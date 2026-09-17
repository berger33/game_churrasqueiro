/**
 * Derives `shared/schema/*.schema.json` from the real tables in `shared/data`.
 *
 * Every table already declares a `$schema` pointing at `schema/<name>.schema.json`,
 * but those files did not exist — 18 dangling references. Rather than hand-write
 * 18 schemas (and guess shapes wrong), this reads the actual data and emits a
 * schema that matches it: types, required-vs-optional from observed presence,
 * and enums from observed distinct values.
 *
 * It is deliberately conservative. Where a field's meaning is not knowable from
 * the data alone it emits a permissive type; the semantic rules that matter
 * (referential integrity, reachability, monotonic curves) stay in
 * `validate-data.ts`, which can see across tables. A schema's job is to catch a
 * malformed *shape*, not a wrong *number*.
 *
 * Usage:
 *   node tools/studio/gen-schemas.mjs           write schemas
 *   node tools/studio/gen-schemas.mjs --check   assert they are up to date
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..', '..');
const DATA = join(ROOT, 'shared', 'data');
const SCHEMA = join(ROOT, 'shared', 'schema');
const CHECK = process.argv.includes('--check');

/** Hand-authored constraints, keyed by table then JSON-pointer-ish path. */
const OVERRIDES = {
  'ingredients.json': {
    title: 'Ingredients',
    minItems: { items: 12 },
    enums: {
      'items[].category': ['beef', 'sausage', 'poultry', 'skewer', 'cheese', 'bread', 'sides'],
      'items[].rarity': ['common', 'uncommon', 'rare', 'epic'],
      'items[].cookMethod': ['grill', 'prep'],
      'items[].idealZone': ['low', 'medium', 'high', 'none'],
      'items[].sides': [1, 2, 4]
    }
  },
  'customers.json': {
    title: 'Customers',
    minItems: { customers: 8 },
    enums: { 'customers[].voiceSet': null }
  },
  'upgrades.json': {
    title: 'Upgrades',
    minItems: { tracks: 20 },
    enums: { 'tracks[].category': null, 'tracks[].currency': ['coins', 'embers'] }
  },
  'achievements.json': { title: 'Achievements', minItems: { achievements: 30 } },
  'analytics.json': { title: 'Analytics event taxonomy', minItems: { events: 40 } },
  'levels.json': { title: 'Campaign levels', minItems: { levels: 50 } },
  'restaurants.json': { title: 'Restaurants (progression spine)' },
  'economy.json': { title: 'Economy rules' },
  'grill.json': { title: 'Grill' },
  'iap.json': { title: 'In-app purchases', enums: { 'products[].type': null } },
  'ads.json': { title: 'Ad placements' },
  'performance.json': { title: 'Performance quality levels' },
  'regions.json': { title: 'Regions' },
  'route.json': { title: 'Route stops' },
  'pass.json': { title: 'Season pass' },
  'missions.json': { title: 'Daily and weekly missions' },
  'events.json': { title: 'Live events' },
  'collection.json': { title: 'Collection' },
  'employees.json': { title: 'Employees', enums: { 'roles[].rarity': ['common', 'uncommon', 'rare', 'epic'] } },
  'remoteconfig_defaults.json': { title: 'Remote Config defaults' }
};

/**
 * Id conventions differ per table, and forcing one pattern rejected valid data:
 *
 *   ingredients / upgrades / customers  snake_case keys      grill_size
 *   iap products                        reverse-DNS SKUs     brasa.coins.small.v1
 *   performance quality levels          uppercase tiers      LOW | MEDIUM | HIGH
 *
 * So the default is snake_case and a table opts out by declaring its own.
 */
const ID_RE = '^[a-z][a-z0-9_]*$';
/**
 * Keyed by table, then by the array path the id belongs to. '*' is the default
 * for that table. Scoping by path matters: iap.json's `products[].id` is a
 * dotted store SKU but the nested `products[].contents[].id` is plain snake_case
 * (`avental_mestre`), so one table can legitimately need two conventions.
 */
const ID_PATTERNS = {
  'iap.json': {
    products: '^[a-z][a-z0-9_]*(\\.[a-z0-9]+)+$',
    '*': ID_RE
  },
  // Quality tiers are referenced from C# and settings, so they are uppercase.
  'performance.json': { qualityLevels: '^[A-Z][A-Z0-9_]*$', '*': ID_RE }
};

function typeOf(v) {
  if (v === null) return { type: 'null' };
  if (Array.isArray(v)) return { type: 'array' };
  if (Number.isInteger(v)) return { type: 'integer' };
  if (typeof v === 'number') return { type: 'number' };
  return { type: typeof v };
}

/**
 * Merge the observed type of one value into a running schema for that key.
 * Integers widen to number if any sibling is fractional.
 */
function mergeValue(acc, v) {
  if (v === null || v === undefined) { acc.nullable = true; return; }
  if (Array.isArray(v)) {
    acc.types.add('array');
    for (const el of v) {
      mergeValue(acc.items ??= { types: new Set(), values: [], objs: [], items: null }, el);
    }
    return;
  }
  if (typeof v === 'object') {
    acc.types.add('object');
    acc.objs.push(v);
    return;
  }
  const t = typeOf(v);
  acc.types.add(t.type);
  if (t.type === 'integer' && acc.types.has('number')) acc.types.delete('integer');
  acc.values.push(v);
}

function emitForObserved(acc, overrideEnum, path) {
  if (overrideEnum) return { enum: overrideEnum };

  const types = [...acc.types];
  // object
  if (types.includes('object') && acc.objs.length) return buildObjectSchema(acc.objs, path);

  // array
  if (types.includes('array')) {
    const schema = { type: 'array' };
    if (acc.items) schema.items = emitForObserved(acc.items, null, path);
    return schema;
  }

  // scalar
  if (types.length === 1) {
    const t = types[0];
    if (t === 'string') {
      // Hex colours are a recognisable, checkable shape.
      const allHex = acc.values.length > 0 && acc.values.every((s) => /^#[0-9A-Fa-f]{6}$/.test(s));
      if (allHex) return { type: 'string', pattern: '^#[0-9A-Fa-f]{6}$' };
      // A closed vocabulary observed across many rows is very likely an enum.
      const distinct = [...new Set(acc.values)].sort();
      if (acc.values.length >= 4 && distinct.length <= Math.max(4, acc.values.length / 2)) {
        return { enum: distinct };
      }
      return { type: 'string' };
    }
    if (t === 'boolean') return { type: 'boolean' };
    return { type: t };
  }
  if (types.length > 1) return { type: types };
  return {};
}

function buildObjectSchema(objs, path) {
  const present = new Map();
  for (const o of objs) for (const k of Object.keys(o)) present.set(k, (present.get(k) ?? 0) + 1);

  const props = {};
  const required = [];
  for (const [k, count] of [...present].sort()) {
    const acc = { types: new Set(), values: [], objs: [], items: null, nullable: false };
    for (const o of objs) if (o[k] !== undefined) mergeValue(acc, o[k]);
    const childPath = path ? `${path}.${k}` : k;
    props[k] = emitForObserved(acc, ENUM_LOOKUP.get(childPath), k);
    if (k === 'id' && props[k].type === 'string') {
      const pat = ID_PATTERN_BY_PATH.get(path) ?? ID_PATTERN_BY_PATH.get('*') ?? ID_RE;
      props[k] = { type: 'string', pattern: pat };
    }
    if (count === objs.length) required.push(k);
  }
  const schema = { type: 'object', properties: props };
  if (required.length) schema.required = required.sort();
  return schema;
}

// Flatten the override enum map into dotted paths relative to each array.
const ENUM_LOOKUP = new Map();
/** Id patterns for the table currently being derived, keyed by array path. */
let ID_PATTERN_BY_PATH = new Map();

function derive(tableFile) {
  const data = JSON.parse(readFileSync(join(DATA, tableFile), 'utf8'));
  const cfg = OVERRIDES[tableFile] ?? { title: tableFile.replace('.json', '') };

  ENUM_LOOKUP.clear();
  ID_PATTERN_BY_PATH = new Map(Object.entries(ID_PATTERNS[tableFile] ?? { '*': ID_RE }));
  for (const [k, v] of Object.entries(cfg.enums ?? {})) {
    if (v) ENUM_LOOKUP.set(k, v);
  }

  const properties = {};
  const required = [];

  for (const key of Object.keys(data).sort()) {
    if (key === '$schema') { properties[key] = { type: 'string' }; continue; }
    if (key === '_comment' || key.startsWith('_')) { properties[key] = { type: 'string' }; continue; }

    const val = data[key];
    if (Array.isArray(val)) {
      const itemSchema = val.length && typeof val[0] === 'object' && val[0] !== null
        ? buildObjectSchema(val, key)
        : { type: val.length ? typeOf(val[0]).type : 'string' };
      const arr = { type: 'array', items: itemSchema };
      const min = cfg.minItems?.[key];
      if (min) {
        arr.minItems = min;
        arr.description = `§8 content floor: at least ${min} entries.`;
      }
      properties[key] = arr;
    } else if (val !== null && typeof val === 'object') {
      properties[key] = buildObjectSchema([val], key);
    } else {
      properties[key] = typeOf(val);
    }
    required.push(key);
  }

  return {
    $schema: 'http://json-schema.org/draft-07/schema#',
    $id: `schema/${tableFile.replace('.json', '.schema.json')}`,
    title: cfg.title,
    description: `Shape contract for shared/data/${tableFile}. Generated by tools/studio/gen-schemas.mjs — edit the generator, not this file.`,
    type: 'object',
    required: required.sort(),
    additionalProperties: false,
    properties
  };
}

// ── Run ─────────────────────────────────────────────────────────────────────
const tables = readdirSync(DATA).filter((f) => f.endsWith('.json')).sort();
let written = 0;
const drift = [];

for (const f of tables) {
  const schema = derive(f);
  const out = join(SCHEMA, f.replace('.json', '.schema.json'));
  const text = JSON.stringify(schema, null, 2) + '\n';

  if (CHECK) {
    if (!existsSync(out)) { drift.push(`${f}: schema missing`); continue; }
    if (readFileSync(out, 'utf8') !== text) drift.push(`${f}: schema out of date`);
  } else {
    writeFileSync(out, text);
    written++;
  }
}

if (CHECK) {
  if (drift.length) {
    console.error('[schema] FAIL — run `npm run gen-schemas`:');
    for (const d of drift) console.error('  · ' + d);
    process.exit(1);
  }
  console.log(`[schema] OK — ${tables.length} schemas in step with shared/data`);
} else {
  console.log(`[schema] wrote ${written} schemas to shared/schema`);
}
