import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Contract, Keypair, StrKey, nativeToScVal, rpc } from '@stellar/stellar-sdk';
import {
  decodeContractEvents,
  fetchContractEvents,
  runIndexerPollCycle,
  startEventListener,
} from './eventListener';

vi.mock('./processor', () => ({
  processEvent: vi.fn(),
}));

import { processEvent } from './processor';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const CONTRACT_ID = StrKey.encodeContract(Buffer.alloc(32, 1));
const PLAYER = Keypair.random().publicKey();

function makeRawEvent(overrides: Partial<rpc.Api.EventResponse> = {}): rpc.Api.EventResponse {
  return {
    id: '1-1',
    type: 'contract',
    ledger: 100,
    ledgerClosedAt: new Date().toISOString(),
    pagingToken: '1-1',
    inSuccessfulContractCall: true,
    txHash: 'deadbeef',
    contractId: new Contract(CONTRACT_ID),
    topic: [
      nativeToScVal('claimed', { type: 'symbol' }),
      nativeToScVal(PLAYER, { type: 'address' }),
    ],
    value: nativeToScVal(7, { type: 'u32' }),
    ...overrides,
  };
}

// ── decodeContractEvents ─────────────────────────────────────────────────────

describe('decodeContractEvents', () => {
  it('decodes topic symbols and addresses to native strings', () => {
    const [decoded] = decodeContractEvents([makeRawEvent()]);
    expect(decoded.topic).toEqual(['claimed', PLAYER]);
  });

  it('decodes the event value to its native type', () => {
    const [decoded] = decodeContractEvents([makeRawEvent()]);
    expect(decoded.value).toBe(7);
  });

  it('carries the contract id and ledger sequence through', () => {
    const [decoded] = decodeContractEvents([makeRawEvent({ ledger: 555 })]);
    expect(decoded.contractId).toBe(CONTRACT_ID);
    expect(decoded.ledgerSequence).toBe(555);
  });

  it('decodes an empty list to an empty list', () => {
    expect(decodeContractEvents([])).toEqual([]);
  });
});

// ── fetchContractEvents ──────────────────────────────────────────────────────

describe('fetchContractEvents', () => {
  it('requests contract-type events for the given contract ids starting at the given ledger', async () => {
    const getEvents = vi.fn().mockResolvedValue({ events: [], latestLedger: 100 });
    const server = { getEvents } as unknown as rpc.Server;

    await fetchContractEvents(server, [CONTRACT_ID], 50);

    expect(getEvents).toHaveBeenCalledWith({
      startLedger: 50,
      filters: [{ type: 'contract', contractIds: [CONTRACT_ID] }],
    });
  });
});

// ── runIndexerPollCycle ──────────────────────────────────────────────────────

describe('runIndexerPollCycle', () => {
  beforeEach(() => {
    vi.mocked(processEvent).mockClear();
  });

  it('persists every decoded event via the processor', async () => {
    const rawEvent = makeRawEvent();
    const server = {
      getEvents: vi.fn().mockResolvedValue({ events: [rawEvent], latestLedger: 100 }),
    } as unknown as rpc.Server;
    const db = {} as any;

    await runIndexerPollCycle(server, db, [CONTRACT_ID], 1);

    expect(processEvent).toHaveBeenCalledTimes(1);
    expect(processEvent).toHaveBeenCalledWith(db, expect.objectContaining({ contractId: CONTRACT_ID }));
  });

  it('returns the ledger to resume from on the next cycle', async () => {
    const server = {
      getEvents: vi.fn().mockResolvedValue({ events: [], latestLedger: 200 }),
    } as unknown as rpc.Server;

    const nextLedger = await runIndexerPollCycle(server, {} as any, [CONTRACT_ID], 1);

    expect(nextLedger).toBe(201);
  });
});

// ── startEventListener ───────────────────────────────────────────────────────

describe('startEventListener', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('advances the cursor returned by each poll cycle', async () => {
    const runPollCycle = vi.fn().mockResolvedValueOnce(11).mockResolvedValueOnce(21);

    startEventListener({ runPollCycle, startLedger: 1, pollIntervalMs: 1000 });

    await vi.advanceTimersByTimeAsync(1000);
    expect(runPollCycle).toHaveBeenNthCalledWith(1, 1);

    await vi.advanceTimersByTimeAsync(1000);
    expect(runPollCycle).toHaveBeenNthCalledWith(2, 11);

    vi.useRealTimers();
  });

  it('stops polling once stop() is called', async () => {
    const runPollCycle = vi.fn().mockResolvedValue(1);
    const { stop } = startEventListener({ runPollCycle, startLedger: 1, pollIntervalMs: 1000 });

    stop();
    await vi.advanceTimersByTimeAsync(5000);

    expect(runPollCycle).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('reports errors from a failed poll cycle without stopping the loop', async () => {
    const onError = vi.fn();
    const runPollCycle = vi.fn().mockRejectedValueOnce(new Error('rpc down')).mockResolvedValueOnce(11);

    startEventListener({ runPollCycle, startLedger: 1, pollIntervalMs: 1000, onError });

    await vi.advanceTimersByTimeAsync(1000);
    expect(onError).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1000);
    expect(runPollCycle).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });
});
