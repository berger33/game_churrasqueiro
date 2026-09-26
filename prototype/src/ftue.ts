/**
 * FTUE overlay primitives (docs/05-UX_FLOW.md §4, fixes from docs/20 + docs/21).
 *
 * Pure drawing — no game state. `main.ts` decides *what* to point at (via
 * `TutorialTurn.coach()` in sim-core); this file decides how it looks:
 *
 *   drawScrim      dark veil with real holes (even-odd fill). The old overlay
 *                  used destination-out on the main canvas, which erased the
 *                  scene inside the spotlight down to the page background.
 *   drawHand       vector hand — never the 👆 emoji that renders as ☐ on
 *                  low-end Android (docs/20 P0 #1)
 *   dragLoop       the bench → grill arc on a ~900 ms loop, not a 6 px wobble
 *   wrapWords      word-safe wrap (docs/20: "LINGUIÇA" was split in two)
 *   drawStepDots   six dots, no "Passo x/6" text — zero text explanation
 *   drawSkipButton PULAR on a 48 px target (docs/21: the 36×28 ✕ was found by 60 %)
 */
import { C, DISPLAY, UI, clamp01, ease, font, outlinedText } from './theme.ts';

export interface Rect { x: number; y: number; w: number; h: number; r?: number }
export interface Pt { x: number; y: number }

function addRoundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.max(1, Math.min(r, w / 2, h / 2));
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export function pad(r: Rect, p: number): Rect {
  return { x: r.x - p, y: r.y - p, w: r.w + p * 2, h: r.h + p * 2, r: (r.r ?? 14) + p };
}

export function contains(r: Rect, p: Pt, slop = 0): boolean {
  return p.x >= r.x - slop && p.x <= r.x + r.w + slop && p.y >= r.y - slop && p.y <= r.y + r.h + slop;
}

/** Dark veil over everything except `holes`. Holes must not overlap (even-odd). */
export function drawScrim(ctx: CanvasRenderingContext2D, w: number, h: number, holes: Rect[], alpha: number): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, w, h);
  for (const r of holes) addRoundRect(ctx, r.x, r.y, r.w, r.h, r.r ?? 14);
  ctx.fillStyle = `rgba(6,3,2,${alpha})`;
  ctx.fill('evenodd');
  ctx.restore();
}

/** Pulsing warm outline around a hole; `nudge` (0..1) shakes it after a blocked action. */
export function drawHoleRing(ctx: CanvasRenderingContext2D, r: Rect, t: number, nudge = 0): void {
  const pulse = 0.5 + 0.5 * Math.sin(t * 3.5);
  const shake = nudge > 0 ? Math.sin(t * 55) * 5 * nudge : 0;
  ctx.save();
  ctx.strokeStyle = `rgba(255,220,160,${0.35 + 0.35 * pulse})`;
  ctx.lineWidth = 2 + 1.5 * pulse;
  ctx.shadowColor = 'rgba(255,190,90,0.55)';
  ctx.shadowBlur = 10;
  ctx.beginPath();
  addRoundRect(ctx, r.x - 3 + shake, r.y - 3, r.w + 6, r.h + 6, (r.r ?? 14) + 3);
  ctx.stroke();
  ctx.restore();
}

/**
 * Ring that fills while the plate is not ready yet — "espere dourar" said
 * without words. Full ring = the prompt is about to appear.
 */
export function drawProgressRing(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, progress: number, t: number, nudge = 0): void {
  const p = clamp01(progress);
  const s = 1 + 0.12 * nudge * Math.abs(Math.sin(t * 30));
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  ctx.lineWidth = 7;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,235,205,0.16)';
  ctx.lineWidth = 5;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
  if (p > 0.001) {
    ctx.strokeStyle = p >= 1 ? C.ouroLight : C.chama;
    ctx.shadowColor = C.chama;
    ctx.shadowBlur = 10;
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(0, 0, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p); ctx.stroke();
    // ember at the leading edge
    const a = -Math.PI / 2 + Math.PI * 2 * p;
    ctx.fillStyle = C.chamaCore;
    ctx.beginPath(); ctx.arc(Math.cos(a) * r, Math.sin(a) * r, 3.2, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

/**
 * Vector hand with the index fingertip at (x, y). `press` 0..1 squashes it onto
 * the target and draws a touch ripple.
 */
export function drawHand(ctx: CanvasRenderingContext2D, x: number, y: number, press = 0, alpha = 1): void {
  if (alpha <= 0.01) return;
  ctx.save();
  ctx.globalAlpha *= clamp01(alpha);
  if (press > 0.05) {
    ctx.strokeStyle = `rgba(255,227,136,${0.75 * press})`;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(x, y, 10 + 16 * press, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.translate(x, y + 2 * press);
  ctx.rotate(-0.22);
  const k = 1 - 0.1 * press;
  ctx.scale(k, k);
  const skin = C.perola;
  const line = 'rgba(18,11,8,0.9)';
  ctx.lineJoin = 'round';
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 5;
  // palm + folded fingers
  ctx.beginPath();
  addRoundRect(ctx, -9, 17, 32, 27, 10);
  ctx.fillStyle = skin; ctx.fill();
  ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  ctx.strokeStyle = line; ctx.lineWidth = 2; ctx.stroke();
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    addRoundRect(ctx, 5 + i * 6.2, 13 + i * 1.5, 7.5, 12, 3.8);
    ctx.fillStyle = skin; ctx.fill(); ctx.stroke();
  }
  // index finger (tip at the origin)
  ctx.beginPath();
  addRoundRect(ctx, -6, -1, 12, 28, 6);
  ctx.fillStyle = skin; ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(231,194,74,0.35)';
  ctx.beginPath(); ctx.ellipse(0, 4, 3.4, 2.4, 0, 0, Math.PI * 2); ctx.fill();
  // thumb
  ctx.save();
  ctx.translate(-8, 30); ctx.rotate(-0.75);
  ctx.beginPath(); addRoundRect(ctx, -6, -10, 12, 19, 6);
  ctx.fillStyle = skin; ctx.fill(); ctx.stroke();
  ctx.restore();
  // cuff
  ctx.beginPath(); addRoundRect(ctx, -6, 42, 27, 9, 3);
  ctx.fillStyle = C.brasa; ctx.fill(); ctx.stroke();
  ctx.restore();
}

/** Point along the hand's arc: a quadratic curve lifted toward the top of the screen. */
export function arcPoint(from: Pt, to: Pt, u: number, lift = 70): Pt {
  const t = clamp01(u);
  const c = { x: (from.x + to.x) / 2 - 26, y: Math.min(from.y, to.y) - lift };
  const a = 1 - t;
  return { x: a * a * from.x + 2 * a * t * c.x + t * t * to.x, y: a * a * from.y + 2 * a * t * c.y + t * t * to.y };
}

/**
 * Phase of the drag demonstration: press on the source, travel along the arc in
 * `travelSec` (docs/20: ~900 ms), release on the target, fade, repeat.
 */
export function dragLoop(t: number, travelSec: number): { u: number; press: number; alpha: number; carrying: boolean } {
  const grab = 0.25, drop = 0.3, fade = 0.3;
  const period = grab + travelSec + drop + fade;
  const k = ((t % period) + period) % period;
  if (k < grab) return { u: 0, press: ease.outCubic(k / grab), alpha: clamp01(k / 0.12), carrying: k > grab * 0.6 };
  if (k < grab + travelSec) return { u: ease.inOutCubic((k - grab) / travelSec), press: 1, alpha: 1, carrying: true };
  if (k < grab + travelSec + drop) return { u: 1, press: 1 - ease.outCubic((k - grab - travelSec) / drop), alpha: 1, carrying: false };
  return { u: 1, press: 0, alpha: 1 - (k - grab - travelSec - drop) / fade, carrying: false };
}

/** Phase of the tap demonstration: two quick presses, then a rest. */
export function tapLoop(t: number): { press: number; lift: number } {
  const k = t % 1.2;
  const bump = (c: number): number => Math.max(0, 1 - Math.abs(k - c) / 0.14);
  const press = Math.max(bump(0.25), bump(0.62));
  return { press, lift: (1 - press) * 10 };
}

/** Greedy word wrap that never breaks inside a word. */
export function wrapWords(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (!line || ctx.measureText(next).width <= maxWidth) line = next;
    else { lines.push(line); line = w; }
  }
  if (line) lines.push(line);
  return lines;
}

/** Short imperative prompt ("TOQUE PARA VIRAR") in a pill centred on (cx, cy). */
export function drawPrompt(ctx: CanvasRenderingContext2D, text: string, cx: number, cy: number, maxW: number, t: number): Rect {
  const size = 17;
  const lineH = 22;
  ctx.save();
  ctx.font = font(size, 900, DISPLAY);
  const lines = wrapWords(ctx, text, maxW - 40);
  let wMax = 0;
  for (const l of lines) wMax = Math.max(wMax, ctx.measureText(l).width);
  const w = Math.min(maxW, Math.max(120, wMax + 40));
  const h = lines.length * lineH + 18;
  const bob = Math.sin(t * 2.4) * 2;
  const x = cx - w / 2;
  const y = cy - h / 2 + bob;
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 6;
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, 'rgba(70,46,26,0.97)');
  g.addColorStop(1, 'rgba(32,20,12,0.97)');
  ctx.fillStyle = g;
  ctx.beginPath(); addRoundRect(ctx, x, y, w, h, h / 2); ctx.fill();
  ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  ctx.strokeStyle = C.ouro; ctx.lineWidth = 2;
  ctx.beginPath(); addRoundRect(ctx, x + 1, y + 1, w - 2, h - 2, h / 2 - 1); ctx.stroke();
  ctx.restore();
  lines.forEach((l, i) => {
    outlinedText(ctx, l, cx, y + 9 + lineH * (i + 0.5) + 1, C.perola, size, { weight: 900, outline: 3 });
  });
  return { x, y, w, h };
}

/** One dot per FTUE step: done = gold, current = pulsing, ahead = dim. */
export function drawStepDots(ctx: CanvasRenderingContext2D, cx: number, cy: number, total: number, current: number, t: number): void {
  const gap = 13;
  const x0 = cx - ((total - 1) * gap) / 2;
  ctx.save();
  for (let i = 0; i < total; i++) {
    const idx = i + 1;
    const x = x0 + i * gap;
    if (idx < current) {
      ctx.fillStyle = C.ouroLight;
      ctx.beginPath(); ctx.arc(x, cy, 4, 0, Math.PI * 2); ctx.fill();
    } else if (idx === current) {
      const p = 0.5 + 0.5 * Math.sin(t * 5);
      ctx.fillStyle = C.chama;
      ctx.shadowColor = C.chama; ctx.shadowBlur = 8 * p;
      ctx.beginPath(); ctx.arc(x, cy, 4.5 + p, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
    } else {
      ctx.fillStyle = 'rgba(255,235,205,0.22)';
      ctx.beginPath(); ctx.arc(x, cy, 3.5, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.restore();
}

/** PULAR: a labelled chip centred in its (≥ 44 px) hit rect. */
export function drawSkipButton(ctx: CanvasRenderingContext2D, hit: Rect, label: string, alpha: number): void {
  if (alpha <= 0.01) return;
  const w = Math.max(hit.w, 58);
  const h = 32;
  const x = hit.x + hit.w - w;
  const y = hit.y + (hit.h - h) / 2;
  ctx.save();
  ctx.globalAlpha *= clamp01(alpha);
  ctx.fillStyle = 'rgba(20,12,8,0.78)';
  ctx.beginPath(); addRoundRect(ctx, x, y, w, h, h / 2); ctx.fill();
  ctx.strokeStyle = 'rgba(255,214,160,0.45)'; ctx.lineWidth = 1.5; ctx.stroke();
  // ✕ drawn as strokes, so it cannot become a missing glyph
  const ix = x + 13, iy = y + h / 2;
  ctx.strokeStyle = C.creme; ctx.lineWidth = 2; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(ix - 4, iy - 4); ctx.lineTo(ix + 4, iy + 4); ctx.moveTo(ix + 4, iy - 4); ctx.lineTo(ix - 4, iy + 4); ctx.stroke();
  ctx.font = font(11, 900, UI);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = C.creme;
  ctx.fillText(label, x + 22, iy + 1);
  ctx.restore();
}
