import { useCallback, useEffect, useRef, useState } from 'react';
import { FleetClient, Fleet } from '@starbound-realms/sdk';
import { getStarboundClient } from '../lib/starboundClient';

export interface UseFleetDataResult {
  fleet: Fleet | null;
  isLoading: boolean;
  error: string | null;
  /** Re-reads the fleet — call after a write (building a unit, moving) to refresh the view. */
  refetch: () => Promise<void>;
}

/**
 * Reads a player's fleet directly from the chain via the SDK, rather than
 * through the backend's `/fleet/:address` route — that route is a known
 * hardcoded stub (returns an empty fleet regardless of real data), so going
 * through it would never reflect an actual build or move. Worth switching
 * back to the backend path once that route reads real indexed data.
 */
export function useFleetData(playerAddress: string | null): UseFleetDataResult {
  const [fleet, setFleet] = useState<Fleet | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isMounted = useRef(true);

  const load = useCallback(async () => {
    if (!playerAddress) {
      setFleet(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const client = new FleetClient(getStarboundClient());
      const result = await client.getFleet(playerAddress);
      if (isMounted.current) {
        setFleet(result);
      }
    } catch (err) {
      if (isMounted.current) {
        setError(err instanceof Error ? err.message : String(err));
        setFleet(null);
      }
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
      }
    }
  }, [playerAddress]);

  useEffect(() => {
    isMounted.current = true;
    load();
    return () => {
      isMounted.current = false;
    };
  }, [load]);

  return { fleet, isLoading, error, refetch: load };
}
