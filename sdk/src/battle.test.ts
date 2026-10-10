import { describe, it, expect, vi } from 'vitest';
import { decodeInvokeArgs } from './xdr.testutil.js';
import { Keypair, nativeToScVal, scValToNative, StrKey } from '@stellar/stellar-sdk';
import { didAttackerWin, getBattleLoser, wasBattleDecisive, BattleClient, BattleResult } from './battle.js';

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

describe('BattleClient.getBattle', () => {
  function makeClient(simulateReadCall: ReturnType<typeof vi.fn>): any {
    return { simulateReadCall, contractIds: { battle: 'CBATTLE' } };
  }

  // Shape exactly as scValToNative decodes the contract's BattleResult:
  // snake_case field names, and u64 as bigint.
  const rawBattle = {
    battle_id: 5n,
    attacker: ATTACKER,
    defender: DEFENDER,
    system_id: 9,
    winner: ATTACKER,
    rounds: 3,
  };

  it("maps the contract's snake_case BattleResult to the SDK's camelCase shape with a numeric id", async () => {
    const battle = new BattleClient(makeClient(vi.fn().mockResolvedValue(rawBattle)));

    const result = await battle.getBattle(5);

    expect(result).toEqual({
      battleId: 5,
      attacker: ATTACKER,
      defender: DEFENDER,
      systemId: 9,
      winner: ATTACKER,
      rounds: 3,
    });
  });

  it('calls get_battle with the battle id encoded as a u64', async () => {
    const simulateReadCall = vi.fn().mockResolvedValue(rawBattle);
    const battle = new BattleClient(makeClient(simulateReadCall));

    await battle.getBattle(5);

    expect(simulateReadCall).toHaveBeenCalledWith('CBATTLE', 'get_battle', [expect.anything()]);
    expect(scValToNative(simulateReadCall.mock.calls[0][2][0])).toBe(5n);
  });
});

// ── BattleClient.resolveBattle ───────────────────────────────────────────────

describe('BattleClient.resolveBattle', () => {
  const BATTLE_ID = StrKey.encodeContract(Buffer.alloc(32, 8));
  const ATTACKER_ADDR = Keypair.random().publicKey();
  const DEFENDER_ADDR = Keypair.random().publicKey();

  function makeClient(overrides: Record<string, ReturnType<typeof vi.fn>>): any {
    return { contractIds: { battle: BATTLE_ID }, ...overrides };
  }

  it('submits a resolve_battle call and returns the decoded battle id', async () => {
    const submitTransaction = vi.fn().mockResolvedValue({
      status: 'SUCCESS',
      returnValue: nativeToScVal(7n, { type: 'u64' }),
    });
    const battle = new BattleClient(makeClient({ submitTransaction }));
    const sign = vi.fn();

    const battleId = await battle.resolveBattle(ATTACKER_ADDR, DEFENDER_ADDR, 3, sign);

    expect(battleId).toBe(7);
    const options = submitTransaction.mock.calls[0][0];
    expect(options.sourceAddress).toBe(ATTACKER_ADDR);
    expect(options.sign).toBe(sign);

    const args = decodeInvokeArgs(options.operation);
    expect(args[0]).toBe(ATTACKER_ADDR);
    expect(args[1]).toBe(DEFENDER_ADDR);
    expect(args[2]).toBe(3);
  });
});
