import { describe, it, expect, vi } from 'vitest';
import { nativeToScVal, rpc, xdr, StrKey } from '@stellar/stellar-sdk';
import { StarboundClient } from './client';

const CONTRACT_ID = StrKey.encodeContract(Buffer.alloc(32, 3));

function makeClient(server: Partial<rpc.Server>): StarboundClient {
  const client = new StarboundClient({
    rpcUrl: 'https://example.invalid',
    networkPassphrase: 'Test SDF Network ; September 2015',
    contractIds: { galaxyMap: CONTRACT_ID, resources: CONTRACT_ID, fleet: CONTRACT_ID, battle: CONTRACT_ID },
  });
  (client as any).server = server;
  return client;
}

function successResponse(retval: xdr.ScVal): rpc.Api.SimulateTransactionSuccessResponse {
  return {
    id: '1',
    latestLedger: 100,
    events: [],
    _parsed: true,
    transactionData: {} as any,
    minResourceFee: '100',
    result: { auth: [], retval },
  };
}

function errorResponse(error: string): rpc.Api.SimulateTransactionErrorResponse {
  return { id: '1', latestLedger: 100, events: [], _parsed: true, error };
}

describe('simulateReadCall', () => {
  it('returns the decoded native value on a successful simulation', async () => {
    const simulateTransaction = vi.fn().mockResolvedValue(successResponse(nativeToScVal(4, { type: 'u32' })));
    const client = makeClient({ simulateTransaction });

    const result = await client.simulateReadCall(CONTRACT_ID, 'get_grid_size');

    expect(result).toBe(4);
  });

  it('passes the given arguments through to the contract call', async () => {
    const simulateTransaction = vi.fn().mockResolvedValue(successResponse(nativeToScVal(0, { type: 'u32' })));
    const client = makeClient({ simulateTransaction });

    await client.simulateReadCall(CONTRACT_ID, 'get_system', [nativeToScVal(3, { type: 'u32' })]);

    expect(simulateTransaction).toHaveBeenCalledTimes(1);
    const tx = simulateTransaction.mock.calls[0][0];
    expect(typeof tx.toXDR).toBe('function');
  });

  it('throws a clear error when the simulation fails', async () => {
    const simulateTransaction = vi.fn().mockResolvedValue(errorResponse('system not found'));
    const client = makeClient({ simulateTransaction });

    await expect(client.simulateReadCall(CONTRACT_ID, 'get_system')).rejects.toThrow('system not found');
  });
});
