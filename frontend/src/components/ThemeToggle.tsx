import { useEffect } from 'react';
import { usePreferences } from '../hooks/usePreferences';

export function ThemeToggle() {
  const { preferences, setPreferences } = usePreferences();
  const theme = preferences.theme;

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <button
      type="button"
      onClick={() => setPreferences({ theme: theme === 'dark' ? 'light' : 'dark' })}
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      style={{
        padding: '0.5rem 1rem',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border)',
        background: 'var(--bg-card)',
        color: 'var(--text)',
        fontSize: 'var(--font-sm)',
        cursor: 'pointer',
        fontFamily: 'inherit',
      }}
    >
      {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
    </button>
  );
}
