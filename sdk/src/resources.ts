import { Asset, Keypair, nativeToScVal, Operation, xdr } from '@stellar/stellar-sdk';
import { StarboundClient, TransactionSigner } from './client.js';

export type ResourceType = 'Iron' | 'Energy' | 'Plasma';

export interface ResourceBalance {
  player: string;
  resource: ResourceType;
  amount: bigint;
}

/**
 * The classic Stellar asset codes behind each resource. Players must hold a
 * trustline to each one before they can receive it, since these are real
 * classic assets wrapped as Stellar Asset Contracts, not Soroban-native tokens.
 */
export const RESOURCE_ASSET_CODES = ['IRON', 'NRGY', 'PLSM'] as const;

/** Builds the ledger key identifying a player's trustline to one resource asset. */
export function buildTrustlineKey(playerAddress: string, assetCode: string, issuer: string): xdr.LedgerKey {
  return xdr.LedgerKey.trustline(
    new xdr.LedgerKeyTrustLine({
      accountId: Keypair.fromPublicKey(playerAddress).xdrAccountId(),
      asset: new Asset(assetCode, issuer).toTrustLineXDRObject(),
    })
  );
}

/** Encodes a resource as Soroban does a unit enum variant: a vec holding the variant name as a symbol. */
export function resourceTypeToScVal(resource: ResourceType): xdr.ScVal {
  return xdr.ScVal.scvVec([xdr.ScVal.scvSymbol(resource)]);
}

export class ResourcesClient {
  constructor(private readonly client: StarboundClient) {}

  /** Get a player's balance for a given resource type */
  async getBalance(playerAddress: string, resource: ResourceType): Promise<bigint> {
    return this.client.simulateReadCall(this.client.contractIds.resources, 'balance', [
      nativeToScVal(playerAddress, { type: 'address' }),
      resourceTypeToScVal(resource),
    ]);
  }

  /** Get all three resource balances for a player in one call */
  async getAllBalances(playerAddress: string): Promise<Record<ResourceType, bigint>> {
    const [iron, energy, plasma] = await Promise.all([
      this.getBalance(playerAddress, 'Iron'),
      this.getBalance(playerAddress, 'Energy'),
      this.getBalance(playerAddress, 'Plasma'),
    ]);
    return { Iron: iron, Energy: energy, Plasma: plasma };
  }

  /** Returns the resource asset codes the player has no trustline for yet. */
  async findMissingTrustlines(playerAddress: string, issuer: string): Promise<string[]> {
    const keys = RESOURCE_ASSET_CODES.map((code) => buildTrustlineKey(playerAddress, code, issuer));
    const { entries } = await this.client.server.getLedgerEntries(...keys);
    const existing = new Set(entries.map((entry) => entry.key.toXDR('base64')));
    return RESOURCE_ASSET_CODES.filter((code, i) => !existing.has(keys[i].toXDR('base64')));
  }

  /**
   * Establishes the player's trustlines to every resource asset they don't
   * already trust, in a single transaction. Does nothing if none are missing,
   * so it's safe to call on every wallet connect.
   */
  async establishTrustlines(playerAddress: string, issuer: string, sign: TransactionSigner): Promise<void> {
    const missing = await this.findMissingTrustlines(playerAddress, issuer);
    if (missing.length === 0) {
      return;
    }
    await this.client.submitClassicTransaction({
      sourceAddress: playerAddress,
      operations: missing.map((code) => Operation.changeTrust({ asset: new Asset(code, issuer) })),
      sign,
    });
  }
}
