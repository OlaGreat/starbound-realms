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

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::testutils::{Address as _, Events};
    use soroban_sdk::{Env, IntoVal};

    struct Fixture<'a> {
        client: ResourcesContractClient<'a>,
        admin: Address,
    }

    fn setup_resources(env: &Env) -> Fixture<'_> {
        env.mock_all_auths();
        let admin = Address::generate(env);
        let iron = env.register_stellar_asset_contract_v2(admin.clone());
        let energy = env.register_stellar_asset_contract_v2(admin.clone());
        let plasma = env.register_stellar_asset_contract_v2(admin.clone());

        let contract_id = env.register(ResourcesContract, ());
        let client = ResourcesContractClient::new(env, &contract_id);
        client.initialize(&admin, &iron.address(), &energy.address(), &plasma.address());

        Fixture { client, admin }
    }

    #[test]
    fn balance_is_zero_for_new_player() {
        let env = Env::default();
        let fx = setup_resources(&env);
        let player = Address::generate(&env);

        assert_eq!(fx.client.balance(&player, &ResourceType::Iron), 0);
    }

    #[test]
    fn mint_increases_balance_of_that_resource() {
        let env = Env::default();
        let fx = setup_resources(&env);
        let player = Address::generate(&env);

        fx.client.mint(&player, &ResourceType::Iron, &100);

        assert_eq!(fx.client.balance(&player, &ResourceType::Iron), 100);
    }

    #[test]
    fn mint_does_not_change_other_resource_balances() {
        let env = Env::default();
        let fx = setup_resources(&env);
        let player = Address::generate(&env);

        fx.client.mint(&player, &ResourceType::Iron, &100);

        assert_eq!(fx.client.balance(&player, &ResourceType::Energy), 0);
        assert_eq!(fx.client.balance(&player, &ResourceType::Plasma), 0);
    }

    #[test]
    fn each_resource_is_backed_by_its_own_token() {
        let env = Env::default();
        let fx = setup_resources(&env);
        let player = Address::generate(&env);

        fx.client.mint(&player, &ResourceType::Iron, &1);
        fx.client.mint(&player, &ResourceType::Energy, &20);
        fx.client.mint(&player, &ResourceType::Plasma, &300);

        assert_eq!(fx.client.balance(&player, &ResourceType::Iron), 1);
        assert_eq!(fx.client.balance(&player, &ResourceType::Energy), 20);
        assert_eq!(fx.client.balance(&player, &ResourceType::Plasma), 300);
    }

    #[test]
    fn mint_accumulates_across_calls() {
        let env = Env::default();
        let fx = setup_resources(&env);
        let player = Address::generate(&env);

        fx.client.mint(&player, &ResourceType::Plasma, &40);
        fx.client.mint(&player, &ResourceType::Plasma, &2);

        assert_eq!(fx.client.balance(&player, &ResourceType::Plasma), 42);
    }

    #[test]
    fn mint_requires_admin_authorization() {
        let env = Env::default();
        let fx = setup_resources(&env);
        let player = Address::generate(&env);

        fx.client.mint(&player, &ResourceType::Iron, &1);

        let (authorizer, _) = env.auths().into_iter().next().unwrap();
        assert_eq!(authorizer, fx.admin);
    }

    #[test]
    fn mint_emits_minted_event() {
        let env = Env::default();
        let fx = setup_resources(&env);
        let player = Address::generate(&env);

        fx.client.mint(&player, &ResourceType::Energy, &7);

        let (contract, topics, data) = env
            .events()
            .all()
            .into_iter()
            .filter(|(c, _, _)| *c == fx.client.address)
            .last()
            .unwrap();
        assert_eq!(contract, fx.client.address);
        assert_eq!(topics, (symbol_short!("minted"), player).into_val(&env));
        let payload: (ResourceType, i128) = data.into_val(&env);
        assert_eq!(payload, (ResourceType::Energy, 7));
    }

    #[test]
    fn burn_decreases_balance() {
        let env = Env::default();
        let fx = setup_resources(&env);
        let player = Address::generate(&env);
        fx.client.mint(&player, &ResourceType::Iron, &100);

        fx.client.burn(&player, &ResourceType::Iron, &30);

        assert_eq!(fx.client.balance(&player, &ResourceType::Iron), 70);
    }

    #[test]
    #[should_panic]
    fn burn_panics_when_balance_is_insufficient() {
        let env = Env::default();
        let fx = setup_resources(&env);
        let player = Address::generate(&env);
        fx.client.mint(&player, &ResourceType::Iron, &10);

        fx.client.burn(&player, &ResourceType::Iron, &11);
    }

    #[test]
    fn burn_emits_burned_event() {
        let env = Env::default();
        let fx = setup_resources(&env);
        let player = Address::generate(&env);
        fx.client.mint(&player, &ResourceType::Iron, &10);

        fx.client.burn(&player, &ResourceType::Iron, &4);

        let (contract, topics, data) = env
            .events()
            .all()
            .into_iter()
            .filter(|(c, _, _)| *c == fx.client.address)
            .last()
            .unwrap();
        assert_eq!(contract, fx.client.address);
        assert_eq!(topics, (symbol_short!("burned"), player).into_val(&env));
        let payload: (ResourceType, i128) = data.into_val(&env);
        assert_eq!(payload, (ResourceType::Iron, 4));
    }

    #[test]
    #[should_panic(expected = "already initialized")]
    fn initialize_panics_when_called_twice() {
        let env = Env::default();
        let fx = setup_resources(&env);
        let token = Address::generate(&env);

        fx.client.initialize(&fx.admin, &token, &token, &token);
    }

    #[test]
    #[should_panic(expected = "not initialized")]
    fn mint_panics_before_initialization() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(ResourcesContract, ());
        let client = ResourcesContractClient::new(&env, &contract_id);
        let player = Address::generate(&env);

        client.mint(&player, &ResourceType::Iron, &1);
    }
}
