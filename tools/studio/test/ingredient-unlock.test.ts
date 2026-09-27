import { describe, expect, it } from 'vitest';
import { loadDatabase } from '../load-data.ts';
import { TurnSimulation, type TurnConfig } from '../../sim-core/src/turn.ts';
import { SkillPolicy } from '../../sim-core/src/policy.ts';
import { Rng } from '../../sim-core/src/rng.ts';

const db = loadDatabase();
const config = (restaurantIndex: number, playerLevel: number) => ({
  restaurantIndex, playerLevel, levelId: 'unlock-boundary', seed: 4242, upgradeLevels: {},
  overrides: { autoSpawn: false }
});
const make = (restaurantIndex: number, playerLevel: number) => new TurnSimulation(db, config(restaurantIndex, playerLevel));
const orders = (sim: TurnSimulation, n = 200) => {
  const ids = new Set<string>();
  for (let i = 0; i < n; i++) {
    const c = sim.spawnCustomer('comum');
    expect(c.lines.length).toBeGreaterThan(0);
    for (const l of c.lines) ids.add(l.ingredientId);
  }
  return ids;
};

describe('A-02: ingredient unlock requires player level AND restaurant', () => {
  it('starts with only linguiça in natural orders and the stock list', () => {
    const sim = make(0, 1);
    const ids = new Set<string>();
    for (let i = 0; i < 200; i++) for (const l of sim.spawnCustomer().lines) ids.add(l.ingredientId);
    expect([...ids]).toEqual(['linguica_toscana']);
    expect(sim.bench.map(i => i.id)).toEqual(['linguica_toscana']);
  });
  for (const ing of db.ingredients.items) {
    const { restaurantIndex, level } = ing.unlock;
    if (level > 1) it(`${ing.id} is absent immediately before level ${level}, even in restaurant 6`, () => {
      const sim = make(6, level - 1);
      expect(orders(sim).has(ing.id)).toBe(false);
      expect(() => sim.takeFromStock(ing)).toThrow(/locked/);
      expect(() => sim.spawnScriptedCustomer('comum', [ing.id], 40)).toThrow(/locked/);
      expect(sim.foods).toHaveLength(0);
    });
    it(`${ing.id} is available at and after its exact level and restaurant`, () => {
      for (const playerLevel of [level, level + 1]) {
        const sim = make(restaurantIndex, playerLevel);
        expect(orders(sim).has(ing.id)).toBe(true);
        expect(sim.bench.map(i => i.id)).toContain(ing.id);
        expect(sim.takeFromStock(ing).ingredient.id).toBe(ing.id);
        expect(sim.spawnScriptedCustomer('comum', [ing.id], 40).lines[0]!.ingredientId).toBe(ing.id);
      }
    });
    if (restaurantIndex > 0) it(`${ing.id} still requires restaurant ${restaurantIndex} at level 80`, () => {
      const sim = make(restaurantIndex - 1, 80);
      expect(orders(sim).has(ing.id)).toBe(false);
      expect(() => sim.takeFromStock(ing)).toThrow(/locked/);
    });
  }
  it('does not confuse a campaign level index/id with player progression', () => {
    const sim = new TurnSimulation(db, { ...config(0, 1), levelId: 'level_060' });
    expect([...orders(sim)]).toEqual(['linguica_toscana']);
  });
  it('snapshots progression at turn start, then unlocks on the next turn', () => {
    const cfg = config(0, 5);
    const sim = new TurnSimulation(db, cfg);
    cfg.playerLevel = 6;
    expect(orders(sim).has('queijo_coalho')).toBe(false);
    expect(orders(new TurnSimulation(db, cfg)).has('queijo_coalho')).toBe(true);
  });
  for (const playerLevel of [0, -1, 1.5, NaN, Infinity]) it(`rejects invalid player level ${playerLevel}`, () => {
    expect(() => make(0, playerLevel)).toThrow(/playerLevel/);
  });
  it('rejects missing playerLevel rather than silently enabling all recipes', () => {
    const { playerLevel: _, ...missing } = config(0, 1);
    expect(() => new TurnSimulation(db, missing as TurnConfig)).toThrow(/playerLevel/);
  });
  it('rejects a configuration with no unlocked recipe instead of admitting an empty order', () => {
    const broken = structuredClone(db);
    for (const ing of broken.ingredients.items) ing.unlock.level = 2;
    expect(() => new TurnSimulation(broken, config(0, 1))).toThrow(/no unlocked ingredients/);
  });
  it('never spawns an unusual-only customer with an empty/locked menu', () => {
    const sim = make(2, 1);
    const seen = new Set<string>();
    for (let i = 0; i < 300; i++) {
      const c = sim.spawnCustomer(); seen.add(c.def.id);
      expect(c.lines.length).toBeGreaterThan(0);
      for (const l of c.lines) expect(db.ingredientById.get(l.ingredientId)!.unlock.level).toBeLessThanOrEqual(1);
    }
    expect(seen.has('turista')).toBe(false); // no non-common recipe yet
    expect(() => sim.spawnCustomer('turista')).toThrow(/no unlocked ingredients/);
    expect(orders(make(2, 6)).has('queijo_coalho')).toBe(true);
    const eligible = make(2, 6).spawnCustomer('turista');
    expect(eligible.lines.length).toBeGreaterThan(0);
    expect(eligible.lines.every(l => db.ingredientById.get(l.ingredientId)!.rarity !== 'common')).toBe(true);
  });
  it('the real policy only takes and serves unlocked stock at a low player level', () => {
    const sim = new TurnSimulation(db, { ...config(0, 1), overrides: { turnLengthSec: 90 } });
    const policy = new SkillPolicy(new Rng(991), { skill: 0.85 });
    const seen = new Set<string>();
    while (!sim.finished) sim.tick(1 / 20, a => {
      policy.act(a);
      for (const f of a.foods) seen.add(f.ingredient.id);
    });
    expect([...seen]).toEqual(['linguica_toscana']);
    expect(sim.counters.customersServed).toBeGreaterThan(0);
  });
});
