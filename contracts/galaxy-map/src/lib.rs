#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, vec, Address, Env, Vec,
};

// ── Storage Keys ─────────────────────────────────────────────────────────────

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    System(u32),
    PlayerSystems(Address),
    GridSize,
    Initialized,
}

// ── Types ─────────────────────────────────────────────────────────────────────

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub enum ResourceType {
    Iron,
    Energy,
    Plasma,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct StarSystem {
    pub owner: Option<Address>,
    pub coord_x: u32,
    pub coord_y: u32,
    pub resource_type: ResourceType,
    pub resource_yield: u32,
    pub defense_rating: u32,
    pub last_claimed: u64,
}

// ── Contract ──────────────────────────────────────────────────────────────────

#[contract]
pub struct GalaxyMapContract;

#[contractimpl]
impl GalaxyMapContract {
    /// Initialize the galaxy grid. Must be called once after deployment.
    pub fn initialize(env: Env, admin: Address, grid_size: u32) {
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
            .set(&DataKey::GridSize, &grid_size);

        let total = grid_size * grid_size;
        let mut id: u32 = 0;

        while id < total {
            let system = StarSystem {
                owner: None,
                coord_x: id % grid_size,
                coord_y: id / grid_size,
                resource_type: match id % 3 {
                    0 => ResourceType::Iron,
                    1 => ResourceType::Energy,
                    _ => ResourceType::Plasma,
                },
                resource_yield: 10 + (id % 41),
                defense_rating: 5 + (id % 16),
                last_claimed: 0,
            };

            env.storage()
                .persistent()
                .set(&DataKey::System(id), &system);

            id += 1;
        }

        env.storage()
            .instance()
            .set(&DataKey::Initialized, &true);
    }

    /// Claim an unclaimed star system.
    pub fn claim_system(env: Env, player: Address, system_id: u32) {
        player.require_auth();

        let mut system: StarSystem = env
            .storage()
            .persistent()
            .get(&DataKey::System(system_id))
            .expect("system not found");

        if system.owner.is_some() {
            panic!("system already owned");
        }

        system.owner = Some(player.clone());
        system.last_claimed = env.ledger().timestamp();

        env.storage()
            .persistent()
            .set(&DataKey::System(system_id), &system);

        let mut player_systems: Vec<u32> = env
            .storage()
            .persistent()
            .get(&DataKey::PlayerSystems(player.clone()))
            .unwrap_or(vec![&env]);

        player_systems.push_back(system_id);

        env.storage()
            .persistent()
            .set(&DataKey::PlayerSystems(player.clone()), &player_systems);

        env.events()
            .publish((symbol_short!("claimed"), player), system_id);
    }

    // ── View functions ────────────────────────────────────────────────────────

    pub fn get_system(env: Env, system_id: u32) -> StarSystem {
        env.storage()
            .persistent()
            .get(&DataKey::System(system_id))
            .expect("system not found")
    }

    pub fn get_player_systems(env: Env, player: Address) -> Vec<u32> {
        env.storage()
            .persistent()
            .get(&DataKey::PlayerSystems(player))
            .unwrap_or(vec![&env])
    }

    pub fn get_grid_size(env: Env) -> u32 {
        env.storage()
            .instance()
            .get(&DataKey::GridSize)
            .expect("not initialized")
    }
}
