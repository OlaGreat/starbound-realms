import { describe, it, expect, vi } from 'vitest';
import { Keypair, Operation, scValToNative, xdr } from '@stellar/stellar-sdk';
import { ResourcesClient, resourceTypeToScVal, buildTrustlineKey, RESOURCE_ASSET_CODES } from './resources';

const PLAYER = Keypair.random().publicKey();

function makeClient(simulateReadCall: ReturnType<typeof vi.fn>): any {
  return { simulateReadCall, contractIds: { resources: 'CRESOURCES' } };
}

describe('resourceTypeToScVal', () => {
  it('encodes a resource as a one-symbol vec, the way Soroban encodes a unit enum variant', () => {
    const scVal = resourceTypeToScVal('Energy');

    expect(scVal.switch()).toBe(xdr.ScValType.scvVec());
    expect(scValToNative(scVal)).toEqual(['Energy']);
  });
});

describe('ResourcesClient.getBalance', () => {
  it('calls balance with the player address and resource type and returns the bigint', async () => {
    const simulateReadCall = vi.fn().mockResolvedValue(250n);
    const resources = new ResourcesClient(makeClient(simulateReadCall));

    const balance = await resources.getBalance(PLAYER, 'Iron');

    expect(balance).toBe(250n);
    expect(simulateReadCall).toHaveBeenCalledWith('CRESOURCES', 'balance', [
      expect.anything(),
      expect.anything(),
    ]);
    const args = simulateReadCall.mock.calls[0][2];
    expect(scValToNative(args[0])).toBe(PLAYER);
    expect(scValToNative(args[1])).toEqual(['Iron']);
  });
});

describe('ResourcesClient.getAllBalances', () => {
  it('returns each resource under its own key', async () => {
    const balanceByResource: Record<string, bigint> = { Iron: 1n, Energy: 20n, Plasma: 300n };
    const simulateReadCall = vi.fn().mockImplementation(async (_id, _method, args) => {
      const [resource] = scValToNative(args[1]);
      return balanceByResource[resource];
    });
    const resources = new ResourcesClient(makeClient(simulateReadCall));

    const balances = await resources.getAllBalances(PLAYER);

    expect(balances).toEqual({ Iron: 1n, Energy: 20n, Plasma: 300n });
  });
});

// ── trustlines ───────────────────────────────────────────────────────────────

const ISSUER = Keypair.random().publicKey();

/** A ledger entry as getLedgerEntries returns it, for an existing trustline. */
function existingTrustline(code: string) {
  return { key: buildTrustlineKey(PLAYER, code, ISSUER) };
}

function trustlineClient(existingCodes: string[], submitClassicTransaction = vi.fn().mockResolvedValue({})) {
  const getLedgerEntries = vi.fn().mockResolvedValue({ entries: existingCodes.map(existingTrustline) });
  return {
    client: { server: { getLedgerEntries }, submitClassicTransaction, contractIds: { resources: 'CRESOURCES' } } as any,
    getLedgerEntries,
    submitClassicTransaction,
  };
}

describe('RESOURCE_ASSET_CODES', () => {
  it('matches the asset codes documented in the README', () => {
    expect(RESOURCE_ASSET_CODES).toEqual(['IRON', 'NRGY', 'PLSM']);
  });
});

describe('buildTrustlineKey', () => {
  it('builds a trustline ledger key for the player and the given asset', () => {
    const key = buildTrustlineKey(PLAYER, 'IRON', ISSUER);

    expect(key.switch()).toBe(xdr.LedgerEntryType.trustline());
    expect(Keypair.fromPublicKey(PLAYER).xdrAccountId().toXDR('base64')).toBe(
      key.trustLine().accountId().toXDR('base64')
    );
    expect(key.trustLine().asset().alphaNum4().assetCode().toString()).toBe('IRON');
  });
});

describe('ResourcesClient.findMissingTrustlines', () => {
  it('returns every resource code when the player has no trustlines', async () => {
    const { client } = trustlineClient([]);

    await expect(new ResourcesClient(client).findMissingTrustlines(PLAYER, ISSUER)).resolves.toEqual([
      'IRON',
      'NRGY',
      'PLSM',
    ]);
  });

  it('returns only the codes the player has no trustline for', async () => {
    const { client } = trustlineClient(['IRON', 'NRGY']);

    await expect(new ResourcesClient(client).findMissingTrustlines(PLAYER, ISSUER)).resolves.toEqual(['PLSM']);
  });

  it('returns nothing when all trustlines exist', async () => {
    const { client } = trustlineClient(['IRON', 'NRGY', 'PLSM']);

    await expect(new ResourcesClient(client).findMissingTrustlines(PLAYER, ISSUER)).resolves.toEqual([]);
  });

  it('asks the ledger about all three trustlines in one request', async () => {
    const { client, getLedgerEntries } = trustlineClient([]);

    await new ResourcesClient(client).findMissingTrustlines(PLAYER, ISSUER);

    expect(getLedgerEntries).toHaveBeenCalledTimes(1);
    expect(getLedgerEntries.mock.calls[0]).toHaveLength(3);
  });
});

describe('ResourcesClient.establishTrustlines', () => {
  function submittedCodes(submit: ReturnType<typeof vi.fn>): string[] {
    return submit.mock.calls[0][0].operations.map((op: xdr.Operation) => {
      const decoded = Operation.fromXDRObject(op) as any;
      expect(decoded.type).toBe('changeTrust');
      expect(decoded.line.issuer).toBe(ISSUER);
      return decoded.line.code;
    });
  }

  it('submits a ChangeTrust for each missing resource, in one transaction signed by the player', async () => {
    const { client, submitClassicTransaction } = trustlineClient(['NRGY']);
    const sign = vi.fn();

    await new ResourcesClient(client).establishTrustlines(PLAYER, ISSUER, sign);

    expect(submitClassicTransaction).toHaveBeenCalledTimes(1);
    expect(submitClassicTransaction.mock.calls[0][0].sourceAddress).toBe(PLAYER);
    expect(submitClassicTransaction.mock.calls[0][0].sign).toBe(sign);
    expect(submittedCodes(submitClassicTransaction)).toEqual(['IRON', 'PLSM']);
  });

  it('submits nothing when every trustline already exists', async () => {
    const { client, submitClassicTransaction } = trustlineClient(['IRON', 'NRGY', 'PLSM']);

    await new ResourcesClient(client).establishTrustlines(PLAYER, ISSUER, vi.fn());

    expect(submitClassicTransaction).not.toHaveBeenCalled();
  });
});
