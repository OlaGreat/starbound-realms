import React from 'react';
import { CELL_SIZE, CELL_GAP } from './GalaxyMap';

/**
 * Number of rows/columns the skeleton draws before the galaxy has loaded.
 *
 * Mirrors the 8×8 testnet galaxy so the placeholder has the same overall
 * silhouette as the grid that replaces it.
 */
export const DEFAULT_SKELETON_GRID_SIZE = 8;

export interface GalaxyMapSkeletonProps {
  /** Rows and columns to draw, matching the galaxy grid once it loads. */
  gridSize?: number;
  label?: string;
}

const PULSE_CLASS_NAME = 'galaxy-skeleton-cell';

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    width: '100%',
  },

  label: {
    fontSize: '0.9rem',
    color: 'var(--text-muted)',
  },

  filterBar: {
    height: '3rem',
    borderRadius: '8px',
    border: '1px solid var(--border)',
    background: 'var(--bg-card)',
  },

  layoutRow: {
    display: 'flex',
    gap: '1rem',
    alignItems: 'flex-start',
    width: '100%',
  },

  sidebar: {
    width: '180px',
    height: '12rem',
    flexShrink: 0,
    borderRadius: '8px',
    border: '1px solid var(--border)',
    background: 'var(--bg-card)',
  },

  viewport: {
    flex: 1,
    overflow: 'hidden',
    padding: '0.75rem',
    borderRadius: '8px',
    border: '1px solid var(--border)',
    background: 'var(--bg-card)',
  },

  grid: {
    display: 'grid',
    justifyContent: 'start',
  },

  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderRadius: '4px',
    background: 'var(--unclaimed)',
    border: '1px solid var(--border)',
  },
};

/**
 * Grid-shaped placeholder shown while `useGalaxyData` loads.
 *
 * Matches the eventual galaxy layout — filter bar, owned-systems sidebar, and
 * a column of square cells at the map's real cell size — so the page does not
 * jump when the data arrives.
 */
export function GalaxyMapSkeleton({
  gridSize = DEFAULT_SKELETON_GRID_SIZE,
  label = 'Loading galaxy…',
}: GalaxyMapSkeletonProps) {
  const cellCount = gridSize * gridSize;

  return (
    <div
      style={styles.container}
      role="status"
      aria-label={label}
      data-testid="galaxy-map-skeleton"
    >
      <span style={styles.label}>{label}</span>

      <div style={styles.filterBar} aria-hidden="true" data-testid="galaxy-skeleton-filter" />

      <div style={styles.layoutRow} aria-hidden="true">
        <div style={styles.sidebar} data-testid="galaxy-skeleton-sidebar" />
        <div style={styles.viewport}>
          <div
            style={{
              ...styles.grid,
              gridTemplateColumns: `repeat(${gridSize}, ${CELL_SIZE}px)`,
              gap: `${CELL_GAP}px`,
            }}
          >
            {Array.from({ length: cellCount }, (_, index) => (
              <div key={index} className={PULSE_CLASS_NAME} style={styles.cell} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
