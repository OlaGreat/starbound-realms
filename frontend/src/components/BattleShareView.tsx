import React, { useEffect, useState } from 'react';
import { LoadingIndicator } from './LoadingIndicator';
import { truncateAddress } from '../lib/format';

/** Raw `battles` row as returned by `GET /battles/:battleId` (snake_case). */
interface RawSharedBattle {
  battle_id: string;
  attacker: string;
  defender: string;
  system_id: number;
  winner: string;
  rounds: number;
  ledger_sequence: string;
  created_at: string;
}

export interface SharedBattle {
  battleId: number;
  attacker: string;
  defender: string;
  systemId: number;
  winner: string;
  rounds: number;
  ledgerSequence: number;
  createdAt: number;
}

function toSharedBattle(raw: RawSharedBattle): SharedBattle {
  return {
    battleId: Number(raw.battle_id),
    attacker: raw.attacker,
    defender: raw.defender,
    systemId: raw.system_id,
    winner: raw.winner,
    rounds: raw.rounds,
    ledgerSequence: Number(raw.ledger_sequence),
    createdAt: Date.parse(raw.created_at),
  };
}

/** Reads the battle id from a share URL's `battle` query param. */
export function readSharedBattleId(search: string): number | null {
  const raw = new URLSearchParams(search).get('battle');
  if (!raw || !/^\d+$/.test(raw)) {
    return null;
  }
  return Number(raw);
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2rem 1rem',
    background: 'var(--bg)',
  },

  card: {
    width: '100%',
    maxWidth: '520px',
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    padding: '1.75rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    color: 'var(--text)',
  },

  title: {
    fontSize: '1.25rem',
    fontWeight: 700,
    margin: 0,
  },

  outcome: {
    fontSize: '1rem',
    fontWeight: 700,
    margin: 0,
  },

  row: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '1rem',
    fontSize: '0.9rem',
    paddingBottom: '0.4rem',
    borderBottom: '1px solid var(--border)',
  },

  label: {
    color: 'var(--text-muted)',
  },

  value: {
    fontFamily: 'monospace',
    textAlign: 'right',
    wordBreak: 'break-all',
  },

  muted: {
    color: 'var(--text-muted)',
    fontSize: '0.9rem',
    margin: 0,
  },

  link: {
    color: 'var(--accent)',
    fontSize: '0.9rem',
    fontWeight: 600,
  },
};

export interface BattleShareViewProps {
  backendUrl: string;
  battleId: number;
}

/**
 * Standalone page for a shared battle link: reads one battle from
 * `GET /battles/:battleId` and renders its outcome, without needing a wallet.
 */
export function BattleShareView({ backendUrl, battleId }: BattleShareViewProps) {
  const [battle, setBattle] = useState<SharedBattle | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(`${backendUrl}/battles/${battleId}`);
        if (response.status === 404) {
          throw new Error('Battle not found');
        }
        if (!response.ok) {
          throw new Error(`failed to fetch battle: ${response.status}`);
        }
        const { battle: raw } = (await response.json()) as { battle: RawSharedBattle };
        if (isMounted) {
          setBattle(toSharedBattle(raw));
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : String(err));
          setBattle(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    load();
    return () => {
      isMounted = false;
    };
  }, [backendUrl, battleId]);

  return (
    <div style={styles.page}>
      <div style={styles.card} data-testid="battle-share-view">
        <h1 style={styles.title}>Battle #{battleId}</h1>

        {isLoading && <LoadingIndicator label="Loading battle…" />}
        {!isLoading && error && <p style={styles.muted}>{error}</p>}

        {!isLoading && !error && battle && (
          <>
            <p style={styles.outcome}>
              {truncateAddress(battle.winner)} won system {battle.systemId} in {battle.rounds}{' '}
              round(s).
            </p>
            <div style={styles.row}>
              <span style={styles.label}>Attacker</span>
              <span style={styles.value}>{battle.attacker}</span>
            </div>
            <div style={styles.row}>
              <span style={styles.label}>Defender</span>
              <span style={styles.value}>{battle.defender}</span>
            </div>
            <div style={styles.row}>
              <span style={styles.label}>Winner</span>
              <span style={styles.value}>{battle.winner}</span>
            </div>
            <div style={styles.row}>
              <span style={styles.label}>System</span>
              <span style={styles.value}>{battle.systemId}</span>
            </div>
            <div style={styles.row}>
              <span style={styles.label}>Rounds</span>
              <span style={styles.value}>{battle.rounds}</span>
            </div>
            <div style={styles.row}>
              <span style={styles.label}>Ledger</span>
              <span style={styles.value}>{battle.ledgerSequence}</span>
            </div>
          </>
        )}

        <a href={window.location.pathname} style={styles.link}>
          Back to Starbound Realms
        </a>
      </div>
    </div>
  );
}
