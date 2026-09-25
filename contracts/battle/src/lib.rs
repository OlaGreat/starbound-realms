#![no_std]

use soroban_sdk::{contract, contractimpl, contracttype, Address, Env};

// ── Storage Keys ─────────────────────────────────────────────────────────────

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    GalaxyMapContract,
    FleetContract,
    NextBattleId,
    Battle(u64),
    Initialized,
}

// ── Types ─────────────────────────────────────────────────────────────────────

/// Mirrors fleet::Fleet field-for-field so it encodes identically over the wire.
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct Fleet {
    pub scouts: u32,
    pub fighters: u32,
    pub cruisers: u32,
    pub dreadnoughts: u32,
    pub location: u32,
    pub last_moved: u64,
}

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct BattleResult {
    pub battle_id: u64,
    pub attacker: Address,
    pub defender: Address,
    pub system_id: u32,
    pub winner: Address,
    pub rounds: u32,
}

// ── Contract ──────────────────────────────────────────────────────────────────

#[contract]
pub struct BattleContract;

#[contractimpl]
impl BattleContract {
    /// Initialize with the galaxy-map and fleet contract addresses. Must be called once.
    pub fn initialize(env: Env, admin: Address, galaxy_map_contract: Address, fleet_contract: Address) {
        admin.require_auth();

        let already_init: bool = env
            .storage()
            .instance()
            .get(&DataKey::Initialized)
            .unwrap_or(false);

        if already_init {
            panic!("already initialized");
        }

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage()
            .instance()
            .set(&DataKey::GalaxyMapContract, &galaxy_map_contract);
        env.storage()
            .instance()
            .set(&DataKey::FleetContract, &fleet_contract);
        env.storage().instance().set(&DataKey::NextBattleId, &0u64);
        env.storage().instance().set(&DataKey::Initialized, &true);
    }

    // ── View functions ────────────────────────────────────────────────────────

    /// Returns a stored battle result by id, or panics if it doesn't exist.
    pub fn get_battle(env: Env, battle_id: u64) -> BattleResult {
        env.storage()
            .persistent()
            .get(&DataKey::Battle(battle_id))
            .expect("battle not found")
    }
}

// ── Combat math ───────────────────────────────────────────────────────────────

fn empty_fleet_with_location(location: u32) -> Fleet {
    Fleet { scouts: 0, fighters: 0, cruisers: 0, dreadnoughts: 0, location, last_moved: 0 }
}

/// A unit's defense stat doubles as its "toughness" when absorbing damage.
const UNIT_TOUGHNESS: [(u32, u32); 4] = [(0, 1), (1, 3), (2, 8), (3, 20)];

fn unit_count_mut(fleet: &mut Fleet, unit_index: u32) -> &mut u32 {
    match unit_index {
        0 => &mut fleet.scouts,
        1 => &mut fleet.fighters,
        2 => &mut fleet.cruisers,
        _ => &mut fleet.dreadnoughts,
    }
}

/// Removes units starting with the weakest (lowest-toughness) type until the
/// damage pool is exhausted or the fleet is empty.
fn apply_damage_to_fleet(fleet: &mut Fleet, mut damage: u32) {
    for (unit_index, toughness) in UNIT_TOUGHNESS {
        while damage > 0 && *unit_count_mut(fleet, unit_index) > 0 {
            *unit_count_mut(fleet, unit_index) -= 1;
            damage = damage.saturating_sub(toughness);
        }
        if damage == 0 {
            break;
        }
    }
}

/// Ties favor the defender, so the attacker needs a strictly higher roll to win a round.
fn did_attacker_lose_round(attacker_roll: u32, defender_roll: u32) -> bool {
    attacker_roll <= defender_roll
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::testutils::Address as _;
    use soroban_sdk::{Address, Env};

    fn setup_battle(env: &Env) -> (BattleContractClient<'_>, Address) {
        env.mock_all_auths();
        let contract_id = env.register(BattleContract, ());
        let client = BattleContractClient::new(env, &contract_id);
        let admin = Address::generate(env);
        let galaxy_map = Address::generate(env);
        let fleet = Address::generate(env);
        client.initialize(&admin, &galaxy_map, &fleet);
        (client, admin)
    }

    // ── damage application ────────────────────────────────────────────────────

    #[test]
    fn damage_kills_weakest_units_first() {
        let mut fleet = Fleet { scouts: 3, fighters: 2, cruisers: 0, dreadnoughts: 0, location: 0, last_moved: 0 };

        apply_damage_to_fleet(&mut fleet, 2);

        assert_eq!((fleet.scouts, fleet.fighters), (1, 2));
    }

    #[test]
    fn damage_moves_to_the_next_unit_type_once_the_weaker_one_is_gone() {
        let mut fleet = Fleet { scouts: 2, fighters: 2, cruisers: 0, dreadnoughts: 0, location: 0, last_moved: 0 };

        // 2 scouts cost 2 damage (defense 1 each), leaving 3 for fighters (defense 3 each)
        apply_damage_to_fleet(&mut fleet, 5);

        assert_eq!((fleet.scouts, fleet.fighters), (0, 1));
    }

    #[test]
    fn damage_that_exceeds_the_whole_fleet_empties_it_without_underflow() {
        let mut fleet = Fleet { scouts: 1, fighters: 0, cruisers: 0, dreadnoughts: 0, location: 0, last_moved: 0 };

        apply_damage_to_fleet(&mut fleet, 1_000_000);

        assert_eq!(fleet, empty_fleet_with_location(0));
    }

    #[test]
    fn a_kill_that_costs_more_toughness_than_remaining_damage_does_not_panic() {
        // fighter toughness is 3, but only 1 damage remains after this unit's kill
        // is credited — must clamp to zero, not underflow.
        let mut fleet = Fleet { scouts: 0, fighters: 1, cruisers: 0, dreadnoughts: 0, location: 0, last_moved: 0 };

        apply_damage_to_fleet(&mut fleet, 1);

        assert_eq!(fleet.fighters, 0);
    }

    #[test]
    fn zero_damage_leaves_the_fleet_unchanged() {
        let mut fleet = Fleet { scouts: 4, fighters: 0, cruisers: 0, dreadnoughts: 0, location: 0, last_moved: 0 };

        apply_damage_to_fleet(&mut fleet, 0);

        assert_eq!(fleet.scouts, 4);
    }

    // ── round outcome ─────────────────────────────────────────────────────────

    #[test]
    fn higher_roll_wins_the_round() {
        assert!(!did_attacker_lose_round(10, 5));
        assert!(did_attacker_lose_round(5, 10));
    }

    #[test]
    fn a_tied_roll_favors_the_defender() {
        assert!(did_attacker_lose_round(7, 7));
    }

    #[test]
    #[should_panic(expected = "already initialized")]
    fn initialize_panics_when_called_twice() {
        let env = Env::default();
        let (client, admin) = setup_battle(&env);
        let other = Address::generate(&env);

        client.initialize(&admin, &other, &other);
    }

    #[test]
    #[should_panic(expected = "battle not found")]
    fn get_battle_panics_for_unknown_id() {
        let env = Env::default();
        let (client, _) = setup_battle(&env);

        client.get_battle(&1);
    }
}
