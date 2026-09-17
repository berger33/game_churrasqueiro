/**
 * Theme — palette, typography and drawing primitives.
 *
 * Everything here is derived from docs/04-ART_STYLE.md and is checkable against it:
 *   R2 silhouette first   — every food has a distinct vector outline, readable as a
 *                           solid black shape (no emoji, no generic rounded box)
 *   R3 round everything   — `panel()` never produces a corner tighter than 4% of
 *                           the element's smallest dimension
 *   R4 warm light only    — every gradient runs through the fire/wood palette;
 *                           there is no cool or neutral white key light
 *   R5 one palette        — colours come from C only; adding one means editing this file
 *
 * Kept separate from main.ts so the game logic (which is covered by the sim-core
 * tests) never has to change when the art does.
 */

// ── Palette (docs/04-ART_STYLE.md §3) ───────────────────────────────────────
export const C = {
  carvao: '#1C1512',
  carvaoDeep: '#120D0A',
  cinza: '#3A2E28',
  cinzaLight: '#4E3E35',
  madeira: '#7A4A2A',
  madeiraClara: '#B98A55',
  inox: '#C8CDD2',
  ferro: '#5C5A58',
  brasa: '#E0561F',
  chama: '#F2A63B',
  vermelho: '#A32E1C',
  creme: '#F4E7D3',
  offwhite: '#FBF5EC',
  verde: '#6FA84A',
  ambar: '#E8B23C',
  telha: '#C0442E',
  ouro: '#E7C24A'
} as const;

/** Display face: rounded geometric grotesque, heavy (§4). */
export const DISPLAY = '"Baloo 2", "Trebuchet MS", system-ui, sans-serif';
/** UI face: humanist sans (§4). */
export const UI = '"Nunito", "Segoe UI", system-ui, sans-serif';

export function font(size: number, weight = 700, family: string = UI): string {
  return `${weight} ${size}px ${family}`;
}

// ── Easing ──────────────────────────────────────────────────────────────────
export const ease = {
  outCubic: (t: number): number => 1 - Math.pow(1 - t, 3),
  outBack: (t: number): number => 1 + 2.2 * Math.pow(t - 1, 3) + 1.4 * Math.pow(t - 1, 2),
  outElastic: (t: number): number =>
    t === 0 || t === 1 ? t : Math.pow(2, -9 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1,
  inOutQuad: (t: number): number => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)
};

export const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * clamp01(t);

// ── Colour helpers ──────────────────────────────────────────────────────────
export type RGB = [number, number, number];

export function hex(h: string): RGB {
  const s = h.replace('#', '');
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
}

export function mixRgb(a: RGB, b: RGB, t: number): RGB {
  const k = clamp01(t);
  return [
    Math.round(a[0] + (b[0] - a[0]) * k),
    Math.round(a[1] + (b[1] - a[1]) * k),
    Math.round(a[2] + (b[2] - a[2]) * k)
  ];
}

export function rgb(c: RGB, alpha = 1): string {
  return alpha >= 1 ? `rgb(${c[0]},${c[1]},${c[2]})` : `rgba(${c[0]},${c[1]},${c[2]},${alpha})`;
}

export function mix(a: RGB, b: RGB, t: number, alpha = 1): string {
  return rgb(mixRgb(a, b, t), alpha);
}

export function shade(c: RGB, amount: number): RGB {
  return amount >= 0 ? mixRgb(c, [255, 255, 255], amount) : mixRgb(c, [0, 0, 0], -amount);
}

// ── Geometry primitives ─────────────────────────────────────────────────────

export function roundRectPath(
  ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number
): void {
  // R3: never tighter than 4% of the smallest dimension.
  const minR = Math.min(w, h) * 0.04;
  const rr = Math.max(minR, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/**
 * A panel: warm gradient body, soft drop shadow, and a lit top edge.
 * This single primitive is what makes the UI read as "product" rather than
 * "flat rectangle" — every card, button and pill in the game uses it.
 */
export function panel(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  opts: {
    r?: number;
    top?: string;
    bottom?: string;
    border?: string;
    borderWidth?: number;
    shadow?: number;
    shadowAlpha?: number;
    innerGlow?: boolean;
  } = {}
): void {
  const {
    r = 14,
    top = 'rgba(58,46,40,0.96)',
    bottom = 'rgba(28,21,18,0.96)',
    border = 'rgba(244,231,211,0.14)',
    borderWidth = 1,
    shadow = 10,
    shadowAlpha = 0.45,
    innerGlow = true
  } = opts;

  ctx.save();
  if (shadow > 0) {
    ctx.shadowColor = `rgba(0,0,0,${shadowAlpha})`;
    ctx.shadowBlur = shadow;
    ctx.shadowOffsetY = shadow * 0.4;
  }
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  roundRectPath(ctx, x, y, w, h, r);
  ctx.fill();
  ctx.restore();

  // Lit top edge — the key light is warm and comes from above (R4).
  if (innerGlow) {
    ctx.save();
    roundRectPath(ctx, x + 0.5, y + 0.5, w - 1, h - 1, r);
    ctx.clip();
    const hl = ctx.createLinearGradient(0, y, 0, y + Math.min(h * 0.5, 26));
    hl.addColorStop(0, 'rgba(255,214,160,0.20)');
    hl.addColorStop(1, 'rgba(255,214,160,0)');
    ctx.fillStyle = hl;
    ctx.fillRect(x, y, w, Math.min(h * 0.5, 26));
    ctx.restore();
  }

  if (borderWidth > 0 && border !== 'none') {
    ctx.strokeStyle = border;
    ctx.lineWidth = borderWidth;
    roundRectPath(ctx, x + borderWidth / 2, y + borderWidth / 2, w - borderWidth, h - borderWidth, r);
    ctx.stroke();
  }
}

/** Filled pill used for HUD chips and buttons. */
export function pill(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  fill: string | CanvasGradient,
  opts: { border?: string; shadow?: number } = {}
): void {
  ctx.save();
  if (opts.shadow) {
    ctx.shadowColor = 'rgba(0,0,0,0.4)';
    ctx.shadowBlur = opts.shadow;
    ctx.shadowOffsetY = opts.shadow * 0.35;
  }
  ctx.fillStyle = fill;
  roundRectPath(ctx, x, y, w, h, h / 2);
  ctx.fill();
  ctx.restore();
  if (opts.border) {
    ctx.strokeStyle = opts.border;
    ctx.lineWidth = 1;
    roundRectPath(ctx, x + 0.5, y + 0.5, w - 1, h - 1, (h - 1) / 2);
    ctx.stroke();
  }
}

/** Text with a soft dark outline so it stays legible over fire and glow. */
export function outlinedText(
  ctx: CanvasRenderingContext2D,
  text: string, x: number, y: number,
  fill: string, size: number,
  opts: { weight?: number; family?: string; outline?: number; align?: CanvasTextAlign; shadow?: number } = {}
): void {
  const { weight = 800, family = DISPLAY, outline = 3, align = 'center', shadow = 0 } = opts;
  ctx.save();
  ctx.font = font(size, weight, family);
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  if (shadow > 0) {
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = shadow;
    ctx.shadowOffsetY = 2;
  }
  if (outline > 0) {
    ctx.lineWidth = outline;
    ctx.strokeStyle = 'rgba(24,15,11,0.85)';
    ctx.strokeText(text, x, y);
  }
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
  ctx.restore();
}

// ── Vector icons (replacing every emoji) ────────────────────────────────────

export function coinIcon(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.save();
  ctx.translate(x, y);
  const g = ctx.createLinearGradient(0, -r, 0, r);
  g.addColorStop(0, '#F7DC82');
  g.addColorStop(0.45, C.ouro);
  g.addColorStop(1, '#B8862B');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(90,58,12,0.55)';
  ctx.lineWidth = Math.max(1, r * 0.14);
  ctx.stroke();
  // inner ring + ember glyph
  ctx.strokeStyle = 'rgba(255,244,200,0.55)';
  ctx.lineWidth = Math.max(1, r * 0.1);
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.66, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = 'rgba(140,88,18,0.75)';
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.42);
  ctx.quadraticCurveTo(r * 0.3, -r * 0.05, 0, r * 0.42);
  ctx.quadraticCurveTo(-r * 0.3, -r * 0.05, 0, -r * 0.42);
  ctx.fill();
  ctx.restore();
}

export function flameIcon(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, hot = false): void {
  ctx.save();
  ctx.translate(x, y);
  const g = ctx.createLinearGradient(0, -r, 0, r);
  g.addColorStop(0, hot ? '#FFE08A' : C.chama);
  g.addColorStop(0.55, C.brasa);
  g.addColorStop(1, C.vermelho);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0, -r);
  ctx.bezierCurveTo(r * 0.75, -r * 0.3, r * 0.62, r * 0.55, 0, r);
  ctx.bezierCurveTo(-r * 0.62, r * 0.55, -r * 0.75, -r * 0.3, 0, -r);
  ctx.fill();
  // inner core
  ctx.fillStyle = hot ? 'rgba(255,250,220,0.92)' : 'rgba(255,224,138,0.85)';
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.32);
  ctx.bezierCurveTo(r * 0.34, r * 0.05, r * 0.26, r * 0.5, 0, r * 0.66);
  ctx.bezierCurveTo(-r * 0.26, r * 0.5, -r * 0.34, r * 0.05, 0, -r * 0.32);
  ctx.fill();
  ctx.restore();
}

export function starIcon(
  ctx: CanvasRenderingContext2D, x: number, y: number, r: number,
  opts: { filled?: boolean; scale?: number } = {}
): void {
  const { filled = true, scale = 1 } = opts;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * 0.46;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const px = Math.cos(a) * rad;
    const py = Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  if (filled) {
    const g = ctx.createLinearGradient(0, -r, 0, r);
    g.addColorStop(0, '#FFE9A8');
    g.addColorStop(0.5, C.ouro);
    g.addColorStop(1, '#C89528');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = 'rgba(120,78,16,0.6)';
    ctx.lineWidth = Math.max(1, r * 0.09);
    ctx.stroke();
  } else {
    ctx.strokeStyle = 'rgba(244,231,211,0.30)';
    ctx.lineWidth = Math.max(1.5, r * 0.12);
    ctx.stroke();
  }
  ctx.restore();
}

export function clockIcon(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, col: string): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = col;
  ctx.lineWidth = Math.max(1.4, r * 0.16);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.5);
  ctx.lineTo(0, 0);
  ctx.lineTo(r * 0.38, r * 0.22);
  ctx.stroke();
  ctx.restore();
}

export function checkIcon(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, col: string): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = col;
  ctx.lineWidth = Math.max(2, r * 0.34);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(-r * 0.55, 0);
  ctx.lineTo(-r * 0.1, r * 0.48);
  ctx.lineTo(r * 0.6, -r * 0.45);
  ctx.stroke();
  ctx.restore();
}

/** Small circular avatar backdrop used by customer cards. */
export function avatar(
  ctx: CanvasRenderingContext2D, x: number, y: number, r: number,
  body: string, accent: string
): void {
  ctx.save();
  const g = ctx.createLinearGradient(x, y - r, x, y + r);
  g.addColorStop(0, mix(hex(body), [255, 255, 255], 0.24));
  g.addColorStop(1, body);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = accent;
  ctx.lineWidth = Math.max(1.5, r * 0.12);
  ctx.stroke();
  // simple head + shoulders silhouette (R2)
  ctx.fillStyle = 'rgba(28,21,18,0.55)';
  ctx.beginPath();
  ctx.arc(x, y - r * 0.22, r * 0.34, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x, y + r * 0.62, r * 0.52, r * 0.42, 0, Math.PI, 0);
  ctx.fill();
  ctx.restore();
}
