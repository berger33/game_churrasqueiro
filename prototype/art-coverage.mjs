/**
 * Silhouette coverage test — draws EVERY ingredient at EVERY doneness level
 * through the real `foods.ts` renderers, using the real data tables.
 *
 * The smoke test only exercises whatever a turn happens to spawn; this walks the
 * full `switch` in `drawFood`/`drawFoodIcon` so no branch ships untested. A food
 * that throws, or renders with no fill, is a bug this catches.
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const ROOT = join(import.meta.dirname, '..');

// ── Recording context: tracks that each draw actually painted something ──────
let fills = 0;
let strokes = 0;
let gradientStops = 0;
let pathOps = 0;

function makeCtx() {
  const ctx = {};
  const noop = () => {};
  for (const m of [
    'save', 'restore', 'translate', 'rotate', 'scale', 'beginPath', 'closePath',
    'moveTo', 'lineTo', 'bezierCurveTo', 'quadraticCurveTo', 'arcTo', 'arc',
    'ellipse', 'rect', 'clip', 'setLineDash', 'fillRect', 'strokeRect', 'clearRect',
    'drawImage', 'fillText', 'strokeText', 'transform', 'setTransform'
  ]) {
    ctx[m] = (...a) => {
      if (m === 'beginPath' || m === 'moveTo' || m === 'arc' || m === 'ellipse') pathOps++;
    };
  }
  ctx.fill = () => { fills++; };
  ctx.stroke = () => { strokes++; };
  const grad = () => ({ addColorStop: () => { gradientStops++; } });
  ctx.createLinearGradient = grad;
  ctx.createRadialGradient = grad;
  ctx.measureText = () => ({ width: 8 });
  Object.assign(ctx, {
    globalAlpha: 1, fillStyle: '#000', strokeStyle: '#000', lineWidth: 1,
    lineCap: 'butt', lineJoin: 'miter', font: '10px sans-serif', textAlign: 'start',
    textBaseline: 'alphabetic', globalCompositeOperation: 'source-over',
    shadowColor: 'transparent', shadowBlur: 0, shadowOffsetX: 0, shadowOffsetY: 0,
    lineDashOffset: 0
  });
  return ctx;
}

// ── Bundle foods.ts + theme.ts so we import the shipped code, not a copy ─────
const ENTRY = join(ROOT, 'prototype', 'art-coverage-entry.ts');
const OUT = join(ROOT, 'prototype', 'dist', 'art-coverage.mjs');

const result = await build({
  entryPoints: [ENTRY],
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: ['node18'],
  outfile: OUT,
  logLevel: 'warning'
});
if (result.errors.length) {
  console.error('[art-coverage] FAIL — bundle errors');
  process.exit(1);
}

const mod = await import(pathToFileURL(OUT).href);
const { drawFood, drawFoodIcon, donenessColors } = mod;

// ── Real data ───────────────────────────────────────────────────────────────
const raw = JSON.parse(
  await readFile(join(ROOT, 'shared', 'data', 'ingredients.json'), 'utf8')
);
const ingredients = raw.items;

if (!Array.isArray(ingredients) || ingredients.length === 0) {
  console.error('[art-coverage] FAIL — no ingredients loaded');
  process.exit(1);
}

const ctx = makeCtx();
const donenessValues = [0, 0.2, 0.5, 0.72, 0.95, 1.19, 1.2, 1.5];
let checks = 0;
const failures = [];

for (const ing of ingredients) {
  for (const d of donenessValues) {
    fills = 0; strokes = 0; gradientStops = 0; pathOps = 0;
    try {
      drawFood(ctx, ing, 100, 100, { doneness: d, burned: d >= 1.2, scale: 1, glow: 1 });
    } catch (err) {
      failures.push(`${ing.id} @ doneness ${d}: ${err.message}`);
      continue;
    }
    checks++;
    if (fills < 2) failures.push(`${ing.id} @ ${d}: only ${fills} fills — nothing painted`);
    if (gradientStops < 2) failures.push(`${ing.id} @ ${d}: gradient has ${gradientStops} stops`);
    if (pathOps < 2) failures.push(`${ing.id} @ ${d}: no path built`);
  }

  // Icon form (bench + order cards)
  fills = 0; gradientStops = 0;
  try {
    drawFoodIcon(ctx, ing, 50, 50, 30);
  } catch (err) {
    failures.push(`${ing.id} icon: ${err.message}`);
    continue;
  }
  checks++;
  if (fills < 1) failures.push(`${ing.id} icon: nothing painted`);

  // Colour ramp must stay finite and inside 0..255 at both ends.
  for (const d of [0, 1.5]) {
    const c = donenessColors(ing, d);
    for (const [name, v] of Object.entries(c)) {
      if (!Array.isArray(v) || v.length !== 3 || v.some((n) => !Number.isFinite(n) || n < 0 || n > 255)) {
        failures.push(`${ing.id} donenessColors(${d}).${name} out of range: ${JSON.stringify(v)}`);
      }
    }
  }
}

if (failures.length) {
  console.error(`[art-coverage] FAIL — ${failures.length} problem(s):`);
  for (const f of failures.slice(0, 25)) console.error('  · ' + f);
  process.exit(1);
}

console.log(
  `[art-coverage] OK — ${ingredients.length} ingredients × ${donenessValues.length} doneness levels + icons = ${checks} draws, all painted`
);
