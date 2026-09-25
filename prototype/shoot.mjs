/**
 * Renders real frames of the prototype to PNG so the art can be looked at
 * rather than merely asserted to not throw.
 *
 * Loads the same `dist/bundle.js` the browser loads, backs it with
 * @napi-rs/canvas, drives the game into the states that matter, and writes one
 * PNG per state into `prototype/shots/`.
 *
 * The game loop caps dt at 0.1s and draws every RAF. Pumping 10 800 frames of
 * full-scene canvas work to wait out a 90s turn (~3.8 GB RSS) is how this
 * used to miss a 300s timeout. Catch-up ticks at the dt cap with
 * `__churrascoSkipDraw` set, and only rasterizes the frame we are about to
 * write. Do not "fix" a slow run by raising the timeout.
 *
 * Flow matches the current UI: splash → home (JOGAR) → play → result.
 * First-run title is skipped by seeding `ftueDone` in localStorage — the
 * live path after FTUE.
 *
 * Usage: node prototype/shoot.mjs
 */
import { createCanvas } from '@napi-rs/canvas';
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const ROOT = join(import.meta.dirname, '..');
const OUT = join(ROOT, 'prototype', 'shots');
const BUNDLE = join(ROOT, 'prototype', 'dist', 'bundle.js');
const BUDGET_MS = 60_000;

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

// Post-FTUE home (JOGAR), not the first-run title. lastLoginISO = today so the
// daily-reward modal does not steal the play tap.
const today = (() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
})();
const ls = Object.create(null);
ls.churrasco_meta_v2 = JSON.stringify({
  coins: 820, embers: 12, xp: 40, level: 3, streak: 2, longestStreak: 2,
  lastLoginISO: today, lastClaimDay: 1, turnsPlayed: 3, bestCombo: 3,
  totalPerfect: 2, collection: ['linguica_toscana', 'pao_de_alho'],
  ftueDone: true, ftueStep: 99, bonusReady: null, bonusExpiresAt: 0,
  wheelSpins: 1, lastWheelSpinISO: '',
  upgrades: { grill_size: 0 }, graceUsed: false,
  churrasqueiraId: 'lata_valente', churrasqueiraLv: { lata_valente: 1 }
});
globalThis.localStorage = {
  getItem: (k) => (Object.prototype.hasOwnProperty.call(ls, k) ? ls[k] : null),
  setItem: (k, v) => { ls[k] = String(v); },
  removeItem: (k) => { delete ls[k]; },
  clear: () => { for (const k of Object.keys(ls)) delete ls[k]; }
};

// ── Drive ───────────────────────────────────────────────────────────────────
const FRAME = 1000 / 60;
/** Game.init caps dt at 0.1s — a 100ms tick is the cheapest RAF that still
 *  advances the sim at full speed. */
const DT_CAP_MS = 100;

let paintedFrames = 0;
let skippedFrames = 0;

function skipDraw(on) {
  globalThis.__churrascoSkipDraw = on;
}

async function waitForLoop(ms = 2500) {
  const t0 = Date.now();
  while (rafQueue.length === 0) {
    if (Date.now() - t0 > ms) throw new Error('game never started the render loop');
    await new Promise((r) => setTimeout(r, 20));
  }
}

async function advance(simSec, { paint = true } = {}) {
  skipDraw(!paint);
  const tick = paint ? FRAME : DT_CAP_MS;
  let left = simSec * 1000;
  while (left > 0.5) {
    const step = Math.min(tick, left);
    const batch = rafQueue.splice(0, rafQueue.length);
    if (!batch.length) throw new Error('render loop stalled');
    nowMs += step;
    for (const fn of batch) fn(nowMs);
    if (paint) paintedFrames++;
    else skippedFrames++;
    left -= step;
  }
  skipDraw(false);
}

async function paintFrame() {
  skipDraw(false);
  const batch = rafQueue.splice(0, rafQueue.length);
  if (!batch.length) throw new Error('render loop stalled');
  nowMs += FRAME;
  for (const fn of batch) fn(nowMs);
  paintedFrames++;
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

function tap(x, y) {
  pointer('pointerdown', x, y);
  pointer('pointerup', x, y);
}

function assertPainted(name) {
  const { data } = real.getContext('2d').getImageData(0, 0, 420, 780);
  let painted = 0;
  for (let i = 0; i < data.length; i += 16 * 4) {
    if (data[i + 3] > 8 && (data[i] > 8 || data[i + 1] > 8 || data[i + 2] > 8)) painted++;
  }
  if (painted < 80) throw new Error(`[shoot] ${name} looks blank (painted samples=${painted})`);
}

async function shot(name) {
  await paintFrame();
  assertPainted(name);
  await mkdir(OUT, { recursive: true });
  const file = join(OUT, `${name}.png`);
  await writeFile(file, real.toBuffer('image/png'));
  const { size } = await stat(file);
  if (size < 8_000) throw new Error(`[shoot] ${name}.png is ${size} bytes — too small to be a real frame`);
  console.log(`[shoot] ${name}.png  ${(size / 1024).toFixed(1)} kB`);
}

process.on('unhandledRejection', (e) => {
  console.error('[shoot] UNHANDLED INIT REJECTION:', e && e.stack ? e.stack : e);
});

const wall0 = Date.now();

await import(pathToFileURL(BUNDLE).href);
await waitForLoop();

// 1. Splash (auto-advance is 1.45s; we snapshot it, then skip with a tap).
await advance(0.35, { paint: true });
await shot('01-splash');

// 2. Tap-to-skip splash → home. JOGAR lives on the home hero card (y 272–348).
tap(210, 400);
await advance(0.4, { paint: true });
await shot('02-home');

// 3. JOGAR
tap(210, 310);
await advance(0.8, { paint: true });
await shot('03-turn-empty');

// 4. Place several items so the grill is populated
const drops = [[60, 660, 210, 250], [150, 660, 210, 330], [240, 660, 210, 410]];
for (const [sx, sy, tx, ty] of drops) {
  pointer('pointerdown', sx, sy);
  await advance(0.05, { paint: true });
  pointer('pointermove', (sx + tx) / 2, (sy + ty) / 2);
  await advance(0.05, { paint: true });
  pointer('pointermove', tx, ty);
  await advance(0.05, { paint: true });
  pointer('pointerup', tx, ty);
  await advance(0.2, { paint: true });
}

// Cook into the browning range (sim only — do not raster 26s at 60 fps).
await advance(8, { paint: false });
await shot('04-grill-cooking');

// 5. First restaurant turn is 90s. We have already spent ~10s on the grill;
//    another 90s of sim is past the result screen without 10 800 draws.
await advance(90, { paint: false });
await shot('05-result');

const ms = Date.now() - wall0;
console.log(`[shoot] frames written to prototype/shots/`);
console.log(`[shoot] painted=${paintedFrames} skipped=${skippedFrames} wall=${(ms / 1000).toFixed(1)}s`);
if (ms > BUDGET_MS) {
  throw new Error(`check-shots too slow: ${ms}ms (budget ${BUDGET_MS}ms) — make the tail cheaper, do not raise the timeout`);
}
