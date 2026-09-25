#!/usr/bin/env node
/**
 * make-ref — rebuilds a style/layout reference image for the image model from approved
 * masters in Assets/Art (docs/22-ARTE_2D_PLANO.md §1). Raw model outputs are not in git and
 * do not survive a workspace reset, so references are always composed from the masters:
 * sprites are laid back onto flat magenta exactly the way the model is asked to paint.
 *
 *   node tools/art/make-ref.mjs grid   <out.png> <W> <H> <cols> <rows> <sprite>...
 *   node tools/art/make-ref.mjs single <out.png> <W> <H> <sprite>
 *
 * <sprite> is a manifest name (spr_food_picanha_raw). Each sprite is centred in its cell and
 * scaled down only if it does not fit in 88 % of the cell.
 */
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';

const ROOT = join(import.meta.dirname, '..', '..');
const [mode, out, W, H, ...rest] = process.argv.slice(2);
if (!['grid', 'single'].includes(mode) || !out) {
  console.error('usage: make-ref.mjs grid <out.png> <W> <H> <cols> <rows> <sprite>... | single <out.png> <W> <H> <sprite>');
  process.exit(2);
}
const manifest = JSON.parse(await readFile(join(ROOT, 'Assets', 'Art', 'sprites.manifest.json'), 'utf8'));
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
