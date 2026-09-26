import { nativeToScVal } from '@stellar/stellar-sdk';
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

/** The raw shape scValToNative produces for the contract's StarSystem struct. */
interface RawStarSystem {
  owner: string | null;
  coord_x: number;
  coord_y: number;
  resource_type: 'Iron' | 'Energy' | 'Plasma';
  resource_yield: number;
  defense_rating: number;
  last_claimed: number;
}

/** Maps the contract's snake_case StarSystem fields to the SDK's camelCase shape. */
function toStarSystem(systemId: number, raw: RawStarSystem): StarSystem {
  return {
    systemId,
    owner: raw.owner,
    coordX: raw.coord_x,
    coordY: raw.coord_y,
    resourceType: raw.resource_type,
    resourceYield: raw.resource_yield,
    defenseRating: raw.defense_rating,
    lastClaimed: raw.last_claimed,
  };
}

export class GalaxyClient {
  constructor(private readonly client: StarboundClient) {}

  /** Fetch a single star system by ID from the chain */
  async getSystem(systemId: number): Promise<StarSystem> {
    const raw = await this.client.simulateReadCall(this.client.contractIds.galaxyMap, 'get_system', [
      nativeToScVal(systemId, { type: 'u32' }),
    ]);
    return toStarSystem(systemId, raw);
  }

  /** Fetch all system IDs owned by a player address */
  async getPlayerSystems(playerAddress: string): Promise<number[]> {
    return this.client.simulateReadCall(this.client.contractIds.galaxyMap, 'get_player_systems', [
      nativeToScVal(playerAddress, { type: 'address' }),
    ]);
  }

  /** Fetch the galaxy grid size */
  async getGridSize(): Promise<number> {
    return this.client.simulateReadCall(this.client.contractIds.galaxyMap, 'get_grid_size', []);
  }
}
