import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

const getFleet = vi.fn();

vi.mock('@starbound-realms/sdk', () => ({
  FleetClient: vi.fn().mockImplementation(() => ({ getFleet })),
}));
vi.mock('../lib/starboundClient', () => ({
  getStarboundClient: vi.fn().mockReturnValue({}),
}));

import { useFleetData } from './useFleetData';

const SOME_FLEET = { scouts: 2, fighters: 1, cruisers: 0, dreadnoughts: 0, location: 3, lastMoved: 1000 };

beforeEach(() => {
  getFleet.mockReset();
});

describe('useFleetData', () => {
  it('returns null fleet and does not fetch when no wallet is connected', () => {
    const { result } = renderHook(() => useFleetData(null));

    expect(result.current.fleet).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(getFleet).not.toHaveBeenCalled();
  });

  it('fetches the fleet for the given player once connected', async () => {
    getFleet.mockResolvedValue(SOME_FLEET);

    const { result } = renderHook(() => useFleetData('GPLAYER'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.fleet).toEqual(SOME_FLEET);
    expect(getFleet).toHaveBeenCalledWith('GPLAYER');
  });

  it('sets an error instead of throwing when the read fails', async () => {
    getFleet.mockRejectedValue(new Error('simulation failed'));

    const { result } = renderHook(() => useFleetData('GPLAYER'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toMatch(/simulation failed/);
    expect(result.current.fleet).toBeNull();
  });

  it('clears a stale fleet if a later refetch fails', async () => {
    getFleet.mockResolvedValueOnce(SOME_FLEET).mockRejectedValueOnce(new Error('simulation failed'));

    const { result } = renderHook(() => useFleetData('GPLAYER'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.fleet).toEqual(SOME_FLEET);

    await act(async () => {
      await result.current.refetch();
    });

    expect(result.current.fleet).toBeNull();
    expect(result.current.error).toMatch(/simulation failed/);
  });

  it('refetch re-reads the fleet', async () => {
    getFleet.mockResolvedValueOnce(SOME_FLEET).mockResolvedValueOnce({ ...SOME_FLEET, scouts: 9 });

    const { result } = renderHook(() => useFleetData('GPLAYER'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.fleet?.scouts).toBe(2);

    await act(async () => {
      await result.current.refetch();
    });

    expect(getFleet).toHaveBeenCalledTimes(2);
    expect(result.current.fleet?.scouts).toBe(9);
  });
});
