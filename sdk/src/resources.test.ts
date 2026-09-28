import { describe, it, expect, vi } from 'vitest';
import { Keypair, scValToNative, xdr } from '@stellar/stellar-sdk';
import { ResourcesClient, resourceTypeToScVal } from './resources';

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
