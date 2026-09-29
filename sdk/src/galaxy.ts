import { Contract, nativeToScVal } from '@stellar/stellar-sdk';
import { StarboundClient, TransactionSigner } from './client';

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
  last_claimed: bigint; // u64 decodes to bigint
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
    lastClaimed: Number(raw.last_claimed),
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

  /** Claim an unclaimed star system as the given player. */
  async claimSystem(playerAddress: string, systemId: number, sign: TransactionSigner): Promise<void> {
    const contract = new Contract(this.client.contractIds.galaxyMap);
    await this.client.submitTransaction({
      sourceAddress: playerAddress,
      operation: contract.call(
        'claim_system',
        nativeToScVal(playerAddress, { type: 'address' }),
        nativeToScVal(systemId, { type: 'u32' })
      ),
      sign,
    });
  }
}
