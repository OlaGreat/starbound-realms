import { describe, it, expect, vi } from 'vitest';
import { Keypair } from '@stellar/stellar-sdk';
import {
  getUnitCost,
  calculateFleetAttack,
  calculateFleetDefense,
  isFleetEmpty,
  Fleet,
  FleetClient,
} from './fleet';

// ── getUnitCost ───────────────────────────────────────────────────────────────

describe('getUnitCost', () => {
  it('returns correct cost for Scout', () => {
    const cost = getUnitCost('Scout');
    expect(cost.iron).toBe(10n);
    expect(cost.energy).toBe(5n);
  });

  it('returns correct cost for Fighter', () => {
    const cost = getUnitCost('Fighter');
    expect(cost.iron).toBe(25n);
    expect(cost.energy).toBe(15n);
  });

  it('returns correct cost for Cruiser', () => {
    const cost = getUnitCost('Cruiser');
    expect(cost.iron).toBe(60n);
    expect(cost.energy).toBe(40n);
  });

  it('returns correct cost for Dreadnought', () => {
    const cost = getUnitCost('Dreadnought');
    expect(cost.iron).toBe(150n);
    expect(cost.energy).toBe(100n);
  });
});

// ── calculateFleetAttack ──────────────────────────────────────────────────────

describe('calculateFleetAttack', () => {
  it('returns 0 for an empty fleet', () => {
    const fleet = emptyFleet();
    expect(calculateFleetAttack(fleet)).toBe(0);
  });

  it('calculates attack for scouts only', () => {
    const fleet = { ...emptyFleet(), scouts: 3 };
    expect(calculateFleetAttack(fleet)).toBe(6); // 3 * 2
  });

  it('calculates attack for mixed fleet', () => {
    const fleet = { ...emptyFleet(), scouts: 1, fighters: 1, cruisers: 1, dreadnoughts: 1 };
    expect(calculateFleetAttack(fleet)).toBe(49); // 2 + 5 + 12 + 30
  });

  it('calculates attack for dreadnoughts only', () => {
    const fleet = { ...emptyFleet(), dreadnoughts: 2 };
    expect(calculateFleetAttack(fleet)).toBe(60); // 2 * 30
  });
});

// ── calculateFleetDefense ─────────────────────────────────────────────────────

describe('calculateFleetDefense', () => {
  it('returns 0 for an empty fleet', () => {
    const fleet = emptyFleet();
    expect(calculateFleetDefense(fleet)).toBe(0);
  });

  it('calculates defense for fighters only', () => {
    const fleet = { ...emptyFleet(), fighters: 4 };
    expect(calculateFleetDefense(fleet)).toBe(12); // 4 * 3
  });

  it('calculates defense for mixed fleet', () => {
    const fleet = { ...emptyFleet(), scouts: 1, fighters: 1, cruisers: 1, dreadnoughts: 1 };
    expect(calculateFleetDefense(fleet)).toBe(32); // 1 + 3 + 8 + 20
  });
});

// ── isFleetEmpty ──────────────────────────────────────────────────────────────

describe('isFleetEmpty', () => {
  it('returns true when fleet has no units', () => {
    expect(isFleetEmpty(emptyFleet())).toBe(true);
  });

  it('returns false when fleet has scouts', () => {
    expect(isFleetEmpty({ ...emptyFleet(), scouts: 1 })).toBe(false);
  });

  it('returns false when fleet has only dreadnoughts', () => {
    expect(isFleetEmpty({ ...emptyFleet(), dreadnoughts: 1 })).toBe(false);
  });
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function emptyFleet(): Fleet {
  return {
    scouts: 0,
    fighters: 0,
    cruisers: 0,
    dreadnoughts: 0,
    location: 0,
    lastMoved: 0,
  };
}

// ── FleetClient.getFleet ─────────────────────────────────────────────────────

const PLAYER = Keypair.random().publicKey();

function makeClient(simulateReadCall: ReturnType<typeof vi.fn>): any {
  return { simulateReadCall, contractIds: { fleet: 'CFLEET' } };
}

describe('FleetClient.getFleet', () => {
  it("maps the contract's snake_case last_moved field to the SDK's camelCase shape", async () => {
    const simulateReadCall = vi.fn().mockResolvedValue({
      scouts: 2,
      fighters: 1,
      cruisers: 0,
      dreadnoughts: 0,
      location: 5,
      last_moved: 1000,
    });
    const fleetClient = new FleetClient(makeClient(simulateReadCall));

    const fleet = await fleetClient.getFleet(PLAYER);

    expect(fleet).toEqual({
      scouts: 2,
      fighters: 1,
      cruisers: 0,
      dreadnoughts: 0,
      location: 5,
      lastMoved: 1000,
    });
  });

  it('calls get_fleet with the player address', async () => {
    const simulateReadCall = vi.fn().mockResolvedValue({
      scouts: 0, fighters: 0, cruisers: 0, dreadnoughts: 0, location: 0, last_moved: 0,
    });
    const fleetClient = new FleetClient(makeClient(simulateReadCall));

    await fleetClient.getFleet(PLAYER);

    expect(simulateReadCall).toHaveBeenCalledWith('CFLEET', 'get_fleet', [expect.anything()]);
  });
});
