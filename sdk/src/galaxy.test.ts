import { describe, it, expect, vi } from 'vitest';
import { Keypair, StrKey } from '@stellar/stellar-sdk';
import { GalaxyClient } from './galaxy';
import { StarboundClient } from './client';

const PLAYER = Keypair.random().publicKey();
const GALAXY_MAP = StrKey.encodeContract(Buffer.alloc(32, 6));

function makeClient(overrides: Record<string, ReturnType<typeof vi.fn>>): StarboundClient {
  return { contractIds: { galaxyMap: GALAXY_MAP }, ...overrides } as unknown as StarboundClient;
}

describe('getGridSize', () => {
  it('calls get_grid_size on the galaxy-map contract and returns the number', async () => {
    const simulateReadCall = vi.fn().mockResolvedValue(20);
    const galaxy = new GalaxyClient(makeClient({ simulateReadCall }));

    const size = await galaxy.getGridSize();

    expect(size).toBe(20);
    expect(simulateReadCall).toHaveBeenCalledWith(GALAXY_MAP, 'get_grid_size', []);
  });
});

describe('getPlayerSystems', () => {
  it('calls get_player_systems with the player address and returns the id list', async () => {
    const simulateReadCall = vi.fn().mockResolvedValue([2, 5, 9]);
    const galaxy = new GalaxyClient(makeClient({ simulateReadCall }));

    const systems = await galaxy.getPlayerSystems(PLAYER);

    expect(systems).toEqual([2, 5, 9]);
    expect(simulateReadCall).toHaveBeenCalledWith(GALAXY_MAP, 'get_player_systems', [expect.anything()]);
  });
});

describe('getSystem', () => {
  it('maps the contract\'s snake_case StarSystem fields to the SDK\'s camelCase shape', async () => {
    // Shape exactly as scValToNative would decode the real Rust struct —
    // field names are the struct's own, not a JS naming convention.
    const simulateReadCall = vi.fn().mockResolvedValue({
      owner: 'GOWNER',
      coord_x: 3,
      coord_y: 1,
      resource_type: 'Iron',
      resource_yield: 25,
      defense_rating: 12,
      last_claimed: 1000n,
    });
    const galaxy = new GalaxyClient(makeClient({ simulateReadCall }));

    const system = await galaxy.getSystem(7);

    expect(system).toEqual({
      systemId: 7,
      owner: 'GOWNER',
      coordX: 3,
      coordY: 1,
      resourceType: 'Iron',
      resourceYield: 25,
      defenseRating: 12,
      lastClaimed: 1000,
    });
  });

  it('maps an unclaimed system\'s null owner to null', async () => {
    const simulateReadCall = vi.fn().mockResolvedValue({
      owner: null,
      coord_x: 0,
      coord_y: 0,
      resource_type: 'Plasma',
      resource_yield: 10,
      defense_rating: 5,
      last_claimed: 0n,
    });
    const galaxy = new GalaxyClient(makeClient({ simulateReadCall }));

    const system = await galaxy.getSystem(0);

    expect(system.owner).toBeNull();
  });

  it('calls get_system with the system id', async () => {
    const simulateReadCall = vi.fn().mockResolvedValue({
      owner: null,
      coord_x: 0,
      coord_y: 0,
      resource_type: 'Iron',
      resource_yield: 10,
      defense_rating: 5,
      last_claimed: 0n,
    });
    const galaxy = new GalaxyClient(makeClient({ simulateReadCall }));

    await galaxy.getSystem(3);

    expect(simulateReadCall).toHaveBeenCalledWith(GALAXY_MAP, 'get_system', [expect.anything()]);
  });
});

describe('claimSystem', () => {
  it('submits a claim_system call for the given player and system', async () => {
    const submitTransaction = vi.fn().mockResolvedValue({ status: 'SUCCESS' });
    const galaxy = new GalaxyClient(makeClient({ submitTransaction }));
    const sign = vi.fn();

    await galaxy.claimSystem(PLAYER, 3, sign);

    expect(submitTransaction).toHaveBeenCalledTimes(1);
    const options = submitTransaction.mock.calls[0][0];
    expect(options.sourceAddress).toBe(PLAYER);
    expect(options.sign).toBe(sign);
  });
});
