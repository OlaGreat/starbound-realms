import { useState, useEffect } from 'react';

const PREFERENCES_KEY = 'starbound-preferences';

export interface Preferences {
  theme: 'dark' | 'light';
  soundEnabled: boolean;
  notificationsEnabled: boolean;
}

const DEFAULT_PREFERENCES: Preferences = {
  theme: 'dark',
  soundEnabled: true,
  notificationsEnabled: true,
};

function getStoredPreferences(): Preferences {
  if (typeof localStorage === 'undefined') return DEFAULT_PREFERENCES;

  try {
    const stored = localStorage.getItem(PREFERENCES_KEY);
    if (!stored) return DEFAULT_PREFERENCES;
    return { ...DEFAULT_PREFERENCES, ...JSON.parse(stored) };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function usePreferences() {
  const [preferences, setPreferencesState] = useState<Preferences>(getStoredPreferences);

  useEffect(() => {
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
  }, [preferences]);

  const setPreferences = (updates: Partial<Preferences>) => {
    setPreferencesState((prev) => ({ ...prev, ...updates }));
  };

  return { preferences, setPreferences };
}
