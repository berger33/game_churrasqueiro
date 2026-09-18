import type { GameDatabase, RawDataBundle } from './types.ts';

/**
 * Builds an indexed, cross-validated database from the raw JSON tables.
 *
 * The same function is used by:
 *  - the Node studio tools (`tools/studio/*`)
 *  - the design-verification prototype (`prototype/`)
 * and is mirrored by `DataDatabase.FromJson()` in the Unity client.
 */
export function createDatabase(raw: RawDataBundle): GameDatabase {
  const db: GameDatabase = {
    ingredients: raw.ingredients,
    grill: raw.grill,
    customers: raw.customers,
    restaurants: raw.restaurants,
    upgrades: raw.upgrades,
    economy: raw.economy,
    ingredientById: new Map(),
    customerById: new Map(),
    restaurantByIndex: new Map(),
    upgradeById: new Map()
  };

  for (const it of raw.ingredients.items) db.ingredientById.set(it.id, it);
  for (const c of raw.customers.customers) db.customerById.set(c.id, c);
  for (const r of raw.restaurants.restaurants) db.restaurantByIndex.set(r.index, r);
  for (const u of raw.upgrades.tracks) db.upgradeById.set(u.id, u);

  return db;
}

/** Structural + referential validation. Returns a list of human-readable problems. */
export function validateDatabase(db: GameDatabase): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();

  for (const it of db.ingredients.items) {
    if (ids.has(it.id)) problems.push(`ingredient: duplicate id "${it.id}"`);
    ids.add(it.id);
    if (it.sides < 1) problems.push(`ingredient ${it.id}: sides must be >= 1`);
    if (it.cookMethod === 'grill' && it.sideCookSec <= 0) {
      problems.push(`ingredient ${it.id}: grilled items need sideCookSec > 0`);
    }
    if (it.cookMethod === 'prep' && !it.prepSec) {
      problems.push(`ingredient ${it.id}: prep items need prepSec > 0`);
    }
    const [lo, hi] = it.perfectWindow;
    if (!(lo < hi)) problems.push(`ingredient ${it.id}: perfectWindow must be ascending`);
    if (lo < 0 || hi > 1.2) problems.push(`ingredient ${it.id}: perfectWindow out of sane range`);
    if (it.value <= 0) problems.push(`ingredient ${it.id}: value must be > 0`);
    if (!db.restaurantByIndex.has(it.unlock.restaurantIndex)) {
      problems.push(`ingredient ${it.id}: unlock.restaurantIndex ${it.unlock.restaurantIndex} not defined`);
    }
  }

  for (const r of db.restaurants.restaurants) {
    for (const cid of r.customerPool) {
      if (!db.customerById.has(cid)) problems.push(`restaurant ${r.id}: unknown customer "${cid}" in pool`);
    }
    if (r.service.maxOrdersOnScreen < 1) problems.push(`restaurant ${r.id}: maxOrdersOnScreen must be >= 1`);
  }

  for (const c of db.customers.customers) {
    if (c.itemsMin < 1) problems.push(`customer ${c.id}: itemsMin must be >= 1`);
    if (c.itemsMax < c.itemsMin) problems.push(`customer ${c.id}: itemsMax < itemsMin`);
    if (c.patienceMultiplier <= 0) problems.push(`customer ${c.id}: patienceMultiplier must be > 0`);
  }

  // Restaurant indices must be contiguous starting at 0.
  const indices = [...db.restaurantByIndex.keys()].sort((a, b) => a - b);
  indices.forEach((v, i) => {
    if (v !== i) problems.push(`restaurant indices must be contiguous from 0 (found ${v} at position ${i})`);
  });

  // Upgrade costs must be monotonic within a track.
  for (const u of db.upgrades.tracks) {
    let prev = 0;
    for (let lvl = 1; lvl <= u.maxLevel; lvl++) {
      const cost = upgradeCost(u.baseCost, u.growth, lvl);
      if (cost <= prev) problems.push(`upgrade ${u.id}: non-monotonic cost at level ${lvl}`);
      prev = cost;
    }
    if (u.effect.delta === 0) problems.push(`upgrade ${u.id}: effect delta is 0`);
  }

  return problems;
}

/** cost(level) = round(base * growth^(level-1) / 10) * 10 — matches ECONOMY.md and the Unity port. */
export function upgradeCost(baseCost: number, growth: number, level: number): number {
  if (level < 1) return 0;
  const raw = baseCost * Math.pow(growth, level - 1);
  return Math.round(raw / 10) * 10;
}

/** XP required to go FROM `level` TO `level + 1`. */
export function xpForLevel(level: number, a: number, exponent: number, minPerLevel: number): number {
  if (level < 1) return minPerLevel;
  return Math.max(minPerLevel, Math.round(a * Math.pow(level, exponent)));
}

/** Cumulative XP needed to reach `level` (level 1 costs 0). */
export function totalXpForLevel(level: number, a: number, exponent: number, minPerLevel: number): number {
  let total = 0;
  for (let l = 1; l < level; l++) total += xpForLevel(l, a, exponent, minPerLevel);
  return total;
}

/** Level for a given cumulative XP amount. */
export function levelForXp(xp: number, a: number, exponent: number, minPerLevel: number, maxLevel: number): number {
  let level = 1;
  let remaining = xp;
  while (level < maxLevel) {
    const need = xpForLevel(level, a, exponent, minPerLevel);
    if (remaining < need) break;
    remaining -= need;
    level++;
  }
  return level;
}

/** Piecewise-linear curve lookup (used for the charcoal efficiency ramp). */
export function sampleCurve(points: { t: number; value: number }[], t: number): number {
  if (points.length === 0) return 1;
  const clamped = Math.max(0, Math.min(1, t));
  if (clamped <= points[0]!.t) return points[0]!.value;
  const last = points[points.length - 1]!;
  if (clamped >= last.t) return last.value;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]!;
    const b = points[i + 1]!;
    if (clamped >= a.t && clamped <= b.t) {
      const span = b.t - a.t;
      const k = span <= 0 ? 0 : (clamped - a.t) / span;
      return a.value + (b.value - a.value) * k;
    }
  }
  return last.value;
}

export const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);
