#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, token, Address, Env,
};

// ── Storage Keys ─────────────────────────────────────────────────────────────

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    IronToken,
    EnergyToken,
    PlasmaToken,
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

// ── Contract ──────────────────────────────────────────────────────────────────

#[contract]
pub struct ResourcesContract;

#[contractimpl]
impl ResourcesContract {
    /// Initialize with addresses of the three Stellar Asset Contract (SAC) tokens.
    pub fn initialize(
        env: Env,
        admin: Address,
        iron_token: Address,
        energy_token: Address,
        plasma_token: Address,
    ) {
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
        env.storage().instance().set(&DataKey::IronToken, &iron_token);
        env.storage().instance().set(&DataKey::EnergyToken, &energy_token);
        env.storage().instance().set(&DataKey::PlasmaToken, &plasma_token);
        env.storage().instance().set(&DataKey::Initialized, &true);
    }

    /// Mint resources to a player. Only callable by the admin.
    pub fn mint(env: Env, to: Address, resource: ResourceType, amount: i128) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("not initialized");

        admin.require_auth();

        let token_addr = Self::token_addr(&env, &resource);
        let client = token::StellarAssetClient::new(&env, &token_addr);
        client.mint(&to, &amount);

        env.events()
            .publish((symbol_short!("minted"), to), (resource, amount));
    }

    /// Burn resources from a player.
    pub fn burn(env: Env, from: Address, resource: ResourceType, amount: i128) {
        from.require_auth();

        let token_addr = Self::token_addr(&env, &resource);
        let client = token::TokenClient::new(&env, &token_addr);
        client.burn(&from, &amount);

        env.events()
            .publish((symbol_short!("burned"), from), (resource, amount));
    }

    /// Get a player's resource balance.
    pub fn balance(env: Env, player: Address, resource: ResourceType) -> i128 {
        let token_addr = Self::token_addr(&env, &resource);
        let client = token::TokenClient::new(&env, &token_addr);
        client.balance(&player)
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    fn token_addr(env: &Env, resource: &ResourceType) -> Address {
        match resource {
            ResourceType::Iron => env
                .storage()
                .instance()
                .get(&DataKey::IronToken)
                .expect("not initialized"),
            ResourceType::Energy => env
                .storage()
                .instance()
                .get(&DataKey::EnergyToken)
                .expect("not initialized"),
            ResourceType::Plasma => env
                .storage()
                .instance()
                .get(&DataKey::PlasmaToken)
                .expect("not initialized"),
        }
    }
}
