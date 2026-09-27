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
import { createCanvas as nativeCanvas, Image as NapiImage } from '@napi-rs/canvas';
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

// Relaunch fixtures import distinct bundles; their module image registries stay alive.
// Share immutable decoded pixels by URL, like a browser image cache, instead of keeping
// a fresh 244-image native allocation per fixture. Every draw still uses the real decoder.
const decodedImages=new Map();
function createCanvas(w,h){
  const canvas=nativeCanvas(w,h),ctx=canvas.getContext('2d'),draw=ctx.drawImage;
  ctx.drawImage=(image,...args)=>draw.call(ctx,image?._decoded??image,...args);
  return canvas;
}

// ── DOM backed by a real rasterizer ─────────────────────────────────────────
const real = createCanvas(420, 780);
const listeners = new Map();
const lifecycle = new Map();
const listenLifecycle=(t,fn)=>{(lifecycle.get(t)??lifecycle.set(t,[]).get(t)).push(fn);};
const dispatchLifecycle=t=>{for(const fn of lifecycle.get(t)??[])fn();};

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
  visibilityState: 'visible',
  addEventListener: listenLifecycle,
  fonts: { ready: Promise.resolve(), load: () => Promise.resolve() }
};
globalThis.window = globalThis;
globalThis.addEventListener=listenLifecycle;
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
globalThis.Image = class {
  _decoded=null; onload=null; onerror=null; _src='';
  set src(url){
    this._src=url;
    if(!decodedImages.has(url)){
      const image=new NapiImage();
      const ready=new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=reject;});
      decodedImages.set(url,{image,ready});
      image.src=readFileSync(join(ROOT,'prototype',String(url).replace(/^https?:\/\/[^/]+/,'')));
    }
    const entry=decodedImages.get(url);this._decoded=entry.image;
    entry.ready.then(()=>this.onload?.()).catch(e=>this.onerror?.(e));
  }
  get src(){return this._src;}
  get width(){return this._decoded?.width??0;}
  get height(){return this._decoded?.height??0;}
  get naturalWidth(){return this.width;}
  get naturalHeight(){return this.height;}
  get complete(){return this.width>0;}
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
listeners.clear();lifecycle.clear();
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

// ═══ A-01 advanced fixture: real bundle, sprites and pointer input ═══════════
// Only the authored starting level and saved progression are fixtures. Recipe,
// heat, flip, input and UI all run unchanged; this is NOT a campaign-unlock proof.
const levelFile = join(ROOT, 'shared', 'data', 'levels.json');
const advancedLevels = JSON.parse(cache.get(levelFile));
advancedLevels.levels[0].restaurantIndex = 4;
advancedLevels.levels[0].turnLengthSec = 180;
cache.set(levelFile, JSON.stringify(advancedLevels));
const advancedMeta = meta();
advancedMeta.level = 44;
advancedMeta.churrasqueiraId = 'fornalha_dragao_manso';
advancedMeta.churrasqueiraLv.fornalha_dragao_manso = 3;
localStorage.setItem('churrasco_meta_v2', JSON.stringify(advancedMeta));
listeners.clear();lifecycle.clear(); rafQueue.length = 0;
await import(pathToFileURL(BUNDLE).href + '?advanced-a01=1');
await waitForLoop(); await waitForArt();
await advance(0.35, { paint: false }); tap(210, 400);
await advance(0.4, { paint: false });
assert(screen() === 'home', 'advanced fixture must reach Home');
tap(210, 310); await advance(0.3, { paint: false });
const cooking = () => globalThis.__churrascoCooking;
assert(screen() === 'play' && cooking()?.pages === 2, 'advanced bench must expose two pages');
assert(cooking().zones.length === 4, 'A-04 Premium + Fornalha must expose four real zones');
const pageButton = cooking().pager;
assert(pageButton && pageButton.w >= 48 && pageButton.h >= 48, 'pager needs a touch-sized hitbox');
tap(pageButton.x + pageButton.w/2, pageButton.y + pageButton.h/2);
await advance(0.1, { paint: false });
assert(cooking().page === 1, 'the DRAWN pager must respond to a tap');
for (const id of ['costela', 'cupim']) assert(cooking().bench.some(b => b.id === id), `${id} must be reachable on page 2`);
await shot('14-advanced-bench');
// Wrap and come back, to check both directions without adding extra controls.
for (const expectedPage of [0, 1]) {
  tap(pageButton.x + pageButton.w/2, pageButton.y + pageButton.h/2);
  await advance(0.1, { paint: false });
  assert(cooking().page === expectedPage, 'pager must wrap without changing the selected recipe');
}
for (const id of ['costela', 'cupim']) {
  const b = cooking().bench.find(b => b.id === id);
  await act({ from: { x: b.x+b.w/2, y: b.y+b.h/2 }, to: cooking().zones[0] });
  await advance(0.1, { paint: false });
  assert(cooking().foods.some(f => f.id === id && f.flips === 0 && !f.flipHint), `${id}: page-2 pickup/drop must produce the right fresh plate without an early hint`);
}
let hintShot = false;
const perfectSeen = new Set();
for (let t = 0; t < 100 && perfectSeen.size < 2; t += 0.1) {
  for (const id of ['costela', 'cupim']) {
    const f = cooking().foods.find(f => f.id === id);
    assert(f && !f.burned, `${id} must not burn while following the flip cue`);
    if (f.flipHint && f.flips === 0) {
      if (!hintShot) { await shot('15-advanced-flip-hint'); hintShot = true; }
      tap(f.x, f.y); await advance(0.1, { paint: false });
      const flipped = cooking().foods.find(f => f.id === id);
      assert(flipped.flips === 1 && !flipped.flipHint, `${id}: tap must flip once and clear the hint`);
    }
    if (f.perfect && !perfectSeen.has(id)) {
      perfectSeen.add(id);
      await shot(id === 'costela' ? '16-costela-perfect-window' : '17-cupim-perfect-window');
    }
  }
  await advance(0.1, { paint: false });
}
assert(hintShot && perfectSeen.size === 2, 'both slow cuts must reach their perfect window through real pointer input');
console.log('[shoot] A-01: page 2 → costela/cupim → wait for cue → tap flips once → both perfect windows');

// ═══ A-02 progression boundary in the actual UI ═════════════════════════════
const ingredientTable = JSON.parse(await readFile(join(ROOT, 'shared', 'data', 'ingredients.json'), 'utf8'));
for (const playerLevel of [1, 5, 6, 7]) {
  const fixture = JSON.parse(cache.get(levelFile));
  fixture.levels[0].restaurantIndex = 0;
  cache.set(levelFile, JSON.stringify(fixture));
  const saved = meta(); saved.level = playerLevel;
  localStorage.setItem('churrasco_meta_v2', JSON.stringify(saved));
  listeners.clear();lifecycle.clear(); rafQueue.length = 0;
  await import(pathToFileURL(BUNDLE).href + `?a02-player-level=${playerLevel}`);
  await waitForLoop(); await waitForArt();
  await advance(0.35, { paint: false }); tap(210, 400);
  await advance(0.4, { paint: false }); tap(210, 310);
  await advance(1.5, { paint: false });
  assert(screen() === 'play' && cooking().playerLevel === playerLevel, 'normal turn must receive saved PLAYER level');
  const available = ingredientTable.items.filter(i => i.unlock.restaurantIndex <= 0 && i.unlock.level <= playerLevel);
  const grillIds = available.filter(i => i.cookMethod === 'grill').map(i => i.id);
  assert(JSON.stringify(cooking().bench.map(i => i.id)) === JSON.stringify(grillIds), `A-02 level ${playerLevel}: bench must use BOTH unlock requirements`);
  assert(cooking().orders.length > 0, 'must observe actual generated orders, not only the bench');
  for (const c of cooking().orders) for (const id of c.ingredients) {
    assert(available.some(i => i.id === id), `A-02 level ${playerLevel}: order includes a locked item ${id}`);
  }
  if (playerLevel === 1) {
    await act({ from: { x: 215, y: 607 }, to: cooking().zones[0] });
    await advance(0.1, { paint: false });
    assert(cooking().foods.length === 0, 'old locked cheese slot must not retain a phantom hitbox');
  }
  if (playerLevel === 5) await shot('18-before-cheese-unlock');
  if (playerLevel === 6 || playerLevel === 7) {
    const b = cooking().bench.find(i => i.id === 'queijo_coalho');
    assert(b, 'cheese unlocks at exactly level 6 and stays unlocked');
    await act({ from: { x: b.x+b.w/2, y: b.y+b.h/2 }, to: cooking().zones[0] });
    await advance(0.1, { paint: false });
    assert(cooking().foods.some(f => f.id === 'queijo_coalho'), 'newly unlocked cheese must be pickable/placeable');
    if (playerLevel === 6) await shot('19-cheese-unlocked');
  }
}
console.log('[shoot] A-02: saved levels 1/5/6/7 → matching bench/orders → no phantom locked slot → cheese draggable at 6/7');

// ═══ A-03: prep unlock in the actual bundle, no state-mutating game hooks ═══
for (const playerLevel of [11, 12, 13]) {
  const saved = meta(); saved.level = playerLevel;
  localStorage.setItem('churrasco_meta_v2', JSON.stringify(saved));
  listeners.clear();lifecycle.clear(); rafQueue.length = 0;
  await import(pathToFileURL(BUNDLE).href + `?a03-player-level=${playerLevel}`);
  await waitForLoop(); await waitForArt();
  await advance(0.35, { paint: false }); tap(210, 400);
  await advance(0.4, { paint: false }); tap(210, 310);
  await advance(1.5, { paint: false });
  const prep = cooking().bench.find(i => i.id === 'vinagrete');
  assert(Boolean(prep) === (playerLevel >= 12), `A-03 level ${playerLevel}: vinagrete must be reachable exactly at 12`);
  if (playerLevel === 11) {
    assert(cooking().prep.length === 0, 'no prep hitbox before unlock');
    await shot('20-before-prep-unlock');
    continue;
  }
  const centre = r => ({ x: r.x+r.w/2, y: r.y+r.h/2 });
  const refresh = () => advance(0.02, { paint: false });
  const dragNow = (from, to, cancel = false) => {
    pointer('pointerdown', from.x, from.y);
    pointer('pointermove', to.x, to.y);
    pointer(cancel ? 'pointercancel' : 'pointerup', to.x, to.y);
  };
  const source = centre(prep), station = () => centre(cooking().prep[0]);
  const rawCount = cooking().activeFoods;
  dragNow(source, cooking().zones[0]); await refresh();
  assert(cooking().activeFoods === rawCount && cooking().foods.length === 0, 'prep cannot go to grill or leak raw stock');
  dragNow(source, station(), true); await refresh();
  assert(cooking().prep[0].uid === null && cooking().activeFoods === rawCount, 'pointercancel must not start prep');
  if (playerLevel === 12) tap(source.x, source.y);
  else dragNow(source, station());
  await advance(0.5, { paint: false });
  const first = cooking().prep[0];
  assert(first.uid !== null && first.progress > 0 && first.progress < 1, 'tap/drag starts timed prep off grill');
  tap(source.x, source.y); await refresh();
  assert(cooking().prep[0].uid === first.uid && cooking().activeFoods === rawCount+1, 'full prep rejects extra stock without leaks');
  const early = cooking().orders.find(c => c.state === 'waiting');
  const coinsBefore = cooking().coins, xpBefore = cooking().xp;
  dragNow(station(), centre(early)); await refresh();
  assert(cooking().coins === coinsBefore && cooking().xp === xpBefore && cooking().prep[0].uid === first.uid, 'premature drop cannot pay or release capacity');
  if (playerLevel === 12) await shot('21-prep-in-progress');
  await advance(2, { paint: false });
  assert(cooking().prep[0].progress === 1, 'prep becomes ready after recipe duration');
  dragNow(station(), cooking().zones[0]); await refresh();
  assert(cooking().prep[0].uid === first.uid && cooking().foods.length === 0, 'ready prep still cannot touch coals');
  dragNow(station(), centre(early), true); await refresh();
  assert(cooking().prep[0].uid === first.uid && cooking().coins === coinsBefore, 'cancelled drag cannot serve/discard ready food');
  // The gap inside the prep strip is not a discard target.
  dragNow(station(), { x: 75, y: 750 }); await refresh();
  assert(cooking().prep[0].uid === first.uid, 'dropping in prep whitespace must not discard a ready portion');
  if (playerLevel === 13) {
    dragNow(station(), source); await refresh();
    assert(cooking().prep[0].uid === null && cooking().activeFoods === rawCount, 'drop onto stock discards and releases station');
    continue;
  }
  await shot('22-prep-ready');
  // Wait for an actual seeded order, never write customer/food state through a hook.
  const wantsPrep = () => cooking().orders.find(c => c.state === 'waiting' && c.ingredients.includes('vinagrete'));
  // Clear other natural orders with actual grill gestures, so the on-screen cap cannot
  // hide later arrivals behind two long patience budgets.
  for (let i = 0; i < 1300 && !wantsPrep() && screen() === 'play'; i++) {
    for (const c of cooking().orders.filter(c => c.state === 'waiting')) {
      for (let line = 0; line < c.ingredients.length; line++) {
        if (c.fulfilled[line]) continue;
        const id = c.ingredients[line];
        const f = cooking().foods.find(f => f.id === id && !f.burned);
        if (f?.flipHint) { tap(f.x, f.y); await refresh(); }
        else if (f?.perfect) { dragNow(f, centre(c)); await refresh(); }
        else if (!f) {
          const stock = cooking().bench.find(b => b.id === id);
          if (stock) { dragNow(centre(stock), cooking().zones[0]); await refresh(); }
        }
      }
    }
    await advance(0.1, { paint: false });
  }
  const customer = wantsPrep();
  assert(customer, 'seeded normal turn must produce a reachable vinagrete order');
  const payoutBefore = { coins: cooking().coins, xp: cooking().xp, items: cooking().counters.itemsCooked };
  dragNow(station(), centre(customer)); await refresh();
  const served = cooking().orders.find(c => c.uid === customer.uid);
  const line = customer.ingredients.indexOf('vinagrete');
  assert(served.fulfilled[line] === 1 && cooking().prep[0].uid === null, 'real drop fulfills prep line and frees slot');
  assert(cooking().coins > payoutBefore.coins && cooking().xp > payoutBefore.xp && cooking().counters.itemsCooked === payoutBefore.items+1, 'real prep rewards counted exactly once');
  await shot('23-prep-served');
  console.log(`[shoot] A-03: actual order ${customer.uid} (${customer.ingredients}) served prep, coins=${cooking().coins} xp=${cooking().xp}`);

}

// Capacity fixture: largest restaurant + max board = 10 real slots over two pages.
// Only saved progression/authored restaurant are fixtures, not runtime food/customer state.
{
  const fixture = JSON.parse(cache.get(levelFile)); fixture.levels[0].restaurantIndex = 6;
  cache.set(levelFile, JSON.stringify(fixture));
  const saved = meta(); saved.level = 44; saved.upgrades.board = 5; saved.upgrades.counter = 5; // finite stock for ten simultaneous prep portions
  localStorage.setItem('churrasco_meta_v2', JSON.stringify(saved));
  listeners.clear();lifecycle.clear(); rafQueue.length = 0;
  await import(pathToFileURL(BUNDLE).href + '?a03-capacity=10');
  await waitForLoop(); await waitForArt();
  await advance(0.35, { paint: false }); tap(210, 400);
  await advance(0.4, { paint: false }); tap(210, 310);
  await advance(0.2, { paint: false });
  let prep = cooking().bench.find(i => i.id === 'vinagrete');
  if (!prep) { const b = cooking().pager; tap(b.x+b.w/2, b.y+b.h/2); await advance(0.02, { paint: false }); prep = cooking().bench.find(i => i.id === 'vinagrete'); }
  assert(prep && cooking().prepPager, 'prep stock and capacity pager must be reachable');
  for (let i = 0; i < 12; i++) { tap(prep.x+prep.w/2, prep.y+prep.h/2); await advance(0.02, { paint: false }); }
  assert(cooking().activeFoods === 10 && cooking().prep.every(s => s.uid !== null), '10 slots admit exactly 10 portions, not 12');
  assert(cooking().bench.find(i=>i.id==='vinagrete').remaining===1,'A-06.2: full prep failures do not debit the eleventh unit');
  assert(cooking().prep[0].slot === 5, 'auto-start follows the new portion to page 2');
  await advance(2, { paint: false });
  await shot('24-prep-capacity-page-2');
  const pager = cooking().prepPager; tap(pager.x+pager.w/2, pager.y+pager.h/2);
  await advance(0.02, { paint: false });
  assert(cooking().prep[0].slot === 0 && cooking().prep.every(s => s.progress === 1), 'page 1 retains ready portions');
  const target = cooking().prep[2];
  pointer('pointerdown', target.x+target.w/2, target.y+target.h/2);
  pointer('pointermove', prep.x+prep.w/2, prep.y+prep.h/2);
  pointer('pointerup', prep.x+prep.w/2, prep.y+prep.h/2);
  await advance(0.02, { paint: false });
  assert(cooking().prep[2].uid === null && cooking().activeFoods === 9, 'neighbor hitbox discards only selected slot');
  assert(cooking().bench.find(i=>i.id==='vinagrete').remaining===1,'discard does not refund prep stock');
  tap(prep.x+prep.w/2, prep.y+prep.h/2); await advance(0.02, { paint: false });
  assert(cooking().prep[2].uid !== null && cooking().prep[2].progress < 1 && cooking().activeFoods === 10, 'discarded capacity reusable with fresh timer');
}
console.log('[shoot] A-03: unlock 11/12/13, tap/drag, invalid drops, cancellation, timing, real service, discard, 10 slots + paging');

// ═══ A-04: joint restaurant/hardware requirement and actual fourth-row input ═══
for (const [restaurantIndex, id, evo, expected] of [
  [3,'fornalha_dragao_manso',3,3], [4,'fornalha_dragao_manso',1,4],
  [4,'fornalha_dragao_manso',2,4], [4,'fornalha_dragao_manso',3,4],
  [5,'fornalha_dragao_manso',3,4], [6,'fornalha_dragao_manso',3,4],
  [4,'lata_valente',3,1], [4,'ze_da_esquina',3,2], [4,'parrilla_chef_cisma',3,3]
]) {
  const fixture = JSON.parse(cache.get(levelFile)); fixture.levels[0].restaurantIndex = restaurantIndex;
  cache.set(levelFile, JSON.stringify(fixture));
  const saved = meta(); saved.level = 44; saved.upgrades = {};
  saved.churrasqueiraId = id; saved.churrasqueiraLv[id] = evo;
  localStorage.setItem('churrasco_meta_v2', JSON.stringify(saved));
  listeners.clear();lifecycle.clear(); rafQueue.length = 0;
  await import(pathToFileURL(BUNDLE).href + `?a04=${restaurantIndex}-${id}-${evo}`);
  await waitForLoop(); await waitForArt();
  await advance(0.35, { paint: false }); tap(210, 400); await advance(0.4, { paint: false });
  assert(globalThis.__churrascoHome.equippedZoneCount === expected, 'Home must show the same joint unlock as the turn');
  tap(210,310); await advance(1.5, { paint: false });
  assert(cooking().zones.length === expected && cooking().zoneCountBadge === expected, `A-04 ${restaurantIndex}/${id}/${evo}: expected ${expected} zones in runtime AND badge`);
  assert(cooking().zones.every(z => z.label && !/^F[0-9]/.test(z.label)), 'zone labels must resolve from l10n, never F4 fallback');
  if (restaurantIndex === 3) await shot('25-before-fourth-zone');
  if (id === 'parrilla_chef_cisma') await shot('29-premium-without-fornalha');
  if (restaurantIndex !== 4 || id !== 'fornalha_dragao_manso' || evo !== 3) continue;
  assert(cooking().zones[3].label === 'MÉDIA EXTRA' && cooking().zones[3].heat === cooking().zones[1].heat, 'extra row must really be medium, not a stretched high profile');
  await shot('26-fourth-zone-unlocked');
  const centre = r => ({ x:r.x+r.w/2, y:r.y+r.h/2 });
  const refresh = () => advance(.02, { paint:false });
  const dragNow = (from,to) => { pointer('pointerdown',from.x,from.y);pointer('pointermove',to.x,to.y);pointer('pointerup',to.x,to.y); };
  const customer = cooking().orders.find(c => c.state === 'waiting');
  assert(customer && customer.ingredients.includes('coracao_frango') && customer.ingredients.includes('frango_coxa'), 'natural seeded order must contain the two tested grill recipes');
  for (const [recipe,z] of [['coracao_frango',3],['frango_coxa',2]]) {
    const stock=cooking().bench.find(b=>b.id===recipe); assert(stock,'requested recipe must be reachable');
    dragNow(centre(stock),cooking().zones[z]); await refresh();
    assert(cooking().foods.some(f=>f.id===recipe && f.zoneIndex===z),'drop must reach the intended third/fourth row');
  }
  let neighbor=cooking().foods.find(f=>f.id==='frango_coxa');
  dragNow(neighbor,cooking().zones[3]); await refresh();
  assert(cooking().foods.every(f=>f.zoneIndex===3) && cooking().foods.length===2, 'moving the neighboring plate must not select/remove the fourth-row plate');
  const portion=cooking().foods.find(f=>f.id==='coracao_frango');
  dragNow(portion,cooking().zones[2]); await refresh();
  assert(cooking().foods.find(f=>f.uid===portion.uid).zoneIndex===2,'nearest-plate hit test must allow moving out of fourth row');
  dragNow(cooking().foods.find(f=>f.uid===portion.uid),cooking().zones[3]); await refresh();
  await advance(1,{paint:false}); await shot('27-fourth-zone-cooking');
  const before={coins:cooking().coins,xp:cooking().xp,items:cooking().counters.itemsCooked,orders:cooking().counters.ordersCompleted};
  for(let i=0;i<700;i++) {
    for(const f of cooking().foods) {
      if(f.flipHint){tap(f.x,f.y);await refresh();}
      else if(f.perfect){
        const c=cooking().orders.find(c=>c.uid===customer.uid);
        if(c?.state==='waiting'){dragNow(f,centre(c));await refresh();}
      }
    }
    if(cooking().counters.ordersCompleted>before.orders) break;
    await advance(.1,{paint:false});
  }
  assert(cooking().counters.ordersCompleted===before.orders+1 && cooking().counters.itemsCooked===before.items+2,'actual fourth-row cooking/flip/drop must complete both natural order lines once');
  assert(cooking().coins>before.coins && cooking().xp>before.xp && cooking().counters.flips>=2,'real fourth zone must cook, flip and pay');
  assert(!cooking().foods.some(f=>['coracao_frango','frango_coxa'].includes(f.id)),'served portions must free the row');
  await shot('28-fourth-zone-order-served');
}
console.log('[shoot] A-04: Home/runtime/HUD agree; Fornalha3→4 at Premium, evo1/2/3; others1/2/3; real fourth-row placement/move/flip/mixed-order service');

// A-05: only level/save fixtures; all reward/placement/flip/serve input uses real pointers.
{
  const centre=r=>({x:r.x+r.w/2,y:r.y+r.h/2});
  const click=async r=>{const p=centre(r);tap(p.x,p.y);await advance(.03,{paint:false});};
  const refresh=()=>advance(.02,{paint:false});
  const dragNow=(from,to)=>{pointer('pointerdown',from.x,from.y);pointer('pointermove',to.x,to.y);pointer('pointerup',to.x,to.y);};
  const home=()=>globalThis.__churrascoHome;
  let launchId=0;
  async function launch(){
    listeners.clear();lifecycle.clear();rafQueue.length=0;
    await import(pathToFileURL(BUNDLE).href+`?a05=${++launchId}`);await waitForLoop();await waitForArt();
    await advance(.35,{paint:false});tap(210,400);await advance(.4,{paint:false});
    assert(home()?.vip,'VIP call must be exposed by the real Home, not only core tests');
  }
  const fixture=JSON.parse(cache.get(levelFile));
  fixture.levels[0].restaurantIndex=1;fixture.levels[0].vipChance=0;
  cache.set(levelFile,JSON.stringify(fixture));
  const saved=meta();delete saved.vip;saved.level=12;saved.turnsPlayed=9;saved.bonusReady=null;
  saved.churrasqueiraId='parrilla_chef_cisma';saved.churrasqueiraLv.parrilla_chef_cisma=3;
  localStorage.setItem('churrasco_meta_v2',JSON.stringify(saved));
  await launch();assert(home().vip.status==='ready','eligible Home starts ready');await shot('30-vip-home-test');
  await click(home().vip.card);assert(home().vip.modal,'opening the offer must not grant a visit');
  assert(meta().vip.usedToday===0&&!meta().vip.pendingCall,'offer alone is not a reward');
  await shot('31-vip-explicit-simulation');
  await click(home().vip.modal.cancel);assert(!meta().vip.pendingCall&&meta().vip.usedToday===0,'cancel never pays or consumes quota');
  tap(210,310);await advance(fixture.levels[0].turnLengthSec+1,{paint:false});
  assert(screen()==='result'&&meta().vip.usedToday===0,'authored chance zero must remain zero through a whole real UI turn');
  await launch();await click(home().vip.card);await click(home().vip.modal.confirm);
  assert(meta().vip.pendingCall&&meta().vip.usedToday===1,'completion atomically reserves one visit');
  assert(globalThis.__churrascoAnalytics.filter(e=>e.name==='rewarded_complete').length===1,'exactly one test reward completion');
  assert(globalThis.__churrascoAnalytics.every(e=>e.valid),'test rewarded analytics follow the declared taxonomy');
  const reserved=meta().vip.pendingCall;
  await launch();assert(home().vip.state.pendingCall===reserved&&home().vip.status==='reserved','reservation survives relaunch');
  await shot('32-vip-reserved-after-relaunch');
  tap(210,310);await advance(1.5,{paint:false});
  const customer=cooking().orders.find(c=>c.id==='vip');assert(customer,'reserved VIP must arrive even with natural chance zero');
  assert(meta().vip.pendingCall===null&&meta().vip.usedToday===1,'arrival consumes reservation, not a second quota slot');
  const arrival=globalThis.__churrascoAnalytics.find(e=>e.name==='vip_arrival');
  assert(arrival?.params.source==='called'&&arrival.valid,'real arrival analytics identifies called source');
  await shot('33-vip-called-arrival');
  console.log('[shoot] A-05 called order:',customer.ingredients);
  for(let i=0;i<850&&screen()==='play'&&cooking().counters.vipServed===0;i++) {
    const c=cooking().orders.find(c=>c.uid===customer.uid);
    assert(c?.state==='waiting','VIP must stay until its actual order can be completed');
    for(let line=0;line<c.ingredients.length;line++) {
      if(c.fulfilled[line])continue;
      const id=c.ingredients[line],ing=ingredientTable.items.find(i=>i.id===id);
      let stock=cooking().bench.find(b=>b.id===id);
      if(!stock&&cooking().pager){await click(cooking().pager);stock=cooking().bench.find(b=>b.id===id);}
      if(ing.cookMethod==='prep') {
        const slot=cooking().prep.find(p=>p.uid!==null);
        if(slot?.progress===1){dragNow(centre(slot),centre(c));await refresh();}
        else if(!slot&&stock){await click(stock);}
      } else {
        const f=cooking().foods.find(f=>f.id===id&&!f.burned);
        if(f?.flipHint){tap(f.x,f.y);await refresh();}
        else if(f?.perfect){dragNow(f,centre(c));await refresh();}
        else if(!f&&stock){dragNow(centre(stock),cooking().zones[{low:0,medium:1,high:2}[ing.idealZone]]);await refresh();}
      }
    }
    await advance(.1,{paint:false});
  }
  assert(cooking().counters.vipServed===1&&cooking().coins>0,'actual order pays and completes VIP once');
  assert(globalThis.__churrascoAnalytics.filter(e=>e.name==='vip_served').length===1,'one VIP completion, not once per plate');
  await shot('34-vip-order-served');
  await advance(fixture.levels[0].turnLengthSec+1,{paint:false});assert(screen()==='result','VIP turn must finish through normal loop');
  assert(meta().vip.servedTotal===1&&meta().vip.claimedAchievements.includes('vip_1'),'completed-turn payout persists VIP achievement');
  assert(globalThis.__churrascoResult?.vipReward?.coins===1000 && globalThis.__churrascoResult.vipReward.embers===3,'result must disclose VIP achievement currency separately from plate/level rewards');
  await shot('37-vip-achievement-result');
  await launch();assert(home().vip.status==='cooldown'&&home().vip.state.servedTotal===1,'cooldown/progress survive a second reload');

  // Separate player fixture: natural visits, no offer/claim, same real caller and normal clock.
  fixture.levels[0].vipChance=1;cache.set(levelFile,JSON.stringify(fixture));
  const free=meta();delete free.vip;free.turnsPlayed=9;free.bonusReady=null;
  localStorage.setItem('churrasco_meta_v2',JSON.stringify(free));await launch();
  tap(210,310);await advance(1.5,{paint:false});
  assert(cooking().orders.some(c=>c.id==='vip'),'natural configured chance must reach real gameplay');
  assert(globalThis.__churrascoAnalytics.find(e=>e.name==='vip_arrival')?.params.source==='natural','natural visit must not pretend a rewarded callback');
  await shot('35-vip-natural-arrival');
  await advance(fixture.levels[0].turnLengthSec+1,{paint:false});assert(meta().vip.usedToday===2&&meta().vip.sequence===0,'two natural visits, zero calls');
  await launch();assert(home().vip.status==='limit','natural visitors exhaust the shared call cap');await shot('36-vip-daily-limit');
  tap(210,310);await advance(fixture.levels[0].turnLengthSec+1,{paint:false});
  assert(!globalThis.__churrascoAnalytics.some(e=>e.name==='vip_arrival'),'persisted cap blocks the next turn as well');
  fixture.levels[0].restaurantIndex=0;cache.set(levelFile,JSON.stringify(fixture));
  const initial=meta();delete initial.vip;localStorage.setItem('churrasco_meta_v2',JSON.stringify(initial));
  await launch();assert(home().vip.status==='locked','initial restaurant blocks VIP call');
  await click(home().vip.card);assert(!home().vip.modal,'locked card has no hidden claim hitbox');
  tap(210,310);await advance(fixture.levels[0].turnLengthSec+1,{paint:false});
  assert(!globalThis.__churrascoAnalytics.some(e=>e.name==='vip_arrival'),'initial restaurant blocks natural chance one too');
  console.log('[shoot] A-05: zero/one authored chance; cancel/complete; persistent reserved call, real cooking/flip/service, VIP achievement; natural no-ads, shared cap/relaunch, starter locked');
}

// A-06.1: save/level fixtures only; purchasing and paging use real pointer input.
{
  const centre=r=>({x:r.x+r.w/2,y:r.y+r.h/2});
  const click=async r=>{const p=centre(r);tap(p.x,p.y);await advance(.03,{paint:false});};
  const home=()=>globalThis.__churrascoHome;
  const fixture=JSON.parse(cache.get(levelFile));
  Object.assign(fixture.levels[0],{restaurantIndex:4,vipChance:0,maxOrdersOnScreen:3,spawnIntervalSec:.1,patienceScalar:100});
  cache.set(levelFile,JSON.stringify(fixture));
  const saved=meta();saved.coins=10000000;saved.level=44;saved.turnsPlayed=9;saved.bonusReady=null;
  saved.upgrades={capacity:5,tables:6,grill_stability:2,garcom:2,caixa:2,board:3};
  localStorage.setItem('churrasco_meta_v2',JSON.stringify(saved));
  let launchId=0;
  async function launch(){listeners.clear();lifecycle.clear();rafQueue.length=0;await import(pathToFileURL(BUNDLE).href+`?a061=${++launchId}`);await waitForLoop();await waitForArt();await advance(.35,{paint:false});tap(210,400);await advance(.4,{paint:false});}
  await launch();tap(126,750);await advance(.05,{paint:false});
  assert(home()?.catalog?.cards?.length,'A-06.1: real Shop must expose the upgrade catalog');
  const seen=new Set(),resourcesBought=new Set(),staffBought=new Set();let bought=false;
  for(let page=0;page<home().catalog.pages;page++){
    for(const card of home().catalog.cards){
      seen.add(card.id);
      if(['caixa','gerente','imperio_logistica'].includes(card.id)){
        const before=meta().coins,level=card.recordedLevel;await click(card.buy);
        assert(meta().coins===before-card.cost&&meta().upgrades[card.id]===level+1,'A-06.4: real offline consumer unlocks purchase, preserving historic levels and exact quote');
      }
      if(['grill_stability','charcoal_quality','charcoal_auto','counter'].includes(card.id)){
        const before=meta().coins,level=card.recordedLevel;await click(card.buy);
        assert(meta().coins===before-card.cost&&meta().upgrades[card.id]===level+1,'A-06.2: exact shared quote debits and preserves resource history');resourcesBought.add(card.id);
      }
      if(['garcom','auxiliar','churrasqueiro','tray'].includes(card.id)){
        const before=meta().coins,level=card.recordedLevel;await click(card.buy);
        assert(meta().coins===before-card.cost&&meta().upgrades[card.id]===level+1,'A-06.3: shared staff purchase preserves historical level and exact price');staffBought.add(card.id);
      }
      if(card.id==='grill_size'){
        const coins=meta().coins;await click(card.buy);
        assert(meta().coins===coins-card.cost&&meta().upgrades.grill_size===1,'catalog debits shared exact quote');bought=true;
      }
      if(card.id==='capacity'){
        const before=JSON.stringify(meta());await click(card.buy);
        assert(JSON.stringify(meta())===before,'maxed catalog card cannot buy again');
      }
    }
    if(page===0)await shot('38-upgrade-catalog');
    await click(home().catalog.next);
  }
  assert(seen.size===27&&bought&&resourcesBought.size===4&&staffBought.size===4,'all 27 tracks must be reachable through the real pager');
  await launch();assert(meta().upgrades.grill_size===1&&meta().upgrades.grill_stability===3&&meta().upgrades.garcom===3&&meta().upgrades.auxiliar===1&&meta().upgrades.churrasqueiro===1&&meta().upgrades.tray===1&&meta().upgrades.caixa===3&&meta().upgrades.gerente===1&&meta().upgrades.imperio_logistica===1&&meta().upgrades.counter===1&&meta().upgrades.charcoal_auto===1&&meta().upgrades.charcoal_quality===1,'purchases and preserved offline history survive relaunch');
  // Isolate the manual paged-order proof from automatic service; purchase history was checked above.
  const manualFixture=meta();for(const id of ['garcom','auxiliar','churrasqueiro','tray'])manualFixture.upgrades[id]=0;
  localStorage.setItem('churrasco_meta_v2',JSON.stringify(manualFixture));await launch();
  tap(210,310);await advance(4,{paint:false});
  assert(cooking().orders.filter(c=>c.state==='waiting').length===14,'authored base3 + capacity5 + tables6 reaches14 orders');
  assert(cooking().orderPager,'overflow must have a real order pager');
  const reached=new Set();
  for(let i=0;i<5;i++){
    for(const c of cooking().orders.filter(c=>c.visible)){reached.add(c.uid);assert(c.y+c.h<224,'orders cannot cover the grill');}
    await click(cooking().orderPager.next);
  }
  assert(reached.size===14,'every active order has a reachable page');
  await shot('39-orders-paged');
  // A touch on the pager cannot accidentally put food on the grill.
  assert(cooking().activeFoods===0,'order pager is not a phantom grill/stock hitbox');
  await click(cooking().orderPager.next);
  let target=cooking().orders.find(c=>c.visible&&c.state==='waiting');
  const targetId=target.uid,ingredientId=target.ingredients[0];
  const ing=ingredientTable.items.find(i=>i.id===ingredientId);
  let stock=cooking().bench.find(b=>b.id===ingredientId);
  if(!stock){await click(cooking().pager);stock=cooking().bench.find(b=>b.id===ingredientId);}
  assert(stock,'off-page order ingredient is reachable');
  const drag=(from,to)=>{pointer('pointerdown',from.x,from.y);pointer('pointermove',to.x,to.y);pointer('pointerup',to.x,to.y);};
  if(ing.cookMethod==='prep'){
    await click(stock);await advance(2.1,{paint:false});
    const slot=cooking().prep.find(p=>p.progress===1);assert(slot,'prep readies through real station');
    target=cooking().orders.find(c=>c.uid===targetId);drag(centre(slot),centre(target));
  }else{
    drag(centre(stock),cooking().zones[{low:0,medium:1,high:2}[ing.idealZone]]);
    for(let i=0;i<1300;i++){
      await advance(.05,{paint:false});const f=cooking().foods.find(f=>f.id===ingredientId);
      assert(f&&!f.burned,'real off-page order must cook without a state injection');
      if(f.flipHint)tap(f.x,f.y);
      if(f.perfect){target=cooking().orders.find(c=>c.uid===targetId);drag(f,centre(target));break;}
    }
  }
  await advance(.05,{paint:false});
  assert(cooking().orders.find(c=>c.uid===targetId).fulfilled[0]===1,'drag serves the selected customer on page2, not a hidden page1 hitbox');
  await shot('40-orders-page2-service');

  // Freeze visible targets while new arrivals are admitted during a held drag.
  await launch();tap(210,310);await advance(1.3,{paint:false});
  const fixed=cooking().orders.filter(c=>c.visible).map(c=>c.uid);
  const held=centre(cooking().bench[0]);pointer('pointerdown',held.x,held.y);pointer('pointermove',410,600);
  await advance(1,{paint:false});
  assert(cooking().orders.length>fixed.length,'new orders actually arrive during the gesture');
  assert(JSON.stringify(cooking().orders.filter(c=>c.visible).map(c=>c.uid))===JSON.stringify(fixed),'arrival cannot move or replace targets under a drag');
  pointer('pointerup',410,600);await advance(.02,{paint:false});

  // The same recipe gate is visible and enforced in the real purchase path.
  fixture.levels[0].restaurantIndex=0;cache.set(levelFile,JSON.stringify(fixture));
  const young=meta();young.level=11;young.upgrades.knife=0;localStorage.setItem('churrasco_meta_v2',JSON.stringify(young));
  await launch();tap(126,750);await advance(.03,{paint:false});
  await click(home().catalog.next);await click(home().catalog.next);
  let knife=home().catalog.cards.find(c=>c.id==='knife');assert(knife.reasons.includes('recipe_locked'),'level11 UI explains prep gate');
  const before=JSON.stringify(meta());await click(knife.buy);assert(JSON.stringify(meta())===before,'level11 cannot purchase through pointer');
  await shot('41-upgrade-prep-locked');
  const eligible=meta();eligible.level=12;localStorage.setItem('churrasco_meta_v2',JSON.stringify(eligible));
  await launch();tap(126,750);await advance(.03,{paint:false});await click(home().catalog.next);await click(home().catalog.next);
  knife=home().catalog.cards.find(c=>c.id==='knife');assert(knife.canBuy,'level12 enables the same real UI');await click(knife.buy);
  assert(meta().upgrades.knife===1,'eligible knife purchased');await shot('42-upgrade-prep-unlocked');
  console.log('[shoot] A-06.1: all27 catalog, shared purchase/relaunch, offline purchase/max no debit; capacity14 all reachable, page2 real service, drag stable across arrivals, prep11/12 purchase gating');
}

// A-06.2: no resource mutation hooks; fixtures only select initial upgrades/level.
{
  const centre=r=>({x:r.x+r.w/2,y:r.y+r.h/2});
  const click=async r=>{const p=centre(r);tap(p.x,p.y);await advance(.03,{paint:false});};
  const drag=(from,to)=>{pointer('pointerdown',from.x,from.y);pointer('pointermove',to.x,to.y);pointer('pointerup',to.x,to.y);};
  const fixture=JSON.parse(cache.get(levelFile));
  Object.assign(fixture.levels[0],{restaurantIndex:4,turnLengthSec:500,vipChance:0,spawnIntervalSec:30,patienceScalar:10});
  cache.set(levelFile,JSON.stringify(fixture));
  const saved=meta();saved.level=44;saved.coins=1000000;saved.turnsPlayed=9;saved.bonusReady=null;
  saved.churrasqueiraId='fornalha_dragao_manso';saved.churrasqueiraLv.fornalha_dragao_manso=3;
  saved.upgrades={grill_size:2,grill_stability:6,charcoal_quality:6,charcoal_auto:3,counter:0};
  localStorage.setItem('churrasco_meta_v2',JSON.stringify(saved));
  listeners.clear();lifecycle.clear();rafQueue.length=0;await import(pathToFileURL(BUNDLE).href+'?a062');await waitForLoop();await waitForArt();
  await advance(.35,{paint:false});tap(210,400);await advance(.4,{paint:false});tap(210,310);await advance(.2,{paint:false});
  assert(cooking()?.resources?.stockRefill,'A-06.2: real stock/refill controls must be exposed');
  const id='linguica_toscana';
  const stock=()=>cooking().bench.find(b=>b.id===id);
  assert(stock().remaining===6,'initial per-ingredient stock is6');
  // Cancel over a valid grill target: never turn cancellation into a paid admission.
  const start=centre(stock());pointer('pointerdown',start.x,start.y);pointer('pointermove',cooking().zones[0].x,cooking().zones[0].y);pointer('pointercancel',0,0);
  await advance(.03,{paint:false});assert(stock().remaining===6&&cooking().activeFoods===0,'cancel keeps stock and removes the unadmitted raw item');
  for(let i=0;i<6;i++){
    drag(centre(stock()),cooking().zones[0]);await advance(.03,{paint:false});
    assert(stock().remaining===5-i,'one unit per accepted grill placement');
    const f=cooking().foods.find(f=>f.id===id);assert(f,'raw portion admitted through pointer');
    drag(f,{x:410,y:710});await advance(.03,{paint:false});
  }
  assert(cooking().activeFoods===0,'discarded portions cannot accumulate');
  drag(centre(stock()),cooking().zones[0]);await advance(.03,{paint:false});
  assert(stock().remaining===0&&cooking().activeFoods===0,'empty stock blocks admission without orphan food');
  assert(cooking().resources.feedback?.includes('Estoque esgotado'),'empty stock provides visible feedback');
  await shot('43-stock-empty');
  const wallet=meta().coins,refill=cooking().resources.stockRefill;
  await click(refill);const remaining=cooking().resources.stockRefillRemaining;
  await click(refill);assert(cooking().resources.stockRefillRemaining<remaining,'repeated click cannot restart refill');
  await advance(2.7,{paint:false});assert(stock().remaining===0,'must wait the full three seconds');
  await shot('44-stock-refilling');
  await advance(.4,{paint:false});assert(stock().remaining===6&&meta().coins===wallet,'free refill restores stock once');
  await shot('45-stock-restored');
  // Let real elapsed play reach the low-fuel boundary; upgrades are not invoked by a test callback.
  for(let i=0;i<2400&&cooking().resources.autoAttempts===0;i++)await advance(.1,{paint:false});
  assert(cooking().resources.autoAttempts===1&&cooking().resources.autoSuccesses===1,'seeded natural low-fuel auto refill succeeds once');
  assert(cooking().zones.every(z=>z.effectiveHeat===0),'refill cuts heat in all four zones');
  assert(cooking().resources.feedback?.includes('automática'),'automatic refill confirmation must not be overwritten by low-fuel warning');
  await shot('46-charcoal-automatic');
  await click(cooking().resources.charcoalRefill);await advance(2.4,{paint:false});
  assert(cooking().counters.charcoalRefills===1,'manual collision cannot start a second cycle');
  assert(cooking().zones.every(z=>z.effectiveHeat>0),'heat returns with new fuel');
  assert(meta().coins===wallet,'automatic refill cannot charge or grant currency');
  console.log('[shoot] A-06.2: cancel, six legal admissions/discards, empty stock, three-second free refill, seeded low-fuel auto refill, zero heat/collision in four zones');
}

// A-06.3: owned staff act during real play; no food/order/budget mutation hooks.
{
  const fixture=JSON.parse(cache.get(levelFile));
  Object.assign(fixture.levels[0],{restaurantIndex:4,turnLengthSec:500,vipChance:0,spawnIntervalSec:1.5,maxOrdersOnScreen:17,patienceScalar:100});
  cache.set(levelFile,JSON.stringify(fixture));
  const saved=meta();saved.level=12;saved.turnsPlayed=9;saved.bonusReady=null;
  saved.upgrades={garcom:3,auxiliar:5,churrasqueiro:5,tray:5,counter:5};
  saved.churrasqueiraId='fornalha_dragao_manso';saved.churrasqueiraLv.fornalha_dragao_manso=3;
  localStorage.setItem('churrasco_meta_v2',JSON.stringify(saved));
  listeners.clear();lifecycle.clear();rafQueue.length=0;await import(pathToFileURL(BUNDLE).href+'?a063');await waitForLoop();await waitForArt();
  await advance(.35,{paint:false});tap(210,400);await advance(.4,{paint:false});tap(210,310);await advance(.2,{paint:false});
  assert(cooking()?.staff?.serve.level===3,'A-06.3: real play must expose bounded staff status');
  const item=cooking().bench.find(i=>i.id==='linguica_toscana');
  for(let i=0;i<2;i++){
    pointer('pointerdown',item.x+item.w/2,item.y+item.h/2);pointer('pointermove',cooking().zones[0].x,cooking().zones[0].y);pointer('pointerup',cooking().zones[0].x,cooking().zones[0].y);await advance(.05,{paint:false});
  }
  for(let i=0;i<300&&cooking().staff.flip.used===0;i++)await advance(.1,{paint:false});
  assert(cooking().staff.flip.used===1&&cooking().staff.flip.eligible===2,'two public cues permit exactly one automated flip');
  assert(cooking().foods.every(f=>f.zoneIndex===0),'cook cannot move a plate to a better zone');
  await shot('47-staff-auto-flip');
  // Manual flip overlaps the automated crew legally, without inflating the denominator.
  const unflipped=cooking().foods.find(f=>f.flips===0&&!f.burned);if(unflipped){tap(unflipped.x,unflipped.y);await advance(.05,{paint:false});}
  let sawBurnRisk=false;
  for(let i=0;i<800&&(cooking().staff.serve.used===0||cooking().staff.prep.used===0);i++){
    await advance(.1,{paint:false});
    if(!sawBurnRisk&&cooking().staff.riskFoodIds.length){sawBurnRisk=true;await shot('49-staff-burn-warning');}
  }
  assert(sawBurnRisk,'waiter3 must visibly warn about live physics burn risk, not rescue the remaining plate');
  console.log('[shoot] staff snapshot',JSON.stringify(cooking().staff));
  assert(cooking().staff.prep.used>0&&cooking().staff.serve.used>0,'helper and waiter must really prepare and serve live orders');
  assert(cooking().coins>0&&cooking().counters.itemsCooked>0,'automatic serving pays through the real scoring path');
  assert(cooking().staff.serve.used<=Math.floor(.5*cooking().staff.serve.eligible),'service remains inside the actual floor budget');
  assert(cooking().staff.flip.used<=Math.floor(.6*cooking().staff.flip.eligible),'manual overlap cannot exceed flip cap');
  assert(cooking().staff.serve.interval===1,'max tray gives real one-second waiter trips');
  assert(cooking().prep.length===4,'helper adds exactly one real prep slot');
  await shot('48-staff-prep-and-service');
  console.log('[shoot] A-06.3: pointer places two plates; public cue/one bounded auto flip, no zone move; manual overlap; helper actual prep/extra slot, waiter actual payout and tray cadence');
}

// A-06.4: advanced restaurant fixture, real lifecycle + pointer-only settlement.
{
  const saved=meta();saved.level=80;saved.turnsPlayed=9;saved.bonusReady=null;saved.upgrades={caixa:1};delete saved.offline;
  saved.lastLoginISO='2020-01-01'; // A changed login day must not fabricate an absence.
  localStorage.setItem('churrasco_meta_v2',JSON.stringify(saved));
  const relaunch=async tag=>{listeners.clear();lifecycle.clear();rafQueue.length=0;await import(pathToFileURL(BUNDLE).href+'?'+tag);await waitForLoop();await waitForArt();await advance(.35,{paint:false});await paintFrame();};
  await relaunch('a064');
  const off=()=>globalThis.__churrascoOffline;
  const click=async r=>{tap(r.x+r.w/2,r.y+r.h/2);await paintFrame();};
  assert(off(),'A-06.4: real ledger UI/read-only layout must replace the random date-change popup');
  assert(!off().open&&meta().coins===saved.coins,'migration/date must invent no old offline income');
  tap(360,204); // close the genuine daily modal, not an offline reward
  tap(210,400);await advance(.4,{paint:false});tap(210,310);await advance(.2,{paint:false});await paintFrame();
  const t=off().simulationTime,wallet=meta().coins;
  const realNow=Date.now;let clock=realNow();Date.now=()=>clock;
  document.visibilityState='hidden';dispatchLifecycle('visibilitychange');dispatchLifecycle('pagehide');
  await advance(3,{paint:false});await paintFrame();
  assert(off().simulationTime===t,'hidden turn must not advance even if RAF fires');
  const workingStorage=localStorage.setItem;localStorage.setItem=()=>{throw Error('return quota');};
  clock+=6*3600*1000;document.visibilityState='visible';dispatchLifecycle('visibilitychange');dispatchLifecycle('pageshow');await paintFrame();
  assert(meta().coins===wallet&&meta().offline.anchor&&off().simulationTime===t,'failed return must keep anchor and wallet, with active play paused');
  clock+=60000;localStorage.setItem=workingStorage;await advance(1.1,{paint:false});await paintFrame();
  assert(off().minutes===360,'retry consumes fixed return time, not the minute waiting online for storage');
  assert(meta().coins-wallet===120*96,'cashier1 advances2h of6h, once despite duplicate return');
  assert(off().coins===240*96&&off().xp>0&&off().minutes===360,'remainder has real four-hour coins/XP');
  assert(off().simulationTime===t,'absence cannot also count as cooking');
  await shot('50-offline-cashier-partial');
  const id=off().id;
  await click(off().layout.close);await advance(.1,{paint:false});await paintFrame();
  assert(!off().open&&meta().offline.batch.id===id,'dismissal preserves pending ledger');
  await relaunch('a064-reload');assert(off().id===id&&meta().coins-wallet===120*96,'reload preserves remainder without another automatic payout');
  await click(off().layout.close);await advance(.35,{paint:false});tap(210,400);await advance(.1,{paint:false});await paintFrame();
  assert(globalThis.__churrascoScreen==='home','dismissed return reaches Home');
  assert(globalThis.__churrascoHome.activeCoinMultiplier===.85,'Premium displays the shared85% active plate rate, without changing offline');
  await shot('53-late-income-home');await click(off().layout.entry);
  assert(off().open&&off().id===id,'Home entry reopens the same pending credit');
  const persist=localStorage.setItem;localStorage.setItem=()=>{throw new Error('quota test');};
  await click(off().layout.claim);await paintFrame();
  assert(off().storageError&&meta().coins-wallet===120*96&&off().id===id,'failed atomic write grants neither wallet nor claim');
  await shot('51-offline-storage-failure');
  localStorage.setItem=persist;
  await click(off().layout.claim);await paintFrame();
  assert(meta().coins-wallet===360*96&&off().id===null,'retry pays precisely remaining four hours');
  const settled=meta().coins;await click(off().layout.claim);await paintFrame();assert(meta().coins===settled,'repeated claim is inert');
  await shot('52-offline-settled-receipt');
  await relaunch('a064-final');assert(meta().coins===settled&&off().id===null,'settled reload cannot resurrect batch');
  Date.now=realNow;
  console.log('[shoot] A-06.4: real hide/show, duplicate events, paused turn,6h/Caixa1 split, dismiss/reload/Home reopen, return and claim quota fault/retry, pointer claim and receipt, no duplicate payout');
}
const ms = Date.now() - wall0;
console.log(`[shoot] frames written to prototype/shots/`);
console.log(`[shoot] painted=${paintedFrames} skipped=${skippedFrames} wall=${(ms / 1000).toFixed(1)}s`);
if (ms > BUDGET_MS) {
  throw new Error(`check-shots too slow: ${ms}ms (budget ${BUDGET_MS}ms) — make the tail cheaper, do not raise the timeout`);
}
process.exit(0);
