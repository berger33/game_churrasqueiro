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
 * Flow — a fresh install, then a relaunch, exactly as a player meets it:
 *
 *   first launch   splash → title → FTUE steps 1–5 (one PNG per step, played by
 *                  following the tutorial hand) → simplified result → Home,
 *                  step 6 (buy the spotlit upgrade)
 *   relaunch       splash → Home (the FTUE must not repeat) → JOGAR → turn →
 *                  result
 *
 * It also asserts the FTUE's analytics funnel (`__churrascoAnalytics`): every
 * event in order, every event valid against analytics.json, zero misses, and
 * the whole first run under the 60 s of docs/05-UX_FLOW.md §4.
 *
 * Usage: node prototype/shoot.mjs
 */
import { createCanvas, Image as NapiImage } from '@napi-rs/canvas';
import { readFileSync } from 'node:fs';
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

// Images: the painted sprites (docs/22 §7.1) load through the real decoder, from the same
// files the dev server serves under /assets/. check-render and check-art have no Image, so
// they keep exercising the procedural fallback; this harness renders the art.
globalThis.Image = class extends NapiImage {
  set src(url) { super.src = readFileSync(join(ROOT, 'prototype', String(url).replace(/^https?:\/\/[^/]+/, ''))); }
  get src() { return super.src; }
};

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
  else if (rel.startsWith('/assets/')) file = join(ROOT, 'prototype', rel);
  else throw new Error('unexpected fetch ' + url);
  if (!cache.has(file)) cache.set(file, await readFile(file, 'utf8'));
  const body = cache.get(file);
  return { ok: true, status: 200, json: async () => JSON.parse(body), text: async () => body };
};

// A fresh install: empty storage. The relaunch below re-uses this same store.
const ls = Object.create(null);
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

/** Waits until every sprite in /assets/art/index.json is decoded (or gives up: fallback art). */
async function waitForArt(ms = 5000) {
  const t0 = Date.now();
  for (;;) {
    const a = globalThis.__churrascoArt;
    if (a && a.expected() > 0 && a.loaded() >= a.expected()) { console.log(`art: ${a.loaded()} sprites decoded`); return; }
    if (Date.now() - t0 > ms) { console.log(`art: ${a ? `${a.loaded()}/${a.expected()}` : 'no hook'} after ${ms} ms — procedural fallback`); return; }
    await new Promise((r) => setTimeout(r, 20));
  }
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
const screen = () => globalThis.__churrascoScreen;
const ftue = () => globalThis.__churrascoFtue;
const meta = () => JSON.parse(ls.churrasco_meta_v2 ?? '{}');
function assert(cond, msg) { if (!cond) throw new Error(`[shoot] ${msg}`); }

/** Advance the sim (unpainted) until `pred` holds. */
async function waitFor(pred, maxSec, what) {
  for (let t = 0; t < maxSec; t += 0.1) {
    if (pred()) return;
    await advance(0.1, { paint: false });
  }
  throw new Error(`[shoot] timed out waiting for ${what} — screen=${screen()} ftue=${JSON.stringify(ftue())}`);
}

/** What a finger does for one hand demonstration: a tap, or press → arc → release. */
async function act(hand) {
  const { from, to } = hand;
  pointer('pointerdown', from.x, from.y);
  await advance(0.05, { paint: false });
  if (to) {
    pointer('pointermove', (from.x + to.x) / 2, (from.y + to.y) / 2);
    await advance(0.05, { paint: false });
    pointer('pointermove', to.x, to.y);
    await advance(0.05, { paint: false });
    pointer('pointerup', to.x, to.y);
  } else {
    pointer('pointerup', from.x, from.y);
  }
  await advance(0.05, { paint: false });
}

/** A player who reads nothing: wait for the hand, react after 0.6 s, do what it shows. */
async function followHand(until, maxSec, what) {
  let seen = '';
  let seenAt = 0;
  for (let t = 0; t < maxSec; t += 0.1) {
    if (until()) return;
    const hand = ftue()?.hand;
    const key = hand ? `${hand.kind}@${Math.round(hand.from.x)},${Math.round(hand.from.y)}` : '';
    if (key !== seen) { seen = key; seenAt = t; }
    if (hand && t - seenAt >= 0.6) { await act(hand); seen = ''; }
    await advance(0.1, { paint: false });
  }
  throw new Error(`[shoot] FTUE stalled before ${what} — screen=${screen()} ftue=${JSON.stringify(ftue())}`);
}
const handIs = (kind) => () => ftue()?.hand?.kind === kind;

// ═══ First launch (fresh install) ════════════════════════════════════════════
await import(pathToFileURL(BUNDLE).href);
await waitForLoop();
await waitForArt();
const firstRunLog = globalThis.__churrascoAnalytics;

// 1. Splash (auto-advance is 1.45s; we snapshot it, then skip with a tap).
await advance(0.35, { paint: true });
await shot('01-splash');

// 2. A fresh install lands on the title, not Home.
tap(210, 400);
await advance(0.4, { paint: true });
assert(screen() === 'title', `fresh install should reach the title, got ${screen()}`);
await shot('02-title');

// 3. JOGAR → FTUE step 1: the hand arcs bench → grill with a linguiça. No text.
tap(210, 554);
await advance(0.05, { paint: false });
assert(screen() === 'play' && ftue()?.step === 'place', `JOGAR should start FTUE step 1, got ${screen()}/${ftue()?.step}`);
await advance(0.75, { paint: false }); // mid-arc, carrying the linguiça
await shot('03-ftue-place');
await followHand(() => ftue()?.step === 'flip', 10, 'step 2');

// 4. Step 2 before the side browns: the ring fills — "espere dourar", no prompt yet.
await advance(2.5, { paint: false });
assert(!ftue()?.hand, 'the flip prompt must wait for a browned side (docs/20)');
await shot('04-ftue-wait');

// 5. Side browned: TOQUE PARA VIRAR.
await waitFor(handIs('flip'), 15, 'the flip prompt');
await advance(0.25, { paint: false }); // the press of the tap demo
await shot('05-ftue-flip');
await followHand(() => ftue()?.step === 'serve', 5, 'step 3');

// 6. Near perfect: ARRASTE PARA O CLIENTE — the card dropped 40 px (docs/20).
await waitFor(handIs('serve'), 20, 'the serve prompt');
await advance(0.75, { paint: false });
await shot('06-ftue-serve');
await followHand(() => ftue()?.step === 'perfect', 5, 'step 4');

// 7. PERFEITO! and the coins flying to the counter.
await advance(0.3, { paint: false });
await shot('07-ftue-perfect');

// 8. Step 5 alone (the hand only returns after idle), then the simplified card.
await followHand(() => screen() === 'result', 60, 'the FTUE result');
await advance(2.2, { paint: false });
await shot('08-ftue-result');

// 9. CONTINUAR → Home, step 6: only the upgrade card is lit.
await followHand(() => screen() === 'home', 5, 'Home');
await advance(0.1, { paint: false });
assert(screen() === 'home' && ftue()?.step === 'upgrade', `CONTINUAR should open Home at step 6, got ${screen()}/${ftue()?.step}`);
await advance(0.5, { paint: false });
await shot('09-ftue-upgrade');
await followHand(() => !ftue(), 10, 'the end of the FTUE');
await advance(0.3, { paint: false });

// ── The funnel, as analytics saw it ──────────────────────────────────────────
const names = firstRunLog.map((e) => (e.name === 'tutorial_step' ? `step:${e.params.step}` : e.name));
const expected = ['tutorial_start', 'step:place', 'step:flip', 'step:serve', 'step:perfect', 'tutorial_complete', 'upgrade_purchase', 'step:upgrade'];
assert(JSON.stringify(names) === JSON.stringify(expected), `FTUE analytics: ${names.join(' → ')}`);
assert(firstRunLog.every((e) => e.valid), `event outside analytics.json: ${JSON.stringify(firstRunLog.filter((e) => !e.valid))}`);
const complete = firstRunLog.find((e) => e.name === 'tutorial_complete');
assert(complete.params.misses === 0, `following the hand cost ${complete.params.misses} misses — the hand is misleading`);
const lastStep = firstRunLog.at(-1);
assert(lastStep.params.elapsed_ms < 60_000, `first run took ${lastStep.params.elapsed_ms} ms (docs/05 §4: under 60 s)`);
const purchase = firstRunLog.find((e) => e.name === 'upgrade_purchase');
const m = meta();
assert(m.ftueDone === true && m.tutorial?.step === 7, 'FTUE should be persisted as done');
assert(m.totalPerfect >= 1, 'the guided serve should have been PERFEITO');
assert(m.upgrades?.grill_size === 1 && purchase.params.track_id === 'grill_size', 'step 6 should buy grill_size');
assert(m.clearedLevels?.includes('level_001'), 'the FTUE turn is level_001\'s first clear');
console.log(`[shoot] FTUE ${names.join(' → ')}`);
console.log(`[shoot] FTUE first PERFEITO at ${(firstRunLog.find((e) => e.params.step === 'serve').params.elapsed_ms / 1000).toFixed(1)}s, ` +
  `complete at ${(complete.params.duration_ms / 1000).toFixed(1)}s, upgrade at ${(lastStep.params.elapsed_ms / 1000).toFixed(1)}s, ` +
  `misses ${complete.params.misses}, coins left ${m.coins}`);

// ═══ Relaunch: same storage, fresh module instance ═══════════════════════════
listeners.clear();
rafQueue.length = 0;
await import(pathToFileURL(BUNDLE).href + '?relaunch=1');
await waitForLoop();
await waitForArt();
const relaunchLog = globalThis.__churrascoAnalytics;
assert(relaunchLog !== firstRunLog, 'relaunch should run a new game instance');

// 10. splash → Home directly; the FTUE does not repeat.
await advance(0.35, { paint: false });
tap(210, 400);
await advance(0.4, { paint: true });
assert(screen() === 'home' && !ftue(), `relaunch should open Home, got ${screen()} ftue=${JSON.stringify(ftue())}`);
await shot('10-home');

// Quadro extra para julgamento de UI: `CHURR_SHOT=charcoal` abre o painel dos três carvões com um
// toque real no chip do cartão e fotografa o resultado. A régua de layout é ver o quadro, não ler
// descrição — e o painel do carvão tem linhas bloqueadas, que só aparecem no nível baixo do harness.
// Fora das asserções do gate: serve para olhar, não para aprovar nada sozinho.
if (process.env.CHURR_SHOT === 'charcoal') {
  tap(126, 780 - 32);                      // barra de navegação: aba 'shop' (a garagem)
  await advance(0.15, { paint: false });
  tap(420 - 96 + 41, 356 + 58 + 13);       // charcoalChipRect(): { x: W-96, y: 356+58, w: 82, h: 26 }
  await advance(0.25, { paint: false });
  const home = globalThis.__churrascoHome;
  assert(home?.tab === 'shop', `painel testado fora da garagem (tab=${home?.tab})`);
  assert(home?.charcoalOpen === true, `toque no chip não abriu o painel de carvão (home=${JSON.stringify(home)})`);
  const pp = home.charcoalPanel;
  assert(pp && pp.y > 0 && pp.y + pp.h < 780, `painel fora da tela: ${JSON.stringify(pp)}`);
  console.log(`[shoot] painel de carvão aberto · panel=${JSON.stringify(pp)}`);
  await shot('99-charcoal-panel');
  tap(pp.x + pp.w - 40 + 13, pp.y + 14 + 13);   // centro do × (close: x=pw-40, y=py+14, 26×26)
  await advance(0.2, { paint: false });
  assert(globalThis.__churrascoHome?.charcoalOpen === false, 'botão × não fechou o painel');
  console.log('[shoot] painel de carvão fechado pelo ×');
}

// 11. JOGAR
tap(210, 310);
await advance(0.8, { paint: true });
assert(screen() === 'play', `JOGAR should start a turn, got ${screen()}`);
await shot('11-turn-empty');

// 12. Place several items so the grill is populated
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
await shot('12-grill-cooking');

// 13. First restaurant turn is 90s. We have already spent ~10s on the grill;
//     another 90s of sim is past the result screen without 10 800 draws.
await advance(90, { paint: false });
assert(screen() === 'result', `turn should end on the result screen, got ${screen()}`);
await shot('13-result');
assert(!relaunchLog.some((e) => e.name.startsWith('tutorial_')), 'no tutorial events after the FTUE is done');

const ms = Date.now() - wall0;
console.log(`[shoot] frames written to prototype/shots/`);
console.log(`[shoot] painted=${paintedFrames} skipped=${skippedFrames} wall=${(ms / 1000).toFixed(1)}s`);
if (ms > BUDGET_MS) {
  throw new Error(`check-shots too slow: ${ms}ms (budget ${BUDGET_MS}ms) — make the tail cheaper, do not raise the timeout`);
}
process.exit(0);
