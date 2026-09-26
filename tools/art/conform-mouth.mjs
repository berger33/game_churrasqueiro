#!/usr/bin/env node
/**
 * conform-mouth — puts a painted grill opening inside the standard, without repainting it.
 *   node tools/art/conform-mouth.mjs <sprite name> [<sprite name>…]
 *   node tools/art/conform-mouth.mjs --all
 *
 * Why this exists (docs/22-ARTE_2D_PLANO.md §6.8): three rounds of prompts told the model the
 * ratio the cooking opening must have (~2:1 for a 3×3 grill) and it delivered 1.31:1, 1.85:1,
 * 2.24:1, 2.77:1 and 2.88:1. A diffusion model does not measure pixels, so chasing the number in
 * prose is not a plan. The opening, though, is a *rectangle of empty space*: the art around it is
 * whatever the model liked, and the geometry the game reads is the hole. So the pipeline finishes
 * the geometry — it scales the sprite vertically until the opening's on-screen height matches the
 * bed the data promises, and scales the recorded hole with it.
 *
 * What it does NOT do: it never changes the horizontal mapping (the engine's `s = bedW / mouthW`
 * is untouched, so the grill still occupies the width the standard picked), it never moves food
 * (the engine draws that at its own size), and it refuses to stretch art into a blob — anything
 * beyond ±70 % is reported as "regenere". The factor, the reason and the before/after are written
 * into `hole.conformed` in the manifest and into the registry note, so an approved asset that was
 * conformed is visibly, permanently distinguishable from one that was painted right.
 *
 * The sprite's own status is not touched: conformed art still needs the owner's approval.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { join } from 'node:path';
import { loadStandard, capacity, requiredMouth, measuredMouth, conformFactor, scaleHole } from './grill-geometry.mjs';

const ROOT = join(import.meta.dirname, '..', '..');
const MANIFEST = join(ROOT, 'Assets', 'Art', 'sprites.manifest.json');
const REGISTRY = join(ROOT, 'Assets', 'Art', 'ASSET_REGISTRY.csv');
const NAME_RE = /^spr_grill_(.+)_evo(\d+)$/;

function scaleCanvas(canvas, f) {
  const h2 = Math.max(1, Math.round(canvas.height * f));
  const out = createCanvas(canvas.width, h2);
  const x = out.getContext('2d');
  x.imageSmoothingEnabled = false; // pixel art: nearest neighbour, never a blur
  x.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, canvas.width, h2);
  return out;
}

async function main() {
  const args = process.argv.slice(2);
  const std = await loadStandard();
  const manifest = JSON.parse(await readFile(MANIFEST, 'utf8'));
  const wanted = args.includes('--all')
    ? Object.keys(manifest.sprites).filter((n) => NAME_RE.test(n) && manifest.sprites[n].hole)
    : args.filter((a) => !a.startsWith('--'));
  if (!wanted.length) { console.error('usage: conform-mouth.mjs <sprite…> | --all'); process.exit(2); }

  const rows = [];
  const touched = [];
  for (const name of wanted) {
    const e = manifest.sprites[name];
    const m = NAME_RE.exec(name);
    if (!e || !m) { console.error(`[conform] ${name}: não é uma grelha com boca no manifest`); process.exitCode = 1; continue; }
    const cap = capacity(std, m[1], +m[2]);
    if (!e.hole) { console.error(`[conform] ${name}: sem boca detectada — nada a conformar`); process.exitCode = 1; continue; }
    const need = requiredMouth(std.art, cap);
    const before = measuredMouth(std.art, e, cap);
    if (before.ok) {
      rows.push(`${name.padEnd(42)} ok (boca ${before.aspect}:1, faixa ${before.cellH} px) — nada a fazer`);
      continue;
    }
    const conf = conformFactor(std.art, e, cap);
    if (!conf || conf.error) {
      rows.push(`${name.padEnd(42)} ${conf?.error ?? `sem conform possível (${before.why})`} — REGENERE`);
      process.exitCode = 1;
      continue;
    }
    const img = await loadImage(join(ROOT, e.file));
    const c = scaleCanvas(img, conf.f);
    await writeFile(join(ROOT, e.file), Buffer.from(await c.toBuffer('image/png')));
    e.w = c.width;
    e.h = c.height;
    e.hole = scaleHole(e.hole, conf.f);
    const after = measuredMouth(std.art, e, cap);
    e.hole.conformed = {
      factorY: +conf.f.toFixed(3), reason: conf.why,
      mouthHScreen: [before.mouthHScreen, after.mouthHScreen], aspect: [before.aspect, after.aspect],
      date: new Date().toISOString().slice(0, 10),
    };
    // The promise the art now meets is recorded next to the sprite, so the runtime can map the
    // bed from the data instead of trusting a hand-tuned constant.
    e.bedWidth = after.bedW;
    rows.push(`${name.padEnd(42)} ×${conf.f.toFixed(3)} (${conf.why}): boca ${before.aspect}:1 → ${after.aspect}:1, `
      + `faixa ${before.cellH} → ${after.cellH} px (pedido ${need.cellW}×${need.minCellH}) ${after.ok ? '→ ok' : `→ AINDA FORA: ${after.why}`}`);
    touched.push({ name, note: `boca conformada ×${conf.f.toFixed(3)} pelo padrão grill.art (${conf.why})`, ok: after.ok });
    if (!after.ok) process.exitCode = 1;
  }

  if (touched.length) {
    const sorted = {
      _comment: manifest._comment,
      sprites: Object.fromEntries(Object.entries(manifest.sprites).sort(([a], [b]) => a.localeCompare(b))),
      foods: manifest.foods,
    };
    await writeFile(MANIFEST, JSON.stringify(sorted, null, 2) + '\n');
    const csv = (await readFile(REGISTRY, 'utf8')).split('\n');
    const head = csv[0].split(',');
    for (const t of touched) {
      const i = csv.findIndex((l) => l.startsWith(`${t.name},`));
      if (i < 0) continue;
      const cells = csv[i].split(',');
      cells[head.indexOf('notes')] = t.note;
      csv[i] = cells.join(',');
    }
    await writeFile(REGISTRY, csv.join('\n'));
  }

  console.log(`\n── conform de boca × padrão grill.art ─────────────────────────────`);
  for (const r of rows) console.log(`   ${r}`);
  console.log('');
  if (!touched.length) console.log('[conform] nada alterado');
  else console.log(`[conform] ${touched.length} arte(s) conformada(s); o status de aprovação não foi tocado — aprovar é decisão do dono`);
}

main().catch((e) => { console.error(`[conform] FAILED: ${e.message}`); process.exit(1); });
