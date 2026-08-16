import { describe, it, expect } from 'vitest';
import { didAttackerWin, getBattleLoser, wasBattleDecisive, BattleResult } from './battle';

const ATTACKER = 'GATTACKER111111111111111111111111111111111111111111111111';
const DEFENDER = 'GDEFENDER111111111111111111111111111111111111111111111111';

function makeBattle(winner: string, rounds = 10): BattleResult {
  return { battleId: 1, attacker: ATTACKER, defender: DEFENDER, systemId: 5, winner, rounds };
}

describe('didAttackerWin', () => {
  it('returns true when attacker is the winner', () => {
    expect(didAttackerWin(makeBattle(ATTACKER))).toBe(true);
  });

  it('returns false when defender is the winner', () => {
    expect(didAttackerWin(makeBattle(DEFENDER))).toBe(false);
  });
});

describe('getBattleLoser', () => {
  it('returns defender when attacker wins', () => {
    expect(getBattleLoser(makeBattle(ATTACKER))).toBe(DEFENDER);
  });

  it('returns attacker when defender wins', () => {
    expect(getBattleLoser(makeBattle(DEFENDER))).toBe(ATTACKER);
  });
});

describe('wasBattleDecisive', () => {
  it('returns true when battle ended before max rounds', () => {
    expect(wasBattleDecisive(makeBattle(ATTACKER, 15))).toBe(true);
  });

  it('returns false when battle reached max rounds', () => {
    expect(wasBattleDecisive(makeBattle(ATTACKER, 20))).toBe(false);
  });

  it('respects a custom max rounds argument', () => {
    expect(wasBattleDecisive(makeBattle(ATTACKER, 5), 5)).toBe(false);
  });
});
