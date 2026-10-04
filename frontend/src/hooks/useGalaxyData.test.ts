import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useGalaxyData } from './useGalaxyData';

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});

// Shape exactly as the backend's `SELECT * FROM star_systems` returns it:
// raw Postgres column names (snake_case), and BIGINT columns (last_claimed)
// come back as strings, not numbers, via node-postgres's default type parsing.
function rawSystem(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    system_id: 5,
    owner: 'GOWNER',
    coord_x: 2,
    coord_y: 1,
    resource_type: 'Iron',
    resource_yield: 25,
    defense_rating: 12,
    last_claimed: '1000',
    ...overrides,
  };
}

describe('useGalaxyData', () => {
  it('fetches from /galaxy and maps snake_case fields to the camelCase shape', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ systems: [rawSystem()] }),
    } as Response);

    const { result } = renderHook(() => useGalaxyData('http://backend.example'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(fetch).toHaveBeenCalledWith('http://backend.example/galaxy');
    expect(result.current.systems).toEqual([
      {
        systemId: 5,
        owner: 'GOWNER',
        coordX: 2,
        coordY: 1,
        resourceType: 'Iron',
        resourceYield: 25,
        defenseRating: 12,
        lastClaimed: 1000,
      },
    ]);
  });

  it('converts the stringified BIGINT last_claimed to a number', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ systems: [rawSystem({ last_claimed: '9999999999' })] }),
    } as Response);

    const { result } = renderHook(() => useGalaxyData('http://backend.example'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.systems[0].lastClaimed).toBe(9999999999);
  });

  it('starts with isLoading true and no error', () => {
    vi.mocked(fetch).mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useGalaxyData('http://backend.example'));

    expect(result.current.isLoading).toBe(true);
    expect(result.current.error).toBeNull();
    expect(result.current.systems).toEqual([]);
  });

  it('sets an error and stops loading when the backend responds with a non-OK status', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 500 } as Response);

    const { result } = renderHook(() => useGalaxyData('http://backend.example'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toMatch(/500/);
    expect(result.current.systems).toEqual([]);
  });

  it('sets an error instead of throwing when the network request fails', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('network down'));

    const { result } = renderHook(() => useGalaxyData('http://backend.example'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toMatch(/network down/);
  });
});

describe('useGalaxyData refetch', () => {
  it('re-fetches and replaces the systems list when called', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ systems: [rawSystem({ system_id: 1 })] }) } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ systems: [rawSystem({ system_id: 2 })] }) } as Response);

    const { result } = renderHook(() => useGalaxyData('http://backend.example'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.systems[0].systemId).toBe(1);

    await act(async () => {
      await result.current.refetch();
    });

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(result.current.systems[0].systemId).toBe(2);
  });
});
