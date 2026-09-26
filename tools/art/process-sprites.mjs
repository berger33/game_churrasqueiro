#!/usr/bin/env node
/**
 * process-sprites — turns AI-generated sheets painted on a flat magenta background
 * into transparent, trimmed, named sprites (docs/22-ARTE_2D_PLANO.md §4).
 *
 *   node tools/art/process-sprites.mjs art/lote-01.json
 *
 * Per source image:
 *   1. key colour = median of the magenta-looking border pixels (the model never
 *      paints an exact #FF00FF, and it drifts per image)
 *   2. alpha from the "magenta excess" m = min(R,B) − G, soft between two thresholds
 *   3. un-mix the key out of every soft pixel, F = (P − (1−a)·K) / a, then despill
 *   4. erase the thin straight grid lines the model draws despite the prompt
 *   5. 8-connected components → keep what belongs to each cell/object; labels the
 *      model wrote and stray specks are separate components and are dropped
 *   6. modes: grid (sprite sheet), components (anchored by position), strips
 *      (stacked textures), single (one prop, optional enclosed hole), opaque (backdrop)
 *   7. food states are rotated together (maxTiltDeg), equalised by mask area and put on
 *      one shared canvas with one pivot, so a crossfade between neighbouring states
 *      never moves the outline
 *
 * Writes PNG masters (Unity-ready), Assets/Art/sprites.manifest.json and the rows of
 * Assets/Art/ASSET_REGISTRY.csv (docs/04-ART_STYLE.md §11). A row enters as
 * source=ai-assisted, status=pending; approval flips it to ai-assisted-reviewed/approved.
 */
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';

const ROOT = join(import.meta.dirname, '..', '..');
const MANIFEST = join(ROOT, 'Assets', 'Art', 'sprites.manifest.json');
const REGISTRY = join(ROOT, 'Assets', 'Art', 'ASSET_REGISTRY.csv');
const REGISTRY_COLUMNS = ['name', 'category', 'source', 'license', 'version', 'author', 'date', 'status', 'batch', 'file', 'notes'];
// --dry-run measures a batch without writing anything: no masters, no manifest rows, no
// registry rows. It exists to check a layout guide before a model paints into it
// (docs/22-ARTE_2D_PLANO.md §6.4) — the same hole detector that failed lote 03's grills.
const DRY_RUN = process.argv.includes('--dry-run');
const ALLOW_REPAINT = process.argv.includes('--allow-repaint');

// ── image helpers ────────────────────────────────────────────────────────────

async function loadRgba(path) {
  const img = await loadImage(await readFile(path));
  const c = createCanvas(img.width, img.height);
  const x = c.getContext('2d');
  x.drawImage(img, 0, 0);
  return { w: img.width, h: img.height, data: x.getImageData(0, 0, img.width, img.height).data };
}

function toCanvas(w, h, data) {
  const c = createCanvas(w, h);
  const x = c.getContext('2d');
  const id = x.createImageData(w, h);
  id.data.set(data);
  x.putImageData(id, 0, 0);
  return c;
}

function canvasRgba(c) {
  return c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
}

// ── 1–3: key colour, alpha, un-mix ──────────────────────────────────────────

function keyColour({ w, h, data }) {
  const rs = [], gs = [], bs = [];
  const take = (x, y) => {
    const i = (y * w + x) * 4;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    if (Math.min(r, b) - g > 120) { rs.push(r); gs.push(g); bs.push(b); }
  };
  for (let x = 0; x < w; x += 2) { take(x, 0); take(x, 1); take(x, h - 1); take(x, h - 2); }
  for (let y = 0; y < h; y += 2) { take(0, y); take(1, y); take(w - 1, y); take(w - 2, y); }
  if (rs.length < 40) throw new Error('no magenta border — is this a keyed sheet?');
  const med = (a) => a.sort((p, q) => p - q)[a.length >> 1];
  return [med(rs), med(gs), med(bs)];
}

function keyOut(src, K) {
  const { w, h, data } = src;
  const mK = Math.min(K[0], K[2]) - K[1];
  const hi = mK * 0.78; // at or above → background
  const lo = mK * 0.16; // at or below → fully opaque
  const rgba = new Uint8ClampedArray(w * h * 4);
  const alpha = new Float32Array(w * h);
  for (let p = 0, i = 0; p < w * h; p++, i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const m = Math.min(r, b) - g;
    const a = m >= hi ? 0 : m <= lo ? 1 : (hi - m) / (hi - lo);
    alpha[p] = a;
    if (a <= 0.004) continue;
    let fr = r, fg = g, fb = b;
    if (a < 1) {
      fr = (r - (1 - a) * K[0]) / a;
      fg = (g - (1 - a) * K[1]) / a;
      fb = (b - (1 - a) * K[2]) / a;
      const spill = Math.min(fr, fb) - fg; // whatever magenta survived the un-mix
      if (spill > 0) { fr -= spill; fb -= spill; }
    }
    rgba[i] = fr; rgba[i + 1] = fg; rgba[i + 2] = fb;
  }
  // Interior pixels are opaque: a pinkish highlight inside the food is paint, not background.
  const solid = new Float32Array(alpha);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const p = y * w + x;
      if (alpha[p] >= 1 || alpha[p] < 0.6) continue;
      let inner = true;
      for (let dy = -1; dy <= 1 && inner; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (alpha[p + dy * w + dx] < 0.6) { inner = false; break; }
      }
      if (inner) solid[p] = 1;
    }
  }
  return { w, h, rgba, alpha: solid };
}

// ── 4: grid lines ────────────────────────────────────────────────────────────

/** Thin, straight, magenta-hued lines with background on both sides are artefacts. */
function eraseGridLines(src, img) {
  const { w, h, data } = src;
  const { alpha } = img;
  const hued = (p) => {
    const i = p * 4, r = data[i], g = data[i + 1], b = data[i + 2];
    return Math.min(r, b) - g > 40 && Math.abs(r - b) < 70;
  };
  const clear = (p) => p >= 0 && p < w * h && alpha[p] < 0.05;
  const lineH = (p) => alpha[p] > 0 && hued(p) && clear(p - 4 * w) && clear(p + 4 * w);
  const lineV = (p) => alpha[p] > 0 && hued(p) && clear(p - 4) && clear(p + 4);
  let erased = 0;
  for (let y = 4; y < h - 4; y++) {
    let run = 0, best = 0;
    for (let x = 0; x < w; x++) { if (lineH(y * w + x)) { if (++run > best) best = run; } else run = 0; }
    if (best < w * 0.2) continue;
    for (let x = 0; x < w; x++) { const p = y * w + x; if (lineH(p)) { alpha[p] = 0; erased++; } }
  }
  for (let x = 4; x < w - 4; x++) {
    let run = 0, best = 0;
    for (let y = 0; y < h; y++) { if (lineV(y * w + x)) { if (++run > best) best = run; } else run = 0; }
    if (best < h * 0.2) continue;
    for (let y = 0; y < h; y++) { const p = y * w + x; if (lineV(p)) { alpha[p] = 0; erased++; } }
  }
  return erased;
}

// ── 5: components ────────────────────────────────────────────────────────────

function components(alpha, w, h, thr = 0.5) {
  const lab = new Int32Array(w * h).fill(-1);
  const stack = new Int32Array(w * h);
  const comps = [];
  for (let p0 = 0; p0 < w * h; p0++) {
    if (alpha[p0] <= thr || lab[p0] !== -1) continue;
    const id = comps.length;
    let sp = 0, area = 0, sx = 0, sy = 0, minx = w, miny = h, maxx = 0, maxy = 0;
    stack[sp++] = p0; lab[p0] = id;
    while (sp) {
      const q = stack[--sp];
      const x = q % w, y = (q / w) | 0;
      area++; sx += x; sy += y;
      if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy; if (yy < 0 || yy >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx; if (xx < 0 || xx >= w) continue;
          const r = yy * w + xx;
          if (lab[r] === -1 && alpha[r] > thr) { lab[r] = id; stack[sp++] = r; }
        }
      }
    }
    comps.push({ id, area, cx: sx / area, cy: sy / area, minx, miny, maxx, maxy });
  }
  return { lab, comps };
}

const grow = (c, f) => {
  const mx = (c.maxx - c.minx) * f, my = (c.maxy - c.miny) * f;
  return { minx: c.minx - mx, miny: c.miny - my, maxx: c.maxx + mx, maxy: c.maxy + my };
};
const overlaps = (a, b) => a.minx <= b.maxx && a.maxx >= b.minx && a.miny <= b.maxy && a.maxy >= b.miny;

/** Cut the kept components (plus their soft edge) out into their own RGBA buffer. */
function extract(img, lab, keepIds, pad = 8) {
  const { w, h, rgba, alpha } = img;
  const keep = new Uint8Array(w * h);
  let minx = w, miny = h, maxx = 0, maxy = 0;
  for (let p = 0; p < w * h; p++) {
    if (!keepIds.has(lab[p])) continue;
    keep[p] = 1;
    const x = p % w, y = (p / w) | 0;
    if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y;
  }
  // the soft edge (alpha ≤ 0.5) is unlabelled: grow into it for 3 px
  for (let it = 0; it < 3; it++) {
    const add = [];
    for (let y = Math.max(1, miny - 3); y <= Math.min(h - 2, maxy + 3); y++) {
      for (let x = Math.max(1, minx - 3); x <= Math.min(w - 2, maxx + 3); x++) {
        const p = y * w + x;
        if (keep[p] || alpha[p] <= 0) continue;
        if (keep[p - 1] || keep[p + 1] || keep[p - w] || keep[p + w]) add.push(p);
      }
    }
    for (const p of add) keep[p] = 1;
  }
  minx = Math.max(0, minx - 3 - pad); miny = Math.max(0, miny - 3 - pad);
  maxx = Math.min(w - 1, maxx + 3 + pad); maxy = Math.min(h - 1, maxy + 3 + pad);
  const ow = maxx - minx + 1, oh = maxy - miny + 1;
  const out = new Uint8ClampedArray(ow * oh * 4);
  for (let y = 0; y < oh; y++) {
    for (let x = 0; x < ow; x++) {
      const p = (y + miny) * w + (x + minx);
      if (!keep[p]) continue;
      const i = p * 4, o = (y * ow + x) * 4;
      out[o] = rgba[i]; out[o + 1] = rgba[i + 1]; out[o + 2] = rgba[i + 2];
      out[o + 3] = Math.round(alpha[p] * 255);
    }
  }
  return { w: ow, h: oh, data: out, origin: [minx, miny] };
}

// ── 7: food states on one canvas ─────────────────────────────────────────────

function maskStats({ w, h, data }) {
  let n = 0, sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0;
  let minx = w, miny = h, maxx = 0, maxy = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (data[(y * w + x) * 4 + 3] < 128) continue;
    n++; sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y;
    if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y;
  }
  const cx = sx / n, cy = sy / n;
  const cxx = sxx / n - cx * cx, cyy = syy / n - cy * cy, cxy = sxy / n - cx * cy;
  const angle = 0.5 * Math.atan2(2 * cxy, cxx - cyy); // principal axis, radians
  return { area: n, cx, cy, angle, minx, miny, maxx, maxy };
}

/** Rotate a sprite by `rad` about its centre, onto a canvas big enough to hold it. */
function rotated(sprite, rad) {
  if (Math.abs(rad) < 1e-4) return sprite;
  const cos = Math.abs(Math.cos(rad)), sin = Math.abs(Math.sin(rad));
  const nw = Math.ceil(sprite.w * cos + sprite.h * sin) + 4;
  const nh = Math.ceil(sprite.w * sin + sprite.h * cos) + 4;
  const c = createCanvas(nw, nh);
  const x = c.getContext('2d');
  x.imageSmoothingQuality = 'high';
  x.translate(nw / 2, nh / 2);
  x.rotate(rad);
  x.drawImage(toCanvas(sprite.w, sprite.h, sprite.data), -sprite.w / 2, -sprite.h / 2);
  return { w: nw, h: nh, data: canvasRgba(c) };
}

function alignStates(sprites, maxTiltDeg) {
  let stats = sprites.map(maskStats);
  if (maxTiltDeg !== undefined) {
    const mean = stats.reduce((s, t) => s + t.angle, 0) / stats.length;
    const limit = (maxTiltDeg * Math.PI) / 180;
    if (Math.abs(mean) > limit) {
      const turn = -(mean - Math.sign(mean) * limit);
      sprites = sprites.map((s) => rotated(s, turn));
      stats = sprites.map(maskStats);
    }
  }
  const areas = stats.map((s) => s.area).sort((a, b) => a - b);
  const target = areas[areas.length >> 1];
  const scales = stats.map((s) => Math.min(1.15, Math.max(0.87, Math.sqrt(target / s.area))));
  let L = 0, R = 0, T = 0, B = 0;
  stats.forEach((s, i) => {
    L = Math.max(L, (s.cx - s.minx) * scales[i]); R = Math.max(R, (s.maxx - s.cx) * scales[i]);
    T = Math.max(T, (s.cy - s.miny) * scales[i]); B = Math.max(B, (s.maxy - s.cy) * scales[i]);
  });
  const pad = 10;
  const half = { x: Math.ceil(Math.max(L, R)) + pad, y: Math.ceil(Math.max(T, B)) + pad };
  const W = half.x * 2, H = half.y * 2;
  return sprites.map((s, i) => {
    const c = createCanvas(W, H);
    const x = c.getContext('2d');
    x.imageSmoothingQuality = 'high';
    x.translate(half.x, half.y);
    x.scale(scales[i], scales[i]);
    x.drawImage(toCanvas(s.w, s.h, s.data), -stats[i].cx, -stats[i].cy);
    return { w: W, h: H, data: canvasRgba(c), pivot: [0.5, 0.5], scale: scales[i] };
  });
}

// ── holes (the grill's cooking opening) ──────────────────────────────────────

function enclosedHole(sprite) {
  const { w, h, data } = sprite;
  const open = (p) => data[p * 4 + 3] < 128;
  const outside = new Uint8Array(w * h);
  const stack = [];
  for (let x = 0; x < w; x++) { stack.push(x, (h - 1) * w + x); }
  for (let y = 0; y < h; y++) { stack.push(y * w, y * w + w - 1); }
  while (stack.length) {
    const p = stack.pop();
    if (outside[p] || !open(p)) continue;
    outside[p] = 1;
    const x = p % w, y = (p / w) | 0;
    if (x > 0) stack.push(p - 1); if (x < w - 1) stack.push(p + 1);
    if (y > 0) stack.push(p - w); if (y < h - 1) stack.push(p + w);
  }
  const inside = new Float32Array(w * h);
  for (let p = 0; p < w * h; p++) inside[p] = open(p) && !outside[p] ? 1 : 0;
  const { lab, comps } = components(inside, w, h, 0.5);
  if (!comps.length) return null;
  const hole = comps.reduce((a, b) => (b.area > a.area ? b : a));
  // Corner candidates: diagonal extremes suit an upright opening, axis extremes suit a
  // tilted one (whose corners are its leftmost/topmost/rightmost/lowest points). Keep the
  // set that spans more area.
  let tl = null, tr = null, br = null, bl = null, l = null, r = null, t = null, b = null;
  for (let p = 0; p < w * h; p++) {
    if (lab[p] !== hole.id) continue;
    const x = p % w, y = (p / w) | 0;
    if (!tl || x + y < tl[0] + tl[1]) tl = [x, y];
    if (!br || x + y > br[0] + br[1]) br = [x, y];
    if (!tr || x - y > tr[0] - tr[1]) tr = [x, y];
    if (!bl || x - y < bl[0] - bl[1]) bl = [x, y];
    if (!l || x < l[0]) l = [x, y];
    if (!r || x > r[0]) r = [x, y];
    if (!t || y < t[1]) t = [x, y];
    if (!b || y > b[1]) b = [x, y];
  }
  const clockwise = (q) => {
    const cx = q.reduce((s, p) => s + p[0], 0) / 4, cy = q.reduce((s, p) => s + p[1], 0) / 4;
    const o = [...q].sort((p, s) => Math.atan2(p[1] - cy, p[0] - cx) - Math.atan2(s[1] - cy, s[0] - cx));
    const start = o.reduce((best, p, i) => (p[0] + p[1] < o[best][0] + o[best][1] ? i : best), 0);
    return [...o.slice(start), ...o.slice(0, start)]; // TL (far-left corner) first, then clockwise
  };
  const area = (q) => Math.abs(q.reduce((s, p, i) => { const n = q[(i + 1) % 4]; return s + p[0] * n[1] - n[0] * p[1]; }, 0)) / 2;
  const diag = clockwise([tl, tr, br, bl]), axis = clockwise([l, t, r, b]);
  const quad = area(axis) > area(diag) ? axis : diag;
  const edge = Math.atan2(quad[1][1] - quad[0][1], quad[1][0] - quad[0][0]);
  return {
    bbox: [hole.minx, hole.miny, hole.maxx - hole.minx + 1, hole.maxy - hole.miny + 1],
    quad, // TL, TR, BR, BL — TL→TR is the far rim; the grate bars run parallel to it
    tiltDeg: +((edge * 180) / Math.PI).toFixed(1), // 0 = the game's horizontal heat bands fit as-is
    areaFrac: +(hole.area / (w * h)).toFixed(4),
  };
}

// ── modes ────────────────────────────────────────────────────────────────────

function processGrid(img, lab, comps, spec, { keepAllInCell = false, minAreaFrac = 0.0015 } = {}) {
  const cw = img.w / spec.cols, ch = img.h / spec.rows;
  const minArea = img.w * img.h * minAreaFrac;
  const out = [];
  for (let r = 0; r < spec.rows; r++) {
    for (let c = 0; c < spec.cols; c++) {
      const cell = { minx: c * cw, miny: r * ch, maxx: (c + 1) * cw, maxy: (r + 1) * ch };
      const inCell = comps.filter((k) => k.area >= minArea && k.cx >= cell.minx && k.cx < cell.maxx && k.cy >= cell.miny && k.cy < cell.maxy);
      if (!inCell.length) throw new Error(`${spec.source}: cell ${r * spec.cols + c} is empty`);
      const main = inCell.reduce((a, b) => (b.area > a.area ? b : a));
      const zone = grow(main, 0.12);
      // Food sheets drop loose parts (the model's captions); an icon keeps every part in its
      // cell (flames over a starter, a glint off a blade), minus specks.
      const keep = keepAllInCell
        ? inCell.filter((k) => k.area >= main.area * 0.015)
        : inCell.filter((k) => k === main || (k.area >= main.area * 0.06 && overlaps(k, zone)));
      const dropped = inCell.length - keep.length;
      const touches = main.minx <= cell.minx + 1 || main.maxx >= cell.maxx - 1 || main.miny <= cell.miny + 1 || main.maxy >= cell.maxy - 1;
      out.push({ sprite: extract(img, lab, new Set(keep.map((k) => k.id))), dropped, touches });
    }
  }
  return out;
}

function processComponents(img, lab, comps, spec) {
  const minArea = img.w * img.h * (spec.minAreaFrac ?? 0.01);
  const big = comps.filter((k) => k.area >= minArea);
  const taken = new Map();
  for (const k of big) {
    let best = null, bestD = Infinity;
    for (const n of spec.names) {
      const d = Math.hypot(k.cx - n.at[0], k.cy - n.at[1]);
      if (d < bestD) { bestD = d; best = n.name; }
    }
    if (taken.has(best)) throw new Error(`${spec.source}: two components claim ${best}`);
    taken.set(best, k);
  }
  const missing = spec.names.filter((n) => !taken.has(n.name)).map((n) => n.name);
  if (missing.length) throw new Error(`${spec.source}: no component for ${missing.join(', ')}`);
  const small = comps.filter((k) => k.area < minArea && k.area >= img.w * img.h * 0.0004);
  return spec.names.map(({ name }) => {
    const main = taken.get(name);
    const zone = grow(main, 0.05);
    const parts = [main, ...small.filter((k) => overlaps(k, zone))];
    return { name, sprite: extract(img, lab, new Set(parts.map((k) => k.id))) };
  });
}

function processStrips(img, spec) {
  const { w, h, alpha, rgba } = img;
  const rowFull = (y) => { let n = 0; for (let x = 0; x < w; x++) if (alpha[y * w + x] > 0.5) n++; return n / w > 0.5; };
  const bands = [];
  let start = -1;
  for (let y = 0; y <= h; y++) {
    const full = y < h && rowFull(y);
    if (full && start < 0) start = y;
    if (!full && start >= 0) { if (y - start > 20) bands.push([start, y - 1]); start = -1; }
  }
  if (bands.length !== spec.names.length) throw new Error(`${spec.source}: found ${bands.length} strips, expected ${spec.names.length}`);
  return bands.map(([y0, y1], i) => {
    const colFull = (x) => { let n = 0; for (let y = y0; y <= y1; y++) if (alpha[y * w + x] > 0.5) n++; return n / (y1 - y0 + 1) > 0.5; };
    let x0 = 0; while (x0 < w && !colFull(x0)) x0++;
    let x1 = w - 1; while (x1 > x0 && !colFull(x1)) x1--;
    const inset = 4;
    const sx = x0 + inset, sy = y0 + inset, sw = x1 - x0 + 1 - inset * 2, sh = y1 - y0 + 1 - inset * 2;
    const out = new Uint8ClampedArray(sw * sh * 4);
    for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
      const i = ((y + sy) * w + (x + sx)) * 4, o = (y * sw + x) * 4;
      out[o] = rgba[i]; out[o + 1] = rgba[i + 1]; out[o + 2] = rgba[i + 2]; out[o + 3] = 255;
    }
    return { name: spec.names[i], sprite: { w: sw, h: sh, data: out } };
  });
}

function processSingle(img, lab, comps, spec) {
  const main = comps.reduce((a, b) => (b.area > a.area ? b : a));
  const zone = grow(main, 0.08);
  const keep = comps.filter((k) => k === main || (k.area >= main.area * 0.01 && overlaps(k, zone)));
  const sprite = extract(img, lab, new Set(keep.map((k) => k.id)));
  return { sprite, hole: spec.hole ? enclosedHole(sprite) : null };
}

// ── registry / manifest ──────────────────────────────────────────────────────

function parseCsv(text) {
  const rows = [];
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    const cells = []; let cur = '', q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (q) { if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; }
      else if (ch === '"') q = true; else if (ch === ',') { cells.push(cur); cur = ''; } else cur += ch;
    }
    cells.push(cur);
    rows.push(cells);
  }
  return rows;
}
const csvCell = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));

async function updateRegistry(entries) {
  const byName = new Map();
  const order = [];
  if (existsSync(REGISTRY)) {
    const [head, ...rows] = parseCsv(await readFile(REGISTRY, 'utf8'));
    for (const r of rows) {
      const o = Object.fromEntries(head.map((k, i) => [k, r[i] ?? '']));
      byName.set(o.name, o); order.push(o.name);
    }
  }
  for (const e of entries) {
    const prev = byName.get(e.name);
    // A reviewed row is frozen: re-processing never resets a decision that still stands.
    // `rejected` is the exception — docs/04 §11 says a refused asset's redo leads the next
    // batch, and a redo that could never be approved would not be a redo. The new batch
    // re-adopts the row (new file, new batch, status pending) and says so in the notes.
    if (prev && prev.status && prev.status !== 'pending' && prev.status !== 'rejected') {
      e.status = prev.status; e.source = prev.source; e.notes = prev.notes;
    } else if (prev && prev.status === 'rejected') {
      e.notes = [prev.notes, `reprocessa a linha rejeitada de ${prev.batch}`].filter(Boolean).join(' — ');
    }
    if (!prev) order.push(e.name);
    byName.set(e.name, { ...prev, ...e });
  }
  const lines = [REGISTRY_COLUMNS.join(',')];
  for (const n of order) lines.push(REGISTRY_COLUMNS.map((k) => csvCell(byName.get(n)[k] ?? '')).join(','));
  await writeFile(REGISTRY, lines.join('\n') + '\n');
}

// ── main ─────────────────────────────────────────────────────────────────────
// ── the guard: repainting reviewed pixels needs an explicit decision ────────
// updateRegistry freezes a reviewed row's *decision*, but the master file underneath it is
// still overwritten by the processor — so a redo of one frame of a food silently shipped the
// other frames as if the owner had approved them (found while reprocessing the maminha sheet
// for lote 05: 5 `approved` rows kept their status while their pixels changed). Naming what a
// batch will write lets the tool refuse instead.

function plannedNames(spec) {
  if (spec.mode === 'grid') return spec.cells.map((c) => `${spec.prefix ?? 'spr_food_'}${spec.subject}_${c}`);
  if (spec.mode === 'icons' || spec.mode === 'strips' || spec.mode === 'components') {
    return spec.names.map((n) => (typeof n === 'string' ? n : n.name));
  }
  return [spec.name];
}

async function refuseReviewedRepaint(batch) {
  if (ALLOW_REPAINT || !existsSync(REGISTRY)) return;
  const [head, ...rows] = parseCsv(await readFile(REGISTRY, 'utf8'));
  const record = (r) => Object.fromEntries(head.map((k, i) => [k, r[i] ?? '']));
  const decided = new Set(batch.assets.flatMap((a) => plannedNames(a)));
  const hit = rows.map(record)
    .filter((r) => decided.has(r.name) && (r.status === 'approved' || r.status === 'superseded'))
    .map((r) => `${r.name} (${r.status}, ${r.batch})`);
  if (hit.length) {
    console.error(`[art] refusing to repaint ${hit.length} reviewed sprite(s): ${hit.join(', ')}`);
    console.error('[art] an approved row keeps its decision while its pixels change — that puts unreviewed art in the game.');
    console.error('[art] do it on purpose: `node tools/art/set-status.mjs <batch> pending <name…>` first,');
    console.error('[art] or pass --allow-repaint if you really only mean to re-encode the same files.');
    process.exit(1);
  }
}


async function writeSprite(dir, name, sprite) {
  const file = join(ROOT, dir, `${name}.png`);
  if (DRY_RUN) return relative(ROOT, file);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, toCanvas(sprite.w, sprite.h, sprite.data).toBuffer('image/png'));
  return relative(ROOT, file);
}

async function main() {
  const specPath = process.argv[2];
  if (!specPath) { console.error('usage: node tools/art/process-sprites.mjs art/<lote>.json'); process.exit(2); }
  const batch = JSON.parse(await readFile(join(ROOT, specPath), 'utf8'));
  await refuseReviewedRepaint(batch);
  const manifest = existsSync(MANIFEST) ? JSON.parse(await readFile(MANIFEST, 'utf8')) : { _comment: '', sprites: {}, foods: {} };
  manifest._comment = 'Generated by tools/art/process-sprites.mjs from art/<lote>.json — do not edit by hand. pivot is normalised (0..1); food states of one ingredient share canvas size and pivot.';
  const registry = [];
  const row = (name, category, file, notes = '') => { if (DRY_RUN) return; registry.push({
    name, category, source: 'ai-assisted', license: 'proprietary', version: '1.0',
    author: 'AI image model (Arena agent) + studio review', date: batch.date, status: 'pending',
    batch: batch.batch, file, notes,
  }); };
  const put = (name, entry) => { if (!DRY_RUN) manifest.sprites[name] = { ...entry, batch: batch.batch }; };

  let skipped = 0;
  for (const spec of batch.assets) {
    const srcPath = join(ROOT, batch.sourceDir, spec.source);
    if (!existsSync(srcPath)) {
      // Raw outputs are not in git and do not survive a workspace reset; the masters
      // already committed stay valid (docs/22 §8). Nothing is deleted or rewritten.
      console.warn(`[art] skip ${spec.source}: raw file missing — keeping the committed masters`);
      skipped++;
      continue;
    }
    const src = await loadRgba(srcPath);
    const srcRel = relative(ROOT, srcPath);
    if (spec.mode === 'opaque') {
      const file = await writeSprite(spec.out, spec.name, { w: src.w, h: src.h, data: src.data });
      put(spec.name, { file, w: src.w, h: src.h, pivot: [0.5, 0.5], category: spec.category, source: srcRel });
      row(spec.name, spec.category, file, spec.notes ?? '');
      console.log(`[art] ${spec.name.padEnd(38)} ${src.w}×${src.h} (opaque)`);
      continue;
    }
    const K = keyColour(src);
    const img = keyOut(src, K);
    const erased = eraseGridLines(src, img);
    const { lab, comps } = components(img.alpha, img.w, img.h);
    const tag = `key rgb(${K.join(',')})${erased ? `, ${erased} grid-line px erased` : ''}`;

    if (spec.mode === 'grid') {
      const cells = processGrid(img, lab, comps, spec);
      const byCell = Object.fromEntries(spec.cells.map((n, i) => [n, cells[i]]));
      // Grill foods share one canvas so neighbouring states can crossfade; prep items
      // (vinagrete: board → chopped → bowl) change shape by design, so `align: false`.
      const align = spec.align !== false;
      const aligned = align ? alignStates(spec.states.map((s) => byCell[s].sprite), spec.maxTiltDeg) : [];
      const food = { kind: spec.kind ?? 'grill', states: {}, served: null };
      for (let i = 0; i < spec.cells.length; i++) {
        const cellName = spec.cells[i];
        const name = `spr_food_${spec.subject}_${cellName}`;
        const si = spec.states.indexOf(cellName);
        const sprite = si >= 0 && align ? aligned[si] : cells[i].sprite;
        const file = await writeSprite(spec.out, name, sprite);
        put(name, { file, w: sprite.w, h: sprite.h, pivot: sprite.pivot ?? [0.5, 0.5], category: 'food', source: srcRel });
        if (cellName === 'served') food.served = name;
        else if (si >= 0) food.states[cellName] = name;
        else (food.other ??= {})[cellName] = name;
        const warn = [cells[i].dropped ? `${cells[i].dropped} stray part(s) dropped` : '', cells[i].touches ? 'touches cell edge' : ''].filter(Boolean).join('; ');
        row(name, 'food', file, [spec.notes ?? '', warn].filter(Boolean).join(' — '));
        console.log(`[art] ${name.padEnd(38)} ${sprite.w}×${sprite.h}${warn ? `  (${warn})` : ''}`);
      }
      manifest.foods[spec.subject] = food;
      console.log(`[art]   ${spec.source}: ${tag}`);
    } else if (spec.mode === 'icons') {
      if (spec.names.length !== spec.cols * spec.rows) throw new Error(`${spec.source}: ${spec.names.length} names for ${spec.cols * spec.rows} cells`);
      const cells = processGrid(img, lab, comps, spec, { keepAllInCell: true, minAreaFrac: 0.0002 });
      const category = spec.category ?? 'ui';
      for (let i = 0; i < spec.names.length; i++) {
        const { sprite, touches } = cells[i];
        const name = spec.names[i];
        const file = await writeSprite(spec.out, name, sprite);
        put(name, { file, w: sprite.w, h: sprite.h, pivot: [0.5, 0.5], category, source: srcRel });
        const warn = touches ? 'touches cell edge' : '';
        row(name, category, file, [spec.notes ?? '', warn].filter(Boolean).join(' — '));
        console.log(`[art] ${name.padEnd(38)} ${sprite.w}×${sprite.h}${warn ? `  (${warn})` : ''}`);
      }
      console.log(`[art]   ${spec.source}: ${tag}`);
    } else if (spec.mode === 'components') {
      for (const { name, sprite } of processComponents(img, lab, comps, spec)) {
        const file = await writeSprite(spec.out, name, sprite);
        put(name, { file, w: sprite.w, h: sprite.h, pivot: [0.5, 0.5], category: spec.category, source: srcRel });
        row(name, spec.category, file, spec.notes ?? '');
        console.log(`[art] ${name.padEnd(38)} ${sprite.w}×${sprite.h}`);
      }
      console.log(`[art]   ${spec.source}: ${tag}`);
    } else if (spec.mode === 'strips') {
      for (const { name, sprite } of processStrips(img, spec)) {
        const file = await writeSprite(spec.out, name, sprite);
        put(name, { file, w: sprite.w, h: sprite.h, pivot: [0.5, 0.5], category: spec.category, source: srcRel });
        row(name, spec.category, file, spec.notes ?? '');
        console.log(`[art] ${name.padEnd(38)} ${sprite.w}×${sprite.h} (opaque strip)`);
      }
      console.log(`[art]   ${spec.source}: ${tag}`);
    } else if (spec.mode === 'single') {
      const { sprite, hole } = processSingle(img, lab, comps, spec);
      const file = await writeSprite(spec.out, spec.name, sprite);
      put(spec.name, { file, w: sprite.w, h: sprite.h, pivot: [0.5, 0.5], category: spec.category, source: srcRel, ...(hole ? { hole } : {}) });
      row(spec.name, spec.category, file, spec.notes ?? '');
      console.log(`[art] ${spec.name.padEnd(38)} ${sprite.w}×${sprite.h}${hole ? `  hole bbox ${hole.bbox.join(',')}` : ''}`);
      console.log(`[art]   ${spec.source}: ${tag}`);
    } else {
      throw new Error(`unknown mode ${spec.mode}`);
    }
  }
  if (DRY_RUN) { console.log(`[art] dry run: nothing written (Assets/Art untouched)`); return; }
  await mkdir(dirname(MANIFEST), { recursive: true });
  const sorted = { _comment: manifest._comment, sprites: Object.fromEntries(Object.entries(manifest.sprites).sort(([a], [b]) => a.localeCompare(b))), foods: manifest.foods };
  await writeFile(MANIFEST, JSON.stringify(sorted, null, 2) + '\n');
  await updateRegistry(registry);
  console.log(`[art] ${registry.length} sprites → ${relative(ROOT, MANIFEST)}, ${relative(ROOT, REGISTRY)}${skipped ? ` · ${skipped} source(s) skipped (raw missing)` : ''}`);
}

main().catch((e) => { console.error('[art] FAILED:', e.message); process.exit(1); });
