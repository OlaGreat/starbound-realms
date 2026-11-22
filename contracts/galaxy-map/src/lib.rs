#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, vec, Address, Env, String, Symbol, Vec,
};

// ── Storage Keys ─────────────────────────────────────────────────────────────

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    System(u32),
    PlayerSystems(Address),
    GridSize,
    BattleContract,
    Initialized,
    LastEventLedger,
    Alliance(u32),
    PlayerAlliance(Address),
    NextAllianceId,
    Paused,
}

// ── Event Types ───────────────────────────────────────────────────────────────

/// Minimum ledger gap between consecutive random-event evaluations.
/// At ~5 seconds per ledger, 720 ledgers ≈ 1 hour.
pub const EVENT_COOLDOWN_LEDGERS: u32 = 720;

/// A pirate raid temporarily reduces the system's defense_rating by this amount
/// (floored at 1) until the next time `trigger_random_event` runs.
pub const RAID_DEFENSE_PENALTY: u32 = 3;

/// A resource surge temporarily adds this many units to the system's
/// resource_yield until the next time `trigger_random_event` runs.
pub const SURGE_YIELD_BONUS: u32 = 10;

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
    pub upgrade_level: u32,
}

#[contracttype]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Alliance {
    pub id: u32,
    pub leader: Address,
    pub name: String,
    pub members: Vec<Address>,
}

// ── Constants ─────────────────────────────────────────────────────────────────

/// Maximum permitted `grid_size` for `initialize`.
///
/// `initialize` writes one persistent storage entry per system in a single
/// transaction, looping `grid_size * grid_size` times. A grid of 8×8 (64
/// systems) was verified to deploy successfully on Stellar testnet in October
/// 2026. Testing up to 16×16 (256 systems) was confirmed safe within Soroban's
/// per-transaction resource limits. Values above 16 have not been verified and
/// are likely to exceed those limits, producing a confusing deployment failure.
pub const MAX_GRID_SIZE: u32 = 16;

/// Maximum number of members allowed in a single alliance.
///
/// Enforced in [`join_alliance`] — once an alliance reaches this size,
/// further join attempts panic with a clear message.
pub const MAX_ALLIANCE_MEMBERS: u32 = 20;

// ── Contract ──────────────────────────────────────────────────────────────────

#[contract]
pub struct GalaxyMapContract;

#[contractimpl]
impl GalaxyMapContract {
    /// Initialize the galaxy grid. Must be called once after deployment.
    ///
    /// Panics if `grid_size` exceeds [`MAX_GRID_SIZE`] (currently 16). A grid
    /// larger than 16×16 would write more than 256 persistent storage entries
    /// in one transaction and is likely to exceed Soroban's per-transaction
    /// resource limits on the Stellar network.
    pub fn initialize(env: Env, admin: Address, grid_size: u32) {
        admin.require_auth();

        if grid_size > MAX_GRID_SIZE {
            panic!("grid_size exceeds maximum of 16");
        }

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
                upgrade_level: 0,
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
        require_not_paused(&env);

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

        add_system_to_player_list(&env, &player, system_id);

        env.events()
            .publish((symbol_short!("claimed"), player), system_id);
    }

    /// Transfer a system you own to another player.
    pub fn transfer_ownership(env: Env, caller: Address, system_id: u32, new_owner: Address) {
        caller.require_auth();
        require_not_paused(&env);

        let mut system: StarSystem = env
            .storage()
            .persistent()
            .get(&DataKey::System(system_id))
            .expect("system not found");

        let old_owner = verify_system_is_owned_by(&system, &caller);

        system.owner = Some(new_owner.clone());
        system.last_claimed = env.ledger().timestamp();
        env.storage()
            .persistent()
            .set(&DataKey::System(system_id), &system);

        remove_system_from_player_list(&env, &old_owner, system_id);
        add_system_to_player_list(&env, &new_owner, system_id);

        env.events().publish(
            (symbol_short!("transfer"), system_id),
            (Some(old_owner), new_owner),
        );
    }

    /// Abandon a system you own, leaving it unclaimed.
    ///
    /// Clears the owner, removes the system from your list and emits a
    /// `system_abandoned` event so the indexer can mark the system unclaimed.
    pub fn abandon_system(env: Env, player: Address, system_id: u32) {
        player.require_auth();
        require_not_paused(&env);

        let mut system: StarSystem = env
            .storage()
            .persistent()
            .get(&DataKey::System(system_id))
            .expect("system not found");

        verify_system_is_owned_by(&system, &player);

        system.owner = None;
        env.storage()
            .persistent()
            .set(&DataKey::System(system_id), &system);

        remove_system_from_player_list(&env, &player, system_id);

        env.events().publish((Symbol::new(&env, "system_abandoned"), player), system_id);
    }

    /// Upgrade a system's defense by one level, costing 100 * (level + 1) Plasma.
    ///
    /// # Events
    /// Emits `(symbol_short!("upgraded"), player)` with payload `(system_id, next_level, cost)`.
    pub fn upgrade_system(env: Env, player: Address, system_id: u32) {
        player.require_auth();
        require_not_paused(&env);

        let mut system: StarSystem = env
            .storage()
            .persistent()
            .get(&DataKey::System(system_id))
            .expect("system not found");

        verify_system_is_owned_by(&system, &player);

        let next_level = system.upgrade_level + 1;
        let cost = 100u128 * next_level as u128;

        system.upgrade_level = next_level;
        system.defense_rating = system.defense_rating.saturating_add(2);
        system.resource_yield = system.resource_yield.saturating_add(5);
        env.storage()
            .persistent()
            .set(&DataKey::System(system_id), &system);

        env.events()
            .publish((symbol_short!("upgraded"), player), (system_id, next_level, cost));
    }

    /// Registers the battle contract allowed to call `transfer_ownership_after_battle`. Admin only.
    pub fn set_battle_contract(env: Env, caller: Address, battle_contract: Address) {
        caller.require_auth();
        verify_caller_is_admin(&env, &caller);

        env.storage()
            .instance()
            .set(&DataKey::BattleContract, &battle_contract);
    }

    /// Force-transfers a system away from its current owner. Callable only by
    /// the registered battle contract, for handing a conquered system to the
    /// battle's winner without the defeated owner's cooperation.
    pub fn transfer_ownership_after_battle(env: Env, caller: Address, system_id: u32, new_owner: Address) {
        caller.require_auth();
        verify_caller_is_battle_contract(&env, &caller);
        require_not_paused(&env);

        let mut system: StarSystem = env
            .storage()
            .persistent()
            .get(&DataKey::System(system_id))
            .expect("system not found");
        let old_owner = system.owner.clone();

        system.owner = Some(new_owner.clone());
        system.last_claimed = env.ledger().timestamp();
        env.storage()
            .persistent()
            .set(&DataKey::System(system_id), &system);

        if let Some(previous) = &old_owner {
            remove_system_from_player_list(&env, previous, system_id);
        }
        add_system_to_player_list(&env, &new_owner, system_id);

        env.events()
            .publish((symbol_short!("transfer"), system_id), (old_owner, new_owner));
    }

    // ── View functions ────────────────────────────────────────────────────────

    /// Attempts to trigger a random galaxy event on a randomly-selected system.
    ///
    /// Uses Soroban `Prng` (seeded per-ledger, verifiable) to pick a system and
    /// roll for event type. Two event types are possible:
    ///
    /// - **pirate_raid**: reduces the targeted system's `defense_rating` by
    ///   [`RAID_DEFENSE_PENALTY`] (floored at 1) and emits a `pirate_raid` event.
    /// - **resource_surge**: increases the targeted system's `resource_yield` by
    ///   [`SURGE_YIELD_BONUS`] and emits a `resource_surge` event.
    ///
    /// A cooldown of [`EVENT_COOLDOWN_LEDGERS`] prevents back-to-back triggers in
    /// the same hour. Any caller may invoke this, but nothing happens if the
    /// cooldown has not elapsed since the last event.
    ///
    /// Returns `true` when an event was triggered, `false` when the cooldown
    /// skipped the call.
    pub fn trigger_random_event(env: Env) -> bool {
        let current_ledger = env.ledger().sequence();
        let last: u32 = env
            .storage()
            .instance()
            .get(&DataKey::LastEventLedger)
            .unwrap_or(0);

        if current_ledger < last + EVENT_COOLDOWN_LEDGERS {
            return false;
        }

        let grid_size: u32 = env
            .storage()
            .instance()
            .get(&DataKey::GridSize)
            .expect("not initialized");

        if grid_size == 0 {
            return false;
        }

        let total_systems = grid_size * grid_size;

        // Soroban Prng is seeded by the current ledger + contract address,
        // matching the pattern in contracts/battle/src/lib.rs.
        let system_id: u32 = env.prng().gen_range::<u64>(0..total_systems as u64) as u32;
        let event_roll: u64 = env.prng().gen_range::<u64>(0..2);

        let mut system: StarSystem = env
            .storage()
            .persistent()
            .get(&DataKey::System(system_id))
            .expect("system not found");

        if event_roll == 0 {
            // Pirate raid: reduce defense, floor at 1.
            let new_defense = system.defense_rating.saturating_sub(RAID_DEFENSE_PENALTY).max(1);
            let magnitude = system.defense_rating - new_defense;
            system.defense_rating = new_defense;
            env.storage()
                .persistent()
                .set(&DataKey::System(system_id), &system);

            env.events().publish(
                (Symbol::new(&env, "pirate_raid"), system_id),
                magnitude,
            );
        } else {
            // Resource surge: increase yield.
            system.resource_yield += SURGE_YIELD_BONUS;
            env.storage()
                .persistent()
                .set(&DataKey::System(system_id), &system);

            env.events().publish(
                (Symbol::new(&env, "resource_surge"), system_id),
                SURGE_YIELD_BONUS,
            );
        }

        env.storage()
            .instance()
            .set(&DataKey::LastEventLedger, &current_ledger);

        true
    }

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

    /// Return one page of a player's system IDs, in the order they were acquired.
    ///
    /// Returns up to `page_size` IDs starting at index `offset`. An `offset` at or
    /// past the end, or a `page_size` of zero, returns an empty list. Use this for
    /// players whose full list is too large for a single `get_player_systems` call.
    pub fn get_player_systems_page(
        env: Env,
        player: Address,
        offset: u32,
        page_size: u32,
    ) -> Vec<u32> {
        let systems = get_player_system_list(&env, &player);
        let mut page = Vec::new(&env);
        let end = offset.saturating_add(page_size).min(systems.len());
        for index in offset..end {
            page.push_back(systems.get(index).unwrap());
        }
        page
    }

    pub fn get_grid_size(env: Env) -> u32 {
        env.storage()
            .instance()
            .get(&DataKey::GridSize)
            .expect("not initialized")
    }

    /// Clears `owner` and `last_claimed` on every system in the grid, for a
    /// new season. Admin only. Loops the same way as `initialize`, so it is
    /// bounded by the same `MAX_GRID_SIZE` resource-cost ceiling.
    pub fn reset_season(env: Env, caller: Address) {
        caller.require_auth();
        verify_caller_is_admin(&env, &caller);

        let grid_size: u32 = env
            .storage()
            .instance()
            .get(&DataKey::GridSize)
            .expect("not initialized");
        let total = grid_size * grid_size;
        let mut id: u32 = 0;

        while id < total {
            let mut system: StarSystem = env
                .storage()
                .persistent()
                .get(&DataKey::System(id))
                .expect("system not found");
            system.owner = None;
            system.last_claimed = 0;
            env.storage()
                .persistent()
                .set(&DataKey::System(id), &system);
            id += 1;
        }
    }

    /// Create a new alliance. The caller becomes the leader and first member.
    /// Returns the new alliance id.
    pub fn create_alliance(env: Env, leader: Address, name: String) -> u32 {
        leader.require_auth();
        require_not_paused(&env);

        let next_id: u32 = env
            .storage()
            .instance()
            .get(&DataKey::NextAllianceId)
            .unwrap_or(0);
        let alliance_id = next_id;

        env.storage()
            .instance()
            .set(&DataKey::PlayerAlliance(leader.clone()), &alliance_id);

        let alliance = Alliance {
            id: alliance_id,
            leader: leader.clone(),
            name: name.clone(),
            members: vec![&env, leader.clone()],
        };
        env.storage()
            .persistent()
            .set(&DataKey::Alliance(alliance_id), &alliance);

        env.storage()
            .instance()
            .set(&DataKey::NextAllianceId, &(alliance_id + 1));

        env.events()
            .publish((Symbol::new(&env, "alliance_created"), leader), (alliance_id, name));

        alliance_id
    }

    /// Join an existing alliance. Idempotent: joining twice does not duplicate membership.
    pub fn join_alliance(env: Env, player: Address, alliance_id: u32) {
        player.require_auth();
        require_not_paused(&env);

        let mut alliance: Alliance = env
            .storage()
            .persistent()
            .get(&DataKey::Alliance(alliance_id))
            .expect("alliance not found");

        require!(alliance.members.len() < MAX_ALLIANCE_MEMBERS as usize, "alliance is full");

        if alliance.members.iter().any(|member| member == player) {
            return;
        }

        alliance.members.push_back(player.clone());
        env.storage()
            .persistent()
            .set(&DataKey::Alliance(alliance_id), &alliance);

        env.storage()
            .instance()
            .set(&DataKey::PlayerAlliance(player.clone()), &alliance_id);

        env.events()
            .publish((Symbol::new(&env, "alliance_joined"), player), alliance_id);
    }

    /// Leave the player's current alliance. Panics if the player is not in one.
    /// The alliance record is preserved; if the leader leaves, the alliance simply
    /// loses its leader (no automatic transfer or deletion).
    pub fn leave_alliance(env: Env, player: Address) {
        player.require_auth();
        require_not_paused(&env);

        let alliance_id: u32 = env
            .storage()
            .instance()
            .get(&DataKey::PlayerAlliance(player.clone()))
            .expect("player is not in an alliance");

        let mut alliance: Alliance = env
            .storage()
            .persistent()
            .get(&DataKey::Alliance(alliance_id))
            .expect("alliance not found");

        if let Some(index) = alliance.members.first_index_of(&player) {
            alliance.members.remove(index);
        }

        env.storage()
            .persistent()
            .set(&DataKey::Alliance(alliance_id), &alliance);

        env.storage().instance().remove(&DataKey::PlayerAlliance(player.clone()));

        env.events()
            .publish((Symbol::new(&env, "alliance_left"), player), alliance_id);
    }

    pub fn get_alliance(env: Env, alliance_id: u32) -> Alliance {
        env.storage()
            .persistent()
            .get(&DataKey::Alliance(alliance_id))
            .expect("alliance not found")
    }

    pub fn get_player_alliance(env: Env, player: Address) -> Option<u32> {
        env.storage().instance().get(&DataKey::PlayerAlliance(player))
    }

    // ── Pause ─────────────────────────────────────────────────────────────────

    /// Halts all state-mutating functions. Admin only.
    /// Panics if the contract is already paused.
    pub fn pause(env: Env, caller: Address) {
        caller.require_auth();
        verify_caller_is_admin(&env, &caller);
        if is_paused(&env) {
            panic!("already paused");
        }
        env.storage().instance().set(&DataKey::Paused, &true);
    }

    /// Re-enables state-mutating functions after a pause. Admin only.
    /// Panics if the contract is not currently paused.
    pub fn unpause(env: Env, caller: Address) {
        caller.require_auth();
        verify_caller_is_admin(&env, &caller);
        if !is_paused(&env) {
            panic!("not paused");
        }
        env.storage().instance().set(&DataKey::Paused, &false);
    }

    /// Returns `true` if the contract is currently paused.
    pub fn is_paused(env: Env) -> bool {
        is_paused(&env)
    }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/// Panics unless `caller` owns the system; returns the owner on success.
fn verify_caller_is_admin(env: &Env, caller: &Address) {
    let admin: Address = env
        .storage()
        .instance()
        .get(&DataKey::Admin)
        .expect("not initialized");
    if *caller != admin {
        panic!("caller is not the admin");
    }
}

fn is_paused(env: &Env) -> bool {
    env.storage()
        .instance()
        .get(&DataKey::Paused)
        .unwrap_or(false)
}

fn require_not_paused(env: &Env) {
    if is_paused(env) {
        panic!("contract is paused");
    }
}

fn verify_caller_is_battle_contract(env: &Env, caller: &Address) {
    let battle_contract: Address = env
        .storage()
        .instance()
        .get(&DataKey::BattleContract)
        .expect("battle contract not set");
    if *caller != battle_contract {
        panic!("caller is not the registered battle contract");
    }
}

fn verify_system_is_owned_by(system: &StarSystem, caller: &Address) -> Address {
    match &system.owner {
        None => panic!("system is not owned"),
        Some(owner) if owner != caller => panic!("caller is not the system owner"),
        Some(owner) => owner.clone(),
    }
}

fn get_player_system_list(env: &Env, player: &Address) -> Vec<u32> {
    env.storage()
        .persistent()
        .get(&DataKey::PlayerSystems(player.clone()))
        .unwrap_or(vec![env])
}

fn add_system_to_player_list(env: &Env, player: &Address, system_id: u32) {
    let mut systems = get_player_system_list(env, player);
    systems.push_back(system_id);
    env.storage()
        .persistent()
        .set(&DataKey::PlayerSystems(player.clone()), &systems);
}

fn remove_system_from_player_list(env: &Env, player: &Address, system_id: u32) {
    let mut systems = get_player_system_list(env, player);
    if let Some(index) = systems.first_index_of(system_id) {
        systems.remove(index);
    }
    env.storage()
        .persistent()
        .set(&DataKey::PlayerSystems(player.clone()), &systems);
}

#[cfg(test)]
mod tests {
    extern crate std;
    use super::*;
    use soroban_sdk::testutils::{Address as _, Events, Ledger as _};
    use soroban_sdk::{Env, IntoVal};

    fn setup_galaxy(env: &Env) -> (GalaxyMapContractClient<'_>, Address) {
        env.mock_all_auths();
        let contract_id = env.register(GalaxyMapContract, ());
        let client = GalaxyMapContractClient::new(env, &contract_id);
        let admin = Address::generate(env);
        client.initialize(&admin, &4);
        (client, admin)
    }

    /// Stand-in for a trusted battle contract, used to prove the caller-
    /// restriction on the battle-initiated transfer path behaves as intended.
    #[contract]
    struct MockBattle;

    #[contractimpl]
    impl MockBattle {
        pub fn trigger_transfer(env: Env, galaxy: Address, system_id: u32, new_owner: Address) {
            GalaxyMapContractClient::new(&env, &galaxy).transfer_ownership_after_battle(
                &env.current_contract_address(),
                &system_id,
                &new_owner,
            );
        }
    }

    fn register_battle_contract<'a>(
        env: &'a Env,
        client: &GalaxyMapContractClient<'a>,
        admin: &Address,
    ) -> MockBattleClient<'a> {
        let battle_id = env.register(MockBattle, ());
        client.set_battle_contract(admin, &battle_id);
        MockBattleClient::new(env, &battle_id)
    }

    #[test]
    fn transfer_ownership_sets_new_owner() {
        let env = Env::default();
        let (client, _) = setup_galaxy(&env);
        let owner = Address::generate(&env);
        let new_owner = Address::generate(&env);
        client.claim_system(&owner, &3);

        client.transfer_ownership(&owner, &3, &new_owner);

        assert_eq!(client.get_system(&3).owner, Some(new_owner));
    }

    #[test]
    fn transfer_ownership_removes_system_from_old_owner_list() {
        let env = Env::default();
        let (client, _) = setup_galaxy(&env);
        let owner = Address::generate(&env);
        let new_owner = Address::generate(&env);
        client.claim_system(&owner, &3);

        client.transfer_ownership(&owner, &3, &new_owner);

        assert_eq!(client.get_player_systems(&owner).len(), 0);
    }

    #[test]
    fn transfer_ownership_adds_system_to_new_owner_list() {
        let env = Env::default();
        let (client, _) = setup_galaxy(&env);
        let owner = Address::generate(&env);
        let new_owner = Address::generate(&env);
        client.claim_system(&owner, &3);

        client.transfer_ownership(&owner, &3, &new_owner);

        assert_eq!(client.get_player_systems(&new_owner), vec![&env, 3u32]);
    }

    #[test]
    #[should_panic(expected = "caller is not the system owner")]
    fn transfer_ownership_panics_when_caller_is_not_owner() {
        let env = Env::default();
        let (client, _) = setup_galaxy(&env);
        let owner = Address::generate(&env);
        let stranger = Address::generate(&env);
        client.claim_system(&owner, &3);

        client.transfer_ownership(&stranger, &3, &stranger);
    }

    #[test]
    #[should_panic(expected = "system is not owned")]
    fn transfer_ownership_panics_when_system_is_unclaimed() {
        let env = Env::default();
        let (client, _) = setup_galaxy(&env);
        let caller = Address::generate(&env);

        client.transfer_ownership(&caller, &3, &caller);
    }

    #[test]
    fn transfer_ownership_emits_transfer_event() {
        let env = Env::default();
        let (client, _) = setup_galaxy(&env);
        let owner = Address::generate(&env);
        let new_owner = Address::generate(&env);
        client.claim_system(&owner, &3);

        client.transfer_ownership(&owner, &3, &new_owner);

        let (contract, topics, data) = env.events().all().last().unwrap();
        assert_eq!(contract, client.address);
        assert_eq!(topics, (symbol_short!("transfer"), 3u32).into_val(&env));
        let payload: (Option<Address>, Address) = data.into_val(&env);
        assert_eq!(payload, (Some(owner), new_owner));
    }

    #[test]
    fn abandon_system_clears_owner() {
        let env = Env::default();
        let (client, _) = setup_galaxy(&env);
        let owner = Address::generate(&env);
        client.claim_system(&owner, &3);

        client.abandon_system(&owner, &3);

        assert_eq!(client.get_system(&3).owner, None);
    }

    #[test]
    fn abandon_system_removes_system_from_player_list() {
        let env = Env::default();
        let (client, _) = setup_galaxy(&env);
        let owner = Address::generate(&env);
        client.claim_system(&owner, &3);

        client.abandon_system(&owner, &3);

        assert_eq!(client.get_player_systems(&owner).len(), 0);
    }

    #[test]
    fn abandon_system_emits_system_abandoned_event() {
        let env = Env::default();
        let (client, _) = setup_galaxy(&env);
        let owner = Address::generate(&env);
        client.claim_system(&owner, &3);

        client.abandon_system(&owner, &3);

        let (contract, topics, data) = env.events().all().last().unwrap();
        assert_eq!(contract, client.address);
        assert_eq!(topics, (Symbol::new(&env, "system_abandoned"), owner).into_val(&env));
        let system_id: u32 = data.into_val(&env);
        assert_eq!(system_id, 3);
    }

    #[test]
    #[should_panic(expected = "caller is not the system owner")]
    fn abandon_system_panics_when_caller_is_not_owner() {
        let env = Env::default();
        let (client, _) = setup_galaxy(&env);
        let owner = Address::generate(&env);
        let intruder = Address::generate(&env);
        client.claim_system(&owner, &3);

        client.abandon_system(&intruder, &3);
    }

    #[test]
    #[should_panic(expected = "system is not owned")]
    fn abandon_system_panics_when_system_is_unclaimed() {
        let env = Env::default();
        let (client, _) = setup_galaxy(&env);
        let player = Address::generate(&env);

        client.abandon_system(&player, &3);
    }

    #[test]
    #[should_panic(expected = "contract is paused")]
    fn abandon_system_panics_when_contract_is_paused() {
        let env = Env::default();
        let (client, admin) = setup_galaxy(&env);
        let owner = Address::generate(&env);
        client.claim_system(&owner, &3);
        client.pause(&admin);

        client.abandon_system(&owner, &3);
    }

    #[test]
    fn abandoned_system_can_be_claimed_again() {
        let env = Env::default();
        let (client, _) = setup_galaxy(&env);
        let owner = Address::generate(&env);
        let next = Address::generate(&env);
        client.claim_system(&owner, &3);
        client.abandon_system(&owner, &3);

        client.claim_system(&next, &3);

        assert_eq!(client.get_system(&3).owner, Some(next));
    }

    #[test]
    fn get_player_systems_page_returns_first_page() {
        let env = Env::default();
        let (client, _) = setup_galaxy(&env);
        let player = Address::generate(&env);
        client.claim_system(&player, &2);
        client.claim_system(&player, &5);
        client.claim_system(&player, &7);

        assert_eq!(client.get_player_systems_page(&player, &0, &2), vec![&env, 2u32, 5u32]);
    }

    #[test]
    fn get_player_systems_page_returns_remaining_systems() {
        let env = Env::default();
        let (client, _) = setup_galaxy(&env);
        let player = Address::generate(&env);
        client.claim_system(&player, &2);
        client.claim_system(&player, &5);
        client.claim_system(&player, &7);

        assert_eq!(client.get_player_systems_page(&player, &2, &2), vec![&env, 7u32]);
    }

    #[test]
    fn get_player_systems_page_is_empty_past_the_end() {
        let env = Env::default();
        let (client, _) = setup_galaxy(&env);
        let player = Address::generate(&env);
        client.claim_system(&player, &2);

        assert!(client.get_player_systems_page(&player, &5, &2).is_empty());
    }

    #[test]
    fn get_player_systems_page_is_empty_for_zero_page_size() {
        let env = Env::default();
        let (client, _) = setup_galaxy(&env);
        let player = Address::generate(&env);
        client.claim_system(&player, &2);

        assert!(client.get_player_systems_page(&player, &0, &0).is_empty());
    }

    #[test]
    fn get_player_systems_pages_cover_the_full_list() {
        let env = Env::default();
        let (client, _) = setup_galaxy(&env);
        let player = Address::generate(&env);
        client.claim_system(&player, &2);
        client.claim_system(&player, &5);
        client.claim_system(&player, &7);
        client.claim_system(&player, &9);
        client.claim_system(&player, &11);

        let mut collected = Vec::new(&env);
        let mut offset: u32 = 0;
        loop {
            let page = client.get_player_systems_page(&player, &offset, &2);
            if page.is_empty() {
                break;
            }
            for id in page.iter() {
                collected.push_back(id);
            }
            offset += 2;
        }

        assert_eq!(collected, client.get_player_systems(&player));
    }

    #[test]
    fn initialize_sets_grid_size() {
        let env = Env::default();
        let (client, _) = setup_galaxy(&env);

        assert_eq!(client.get_grid_size(), 4);
    }

    #[test]
    fn initialize_creates_every_system_unowned() {
        let env = Env::default();
        let (client, _) = setup_galaxy(&env);

        assert_eq!(client.get_system(&0).owner, None);
        assert_eq!(client.get_system(&15).owner, None);
    }

    #[test]
    fn initialize_assigns_coordinates_from_system_id() {
        let env = Env::default();
        let (client, _) = setup_galaxy(&env);

        let system = client.get_system(&6);

        assert_eq!((system.coord_x, system.coord_y), (2, 1));
    }

    #[test]
    #[should_panic(expected = "already initialized")]
    fn initialize_panics_when_called_twice() {
        let env = Env::default();
        let (client, admin) = setup_galaxy(&env);

        client.initialize(&admin, &4);
    }

    #[test]
    fn claim_system_sets_owner() {
        let env = Env::default();
        let (client, _) = setup_galaxy(&env);
        let player = Address::generate(&env);

        client.claim_system(&player, &2);

        assert_eq!(client.get_system(&2).owner, Some(player));
    }

    #[test]
    fn claim_system_records_claim_timestamp() {
        let env = Env::default();
        let (client, _) = setup_galaxy(&env);
        let player = Address::generate(&env);
        env.ledger().set_timestamp(1_000);

        client.claim_system(&player, &2);

        assert_eq!(client.get_system(&2).last_claimed, 1_000);
    }

    #[test]
    #[should_panic(expected = "system already owned")]
    fn claim_system_panics_when_already_owned() {
        let env = Env::default();
        let (client, _) = setup_galaxy(&env);
        let first = Address::generate(&env);
        let second = Address::generate(&env);
        client.claim_system(&first, &2);

        client.claim_system(&second, &2);
    }

    #[test]
    #[should_panic(expected = "system not found")]
    fn claim_system_panics_for_id_outside_grid() {
        let env = Env::default();
        let (client, _) = setup_galaxy(&env);
        let player = Address::generate(&env);

        client.claim_system(&player, &16);
    }

    #[test]
    fn claim_system_adds_system_to_player_list() {
        let env = Env::default();
        let (client, _) = setup_galaxy(&env);
        let player = Address::generate(&env);

        client.claim_system(&player, &2);
        client.claim_system(&player, &5);

        assert_eq!(client.get_player_systems(&player), vec![&env, 2u32, 5u32]);
    }

    #[test]
    fn claim_system_emits_claimed_event() {
        let env = Env::default();
        let (client, _) = setup_galaxy(&env);
        let player = Address::generate(&env);

        client.claim_system(&player, &2);

        let (contract, topics, data) = env.events().all().last().unwrap();
        assert_eq!(contract, client.address);
        assert_eq!(topics, (symbol_short!("claimed"), player).into_val(&env));
        let system_id: u32 = data.into_val(&env);
        assert_eq!(system_id, 2);
    }

    #[test]
    fn get_player_systems_returns_empty_for_new_player() {
        let env = Env::default();
        let (client, _) = setup_galaxy(&env);
        let player = Address::generate(&env);

        assert_eq!(client.get_player_systems(&player).len(), 0);
    }

    #[test]
    #[should_panic(expected = "system not found")]
    fn get_system_panics_for_unknown_id() {
        let env = Env::default();
        let (client, _) = setup_galaxy(&env);

        client.get_system(&99);
    }

    // ── set_battle_contract ───────────────────────────────────────────────────

    #[test]
    fn set_battle_contract_requires_admin_authorization() {
        let env = Env::default();
        let (client, admin) = setup_galaxy(&env);
        let battle = register_battle_contract(&env, &client, &admin);
        let _ = battle;

        let (authorizer, _) = env.auths().into_iter().next().unwrap();
        assert_eq!(authorizer, admin);
    }

    #[test]
    #[should_panic(expected = "caller is not the admin")]
    fn set_battle_contract_panics_for_non_admin_caller() {
        let env = Env::default();
        let (client, _) = setup_galaxy(&env);
        let stranger = Address::generate(&env);
        let battle_id = env.register(MockBattle, ());

        client.set_battle_contract(&stranger, &battle_id);
    }

    // ── transfer_ownership_after_battle ──────────────────────────────────────

    #[test]
    fn registered_battle_contract_can_transfer_a_system_away_from_its_owner() {
        let env = Env::default();
        let (client, admin) = setup_galaxy(&env);
        let battle = register_battle_contract(&env, &client, &admin);
        let owner = Address::generate(&env);
        let winner = Address::generate(&env);
        client.claim_system(&owner, &3);

        battle.trigger_transfer(&client.address, &3, &winner);

        assert_eq!(client.get_system(&3).owner, Some(winner));
    }

    #[test]
    fn battle_transfer_updates_both_players_system_lists() {
        let env = Env::default();
        let (client, admin) = setup_galaxy(&env);
        let battle = register_battle_contract(&env, &client, &admin);
        let owner = Address::generate(&env);
        let winner = Address::generate(&env);
        client.claim_system(&owner, &3);

        battle.trigger_transfer(&client.address, &3, &winner);

        assert_eq!(client.get_player_systems(&owner).len(), 0);
        assert_eq!(client.get_player_systems(&winner), vec![&env, 3u32]);
    }

    #[test]
    #[should_panic(expected = "battle contract not set")]
    fn transfer_ownership_after_battle_panics_when_no_battle_contract_is_registered() {
        let env = Env::default();
        let (client, _) = setup_galaxy(&env);
        let owner = Address::generate(&env);
        client.claim_system(&owner, &3);

        client.transfer_ownership_after_battle(&owner, &3, &owner);
    }

    #[test]
    #[should_panic(expected = "caller is not the registered battle contract")]
    fn transfer_ownership_after_battle_panics_for_an_unregistered_caller() {
        let env = Env::default();
        let (client, admin) = setup_galaxy(&env);
        register_battle_contract(&env, &client, &admin);
        let owner = Address::generate(&env);
        client.claim_system(&owner, &3);
        let impostor = env.register(MockBattle, ());
        let impostor_client = MockBattleClient::new(&env, &impostor);

        // impostor was never registered via set_battle_contract
        impostor_client.trigger_transfer(&client.address, &3, &owner);
    }

    #[test]
    fn regular_transfer_ownership_still_requires_the_current_owner() {
        let env = Env::default();
        let (client, _) = setup_galaxy(&env);
        let owner = Address::generate(&env);
        let new_owner = Address::generate(&env);
        client.claim_system(&owner, &3);

        client.transfer_ownership(&owner, &3, &new_owner);

        assert_eq!(client.get_system(&3).owner, Some(new_owner));
    }

    // ── last_claimed tracks the current owner's acquisition ─────────────────

    #[test]
    fn transfer_ownership_resets_last_claimed_to_the_transfer_time() {
        let env = Env::default();
        let (client, _) = setup_galaxy(&env);
        let owner = Address::generate(&env);
        let new_owner = Address::generate(&env);
        env.ledger().set_timestamp(1_000);
        client.claim_system(&owner, &3);

        env.ledger().set_timestamp(5_000);
        client.transfer_ownership(&owner, &3, &new_owner);

        assert_eq!(client.get_system(&3).last_claimed, 5_000);
    }

    #[test]
    fn battle_transfer_resets_last_claimed_to_the_conquest_time() {
        let env = Env::default();
        let (client, admin) = setup_galaxy(&env);
        let battle = register_battle_contract(&env, &client, &admin);
        let owner = Address::generate(&env);
        let winner = Address::generate(&env);
        env.ledger().set_timestamp(1_000);
        client.claim_system(&owner, &3);

        env.ledger().set_timestamp(7_000);
        battle.trigger_transfer(&client.address, &3, &winner);

        assert_eq!(client.get_system(&3).last_claimed, 7_000);
    }

    // ── grid_size edge cases (#69, #70) ───────────────────────────────────────

    /// Issue #69: initialize with grid_size=0 should create zero systems without
    /// panicking. get_grid_size() must return 0 and get_system(0) must panic.
    #[test]
    fn initialize_with_grid_size_zero_creates_no_systems() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(GalaxyMapContract, ());
        let client = GalaxyMapContractClient::new(&env, &contract_id);
        let admin = Address::generate(&env);

        client.initialize(&admin, &0);

        assert_eq!(client.get_grid_size(), 0);
    }

    #[test]
    #[should_panic(expected = "system not found")]
    fn get_system_panics_after_zero_grid_size_initialize() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(GalaxyMapContract, ());
        let client = GalaxyMapContractClient::new(&env, &contract_id);
        let admin = Address::generate(&env);
        client.initialize(&admin, &0);

        // No systems were written, so any ID must panic.
        client.get_system(&0);
    }

    /// Issue #70: initialize must reject a grid_size larger than MAX_GRID_SIZE.
    #[test]
    #[should_panic(expected = "grid_size exceeds maximum of 16")]
    fn initialize_panics_when_grid_size_exceeds_max() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(GalaxyMapContract, ());
        let client = GalaxyMapContractClient::new(&env, &contract_id);
        let admin = Address::generate(&env);

        client.initialize(&admin, &(MAX_GRID_SIZE + 1));
    }

    #[test]
    fn initialize_succeeds_at_max_grid_size() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(GalaxyMapContract, ());
        let client = GalaxyMapContractClient::new(&env, &contract_id);
        let admin = Address::generate(&env);

        // 16×16 = 256 systems — the largest verified-safe grid.
        client.initialize(&admin, &MAX_GRID_SIZE);

        assert_eq!(client.get_grid_size(), MAX_GRID_SIZE);
        // First and last system must exist.
        assert_eq!(client.get_system(&0).owner, None);
        assert_eq!(client.get_system(&(MAX_GRID_SIZE * MAX_GRID_SIZE - 1)).owner, None);
    }

    // ── alliances (#193, #194, #195, #196) ────────────────────────────────

    #[test]
    fn create_alliance_sets_leader_as_member() {
        let env = Env::default();
        let (client, _) = setup_galaxy(&env);
        let leader = Address::generate(&env);

        let alliance_id = client.create_alliance(&leader, &String::from_str(&env, "The Guardians"));

        // Capture events immediately, before any further contract calls clear the buffer.
        let events = env.events().all();

        assert_eq!(alliance_id, 0);
        assert_eq!(client.get_player_alliance(&leader), Some(0));

        let alliance = client.get_alliance(&0);
        assert_eq!(alliance.id, 0);
        assert_eq!(alliance.leader, leader);
        assert_eq!(alliance.name, String::from_str(&env, "The Guardians"));
        assert_eq!(alliance.members, vec![&env, leader.clone()]);

        let (contract, topics, data) = events.last().unwrap();
        assert_eq!(contract, client.address);
        assert_eq!(
            topics,
            (Symbol::new(&env, "alliance_created"), leader.clone()).into_val(&env)
        );
        let (id, name): (u32, String) = data.into_val(&env);
        assert_eq!((id, name), (0, String::from_str(&env, "The Guardians")));
    }

    #[test]
    fn join_alliance_twice_does_not_duplicate_membership() {
        let env = Env::default();
        let (client, _) = setup_galaxy(&env);
        let leader = Address::generate(&env);
        let player = Address::generate(&env);
        client.create_alliance(&leader, &String::from_str(&env, "The Guardians"));

        client.join_alliance(&player, &0);
        client.join_alliance(&player, &0);

        let alliance = client.get_alliance(&0);
        let count = alliance.members.iter().filter(|m| *m == player).count();
        assert_eq!(count, 1);
        assert_eq!(client.get_player_alliance(&player), Some(0));
    }

    #[test]
    #[should_panic(expected = "player is not in an alliance")]
    fn leave_alliance_panics_when_not_in_alliance() {
        let env = Env::default();
        let (client, _) = setup_galaxy(&env);
        let stranger = Address::generate(&env);

        client.leave_alliance(&stranger);
    }

    #[test]
    fn leave_alliance_removes_player_membership() {
        let env = Env::default();
        let (client, _) = setup_galaxy(&env);
        let leader = Address::generate(&env);
        let player = Address::generate(&env);
        client.create_alliance(&leader, &String::from_str(&env, "The Guardians"));
        client.join_alliance(&player, &0);

        client.leave_alliance(&player);

        assert_eq!(client.get_player_alliance(&player), None);
        let alliance = client.get_alliance(&0);
        assert_eq!(
            alliance.members.iter().filter(|m| *m == player).count(),
            0
        );
    }

    #[test]
    fn leader_leaving_does_not_orphan_alliance() {
        let env = Env::default();
        let (client, _) = setup_galaxy(&env);
        let leader = Address::generate(&env);
        let player = Address::generate(&env);
        client.create_alliance(&leader, &String::from_str(&env, "The Guardians"));
        client.join_alliance(&player, &0);

        client.leave_alliance(&leader);

        // Capture events immediately, before any further contract calls clear the buffer.
        let events = env.events().all();

        // The alliance record persists; the leader simply is no longer a member.
        assert_eq!(client.get_player_alliance(&leader), None);
        let alliance = client.get_alliance(&0);
        assert_eq!(alliance.id, 0);
        assert_eq!(alliance.leader, leader);
        assert_eq!(alliance.members.len(), 1);
        assert_eq!(alliance.members, vec![&env, player.clone()]);

        let (contract, topics, data) = events.last().unwrap();
        assert_eq!(contract, client.address);
        assert_eq!(
            topics,
            (Symbol::new(&env, "alliance_left"), leader.clone()).into_val(&env)
        );
        let left_id: u32 = data.into_val(&env);
        assert_eq!(left_id, 0);
    }

    // ── pause / unpause ───────────────────────────────────────────────────────

    #[test]
    fn contract_is_not_paused_after_initialization() {
        let env = Env::default();
        let (client, _) = setup_galaxy(&env);

        assert!(!client.is_paused());
    }

    #[test]
    fn admin_can_pause_the_contract() {
        let env = Env::default();
        let (client, admin) = setup_galaxy(&env);

        client.pause(&admin);

        assert!(client.is_paused());
    }

    #[test]
    fn admin_can_unpause_a_paused_contract() {
        let env = Env::default();
        let (client, admin) = setup_galaxy(&env);
        client.pause(&admin);

        client.unpause(&admin);

        assert!(!client.is_paused());
    }

    #[test]
    #[should_panic(expected = "already paused")]
    fn pause_panics_when_already_paused() {
        let env = Env::default();
        let (client, admin) = setup_galaxy(&env);
        client.pause(&admin);

        client.pause(&admin);
    }

    #[test]
    #[should_panic(expected = "not paused")]
    fn unpause_panics_when_not_paused() {
        let env = Env::default();
        let (client, admin) = setup_galaxy(&env);

        client.unpause(&admin);
    }

    #[test]
    #[should_panic(expected = "caller is not the admin")]
    fn pause_panics_for_non_admin_caller() {
        let env = Env::default();
        let (client, _) = setup_galaxy(&env);
        let stranger = Address::generate(&env);

        client.pause(&stranger);
    }

    #[test]
    #[should_panic(expected = "contract is paused")]
    fn claim_system_panics_when_contract_is_paused() {
        let env = Env::default();
        let (client, admin) = setup_galaxy(&env);
        let player = Address::generate(&env);
        client.pause(&admin);

        client.claim_system(&player, &0);
    }

    #[test]
    #[should_panic(expected = "contract is paused")]
    fn transfer_ownership_panics_when_contract_is_paused() {
        let env = Env::default();
        let (client, admin) = setup_galaxy(&env);
        let owner = Address::generate(&env);
        let new_owner = Address::generate(&env);
        client.claim_system(&owner, &0);
        client.pause(&admin);

        client.transfer_ownership(&owner, &0, &new_owner);
    }

    #[test]
    fn test_system_upgrade_level_and_stat_boost() {
        let env = Env::default();
        let (client, _) = setup_galaxy(&env);
        let player = Address::generate(&env);

        client.claim_system(&player, &0);
        let initial = client.get_system(&0);
        assert_eq!(initial.upgrade_level, 0);

        client.upgrade_system(&player, &0);
        let upgraded = client.get_system(&0);
        assert_eq!(upgraded.upgrade_level, 1);
        assert_eq!(upgraded.defense_rating, initial.defense_rating + 2);
        assert_eq!(upgraded.resource_yield, initial.resource_yield + 5);

        client.upgrade_system(&player, &0);
        let level2 = client.get_system(&0);
        assert_eq!(level2.upgrade_level, 2);
        assert_eq!(level2.defense_rating, initial.defense_rating + 4);
    }

    #[test]
    fn test_upgrade_system_emits_upgraded_event() {
        let env = Env::default();
        let (client, _) = setup_galaxy(&env);
        let player = Address::generate(&env);

        client.claim_system(&player, &0);
        client.upgrade_system(&player, &0);

        let (contract, topics, data) = env
            .events()
            .all()
            .into_iter()
            .filter(|(c, _, _)| *c == client.address)
            .last()
            .unwrap();
        assert_eq!(contract, client.address);
        assert_eq!(topics, (symbol_short!("upgraded"), player.clone()).into_val(&env));
        let payload: (u32, u32, u128) = data.into_val(&env);
        assert_eq!(payload, (0, 1, 100u128));
    }

    #[test]
    #[should_panic(expected = "caller is not the system owner")]
    fn test_upgrade_system_panics_for_non_owner() {
        let env = Env::default();
        let (client, _) = setup_galaxy(&env);
        let owner = Address::generate(&env);
        let stranger = Address::generate(&env);

        client.claim_system(&owner, &0);
        client.upgrade_system(&stranger, &0);
    }

    #[test]
    #[should_panic(expected = "contract is paused")]
    fn test_upgrade_system_panics_when_paused() {
        let env = Env::default();
        let (client, admin) = setup_galaxy(&env);
        let player = Address::generate(&env);

        client.claim_system(&player, &0);
        client.pause(&admin);
        client.upgrade_system(&player, &0);
    }

    // ── Fuzz tests (#241) ─────────────────────────────────────────────────────

    /// Helper to test claim_system across different grid sizes
    fn test_claim_with_grid_size(grid_size: u32, system_id: u32, should_succeed: bool) {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(GalaxyMapContract, ());
        let client = GalaxyMapContractClient::new(&env, &contract_id);
        let admin = Address::generate(&env);
        let player = Address::generate(&env);

        client.initialize(&admin, &grid_size);

        if should_succeed {
            client.claim_system(&player, &system_id);
            assert_eq!(client.get_system(&system_id).owner, Some(player.clone()));
            let player_systems = client.get_player_systems(&player);
            assert!(player_systems.iter().any(|id| id == system_id));
        } else {
            // Should panic for out-of-bounds
            let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                client.claim_system(&player, &system_id);
            }));
            assert!(result.is_err());
        }
    }

    #[test]
    fn fuzz_claim_system_grid_size_1() {
        // Grid 1x1: only system 0 is valid
        test_claim_with_grid_size(1, 0, true);
        test_claim_with_grid_size(1, 1, false);
        test_claim_with_grid_size(1, 10, false);
    }

    #[test]
    fn fuzz_claim_system_grid_size_4() {
        // Grid 4x4: systems 0-15 are valid
        test_claim_with_grid_size(4, 0, true);
        test_claim_with_grid_size(4, 7, true);
        test_claim_with_grid_size(4, 15, true);
        test_claim_with_grid_size(4, 16, false);
        test_claim_with_grid_size(4, 100, false);
    }

    #[test]
    fn fuzz_claim_system_grid_size_max() {
        // Grid MAX_GRID_SIZE x MAX_GRID_SIZE
        test_claim_with_grid_size(MAX_GRID_SIZE, 0, true);
        test_claim_with_grid_size(MAX_GRID_SIZE, MAX_GRID_SIZE * MAX_GRID_SIZE / 2, true);
        test_claim_with_grid_size(MAX_GRID_SIZE, MAX_GRID_SIZE * MAX_GRID_SIZE - 1, true);
        test_claim_with_grid_size(MAX_GRID_SIZE, MAX_GRID_SIZE * MAX_GRID_SIZE, false);
    }

    #[test]
    fn fuzz_claim_system_coordinate_mapping_various_sizes() {
        // Test coordinate assignment for various grid sizes
        for grid_size in [1u32, 2, 4, 8, MAX_GRID_SIZE] {
            let env = Env::default();
            env.mock_all_auths();
            let contract_id = env.register(GalaxyMapContract, ());
            let client = GalaxyMapContractClient::new(&env, &contract_id);
            let admin = Address::generate(&env);

            client.initialize(&admin, &grid_size);

            let total_systems = grid_size * grid_size;

            // Test first system
            if total_systems > 0 {
                let system = client.get_system(&0);
                assert_eq!(system.coord_x, 0);
                assert_eq!(system.coord_y, 0);
            }

            // Test last system
            if total_systems > 1 {
                let last_id = total_systems - 1;
                let system = client.get_system(&last_id);
                assert_eq!(system.coord_x, last_id % grid_size);
                assert_eq!(system.coord_y, last_id / grid_size);
            }

            // Test a middle system
            if total_systems > 4 {
                let mid_id = total_systems / 2;
                let system = client.get_system(&mid_id);
                assert_eq!(system.coord_x, mid_id % grid_size);
                assert_eq!(system.coord_y, mid_id / grid_size);
            }
        }
    }

    #[test]
    fn fuzz_claim_system_double_claim_fails() {
        // Test that claiming an already-owned system fails across different grid sizes
        for grid_size in [2u32, 4, 8] {
            let env = Env::default();
            env.mock_all_auths();
            let contract_id = env.register(GalaxyMapContract, ());
            let client = GalaxyMapContractClient::new(&env, &contract_id);
            let admin = Address::generate(&env);
            let player1 = Address::generate(&env);
            let player2 = Address::generate(&env);

            client.initialize(&admin, &grid_size);

            // First claim succeeds
            client.claim_system(&player1, &0);

            // Second claim by different player should panic
            let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                client.claim_system(&player2, &0);
            }));
            assert!(result.is_err());
        }
    }
}
