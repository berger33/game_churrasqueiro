// Mechanics fixtures explicitly use level 44: the full menu of their restaurant.
// Player progression boundaries are covered by ingredient-unlock.test.ts.
import { describe, expect, it } from 'vitest';
import { loadDatabase } from '../load-data.ts';
import { validateDatabase } from '../../sim-core/src/data.ts';
import {
  createFood, placeOnGrill, tickGrill, flipFood, overallDoneness,
  scoreItem, rewardTuning
} from '../../sim-core/src/cooking.ts';
import { TurnSimulation } from '../../sim-core/src/turn.ts';
import { SkillPolicy, optimalFlipPoint } from '../../sim-core/src/policy.ts';
import { Rng } from '../../sim-core/src/rng.ts';

const db = loadDatabase();
const CUTS = ['costela', 'cupim'];

/** Integrate actual sides/charcoal until burning; obey the recipe, not a test-forced flip. */
function trace(id: string, zone: number, obeyRecipe: boolean) {
  const ing = db.ingredientById.get(id)!;
  const sim = new TurnSimulation(db, { playerLevel: 44, restaurantIndex: 4, levelId: 'slow-cut', upgradeLevels: {}, seed: 1 });
  const f = createFood(1, ing);
  expect(placeOnGrill(sim.grill, db, f, zone)).toBe(true);
  const target = (ing.perfectWindow[0] + ing.perfectWindow[1]) / 2;
  const flipAt = optimalFlipPoint(target, ing.sides, db.ingredients.shared.carryoverRate);
  let perfectTicks = 0, nonRawBeforeBurn = 0, t = 0;
  while (!f.burned && t < 180) {
    tickGrill(sim.grill, db, 0.05); t += 0.05;
    if (obeyRecipe && ing.flipNeeded && !f.flips && f.sides[f.downSide]! >= flipAt) flipFood(sim.grill, f, t, db);
    const quality = scoreItem(db, f, {
      target: 0, toleranceScale: 1, patienceRemaining: 1, combo: 0, tipMult: 1, xpMult: 1, tuning: rewardTuning(db.economy)
    }).quality;
    if (quality === 'perfect') perfectTicks++;
    if (!f.burned && quality !== 'raw') nonRawBeforeBurn++;
  }
  return { f, perfectSec: perfectTicks * 0.05, nonRawBeforeBurn };
}

describe('A-01: slow cuts require a flip (owner decision)', () => {
  for (const id of CUTS) {
    it(`${id} declares two sides and a mandatory flip`, () => {
      expect(db.ingredientById.get(id)).toMatchObject({ sides: 2, flipNeeded: true, idealZone: 'low' });
    });
    it(`${id} cannot reach a valid window if the player never flips`, () => {
      const { f, perfectSec, nonRawBeforeBurn } = trace(id, 2, false);
      expect(f.burned).toBe(true);
      expect(f.flips).toBe(0);
      expect(perfectSec).toBe(0);
      expect(nonRawBeforeBurn).toBe(0);
      expect(overallDoneness(f)).toBeLessThan(0.68);
    });
    for (const zone of [0, 1, 2]) {
      it(`${id} has a usable perfect window following its recipe in zone ${zone}`, () => {
        const { f, perfectSec } = trace(id, zone, true);
        expect(f.flips).toBe(1);
        expect(perfectSec).toBeGreaterThan(1); // actual time window, not synthetic sides set to the target
        expect(f.burned).toBe(true); // leaving it too long must STILL burn
      });
    }
    it(`data validation rejects reintroducing ${id}'s non-flipping multi-side recipe`, () => {
      const broken = structuredClone(db);
      broken.ingredientById.get(id)!.flipNeeded = false;
      expect(validateDatabase(broken)).toContain(`ingredient ${id}: multi-side grilling requires flipNeeded`);
    });
    for (const restaurantIndex of [3, 4, 5, 6]) {
      if (restaurantIndex < db.ingredientById.get(id)!.unlock.restaurantIndex) continue;
      it(`the bot flips and serves ${id} at restaurant ${restaurantIndex} on the equipped advanced grill`, () => {
        let perfect = 0;
        // Isolated real orders: prove the cut is cookable independently of random pool/patience balance.
        for (let seed = 1; seed <= 8; seed++) {
          const sim = new TurnSimulation(db, {
            playerLevel: 44,
            restaurantIndex, levelId: 'slow-cut-bot', upgradeLevels: {}, seed,
            churrasqueiraId: 'fornalha_dragao_manso', churrasqueiraLevel: 3,
            overrides: { autoSpawn: false, turnLengthSec: 150 }
          });
          sim.spawnScriptedCustomer('comum', [id], 150);
          const policy = new SkillPolicy(new Rng(seed * 7919), { skill: 1 });
          while (!sim.finished && sim.counters.customersServed === 0) sim.tick(1 / 30, a => policy.act(a));
          expect(sim.counters.flips).toBeGreaterThan(0);
          expect(sim.counters.customersServed).toBe(1);
          expect(sim.counters.burnedFood).toBe(0);
          perfect += sim.counters.perfectCooks;
        }
        expect(perfect / 8).toBeGreaterThanOrEqual(0.75); // skilled human policy, not frame-perfect
      });
    }
  }
});
