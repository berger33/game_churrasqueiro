/**
 * check-grill-geometry — does every shipped grill's painted opening actually hold the grid the
 * data promises? (docs/04 §5.1, docs/22 §6.8)
 *
 *   node tools/art/check-grill-geometry.mjs [--all]
 *
 * By default only `approved` rows can fail the build: that is the art that ships, and the owner
 * signed off on it believing the bed holds zoneCount × slotsPerZone items. `pending`/`rejected`
 * rows are reported as information so a batch can be measured before it is approved.
 *
 * Measured, not described: the numbers come from the hole the sprite processor detected in the
 * painted art (Assets/Art/sprites.manifest.json), mapped through the same rule the prototype
 * uses to place food (`grill.json.art`), and compared with the food the game actually draws.
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { loadStandard, report } from './grill-geometry.mjs';

const ROOT = join(import.meta.dirname, '..', '..');
const checkAll = process.argv.includes('--all');
const standard = await loadStandard(ROOT);
const { rows, ladder, art } = await report(standard);

// status per sprite name (CSV with quoted notes, so a real split is needed)
function parseLine(line) {
  const out = []; let cur = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) { if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; }
    else if (ch === '"') q = true; else if (ch === ',') { out.push(cur); cur = ''; } else cur += ch;
  }
  return [...out, cur];
}
const csv = (await readFile(join(ROOT, 'Assets', 'Art', 'ASSET_REGISTRY.csv'), 'utf8')).split('\n').filter((l) => l.trim());
const head = parseLine(csv[0]);
const iName = head.indexOf('name'), iStatus = head.indexOf('status');
const statusOf = new Map(csv.slice(1).map((l) => { const c = parseLine(l); return [c[iName], c[iStatus]]; }));

const fmt = (n) => String(n).padStart(4);
console.log(`\n── churrasqueiras: boca pintada × grade prometida ─────────────────────────`);
console.log(`   padrão: comida ${art.foodFootprint.width}×${art.foodFootprint.height} px · leito ${art.bedWidthOnScreen}–${art.maxBedWidthOnScreen} px · topo ≤ ${art.maxTiltDeg}°`);
console.log(`   grelha              Z×S  vagas   exige (vaga)     pintado (vaga)     boca    incl.  status`);
let bad = 0, warn = 0;
for (const r of rows.sort((a, b) => a.cap.id.localeCompare(b.cap.id) || a.cap.evo - b.cap.evo)) {
  const st = statusOf.get(r.name) ?? 'unknown';
  const counts = st === 'approved' || checkAll;
  const flag = r.got.ok ? 'ok' : (counts ? 'FALHA' : 'pende');
  if (!r.got.ok && counts) bad++; else if (!r.got.ok) warn++;
  console.log(
    `   ${(r.cap.name.slice(0, 18) + ' e' + r.cap.evo).padEnd(20)}` +
    ` ${r.cap.zoneCount}×${r.cap.slotsPerZone}`.padEnd(7) + fmt(r.cap.capacity) +
    `   ${fmt(r.need.cellW)}×${r.need.cellH}`.padEnd(17) + `${fmt(r.got.cellW)}×${r.got.cellH}`.padEnd(17) +
    ` ${String(r.got.aspect).padStart(5)}:1 ${String(r.got.tiltDeg).padStart(5)}°  ${flag.padEnd(6)} ${r.name}`);
  if (!r.got.ok) console.log(`   ${''.padEnd(20)}→ ${r.got.why}`);
}

// the progression itself, in the same breath: bigger grill must mean bigger bed
let ladderBad = 0, prev = null;
for (const step of ladder) {
  if (prev && step.cap < prev.cap) {
    console.log(`   FALHA da progressão: ${step.id} e${step.evo} tem ${step.cap} vagas, menos que o passo anterior (${prev.cap})`);
    ladderBad++;
  }
  prev = step;
}
const caps = ladder.map((s) => s.cap);
console.log(`\n   escada de vagas: ${caps.join(' → ')}  (monótona: ${ladderBad ? 'NÃO' : 'sim'})`);

if (!rows.length) { console.error('[grill-geometry] no grill sprites with a detected opening in the manifest'); process.exit(1); }
if (bad || ladderBad) {
  console.error(`\n[grill-geometry] FAILED — ${bad} grelha(s) aprovada(s) sem leito para a grade que os dados prometem${ladderBad ? ` · ${ladderBad} inversão(ões) de progressão` : ''}`);
  console.error('[grill-geometry] ou se regenera a arte com a boca exigida (make-ref.mjs guide --grill <id> --evo <n>), ou se corrige zoneCount/slotsPerZone em churrasqueiras.json.');
  process.exit(1);
}
console.log(`\nOK — ${rows.length} grelhas medidas, todas com leito para a grade prometida (aviso: ${warn} ainda fora de aprovação).`);
