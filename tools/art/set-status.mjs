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

function parseLine(line) {
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

/**
 * Guard against approving a grill whose painted opening does not hold the grid the data promises
 * (docs/22 §6.8, docs/23 §5). The ruler is the same one `check-grill-geometry` runs, measured on
 * the master that is about to be signed off — approving from a contact sheet is how a 19 px band
 * got into a review pile once already. `--force` overrides, with the reason recorded in the note.
 */
async function grillRulerCheck(names) {
  const targets = names.filter((n) => n.startsWith('spr_grill_'));
  if (!targets.length) return [];
  const { loadStandard, report } = await import('./grill-geometry.mjs');
  const standard = await loadStandard(ROOT);
  const { rows } = await report(standard);
  const byName = new Map(rows.map((r) => [r.name, r]));
  const bad = [];
  for (const n of targets) {
    const r = byName.get(n);
    if (!r) { bad.push(`${n}: sem medição no manifest (rode process-sprites antes de aprovar)`); continue; }
    if (!r.got.ok) bad.push(`${n}: ${r.got.why} · exige ${r.need.cellW}×${r.need.cellH} por vaga, boca pintada ${r.got.cellW}×${r.got.cellH}`);
  }
  return bad;
}

const force = args.includes('--force');
if (force) args.splice(args.indexOf('--force'), 1);

const [headLine, ...lines] = (await readFile(REGISTRY, 'utf8')).split('\n').filter((l) => l.trim());
const head = parseLine(headLine);
const col = Object.fromEntries(head.map((k, i) => [k, i]));
const wanted = new Set(names);
const found = new Set();
let changed = 0;
const out = lines.map((line) => {
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

if (status === 'approved' && !force) {
  const bad = await grillRulerCheck(names.length ? names : [...found]);
  if (bad.length) {
    console.error(`[art] NÃO aprovado — ${bad.length} grelha(s) fora do padrão de boca/leito (docs/22 §6.8):`);
    for (const b of bad) console.error(`  - ${b}`);
    console.error('[art] ou se regenera com o guia do degrau (`make-ref.mjs guide <out> 1408 --grill <id> --evo <n>`), ou se ajusta a grade em `churrasqueiras.json`, ou — se a decisão for do outro tipo, de linguagem visual — `--force "motivo"`.');
    process.exit(1);
  }
}
if (status === 'approved' && force) console.log('[art] --force: régua da grelha ignorada por decisão explícita (fica na nota).');
await writeFile(REGISTRY, [headLine, ...out].join('\n') + '\n');
console.log(`[art] ${batch}: ${changed} row(s) → ${status}`);
