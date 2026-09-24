/**
 * CHURRASCO! O Mestre da Brasa — sim-core type definitions.
 *
 * These types mirror the JSON tables in `shared/data/` 1:1 and are the contract
 * that the Unity C# runtime ports (`Assets/Scripts/Sim/Core/*.cs`) must honour.
 * Golden vectors produced by this implementation are checked in at
 * `tools/sim-core/golden/*.json` so the C# port can be verified for parity.
 */

// ── Ingredients ─────────────────────────────────────────────────────────────

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
export type CookMethod = 'grill' | 'prep';
export type ZoneId = 'low' | 'medium' | 'high' | 'none';

export interface StageOverride {
  id: string;
  max: number;
  nameKey: string;
}

export interface IngredientArt {
  shape: string;
  rawColor: string;
  cookedColor: string;
  burnColor: string;
  gloss: number;
  fatSheen: boolean;
  marbling?: number;
  fatCap?: boolean;
  bone?: boolean;
  meltAmount?: number;
}

export interface Ingredient {
  id: string;
  nameKey: string;
  descKey: string;
  category: string;
  collectionCategory: string;
  rarity: Rarity;
  cookMethod: CookMethod;
  sides: number;
  sideCookSec: number;
  idealZone: ZoneId;
  heatRate: number;
  burnRate: number;
  flipNeeded: boolean;
  perfectWindow: [number, number];
  prepSec?: number;
  value: number;
  xp: number;
  satisfaction: number;
  region?: string;
  stageOverrides?: StageOverride[];
  unlock: { restaurantIndex: number; level: number };
  art: IngredientArt;
}

export interface IngredientTable {
  version: number;
  shared: {
    stageThresholds: { RAW_MAX: number; RARE_MAX: number; MEDIUM_MAX: number; WELL_MAX: number };
    carryoverRate: number;
    burnedThreshold: number;
    minEvennessForPerfect: number;
    defaultPerfectWindow: [number, number];
  };
  items: Ingredient[];
}

// ── Grill ───────────────────────────────────────────────────────────────────

export interface GrillZone {
  id: Exclude<ZoneId, 'none'>;
  nameKey: string;
  index: number;
  heatMultiplier: number;
  embers: number;
  color: string;
}

export interface GrillTable {
  version: number;
  zones: GrillZone[];
  charcoal: {
    baseDurationSec: number;
    efficiencyCurve: { t: number; value: number }[];
    refillTimeSec: number;
    refillCostCoins: number;
    lowWarningThreshold: number;
  };
  slots: { baseSlotsPerZone: number; slotWidthNorm: number; slotHeightNorm: number };
  interaction: {
    dragThresholdPx: number;
    flipCooldownSec: number;
    serveDragToTray: boolean;
    longPressSecToServe: number;
    haptics: Record<string, string>;
  };
  scoring: {
    perfectLabel: string;
    goodLabel: string;
    overcookedLabel: string;
    rawLabel: string;
    burnedLabel: string;
    goodWindowPadding: number;
    comboMilestones: number[];
    comboBreakOn: string[];
  };
}

// ── Customers ───────────────────────────────────────────────────────────────

export interface CustomerLook {
  skin: string;
  hair: string;
  outfit: string;
  accessory: string;
  tint: string;
}

export interface CustomerDef {
  id: string;
  nameKey: string;
  personaKey: string;
  weight: number;
  patienceMultiplier: number;
  tipMultiplier: number;
  toleranceScale: number;
  itemsMin: number;
  itemsMax: number;
  allowsSpecificDoneness: boolean;
  unusualOnly?: boolean;
  isVip?: boolean;
  minRestaurant: number;
  look: CustomerLook;
  voiceSet: string;
}

export interface CustomerTable {
  version: number;
  patience: {
    baseSeconds: number;
    perItemSeconds: number;
    perBiteSeconds: number;
    minSeconds: number;
    warningThreshold: number;
    criticalThreshold: number;
    leaveGraceSec: number;
  };
  customers: CustomerDef[];
}

// ── Restaurants ─────────────────────────────────────────────────────────────

export interface RestaurantDef {
  index: number;
  id: string;
  nameKey: string;
  taglineKey: string;
  unlockCostCoins: number;
  requiredLevel: number;
  grill: { slotsPerZone: number; zoneCount: number; heatStability: number; charcoalDurationBonus: number };
  service: { maxOrdersOnScreen: number; prepSlots: number; employeeSlots: number; tables: number };
  introduces: string[];
  customerPool: string[];
  turnLengthSec: number;
  ambient: string;
  art: { scene: string; props: string[]; lighting: string };
}

export interface RestaurantTable {
  version: number;
  restaurants: RestaurantDef[];
}

// ── Upgrades / economy ──────────────────────────────────────────────────────

export interface UpgradeTrack {
  id: string;
  category: string;
  nameKey: string;
  descKey: string;
  baseCost: number;
  growth: number;
  maxLevel: number;
  currency: 'coins' | 'embers';
  effect: { stat: string; delta: number };
  icon: string;
}

export interface UpgradeTable {
  version: number;
  tracks: UpgradeTrack[];
  cosmeticTracks: unknown[];
}

export interface EconomyTable {
  version: number;
  currencies: Record<string, { id: string; nameKey: string; premium: boolean; icon: string; cap: number }>;
  xp: { formula: { type: string; a: number; exponent: number; minPerLevel: number }; maxLevel: number };
  reward: {
    orderBaseTip: number;
    perfectTipBonus: number;
    speedBonusMax: number;
    speedBonusWindow: number;
    comboStep: number;
    comboCap: number;
    /** Damps customer generosity so a VIP tips more instead of multiplying the whole plate. */
    customerTipWeight: number;
    /** Remote-Config-overridable payout tuning consumed by `scoreItem`. */
    levelUpCoins: { type: 'power'; base: number; exponent: number };
    levelUpEmbers: { every: number; amount: number };
    turnEndBonus: { base: number; perPerfect: number; perLostCustomer: number };
    roundCoinMultiplierRange: [number, number];
  };
  idle: {
    coinsPerMinuteByRestaurant: number[];
    xpPerMinuteByRestaurant: number[];
    maxOfflineHours: number;
    rampInMinutes: number;
    adDoubleAvailable: boolean;
    minCollectIntervalMin: number;
  };
  dailyReward: {
    cycleDays: number;
    streakBonusPerCycle: number;
    graceDays: number;
    days: { day: number; rewards: Record<string, unknown>[] }[];
  };
  targets: Record<string, unknown>;
}

// ── Raw bundle ──────────────────────────────────────────────────────────────

export interface RawDataBundle {
  ingredients: IngredientTable;
  grill: GrillTable;
  customers: CustomerTable;
  restaurants: RestaurantTable;
  upgrades: UpgradeTable;
  economy: EconomyTable;
}

export interface GameDatabase {
  ingredients: IngredientTable;
  grill: GrillTable;
  customers: CustomerTable;
  restaurants: RestaurantTable;
  upgrades: UpgradeTable;
  economy: EconomyTable;
  ingredientById: Map<string, Ingredient>;
  customerById: Map<string, CustomerDef>;
  restaurantByIndex: Map<number, RestaurantDef>;
  upgradeById: Map<string, UpgradeTrack>;
}
