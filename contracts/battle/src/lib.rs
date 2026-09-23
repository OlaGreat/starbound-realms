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
