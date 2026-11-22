import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GalaxyMapSkeleton, DEFAULT_SKELETON_GRID_SIZE } from './GalaxyMapSkeleton';
import { CELL_SIZE } from './GalaxyMap';

describe('GalaxyMapSkeleton', () => {
  it('is announced as a loading status', () => {
    render(<GalaxyMapSkeleton />);

    const skeleton = screen.getByRole('status', { name: /loading galaxy/i });
    expect(skeleton).toHaveAttribute('data-testid', 'galaxy-map-skeleton');
  });

  it('draws a square grid of cells by default', () => {
    render(<GalaxyMapSkeleton />);

    const cells = screen.getByTestId('galaxy-map-skeleton').querySelectorAll('.galaxy-skeleton-cell');
    expect(cells).toHaveLength(DEFAULT_SKELETON_GRID_SIZE * DEFAULT_SKELETON_GRID_SIZE);
  });

  it('matches the requested grid size', () => {
    render(<GalaxyMapSkeleton gridSize={4} />);

    const cells = screen.getByTestId('galaxy-map-skeleton').querySelectorAll('.galaxy-skeleton-cell');
    expect(cells).toHaveLength(16);
  });

  it('uses the galaxy map cell size so the grid does not jump on load', () => {
    render(<GalaxyMapSkeleton gridSize={2} />);

    const cell = screen.getByTestId('galaxy-map-skeleton').querySelector('.galaxy-skeleton-cell');
    expect(cell).toHaveStyle({ width: `${CELL_SIZE}px`, height: `${CELL_SIZE}px` });
  });

  it('reserves the filter bar and owned-systems sidebar', () => {
    render(<GalaxyMapSkeleton />);

    expect(screen.getByTestId('galaxy-skeleton-filter')).toBeInTheDocument();
    expect(screen.getByTestId('galaxy-skeleton-sidebar')).toBeInTheDocument();
  });

  it('accepts a custom label', () => {
    render(<GalaxyMapSkeleton label="Fetching systems…" />);

    expect(screen.getByText('Fetching systems…')).toBeInTheDocument();
  });
});
