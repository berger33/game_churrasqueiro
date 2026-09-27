import { describe, expect, it } from 'vitest';
import { loadDatabase } from '../load-data.ts';
import { TurnSimulation } from '../../sim-core/src/turn.ts';
import { createFood, overallDoneness } from '../../sim-core/src/cooking.ts';
import { SkillPolicy } from '../../sim-core/src/policy.ts';
import { Rng } from '../../sim-core/src/rng.ts';
const db = loadDatabase();
const recipe = db.ingredientById.get('vinagrete')!;
const make = (upgradeLevels: Record<string, number> = {}, restaurantIndex = 0, playerLevel = 12) =>
  new TurnSimulation(db, { playerLevel, restaurantIndex, levelId: 'prep', upgradeLevels, seed: 55,
    overrides: { autoSpawn: false, turnLengthSec: 120 } });
const order = (s: TurnSimulation, ids = ['vinagrete'], patience = 60) => s.spawnScriptedCustomer('comum', ids, patience);

describe('A-03: prep is an explicit, bounded station, not a free stock timer', () => {
  it('does not prepare stock until admitted to the station', () => {
    const s = make(), f = s.takeFromStock(recipe), c = order(s);
    s.tick(3);
    expect(f.prepProgress).toBe(0);
    expect(s.serve(c, f)).toBeNull();
  });
  it('rejects placing, moving or flipping prep through player actions', () => {
    const s = make(), f = s.takeFromStock(recipe);
    expect(s.place(f, 0)).toBe(false);
    expect(s.move(f, 0)).toBe(false);
    expect(s.flip(f)).toBe(false);
    expect(s.grill.zones.flatMap(z => z.items)).toEqual([]);
  });
  it('holds capacity while preparing AND ready, releases only on service/discard', () => {
    const s = make(), a = s.takeFromStock(recipe), b = s.takeFromStock(recipe), c = order(s);
    expect(s.startPrep(a)).toBe(true);
    expect(s.startPrep(a)).toBe(false);
    expect(s.startPrep(b)).toBe(false);
    s.tick(2);
    expect(a.prepProgress).toBe(1); expect(b.prepProgress).toBe(0);
    expect(s.startPrep(b)).toBe(false);
    expect(s.serve(c, a)?.quality).toBe('perfect');
    expect(s.startPrep(b)).toBe(true);
    s.discard(b);
    expect(s.prepSlots.every(f => f === null)).toBe(true);
    s.tick(5); expect(b.prepProgress).toBe(0);
    expect(s.startPrep(b)).toBe(false);
  });
  it.each([0, 1, 6])('uses prepSec / knife multiplier exactly (knife %i)', knife => {
    const s = make({ knife }), f = s.takeFromStock(recipe), c = order(s);
    expect(s.startPrep(f)).toBe(true);
    const duration = recipe.prepSec! / s.stats.prepSpeedMult;
    s.tick(duration / 2); expect(f.prepProgress).toBeCloseTo(0.5);
    expect(s.serve(c, f)).toBeNull();
    s.tick(duration / 2); expect(f.prepProgress).toBe(1);
    expect(overallDoneness(f)).toBe(0.5);
    s.tick(20); expect(f.prepProgress).toBe(1); expect(f.burned).toBe(false);
    expect(f.onGrill).toBe(false); expect(f.timeOnGrill).toBe(0); expect(f.flips).toBe(0);
    expect(s.serve(c, f)?.quality).toBe('perfect');
  });
  it.each([0, 2, 6])('consumes restaurant capacity plus board (restaurant %i)', restaurant => {
    const s = make({ board: 5, counter: 5 }, restaurant); // A-06.2: enough stock to exercise every prep slot
    const capacity = db.restaurants.restaurants[restaurant]!.service.prepSlots + 5;
    expect(s.prepSlots).toHaveLength(capacity);
    for (let i = 0; i < capacity; i++) expect(s.startPrep(s.takeFromStock(recipe), i)).toBe(true);
    expect(s.startPrep(s.takeFromStock(recipe))).toBe(false);
    s.tick(1); expect(s.prepSlots.every(f => f?.prepProgress === 0.5)).toBe(true);
  });
  it('rejects foreign, grilled, invalid-slot and duplicate admissions without effects', () => {
    const s = make(), f = s.takeFromStock(recipe), g = s.takeFromStock(db.ingredientById.get('linguica_toscana')!);
    for (const slot of [-1, 1, 0.5, NaN]) expect(s.startPrep(f, slot)).toBe(false);
    expect(s.startPrep(createFood(999, recipe))).toBe(false);
    expect(s.startPrep(g)).toBe(false);
    expect(s.startPrep(f, 0)).toBe(true);
    expect(s.startPrep(f, 0)).toBe(false);
    expect(s.place(f, 0)).toBe(false);
    expect(s.prepSlots[0]).toBe(f);
  });
  it.each([11, 12, 13])('preserves level gating at player %i', level => {
    const s = make({}, 0, level);
    if (level < 12) { expect(() => s.takeFromStock(recipe)).toThrow(/locked/); return; }
    expect(s.startPrep(s.takeFromStock(recipe))).toBe(true);
  });
  it('completes mixed orders only after both lines, counts rewards once, keeps result pure', () => {
    const s = make(), c = order(s, ['vinagrete', 'linguica_toscana']);
    const prep = s.takeFromStock(recipe), grill = s.takeFromStock(db.ingredientById.get('linguica_toscana')!);
    s.startPrep(prep); s.place(grill, 0);
    s.tick(2);
    const p = s.serve(c, prep)!;
    expect(p.quality).toBe('perfect'); expect(c.state).toBe('waiting');
    expect(c.patienceLeft).toBe(58); expect(s.combo).toBe(1);
    expect(s.counters.customersServed).toBe(0);
    expect(s.serve(c, prep)).toBeNull();
    for (let i = 0; i < 3000 && overallDoneness(grill) < 0.78; i++) {
      s.tick(0.01);
      if (grill.flips === 0 && grill.sides[0]! >= 0.78) s.flip(grill);
    }
    const g = s.serve(c, grill)!;
    expect(g.quality).toBe('perfect'); expect(c.state).toBe('served');
    expect(s.combo).toBe(2); expect(s.counters.ordersCompleted).toBe(1);
    expect(s.counters.itemsCooked).toBe(2); expect(s.counters.burnedFood).toBe(0);
    expect(s.coins).toBe(p.coins + g.coins); expect(s.xp).toBe(p.xp + g.xp);
    const result = s.result(); expect(s.serve(c, grill)).toBeNull(); expect(s.result()).toEqual(result);
  });
  it('keeps failed drops and departed customers from consuming a prepared plate', () => {
    const s = make(), f = s.takeFromStock(recipe), left = order(s, ['vinagrete'], 1);
    const wrong = order(s, ['linguica_toscana']);
    s.startPrep(f); s.tick(2);
    expect(left.state).toBe('left'); expect(s.serve(left, f)).toBeNull();
    expect(s.serve(wrong, f)).toBeNull(); expect(s.prepSlots[0]).toBe(f);
    const c = order(s);
    s.serveDelayed(c, f, 0.1); s.serveDelayed(c, f, 0.1); s.tick(0.1);
    expect(s.counters.itemsCooked).toBe(1); expect(s.counters.customersLost).toBe(1);
    expect(s.prepSlots[0]).toBeNull();
  });
  it('bot uses the station and serves two waiting prep orders without stock leakage', () => {
    const s = make(), bot = new SkillPolicy(new Rng(10), { skill: 0.8 });
    order(s); order(s);
    let peak = 0;
    for (let i = 0; i < 100; i++) { s.tick(0.1, a => bot.act(a)); peak = Math.max(peak, s.foods.filter(f => !f.served).length); }
    expect(s.counters.customersServed).toBe(2); expect(peak).toBe(1);
    expect(s.prepSlots.every(f => f === null)).toBe(true);
  });
});
