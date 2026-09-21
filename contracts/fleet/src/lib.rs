#![no_std]

use soroban_sdk::{contract, contractimpl, contracttype, Address, Env};

// ── Storage Keys ─────────────────────────────────────────────────────────────

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    ResourcesContract,
    Fleet(Address),
    Initialized,
}

// ── Types ─────────────────────────────────────────────────────────────────────

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub enum UnitType {
    Scout,
    Fighter,
    Cruiser,
    Dreadnought,
}

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

// ── Contract ──────────────────────────────────────────────────────────────────

#[contract]
pub struct FleetContract;

#[contractimpl]
impl FleetContract {
    /// Initialize with the address of the resources contract. Must be called once.
    pub fn initialize(env: Env, admin: Address, resources_contract: Address) {
        admin.require_auth();

        let already_init: bool = env
            .storage()
            .instance()
            .get(&DataKey::Initialized)
            .unwrap_or(false);

        if already_init {
            panic!("already initialized");
        }

        env.storage()
            .instance()
            .set(&DataKey::ResourcesContract, &resources_contract);
        env.storage().instance().set(&DataKey::Initialized, &true);
    }

    // ── View functions ────────────────────────────────────────────────────────

    /// Returns a player's fleet, or an empty fleet if they have none.
    pub fn get_fleet(env: Env, player: Address) -> Fleet {
        env.storage()
            .persistent()
            .get(&DataKey::Fleet(player))
            .unwrap_or(empty_fleet())
    }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

fn empty_fleet() -> Fleet {
    Fleet {
        scouts: 0,
        fighters: 0,
        cruisers: 0,
        dreadnoughts: 0,
        location: 0,
        last_moved: 0,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::testutils::Address as _;
    use soroban_sdk::{Address, Env};

    fn setup_fleet(env: &Env) -> (FleetContractClient<'_>, Address) {
        env.mock_all_auths();
        let contract_id = env.register(FleetContract, ());
        let client = FleetContractClient::new(env, &contract_id);
        let admin = Address::generate(env);
        let resources = Address::generate(env);
        client.initialize(&admin, &resources);
        (client, resources)
    }

    #[test]
    fn get_fleet_returns_empty_fleet_for_new_player() {
        let env = Env::default();
        let (client, _) = setup_fleet(&env);
        let player = Address::generate(&env);

        let fleet = client.get_fleet(&player);

        assert_eq!(
            fleet,
            Fleet { scouts: 0, fighters: 0, cruisers: 0, dreadnoughts: 0, location: 0, last_moved: 0 }
        );
    }

    #[test]
    #[should_panic(expected = "already initialized")]
    fn initialize_panics_when_called_twice() {
        let env = Env::default();
        let (client, resources) = setup_fleet(&env);
        let admin = Address::generate(&env);

        client.initialize(&admin, &resources);
    }
}
