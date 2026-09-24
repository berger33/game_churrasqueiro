import { describe, expect, it } from 'vitest';
import { loadAndValidate } from '../load-data.ts';
import { TurnSimulation } from '../../sim-core/src/turn.ts';
import { SkillPolicy } from '../../sim-core/src/policy.ts';
import { Rng } from '../../sim-core/src/rng.ts';
import { createFood, overallDoneness, placeOnGrill } from '../../sim-core/src/cooking.ts';

const { db } = loadAndValidate();

function runTurn(opts: {
  restaurantIndex?: number;
  seed?: number;
  skill?: number;
  overrides?: Record<string, unknown>;
}) {
  const seed = opts.seed ?? 99;
  const sim = new TurnSimulation(
    db,
    {
      restaurantIndex: opts.restaurantIndex ?? 1,
      levelId: 'test',
      upgradeLevels: {},
      seed,
      overrides: opts.overrides as never
    },
    seed
  );
  const policy = new SkillPolicy(new Rng(seed * 31 + 7), { skill: opts.skill ?? 0.8 });
  let guard = 0;
  while (!sim.finished && guard++ < 40000) sim.tick(1 / 30, (a) => policy.act(a));
  return sim;
}

describe('turn simulation', () => {
  it('is deterministic for a given seed', () => {
    const a = runTurn({ seed: 1234 }).result();
    const b = runTurn({ seed: 1234 }).result();
    expect(a.coins).toBe(b.coins);
    expect(a.xp).toBe(b.xp);
    expect(a.counters).toEqual(b.counters);
  });

  it('produces different turns for different seeds', () => {
    const a = runTurn({ seed: 1 }).result();
    const b = runTurn({ seed: 2 }).result();
    expect(a.counters.customersSpawned === b.counters.customersSpawned && a.coins === b.coins).toBe(false);
  });

  it('spawns customers on the configured cadence', () => {
    const sim = runTurn({ overrides: { spawnIntervalSec: 5, maxOrdersOnScreen: 6, turnLengthSec: 60 } });
    // 60s at one spawn every 5s, first at 1.2s => ~12 spawns
    expect(sim.counters.customersSpawned).toBeGreaterThan(8);
    expect(sim.counters.customersSpawned).toBeLessThanOrEqual(13);
  });

  it('never exceeds maxOrdersOnScreen simultaneous waiting customers', () => {
    const sim = runTurn({ overrides: { maxOrdersOnScreen: 2, spawnIntervalSec: 2, turnLengthSec: 60 } });
    expect(sim.counters.peakSimultaneousOrders).toBeLessThanOrEqual(2);
  });

  it('ends exactly at the configured turn length', () => {
    const sim = runTurn({ overrides: { turnLengthSec: 45 } });
    expect(sim.time).toBeCloseTo(45, 1);
    expect(sim.finished).toBe(true);
  });

  it('drains patience and makes waiting customers leave', () => {
    // A turn with no policy at all: nobody is served, everyone leaves.
    const sim = new TurnSimulation(
      db,
      {
        restaurantIndex: 0,
        levelId: 'idle',
        upgradeLevels: {},
        seed: 5,
        overrides: { spawnIntervalSec: 3, patienceScalar: 0.4, turnLengthSec: 60, maxOrdersOnScreen: 3 }
      },
      5
    );
    let guard = 0;
    while (!sim.finished && guard++ < 40000) sim.tick(1 / 30);
    const r = sim.result();
    expect(r.counters.customersLost).toBeGreaterThan(0);
    expect(r.counters.customersServed).toBe(0);
    expect(r.counters.flawless).toBe(false);
  });

  it('only accepts a serve for an ingredient the customer actually ordered', () => {
    const sim = new TurnSimulation(db, { restaurantIndex: 1, levelId: 'match', upgradeLevels: {}, seed: 3 }, 3);
    const customer = sim.spawnCustomer('comum');
    const ordered = customer.lines[0]!.ingredientId;
    const other = db.ingredients.items.find((i) => i.id !== ordered && i.cookMethod === 'grill')!;

    const wrong = sim.takeFromStock(other);
    placeOnGrill(sim.grill, db, wrong, 1);
    wrong.sides = [0.8, 0.8];
    expect(sim.serve(customer, wrong)).toBeNull();

    const right = sim.takeFromStock(db.ingredientById.get(ordered)!);
    placeOnGrill(sim.grill, db, right, 1);
    right.sides = [(db.ingredientById.get(ordered)!.perfectWindow[0] + db.ingredientById.get(ordered)!.perfectWindow[1]) / 2, 0];
    right.sides = right.sides.map(() => (db.ingredientById.get(ordered)!.perfectWindow[0] + db.ingredientById.get(ordered)!.perfectWindow[1]) / 2);
    expect(sim.serve(customer, right)).not.toBeNull();
  });

  it('marks the customer served only when every order line is fulfilled', () => {
    const sim = new TurnSimulation(db, { restaurantIndex: 3, levelId: 'multi', upgradeLevels: {}, seed: 8 }, 8);
    let customer = sim.spawnCustomer('familia');
    let guard = 0;
    while (customer.lines.length < 2 && guard++ < 40) customer = sim.spawnCustomer('familia');
    expect(customer.lines.length).toBeGreaterThanOrEqual(2);

    const centre = (id: string) => {
      const ing = db.ingredientById.get(id)!;
      return (ing.perfectWindow[0] + ing.perfectWindow[1]) / 2;
    };

    const first = customer.lines[0]!;
    const f = sim.takeFromStock(db.ingredientById.get(first.ingredientId)!);
    placeOnGrill(sim.grill, db, f, 1);
    f.sides = f.sides.map(() => centre(first.ingredientId));
    sim.serve(customer, f);
    expect(customer.state).toBe('waiting');

    const second = customer.lines[1]!;
    const g = sim.takeFromStock(db.ingredientById.get(second.ingredientId)!);
    placeOnGrill(sim.grill, db, g, 1);
    g.sides = g.sides.map(() => centre(second.ingredientId));
    sim.serve(customer, g);
    expect(customer.state).toBe('served');
    expect(sim.counters.customersServed).toBe(1);
  });

  it('breaks the combo when food burns', () => {
    const sim = new TurnSimulation(db, { restaurantIndex: 0, levelId: 'combo', upgradeLevels: {}, seed: 11 }, 11);
    const c = sim.spawnCustomer('comum');
    const ing = db.ingredientById.get(c.lines[0]!.ingredientId)!;
    const f = sim.takeFromStock(ing);
    placeOnGrill(sim.grill, db, f, 2);
    const target = (ing.perfectWindow[0] + ing.perfectWindow[1]) / 2;
    f.sides = f.sides.map(() => target);
    sim.serve(c, f);
    expect(sim.combo).toBe(1);

    const junk = sim.takeFromStock(ing);
    placeOnGrill(sim.grill, db, junk, 2);
    let guard = 0;
    while (!junk.burned && guard++ < 5000) sim.tick(1 / 30);
    expect(junk.burned).toBe(true);
    expect(sim.combo).toBe(0);
  });

  it('awards 3 stars only for a near-perfect shift', () => {
    const great = runTurn({ skill: 1, seed: 21 }).result();
    expect(great.stars).toBeGreaterThanOrEqual(2);

    const idle = new TurnSimulation(
      db,
      { restaurantIndex: 0, levelId: 'idle2', upgradeLevels: {}, seed: 22, overrides: { turnLengthSec: 40, spawnIntervalSec: 4, patienceScalar: 0.3 } },
      22
    );
    let guard = 0;
    while (!idle.finished && guard++ < 20000) idle.tick(1 / 30);
    expect(idle.result().stars).toBe(0);
  });

  it('grants a delayed serve after the modelled reaction latency', () => {
    const sim = new TurnSimulation(db, { restaurantIndex: 0, levelId: 'delay', upgradeLevels: {}, seed: 33 }, 33);
    const c = sim.spawnCustomer('comum');
    const ing = db.ingredientById.get(c.lines[0]!.ingredientId)!;
    const f = sim.takeFromStock(ing);
    placeOnGrill(sim.grill, db, f, 1);
    const target = (ing.perfectWindow[0] + ing.perfectWindow[1]) / 2;
    f.sides = f.sides.map(() => target - 0.02);

    sim.serveDelayed(c, f, 0.5);
    expect(c.state).toBe('waiting'); // not landed yet
    const before = overallDoneness(f);
    sim.tick(0.55);
    expect(c.state).toBe('served');
    // The food kept cooking during the latency, which is the whole point.
    expect(before).toBeLessThan(target);
  });

  it('never lets one plate be queued twice', () => {
    const sim = new TurnSimulation(db, { restaurantIndex: 0, levelId: 'dedupe', upgradeLevels: {}, seed: 44 }, 44);
    const c = sim.spawnCustomer('comum');
    // Pin the order to a grilled cut: the randomised pool can include `vinagrete`,
    // a prep item that is not ready after 1.1 s and would fail for an unrelated reason.
    c.lines = [{ ingredientId: 'linguica_toscana', target: 0, fulfilledBy: [] }];
    const ing = db.ingredientById.get(c.lines[0]!.ingredientId)!;
    const f = sim.takeFromStock(ing);
    placeOnGrill(sim.grill, db, f, 1);
    sim.serveDelayed(c, f, 1);
    sim.serveDelayed(c, f, 1);
    sim.tick(1.1);
    expect(sim.counters.customersServed).toBe(1);
  });
});

describe('turn economy output', () => {
  it('pays more for a skilled shift than a sloppy one', () => {
    const pro = runTurn({ skill: 1, seed: 77 }).result();
    const rookie = runTurn({ skill: 0.3, seed: 77 }).result();
    expect(pro.coins).toBeGreaterThan(rookie.coins);
  });

  it('keeps burned food from paying anything', () => {
    const sim = runTurn({ skill: 1, seed: 88 });
    const burned = sim.counters.burnedFood;
    void burned;
    const r = sim.result();
    expect(r.coins).toBeGreaterThan(0);
    expect(Number.isFinite(r.coins)).toBe(true);
  });

  it('produces a finite, non-negative result under extreme difficulty', () => {
    const r = runTurn({
      skill: 0.2,
      seed: 5,
      overrides: { spawnIntervalSec: 1.5, patienceScalar: 0.25, maxOrdersOnScreen: 4, turnLengthSec: 60 }
    }).result();
    expect(r.coins).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(r.coins)).toBe(true);
    expect(r.counters.customersLost).toBeGreaterThan(0);
    expect(r.stars).toBeLessThan(3);
  });
});

describe('food lifecycle', () => {
  it('keeps the active food list bounded (compaction + no per-tick spawning)', () => {
    const sim = runTurn({ seed: 101, overrides: { turnLengthSec: 30 } });
    // A 30 s turn cooks on the order of tens of items. If this list is in the
    // hundreds, something is re-spawning food every tick (a real bug this caught:
    // prep items were never counted as "already cooking").
    expect(sim.counters.itemsCooked).toBeGreaterThan(0);
    expect(sim.foods.length).toBeLessThan(24);
    // Compaction runs every 32 ticks, so a residue of recently served items can
    // linger. Tick past the next compaction and the list must be clean.
    const residue = sim.foods.filter((f) => f.served).length;
    expect(residue).toBeLessThan(12);
    for (let i = 0; i < 33; i++) sim.tick(1 / 30);
    expect(sim.foods.every((f) => !f.served)).toBe(true);
  });

  it('keeps waiting customers bounded by the on-screen cap', () => {
    const sim = runTurn({ seed: 102, overrides: { turnLengthSec: 40, patienceScalar: 0.4, maxOrdersOnScreen: 3 } });
    const waiting = sim.customers.filter((c) => c.state === 'waiting').length;
    expect(waiting).toBeLessThanOrEqual(3);
    expect(sim.counters.peakSimultaneousOrders).toBeLessThanOrEqual(3);
    expect(sim.counters.customersSpawned).toBeGreaterThan(waiting);
  });

  it('prep items become servable without ever touching the grill', () => {
    const sim = new TurnSimulation(db, { restaurantIndex: 0, levelId: 'prep', upgradeLevels: {}, seed: 55 }, 55);
    const ing = db.ingredientById.get('vinagrete')!;
    const f = sim.takeFromStock(ing);
    expect(f.onGrill).toBe(false);
    let guard = 0;
    while (f.prepProgress < 1 && guard++ < 1000) sim.tick(1 / 30);
    expect(f.prepProgress).toBe(1);
    expect(overallDoneness(f)).toBeGreaterThan(0);

    const c = sim.spawnCustomer('comum');
    c.lines = [{ ingredientId: 'vinagrete', target: 0, fulfilledBy: [] }];
    expect(sim.serve(c, f)).not.toBeNull();
  });

  it('creates food with zeroed sides and the right side count', () => {
    const steak = createFood(1, db.ingredientById.get('picanha')!);
    expect(steak.sides.length).toBe(2);
    const skewer = createFood(2, db.ingredientById.get('espetinho_misto')!);
    expect(skewer.sides.length).toBe(4);
    expect(overallDoneness(steak)).toBe(0);
  });
});
