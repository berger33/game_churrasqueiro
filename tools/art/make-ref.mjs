#!/usr/bin/env node
/**
 * make-ref — rebuilds a style/layout reference image for the image model from approved
 * masters in Assets/Art (docs/22-ARTE_2D_PLANO.md §1). Raw model outputs are not in git and
 * do not survive a workspace reset, so references are always composed from the masters:
 * sprites are laid back onto flat magenta exactly the way the model is asked to paint.
 *
 *   node tools/art/make-ref.mjs grid   <out.png> <W> <H> <cols> <rows> <sprite>...
 *   node tools/art/make-ref.mjs single <out.png> <W> <H> <sprite>
 *   node tools/art/make-ref.mjs guide  <out.png> <W> <H> <cart|box|masonry>
 *
 * <sprite> is a manifest name (spr_food_picanha_raw). Each sprite is centred in its cell and
 * scaled down only if it does not fit in 88 % of the cell.
 *
 * `guide` draws a layout guide instead of a style reference: a flat silhouette with the
 * cooking opening already placed, so the model paints into a given composition rather than
 * interpreting "the mouth faces the viewer" (docs/22 §6.4 — that sentence produced three
 * front-facing windows in lote 03, with the opening at 5–9 % of the sprite and ±9° of tilt).
 * The opening is the one thing the game must map food onto, so the guide fixes it: at least
 * 78 % of the frame width, top edge perfectly horizontal (the game's heat bands are
 * horizontal), and wide enough for 2–3 zones to read. `box` = long steel firebox on legs,
 * `cart` = firebox on a wheeled street cart, `masonry` = brick barbecue with a stone counter.
 */
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';

const ROOT = join(import.meta.dirname, '..', '..');
const rawArgs = process.argv.slice(2);
const flags = {}; const pos = [];
for (let i = 0; i < rawArgs.length; i++) {
  if (rawArgs[i].startsWith('--')) { flags[rawArgs[i].slice(2)] = rawArgs[i + 1]; i++; } else pos.push(rawArgs[i]);
}
const [mode, out, W, H, ...rest] = pos;
if (!['grid', 'single', 'guide'].includes(mode) || !out) {
  console.error('usage: make-ref.mjs grid <out.png> <W> <H> <cols> <rows> <sprite>... | single <out.png> <W> <H> <sprite> | guide <out.png> <W> <H> <cart|box|masonry>');
  process.exit(2);
}
// ── guide: the composition the model must paint into (docs/22 §6.4) ─────────
// Every rect is a fraction of the frame. The mouth is drawn LAST so it stays pure magenta:
// no stroke, no gradient — the same keying and the same enclosed-hole detector that
// process-sprites.mjs uses on the real sprite must find it (verify with --dry-run).
// The geometry rule, measured rather than described (docs/22 §6.4): the opening must be at
// least 82 % of the frame width and about a third of its area — the approved lata is 89 % of
// its own width and 21 % of the sprite — because the game maps the food slots and the heat
// bands onto that quad. A "1.4:1 opening" written into a landscape frame is impossible next
// to a visible front panel, which is exactly what pushed lote 03 into drawing a small window.
// The guide is generated FROM THE DATA (docs/22 §6.8): the object is picked by
// `visual.style`, the opening by `requiredMouth(art, {zoneCount, slotsPerZone})` for that
// exact evolution. So the silhouette, the game's slot math and the art review can never
// disagree, and a grill with more zones is drawn with a taller bed, not just "bigger".
import { loadStandard, capacity, requiredMouth } from './grill-geometry.mjs';

const STYLE_BODIES = {
  lata:    { body: [0.05, 0.10, 0.95, 0.66], base: { kind: 'drum', from: 0.66, to: 0.93, inset: 0.12 }, shelf: null, chimney: null },
  chapa:   { body: [0.06, 0.10, 0.94, 0.60], base: { kind: 'wheels', from: 0.60, to: 0.90, inset: 0.13 }, shelf: [0.94, 0.34, 0.99, 0.48], chimney: [0.13, 0.035, 0.19, 0.115] },
  inox:    { body: [0.05, 0.12, 0.95, 0.60], base: { kind: 'legs', from: 0.60, to: 0.90, inset: 0.10 }, shelf: [0.95, 0.30, 1.00, 0.46], chimney: [0.09, 0.0, 0.15, 0.075] },
  fornalha:{ body: [0.03, 0.10, 0.97, 0.585], base: { kind: 'plinth', from: 0.585, to: 0.97, inset: 0.0 }, shelf: null, chimney: [0.08, 0.0, 0.16, 0.115] },
  // Os três estilos que entraram com a escada de dez grelhas (docs/23 §2). O que importa para a
  // régua é o corpo e a boca; os detalhes abaixo da boca (spits/valve/counter) são caráter — são
  // desenhados *fora* do magenta, porque qualquer coisa sobre o buraco encolhe o leito detectado
  // pelo process-sprites e a grelha inteira volta para `redo`.
  espeto:  { body: [0.04, 0.14, 0.96, 0.66], base: { kind: 'drum', from: 0.66, to: 0.94, inset: 0.14 }, shelf: null, chimney: null, spits: true, motor: true },
  tambor:  { body: [0.12, 0.09, 0.88, 0.60], base: { kind: 'legs', from: 0.60, to: 0.95, inset: 0.16 }, shelf: null, chimney: [0.42, 0.0, 0.58, 0.075], valve: true },
  campeao: { body: [0.03, 0.13, 0.97, 0.60], base: { kind: 'plinth', from: 0.60, to: 0.96, inset: 0.02 }, shelf: [0.97, 0.32, 1.00, 0.46], chimney: null, counter: [0.0, 0.075, 1.0, 0.115] },
};

async function drawGuide(out, kindOrOpts) {
  const standard = await loadStandard(ROOT);
  const { grillId, evo, W = 1408 } = kindOrOpts;
  const ch = standard.churrasqueiras.find((c) => c.id === grillId);
  if (!ch) throw new Error(`churrasqueira ${grillId} não está em churrasqueiras.json`);
  const style = ch.visual?.style ?? 'inox';
  const g = STYLE_BODIES[style];
  if (!g) throw new Error(`style ${style} não tem silhueta no make-ref (adicione em STYLE_BODIES)`);
  const cap = capacity(standard, grillId, evo);
  const need = requiredMouth(standard.art, cap);
  const aspect = need.bedW / need.mouthH;
  // The frame is derived from the mouth, never the other way round: the opening takes MOUTH_W of
  // the width and MOUTH_H of the height, and the body, the front band and the base are laid out
  // in what is left. A grill with 3 zones therefore gets a taller, squarer image — which is what
  // "espaço de acordo com cada uma" means in pixels. (Hard-coded 16:9 frames are what made the
  // mouth leak past the body in the first place.)
  const MOUTH_W = 0.8, MOUTH_H = 0.42;
  const Wm = Math.round(W);
  const H = Math.max(768, Math.ceil((MOUTH_W * Wm / aspect) / MOUTH_H / 16) * 16);
  const mwFrac = MOUTH_W;
  const mH = (MOUTH_W * Wm / aspect) / H;
  const mTop = 0.5 - mH / 2 - 0.06;
  const mouth = [0.5 - mwFrac / 2, mTop, 0.5 + mwFrac / 2, mTop + mH];
  const body = [0.5 - mwFrac / 2 - 0.045, mTop - 0.05, 0.5 + mwFrac / 2 + 0.045, mouth[3] + 0.17];
  const base = { from: body[3], to: Math.min(0.97, body[3] + 0.24) };
  const c = createCanvas(W, H);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#FF00FF'; ctx.fillRect(0, 0, W, H);
  const rect = ([x0, y0, x1, y1], fill, r = 0) => {
    const [x, y, w, h] = [x0 * W, y0 * H, (x1 - x0) * W, (y1 - y0) * H];
    ctx.fillStyle = fill;
    if (!r || !ctx.roundRect) { ctx.fillRect(x, y, w, h); return; }
    ctx.beginPath(); ctx.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2)); ctx.fill();
  };
  const BODY = '#4a4038', FAR = '#3d352e', NEAR = '#5b5045';
  if (g.chimney) rect([g.chimney[0], body[1] - 0.09, g.chimney[2], body[1] + 0.01], FAR);
  rect(body, BODY, W * 0.012);
  if (g.shelf) rect(g.shelf, NEAR, W * 0.006);
  ctx.fillStyle = FAR;
  const bi = g.base.inset;
  if (g.base.kind === 'plinth') {
    rect([bi, base.from, 1 - bi, base.to], NEAR, W * 0.008);
    rect([bi + 0.02, base.from + 0.025, 1 - bi - 0.02, base.to - 0.03], FAR);
  } else if (g.base.kind === 'wheels') {
    for (const cx of [bi, 1 - bi - 0.02]) {
      ctx.fillRect(cx * W, base.from * H, W * 0.016, (base.to - base.from) * H * 0.72);
      ctx.beginPath(); ctx.arc((cx + 0.008) * W, base.to * H - H * 0.04, H * 0.04, 0, Math.PI * 2); ctx.fill();
    }
  } else if (g.base.kind === 'drum') {
    ctx.beginPath(); ctx.ellipse(W * 0.5, H * (base.from + 0.015), W * 0.42, H * 0.04, 0, 0, Math.PI * 2); ctx.fill();
  } else {
    for (const cx of [bi, 1 - bi - 0.025]) ctx.fillRect(cx * W, base.from * H, W * 0.026, (base.to - base.from) * H);
  }
  if (g.counter) rect(g.counter, NEAR, W * 0.006);   // bancada do campeão: sempre acima do corpo
  rect(mouth, '#FF00FF');   // the opening: painted by the model, detected by process-sprites
  // Caráter do estilo, desenhado na faixa entre a boca e a base — nunca sobre o magenta.
  const bandTop = mouth[3] + 0.012, bandBot = body[3] - 0.012;
  if (g.spits) {
    ctx.fillStyle = '#6f6257';
    for (let i = 0; i < 3; i++) {
      const y = bandTop + (bandBot - bandTop) * (0.28 + i * 0.22);
      ctx.fillRect(mouth[0] * W, y * H, (mouth[2] - mouth[0]) * W, Math.max(2, H * 0.008));
    }
  }
  if (g.motor) { ctx.fillStyle = FAR; ctx.fillRect(body[0] * W - W * 0.05, (body[1] + 0.06) * H, W * 0.05, H * 0.10); }
  if (g.valve) {
    ctx.fillStyle = NEAR; ctx.beginPath();
    ctx.arc(body[2] * W + W * 0.012, ((bandTop + bandBot) / 2) * H, H * 0.022, 0, Math.PI * 2); ctx.fill();
  }
  const mwp = (mouth[2] - mouth[0]) * W, mhp = (mouth[3] - mouth[1]) * H;
  console.log(`[guide] ${grillId} e${evo} (${style}) ${W}×${H}: boca ${Math.round(mwp)}×${Math.round(mhp)} px `
    + `= ${(mwp / mhp).toFixed(2)}:1 · ${cap.zoneCount}×${cap.slotsPerZone} vagas · leito ${need.bedW} px na tela `
    + `· vaga ${need.cellW}×${need.cellH} → ${out}`);
  return c;
}

await mkdir(dirname(join(ROOT, out)), { recursive: true });
if (mode === 'guide') {
  const grillId = flags.grill, evo = +(flags.evo ?? 1);
  if (!grillId) { console.error('usage: make-ref.mjs guide <out.png> [W] --grill <id> --evo <n>'); process.exit(2); }
  await writeFile(join(ROOT, out), (await drawGuide(out, { grillId, evo, W: +W || 1408 })).toBuffer('image/png'));
  process.exit(0);
}
const manifest = existsSync(join(ROOT, 'Assets', 'Art', 'sprites.manifest.json'))
  ? JSON.parse(await readFile(join(ROOT, 'Assets', 'Art', 'sprites.manifest.json'), 'utf8'))
  : { sprites: {} };
const [cols, rows, names] = mode === 'grid' ? [+rest[0], +rest[1], rest.slice(2)] : [1, 1, rest.slice(0, 1)];
const c = createCanvas(+W, +H);
const ctx = c.getContext('2d');
ctx.fillStyle = '#FF00FF';
ctx.fillRect(0, 0, +W, +H);
ctx.imageSmoothingQuality = 'high';
const cw = +W / cols, ch = +H / rows;
for (let i = 0; i < names.length; i++) {
  const entry = manifest.sprites[names[i]];
  if (!entry) throw new Error(`${names[i]} is not in Assets/Art/sprites.manifest.json`);
  const img = await loadImage(await readFile(join(ROOT, entry.file)));
  const s = Math.min(1, (cw * 0.88) / img.width, (ch * 0.88) / img.height);
  const col = i % cols, row = Math.floor(i / cols);
  ctx.drawImage(img, col * cw + (cw - img.width * s) / 2, row * ch + (ch - img.height * s) / 2, img.width * s, img.height * s);
}
await mkdir(dirname(join(ROOT, out)), { recursive: true });
await writeFile(join(ROOT, out), c.toBuffer('image/png'));
console.log(`[ref] ${out} ${W}×${H} from ${names.length} sprite(s)`);
