/**
 * gen-csharp-types — emits the C# data classes from the JSON tables themselves
 * (`npm run gen-csharp-types`).
 *
 * Why generated: the first hand-written `Types.cs` invented fields that do not
 * exist in the data (`prepSec`, `carryover`, `burnedCoinFactor`) and omitted real
 * ones (`satisfaction`, `burnRate`, `idealZone`, `efficiencyCurve`). A port that
 * cannot bind the data is worse than no port. Deriving the classes from the tables
 * makes that class of mistake impossible and keeps the port in step when a table
 * gains a field.
 *
 *   node tools/studio/gen-csharp-types.mjs          write Assets/Scripts/Core/Generated/
 *   node tools/studio/gen-csharp-types.mjs --check  fail if the output would change
 *
 * Types are inferred from every element of every array: a field missing from
 * any element is emitted nullable (optionality is counted per element — it used
 * to be counted per parent, so `isVip`, present on one customer of eleven, came
 * out as a plain `bool` that serialised back `false` for the other ten). A
 * number written with a decimal point or an exponent (`2.0`, `1e3`) is a
 * `double` even when its value is whole: System.Text.Json will not read `2.0`
 * into an `int`, and the author meant a fractional quantity.
 */
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..', '..');
const DATA = join(ROOT, 'shared', 'data');
const OUT = join(ROOT, 'Assets', 'Scripts', 'Core', 'Generated');
const CHECK = process.argv.includes('--check');

// JSON files worth modelling in C#. Pure-editor tables (remote config defaults,
// ads, iap, …) are read as raw JSON by their services and need no class.
// analytics.json is modelled because the runtime contract (Analytics.cs) checks
// every event against it, as the TutorialDirector's tests do in TypeScript.
const MODELLED = [
  'ingredients.json', 'grill.json', 'customers.json', 'restaurants.json',
  'upgrades.json', 'economy.json', 'levels.json', 'employees.json',
  'collection.json', 'pass.json', 'churrasqueiras.json', 'tutorial.json',
  'analytics.json'
];

const pascal = (s) => s
  .replace(/[^a-zA-Z0-9]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ''))
  .replace(/^(.)/, (_, c) => c.toUpperCase());

const RESERVED = new Set(['class', 'int', 'float', 'double', 'string', 'object', 'new', 'base', 'operator', 'params', 'ref', 'out', 'in', 'is', 'as', 'lock', 'event']);
const safe = (s) => (RESERVED.has(s) ? `@${s}` : s);

/** `RAW_MAX`-style keys are kept verbatim: Pascal-casing them to `RAWMAX` broke binding. */
const SCREAMING = /^[A-Z][A-Z0-9_]*$/;
/** A key that can be a property name after Pascal-casing (`maxLevel` -> `MaxLevel`). */
const FIELD_KEY = /^[a-z][A-Za-z0-9]*$/;

/** C# property name for a JSON key. */
const propName = (key) => (SCREAMING.test(key) ? key : safe(pascal(key)));

/**
 * An object whose keys are data — ids (`espetinho_rua`) or numbers (`"15"`) —
 * not field names. It becomes `Dictionary<string, T>`: as a class it emitted
 * `public List<int> 15 { get; set; }`, which is not C#, and snake_case ids
 * Pascal-cased to `EspetinhoRua` would never bind anyway.
 */
function isMap(node) {
  const keys = [...(node.fields ?? new Map()).keys()];
  if (keys.length === 0 || keys.every((k) => SCREAMING.test(k))) return false;
  return keys.some((k) => !FIELD_KEY.test(k));
}

/** Merge one inferred shape into another (a map's values collapse into one type). */
function mergeNodes(dst, src) {
  for (const flag of ['string', 'bool', 'number', 'floating', 'nullable']) if (src[flag]) dst[flag] = true;
  if (src.arrayOf) mergeNodes(dst.arrayOf ??= {}, src.arrayOf);
  if (src.kind === 'object') {
    dst.kind = 'object';
    dst.objCount = (dst.objCount ?? 0) + (src.objCount ?? 0);
    dst.fields ??= new Map();
    for (const [k, f] of src.fields ?? new Map()) {
      let d = dst.fields.get(k);
      if (!d) { d = { seen: 0 }; dst.fields.set(k, d); }
      d.seen += f.seen;
      mergeNodes(d, f);
    }
  }
}

/** Merge a value's shape into a node describing an object type. */
function mergeObject(node, value) {
  node.kind = 'object';
  node.fields ??= new Map();
  if (!value || typeof value !== 'object') return;
  // How many objects were merged here: a field seen fewer times is optional.
  node.objCount = (node.objCount ?? 0) + 1;
  for (const [k, v] of Object.entries(value)) {
    if (k.startsWith('_') || k === '$schema') continue;
    let f = node.fields.get(k);
    if (!f) { f = { seen: 0 }; node.fields.set(k, f); }
    f.seen++;
    mergeInto(f, v);
  }
}

function mergeInto(node, value) {
  if (Array.isArray(value)) {
    node.arrayOf ??= {};
    for (const el of value) mergeInto(node.arrayOf, el);
    return;
  }
  if (value === null || value === undefined) { node.nullable = true; return; }
  // A decimal literal (see parseTable) — a double whatever its value.
  if (value instanceof Number) { node.number = true; node.floating = true; return; }
  const t = typeof value;
  if (t === 'string') { node.string = true; return; }
  if (t === 'boolean') { node.bool = true; return; }
  if (t === 'number') {
    node.number = true;
    if (!Number.isInteger(value)) node.floating = true;
    return;
  }
  if (t === 'object') { mergeObject(node, value); }
}

function walk(value, node = {}) {
  mergeInto(node, value);
  return node;
}

/**
 * JSON.parse, except that numbers written as decimals (`2.0`) come back as
 * `Number` objects so the type inference can tell them from integers. Needs the
 * reviver's source-text access (Node 22+, as the rest of the tooling does).
 */
function parseTable(text) {
  return JSON.parse(text, (key, value, ctx) =>
    typeof value === 'number' && ctx && typeof ctx.source === 'string' && /[.eE]/.test(ctx.source)
      ? new Number(value)
      : value);
}

/** C# type name for an inferred node. */
function csType(node, typeName, emitted) {
  if (!node) return 'object';
  if (node.arrayOf) {
    const inner = csType(node.arrayOf, typeName + 'Item', emitted);
    return `List<${inner}>`;
  }
  if (node.kind === 'object') return typeName;
  if (node.string) return 'string';
  if (node.bool) return 'bool';
  if (node.number) return node.floating ? 'double' : 'int';
  // Mixed or absent: fall back to raw JSON so nothing is silently dropped.
  return 'object';
}

/** Recursively emit classes for a node and its nested objects. */
/** The C# type of a map's values (`isMap`). */
function mapValueType(node, childName, out, emitted) {
  const value = {};
  for (const f of node.fields.values()) mergeNodes(value, f);
  if (value.arrayOf) {
    const inner = value.arrayOf.kind === 'object'
      ? emitClasses(value.arrayOf, `${childName}Item`, out, emitted)
      : csType(value.arrayOf, `${childName}Item`, emitted);
    return `List<${inner}>`;
  }
  if (value.kind === 'object') return emitClasses(value, `${childName}Value`, out, emitted);
  return csType(value, `${childName}Value`, emitted);
}

/**
 * Emit `node` as class `name`; nested classes are named `${prefix}${Key}`. The
 * prefix is the table stem, so a root class can be `CustomersTable` while its
 * rows stay `CustomersCustomers` (a root named after its own `customers`
 * member is CS0542).
 */
function emitClasses(node, name, out, emitted, prefix = name) {
  if (!node || node.kind !== 'object' || emitted.has(name)) return name;
  emitted.add(name);

  const lines = [];
  lines.push(`    public sealed class ${name}`);
  lines.push('    {');
  const fields = [...(node.fields ?? new Map()).entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const total = node.objCount ?? 1;
  for (const [key, f] of fields) {
    const childName = `${prefix}${pascal(key)}`;
    if (propName(key) === name) throw new Error(`[csharp] ${name}.${key}: a member cannot share its class's name (CS0542)`);
    let t;
    if (f.arrayOf) {
      const inner = f.arrayOf.kind === 'object'
        ? emitClasses(f.arrayOf, childName, out, emitted)
        : csType(f.arrayOf, childName, emitted);
      t = `List<${inner}>`;
    } else if (f.kind === 'object' && isMap(f)) {
      t = `Dictionary<string, ${mapValueType(f, childName, out, emitted)}>`;
    } else if (f.kind === 'object') {
      t = emitClasses(f, childName, out, emitted);
    } else {
      t = csType(f, childName, emitted);
    }
    // A field missing from some array elements must be nullable so binding
    // cannot throw on a shorter record.
    const optional = f.seen < total;
    const nullable = optional || f.nullable;
    const decl = nullable && t !== 'string' && !t.startsWith('List<') && !t.startsWith('Dictionary<') ? `${t}?` : t;
    lines.push(`        public ${decl} ${propName(key)} { get; set; }`);
  }
  lines.push('    }');
  out.unshift(lines.join('\n'));
  return name;
}

// ── Build ───────────────────────────────────────────────────────────────────
const files = [];
for (const file of MODELLED) {
  const path = join(DATA, file);
  if (!existsSync(path)) { console.error(`[csharp] missing table: ${file}`); process.exit(1); }
  const raw = parseTable(await readFile(path, 'utf8'));
  const base = pascal(file.replace(/\.json$/, ''));
  const out = [];
  const emitted = new Set();

  const root = {};
  mergeObject(root, raw);

  emitClasses(root, `${base}Table`, out, emitted, base);

  files.push({
    file,
    base,
    body: out.join('\n\n'),
    classes: emitted.size,
    keys: root.fields ? [...root.fields.keys()] : []
  });
}

const header = `// <auto-generated>
//   Generated by tools/studio/gen-csharp-types.mjs from shared/data/*.json.
//   DO NOT EDIT BY HAND — regenerate with \`npm run gen-csharp-types\`.
//   Property names are the JSON keys Pascal-cased (SCREAMING_SNAKE keys kept
//   verbatim), so case-insensitive binding — Newtonsoft's default, or
//   System.Text.Json with PropertyNameCaseInsensitive — needs no attributes.
//   Objects keyed by data (ids, levels) are Dictionary<string, T>. Each table's
//   root class is <Stem>Table. tools/csharp/parity binds every table losslessly.
// </auto-generated>
#nullable enable
#pragma warning disable CS8618 // filled in by the JSON deserialiser, never by a constructor
using System.Collections.Generic;

namespace Churrasco.Core.Generated
{
`;

let total = 0;
const written = [];
for (const f of files) {
  const content = `${header}${f.body}\n}\n`;
  const dest = join(OUT, `${f.base}.g.cs`);
  written.push({ dest, content });
  total += f.classes;
}

if (CHECK) {
  let drift = false;
  for (const { dest, content } of written) {
    if (!existsSync(dest) || (await readFile(dest, 'utf8')) !== content) {
      console.error(`[csharp] DRIFT: ${dest.replace(ROOT + '/', '')}`);
      drift = true;
    }
  }
  if (drift) {
    console.error('[csharp] A data table changed shape. Run `npm run gen-csharp-types`, review, commit.');
    process.exit(1);
  }
  console.log(`[csharp] OK — ${files.length} files, ${total} classes in step with shared/data`);
  process.exit(0);
}

await mkdir(OUT, { recursive: true });
for (const { dest, content } of written) await writeFile(dest, content);
console.log(`[csharp] wrote ${files.length} files / ${total} classes to Assets/Scripts/Core/Generated`);
for (const f of files) console.log(`  ${f.base.padEnd(16)} ${String(f.classes).padStart(3)} classes  <- ${f.file}`);
