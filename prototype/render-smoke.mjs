/**
 * Render smoke test — runs the REAL prototype bundle in Node against a recording
 * canvas stub, so every draw method actually executes.
 *
 * A typecheck proves the code compiles; it does not prove `drawGrill` runs. This
 * harness imports the same `dist/bundle.js` the browser loads, feeds it the real
 * data tables from `shared/data`, and drives enough frames to reach the grill,
 * the bench, the order cards and the result screen — first through the FTUE
 * (steps 1–6, played by following the tutorial hand), then an ordinary turn.
 *
 * Any exception thrown from a draw method surfaces here as a failure.
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = join(import.meta.dirname, '..');
const BUNDLE = join(ROOT, 'prototype', 'dist', 'bundle.js');

// ── Recording 2D context ────────────────────────────────────────────────────
const calls = new Map();
let ops = 0;

const TRANSFORM_OPS = new Set(['setTransform', 'transform', 'scale', 'translate', 'rotate']);

function record(name) {
  return (...args) => {
    calls.set(name, (calls.get(name) ?? 0) + 1);
    ops++;
    // A non-finite layout transform (e.g. resize computing scale from a missing
    // window.innerWidth) draws nothing yet records as "successful". Fail loudly.
    if (TRANSFORM_OPS.has(name)) {
      for (const a of args) {
        if (typeof a === 'number' && !Number.isFinite(a)) {
          throw new Error(`non-finite argument to ${name}(${args.join(',')}) — the frame would render blank`);
        }
      }
    }
    // Gradient factories must return a usable object.
    if (name === 'createLinearGradient' || name === 'createRadialGradient') {
      return { addColorStop: () => {} };
    }
    if (name === 'measureText') return { width: 8 };
    if (name === 'getImageData') return { data: new Uint8ClampedArray(4) };
    return undefined;
  };
}

function makeCtx() {
  const ctx = {};
  const methods = [
    'save', 'restore', 'beginPath', 'closePath', 'moveTo', 'lineTo', 'bezierCurveTo',
    'quadraticCurveTo', 'arc', 'arcTo', 'ellipse', 'rect', 'roundRect', 'fill', 'stroke',
    'clip', 'fillRect', 'strokeRect', 'clearRect', 'translate', 'rotate', 'scale',
    'transform', 'setTransform', 'resetTransform', 'setLineDash', 'getLineDash',
    'fillText', 'strokeText', 'drawImage', 'createLinearGradient', 'createRadialGradient',
    'createPattern', 'putImageData', 'getImageData', 'measureText'
  ];
  for (const m of methods) ctx[m] = record(m);
  // Drawing state the code reads back.
  Object.assign(ctx, {
    canvas: null, globalAlpha: 1, fillStyle: '#000', strokeStyle: '#000',
    lineWidth: 1, lineCap: 'butt', lineJoin: 'miter', font: '10px sans-serif',
    textAlign: 'start', textBaseline: 'alphabetic', globalCompositeOperation: 'source-over',
    shadowColor: 'transparent', shadowBlur: 0, shadowOffsetX: 0, shadowOffsetY: 0,
    lineDashOffset: 0, filter: 'none', imageSmoothingEnabled: true
  });
  return ctx;
}

// ── Minimal DOM ─────────────────────────────────────────────────────────────
const listeners = new Map();
const docListeners = new Map();
const canvasEl = {
  width: 420,
  height: 780,
  style: {},
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 420, height: 780 }),
  getContext: () => canvasEl._ctx,
  addEventListener: (t, fn) => {
    if (!listeners.has(t)) listeners.set(t, []);
    listeners.get(t).push(fn);
  },
  removeEventListener: () => {},
  setAttribute: () => {},
  setPointerCapture: () => {},
  releasePointerCapture: () => {},
  hasPointerCapture: () => false,
  focus: () => {},
  _ctx: null
};
canvasEl._ctx = makeCtx();

globalThis.document = {
  getElementById: (id) => (id === 'c' ? canvasEl : null),
  createElement: (tag) => {
    if (tag === 'canvas') {
      const c = { width: 0, height: 0, style: {}, getContext: () => null };
      c.getContext = () => { c._ctx = makeCtx(); c._ctx.canvas = c; return c._ctx; };
      return c;
    }
    return { style: {}, appendChild: () => {} };
  },
  // Recorded so the harness can background the app (visibilitychange → tutorial_abandon).
  addEventListener: (t, fn) => { (docListeners.get(t) ?? docListeners.set(t, []).get(t)).push(fn); },
  visibilityState: 'visible',
  fonts: { ready: Promise.resolve(), load: () => Promise.resolve() },
  body: { appendChild: () => {} }
};
// ── WebAudio stub ───────────────────────────────────────────────────────────
// Without this the audio layer takes its "no AudioContext" early return and the
// cue code never executes. The stub records which cues were scheduled.
const audioNodes = { osc: 0, bufSrc: 0, gain: 0, filter: 0, started: 0, stopped: 0 };
function param(v = 0) {
  return {
    value: v,
    setValueAtTime: () => {},
    exponentialRampToValueAtTime: () => {},
    linearRampToValueAtTime: () => {},
    setTargetAtTime: () => {}
  };
}
class FakeAudioContext {
  constructor() {
    this.currentTime = 0;
    this.sampleRate = 44100;
    this.state = 'running';
    this.destination = { connect: () => {} };
  }
  resume() { return Promise.resolve(); }
  createGain() { audioNodes.gain++; return { gain: param(1), connect: () => {}, disconnect: () => {} }; }
  createOscillator() {
    audioNodes.osc++;
    return {
      type: 'sine', frequency: param(440), detune: param(0),
      connect: () => {}, start: () => { audioNodes.started++; }, stop: () => { audioNodes.stopped++; }
    };
  }
  createBufferSource() {
    audioNodes.bufSrc++;
    return {
      buffer: null, loop: false, playbackRate: param(1),
      connect: () => {}, start: () => { audioNodes.started++; }, stop: () => { audioNodes.stopped++; }
    };
  }
  createBiquadFilter() {
    audioNodes.filter++;
    return { type: 'lowpass', frequency: param(1000), Q: param(1), gain: param(0), connect: () => {} };
  }
  createBuffer(ch, len, rate) {
    const data = new Float32Array(len);
    return { length: len, sampleRate: rate, numberOfChannels: ch, getChannelData: () => data };
  }
}
globalThis.AudioContext = FakeAudioContext;
globalThis.window = globalThis;
globalThis.innerWidth = 420;
globalThis.innerHeight = 820;
globalThis.devicePixelRatio = 1;
globalThis.location = { search: '', href: 'http://localhost/' };

// ── Frame pump ──────────────────────────────────────────────────────────────
const rafQueue = [];
globalThis.requestAnimationFrame = (fn) => { rafQueue.push(fn); return rafQueue.length; };
globalThis.cancelAnimationFrame = () => {};
let nowMs = 0;
globalThis.performance = { now: () => nowMs };

// ── Network: serve the real tables off disk ─────────────────────────────────
const cache = new Map();
globalThis.fetch = async (url) => {
  const u = String(url);
  const rel = u.replace(/^https?:\/\/[^/]+/, '');
  let file;
  if (rel.startsWith('/data/')) file = join(ROOT, 'shared', 'data', rel.slice('/data/'.length));
  else if (rel.startsWith('/l10n/')) file = join(ROOT, 'shared', 'l10n', rel.slice('/l10n/'.length));
  else throw new Error(`unexpected fetch: ${u}`);
  if (!cache.has(file)) cache.set(file, await readFile(file, 'utf8'));
  const body = cache.get(file);
  return { ok: true, status: 200, json: async () => JSON.parse(body), text: async () => body };
};

// ── Drive it ────────────────────────────────────────────────────────────────
const FRAME_MS = 1000 / 60;

async function pump(frames) {
  for (let i = 0; i < frames; i++) {
    const batch = rafQueue.splice(0, rafQueue.length);
    if (batch.length === 0) throw new Error(`render loop stalled at frame ${i}`);
    nowMs += FRAME_MS;
    for (const fn of batch) fn(nowMs);
  }
}

/** Synthesise a pointer event against the canvas listeners. */
function pointer(type, x, y) {
  const ev = {
    type, clientX: x, clientY: y, pointerId: 1, isPrimary: true, button: 0,
    preventDefault: () => {}, stopPropagation: () => {},
    target: canvasEl, touches: type === 'touchstart' ? [{ clientX: x, clientY: y }] : undefined
  };
  for (const fn of listeners.get(type) ?? []) fn(ev);
  // pointer events are often bound as pointerdown/move/up too
  const alias = { touchstart: 'pointerdown', touchmove: 'pointermove', touchend: 'pointerup' }[type];
  if (alias) for (const fn of listeners.get(alias) ?? []) fn(ev);
}

/** One gesture, as a finger would do it: a tap, or press → arc → release. */
async function gesture(hand) {
  const { from, to } = hand;
  pointer('pointerdown', from.x, from.y);
  await pump(2);
  if (to) {
    pointer('pointermove', (from.x + to.x) / 2, (from.y + to.y) / 2);
    await pump(2);
    pointer('pointermove', to.x, to.y);
    await pump(2);
    pointer('pointerup', to.x, to.y);
  } else {
    pointer('pointerup', from.x, from.y);
  }
  await pump(2);
}

/**
 * Play like a new player who reads nothing: wait for the hand the FTUE overlay
 * draws (`globalThis.__churrascoFtue.hand`, published every frame), react after
 * 0.6 s, do what it shows. If this cannot finish the FTUE, the hand is lying.
 */
async function followHand(until, maxSec) {
  let seen = '';
  let seenAt = 0;
  let t = 0;
  while (t < maxSec) {
    if (until()) return;
    const hand = globalThis.__churrascoFtue?.hand;
    const key = hand ? `${hand.kind}@${Math.round(hand.from.x)},${Math.round(hand.from.y)}` : '';
    if (key !== seen) { seen = key; seenAt = t; }
    if (hand && t - seenAt >= 0.6) {
      await gesture(hand);
      seen = '';
    }
    await pump(6);
    t += 0.1;
  }
  throw new Error(`FTUE stalled — screen=${globalThis.__churrascoScreen} ftue=${JSON.stringify(globalThis.__churrascoFtue)}`);
}

async function main() {
  await import(pathToFileURL(BUNDLE).href);

  // Let init()'s awaited fetches settle, then run frames.
  await new Promise((r) => setTimeout(r, 120));
  await pump(30);

  const afterInit = { ops, calls: new Map(calls) };
  if (afterInit.ops === 0) throw new Error('nothing drawn after 30 frames');

  // A fresh install goes splash → title (a tap skips the splash); JOGAR on the
  // title starts the FTUE's scripted turn.
  const opsBeforeTitle = ops;
  pointer('pointerdown', 210, 500);
  await pump(4);
  pointer('pointerup', 210, 500);
  await pump(30);
  if (ops === opsBeforeTitle) throw new Error('title screen drew nothing');
  if (globalThis.__churrascoScreen !== 'title') throw new Error(`a fresh install should reach the title, got ${globalThis.__churrascoScreen}`);
  pointer('pointerdown', 210, 554);
  pointer('pointerup', 210, 554);
  await pump(10);
  if (globalThis.__churrascoScreen !== 'play') throw new Error(`JOGAR on the title should start the FTUE, got ${globalThis.__churrascoScreen}`);

  // Steps 1–5 by following the hand, to the simplified result card …
  await followHand(() => globalThis.__churrascoScreen === 'result', 120);
  await pump(150);
  await followHand(() => globalThis.__churrascoScreen === 'home', 5); // CONTINUAR
  await pump(10);
  if (globalThis.__churrascoScreen !== 'home') throw new Error(`CONTINUAR should open Home, got ${globalThis.__churrascoScreen}`);
  // … and step 6 on Home.
  await followHand(() => !globalThis.__churrascoFtue, 30);
  await pump(30);

  const log = globalThis.__churrascoAnalytics ?? [];
  const names = log.map((e) => (e.name === 'tutorial_step' ? `step:${e.params.step}` : e.name));
  const expected = ['tutorial_start', 'step:place', 'step:flip', 'step:serve', 'step:perfect', 'tutorial_complete', 'upgrade_purchase', 'step:upgrade'];
  if (JSON.stringify(names) !== JSON.stringify(expected)) throw new Error(`FTUE analytics: ${names.join(' → ')}`);
  const invalid = log.filter((e) => !e.valid);
  if (invalid.length) throw new Error(`events outside analytics.json: ${JSON.stringify(invalid)}`);
  const complete = log.find((e) => e.name === 'tutorial_complete');
  if (complete.params.misses !== 0) throw new Error(`following the hand still cost ${complete.params.misses} misses`);

  // Home's daily calendar (docs/18-STATUS.md §7): the strip's own panel opens
  // it — its hit box used to be the empty gap underneath — RESGATAR pays the
  // day once per calendar day, and ✕ closes it. Geometry comes from the same
  // layout the drawing uses (`__churrascoHome`).
  const home = () => globalThis.__churrascoHome;
  const tapAt = async (x, y) => { pointer('pointerdown', x, y); pointer('pointerup', x, y); await pump(4); };
  const centre = (r) => [r.x + r.w / 2, r.y + r.h / 2];
  const strip = home().strip;
  await tapAt(strip.x + strip.w / 2, strip.y + strip.h + 30);
  if (home().dailyOpen) throw new Error('the empty gap under the daily strip opened the calendar');
  await tapAt(...centre(strip));
  if (!home().dailyOpen) throw new Error('tapping the daily strip did not open the calendar');
  const coinsBeforeDaily = home().coins;
  await tapAt(...centre(home().modal.claim));
  if (home().lastClaimDay !== 1 || home().coins !== coinsBeforeDaily + 250) {
    throw new Error(`RESGATAR did not pay day 1 (250): ${JSON.stringify(home())}`);
  }
  await tapAt(...centre(home().modal.days[1]));
  await tapAt(...centre(home().modal.claim));
  if (home().lastClaimDay !== 1 || home().coins !== coinsBeforeDaily + 250) throw new Error('the calendar paid twice in one day');
  await tapAt(...centre(home().modal.close));
  if (home().dailyOpen) throw new Error('✕ did not close the calendar');
  const dailyEvents = (globalThis.__churrascoAnalytics ?? []).filter((e) => e.name === 'daily_reward');
  if (dailyEvents.length !== 1 || !dailyEvents[0].valid || dailyEvents[0].params.day_index !== 1) {
    throw new Error(`daily_reward analytics: ${JSON.stringify(dailyEvents)}`);
  }

  // Then an ordinary turn from Home: JOGAR, a drag, a flip, run out to the result.
  pointer('pointerdown', 210, 310);
  pointer('pointerup', 210, 310);
  await pump(10);
  if (globalThis.__churrascoScreen !== 'play') throw new Error('JOGAR after the FTUE should start a turn');
  pointer('pointerdown', 60, 660);
  await pump(4);
  pointer('pointermove', 120, 500);
  await pump(4);
  pointer('pointermove', 210, 330);
  await pump(4);
  pointer('pointerup', 210, 330);
  await pump(10);
  pointer('pointerdown', 210, 330);
  await pump(3);
  pointer('pointerup', 210, 330);
  await pump(20);
  await pump(60 * 95);
  if (globalThis.__churrascoScreen !== 'result') throw new Error(`turn should end on the result screen, got ${globalThis.__churrascoScreen}`);
  await pump(120);

  // A second fresh install (this harness has no storage): background the app
  // mid-step-1, then PULAR. Expect one abandon, one skip, and Home.
  listeners.clear();
  docListeners.clear();
  rafQueue.length = 0;
  await import(pathToFileURL(BUNDLE).href + '?second-install=1');
  await new Promise((r) => setTimeout(r, 120));
  await pump(30);
  pointer('pointerdown', 210, 500);
  pointer('pointerup', 210, 500);
  await pump(30);
  pointer('pointerdown', 210, 554);
  pointer('pointerup', 210, 554);
  await pump(60 * 2.5);
  if (globalThis.__churrascoScreen !== 'play' || !globalThis.__churrascoFtue?.canSkip) {
    throw new Error(`PULAR should be up 2.5 s into the FTUE: ${JSON.stringify(globalThis.__churrascoFtue)}`);
  }
  const background = () => {
    document.visibilityState = 'hidden';
    for (const fn of docListeners.get('visibilitychange') ?? []) fn({ type: 'visibilitychange' });
    document.visibilityState = 'visible';
  };
  background();
  background(); // same step: still one event
  const skip = globalThis.__churrascoFtue.skip;
  pointer('pointerdown', skip.x + skip.w / 2, skip.y + skip.h / 2);
  pointer('pointerup', skip.x + skip.w / 2, skip.y + skip.h / 2);
  await pump(20);
  if (globalThis.__churrascoScreen !== 'home' || globalThis.__churrascoFtue) throw new Error(`PULAR should land on Home, got ${globalThis.__churrascoScreen}`);
  const log2 = globalThis.__churrascoAnalytics ?? [];
  const names2 = log2.map((e) => `${e.name}${e.params.step ? ':' + e.params.step : ''}`);
  if (JSON.stringify(names2) !== JSON.stringify(['tutorial_start', 'tutorial_abandon:place', 'tutorial_skip:place'])) {
    throw new Error(`skip/abandon analytics: ${names2.join(' → ')}`);
  }
  if (log2.some((e) => !e.valid)) throw new Error(`events outside analytics.json: ${JSON.stringify(log2)}`);
  background(); // after the FTUE: nothing
  if ((globalThis.__churrascoAnalytics ?? []).length !== 3) throw new Error('no tutorial events once skipped');

  const drawn = [...calls.entries()].sort((a, b) => b[1] - a[1]);
  const mustHave = ['fill', 'stroke', 'beginPath', 'fillRect', 'fillText'];
  const missing = mustHave.filter((m) => !calls.has(m));
  if (missing.length) throw new Error(`draw ops never called: ${missing.join(', ')}`);

  console.log(`[render-smoke] OK — ${ops.toLocaleString('en-US')} canvas ops, no exceptions`);
  console.log(`[render-smoke] FTUE played by following the hand: ${names.join(' → ')} (misses 0)`);
  console.log(`[render-smoke] second install, backgrounded then skipped: ${names2.join(' → ')}`);
  console.log(`[render-smoke] daily calendar: strip opens it, RESGATAR pays day 1 once (+250), ✕ closes it`);
  console.log(`[render-smoke] top ops: ` + drawn.slice(0, 8).map(([k, v]) => `${k}=${v}`).join(' '));
  console.log(`[render-smoke] gradient calls: linear=${calls.get('createLinearGradient') ?? 0} radial=${calls.get('createRadialGradient') ?? 0}`);
  console.log(`[render-smoke] text drawn: fillText=${calls.get('fillText') ?? 0} strokeText=${calls.get('strokeText') ?? 0}`);
  console.log(`[render-smoke] frames rendered, render loop never stalled`);
  if (audioNodes.started === 0) {
    throw new Error('audio layer scheduled no nodes — cue code never executed');
  }
  console.log(
    `[render-smoke] audio: osc=${audioNodes.osc} noise=${audioNodes.bufSrc} ` +
    `filter=${audioNodes.filter} gain=${audioNodes.gain} started=${audioNodes.started}`
  );
}

main().then(
  // Exit explicitly: the sizzle bed's crackle timer (audio.ts) is a live handle
  // whenever a turn is still on screen, and a harness must never hang on it.
  () => process.exit(0),
  (err) => {
    console.error('[render-smoke] FAIL —', err && err.stack ? err.stack : err);
    process.exit(1);
  }
);
