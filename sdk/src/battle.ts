import { nativeToScVal } from '@stellar/stellar-sdk';
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

/** The raw shape scValToNative produces for the contract's BattleResult struct. */
interface RawBattleResult {
  battle_id: bigint; // u64 decodes to bigint
  attacker: string;
  defender: string;
  system_id: number;
  winner: string;
  rounds: number;
}

/** Maps the contract's snake_case BattleResult to the SDK's camelCase shape. */
function toBattleResult(raw: RawBattleResult): BattleResult {
  return {
    battleId: Number(raw.battle_id),
    attacker: raw.attacker,
    defender: raw.defender,
    systemId: raw.system_id,
    winner: raw.winner,
    rounds: raw.rounds,
  };
}

export class BattleClient {
  constructor(private readonly client: StarboundClient) {}

  /**
   * Fetch a single battle result by ID from the chain. Returns a
   * BattleResult, not a BattleRecord: ledgerSequence and createdAt aren't
   * stored on-chain — they only exist in the indexer's database.
   */
  async getBattle(battleId: number): Promise<BattleResult> {
    const raw = await this.client.simulateReadCall(this.client.contractIds.battle, 'get_battle', [
      nativeToScVal(BigInt(battleId), { type: 'u64' }),
    ]);
    return toBattleResult(raw);
  }
}
