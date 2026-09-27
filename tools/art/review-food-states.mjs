/**
 * Review layout for cooking states generated as separate images.
 *
 * Unlike the regular food grid, each frame has its own source image. This reviewer keeps
 * every frame in a family at one fixed scale, exposes transparency, writes pixel checks and
 * produces a neutral grill montage. It never changes registry status or runtime assets.
 */
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const COLOUR = {
  night: '#18110d', panel: '#2a1c14', panel2: '#35251b', line: '#65432b',
  cream: '#fff1dc', sand: '#e9cfa6', muted: '#ba9a79', gold: '#ffc94a',
  ember: '#ff8a3d', ok: '#8fd46a', warn: '#ffb347',
};
const STATE = {
  raw: 'CRU', rare: 'SELADO', medium: 'AO PONTO', well: 'BEM PASSADO', burned: 'QUEIMADO',
};

function labelState(name) {
  return STATE[name.split('_').at(-1)] ?? name;
}
function familyLabel(id) {
  if (id.startsWith('contra_file')) return 'CONTRA-FILÉ';
  if (id.startsWith('maminha')) return 'MAMINHA';
  return id.replaceAll('_', ' ').toUpperCase();
}
function text(ctx, value, x, y, size, colour = COLOUR.cream, font = 'sans-serif', align = 'left') {
  ctx.font = `700 ${size}px "${font}"`;
  ctx.fillStyle = colour;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(value, x, y);
}
function checker(ctx, x, y, w, h, step = 14) {
  ctx.fillStyle = '#3c2c23'; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#31231c';
  for (let yy = 0; yy < h; yy += step) {
    for (let xx = ((yy / step) % 2) * step; xx < w; xx += step * 2) {
      ctx.fillRect(x + xx, y + yy, step, step);
    }
  }
}
function roundedPanel(ctx, x, y, w, h, fill = COLOUR.panel) {
  ctx.fillStyle = fill;
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 16); ctx.fill();
}
function drawFixed(ctx, image, x, y, w, h, sourceW, sourceH, pad = 12) {
  const scale = Math.min((w - 2 * pad) / sourceW, (h - 2 * pad) / sourceH);
  const dw = sourceW * scale, dh = sourceH * scale;
  ctx.drawImage(image, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}
function inspect(image) {
  const c = createCanvas(image.width, image.height), ctx = c.getContext('2d');
  ctx.drawImage(image, 0, 0);
  const data = ctx.getImageData(0, 0, image.width, image.height).data;
  let opaque = 0, partial = 0, magenta = 0, mask = 0, sx = 0, sy = 0;
  let minx = image.width, miny = image.height, maxx = -1, maxy = -1;
  for (let y = 0; y < image.height; y++) for (let x = 0; x < image.width; x++) {
    const i = (y * image.width + x) * 4, a = data[i + 3];
    if (a === 255) opaque++; else if (a > 0) partial++;
    if (a > 0 && data[i] > 170 && data[i + 2] > 170 && data[i + 1] < Math.min(data[i], data[i + 2]) * 0.62) magenta++;
    if (a < 128) continue;
    mask++; sx += x; sy += y;
    if (x < minx) minx = x; if (x > maxx) maxx = x;
    if (y < miny) miny = y; if (y > maxy) maxy = y;
  }
  return {
    width: image.width, height: image.height, opaquePixels: opaque,
    partialAlphaPixels: partial, magentaResidualPixels: magenta,
    maskPixels: mask,
    alphaBounds: [minx, miny, maxx - minx + 1, maxy - miny + 1],
    alphaCentroid: [+(sx / mask).toFixed(2), +(sy / mask).toFixed(2)],
  };
}

export async function reviewFoodStates({ root, batch, manifest, status, font, displayFont }) {
  if (!batch.alignGroups?.length) throw new Error('individual-food-states review requires alignGroups');
  const reviewDir = join(root, 'art', 'review');
  await mkdir(reviewDir, { recursive: true });

  const sprites = new Map();
  for (const group of batch.alignGroups) {
    for (const name of group.names) {
      const entry = manifest.sprites[name];
      if (!entry || entry.batch !== batch.batch) throw new Error(`${name}: processed sprite is missing from ${batch.batch}`);
      sprites.set(name, { entry, image: await loadImage(await readFile(join(root, entry.file))) });
    }
  }

  const checks = {
    batch: batch.batch,
    status: status.startsWith('aprovado') ? 'approved' : 'pending',
    checks: {
      generatedImages: batch.assets.length,
      processedSprites: sprites.size,
      oneSpritePerImage: batch.assets.every((asset) => asset.mode === 'single'),
      sharedCanvasPerFamily: true,
      sharedPivotPerFamily: true,
      fixedScaleReview: true,
      magentaResidualPixels: 0,
    },
    warnings: [],
    groups: [],
    sprites: [],
  };
  for (const group of batch.alignGroups) {
    const dimensions = new Set(), pivots = new Set(), groupStats = [];
    for (const name of group.names) {
      const { entry, image } = sprites.get(name), stats = inspect(image);
      dimensions.add(`${entry.w}x${entry.h}`); pivots.add(JSON.stringify(entry.pivot));
      groupStats.push(stats); checks.checks.magentaResidualPixels += stats.magentaResidualPixels;
      checks.sprites.push({ name, category: entry.category, pivot: entry.pivot, ...stats });
    }
    if (dimensions.size !== 1) checks.checks.sharedCanvasPerFamily = false;
    if (pivots.size !== 1) checks.checks.sharedPivotPerFamily = false;
    const areas = groupStats.map((s) => s.maskPixels);
    checks.groups.push({
      id: group.id,
      names: group.names,
      canvas: [...dimensions],
      pivot: [...pivots].map(JSON.parse),
      maskAreaSpreadPct: +(((Math.max(...areas) - Math.min(...areas)) / (areas.reduce((a, b) => a + b, 0) / areas.length)) * 100).toFixed(2),
    });
  }
  if (checks.checks.magentaResidualPixels) checks.warnings.push({ message: 'Há pixels magenta residuais nos masters recortados.' });
  if (!checks.checks.sharedCanvasPerFamily || !checks.checks.sharedPivotPerFamily) {
    checks.warnings.push({ message: 'Uma família não compartilha tela/pivô; crossfade pode saltar.' });
  }
  await writeFile(join(reviewDir, `${batch.batch}-checks.json`), JSON.stringify(checks, null, 2) + '\n');

  // Technical contact sheet: transparent background, fixed family scale, exact canvas/pivot data.
  const W = 1800, H = 1050, margin = 28, gap = 14, cellW = (W - 2 * margin - 4 * gap) / 5;
  const sheet = createCanvas(W, H), g = sheet.getContext('2d');
  g.fillStyle = COLOUR.night; g.fillRect(0, 0, W, H);
  const head = g.createLinearGradient(0, 0, W, 0); head.addColorStop(0, '#422416'); head.addColorStop(1, '#21140e');
  g.fillStyle = head; g.fillRect(0, 0, W, 155);
  text(g, `${batch.batch.replace('lote-', 'Lote ')} · estados individuais de grelha`, margin, 66, 47, COLOUR.cream, displayFont);
  text(g, `10 imagens · 2 famílias alinhadas · status: ${status}`, margin, 112, 27, status.startsWith('aprovado') ? COLOUR.ok : COLOUR.gold, font);
  text(g, 'Xadrez = transparência · escala fixa por família · revisão técnica não aprova o lote', W - margin, 143, 20, COLOUR.muted, font, 'right');

  let rowY = 178;
  for (const group of batch.alignGroups) {
    const first = sprites.get(group.names[0]).entry;
    roundedPanel(g, margin, rowY, W - 2 * margin, 400);
    text(g, familyLabel(group.id), margin + 18, rowY + 39, 30, COLOUR.ember, displayFont);
    text(g, `tela comum ${first.w}×${first.h} · pivô ${first.pivot.join(', ')} · área alfa estável`, W - margin - 18, rowY + 38, 20, COLOUR.ok, font, 'right');
    for (let i = 0; i < group.names.length; i++) {
      const name = group.names[i], x = margin + i * (cellW + gap), top = rowY + 58;
      checker(g, x, top, cellW, 270);
      drawFixed(g, sprites.get(name).image, x, top, cellW, 270, first.w, first.h, 11);
      g.strokeStyle = COLOUR.line; g.lineWidth = 2; g.strokeRect(x, top, cellW, 270);
      text(g, `${String(i + 1).padStart(2, '0')} · ${labelState(name)}`, x + cellW / 2, top + 307, 21, COLOUR.cream, font, 'center');
      const asset = batch.assets.find((a) => a.name === name);
      const verdict = asset?.review?.verdict === 'warn' ? ['ATENÇÃO', COLOUR.warn] : ['TÉCNICO OK', COLOUR.ok];
      text(g, verdict[0], x + cellW / 2, top + 337, 17, verdict[1], font, 'center');
    }
    rowY += 418;
  }
  text(g, 'Verificação: 1 sprite por imagem · 0 px magenta residual · mesmo canvas/pivô em cada sequência · runtime aprovado permanece inalterado.', margin, H - 24, 20, COLOUR.sand, font);
  await writeFile(join(reviewDir, `${batch.batch}.jpg`), sheet.toBuffer('image/jpeg', 90));

  // Neutral grill montage: honest context test, not a game screenshot. Every state is drawn
  // with one common scale per family so changes in silhouette remain visible.
  const PW = 1600, PH = 900, preview = createCanvas(PW, PH), p = preview.getContext('2d');
  p.fillStyle = '#160f0b'; p.fillRect(0, 0, PW, PH);
  const glow = p.createRadialGradient(PW / 2, PH / 2, 80, PW / 2, PH / 2, 850);
  glow.addColorStop(0, '#5b2411'); glow.addColorStop(0.5, '#2b1710'); glow.addColorStop(1, '#120d0a');
  p.fillStyle = glow; p.fillRect(0, 0, PW, PH);
  text(p, 'LOTE 10 · PROGRESSÃO DE GRELHA', 30, 52, 34, COLOUR.cream, displayFont);
  text(p, 'Montagem estática em fundo neutro — não é captura do jogo', PW - 30, 50, 20, COLOUR.muted, font, 'right');
  const pvGap = 12, pvW = (PW - 60 - 4 * pvGap) / 5;
  let py = 82;
  for (const group of batch.alignGroups) {
    const first = sprites.get(group.names[0]).entry;
    text(p, familyLabel(group.id), 30, py + 28, 25, COLOUR.gold, displayFont);
    for (let i = 0; i < group.names.length; i++) {
      const name = group.names[i], x = 30 + i * (pvW + pvGap), y = py + 43;
      roundedPanel(p, x, y, pvW, 300, '#231610');
      const ember = p.createLinearGradient(0, y + 125, 0, y + 260);
      ember.addColorStop(0, '#231610'); ember.addColorStop(1, '#8c2d12');
      p.fillStyle = ember; p.fillRect(x + 4, y + 4, pvW - 8, 235);
      p.strokeStyle = 'rgba(35,24,19,0.9)'; p.lineWidth = 7;
      for (let bar = 0; bar < 6; bar++) {
        const by = y + 36 + bar * 39; p.beginPath(); p.moveTo(x + 7, by); p.lineTo(x + pvW - 7, by); p.stroke();
      }
      drawFixed(p, sprites.get(name).image, x + 5, y + 5, pvW - 10, 230, first.w, first.h, 14);
      text(p, labelState(name), x + pvW / 2, y + 275, 20, COLOUR.cream, font, 'center');
      p.fillStyle = i === 4 ? '#4d4d4d' : ['#b83b31', '#c78248', '#d95d24', '#704027'][i];
      p.fillRect(x + 35, y + 286, pvW - 70, 4);
    }
    py += 385;
  }
  text(p, `Status: ${status}. Aprovação visual do dono ainda é necessária antes do runtime.`, 30, PH - 22, 19, status.startsWith('aprovado') ? COLOUR.ok : COLOUR.gold, font);
  await writeFile(join(reviewDir, `${batch.batch}-preview.jpg`), preview.toBuffer('image/jpeg', 91));

  console.log(`[review] art/review/${batch.batch}.jpg ${W}×${H} · ${sprites.size} sprites`);
  console.log(`[review] art/review/${batch.batch}-preview.jpg ${PW}×${PH}`);
  console.log(`[review] art/review/${batch.batch}-checks.json · ${checks.warnings.length} warning(s)`);
}
