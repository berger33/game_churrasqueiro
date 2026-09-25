/**
 * gen-vectors — golden vectors for cross-language parity (`npm run gen-vectors`).
 *
 * The rules exist twice by necessity: the TypeScript reference implementation
 * (tested, and what drives the simulator) and the C# port the Unity client ships.
 * Nothing but identical output proves they agree, so this script freezes a
 * deterministic set of input → output pairs.
 *
 *   npm run gen-vectors          writes tools/golden/vectors.json and
 *                                tools/golden/tutorial-vectors.json (the FTUE)
 *   npm run check-vectors        fails if either file would change (CI gate)
 *
 * The C# runner replays every case from the same file and must match to 1e-9.
 * If a formula changes in one language only, this file changes and CI fails.
 *
 * Determinism rules: fixed seeds, no wall-clock time, no Map/Set iteration in
 * output, every number rounded to 9 dp.
 */
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { loadAndValidate, readJson } from './load-data.ts';
import { generateLevels } from './gen-levels.ts';
import {
  createFood, createGrill, deriveStats, placeOnGrill, tickGrill, flipFood,
  overallDoneness, evenness, stageOf, scoreItem, effectiveHeat, rewardTuning
} from '../sim-core/src/cooking.ts';
import { TurnSimulation } from '../sim-core/src/turn.ts';
import { SkillPolicy } from '../sim-core/src/policy.ts';
import { Rng } from '../sim-core/src/rng.ts';
import { xpForLevel, levelForXp, upgradeCost } from '../sim-core/src/data.ts';
import { levelUpCoinReward, computeOfflineEarnings, newPlayerState } from '../sim-core/src/economy.ts';
import { checkAnalyticsEvent, type AnalyticsEvent, type AnalyticsTaxonomy, type AnalyticsValue } from '../sim-core/src/analytics.ts';
import {
  TutorialDirector, TutorialTurn, coachAction, flipReady, holdCeiling, holdPlate, plateProgress,
  restoreTutorialState, serveReady, sideBrowned,
  type CoachAction, type TutorialAction, type TutorialTable, type TutorialTrigger
} from '../sim-core/src/tutorial.ts';
import type { FoodRuntime } from '../sim-core/src/cooking.ts';

const CHECK = process.argv.includes('--check');
const OUT = join(import.meta.dirname, '..', 'golden', 'vectors.json');
const OUT_TUTORIAL = join(import.meta.dirname, '..', 'golden', 'tutorial-vectors.json');
const SCALE = 1e9;

const { db, problems } = loadAndValidate();
if (problems.length) {
  console.error('data invalid — refusing to write vectors:');
  for (const p of problems) console.error('  ' + p);
  process.exit(1);
}

const r9 = (n: number): number => Math.round(n * SCALE) / SCALE;

/** True when a value survives a JSON round-trip bit-for-bit. */
const isJsonExact = (n: number): boolean => Number(JSON.stringify(n)) === n;

interface Vec { id: string; input: unknown; expect: unknown; }
const cooking: Vec[] = [];
const scoring: Vec[] = [];
const economy: Vec[] = [];
const turns: Vec[] = [];

// The restaurant whose stats we pin. Index 1 keeps the zone count at the authored
// three while exercising a real upgrade baseline.
const RESTAURANT = db.restaurantByIndex.get(1)!;
const STATS = deriveStats(db, RESTAURANT, {});
const TUNING = rewardTuning(db.economy);
/**
 * Simulation step for the golden vectors: 1/16 s = 0.0625.
 *
 * Chosen because 0.0625 is exactly representable in BOTH decimal and binary
 * floating point. A step like 1/12 serialises as 0.083333333 (rounded to 9 dp),
 * so the generator would tick with a different value than the one recorded in
 * the file — and the C# runner, reading the file, could never reproduce it.
 * Exactness matters more here than matching the shipped frame step; the vectors
 * verify the FORMULAS, not the frame rate.
 */
const STEP = 1 / 16;
const SAMPLES = [1, 2, 3, 5, 8, 12, 20, 30];

// ── 1. Cooking integration ──────────────────────────────────────────────────
// Per ingredient × zone, integrate in fixed 1/12 s steps and record per-side
// doneness at sampled times. This pins the heat model exactly.
for (const ing of db.ingredients.items) {
  for (let zi = 0; zi < db.grill.zones.length; zi++) {
    const grill = createGrill(STATS, db);
    const food = createFood(1, ing);
    placeOnGrill(grill, db, food, zi);

    let ticksRun = 0;
    const trace: { ticks: number; tSec: number; sides: number[]; overall: number; evenness: number; burned: boolean }[] = [];
    for (const targetSec of SAMPLES) {
      // Exact tick count — recorded so no consumer (including the C# runner) has
      // to reproduce a floating-point accumulation loop.
      const wantTicks = Math.round(targetSec / STEP);
      while (ticksRun < wantTicks) {
        tickGrill(grill, db, STEP);
        ticksRun++;
      }
      trace.push({
        ticks: ticksRun,
        tSec: r9(ticksRun * STEP),
        sides: food.sides.map(r9),
        overall: r9(overallDoneness(food)),
        evenness: r9(evenness(food)),
        burned: food.burned
      });
    }
    cooking.push({
      id: `cook.${ing.id}.zone${zi}`,
      input: {
        ingredient: ing.id,
        sides: ing.sides,
        cookMethod: ing.cookMethod,
        perfectWindow: ing.perfectWindow,
        zoneIndex: zi,
        zoneHeatMultiplier: db.grill.zones[zi]!.heatMultiplier,
        stepSec: r9(STEP),
        derivedStats: {
          // Doneness gained per second on the side facing the coals. This is the
          // exact coefficient tickGrill multiplies by dt:
          //   rate = heat * ingredient.heatRate * stats.heatRampRate / ingredient.sideCookSec
          // where heat = effectiveHeat(zone) (zone table value + high-zone bonus,
          // scaled by charcoal efficiency). The C# runner recomputes it and asserts
          // equality before replaying the trace.
          // It previously read a `heatRatePerSec` field that does not exist on
          // DerivedStats, so JSON.stringify silently dropped it from every vector.
          heatRatePerSec: r9(
            effectiveHeat(grill, zi, db) * ing.heatRate * STATS.heatRampRate / ing.sideCookSec
          ),
          charcoalEfficiency: r9(grill.charcoalEfficiency),
          highZoneBonus: STATS.highZoneBonus
        }
      },
      expect: { trace }
    });
  }
}

// ── 2. Flip behaviour ───────────────────────────────────────────────────────
for (const ing of db.ingredients.items) {
  const grill = createGrill(STATS, db);
  const food = createFood(7, ing);
  placeOnGrill(grill, db, food, 1);
  for (let i = 0; i < 40; i++) tickGrill(grill, db, STEP);
  const sidesBefore = food.sides.map(r9);
  const downBefore = food.downSide;
  const flipAt = 40 * STEP;
  const flipped = flipFood(grill, food, flipAt, db);
  for (let i = 0; i < 40; i++) tickGrill(grill, db, STEP);
  scoring.push({
    id: `flip.${ing.id}`,
    input: {
      ingredient: ing.id,
      sideDownBefore: downBefore,
      flipAtSec: r9(flipAt),
      cooldownSec: db.grill.interaction.flipCooldownSec
    },
    expect: {
      flipped,
      sideDownAfter: food.downSide,
      sidesBefore,
      sidesAfter: food.sides.map(r9),
      evenness: r9(evenness(food))
    }
  });
}

// ── 3. Scoring across the whole doneness axis ───────────────────────────────
for (const ing of db.ingredients.items) {
  const rows: { overall: number; quality: string; coins: number; xp: number; stage: string; evenness: number }[] = [];
  for (let d = 0; d <= 150; d += 5) {
    const v = d / 100;
    const f = createFood(1, ing);
    for (let i = 0; i < f.sides.length; i++) f.sides[i] = v;
    f.burned = f.sides.some((s) => s >= db.ingredients.shared.burnedThreshold);
    const scored = scoreItem(db, f, {
      target: (ing.perfectWindow[0]! + ing.perfectWindow[1]!) / 2,
      toleranceScale: 1,
      patienceRemaining: 0.5,
      combo: 0,
      tipMult: 1,
      xpMult: 1,
      customerTipMult: 1,
      eventValueMult: 1,
      tuning: TUNING
    });
    rows.push({
      overall: r9(overallDoneness(f)),
      quality: scored.quality,
      coins: r9(scored.coins),
      xp: r9(scored.xp),
      stage: String(stageOf(db, f)),
      evenness: r9(evenness(f))
    });
  }
  scoring.push({
    id: `score.${ing.id}`,
    input: {
      ingredient: ing.id,
      perfectWindow: ing.perfectWindow,
      goodWindowPadding: db.grill.scoring.goodWindowPadding,
      // No `burnedCoinFactor` here: there is no such field in any table, and burned
      // food pays a hard zero (scoreItem → case 'burned': coins = 0), which the
      // expectation rows below already pin down.
      burnedThreshold: db.ingredients.shared.burnedThreshold,
      minEvennessForPerfect: db.ingredients.shared.minEvennessForPerfect,
      target: (ing.perfectWindow[0]! + ing.perfectWindow[1]!) / 2,
      value: ing.value,
      xp: ing.xp,
      tuning: TUNING
    },
    expect: { rows }
  });
}

// ── 4. Economy curves ───────────────────────────────────────────────────────
const xpF = db.economy.xp.formula;
const LEVELS = Array.from({ length: 80 }, (_, i) => i + 1);

economy.push({
  id: 'econ.xpForLevel',
  input: { formula: xpF, levels: LEVELS },
  expect: { values: LEVELS.map((l) => xpForLevel(l, xpF.a, xpF.exponent, xpF.minPerLevel)) }
});

const XP_SAMPLES = [0, 100, 1000, 10000, 100000, 1000000, 10000000];
economy.push({
  id: 'econ.levelForXp',
  input: { formula: xpF, maxLevel: db.economy.xp.maxLevel, xp: XP_SAMPLES },
  expect: { levels: XP_SAMPLES.map((x) => levelForXp(x, xpF.a, xpF.exponent, xpF.minPerLevel, db.economy.xp.maxLevel)) }
});

const costRows: { track: string; level: number; cost: number }[] = [];
for (const track of db.upgrades.tracks) {
  for (let l = 1; l <= Math.min(track.maxLevel, 30); l++) {
    costRows.push({ track: track.id, level: l, cost: r9(upgradeCost(track.baseCost, track.growth, l)) });
  }
}
economy.push({
  id: 'econ.upgradeCost',
  input: { tracks: db.upgrades.tracks.map((t) => ({ id: t.id, baseCost: t.baseCost, growth: t.growth, maxLevel: t.maxLevel, currency: t.currency })) },
  expect: { rows: costRows }
});

economy.push({
  id: 'econ.levelUpReward',
  input: { coins: db.economy.reward.levelUpCoins, embers: db.economy.reward.levelUpEmbers, levels: LEVELS },
  expect: {
    coins: LEVELS.map((l) => r9(levelUpCoinReward(db.economy.reward.levelUpCoins, l))),
    embers: LEVELS.map((l) => (l % db.economy.reward.levelUpEmbers.every === 0 ? db.economy.reward.levelUpEmbers.amount : 0))
  }
});

const offlineRows: { restaurantIndex: number; elapsedSec: number; coins: number; xp: number; capped: boolean }[] = [];
for (const ri of [0, 3, 6]) {
  for (const mins of [1, 5, 20, 60, 240, 600]) {
    const p = newPlayerState();
    p.restaurantIndex = ri;
    const o = computeOfflineEarnings(db, p, mins * 60, 1_000_000);
    offlineRows.push({ restaurantIndex: ri, elapsedSec: mins * 60, coins: r9(o.coins), xp: r9(o.xp), capped: o.capped });
  }
}
economy.push({
  id: 'econ.offline',
  input: { idle: db.economy.idle, upgradeLevels: {}, nowSec: 1_000_000 },
  expect: { rows: offlineRows }
});

const CHARCOAL_SAMPLES = [0, 0.05, 0.12, 0.3, 0.55, 0.8, 1.0];
const heatByZone: number[][] = [];
for (let zi = 0; zi < db.grill.zones.length; zi++) {
  heatByZone.push(CHARCOAL_SAMPLES.map((t) => {
    const g = createGrill(STATS, db);
    g.charcoalT = t;
    // Recompute efficiency the same way tickGrill does, without advancing time.
    g.charcoalEfficiency = charcoalEfficiencyAt(t);
    return r9(effectiveHeat(g, zi, db));
  }));
}
economy.push({
  id: 'econ.effectiveHeat',
  input: {
    zoneHeatMultipliers: db.grill.zones.map((z) => z.heatMultiplier),
    charcoalT: CHARCOAL_SAMPLES,
    derivedStats: { highZoneBonus: STATS.highZoneBonus }
  },
  expect: { byZone: heatByZone }
});

/** Piecewise-linear sample of grill.charcoal.efficiencyCurve (mirrors sampleCurve). */
function charcoalEfficiencyAt(t: number): number {
  const pts = db.grill.charcoal.efficiencyCurve;
  const c = Math.min(1, Math.max(0, t));
  if (c <= pts[0]!.t) return pts[0]!.value;
  const last = pts[pts.length - 1]!;
  if (c >= last.t) return last.value;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]!, b = pts[i + 1]!;
    if (c >= a.t && c <= b.t) {
      const span = b.t - a.t;
      return a.value + (b.value - a.value) * (span <= 0 ? 0 : (c - a.t) / span);
    }
  }
  return last.value;
}

// ── 5. Full turns ───────────────────────────────────────────────────────────
// End-to-end: a seeded turn driven by a fixed skill policy must produce
// identical counters. Strongest parity check — it exercises every subsystem.
const LEVEL_INDICES = [0, 10, 30, 59];
const authored = generateLevels([[0, 24], [1, 36]]).levels;

for (const skill of [0.35, 0.55, 0.85]) {
  for (const li of LEVEL_INDICES) {
    const lvl = authored[li]!;
    const seed = 4242;
    const sim = new TurnSimulation(
      db,
      {
        restaurantIndex: lvl.restaurantIndex,
        levelId: lvl.id,
        upgradeLevels: {},
        seed,
        overrides: {
          turnLengthSec: lvl.turnLengthSec,
          spawnIntervalSec: lvl.spawnIntervalSec,
          patienceScalar: lvl.patienceScalar,
          difficultyScalar: lvl.difficultyScalar,
          maxOrdersOnScreen: lvl.maxOrdersOnScreen
        }
      },
      seed
    );
    const policy = new SkillPolicy(new Rng(seed + lvl.index * 104729), { skill });
    let guard = 0;
    while (!sim.finished && guard++ < 40000) sim.tick(STEP, (a) => policy.act(a));
    const res = sim.result();
    turns.push({
      id: `turn.skill${skill}.${lvl.id}`,
      input: {
        skill,
        levelId: lvl.id,
        levelIndex: lvl.index,
        restaurantIndex: lvl.restaurantIndex,
        seed,
        stepSec: r9(STEP),
        overrides: {
          turnLengthSec: lvl.turnLengthSec,
          spawnIntervalSec: lvl.spawnIntervalSec,
          patienceScalar: lvl.patienceScalar,
          difficultyScalar: lvl.difficultyScalar,
          maxOrdersOnScreen: lvl.maxOrdersOnScreen
        }
      },
      expect: {
        coins: r9(res.coins),
        xp: r9(res.xp),
        stars: res.stars,
        failed: res.failed,
        finalTimeSec: r9(sim.time),
        counters: res.counters
      }
    });
  }
}

// ── 6. FTUE (tools/sim-core/src/tutorial.ts) → tutorial-vectors.json ────────
// Replayed by the C# port (Assets/Scripts/Core/Tutorial.cs + Analytics.cs) in
// tools/csharp/parity. Inputs are written at full double precision — a JSON
// round-trip of a double is exact — and every expectation is what the shipping
// TypeScript returns for exactly those inputs.
const TUT = readJson('tutorial.json') as TutorialTable;
const TAX = readJson('analytics.json') as AnalyticsTaxonomy;
const N_STEPS = TUT.steps.length;
const FTUE_ING = db.ingredientById.get(TUT.turn.ingredientId)!;
const FTUE_LEVEL = (readJson('levels.json') as { levels: { id: string; restaurantIndex: number }[] })
  .levels.find((l) => l.id === TUT.turn.levelId)!;

const tDirector: Vec[] = [];
const tRestore: Vec[] = [];
const tCoach: Vec[] = [];
const tHand: Vec[] = [];
const tMask: Vec[] = [];
const tAnalytics: Vec[] = [];

interface FoodSnap { uid: number; ingredient: string; sides: number[]; downSide: number; onGrill: boolean; burned: boolean; served: boolean }
const snapFood = (f: FoodRuntime): FoodSnap => ({
  uid: f.uid, ingredient: f.ingredient.id, sides: [...f.sides], downSide: f.downSide,
  onGrill: f.onGrill, burned: f.burned, served: f.served
});
function foodFrom(s: FoodSnap): FoodRuntime {
  const f = createFood(s.uid, db.ingredientById.get(s.ingredient)!);
  f.sides = [...s.sides];
  f.downSide = s.downSide;
  f.onGrill = s.onGrill;
  f.burned = s.burned;
  f.served = s.served;
  return f;
}

// 6a. Director scenarios: an op list, and after every op what it returned,
// where the director stands and exactly which events went out.
type DirectorOp = ['start'] | ['tick', number] | ['report', TutorialTrigger] | ['miss'] | ['skip'] | ['abandon'] | ['restartTurn'];
function directorVec(id: string, restore: { raw: unknown; legacyDone: boolean } | null, ops: DirectorOp[]): void {
  const events: AnalyticsEvent[] = [];
  const start = restore ? restoreTutorialState(TUT, restore.raw, restore.legacyDone) : null;
  const d = new TutorialDirector(TUT, start, (e) => events.push(e));
  const trace = ops.map((op) => {
    const before = events.length;
    let ret: boolean | null = null;
    switch (op[0]) {
      case 'start': d.start(); break;
      case 'tick': d.tick(op[1]); break;
      case 'report': ret = d.report(op[1]); break;
      case 'miss': d.miss(); break;
      case 'skip': ret = d.skip(); break;
      case 'abandon': ret = d.abandon(); break;
      case 'restartTurn': d.restartTurn(); break;
    }
    return {
      ret, step: d.current?.id ?? null, done: d.done, canSkip: d.canSkip, elapsedMs: d.elapsedMs,
      misses: d.state.misses, events: events.slice(before)
    };
  });
  tDirector.push({ id: `director.${id}`, input: { restore, ops }, expect: { trace, state: d.state } });
}
const V = TUT.variant;
const midRun = (over: Record<string, unknown>): Record<string, unknown> => ({
  variant: V, step: 3, reported: 2, elapsedMs: 8421.25, misses: 3, started: true, skipped: false, abandonedStep: 2, ...over
});
directorVec('walkthrough', null, [
  ['abandon'], ['tick', 1], ['miss'], ['start'], ['start'], ['tick', 0.75], ['report', 'flipped'], ['miss'],
  ['report', 'placed'], ['abandon'], ['abandon'], ['tick', 1 / 60], ['tick', 1.3], ['report', 'flipped'],
  ['tick', -5], ['report', 'served'], ['report', 'reward_landed'], ['miss'], ['tick', 0.123],
  ['report', 'order_completed'], ['tick', 2.2], ['report', 'upgrade_bought'], ['report', 'upgrade_bought'],
  ['miss'], ['skip'], ['abandon'], ['tick', 1], ['restartTurn']
]);
// PULAR appears at exactly skip.showAfterSec of FTUE time (>=, not >), and not a tick before.
directorVec('skip-threshold', null, [
  ['start'], ['tick', 1.9], ['tick', 0.1], ['tick', 0.001], ['report', 'placed'], ['skip'], ['skip'],
  ['report', 'flipped'], ['abandon'], ['miss'], ['tick', 1]
]);
directorVec('resume-replays-the-turn-silently', { raw: midRun({ step: 4, reported: 4, elapsedMs: 12345.6, misses: 2, abandonedStep: 3 }), legacyDone: false }, [
  ['start'], ['restartTurn'], ['report', 'placed'], ['report', 'flipped'], ['report', 'served'],
  ['report', 'reward_landed'], ['tick', 0.5], ['report', 'order_completed'], ['abandon'], ['restartTurn'],
  ['report', 'upgrade_bought'], ['abandon']
]);
directorVec('legacy-done', { raw: null, legacyDone: true }, [
  ['start'], ['tick', 5], ['report', 'placed'], ['skip'], ['abandon'], ['restartTurn'], ['miss']
]);
directorVec('fresh-from-null', { raw: null, legacyDone: false }, [
  ['tick', 3], ['start'], ['tick', 2.0000001], ['abandon'], ['report', 'placed'], ['abandon'], ['skip']
]);
// Math.round(1234.5) is 1235; C#'s Math.Round gives 1234 (half to even).
directorVec('half-a-millisecond-rounds-up', { raw: midRun({ step: 1, reported: 0, elapsedMs: 1234.5, misses: 0, abandonedStep: 0 }), legacyDone: false }, [
  ['report', 'placed'], ['tick', 0.001], ['report', 'flipped'], ['tick', 0.0005], ['skip']
]);

// 6b. Restores. Type-correct inputs only: in C# a string where a number
// belongs is the deserialiser's to reject, not restoreTutorialState's.
const restoreCases: [string, unknown, boolean][] = [
  ['null', null, false],
  ['legacy-done-wins', midRun({}), true],
  ['other-variant', midRun({ variant: 'old_v0' }), false],
  ['valid-mid-run', midRun({}), false],
  ['reported-ahead-of-step', midRun({ step: 1, reported: 4 }), false],
  ['finished', midRun({ step: N_STEPS + 1, reported: N_STEPS }), false],
  ['skipped', midRun({ skipped: true }), false],
  ['not-started', midRun({ started: false }), false],
  ['step-zero', midRun({ step: 0 }), false],
  ['step-past-the-end', midRun({ step: N_STEPS + 2 }), false],
  ['reported-negative', midRun({ reported: -1 }), false],
  ['reported-past-the-end', midRun({ reported: N_STEPS + 1 }), false],
  ['negative-elapsed-and-misses', midRun({ elapsedMs: -50, misses: -2 }), false],
  ['abandoned-past-the-end', midRun({ abandonedStep: N_STEPS + 2 }), false],
  ['abandoned-negative', midRun({ abandonedStep: -1 }), false]
];
for (const [id, raw, legacyDone] of restoreCases) {
  tRestore.push({ id: `restore.${id}`, input: { raw, legacyDone }, expect: { state: restoreTutorialState(TUT, raw, legacyDone) } });
}

// 6c. Coach rules over a grid of plates, per shape of food.
function coachRow(s: FoodSnap) {
  const f = foodFrom(s);
  const row = {
    sideBrowned: sideBrowned(TUT, f),
    flipReady: flipReady(db, TUT, f),
    serveReady: serveReady(db, TUT, f),
    plateProgress: plateProgress(db, TUT, f),
    holdCeiling: holdCeiling(TUT, f)
  };
  const clamped = holdPlate(TUT, f);
  return { ...row, hold: { clamped, sides: [...f.sides] } };
}
const GRID = [0, 0.3, 0.55 - 1e-9, 0.55, 0.74, 0.8, 0.87, 1.25];
const gridPlates: FoodSnap[] = [];
for (const a of GRID) for (const b of GRID) for (const down of [0, 1]) {
  gridPlates.push({ uid: 1, ingredient: FTUE_ING.id, sides: [a, b], downSide: down, onGrill: true, burned: false, served: false });
}
for (const flags of [{ onGrill: false, burned: false, served: false }, { onGrill: true, burned: true, served: false }, { onGrill: true, burned: false, served: true }]) {
  for (const sides of [[0.8, 0.8], [0.6, 0.1]]) gridPlates.push({ uid: 1, ingredient: FTUE_ING.id, sides, downSide: 0, ...flags });
}
const FOUR = db.ingredients.items.find((i) => i.sides === 4)!;
const ONE = db.ingredients.items.find((i) => i.sides === 1)!;
for (const sides of [[0.6, 0.1, 0.1, 0.1], [0.8, 0.8, 0.8, 0.8], [0.1, 0.6, 0.1, 0.1], [0.9, 0.7, 0.75, 0.72]]) {
  for (const down of [0, 1]) gridPlates.push({ uid: 2, ingredient: FOUR.id, sides, downSide: down, onGrill: true, burned: false, served: false });
}
for (const v of [0, 0.5, 0.8, 1.1]) gridPlates.push({ uid: 3, ingredient: ONE.id, sides: [v], downSide: 0, onGrill: true, burned: false, served: false });
tCoach.push({ id: 'coach.grid', input: { plates: gridPlates }, expect: { rows: gridPlates.map(coachRow) } });

// 6d. The hand: a bot that only follows `turn.coach()` plays the real scripted
// turn; every sample records the turn's state and what the hand pointed at.
interface HandSample { t: number; step: number | null; foods: FoodSnap[]; plate: number | null; plates: number[]; openLines: number; zones: number[]; slotsPerZone: number }
function openLinesOf(turn: TutorialTurn): number {
  let open = 0;
  for (const c of turn.sim.customers) {
    if (c.state !== 'waiting') continue;
    open += c.lines.filter((l) => l.ingredientId === FTUE_ING.id && l.fulfilledBy.length === 0).length;
  }
  return open;
}
function sampleTurn(turn: TutorialTurn, t: number): { input: HandSample; expect: ReturnType<typeof actionOut> } {
  const plates = turn.sim.foods.filter((f) => f.onGrill && !f.served && f.ingredient.id === FTUE_ING.id);
  const foods: FoodRuntime[] = [...plates];
  if (turn.plate && !foods.includes(turn.plate)) foods.push(turn.plate);
  const input: HandSample = {
    t,
    step: turn.step?.index ?? null,
    foods: foods.map(snapFood),
    plate: turn.plate ? foods.indexOf(turn.plate) : null,
    plates: plates.map((f) => foods.indexOf(f)),
    openLines: openLinesOf(turn),
    zones: turn.sim.grill.zones.map((z) => z.items.length),
    slotsPerZone: turn.sim.grill.stats.slotsPerZone
  };
  return { input, expect: actionOut(turn.coach(), foods) };
}
function actionOut(a: CoachAction, foods: FoodRuntime[]) {
  const food = 'food' in a && a.food ? foods.indexOf(a.food) : null;
  return {
    kind: a.kind,
    food,
    zoneIndex: a.kind === 'place' ? a.zoneIndex : -1,
    progress: a.kind === 'wait' ? a.progress : 0
  };
}
function handRun(id: string, reaction: number, hesitate: number): void {
  const director = new TutorialDirector(TUT, null, () => {});
  const turn = new TutorialTurn(db, TUT, director, { restaurantIndex: FTUE_LEVEL.restaurantIndex, seed: 7 });
  const samples: HandSample[] = [];
  const actions: ReturnType<typeof actionOut>[] = [];
  const keyOf = (a: CoachAction): string => (a.kind === 'wait' ? 'wait' : `${a.kind}:${'food' in a ? a.food.uid : a.zoneIndex}`);
  let ticks = 0;
  let lastKey = '';
  let seenKey = '';
  let seenAt = 0;
  let lastInput = 0;
  let rewardAt = -1;
  const record = (): void => {
    const s = sampleTurn(turn, r9(ticks * STEP));
    samples.push(s.input);
    actions.push(s.expect);
  };
  while (ticks < 240 / STEP && !turn.sim.finished) {
    turn.tick(STEP);
    ticks++;
    turn.sim.events.length = 0;
    const t = ticks * STEP;
    const step = turn.step;
    if (!step || step.screen !== 'play') break;
    const hint = turn.coach();
    const key = keyOf(hint);
    if (key !== lastKey || ticks % 16 === 0) { record(); lastKey = key; }
    if (step.completesOn === 'reward_landed') {
      if (rewardAt < 0) rewardAt = t + 0.9;
      if (t >= rewardAt) turn.rewardLanded();
      continue;
    }
    const visible = hint.kind !== 'wait' && (turn.guided || t - lastInput >= TUT.coach.idleHintSec);
    if (!visible) { seenKey = ''; continue; }
    if (key !== seenKey) { seenKey = key; seenAt = t; }
    if (t - seenAt < reaction + hesitate) continue;
    lastInput = t;
    seenKey = '';
    if (hint.kind === 'place') {
      const f = turn.take();
      if (f && !turn.place(f, hint.zoneIndex)) turn.discard(f);
    } else if (hint.kind === 'flip') turn.flip(hint.food);
    else if (hint.kind === 'serve') turn.serve(hint.customer, hint.food);
    else if (hint.kind === 'discard') turn.discard(hint.food);
    record();
  }
  if (!director.state.step || director.state.step <= 5) {
    console.error(`[golden] tutorial hand run "${id}" did not finish steps 1-5 (step ${director.state.step})`);
    process.exit(1);
  }
  tHand.push({ id: `hand.${id}`, input: { reaction, hesitate, samples }, expect: { actions } });
}
handRun('follows-the-hand', 0.6, 0);
handRun('hesitates-5s-before-every-action', 0.6, 5);

// Free-play branches the scripted turn never reaches (it cannot burn or
// overcook): a stand-in turn with exactly the fields coachAction reads.
function freePlayCase(id: string, plates: FoodSnap[], openLines: number, zones: number[], slotsPerZone: number): void {
  const foods = plates.map(foodFrom);
  const grill = { zones: zones.map((n, index) => ({ index, heat: 1, items: Array.from({ length: n }, (_, k) => createFood(900 + index * 10 + k, FTUE_ING)) })), stats: { slotsPerZone } };
  const customers = openLines > 0
    ? [{ state: 'waiting', lines: Array.from({ length: openLines }, () => ({ ingredientId: FTUE_ING.id, fulfilledBy: [] })) }]
    : [{ state: 'waiting', lines: [{ ingredientId: FTUE_ING.id, fulfilledBy: [1] }] }];
  const sim = { db, customers, foods, grill } as unknown as TurnSimulation;
  const input: HandSample = { t: 0, step: 5, foods: plates, plate: null, plates: plates.map((_, i) => i), openLines, zones, slotsPerZone };
  tHand.push({ id: `hand.free.${id}`, input: { reaction: 0, hesitate: 0, samples: [input] }, expect: { actions: [actionOut(coachAction(sim, TUT), foods)] } });
}
const plate = (uid: number, sides: number[], downSide = 0, extra: Partial<FoodSnap> = {}): FoodSnap =>
  ({ uid, ingredient: FTUE_ING.id, sides, downSide, onGrill: true, burned: false, served: false, ...extra });
freePlayCase('burned-plate-is-discarded-first', [plate(1, [0.8, 0.8]), plate(2, [1.3, 0.9], 0, { burned: true })], 1, [2], 3);
freePlayCase('past-the-window-still-served', [plate(1, [0.95, 0.9])], 1, [1], 3);
freePlayCase('no-customer-no-serve', [plate(1, [0.8, 0.8])], 0, [1], 3);
freePlayCase('flip-when-it-helps', [plate(1, [0.6, 0.05])], 1, [1], 3);
freePlayCase('place-in-first-free-zone', [], 2, [2, 1, 0], 2);
freePlayCase('all-zones-full', [], 2, [2, 2], 2);
freePlayCase('nothing-to-do', [], 0, [0], 2);
freePlayCase('wait-with-progress', [plate(1, [0.3, 0.02])], 1, [1], 3);

// 6e. Input masking, at every step, for every action.
const ACTIONS: TutorialAction[] = ['take', 'place', 'move', 'flip', 'serve', 'discard', 'refill'];
const maskRows: { step: number | null; action: string; onGuidedPlate: boolean; plateReady: boolean; allows: boolean; guided: boolean }[] = [];
for (let reach = 0; reach <= N_STEPS; reach++) {
  for (const plateKind of ['none', 'ready', 'unready'] as const) {
    const director = new TutorialDirector(TUT, null, () => {});
    const turn = new TutorialTurn(db, TUT, director, { restaurantIndex: FTUE_LEVEL.restaurantIndex, seed: 7 });
    for (let i = 0; i < reach; i++) director.report(TUT.steps[i]!.completesOn);
    const on = turn.step?.completesOn;
    const readySides = on === 'served' ? [0.8, 0.8] : [0.6, 0.05];
    turn.plate = plateKind === 'none' ? null : foodFrom(plate(1, plateKind === 'ready' ? readySides : [0.1, 0.02]));
    const other = foodFrom(plate(2, [0.8, 0.8]));
    for (const action of ACTIONS) {
      for (const target of turn.plate ? [turn.plate, other, undefined] : [other, undefined]) {
        maskRows.push({
          step: turn.step?.index ?? null,
          action,
          onGuidedPlate: !!turn.plate && target === turn.plate,
          plateReady: turn.plateReady,
          allows: turn.allows(action, target),
          guided: turn.guided
        });
      }
    }
  }
}
tMask.push({ id: 'mask.every-step-every-action', input: { rows: maskRows.map(({ allows, guided, ...r }) => r) }, expect: { rows: maskRows.map(({ allows, guided }) => ({ allows, guided })) } });

// 6f. The analytics contract.
const eventCases: [string, string, Record<string, AnalyticsValue>][] = [
  ['valid-step', 'tutorial_step', { step: 'place', step_index: 1, elapsed_ms: 1234 }],
  ['valid-complete', 'tutorial_complete', { duration_ms: 32900, misses: 0 }],
  ['valid-daily', 'daily_reward', { day_index: 1, streak: 1 }],
  ['unknown-event', 'tutorial_nope', { step: 'place' }],
  ['missing-params', 'tutorial_step', { step: 'place' }],
  ['undeclared-param', 'tutorial_start', { variant: V, extra: true }],
  ['wrong-types', 'tutorial_step', { step: 3, step_index: 1.5, elapsed_ms: 'soon' }],
  ['quoted-string-in-a-number', 'tutorial_abandon', { step: 'flip', step_index: 'a"b\\c' }],
  ['boolean-in-a-string', 'tutorial_start', { variant: false }],
  ['integral-double-is-a-long', 'tutorial_complete', { duration_ms: 1000, misses: 2 }],
  ['everything-wrong', 'tutorial_skip', { step: true, step_index: -2.25, bogus: 'x' }]
];
for (const [id, name, params] of eventCases) {
  tAnalytics.push({ id: `analytics.${id}`, input: { name, params }, expect: { problems: checkAnalyticsEvent(TAX, { name, params }) } });
}
// Every event a director scenario emits must satisfy the contract.
for (const v of tDirector) {
  for (const row of (v.expect as { trace: { events: AnalyticsEvent[] }[] }).trace) {
    for (const e of row.events) {
      const problems = checkAnalyticsEvent(TAX, e);
      if (problems.length) {
        console.error(`[golden] ${v.id}: director sent an invalid event: ${problems.join('; ')}`);
        process.exit(1);
      }
    }
  }
}

// ── Write ───────────────────────────────────────────────────────────────────
const doc = {
  version: 1,
  generatedBy: 'tools/studio/gen-vectors.ts',
  note: 'Golden vectors for TS <-> C# parity. Regenerate with `npm run gen-vectors`. Never edit by hand.',
  dataVersions: {
    ingredients: db.ingredients.version,
    grill: db.grill.version,
    economy: db.economy.version,
    restaurants: db.restaurants.version,
    upgrades: db.upgrades.version
  },
  epsilon: 1e-9,
  counts: { cooking: cooking.length, scoring: scoring.length, economy: economy.length, turns: turns.length },
  cooking,
  scoring,
  economy,
  turns
};

// A step that does not survive serialisation would silently break parity with
// every consumer of this file, so refuse to write one.
if (!isJsonExact(STEP)) {
  console.error(`[golden] STEP ${STEP} is not exactly representable in JSON; ` +
    'the C# runner would tick with a different value than this generator did.');
  process.exit(1);
}

const json = JSON.stringify(doc, null, 2) + '\n';

const tutorialDoc = {
  version: 1,
  generatedBy: 'tools/studio/gen-vectors.ts',
  note: 'FTUE vectors (tools/sim-core/src/tutorial.ts, analytics.ts) for TS <-> C# parity; replayed by tools/csharp/parity. Regenerate with `npm run gen-vectors`. Never edit by hand.',
  dataVersions: { tutorial: TUT.version, analytics: (TAX as unknown as { version: number }).version, ingredients: db.ingredients.version },
  epsilon: 1e-9,
  counts: {
    director: tDirector.length, restore: tRestore.length, coach: tCoach.length,
    hand: tHand.length, mask: tMask.length, analytics: tAnalytics.length
  },
  director: tDirector,
  restore: tRestore,
  coach: tCoach,
  hand: tHand,
  mask: tMask,
  analytics: tAnalytics
};
const tutorialJson = JSON.stringify(tutorialDoc, null, 1) + '\n';
const tutorialTotal = tDirector.length + tRestore.length + tCoach.length + tHand.length + tMask.length + tAnalytics.length;

if (CHECK) {
  let drift = false;
  for (const [path, text] of [[OUT, json], [OUT_TUTORIAL, tutorialJson]] as const) {
    const name = path.slice(path.lastIndexOf('/') + 1);
    if (!existsSync(path)) {
      console.error(`[golden] ${name} does not exist — run \`npm run gen-vectors\``);
      drift = true;
    } else if (readFileSync(path, 'utf8') !== text) {
      console.error(`[golden] DRIFT — ${name} does not match a fresh generation.`);
      drift = true;
    }
  }
  if (drift) {
    console.error('[golden] A rules formula changed, or the TS and C# implementations disagree.');
    console.error('[golden] Run `npm run gen-vectors`, review the diff, then commit.');
    process.exit(1);
  }
  const total = cooking.length + scoring.length + economy.length + turns.length;
  console.log(`[golden] OK — ${total} vectors + ${tutorialTotal} FTUE vectors unchanged`);
  process.exit(0);
}

mkdirSync(join(import.meta.dirname, '..', 'golden'), { recursive: true });
writeFileSync(OUT, json);
writeFileSync(OUT_TUTORIAL, tutorialJson);
const total = cooking.length + scoring.length + economy.length + turns.length;
console.log(`[golden] wrote tools/golden/vectors.json and tools/golden/tutorial-vectors.json`);
console.log(`[golden] cooking ${cooking.length} · scoring ${scoring.length} · economy ${economy.length} · turns ${turns.length}`);
console.log(`[golden] FTUE: director ${tDirector.length} · restore ${tRestore.length} · coach ${tCoach.length} · hand ${tHand.length} · mask ${tMask.length} · analytics ${tAnalytics.length}`);
console.log(`[golden] total ${total} + ${tutorialTotal} vectors`);
