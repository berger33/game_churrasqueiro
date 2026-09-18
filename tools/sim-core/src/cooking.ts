import { clamp, sampleCurve } from './data.ts';
import type { EconomyTable, GameDatabase, Ingredient, RestaurantDef } from './types.ts';

// ── Derived stats (from restaurant tier + upgrade levels) ────────────────────

export interface DerivedStats {
  slotsPerZone: number;
  zoneCount: number;
  heatStability: number;
  charcoalDurationSec: number;
  highZoneBonus: number;
  heatRampRate: number;
  prepSlots: number;
  prepSpeedMult: number;
  tipMult: number;
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
  rawStockPerTurn: number;
}

export function deriveStats(db: GameDatabase, restaurant: RestaurantDef, levels: Record<string, number>): DerivedStats {
  const get = (trackId: string): number => {
    const lvl = levels[trackId] ?? 0;
    const track = db.upgradeById.get(trackId);
    if (!track || lvl <= 0) return 0;
    return track.effect.delta * Math.min(lvl, track.maxLevel);
  };

  return {
    slotsPerZone: restaurant.grill.slotsPerZone + Math.floor(get('grill_size') / 1),
    zoneCount: restaurant.grill.zoneCount,
    heatStability: restaurant.grill.heatStability + get('grill_stability'),
    charcoalDurationSec: db.grill.charcoal.baseDurationSec * (1 + restaurant.grill.charcoalDurationBonus + get('charcoal_duration')),
    highZoneBonus: get('grill_heat'),
    heatRampRate: 1 + get('grill_speed'),
    prepSlots: restaurant.service.prepSlots + Math.floor(get('board')),
    prepSpeedMult: 1 + get('knife'),
    tipMult: 1 + get('plates') + get('decor'),
    serveSpeedMult: 1 + get('tray'),
    patienceMult: 1 + get('patience_charm') + get('music'),
    maxOrdersOnScreen: restaurant.service.maxOrdersOnScreen + Math.floor(get('capacity')),
    tables: restaurant.service.tables + Math.floor(get('tables')),
    xpMult: 1 + get('lighting'),
    customerSpawnRate: 1 + get('sign'),
    autoFlipLevel: Math.floor(get('garcom') > 0 ? 0 : 0) + Math.floor(levels['churrasqueiro'] ?? 0),
    autoServeLevel: Math.floor(levels['garcom'] ?? 0),
    autoPrepLevel: Math.floor(levels['auxiliar'] ?? 0),
    idleRateMult: 1 + get('gerente'),
    rawStockPerTurn: 6 + Math.floor(get('counter'))
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
  stats: DerivedStats;
}

export function createGrill(stats: DerivedStats, db: GameDatabase): GrillRuntime {
  const zones = [];
  const count = Math.min(stats.zoneCount, db.grill.zones.length);
  for (let i = 0; i < count; i++) {
    zones.push({ index: i, heat: db.grill.zones[i]!.heatMultiplier, items: [] });
  }
  return { zones, charcoalT: 0, charcoalEfficiency: 1, refilling: 0, stats };
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
  const base = db.grill.zones[zoneIndex]?.heatMultiplier ?? 1;
  const top = g.zones.length - 1;
  const bonus = zoneIndex === top ? g.stats.highZoneBonus : g.stats.highZoneBonus * (zoneIndex / Math.max(1, top)) * 0.5;
  return (base + bonus) * g.charcoalEfficiency;
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

export function flipFood(g: GrillRuntime, f: FoodRuntime, now: number, db: GameDatabase): boolean {
  if (!f.onGrill) return false;
  if (now - f.lastFlipAt < db.grill.interaction.flipCooldownSec) return false;
  f.downSide = (f.downSide + 1) % f.sides.length;
  f.flips++;
  f.lastFlipAt = now;
  return true;
}

export function startCharcoalRefill(g: GrillRuntime): boolean {
  if (g.refilling > 0) return false;
  g.refilling = 1e-6; // marker; caller supplies duration via `charcoalRefillDuration`
  return true;
}

export function charcoalRefillDuration(db: GameDatabase): number {
  return db.grill.charcoal.refillTimeSec;
}

/**
 * Advance the grill by `dt` seconds. This is the authoritative cooking step and
 * is mirrored exactly by `GrillSimulator.Tick()` in Unity.
 */
export function tickGrill(g: GrillRuntime, db: GameDatabase, dt: number, onBurn?: (f: FoodRuntime) => void): void {
  // Charcoal lifecycle
  if (g.refilling > 0) {
    g.refilling -= dt;
    if (g.refilling <= 0) {
      g.refilling = 0;
      g.charcoalT = 0;
    }
  } else {
    g.charcoalT = clamp(g.charcoalT + dt / g.stats.charcoalDurationSec, 0, 1);
  }
  g.charcoalEfficiency = sampleCurve(db.grill.charcoal.efficiencyCurve, g.charcoalT);

  const carry = db.ingredients.shared.carryoverRate;
  const burnAt = db.ingredients.shared.burnedThreshold;

  for (const zone of g.zones) {
    if (zone.items.length === 0) continue;
    const heat = effectiveHeat(g, zone.index, db);
    for (const f of zone.items) {
      if (f.burned) continue;
      const ing = f.ingredient;
      if (ing.cookMethod !== 'grill' || ing.sideCookSec <= 0) continue;
      const rate = (heat * ing.heatRate * g.stats.heatRampRate) / ing.sideCookSec;
      f.timeOnGrill += dt;
      for (let s = 0; s < f.sides.length; s++) {
        const k = s === f.downSide ? 1 : carry;
        f.sides[s] = f.sides[s]! + dt * rate * k;
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
  /** Target overall doneness requested by the customer (default = window centre). */
  target: number;
  /** Customer tolerance scale; < 1 narrows the perfect window. */
  toleranceScale: number;
  /** 0..1, how much of the customer's patience remained when served. */
  patienceRemaining: number;
  combo: number;
  tipMult: number;
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

  let coins = 0;
  let xp = ing.xp * ctx.xpMult;

  switch (quality) {
    case 'perfect':
      coins = ing.value * ing.satisfaction * (1 + t.orderBaseTip + t.perfectTipBonus + speedBonus) * comboMult * ctx.tipMult * eventMult * customerMult;
      xp *= 1.35;
      break;
    case 'good':
      coins = ing.value * ing.satisfaction * (1 + t.orderBaseTip + speedBonus) * comboMult * ctx.tipMult * eventMult * customerMult;
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

  return { quality, doneness, evenness: ev, windowLo: lo, windowHi: hi, coins: Math.round(coins), xp: Math.round(xp) };
}
