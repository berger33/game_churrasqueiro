/** Read-only inventory gate; no Unity, raw images, regeneration or git mutation required.
 * Checks the on-disk checkout (therefore all shipped files in a clean CI checkout),
 * including unindexed files. Image decoding remains check-shots' responsibility.
 * --root is only an input fixture seam; the approved baseline is always this tool's.
 */
import { lstatSync, readdirSync, readFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';

const TOOL_ROOT = resolve(import.meta.dirname, '../..');
const HEADER = 'name,category,source,license,version,author,date,status,batch,file,notes'.split(',');
const ART = 'Assets/Art';
const RUNTIME = 'prototype/assets/art';
const NAME = /^(?:spr_|bg_|t_|ic_)[a-z0-9_]+$/;
const STATUSES = new Set(['approved', 'pending', 'rejected', 'superseded']);
type Dict = Record<string, unknown>;
type Row = Record<string, string>;
const object = (v: unknown, label: string): Dict => {
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error(`[INPUT] ${label}: expected object`);
  return v as Dict;
};
const relativePath = (v: unknown, prefix: string, extension: string): v is string =>
  typeof v === 'string' && v.startsWith(prefix + '/') && v.endsWith(extension)
  && !v.includes('\\') && !v.includes('\0') && v.split('/').every(p => p !== '' && p !== '.' && p !== '..');

/** Strict CSV, including CRLF, quoted commas, escaped quotes and multiline notes. */
function parseRegistry(text: string): Row[] {
  const rows: string[][] = [];
  let row: string[] = [], cell = '', quoted = false, closed = false;
  const error = () => { throw new Error('[REGISTRY_CSV] malformed quoting, header or row width'); };
  const endCell = () => { row.push(cell); cell = ''; closed = false; };
  const endRow = () => { endCell(); if (row.some(c => c !== '')) rows.push(row); row = []; };
  text = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') { quoted = false; closed = true; }
      else cell += c;
    } else if (c === ',') endCell();
    else if (c === '\r' || c === '\n') { endRow(); if (c === '\r' && text[i + 1] === '\n') i++; }
    else if (c === '"' && cell === '' && !closed) quoted = true;
    else { if (closed || c === '"') error(); cell += c; }
  }
  if (quoted) error();
  if (cell || row.length || closed) endRow();
  const header = rows.shift();
  if (!isDeepStrictEqual(header, HEADER) || rows.some(r => r.length !== HEADER.length)) error();
  return rows.map(r => Object.fromEntries(HEADER.map((key, i) => [key, r[i]!])));
}

function check(root: string): void {
  const errors: string[] = [];
  const assert = (ok: unknown, code: string, detail: string) => { if (!ok) errors.push(`[${code}] ${detail}`); };
  // Refuse links, including parent directories: never follow art outside the checkout.
  const safeFile = (file: string) => {
    let at = root;
    for (const part of file.split('/')) {
      at = join(at, part);
      if (lstatSync(at).isSymbolicLink()) throw new Error(`[SYMLINK] ${file}`);
    }
    return at;
  };
  const json = (file: string): Dict => object(JSON.parse(readFileSync(safeFile(file), 'utf8')), file);
  const walk = (dir: string): Set<string> => {
    const files = new Set<string>();
    const visit = (file: string) => {
      const stat = lstatSync(safeFile(file));
      if (stat.isDirectory()) for (const entry of readdirSync(join(root, file))) visit(`${file}/${entry}`);
      else if (stat.isFile()) files.add(file);
      else throw new Error(`[INPUT] not a regular file: ${file}`);
    };
    visit(dir); return files;
  };
  const masters = walk(ART);
  masters.delete(`${ART}/ASSET_REGISTRY.csv`);
  masters.delete(`${ART}/sprites.manifest.json`);
  const runtimeFiles = walk(RUNTIME);
  runtimeFiles.delete(`${RUNTIME}/index.json`);
  const registry = parseRegistry(readFileSync(safeFile(`${ART}/ASSET_REGISTRY.csv`), 'utf8'));
  const manifest = json(`${ART}/sprites.manifest.json`);
  const sprites = object(manifest.sprites, 'manifest.sprites');
  const foods = object(manifest.foods, 'manifest.foods');
  const runtime = json(`${RUNTIME}/index.json`);
  const shipped = object(runtime.sprites, 'runtime.sprites');
  const byName = new Map<string, Row>();
  const byFile = new Map<string, Row>();
  const batches = new Map<string, Dict | null>();

  for (const r of registry) {
    const name = r.name!, file = r.file!, batch = r.batch!;
    assert(!byName.has(name), 'REGISTRY_DUPLICATE_NAME', name);
    assert(!byFile.has(file), 'REGISTRY_DUPLICATE_FILE', file);
    byName.set(name, r); byFile.set(file, r);
    assert(NAME.test(name) && basename(file) === `${name}.png`, 'REGISTRY_NAME', `${name}: ${file}`);
    const validPath = relativePath(file, ART, '.png');
    assert(validPath, 'REGISTRY_PATH', `${name}: ${file}`);
    assert(validPath && masters.has(file), 'MASTER_MISSING', `${name}: ${file}`);
    assert(STATUSES.has(r.status!), 'REGISTRY_STATUS', `${name}: ${r.status}`);
    assert(r.status !== 'approved' || r.source === 'ai-assisted-reviewed', 'REGISTRY_APPROVAL', name);
    const validBatch = /^lote-\d{2}$/.test(batch);
    assert(validBatch, 'REGISTRY_BATCH', `${name}: ${batch}`);
    if (validBatch && !batches.has(batch)) {
      let spec: Dict | null = null;
      try { spec = json(`art/${batch}.json`); }
      catch (error) {
        // A bad JSON/spec is not equivalent to a missing optional batch; both fail closed.
        assert(false, 'BATCH_MISSING', `${batch}: ${String(error)}`);
      }
      batches.set(batch, spec);
    }
    const spec = batches.get(batch);
    if (spec) {
      assert(spec.batch === batch && spec.sourceDir === `art/source/${batch}`, 'BATCH_ID', batch);
      if (!Array.isArray(spec.assets)) throw new Error(`[INPUT] ${batch}.assets must be an array`);
      const candidates = spec.assets.map(a => object(a, `${batch}.asset`)).filter(a => {
        if (a.mode === 'grid') return Array.isArray(a.cells) && a.cells.some(c => `spr_food_${a.subject}_${c}` === name);
        if (a.mode === 'single' || a.mode === 'opaque') return a.name === name;
        if (['icons', 'components', 'strips'].includes(String(a.mode))) {
          return Array.isArray(a.names) && a.names.some(n => typeof n === 'string' ? n === name : object(n, 'batch.name').name === name);
        }
        throw new Error(`[INPUT] ${batch}: unknown mode ${a.mode}`);
      });
      const asset = candidates[0];
      assert(candidates.length === 1 && asset && `${asset.out}/${name}.png` === file
        && (asset.category ?? (asset.mode === 'icons' ? 'ui' : undefined)) === r.category,
      'BATCH_ASSET', `${name}: not a unique ${r.category} output at ${file} in ${batch}`);
      if (asset && sprites[name]) {
        const e = object(sprites[name], `manifest.${name}`);
        assert(e.source === `${spec.sourceDir}/${asset.source}`, 'MANIFEST_SOURCE', name);
      }
    }
    assert(Object.hasOwn(sprites, name), 'MANIFEST_MISSING', name);
    if (Object.hasOwn(sprites, name)) {
      const e = object(sprites[name], `manifest.${name}`);
      for (const key of ['file', 'batch', 'category']) assert(e[key] === r[key], 'MANIFEST_MISMATCH', `${name}.${key}`);
    }
    if (r.status === 'approved') assert(Object.hasOwn(shipped, name), 'RUNTIME_MISSING', name);
  }
  for (const file of masters) assert(byFile.has(file), 'MASTER_UNREGISTERED', file);
  for (const name of Object.keys(sprites)) assert(byName.has(name), 'MANIFEST_UNREGISTERED', name);

  assert(runtime.includePending === false, 'RUNTIME_REVIEW', 'includePending must be explicitly false');
  const expectedFiles = new Set<string>();
  for (const [name, value] of Object.entries(shipped)) {
    const entry = object(value, `runtime.${name}`);
    assert(byName.get(name)?.status === 'approved', 'RUNTIME_NOT_APPROVED', name);
    assert(NAME.test(name) && entry.file === `${name}.webp`, 'RUNTIME_PATH', `${name}: ${entry.file}`);
    const file = `${RUNTIME}/${name}.webp`;
    expectedFiles.add(file);
    assert(runtimeFiles.has(file), 'RUNTIME_FILE_MISSING', file);
  }
  for (const file of runtimeFiles) assert(expectedFiles.has(file), 'RUNTIME_ORPHAN', file);

  // Independent, reviewed identity floor: coordinated deletions and count-preserving
  // replacements cannot silently erase any of the 244 approved sprites from PR #13.
  const baseline = object(JSON.parse(readFileSync(join(TOOL_ROOT, 'art/approved-runtime-baseline.json'), 'utf8')), 'baseline');
  if (!Array.isArray(baseline.names) || baseline.names.length !== 244 || new Set(baseline.names).size !== 244
    || !baseline.names.every(n => typeof n === 'string' && NAME.test(n))) throw new Error('[INPUT] invalid approved baseline');
  for (const name of baseline.names as string[]) {
    assert(byName.get(name)?.status === 'approved' && Object.hasOwn(sprites, name) && Object.hasOwn(shipped, name),
      'BASELINE_MISSING', name);
  }

  // Food definitions must cover every food sprite, even if both lookup tables were deleted.
  // Runtime lookups are checked independently of the builder; no regeneration can hide drift.
  const expectedFoods: Dict = {}, usedFoodFrames = new Set<string>();
  for (const [subject, value] of Object.entries(foods)) {
    const food = object(value, `foods.${subject}`), states = object(food.states, `foods.${subject}.states`);
    const frames = [...Object.entries(states), ['served', food.served]];
    for (const [stage, ref] of frames) {
      assert(typeof ref === 'string' && ref === `spr_food_${subject}_${stage}` && byName.get(ref)?.category === 'food',
        'MANIFEST_FOOD', `${subject}.${stage}: ${ref}`);
      if (typeof ref === 'string') usedFoodFrames.add(ref);
    }
    assert(Object.keys(states).length > 0, 'MANIFEST_FOOD', `${subject}: empty states`);
    if (frames.every(([, ref]) => typeof ref === 'string' && byName.get(ref)?.status === 'approved')) {
      expectedFoods[subject] = { kind: food.kind ?? 'grill', states, served: food.served };
    }
  }
  for (const r of registry) if (r.category === 'food') assert(usedFoodFrames.has(r.name!), 'MANIFEST_FOOD', `${r.name}: missing food definition`);

  const customers: Record<string, string[]> = {}, grills: Record<string, Record<string, string>> = {};
  const backgrounds: Dict = {}, props: Dict = {}, fx: Dict = {}, icons: Dict = {};
  for (const name of [...byName.keys()].sort((a, b) => a.localeCompare(b))) {
    if (byName.get(name)?.status !== 'approved') continue;
    let m: RegExpMatchArray | null;
    if ((m = name.match(/^spr_char_customer_(.+?)(?:_([ab]))?$/))) (customers[m[1]!] ??= []).push(name);
    else if ((m = name.match(/^spr_grill_(.+)_evo(\d+)$/))) (grills[m[1]!] ??= {})[m[2]!] = name;
    else if ((m = name.match(/^bg_restaurant_(.+)$/))) backgrounds[m[1]!] = name;
    else if ((m = name.match(/^spr_prop_(.+)$/))) props[m[1]!] = name;
    else if ((m = name.match(/^t_fx_(.+)$/))) fx[m[1]!] = name;
    else if (name.startsWith('ic_')) icons[name] = name;
  }
  for (const [key, expected] of Object.entries({ foods: expectedFoods, customers, grills, backgrounds, props, fx, icons })) {
    assert(isDeepStrictEqual(runtime[key], expected), 'RUNTIME_LOOKUP', key);
  }
  if (errors.length) throw new Error(errors.join('\n'));
  const approved = registry.filter(r => r.status === 'approved').length;
  console.log(`[art-registry] OK — ${registry.length} masters/rows/manifest entries; ${approved} approved; ${Object.keys(shipped).length} runtime sprites; 244 baseline IDs preserved`);
}

try {
  const args = process.argv.slice(2);
  if (args.length && (args.length !== 2 || args[0] !== '--root' || !args[1])) throw new Error('[INPUT] usage: check-art-registry.ts [--root <checkout>]');
  check(args[1] ? resolve(args[1]) : TOOL_ROOT);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[art-registry] FAIL\n${message.startsWith('[') ? message : '[INPUT] ' + message}`);
  process.exitCode = 1;
}
