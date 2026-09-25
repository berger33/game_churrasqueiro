/**
 * Data validation CLI (`npm run validate`).
 *
 * Checks that every table is structurally sound and internally consistent before
 * anything else runs. CI fails here first so a broken table never reaches the
 * simulator, the Unity client or a build.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { DATA_DIR, loadAndValidate, readJson } from './load-data.ts';
import { validateDatabase } from '../sim-core/src/data.ts';
import { generateLevels } from './gen-levels.ts';

type Problem = { file: string; message: string };

const problems: Problem[] = [];
const fail = (file: string, message: string): void => {
  problems.push({ file, message });
};

// ── 1. Every table parses ────────────────────────────────────────────────────
const requiredFiles = [
  'ingredients.json', 'grill.json', 'customers.json', 'restaurants.json', 'upgrades.json',
  'economy.json', 'employees.json', 'achievements.json', 'missions.json', 'events.json',
  'collection.json', 'regions.json', 'route.json', 'pass.json', 'iap.json', 'ads.json',
  'analytics.json', 'performance.json', 'remoteconfig_defaults.json', 'churrasqueiras.json'
];

for (const f of requiredFiles) {
  const path = join(DATA_DIR, f);
  if (!existsSync(path)) {
    fail(f, 'missing file');
    continue;
  }
  try {
    readJson(f);
  } catch (e) {
    fail(f, `invalid JSON: ${(e as Error).message}`);
  }
}

// ── 2. Core database integrity ───────────────────────────────────────────────
const { db, problems: dbProblems } = loadAndValidate();
for (const p of dbProblems) fail('core', p);

// ── 3. Referential integrity across the meta tables ─────────────────────────
const collectionEntries = (readJson('collection.json') as {
  entries: { id: string; refId: string; category: string; refType: string }[];
}).entries;

const achievements = readJson('achievements.json') as {
  achievements: { id: string; stat: string; goal: number; reward: Record<string, unknown> }[];
};

// An achievement whose goal exceeds the content that ships is unreachable, so it
// can never be earned. This caught `collection_all_mvp` asking for 40 entries when
// collection.json ships 37.
for (const a of achievements.achievements) {
  if (a.stat === 'collectionEntries' && a.goal > collectionEntries.length) {
    fail('achievements.json', `${a.id}: goal ${a.goal} exceeds the ${collectionEntries.length} entries that ship — achievement is unreachable`);
  }
  if (a.goal <= 0) fail('achievements.json', `${a.id}: goal must be > 0`);
}
const achIds = new Set<string>();
for (const a of achievements.achievements) {
  if (achIds.has(a.id)) fail('achievements.json', `duplicate id "${a.id}"`);
  achIds.add(a.id);
  const reward = a.reward;
  if (reward && typeof reward === 'object' && 'collection' in reward) {
    const ref = String(reward['collection']);
    // Trophies granted by achievements are collection entries; the achievement may
    // reference either the entry id (`c_coroa_da_brasa`) or its content id
    // (`coroa_da_brasa`).
    if (!collectionEntries.some((e) => e.id === ref || e.refId === ref)) {
      fail('achievements.json', `${a.id} grants unknown collection ref "${ref}"`);
    }
  }
}

// One shape for both pools: a union here narrows `requiresIngredient` to `unknown`
// after the `in` check, which then cannot be passed to `ingredientById.has`.
type MissionDef = { id: string; stat: string; goal: number; requiresIngredient?: string };
const missions = readJson('missions.json') as {
  daily: { pool: MissionDef[]; count: number };
  weekly: { pool: MissionDef[]; count: number };
};
if (missions.daily.pool.length < missions.daily.count) {
  fail('missions.json', `daily pool (${missions.daily.pool.length}) is smaller than the number of missions offered (${missions.daily.count})`);
}
if (missions.weekly.pool.length < missions.weekly.count) {
  fail('missions.json', `weekly pool (${missions.weekly.pool.length}) is smaller than the number of missions offered (${missions.weekly.count})`);
}
for (const m of [...missions.daily.pool, ...missions.weekly.pool]) {
  if (m.goal <= 0) fail('missions.json', `${m.id}: goal must be > 0`);
  if (m.requiresIngredient && !db.ingredientById.has(m.requiresIngredient)) {
    fail('missions.json', `${m.id}: requiresIngredient "${m.requiresIngredient}" does not exist`);
  }
}

const events = readJson('events.json') as {
  weeklyRecurring: { id: string; modifiers: { ingredient?: string; category?: string }[] }[];
  defaults: { vipBaseChance: number };
};
const eventIds = new Set<string>();
for (const e of events.weeklyRecurring) {
  if (eventIds.has(e.id)) fail('events.json', `duplicate event id "${e.id}"`);
  eventIds.add(e.id);
  for (const mod of e.modifiers) {
    if (mod.ingredient && !db.ingredientById.has(mod.ingredient)) {
      fail('events.json', `${e.id}: modifier references unknown ingredient "${mod.ingredient}"`);
    }
  }
}
const vip = db.customerById.get('vip');
if (vip && vip.weight !== 0) fail('customers.json', 'VIP must have weight 0 (it is summoned, never rolled)');
if (events.defaults.vipBaseChance <= 0 || events.defaults.vipBaseChance > 0.5) {
  fail('events.json', 'vipBaseChance outside a sane range');
}

const collection = readJson('collection.json') as {
  categories: { id: string }[];
  entries: { id: string; category: string; refId: string; refType: string }[];
};
const catIds = new Set(collection.categories.map((c) => c.id));
const entryIds = new Set<string>();
for (const e of collection.entries) {
  if (entryIds.has(e.id)) fail('collection.json', `duplicate entry id "${e.id}"`);
  entryIds.add(e.id);
  if (!catIds.has(e.category)) fail('collection.json', `${e.id}: unknown category "${e.category}"`);
  if (e.refType === 'ingredient' && !db.ingredientById.has(e.refId)) {
    fail('collection.json', `${e.id}: refId "${e.refId}" is not a known ingredient`);
  }
}

const pass = readJson('pass.json') as {
  rules: { freeTrackContainsEssentialGameplay: boolean };
  tracks: { free: { tier: number }[]; premium: { tier: number }[] };
  season: { tiers: number };
};
if (pass.rules.freeTrackContainsEssentialGameplay !== false) {
  fail('pass.json', 'free track must never contain essential gameplay (spec §32)');
}
for (const [name, track] of Object.entries(pass.tracks)) {
  const tiers = track.map((t) => t.tier);
  if (new Set(tiers).size !== tiers.length) fail('pass.json', `${name} track has duplicate tiers`);
  for (const t of tiers) {
    if (t < 1 || t > pass.season.tiers) fail('pass.json', `${name} track tier ${t} is out of range 1..${pass.season.tiers}`);
  }
}

const route = readJson('route.json') as { stops: { index: number; region: string; id: string }[] };
const regions = readJson('regions.json') as { regions: { id: string }[] };
const regionIds = new Set(regions.regions.map((r) => r.id));
const stopIndices = route.stops.map((s) => s.index);
if (new Set(stopIndices).size !== stopIndices.length) fail('route.json', 'duplicate stop index');
stopIndices.forEach((v, i) => {
  if (v !== i + 1) fail('route.json', `stop indices must be contiguous from 1 (found ${v} at position ${i})`);
});
for (const s of route.stops) {
  if (!regionIds.has(s.region)) fail('route.json', `stop ${s.id}: unknown region "${s.region}"`);
}

const ads = readJson('ads.json') as {
  units: Record<string, { debug: string; release: string; enabled?: boolean }>;
  rewardedPlacements: { id: string }[];
};
const TEST_ACCOUNT = 'ca-app-pub-3940256099942544';
for (const [name, unit] of Object.entries(ads.units)) {
  if (!unit.debug) continue;
  if (!unit.debug.includes(TEST_ACCOUNT)) fail('ads.json', `${name}.debug is not a Google test unit id`);
  if (unit.release && unit.release !== 'REPLACE_IN_SECURE_CONFIG' && unit.release.includes(TEST_ACCOUNT)) {
    fail('ads.json', `${name}.release still points at a Google test unit`);
  }
}
const placementIds = new Set<string>();
for (const p of ads.rewardedPlacements) {
  if (placementIds.has(p.id)) fail('ads.json', `duplicate rewarded placement "${p.id}"`);
  placementIds.add(p.id);
}

const iap = readJson('iap.json') as { products: { id: string }[] };
const iapIds = new Set<string>();
for (const p of iap.products) {
  if (iapIds.has(p.id)) fail('iap.json', `duplicate product id "${p.id}"`);
  iapIds.add(p.id);
}

const analytics = readJson('analytics.json') as {
  events: { name: string; params: Record<string, string> }[];
  piiPolicy: { forbiddenParams: string[]; forbiddenParamSubstrings: string[] };
};
const eventNames = new Set<string>();
for (const e of analytics.events) {
  if (eventNames.has(e.name)) fail('analytics.json', `duplicate event name "${e.name}"`);
  eventNames.add(e.name);
  for (const param of Object.keys(e.params)) {
    const lower = param.toLowerCase();
    if (analytics.piiPolicy.forbiddenParams.includes(lower)) {
      fail('analytics.json', `${e.name}: forbidden PII parameter "${param}"`);
    }
    for (const sub of analytics.piiPolicy.forbiddenParamSubstrings) {
      if (lower.includes(sub) && lower !== 'install_id') {
        fail('analytics.json', `${e.name}: parameter "${param}" matches forbidden substring "${sub}"`);
      }
    }
  }
}

const perf = readJson('performance.json') as {
  qualityLevels: { id: string; maxDrawCalls?: number; particlesMultiplier: number }[];
  budget: { maxDrawCallsLow: number; maxDrawCallsMedium: number; maxDrawCallsHigh: number };
};
const budgets: Record<string, number> = {
  LOW: perf.budget.maxDrawCallsLow,
  MEDIUM: perf.budget.maxDrawCallsMedium,
  HIGH: perf.budget.maxDrawCallsHigh
};
for (const q of perf.qualityLevels) {
  const budget = budgets[q.id];
  if (budget === undefined) fail('performance.json', `quality level "${q.id}" has no draw-call budget`);
  if (q.particlesMultiplier <= 0 || q.particlesMultiplier > 1) {
    fail('performance.json', `${q.id}: particlesMultiplier must be in (0, 1]`);
  }
}
const byId = new Map(perf.qualityLevels.map((q) => [q.id, q]));
const low = byId.get('LOW')?.particlesMultiplier ?? 1;
const high = byId.get('HIGH')?.particlesMultiplier ?? 0;
if (low >= high) fail('performance.json', 'LOW quality must use fewer particles than HIGH');

// ── 4. The level generator must produce a sane, playable curve ──────────────
const levels = generateLevels([[0, 24], [1, 36]]).levels;
if (levels.length !== 60) fail('levels', `expected 60 authored levels, got ${levels.length}`);
const ids = new Set<string>();
for (const l of levels) {
  if (ids.has(l.id)) fail('levels', `duplicate level id "${l.id}"`);
  ids.add(l.id);
  if (!db.restaurantByIndex.has(l.restaurantIndex)) fail('levels', `${l.id}: unknown restaurant index`);
  if (l.spawnIntervalSec <= 0) fail('levels', `${l.id}: spawnIntervalSec must be > 0`);
  if (l.patienceScalar <= 0) fail('levels', `${l.id}: patienceScalar must be > 0`);
  if (l.turnLengthSec < 30) fail('levels', `${l.id}: turnLengthSec suspiciously short`);
}
// §77: no frustration streak — never more than three rising-difficulty turns in a row.
let rising = 0;
for (let i = 1; i < levels.length; i++) {
  if (levels[i]!.difficultyScalar > levels[i - 1]!.difficultyScalar) rising++;
  else rising = 0;
  if (rising > 3) fail('levels', `${levels[i]!.id}: ${rising} consecutive difficulty increases (frustration streak)`);
}

// ── 5. No literal localisation strings in gameplay tables ───────────────────
const accented = /[à-üÀ-Ü]/;
for (const f of ['ingredients.json', 'customers.json', 'restaurants.json', 'upgrades.json', 'achievements.json', 'missions.json', 'events.json', 'collection.json']) {
  const raw = readFileSync(join(DATA_DIR, f), 'utf8');
  if (accented.test(raw)) fail(f, 'contains accented literal text — use *Key fields and the localisation tables');
}

// ── Report ──────────────────────────────────────────────────────────────────
const files = readdirSync(DATA_DIR).filter((f) => f.endsWith('.json'));
console.log(`── CHURRASCO! data validation ────────────────────────────────`);
console.log(`tables checked : ${files.length}`);
console.log(`ingredients    : ${db.ingredientById.size}`);
console.log(`customers      : ${db.customerById.size}`);
console.log(`restaurants    : ${db.restaurantByIndex.size}`);
console.log(`upgrade tracks : ${db.upgradeById.size}`);
console.log(`achievements   : ${achievements.achievements.length}`);
console.log(`collection     : ${collection.entries.length} entries in ${collection.categories.length} categories`);
console.log(`analytics      : ${analytics.events.length} events`);
console.log(`authored levels: ${levels.length}`);
console.log('');

if (problems.length === 0) {
  console.log('OK — all data tables valid and internally consistent');
  process.exit(0);
} else {
  console.error(`${problems.length} problem(s):`);
  for (const p of problems) console.error(`  [${p.file}] ${p.message}`);
  process.exit(1);
}

void validateDatabase;
