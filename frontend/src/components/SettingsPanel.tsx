import React, { useState } from 'react';
import { usePreferences } from '../hooks/usePreferences';

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  panel: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    padding: '2rem',
    maxWidth: '400px',
    width: '90%',
    color: 'var(--text)',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
  },
  title: {
    fontSize: '1.25rem',
    fontWeight: 700,
    marginBottom: '1.5rem',
    color: 'var(--accent)',
  },
  section: {
    marginBottom: '1.5rem',
    paddingBottom: '1.5rem',
    borderBottom: '1px solid var(--border)',
  },
  sectionTitle: {
    fontSize: '0.9rem',
    fontWeight: 600,
    marginBottom: '0.75rem',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  controlGroup: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '0.75rem',
  },
  label: {
    fontSize: '0.9rem',
    fontWeight: 500,
    color: 'var(--text)',
  },
  toggle: {
    width: '48px',
    height: '24px',
    background: 'var(--border)',
    border: 'none',
    borderRadius: '12px',
    cursor: 'pointer',
    position: 'relative',
    padding: '2px',
    transition: 'background 0.2s',
  },
  toggleActive: {
    background: 'var(--accent)',
  },
  toggleHandle: {
    width: '20px',
    height: '20px',
    background: 'white',
    borderRadius: '10px',
    position: 'absolute',
    top: '2px',
    left: '2px',
    transition: 'left 0.2s',
  },
  toggleHandleActive: {
    left: '26px',
  },
  closeButton: {
    marginTop: '1.5rem',
    width: '100%',
    padding: '0.75rem',
    background: 'var(--accent)',
    border: 'none',
    borderRadius: '8px',
    color: 'white',
    fontWeight: 600,
    fontSize: '0.9rem',
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'opacity 0.2s',
  },
};

export interface SettingsPanelProps {
  onClose: () => void;
  networkLabel?: string;
}

export function SettingsPanel({ onClose, networkLabel }: SettingsPanelProps) {
  const { preferences, setPreferences } = usePreferences();

  const handleThemeChange = (newTheme: 'dark' | 'light') => {
    setPreferences({ theme: newTheme });
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  return (
    <div
      style={styles.overlay}
      onClick={onClose}
      role="presentation"
    >
      <div
        style={styles.panel}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Settings"
      >
        <h2 style={styles.title}>Settings</h2>

        {/* Theme Section */}
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Appearance</div>
          <div style={styles.controlGroup}>
            <label style={styles.label} htmlFor="theme-selector">
              Theme
            </label>
            <select
              id="theme-selector"
              value={preferences.theme}
              onChange={(e) => handleThemeChange(e.target.value as 'dark' | 'light')}
              style={{
                padding: '0.5rem 0.75rem',
                borderRadius: '6px',
                border: '1px solid var(--border)',
                background: 'var(--bg)',
                color: 'var(--text)',
                fontFamily: 'inherit',
                fontSize: '0.9rem',
                cursor: 'pointer',
              }}
            >
              <option value="dark">Dark</option>
              <option value="light">Light</option>
            </select>
          </div>
        </div>

        {/* Sound Section */}
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Audio</div>
          <div style={styles.controlGroup}>
            <label style={styles.label} htmlFor="sound-toggle">
              Battle Sounds
            </label>
            <button
              id="sound-toggle"
              style={{
                ...styles.toggle,
                ...(preferences.soundEnabled && styles.toggleActive),
              }}
              onClick={() => setPreferences({ soundEnabled: !preferences.soundEnabled })}
              aria-label={preferences.soundEnabled ? 'Disable sound' : 'Enable sound'}
              aria-pressed={preferences.soundEnabled}
            >
              <span
                style={{
                  ...styles.toggleHandle,
                  ...(preferences.soundEnabled && styles.toggleHandleActive),
                }}
              />
            </button>
          </div>
        </div>

        {/* Notifications Section */}
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Notifications</div>
          <div style={styles.controlGroup}>
            <label style={styles.label} htmlFor="notifications-toggle">
              In-game Notifications
            </label>
            <button
              id="notifications-toggle"
              style={{
                ...styles.toggle,
                ...(preferences.notificationsEnabled && styles.toggleActive),
              }}
              onClick={() => setPreferences({ notificationsEnabled: !preferences.notificationsEnabled })}
              aria-label={preferences.notificationsEnabled ? 'Disable notifications' : 'Enable notifications'}
              aria-pressed={preferences.notificationsEnabled}
            >
              <span
                style={{
                  ...styles.toggleHandle,
                  ...(preferences.notificationsEnabled && styles.toggleHandleActive),
                }}
              />
            </button>
          </div>
        </div>

        {/* Network Info */}
        {networkLabel && (
          <div style={styles.section}>
            <div style={styles.sectionTitle}>Network</div>
            <div style={{ ...styles.label, color: 'var(--text-muted)' }}>
              Connected to Stellar {networkLabel}
            </div>
          </div>
        )}

        <button
          style={styles.closeButton}
          onClick={onClose}
          type="button"
        >
          Close
        </button>
      </div>
    </div>
  );
}
