import { createCanvas } from '@napi-rs/canvas';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const ROOT = join(import.meta.dirname, '..');
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
const real = createCanvas(420, 780);
const listeners = new Map();
const canvasEl = {
  width: 420, height: 780, style: {},
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 420, height: 780 }),
  getContext: () => real.getContext('2d'),
  addEventListener: (t, fn) => { (listeners.get(t) ?? listeners.set(t, []).get(t)).push(fn); },
  removeEventListener: () => {}, setPointerCapture: () => {}, releasePointerCapture: () => {}, hasPointerCapture: () => false
};
const store = new Map();
store.set('churrasco_meta_v2', JSON.stringify({
  coins: 2840, embers: 34, xp: 88, level: 5, streak: 3, longestStreak: 5,
  lastLoginISO: new Date().toISOString().slice(0,10), lastClaimDay: 3, turnsPlayed: 6, bestCombo: 7,
  totalPerfect: 18, collection: ['linguica_toscana','pao_de_alho','queijo_coalho','frango_coxa','coracao_frango'], ftueDone: true,
  ftueStep: 99, bonusReady: 'frenzy', bonusExpiresAt: 0, wheelSpins: 1, lastWheelSpinISO: '',
  upgrades: { grill_size:1, grill_heat:1 }, graceUsed: false
}));
globalThis.localStorage = { getItem(k){ return store.get(k) ?? null; }, setItem(k,v){ store.set(k,v); }, removeItem(k){ store.delete(k); } };
globalThis.document = {
  getElementById: (id) => (id === 'c' ? canvasEl : null),
  createElement: (tag) => tag==='canvas' ? createCanvas(420,780) : { style:{} },
  addEventListener: () => {}, fonts: { ready: Promise.resolve(), load: ()=>Promise.resolve() }
};
globalThis.window = globalThis;
globalThis.innerWidth = 420; globalThis.innerHeight = 820; globalThis.devicePixelRatio=1;
globalThis.location = { search: '', href: 'http://localhost/' };
const rafQueue=[]; globalThis.requestAnimationFrame=(fn)=>{rafQueue.push(fn); return rafQueue.length;}; globalThis.cancelAnimationFrame=()=>{}; let nowMs=0; globalThis.performance={now:()=>nowMs};
delete globalThis.AudioContext;
const cache=new Map();
globalThis.fetch=async(url)=>{
  const rel=String(url).replace(/^https?:\/\/[^/]+/,'');
  let file;
  if(rel.startsWith('/data/')) file=join(ROOT,'shared','data',rel.slice(6));
  else if(rel.startsWith('/l10n/')) file=join(ROOT,'shared','l10n',rel.slice(6));
  else throw new Error('unexpected fetch '+url);
  if(!cache.has(file)) cache.set(file, await readFile(file,'utf8'));
  const body=cache.get(file);
  return {ok:true,status:200, json:async()=>JSON.parse(body), text:async()=>body};
};
const FRAME=1000/60; async function pump(frames){ for(let i=0;i<frames;i++){ const batch=rafQueue.splice(0,rafQueue.length); if(!batch.length) throw new Error('stall'); nowMs+=FRAME; for(const fn of batch) fn(nowMs); } }
function pointer(type,x,y){ const ev={type,clientX:x,clientY:y,pointerId:1,isPrimary:true,button:0,preventDefault:()=>{},stopPropagation:()=>{},target:canvasEl}; for(const fn of listeners.get(type)??[]) fn(ev); const alias={touchstart:'pointerdown',touchmove:'pointermove',touchend:'pointerup'}[type]; if(alias) for(const fn of listeners.get(alias)??[]) fn(ev); }
async function shot(name){ await mkdir(join(ROOT,'prototype','shots'),{recursive:true}); await writeFile(join(ROOT,'prototype','shots',name+'.png'), real.toBuffer('image/png')); console.log('[shoot-tabs2] '+name+'.png'); }

await import(pathToFileURL(BUNDLE).href);
await new Promise(r=>setTimeout(r,200));
await pump(100);
await shot('10-home');

// tap Shop (x 126, y 748)
pointer('pointerdown',126,748); await pump(3); pointer('pointerup',126,748); await pump(30); await shot('16-shop');
// tap Missões (x 210, y 748)
pointer('pointerdown',210,748); await pump(3); pointer('pointerup',210,748); await pump(30); await shot('17-missions');
// tap Coleção (x 294, y 748)
pointer('pointerdown',294,748); await pump(3); pointer('pointerup',294,748); await pump(30); await shot('18-collection');
// tap Rota (x 378, y 748)
pointer('pointerdown',378,748); await pump(3); pointer('pointerup',378,748); await pump(30); await shot('19-route');
// back to Início (x 42, y 748)
pointer('pointerdown',42,748); await pump(3); pointer('pointerup',42,748); await pump(30); await shot('20-home-final');
console.log('done');
