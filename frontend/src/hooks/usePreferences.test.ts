import { renderHook, act } from '@testing-library/react';
import { usePreferences } from './usePreferences';

describe('usePreferences', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns default preferences', () => {
    const { result } = renderHook(() => usePreferences());
    expect(result.current.preferences.theme).toBe('dark');
    expect(result.current.preferences.soundEnabled).toBe(true);
    expect(result.current.preferences.notificationsEnabled).toBe(true);
  });

  it('updates preferences and persists to localStorage', () => {
    const { result } = renderHook(() => usePreferences());

    act(() => {
      result.current.setPreferences({ theme: 'light' });
    });

    expect(result.current.preferences.theme).toBe('light');
    expect(localStorage.getItem('starbound-preferences')).toContain('light');
  });

  it('restores preferences from localStorage', () => {
    localStorage.setItem('starbound-preferences', JSON.stringify({ theme: 'light', soundEnabled: false }));

    const { result } = renderHook(() => usePreferences());
    expect(result.current.preferences.theme).toBe('light');
    expect(result.current.preferences.soundEnabled).toBe(false);
  });
});
