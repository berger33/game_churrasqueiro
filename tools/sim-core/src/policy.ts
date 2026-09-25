import { clamp } from './data.ts';
import { overallDoneness, type FoodRuntime, type TurnActions } from './turn.ts';
import type { CustomerRuntime } from './turn.ts';
import type { Ingredient } from './types.ts';
import type { Rng } from './rng.ts';

export interface SkillPolicyOptions {
  /** 0 = clumsy beginner, 1 = flawless professional. */
  skill: number;
  /** Seconds of reaction lag before acting on new information. */
  reactionSec?: number;
  /** Ceiling policy used to compute theoretical economy maxima. */
  perfectOnly?: boolean;
}

/**
 * Optimal flip point for `n` sides with carryover `c`:
 *   flipAt = T / (1 + (n - 1) * c)
 * Total cook duration: D = T * n / (1 + (n - 1) * c) / rate.
 * Derivation lives in GAME_DESIGN.md §"Cocção".
 */
export function optimalFlipPoint(target: number, sides: number, carryover: number): number {
  return target / (1 + (sides - 1) * carryover);
}

export function optimalCookDuration(target: number, sides: number, carryover: number, ratePerSec: number): number {
  if (ratePerSec <= 0) return Infinity;
  return (target * sides) / (1 + (sides - 1) * carryover) / ratePerSec;
}

/**
 * The "test-harness player". Balance numbers come from actually playing the sim
 * with this policy across the skill axis, not from guesswork.
 */
export class SkillPolicy {
  private readonly skill: number;
  private readonly reactionSec: number;
  /** Modelled human reaction latency in seconds (decide → tap). */
  private readonly latency: number;
  /** Granularity of the visual doneness cue. */
  private readonly perceptionQuant: number;
  private readonly perfectOnly: boolean;
  private readonly rng: Rng;

  constructor(rng: Rng, options: SkillPolicyOptions) {
    this.skill = clamp(options.skill, 0, 1);
    const skill = this.skill;
    this.reactionSec = options.reactionSec ?? (0.5 - skill * 0.3);
    this.latency = this.reactionSec;
    this.perceptionQuant = 0.08 - skill * 0.045;
    this.perfectOnly = options.perfectOnly ?? false;
    this.rng = rng;
  }

  act(a: TurnActions): void {
    const db = a.db;
    const carry = db.ingredients.shared.carryoverRate;
    const foods = a.foods;
    const customers = a.customers;
    const zones = a.grill.zones;
    const slotsPerZone = a.grill.stats.slotsPerZone;

    // 1. Keep the fire alive.
    if (a.grill.charcoalT > 0.9 && a.grill.refilling <= 0 && a.timeLeft > 12) a.refillCharcoal();

    // 2. Clear burned food — it holds a slot and can never be served.
    for (let i = foods.length - 1; i >= 0; i--) {
      const f = foods[i]!;
      if (f.burned && !f.served) a.discard(f);
    }

    // 3. Every outstanding order line needs something cooking.
    for (let ci = 0; ci < customers.length; ci++) {
      const c = customers[ci]!;
      if (c.state !== 'waiting') continue;
      const lines = c.lines;
      for (let li = 0; li < lines.length; li++) {
        const line = lines[li]!;
        if (line.fulfilledBy.length > 0) continue;
        let alreadyCooking = false;
        for (let fi = 0; fi < foods.length; fi++) {
          const f = foods[fi]!;
          if (f.served || f.burned) continue;
          if (f.ingredient.id !== line.ingredientId) continue;
          // Prep items are never on the grill — counting only grilled items made the
          // policy spawn a fresh one every single tick.
          if (f.onGrill || f.ingredient.cookMethod === 'prep') {
            alreadyCooking = true;
            break;
          }
        }
        if (alreadyCooking) continue;
        const ing = db.ingredientById.get(line.ingredientId);
        if (!ing) continue;
        const f = a.spawn(ing as Ingredient);
        if (ing.cookMethod === 'prep') continue; // prepped off-grill
        const zone = this.pickZoneFast(zones, slotsPerZone, this.zoneIndex(a, ing.idealZone));
        if (zone >= 0) a.place(f, zone);
      }
    }

    // 4. Flip, and correct the zone when the player is skilled enough to care.
    for (let fi = 0; fi < foods.length; fi++) {
      const f = foods[fi]!;
      if (!f.onGrill || f.burned || f.served) continue;
      const ing = f.ingredient;
      if (ing.cookMethod !== 'grill') continue;
      const target = this.targetFor(a, f);
      const flipAt = optimalFlipPoint(target, ing.sides, carry) * (1 + this.jitter(0.12));
      if (ing.flipNeeded && (f.sides[f.downSide] ?? 0) >= flipAt && f.flips < ing.sides - 1) a.flip(f);

      const ideal = this.zoneIndex(a, ing.idealZone);
      if (this.skill > 0.55 && ideal >= 0 && f.zoneIndex !== ideal && zones[ideal]!.items.length < slotsPerZone) {
        a.move(f, ideal);
      }
    }

    // 5. Serve — single pass, no allocations.
    for (let ci = 0; ci < customers.length; ci++) {
      const c = customers[ci]!;
      if (c.state !== 'waiting') continue;
      const lines = c.lines;
      for (let li = 0; li < lines.length; li++) {
        const line = lines[li]!;
        if (line.fulfilledBy.length > 0) continue;
        const target = line.target > 0 ? line.target : this.defaultTarget(a, line.ingredientId);
        let best: FoodRuntime | null = null;
        let bestErr = Infinity;
        for (let fi = 0; fi < foods.length; fi++) {
          const f = foods[fi]!;
          if (f.served || f.burned) continue;
          if (f.ingredient.id !== line.ingredientId) continue;
          if (!f.onGrill && f.ingredient.cookMethod !== 'prep') continue;
          const err = Math.abs(overallDoneness(f) - target);
          if (err < bestErr) {
            bestErr = err;
            best = f;
          }
        }
        if (!best) continue;
        const d = overallDoneness(best);
        const rate = this.rateOf(a, best);
        // A human decides at `d` but the tap lands `latency` seconds later, so they
        // must release EARLY by rate*latency. Perception is also coarse: doneness is
        // read from a visual cue, not a number.
        const releaseAt = target - rate * this.latency + this.perceptionNoise();
        let almostBurning = false;
        for (let si = 0; si < best.sides.length; si++) {
          if (best.sides[si]! > 1.05) {
            almostBurning = true;
            break;
          }
        }
        if (d >= releaseAt || (almostBurning && d > target * 0.8)) {
          if (this.latency > 0) a.serveDelayed(c, best, this.latency);
          else a.serve(c, best);
        }
      }
    }
  }

  /** Lazily built zone-id → index lookup (avoids a linear scan every frame). */
  private zoneIndexCache: Map<string, number> | null = null;
  private zoneIndex(a: TurnActions, id: string): number {
    if (id === 'none') return -1;
    if (!this.zoneIndexCache) {
      this.zoneIndexCache = new Map();
      for (const z of a.db.grill.zones) this.zoneIndexCache.set(z.id, z.index);
    }
    return this.zoneIndexCache.get(id) ?? -1;
  }

  /** How fast this item is currently cooking (doneness units per second). */
  private rateOf(a: TurnActions, f: FoodRuntime): number {
    if (f.zoneIndex < 0) return 0.1;
    const zoneBase = a.db.grill.zones[f.zoneIndex]?.heatMultiplier ?? 1;
    const top = a.grill.zones.length - 1;
    const bonus =
      f.zoneIndex === top
        ? a.grill.stats.highZoneBonus
        : a.grill.stats.highZoneBonus * (f.zoneIndex / Math.max(1, top)) * 0.5;
    // Charcoal efficiency MUST be included or the compensation drifts and the
    // player systematically serves early.
    const heat = (zoneBase + bonus) * a.grill.charcoalEfficiency;
    return (heat * f.ingredient.heatRate * a.grill.stats.heatRampRate) / f.ingredient.sideCookSec;
  }

  /**
   * Zone choice for a freshly spawned item. `idealIdx` is the *resolved* zone
   * index for the ingredient's `idealZone` id (`-1` when the ingredient has no
   * preference, e.g. `none`). The runtime zone objects carry no id of their own:
   * the id → index mapping lives in `db.grill.zones` and is resolved by
   * `zoneIndex()`. Comparing against a field that does not exist made this a
   * dead branch — every item was placed at random regardless of skill (measured:
   * 31.9% ideal-zone hits at skill 0.55 versus a 33.3% chance baseline).
   */
  private pickZoneFast(zones: TurnActions['grill']['zones'], slotsPerZone: number, idealIdx: number): number {
    if (idealIdx >= 0 && this.rng.next() <= this.skill) {
      if (zones[idealIdx]!.items.length < slotsPerZone) return idealIdx;
      for (let i = zones.length - 1; i >= 0; i--) if (i !== idealIdx && zones[i]!.items.length < slotsPerZone) return i;
      return -1;
    }
    this.rng.next();
    const order = zones.length;
    for (let attempt = 0; attempt < order; attempt++) {
      const i = Math.floor(this.rng.next() * order);
      if (zones[i]!.items.length < slotsPerZone) return i;
    }
    return -1;
  }

  private jitter(magnitude: number): number {
    // skill 1.0 = an excellent human, not a frame-perfect bot.
    return (this.rng.next() * 2 - 1) * magnitude * (1 - this.skill * 0.7);
  }

  /**
   * Error in reading the visual doneness cue. Combines a coarse perception step
   * (you cannot eyeball 0.01 doneness units) with a skill-dependent spread.
   */
  private perceptionNoise(): number {
    const quant = this.perceptionQuant;
    const coarse = (this.rng.next() * 2 - 1) * quant;
    const spread = (this.rng.next() * 2 - 1) * (0.032 + (1 - this.skill) * 0.06);
    return coarse + spread;
  }

  private targetFor(a: TurnActions, f: FoodRuntime): number {
    for (const c of a.customers) {
      if (c.state !== 'waiting') continue;
      for (const l of c.lines) {
        if (l.ingredientId === f.ingredient.id && l.fulfilledBy.length === 0 && l.target > 0) return l.target;
      }
    }
    return this.defaultTarget(a, f.ingredient.id);
  }

  private defaultTarget(a: TurnActions, ingredientId: string): number {
    const ing = a.db.ingredientById.get(ingredientId);
    if (!ing) return 0.8;
    return (ing.perfectWindow[0] + ing.perfectWindow[1]) / 2;
  }
}

function push(map: Map<string, FoodRuntime[]>, f: FoodRuntime): void {
  const list = map.get(f.ingredient.id) ?? [];
  list.push(f);
  map.set(f.ingredient.id, list);
}



export type { CustomerRuntime };
