/**
 * Golden-vector replay.
 *
 * tools/golden/vectors.json is the contract between the TypeScript reference
 * implementation and the C# port. This test replays every vector against the TS
 * side, which proves two things:
 *
 *   1. the file is current — it was generated from the code that is shipping, not
 *      from some older revision;
 *   2. the vectors are *live*: they actually constrain behaviour. A vector file
 *      nothing reads is decoration.
 *
 * The C# runner reads the same file and must produce the same numbers. When the
 * port exists, running both against this file is the parity gate.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { loadAndValidate } from '../load-data.ts';
import { generateLevels } from '../gen-levels.ts';
import {
  createFood, createGrill, deriveStats, placeOnGrill, tickGrill, flipFood,
  overallDoneness, evenness, stageOf, scoreItem, effectiveHeat, rewardTuning
} from '../../sim-core/src/cooking.ts';
import { xpForLevel, levelForXp, upgradeCost } from '../../sim-core/src/data.ts';
import { levelUpCoinReward, computeOfflineEarnings, newPlayerState } from '../../sim-core/src/economy.ts';
import { TurnSimulation } from '../../sim-core/src/turn.ts';
import { SkillPolicy } from '../../sim-core/src/policy.ts';
import { Rng } from '../../sim-core/src/rng.ts';

const ROOT = join(import.meta.dirname, '..', '..', '..');
const VECTORS_PATH = join(ROOT, 'tools', 'golden', 'vectors.json');

const hasVectors = existsSync(VECTORS_PATH);
const doc = hasVectors
  ? JSON.parse(readFileSync(VECTORS_PATH, 'utf8'))
  : null;

describe.skipIf(!hasVectors)('golden vectors', () => {
  const { db, problems } = loadAndValidate();
  expect(problems).toEqual([]);

  const EPS = doc.epsilon as number;
  const near = (a: number, b: number): boolean => Math.abs(a - b) <= EPS * Math.max(1, Math.abs(b));

  const RESTAURANT = db.restaurantByIndex.get(1)!;
  const STATS = deriveStats(db, RESTAURANT, {});
  const TUNING = rewardTuning(db.economy);

  it('declares the data versions it was generated from', () => {
    expect(doc.dataVersions).toMatchObject({
      ingredients: db.ingredients.version,
      grill: db.grill.version,
      economy: db.economy.version,
      restaurants: db.restaurants.version,
      upgrades: db.upgrades.version
    });
  });

  it('counts match the file contents', () => {
    expect(doc.cooking).toHaveLength(doc.counts.cooking);
    expect(doc.scoring).toHaveLength(doc.counts.scoring);
    expect(doc.economy).toHaveLength(doc.counts.economy);
    expect(doc.turns).toHaveLength(doc.counts.turns);
  });

  it('replays every cooking vector', () => {
    for (const v of doc.cooking) {
      const ing = db.ingredientById.get(v.input.ingredient)!;
      const grill = createGrill(STATS, db);
      const food = createFood(1, ing);
      placeOnGrill(grill, db, food, v.input.zoneIndex);

      let ticksRun = 0;
      for (const sample of v.expect.trace) {
        // The vector states the exact tick count, so neither side re-derives it
        // from a floating-point accumulation loop.
        expect(sample.ticks, `${v.id} tick count must advance`).toBeGreaterThan(ticksRun);
        while (ticksRun < sample.ticks) {
          tickGrill(grill, db, v.input.stepSec);
          ticksRun++;
        }
        const ctx = `${v.id} @tick=${sample.ticks} (t=${sample.tSec}s)`;
        expect(overallDoneness(food), `${ctx} overall`).toBeCloseTo(sample.overall, 8);
        expect(evenness(food), `${ctx} evenness`).toBeCloseTo(sample.evenness, 8);
        expect(food.burned, `${ctx} burned`).toBe(sample.burned);
        for (let s = 0; s < sample.sides.length; s++) {
          expect(near(food.sides[s]!, sample.sides[s]!), `${ctx} side ${s}`).toBe(true);
        }
      }
    }
  });

  it('replays every scoring and flip vector', () => {
    for (const v of doc.scoring) {
      if (v.id.startsWith('score.')) {
        const ing = db.ingredientById.get(v.input.ingredient)!;
        for (const row of v.expect.rows) {
          const f = createFood(1, ing);
          for (let i = 0; i < f.sides.length; i++) f.sides[i] = row.overall;
          f.burned = f.sides.some((s) => s >= db.ingredients.shared.burnedThreshold);
          const scored = scoreItem(db, f, {
            target: v.input.target,
            toleranceScale: 1,
            patienceRemaining: 0.5,
            combo: 0,
            tipMult: 1,
            xpMult: 1,
            customerTipMult: 1,
            eventValueMult: 1,
            tuning: TUNING
          });
          const ctx = `${v.id} d=${row.overall}`;
          expect(scored.quality, `${ctx} quality`).toBe(row.quality);
          expect(scored.coins, `${ctx} coins`).toBe(row.coins);
          expect(String(stageOf(db, f)), `${ctx} stage`).toBe(row.stage);
        }
      } else if (v.id.startsWith('flip.')) {
        const ing = db.ingredientById.get(v.input.ingredient)!;
        const grill = createGrill(STATS, db);
        const food = createFood(7, ing);
        placeOnGrill(grill, db, food, 1);
        for (let i = 0; i < 40; i++) tickGrill(grill, db, 1 / 12);
        const flipped = flipFood(grill, food, v.input.flipAtSec, db);
        expect(flipped, `${v.id} flipped`).toBe(v.expect.flipped);
        expect(food.downSide, `${v.id} downSide`).toBe(v.expect.sideDownAfter);
      }
    }
  });

  it('replays every economy vector', () => {
    for (const v of doc.economy) {
      if (v.id === 'econ.xpForLevel') {
        const f = v.input.formula;
        v.expect.values.forEach((expected: number, i: number) => {
          expect(xpForLevel(i + 1, f.a, f.exponent, f.minPerLevel), `xpForLevel(${i + 1})`).toBe(expected);
        });
      } else if (v.id === 'econ.levelForXp') {
        const f = v.input.formula;
        v.expect.levels.forEach((expected: number, i: number) => {
          expect(
            levelForXp(v.input.xp[i], f.a, f.exponent, f.minPerLevel, v.input.maxLevel),
            `levelForXp(${v.input.xp[i]})`
          ).toBe(expected);
        });
      } else if (v.id === 'econ.upgradeCost') {
        for (const row of v.expect.rows) {
          const track = db.upgradeById.get(row.track)!;
          expect(upgradeCost(track.baseCost, track.growth, row.level), `cost ${row.track}@${row.level}`).toBe(row.cost);
        }
      } else if (v.id === 'econ.levelUpReward') {
        v.expect.coins.forEach((expected: number, i: number) => {
          expect(levelUpCoinReward(db.economy.reward.levelUpCoins, i + 1), `levelUp ${i + 1}`).toBe(expected);
        });
      } else if (v.id === 'econ.offline') {
        for (const row of v.expect.rows) {
          const p = newPlayerState();
          p.restaurantIndex = row.restaurantIndex;
          const o = computeOfflineEarnings(db, p, row.elapsedSec, 1_000_000);
          expect(o.coins, `offline ${row.restaurantIndex}/${row.elapsedSec}s`).toBeCloseTo(row.coins, 6);
          expect(o.capped, `offline capped ${row.elapsedSec}s`).toBe(row.capped);
        }
      } else if (v.id === 'econ.effectiveHeat') {
        v.expect.byZone.forEach((row: number[], zi: number) => {
          row.forEach((expected, i) => {
            const g = createGrill(STATS, db);
            g.charcoalT = v.input.charcoalT[i];
            g.charcoalEfficiency = charcoalEff(g.charcoalT);
            expect(effectiveHeat(g, zi, db), `heat zone${zi} t=${g.charcoalT}`).toBeCloseTo(expected, 8);
          });
        });
      }
    }
  });

  function charcoalEff(t: number): number {
    const curve = db.grill.charcoal.efficiencyCurve;
    if (t <= curve[0]!.t) return curve[0]!.value;
    const last = curve[curve.length - 1]!;
    if (t >= last.t) return last.value;
    for (let i = 0; i < curve.length - 1; i++) {
      const a = curve[i]!, b = curve[i + 1]!;
      if (t >= a.t && t <= b.t) {
        const span = b.t - a.t;
        return a.value + (b.value - a.value) * (span <= 0 ? 0 : (t - a.t) / span);
      }
    }
    return last.value;
  }

  it('replays every full-turn vector', () => {
    const authored = generateLevels([[0, 24], [1, 36]]).levels;
    for (const v of doc.turns) {
      const lvl = authored.find((l) => l.id === v.input.levelId)!;
      const seed = v.input.seed;
      const sim = new TurnSimulation(
        db,
        {
          restaurantIndex: lvl.restaurantIndex,
          levelId: lvl.id,
          upgradeLevels: {},
          seed,
          overrides: v.input.overrides
        },
        seed
      );
      const policy = new SkillPolicy(new Rng(seed + lvl.index * 104729), { skill: v.input.skill });
      let guard = 0;
      while (!sim.finished && guard++ < 40000) sim.tick(v.input.stepSec, (a) => policy.act(a));
      const res = sim.result();

      expect(res.coins, `${v.id} coins`).toBe(v.expect.coins);
      expect(res.xp, `${v.id} xp`).toBe(v.expect.xp);
      expect(res.stars, `${v.id} stars`).toBe(v.expect.stars);
      expect(res.failed, `${v.id} failed`).toBe(v.expect.failed);
      expect(res.counters, `${v.id} counters`).toEqual(v.expect.counters);
    }
  });
});

describe('vector generator', () => {
  it('has produced a vectors file (run `npm run gen-vectors` if this fails)', () => {
    expect(hasVectors, 'tools/golden/vectors.json is missing').toBe(true);
  });
});
