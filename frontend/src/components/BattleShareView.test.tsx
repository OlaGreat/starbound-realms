import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BattleShareView, readSharedBattleId } from './BattleShareView';

const ATTACKER = 'GATTACKER111111111111111111111111111111111111111111111111';
const DEFENDER = 'GDEFENDER222222222222222222222222222222222222222222222222';

function battleResponse() {
  return {
    battle: {
      battle_id: '42',
      attacker: ATTACKER,
      defender: DEFENDER,
      system_id: 7,
      winner: ATTACKER,
      rounds: 3,
      ledger_sequence: '5000',
      created_at: '2026-10-01T12:00:00.000Z',
    },
  };
}

describe('readSharedBattleId', () => {
  it('reads a numeric battle id from the query string', () => {
    expect(readSharedBattleId('?battle=42')).toBe(42);
  });

  it('ignores a missing or malformed battle id', () => {
    expect(readSharedBattleId('')).toBeNull();
    expect(readSharedBattleId('?battle=')).toBeNull();
    expect(readSharedBattleId('?battle=4x2')).toBeNull();
    expect(readSharedBattleId('?battle=-1')).toBeNull();
  });
});

describe('BattleShareView', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetches the requested battle from the backend', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => battleResponse() });

    render(<BattleShareView backendUrl="http://backend.example" battleId={42} />);

    expect(await screen.findByText(/won system 7 in 3 round/i)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith('http://backend.example/battles/42');
  });

  it('renders both players and the winner', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => battleResponse() });

    render(<BattleShareView backendUrl="http://backend.example" battleId={42} />);

    expect(await screen.findByText(ATTACKER)).toBeInTheDocument();
    expect(screen.getByText(DEFENDER)).toBeInTheDocument();
    expect(screen.getByText('Battle #42')).toBeInTheDocument();
  });

  it('reports a missing battle', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 404, json: async () => ({}) });

    render(<BattleShareView backendUrl="http://backend.example" battleId={99} />);

    expect(await screen.findByText(/battle not found/i)).toBeInTheDocument();
  });

  it('reports a failed fetch', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });

    render(<BattleShareView backendUrl="http://backend.example" battleId={99} />);

    expect(await screen.findByText(/failed to fetch battle: 500/i)).toBeInTheDocument();
  });

  it('offers a link back to the game', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => battleResponse() });

    render(<BattleShareView backendUrl="http://backend.example" battleId={42} />);

    expect(await screen.findByRole('link', { name: /back to starbound realms/i })).toBeInTheDocument();
  });
});
