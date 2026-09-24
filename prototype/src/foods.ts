/**
 * Food rendering — one distinct vector silhouette per ingredient.
 *
 * Rule R2 (docs/04-ART_STYLE.md §2): every item must be identifiable as a solid
 * black shape at 64 px. Each ingredient gets its own outline, drawn from paths.
 *
 * Doneness is a material, not a shape: the silhouette never changes, only the
 * fill gradient, grill marks, caramelisation crust, marbling and sheen do.
 *
 * Studio-grade improvements over the prototype version:
 *   - richer body gradient with bounce light from the coals below
 *   - two-pass grill marks: dark char + warm ruby edge, so they read as seared
 *   - dynamic fat marbling that renders (lightens + goldens) with doneness
 *   - juice beads that appear and glisten on well-cooked meats
 *   - smoke opacity/density tied to doneness (main.ts samples this)
 *   - charred edges for burned state instead of a uniform dark overlay
 */
import type { Ingredient } from '../../tools/sim-core/src/types.ts';
import { C, clamp01, hex, mix, mixRgb, rgb, roundRectPath, shade, type RGB } from './theme.ts';

export interface FoodColors {
  base: RGB;
  dark: RGB;
  light: RGB;
  mark: RGB;
  crust: RGB;
}

/**
 * Maps overall doneness 0..1.5 onto the raw → cooked → burned ramp with a
 * more cinematic Maillard-transition curve.
 */
export function donenessColors(ing: Ingredient, d: number): FoodColors {
  const raw = hex(ing.art.rawColor);
  const cooked = hex(ing.art.cookedColor);
  const burn = hex(ing.art.burnColor);

  // Maillard browning peaks at ~0.85 doneness, then gives way to char.
  let base: RGB;
  if (d < 0.6) {
    // raw → maillard onset
    base = mixRgb(raw, cooked, smooth(d / 0.6));
  } else if (d < 0.95) {
    // cooked with golden-brown crust peak
    const golden = mixRgb(cooked, hex('#C9783A'), 0.35);
    base = mixRgb(cooked, golden, (d - 0.6) / 0.35);
  } else {
    // past perfect, sliding toward char
    base = mixRgb(
      mixRgb(cooked, hex('#B86A2E'), 0.2),
      burn,
      clamp01((d - 0.95) / 0.45)
    );
  }

  return {
    base,
    dark: mixRgb(base, [20, 10, 6], 0.45),
    light: mixRgb(
      base,
      d > 0.95 ? [220, 160, 90] : [255, 238, 205],
      d > 1.0 ? 0.12 : 0.32
    ),
    mark: mixRgb(base, [18, 9, 5], 0.82),
    crust: mixRgb(base, [60, 28, 14], 0.35),
  };
}

function smooth(t: number): number {
  const k = clamp01(t);
  return k * k * (3 - 2 * k);
}

type Ctx = CanvasRenderingContext2D;

/** Warm ember glow pooled under the item — intensifies with heat. */
function underGlow(ctx: Ctx, w: number, h: number, intensity: number, heat = 1): void {
  const outer = w * (1.1 + intensity * 0.4);
  const g = ctx.createRadialGradient(0, h * 0.2, 1, 0, h * 0.3, outer);
  const core = 0.30 + intensity * 0.38;
  const hot = heat > 0.8 ? 0.12 : 0;
  g.addColorStop(0, `rgba(255,180,90,${core})`);
  g.addColorStop(0.25, `rgba(242,120,40,${core * 0.6 + hot})`);
  g.addColorStop(0.6, `rgba(224,86,31,${0.10 + intensity * 0.14})`);
  g.addColorStop(1, 'rgba(224,86,31,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(0, h * 0.35, outer, outer * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();
}

/** Contact shadow makes food sit ON the grate. */
function contactShadow(ctx: Ctx, w: number, h: number): void {
  ctx.fillStyle = 'rgba(8,4,2,0.55)';
  ctx.beginPath();
  ctx.ellipse(0, h * 0.5, w * 0.52, h * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(0, h * 0.48, w * 0.38, h * 0.14, 0, 0, Math.PI * 2);
  ctx.fill();
}

/** Two-pass diagonal grill marks: dark char core with a warm ruby halo. */
function grillMarks(ctx: Ctx, w: number, h: number, c: FoodColors, d: number, count = 3): void {
  const t = clamp01((d - 0.15) / 0.6);
  if (t <= 0) return;
  ctx.save();
  roundRectPath(ctx, -w / 2, -h / 2, w, h, h * 0.42);
  ctx.clip();
  // warm halo first (wider, softer, red-brown)
  ctx.strokeStyle = rgb(mixRgb(c.base, [130, 38, 18], 0.55), 0.35 + t * 0.4);
  ctx.lineWidth = Math.max(3, h * 0.24);
  ctx.lineCap = 'round';
  const span = w + h;
  for (let i = 0; i < count; i++) {
    const off = -span / 2 + (span / (count + 1)) * (i + 1);
    ctx.beginPath();
    ctx.moveTo(off - h * 0.7, -h);
    ctx.lineTo(off + h * 0.7, h);
    ctx.stroke();
  }
  // dark char core
  ctx.strokeStyle = rgb(c.mark, 0.55 + t * 0.35);
  ctx.lineWidth = Math.max(1.6, h * 0.12);
  for (let i = 0; i < count; i++) {
    const off = -span / 2 + (span / (count + 1)) * (i + 1);
    ctx.beginPath();
    ctx.moveTo(off - h * 0.7, -h);
    ctx.lineTo(off + h * 0.7, h);
    ctx.stroke();
  }
  // tiny caramelised specks along marks
  ctx.fillStyle = 'rgba(180,110,40,0.4)';
  for (let i = 0; i < count * 3; i++) {
    const si = i % count;
    const local = i / count;
    const off = -span / 2 + (span / (count + 1)) * (si + 1);
    const yy = -h + ((h * 2) / (count * 2.5)) * local;
    const xx = off + (yy / h) * h * 0.7 - h * 0.05;
    ctx.beginPath();
    ctx.arc(xx, yy, 0.9 + (i % 3) * 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Multi-layer fat/meat sheen along the key light. */
function sheen(ctx: Ctx, w: number, h: number, strength: number, juicy = false): void {
  if (strength <= 0) return;
  ctx.save();
  roundRectPath(ctx, -w / 2, -h / 2, w, h, h * 0.42);
  ctx.clip();
  // broad highlight
  const g = ctx.createLinearGradient(-w * 0.45, -h * 0.55, w * 0.15, h * 0.4);
  g.addColorStop(0, `rgba(255,246,225,${0.42 * strength})`);
  g.addColorStop(0.35, `rgba(255,240,210,${0.16 * strength})`);
  g.addColorStop(0.7, `rgba(255,240,210,${0.05 * strength})`);
  g.addColorStop(1, 'rgba(255,240,210,0)');
  ctx.fillStyle = g;
  ctx.fillRect(-w / 2, -h / 2, w, h);
  // specular streak — the "wet" look
  if (juicy) {
    const streak = ctx.createLinearGradient(-w * 0.3, -h * 0.2, -w * 0.05, h * 0.05);
    streak.addColorStop(0, `rgba(255,255,245,${0.45 * strength})`);
    streak.addColorStop(1, 'rgba(255,255,245,0)');
    ctx.fillStyle = streak;
    ctx.beginPath();
    ctx.ellipse(-w * 0.18, -h * 0.1, w * 0.22, h * 0.08, -0.3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Bounce light from hot coals below — a warm red/orange fringe under the food. */
function bounceLight(ctx: Ctx, w: number, h: number, heat: number): void {
  if (heat <= 0) return;
  ctx.save();
  roundRectPath(ctx, -w / 2, -h / 2, w, h, h * 0.42);
  ctx.clip();
  const g = ctx.createLinearGradient(0, h * 0.2, 0, h * 0.55);
  g.addColorStop(0, 'rgba(224,86,31,0)');
  g.addColorStop(1, `rgba(224,86,31,${0.22 * heat})`);
  ctx.fillStyle = g;
  ctx.fillRect(-w / 2, h * 0.2, w, h * 0.4);
  ctx.restore();
}

/** Juice beads glistening on the surface — appear as doneness passes "cooked". */
function juiceBeads(ctx: Ctx, w: number, h: number, d: number, seed: number): void {
  const t = clamp01((d - 0.45) / 0.45);
  if (t <= 0) return;
  const n = Math.floor(2 + t * 4);
  for (let i = 0; i < n; i++) {
    const rx = ((Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453) % 1 + 1) % 1;
    const ry = ((Math.sin(seed * 43.231 + i * 17.132) * 43758.5453) % 1 + 1) % 1;
    const bx = -w * 0.3 + rx * w * 0.6;
    const by = -h * 0.2 + ry * h * 0.45;
    const rr = 0.9 + (i % 3) * 0.5;
    // droplet
    ctx.fillStyle = `rgba(255,235,200,${0.55 * t})`;
    ctx.beginPath();
    ctx.arc(bx, by, rr, 0, Math.PI * 2);
    ctx.fill();
    // highlight
    ctx.fillStyle = `rgba(255,255,255,${0.7 * t})`;
    ctx.beginPath();
    ctx.arc(bx - rr * 0.3, by - rr * 0.3, rr * 0.35, 0, Math.PI * 2);
    ctx.fill();
  }
}

function bodyGradient(ctx: Ctx, h: number, c: FoodColors): CanvasGradient {
  const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
  g.addColorStop(0, rgb(c.light));
  g.addColorStop(0.35, rgb(c.base));
  g.addColorStop(0.75, rgb(mixRgb(c.base, c.dark, 0.4)));
  g.addColorStop(1, rgb(c.dark));
  return g;
}

function strokeOutline(ctx: Ctx, c: FoodColors, w: number): void {
  ctx.strokeStyle = rgb(mixRgb(c.dark, [0, 0, 0], 0.35), 0.88);
  ctx.lineWidth = Math.max(1.2, w * 0.03);
  ctx.stroke();
}

// ── Individual silhouettes ──────────────────────────────────────────────────

/** Steaks: picanha, fraldinha, contra-filé, maminha — wedge with a fat cap. */
function drawSteak(ctx: Ctx, w: number, h: number, c: FoodColors, ing: Ingredient, d: number): void {
  // tiny grill-grate shadow stripes under the meat
  ctx.save();
  roundRectPath(ctx, -w * 0.5, -h * 0.3, w, h * 0.8, h * 0.3);
  ctx.clip();
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  for (let i = 0; i < 7; i++) {
    ctx.fillRect(-w / 2 + i * (w / 6) - 1, -h / 2, 2, h);
  }
  ctx.restore();

  ctx.beginPath();
  ctx.moveTo(-w * 0.46, -h * 0.30);
  ctx.bezierCurveTo(-w * 0.30, -h * 0.52, w * 0.22, -h * 0.54, w * 0.44, -h * 0.34);
  ctx.bezierCurveTo(w * 0.54, -h * 0.20, w * 0.50, h * 0.26, w * 0.30, h * 0.42);
  ctx.bezierCurveTo(w * 0.06, h * 0.56, -w * 0.28, h * 0.50, -w * 0.44, h * 0.28);
  ctx.bezierCurveTo(-w * 0.56, h * 0.08, -w * 0.55, -h * 0.14, -w * 0.46, -h * 0.30);
  ctx.closePath();
  ctx.fillStyle = bodyGradient(ctx, h, c);
  ctx.fill();
  bounceLight(ctx, w, h, clamp01(d * 1.2));
  strokeOutline(ctx, c, w);

  // muscle fibre texture (subtle)
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = rgb(mixRgb(c.base, c.dark, 0.2), 0.25);
  ctx.lineWidth = 0.6;
  for (let i = 0; i < 6; i++) {
    const yy = -h * 0.3 + i * h * 0.16;
    ctx.beginPath();
    ctx.moveTo(-w * 0.4, yy);
    ctx.bezierCurveTo(-w * 0.1, yy - 2, w * 0.15, yy + 2, w * 0.4, yy + 1);
    ctx.stroke();
  }
  ctx.restore();

  // Fat cap — renders from cream to gold as it cooks.
  if (ing.art.fatCap) {
    ctx.save();
    ctx.clip();
    const fatRaw = hex('#FFF0D2');
    const fatGold = hex('#E2AB4D');
    const fat = mixRgb(fatRaw, fatGold, clamp01(d / 0.95));
    const g = ctx.createLinearGradient(0, -h * 0.6, 0, -h * 0.1);
    g.addColorStop(0, rgb(mixRgb(fat, [255, 255, 255], 0.35)));
    g.addColorStop(0.6, rgb(fat));
    g.addColorStop(1, rgb(mixRgb(fat, c.base, 0.3)));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-w * 0.5, -h * 0.6);
    ctx.lineTo(w * 0.5, -h * 0.6);
    ctx.lineTo(w * 0.5, -h * 0.20);
    ctx.bezierCurveTo(w * 0.1, -h * 0.36, -w * 0.16, -h * 0.18, -w * 0.5, -h * 0.34);
    ctx.closePath();
    ctx.fill();
    // fat texture ripples
    ctx.strokeStyle = rgb(mixRgb(fat, [180, 120, 60], 0.3), 0.5);
    ctx.lineWidth = 0.7;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(-w * 0.4 + i * w * 0.25, -h * 0.55);
      ctx.bezierCurveTo(-w * 0.35 + i * w * 0.25, -h * 0.35, -w * 0.3 + i * w * 0.25, -h * 0.3, -w * 0.22 + i * w * 0.25, -h * 0.25);
      ctx.stroke();
    }
    ctx.restore();
  }

  grillMarks(ctx, w, h, c, d, 3);
  sheen(ctx, w, h, (ing.art.fatSheen ? 0.55 : 0.4) + d * 0.55, true);
  juiceBeads(ctx, w, h, d, 1.1);
}

/** Ribs: costela, cupim — block with two bone ends showing. */
function drawRib(ctx: Ctx, w: number, h: number, c: FoodColors, d: number): void {
  ctx.save();
  roundRectPath(ctx, -w / 2, -h / 2, w, h, h * 0.3);
  ctx.clip();
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  for (let i = 0; i < 6; i++) ctx.fillRect(-w / 2 + i * (w / 5) - 1, -h / 2, 2, h);
  ctx.restore();

  roundRectPath(ctx, -w / 2, -h / 2, w, h, h * 0.3);
  ctx.fillStyle = bodyGradient(ctx, h, c);
  ctx.fill();
  bounceLight(ctx, w, h, clamp01(d));
  strokeOutline(ctx, c, w);

  // bone ends with knuckles
  const bone = mixRgb(hex('#F5E9D3'), hex('#B98F56'), clamp01(d * 0.7));
  for (const sx of [-1, 1]) {
    // knuckle
    ctx.fillStyle = rgb(mixRgb(bone, [255, 255, 255], 0.2));
    ctx.beginPath();
    ctx.ellipse(sx * w * 0.48, -h * 0.05, w * 0.1, h * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = rgb(bone);
    ctx.beginPath();
    ctx.ellipse(sx * w * 0.44, -h * 0.14, w * 0.075, h * 0.13, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(120,92,54,0.55)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = 'rgba(160,120,70,0.35)';
    ctx.beginPath(); ctx.arc(sx * w * 0.48, -h * 0.05, w * 0.02, 0, Math.PI * 2); ctx.fill();
  }
  grillMarks(ctx, w, h, c, d, 2);
  sheen(ctx, w, h, 0.55 + d * 0.55, true);
  juiceBeads(ctx, w, h, d, 2.3);
}

/** Sausage: linguiça toscana — curved link with tied ends, casing splits as it cooks. */
function drawSausage(ctx: Ctx, w: number, h: number, c: FoodColors, d: number): void {
  ctx.beginPath();
  ctx.moveTo(-w * 0.44, -h * 0.06);
  ctx.bezierCurveTo(-w * 0.2, -h * 0.44, w * 0.2, h * 0.40, w * 0.44, h * 0.02);
  ctx.bezierCurveTo(w * 0.5, h * 0.22, w * 0.3, h * 0.46, w * 0.06, h * 0.34);
  ctx.bezierCurveTo(-w * 0.22, h * 0.2, -w * 0.42, h * 0.34, -w * 0.44, -h * 0.06);
  ctx.closePath();
  ctx.fillStyle = bodyGradient(ctx, h, c);
  ctx.fill();
  bounceLight(ctx, w, h, clamp01(d));
  strokeOutline(ctx, c, w);

  // casing ties
  ctx.strokeStyle = rgb(mixRgb(c.dark, [0, 0, 0], 0.4), 0.9);
  ctx.lineWidth = Math.max(1.4, h * 0.1);
  for (const sx of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(sx * w * 0.42, -h * 0.2);
    ctx.lineTo(sx * w * 0.5, h * 0.15);
    ctx.stroke();
  }
  // casing split (appears at high doneness, shows fat underneath)
  if (d > 0.7) {
    const split = clamp01((d - 0.7) / 0.4);
    ctx.save();
    ctx.strokeStyle = `rgba(80,30,12,${0.6 * split})`;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-w * 0.1, -h * 0.1);
    ctx.bezierCurveTo(0, h * 0.05, w * 0.05, h * 0.1, w * 0.12, h * 0.18);
    ctx.stroke();
    ctx.fillStyle = `rgba(210,140,70,${0.4 * split})`;
    ctx.beginPath();
    ctx.ellipse(0, h * 0.05, w * 0.08, h * 0.04, 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  grillMarks(ctx, w, h, c, d, 3);
  sheen(ctx, w, h, 0.6 + d * 0.6, true);
  juiceBeads(ctx, w, h, d, 3.7);
}

/** Skewers: espetinhos and coração — stick with cubes threaded on it. */
function drawSkewer(ctx: Ctx, w: number, h: number, c: FoodColors, d: number, pieces: number): void {
  // stick shadow
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = Math.max(2.4, h * 0.13);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-w * 0.5, 2);
  ctx.lineTo(w * 0.5, 2);
  ctx.stroke();
  // stick
  const stick = ctx.createLinearGradient(0, -h * 0.08, 0, h * 0.08);
  stick.addColorStop(0, '#E4C18B');
  stick.addColorStop(0.5, '#C9A46A');
  stick.addColorStop(1, '#8B6B3D');
  ctx.strokeStyle = stick;
  ctx.lineWidth = Math.max(2, h * 0.11);
  ctx.beginPath();
  ctx.moveTo(-w * 0.5, 0);
  ctx.lineTo(w * 0.5, 0);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,240,210,0.3)';
  ctx.lineWidth = Math.max(0.8, h * 0.03);
  ctx.beginPath();
  ctx.moveTo(-w * 0.48, -h * 0.04);
  ctx.lineTo(w * 0.48, -h * 0.04);
  ctx.stroke();
  // pointed tip
  ctx.fillStyle = '#3A2414';
  ctx.beginPath();
  ctx.moveTo(w * 0.5, 0);
  ctx.lineTo(w * 0.6, -h * 0.1);
  ctx.lineTo(w * 0.6, h * 0.1);
  ctx.closePath();
  ctx.fill();

  const step = (w * 0.78) / pieces;
  for (let i = 0; i < pieces; i++) {
    const px = -w * 0.39 + step * (i + 0.5);
    const s = h * 0.78;
    ctx.save();
    ctx.translate(px, 0);
    ctx.rotate((i % 2 === 0 ? 1 : -1) * 0.08);
    // cube shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    roundRectPath(ctx, -s / 2 + 1, -s / 2 + 2, s, s, s * 0.25);
    ctx.fill();
    roundRectPath(ctx, -s / 2, -s / 2, s, s, s * 0.28);
    ctx.fillStyle = bodyGradient(ctx, s, c);
    ctx.fill();
    bounceLight(ctx, s, s, clamp01(d));
    strokeOutline(ctx, c, s);
    grillMarks(ctx, s, s, c, d, 1);
    sheen(ctx, s, s, 0.55 + d * 0.55, true);
    ctx.restore();
  }
}

/** Chicken pieces: coxa, asinha — drumstick silhouette. */
function drawDrumstick(ctx: Ctx, w: number, h: number, c: FoodColors, d: number): void {
  ctx.save();
  ctx.rotate(-0.22);
  // bone
  const boneG = ctx.createLinearGradient(0, -h * 0.15, 0, h * 0.15);
  boneG.addColorStop(0, '#FBF0DA');
  boneG.addColorStop(1, '#C9A46A');
  ctx.fillStyle = boneG;
  roundRectPath(ctx, w * 0.12, -h * 0.11, w * 0.36, h * 0.22, h * 0.11);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(w * 0.46, -h * 0.1, h * 0.13, 0, Math.PI * 2);
  ctx.arc(w * 0.46, h * 0.1, h * 0.13, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(130,90,50,0.45)';
  ctx.lineWidth = 0.8;
  ctx.stroke();
  // meat shadow
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(-w * 0.1, 4, w * 0.34, h * 0.46, 0, 0, Math.PI * 2);
  ctx.fill();
  // meat
  ctx.beginPath();
  ctx.ellipse(-w * 0.12, 0, w * 0.32, h * 0.44, 0, 0, Math.PI * 2);
  ctx.fillStyle = bodyGradient(ctx, h, c);
  ctx.fill();
  bounceLight(ctx, w * 0.62, h * 0.86, clamp01(d));
  strokeOutline(ctx, c, w);
  // crispy skin bumps (appear with doneness)
  if (d > 0.4) {
    ctx.save();
    ctx.clip();
    ctx.fillStyle = `rgba(180,100,40,${clamp01((d - 0.4) / 0.5) * 0.35})`;
    for (let i = 0; i < 6; i++) {
      const bx = -w * 0.3 + (i * 23 % 70) / 100 * w * 0.5;
      const by = -h * 0.3 + (i * 37 % 70) / 100 * h * 0.6;
      ctx.beginPath();
      ctx.arc(bx, by, 1.4 + (i % 2), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
  grillMarks(ctx, w * 0.62, h * 0.86, c, d, 2);
  sheen(ctx, w * 0.62, h * 0.86, 0.55 + d * 0.65, true);
  juiceBeads(ctx, w * 0.6, h * 0.8, d, 5.1);
  ctx.restore();
}

/** Garlic bread: scored loaf with herb butter glistening. */
function drawBread(ctx: Ctx, w: number, h: number, c: FoodColors, d: number): void {
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  roundRectPath(ctx, -w / 2 + 1, -h / 2 + 2, w, h, h * 0.44);
  ctx.fill();
  roundRectPath(ctx, -w / 2, -h / 2, w, h, h * 0.44);
  ctx.fillStyle = bodyGradient(ctx, h, c);
  ctx.fill();
  bounceLight(ctx, w, h, clamp01(d * 0.8));
  strokeOutline(ctx, c, w);

  // diagonal scoring with herb butter (glistening pools)
  ctx.save();
  roundRectPath(ctx, -w / 2, -h / 2, w, h, h * 0.44);
  ctx.clip();
  const butter = mixRgb(hex('#FFF3C6'), hex('#B4842F'), clamp01(d / 1.1));
  // butter pool spread
  ctx.fillStyle = rgb(mixRgb(butter, c.base, 0.2), 0.5);
  ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.strokeStyle = rgb(butter, 0.95);
  ctx.lineWidth = Math.max(2.2, h * 0.17);
  ctx.lineCap = 'round';
  ctx.shadowColor = 'rgba(255,220,130,0.5)';
  ctx.shadowBlur = 3;
  for (let i = 0; i < 4; i++) {
    const off = -w * 0.34 + (w * 0.68 / 3) * i;
    ctx.beginPath();
    ctx.moveTo(off - h * 0.28, h * 0.34);
    ctx.lineTo(off + h * 0.28, -h * 0.34);
    ctx.stroke();
  }
  ctx.shadowBlur = 0;
  // herb flecks
  ctx.fillStyle = 'rgba(90,110,40,0.8)';
  for (let i = 0; i < 10; i++) {
    const hx = -w * 0.4 + (i / 9) * w * 0.8;
    const hy = -h * 0.2 + Math.sin(i * 1.7) * h * 0.25;
    ctx.beginPath();
    ctx.ellipse(hx, hy, 1.2, 0.6, i, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  sheen(ctx, w, h, 0.5 + d * 0.5, true);
}

/** Coalho cheese: tall cube on a skewer, golden crust with blisters. */
function drawCheese(ctx: Ctx, w: number, h: number, c: FoodColors, d: number): void {
  // stick
  ctx.strokeStyle = '#C9A46A';
  ctx.lineWidth = Math.max(2, h * 0.09);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, -h * 0.62);
  ctx.lineTo(0, h * 0.68);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,236,200,0.3)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(-1, -h * 0.6);
  ctx.lineTo(-1, h * 0.66);
  ctx.stroke();

  const s = Math.min(w * 0.62, h * 0.92);
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  roundRectPath(ctx, -s / 2 + 1, -s / 2 + 2, s, s, s * 0.2);
  ctx.fill();
  roundRectPath(ctx, -s / 2, -s / 2, s, s, s * 0.2);
  ctx.fillStyle = bodyGradient(ctx, s, c);
  ctx.fill();
  bounceLight(ctx, s, s, clamp01(d));
  strokeOutline(ctx, c, s);

  // blistered golden crust
  const crust = clamp01((d - 0.2) / 0.65);
  if (crust > 0) {
    ctx.save();
    roundRectPath(ctx, -s / 2, -s / 2, s, s, s * 0.2);
    ctx.clip();
    for (let i = 0; i < 7; i++) {
      const bx = -s * 0.3 + (s * 0.6 / 6) * i;
      const by = -s * 0.28 + ((i * 31) % 5) * s * 0.13;
      const br = s * (0.1 + (i % 3) * 0.04);
      const bg = ctx.createRadialGradient(bx, by, 0, bx, by, br);
      bg.addColorStop(0, rgb(mixRgb(hex('#D99830'), hex('#7A3A10'), crust), 0.45 + crust * 0.4));
      bg.addColorStop(1, 'rgba(120,60,15,0)');
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.arc(bx, by, br, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
  // melted drip at bottom when well done
  if (d > 0.85) {
    ctx.fillStyle = rgb(mixRgb(c.base, hex('#F0C878'), 0.3));
    ctx.beginPath();
    ctx.moveTo(-s * 0.1, s * 0.5);
    ctx.quadraticCurveTo(0, s * 0.75, s * 0.1, s * 0.5);
    ctx.closePath();
    ctx.fill();
  }
  sheen(ctx, s, s, 0.55 + d * 0.35, true);
}

/** Grilled vegetables: pepper ring, courgette disc, onion wedge. */
function drawVeg(ctx: Ctx, w: number, h: number, c: FoodColors, d: number): void {
  const shapes: [number, number, string, number][] = [
    [-w * 0.26, 0, '#6FA84A', 0],    // courgette/zucchini
    [0, -h * 0.04, '#C0442E', 1],    // pepper
    [w * 0.26, h * 0.02, '#E8B23C', 2], // onion
  ];
  for (const [px, py, tint, idx] of shapes) {
    const r = h * 0.34;
    ctx.save();
    ctx.translate(px, py);
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath(); ctx.arc(1, r * 0.25, r * 0.95, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    const base = mixRgb(hex(tint), c.base, 0.28 + d * 0.35);
    const g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r * 1.05);
    g.addColorStop(0, rgb(mixRgb(base, [255, 255, 255], 0.32)));
    g.addColorStop(0.5, rgb(base));
    g.addColorStop(1, rgb(mixRgb(base, [40, 20, 8], 0.4)));
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = 'rgba(30,20,12,0.45)';
    ctx.lineWidth = 1;
    ctx.stroke();
    // inner detail (seeds/rings/flesh)
    if (idx === 0) {
      // zucchini: lighter core
      ctx.fillStyle = 'rgba(220,240,190,0.45)';
      ctx.beginPath(); ctx.arc(0, 0, r * 0.4, 0, Math.PI * 2); ctx.fill();
    } else if (idx === 1) {
      // pepper: hollow ring
      ctx.fillStyle = 'rgba(40,20,10,0.3)';
      ctx.beginPath(); ctx.arc(0, 0, r * 0.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = mix(tint as any, c.base as any, 0.2) as any;
      ctx.fillStyle = rgb(mixRgb(hex(tint), [255, 220, 160], 0.2), 0.4);
      ctx.beginPath(); ctx.arc(0, 0, r * 0.25, 0, Math.PI * 2); ctx.fill();
    } else {
      // onion: concentric rings
      ctx.strokeStyle = 'rgba(255,245,220,0.4)';
      ctx.lineWidth = 0.8;
      for (let rr = 0; rr < 3; rr++) {
        ctx.beginPath();
        ctx.arc(0, 0, r * (0.85 - rr * 0.22), 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    // char spots
    if (d > 0.35) {
      const n = 2 + Math.floor(d * 3);
      for (let k = 0; k < n; k++) {
        ctx.fillStyle = `rgba(40,20,10,${clamp01((d - 0.35) / 0.7) * 0.55})`;
        const ax = Math.sin(idx * 5 + k * 2.3) * r * 0.5;
        const ay = Math.cos(idx * 3 + k * 3.1) * r * 0.4;
        ctx.beginPath();
        ctx.ellipse(ax, ay, r * 0.18, r * 0.1, k, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    sheen(ctx, r * 2, r * 2, 0.35 + d * 0.3, false);
    ctx.restore();
  }
}

/** Vinagrete: bowl of diced relish (prep item, never grilled). */
function drawBowl(ctx: Ctx, w: number, h: number, c: FoodColors): void {
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(0, h * 0.35, w * 0.45, h * 0.14, 0, 0, Math.PI * 2);
  ctx.fill();
  // bowl exterior
  const bowlG = ctx.createLinearGradient(0, -h * 0.2, 0, h * 0.45);
  bowlG.addColorStop(0, '#F8EBD6');
  bowlG.addColorStop(1, '#B89876');
  ctx.fillStyle = bowlG;
  ctx.beginPath();
  ctx.moveTo(-w * 0.48, -h * 0.05);
  ctx.quadraticCurveTo(-w * 0.5, h * 0.45, 0, h * 0.45);
  ctx.quadraticCurveTo(w * 0.5, h * 0.45, w * 0.48, -h * 0.05);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(120,100,74,0.55)';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  // rim
  ctx.fillStyle = '#F4E6CC';
  ctx.beginPath();
  ctx.ellipse(0, -h * 0.05, w * 0.48, h * 0.14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(120,100,74,0.5)';
  ctx.stroke();
  // contents
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(0, -h * 0.05, w * 0.42, h * 0.1, 0, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = 'rgba(160,40,30,0.85)';
  ctx.fillRect(-w * 0.45, -h * 0.25, w * 0.9, h * 0.3);
  const bits: [string, number, number, number][] = [
    ['#C0442E', -w * 0.2, -h * 0.06, 3],
    ['#C0442E', w * 0.1, -h * 0.1, 2.5],
    ['#F4E7D3', -w * 0.05, -h * 0.12, 2],
    ['#F4E7D3', w * 0.22, -h * 0.04, 2.2],
    ['#6FA84A', -w * 0.12, -h * 0.02, 2],
    ['#6FA84A', w * 0.05, -h * 0.08, 2],
    ['#8B3A1F', -w * 0.28, -h * 0.1, 2],
    ['#C0442E', w * 0.3, -h * 0.11, 2],
  ];
  for (const [col, bx, by, sz] of bits) {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(bx, by, sz, 0, Math.PI * 2);
    ctx.fill();
  }
  // oil sheen
  ctx.fillStyle = 'rgba(255,230,160,0.25)';
  ctx.beginPath();
  ctx.ellipse(-w * 0.1, -h * 0.12, w * 0.12, h * 0.04, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // rim highlight
  ctx.strokeStyle = 'rgba(255,250,240,0.6)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(-w * 0.1, -h * 0.09, w * 0.2, h * 0.05, -0.3, Math.PI * 1.1, Math.PI * 1.8);
  ctx.stroke();
  void c;
}

// ── Public entry point ──────────────────────────────────────────────────────

export interface DrawFoodOpts {
  doneness: number;
  burned: boolean;
  scale?: number;
  glow?: number;
  heat?: number;
}

export function drawFood(
  ctx: Ctx, ing: Ingredient, x: number, y: number, opts: DrawFoodOpts
): void {
  const { doneness: d, burned, scale = 1, glow = 1, heat = 1 } = opts;
  const c = donenessColors(ing, d);
  const sides = ing.sides;
  const w = (sides >= 4 ? 44 : 54) * scale;
  const h = (sides >= 4 ? 17 : 25) * scale;

  ctx.save();
  ctx.translate(x, y);

  underGlow(ctx, w, h, glow, heat);
  contactShadow(ctx, w, h);

  switch (ing.id) {
    case 'picanha':
    case 'fraldinha':
    case 'contra_file':
    case 'maminha':
      drawSteak(ctx, w, h, c, ing, d);
      break;
    case 'costela':
    case 'cupim':
      drawRib(ctx, w, h, c, d);
      break;
    case 'linguica_toscana':
      drawSausage(ctx, w, h, c, d);
      break;
    case 'coracao_frango':
      drawSkewer(ctx, w, h, c, d, 4);
      break;
    case 'espetinho_frango':
      drawSkewer(ctx, w, h, c, d, 3);
      break;
    case 'espetinho_misto':
      drawSkewer(ctx, w, h, c, d, 4);
      break;
    case 'frango_coxa':
    case 'asinha_frango':
      drawDrumstick(ctx, w, h, c, d);
      break;
    case 'pao_de_alho':
      drawBread(ctx, w, h, c, d);
      break;
    case 'queijo_coalho':
      drawCheese(ctx, w, h, c, d);
      break;
    case 'legumes_grelhados':
      drawVeg(ctx, w, h, c, d);
      break;
    case 'vinagrete':
      drawBowl(ctx, w, h, c);
      break;
    default:
      roundRectPath(ctx, -w / 2, -h / 2, w, h, h * 0.4);
      ctx.fillStyle = bodyGradient(ctx, h, c);
      ctx.fill();
      strokeOutline(ctx, c, w);
      grillMarks(ctx, w, h, c, d, 2);
      sheen(ctx, w, h, 0.55);
  }

  // Burned state: charred crust + wisp of black smoke. Soft overlay so silhouette
  // remains, but colours desaturate and a scorched rim appears.
  if (burned) {
    ctx.save();
    // desaturate by overlaying dark warm black
    ctx.globalCompositeOperation = 'source-atop';
    const burn = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.max(w, h));
    burn.addColorStop(0, 'rgba(25,15,10,0.62)');
    burn.addColorStop(0.7, 'rgba(20,12,8,0.5)');
    burn.addColorStop(1, 'rgba(15,8,5,0.75)');
    ctx.fillStyle = burn;
    ctx.fillRect(-w * 1.5, -h * 1.5, w * 3, h * 3);
    // ashy specks
    ctx.fillStyle = 'rgba(90,80,75,0.5)';
    for (let i = 0; i < 8; i++) {
      const ax = -w * 0.4 + (i * 31 % 80) / 100 * w * 0.8;
      const ay = -h * 0.3 + (i * 17 % 60) / 100 * h * 0.6;
      ctx.beginPath();
      ctx.arc(ax, ay, 0.8 + (i % 3) * 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  ctx.restore();
}

/** Compact version for bench tiles / order cards. */
export function drawFoodIcon(ctx: Ctx, ing: Ingredient, x: number, y: number, size: number): void {
  const c: FoodColors = {
    base: hex(ing.art.cookedColor),
    dark: mixRgb(hex(ing.art.cookedColor), [26, 14, 9], 0.4),
    light: mixRgb(hex(ing.art.cookedColor), [255, 232, 198], 0.28),
    mark: mixRgb(hex(ing.art.cookedColor), [20, 11, 7], 0.7),
    crust: mixRgb(hex(ing.art.cookedColor), [60, 28, 14], 0.3),
  };
  const w = size;
  const h = size * (ing.sides >= 4 ? 0.42 : 0.55);
  ctx.save();
  ctx.translate(x, y);
  // tiny plate shadow
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath();
  ctx.ellipse(0, h * 0.3, w * 0.48, h * 0.14, 0, 0, Math.PI * 2);
  ctx.fill();
  switch (ing.id) {
    case 'picanha': case 'fraldinha': case 'contra_file': case 'maminha':
      drawSteak(ctx, w, h, c, ing, 0.8); break;
    case 'costela': case 'cupim':
      drawRib(ctx, w, h, c, 0.8); break;
    case 'linguica_toscana':
      drawSausage(ctx, w, h, c, 0.8); break;
    case 'coracao_frango': case 'espetinho_frango': case 'espetinho_misto':
      drawSkewer(ctx, w, h, c, 0.8, 3); break;
    case 'frango_coxa': case 'asinha_frango':
      drawDrumstick(ctx, w, h, c, 0.8); break;
    case 'pao_de_alho':
      drawBread(ctx, w, h, c, 0.8); break;
    case 'queijo_coalho':
      drawCheese(ctx, w, h, c, 0.8); break;
    case 'legumes_grelhados':
      drawVeg(ctx, w, h, c, 0.8); break;
    case 'vinagrete':
      drawBowl(ctx, w, h, c); break;
    default:
      roundRectPath(ctx, -w / 2, -h / 2, w, h, h * 0.4);
      ctx.fillStyle = bodyGradient(ctx, h, c);
      ctx.fill();
      strokeOutline(ctx, c, w);
  }
  ctx.restore();
}

export { C };
