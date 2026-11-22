import React, { useState } from 'react';
import { LeaderboardEntry } from '../hooks/useLeaderboard';
import { AllianceLeaderboardEntry } from '../hooks/useLeaderboard';
import { truncateAddress } from '../lib/format';
import { LoadingIndicator } from './LoadingIndicator';

const styles: Record<string, React.CSSProperties> = {
  tabButtons: {
    display: 'flex',
    gap: '0.5rem',
    marginBottom: '1rem',
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
  },
  tabButton: {
    padding: '0.5rem 1rem',
    border: 'none',
    background: 'transparent',
    color: 'var(--text-muted)',
    fontSize: '0.85rem',
    cursor: 'pointer',
    borderRadius: '0',
    '&.active': {
      color: 'var(--accent)',
      borderBottom: '2px solid var(--accent)',
    },
  },
  content: {
    padding: '1rem',
  },
  header: {
    display: 'grid',
    gridTemplateColumns: '3rem 1fr 8rem 5rem 5rem',
    gap: '0.75rem',
    fontSize: '0.75rem',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: 'var(--text-muted)',
    padding: '0 1rem',
  },
  item: {
    display: 'grid',
    gridTemplateColumns: '3rem 1fr 8rem 5rem 5rem',
    gap: '0.75rem',
    alignItems: 'center',
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    padding: '0.75rem 1rem',
    fontSize: '0.9rem',
    color: 'var(--text)',
  },
  rank: {
    fontWeight: 700,
    color: 'var(--accent)',
  },
  record: {
    fontSize: '0.85rem',
    color: 'var(--text-muted)',
  },
  textMuted: {
    color: 'var(--text-muted)',
    fontSize: '0.9rem',
  },
};

interface LeaderboardProps {
  players: LeaderboardEntry[];
  alliancePlayers: AllianceLeaderboardEntry[];
  isLoading: boolean;
  error: string | null;
}

/** Renders the top-players leaderboard: rank, address, systems owned, and W/L record. */
export function Leaderboard({ players, alliancePlayers, isLoading, error }: LeaderboardProps) {
  const [tab, setTab] = useState<'players' | 'alliances'>('players');

  if (isLoading) {
    return <LoadingIndicator label="Loading leaderboard…" />;
  }
  if (error) {
    return <p style={styles.textMuted}>{error}</p>;
  }

  const renderPlayersTab = () => {
    if (players.length === 0) {
      return <p style={styles.textMuted}>No players yet — claim the first star system.</p>;
    }

    return (
      <>
        <div style={styles.header} aria-hidden="true">
          <span>Rank</span>
          <span>Player</span>
          <span>Systems</span>
          <span>Won</span>
          <span>Lost</span>
        </div>
        <ol style={styles.list} aria-label="Player leaderboard">
          {players.map((player, index) => (
            <li key={player.address} style={styles.item}>
              <span style={styles.rank}>#{index + 1}</span>
              <span>{truncateAddress(player.address)}</span>
              <span>{player.systemsOwned} systems</span>
              <span style={styles.record}>{player.battlesWon}W</span>
              <span style={styles.record}>{player.battlesLost}L</span>
            </li>
          ))}
        </ol>
      </>
    );
  };

  const renderAlliancesTab = () => {
    if (alliancePlayers.length === 0) {
      return <p style={styles.textMuted}>No alliances yet — create one to appear on the leaderboard.</p>;
    }

    return (
      <>
        <div style={styles.header} aria-hidden="true">
          <span>Rank</span>
          <span>Alliance</span>
          <span>Leader</span>
          <span>Systems</span>
          <span>Members</span>
        </div>
        <ol style={styles.list} aria-label="Alliance leaderboard">
          {alliancePlayers.map((alliance, index) => (
            <li key={alliance.allianceId} style={styles.item}>
              <span style={styles.rank}>#{index + 1}</span>
              <span>{truncateAddress(alliance.leader)}</span>
              <span>{alliance.name}</span>
              <span>{alliance.totalSystemsOwned} systems</span>
              <span>{alliance.memberCount} members</span>
            </li>
          ))}
        </ol>
      </>
    );
  };

  return (
    <>
      <div style={styles.tabButtons}>
        <button onClick={() => setTab('players')} style={styles.tabButton}>
          Players
        </button>
        <button onClick={() => setTab('alliances')} style={styles.tabButton}>
          Alliances
        </button>
      </div>

      {tab === 'players' ? renderPlayersTab() : renderAlliancesTab()}
    </>
  );
}