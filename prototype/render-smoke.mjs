/**
 * Render smoke test — runs the REAL prototype bundle in Node against a recording
 * canvas stub, so every draw method actually executes.
 *
 * A typecheck proves the code compiles; it does not prove `drawGrill` runs. This
 * harness imports the same `dist/bundle.js` the browser loads, feeds it the real
 * data tables from `shared/data`, and drives enough frames to reach the grill,
 * the bench, the order cards and the result screen.
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

function record(name) {
  return (...args) => {
    calls.set(name, (calls.get(name) ?? 0) + 1);
    ops++;
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
  addEventListener: () => {},
  fonts: { ready: Promise.resolve(), load: () => Promise.resolve() },
  body: { appendChild: () => {} }
};
globalThis.window = globalThis;
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

async function main() {
  await import(pathToFileURL(BUNDLE).href);

  // Let init()'s awaited fetches settle, then run frames.
  await new Promise((r) => setTimeout(r, 120));
  await pump(30);

  const afterInit = { ops, calls: new Map(calls) };
  if (afterInit.ops === 0) throw new Error('nothing drawn after 30 frames');

  // Drag from the bench (bottom) up onto the grill, then tap to flip.
  pointer('pointerdown', 60, 660);
  await pump(4);
  pointer('pointermove', 120, 500);
  await pump(4);
  pointer('pointermove', 210, 330);
  await pump(4);
  pointer('pointerup', 210, 330);
  await pump(10);

  // Tap an item on the grill to flip it.
  pointer('pointerdown', 210, 330);
  await pump(3);
  pointer('pointerup', 210, 330);
  await pump(20);

  // Run the turn out to the result screen.
  await pump(60 * 60 * 3);

  const drawn = [...calls.entries()].sort((a, b) => b[1] - a[1]);
  const mustHave = ['fill', 'stroke', 'beginPath', 'fillRect', 'fillText'];
  const missing = mustHave.filter((m) => !calls.has(m));
  if (missing.length) throw new Error(`draw ops never called: ${missing.join(', ')}`);

  console.log(`[render-smoke] OK — ${ops.toLocaleString('en-US')} canvas ops, no exceptions`);
  console.log(`[render-smoke] top ops: ` + drawn.slice(0, 8).map(([k, v]) => `${k}=${v}`).join(' '));
  console.log(`[render-smoke] gradient calls: linear=${calls.get('createLinearGradient') ?? 0} radial=${calls.get('createRadialGradient') ?? 0}`);
  console.log(`[render-smoke] text drawn: fillText=${calls.get('fillText') ?? 0} strokeText=${calls.get('strokeText') ?? 0}`);
  console.log(`[render-smoke] frames rendered, render loop never stalled`);
}

main().catch((err) => {
  console.error('[render-smoke] FAIL —', err && err.stack ? err.stack : err);
  process.exit(1);
});
