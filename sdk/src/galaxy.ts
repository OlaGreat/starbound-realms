import { Contract, Address, xdr } from '@stellar/stellar-sdk';
import { StarboundClient } from './client';

export interface StarSystem {
  systemId: number;
  owner: string | null;
  coordX: number;
  coordY: number;
  resourceType: 'Iron' | 'Energy' | 'Plasma';
  resourceYield: number;
  defenseRating: number;
  lastClaimed: number;
}

export class GalaxyClient {
  constructor(private readonly client: StarboundClient) {}

  /** Fetch a single star system by ID from the chain */
  async getSystem(systemId: number): Promise<StarSystem> {
    const contract = new Contract(this.client.contractIds.galaxyMap);
    const result = await this.client.server.simulateTransaction(
      // TODO: build full transaction envelope — contributor task
      // See docs/engineering-guidelines.md for TDD approach
      null as any
    );
    throw new Error('getSystem: not yet implemented — see contracts/galaxy-map');
  }

  /** Fetch all system IDs owned by a player address */
  async getPlayerSystems(playerAddress: string): Promise<number[]> {
    // TODO: cross-contract call to galaxy-map.get_player_systems
    throw new Error('getPlayerSystems: not yet implemented');
  }

  /** Fetch the galaxy grid size */
  async getGridSize(): Promise<number> {
    // TODO: call galaxy-map.get_grid_size
    throw new Error('getGridSize: not yet implemented');
  }
}
