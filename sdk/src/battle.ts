import { StarboundClient } from './client';

export interface BattleResult {
  battleId: number;
  attacker: string;
  defender: string;
  systemId: number;
  winner: string;
  rounds: number;
}

export interface BattleRecord extends BattleResult {
  ledgerSequence: number;
  createdAt: number;
}

/** Returns true if the attacker won the battle */
export function didAttackerWin(result: BattleResult): boolean {
  return result.winner === result.attacker;
}

/** Returns the loser's address from a battle result */
export function getBattleLoser(result: BattleResult): string {
  return result.winner === result.attacker ? result.defender : result.attacker;
}

/** Returns true if the battle was decisive (finished before max rounds) */
export function wasBattleDecisive(result: BattleResult, maxRounds = 20): boolean {
  return result.rounds < maxRounds;
}

export class BattleClient {
  constructor(private readonly client: StarboundClient) {}

  /** Fetch a single battle record by ID */
  async getBattle(battleId: number): Promise<BattleRecord> {
    // TODO: call battle.get_battle via Soroban RPC
    throw new Error('getBattle: not yet implemented');
  }
}
