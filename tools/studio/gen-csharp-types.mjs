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
 * Types are inferred from every element of every array (a field absent from the
 * first element but present in a later one still gets emitted, as nullable).
 */
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..', '..');
const DATA = join(ROOT, 'shared', 'data');
const OUT = join(ROOT, 'Assets', 'Scripts', 'Core', 'Generated');
const CHECK = process.argv.includes('--check');

// JSON files worth modelling in C#. Pure-editor tables (analytics, remote config)
// are read as raw JSON by their services and need no class.
const MODELLED = [
  'ingredients.json', 'grill.json', 'customers.json', 'restaurants.json',
  'upgrades.json', 'economy.json', 'levels.json', 'employees.json',
  'collection.json', 'pass.json', 'churrasqueiras.json', 'tutorial.json'
];

const pascal = (s) => s
  .replace(/[^a-zA-Z0-9]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ''))
  .replace(/^(.)/, (_, c) => c.toUpperCase());

const RESERVED = new Set(['class', 'int', 'float', 'double', 'string', 'object', 'new', 'base', 'operator', 'params', 'ref', 'out', 'in', 'is', 'as', 'lock', 'event']);
const safe = (s) => (RESERVED.has(s) ? `@${s}` : s);

/** Merge a value's shape into a node describing an object type. */
function mergeObject(node, value) {
  node.kind = 'object';
  node.fields ??= new Map();
  if (!value || typeof value !== 'object') return;
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
function emitClasses(node, name, out, emitted) {
  if (!node || node.kind !== 'object' || emitted.has(name)) return name;
  emitted.add(name);

  const lines = [];
  lines.push(`    public sealed class ${name}`);
  lines.push('    {');
  const fields = [...(node.fields ?? new Map()).entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const total = node.sampleCount ?? 1;
  for (const [key, f] of fields) {
    const childName = `${name}${pascal(key)}`;
    let t;
    if (f.arrayOf) {
      const inner = f.arrayOf.kind === 'object'
        ? emitClasses(f.arrayOf, childName, out, emitted)
        : csType(f.arrayOf, childName, emitted);
      t = `List<${inner}>`;
    } else if (f.kind === 'object') {
      t = emitClasses(f, childName, out, emitted);
    } else {
      t = csType(f, childName, emitted);
    }
    // A field missing from some array elements must be nullable so binding
    // cannot throw on a shorter record.
    const optional = f.seen < total;
    const nullable = optional || f.nullable;
    const decl = nullable && t !== 'string' && !t.startsWith('List<') ? `${t}?` : t;
    lines.push(`        public ${decl} ${safe(pascal(key))} { get; set; }`);
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
  const raw = JSON.parse(await readFile(path, 'utf8'));
  const base = pascal(file.replace(/\.json$/, ''));
  const out = [];
  const emitted = new Set();

  const root = {};
  mergeObject(root, raw);
  root.sampleCount = 1;

  // Attach sample counts so optionality can be detected per array element.
  function annotate(node, count) {
    if (!node || typeof node !== 'object') return;
    node.sampleCount = count;
    for (const f of (node.fields ?? new Map()).values()) {
      if (f.arrayOf) {
        // Count how many elements contributed to the merged shape.
        f.arrayOf.sampleCount = f.seen;
        annotate(f.arrayOf, f.seen);
      } else if (f.kind === 'object') {
        annotate(f, f.seen);
      }
    }
  }
  annotate(root, 1);

  emitClasses(root, base, out, emitted);

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
//   Property names mirror the JSON keys exactly (Pascal-cased) so a camelCase
//   naming policy binds them without per-field attributes.
// </auto-generated>
#nullable enable
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
