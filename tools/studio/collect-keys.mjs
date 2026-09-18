/** Extracts every localisation key referenced by the data tables. */
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const DIR = join(import.meta.dirname, '..', '..', 'shared', 'data');
const KEY_FIELDS = /^(nameKey|descKey|taglineKey|reactionPerfectKey|reactionGoodKey|reactionBurnedKey|reactionLostKey|effectKey|titleKey|subtitleKey|labelKey|hintKey|introKey|bodyKey|ctaKey|blurbKey|voiceKey|flavorKey)$/;

const keys = new Map(); // key -> source files

function walk(node, file) {
  if (Array.isArray(node)) { for (const v of node) walk(v, file); return; }
  if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) {
      if (typeof v === 'string' && KEY_FIELDS.test(k)) {
        if (!keys.has(v)) keys.set(v, new Set());
        keys.get(v).add(file);
      }
      walk(v, file);
    }
  }
}

const files = (await readdir(DIR)).filter((f) => f.endsWith('.json')).sort();
for (const f of files) {
  const raw = await readFile(join(DIR, f), 'utf8');
  walk(JSON.parse(raw), f);
}

const sorted = [...keys.entries()].sort((a, b) => a[0].localeCompare(b[0]));
console.log(`collected ${sorted.length} keys from ${files.length} tables`);
const byNamespace = {};
for (const [k, src] of sorted) {
  const ns = k.split('.')[0];
  byNamespace[ns] = (byNamespace[ns] ?? 0) + 1;
}
console.log('namespaces:', Object.entries(byNamespace).map(([k, v]) => `${k}(${v})`).join(' '));
if (process.argv.includes('--json')) {
  process.stdout.write(JSON.stringify(Object.fromEntries(sorted.map(([k, v]) => [k, [...v]])), null, 2));
}
