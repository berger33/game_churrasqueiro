/**
 * gen-vectors — golden vectors for cross-language parity (`npm run gen-vectors`).
 *
 * The rules exist twice by necessity: the TypeScript reference implementation
 * (tested, and what drives the simulator) and the C# port the Unity client ships.
 * Nothing but identical output proves they agree, so this script freezes a
 * deterministic set of input → output pairs.
 *
 *   npm run gen-vectors          writes tools/golden/vectors.json
 *   npm run check-vectors        fails if the file would change (CI gate)
 *
 * The C# runner replays every case from the same file and must match to 1e-9.
 * If a formula changes in one language only, this file changes and CI fails.
 *
 * Determinism rules: fixed seeds, no wall-clock time, no Map/Set iteration in
 * output, every number rounded to 9 dp.
 */
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { loadAndValidate } from './load-data.ts';
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

const CHECK = process.argv.includes('--check');
const OUT = join(import.meta.dirname, '..', 'golden', 'vectors.json');
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
          heatRatePerSec: STATS.heatRatePerSec,
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
    f.burned = f.sides.some((s) => s >= 1.2);
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
      burnedCoinFactor: db.grill.scoring.burnedCoinFactor,
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

if (CHECK) {
  if (!existsSync(OUT)) {
    console.error(`[golden] ${OUT} does not exist — run \`npm run gen-vectors\``);
    process.exit(1);
  }
  const existing = readFileSync(OUT, 'utf8');
  if (existing !== json) {
    console.error('[golden] DRIFT — vectors.json does not match a fresh generation.');
    console.error('[golden] A rules formula changed, or the TS and C# implementations disagree.');
    console.error('[golden] Run `npm run gen-vectors`, review the diff, then commit.');
    process.exit(1);
  }
  const total = cooking.length + scoring.length + economy.length + turns.length;
  console.log(`[golden] OK — ${total} vectors unchanged`);
  process.exit(0);
}

mkdirSync(join(import.meta.dirname, '..', 'golden'), { recursive: true });
writeFileSync(OUT, json);
const total = cooking.length + scoring.length + economy.length + turns.length;
console.log(`[golden] wrote tools/golden/vectors.json`);
console.log(`[golden] cooking ${cooking.length} · scoring ${scoring.length} · economy ${economy.length} · turns ${turns.length}`);
console.log(`[golden] total ${total} vectors`);
