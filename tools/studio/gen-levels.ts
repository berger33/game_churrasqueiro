/**
 * Level generator (spec §78).
 *
 * Hand-authoring 60+ turns is unmaintainable and produces flat difficulty, so
 * turns are generated from a difficulty curve with an intentional sawtooth:
 * easy → medium → hard → reward, repeating (spec §77 "never generate a
 * frustration streak"). The output is a plain data file the client reads, and
 * every field is Remote-Config overridable.
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DATA_DIR, loadAndValidate } from './load-data.ts';

export interface GeneratedLevel {
  id: string;
  index: number;
  restaurantIndex: number;
  nameKey: string;
  difficulty: 'easy' | 'medium' | 'hard' | 'reward';
  difficultyScalar: number;
  turnLengthSec: number;
  spawnIntervalSec: number;
  patienceScalar: number;
  maxOrdersOnScreen: number;
  vipChance: number;
  targetStars3ServedPct: number;
  rewards: { coins: number; xp: number; embers?: number; firstClearBonus: { coins: number; xp: number } };
}

export interface LevelTable {
  version: number;
  generatedBy: string;
  levels: GeneratedLevel[];
}

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

export function generateLevels(restaurantLevels: [number, number][]): LevelTable {
  const levels: GeneratedLevel[] = [];
  let n = 0;

  for (const [restaurantIndex, count] of restaurantLevels) {
    for (let i = 0; i < count; i++) {
      n++;
      const progressInTier = count <= 1 ? 1 : i / (count - 1);
      // Sawtooth: 3 rising steps then a breather, so difficulty never stacks up.
      const beat = i % 4;
      const shape = beat === 3 ? -0.35 : (beat - 1) * 0.14;
      const d = clamp01(0.12 + progressInTier * 0.78 + shape);
      const difficulty: GeneratedLevel['difficulty'] = beat === 3 ? 'reward' : d < 0.4 ? 'easy' : d < 0.72 ? 'medium' : 'hard';

      const id = `level_${String(n).padStart(3, '0')}`;
      const turnLength = Math.round(90 + restaurantIndex * 15 + d * 15);
      const spawnInterval = Number((9.0 - d * 4.2).toFixed(2));
      const patienceScalar = Number((1.28 - d * 0.52).toFixed(3));
      const maxOrders = restaurantIndex === 0 ? (d > 0.55 ? 3 : 2) : Math.min(2 + Math.floor(d * 2.5), 4);

      levels.push({
        id,
        index: n,
        restaurantIndex,
        nameKey: `level.name.${difficulty}`,
        difficulty,
        difficultyScalar: Number((0.75 + d * 0.6).toFixed(3)),
        turnLengthSec: turnLength,
        spawnIntervalSec: spawnInterval,
        patienceScalar,
        maxOrdersOnScreen: maxOrders,
        vipChance: d > 0.75 ? 0.12 : 0,
        targetStars3ServedPct: 0.9,
        rewards: {
          coins: Math.round(80 + d * 160 + restaurantIndex * 120),
          xp: Math.round(18 + d * 40 + restaurantIndex * 14),
          embers: beat === 3 ? 1 : undefined,
          firstClearBonus: { coins: Math.round(150 + d * 200 + restaurantIndex * 180), xp: Math.round(30 + d * 50) }
        }
      });
    }
  }

  return { version: 1, generatedBy: 'tools/studio/gen-levels.ts', levels };
}

/**
 * Post-MVP turns for long-horizon pacing projections. These are NOT shipped in
 * levels.json; they model the daily grind once the authored content runs out,
 * so `run-sim.ts` can verify that establishments 3-7 stay reachable on a
 * realistic schedule (spec §85/§86).
 */
/**
 * Post-MVP turns for long-horizon pacing projections. NOT shipped in levels.json.
 * Throughput scales with the establishment's real capacity (bigger grill, more
 * tables, longer turns) so income keeps growing instead of plateauing — a
 * plateau was measured before this scaling existed and it starved the sinks.
 */
export function generateEndlessLevels(
  count: number,
  startIndex: number,
  restaurant: { index: number; turnLengthSec: number; maxOrders: number }
): GeneratedLevel[] {
  const out: GeneratedLevel[] = [];
  for (let i = 0; i < count; i++) {
    const n = startIndex + i;
    const beat = i % 4;
    const d = 0.78 + (beat === 3 ? -0.14 : (beat - 1) * 0.06);
    const tier = restaurant.index;
    out.push({
      id: `endless_${String(n).padStart(4, '0')}`,
      index: n,
      restaurantIndex: tier,
      nameKey: 'level.name.endless',
      difficulty: beat === 3 ? 'reward' : 'hard',
      difficultyScalar: Number((0.75 + d * 0.6).toFixed(3)),
      turnLengthSec: Math.round(restaurant.turnLengthSec + d * 15),
      spawnIntervalSec: Number(Math.max(3.4, 9.0 - d * 4.2 - tier * 0.45).toFixed(2)),
      patienceScalar: Number((1.3 - d * 0.46).toFixed(3)),
      maxOrdersOnScreen: restaurant.maxOrders,
      vipChance: 0.1,
      targetStars3ServedPct: 0.9,
      rewards: {
        coins: Math.round(80 + d * 160 + tier * 260),
        xp: Math.round(18 + d * 40 + tier * 22),
        firstClearBonus: { coins: 0, xp: 0 }
      }
    });
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { db, problems } = loadAndValidate();
  if (problems.length) {
    console.error('Refusing to generate levels: data problems\n' + problems.join('\n'));
    process.exit(1);
  }
  const tiers: [number, number][] = [[0, 24], [1, 36]];
  const table = generateLevels(tiers);
  const out = join(DATA_DIR, 'levels.json');
  writeFileSync(out, `${JSON.stringify(table, null, 2)}\n`, 'utf8');

  const byDiff = table.levels.reduce<Record<string, number>>((acc, l) => {
    acc[l.difficulty] = (acc[l.difficulty] ?? 0) + 1;
    return acc;
  }, {});
  console.log(`wrote ${table.levels.length} levels → ${out}`);
  console.log(`difficulty mix: ${JSON.stringify(byDiff)}`);
  console.log(`restaurants covered: ${[...new Set(table.levels.map((l) => l.restaurantIndex))].join(', ')} (db has ${db.restaurantByIndex.size} tiers)`);
  const maxSpawn = Math.max(...table.levels.map((l) => l.spawnIntervalSec));
  const minSpawn = Math.min(...table.levels.map((l) => l.spawnIntervalSec));
  console.log(`spawn interval range: ${minSpawn}s .. ${maxSpawn}s`);
  console.log(`patience scalar range: ${Math.min(...table.levels.map((l) => l.patienceScalar))} .. ${Math.max(...table.levels.map((l) => l.patienceScalar))}`);
}
