/**
 * Painted sprites over the procedural art (docs/22-ARTE_2D_PLANO.md §7.1).
 *
 * Loads `/assets/art/index.json` — built by `tools/art/build-runtime.mjs` from the APPROVED
 * masters in Assets/Art — and every WebP it lists. Each helper returns `false`/`null`/`0` when
 * its sprite is missing or not decoded yet, and the caller draws the procedural version. That
 * keeps the procedural art as a tested fallback: `check-art` and `check-render` run in Node
 * without `Image`, so they never load a sprite; `check-shots` shims `Image` and renders these.
 */

type Ctx = CanvasRenderingContext2D;
type Img = CanvasImageSource & { width: number; height: number };
export type Pt = { x: number; y: number };
export type Quad = [number, number][]; // TL, TR, BR, BL — TL→TR is the far rim

interface SpriteEntry { file: string; w: number; h: number; hole?: { bbox: number[]; quad: Quad; tiltDeg?: number } }
interface FoodEntry { kind?: string; states: Record<string, string>; served?: string | null }
interface RuntimeIndex {
  includePending?: boolean;
  sprites: Record<string, SpriteEntry>;
  foods: Record<string, FoodEntry>;
  customers: Record<string, string[]>;
  grills: Record<string, Record<string, string>>;
  backgrounds: Record<string, string>;
  props: Record<string, string>;
  fx: Record<string, string>;
  icons: Record<string, string>;
}

let index: RuntimeIndex | null = null;
const loaded = new Map<string, Img>();
let started = false;

/** Starts loading once; a no-op where there is no `Image` (Node harnesses without a shim). */
export function preloadSprites(base = '/assets/art/'): void {
  if (started || typeof Image === 'undefined' || typeof fetch === 'undefined') return;
  started = true;
  fetch(base + 'index.json')
    .then((r) => (r.ok ? r.json() : null))
    .then((idx: RuntimeIndex | null) => {
      if (!idx || !idx.sprites) return;
      index = idx;
      for (const [name, e] of Object.entries(idx.sprites)) {
        const img = new Image();
        img.onload = () => { loaded.set(name, img as unknown as Img); };
        img.onerror = () => { /* keep the procedural fallback */ };
        img.src = base + e.file;
      }
    })
    .catch(() => { /* offline: procedural art */ });
}

/** How many sprites are decoded (render harnesses wait on this). */
export function spritesLoaded(): number { return loaded.size; }
export function spritesExpected(): number { return index ? Object.keys(index.sprites).length : 0; }
// Harness hook, like __churrascoAnalytics: `prototype/shoot.mjs` waits for the art to decode.
(globalThis as { __churrascoArt?: unknown }).__churrascoArt = { loaded: spritesLoaded, expected: spritesExpected };

function get(name: string | null | undefined): { img: Img; e: SpriteEntry } | null {
  if (!name || !index) return null;
  const img = loaded.get(name);
  const e = index.sprites[name];
  return img && e ? { img, e } : null;
}

// ── geometry ────────────────────────────────────────────────────────────────

/** Bilinear point inside a quad: u across TL→TR, v from the far rim (0) to the near rim (1). */
export function quadPoint(q: Quad, u: number, v: number): Pt {
  const tx = q[0]![0] + (q[1]![0] - q[0]![0]) * u, ty = q[0]![1] + (q[1]![1] - q[0]![1]) * u;
  const bx = q[3]![0] + (q[2]![0] - q[3]![0]) * u, by = q[3]![1] + (q[2]![1] - q[3]![1]) * u;
  return { x: tx + (bx - tx) * v, y: ty + (by - ty) * v };
}

/** Inverse of quadPoint (Newton's method; exact for parallelograms, close for the rest). */
export function quadInverse(q: Quad, x: number, y: number): { u: number; v: number } {
  let u = 0.5, v = 0.5;
  for (let i = 0; i < 8; i++) {
    const p = quadPoint(q, u, v);
    const pu = quadPoint(q, u + 1e-3, v), pv = quadPoint(q, u, v + 1e-3);
    const a = (pu.x - p.x) / 1e-3, b = (pv.x - p.x) / 1e-3, c = (pu.y - p.y) / 1e-3, d = (pv.y - p.y) / 1e-3;
    const det = a * d - b * c;
    if (Math.abs(det) < 1e-9) break;
    const ex = x - p.x, ey = y - p.y;
    u += (d * ex - b * ey) / det;
    v += (-c * ex + a * ey) / det;
  }
  return { u, v };
}

export function quadPath(ctx: Ctx, q: Quad): void {
  ctx.beginPath();
  q.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
}

// ── food ────────────────────────────────────────────────────────────────────

/** Keyframe anchors on the doneness axis, derived from the data's stage thresholds: each
 *  painted state sits in the middle of its stage, so the frame on screen always agrees with
 *  the stage label the rules compute. */
let anchors: [string, number][] = [['raw', 0.15], ['rare', 0.475], ['medium', 0.775], ['well', 1.075], ['burned', 1.3]];
export function setStageThresholds(t: { RAW_MAX: number; RARE_MAX: number; MEDIUM_MAX: number; WELL_MAX: number }): void {
  anchors = [
    ['raw', t.RAW_MAX * 0.45],
    ['rare', (t.RAW_MAX + t.RARE_MAX) / 2],
    ['medium', (t.RARE_MAX + t.MEDIUM_MAX) / 2],
    ['well', (t.MEDIUM_MAX + t.WELL_MAX) / 2],
    ['burned', t.WELL_MAX + (t.WELL_MAX - t.MEDIUM_MAX) * 0.4],
  ];
}

/** The one or two frames to show, with weights (crossfade between neighbouring states). */
export function foodFrameWeights(doneness: number, burned: boolean): [string, number][] {
  if (burned) return [['burned', 1]];
  if (doneness <= anchors[0]![1]) return [['raw', 1]];
  for (let i = 0; i < anchors.length - 1; i++) {
    const [a, da] = anchors[i]!, [b, db] = anchors[i + 1]!;
    if (doneness <= db) {
      const t = (doneness - da) / (db - da);
      return t < 0.02 ? [[a, 1]] : t > 0.98 ? [[b, 1]] : [[a, 1 - t], [b, t]];
    }
  }
  return [['burned', 1]];
}

/** Display width (logical px) of a food sprite at scale 1. */
export function foodDisplayWidth(ingredientId: string, sides: number): number {
  return sides >= 4 || ingredientId === 'coracao_frango' ? 86 : 72;
}

/**
 * Draws the painted food, crossfading two neighbouring states by continuous doneness.
 * Returns the drawn height (0 = not available → draw the procedural food instead).
 */
export function drawFoodSprite(
  ctx: Ctx, ingredientId: string, sides: number, x: number, y: number,
  opts: { doneness: number; burned: boolean; scale?: number },
): number {
  const f = index?.foods[ingredientId];
  if (!f) return 0;
  const weights = f.kind === 'prep'
    ? ([[opts.doneness < 0.33 ? 'raw' : opts.doneness < 0.66 ? 'prep' : 'ready', 1]] as [string, number][])
    : foodFrameWeights(opts.doneness, opts.burned);
  const frames = weights.map(([st, w]) => ({ s: get(f.states[st]), w }));
  if (frames.some((fr) => !fr.s)) return 0;
  const first = frames[0]!.s!;
  const w = foodDisplayWidth(ingredientId, sides) * (opts.scale ?? 1);
  const h = (w * first.e.h) / first.e.w;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.28)'; // contact shadow on the grate
  ctx.beginPath(); ctx.ellipse(x, y + h * 0.3, w * 0.4, h * 0.14, 0, 0, Math.PI * 2); ctx.fill();
  frames.forEach((fr, i) => {
    ctx.globalAlpha = i === 0 ? 1 : fr.w;
    ctx.drawImage(fr.s!.img, x - w / 2, y - h / 2, w, h);
  });
  ctx.restore();
  return h;
}

/** Bench / order-card icon: the raw ingredient or the served dish, fitted in a box. */
export function drawFoodIconSprite(ctx: Ctx, ingredientId: string, x: number, y: number, size: number, kind: 'raw' | 'served'): boolean {
  const f = index?.foods[ingredientId];
  if (!f) return false;
  const s = get(kind === 'served' ? f.served : f.states['raw']);
  if (!s) return false;
  const bw = kind === 'served' ? size * 1.25 : size * 1.7, bh = kind === 'served' ? size * 1.1 : size * 1.05;
  const k = Math.min(bw / s.e.w, bh / s.e.h);
  const w = s.e.w * k, h = s.e.h * k;
  ctx.drawImage(s.img, x - w / 2, y - h / 2, w, h);
  return true;
}

// ── customers ───────────────────────────────────────────────────────────────

/** Circular portrait for an order card. `uid` picks a variant (a/b) and keeps it per customer. */
export function drawPortrait(ctx: Ctx, customerType: string, uid: number, x: number, y: number, r: number, ring: string): boolean {
  const variants = index?.customers[customerType];
  if (!variants?.length) return false;
  const s = get(variants[Math.abs(uid) % variants.length]);
  if (!s) return false;
  const side = Math.min(s.e.w, s.e.h) * 0.86;
  ctx.save();
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.closePath();
  const bg = ctx.createRadialGradient(x, y - r * 0.3, r * 0.2, x, y, r);
  bg.addColorStop(0, '#FBE7C6'); bg.addColorStop(1, '#E2B884');
  ctx.fillStyle = bg; ctx.fill();
  ctx.clip();
  ctx.drawImage(s.img, (s.e.w - side) / 2, 0, side, side, x - r, y - r, r * 2, r * 2);
  ctx.restore();
  ctx.save();
  ctx.strokeStyle = ring; ctx.lineWidth = Math.max(1.5, r * 0.14);
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
  return true;
}

// ── grills, scenes, props, fx, icons ────────────────────────────────────────

export function grillSprite(churrasqueiraId: string, evolution: number): { img: Img; w: number; h: number; hole: { bbox: number[]; quad: Quad } } | null {
  const name = index?.grills[churrasqueiraId]?.[String(evolution)];
  const s = get(name);
  return s && s.e.hole ? { img: s.img, w: s.e.w, h: s.e.h, hole: s.e.hole } : null;
}

export function backgroundSprite(restaurantId: string): Img | null {
  return get(index?.backgrounds[restaurantId])?.img ?? null;
}

export function propSprite(id: string): { img: Img; w: number; h: number } | null {
  const s = get(index?.props[id]);
  return s ? { img: s.img, w: s.e.w, h: s.e.h } : null;
}

export function fxSprite(id: string): Img | null {
  return get(index?.fx[id])?.img ?? null;
}

/** A UI icon (ids as the data names them: ic_coin, ic_ember, ic_heat…) centred in a box. */
export function drawIconSprite(ctx: Ctx, id: string, x: number, y: number, size: number): boolean {
  const s = get(index?.icons[id]);
  if (!s) return false;
  const k = size / Math.max(s.e.w, s.e.h);
  ctx.drawImage(s.img, x - (s.e.w * k) / 2, y - (s.e.h * k) / 2, s.e.w * k, s.e.h * k);
  return true;
}
