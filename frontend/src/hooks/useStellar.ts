import { useCallback, useEffect, useState } from 'react';
import {
  isConnected as freighterIsConnected,
  requestAccess as freighterRequestAccess,
  signTransaction as freighterSignTransaction,
} from '@stellar/freighter-api';

/** Checks Freighter's connection status without throwing if it's unavailable. */
export async function checkIsWalletConnected(): Promise<boolean> {
  try {
    return await freighterIsConnected();
  } catch {
    return false;
  }
}

/** Requests wallet access and returns the player's address. */
export async function fetchWalletAddress(): Promise<string> {
  let address: string;
  try {
    address = await freighterRequestAccess();
  } catch (err) {
    throw new Error('Freighter access request was declined');
  }

  if (!address) {
    throw new Error('Freighter is not installed or not available');
  }

  return address;
}

/** Signs a transaction XDR with Freighter and returns the signed XDR. */
export async function signTransactionWithFreighter(xdr: string, networkPassphrase: string): Promise<string> {
  return freighterSignTransaction(xdr, { networkPassphrase });
}

export interface UseStellarResult {
  walletAddress: string | null;
  isConnected: boolean;
  error: string | null;
  connectWallet: () => Promise<void>;
  signTransaction: (xdr: string, networkPassphrase: string) => Promise<string>;
}

/** Tracks Freighter wallet connection state for use in components. */
export function useStellar(): UseStellarResult {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connectWallet = useCallback(async () => {
    setError(null);
    try {
      const address = await fetchWalletAddress();
      setWalletAddress(address);
      setIsConnected(true);
    } catch (err) {
      setWalletAddress(null);
      setIsConnected(false);
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  // Pick up an already-connected wallet on mount, so returning players don't
  // need to click Connect again every page load.
  useEffect(() => {
    checkIsWalletConnected().then((connected) => {
      if (connected) {
        connectWallet();
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { walletAddress, isConnected, error, connectWallet, signTransaction: signTransactionWithFreighter };
}
