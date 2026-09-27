#!/usr/bin/env node
/**
 * set-status — records the owner's review decision in Assets/Art/ASSET_REGISTRY.csv
 * (lifecycle in docs/04-ART_STYLE.md §11, flow in docs/22-ARTE_2D_PLANO.md §5).
 *
 *   node tools/art/set-status.mjs <batch> <approved|rejected|superseded|pending> [name...] [--note "text"]
 *
 * With no names, every row of the batch changes. `approved` also flips
 * source=ai-assisted → ai-assisted-reviewed (a person reviewed it); any other status puts
 * it back to ai-assisted. The note, when given, is appended to the row's notes.
 * Only `approved` rows may ship.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..', '..');
const REGISTRY = join(ROOT, 'Assets', 'Art', 'ASSET_REGISTRY.csv');
const STATUSES = ['approved', 'rejected', 'superseded', 'pending'];

const args = process.argv.slice(2);
const noteAt = args.indexOf('--note');
const note = noteAt >= 0 ? args.splice(noteAt, 2)[1] : '';
const [batch, status, ...names] = args;
if (!batch || !STATUSES.includes(status)) {
  console.error(`usage: set-status.mjs <batch> <${STATUSES.join('|')}> [name...] [--note "text"]`);
  process.exit(2);
}

function parseLine(rawLine) {
  // The registry uses CRLF. Strip the record terminator before parsing so the
  // final header is `notes`, not `notes\r`, and preserve it again on write.
  const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;
  const cells = []; let cur = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) { if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; }
    else if (ch === '"') q = true; else if (ch === ',') { cells.push(cur); cur = ''; } else cur += ch;
  }
  cells.push(cur);
  return cells;
}
const cell = (v) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

const registryText = await readFile(REGISTRY, 'utf8');
const newline = registryText.includes('\r\n') ? '\r\n' : '\n';
const [rawHeadLine, ...lines] = registryText.split('\n').filter((l) => l.trim());
const headLine = rawHeadLine.endsWith('\r') ? rawHeadLine.slice(0, -1) : rawHeadLine;
const head = parseLine(headLine);
const col = Object.fromEntries(head.map((k, i) => [k, i]));
const wanted = new Set(names);
const found = new Set();
let changed = 0;
const out = lines.map((rawLine) => {
  const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;
  const r = parseLine(line);
  if (r[col.batch] !== batch || (wanted.size && !wanted.has(r[col.name]))) return line;
  found.add(r[col.name]);
  r[col.status] = status;
  r[col.source] = status === 'approved' ? 'ai-assisted-reviewed' : 'ai-assisted';
  if (note) r[col.notes] = r[col.notes] ? `${r[col.notes]} — ${note}` : note;
  changed++;
  return r.map(cell).join(',');
});
const missing = [...wanted].filter((n) => !found.has(n));
if (missing.length) { console.error(`[art] not in ${batch}: ${missing.join(', ')}`); process.exit(1); }
await writeFile(REGISTRY, [headLine, ...out].join(newline) + newline);
console.log(`[art] ${batch}: ${changed} row(s) → ${status}`);
