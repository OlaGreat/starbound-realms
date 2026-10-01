import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

vi.mock('@stellar/freighter-api', () => ({
  isConnected: vi.fn(),
  requestAccess: vi.fn(),
  signTransaction: vi.fn(),
}));

import { isConnected, requestAccess, signTransaction } from '@stellar/freighter-api';
import { checkIsWalletConnected, fetchWalletAddress, signTransactionWithFreighter, useStellar } from './useStellar';

beforeEach(() => {
  vi.mocked(isConnected).mockReset();
  vi.mocked(requestAccess).mockReset();
  vi.mocked(signTransaction).mockReset();
});

// ── checkIsWalletConnected ──────────────────────────────────────────────────

describe('checkIsWalletConnected', () => {
  it('returns true when Freighter reports connected', async () => {
    vi.mocked(isConnected).mockResolvedValue(true);

    await expect(checkIsWalletConnected()).resolves.toBe(true);
  });

  it('returns false when Freighter reports not connected', async () => {
    vi.mocked(isConnected).mockResolvedValue(false);

    await expect(checkIsWalletConnected()).resolves.toBe(false);
  });

  it('returns false instead of throwing when Freighter is not installed', async () => {
    vi.mocked(isConnected).mockRejectedValue(new Error('Freighter not installed'));

    await expect(checkIsWalletConnected()).resolves.toBe(false);
  });
});

// ── fetchWalletAddress ───────────────────────────────────────────────────────

describe('fetchWalletAddress', () => {
  it("returns the player's address on success", async () => {
    vi.mocked(requestAccess).mockResolvedValue('GPLAYERADDRESS');

    await expect(fetchWalletAddress()).resolves.toBe('GPLAYERADDRESS');
  });

  it('throws a clear error when Freighter returns an empty address', async () => {
    vi.mocked(requestAccess).mockResolvedValue('');

    await expect(fetchWalletAddress()).rejects.toThrow(/not installed|not available/i);
  });

  it('throws a clear error when the user rejects the access request', async () => {
    vi.mocked(requestAccess).mockRejectedValue(new Error('User declined access'));

    await expect(fetchWalletAddress()).rejects.toThrow(/declined|denied|rejected/i);
  });
});

// ── signTransactionWithFreighter ─────────────────────────────────────────────

describe('signTransactionWithFreighter', () => {
  it('returns the signed XDR, passing the network passphrase through', async () => {
    vi.mocked(signTransaction).mockResolvedValue('SIGNED_XDR');

    const signed = await signTransactionWithFreighter('UNSIGNED_XDR', 'Test SDF Network ; September 2015');

    expect(signed).toBe('SIGNED_XDR');
    expect(signTransaction).toHaveBeenCalledWith('UNSIGNED_XDR', {
      networkPassphrase: 'Test SDF Network ; September 2015',
    });
  });
});

// ── useStellar ───────────────────────────────────────────────────────────────

describe('useStellar', () => {
  it('starts disconnected with no wallet address', () => {
    vi.mocked(isConnected).mockResolvedValue(false);
    const { result } = renderHook(() => useStellar());

    expect(result.current.isConnected).toBe(false);
    expect(result.current.walletAddress).toBeNull();
  });

  it('picks up an already-connected wallet on mount, without requiring a click', async () => {
    vi.mocked(isConnected).mockResolvedValue(true);
    vi.mocked(requestAccess).mockResolvedValue('GALREADYCONNECTED');

    const { result } = renderHook(() => useStellar());

    await waitFor(() => expect(result.current.isConnected).toBe(true));
    expect(result.current.walletAddress).toBe('GALREADYCONNECTED');
  });

  it('connectWallet sets isConnected and walletAddress on success', async () => {
    vi.mocked(isConnected).mockResolvedValue(false);
    vi.mocked(requestAccess).mockResolvedValue('GNEWLYCONNECTED');
    const { result } = renderHook(() => useStellar());
    await waitFor(() => expect(result.current.isConnected).toBe(false));

    await act(async () => {
      await result.current.connectWallet();
    });

    expect(result.current.isConnected).toBe(true);
    expect(result.current.walletAddress).toBe('GNEWLYCONNECTED');
  });

  it('connectWallet clears a previously-connected wallet if a later call fails', async () => {
    vi.mocked(isConnected).mockResolvedValue(false);
    vi.mocked(requestAccess).mockResolvedValueOnce('GFIRSTCONNECT');
    const { result } = renderHook(() => useStellar());
    await waitFor(() => expect(result.current.isConnected).toBe(false));
    await act(async () => {
      await result.current.connectWallet();
    });
    expect(result.current.isConnected).toBe(true);

    vi.mocked(requestAccess).mockRejectedValueOnce(new Error('User declined access'));
    await act(async () => {
      await result.current.connectWallet();
    });

    expect(result.current.isConnected).toBe(false);
    expect(result.current.walletAddress).toBeNull();
  });

  it('connectWallet surfaces an error message instead of throwing, and stays disconnected', async () => {
    vi.mocked(isConnected).mockResolvedValue(false);
    vi.mocked(requestAccess).mockRejectedValue(new Error('User declined access'));
    const { result } = renderHook(() => useStellar());
    await waitFor(() => expect(result.current.isConnected).toBe(false));

    await act(async () => {
      await result.current.connectWallet();
    });

    expect(result.current.isConnected).toBe(false);
    expect(result.current.walletAddress).toBeNull();
    expect(result.current.error).toMatch(/declined|denied|rejected/i);
  });
});
