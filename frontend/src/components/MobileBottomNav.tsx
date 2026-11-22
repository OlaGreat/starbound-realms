import React from 'react';
import { useIsMobileViewport } from '../hooks/useIsMobileViewport';

/** The top-level views a connected player can switch between on a small screen. */
export type GameTab = 'galaxy' | 'fleet' | 'battles' | 'profile';

export interface MobileTabDefinition {
  id: GameTab;
  label: string;
  icon: string;
}

export const MOBILE_TABS: MobileTabDefinition[] = [
  { id: 'galaxy', label: 'Galaxy', icon: '🌌' },
  { id: 'fleet', label: 'Fleet', icon: '🚀' },
  { id: 'battles', label: 'Battles', icon: '⚔️' },
  { id: 'profile', label: 'Profile', icon: '👤' },
];

const styles: Record<string, React.CSSProperties> = {
  nav: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 50,
    display: 'flex',
    justifyContent: 'space-around',
    alignItems: 'stretch',
    gap: '0.25rem',
    padding: '0.35rem 0.5rem calc(0.35rem + env(safe-area-inset-bottom, 0px))',
    background: 'var(--bg-card)',
    borderTop: '1px solid var(--border)',
    boxShadow: '0 -4px 16px rgba(0, 0, 0, 0.35)',
  },

  tab: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.15rem',
    padding: '0.35rem 0.25rem',
    background: 'transparent',
    border: 'none',
    borderRadius: '8px',
    color: 'var(--text-muted)',
    fontSize: '0.7rem',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },

  activeTab: {
    color: 'var(--accent)',
    background: 'rgba(99, 179, 237, 0.12)',
  },

  icon: {
    fontSize: '1.1rem',
    lineHeight: 1,
  },
};

export interface MobileBottomNavProps {
  activeTab: GameTab;
  onTabChange: (tab: GameTab) => void;
}

/**
 * Fixed bottom navigation for small viewports, letting players switch between
 * the galaxy, fleet, battles, and profile views.
 *
 * Renders nothing at or above the mobile breakpoint, so the desktop layout is
 * untouched.
 */
export function MobileBottomNav({ activeTab, onTabChange }: MobileBottomNavProps) {
  const isMobileViewport = useIsMobileViewport();

  if (!isMobileViewport) {
    return null;
  }

  return (
    <nav style={styles.nav} aria-label="Mobile navigation" data-testid="mobile-bottom-nav">
      {MOBILE_TABS.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            type="button"
            data-testid={`mobile-nav-${tab.id}`}
            aria-current={isActive ? 'page' : undefined}
            onClick={() => onTabChange(tab.id)}
            style={isActive ? { ...styles.tab, ...styles.activeTab } : styles.tab}
          >
            <span style={styles.icon} aria-hidden="true">
              {tab.icon}
            </span>
            <span>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
