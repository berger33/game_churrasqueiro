import { describe, expect, it } from 'vitest';
import { loadAndValidate } from '../load-data.ts';
import {
  createFood, createGrill, deriveStats, effectiveHeat, flipFood, overallDoneness, evenness,
  placeOnGrill, removeFromGrill, scoreItem, stageOf, tickGrill, grillSlotsFree, zoneIsFull,
  rewardTuning
} from '../../sim-core/src/cooking.ts';
import { optimalFlipPoint, optimalCookDuration, SkillPolicy } from '../../sim-core/src/policy.ts';
import { TurnSimulation } from '../../sim-core/src/turn.ts';
import { Rng } from '../../sim-core/src/rng.ts';
import { sampleCurve } from '../../sim-core/src/data.ts';

const { db } = loadAndValidate();
const stats = deriveStats(db, db.restaurantByIndex.get(0)!, {});

function grill() {
  return createGrill(stats, db);
}

describe('cooking model', () => {
  it('cooks the down side at full rate and the other side at carryover rate', () => {
    const g = grill();
    const f = createFood(1, db.ingredientById.get('picanha')!);
    placeOnGrill(g, db, f, 2);
    const before = [...f.sides];
    tickGrill(g, db, 1);
    expect(f.sides[0]!).toBeGreaterThan(before[0]!);
    expect(f.sides[1]!).toBeGreaterThan(0);
    expect(f.sides[1]! / f.sides[0]!).toBeCloseTo(db.ingredients.shared.carryoverRate, 5);
  });

  it('cooks faster in the high zone than in the low zone', () => {
    const g = grill();
    const hot = createFood(1, db.ingredientById.get('picanha')!);
    const cold = createFood(2, db.ingredientById.get('picanha')!);
    placeOnGrill(g, db, hot, 2);
    placeOnGrill(g, db, cold, 0);
    tickGrill(g, db, 3);
    expect(overallDoneness(hot)).toBeGreaterThan(overallDoneness(cold) * 1.5);
  });

  it('marks food burned once a side crosses the threshold', () => {
    const g = grill();
    const f = createFood(1, db.ingredientById.get('pao_de_alho')!);
    placeOnGrill(g, db, f, 2);
    const burned: string[] = [];
    for (let i = 0; i < 400 && !f.burned; i++) tickGrill(g, db, 0.1, (x) => burned.push(x.ingredient.id));
    expect(f.burned).toBe(true);
    expect(burned).toEqual(['pao_de_alho']);
  });

  it('respects the per-ingredient burn rate (bread burns before steak at equal time)', () => {
    const g = grill();
    const bread = createFood(1, db.ingredientById.get('pao_de_alho')!);
    const steak = createFood(2, db.ingredientById.get('costela')!);
    placeOnGrill(g, db, bread, 2);
    placeOnGrill(g, db, steak, 2);
    let t = 0;
    while (t < 30 && !bread.burned) {
      tickGrill(g, db, 0.1);
      t += 0.1;
    }
    expect(bread.burned).toBe(true);
    expect(steak.burned).toBe(false);
  });

  it('does not advance doneness for prep items on the grill path', () => {
    const g = grill();
    const f = createFood(1, db.ingredientById.get('vinagrete')!);
    placeOnGrill(g, db, f, 1);
    tickGrill(g, db, 5);
    expect(overallDoneness(f)).toBe(0);
  });
});

describe('flipping', () => {
  it('alternates the down side and counts flips', () => {
    const g = grill();
    const f = createFood(1, db.ingredientById.get('picanha')!);
    placeOnGrill(g, db, f, 2);
    expect(f.downSide).toBe(0);
    expect(flipFood(g, f, 1, db)).toBe(true);
    expect(f.downSide).toBe(1);
    expect(f.flips).toBe(1);
    expect(flipFood(g, f, 1.05, db)).toBe(false); // inside the flip cooldown
    expect(flipFood(g, f, 1.5, db)).toBe(true);
    expect(f.downSide).toBe(0);
  });

  it('optimalFlipPoint equalises both sides for a 2-sided cut', () => {
    const g = grill();
    const carry = db.ingredients.shared.carryoverRate;
    const target = 0.75;
    const f = createFood(1, db.ingredientById.get('picanha')!);
    placeOnGrill(g, db, f, 2);
    const flipAt = optimalFlipPoint(target, 2, carry);
    let guard = 0;
    while ((f.sides[0]! < flipAt) && guard++ < 10000) tickGrill(g, db, 0.01);
    flipFood(g, f, 10, db);
    guard = 0;
    while (overallDoneness(f) < target && guard++ < 10000) tickGrill(g, db, 0.01);
    expect(Math.abs(f.sides[0]! - f.sides[1]!)).toBeLessThan(0.06);
    expect(evenness(f)).toBeGreaterThan(0.9);
  });

  it('predicts cook duration within 10% of the simulated duration', () => {
    const ing = db.ingredientById.get('picanha')!;
    const g = grill();
    // Pre-warm past the charcoal ignition ramp (efficiencyCurve starts at 0.75
    // and reaches 1.0 at t=0.12 of the load) so the closed-form rate matches.
    tickGrill(g, db, stats.charcoalDurationSec * 0.15);
    const rate = effectiveHeat(g, 2, db) * ing.heatRate * stats.heatRampRate / ing.sideCookSec;
    const target = (ing.perfectWindow[0] + ing.perfectWindow[1]) / 2;
    const predicted = optimalCookDuration(target, 2, db.ingredients.shared.carryoverRate, rate);

    const f = createFood(1, ing);
    placeOnGrill(g, db, f, 2);
    const flipAt = optimalFlipPoint(target, 2, db.ingredients.shared.carryoverRate);
    let t = 0;
    let flipped = false;
    while (overallDoneness(f) < target && t < 60) {
      tickGrill(g, db, 0.01);
      t += 0.01;
      if (!flipped && f.sides[0]! >= flipAt) {
        flipFood(g, f, t, db);
        flipped = true;
      }
    }
    expect(Math.abs(t - predicted) / predicted).toBeLessThan(0.1);
  });
});

describe('doneness stages', () => {
  it('walk the standard ladder raw → rare → medium → well → burned', () => {
    const f = createFood(1, db.ingredientById.get('picanha')!);
    const at = (d: number) => {
      f.sides = [d, d];
      f.burned = false;
      return stageOf(db, f);
    };
    expect(at(0.1)).toBe('raw');
    expect(at(0.5)).toBe('rare');
    expect(at(0.8)).toBe('medium');
    expect(at(1.1)).toBe('well');
    expect(at(1.3)).toBe('burned');
  });

  it('honour per-ingredient stage overrides (spec §6 pão de alho / queijo coalho)', () => {
    const bread = createFood(1, db.ingredientById.get('pao_de_alho')!);
    bread.sides = [0.1, 0.1];
    expect(stageOf(db, bread)).toBe('cold');
    bread.sides = [0.5, 0.5];
    expect(stageOf(db, bread)).toBe('warm');
    bread.sides = [0.8, 0.8];
    expect(stageOf(db, bread)).toBe('crispy');

    const cheese = createFood(2, db.ingredientById.get('queijo_coalho')!);
    cheese.sides = [0.8, 0.8];
    expect(stageOf(db, cheese)).toBe('golden');
    cheese.sides = [1.1, 1.1];
    expect(stageOf(db, cheese)).toBe('melting');
  });
});

describe('scoring', () => {
  const picanha = () => createFood(1, db.ingredientById.get('picanha')!);
  const ctx = (over: Partial<Parameters<typeof scoreItem>[2]> = {}) => ({
    target: 0.75, toleranceScale: 1, patienceRemaining: 0.8, combo: 0, tipMult: 1, xpMult: 1,
    tuning: rewardTuning(db.economy), ...over
  });

  it('awards perfect inside the window', () => {
    const f = picanha();
    f.sides = [0.75, 0.75];
    const s = scoreItem(db, f, ctx());
    expect(s.quality).toBe('perfect');
    expect(s.coins).toBeGreaterThan(f.ingredient.value);
    expect(s.xp).toBeGreaterThan(f.ingredient.xp);
  });

  it('refuses perfect when the sides are uneven (one side charred, one raw)', () => {
    const f = picanha();
    f.sides = [0.2, 1.1]; // mean 0.65 -> raw-ish, but definitely not uniform
    const s = scoreItem(db, f, ctx());
    expect(s.quality).not.toBe('perfect');
    expect(s.evenness).toBeLessThan(db.ingredients.shared.minEvennessForPerfect + 0.3);
  });

  it('gives "good" just outside the perfect window and less money', () => {
    const [lo, hi] = db.ingredientById.get('picanha')!.perfectWindow;
    const justOutside = hi + db.grill.scoring.goodWindowPadding * 0.5;
    const f = picanha();
    f.sides = [justOutside, justOutside];
    const good = scoreItem(db, f, ctx({ target: (lo + hi) / 2 }));
    expect(good.quality).toBe('good');
    f.sides = [(lo + hi) / 2, (lo + hi) / 2];
    const perfect = scoreItem(db, f, ctx({ target: (lo + hi) / 2 }));
    expect(perfect.quality).toBe('perfect');
    expect(good.coins).toBeLessThan(perfect.coins);
  });

  it('scores raw and overcooked outside the padded window', () => {
    const padding = db.grill.scoring.goodWindowPadding;
    const [lo, hi] = db.ingredientById.get('picanha')!.perfectWindow;
    const f = picanha();
    f.sides = [0.1, 0.1];
    expect(scoreItem(db, f, ctx({ target: (lo + hi) / 2 })).quality).toBe('raw');
    const over = hi + padding * 3;
    f.sides = [over, over];
    expect(scoreItem(db, f, ctx({ target: (lo + hi) / 2 })).quality).toBe('overcooked');
  });

  it('always scores burned food as worthless', () => {
    const f = picanha();
    f.sides = [1.4, 1.4];
    f.burned = true;
    const s = scoreItem(db, f, ctx());
    expect(s.quality).toBe('burned');
    expect(s.coins).toBe(0);
    expect(s.xp).toBe(0);
  });

  it('narrows the perfect window for picky customers (toleranceScale < 1)', () => {
    const [lo, hi] = db.ingredientById.get('picanha')!.perfectWindow;
    const centre = (lo + hi) / 2;
    // Inside the authored window, but outside the narrowed one.
    const probe = hi - 0.005;
    const at = (v: number) => { const f = picanha(); f.sides = [v, v]; return f; };
    const strict = scoreItem(db, at(probe), ctx({ target: centre, toleranceScale: 0.6 }));
    const lenient = scoreItem(db, at(probe), ctx({ target: centre, toleranceScale: 1.6 }));
    expect(strict.quality).not.toBe('perfect');
    expect(lenient.quality).toBe('perfect');
  });

  it('pays more the faster the customer is served', () => {
    const mk = () => { const f = picanha(); f.sides = [0.75, 0.75]; return f; };
    const slow = scoreItem(db, mk(), ctx({ patienceRemaining: 0.05 })).coins;
    const fast = scoreItem(db, mk(), ctx({ patienceRemaining: 0.95 })).coins;
    expect(fast).toBeGreaterThan(slow);
  });

  it('applies the combo multiplier and caps it', () => {
    const mk = () => { const f = picanha(); f.sides = [0.75, 0.75]; return f; };
    const base = scoreItem(db, mk(), ctx({ combo: 0 })).coins;
    const c5 = scoreItem(db, mk(), ctx({ combo: 5 })).coins;
    const cap = scoreItem(db, mk(), ctx({ combo: 999 })).coins;
    expect(c5).toBeGreaterThan(base);
    expect(cap).toBeLessThanOrEqual(Math.ceil(base * db.economy.reward.comboCap) + 1);
  });
});

describe('grill capacity & charcoal', () => {
  it('enforces slots per zone and frees them on removal', () => {
    const g = grill();
    const cap = stats.slotsPerZone;
    for (let i = 0; i < cap; i++) expect(placeOnGrill(g, db, createFood(i, db.ingredientById.get('picanha')!), 1)).toBe(true);
    expect(zoneIsFull(g, 1)).toBe(true);
    expect(placeOnGrill(g, db, createFood(99, db.ingredientById.get('picanha')!), 1)).toBe(false);
    const first = g.zones[1]!.items[0]!;
    removeFromGrill(g, first);
    expect(placeOnGrill(g, db, createFood(100, db.ingredientById.get('picanha')!), 1)).toBe(true);
    expect(grillSlotsFree(g)).toBeGreaterThan(0);
  });

  it('follows the charcoal efficiency curve (ramp up, plateau, decay)', () => {
    const curve = db.grill.charcoal.efficiencyCurve;
    expect(sampleCurve(curve, 0)).toBeLessThan(sampleCurve(curve, 0.3));
    expect(sampleCurve(curve, 0.3)).toBeGreaterThanOrEqual(sampleCurve(curve, 0.55));
    expect(sampleCurve(curve, 1)).toBeLessThan(sampleCurve(curve, 0.3));
  });

  it('decays charcoal over the configured duration', () => {
    const g = grill();
    tickGrill(g, db, stats.charcoalDurationSec * 0.5);
    expect(g.charcoalT).toBeCloseTo(0.5, 5);
    expect(g.charcoalEfficiency).toBeGreaterThan(0.9);
    tickGrill(g, db, stats.charcoalDurationSec * 0.5);
    expect(g.charcoalT).toBeCloseTo(1, 5);
    expect(g.charcoalEfficiency).toBeLessThan(0.8);
  });

  it('refills instantly reset the charcoal clock', () => {
    const sim = new TurnSimulation(db, { restaurantIndex: 0, levelId: 'test', upgradeLevels: {}, seed: 1 }, 1);
    tickGrill(sim.grill, db, sim.stats.charcoalDurationSec * 0.9);
    expect(sim.grill.charcoalT).toBeGreaterThan(0.8);
    expect(sim.refillCharcoal()).toBe(true);
    tickGrill(sim.grill, db, db.grill.charcoal.refillTimeSec + 0.01);
    expect(sim.grill.charcoalT).toBeLessThan(0.05);
  });
});

describe('skill policy sanity', () => {
  it('achieves a high perfect rate at skill 1.0 and a low one at skill 0.2', () => {
    const run = (skill: number) => {
      const sim = new TurnSimulation(db, { restaurantIndex: 1, levelId: 'policy', upgradeLevels: {}, seed: 7 }, 7);
      const rng = new Rng(7);
      const policy = new SkillPolicy(rng, { skill });
      let guard = 0;
      while (!sim.finished && guard++ < 20000) {
        sim.tick(1 / 30, (a) => policy.act(a));
      }
      const r = sim.result();
      return {
        perfect: r.counters.perfectCooks,
        burned: r.counters.burnedFood,
        served: r.counters.customersServed,
        lost: r.counters.customersLost,
        coins: r.coins
      };
    };
    const pro = run(1);
    const rookie = run(0.2);

    expect(pro.perfect).toBeGreaterThan(0);

    // Quality, not throughput, is what separates skill at this level. Since the
    // ideal-zone mechanic actually runs (see policy.test.ts), a clumsy player also
    // keeps up with this customer flow — both sides serve all 13-14 customers — so
    // an assertion on `served` can no longer tell the two apart. The gap that
    // remains is large and stable across seeds: 21-22 perfects for the pro against
    // 4-5 for the rookie, and roughly double the coins.
    expect(pro.perfect).toBeGreaterThan(rookie.perfect * 3);
    expect(pro.coins).toBeGreaterThan(rookie.coins * 1.5);
    expect(pro.lost).toBe(0);
    expect(rookie.lost).toBe(0);
    expect(pro.served).toBe(rookie.served);
  });
});
