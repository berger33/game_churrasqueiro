/**
 * check-l10n — localisation coverage gate (`npm run check-l10n`).
 *
 * Enforces §56 (no hardcoded text). It proves three things:
 *   1. every key referenced by the data tables exists in pt-BR (the authored locale);
 *   2. no gameplay table contains a literal accented string that should be a key;
 *   3. every secondary locale either has full coverage or is explicitly declared
 *      a stub (stubs fall back to pt-BR at runtime, which is allowed).
 *
 * Exit 1 on any problem so CI fails before an untranslated string ships.
 */
import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { missingKeys, type L10nTable } from '../sim-core/src/l10n.ts';

const ROOT = join(import.meta.dirname, '..', '..');
const DATA = join(ROOT, 'shared', 'data');
const L10N = join(ROOT, 'shared', 'l10n');

/** Fields whose string values are localisation keys rather than literals. */
const KEY_FIELDS = /^(nameKey|descKey|taglineKey|reactionPerfectKey|reactionGoodKey|reactionBurnedKey|reactionLostKey|effectKey|titleKey|subtitleKey|labelKey|hintKey|introKey|bodyKey|ctaKey|blurbKey|voiceKey|flavorKey)$/;

/** Locales that must be 100% complete before release. */
const REQUIRED_LOCALES = ['pt-BR'];

/** Locales allowed to be partial; they fall back to pt-BR at runtime. */
const STUB_LOCALES = ['en-US', 'es-419'];

interface Problem { area: string; message: string; }
const problems: Problem[] = [];
const fail = (area: string, message: string): void => { problems.push({ area, message }); };

// ── Collect keys referenced by the data tables ──────────────────────────────
const referenced = new Map<string, string[]>();

function walk(node: unknown, file: string): void {
  if (Array.isArray(node)) {
    for (const v of node) walk(v, file);
    return;
  }
  if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      if (typeof v === 'string' && KEY_FIELDS.test(k)) {
        const list = referenced.get(v);
        if (list) list.push(file);
        else referenced.set(v, [file]);
      }
      walk(v, file);
    }
  }
}

const dataFiles = (await readdir(DATA)).filter((f) => f.endsWith('.json')).sort();
for (const f of dataFiles) {
  walk(JSON.parse(await readFile(join(DATA, f), 'utf8')), f);
}

// ── Load locale tables ──────────────────────────────────────────────────────
const tables = new Map<string, L10nTable>();
for (const locale of [...REQUIRED_LOCALES, ...STUB_LOCALES]) {
  const path = join(L10N, `${locale}.json`);
  if (!existsSync(path)) {
    if (REQUIRED_LOCALES.includes(locale)) fail(locale, `required locale file is missing: shared/l10n/${locale}.json`);
    continue;
  }
  try {
    tables.set(locale, JSON.parse(await readFile(path, 'utf8')) as L10nTable);
  } catch (e) {
    fail(locale, `invalid JSON: ${(e as Error).message}`);
  }
}

// ── 1. Required locales cover every referenced key ──────────────────────────
const requiredKeys = [...referenced.keys()].sort();
for (const locale of REQUIRED_LOCALES) {
  const table = tables.get(locale);
  if (!table) continue;
  const missing = missingKeys(table, requiredKeys);
  if (missing.length) {
    fail(locale, `${missing.length} key(s) referenced by data tables are not translated:`);
    for (const k of missing.slice(0, 12)) {
      fail(locale, `    ${k}   (used by ${[...new Set(referenced.get(k)!)].join(', ')})`);
    }
    if (missing.length > 12) fail(locale, `    …and ${missing.length - 12} more`);
  }
  // Duplicate detection: a table is an object so duplicates silently collapse,
  // but an empty value is almost always an accident.
  for (const [k, v] of Object.entries(table)) {
    if (typeof v !== 'string') fail(locale, `${k}: value must be a string`);
    else if (v.trim() === '') fail(locale, `${k}: empty translation`);
  }
}

// ── 2. Stub locales report coverage, and never claim completeness ───────────
const baseTable = tables.get(REQUIRED_LOCALES[0]!) ?? {};
const baseKeys = Object.keys(baseTable);
for (const locale of STUB_LOCALES) {
  const table = tables.get(locale);
  if (!table) continue;
  const missing = missingKeys(table, baseKeys);
  const coverage = baseKeys.length ? ((baseKeys.length - missing.length) / baseKeys.length) * 100 : 0;
  console.log(`  ${locale.padEnd(8)} coverage ${coverage.toFixed(1).padStart(5)}%  (${baseKeys.length - missing.length}/${baseKeys.length} keys, falls back to pt-BR)`);
  // A stub must not contain keys that do not exist in the authored locale —
  // those would be orphans nobody can ever render.
  const orphans = Object.keys(table).filter((k) => !(k in baseTable));
  if (orphans.length) fail(locale, `${orphans.length} orphan key(s) not present in pt-BR: ${orphans.slice(0, 6).join(', ')}`);
}

// ── 3. No literal player-facing text hiding in the gameplay tables ──────────
// Any accented character in a data table means someone typed a real word instead
// of a key. Identifiers are ASCII by construction, so this catches the mistake.
const accented = /[À-ÿà-ÿ]/;
for (const f of dataFiles) {
  const raw = await readFile(join(DATA, f), 'utf8');
  const lines = raw.split('\n');
  lines.forEach((line, i) => {
    if (!accented.test(line)) return;
    // Comments and documentation fields are allowed to be prose.
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('"_') || trimmed.startsWith('*')) return;
    fail(f, `line ${i + 1}: accented literal text — use a *Key field and translate it: ${trimmed.slice(0, 90)}`);
  });
}

// ── Report ──────────────────────────────────────────────────────────────────
console.log('── CHURRASCO! localisation check ─────────────────────────────');
console.log(`data tables scanned : ${dataFiles.length}`);
console.log(`keys referenced     : ${requiredKeys.length}`);
for (const locale of REQUIRED_LOCALES) {
  const t = tables.get(locale);
  if (t) console.log(`${locale.padEnd(22)}: ${Object.keys(t).length} keys (authored locale, must be complete)`);
}

if (problems.length === 0) {
  console.log('');
  console.log('OK — every referenced key is translated and no literal text leaked into data');
  process.exit(0);
}

console.error('');
console.error(`${problems.length} problem(s):`);
for (const p of problems) console.error(`  [${p.area}] ${p.message}`);
process.exit(1);
