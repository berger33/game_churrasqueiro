#!/usr/bin/env node
/**
 * make-ref — rebuilds style/layout reference images for the image model from approved
 * masters in Assets/Art (docs/22-ARTE_2D_PLANO.md §1). Raw model outputs are not in git and
 * do not survive a workspace reset, so references are always composed from the masters:
 * sprites are laid back onto flat magenta exactly the way the model is asked to paint.
 *
 *   node tools/art/make-ref.mjs grid        <out.png> <W> <H> <cols> <rows> <sprite>...
 *   node tools/art/make-ref.mjs single      <out.png> <W> <H> <sprite>
 *   node tools/art/make-ref.mjs grill-guide <out.png> <W> <H> <chapa|inox|fornalha>
 *
 * <sprite> is a manifest name (spr_food_picanha_raw). Each sprite is centred in its cell and
 * scaled down only if it does not fit in 88 % of the cell. `grill-guide` is a deliberately
 * simple geometry plate: the large magenta top opening is the authoritative gameplay layout;
 * the image model paints the finish, not a front-facing oven window.
 */
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';

const ROOT = join(import.meta.dirname, '..', '..');
const [mode, out, wArg, hArg, ...rest] = process.argv.slice(2);
if (!['grid', 'single', 'grill-guide'].includes(mode) || !out) {
  console.error('usage: make-ref.mjs grid <out.png> <W> <H> <cols> <rows> <sprite>... | single <out.png> <W> <H> <sprite> | grill-guide <out.png> <W> <H> <chapa|inox|fornalha>');
  process.exit(2);
}

const W = Number(wArg), H = Number(hArg);
if (!Number.isInteger(W) || !Number.isInteger(H) || W < 128 || H < 128) {
  console.error('W and H must be integers >= 128');
  process.exit(2);
}

function polygon(ctx, points, fill, stroke = '#2a1b14', lineWidth = 16) {
  ctx.beginPath();
  points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lineWidth; ctx.lineJoin = 'round'; ctx.stroke(); }
}

function drawGrillGuide(ctx, style) {
  const palette = {
    chapa: { shell: '#424544', light: '#757B78', dark: '#242828', accent: '#B9824F', base: '#343938' },
    inox: { shell: '#B8C5C9', light: '#E5EBE9', dark: '#718087', accent: '#9A4831', base: '#994832' },
    fornalha: { shell: '#853629', light: '#BA6041', dark: '#4A201A', accent: '#D9B27C', base: '#793024' },
  }[style];
  if (!palette) throw new Error(`unknown grill guide style "${style}" (use chapa, inox, fornalha)`);

  // The whole field and the cooking bed are the exact chroma key. The latter is a closed,
  // oversized quadrilateral: ~80% of the sprite width, ~1.4:1 and a horizontal far rim.
  ctx.fillStyle = '#FF00FF';
  ctx.fillRect(0, 0, 1024, 1024);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // Wheels / masonry pedestal and frame are deliberately behind the firebox.
  if (style === 'chapa') {
    ctx.strokeStyle = palette.dark; ctx.lineWidth = 30;
    for (const x of [185, 840]) {
      ctx.beginPath(); ctx.moveTo(x, 720); ctx.lineTo(x - 18, 914); ctx.stroke();
      ctx.beginPath(); ctx.arc(x - 18, 928, 28, 0, Math.PI * 2); ctx.fillStyle = '#292D2D'; ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(x - 18, 928, 9, 0, Math.PI * 2); ctx.fillStyle = '#7A7770'; ctx.fill();
    }
    ctx.strokeStyle = palette.dark; ctx.lineWidth = 22;
    ctx.beginPath(); ctx.moveTo(168, 865); ctx.lineTo(846, 865); ctx.stroke();
    // compact rear-left smoke stack, connected to the top assembly
    polygon(ctx, [[145, 170], [231, 170], [220, 318], [153, 318]], palette.dark, '#171B1B', 12);
    polygon(ctx, [[132, 160], [244, 160], [244, 185], [132, 185]], palette.light, '#202424', 10);
  } else {
    const baseTop = style === 'inox' ? 735 : 725;
    polygon(ctx, [[117, baseTop], [907, baseTop], [891, 871], [137, 871]], palette.base, palette.dark, 15);
    // simplified mortar courses on the layout plate, never over the opening
    ctx.strokeStyle = style === 'inox' ? '#68352B' : '#C17A51';
    ctx.lineWidth = 8;
    for (const y of [780, 825]) {
      ctx.beginPath(); ctx.moveTo(142, y); ctx.lineTo(890, y); ctx.stroke();
    }
    ctx.strokeStyle = style === 'inox' ? '#68352B' : '#C17A51';
    for (const x of [300, 500, 700]) {
      ctx.beginPath(); ctx.moveTo(x, 780); ctx.lineTo(x - 34, 825); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + 90, 825); ctx.lineTo(x + 55, 870); ctx.stroke();
    }
    // rear chimney, attached to the firebox. A small ornament belongs only to the fornalha.
    if (style === 'inox') {
      polygon(ctx, [[133, 66], [226, 66], [226, 257], [133, 257]], palette.dark, '#354047', 14);
      polygon(ctx, [[117, 52], [243, 52], [243, 83], [117, 83]], palette.light, '#647177', 10);
      ctx.fillStyle = '#E8D8A3'; ctx.beginPath(); ctx.arc(211, 293, 31, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#4A5357'; ctx.lineWidth = 10; ctx.stroke();
    } else {
      polygon(ctx, [[128, 68], [244, 68], [234, 292], [139, 292]], palette.base, palette.dark, 15);
      polygon(ctx, [[109, 48], [263, 48], [263, 86], [109, 86]], palette.light, palette.dark, 12);
      if (style === 'fornalha') {
        // friendly abstract dragon silhouette on the chimney cap (no letters or logos)
        ctx.strokeStyle = '#E5B86D'; ctx.lineWidth = 18;
        ctx.beginPath(); ctx.moveTo(170, 52); ctx.quadraticCurveTo(136, 8, 183, 18); ctx.quadraticCurveTo(224, 28, 199, 50); ctx.stroke();
        ctx.beginPath(); ctx.arc(190, 20, 7, 0, Math.PI * 2); ctx.fillStyle = '#E5B86D'; ctx.fill();
      }
    }
  }

  // Body/apron behind the cooking plane. The opening is on TOP, not on this front fascia.
  polygon(ctx, [[77, 612], [947, 612], [903, 825], [121, 825]], palette.shell, palette.dark, 18);
  if (style === 'chapa') {
    // side shelf; joins the firebox, stays outside the gameplay aperture
    polygon(ctx, [[884, 505], [1001, 520], [1001, 575], [901, 570]], palette.light, palette.dark, 12);
    // front handle
    ctx.strokeStyle = palette.accent; ctx.lineWidth = 18;
    ctx.beginPath(); ctx.moveTo(85, 640); ctx.lineTo(37, 652); ctx.lineTo(37, 699); ctx.lineTo(91, 711); ctx.stroke();
  } else if (style === 'inox') {
    // small round thermometer on the apron, never on the open cooking bed
    ctx.fillStyle = '#E9E3D3'; ctx.beginPath(); ctx.arc(834, 683, 30, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#566269'; ctx.lineWidth = 8; ctx.stroke();
    ctx.strokeStyle = '#A3432E'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(834, 683); ctx.lineTo(848, 665); ctx.stroke();
    polygon(ctx, [[904, 540], [1000, 548], [1000, 580], [920, 574]], palette.light, palette.dark, 10);
  } else {
    // stone landing lip below the open hearth
    polygon(ctx, [[59, 710], [965, 710], [986, 758], [39, 758]], '#C99469', palette.dark, 12);
  }

  // Large top bed and continuous rim. Opening: far edge horizontal; trapezoid remains wide
  // and deep enough to map 2/3 horizontal heat bands without looking like a front window.
  polygon(ctx, [[42, 173], [982, 173], [1015, 742], [9, 742]], palette.light, palette.dark, 22);
  // Exact magenta aperture: width 670 px at the far rim, 830 px at the near rim; depth 535 px.
  // The exported guide is 1024²; this is approximately 1.4:1 by average width/depth.
  ctx.beginPath();
  ctx.moveTo(177, 197); ctx.lineTo(847, 197); ctx.lineTo(923, 725); ctx.lineTo(101, 725);
  ctx.closePath(); ctx.fillStyle = '#FF00FF'; ctx.fill();
  ctx.strokeStyle = palette.accent; ctx.lineWidth = 24; ctx.stroke();

  // Continuous metal/stone edge highlight around the opening, with no grate or fire painted in it.
  ctx.strokeStyle = palette.dark; ctx.lineWidth = 8;
  ctx.beginPath(); ctx.moveTo(177, 197); ctx.lineTo(847, 197); ctx.lineTo(923, 725); ctx.lineTo(101, 725); ctx.closePath(); ctx.stroke();

  // Minimal side handles attached to the firebox, kept within the 1024px canvas.
  if (style !== 'fornalha') {
    ctx.strokeStyle = palette.accent; ctx.lineWidth = 20;
    ctx.beginPath(); ctx.moveTo(92, 570); ctx.lineTo(33, 562); ctx.lineTo(21, 611); ctx.lineTo(88, 624); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(934, 570); ctx.lineTo(991, 562); ctx.lineTo(1003, 611); ctx.lineTo(937, 624); ctx.stroke();
  }
}

async function save(canvas) {
  const file = join(ROOT, out);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, canvas.toBuffer('image/png'));
  console.log(`[ref] ${out} ${canvas.width}×${canvas.height}`);
}

if (mode === 'grill-guide') {
  const style = rest[0];
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  ctx.scale(W / 1024, H / 1024);
  drawGrillGuide(ctx, style);
  await save(canvas);
} else {
  const manifest = JSON.parse(await readFile(join(ROOT, 'Assets', 'Art', 'sprites.manifest.json'), 'utf8'));
  const [cols, rows, names] = mode === 'grid' ? [+rest[0], +rest[1], rest.slice(2)] : [1, 1, rest.slice(0, 1)];
  const c = createCanvas(W, H);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#FF00FF';
  ctx.fillRect(0, 0, W, H);
  ctx.imageSmoothingQuality = 'high';
  const cw = W / cols, ch = H / rows;
  for (let i = 0; i < names.length; i++) {
    const entry = manifest.sprites[names[i]];
    if (!entry) throw new Error(`${names[i]} is not in Assets/Art/sprites.manifest.json`);
    const img = await loadImage(await readFile(join(ROOT, entry.file)));
    const s = Math.min(1, (cw * 0.88) / img.width, (ch * 0.88) / img.height);
    const col = i % cols, row = Math.floor(i / cols);
    ctx.drawImage(img, col * cw + (cw - img.width * s) / 2, row * ch + (ch - img.height * s) / 2, img.width * s, img.height * s);
  }
  await save(c);
}
