import { useEffect, useState } from 'react';

/**
 * The breakpoint below which the app shows its mobile navigation.
 *
 * Kept in sync with `MOBILE_NAV_QUERY`; exported so components and tests can
 * reason about the same number instead of hard-coding it twice.
 */
export const MOBILE_VIEWPORT_MAX_WIDTH = 767;

/** Media query matching every viewport at or below {@link MOBILE_VIEWPORT_MAX_WIDTH}. */
export const MOBILE_VIEWPORT_QUERY = `(max-width: ${MOBILE_VIEWPORT_MAX_WIDTH}px)`;

/** Reads the current match, tolerating environments without `matchMedia` (e.g. jsdom). */
function matchesMobileViewport(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia(MOBILE_VIEWPORT_QUERY).matches;
}

/**
 * Tracks whether the viewport is narrow enough for the mobile layout, and
 * re-renders when the player resizes or rotates the device.
 */
export function useIsMobileViewport(): boolean {
  const [isMobile, setIsMobile] = useState(matchesMobileViewport);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    const query = window.matchMedia(MOBILE_VIEWPORT_QUERY);
    const handleChange = (event: MediaQueryListEvent) => setIsMobile(event.matches);

    setIsMobile(query.matches);
    query.addEventListener('change', handleChange);
    return () => query.removeEventListener('change', handleChange);
  }, []);

  return isMobile;
}
