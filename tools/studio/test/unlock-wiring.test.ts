import { describe, expect, it } from 'vitest';
import { loadDatabase } from '../load-data.ts';
import { simulateProgression, measureSkillCurve } from '../run-sim.ts';
import { generateLevels } from '../gen-levels.ts';
import { levelForXp } from '../../sim-core/src/data.ts';
import { TurnSimulation } from '../../sim-core/src/turn.ts';
import { SkillPolicy } from '../../sim-core/src/policy.ts';
import { Rng } from '../../sim-core/src/rng.ts';
const db = loadDatabase();
const xp = db.economy.xp;
const levelAt = (total: number) => levelForXp(total, xp.formula.a, xp.formula.exponent, xp.formula.minPerLevel, xp.maxLevel);

describe('A-02: real simulation callers pass player progression, not campaign indices', () => {
  it('progression uses pre-payout XP and keeps every order inside the same eligible catalog', () => {
    const report = simulateProgression({ maxTurns: 60, stepSec: 1 / 12 });
    let totalXp = 0;
    for (const turn of report.outcomes) {
      expect(turn.playerLevel).toBe(levelAt(totalXp));
      const expected = db.ingredients.items.filter(i => i.unlock.level <= turn.playerLevel && i.unlock.restaurantIndex <= turn.restaurantIndex).map(i => i.id);
      expect(turn.ingredientIds).toEqual(expected);
      expect(turn.orderedIngredientIds.length).toBeGreaterThan(0);
      for (const id of turn.orderedIngredientIds) expect(expected).toContain(id);
      totalXp += turn.xp;
    }
    expect(report.outcomes[0]!.ingredientIds).toEqual(['linguica_toscana']);
    expect(report.outcomes.at(-1)!.playerLevel).toBeGreaterThanOrEqual(8);
    expect(report.outcomes.some(t => t.playerLevel !== t.level.index)).toBe(true);
    expect(report.player.level).toBe(levelAt(totalXp));
  });

  it('fixed-skill benchmark unlocks through earned XP, without an all-recipes fallback', () => {
    const levels = generateLevels([[0, 12]]).levels;
    const skill = 0.55, seed = 4242;
    let totalXp = 0, coins = 0, perfect = 0, good = 0, burned = 0, lost = 0, spawned = 0;
    for (const level of levels) {
      const sim = new TurnSimulation(db, {
        playerLevel: levelAt(totalXp), restaurantIndex: level.restaurantIndex, levelId: level.id,
        seed: seed + level.index, upgradeLevels: {},
        overrides: {
          turnLengthSec: level.turnLengthSec, spawnIntervalSec: level.spawnIntervalSec,
          patienceScalar: level.patienceScalar, difficultyScalar: level.difficultyScalar,
          maxOrdersOnScreen: level.maxOrdersOnScreen
        }
      });
      const policy = new SkillPolicy(new Rng(seed + level.index * 104729), { skill });
      while (!sim.finished) sim.tick(1 / 20, a => policy.act(a));
      const r = sim.result(); totalXp += r.xp; coins += r.coins;
      perfect += r.counters.perfectCooks; good += r.counters.goodCooks; burned += r.counters.burnedFood;
      lost += r.counters.customersLost; spawned += r.counters.customersSpawned;
    }
    expect(levelAt(totalXp)).toBeGreaterThan(1);
    expect(measureSkillCurve({ levels, skills: [skill], seed })['0.55']).toEqual({
      perfect: perfect / Math.max(1, perfect + good + burned), good: good / Math.max(1, perfect + good + burned),
      burned: burned / Math.max(1, perfect + good + burned), lost: lost / Math.max(1, spawned),
      coinsPerTurn: Math.round(coins / levels.length)
    });
  });
});
