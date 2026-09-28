import { nativeToScVal, xdr } from '@stellar/stellar-sdk';
import { StarboundClient } from './client';

export type ResourceType = 'Iron' | 'Energy' | 'Plasma';

export interface ResourceBalance {
  player: string;
  resource: ResourceType;
  amount: bigint;
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
}
