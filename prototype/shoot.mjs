/**
 * Renders real frames of the prototype to PNG so the art can be looked at
 * rather than merely asserted to not throw.
 *
 * Loads the same `dist/bundle.js` the browser loads, backs it with
 * @napi-rs/canvas, drives the game into the states that matter, and writes one
 * PNG per state into `prototype/shots/`.
 *
 * Usage: node prototype/shoot.mjs
 */
import { createCanvas } from '@napi-rs/canvas';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const ROOT = join(import.meta.dirname, '..');
const OUT = join(ROOT, 'prototype', 'shots');
const BUNDLE = join(ROOT, 'prototype', 'dist', 'bundle.js');

await build({
  entryPoints: [join(ROOT, 'prototype', 'src', 'main.ts')],
  bundle: true,
  format: 'esm',
  target: ['es2022'],
  outfile: BUNDLE,
  sourcemap: 'inline',
  logLevel: 'warning'
});

// ── DOM backed by a real rasterizer ─────────────────────────────────────────
const real = createCanvas(420, 780);
const listeners = new Map();

const canvasEl = {
  width: 420,
  height: 780,
  style: {},
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 420, height: 780 }),
  getContext: () => real.getContext('2d'),
  addEventListener: (t, fn) => { (listeners.get(t) ?? listeners.set(t, []).get(t)).push(fn); },
  removeEventListener: () => {},
  setPointerCapture: () => {},
  releasePointerCapture: () => {},
  hasPointerCapture: () => false
};

globalThis.document = {
  getElementById: (id) => (id === 'c' ? canvasEl : null),
  createElement: (tag) => {
    if (tag === 'canvas') {
      // Return the real Canvas instance, not a wrapper: drawBackdrop caches an
      // offscreen canvas and passes it to ctx.drawImage, which type-checks its
      // argument and rejects a plain object.
      return createCanvas(420, 780);
    }
    return { style: {} };
  },
  addEventListener: () => {},
  fonts: { ready: Promise.resolve(), load: () => Promise.resolve() }
};
globalThis.window = globalThis;
// resize() reads these to compute the layout scale. Without them scale is NaN,
// setTransform(NaN) draws nothing, and the shots come out blank — this is a
// harness bug, not a game bug (a real browser always has them).
globalThis.innerWidth = 420;
globalThis.innerHeight = 820;
globalThis.devicePixelRatio = 1;
globalThis.location = { search: '', href: 'http://localhost/' };

const rafQueue = [];
globalThis.requestAnimationFrame = (fn) => { rafQueue.push(fn); return rafQueue.length; };
globalThis.cancelAnimationFrame = () => {};
let nowMs = 0;
globalThis.performance = { now: () => nowMs };

// No WebAudio: the audio layer must degrade to a no-op, which is itself a thing
// worth exercising.
delete globalThis.AudioContext;

const cache = new Map();
globalThis.fetch = async (url) => {
  const rel = String(url).replace(/^https?:\/\/[^/]+/, '');
  let file;
  if (rel.startsWith('/data/')) file = join(ROOT, 'shared', 'data', rel.slice(6));
  else if (rel.startsWith('/l10n/')) file = join(ROOT, 'shared', 'l10n', rel.slice(6));
  else throw new Error('unexpected fetch ' + url);
  if (!cache.has(file)) cache.set(file, await readFile(file, 'utf8'));
  const body = cache.get(file);
  return { ok: true, status: 200, json: async () => JSON.parse(body), text: async () => body };
};

// ── Drive ───────────────────────────────────────────────────────────────────
const FRAME = 1000 / 60;
async function pump(frames) {
  for (let i = 0; i < frames; i++) {
    const batch = rafQueue.splice(0, rafQueue.length);
    if (!batch.length) throw new Error('render loop stalled');
    nowMs += FRAME;
    for (const fn of batch) fn(nowMs);
  }
}

function pointer(type, x, y) {
  const ev = {
    type, clientX: x, clientY: y, pointerId: 1, isPrimary: true, button: 0,
    preventDefault: () => {}, stopPropagation: () => {}, target: canvasEl
  };
  for (const fn of listeners.get(type) ?? []) fn(ev);
  const alias = { touchstart: 'pointerdown', touchmove: 'pointermove', touchend: 'pointerup' }[type];
  if (alias) for (const fn of listeners.get(alias) ?? []) fn(ev);
}

async function shot(name) {
  await mkdir(OUT, { recursive: true });
  const file = join(OUT, `${name}.png`);
  await writeFile(file, real.toBuffer('image/png'));
  console.log(`[shoot] ${name}.png`);
}

process.on('unhandledRejection', (e) => {
  console.error('[shoot] UNHANDLED INIT REJECTION:', e && e.stack ? e.stack : e);
});

await import(pathToFileURL(BUNDLE).href);
await new Promise((r) => setTimeout(r, 150));

// Sample the real canvas to confirm whether anything is being drawn at all.
{
  const px = real.getContext('2d').getImageData(210, 400, 1, 1).data;
  console.log('[shoot] pixel(210,400) after init+150ms:', [px[0], px[1], px[2], px[3]]);
}

// 1. Title screen
await pump(90);
await shot('01-title');

// 2. Start a turn
pointer('pointerdown', 210, 500);
await pump(3);
pointer('pointerup', 210, 500);
await pump(60);
await shot('02-turn-empty');

// 3. Place several items so the grill is populated
const drops = [[60, 660, 210, 250], [150, 660, 210, 330], [240, 660, 210, 410]];
for (const [sx, sy, tx, ty] of drops) {
  pointer('pointerdown', sx, sy);
  await pump(3);
  pointer('pointermove', (sx + tx) / 2, (sy + ty) / 2);
  await pump(3);
  pointer('pointermove', tx, ty);
  await pump(3);
  pointer('pointerup', tx, ty);
  await pump(20);
}

// 4. Let it cook well into the browning range
await pump(60 * 26);
await shot('03-grill-cooking');

// 5. Keep cooking until the result screen
await pump(60 * 60 * 3);
await shot('04-result');

console.log(`[shoot] frames written to prototype/shots/`);
