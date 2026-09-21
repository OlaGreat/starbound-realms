#![no_std]

use soroban_sdk::{contract, contractclient, contractimpl, contracttype, symbol_short, Address, Env};

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

/// Mirrors the resources contract's enum so it encodes identically over the wire.
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub enum ResourceType {
    Iron,
    Energy,
    Plasma,
}

/// The slice of the resources contract this contract depends on.
#[contractclient(name = "ResourcesClient")]
pub trait ResourcesInterface {
    fn burn(env: Env, from: Address, resource: ResourceType, amount: i128);
}

/// Resource cost, denominated in whole units of each resource token.
#[derive(Clone, Debug, PartialEq)]
pub struct UnitCost {
    pub iron: i128,
    pub energy: i128,
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

    /// Build `count` units of `unit_type`, paying their cost in resources.
    pub fn build_unit(env: Env, player: Address, unit_type: UnitType, count: u32) {
        player.require_auth();
        verify_count_is_positive(count);

        burn_build_cost(&env, &player, &total_build_cost(&unit_type, count));

        let mut fleet = get_stored_fleet(&env, &player);
        add_units_to_fleet(&mut fleet, &unit_type, count);
        save_fleet(&env, &player, &fleet);

        env.events()
            .publish((symbol_short!("built"), player), (unit_type, count));
    }

    // ── View functions ────────────────────────────────────────────────────────

    /// Returns a player's fleet, or an empty fleet if they have none.
    pub fn get_fleet(env: Env, player: Address) -> Fleet {
        get_stored_fleet(&env, &player)
    }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

fn verify_count_is_positive(count: u32) {
    if count == 0 {
        panic!("count must be positive");
    }
}

fn get_stored_fleet(env: &Env, player: &Address) -> Fleet {
    env.storage()
        .persistent()
        .get(&DataKey::Fleet(player.clone()))
        .unwrap_or(empty_fleet())
}

fn save_fleet(env: &Env, player: &Address, fleet: &Fleet) {
    env.storage()
        .persistent()
        .set(&DataKey::Fleet(player.clone()), fleet);
}

fn add_units_to_fleet(fleet: &mut Fleet, unit: &UnitType, count: u32) {
    match unit {
        UnitType::Scout => fleet.scouts += count,
        UnitType::Fighter => fleet.fighters += count,
        UnitType::Cruiser => fleet.cruisers += count,
        UnitType::Dreadnought => fleet.dreadnoughts += count,
    }
}

/// Burns the iron then energy cost from the player via the resources contract.
fn burn_build_cost(env: &Env, player: &Address, cost: &UnitCost) {
    let resources_addr: Address = env
        .storage()
        .instance()
        .get(&DataKey::ResourcesContract)
        .expect("not initialized");
    let resources = ResourcesClient::new(env, &resources_addr);

    resources.burn(player, &ResourceType::Iron, &cost.iron);
    resources.burn(player, &ResourceType::Energy, &cost.energy);
}

/// Cost of building a single unit of the given type.
fn unit_cost(unit: &UnitType) -> UnitCost {
    match unit {
        UnitType::Scout => UnitCost { iron: 10, energy: 5 },
        UnitType::Fighter => UnitCost { iron: 25, energy: 15 },
        UnitType::Cruiser => UnitCost { iron: 60, energy: 40 },
        UnitType::Dreadnought => UnitCost { iron: 150, energy: 100 },
    }
}

/// Cost of building `count` units of the given type.
fn total_build_cost(unit: &UnitType, count: u32) -> UnitCost {
    let single = unit_cost(unit);
    UnitCost {
        iron: single.iron * count as i128,
        energy: single.energy * count as i128,
    }
}

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
    use soroban_sdk::testutils::{Address as _, Events};
    use soroban_sdk::{contract, contractimpl, symbol_short, Address, Env, IntoVal, Vec};

    /// Stand-in for the resources contract that records every burn it receives.
    #[contract]
    struct MockResources;

    #[contractimpl]
    impl MockResources {
        pub fn burn(env: Env, from: Address, resource: ResourceType, amount: i128) {
            from.require_auth();
            let mut burns: Vec<(Address, ResourceType, i128)> = env
                .storage()
                .instance()
                .get(&symbol_short!("burns"))
                .unwrap_or(Vec::new(&env));
            burns.push_back((from, resource, amount));
            env.storage().instance().set(&symbol_short!("burns"), &burns);
        }

        pub fn burns(env: Env) -> Vec<(Address, ResourceType, i128)> {
            env.storage()
                .instance()
                .get(&symbol_short!("burns"))
                .unwrap_or(Vec::new(&env))
        }
    }

    struct Fixture<'a> {
        client: FleetContractClient<'a>,
        resources: MockResourcesClient<'a>,
    }

    fn setup_fleet(env: &Env) -> Fixture<'_> {
        env.mock_all_auths();
        let resources_id = env.register(MockResources, ());
        let contract_id = env.register(FleetContract, ());
        let client = FleetContractClient::new(env, &contract_id);
        let admin = Address::generate(env);
        client.initialize(&admin, &resources_id);
        Fixture { client, resources: MockResourcesClient::new(env, &resources_id) }
    }

    #[test]
    fn get_fleet_returns_empty_fleet_for_new_player() {
        let env = Env::default();
        let fx = setup_fleet(&env);
        let player = Address::generate(&env);

        let fleet = fx.client.get_fleet(&player);

        assert_eq!(
            fleet,
            Fleet { scouts: 0, fighters: 0, cruisers: 0, dreadnoughts: 0, location: 0, last_moved: 0 }
        );
    }

    #[test]
    #[should_panic(expected = "already initialized")]
    fn initialize_panics_when_called_twice() {
        let env = Env::default();
        let fx = setup_fleet(&env);
        let admin = Address::generate(&env);

        fx.client.initialize(&admin, &fx.resources.address);
    }

    #[test]
    fn unit_cost_matches_the_game_mechanics_table() {
        assert_eq!(unit_cost(&UnitType::Scout), UnitCost { iron: 10, energy: 5 });
        assert_eq!(unit_cost(&UnitType::Fighter), UnitCost { iron: 25, energy: 15 });
        assert_eq!(unit_cost(&UnitType::Cruiser), UnitCost { iron: 60, energy: 40 });
        assert_eq!(unit_cost(&UnitType::Dreadnought), UnitCost { iron: 150, energy: 100 });
    }

    #[test]
    fn total_build_cost_multiplies_unit_cost_by_count() {
        assert_eq!(
            total_build_cost(&UnitType::Fighter, 4),
            UnitCost { iron: 100, energy: 60 }
        );
    }

    #[test]
    fn build_unit_adds_units_to_the_players_fleet() {
        let env = Env::default();
        let fx = setup_fleet(&env);
        let player = Address::generate(&env);

        fx.client.build_unit(&player, &UnitType::Scout, &3);

        assert_eq!(fx.client.get_fleet(&player).scouts, 3);
    }

    #[test]
    fn build_unit_increments_the_matching_unit_counter() {
        let env = Env::default();
        let fx = setup_fleet(&env);
        let player = Address::generate(&env);

        fx.client.build_unit(&player, &UnitType::Scout, &1);
        fx.client.build_unit(&player, &UnitType::Fighter, &2);
        fx.client.build_unit(&player, &UnitType::Cruiser, &3);
        fx.client.build_unit(&player, &UnitType::Dreadnought, &4);

        let fleet = fx.client.get_fleet(&player);
        assert_eq!(
            (fleet.scouts, fleet.fighters, fleet.cruisers, fleet.dreadnoughts),
            (1, 2, 3, 4)
        );
    }

    #[test]
    fn build_unit_accumulates_across_calls() {
        let env = Env::default();
        let fx = setup_fleet(&env);
        let player = Address::generate(&env);

        fx.client.build_unit(&player, &UnitType::Fighter, &2);
        fx.client.build_unit(&player, &UnitType::Fighter, &5);

        assert_eq!(fx.client.get_fleet(&player).fighters, 7);
    }

    #[test]
    fn build_unit_burns_iron_then_energy_cost_from_the_player() {
        let env = Env::default();
        let fx = setup_fleet(&env);
        let player = Address::generate(&env);

        fx.client.build_unit(&player, &UnitType::Fighter, &4);

        assert_eq!(
            fx.resources.burns(),
            soroban_sdk::vec![
                &env,
                (player.clone(), ResourceType::Iron, 100i128),
                (player, ResourceType::Energy, 60i128),
            ]
        );
    }

    #[test]
    fn build_unit_requires_player_authorization() {
        let env = Env::default();
        let fx = setup_fleet(&env);
        let player = Address::generate(&env);

        fx.client.build_unit(&player, &UnitType::Scout, &1);

        let (authorizer, _) = env.auths().into_iter().next().unwrap();
        assert_eq!(authorizer, player);
    }

    #[test]
    fn build_unit_keeps_players_fleets_separate() {
        let env = Env::default();
        let fx = setup_fleet(&env);
        let alice = Address::generate(&env);
        let bob = Address::generate(&env);

        fx.client.build_unit(&alice, &UnitType::Scout, &2);

        assert_eq!(fx.client.get_fleet(&bob).scouts, 0);
    }

    #[test]
    #[should_panic(expected = "count must be positive")]
    fn build_unit_panics_when_count_is_zero() {
        let env = Env::default();
        let fx = setup_fleet(&env);
        let player = Address::generate(&env);

        fx.client.build_unit(&player, &UnitType::Scout, &0);
    }

    #[test]
    fn build_unit_emits_built_event() {
        let env = Env::default();
        let fx = setup_fleet(&env);
        let player = Address::generate(&env);

        fx.client.build_unit(&player, &UnitType::Cruiser, &2);

        let (contract, topics, data) = env
            .events()
            .all()
            .into_iter()
            .filter(|(c, _, _)| *c == fx.client.address)
            .last()
            .unwrap();
        assert_eq!(contract, fx.client.address);
        assert_eq!(topics, (symbol_short!("built"), player).into_val(&env));
        let payload: (UnitType, u32) = data.into_val(&env);
        assert_eq!(payload, (UnitType::Cruiser, 2));
    }
}
