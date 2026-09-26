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
import { loadStandard, report, MOUTH_WIDTH_HINT, MOUTH_FILL_HINT, MOUTH_TILT_MIN_HINT } from './grill-geometry.mjs';

const ROOT = join(import.meta.dirname, '..', '..');
const checkAll = process.argv.includes('--all');
const standard = await loadStandard(ROOT);
const { rows, ladder, art, concepts } = await report(standard);

if (concepts?.length) {
  console.log(`   conceito sem slot no dado (não mede, não reprov\u00e1): ${concepts.map((c) => c.name).join(', ')}`);
}

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

// ── a família manda no inclinado ──────────────────────────────────────────────────────────────
// Um vão "em nível" não é defeito absoluto: é. O que reprovava arte no §6.10.3 era o vão a 0° numa
// grelha cujas irmãs assinadas o dono medem 6–10° — o jogador vê a churrasqueira virar na tela no
// instante da evolução. Daí medir por grelha, não no mundo: `flat` só faz sentido contra o piso da
// PRÓPRIA família, e o sinal (para cima ou para baixo à direita) é da família também. As duas evo 3
// do lote 11 voltaram rejeitadas por causa disso: passavam na régua global com o MÓVEL tombado
// (docs/22 §6.13), e a zé assinada tem o vão a +1,7° — uma régua de 4° do mundo inteiro a acusaria.
const famTilt = new Map();
for (const r of rows) {
  if (!r.got || typeof r.got.tiltDeg !== 'number') continue;
  if ((statusOf.get(r.name) ?? 'unknown') !== 'approved') continue;
  const list = famTilt.get(r.cap.id) ?? [];
  list.push({ evo: r.cap.evo, tilt: r.got.tiltDeg });
  famTilt.set(r.cap.id, list);
}
const famStats = (id, selfEvo) => {
  // as irmãs, nunca a própria linha: a evo 1 assinada a 1,7° não pode ser acusada pela régua dela
  // mesma — só por uma irmã assinada que incline mais.
  const l = (famTilt.get(id) ?? []).filter((x) => x.evo !== selfEvo && Math.abs(x.tilt) >= 2);
  if (!l.length) return null;
  const abs = l.map((x) => Math.abs(x.tilt));
  return { min: Math.min(...abs), max: Math.max(...abs), sign: Math.sign(l.reduce((a, x) => a + x.tilt, 0)), list: l };
};

const fmt = (n) => String(n).padStart(4);
console.log(`\n── churrasqueiras: boca pintada × grade prometida ─────────────────────────`);
console.log(`   padrão: comida ${art.foodFootprint.width}×${art.foodFootprint.height} px · leito ${art.bedWidthOnScreen}–${art.maxBedWidthOnScreen} px · topo ≤ ${art.maxTiltDeg}°`);
console.log(`   grelha              Z×S  vagas   exige (vaga)     pintado (vaga)     boca    incl. b/larg cheio status`);
let bad = 0, warn = 0, narrow = 0, invaded = 0, flat = 0;
for (const r of rows.sort((a, b) => a.cap.id.localeCompare(b.cap.id) || a.cap.evo - b.cap.evo)) {
  const st = statusOf.get(r.name) ?? 'unknown';
  // Only approved art ships, so only approved art can break the build. `--all` widens what is
  // *measured and printed* — counting a pending row as a failure was both wrong (nobody agreed to
  // ship it) and self-defeating: it made the flag you use to grade a batch before approval red.
  const ships = st === 'approved';
  const flag = r.got.ok ? 'ok' : (ships ? 'FALHA' : 'pende');
  if (!r.got.ok) { if (ships) bad++; else warn++; }
  console.log(
    `   ${(r.cap.name.slice(0, 18) + ' e' + r.cap.evo).padEnd(20)}` +
    ` ${r.cap.zoneCount}×${r.cap.slotsPerZone}`.padEnd(7) + fmt(r.cap.capacity) +
    `   ${fmt(r.need.cellW)}×${r.need.cellH}`.padEnd(17) + `${fmt(r.got.cellW)}×${r.got.cellH}`.padEnd(17) +
    ` ${String(r.got.aspect).padStart(5)}:1 ${String(r.got.tiltDeg).padStart(5)}° ${String(r.got.widthFrac).padStart(5)} ${String(r.got.fill).padStart(5)} ` +
    `${r.got.bedKind === 'cells' ? '⌗células' : '—aberto '}` + `  ${flag.padEnd(6)} ${r.name}`);
  if (!r.got.ok) console.log(`   ${''.padEnd(20)}→ ${r.got.why}`);
  const avisos = [];
  if (r.got.mouthInvaded) avisos.push(['invadida', `só ${Math.round(r.got.fill * 100)} % do quadrilátero do vão é magenta de verdade: tem coisa pintada para dentro da boca (balcão, tampa, apoio, grade). A régua de vagas lê o vão inteiro — é esse pedaço pintado que come o espaço do prato.`]);
  if (r.got.mouthTooNarrow) avisos.push(['estreita', `boca em ${Math.round(r.got.widthFrac * 100)} % da largura do sprite (< ${Math.round(MOUTH_WIDTH_HINT * 100)} %): o teto de tela ganha da régua do leito e a comida encosta. Não reprova — as artes aprovadas antes desta regra também medem menos. É a régua da PRÓXIMA geração.`]);
  const fam = famStats(r.cap.id, r.cap.evo);
  if (r.got.flatMouth && (fam || !ships)) {
    // com família assinada inclinada, o piso dela é que vale; sem família (ou com família nivelada),
    // vale o piso global, que é a leitura "planta baixa" que ele devolve.
    const piso = fam ? fam.min : MOUTH_TILT_MIN_HINT;
    if (Math.abs(r.got.tiltDeg) < piso - 0.5) {
      avisos.push(['nivelada', `vão a ${r.got.tiltDeg}°, mais nivelado que qualquer assinada desta grelha (${fam ? fam.list.map((x) => `evo${x.evo} ${x.tilt}°`).join(', ') : 'as carimbadas por ele medem −8,6° a −6,1°'}) — na tela, evoluir faz a churrasqueira virar. \`make-ref.mjs guide … --mouth-tilt 7\` cisalha o vão do desenho de partida nesse ângulo (e casa o sinal com a família sozinho); o CORPO fica de nível — não é mais a foto tombada de \`--roll\`, que foi o defeito do docs/22 §6.13.`]);
    }
  } else if (fam && fam.sign && Math.sign(r.got.tiltDeg) === -fam.sign && Math.abs(r.got.tiltDeg) >= 2) {
    avisos.push(['nivelada', `sentido da inclinação contrário às assinadas da mesma grelha (${r.got.tiltDeg}° aqui, ${fam.list.map((x) => `evo${x.evo} ${x.tilt}°`).join(', ')} lá) — o vão "espelha" na evolução. O \`guide --mouth-tilt\` já inverte o sinal sozinho quando o manifesto existe; se apareceu este aviso, é gerar o guia de novo antes de repintar.`]);
  }
  for (const [kind, msg] of avisos) {
    if (kind === 'invadida') invaded++; else if (kind === 'estreita') narrow++; else flat++;
    console.log(`   ${''.padEnd(20)}⚕ ${msg}`);
  }
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
if (flat) console.log(`   ⚕ ${flat} grelha(s) com o vão mais nivelado que as assinadas da PRÓPRIA grelha (piso global < ${MOUTH_TILT_MIN_HINT}°) — planta baixa, não foto. Régua de desenho de partida, não de aprovação: o que se cobra delas é casar com a família, e o corpo fica de pé — foi tombar a foto (docs/22 §6.13) que reprovou arte com a régua verde.`);
if (invaded) console.log(`   ⚕ ${invaded} grelha(s) com o vão invadido por detalhe pintado (< ${Math.round(MOUTH_FILL_HINT * 100)} % de cheio).`);
if (narrow) console.log(`   ⚕ ${narrow} grelha(s) com boca estreita demais para a largura do sprite (< ${Math.round(MOUTH_WIDTH_HINT * 100)} %) — régua nova, ainda só aviso: é o piso da próxima geração.`);
console.log(`\n   escada de vagas: ${caps.join(' → ')}  (monótona: ${ladderBad ? 'NÃO' : 'sim'})`);
if (!checkAll && warn) console.log(`   (${warn} grelha(s) fora do padrão ainda não aprovadas — ` + `rode com --all para ver as medições)`);

if (!rows.length) { console.error('[grill-geometry] no grill sprites with a detected opening in the manifest'); process.exit(1); }
if (bad || ladderBad) {
  const parts = [];
  if (bad) parts.push(`${bad} grelha(s) aprovada(s) sem leito para a grade que os dados prometem`);
  if (ladderBad) parts.push(`${ladderBad} inversão(ões) de progressão na escada de vagas`);
  console.error(`\n[grill-geometry] FAILED — ${parts.join(' · ')}`);
  console.error('[grill-geometry] ou se regenera a arte com a boca exigida (make-ref.mjs guide --grill <id> --evo <n>), ou se corrige zoneCount/slotsPerZone em churrasqueiras.json.');
  process.exit(1);
}
console.log(`\nOK — ${rows.length} grelhas medidas, todas com leito para a grade prometida (aviso: ${warn} ainda fora de aprovação).`);
