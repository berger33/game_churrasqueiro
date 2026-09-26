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
import { costFor } from '../sim-core/src/economy.ts';
import { TUTORIAL_EVENT_PARAMS, TUTORIAL_TRIGGERS, type TutorialTable } from '../sim-core/src/tutorial.ts';
import { generateLevels } from './gen-levels.ts';

type Problem = { file: string; message: string };

function readJsonAbs<T = Record<string, unknown>>(p: string): T {
  return JSON.parse(readFileSync(p, 'utf8')) as T;
}



const ROOT = join(DATA_DIR, '..', '..');

const problems: Problem[] = [];
const fail = (file: string, message: string): void => {
  problems.push({ file, message });
};

// ── 1. Every table parses ────────────────────────────────────────────────────
const requiredFiles = [
  'ingredients.json', 'grill.json', 'customers.json', 'restaurants.json', 'upgrades.json',
  'economy.json', 'employees.json', 'achievements.json', 'missions.json', 'events.json',
  'collection.json', 'regions.json', 'route.json', 'pass.json', 'iap.json', 'ads.json',
  'analytics.json', 'performance.json', 'remoteconfig_defaults.json', 'churrasqueiras.json',
  'tutorial.json'
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

// ── 5. The FTUE script (docs/05-UX_FLOW.md §4) ──────────────────────────────
// A tutorial that points at a missing id, sends an undeclared event or asks for
// an upgrade the player cannot afford is a first-run dead end, so every link out
// of tutorial.json is checked here rather than discovered on a fresh install.
const tut = readJson('tutorial.json') as TutorialTable;
{
  const T = 'tutorial.json';
  const steps = tut.steps ?? [];
  steps.forEach((st, i) => {
    if (st.index !== i + 1) fail(T, `step "${st.id}": index ${st.index} at position ${i} — indices must be contiguous from 1`);
    if (!(TUTORIAL_TRIGGERS as readonly string[]).includes(st.completesOn)) {
      fail(T, `step "${st.id}": completesOn "${st.completesOn}" is not a trigger the director knows (${TUTORIAL_TRIGGERS.join(', ')})`);
    }
  });
  if (new Set(steps.map((st) => st.id)).size !== steps.length) fail(T, 'duplicate step id');
  if (new Set(steps.map((st) => st.completesOn)).size !== steps.length) fail(T, 'two steps complete on the same trigger — the second could never complete');
  if (steps.filter((st) => st.event === 'tutorial_complete').length !== 1) fail(T, 'exactly one step must send tutorial_complete');
  const firstHome = steps.findIndex((st) => st.screen === 'home');
  if (firstHome >= 0 && steps.slice(firstHome).some((st) => st.screen === 'play')) {
    fail(T, 'play steps after a home step — the scripted turn must be one contiguous block');
  }
  if (tut.targetDurationSec > 60) fail(T, `targetDurationSec ${tut.targetDurationSec} breaks the under-60-s rule (docs/05 §4)`);

  // Every event the director can send must be declared, with exactly its params.
  const declared = new Map(analyticsEventsForTutorial().map((e) => [e.name, e.params]));
  for (const [name, params] of Object.entries(TUTORIAL_EVENT_PARAMS)) {
    const d = declared.get(name);
    if (!d) { fail(T, `the director sends "${name}" but analytics.json does not declare it`); continue; }
    const want = [...params].sort().join(',');
    const have = Object.keys(d).sort().join(',');
    if (want !== have) fail(T, `"${name}" params differ — director sends [${want}], analytics.json declares [${have}]`);
  }

  // Referential integrity.
  const turn = tut.turn;
  const level = levelsForTutorial().find((l) => l.id === turn.levelId);
  if (!level) fail(T, `turn.levelId "${turn.levelId}" is not an authored level`);
  const ch = db.churrasqueiraById.get(turn.churrasqueiraId);
  if (!ch) fail(T, `turn.churrasqueiraId "${turn.churrasqueiraId}" is not in churrasqueiras.json`);
  else if (ch.unlockLevel > 1 || ch.unlockCostCoins > 0) fail(T, `turn.churrasqueiraId "${ch.id}" is not the free starter grill`);
  const ing = db.ingredientById.get(turn.ingredientId);
  if (!ing) fail(T, `turn.ingredientId "${turn.ingredientId}" does not exist`);
  else {
    if (ing.cookMethod !== 'grill' || ing.sides < 2) fail(T, `${ing.id}: the FTUE teaches the flip, so its item must be grilled and have >= 2 sides`);
    if (level && ing.unlock.restaurantIndex > level.restaurantIndex) fail(T, `${ing.id} is not unlocked at ${level.id}'s restaurant`);
    // Coach thresholds must describe a reachable, holdable PERFEITO.
    const [lo, hi] = ing.perfectWindow;
    const c = tut.coach;
    const ceiling = hi - c.holdBelowWindowHi;
    if (!(c.serveReadyMinDoneness >= lo && c.serveReadyMinDoneness < ceiling)) {
      fail(T, `coach: serveReadyMinDoneness ${c.serveReadyMinDoneness} must sit in [${lo}, ${ceiling.toFixed(2)}) — the perfect window under the hold ceiling`);
    }
    if (!(c.flipPromptAtSideDoneness > 0 && c.flipPromptAtSideDoneness < ceiling)) {
      fail(T, `coach: flipPromptAtSideDoneness ${c.flipPromptAtSideDoneness} must be above 0 and below the hold ceiling ${ceiling.toFixed(2)}`);
    }
    if (c.holdBelowWindowHi <= 0 || c.holdBelowWindowHi >= hi - lo) fail(T, 'coach: holdBelowWindowHi must be inside the perfect window');
  }
  if (turn.customers.length < 2) fail(T, 'turn.customers: step 3 serves the first customer, step 5 needs a second one');
  for (const cu of turn.customers) {
    const def = db.customerById.get(cu.customerId);
    if (!def) { fail(T, `turn.customers: unknown customer "${cu.customerId}"`); continue; }
    // The hold targets the ingredient's own window; a picky customer would narrow it.
    if (def.toleranceScale < 1) fail(T, `turn.customers: ${def.id} narrows the perfect window (toleranceScale ${def.toleranceScale}) — the guided serve could miss`);
    if (cu.order.length === 0 || cu.order.some((o) => o !== turn.ingredientId)) {
      fail(T, `turn.customers: ${def.id} must order only ${turn.ingredientId} — one variable at a time`);
    }
  }
  if (turn.customerPatienceSec <= turn.safetyLimitSec) fail(T, 'turn.customerPatienceSec must outlast turn.safetyLimitSec — nobody may leave during the FTUE');
  if (tut.skip.hitSizePx < 44) fail(T, `skip.hitSizePx ${tut.skip.hitSizePx} < 44 (docs/21: the 36x28 X was found by only 60%)`);

  // Step 6 must be affordable from a fresh install. Guaranteed income of the
  // scripted turn, counting nothing a player could miss: level reward + first
  // clear + the turn-end bonus for the one guided PERFEITO.
  const track = db.upgradeById.get(tut.upgradeTrackId);
  if (!track) fail(T, `upgradeTrackId "${tut.upgradeTrackId}" is not an upgrade track`);
  else if (track.currency !== 'coins') fail(T, `upgradeTrackId "${track.id}" costs ${track.currency}; a fresh install has none`);
  else if (level) {
    const bonus = db.economy.reward.turnEndBonus;
    const guaranteed = level.rewards.coins + level.rewards.firstClearBonus.coins + bonus.base + bonus.perPerfect;
    const cost = costFor(db, track.id, 0);
    if (guaranteed < cost) {
      fail(T, `step 6 unreachable: the FTUE guarantees ${guaranteed} coins but ${track.id} level 1 costs ${cost}`);
    }
  }
}

function analyticsEventsForTutorial(): { name: string; params: Record<string, string> }[] {
  return (readJson('analytics.json') as { events: { name: string; params: Record<string, string> }[] }).events;
}
function levelsForTutorial(): { id: string; restaurantIndex: number; rewards: { coins: number; firstClearBonus: { coins: number } } }[] {
  return (readJson('levels.json') as { levels: { id: string; restaurantIndex: number; rewards: { coins: number; firstClearBonus: { coins: number } } }[] }).levels;
}

// ── 6. No literal localisation strings in gameplay tables ───────────────────
const accented = /[à-üÀ-Ü]/;
// Nota de desenvolvedor nao e texto de jogo: `_comment` e `_*Note` sao lidos por quem mantem o
// repositorio, e exigir que eles sejam escritos sem acento so produzia portugues torto. A regra
// continua valendo para o campo de exibicao — literal acentuado em chave de UI segue proibido.
for (const f of ['ingredients.json', 'customers.json', 'restaurants.json', 'upgrades.json', 'achievements.json', 'missions.json', 'events.json', 'collection.json', 'churrasqueiras.json', 'grill.json', 'economy.json']) {
  const doc = readJson(f) as Record<string, unknown>;
  const stripNotes = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(stripNotes);
    if (v && typeof v === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, val] of Object.entries(v)) if (!k.startsWith('_')) out[k] = stripNotes(val);
      return out;
    }
    return v;
  };
  if (accented.test(JSON.stringify(stripNotes(doc)))) {
    fail(f, 'contains accented literal text in a display field — use *Key fields and the localisation tables');
  }
}

// ── A loja promete na tela o mesmo grid que o motor monta ───────────────────
// `churrasqueiras.json` carries the grid (zoneCount × slotsPerZone) and the l10n text sells it
// back to the player as "2 fileiras, 4 espetos". Those two drifted (inox evo2 said 7 for a 6-slot
// grill, evo3 said 8 for a 9-slot one) — and a description the art is drawn to measure becomes a
// contract nobody checks. The text is data, so it is validated as data.
const grillDescRe = /^(\d+) fileiras?[^\d]*?(\d+) espetos?/i;
const l10nPtBr = readJsonAbs(join(ROOT, 'shared', 'l10n', 'pt-BR.json'));
for (const ch of (readJson('churrasqueiras.json') as {
  churrasqueiras: { id: string; fileiras?: number; visual?: { style?: string }; evolutions: Record<string, never>[] }[]
}).churrasqueiras) {
  const zones = ch.evolutions.map((e) => Number(e.zoneCount));
  if (ch.fileiras !== undefined && Math.max(...zones) > ch.fileiras) {
    fail('churrasqueiras.json', `${ch.id}: an evolution has ${Math.max(...zones)} zones but the grill declares "fileiras": ${ch.fileiras}`);
  }
  for (const e of ch.evolutions) {
    const key = (e as { descKey?: string }).descKey;
    if (!key) continue;
    const text = l10nPtBr[key];
    if (typeof text !== 'string') { fail('churrasqueiras.json', `${ch.id} evo${e.level}: descKey "${key}" is not in shared/l10n/pt-BR.json`); continue; }
    const m = grillDescRe.exec(text);
    if (!m) continue; // only sentences that promise a grid are held to it
    const [fileiras, espetos] = [Number(m[1]), Number(m[2])];
    const cap = Number(e.zoneCount) * Number(e.slotsPerZone);
    if (fileiras !== Number(e.zoneCount)) fail('churrasqueiras.json', `${ch.id} evo${e.level}: "${text}" promises ${fileiras} fileiras, the grid is ${e.zoneCount}`);
    if (espetos !== cap) fail('churrasqueiras.json', `${ch.id} evo${e.level}: "${text}" promises ${espetos} vagas, the grid is ${cap} (${e.zoneCount}×${e.slotsPerZone})`);
  }
}

// ── A escada de churrasqueiras: leis de progressão ───────────────────────────
// Dez grelhas × três níveis só funcionam se nenhum degrau for armadilha e se a arte pintada para uma
// grelha continuar válida na próxima. As leis estão escritas em `churrasqueiras.json._comment`; aqui
// elas viram asserção, porque escada sem porta é só um buraco com degraus.
{
  const table = readJson('churrasqueiras.json') as {
    version?: number;
    churrasqueiras: {
      id: string; index: number; tier: string; unlockLevel: number; unlockCostCoins: number;
      visual?: { style?: string };
      evolutions: {
        level: number; zoneCount: number; slotsPerZone: number; heatBase: number;
        charcoalBonus?: number; costCoins: number; nameKey?: string; descKey?: string; shortNameKey?: string;
      }[];
    }[];
  };
  const ch = table.churrasqueiras;
  const cap = (e: { zoneCount: number; slotsPerZone: number }) => e.zoneCount * e.slotsPerZone;
  if (ch.length < 10) fail('churrasqueiras.json', `a escada pede 10 churrasqueiras, há ${ch.length}`);
  for (let i = 0; i < ch.length; i++) {
    const c = ch[i]!;
    if (c.index !== i) fail('churrasqueiras.json', `${c.id}: index ${c.index} fora da ordem (esperado ${i})`);
    if (c.evolutions.length !== 3) fail('churrasqueiras.json', `${c.id}: ${c.evolutions.length} evoluções, esperado 3`);
    if (i > 0) {
      if (c.unlockLevel < ch[i - 1]!.unlockLevel) fail('churrasqueiras.json', `${c.id}: unlockLevel ${c.unlockLevel} antes da anterior`);
      if (c.unlockCostCoins < ch[i - 1]!.unlockCostCoins) fail('churrasqueiras.json', `${c.id}: unlock mais barato que a grelha anterior`);
    }
    let prev: (typeof c.evolutions)[number] | undefined;
    for (const e of c.evolutions) {
      if (prev) {
        if (cap(e) < cap(prev)) fail('churrasqueiras.json', `${c.id} evo${e.level}: capacidade ${cap(e)} < ${cap(prev)} do degrau anterior`);
        if (e.heatBase < prev.heatBase - 1e-9) fail('churrasqueiras.json', `${c.id} evo${e.level}: heatBase recua`);
        if ((e.charcoalBonus ?? 0) < (prev.charcoalBonus ?? 0) - 1e-9 && cap(e) === cap(prev)) {
          fail('churrasqueiras.json', `${c.id} evo${e.level}: brasa mais curta sem ganhar vaga (charcoalBonus ${e.charcoalBonus} < ${prev.charcoalBonus})`);
        }
        if (e.costCoins < prev.costCoins) fail('churrasqueiras.json', `${c.id}: evo${e.level} custa menos que a evolução anterior`);
      }
      if (e.heatBase > 1.7 + 1e-9) fail('churrasqueiras.json', `${c.id} evo${e.level}: heatBase ${e.heatBase} acima do teto 1,70 da simulação`);
      prev = e;
    }
  }
  // ordem global dos 30 degraus (a arte é derivada do grid, então vale para a escada inteira)
  const rungs = ch.flatMap((c) => c.evolutions.map((e) => ({ id: `${c.id} evo${e.level}`, cap: cap(e), heat: e.heatBase, burn: e.charcoalBonus ?? 0 })));
  for (let i = 1; i < rungs.length; i++) {
    const a = rungs[i - 1]!, b = rungs[i]!;
    if (b.cap < a.cap) fail('churrasqueiras.json', `capacidade cai entre ${a.id} (${a.cap}) e ${b.id} (${b.cap})`);
    if (b.heat < a.heat - 1e-9) fail('churrasqueiras.json', `heatBase cai entre ${a.id} e ${b.id}`);
    if (b.burn < a.burn - 1e-9 && b.cap === a.cap) fail('churrasqueiras.json', `${b.id}: brasa mais curta e mesma capacidade que ${a.id} — degrau sem razão de existir`);
    if (b.cap <= a.cap && b.heat <= a.heat + 1e-9 && b.burn <= a.burn + 1e-9) {
      fail('churrasqueiras.json', `${b.id} não melhora nada sobre ${a.id}: degrau igual ou pior com preço maior`);
    }
  }
  // o texto da loja e da garagem promete o grid real — inclusive nos estilos novos
  const STYLES = ['lata', 'chapa', 'inox', 'fornalha', 'espeto', 'tambor', 'campeao'];
  for (const c of ch) {
    const style = c.visual?.style;
    if (style && !STYLES.includes(style)) {
      fail('churrasqueiras.json', `${c.id}: visual.style "${style}" não tem corpo em tools/art/make-ref.mjs (STYLE_BODIES) nem fallback no protótipo`);
    }
    for (const key of [`grill.${c.id.replace(/_([a-z])/g, (_m, l) => l.toUpperCase())}`, ''] as never[]) void key;
  }
  // todo nome/descrição de grelha e evolução precisa existir no pt-BR — a escada nova não pode chegar sem legenda
  for (const c of ch) {
    for (const key of [c.id]) void key;
    const need = [
      (c as unknown as { nameKey?: string; subtitleKey?: string; descKey?: string }),
      ...c.evolutions.map((e) => e as unknown as { nameKey?: string; descKey?: string })
    ];
    for (const o of need) {
      for (const key of [o.nameKey, o.descKey, (o as { subtitleKey?: string }).subtitleKey, (o as { shortNameKey?: string }).shortNameKey]) {
        if (typeof key === 'string' && typeof l10nPtBr[key] !== 'string') {
          fail('churrasqueiras.json', `${c.id}: chave de texto "${key}" ausente em shared/l10n/pt-BR.json`);
        }
      }
    }
  }
}

// ── Os três tipos de carvão ───────────────────────────────────────────────────
// O tipo padrão precisa reproduzir o jogo antigo (senão os vetores dourados andam por causa de
// tabela nova), e o preço de recarga é dreno de moedas: entra nas bandas de `coinSpendRatio`.
{
  const grill = readJson('grill.json') as {
    charcoal: {
      refillCostCoins: number; baseDurationSec: number;
      types?: { id: string; tier: number; durationMult: number; heatMult: number; refillCostCoins: number; unlockLevel: number; nameKey: string; descKey: string }[];
    };
  };
  const types = grill.charcoal.types ?? [];
  if (types.length !== 3) fail('grill.json', `carvão: ${types.length} tipos, esperado 3 (comum / vegetal / briquete)`);
  for (const id of ['comum', 'vegetal', 'briquete']) {
    if (!types.some((t) => t.id === id)) fail('grill.json', `carvão: falta o tipo "${id}"`);
  }
  let prevT: (typeof types)[number] | undefined;
  for (const t of types) {
    if (t.durationMult < 0.8 || t.durationMult > 1.6) fail('grill.json', `carvão ${t.id}: durationMult ${t.durationMult} fora de 0,8–1,6`);
    if (t.heatMult < 0.9 || t.heatMult > 1.15) fail('grill.json', `carvão ${t.id}: heatMult ${t.heatMult} fora de 0,90–1,15`);
    if (t.refillCostCoins < 0) fail('grill.json', `carvão ${t.id}: recarga com preço negativo`);
    for (const key of [t.nameKey, t.descKey]) {
      if (typeof l10nPtBr[key] !== 'string') fail('grill.json', `carvão ${t.id}: chave "${key}" ausente no pt-BR`);
    }
    if (prevT) {
      if (t.unlockLevel <= prevT.unlockLevel) fail('grill.json', `carvão ${t.id}: unlockLevel ${t.unlockLevel} não avança`);
      if (t.refillCostCoins <= prevT.refillCostCoins) fail('grill.json', `carvão ${t.id}: preço ${t.refillCostCoins} não supera ${prevT.refillCostCoins} — o upgrade tem de doer um pouco`);
      // Cada tipo melhora pelo menos um eixo sobre o anterior (e uma troca, nao um upgrade puro:
      // vegetal queima mais e mais brando, briquete queima mais quente e mais curto) e o eixo cedido
      // nao pode desabar — ai a diferenca vira taxa, nao escolha.
      if (t.durationMult <= prevT.durationMult + 1e-9 && t.heatMult <= prevT.heatMult + 1e-9) {
        fail('grill.json', `carvao ${t.id}: nem duracao nem temperatura melhoram as do tipo anterior`);
      }
      if (t.durationMult < prevT.durationMult * 0.85 || t.heatMult < prevT.heatMult * 0.85) {
        fail('grill.json', `carvao ${t.id}: um eixo cai mais de 15% abaixo do tipo anterior — troca dura demais`);
      }
    }
    prevT = t;
  }
  const base = types.find((t) => t.tier === 0) ?? types[0];
  if (base) {
    if (Math.abs(base.durationMult - 1) > 1e-9 || Math.abs(base.heatMult - 1) > 1e-9) {
      fail('grill.json', `carvão ${base.id}: o tipo base tem de ser 1,00x/1,00x — é ele que mantém a curva medida de hoje`);
    }
    if (base.refillCostCoins !== grill.charcoal.refillCostCoins) {
      fail('grill.json', `carvão ${base.id}: refillCostCoins ${base.refillCostCoins} difere do padrão da tabela ${grill.charcoal.refillCostCoins}`);
    }
  }
  // custo de recarga tem de caber na renda do nível em que destrava (senão é taxa, não escolha)
  const econ = readJson('economy.json') as { targets?: Record<string, unknown> };
  void econ;
  for (const t of types) {
    if (t.tier === 0) continue;
    const income = [1, 2.5, 5, 9, 15, 24, 38, 55, 80, 115];
    const band = Math.min(income.length - 1, Math.floor(t.unlockLevel / 8));
    const coinsPerMin = income[band]!;
    if (t.refillCostCoins > coinsPerMin * 60 * 0.35) {
      fail('grill.json', `carvão ${t.id}: ${t.refillCostCoins} moedas por recarga pesam demais para ~${coinsPerMin}/min no nível ${t.unlockLevel} (teto 35% de um turno)`);
    }
  }
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
console.log(`tutorial       : ${tut.steps.length} steps (${tut.variant}), target < ${tut.targetDurationSec}s`);
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
