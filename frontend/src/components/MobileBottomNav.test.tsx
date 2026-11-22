import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MobileBottomNav, MOBILE_TABS } from './MobileBottomNav';
import { MOBILE_VIEWPORT_QUERY } from '../hooks/useIsMobileViewport';

/** Replaces `window.matchMedia` with a stub reporting a fixed viewport width. */
function setMobileViewport(isMobile: boolean) {
  const matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: isMobile,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));

  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: matchMedia,
  });

  return matchMedia;
}

describe('MobileBottomNav', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders nothing on a desktop viewport', () => {
    setMobileViewport(false);

    render(<MobileBottomNav activeTab="galaxy" onTabChange={vi.fn()} />);

    expect(screen.queryByTestId('mobile-bottom-nav')).not.toBeInTheDocument();
  });

  it('asks matchMedia about the mobile breakpoint', () => {
    const matchMedia = setMobileViewport(true);

    render(<MobileBottomNav activeTab="galaxy" onTabChange={vi.fn()} />);

    expect(matchMedia).toHaveBeenCalledWith(MOBILE_VIEWPORT_QUERY);
  });

  it('renders every game view on a mobile viewport', () => {
    setMobileViewport(true);

    render(<MobileBottomNav activeTab="galaxy" onTabChange={vi.fn()} />);

    expect(screen.getByTestId('mobile-bottom-nav')).toBeInTheDocument();
    for (const tab of MOBILE_TABS) {
      expect(screen.getByRole('button', { name: new RegExp(tab.label, 'i') })).toBeInTheDocument();
    }
  });

  it('marks only the active tab as the current page', () => {
    setMobileViewport(true);

    render(<MobileBottomNav activeTab="battles" onTabChange={vi.fn()} />);

    expect(screen.getByTestId('mobile-nav-battles')).toHaveAttribute('aria-current', 'page');
    expect(screen.getByTestId('mobile-nav-galaxy')).not.toHaveAttribute('aria-current');
    expect(screen.getByTestId('mobile-nav-fleet')).not.toHaveAttribute('aria-current');
    expect(screen.getByTestId('mobile-nav-profile')).not.toHaveAttribute('aria-current');
  });

  it.each(MOBILE_TABS.map((tab) => tab.id))('reports a tap on the %s tab', (tabId) => {
    setMobileViewport(true);
    const onTabChange = vi.fn();

    render(<MobileBottomNav activeTab="galaxy" onTabChange={onTabChange} />);
    fireEvent.click(screen.getByTestId(`mobile-nav-${tabId}`));

    expect(onTabChange).toHaveBeenCalledWith(tabId);
  });
});
