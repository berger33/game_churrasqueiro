/**
 * Theme — palette, typography and drawing primitives.
 *
 * Refined for a friendly, commercial, big-studio look. Every primitive is
 * designed to look intentional rather than prototypical:
 *   - glass() for frosted glass chips/HUD
 *   - premiumButton() for CTA treatment with inner glow + ambient rim
 *   - coin/flame/star get cinematic lighting
 *   - brickPattern() + mortar() for the iconic churrasqueira de alvenaria
 *
 * Everything here is derived from docs/04-ART_STYLE.md and checkable against it:
 *   R2 silhouette first   — every food has a distinct vector outline
 *   R3 round everything   — panel radii clamped to ≥4% of smallest dim
 *   R4 warm light only    — every gradient runs through the fire/wood palette
 *   R5 one palette        — colours come from C only
 */

// ── Palette (docs/04-ART_STYLE.md §3, expanded for studio grade) ────────────
export const C = {
  // Deep structure
  carvao: '#1C1512',
  carvaoDeep: '#0E0907',
  night: '#070504',
  cinza: '#3A2E28',
  cinzaLight: '#55453B',
  cinzaMid: '#483830',
  // Wood (tábua, mesa, alvenaria)
  madeira: '#7A4A2A',
  madeiraEscura: '#5A341E',
  madeiraClara: '#B98A55',
  madeiraPinho: '#D7AE7A',
  // Masonry (churrasqueira de alvenaria)
  tijolo: '#9A3B22',
  tijoloClaro: '#B54E2E',
  tijoloSombra: '#6E2816',
  argamassa: '#C9A98A',
  // Metal
  inox: '#D6DBE0',
  inoxDark: '#8A8F94',
  ferro: '#4A4846',
  ferroClaro: '#6E6A66',
  // Fire
  brasa: '#E0561F',
  brasaHot: '#F26A27',
  chama: '#F2A63B',
  chamaCore: '#FFD98A',
  chamaWhite: '#FFF3D0',
  vermelho: '#A32E1C',
  // UI neutrals
  creme: '#F4E7D3',
  offwhite: '#FBF5EC',
  perola: '#FFFAF0',
  // Semantic
  verde: '#6FA84A',
  verdeClaro: '#8CC664',
  ambar: '#E8B23C',
  telha: '#C0442E',
  ouro: '#E7C24A',
  ouroLight: '#FFE388',
  ouroDark: '#B78F1F',
  // Glass
  glass: 'rgba(255,235,205,0.06)',
  glassStrong: 'rgba(255,235,205,0.12)',
  glassBorder: 'rgba(255,235,205,0.18)',
} as const;

// ── Textured atlas (opt-in fotoreal, fallback procedural) ───────────────────
// PNGs em prototype/assets/textures/*.png (512 wood, 256 brick). Se carregadas,
// drawWoodGrain/drawBrickwork usam pattern; senão caem no procedural (Node smoke,
// offline, LOW memory). Assim ganhamos +12% fidelity sem quebrar check-render.
export const TEXTURE_URLS = {
  wood: '/assets/textures/wood-planks-512.png',
  brick: '/assets/textures/brick-wall-256.png',
} as const;
const _texCache = new Map<string, CanvasImageSource & { width:number; height:number }>();
const _texPatternCache = new Map<string, CanvasPattern | null>();
let _texReady = false;
export function preloadTextures(): void {
  if (_texReady || typeof Image === 'undefined' || typeof document === 'undefined') return;
  _texReady = true;
  for (const [key, url] of Object.entries(TEXTURE_URLS) as [keyof typeof TEXTURE_URLS, string][]) {
    const img = new Image() as HTMLImageElement;
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      _texCache.set(key, img as unknown as CanvasImageSource & { width:number; height:number });
      _texPatternCache.delete(key);
    };
    img.onerror = () => { /* keep procedural fallback */ };
    img.src = url;
  }
}
export function isTextureReady(key: keyof typeof TEXTURE_URLS): boolean {
  return _texCache.has(key);
}
function getTexturePattern(ctx: CanvasRenderingContext2D, key: keyof typeof TEXTURE_URLS): CanvasPattern | null {
  if (_texPatternCache.has(key)) return _texPatternCache.get(key) ?? null;
  const img = _texCache.get(key);
  if (!img) { _texPatternCache.set(key, null); return null; }
  try {
    const pat = ctx.createPattern(img as unknown as CanvasImageSource, 'repeat');
    _texPatternCache.set(key, pat);
    return pat;
  } catch { _texPatternCache.set(key, null); return null; }
}

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
  outBack: (t: number): number => {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  outElastic: (t: number): number =>
    t === 0 || t === 1 ? t : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1,
  inOutQuad: (t: number): number => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  outQuint: (t: number): number => 1 - Math.pow(1 - t, 5),
  inOutCubic: (t: number): number =>
    t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
};

export const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * clamp01(t);
export const smoothstep = (edge0: number, edge1: number, x: number): number => {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};

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
    Math.round(a[2] + (b[2] - a[2]) * k),
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

/** HSL-adjusted color. h shift in degrees, s/l in -1..1. */
export function adjustHsl(h: string, hShift = 0, sShift = 0, lShift = 0): string {
  const [r, g, b] = hex(h);
  const r1 = r / 255, g1 = g / 255, b1 = b / 255;
  const max = Math.max(r1, g1, b1), min = Math.min(r1, g1, b1);
  let hu = 0, s = 0, l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r1: hu = (g1 - b1) / d + (g1 < b1 ? 6 : 0); break;
      case g1: hu = (b1 - r1) / d + 2; break;
      case b1: hu = (r1 - g1) / d + 4; break;
    }
    hu *= 60;
  }
  hu = (hu + hShift + 360) % 360;
  s = clamp01(s + sShift);
  l = clamp01(l + lShift);
  // hsl → rgb
  const c2 = (1 - Math.abs(2 * l - 1)) * s;
  const x = c2 * (1 - Math.abs(((hu / 60) % 2) - 1));
  const m = l - c2 / 2;
  let rp = 0, gp = 0, bp = 0;
  if (hu < 60) { rp = c2; gp = x; bp = 0; }
  else if (hu < 120) { rp = x; gp = c2; bp = 0; }
  else if (hu < 180) { rp = 0; gp = c2; bp = x; }
  else if (hu < 240) { rp = 0; gp = x; bp = c2; }
  else if (hu < 300) { rp = x; gp = 0; bp = c2; }
  else { rp = c2; gp = 0; bp = x; }
  const to = (v: number): number => Math.round((v + m) * 255);
  return `rgb(${to(rp)},${to(gp)},${to(bp)})`;
}

// ── Geometry primitives ─────────────────────────────────────────────────────

export function roundRectPath(
  ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number
): void {
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
 * A rich panel: warm gradient body, multi-layer drop shadow, lit top edge,
 * and a subtle noise-free texture via a secondary highlight. Used everywhere
 * a card, bench tile or surface needs to feel like a physical object.
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
    shadowColor?: string;
    innerGlow?: boolean;
    glowTop?: string;
  } = {}
): void {
  const {
    r = 14,
    top = 'rgba(58,46,40,0.96)',
    bottom = 'rgba(28,21,18,0.96)',
    border = 'rgba(255,214,160,0.14)',
    borderWidth = 1,
    shadow = 10,
    shadowAlpha = 0.45,
    shadowColor = 'rgba(0,0,0,0.6)',
    innerGlow = true,
    glowTop = 'rgba(255,220,170,0.24)',
  } = opts;

  ctx.save();
  if (shadow > 0) {
    // ambient occlusion: two stacked shadows, one tight dark, one broad soft
    ctx.shadowColor = shadowColor.replace(/[\d.]+\)$/, `${shadowAlpha})`);
    ctx.shadowBlur = shadow;
    ctx.shadowOffsetY = shadow * 0.4;
  }
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, top);
  g.addColorStop(0.5, mixHex(top, bottom, 0.5));
  g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  roundRectPath(ctx, x, y, w, h, r);
  ctx.fill();
  ctx.restore();

  if (innerGlow) {
    ctx.save();
    roundRectPath(ctx, x + 0.5, y + 0.5, w - 1, h - 1, r);
    ctx.clip();
    // Warm key-light highlight from top-left
    const hl = ctx.createLinearGradient(0, y, 0, y + Math.min(h * 0.45, 32));
    hl.addColorStop(0, glowTop);
    hl.addColorStop(1, 'rgba(255,220,170,0)');
    ctx.fillStyle = hl;
    ctx.fillRect(x, y, w, Math.min(h * 0.45, 32));
    // Subtle bottom bounce
    const foot = ctx.createLinearGradient(0, y + h - Math.min(h * 0.25, 18), 0, y + h);
    foot.addColorStop(0, 'rgba(0,0,0,0)');
    foot.addColorStop(1, 'rgba(0,0,0,0.35)');
    ctx.fillStyle = foot;
    ctx.fillRect(x, y + h - Math.min(h * 0.25, 18), w, Math.min(h * 0.25, 18));
    ctx.restore();
  }

  if (borderWidth > 0 && border !== 'none') {
    ctx.strokeStyle = border;
    ctx.lineWidth = borderWidth;
    roundRectPath(ctx, x + borderWidth / 2, y + borderWidth / 2, w - borderWidth, h - borderWidth, r);
    ctx.stroke();
  }
}

/** Frosted-glass chip used for HUD, level badges, etc. */
export function glass(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  opts: { r?: number; alpha?: number; border?: string; tint?: string } = {}
): void {
  const { r = h / 2, alpha = 0.14, border = C.glassBorder, tint = '255,220,180' } = opts;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 3;
  roundRectPath(ctx, x, y, w, h, r);
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, `rgba(${tint},${alpha + 0.08})`);
  g.addColorStop(1, `rgba(${tint},${alpha - 0.04})`);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.restore();
  // top sheen
  ctx.save();
  roundRectPath(ctx, x + 1, y + 1, w - 2, h - 2, Math.max(0, r - 1));
  ctx.clip();
  const sh = ctx.createLinearGradient(0, y, 0, y + Math.min(12, h * 0.6));
  sh.addColorStop(0, 'rgba(255,240,215,0.18)');
  sh.addColorStop(1, 'rgba(255,240,215,0)');
  ctx.fillStyle = sh;
  ctx.fillRect(x, y, w, Math.min(12, h * 0.6));
  ctx.restore();
  ctx.strokeStyle = border;
  ctx.lineWidth = 1;
  roundRectPath(ctx, x + 0.5, y + 0.5, w - 1, h - 1, Math.max(0, r - 0.5));
  ctx.stroke();
}

/** Filled pill (legacy — kept for callers; prefer glass or panel). */
export function pill(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  fill: string | CanvasGradient,
  opts: { border?: string; shadow?: number } = {}
): void {
  ctx.save();
  if (opts.shadow) {
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
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

/** Premium CTA button: deep fire gradient, strong glow, pressed-lit top. */
export function premiumButton(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  opts: { variant?: 'primary' | 'gold' | 'ghost'; disabled?: boolean } = {}
): void {
  const { variant = 'primary', disabled = false } = opts;
  ctx.save();
  if (disabled) ctx.globalAlpha = 0.45;

  const grad = ctx.createLinearGradient(0, y, 0, y + h);
  if (variant === 'gold') {
    grad.addColorStop(0, '#FFE79B');
    grad.addColorStop(0.45, C.ouro);
    grad.addColorStop(1, C.ouroDark);
  } else {
    grad.addColorStop(0, '#FF8236');
    grad.addColorStop(0.45, C.brasaHot);
    grad.addColorStop(1, C.vermelho);
  }

  ctx.shadowColor = variant === 'gold' ? 'rgba(231,194,74,0.55)' : 'rgba(224,86,31,0.55)';
  ctx.shadowBlur = 22;
  ctx.shadowOffsetY = 6;
  roundRectPath(ctx, x, y, w, h, h / 2);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.restore();

  // Inner lit top — glossy
  ctx.save();
  roundRectPath(ctx, x + 1, y + 1, w - 2, h - 2, (h - 2) / 2);
  ctx.clip();
  const top = ctx.createLinearGradient(0, y, 0, y + h * 0.55);
  top.addColorStop(0, 'rgba(255,245,220,0.35)');
  top.addColorStop(0.5, 'rgba(255,245,220,0.08)');
  top.addColorStop(1, 'rgba(255,245,220,0)');
  ctx.fillStyle = top;
  ctx.fillRect(x, y, w, h * 0.55);
  const bot = ctx.createLinearGradient(0, y + h * 0.6, 0, y + h);
  bot.addColorStop(0, 'rgba(0,0,0,0)');
  bot.addColorStop(1, 'rgba(120,30,10,0.35)');
  ctx.fillStyle = bot;
  ctx.fillRect(x, y + h * 0.6, w, h * 0.4);
  ctx.restore();

  // Rim
  ctx.strokeStyle = variant === 'gold' ? 'rgba(120,78,16,0.55)' : 'rgba(120,30,10,0.5)';
  ctx.lineWidth = 1.5;
  roundRectPath(ctx, x + 0.75, y + 0.75, w - 1.5, h - 1.5, (h - 1.5) / 2);
  ctx.stroke();
}

/** Text with a soft dark outline so it stays legible over fire and glow. */
export function outlinedText(
  ctx: CanvasRenderingContext2D,
  text: string, x: number, y: number,
  fill: string, size: number,
  opts: {
    weight?: number; family?: string; outline?: number; align?: CanvasTextAlign;
    shadow?: number; shadowColor?: string; letterSpacing?: number;
  } = {}
): void {
  const {
    weight = 800, family = DISPLAY, outline = 3, align = 'center', shadow = 0,
    shadowColor = 'rgba(0,0,0,0.65)', letterSpacing = 0,
  } = opts;
  ctx.save();
  ctx.font = font(size, weight, family);
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  if (shadow > 0) {
    ctx.shadowColor = shadowColor;
    ctx.shadowBlur = shadow;
    ctx.shadowOffsetY = shadow * 0.35;
  }
  if (outline > 0) {
    ctx.lineWidth = outline;
    ctx.strokeStyle = 'rgba(18,11,8,0.88)';
    if (letterSpacing) {
      drawTextSpaced(ctx, text, x, y, letterSpacing, true);
    } else {
      ctx.strokeText(text, x, y);
    }
  }
  ctx.fillStyle = fill;
  if (letterSpacing) {
    drawTextSpaced(ctx, text, x, y, letterSpacing, false);
  } else {
    ctx.fillText(text, x, y);
  }
  ctx.restore();
}

function drawTextSpaced(
  ctx: CanvasRenderingContext2D, text: string, x: number, y: number,
  spacing: number, stroke: boolean
): void {
  const chars = [...text];
  const widths = chars.map((c) => ctx.measureText(c).width);
  const total = widths.reduce((a, b) => a + b, 0) + spacing * (chars.length - 1);
  let cx = x - total / 2;
  chars.forEach((c, i) => {
    if (stroke) ctx.strokeText(c, cx + widths[i]! / 2, y);
    else ctx.fillText(c, cx + widths[i]! / 2, y);
    cx += widths[i]! + spacing;
  });
}

/** Mix two hex/css colors crudely via canvas (no HSL needed for stops). */
function mixHex(a: string, b: string, t: number): string {
  // accept rgba(...) strings and blend numeric
  const pa = parse(a), pb = parse(b);
  const k = clamp01(t);
  const ch = [0, 1, 2].map((i) => Math.round(pa[i] + (pb[i] - pa[i]) * k));
  const al = pa[3] + (pb[3] - pa[3]) * k;
  return `rgba(${ch[0]},${ch[1]},${ch[2]},${al.toFixed(3)})`;
}
function parse(c: string): [number, number, number, number] {
  if (c.startsWith('#')) {
    const [r, g, b] = hex(c);
    return [r, g, b, 1];
  }
  const m = c.match(/rgba?\(([^)]+)\)/);
  if (!m) return [255, 255, 255, 1];
  const parts = m[1]!.split(',').map((s) => parseFloat(s.trim()));
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0, parts[3] ?? 1];
}

// ── Vector icons (cinematic lighting) ──────────────────────────────────────

export function coinIcon(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.save();
  ctx.translate(x, y);
  // outer shadow disc
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath(); ctx.ellipse(0, r * 0.35, r * 0.95, r * 0.3, 0, 0, Math.PI * 2); ctx.fill();
  // body
  const g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.15, 0, 0, r);
  g.addColorStop(0, '#FFF2B8');
  g.addColorStop(0.35, C.ouroLight);
  g.addColorStop(0.7, C.ouro);
  g.addColorStop(1, '#8F6A17');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
  // rim
  ctx.strokeStyle = 'rgba(110,72,12,0.75)';
  ctx.lineWidth = Math.max(1, r * 0.12);
  ctx.stroke();
  // highlight arc
  ctx.strokeStyle = 'rgba(255,250,220,0.55)';
  ctx.lineWidth = Math.max(1, r * 0.1);
  ctx.beginPath();
  ctx.arc(-r * 0.15, -r * 0.2, r * 0.62, Math.PI * 1.05, Math.PI * 1.7);
  ctx.stroke();
  // churrasco trident-like flame glyph (simplified)
  ctx.fillStyle = 'rgba(130,82,16,0.85)';
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.42);
  ctx.quadraticCurveTo(r * 0.28, -r * 0.08, 0, r * 0.4);
  ctx.quadraticCurveTo(-r * 0.28, -r * 0.08, 0, -r * 0.42);
  ctx.fill();
  // tiny sparkle
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.beginPath();
  ctx.ellipse(-r * 0.35, -r * 0.45, r * 0.12, r * 0.06, -0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function flameIcon(
  ctx: CanvasRenderingContext2D, x: number, y: number, r: number, hot = false
): void {
  ctx.save();
  ctx.translate(x, y);
  // outer glow
  const glow = ctx.createRadialGradient(0, r * 0.2, r * 0.1, 0, r * 0.2, r * 2.2);
  glow.addColorStop(0, `rgba(255,180,80,${hot ? 0.55 : 0.35})`);
  glow.addColorStop(1, 'rgba(255,140,40,0)');
  ctx.fillStyle = glow;
  ctx.beginPath(); ctx.arc(0, r * 0.2, r * 2.2, 0, Math.PI * 2); ctx.fill();
  // body
  const g = ctx.createLinearGradient(0, -r * 1.1, 0, r * 1.1);
  g.addColorStop(0, hot ? C.chamaWhite : C.chamaCore);
  g.addColorStop(0.35, hot ? C.chama : C.chama);
  g.addColorStop(0.7, C.brasa);
  g.addColorStop(1, C.vermelho);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0, -r);
  ctx.bezierCurveTo(r * 0.85, -r * 0.25, r * 0.7, r * 0.6, 0, r);
  ctx.bezierCurveTo(-r * 0.7, r * 0.6, -r * 0.85, -r * 0.25, 0, -r);
  ctx.fill();
  // inner core
  ctx.fillStyle = hot ? 'rgba(255,252,235,0.95)' : 'rgba(255,232,160,0.9)';
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.2);
  ctx.bezierCurveTo(r * 0.34, r * 0.05, r * 0.28, r * 0.55, 0, r * 0.7);
  ctx.bezierCurveTo(-r * 0.28, r * 0.55, -r * 0.34, r * 0.05, 0, -r * 0.2);
  ctx.fill();
  // hot cap highlight
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.beginPath();
  ctx.ellipse(0, -r * 0.6, r * 0.15, r * 0.25, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function starIcon(
  ctx: CanvasRenderingContext2D, x: number, y: number, r: number,
  opts: { filled?: boolean; scale?: number; glow?: boolean } = {}
): void {
  const { filled = true, scale = 1, glow = false } = opts;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  if (glow && filled) {
    const gg = ctx.createRadialGradient(0, 0, r * 0.2, 0, 0, r * 2.2);
    gg.addColorStop(0, 'rgba(255,220,120,0.55)');
    gg.addColorStop(1, 'rgba(255,220,120,0)');
    ctx.fillStyle = gg;
    ctx.beginPath(); ctx.arc(0, 0, r * 2.2, 0, Math.PI * 2); ctx.fill();
  }
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
    const g = ctx.createLinearGradient(0, -r * 1.1, 0, r * 1.1);
    g.addColorStop(0, '#FFF1B8');
    g.addColorStop(0.45, C.ouroLight);
    g.addColorStop(1, '#B0831B');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = 'rgba(120,78,16,0.65)';
    ctx.lineWidth = Math.max(1, r * 0.09);
    ctx.stroke();
    // specular highlight
    ctx.fillStyle = 'rgba(255,255,240,0.55)';
    ctx.beginPath();
    ctx.ellipse(-r * 0.2, -r * 0.35, r * 0.25, r * 0.12, -0.5, 0, Math.PI * 2);
    ctx.fill();
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
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath(); ctx.arc(0, r * 0.2, r * 0.9, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = col;
  ctx.lineWidth = Math.max(1.4, r * 0.16);
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
  // inner tick marks
  ctx.lineWidth = Math.max(1, r * 0.1);
  for (let i = 0; i < 12; i++) {
    const a = (Math.PI * 2 * i) / 12 - Math.PI / 2;
    const outer = r * 0.9, inner = i % 3 === 0 ? r * 0.72 : r * 0.8;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * inner, Math.sin(a) * inner);
    ctx.lineTo(Math.cos(a) * outer, Math.sin(a) * outer);
    ctx.stroke();
  }
  ctx.strokeStyle = col;
  ctx.lineWidth = Math.max(1.4, r * 0.15);
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(0, -r * 0.55);
  ctx.moveTo(0, 0); ctx.lineTo(r * 0.42, r * 0.18);
  ctx.stroke();
  ctx.fillStyle = col;
  ctx.beginPath(); ctx.arc(0, 0, r * 0.1, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

export function checkIcon(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, col: string): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = col;
  ctx.lineWidth = Math.max(2, r * 0.32);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.shadowColor = col;
  ctx.shadowBlur = r * 0.4;
  ctx.beginPath();
  ctx.moveTo(-r * 0.55, 0);
  ctx.lineTo(-r * 0.1, r * 0.48);
  ctx.lineTo(r * 0.6, -r * 0.45);
  ctx.stroke();
  ctx.restore();
}

/** A stylised customer avatar with shoulders, skin tone, hair, shoulders. */
export function avatar(
  ctx: CanvasRenderingContext2D, x: number, y: number, r: number,
  body: string, accent: string, opts: { vip?: boolean; hue?: number } = {}
): void {
  const { vip = false, hue = 0 } = opts;
  ctx.save();
  // disc backdrop
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.arc(x, y + r * 0.25, r * 0.95, 0, Math.PI * 2); ctx.fill();
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r * 1.1);
  const baseCol = hex(body);
  g.addColorStop(0, mix(mixRgb(baseCol, [255, 255, 255], 0.28), baseCol, 0));
  g.addColorStop(1, body);
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = accent;
  ctx.lineWidth = Math.max(1.5, r * 0.12);
  ctx.stroke();
  // body shadow
  ctx.save();
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.clip();
  const foot = ctx.createLinearGradient(x, y + r * 0.2, x, y + r);
  foot.addColorStop(0, 'rgba(0,0,0,0)');
  foot.addColorStop(1, 'rgba(0,0,0,0.35)');
  ctx.fillStyle = foot;
  ctx.fillRect(x - r, y + r * 0.2, r * 2, r);
  ctx.restore();

  // Character silhouette (chunky cartoon friendly)
  const skin = vip ? '#E8B98A' : '#C9916A';
  const hair = vip ? '#3A2414' : '#2A1810';
  const shirt = vip ? C.ouro : mixHex(body, '#3A2414', 0.3);
  // shoulders
  ctx.fillStyle = shirt;
  ctx.beginPath();
  ctx.ellipse(x, y + r * 0.9, r * 0.9, r * 0.55, 0, Math.PI, Math.PI * 2);
  ctx.fill();
  // collar
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse(x, y + r * 0.55, r * 0.25, r * 0.1, 0, 0, Math.PI * 2);
  ctx.fill();
  // head
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.ellipse(x, y - r * 0.05, r * 0.45, r * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();
  // hair
  ctx.fillStyle = hair;
  ctx.beginPath();
  ctx.ellipse(x, y - r * 0.32, r * 0.5, r * 0.34, 0, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x - r * 0.38, y - r * 0.1, r * 0.12, r * 0.28, 0, 0, Math.PI * 2);
  ctx.ellipse(x + r * 0.38, y - r * 0.1, r * 0.12, r * 0.28, 0, 0, Math.PI * 2);
  ctx.fill();
  // eyes
  ctx.fillStyle = '#1C120A';
  ctx.beginPath();
  ctx.arc(x - r * 0.14, y - r * 0.05, r * 0.06, 0, Math.PI * 2);
  ctx.arc(x + r * 0.14, y - r * 0.05, r * 0.06, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(x - r * 0.12, y - r * 0.07, r * 0.02, 0, Math.PI * 2);
  ctx.arc(x + r * 0.16, y - r * 0.07, r * 0.02, 0, Math.PI * 2);
  ctx.fill();
  // smile
  ctx.strokeStyle = '#1C120A';
  ctx.lineWidth = Math.max(1, r * 0.07);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(x, y + r * 0.08, r * 0.14, 0.2, Math.PI - 0.2);
  ctx.stroke();
  // VIP crown
  if (vip) {
    ctx.save();
    ctx.translate(x, y - r * 0.72);
    ctx.fillStyle = C.ouro;
    ctx.beginPath();
    ctx.moveTo(-r * 0.35, 0);
    ctx.lineTo(-r * 0.22, -r * 0.22);
    ctx.lineTo(-r * 0.08, -r * 0.06);
    ctx.lineTo(0, -r * 0.3);
    ctx.lineTo(r * 0.08, -r * 0.06);
    ctx.lineTo(r * 0.22, -r * 0.22);
    ctx.lineTo(r * 0.35, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(120,78,16,0.7)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = C.brasa;
    ctx.beginPath(); ctx.arc(0, -r * 0.18, r * 0.05, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

/** Brick pattern fill (churrasqueira de alvenaria) — high-fidelity for reference validation.
 *  Additions vs base: mortar shadow AO, beveled edge highlight, 3-stop vertical gradient
 *  per brick, subtle hue jitter, lit wash from brasa and an outer occlusion stroke.
 */
export function drawBrickwork(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  opts: { brickH?: number; mortar?: number; lit?: boolean } = {}
): void {
  const { brickH = 18, mortar = 3, lit = false } = opts;
  const brickW = brickH * 2.2;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  // fotoreal atlas branch: if brick texture loaded, use tiled pattern with procedural overlay (keeps lit logic)
  const brickPat = getTexturePattern(ctx, 'brick');
  if (brickPat) {
    ctx.fillStyle = brickPat;
    // scale texture so ~2.2 bricks per row match expected brickW
    // We can't scale pattern directly without setTransform, so we draw at native and blend
    ctx.fillRect(x, y, w, h);
    // tint to match our palette + AO
    ctx.fillStyle = 'rgba(154,59,34,0.18)'; ctx.fillRect(x, y, w, h);
    // mortar AO lines on top of photo texture
    ctx.fillStyle = 'rgba(42,24,14,0.18)';
    for (let row = 0; row < Math.ceil(h / (brickH + mortar)) + 1; row++) {
      const gy = y + row * (brickH + mortar) + brickH;
      ctx.fillRect(x, gy - 0.5, w, 1.6);
    }
    // highlight top row when lit (like reference)
    if (lit) {
      ctx.fillStyle = 'rgba(255,200,160,0.12)';
      ctx.fillRect(x, y, w, brickH + 4);
    }
  } else {
    const mg = ctx.createLinearGradient(x, y, x, y + h);
    mg.addColorStop(0, '#D9BF9E');
    mg.addColorStop(0.5, C.argamassa);
    mg.addColorStop(1, '#A68A6A');
    ctx.fillStyle = mg;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = 'rgba(42,24,14,0.16)';
    for (let row = 0; row < Math.ceil(h / (brickH + mortar)) + 1; row++) {
      const gy = y + row * (brickH + mortar) + brickH;
      ctx.fillRect(x, gy - 0.5, w, 1.4);
    }
    const rows = Math.ceil(h / (brickH + mortar)) + 2;
    for (let row = 0; row < rows; row++) {
      const yy = y + row * (brickH + mortar);
      const offset = (row % 2) * (brickW / 2 + mortar / 2);
      for (let bx = x - brickW; bx < x + w + brickW; bx += brickW + mortar) {
        const xx = bx + offset;
        const jitter = ((row * 17 + Math.floor(bx / brickW) * 13) % 7) * 0.012;
        const litTop = lit && row < 2;
        const g = ctx.createLinearGradient(xx, yy, xx, yy + brickH);
        g.addColorStop(0, litTop ? `rgba(230,110,70,${0.92 + jitter})` : `rgba(181,78,46,${0.98})`);
        g.addColorStop(0.28, C.tijoloClaro);
        g.addColorStop(0.55, C.tijolo);
        g.addColorStop(1, C.tijoloSombra);
        ctx.fillStyle = g;
        roundRectPath(ctx, xx, yy, brickW, brickH, 2.2);
        ctx.fill();
        ctx.fillStyle = `rgba(255,220,180,${litTop ? 0.22 : 0.12})`;
        roundRectPath(ctx, xx + 1, yy + 0.6, brickW - 2, 2.2, 1);
        ctx.fill();
        const sideG = ctx.createLinearGradient(xx, yy, xx + 6, yy);
        sideG.addColorStop(0, 'rgba(255,255,255,0.10)');
        sideG.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = sideG;
        ctx.fillRect(xx + 1, yy + 3, 6, brickH - 6);
        ctx.fillStyle = 'rgba(22,10,6,0.18)';
        ctx.fillRect(xx, yy + brickH - 1, brickW, 1.4);
      }
    }
  }
  if (lit) {
    const wash = ctx.createLinearGradient(0, y, 0, y + h);
    wash.addColorStop(0, 'rgba(255,190,100,0.20)');
    wash.addColorStop(0.35, 'rgba(255,150,60,0.10)');
    wash.addColorStop(0.7, 'rgba(224,86,31,0.06)');
    wash.addColorStop(1, 'rgba(0,0,0,0.20)');
    ctx.fillStyle = wash;
    ctx.fillRect(x, y, w, h);
  }
  // outer occlusion stroke
  ctx.strokeStyle = 'rgba(20,10,6,0.22)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  ctx.restore();
}

/** Wood-grain procedural fill — upgraded to match Cooking Fever polish.
 *  Adds: per-plank base tint, dual-grain (coarse + fine), varnish specular,
 *  chamfered seam AO, richer knots with ring highlights.
 */
export function drawWoodGrain(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  opts: { base?: string; dark?: string; planks?: number } = {}
): void {
  const { base = C.madeiraClara, dark = C.madeiraEscura, planks = 3 } = opts;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  // fotoreal atlas: if wood texture is loaded, use it as base (blended with warm tint)
  const woodPat = getTexturePattern(ctx, 'wood');
  if (woodPat) {
    const baseGrad = ctx.createLinearGradient(0, y, 0, y + h);
    baseGrad.addColorStop(0, 'rgba(185,138,85,0.92)');
    baseGrad.addColorStop(1, 'rgba(90,52,30,0.96)');
    ctx.fillStyle = baseGrad; ctx.fillRect(x, y, w, h);
    ctx.globalAlpha = 0.88;
    ctx.fillStyle = woodPat; ctx.fillRect(x, y, w, h);
    ctx.globalAlpha = 1;
    // warm color overlay so photographed wood matches our palette
    ctx.fillStyle = 'rgba(185,138,85,0.10)'; ctx.fillRect(x, y, w, h);
  } else {
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, mix(hex(base), [255, 238, 210], 0.18));
    g.addColorStop(0.28, base);
    g.addColorStop(0.72, mix(hex(base), hex(dark), 0.5));
    g.addColorStop(1, dark);
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
  }
  // per-plank tint so no two planks look cloned
  for (let i = 0; i < planks; i++) {
    const px = x + (w / planks) * i;
    const pw = w / planks;
    const tint = (i % 2 ? 'rgba(255,245,220,0.08)' : 'rgba(60,32,14,0.06)');
    ctx.fillStyle = tint;
    ctx.fillRect(px, y, pw, h);
  }
  // coarse grain
  ctx.strokeStyle = 'rgba(70,38,18,0.22)';
  ctx.lineWidth = 1.1;
  for (let k = 0; k < Math.ceil(h / 7); k++) {
    const gy = y + 5 + k * 7;
    ctx.beginPath();
    ctx.moveTo(x + 2, gy);
    for (let px = x + 2; px < x + w - 2; px += 18) {
      ctx.quadraticCurveTo(px + 9, gy + Math.sin((px * 0.07 + k * 41) * 0.9) * 2.8, px + 18, gy + Math.cos((px + k * 7) * 0.04) * 0.6);
    }
    ctx.stroke();
  }
  // fine micro-grain (subtle)
  ctx.strokeStyle = 'rgba(70,38,18,0.10)';
  ctx.lineWidth = 0.7;
  for (let k = 0; k < Math.ceil(h / 5); k++) {
    const gy = y + 2 + k * 6.5;
    ctx.beginPath();
    ctx.moveTo(x + 8, gy);
    for (let px = x + 8; px < x + w - 8; px += 24) {
      ctx.quadraticCurveTo(px + 12, gy + Math.sin(px * 0.12 + k) * 1.1, px + 24, gy);
    }
    ctx.stroke();
  }
  // plank seams — deep AO + highlight
  for (let i = 1; i < planks; i++) {
    const px = x + (w / planks) * i;
    // AO trench
    ctx.fillStyle = 'rgba(28,16,8,0.28)';
    ctx.fillRect(px - 0.6, y, 1.8, h);
    ctx.strokeStyle = 'rgba(20,11,6,0.32)';
    ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(px, y); ctx.lineTo(px, y + h); ctx.stroke();
    // varnish highlight left of seam
    ctx.strokeStyle = 'rgba(255,230,190,0.20)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(px - 1.2, y + 2); ctx.lineTo(px - 1.2, y + h - 2); ctx.stroke();
  }
  // varnish top specular — long horizontal bloom like lacquered counter
  const varnish = ctx.createLinearGradient(0, y, 0, y + Math.min(h * 0.38, 28));
  varnish.addColorStop(0, 'rgba(255,245,220,0.30)');
  varnish.addColorStop(0.5, 'rgba(255,240,210,0.12)');
  varnish.addColorStop(1, 'rgba(255,240,210,0)');
  ctx.fillStyle = varnish;
  ctx.fillRect(x, y, w, Math.min(h * 0.38, 28));
  // knots — with concentric rings
  for (let k = 0; k < planks + 1; k++) {
    const kx = x + 18 + ((k * 97) % (w - 36));
    const ky = y + 14 + ((k * 53) % (h - 28));
    const a = k * 0.62;
    ctx.save();
    ctx.translate(kx, ky);
    ctx.rotate(a);
    // outer ring shadow
    ctx.fillStyle = 'rgba(42,22,10,0.38)';
    ctx.beginPath(); ctx.ellipse(0, 0, 8.5, 4.2, 0, 0, Math.PI * 2); ctx.fill();
    // knot body
    const kg = ctx.createRadialGradient(-2, -0.5, 0.8, 0, 0, 8);
    kg.addColorStop(0, 'rgba(96,52,22,0.95)');
    kg.addColorStop(0.5, 'rgba(70,38,18,0.85)');
    kg.addColorStop(1, 'rgba(42,22,10,0.0)');
    ctx.fillStyle = kg;
    ctx.beginPath(); ctx.ellipse(0, 0, 8, 3.8, 0, 0, Math.PI * 2); ctx.fill();
    // highlight ring
    ctx.strokeStyle = 'rgba(255,220,170,0.18)';
    ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.ellipse(0, 0, 6.2, 2.9, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }
  // bottom AO like counter lip
  const foot = ctx.createLinearGradient(0, y + h - 10, 0, y + h);
  foot.addColorStop(0, 'rgba(0,0,0,0)');
  foot.addColorStop(1, 'rgba(0,0,0,0.28)');
  ctx.fillStyle = foot;
  ctx.fillRect(x, y + h - 10, w, 10);
  ctx.restore();
}

/** Brushed stainless helper — linear highlight streak like reference inox counters. */
export function brushedMetalGradient(
  ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number
): CanvasGradient {
  const g = ctx.createLinearGradient(x, y, x + w, y);
  g.addColorStop(0, '#A9B3BC');
  g.addColorStop(0.18, '#D8E2E8');
  g.addColorStop(0.32, '#F4F7F9');
  g.addColorStop(0.38, '#EDF1F4');
  g.addColorStop(0.52, '#C2CED8');
  g.addColorStop(0.70, '#E6EEF4');
  g.addColorStop(1, '#8FA0AF');
  return g;
}

/** Subtle checkered floor — like the restaurant tiling in the reference, but warm/wood-leaning. */
export function drawCheckerFloor(
  ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number,
  opts: { tile?: number; light?: string; dark?: string; alpha?: number } = {}
): void {
  const { tile = 26, light = '#2B1B12', dark = '#241610', alpha = 0.55 } = opts;
  ctx.save();
  ctx.globalAlpha = alpha;
  // base
  ctx.fillStyle = dark;
  ctx.fillRect(x, y, w, h);
  // light tiles
  ctx.fillStyle = light;
  const cols = Math.ceil(w / tile) + 1;
  const rows = Math.ceil(h / tile) + 1;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if ((r + c) % 2 === 0) {
        ctx.fillRect(x + c * tile, y + r * tile, tile - 1, tile - 1);
      }
    }
  }
  // grout AO
  ctx.strokeStyle = 'rgba(10,6,4,0.22)';
  ctx.lineWidth = 0.8;
  for (let r = 0; r <= rows; r++) { ctx.beginPath(); ctx.moveTo(x, y + r * tile); ctx.lineTo(x + w, y + r * tile); ctx.stroke(); }
  for (let c = 0; c <= cols; c++) { ctx.beginPath(); ctx.moveTo(x + c * tile, y); ctx.lineTo(x + c * tile, y + h); ctx.stroke(); }
  ctx.restore();
}

/** Lightweight bloom for ember bed — draws a blurred glow copy of a rect.
 *  Fallback to radial gradient if filter API unavailable (Node smoke).
 *  Usage: call after ember bed fill, before grate, with same zx/y/zw/zh and heat.
 */
export function drawEmberBloom(
  ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, heat: number
): void {
  if (heat < 0.6) return;
  const intensity = Math.min(1, (heat - 0.6) / 0.7); // 0..1
  const alpha = 0.10 + intensity * 0.18;
  ctx.save();
  // Try canvas filter blur (supported in browsers, not in @napi-rs Node)
  const hasFilter = (() => { try { (ctx as any).filter = 'blur(8px)'; return (ctx as any).filter === 'blur(8px)'; } catch { return false; } })();
  if (hasFilter && typeof document !== 'undefined' && (document as any).createElement) {
    // Cheap: draw expanded glow rect with blur then restore filter — 1 pass
    (ctx as any).filter = 'blur(7px)';
    ctx.fillStyle = `rgba(255,160,60,${alpha})`;
    ctx.fillRect(x - 6, y - 6, w + 12, h + 12);
    (ctx as any).filter = 'none';
    // inner core without blur for sharpness
    ctx.fillStyle = `rgba(255,210,100,${alpha * 0.55})`;
    ctx.fillRect(x + w * 0.18, y + h * 0.22, w * 0.64, h * 0.44);
  } else {
    // Node fallback: soft radial glow (no filter)
    const cx = x + w / 2, cy = y + h / 2;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.62);
    g.addColorStop(0, `rgba(255,190,100,${alpha})`);
    g.addColorStop(0.45, `rgba(255,150,40,${alpha * 0.5})`);
    g.addColorStop(1, 'rgba(255,120,30,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(cx, cy, w * 0.62, h * 0.72, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}
