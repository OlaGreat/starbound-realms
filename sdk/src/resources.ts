import { Contract } from '@stellar/stellar-sdk';
import { StarboundClient } from './client';

export type ResourceType = 'Iron' | 'Energy' | 'Plasma';

export interface ResourceBalance {
  player: string;
  resource: ResourceType;
  amount: bigint;
}

export class ResourcesClient {
  constructor(private readonly client: StarboundClient) {}

  /** Get a player's balance for a given resource type */
  async getBalance(playerAddress: string, resource: ResourceType): Promise<bigint> {
    // TODO: call resources.balance via Soroban RPC
    throw new Error('getBalance: not yet implemented');
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
