import { nativeToScVal } from '@stellar/stellar-sdk';
import { StarboundClient } from './client';

export type UnitType = 'Scout' | 'Fighter' | 'Cruiser' | 'Dreadnought';

export interface Fleet {
  scouts: number;
  fighters: number;
  cruisers: number;
  dreadnoughts: number;
  location: number;
  lastMoved: number;
}

export interface UnitCost {
  iron: bigint;
  energy: bigint;
}

/** Returns the resource cost for a given unit type */
export function getUnitCost(unit: UnitType): UnitCost {
  const costs: Record<UnitType, UnitCost> = {
    Scout:        { iron: 10n,  energy: 5n  },
    Fighter:      { iron: 25n,  energy: 15n },
    Cruiser:      { iron: 60n,  energy: 40n },
    Dreadnought:  { iron: 150n, energy: 100n },
  };
  return costs[unit];
}

/** Returns total attack power of a fleet */
export function calculateFleetAttack(fleet: Fleet): number {
  return (
    fleet.scouts * 2 +
    fleet.fighters * 5 +
    fleet.cruisers * 12 +
    fleet.dreadnoughts * 30
  );
}

/** Returns total defense power of a fleet */
export function calculateFleetDefense(fleet: Fleet): number {
  return (
    fleet.scouts * 1 +
    fleet.fighters * 3 +
    fleet.cruisers * 8 +
    fleet.dreadnoughts * 20
  );
}

/** Returns true if a fleet has no units */
export function isFleetEmpty(fleet: Fleet): boolean {
  return (
    fleet.scouts === 0 &&
    fleet.fighters === 0 &&
    fleet.cruisers === 0 &&
    fleet.dreadnoughts === 0
  );
}

/** The raw shape scValToNative produces for the contract's Fleet struct. */
interface RawFleet {
  scouts: number;
  fighters: number;
  cruisers: number;
  dreadnoughts: number;
  location: number;
  last_moved: number;
}

/** Maps the contract's snake_case Fleet field to the SDK's camelCase shape. */
function toFleet(raw: RawFleet): Fleet {
  return {
    scouts: raw.scouts,
    fighters: raw.fighters,
    cruisers: raw.cruisers,
    dreadnoughts: raw.dreadnoughts,
    location: raw.location,
    lastMoved: raw.last_moved,
  };
}

export class FleetClient {
  constructor(private readonly client: StarboundClient) {}

  /** Fetch a player's current fleet from the chain */
  async getFleet(playerAddress: string): Promise<Fleet> {
    const raw = await this.client.simulateReadCall(this.client.contractIds.fleet, 'get_fleet', [
      nativeToScVal(playerAddress, { type: 'address' }),
    ]);
    return toFleet(raw);
  }
}
