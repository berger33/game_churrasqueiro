import { upgradeLevel } from './upgrades.ts';
import { clamp, sampleCurve } from './data.ts';
import type { ChurrasqueiraDef, ChurrasqueiraEvolution, EconomyTable, GameDatabase, GrillZone, Ingredient, RestaurantDef } from './types.ts';

// ── Derived stats (from restaurant tier + upgrade levels) ────────────────────

export interface DerivedStats {
  slotsPerZone: number;
  zoneCount: number;
  /** Legacy restaurant field, not an invented oscillation consumer. */
  heatStability: number;
  stabilityRecoveryFraction: number;
  minCharcoalEfficiencyBonus: number;
  autoRefillChance: number;
  charcoalDurationSec: number;
  highZoneBonus: number;
  heatRampRate: number;
  prepSlots: number;
  prepSpeedMult: number;
  tipMult: number;
  /** Prestige only scales the tip component, not the legacy whole-plate multiplier. */
  prestigeTipBonus?: number;
  serveSpeedMult: number;
  patienceMult: number;
  maxOrdersOnScreen: number;
  tables: number;
  xpMult: number;
  customerSpawnRate: number;
  autoFlipLevel: number;
  autoServeLevel: number;
  autoPrepLevel: number;
  idleRateMult: number;
  rawStockCapacityPerIngredient: number;
}

export function deriveStats(db: GameDatabase, restaurant: RestaurantDef, levels: Record<string, number>): DerivedStats {
  const get = (trackId: string): number => {
    const lvl = upgradeLevel(db, levels, trackId);
    const track = db.upgradeById.get(trackId);
    if (!track || lvl <= 0) return 0;
    return track.effect.delta * Math.min(lvl, track.maxLevel);
  };

  return {
    slotsPerZone: restaurant.grill.slotsPerZone + Math.floor(get('grill_size') / 1),
    zoneCount: restaurant.grill.zoneCount,
    heatStability: restaurant.grill.heatStability,
    stabilityRecoveryFraction: get('grill_stability'),
    minCharcoalEfficiencyBonus: get('charcoal_quality'),
    autoRefillChance: Math.min(1, get('charcoal_auto')),
    charcoalDurationSec: db.grill.charcoal.baseDurationSec * (1 + restaurant.grill.charcoalDurationBonus + get('charcoal_duration')),
    highZoneBonus: get('grill_heat'),
    heatRampRate: 1 + get('grill_speed'),
    prepSlots: restaurant.service.prepSlots + Math.floor(get('board')),
    prepSpeedMult: 1 + get('knife'),
    tipMult: 1 + get('plates') + get('decor') + get('brasa_mastery'),
    prestigeTipBonus: get('brasa_mastery'),
    serveSpeedMult: 1 + get('tray'),
    patienceMult: 1 + get('patience_charm') + get('music') + get('clientela_fiel'),
    maxOrdersOnScreen: restaurant.service.maxOrdersOnScreen + Math.floor(get('capacity')) + Math.floor(get('tables')),
    tables: restaurant.service.tables + Math.floor(get('tables')),
    xpMult: 1 + get('lighting'),
    customerSpawnRate: 1 + get('sign'),
    autoFlipLevel: upgradeLevel(db, levels, 'churrasqueiro'),
    autoServeLevel: upgradeLevel(db, levels, 'garcom'),
    autoPrepLevel: upgradeLevel(db, levels, 'auxiliar'),
    idleRateMult: 1 + get('gerente'),
    rawStockCapacityPerIngredient: db.grill.stock.basePerIngredient + Math.floor(get('counter'))
  };
}

/** Resolve the joint restaurant + equipped hardware expansion; no player-level shortcut. */
export function churrasqueiraZoneCount(ch: ChurrasqueiraDef, evo: ChurrasqueiraEvolution, restaurant?: RestaurantDef): number {
  const expansion = ch.restaurantExpansion;
  return restaurant && expansion && restaurant.index >= expansion.restaurantIndex
    ? expansion.zoneCount : evo.zoneCount;
}

/**
 * Apply churrasqueira evolution overrides on top of restaurant-derived stats
 * (data-driven 1F→2F→3F, with an explicit Premium expansion). The equipped grill *replaces* the restaurant's
 * hardware (zones, base slots, charcoal bonus) but additive upgrades
 * (`grill_size`, `charcoal_duration`) still stack — otherwise buying those
 * tracks would be a dead sink the moment a churrasqueira is equipped.
 */
export function applyChurrasqueiraToStats(
  stats: DerivedStats,
  db: GameDatabase,
  churrasqueiraId: string,
  evoLevel: number,
  restaurant?: RestaurantDef
): DerivedStats {
  const ch = db.churrasqueiraById?.get(churrasqueiraId);
  if (!ch) return stats;
  const evo = ch.evolutions.find(e => e.level === evoLevel) ?? ch.evolutions[0];
  if (!evo) return stats;
  const extraSlots = restaurant ? Math.max(0, stats.slotsPerZone - restaurant.grill.slotsPerZone) : 0;
  const baseCharcoal = db.grill.charcoal.baseDurationSec;
  const extraCharcoal = restaurant
    ? (stats.charcoalDurationSec / baseCharcoal) - 1 - restaurant.grill.charcoalDurationBonus
    : 0;
  return {
    ...stats,
    slotsPerZone: evo.slotsPerZone + extraSlots,
    zoneCount: churrasqueiraZoneCount(ch, evo, restaurant),
    charcoalDurationSec: baseCharcoal * (1 + (evo.charcoalBonus ?? 0) + extraCharcoal)
  };
}

// ── Food runtime ─────────────────────────────────────────────────────────────

export type DonenessStageId = 'raw' | 'rare' | 'medium' | 'well' | 'burned' | string;

export interface FoodRuntime {
  uid: number;
  ingredient: Ingredient;
  /** Per-side doneness in [0, ~2]. Overall = mean of all sides. */
  sides: number[];
  /** Index of the side currently facing the coals. */
  downSide: number;
  /** -1 = on the bench / tray / prep, otherwise grill zone index. */
  zoneIndex: number;
  onGrill: boolean;
  timeOnGrill: number;
  flips: number;
  burned: boolean;
  served: boolean;
  /** 0..1 progress for `cookMethod: "prep"` items. */
  prepProgress: number;
  lastFlipAt: number;
}

export function createFood(uid: number, ingredient: Ingredient): FoodRuntime {
  return {
    uid,
    ingredient,
    sides: new Array(ingredient.sides).fill(0),
    downSide: 0,
    zoneIndex: -1,
    onGrill: false,
    timeOnGrill: 0,
    flips: 0,
    burned: false,
    served: false,
    prepProgress: 0,
    lastFlipAt: 0
  };
}

export function overallDoneness(f: FoodRuntime): number {
  let sum = 0;
  for (const s of f.sides) sum += s;
  return sum / f.sides.length;
}

/** Evenness = min/max side doneness. 1 means perfectly uniform cooking. */
export function evenness(f: FoodRuntime): number {
  let min = Infinity;
  let max = 0;
  for (const s of f.sides) {
    if (s < min) min = s;
    if (s > max) max = s;
  }
  if (max <= 1e-6) return 1;
  return min / max;
}

export function stageOf(db: GameDatabase, f: FoodRuntime): DonenessStageId {
  const d = overallDoneness(f);
  if (f.ingredient.stageOverrides && f.ingredient.stageOverrides.length > 0) {
    for (const s of f.ingredient.stageOverrides) if (d < s.max) return s.id;
    return f.ingredient.stageOverrides[f.ingredient.stageOverrides.length - 1]!.id;
  }
  const t = db.ingredients.shared.stageThresholds;
  if (f.burned || d >= t.WELL_MAX) return 'burned';
  if (d >= t.MEDIUM_MAX) return 'well';
  if (d >= t.RARE_MAX) return 'medium';
  if (d >= t.RAW_MAX) return 'rare';
  return 'raw';
}

// ── Grill runtime ────────────────────────────────────────────────────────────

export interface GrillRuntime {
  zones: { index: number; heat: number; items: FoodRuntime[] }[];
  charcoalT: number; // 0..1 progress of the current charcoal load
  charcoalEfficiency: number;
  refilling: number; // seconds remaining
  charcoalAutoAttempted: boolean; // one attempt per sack, reset only on completed refill
  stats: DerivedStats;
}

export function createGrill(stats: DerivedStats, db: GameDatabase): GrillRuntime {
  const zones = [];
  const count = stats.zoneCount;
  if (!Number.isInteger(count) || count < 1 || count > db.grill.zones.length) {
    throw new Error(`createGrill: unsupported zoneCount ${count}`);
  }
  for (let i = 0; i < count; i++) {
    zones.push({ index: i, heat: runtimeZoneDefinition(db, count, i)!.heatMultiplier, items: [] });
  }
  return { zones, charcoalT: 0, charcoalEfficiency: charcoalEfficiencyAt(stats, db, 0), refilling: 0, charcoalAutoAttempted: false, stats };
}

/**
 * Hard cap on a churrasqueira zone. Default `high` is 1.55; going much past
 * that turns the "premium grill" into an incinerator. Measured on the old
 * `heatBase + 0.85·t` ramp: fornalha evo 3 peaked at 2.47, campaign burn
 * 20.3 %, lost customers 11.4 %, L15/L30 income 20 % below the 3-zone curve.
 */
export const CHURRASQUEIRA_HEAT_CAP = 1.7;

/** Primary profile remains low/medium/high; auxiliary capacity is appended, never resampled into it. */
export function primaryGrillZones(db: GameDatabase): GrillZone[] {
  return db.grill.zones.filter(z => !z.auxiliaryOf);
}

/** One identity for heat, bonuses, bot mapping and UI labels, even on 1/2-zone grills. */
export function runtimeZoneDefinition(db: GameDatabase, zoneCount: number, zoneIndex: number): GrillZone | undefined {
  if (!Number.isInteger(zoneIndex) || zoneIndex < 0 || zoneIndex >= zoneCount) return undefined;
  const primary = primaryGrillZones(db);
  if (zoneIndex >= primary.length) return db.grill.zones[zoneIndex];
  const n = Math.min(zoneCount, primary.length);
  const index = n <= 1 ? 0 : Math.round(zoneIndex * (primary.length - 1) / (n - 1));
  return primary[index];
}

/** Zone heat for equipped hardware: unchanged 1/2/3 profile plus explicit auxiliary medium. */
export function churrasqueiraZoneHeat(
  evo: { zoneCount: number; heatBase: number },
  zoneIndex: number,
  db: GameDatabase
): number {
  if (evo.zoneCount <= 1) return evo.heatBase;
  const profile = runtimeZoneDefinition(db, evo.zoneCount, zoneIndex)?.heatMultiplier ?? 1;
  return Math.min(CHURRASQUEIRA_HEAT_CAP, profile * evo.heatBase);
}

/** Patch grill zones heat to match churrasqueira evolution. */
export function patchGrillForChurrasqueira(grill: GrillRuntime, db: GameDatabase, churrasqueiraId: string, evoLevel: number): void {
  const ch = db.churrasqueiraById?.get(churrasqueiraId);
  if (!ch) return;
  const evo = ch.evolutions.find(e => e.level === evoLevel) ?? ch.evolutions[0];
  if (!evo) return;
  const newZones: GrillRuntime['zones'] = [];
  const zoneCount = grill.stats.zoneCount; // already resolved with the restaurant requirement
  for (let i = 0; i < zoneCount; i++) {
    const old = grill.zones[i];
    newZones.push({ index: i, heat: churrasqueiraZoneHeat({ ...evo, zoneCount }, i, db), items: old ? [...old.items] : [] });
  }
  grill.zones = newZones;
  grill.stats.zoneCount = zoneCount;
  // slotsPerZone is already set by applyChurrasqueiraToStats (evo base + grill_size).
}

/** Primary IDs keep their relative mapping on 1/2/3 zones; extra IDs exist only if unlocked. */
export function runtimeZoneIndex(g: GrillRuntime, db: GameDatabase, zoneId: string): number {
  const primary = primaryGrillZones(db);
  const tableIndex = db.grill.zones.findIndex(z => z.id === zoneId);
  const n = g.zones.length;
  if (tableIndex < 0 || n === 0) return -1;
  if (db.grill.zones[tableIndex]!.auxiliaryOf) return tableIndex < n ? tableIndex : -1;
  const t = primary.findIndex(z => z.id === zoneId);
  if (n === 1 || primary.length === 1) return 0;
  return Math.round((t / (primary.length - 1)) * (Math.min(n, primary.length) - 1));
}

export function grillSlotsFree(g: GrillRuntime): number {
  const cap = g.stats.slotsPerZone;
  let free = 0;
  for (const z of g.zones) free += Math.max(0, cap - z.items.length);
  return free;
}

export function zoneIsFull(g: GrillRuntime, zoneIndex: number): boolean {
  const z = g.zones[zoneIndex];
  return !z || z.items.length >= g.stats.slotsPerZone;
}

/** Effective heat of a zone, including charcoal efficiency and upgrade bonuses. */
export function effectiveHeat(g: GrillRuntime, zoneIndex: number, db: GameDatabase): number {
  if (g.refilling > 0 || g.charcoalT >= 1) return 0;
  return zoneThermalBase(g, zoneIndex, db) * g.charcoalEfficiency;
}

function zoneThermalBase(g: GrillRuntime, zoneIndex: number, db: GameDatabase): number {
  // Prefer churrasqueira-patched heat stored on the grill runtime; fallback to db table for legacy
  const base = g.zones[zoneIndex]?.heat ?? db.grill.zones[zoneIndex]?.heatMultiplier ?? 1;
  const primary = primaryGrillZones(db);
  const def = runtimeZoneDefinition(db, g.zones.length, zoneIndex);
  const source = primary.findIndex(z => z.id === (def?.auxiliaryOf ?? def?.id));
  // The new row inherits MEDIUM's upgrade bonus, never HIGH's just for being last.
  const factor = g.zones.length === 1 || source === primary.length - 1
    ? 1 : Math.max(0, source) / Math.max(1, primary.length - 1) * .5;
  const bonus = g.stats.highZoneBonus * factor;
  return base + bonus;
}

export function placeOnGrill(g: GrillRuntime, db: GameDatabase, f: FoodRuntime, zoneIndex: number): boolean {
  if (zoneIsFull(g, zoneIndex)) return false;
  removeFromGrill(g, f);
  f.zoneIndex = zoneIndex;
  f.onGrill = true;
  g.zones[zoneIndex]!.items.push(f);
  void db;
  return true;
}

export function removeFromGrill(g: GrillRuntime, f: FoodRuntime): void {
  if (!f.onGrill) return;
  const z = g.zones[f.zoneIndex];
  if (z) {
    const i = z.items.indexOf(f);
    if (i >= 0) z.items.splice(i, 1);
  }
  f.onGrill = false;
  f.zoneIndex = -1;
}

/** The public free-play flip cue, shared by UI and bounded staff (not an optimal timer). */
export function publicFlipReady(db: GameDatabase, f: FoodRuntime): boolean {
  if (!f.onGrill || f.burned || f.served || !f.ingredient.flipNeeded || f.sides.length < 2) return false;
  const down=f.sides[f.downSide] ?? 0;
  return down >= db.grill.interaction.flipPromptAtSideDoneness && f.sides.every(s=>s<=down+1e-9)
    && evenness(f)<db.ingredients.shared.minEvennessForPerfect;
}

export function flipFood(g: GrillRuntime, f: FoodRuntime, now: number, db: GameDatabase): boolean {
  if (!f.onGrill) return false;
  if (now - f.lastFlipAt < db.grill.interaction.flipCooldownSec) return false;
  f.downSide = (f.downSide + 1) % f.sides.length;
  f.flips++;
  f.lastFlipAt = now;
  return true;
}

/** Shared manual/automatic refill: no marker duration or second timer. */
export function startCharcoalRefill(g: GrillRuntime, db: GameDatabase): boolean {
  if (g.refilling > 0) return false;
  g.refilling = charcoalRefillDuration(db);
  g.charcoalEfficiency = 0;
  return true;
}

export function charcoalRefillDuration(db: GameDatabase): number {
  return db.grill.charcoal.refillTimeSec;
}

/** Efficiency of live fuel; callers enforce exhaustion/refill rather than flooring dead fuel. */
export function charcoalEfficiencyAt(stats: DerivedStats, db: GameDatabase, progress: number): number {
  const curve = db.grill.charcoal.efficiencyCurve;
  const e = sampleCurve(curve, progress);
  const floor = Math.min(1, Math.min(...curve.map(p => p.value)) + stats.minCharcoalEfficiencyBonus);
  const q = Math.max(e, floor);
  return q + stats.stabilityRecoveryFraction * (1 - q);
}

/** Advances only the hot part of dt. Returns true once when a refill completes. */
export function tickGrill(g: GrillRuntime, db: GameDatabase, dt: number, onBurn?: (f: FoodRuntime) => void): boolean {
  if (!Number.isFinite(dt) || dt < 0) throw new Error('tickGrill: invalid dt');
  let activeSec = dt, refilled = false;
  if (g.refilling > 0) {
    const coldSec = Math.min(dt, g.refilling);
    activeSec -= coldSec;
    g.refilling = Math.max(0, g.refilling - dt);
    if (g.refilling < 1e-9) {
      g.refilling = 0; g.charcoalT = 0; g.charcoalAutoAttempted = false; refilled = true;
    }
  }
  activeSec = Math.min(activeSec, Math.max(0, 1 - g.charcoalT) * g.stats.charcoalDurationSec);
  if (g.refilling > 0) activeSec = 0;
  g.charcoalT = clamp(g.charcoalT + activeSec / g.stats.charcoalDurationSec, 0, 1);
  const burnEfficiency = charcoalEfficiencyAt(g.stats, db, g.charcoalT);
  g.charcoalEfficiency = g.refilling > 0 || g.charcoalT >= 1 ? 0 : burnEfficiency;

  const carry = db.ingredients.shared.carryoverRate;
  const burnAt = db.ingredients.shared.burnedThreshold;

  for (const zone of g.zones) {
    if (zone.items.length === 0) continue;
    const heat = zoneThermalBase(g, zone.index, db) * burnEfficiency;
    for (const f of zone.items) {
      if (f.burned) continue;
      const ing = f.ingredient;
      if (ing.cookMethod !== 'grill' || ing.sideCookSec <= 0) continue;
      const rate = (heat * ing.heatRate * g.stats.heatRampRate) / ing.sideCookSec;
      f.timeOnGrill += activeSec;
      for (let s = 0; s < f.sides.length; s++) {
        const k = s === f.downSide ? 1 : carry;
        f.sides[s] = f.sides[s]! + activeSec * rate * k;
      }
      for (let s = 0; s < f.sides.length; s++) {
        if (f.sides[s]! >= burnAt) {
          f.burned = true;
          onBurn?.(f);
          break;
        }
      }
    }
  }
  return refilled;
}

// ── Scoring ──────────────────────────────────────────────────────────────────

export type ServeQuality = 'perfect' | 'good' | 'overcooked' | 'raw' | 'burned';

export interface ScoredItem {
  quality: ServeQuality;
  doneness: number;
  evenness: number;
  windowLo: number;
  windowHi: number;
  coins: number;
  xp: number;
}

/** Payout tuning. Always sourced from `economy.json -> reward` so money rules live in exactly one place. */
export interface RewardTuning {
  orderBaseTip: number;
  perfectTipBonus: number;
  speedBonusMax: number;
  comboStep: number;
  comboCap: number;
  customerTipWeight: number;
}

export function rewardTuning(economy: EconomyTable): RewardTuning {
  const r = economy.reward;
  return {
    orderBaseTip: r.orderBaseTip,
    perfectTipBonus: r.perfectTipBonus,
    speedBonusMax: r.speedBonusMax,
    comboStep: r.comboStep,
    comboCap: r.comboCap,
    customerTipWeight: r.customerTipWeight
  };
}

export interface ScoreContext {
  /** Explicit in real turns; legacy isolated scoring fixtures default to starter tier. */
  restaurantIndex?: number;
  /** Target overall doneness requested by the customer (default = window centre). */
  target: number;
  /** Customer tolerance scale; < 1 narrows the perfect window. */
  toleranceScale: number;
  /** 0..1, how much of the customer's patience remained when served. */
  patienceRemaining: number;
  combo: number;
  tipMult: number;
  /** Prestige only scales the tip component, not the legacy whole-plate multiplier. */
  prestigeTipBonus?: number;
  autoServiceTipBonus?: number;
  xpMult: number;
  /** Customer generosity as authored in customers.json (e.g. VIP 3x, stingy 0.5x). */
  customerTipMult?: number;
  /** LiveOps/event value multiplier. */
  eventValueMult?: number;
  tuning: RewardTuning;
}

/**
 * Score a single served item. Deterministic and side-effect free so it can be
 * unit-tested and mirrored 1:1 in `ScoringService.cs`.
 */
export function scoreItem(db: GameDatabase, f: FoodRuntime, ctx: ScoreContext): ScoredItem {
  const ing = f.ingredient;
  const doneness = overallDoneness(f);
  const ev = evenness(f);
  const padding = db.grill.scoring.goodWindowPadding;
  const t = ctx.tuning;

  const [rawLo, rawHi] = ing.perfectWindow;
  const centre = ctx.target > 0 ? ctx.target : (rawLo + rawHi) / 2;
  const tol = ctx.toleranceScale;
  const lo = centre - (centre - rawLo) * tol;
  const hi = centre + (rawHi - centre) * tol;

  let quality: ServeQuality;
  if (f.burned || doneness >= db.ingredients.shared.burnedThreshold) {
    quality = 'burned';
  } else if (doneness >= lo && doneness <= hi && ev >= db.ingredients.shared.minEvennessForPerfect) {
    quality = 'perfect';
  } else if (doneness >= lo - padding && doneness <= hi + padding) {
    quality = 'good';
  } else if (doneness < lo - padding) {
    quality = 'raw';
  } else {
    quality = 'overcooked';
  }

  const p = ctx.patienceRemaining;
  const speedBonus = t.speedBonusMax * clamp((p - 0.15) / 0.7, 0, 1);
  const comboMult = clamp(1 + ctx.combo * t.comboStep, 1, t.comboCap);
  const eventMult = ctx.eventValueMult ?? 1;
  // Generosity scales a damped tip term, never the full plate price.
  const customerMult = 1 + ((ctx.customerTipMult ?? 1) - 1) * t.customerTipWeight;

  const prestige = ctx.prestigeTipBonus ?? 0;
  // Preserve Plates/Decor's existing payout, but never apply the new prestige to base price.
  const tipFactor = (tips: number): number => {
    const legacy=ctx.tipMult-prestige;
    return (1+tips)*legacy + tips*prestige + tips*ctx.tipMult*(ctx.autoServiceTipBonus??0);
  };
  let coins = 0;
  let xp = ing.xp * ctx.xpMult;

  switch (quality) {
    case 'perfect':
      coins = ing.value * ing.satisfaction * tipFactor(t.orderBaseTip + t.perfectTipBonus + speedBonus) * comboMult * eventMult * customerMult;
      xp *= 1.35;
      break;
    case 'good':
      coins = ing.value * ing.satisfaction * tipFactor(t.orderBaseTip + speedBonus) * comboMult * eventMult * customerMult;
      break;
    case 'overcooked':
    case 'raw':
      coins = ing.value * 0.35;
      xp *= 0.4;
      break;
    case 'burned':
      coins = 0;
      xp = 0;
      break;
  }

  return { quality, doneness, evenness: ev, windowLo: lo, windowHi: hi, coins: Math.round(coins * activeCoinMultiplier(db,ctx.restaurantIndex??0)), xp: Math.round(xp) };
}

/** Authored active revenue curve; shared by manual, staff and VIP serving in every client. */
export function activeCoinMultiplier(db:GameDatabase,restaurantIndex:number):number {
  const multiplier=db.economy.reward.activeCoinMultiplierByRestaurant[restaurantIndex];
  if(!Number.isInteger(restaurantIndex)||multiplier===undefined||!Number.isFinite(multiplier)||multiplier<=0||multiplier>1)throw Error('invalid active income context');
  return multiplier;
}
