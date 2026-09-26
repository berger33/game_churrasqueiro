#!/usr/bin/env node
/**
 * review-sheet — the approval deliverable of an art batch (docs/22-ARTE_2D_PLANO.md §5).
 *
 *   node tools/art/review-sheet.mjs art/<lote>.json
 *
 * Reads the processed sprites through Assets/Art/sprites.manifest.json (so it works even
 * after the raw files are gone) and writes:
 *   art/review/<lote>.jpg          contact sheet: every sprite of the batch, labelled, on a
 *                                   checkerboard so the transparency is visible
 *   art/review/<lote>-preview.jpg   montage in the game's 420×780 layout (2×). It is labelled
 *                                   as a montage: it is NOT a capture of the running game and
 *                                   must never be used as a store screenshot (docs/15-ASO.md §5).
 * Everything batch-specific comes from the spec: `label`, `cellLabels`, `review`
 * ({ verdict: ok|warn|redo, note }), per-name `label`/`flag`, `compare` (earlier sprites shown
 * next to this batch's grills) and `preview` (what the montage shows). The batch status in
 * the header is read from Assets/Art/ASSET_REGISTRY.csv.
 * Fonts: Baloo 2 / Nunito TTFs when found in $ART_FONTS_DIR (default /tmp/fonts, e.g. from
 * `npm pack @expo-google-fonts/baloo-2 @expo-google-fonts/nunito`); otherwise the system sans.
 */
import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas';
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..', '..');
const manifest = JSON.parse(await readFile(join(ROOT, 'Assets', 'Art', 'sprites.manifest.json'), 'utf8'));
const specPath = process.argv[2];
if (!specPath) { console.error('usage: node tools/art/review-sheet.mjs art/<lote>.json'); process.exit(2); }
const batch = JSON.parse(await readFile(join(ROOT, specPath), 'utf8'));
const batchLabel = batch.batch.replace('lote-', 'Lote ');

// ── fonts ────────────────────────────────────────────────────────────────────
async function findTtf(dir, re) {
  if (!existsSync(dir)) return null;
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) { const r = await findTtf(p, re); if (r) return r; }
    else if (re.test(e.name)) return p;
  }
  return null;
}
const fontDir = process.env.ART_FONTS_DIR ?? '/tmp/fonts';
const fontFiles = {
  display: await findTtf(fontDir, /^Baloo2_800ExtraBold\.ttf$/),
  ui: await findTtf(fontDir, /^Nunito_800ExtraBold\.ttf$/),
  uiBold: await findTtf(fontDir, /^Nunito_700Bold\.ttf$/),
};
if (fontFiles.display) GlobalFonts.registerFromPath(fontFiles.display, 'ReviewDisplay');
if (fontFiles.ui) GlobalFonts.registerFromPath(fontFiles.ui, 'ReviewUI');
if (fontFiles.uiBold) GlobalFonts.registerFromPath(fontFiles.uiBold, 'ReviewUIBold');
const DISPLAY = fontFiles.display ? 'ReviewDisplay' : 'DejaVu Sans';
const UI = fontFiles.ui ? 'ReviewUI' : 'DejaVu Sans';
const UIB = fontFiles.uiBold ? 'ReviewUIBold' : 'DejaVu Sans';

// ── palette (shared with prototype/src/theme.ts, docs/04 §3) ─────────────────
const P = {
  night: '#1b120d', panel: '#2a1c14', line: '#4a3223',
  cream: '#fff1dc', sand: '#e9cfa6', muted: '#bfa283', ember: '#ff8a3d', gold: '#ffc94a',
  ok: '#8fd46a', warn: '#ffb347', bad: '#ff6b5a', cyan: '#5fe3ff',
};
const VERDICT = { ok: [P.ok, 'ok'], warn: [P.warn, 'atenção'], redo: [P.bad, 'refazer'] };

const STATE_LABEL = { raw: 'cru', rare: 'selado', medium: 'ao ponto', well: 'bem passado', burned: 'queimado', served: 'servido', prep: 'picado', ready: 'pronto' };
const FOOD_LABEL = { picanha: 'Picanha', linguica_toscana: 'Linguiça toscana', pao_de_alho: 'Pão de alho', queijo_coalho: 'Queijo coalho', espetinho_misto: 'Espetinho misto' };
const CUSTOMER_LABEL = {
  comum: 'comum', apressado_a: 'apressado (a)', apressado_b: 'apressado (b)', familia: 'família',
  tio_do_churrasco: 'tio do churrasco', influencer: 'influencer', turista: 'turista',
};

const cache = new Map();
async function sprite(name) {
  if (cache.has(name)) return cache.get(name);
  const entry = manifest.sprites[name];
  if (!entry) throw new Error(`sprite ${name} is not in the manifest — run process-sprites first`);
  const v = { img: await loadImage(await readFile(join(ROOT, entry.file))), ...entry };
  cache.set(name, v);
  return v;
}

async function batchStatus() {
  const file = join(ROOT, 'Assets', 'Art', 'ASSET_REGISTRY.csv');
  if (!existsSync(file)) return 'sem registro';
  const [head, ...rows] = (await readFile(file, 'utf8')).split('\n').filter((l) => l.trim());
  const cols = head.split(',');
  const bi = cols.indexOf('batch'), si = cols.indexOf('status');
  const count = {};
  for (const r of rows) {
    const cells = r.match(/("([^"]|"")*"|[^,]*)(,|$)/g).map((c) => c.replace(/,$/, ''));
    if (cells[bi] === batch.batch) count[cells[si]] = (count[cells[si]] ?? 0) + 1;
  }
  const total = Object.values(count).reduce((a, b) => a + b, 0);
  if (!total) return 'sem registro';
  const PT = { approved: 'aprovados', pending: 'pendentes', rejected: 'recusados', superseded: 'substituídos' };
  if (!count.pending && !count.rejected) return `aprovado${count.superseded ? ` (${count.superseded} substituído${count.superseded > 1 ? 's' : ''})` : ''}`;
  if (count.pending === total) return 'aguardando aprovação';
  return Object.entries(count).map(([k, v]) => `${v} ${PT[k] ?? k}`).join(', ');
}

// ── drawing helpers ──────────────────────────────────────────────────────────
function checker(ctx, x, y, w, h, s = 12, a = '#3b2a20', b = '#30221a') {
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.fillStyle = a; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = b;
  for (let yy = 0; yy < h; yy += s) for (let xx = ((yy / s) % 2) * s; xx < w; xx += s * 2) ctx.fillRect(x + xx, y + yy, s, s);
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

/** Draw `img` centred in the box, scaled to fit (never above maxScale). Returns the placement. */
function fit(ctx, img, x, y, w, h, pad = 8, maxScale = 1) {
  const s = Math.min((w - pad * 2) / img.width, (h - pad * 2) / img.height, maxScale);
  const dw = img.width * s, dh = img.height * s;
  const dx = x + (w - dw) / 2, dy = y + (h - dh) / 2;
  ctx.drawImage(img, dx, dy, dw, dh);
  return { dx, dy, s };
}

function text(ctx, str, x, y, size, color = P.cream, fam = UI, align = 'left') {
  ctx.font = `${size}px "${fam}"`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(str, x, y);
}

function wrap(ctx, str, x, y, maxW, size, lh, color = P.sand, fam = UIB, maxLines = Infinity) {
  ctx.font = `${size}px "${fam}"`;
  const lines = [];
  let line = '';
  for (const w of str.split(' ')) {
    const t = line ? `${line} ${w}` : w;
    if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t;
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) { // never spill out of the box: cut and mark the cut
    lines.length = Math.max(1, maxLines);
    let last = lines[lines.length - 1];
    while (last && ctx.measureText(`${last}…`).width > maxW) last = last.slice(0, -1);
    lines[lines.length - 1] = `${last.trimEnd()}…`;
  }
  lines.forEach((l, i) => text(ctx, l, x, y + i * lh, size, color, fam));
  return y + lines.length * lh;
}

function verdictChip(ctx, review, x, y) {
  if (!review?.verdict) return y;
  const [color, word] = VERDICT[review.verdict] ?? VERDICT.warn;
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(x + 8, y - 8, 8, 0, Math.PI * 2); ctx.fill();
  text(ctx, word, x + 24, y, 24, color, UIB);
  return y + 32;
}

function holeOutline(ctx, hole, p) {
  ctx.save();
  ctx.strokeStyle = P.cyan; ctx.lineWidth = 4; ctx.setLineDash([14, 10]);
  ctx.beginPath();
  hole.quad.forEach(([qx, qy], i) => { const px = p.dx + qx * p.s, py = p.dy + qy * p.s; if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); });
  ctx.closePath(); ctx.stroke(); ctx.restore();
}

// ── contact sheet ────────────────────────────────────────────────────────────
async function contactSheet() {
  const W = 2000, M = 28, H = 6000; // generous; trimmed to the content below
  const imgNo = (a) => batch.assets.indexOf(a) + 1;
  const c = createCanvas(W, H);
  const ctx = c.getContext('2d');
  ctx.fillStyle = P.night; ctx.fillRect(0, 0, W, H);

  const status = await batchStatus();
  const g = ctx.createLinearGradient(0, 0, W, 0);
  g.addColorStop(0, '#3a2014'); g.addColorStop(1, '#23150e');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, 170);
  text(ctx, `${batchLabel} · arte 2D gerada por IA`, M, 78, 60, P.cream, DISPLAY);
  const nSprites = Object.values(manifest.sprites).filter((s) => s.batch === batch.batch).length;
  text(ctx, `${batch.assets.length} imagens viraram ${nSprites} sprites recortados · ${batch.date} · status: ${status}`, M, 130, 30, status.startsWith('aprovado') ? P.ok : P.gold, UI);
  text(ctx, 'fundo xadrez = área transparente', W - M, 130, 24, P.muted, UIB, 'right');

  let y = 210;
  const section = (title, sub) => {
    text(ctx, title, M, y + 34, 38, P.ember, DISPLAY);
    if (sub) text(ctx, sub, M, y + 70, 24, P.muted, UIB);
    y += sub ? 92 : 58;
  };

  // foods (grid sheets)
  const foods = batch.assets.filter((a) => a.mode === 'grid');
  if (foods.length) {
    section('Comidas — estados de cozimento + servido', 'mesma peça, mesmo contorno e mesmo pivô em todos os estados de grelha: no jogo os estados vizinhos são misturados (crossfade) pelo ponto contínuo');
    const labelW = 250, cellW = 272, cellH = 196, gap = 10, rowH = cellH + 60;
    for (const a of foods) {
      ctx.fillStyle = P.panel; roundRect(ctx, M - 8, y - 8, W - 2 * M + 16, rowH, 18); ctx.fill();
      text(ctx, `#${imgNo(a)}`, M + 8, y + 50, 44, P.gold, DISPLAY);
      let ly = wrap(ctx, a.label ?? FOOD_LABEL[a.subject] ?? a.subject, M + 8, y + 94, labelW - 24, 30, 32, P.cream, DISPLAY);
      ly = verdictChip(ctx, a.review, M + 8, ly + 6);
      if (a.review?.note && a.review.verdict !== 'ok') {
        wrap(ctx, a.review.note, M + 8, ly, labelW - 24, 19, 22, P.sand, UIB, Math.floor((y + rowH - 20 - ly) / 22) + 1);
      }
      for (let i = 0; i < a.cells.length; i++) {
        const x = M + labelW + i * (cellW + gap);
        checker(ctx, x, y, cellW, cellH);
        const s = await sprite(`spr_food_${a.subject}_${a.cells[i]}`);
        fit(ctx, s.img, x, y, cellW, cellH, 6);
        const label = a.cellLabels?.[a.cells[i]] ?? STATE_LABEL[a.cells[i]] ?? a.cells[i];
        text(ctx, label, x + cellW / 2, y + cellH + 34, 26, a.cells[i] === 'served' ? P.gold : P.sand, UIB, 'center');
      }
      y += rowH + 16;
    }
  }

  // UI icons: big, then at the game's size (32 px) on dark and in greyscale on light
  const iconSets = batch.assets.filter((a) => a.mode === 'icons');
  if (iconSets.length) {
    section('Ícones', 'cada ícone também no tamanho real do jogo (32 px) e em cinza: a silhueta precisa ler sozinha');
    const labelW = 250, gap = 10;
    for (const a of iconSets) {
      const n = a.names.length, cw = (W - 2 * M - labelW - gap * (n - 1)) / n, rowH = cw + 128;
      ctx.fillStyle = P.panel; roundRect(ctx, M - 8, y - 8, W - 2 * M + 16, rowH, 18); ctx.fill();
      text(ctx, `#${imgNo(a)}`, M + 8, y + 50, 44, P.gold, DISPLAY);
      let ly = wrap(ctx, a.label ?? a.source, M + 8, y + 94, labelW - 24, 28, 30, P.cream, DISPLAY);
      ly = verdictChip(ctx, a.review, M + 8, ly + 6);
      if (a.review?.note) wrap(ctx, a.review.note, M + 8, ly, labelW - 24, 18, 21, P.sand, UIB, 3);
      for (let i = 0; i < n; i++) {
        const x = M + labelW + i * (cw + gap);
        const s = await sprite(a.names[i]);
        checker(ctx, x, y, cw, cw);
        fit(ctx, s.img, x, y, cw, cw, 12);
        // real size, on the dark UI panel colour
        ctx.fillStyle = '#2c2018'; roundRect(ctx, x, y + cw + 8, cw / 2 - 4, 48, 8); ctx.fill();
        fit(ctx, s.img, x + (cw / 2 - 4 - 32) / 2, y + cw + 16, 32, 32, 0);
        // greyscale test on a light card
        const g = createCanvas(32, 32), gx = g.getContext('2d');
        fit(gx, s.img, 0, 0, 32, 32, 0);
        const d = gx.getImageData(0, 0, 32, 32);
        for (let p = 0; p < d.data.length; p += 4) { const l = 0.299 * d.data[p] + 0.587 * d.data[p + 1] + 0.114 * d.data[p + 2]; d.data[p] = d.data[p + 1] = d.data[p + 2] = l; }
        gx.putImageData(d, 0, 0);
        ctx.fillStyle = '#efe6da'; roundRect(ctx, x + cw / 2 + 4, y + cw + 8, cw / 2 - 4, 48, 8); ctx.fill();
        ctx.drawImage(g, x + cw / 2 + 4 + (cw / 2 - 4 - 32) / 2, y + cw + 16);
        text(ctx, a.names[i].replace(/^ic_/, ''), x + cw / 2, y + cw + 88, 19, P.sand, UIB, 'center');
      }
      y += rowH + 16;
    }
  }

  // grills and props (single objects), with earlier sprites for comparison
  const singles = batch.assets.filter((a) => a.mode === 'single');
  // Comparison sprites go in a row of their own, above the batch's: sharing one row squeezed them to
  // ~110 px each, their names cannot wrap (no spaces to break on) and the labels printed over each
  // other — which is exactly the row the owner reads to answer "does the ladder grow?". Four across,
  // short labels, the measured mouth under each.
  const compare = batch.compare ?? [];
  if (compare.length) {
    section('Como está hoje no jogo (comparação)', 'as grelhas já aprovadas, na mesma folha e na mesma escala de recorte');
    const gap = 20, boxH = 300;
    const bw = (W - 2 * M - gap * (compare.length - 1)) / compare.length;
    let maxY = y;
    for (let i = 0; i < compare.length; i++) {
      const name = compare[i];
      const s = await sprite(name);
      const x = M + i * (bw + gap);
      checker(ctx, x, y, bw, boxH);
      const p = fit(ctx, s.img, x, y, bw, boxH, 12);
      if (s.hole) holeOutline(ctx, s.hole, p);
      const shortName = name.replace(/^spr_(grill|prop|food)_/, '').replace(/_evo(\d+)$/, (m, d) => ` · evo${d}`);
      let ty = wrap(ctx, shortName, x, y + boxH + 26, bw - 8, 22, 26, P.muted, UIB, 2);
      if (s.hole) text(ctx, `${s.hole.tiltDeg ?? '?'}° · ${Math.round(s.hole.areaFrac * 100)}% · ${s.batch.replace('lote-', 'lote ')}`, x, ty + 2, 20, P.cyan, UIB);
      maxY = Math.max(maxY, ty + 34);
    }
    y = maxY + 20;
  }
  const row = [...singles];
  if (row.length) {
    section('Churrasqueiras e props', 'a boca magenta da churrasqueira vira um furo transparente (contorno ciano = quadrilátero detectado); brasas e grelha são desenhadas por baixo');
    const gap = 20, boxH = 540;
    const bw = (W - 2 * M - gap * (row.length - 1)) / row.length;
    let maxY = y;
    for (let i = 0; i < row.length; i++) {
      const item = row[i];
      const x = M + i * (bw + gap);
      const name = item.name;
      const s = await sprite(name);
      checker(ctx, x, y, bw, boxH);
      const p = fit(ctx, s.img, x, y, bw, boxH, 16);
      if (s.hole) holeOutline(ctx, s.hole, p);
      let ty = y + boxH + 36;
      ty = wrap(ctx, `#${imgNo(item)} ${item.label ?? name}`, x, ty, bw - 10, 25, 29, P.cream, UIB, 2);
      ty = verdictChip(ctx, item.review, x, ty + 8);
      if (item.review?.note) ty = wrap(ctx, item.review.note, x, ty, bw - 10, 21, 25, P.sand, UIB);
      if (s.hole) ty = wrap(ctx, `boca: inclinação ${s.hole.tiltDeg ?? '?'}°, ${Math.round(s.hole.areaFrac * 100)} % do sprite`, x, ty + 4, bw - 10, 21, 25, P.cyan, UIB, 2) - 4;
      maxY = Math.max(maxY, ty + 30);
    }
    y = maxY + 30;
  }
  // embers (strips) and backdrops (opaque)
  const strips = batch.assets.filter((a) => a.mode === 'strips');
  const opaque = batch.assets.filter((a) => a.mode === 'opaque');
  if (strips.length || opaque.length) {
    if (strips.length) section('Brasas por calor e fundos', 'faixas opacas que ficam sob a grelha: fraco / médio / forte — mesmo desenho, só muda a intensidade');
    else section('Fundos dos restaurantes', 'cenas 9:16 sem pessoas nem texto; o terço do meio fica livre para a churrasqueira');
    const top = y;
    let bottom = y;
    for (const fxA of strips) {
      const heat = ['fraco', 'médio', 'forte'];
      for (let i = 0; i < fxA.names.length; i++) {
        const s = await sprite(fxA.names[i]);
        const sw = opaque.length ? 1280 : W - 2 * M - 170;
        const sh = Math.round((s.img.height * sw) / s.img.width);
        ctx.drawImage(s.img, M + 170, y, sw, sh);
        text(ctx, heat[i] ?? fxA.names[i], M, y + sh / 2 + 12, 34, P.sand, DISPLAY);
        y += sh + 24;
      }
      text(ctx, `#${imgNo(fxA)} ${fxA.label ?? 'brasas'}`, M + 170, y + 20, 26, P.ok, UIB);
      y += 50;
      bottom = y;
    }
    // next to the strips: packed from the right edge; alone: left to right in batch order
    const bgW = (a) => Math.round((manifest.sprites[a.name].w * 820) / manifest.sprites[a.name].h);
    let bx = strips.length ? W - M - opaque.reduce((t, a) => t + bgW(a) + 30, -30) : M;
    for (const bgA of opaque) {
      const s = await sprite(bgA.name);
      const bh = 820, bw = bgW(bgA);
      ctx.drawImage(s.img, bx, top, bw, bh);
      ctx.strokeStyle = P.line; ctx.lineWidth = 3; ctx.strokeRect(bx, top, bw, bh);
      text(ctx, `#${imgNo(bgA)} ${bgA.label ?? bgA.name}`, bx, top + bh + 36, 26, P.ok, UIB);
      bx += bw + 30;
      bottom = Math.max(bottom, top + bh + 60);
    }
    y = bottom + 20;
  }

  // customers (components)
  for (const custA of batch.assets.filter((a) => a.mode === 'components')) {
    section(custA.label ?? 'Clientes', 'recorte + avatar circular como aparece no cartão de pedido');
    const n = custA.names.length, cw = (W - 2 * M - (n - 1) * 12) / n;
    for (let i = 0; i < n; i++) {
      const { name, label, flag } = custA.names[i];
      const s = await sprite(name);
      const x = M + i * (cw + 12);
      checker(ctx, x, y, cw, 260);
      fit(ctx, s.img, x, y, cw, 260, 8);
      const side = Math.min(s.img.width, s.img.height) * 0.86;
      const r = 50, cx = x + cw / 2, cy = y + 330;
      ctx.save();
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.closePath();
      ctx.fillStyle = '#f6dfbd'; ctx.fill(); ctx.clip();
      ctx.drawImage(s.img, (s.img.width - side) / 2, 0, side, side, cx - r, cy - r, r * 2, r * 2);
      ctx.restore();
      ctx.strokeStyle = '#7a4a2a'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
      const key = name.replace('spr_char_customer_', '');
      wrap(ctx, label ?? CUSTOMER_LABEL[key] ?? key, x + 4, y + 418, cw - 8, 23, 26, flag ? P.warn : P.sand, UIB);
    }
    y += 492; // below two-line labels
    text(ctx, `#${imgNo(custA)}`, M, y, 32, P.gold, DISPLAY);
    let ty = custA.review?.verdict ? verdictChip(ctx, custA.review, M + 70, y - 2) : y + 32;
    if (custA.review?.note) ty = wrap(ctx, custA.review.note, M, ty + 2, W - 2 * M, 24, 30, P.sand, UIB);
    y = ty + 20;
  }

  const out = join(ROOT, 'art', 'review', `${batch.batch}.jpg`);
  await mkdir(join(ROOT, 'art', 'review'), { recursive: true });
  const trimmed = createCanvas(W, Math.min(H, y + 20));
  trimmed.getContext('2d').drawImage(c, 0, 0);
  const small = createCanvas(1600, Math.round((trimmed.height * 1600) / W));
  const sctx = small.getContext('2d');
  sctx.imageSmoothingQuality = 'high';
  sctx.drawImage(trimmed, 0, 0, small.width, small.height);
  await writeFile(out, small.toBuffer('image/jpeg', 86));
  console.log(`[review] ${out.replace(ROOT + '/', '')} ${small.width}×${small.height}${y > H ? ' (content cut — raise H)' : ''} · status: ${status}`);
}

// ── in-context montage (game layout 420×780 logical, drawn at 2×) ────────────
async function montage(pv) {
  const S = 2, LW = 420, LH = 780;
  const c = createCanvas(LW * S, LH * S);
  const ctx = c.getContext('2d');
  ctx.scale(S, S);
  ctx.imageSmoothingQuality = 'high';

  const bg = await sprite(pv.background);
  const bs = Math.max(LW / bg.img.width, LH / bg.img.height);
  ctx.drawImage(bg.img, (LW - bg.img.width * bs) / 2, (LH - bg.img.height * bs) / 2, bg.img.width * bs, bg.img.height * bs);

  // grill: as wide as the screen, opening around the middle of the play area
  const grill = await sprite(pv.grill);
  const gs = 408 / grill.img.width;
  const gx = (LW - grill.img.width * gs) / 2, gy = pv.grillY ?? 250;
  const Q = grill.hole.quad.map(([x, y]) => [gx + x * gs, gy + y * gs]);
  const at = (u, v) => {
    const tx = Q[0][0] + (Q[1][0] - Q[0][0]) * u, ty = Q[0][1] + (Q[1][1] - Q[0][1]) * u;
    const bx = Q[3][0] + (Q[2][0] - Q[3][0]) * u, by = Q[3][1] + (Q[2][1] - Q[3][1]) * u;
    return [tx + (bx - tx) * v, ty + (by - ty) * v];
  };
  const quadPath = () => { ctx.beginPath(); Q.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); };
  const [bx0, by0, bw0, bh0] = grill.hole.bbox;
  const hx = gx + bx0 * gs, hy = gy + by0 * gs, hw = bw0 * gs, hh = bh0 * gs;

  // ember bed under the grate: one strip, or one band per heat zone (top = low → bottom = high,
  // like grill.json)
  ctx.save();
  quadPath(); ctx.clip();
  ctx.fillStyle = '#1a0c06'; ctx.fillRect(hx, hy, hw, hh);
  if (pv.zones) {
    for (let z = 0; z < pv.zones.length; z++) {
      const v0 = z / pv.zones.length, v1 = (z + 1) / pv.zones.length;
      const band = [at(-0.05, v0), at(1.05, v0), at(1.05, v1), at(-0.05, v1)];
      const ys = band.map((p) => p[1]);
      const e = await sprite(pv.zones[z]);
      ctx.save();
      ctx.beginPath(); band.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.clip();
      ctx.drawImage(e.img, hx - 6, Math.min(...ys), hw + 12, Math.max(8, Math.max(...ys) - Math.min(...ys)));
      ctx.restore();
    }
  } else {
    const embers = await sprite(pv.embers ?? 't_fx_embers_medium');
    ctx.drawImage(embers.img, hx - 6, hy + hh * 0.18, hw + 12, hh * 0.9);
  }
  const glow = ctx.createLinearGradient(0, hy, 0, hy + hh);
  glow.addColorStop(0, 'rgba(20,8,4,0.55)'); glow.addColorStop(0.5, 'rgba(255,120,40,0.10)'); glow.addColorStop(1, 'rgba(255,150,60,0.22)');
  ctx.fillStyle = glow; ctx.fillRect(hx, hy, hw, hh);
  for (let k = 1; k < 9; k++) { // grate bars follow the opening's quad
    const v = k / 9;
    const [x0, y0] = at(-0.02, v), [x1, y1] = at(1.02, v);
    ctx.strokeStyle = 'rgba(25,18,15,0.95)'; ctx.lineWidth = 2.6;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.strokeStyle = 'rgba(210,190,170,0.55)'; ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.moveTo(x0, y0 - 0.9); ctx.lineTo(x1, y1 - 0.9); ctx.stroke();
  }
  ctx.restore();
  ctx.drawImage(grill.img, gx, gy, grill.img.width * gs, grill.img.height * gs);

  for (const [name, u, v, w] of pv.onGrill) { // [sprite, u, v, width] — u/v across the opening
    const s = await sprite(name);
    const [x, y] = at(u, v);
    const h = (s.img.height * w) / s.img.width;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(x, y + h * 0.22, w * 0.42, h * 0.2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.drawImage(s.img, x - w / 2, y - h / 2, w, h);
  }

  // counter in front: back edge spans the screen, sides cropped
  const bench = await sprite(pv.bench ?? 'spr_prop_bancada');
  const bw = 600, bh = (bench.img.height * bw) / bench.img.width;
  const by = 534;
  ctx.drawImage(bench.img, (LW - bw) / 2, by, bw, bh);
  ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(0, by + bh - 4, LW, LH);

  for (let i = 0; i < pv.benchItems.length; i++) { // raw items in the 5 bench slots
    const [name, w] = pv.benchItems[i];
    const s = await sprite(name);
    const h = (s.img.height * w) / s.img.width;
    const x = 14 + i * 82 + 37, y = 600;
    ctx.fillStyle = 'rgba(40,20,10,0.28)';
    ctx.beginPath(); ctx.ellipse(x, y + h * 0.26, w * 0.4, h * 0.16, 0, 0, Math.PI * 2); ctx.fill();
    ctx.drawImage(s.img, x - w / 2, y - h / 2, w, h);
  }

  for (let i = 0; i < pv.orders.length; i++) { // cream card, circular customer, the order
    const [cust, items, patience] = pv.orders[i];
    const x = 14 + i * 202, y = 84, w = 190, h = 96;
    ctx.save();
    ctx.shadowColor = 'rgba(40,18,6,0.35)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 3;
    ctx.fillStyle = '#fff4e2'; roundRect(ctx, x, y, w, h, 16); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = '#c98e57'; ctx.lineWidth = 2; roundRect(ctx, x, y, w, h, 16); ctx.stroke();
    const s = await sprite(cust);
    const r = 27, cx = x + 34, cy = y + 42;
    const side = Math.min(s.img.width, s.img.height) * 0.86;
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fillStyle = '#f3d6ae'; ctx.fill(); ctx.clip();
    ctx.drawImage(s.img, (s.img.width - side) / 2, 0, side, side, cx - r, cy - r, r * 2, r * 2);
    ctx.restore();
    ctx.strokeStyle = '#8a5530'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
    for (let k = 0; k < items.length; k++) fit(ctx, (await sprite(items[k])).img, x + 68 + k * 60, y + 10, 60, 64, 1, 1);
    ctx.fillStyle = '#ecd9bf'; roundRect(ctx, x + 12, y + h - 16, w - 24, 7, 3.5); ctx.fill();
    ctx.fillStyle = patience > 0.5 ? '#6cc04a' : '#f0a030'; roundRect(ctx, x + 12, y + h - 16, (w - 24) * patience, 7, 3.5); ctx.fill();
  }

  // honest label: this is a montage for art review, not the game
  ctx.fillStyle = 'rgba(27,18,13,0.78)'; roundRect(ctx, 10, 12, LW - 20, 58, 14); ctx.fill();
  text(ctx, `PRÉVIA · montagem com os sprites do ${batchLabel.toLowerCase()}`, LW / 2, 36, 17, P.cream, DISPLAY, 'center');
  text(ctx, 'não é captura do jogo — só para aprovar o visual', LW / 2, 58, 12.5, P.sand, UIB, 'center');

  const out = join(ROOT, 'art', 'review', `${batch.batch}-preview.jpg`);
  await writeFile(out, c.toBuffer('image/jpeg', 88));
  console.log(`[review] ${out.replace(ROOT + '/', '')} ${c.width}×${c.height}`);
}

await contactSheet();
if (batch.preview) await montage(batch.preview);
console.log(`[review] fonts: ${fontFiles.display ? 'Baloo 2 + Nunito' : 'system fallback (set ART_FONTS_DIR for the game fonts)'}`);
