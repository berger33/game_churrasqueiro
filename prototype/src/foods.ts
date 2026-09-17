/**
 * Food rendering — one distinct vector silhouette per ingredient.
 *
 * Rule R2 (docs/04-ART_STYLE.md §2): every item must be identifiable as a solid
 * black shape at 64 px. A generic rounded rectangle fails that for all 16 items
 * at once; emoji fail it differently on every platform. So each ingredient gets
 * its own outline, drawn from paths.
 *
 * Doneness is a material, not a shape: the silhouette never changes, only the
 * fill gradient, the grill marks and the sheen do. That is what makes the
 * "is it ready?" read instant.
 */
import type { Ingredient } from '../../tools/sim-core/src/types.ts';
import { C, clamp01, hex, mix, mixRgb, rgb, roundRectPath, type RGB } from './theme.ts';

export interface FoodColors {
  base: RGB;
  dark: RGB;
  light: RGB;
  mark: RGB;
}

/**
 * Maps overall doneness 0..1.5 onto the raw → cooked → burned ramp.
 * Kept in one place so the prototype and any future shader agree.
 */
export function donenessColors(ing: Ingredient, d: number): FoodColors {
  const raw = hex(ing.art.rawColor);
  const cooked = hex(ing.art.cookedColor);
  const burn = hex(ing.art.burnColor);

  let base: RGB;
  if (d < 0.72) base = mixRgb(raw, cooked, clamp01(d / 0.72));
  else base = mixRgb(cooked, burn, clamp01((d - 0.72) / 0.48));

  return {
    base,
    dark: mixRgb(base, [26, 14, 9], 0.42),
    light: mixRgb(base, [255, 232, 198], d > 1.1 ? 0.1 : 0.26),
    mark: mixRgb(base, [20, 11, 7], 0.72)
  };
}

type Ctx = CanvasRenderingContext2D;

/** Soft warm glow pooled under the item, as if lit by the coals below (R4). */
function underGlow(ctx: Ctx, w: number, h: number, intensity: number): void {
  const g = ctx.createRadialGradient(0, h * 0.45, 1, 0, h * 0.45, w * 0.95);
  g.addColorStop(0, `rgba(224,86,31,${0.30 + intensity * 0.34})`);
  g.addColorStop(0.55, `rgba(224,86,31,${0.10 + intensity * 0.12})`);
  g.addColorStop(1, 'rgba(224,86,31,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(0, h * 0.45, w * 0.95, h * 0.95, 0, 0, Math.PI * 2);
  ctx.fill();
}

/** Contact shadow so the item sits ON the grate instead of floating. */
function contactShadow(ctx: Ctx, w: number, h: number): void {
  ctx.fillStyle = 'rgba(12,7,5,0.42)';
  ctx.beginPath();
  ctx.ellipse(0, h * 0.52, w * 0.46, h * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();
}

/** Diagonal sear stripes. Alpha and width track browning. */
function grillMarks(ctx: Ctx, w: number, h: number, col: RGB, d: number, count = 3): void {
  const t = clamp01((d - 0.22) / 0.55);
  if (t <= 0) return;
  ctx.save();
  roundRectPath(ctx, -w / 2, -h / 2, w, h, h * 0.42);
  ctx.clip();
  ctx.strokeStyle = rgb(col, 0.22 + t * 0.6);
  ctx.lineWidth = Math.max(2, h * 0.16);
  ctx.lineCap = 'round';
  const span = w + h;
  for (let i = 0; i < count; i++) {
    const off = -span / 2 + (span / (count + 1)) * (i + 1);
    ctx.beginPath();
    ctx.moveTo(off - h * 0.6, -h);
    ctx.lineTo(off + h * 0.6, h);
    ctx.stroke();
  }
  ctx.restore();
}

/** Specular sheen along the top-left, stronger as fat renders out. */
function sheen(ctx: Ctx, w: number, h: number, strength: number): void {
  if (strength <= 0) return;
  ctx.save();
  roundRectPath(ctx, -w / 2, -h / 2, w, h, h * 0.42);
  ctx.clip();
  const g = ctx.createLinearGradient(-w * 0.4, -h * 0.5, w * 0.1, h * 0.35);
  g.addColorStop(0, `rgba(255,246,225,${0.34 * strength})`);
  g.addColorStop(0.5, `rgba(255,246,225,${0.08 * strength})`);
  g.addColorStop(1, 'rgba(255,246,225,0)');
  ctx.fillStyle = g;
  ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.restore();
}

function bodyGradient(ctx: Ctx, h: number, c: FoodColors): CanvasGradient {
  const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
  g.addColorStop(0, rgb(c.light));
  g.addColorStop(0.42, rgb(c.base));
  g.addColorStop(1, rgb(c.dark));
  return g;
}

function strokeOutline(ctx: Ctx, c: FoodColors, w: number): void {
  ctx.strokeStyle = rgb(mixRgb(c.dark, [0, 0, 0], 0.25), 0.75);
  ctx.lineWidth = Math.max(1.2, w * 0.028);
  ctx.stroke();
}

// ── Individual silhouettes ──────────────────────────────────────────────────

/** Steaks: picanha, fraldinha, contra-filé, maminha — wedge with a fat cap. */
function drawSteak(ctx: Ctx, w: number, h: number, c: FoodColors, ing: Ingredient, d: number): void {
  ctx.beginPath();
  ctx.moveTo(-w * 0.46, -h * 0.30);
  ctx.bezierCurveTo(-w * 0.30, -h * 0.52, w * 0.22, -h * 0.54, w * 0.44, -h * 0.34);
  ctx.bezierCurveTo(w * 0.54, -h * 0.20, w * 0.50, h * 0.26, w * 0.30, h * 0.42);
  ctx.bezierCurveTo(w * 0.06, h * 0.56, -w * 0.28, h * 0.50, -w * 0.44, h * 0.28);
  ctx.bezierCurveTo(-w * 0.56, h * 0.08, -w * 0.55, -h * 0.14, -w * 0.46, -h * 0.30);
  ctx.closePath();
  ctx.fillStyle = bodyGradient(ctx, h, c);
  ctx.fill();
  strokeOutline(ctx, c, w);

  // Fat cap — renders from cream to gold as it cooks.
  if (ing.art.fatCap) {
    ctx.save();
    ctx.clip();
    const fat = mixRgb(hex('#F3E3C6'), hex('#D9A44E'), clamp01(d / 0.9));
    const g = ctx.createLinearGradient(0, -h * 0.55, 0, -h * 0.1);
    g.addColorStop(0, rgb(mixRgb(fat, [255, 255, 255], 0.25)));
    g.addColorStop(1, rgb(fat));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-w * 0.5, -h * 0.6);
    ctx.lineTo(w * 0.5, -h * 0.6);
    ctx.lineTo(w * 0.5, -h * 0.20);
    ctx.bezierCurveTo(w * 0.1, -h * 0.36, -w * 0.16, -h * 0.18, -w * 0.5, -h * 0.34);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  grillMarks(ctx, w, h, c.mark, d, 3);
  sheen(ctx, w, h, ing.art.fatSheen ? 0.5 + d * 0.7 : 0.35);
}

/** Ribs: costela, cupim — block with two bone ends showing. */
function drawRib(ctx: Ctx, w: number, h: number, c: FoodColors, d: number): void {
  roundRectPath(ctx, -w / 2, -h / 2, w, h, h * 0.3);
  ctx.fillStyle = bodyGradient(ctx, h, c);
  ctx.fill();
  strokeOutline(ctx, c, w);

  // bone ends
  const bone = mixRgb(hex('#F0E4CE'), hex('#C9A46A'), clamp01(d));
  for (const sx of [-1, 1]) {
    ctx.fillStyle = rgb(bone);
    ctx.beginPath();
    ctx.ellipse(sx * w * 0.44, -h * 0.16, w * 0.075, h * 0.13, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(120,92,54,0.5)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  grillMarks(ctx, w, h, c.mark, d, 2);
  sheen(ctx, w, h, 0.5 + d * 0.5);
}

/** Sausage: linguiça toscana — curved link with tied ends. */
function drawSausage(ctx: Ctx, w: number, h: number, c: FoodColors, d: number): void {
  ctx.beginPath();
  ctx.moveTo(-w * 0.44, -h * 0.06);
  ctx.bezierCurveTo(-w * 0.2, -h * 0.44, w * 0.2, h * 0.40, w * 0.44, h * 0.02);
  ctx.bezierCurveTo(w * 0.5, h * 0.22, w * 0.3, h * 0.46, w * 0.06, h * 0.34);
  ctx.bezierCurveTo(-w * 0.22, h * 0.2, -w * 0.42, h * 0.34, -w * 0.44, -h * 0.06);
  ctx.closePath();
  ctx.fillStyle = bodyGradient(ctx, h, c);
  ctx.fill();
  strokeOutline(ctx, c, w);

  // casing ties
  ctx.strokeStyle = rgb(mixRgb(c.dark, [0, 0, 0], 0.3), 0.8);
  ctx.lineWidth = Math.max(1.4, h * 0.09);
  for (const sx of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(sx * w * 0.42, -h * 0.2);
    ctx.lineTo(sx * w * 0.48, h * 0.12);
    ctx.stroke();
  }
  grillMarks(ctx, w, h, c.mark, d, 2);
  sheen(ctx, w, h, 0.55 + d * 0.7);
}

/** Skewers: espetinhos and coração — stick with cubes threaded on it. */
function drawSkewer(ctx: Ctx, w: number, h: number, c: FoodColors, d: number, pieces: number): void {
  // stick
  ctx.strokeStyle = '#C9A46A';
  ctx.lineWidth = Math.max(2, h * 0.11);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-w * 0.5, 0);
  ctx.lineTo(w * 0.5, 0);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,236,200,0.35)';
  ctx.lineWidth = Math.max(1, h * 0.04);
  ctx.beginPath();
  ctx.moveTo(-w * 0.48, -h * 0.03);
  ctx.lineTo(w * 0.48, -h * 0.03);
  ctx.stroke();

  const step = (w * 0.78) / pieces;
  for (let i = 0; i < pieces; i++) {
    const px = -w * 0.39 + step * (i + 0.5);
    const s = h * 0.78;
    ctx.save();
    ctx.translate(px, 0);
    ctx.rotate((i % 2 === 0 ? 1 : -1) * 0.09);
    roundRectPath(ctx, -s / 2, -s / 2, s, s, s * 0.3);
    ctx.fillStyle = bodyGradient(ctx, s, c);
    ctx.fill();
    strokeOutline(ctx, c, s);
    grillMarks(ctx, s, s, c.mark, d, 1);
    sheen(ctx, s, s, 0.5 + d * 0.6);
    ctx.restore();
  }
}

/** Chicken pieces: coxa, asinha — drumstick silhouette. */
function drawDrumstick(ctx: Ctx, w: number, h: number, c: FoodColors, d: number): void {
  ctx.save();
  ctx.rotate(-0.22);
  // bone
  ctx.fillStyle = '#EFE2C8';
  roundRectPath(ctx, w * 0.12, -h * 0.11, w * 0.36, h * 0.22, h * 0.11);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(w * 0.46, -h * 0.1, h * 0.13, 0, Math.PI * 2);
  ctx.arc(w * 0.46, h * 0.1, h * 0.13, 0, Math.PI * 2);
  ctx.fill();
  // meat
  ctx.beginPath();
  ctx.ellipse(-w * 0.12, 0, w * 0.32, h * 0.44, 0, 0, Math.PI * 2);
  ctx.fillStyle = bodyGradient(ctx, h, c);
  ctx.fill();
  strokeOutline(ctx, c, w);
  grillMarks(ctx, w * 0.62, h * 0.86, c.mark, d, 2);
  sheen(ctx, w * 0.62, h * 0.86, 0.55 + d * 0.65);
  ctx.restore();
}

/** Garlic bread: scored loaf. */
function drawBread(ctx: Ctx, w: number, h: number, c: FoodColors, d: number): void {
  roundRectPath(ctx, -w / 2, -h / 2, w, h, h * 0.44);
  ctx.fillStyle = bodyGradient(ctx, h, c);
  ctx.fill();
  strokeOutline(ctx, c, w);

  // diagonal scoring with herb butter
  ctx.save();
  roundRectPath(ctx, -w / 2, -h / 2, w, h, h * 0.44);
  ctx.clip();
  const butter = mixRgb(hex('#E8D9A8'), hex('#9E7A2C'), clamp01(d));
  ctx.strokeStyle = rgb(butter, 0.9);
  ctx.lineWidth = Math.max(2, h * 0.15);
  ctx.lineCap = 'round';
  for (let i = 0; i < 4; i++) {
    const off = -w * 0.34 + (w * 0.68 / 3) * i;
    ctx.beginPath();
    ctx.moveTo(off - h * 0.28, h * 0.34);
    ctx.lineTo(off + h * 0.28, -h * 0.34);
    ctx.stroke();
  }
  ctx.restore();
  sheen(ctx, w, h, 0.4 + d * 0.5);
}

/** Coalho cheese: tall cube on a skewer, golden crust. */
function drawCheese(ctx: Ctx, w: number, h: number, c: FoodColors, d: number): void {
  ctx.strokeStyle = '#C9A46A';
  ctx.lineWidth = Math.max(2, h * 0.09);
  ctx.beginPath();
  ctx.moveTo(0, -h * 0.62);
  ctx.lineTo(0, h * 0.62);
  ctx.stroke();

  const s = Math.min(w * 0.62, h * 0.92);
  roundRectPath(ctx, -s / 2, -s / 2, s, s, s * 0.2);
  ctx.fillStyle = bodyGradient(ctx, s, c);
  ctx.fill();
  strokeOutline(ctx, c, s);

  // blistered golden crust
  const crust = clamp01((d - 0.25) / 0.6);
  if (crust > 0) {
    ctx.save();
    roundRectPath(ctx, -s / 2, -s / 2, s, s, s * 0.2);
    ctx.clip();
    ctx.fillStyle = rgb(mixRgb(hex('#D9A44E'), hex('#8C4A16'), crust), 0.35 + crust * 0.45);
    for (let i = 0; i < 5; i++) {
      const bx = -s * 0.3 + (s * 0.6 / 4) * i;
      const by = -s * 0.24 + ((i % 2) * s * 0.42);
      ctx.beginPath();
      ctx.ellipse(bx, by, s * 0.16, s * 0.12, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
  sheen(ctx, s, s, 0.5 + d * 0.4);
}

/** Grilled vegetables: pepper ring, courgette disc, onion wedge. */
function drawVeg(ctx: Ctx, w: number, h: number, c: FoodColors, d: number): void {
  const shapes: [number, number, string][] = [
    [-w * 0.26, 0, '#6FA84A'],
    [0, -h * 0.04, '#C0442E'],
    [w * 0.26, h * 0.02, '#E8B23C']
  ];
  for (const [px, py, tint] of shapes) {
    const r = h * 0.34;
    ctx.save();
    ctx.translate(px, py);
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    const base = mixRgb(hex(tint), c.base, 0.35 + d * 0.35);
    const g = ctx.createLinearGradient(0, -r, 0, r);
    g.addColorStop(0, rgb(mixRgb(base, [255, 255, 255], 0.28)));
    g.addColorStop(1, rgb(mixRgb(base, [0, 0, 0], 0.28)));
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = 'rgba(30,20,12,0.4)';
    ctx.lineWidth = 1;
    ctx.stroke();
    // char spots
    if (d > 0.4) {
      ctx.fillStyle = `rgba(60,32,14,${clamp01((d - 0.4) / 0.6) * 0.55})`;
      ctx.beginPath();
      ctx.arc(r * 0.2, -r * 0.15, r * 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

/** Vinagrete: bowl of diced relish (prep item, never grilled). */
function drawBowl(ctx: Ctx, w: number, h: number, c: FoodColors): void {
  ctx.fillStyle = '#E8DCC6';
  ctx.beginPath();
  ctx.ellipse(0, h * 0.1, w * 0.42, h * 0.36, 0, 0, Math.PI);
  ctx.fill();
  ctx.strokeStyle = 'rgba(120,100,74,0.5)';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  const bits: [string, number, number][] = [
    ['#C0442E', -w * 0.18, -h * 0.02],
    ['#F4E7D3', 0, -h * 0.08],
    ['#6FA84A', w * 0.17, 0]
  ];
  for (const [col, bx, by] of bits) {
    ctx.fillStyle = col;
    roundRectPath(ctx, bx - w * 0.09, by - h * 0.08, w * 0.18, h * 0.16, 2);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.beginPath();
  ctx.ellipse(-w * 0.16, h * 0.2, w * 0.1, h * 0.06, 0, 0, Math.PI * 2);
  ctx.fill();
  void c;
}

// ── Public entry point ──────────────────────────────────────────────────────

export interface DrawFoodOpts {
  doneness: number;
  burned: boolean;
  scale?: number;
  glow?: number;
}

export function drawFood(
  ctx: Ctx, ing: Ingredient, x: number, y: number, opts: DrawFoodOpts
): void {
  const { doneness: d, burned, scale = 1, glow = 1 } = opts;
  const c = donenessColors(ing, d);
  const sides = ing.sides;
  const w = (sides >= 4 ? 44 : 54) * scale;
  const h = (sides >= 4 ? 17 : 25) * scale;

  ctx.save();
  ctx.translate(x, y);

  underGlow(ctx, w, h, glow);
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
      grillMarks(ctx, w, h, c.mark, d, 2);
      sheen(ctx, w, h, 0.5);
  }

  // Burned: desaturate to charcoal and add a scorched rim.
  if (burned) {
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = 'rgba(28,20,16,0.55)';
    ctx.fillRect(-w, -h, w * 2, h * 2);
    ctx.globalCompositeOperation = 'source-over';
  }

  ctx.restore();
  return;
}

/** Compact version for bench tiles — silhouette only, no glow or shadow. */
export function drawFoodIcon(ctx: Ctx, ing: Ingredient, x: number, y: number, size: number): void {
  const c: FoodColors = {
    base: hex(ing.art.cookedColor),
    dark: mixRgb(hex(ing.art.cookedColor), [26, 14, 9], 0.4),
    light: mixRgb(hex(ing.art.cookedColor), [255, 232, 198], 0.28),
    mark: mixRgb(hex(ing.art.cookedColor), [20, 11, 7], 0.7)
  };
  const w = size;
  const h = size * (ing.sides >= 4 ? 0.42 : 0.55);
  ctx.save();
  ctx.translate(x, y);
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
