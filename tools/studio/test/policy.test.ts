/**
 * Skill-policy behaviour.
 *
 * These tests lock down what the *skills* in the economy simulator actually do,
 * because every published pacing number is measured through this policy. A
 * policy that quietly stops using a mechanic makes the balance report describe a
 * game nobody plays.
 *
 * Regression this file exists for: `pickZoneFast` compared `zones[i].id` against
 * the ingredient's `idealZone`. Runtime zones carry no `id` (they are
 * `{ index, heat, items }`), so the comparison was always false and the
 * ideal-zone branch was dead code: at skill 0.55 the measured ideal-zone hit rate
 * was 31.9%, exactly the 1/3 chance level for three zones. Nothing failed —
 * `npm test` was green and all 15 balance targets passed — because no test
 * asserted the thing the code claimed to do.
 *
 * A zone choice is a placement, and every placement is observable, so the
 * assertion is behavioural rather than structural: run real turns, look at where
 * items actually landed.
 */
import { describe, expect, it } from 'vitest';
import { loadAndValidate } from '../load-data.ts';
import { generateLevels } from '../gen-levels.ts';
import { TurnSimulation } from '../../sim-core/src/turn.ts';
import { SkillPolicy, optimalFlipPoint, optimalCookDuration } from '../../sim-core/src/policy.ts';
import { Rng } from '../../sim-core/src/rng.ts';

const { db } = loadAndValidate();
const LEVELS = generateLevels([[0, 20], [1, 20], [2, 20], [3, 20], [4, 20], [5, 20]]).levels;
const ZONE_COUNT = db.grill.zones.length;

const idealIndexOf = (ingredientId: string): number => {
  const ing = db.ingredientById.get(ingredientId);
  if (!ing || ing.cookMethod !== 'grill') return -1;
  return db.grill.zones.findIndex((z) => z.id === ing.idealZone);
};

/**
 * Plays real turns and reports where every grill item was first placed.
 * Returns the share of placements that went to the ingredient's ideal zone.
 */
function measureIdealZoneHits(skill: number, turns = 40): { placed: number; hits: number } {
  let placed = 0;
  let hits = 0;

  for (let i = 0; i < turns; i++) {
    const level = LEVELS[i % LEVELS.length]!;
    const sim = new TurnSimulation(
      db,
      { restaurantIndex: level.restaurantIndex, levelId: level.id, upgradeLevels: {}, seed: 2000 + i },
      2000 + i
    );
    const policy = new SkillPolicy(new Rng(2000 + i * 7919), { skill });
    const seen = new Set<number>();
    let guard = 0;

    while (!sim.finished && guard++ < 40000) {
      const before = sim.grill.zones.map((z) => z.items.map((f) => f.uid));
      sim.tick(1 / 20, (a) => {
        policy.act(a);
        for (let zi = 0; zi < a.grill.zones.length; zi++) {
          for (const f of a.grill.zones[zi]!.items) {
            if (seen.has(f.uid)) continue;
            seen.add(f.uid);
            if (before.some((list) => list.includes(f.uid))) continue;
            const ideal = idealIndexOf(f.ingredient.id);
            if (ideal < 0) continue;
            placed++;
            if (ideal === zi) hits++;
          }
        }
      });
    }
  }

  return { placed, hits };
}

describe('skill policy — zone choice', () => {
  it('sends most items to their ideal zone at a skilled level', () => {
    const { placed, hits } = measureIdealZoneHits(0.55);
    const rate = hits / placed;

    expect(placed).toBeGreaterThan(100);
    // Chance level is 33.3% over three zones. The old dead branch measured 31.9%;
    // the corrected policy measures ~68% at this skill.
    expect(rate).toBeGreaterThan(0.6);
  });

  it('beats chance even at low skill, because it still tries', () => {
    const { placed, hits } = measureIdealZoneHits(0.30);
    const rate = hits / placed;

    expect(placed).toBeGreaterThan(100);
    expect(rate).toBeGreaterThan(1 / ZONE_COUNT + 0.1);
  });

  it('is monotonically more likely to hit the ideal zone as skill rises', () => {
    const low = measureIdealZoneHits(0.30);
    const mid = measureIdealZoneHits(0.55);
    const high = measureIdealZoneHits(0.90);

    const rate = (m: { placed: number; hits: number }): number => m.hits / m.placed;
    expect(rate(low)).toBeLessThan(rate(mid));
    expect(rate(mid)).toBeLessThan(rate(high));
  });
});

describe('optimal cook maths (flip / duration)', () => {
  it('flip point and total duration agree for every grill item in the data', () => {
    const carry = db.ingredients.shared.carryoverRate;
    let checked = 0;

    for (const ing of db.ingredients.items) {
      if (ing.cookMethod !== 'grill' || ing.sides < 2) continue;
      const target = (ing.perfectWindow[0]! + ing.perfectWindow[1]!) / 2;
      const ratePerSec = 1; // units of doneness per second; the identity is linear in it
      const flipAt = optimalFlipPoint(target, ing.sides, carry);
      const duration = optimalCookDuration(target, ing.sides, carry, ratePerSec);

      expect(flipAt).toBeGreaterThan(0);
      expect(duration).toBeGreaterThan(flipAt);
      // n-1 flips spread over the duration put the first one at duration / sides.
      expect(flipAt).toBeCloseTo(duration / ing.sides, 10);
      // Halving the rate doubles the time, and never changes the flip point.
      expect(optimalCookDuration(target, ing.sides, carry, ratePerSec / 2)).toBeCloseTo(duration * 2, 10);
      expect(optimalFlipPoint(target, ing.sides, carry)).toBe(flipAt);
      checked++;
    }

    expect(checked).toBeGreaterThan(8);
  });

  it('reports an unreachable duration instead of dividing by zero', () => {
    expect(optimalCookDuration(0.8, 2, 0.12, 0)).toBe(Infinity);
    expect(optimalCookDuration(0.8, 2, 0.12, -1)).toBe(Infinity);
  });
});
