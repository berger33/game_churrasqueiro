#!/usr/bin/env node
/**
 * check-art-registry — o registro de arte, o atlas em serviço e os lotes têm de contar a mesma
 * história (docs/04 §11, docs/22 §5/§6.10, docs/23 §5).
 *
 *   node tools/art/check-art-registry.mjs
 *
 * As regras existem porque a esteira tem três camadas que podem andar separadas — `Assets/Art`
 * (masters + ASSET_REGISTRY.csv), `prototype/assets/art` (o atlas que o jogo carrega) e
 * `art/lote-*.json` (o que foi pedido, com o prompt) — e cada divergência silenciosa entre elas já
 * mordeu uma vez: um repaint pôs a linha do registro de volta em `pending` enquanto o atlas seguia
 * servindo os bytes antigos, e nada avisava. Embarque sem aprovação é o que o portão recusa; o
 * congelamento declarado (arte segurada enquanto a escada muda) é permitido, mas *listado* — decisão
 * escrita em `art/frozen-atlas.json`, não ruído aceito.
 */
import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, basename } from 'node:path';

const ROOT = join(import.meta.dirname, '..', '..');
const problems = [];
const fail = (m) => problems.push(m);

function parseLine(line) {
  const out = []; let cur = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) { if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; }
    else if (ch === '"') q = true; else if (ch === ',') { out.push(cur); cur = ''; } else cur += ch;
  }
  return [...out, cur];
}

const csvPath = join(ROOT, 'Assets', 'Art', 'ASSET_REGISTRY.csv');
const [head, ...lines] = (await readFile(csvPath, 'utf8')).split('\n').filter((l) => l.trim());
const cols = parseLine(head);
const at = (k) => cols.indexOf(k);
if (at('name') < 0 || at('status') < 0 || at('file') < 0) {
  console.error(`[art-registry] ASSET_REGISTRY.csv sem as colunas name/status/file`);
  process.exit(1);
}
const rows = lines.map((l) => parseLine(l)).map((c) => ({
  name: c[at('name')], status: c[at('status')], file: c[at('file')], batch: c[at('batch')] ?? '', source: c[at('source')] ?? ''
}));
const byName = new Map(rows.map((r) => [r.name, r]));

// O atlas embarcado é versionado de propósito (o protótipo precisa dele num clone limpo), mas ele é
// *derivado* de `Assets/Art` por `build-runtime.mjs` — então um checkout podado pode não tê-lo. Sem
// ele o portão continua cobrando o lado do registro (aprovado tem master, lote tem prompt, lista de
// congelamento é viva); só deixa de auditar embarque, e diz isso na saída em vez de fingir 0 sprites.
const indexPath = join(ROOT, 'prototype', 'assets', 'art', 'index.json');
const atlasPresent = existsSync(indexPath);
const idx = atlasPresent ? JSON.parse(await readFile(indexPath, 'utf8')) : { sprites: {} };
const shipped = new Set(Object.keys(idx.sprites ?? {}));

const frozenPath = join(ROOT, 'art', 'frozen-atlas.json');
const frozen = existsSync(frozenPath)
  ? JSON.parse(await readFile(frozenPath, 'utf8')).sprites ?? []
  : [];
const frozenByName = new Map(frozen.map((f) => [f.name, f]));

// 1. aprovado tem de ter master em disco
for (const r of rows.filter((x) => x.status === 'approved')) {
  if (!r.file || !existsSync(join(ROOT, r.file))) fail(`${r.name}: status approved sem master em "${r.file}"`);
}

// 2. recusado nunca embarca
for (const name of shipped) {
    // (cada um abaixo só é cobrado quando o atlas existe — sem atlas não há embarque a auditar)
  const r = byName.get(name);
  if (!r) { fail(`${name}: no atlas em serviço sem linha no ASSET_REGISTRY.csv`); continue; }
  if (r.status === 'rejected') fail(`${name}: sprite RECUSADO pelo dono está no atlas — rode build-runtime.mjs`);
  // 3. embarcado sem aprovação só se declarado
  if (r.status !== 'approved') {
    const f = frozenByName.get(name);
    if (!f) {
      fail(`${name}: embarcado com status "${r.status}". Ou o dono aprova, ou se declara o `
        + `congelamento em art/frozen-atlas.json com o motivo (o que o atlas serve são os bytes `
        + `anteriores, aprovados; o master novo espera revisão).`);
    } else if (!f.reason || f.reason.trim().length < 12) {
      fail(`${name}: declarado em frozen-atlas.json sem motivo legível (precisa de frase, não de etiqueta)`);
    }
  }
}

// 4. aprovado e não embarcado = build esquecido
for (const r of rows.filter((x) => x.status === 'approved')) {
  if (!atlasPresent) break;
  if (!shipped.has(r.name) && !frozenByName.has(r.name)) {
    fail(`${r.name}: aprovado e ausente do atlas — rode \`node tools/art/build-runtime.mjs\` (ou declare em frozen-atlas.json)`);
  }
}

// 5. cada nome pedido num lote tem de ter registro; e cada lote tem de ter prompt gravado
const artDir = join(ROOT, 'art');
const lotFiles = (await readdir(artDir)).filter((f) => /^lote-.*\.json$/.test(f)).sort();
const promptFiles = existsSync(join(artDir, 'prompts')) ? await readdir(join(artDir, 'prompts')) : [];
for (const f of lotFiles) {
  const lot = JSON.parse(await readFile(join(artDir, f), 'utf8'));
  const batch = lot.batch ?? f.replace(/\.json$/, '');
  const names = new Set();
  let legacy = 0;
  for (const a of lot.assets ?? []) {
    if (a.name) names.add(a.name);
    for (const n of a.names ?? []) if (typeof n === 'string') names.add(n);
    // Lotes de comida em `grid` declaram `subject` + `cells`; o nome vem do padrão do
    // processador (`spr_food_<subject>_<estado>`). Expandido aqui para a cobertura não
    // ficar cega nos lotes antigos (01–05), que não traziam `name` por entrada.
    if (!a.name && !a.names && a.subject && Array.isArray(a.cells)) {
      for (const c of a.cells) names.add(`spr_${a.category}_${a.subject}_${c}`);
    } else if (!a.name && !a.names) legacy++;
  }
  if (legacy) console.log(`   nota: ${f} tem ${legacy} entrada(s) sem nome declarável (cobertura não verificada)`);
  const missing = [...names].filter((n) => !byName.has(n));
  if (missing.length) fail(`${f}: ${missing.length} sprite(s) sem linha no registro: ${missing.slice(0, 4).join(', ')}${missing.length > 4 ? '…' : ''}`);
  const stem = batch.replace(/-.*$/, '');
  const hasPrompt = promptFiles.some((p) => p.startsWith(stem) && p.endsWith('.md'))
    || promptFiles.some((p) => p.replace(/\.md$/, '') === batch);
  if (!hasPrompt) fail(`${f}: lote sem prompt gravado em art/prompts/ (a regra é prompt antes da geração — docs/22 §5)`);
}

// 6. a lista de congelamento não pode apodrecer
for (const f of frozen) {
  const r = byName.get(f.name);
  if (!r) { fail(`frozen-atlas.json: "${f.name}" não existe no registro`); continue; }
  if (r.status === 'approved' && shipped.has(f.name)) {
    fail(`frozen-atlas.json: "${f.name}" já está aprovado e embarcado — tire da lista (a lista é para divergência viva, não histórico)`);
  }
  if (!shipped.has(f.name)) fail(`frozen-atlas.json: "${f.name}" não está no atlas; não há o que congelar`);
}

console.log('── registry × atlas × lotes ────────────────────────────────────');
const counts = rows.reduce((a, r) => ((a[r.status] = (a[r.status] ?? 0) + 1), a), {});
console.log(`   registro: ${rows.length} linhas (${Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(', ')})`);
console.log(`   atlas: ${atlasPresent ? `${shipped.size} sprites` : 'AUSENTE (clone limpo — rode `node tools/art/build-runtime.mjs` para auditar embarque)'} · congelamento declarado: ${frozen.length}`);
console.log(`   lotes: ${lotFiles.length} · prompts: ${promptFiles.filter((p) => p.endsWith('.md')).length}`);
if (problems.length) {
  console.error(`\n[art-registry] FAILED — ${problems.length} problema(s):`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log(`\nOK — registro, atlas e lotes contam a mesma história.`);
