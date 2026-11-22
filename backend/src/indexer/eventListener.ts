import { rpc, xdr, scValToNative } from '@stellar/stellar-sdk';
import { Pool } from 'pg';
import { processEvent, ContractEvent, EventBroadcaster } from './processor';
import { CircuitBreaker, CircuitState } from './circuitBreaker';

// ── Decoding ───────────────────────────────────────────────────────────

/** Converts a raw XDR event topic into its native string values */
function decodeEventTopic(topic: xdr.ScVal[]): string[] {
  return topic.map((scVal) => String(scValToNative(scVal)));
}

/** Converts a raw XDR event value into its native JS representation */
function decodeEventValue(value: xdr.ScVal): any {
  return scValToNative(value);
}

/** Converts one raw Soroban RPC event into the ContractEvent shape the processor expects */
function decodeContractEvent(raw: rpc.Api.EventResponse): ContractEvent {
  return {
    contractId: raw.contractId?.contractId() ?? '',
    topic: decodeEventTopic(raw.topic),
    value: decodeEventValue(raw.value),
    ledgerSequence: raw.ledger,
  };
}

/** Converts a batch of raw Soroban RPC events into ContractEvent records */
export function decodeContractEvents(rawEvents: rpc.Api.EventResponse[]): ContractEvent[] {
  return rawEvents.map(decodeContractEvent);
}

// ── Fetching ───────────────────────────────────────────────────────────

const INDEXER_PAGE_SIZE = 100;
const INDEXER_MAX_PAGES = 1000;

/** Fetches contract events in bounded pages, following the RPC cursor. */
export async function fetchContractEvents(
  server: rpc.Server,
  contractIds: string[],
  startLedger: number,
  circuitBreaker?: CircuitBreaker
): Promise<rpc.Api.GetEventsResponse> {
  let cursor: string | undefined;
  let latestLedger = startLedger - 1;
  const events: rpc.Api.EventResponse[] = [];
  const seenCursors = new Set<string>();

  for (let page = 0; page < INDEXER_MAX_PAGES; page++) {
    const fetchFn = () => {
      const request: rpc.Api.GetEventsParams = {
        startLedger,
        filters: [{ type: 'contract', contractIds }],
        limit: INDEXER_PAGE_SIZE,
        ...(cursor ? { cursor } : {}),
      };
      return server.getEvents(request);
    };

    const response = circuitBreaker
      ? await circuitBreaker.execute(fetchFn)
      : await fetchFn();

    events.push(...response.events);
    latestLedger = response.latestLedger;

    if (!response.cursor) {
      return { ...response, events };
    }
    if (seenCursors.has(response.cursor)) {
      throw new Error('RPC pagination cursor did not advance; aborting indexer catch-up pagination');
    }

    seenCursors.add(response.cursor);
    cursor = response.cursor;
  }

  throw new Error(`Indexer catch-up exceeded ${INDEXER_MAX_PAGES} RPC pages; aborting pagination`);
}

// ── Persisting ───────────────────────────────────────────────────────────

/** Hands each decoded event to the processor, in order, so DB writes stay sequential. */
async function persistContractEvents(
  db: Pool,
  events: ContractEvent[],
  broadcast?: EventBroadcaster
): Promise<void> {
  for (const event of events) {
    await processEvent(db, event, broadcast);
  }
}

// ── Poll cycle ───────────────────────────────────────────────────────────

/** Runs one poll cycle, fetching and persisting all event pages for the ledger range. */
export async function runIndexerPollCycle(
  server: rpc.Server,
  db: Pool,
  contractIds: string[],
  startLedger: number,
  broadcast?: EventBroadcaster,
  circuitBreaker?: CircuitBreaker
): Promise<number> {
  const response = await fetchContractEvents(server, contractIds, startLedger, circuitBreaker);
  const events = decodeContractEvents(response.events);

  await persistContractEvents(db, events, broadcast);

  return response.latestLedger + 1;
}

// ── Listener loop ───────────────────────────────────────────────────────────

export interface EventListenerHandle {
  stop: () => void;
}

export interface EventListenerOptions {
  runPollCycle: (startLedger: number) => Promise<number>;
  startLedger: number;
  pollIntervalMs: number;
  onError?: (err: unknown) => void;
}

/** Starts polling for new contract events on a fixed interval. */
export function startEventListener(options: EventListenerOptions): EventListenerHandle {
  let cursor = options.startLedger;
  let stopped = false;

  const tick = async () => {
    if (stopped) return;
    try {
      cursor = await options.runPollCycle(cursor);
    } catch (err) {
      options.onError?.(err);
    }
  };

  const timer = setInterval(tick, options.pollIntervalMs);

  return {
    stop: () => {
      stopped = true;
      clearInterval(timer);
    },
  };
}

// ── Cursor persistence ───────────────────────────────────────────────────
// The listener cursor is persisted to Postgres by startIndexer. It advances only
// after a successful complete poll cycle.
