import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

// ── SDK mock ──────────────────────────────────────────────────────────────────

const claimSystem = vi.fn();
const buildUnit = vi.fn();
const moveFleet = vi.fn();
const resolveBattle = vi.fn();
const getBattle = vi.fn();

vi.mock('@starbound-realms/sdk', () => ({
  GalaxyClient: vi.fn().mockImplementation(() => ({ claimSystem })),
  FleetClient: vi.fn().mockImplementation(() => ({ buildUnit, moveFleet, getFleet: vi.fn().mockResolvedValue(null) })),
  BattleClient: vi.fn().mockImplementation(() => ({ resolveBattle, getBattle })),
  ResourcesClient: vi.fn().mockImplementation(() => ({
    getAllBalances: vi.fn().mockResolvedValue(null),
    findMissingTrustlines: vi.fn().mockResolvedValue([]),
    establishTrustlines: vi.fn(),
  })),
  UnitType: { Scout: 'Scout', Fighter: 'Fighter', Cruiser: 'Cruiser', Dreadnought: 'Dreadnought' },
}));

vi.mock('../lib/starboundClient', () => ({
  getStarboundClient: vi.fn().mockReturnValue({ networkPassphrase: 'Test SDF Network ; September 2015' }),
  getResourceIssuer: vi.fn().mockReturnValue('GISSUER'),
}));

// ── Hook mocks ────────────────────────────────────────────────────────────────

const mockRefetchGalaxy = vi.fn().mockResolvedValue(undefined);
const mockRefetchFleet = vi.fn().mockResolvedValue(undefined);
const mockRefetchBalances = vi.fn().mockResolvedValue(undefined);

const galaxyState = {
  systems: [] as ReturnType<typeof makeSystem>[],
  isLoading: false,
  error: null as string | null,
  refetch: mockRefetchGalaxy,
};

const fleetState = {
  fleet: null as object | null,
  isLoading: false,
  error: null as string | null,
  refetch: mockRefetchFleet,
};

const balancesState = {
  balances: null,
  isLoading: false,
  error: null as string | null,
  refetch: mockRefetchBalances,
};

const recentBattlesState = {
  battles: [],
  isLoading: false,
  error: null as string | null,
  hasPreviousPage: false,
  hasNextPage: false,
  goToNextPage: vi.fn(),
  goToPreviousPage: vi.fn(),
};

const trustlinesState = {
  missing: [] as string[],
  isLoading: false,
  isSettingUp: false,
  error: null as string | null,
  setUpTrustlines: vi.fn(),
};

const profileState = {
  profile: null as { address: string; systemsOwned: number; battlesWon: number; battlesLost: number } | null,
  isLoading: false,
  error: null as string | null,
  refetch: vi.fn().mockResolvedValue(undefined),
};

const historyState = {
  battles: [] as unknown[],
  isLoading: false,
  error: null as string | null,
  refetch: vi.fn().mockResolvedValue(undefined),
};

vi.mock('../hooks/useGalaxyData', () => ({ useGalaxyData: vi.fn(() => galaxyState) }));
vi.mock('../hooks/useFleetData', () => ({ useFleetData: vi.fn(() => fleetState) }));
vi.mock('../hooks/useResourceBalances', () => ({ useResourceBalances: vi.fn(() => balancesState) }));
vi.mock('../hooks/useRecentBattles', () => ({ useRecentBattles: vi.fn(() => recentBattlesState) }));
vi.mock('../hooks/useTrustlines', () => ({ useTrustlines: vi.fn(() => trustlinesState) }));
vi.mock('../hooks/usePlayerProfile', () => ({ usePlayerProfile: vi.fn(() => profileState) }));
vi.mock('../hooks/useBattleHistory', () => ({ useBattleHistory: vi.fn(() => historyState) }));

const viewportState = { isMobile: false };
vi.mock('../hooks/useIsMobileViewport', () => ({ useIsMobileViewport: vi.fn(() => viewportState.isMobile) }));

// ── Child component mocks ─────────────────────────────────────────────────────

vi.mock('./GalaxyMap', () => ({
  CELL_SIZE: 32,
  CELL_GAP: 2,
  GalaxyMap: ({ onSelectSystem }: { onSelectSystem: (id: number, trigger: SVGRectElement) => void }) => (
    <div data-testid="galaxy-map">
      <button onClick={(event) => onSelectSystem(42, event.currentTarget as unknown as SVGRectElement)}>
        Select System 42
      </button>
    </div>
  ),
}));

vi.mock('./StarSystem', () => ({
  StarSystem: ({
    system,
    onClose,
    onClaim,
    onMoveFleet,
    onAttack,
  }: {
    system: { systemId: number; owner: string | null } | null;
    onClose: () => void;
    onClaim: (id: number) => void;
    onMoveFleet: (id: number) => void;
    onAttack: (id: number) => void;
  }) =>
    system ? (
      <div data-testid="star-system">
        <span>System {system.systemId}</span>
        <button onClick={onClose}>Close</button>
        <button onClick={() => onClaim(system.systemId)}>Claim</button>
        <button onClick={() => onMoveFleet(system.systemId)}>Move Fleet</button>
        {system.owner && system.owner !== 'GPLAYER' && (
          <button onClick={() => onAttack(system.systemId)}>Attack</button>
        )}
      </div>
    ) : null,
}));

vi.mock('./Fleet', () => ({
  Fleet: ({ onBuildUnit }: { onBuildUnit: (unitType: string, count: number) => void }) => (
    <div data-testid="fleet">
      <button onClick={() => onBuildUnit('Scout', 1)}>Build Scout</button>
    </div>
  ),
}));

vi.mock('./ResourceBalances', () => ({
  ResourceBalances: () => <div data-testid="resource-balances" />,
}));

vi.mock('./BattleFeed', () => ({
  BattleFeed: () => <div data-testid="battle-feed" />,
}));

vi.mock('./ResourceSetupBanner', () => ({
  ResourceSetupBanner: () => <div data-testid="resource-setup-banner" />,
}));

vi.mock('./PlayerProfile', () => ({
  PlayerProfile: ({ profile }: { profile: { address: string } | null }) => (
    <div data-testid="player-profile">{profile ? <span>{profile.address}</span> : null}</div>
  ),
}));

vi.mock('./BattleLog', () => ({
  BattleLog: ({ isLoading }: { isLoading: boolean }) => (
    <div data-testid="battle-log">{isLoading ? 'loading history' : 'history ready'}</div>
  ),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

import { GameView } from './GameView';
import { NotificationProvider } from './Notifications';
import { SELECTED_SYSTEM_STORAGE_KEY } from '../lib/selectedSystemStorage';

function renderGameView() {
  return render(
    <NotificationProvider>
      <GameView {...DEFAULT_PROPS} />
    </NotificationProvider>
  );
}

function makeSystem(overrides: Partial<{
  systemId: number;
  owner: string | null;
  coordX: number;
  coordY: number;
  resourceType: 'Iron' | 'Energy' | 'Plasma';
  resourceYield: number;
  defenseRating: number;
  lastClaimed: number;
}> = {}) {
  return {
    systemId: 1,
    owner: null,
    coordX: 0,
    coordY: 0,
    resourceType: 'Iron' as const,
    resourceYield: 10,
    defenseRating: 5,
    lastClaimed: 0,
    ...overrides,
  };
}

const DEFAULT_PROPS = {
  walletAddress: 'GPLAYER',
  signTransaction: vi.fn().mockResolvedValue('SIGNED'),
  backendUrl: 'http://backend.example',
};

beforeEach(() => {
  vi.clearAllMocks();
  galaxyState.systems = [];
  galaxyState.isLoading = false;
  galaxyState.error = null;
  fleetState.fleet = null;
  fleetState.isLoading = false;
  fleetState.error = null;
  balancesState.error = null;
  balancesState.isLoading = false;
  recentBattlesState.error = null;
  trustlinesState.error = null;
  trustlinesState.missing = [];
  trustlinesState.isLoading = false;
  profileState.profile = null;
  profileState.isLoading = false;
  profileState.error = null;
  historyState.battles = [];
  historyState.isLoading = false;
  historyState.error = null;
  viewportState.isMobile = false;
  mockRefetchGalaxy.mockResolvedValue(undefined);
  mockRefetchFleet.mockResolvedValue(undefined);
  mockRefetchBalances.mockResolvedValue(undefined);
  window.localStorage.clear();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GameView', () => {
  // ── Rendering ──────────────────────────────────────────────────────────────

  it('renders the galaxy map and battle feed', () => {
    renderGameView();

    expect(screen.getByTestId('galaxy-map')).toBeInTheDocument();
    expect(screen.getByTestId('battle-feed')).toBeInTheDocument();
  });

  it('shows a loading message while the galaxy is loading', () => {
    galaxyState.isLoading = true;

    renderGameView();

    expect(screen.getByText(/loading galaxy/i)).toBeInTheDocument();
    expect(screen.queryByTestId('galaxy-map')).not.toBeInTheDocument();
  });

  it('shows the shared loading state while fleet data loads', () => {
    fleetState.isLoading = true;

    renderGameView();

    expect(screen.getByRole('status', { name: /loading fleet/i })).toBeInTheDocument();
    expect(screen.queryByTestId('fleet')).not.toBeInTheDocument();
  });

  it('shows the shared loading state while trustlines are checked', () => {
    trustlinesState.isLoading = true;

    renderGameView();

    expect(screen.getByRole('status', { name: /checking resource setup/i })).toBeInTheDocument();
    expect(screen.queryByTestId('resource-setup-banner')).not.toBeInTheDocument();
  });

  it('shows a galaxy error and hides the map when the galaxy fetch fails', () => {
    galaxyState.error = 'failed to fetch galaxy: 500';

    renderGameView();

    expect(screen.getByText(/failed to fetch galaxy/i)).toBeInTheDocument();
    expect(screen.queryByTestId('galaxy-map')).not.toBeInTheDocument();
  });

  // ── Player profile ──────────────────────────────────────────────────────────

  it('requests the profile for the connected wallet address', async () => {
    const { usePlayerProfile } = await import('../hooks/usePlayerProfile');
    const { useGalaxyData } = await import('../hooks/useGalaxyData');

    renderGameView();

    expect(usePlayerProfile).toHaveBeenCalledWith('http://backend.example', 'GPLAYER');
    expect(useGalaxyData).toHaveBeenCalled();
  });

  it('renders the player profile for the connected wallet', () => {
    profileState.profile = {
      address: 'GPLAYER',
      systemsOwned: 3,
      battlesWon: 5,
      battlesLost: 2,
    };

    renderGameView();

    expect(screen.getByTestId('player-profile')).toHaveTextContent('GPLAYER');
    expect(screen.getByText(/your profile/i)).toBeInTheDocument();
  });

  // ── Battle history ──────────────────────────────────────────────────────────

  it('requests the battle history for the connected wallet address', async () => {
    const { useBattleHistory } = await import('../hooks/useBattleHistory');

    renderGameView();

    expect(useBattleHistory).toHaveBeenCalledWith('http://backend.example', 'GPLAYER');
  });

  it('renders the battle history section', () => {
    renderGameView();

    expect(screen.getByText(/battle history/i)).toBeInTheDocument();
    expect(screen.getByTestId('battle-log')).toBeInTheDocument();
  });

  // ── Selection ──────────────────────────────────────────────────────────────

  it('selecting a system opens StarSystem for that system', () => {
    galaxyState.systems = [makeSystem({ systemId: 42 })];

    renderGameView();
    fireEvent.click(screen.getByText('Select System 42'));

    expect(screen.getByTestId('star-system')).toBeInTheDocument();
    expect(screen.getByText('System 42')).toBeInTheDocument();
  });

  it('closing the StarSystem drawer clears the selection', () => {
    galaxyState.systems = [makeSystem({ systemId: 42 })];

    renderGameView();
    fireEvent.click(screen.getByText('Select System 42'));
    expect(screen.getByTestId('star-system')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Close'));
    expect(screen.queryByTestId('star-system')).not.toBeInTheDocument();
  });

  // ── Selection persistence (#133) ───────────────────────────────────────────

  it('persists the system id when a system is selected', () => {
    galaxyState.systems = [makeSystem({ systemId: 42 })];

    renderGameView();
    fireEvent.click(screen.getByText('Select System 42'));

    expect(window.localStorage.getItem(SELECTED_SYSTEM_STORAGE_KEY)).toBe('42');
  });

  it('restores the last-selected system once the galaxy has loaded', () => {
    window.localStorage.setItem(SELECTED_SYSTEM_STORAGE_KEY, '42');
    galaxyState.systems = [makeSystem({ systemId: 42 })];

    renderGameView();

    expect(screen.getByTestId('star-system')).toHaveTextContent('System 42');
  });

  it('does not restore the selection while the galaxy is still loading', () => {
    window.localStorage.setItem(SELECTED_SYSTEM_STORAGE_KEY, '42');
    galaxyState.isLoading = true;
    galaxyState.systems = [makeSystem({ systemId: 42 })];

    const { rerender } = renderGameView();
    expect(screen.queryByTestId('star-system')).not.toBeInTheDocument();

    galaxyState.isLoading = false;
    rerender(
      <NotificationProvider>
        <GameView {...DEFAULT_PROPS} />
      </NotificationProvider>
    );

    expect(screen.getByTestId('star-system')).toHaveTextContent('System 42');
  });

  it('drops a stored selection whose system no longer exists', () => {
    window.localStorage.setItem(SELECTED_SYSTEM_STORAGE_KEY, '99');
    galaxyState.systems = [makeSystem({ systemId: 42 })];

    renderGameView();

    expect(screen.queryByTestId('star-system')).not.toBeInTheDocument();
    expect(window.localStorage.getItem(SELECTED_SYSTEM_STORAGE_KEY)).toBeNull();
  });

  it('forgets the stored selection when the drawer is closed', () => {
    window.localStorage.setItem(SELECTED_SYSTEM_STORAGE_KEY, '42');
    galaxyState.systems = [makeSystem({ systemId: 42 })];

    renderGameView();
    fireEvent.click(screen.getByText('Close'));

    expect(window.localStorage.getItem(SELECTED_SYSTEM_STORAGE_KEY)).toBeNull();
  });

  it('returns focus to the cell that opened the drawer when it closes', async () => {
    galaxyState.systems = [makeSystem({ systemId: 42 })];

    renderGameView();
    const trigger = screen.getByText('Select System 42');
    fireEvent.click(trigger);
    fireEvent.click(screen.getByText('Close'));

    await waitFor(() => expect(trigger).toHaveFocus());
  });

  // ── claimSystem ────────────────────────────────────────────────────────────

  it('claimSystem calls GalaxyClient.claimSystem with the wallet address and system id', async () => {
    galaxyState.systems = [makeSystem({ systemId: 42 })];
    claimSystem.mockResolvedValue(undefined);

    renderGameView();
    fireEvent.click(screen.getByText('Select System 42'));
    fireEvent.click(screen.getByText('Claim'));

    await waitFor(() =>
      expect(claimSystem).toHaveBeenCalledWith('GPLAYER', 42, expect.any(Function))
    );
  });

  it('claimSystem refetches the galaxy and clears the selection on success', async () => {
    galaxyState.systems = [makeSystem({ systemId: 42 })];
    claimSystem.mockResolvedValue(undefined);

    renderGameView();
    fireEvent.click(screen.getByText('Select System 42'));
    fireEvent.click(screen.getByText('Claim'));

    await waitFor(() => expect(mockRefetchGalaxy).toHaveBeenCalled());
    expect(screen.queryByTestId('star-system')).not.toBeInTheDocument();
  });

  it('claimSystem surfaces an error without crashing when it fails', async () => {
    galaxyState.systems = [makeSystem({ systemId: 42 })];
    claimSystem.mockRejectedValue(new Error('claim rejected'));

    renderGameView();
    fireEvent.click(screen.getByText('Select System 42'));
    fireEvent.click(screen.getByText('Claim'));

    await waitFor(() =>
      expect(screen.getByText(/claim rejected/i)).toBeInTheDocument()
    );
  });

  it('shows a submission toast and a confirmation toast for a claim', async () => {
    galaxyState.systems = [makeSystem({ systemId: 42 })];
    claimSystem.mockResolvedValue(undefined);

    renderGameView();
    fireEvent.click(screen.getByText('Select System 42'));
    fireEvent.click(screen.getByText('Claim'));

    expect(
      await screen.findByText(/claim transaction submitted for system 42/i)
    ).toBeInTheDocument();
    expect(await screen.findByText(/system 42 claimed/i)).toBeInTheDocument();
  });

  // ── Mobile navigation (#262) ────────────────────────────────────────────────

  it('switches between views on a mobile viewport', () => {
    viewportState.isMobile = true;
    galaxyState.systems = [makeSystem({ systemId: 42 })];
    profileState.profile = { address: 'GPLAYER', systemsOwned: 0, battlesWon: 0, battlesLost: 0 };

    renderGameView();

    expect(screen.getByTestId('mobile-bottom-nav')).toBeInTheDocument();
    expect(screen.getByTestId('galaxy-map')).toBeInTheDocument();
    expect(screen.queryByTestId('fleet')).not.toBeInTheDocument();
    expect(screen.queryByTestId('player-profile')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('mobile-nav-fleet'));
    expect(screen.getByTestId('fleet')).toBeInTheDocument();
    expect(screen.queryByTestId('galaxy-map')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('mobile-nav-battles'));
    expect(screen.getByTestId('battle-log')).toBeInTheDocument();
    expect(screen.getByTestId('battle-feed')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('mobile-nav-profile'));
    expect(screen.getByTestId('player-profile')).toBeInTheDocument();
    expect(screen.queryByTestId('battle-log')).not.toBeInTheDocument();
  });

  it('does not render the mobile navigation on a desktop viewport', () => {
    renderGameView();

    expect(screen.queryByTestId('mobile-bottom-nav')).not.toBeInTheDocument();
    expect(screen.getByTestId('galaxy-map')).toBeInTheDocument();
    expect(screen.getByTestId('battle-log')).toBeInTheDocument();
  });

  // ── buildUnit ──────────────────────────────────────────────────────────────

  it('buildUnit calls FleetClient.buildUnit with the wallet address, unit type, and count', async () => {
    buildUnit.mockResolvedValue(undefined);

    renderGameView();
    fireEvent.click(screen.getByText('Build Scout'));

    await waitFor(() =>
      expect(buildUnit).toHaveBeenCalledWith('GPLAYER', 'Scout', 1, expect.any(Function))
    );
  });

  it('buildUnit refetches fleet and balances on success', async () => {
    buildUnit.mockResolvedValue(undefined);

    renderGameView();
    fireEvent.click(screen.getByText('Build Scout'));

    await waitFor(() => {
      expect(mockRefetchFleet).toHaveBeenCalled();
      expect(mockRefetchBalances).toHaveBeenCalled();
    });
  });

  it('buildUnit surfaces an error without crashing when it fails', async () => {
    buildUnit.mockRejectedValue(new Error('build failed'));

    renderGameView();
    fireEvent.click(screen.getByText('Build Scout'));

    await waitFor(() =>
      expect(screen.getByText(/build failed/i)).toBeInTheDocument()
    );
  });

  // ── moveFleet ──────────────────────────────────────────────────────────────

  it('moveFleet calls FleetClient.moveFleet with the wallet address and target system id', async () => {
    galaxyState.systems = [makeSystem({ systemId: 42 })];
    moveFleet.mockResolvedValue(undefined);

    renderGameView();
    fireEvent.click(screen.getByText('Select System 42'));
    fireEvent.click(screen.getByText('Move Fleet'));

    await waitFor(() =>
      expect(moveFleet).toHaveBeenCalledWith('GPLAYER', 42, expect.any(Function))
    );
  });

  it('moveFleet refetches fleet and clears the selection on success', async () => {
    galaxyState.systems = [makeSystem({ systemId: 42 })];
    moveFleet.mockResolvedValue(undefined);

    renderGameView();
    fireEvent.click(screen.getByText('Select System 42'));
    fireEvent.click(screen.getByText('Move Fleet'));

    await waitFor(() => expect(mockRefetchFleet).toHaveBeenCalled());
    expect(screen.queryByTestId('star-system')).not.toBeInTheDocument();
  });

  it('moveFleet surfaces an error without crashing when it fails', async () => {
    galaxyState.systems = [makeSystem({ systemId: 42 })];
    moveFleet.mockRejectedValue(new Error('move rejected'));

    renderGameView();
    fireEvent.click(screen.getByText('Select System 42'));
    fireEvent.click(screen.getByText('Move Fleet'));

    await waitFor(() =>
      expect(screen.getByText(/move rejected/i)).toBeInTheDocument()
    );
  });

  // ── attackSystem ───────────────────────────────────────────────────────────

  it('attackSystem calls BattleClient.resolveBattle with attacker, defender, and system id', async () => {
    galaxyState.systems = [makeSystem({ systemId: 42, owner: 'GENEMY' })];
    resolveBattle.mockResolvedValue(99);
    getBattle.mockResolvedValue({ winner: 'GPLAYER', rounds: 3 });

    renderGameView();
    fireEvent.click(screen.getByText('Select System 42'));
    fireEvent.click(screen.getByText('Attack'));

    await waitFor(() =>
      expect(resolveBattle).toHaveBeenCalledWith('GPLAYER', 'GENEMY', 42, expect.any(Function))
    );
  });

  it('attackSystem shows a victory message when the attacker wins', async () => {
    galaxyState.systems = [makeSystem({ systemId: 42, owner: 'GENEMY' })];
    resolveBattle.mockResolvedValue(99);
    getBattle.mockResolvedValue({ winner: 'GPLAYER', rounds: 2 });

    renderGameView();
    fireEvent.click(screen.getByText('Select System 42'));
    fireEvent.click(screen.getByText('Attack'));

    await waitFor(() =>
      expect(screen.getByText(/victory/i)).toBeInTheDocument()
    );
  });

  it('attackSystem shows a defeat message when the attacker loses', async () => {
    galaxyState.systems = [makeSystem({ systemId: 42, owner: 'GENEMY' })];
    resolveBattle.mockResolvedValue(99);
    getBattle.mockResolvedValue({ winner: 'GENEMY', rounds: 1 });

    renderGameView();
    fireEvent.click(screen.getByText('Select System 42'));
    fireEvent.click(screen.getByText('Attack'));

    await waitFor(() =>
      expect(screen.getByText(/defeat/i)).toBeInTheDocument()
    );
  });

  it('attackSystem surfaces an error without crashing when the battle call fails', async () => {
    galaxyState.systems = [makeSystem({ systemId: 42, owner: 'GENEMY' })];
    resolveBattle.mockRejectedValue(new Error('battle simulation failed'));

    renderGameView();
    fireEvent.click(screen.getByText('Select System 42'));
    fireEvent.click(screen.getByText('Attack'));

    await waitFor(() =>
      expect(screen.getByText(/battle simulation failed/i)).toBeInTheDocument()
    );
  });

  it('attackSystem refetches fleet and galaxy after a successful battle', async () => {
    galaxyState.systems = [makeSystem({ systemId: 42, owner: 'GENEMY' })];
    resolveBattle.mockResolvedValue(99);
    getBattle.mockResolvedValue({ winner: 'GPLAYER', rounds: 1 });

    renderGameView();
    fireEvent.click(screen.getByText('Select System 42'));
    fireEvent.click(screen.getByText('Attack'));

    await waitFor(() => {
      expect(mockRefetchFleet).toHaveBeenCalled();
      expect(mockRefetchGalaxy).toHaveBeenCalled();
    });
  });
});
