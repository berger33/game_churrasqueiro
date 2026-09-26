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
const [mode, out, W, H, ...rest] = process.argv.slice(2);
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
const GRILL_GUIDES = {
  box: {
    body: [0.04, 0.06, 0.96, 0.62], mouth: [0.075, 0.095, 0.925, 0.50],
    base: { kind: 'legs', from: 0.62, to: 0.92, inset: 0.10 },
    shelf: [0.96, 0.30, 1.00, 0.46], chimney: [0.09, 0.0, 0.15, 0.075],
  },
  cart: {
    body: [0.06, 0.10, 0.94, 0.60], mouth: [0.10, 0.14, 0.90, 0.50],
    base: { kind: 'wheels', from: 0.60, to: 0.90, inset: 0.13 },
    shelf: [0.94, 0.34, 0.99, 0.48], chimney: [0.13, 0.035, 0.19, 0.115],
  },
  masonry: {
    body: [0.03, 0.10, 0.97, 0.66], mouth: [0.09, 0.14, 0.91, 0.52],
    base: { kind: 'plinth', from: 0.66, to: 0.97, inset: 0.0 },
    shelf: null, chimney: [0.08, 0.0, 0.16, 0.115],
  },
};

function drawGuide(out, W, H, kind) {
  const g = GRILL_GUIDES[kind];
  if (!g) throw new Error(`unknown guide kind ${kind} (want ${Object.keys(GRILL_GUIDES).join('|')})`);
  const c = createCanvas(W, H);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#FF00FF';
  ctx.fillRect(0, 0, W, H);
  const rect = ([x0, y0, x1, y1], fill, r = 0) => {
    const [x, y, w, h] = [x0 * W, y0 * H, (x1 - x0) * W, (y1 - y0) * H];
    ctx.fillStyle = fill;
    if (!r || !ctx.roundRect) { ctx.fillRect(x, y, w, h); return; }
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2));
    ctx.fill();
  };
  const BODY = '#4a4038', FAR = '#3d352e', NEAR = '#5b5045';
  if (g.chimney) rect(g.chimney, FAR);
  rect(g.body, BODY, W * 0.012);
  if (g.shelf) rect(g.shelf, NEAR, W * 0.006);
  if (g.base.kind === 'plinth') {
    rect([g.base.inset, g.base.from, 1 - g.base.inset, g.base.to], NEAR, W * 0.008);
    rect([g.base.inset + 0.02, g.base.from + 0.04, 1 - g.base.inset - 0.02, g.base.to - 0.05], FAR);
  } else if (g.base.kind === 'wheels') {
    ctx.fillStyle = FAR;
    for (const cx of [g.base.inset + 0.04, 1 - g.base.inset - 0.04]) {
      ctx.fillRect(cx * W, g.base.from * H, W * 0.018, (g.base.to - g.base.from) * H * 0.7);
      ctx.beginPath();
      ctx.arc((cx + 0.009) * W, g.base.to * H - H * 0.045, H * 0.045, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    ctx.fillStyle = FAR;
    for (const cx of [g.base.inset, 1 - g.base.inset - 0.03]) {
      ctx.fillRect(cx * W, g.base.from * H, W * 0.03, (g.base.to - g.base.from) * H);
    }
  }
  rect(g.mouth, '#FF00FF'); // the opening: the model must leave exactly this empty
  // Report the mouth the way the detector will measure it: pixel aspect, share of the frame
  // width, and share of the object's own bbox (lata aprovada: 89 % × 21 %).
  const [mwpx, mhpx] = [(g.mouth[2] - g.mouth[0]) * W, (g.mouth[3] - g.mouth[1]) * H];
  const [bwpx, bhpx] = [(g.body[2] - g.body[0]) * W, (g.base.to - g.body[1]) * H];
  console.log(`[ref] ${out} ${W}×${H} ${kind}: boca ${Math.round(mwpx)}×${Math.round(mhpx)} px `
    + `(${(mwpx / mhpx).toFixed(2)}:1), ${Math.round((mwpx / bwpx) * 100)} % da largura do objeto, `
    + `${Math.round((mwpx * mhpx / (bwpx * bhpx)) * 100)} % do bbox, topo horizontal`);
  return c;
}

await mkdir(dirname(join(ROOT, out)), { recursive: true });
if (mode === 'guide') {
  await writeFile(join(ROOT, out), drawGuide(out, +W, +H, rest[0]).toBuffer('image/png'));
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
