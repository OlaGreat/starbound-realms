import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../db/queries', () => ({
  upsertStarSystem: vi.fn(),
  saveBattle: vi.fn(),
  incrementPlayerSystemsOwned: vi.fn(),
  decrementPlayerSystemsOwned: vi.fn(),
}));

import {
  upsertStarSystem,
  saveBattle,
  incrementPlayerSystemsOwned,
  decrementPlayerSystemsOwned,
} from '../db/queries';
import { processEvent, ContractEvent } from './processor';

const db = {} as any;

beforeEach(() => {
  vi.mocked(upsertStarSystem).mockClear();
  vi.mocked(saveBattle).mockClear();
  vi.mocked(incrementPlayerSystemsOwned).mockClear();
  vi.mocked(decrementPlayerSystemsOwned).mockClear();
});

describe('processEvent — claimed', () => {
  it('upserts the star system and increments the owner\'s systems owned', async () => {
    const event: ContractEvent = {
      contractId: 'C1',
      topic: ['claimed', 'GPLAYER'],
      value: 7,
      ledgerSequence: 100,
    };

    await processEvent(db, event);

    expect(upsertStarSystem).toHaveBeenCalledWith(db, 7, 'GPLAYER', 100);
    expect(incrementPlayerSystemsOwned).toHaveBeenCalledWith(db, 'GPLAYER');
  });
});

describe('processEvent — transfer', () => {
  it('passes a numeric system id to upsertStarSystem', async () => {
    const event: ContractEvent = {
      contractId: 'C1',
      topic: ['transfer', '42'],
      value: ['GOLD', 'GNEW'],
      ledgerSequence: 200,
    };

    await processEvent(db, event);

    expect(upsertStarSystem).toHaveBeenCalledWith(db, 42, 'GNEW', 200);
    expect(typeof vi.mocked(upsertStarSystem).mock.calls[0][1]).toBe('number');
  });

  it('decrements the old owner and increments the new owner', async () => {
    const event: ContractEvent = {
      contractId: 'C1',
      topic: ['transfer', '42'],
      value: ['GOLD', 'GNEW'],
      ledgerSequence: 200,
    };

    await processEvent(db, event);

    expect(decrementPlayerSystemsOwned).toHaveBeenCalledWith(db, 'GOLD');
    expect(incrementPlayerSystemsOwned).toHaveBeenCalledWith(db, 'GNEW');
  });

  it('skips decrementing when there was no previous owner', async () => {
    const event: ContractEvent = {
      contractId: 'C1',
      topic: ['transfer', '42'],
      value: [null, 'GNEW'],
      ledgerSequence: 200,
    };

    await processEvent(db, event);

    expect(decrementPlayerSystemsOwned).not.toHaveBeenCalled();
  });
});

describe('processEvent — battle_resolved', () => {
  it('saves the battle record', async () => {
    const event: ContractEvent = {
      contractId: 'C1',
      topic: ['battle_resolved'],
      value: {
        battleId: 5,
        attacker: 'GATTACKER',
        defender: 'GDEFENDER',
        systemId: 9,
        winner: 'GATTACKER',
        rounds: 3,
      },
      ledgerSequence: 300,
    };

    await processEvent(db, event);

    expect(saveBattle).toHaveBeenCalledWith(db, 5, 'GATTACKER', 'GDEFENDER', 9, 'GATTACKER', 3, 300);
  });
});

describe('processEvent — unknown topic', () => {
  it('skips silently without calling any handler', async () => {
    const event: ContractEvent = {
      contractId: 'C1',
      topic: ['minted'],
      value: {},
      ledgerSequence: 400,
    };

    await processEvent(db, event);

    expect(upsertStarSystem).not.toHaveBeenCalled();
    expect(saveBattle).not.toHaveBeenCalled();
    expect(incrementPlayerSystemsOwned).not.toHaveBeenCalled();
  });
});
