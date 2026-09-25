#!/usr/bin/env node
/**
 * review-sheet — the approval deliverable of an art batch (docs/22-ARTE_2D_PLANO.md §5).
 *
 *   node tools/art/review-sheet.mjs art/lote-01.json
 *
 * Reads the processed sprites through Assets/Art/sprites.manifest.json and writes:
 *   art/review/<lote>.jpg          contact sheet: every sprite of the batch, labelled, on a
 *                                   checkerboard so the transparency is visible
 *   art/review/<lote>-preview.jpg   montage in the game's 420×780 layout (2×) that puts the
 *                                   pieces together. It is labelled as a montage: it is NOT a
 *                                   capture of the running game and must never be used as a
 *                                   store screenshot (docs/15-ASO.md §5).
 * Fonts: Baloo 2 / Nunito TTFs are used when found in $ART_FONTS_DIR (default /tmp/fonts,
 * e.g. from `npm pack @expo-google-fonts/baloo-2 @expo-google-fonts/nunito`); otherwise the
 * system sans is used — the art is what is being reviewed, not the type.
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
const font = (size, fam = UI, weight = '') => `${weight ? weight + ' ' : ''}${size}px "${fam}"`;

// ── palette (shared with prototype/src/theme.ts, docs/04 §3) ─────────────────
const P = {
  night: '#1b120d', panel: '#2a1c14', panel2: '#35241a', line: '#4a3223',
  cream: '#fff1dc', sand: '#e9cfa6', muted: '#bfa283', ember: '#ff8a3d', gold: '#ffc94a',
  ok: '#8fd46a', warn: '#ffb347', bad: '#ff6b5a', cyan: '#5fe3ff',
};

const cache = new Map();
async function sprite(name) {
  if (cache.has(name)) return cache.get(name);
  const entry = manifest.sprites[name];
  if (!entry) throw new Error(`sprite ${name} is not in the manifest — run process-sprites first`);
  const img = await loadImage(await readFile(join(ROOT, entry.file)));
  const v = { img, ...entry };
  cache.set(name, v);
  return v;
}

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
  ctx.font = font(size, fam);
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(str, x, y);
}

function wrap(ctx, str, x, y, maxW, size, lh, color = P.sand, fam = UIB) {
  ctx.font = font(size, fam);
  const words = str.split(' ');
  let line = '', yy = y;
  for (const w of words) {
    const t = line ? `${line} ${w}` : w;
    if (ctx.measureText(t).width > maxW && line) { text(ctx, line, x, yy, size, color, fam); line = w; yy += lh; }
    else line = t;
  }
  if (line) text(ctx, line, x, yy, size, color, fam);
  return yy + lh;
}

const STATE_LABEL = { raw: 'cru', rare: 'selado', medium: 'ao ponto', well: 'bem passado', burned: 'queimado', served: 'servido' };
const FOOD_LABEL = { picanha: 'Picanha', linguica_toscana: 'Linguiça toscana', pao_de_alho: 'Pão de alho', queijo_coalho: 'Queijo coalho', espetinho_misto: 'Espetinho misto' };
const CUSTOMER_LABEL = {
  comum: 'comum', apressado_a: 'apressado (a)', apressado_b: 'apressado (b)', familia: 'família',
  tio_do_churrasco: 'tio do churrasco', influencer: 'influencer', turista: 'turista',
};

// ── contact sheet ────────────────────────────────────────────────────────────
async function contactSheet() {
  const W = 2000, M = 28;
  const foods = batch.assets.filter((a) => a.mode === 'grid');
  const imgNo = (a) => batch.assets.indexOf(a) + 1;
  const H = 4800; // generous; trimmed to the content below
  const c = createCanvas(W, H);
  const ctx = c.getContext('2d');
  ctx.fillStyle = P.night; ctx.fillRect(0, 0, W, H);

  // header
  const g = ctx.createLinearGradient(0, 0, W, 0);
  g.addColorStop(0, '#3a2014'); g.addColorStop(1, '#23150e');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, 170);
  text(ctx, `${batch.batch.replace('lote-', 'Lote ')} · arte 2D gerada por IA`, M, 78, 60, P.cream, DISPLAY);
  text(ctx, `${batch.assets.length} imagens viraram ${Object.values(manifest.sprites).filter((s) => s.batch === batch.batch).length} sprites recortados · ${batch.date} · status: aguardando aprovação`, M, 130, 30, P.gold, UI);
  text(ctx, 'fundo xadrez = área transparente', W - M, 130, 24, P.muted, UIB, 'right');

  let y = 210;
  const section = (title, sub) => {
    text(ctx, title, M, y + 34, 38, P.ember, DISPLAY);
    if (sub) text(ctx, sub, M, y + 70, 24, P.muted, UIB);
    y += sub ? 92 : 58;
  };

  // foods
  section('Comidas — 5 estados de cozimento + servido', 'mesma peça, mesmo contorno e mesmo pivô em todos os estados: no jogo os estados vizinhos são misturados (crossfade) pelo ponto contínuo');
  const labelW = 250, cellW = 272, cellH = 196, gap = 10;
  for (const a of foods) {
    ctx.fillStyle = P.panel; roundRect(ctx, M - 8, y - 8, W - 2 * M + 16, cellH + 60, 18); ctx.fill();
    text(ctx, `#${imgNo(a)}`, M + 8, y + 50, 44, P.gold, DISPLAY);
    wrap(ctx, FOOD_LABEL[a.subject] ?? a.subject, M + 8, y + 96, labelW - 30, 30, 34, P.cream, DISPLAY);
    for (let i = 0; i < a.cells.length; i++) {
      const x = M + labelW + i * (cellW + gap);
      checker(ctx, x, y, cellW, cellH);
      const s = await sprite(`spr_food_${a.subject}_${a.cells[i]}`);
      fit(ctx, s.img, x, y, cellW, cellH, 6);
      text(ctx, STATE_LABEL[a.cells[i]] ?? a.cells[i], x + cellW / 2, y + cellH + 34, 26, a.cells[i] === 'served' ? P.gold : P.sand, UIB, 'center');
    }
    y += cellH + 76;
  }

  // grill + bancada
  const grillA = batch.assets.find((a) => a.category === 'grill');
  const benchA = batch.assets.find((a) => a.category === 'prop');
  section('Churrasqueira e bancada', 'a boca magenta da churrasqueira vira um furo transparente (contorno ciano = quadrilátero detectado); brasas e grelha são desenhadas por baixo');
  const rowH = 560;
  if (grillA) {
    const s = await sprite(grillA.name);
    const bw = 700;
    checker(ctx, M, y, bw, rowH);
    const p = fit(ctx, s.img, M, y, bw, rowH - 50, 14);
    if (s.hole) {
      ctx.save();
      ctx.strokeStyle = P.cyan; ctx.lineWidth = 4; ctx.setLineDash([14, 10]);
      ctx.beginPath();
      s.hole.quad.forEach(([qx, qy], i) => { const px = p.dx + qx * p.s, py = p.dy + qy * p.s; if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); });
      ctx.closePath(); ctx.stroke(); ctx.restore();
    }
    text(ctx, `#${imgNo(grillA)} lata valente (evo 1) — REFAZER: vista oblíqua`, M + 14, y + rowH - 16, 26, P.warn, UIB);
  }
  if (benchA) {
    const s = await sprite(benchA.name);
    const bx = M + 720, bw = W - M - bx;
    checker(ctx, bx, y, bw, rowH);
    fit(ctx, s.img, bx, y, bw, rowH - 50, 14);
    text(ctx, `#${imgNo(benchA)} bancada — usável cortando as laterais; ideal refazer reta`, bx + 14, y + rowH - 16, 26, P.warn, UIB);
  }
  y += rowH + 40;

  // embers + backdrop
  const fxA = batch.assets.find((a) => a.mode === 'strips');
  const bgA = batch.assets.find((a) => a.mode === 'opaque');
  section('Brasas por calor e fundo do restaurante', 'faixas opacas que ficam sob a grelha: fraco / médio / forte — mesmo desenho, só muda a intensidade (as zonas do jogo são faixas horizontais)');
  const top = y;
  if (fxA) {
    const heat = ['fraco', 'médio', 'forte'];
    for (let i = 0; i < fxA.names.length; i++) {
      const s = await sprite(fxA.names[i]);
      const sw = 1280, sh = Math.round((s.img.height * sw) / s.img.width);
      ctx.drawImage(s.img, M + 170, y, sw, sh);
      text(ctx, heat[i], M, y + sh / 2 + 12, 34, P.sand, DISPLAY);
      y += sh + 24;
    }
    text(ctx, `#${imgNo(fxA)} brasas (3 faixas de uma imagem)`, M + 170, y + 20, 26, P.ok, UIB);
  }
  if (bgA) {
    const s = await sprite(bgA.name);
    const bh = 820, bw = Math.round((s.img.width * bh) / s.img.height);
    const bx = W - M - bw;
    ctx.drawImage(s.img, bx, top, bw, bh);
    ctx.strokeStyle = P.line; ctx.lineWidth = 3; ctx.strokeRect(bx, top, bw, bh);
    text(ctx, `#${imgNo(bgA)} fundo: quintal (9:16)`, bx, top + bh + 36, 26, P.ok, UIB);
    y = Math.max(y + 40, top + bh + 60);
  }

  // customers
  const custA = batch.assets.find((a) => a.mode === 'components');
  if (custA) {
    section('Clientes (lote A)', 'recorte + avatar circular como aparece no cartão de pedido');
    const n = custA.names.length, cw = (W - 2 * M - (n - 1) * 12) / n;
    for (let i = 0; i < n; i++) {
      const name = custA.names[i].name;
      const s = await sprite(name);
      const x = M + i * (cw + 12);
      checker(ctx, x, y, cw, 260);
      fit(ctx, s.img, x, y, cw, 260, 8);
      // circular avatar: square crop from the top of the bust
      const side = Math.min(s.img.width, s.img.height) * 0.86;
      const sx = (s.img.width - side) / 2, sy = 0;
      const r = 50, cx = x + cw / 2, cy = y + 330;
      ctx.save();
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.closePath();
      ctx.fillStyle = '#f6dfbd'; ctx.fill(); ctx.clip();
      ctx.drawImage(s.img, sx, sy, side, side, cx - r, cy - r, r * 2, r * 2);
      ctx.restore();
      ctx.strokeStyle = '#7a4a2a'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
      const key = name.replace('spr_char_customer_', '');
      text(ctx, CUSTOMER_LABEL[key] ?? key, cx, y + 418, 25, key === 'turista' ? P.warn : P.sand, UIB, 'center');
    }
    text(ctx, `#${imgNo(custA)} — o modelo fez 7 retratos em vez de 6; turista sem camisa: sinalizado para revisão`, M, y + 462, 26, P.warn, UIB);
    y += 500;
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
  console.log(`[review] ${out.replace(ROOT + '/', '')} ${small.width}×${small.height}${y > H ? ' (content cut — raise H)' : ''}`);
}

// ── in-context montage (game layout 420×780 logical, drawn at 2×) ────────────
async function montage() {
  const S = 2, LW = 420, LH = 780;
  const c = createCanvas(LW * S, LH * S);
  const ctx = c.getContext('2d');
  ctx.scale(S, S);
  ctx.imageSmoothingQuality = 'high';

  const bg = await sprite('bg_restaurant_quintal');
  const bs = Math.max(LW / bg.img.width, LH / bg.img.height);
  ctx.drawImage(bg.img, (LW - bg.img.width * bs) / 2, (LH - bg.img.height * bs) / 2, bg.img.width * bs, bg.img.height * bs);

  // grill: as wide as the screen, opening around the middle of the play area
  const grill = await sprite('spr_grill_lata_valente_evo1');
  const gs = 408 / grill.img.width;
  const gx = (LW - grill.img.width * gs) / 2, gy = 250;
  const Q = grill.hole.quad.map(([x, y]) => [gx + x * gs, gy + y * gs]);
  const at = (u, v) => {
    const tx = Q[0][0] + (Q[1][0] - Q[0][0]) * u, ty = Q[0][1] + (Q[1][1] - Q[0][1]) * u;
    const bx = Q[3][0] + (Q[2][0] - Q[3][0]) * u, by = Q[3][1] + (Q[2][1] - Q[3][1]) * u;
    return [tx + (bx - tx) * v, ty + (by - ty) * v];
  };
  const quadPath = () => { ctx.beginPath(); Q.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); };
  const [bx0, by0, bw0, bh0] = grill.hole.bbox;
  const hx = gx + bx0 * gs, hy = gy + by0 * gs, hw = bw0 * gs, hh = bh0 * gs;

  // ember bed under the grate (medium heat)
  const embers = await sprite('t_fx_embers_medium');
  ctx.save();
  quadPath(); ctx.clip();
  ctx.fillStyle = '#1a0c06'; ctx.fillRect(hx, hy, hw, hh);
  ctx.drawImage(embers.img, hx - 6, hy + hh * 0.18, hw + 12, hh * 0.9);
  const glow = ctx.createLinearGradient(0, hy, 0, hy + hh);
  glow.addColorStop(0, 'rgba(20,8,4,0.55)'); glow.addColorStop(0.5, 'rgba(255,120,40,0.10)'); glow.addColorStop(1, 'rgba(255,150,60,0.22)');
  ctx.fillStyle = glow; ctx.fillRect(hx, hy, hw, hh);
  // grate: bars follow the opening's parallelogram
  for (let k = 1; k < 9; k++) {
    const v = k / 9;
    const [x0, y0] = at(-0.02, v), [x1, y1] = at(1.02, v);
    ctx.strokeStyle = 'rgba(25,18,15,0.95)'; ctx.lineWidth = 2.6;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.strokeStyle = 'rgba(210,190,170,0.55)'; ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.moveTo(x0, y0 - 0.9); ctx.lineTo(x1, y1 - 0.9); ctx.stroke();
  }
  ctx.restore();

  ctx.drawImage(grill.img, gx, gy, grill.img.width * gs, grill.img.height * gs);

  // food on the grate — soft contact shadow + a warm rim from the embers below
  const onGrill = [ // [sprite, u, v, width] — u/v across the opening, 0..1
    ['spr_food_picanha_medium', 0.2, 0.52, 70],
    ['spr_food_queijo_coalho_rare', 0.44, 0.3, 58],
    ['spr_food_linguica_toscana_well', 0.52, 0.72, 66],
    ['spr_food_espetinho_misto_medium', 0.79, 0.46, 86],
  ];
  for (const [name, u, v, w] of onGrill) {
    const s = await sprite(name);
    const [x, y] = at(u, v);
    const h = (s.img.height * w) / s.img.width;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(x, y + h * 0.22, w * 0.42, h * 0.2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.drawImage(s.img, x - w / 2, y - h / 2, w, h);
  }

  // counter in front: back edge spans the screen, sides cropped
  const bench = await sprite('spr_prop_bancada');
  const bw = 600, bh = (bench.img.height * bw) / bench.img.width;
  const bx = (LW - bw) / 2, by = 534;
  ctx.drawImage(bench.img, bx, by, bw, bh);
  ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(0, by + bh - 4, LW, LH);

  // raw items waiting on the counter (5 slots, like the bench row of the game)
  const raw = ['picanha', 'linguica_toscana', 'pao_de_alho', 'queijo_coalho', 'espetinho_misto'];
  for (let i = 0; i < raw.length; i++) {
    const s = await sprite(`spr_food_${raw[i]}_raw`);
    const w = raw[i] === 'espetinho_misto' ? 76 : 64;
    const h = (s.img.height * w) / s.img.width;
    const x = 14 + i * 82 + 37, y = 600;
    ctx.fillStyle = 'rgba(40,20,10,0.28)';
    ctx.beginPath(); ctx.ellipse(x, y + h * 0.26, w * 0.4, h * 0.16, 0, 0, Math.PI * 2); ctx.fill();
    ctx.drawImage(s.img, x - w / 2, y - h / 2, w, h);
  }

  // order cards: cream card, circular customer, what they ordered
  const orders = [
    ['spr_char_customer_tio_do_churrasco', ['spr_food_picanha_served', 'spr_food_pao_de_alho_served'], 0.72],
    ['spr_char_customer_influencer', ['spr_food_queijo_coalho_served', 'spr_food_linguica_toscana_served'], 0.4],
  ];
  for (let i = 0; i < orders.length; i++) {
    const [cust, items, patience] = orders[i];
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
    for (let k = 0; k < items.length; k++) {
      const it = await sprite(items[k]);
      fit(ctx, it.img, x + 68 + k * 60, y + 10, 60, 64, 1, 1);
    }
    ctx.fillStyle = '#ecd9bf'; roundRect(ctx, x + 12, y + h - 16, w - 24, 7, 3.5); ctx.fill();
    ctx.fillStyle = patience > 0.5 ? '#6cc04a' : '#f0a030'; roundRect(ctx, x + 12, y + h - 16, (w - 24) * patience, 7, 3.5); ctx.fill();
  }

  // honest label: this is a montage for art review, not the game
  ctx.fillStyle = 'rgba(27,18,13,0.78)'; roundRect(ctx, 10, 12, LW - 20, 58, 14); ctx.fill();
  text(ctx, 'PRÉVIA · montagem com os sprites do lote 01', LW / 2, 36, 17, P.cream, DISPLAY, 'center');
  text(ctx, 'não é captura do jogo — só para aprovar o visual', LW / 2, 58, 12.5, P.sand, UIB, 'center');

  const out = join(ROOT, 'art', 'review', `${batch.batch}-preview.jpg`);
  await writeFile(out, c.toBuffer('image/jpeg', 88));
  console.log(`[review] ${out.replace(ROOT + '/', '')} ${c.width}×${c.height}`);
}

await contactSheet();
await montage();
console.log(`[review] fonts: ${fontFiles.display ? 'Baloo 2 + Nunito' : 'system fallback (set ART_FONTS_DIR for the game fonts)'}`);
