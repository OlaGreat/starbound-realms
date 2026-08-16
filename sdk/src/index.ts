export { StarboundClient } from './client';
export type { StarboundClientConfig, ContractIds } from './client';

export { GalaxyClient } from './galaxy';
export type { StarSystem } from './galaxy';

export { ResourcesClient } from './resources';
export type { ResourceType, ResourceBalance } from './resources';

export { FleetClient, getUnitCost, calculateFleetAttack, calculateFleetDefense, isFleetEmpty } from './fleet';
export type { Fleet, UnitType, UnitCost } from './fleet';

export { BattleClient, didAttackerWin, getBattleLoser, wasBattleDecisive } from './battle';
export type { BattleResult, BattleRecord } from './battle';
