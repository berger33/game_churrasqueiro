#!/usr/bin/env node
/**
 * Generates REAL audio asset WAVs for CHURRASCO! — foley + music golden-hour 3400K
 * Each file is 44.1kHz 16-bit PCM mono. Synthetic but deterministic, so CI can verify existence/size.
 * These are SHIPPABLE placeholders until studio foley replaces them (same ids, one-line swap in audio.ts).
 * Spec: docs/10-AUDIO.md §3 assets + §4 music.
 */
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const OUT = join(ROOT, 'Assets', 'Audio');
const PROTO_OUT = join(ROOT, 'prototype', 'public', 'audio');
const SR = 44100;

function wavHeader(sampleCount, sr=SR, ch=1, bits=16){
  const blockAlign = ch * bits/8;
  const byteRate = sr * blockAlign;
  const dataSize = sampleCount * ch * bits/8;
  const buf = Buffer.alloc(44);
  buf.write('RIFF',0); buf.writeUInt32LE(36+dataSize,4); buf.write('WAVE',8);
  buf.write('fmt ',12); buf.writeUInt32LE(16,16); buf.writeUInt16LE(1,20); buf.writeUInt16LE(ch,22);
  buf.writeUInt32LE(sr,24); buf.writeUInt32LE(byteRate,28); buf.writeUInt16LE(blockAlign,32); buf.writeUInt16LE(bits,34);
  buf.write('data',36); buf.writeUInt32LE(dataSize,40);
  return buf;
}
function encodePCM(samples){
  const buf = Buffer.alloc(samples.length*2);
  for(let i=0;i<samples.length;i++){
    let s = samples[i];
    if(s>1) s=1; if(s<-1) s=-1;
    buf.writeInt16LE(Math.round(s*32767), i*2);
  }
  return buf;
}
function clamp(v,a,b){ return v<a?a:v>b?b:v; }

// Simple RNG for determinism
function mulberry(a){ return function(){ let t=a+=0x6D2B79F5; t=Math.imul(t^t>>>15,t|1); t^=t+Math.imul(t^t>>>7,t|61); return ((t^t>>>14)>>>0)/4294967296; } }

// Biquad-ish helpers
function lpf(input, alpha){ let y=0; const out=[]; for(let i=0;i<input.length;i++){ y += alpha*(input[i]-y); out.push(y);} return out; }

// Generate brown noise
function brownNoise(len, rng){
  const out = new Float32Array(len);
  let y=0;
  for(let i=0;i<len;i++){
    const white = rng()*2-1;
    y += white * 0.02;
    y = clamp(y, -1, 1);
    out[i]= y*3.5;
  }
  return out;
}
function adsr(len, attack, decay, sustain, release, sr=SR){
  const a=Math.floor(attack*sr), d=Math.floor(decay*sr), r=Math.floor(release*sr);
  const sLen=len-a-d-r;
  const env=new Float32Array(len);
  for(let i=0;i<len;i++){
    if(i<a) env[i]=i/a;
    else if(i<a+d) env[i]=1 - (1-sustain)*(i-a)/d;
    else if(i<a+d+sLen) env[i]=sustain;
    else env[i]=sustain*(1-(i-a-d-sLen)/r);
  }
  return env;
}
function sine(freq, len, sr=SR, phase=0){
  const out=new Float32Array(len);
  for(let i=0;i<len;i++) out[i]=Math.sin(2*Math.PI*freq*i/sr + phase);
  return out;
}
function triangle(freq, len, sr=SR){
  const out=new Float32Array(len);
  const period=sr/freq;
  for(let i=0;i<len;i++){
    const p=(i%period)/period;
    out[i]= p<0.5 ? 4*p-1 : 3-4*p;
  }
  return out;
}
function add(...arrs){
  const n=arrs[0].length;
  const out=new Float32Array(n);
  for(const a of arrs) for(let i=0;i<n;i++) out[i]+=a[i];
  return out;
}
function scale(arr, g){ for(let i=0;i<arr.length;i++) arr[i]*=g; return arr; }
function mul(arr, env){ for(let i=0;i<arr.length;i++) arr[i]*=env[i]; return arr; }
function mix(a,b,t){ const out=new Float32Array(a.length); for(let i=0;i<a.length;i++) out[i]=a[i]*(1-t)+b[i]*t; return out; }

// Foley generators
function sizzleLoop(sec=2){
  const rng=mulberry(0x1a2b3c);
  const n=Math.floor(sec*SR);
  let base=brownNoise(n, rng);
  // bandpass-ish: emphasize 800-3000
  base=lpf(base, 0.08);
  // add crackle pops random
  for(let p=0;p< 18;p++){
    const at=Math.floor(rng()*n);
    const dur=Math.floor((0.02+rng()*0.04)*SR);
    for(let i=0;i<dur && at+i<n;i++){
      const env=Math.exp(-i/(dur*0.3))*0.6;
      base[at+i]+= (rng()*2-1)*env*1.2;
    }
  }
  // modulate intensity gentle
  for(let i=0;i<n;i++) base[i]*= 0.7 + 0.3*Math.sin(2*Math.PI*2.2*i/SR);
  return scale(base, 0.28);
}
function charcoalCrackleLoop(sec=3){
  const rng=mulberry(0x9e3779);
  const n=Math.floor(sec*SR);
  const out=new Float32Array(n);
  let crackInterval=0;
  let next=Math.floor(rng()*0.4*SR);
  for(let i=0;i<n;i++){
    out[i]+= (rng()*2-1)*0.04; // low hiss
    if(i>=next){
      const dur=Math.floor((0.04+rng()*0.06)*SR);
      const amp=0.5+rng()*0.5;
      for(let j=0;j<dur && i+j<n;j++){
        const env=Math.exp(-j/(dur*0.25))*amp;
        out[i+j]+= (rng()*2-1)*env*0.9;
      }
      next=i+Math.floor((0.18+rng()*0.35)*SR);
    }
  }
  // lowpass to make warm
  const lp=lpf(Array.from(out),0.05);
  for(let i=0;i<n;i++) out[i]=lp[i]*0.35;
  return out;
}
function flipVariant(v){
  const rng=mulberry(0x1000+v*1337);
  const sec=0.32;
  const n=Math.floor(sec*SR);
  const out=new Float32Array(n);
  // TSSSS burst highpass noise
  const burst=new Float32Array(n);
  for(let i=0;i<n;i++) burst[i]=(rng()*2-1);
  // highpass via differencing
  for(let i=1;i<n;i++) burst[i]=burst[i]-burst[i-1]*0.9;
  const env=adsr(n, 0.005, 0.06, 0.15, 0.22);
  for(let i=0;i<n;i++) burst[i]*=env[i]* (0.5+ v*0.08);
  // pitch drop via vibrato-ish? Add crackle pops 3+v
  for(let k=0;k<3+v;k++){
    const at=Math.floor((0.02+k*0.035)*SR + rng()*200);
    const dur=Math.floor(0.05*SR);
    for(let j=0;j<dur && at+j<n;j++){
      burst[at+j]+= (rng()*2-1)*Math.exp(-j/(dur*0.3))*0.25;
    }
  }
  for(let i=0;i<n;i++) out[i]=burst[i]*0.45;
  return out;
}
function placeVariant(v){
  const sec=0.18; const n=Math.floor(sec*SR);
  const out=new Float32Array(n);
  // thud sine 150->80
  for(let i=0;i<n;i++){
    const t=i/SR;
    const f=150 - v*18 + (80-150)* (t/sec);
    const env=Math.exp(-t*28)*0.9;
    out[i]+= Math.sin(2*Math.PI*f*t)*env*0.6;
    // noise burst
    if(t<0.12) out[i]+= (Math.random()*2-1)*Math.exp(-t*40)*0.25;
  }
  return scale(out, 0.5);
}
function serve(){
  const sec=0.22; const n=Math.floor(sec*SR);
  const out=new Float32Array(n);
  for(let i=0;i<n;i++){
    const t=i/SR;
    const env=Math.exp(-t*12)*0.5;
    out[i]+= Math.sin(2*Math.PI*620*t)*env*0.3;
    if(t>0.02) out[i]+= Math.sin(2*Math.PI*880*(t-0.02))*Math.exp(-(t-0.02)*10)*0.15;
    if(i< n*0.3) out[i]+= (Math.random()*2-1)*0.06*Math.exp(-t*30);
  }
  return out;
}
function perfectVariant(v){
  const sec=0.42; const n=Math.floor(sec*SR);
  const out=new Float32Array(n);
  const root=660*Math.pow(2, v/12);
  const freqs=[root, root*1.5, root*2];
  const delays=[0,0.05,0.1];
  for(let k=0;k<3;k++){
    const f=freqs[k], d=delays[k];
    const start=Math.floor(d*SR);
    for(let i=start;i<n;i++){
      const t=(i-start)/SR;
      out[i]+= Math.sin(2*Math.PI*f*t)*Math.exp(-t*5.5)* (0.3 - k*0.06);
      // triangle warmth
      out[i]+= (2*Math.abs(2*((f*t)%1)-1)-1)*Math.exp(-t*6)*0.04;
    }
  }
  return scale(out,0.4);
}
function good(){
  const sec=0.18; const n=Math.floor(sec*SR);
  const out=new Float32Array(n);
  for(let i=0;i<n;i++){
    const t=i/SR;
    const f=520 + (640-520)*(t/sec);
    out[i]+= Math.sin(2*Math.PI*f*t)*Math.exp(-t*18)*0.45;
  }
  return out;
}
function burned(){
  const sec=0.5; const n=Math.floor(sec*SR);
  const rng=mulberry(0xcafe);
  const out=new Float32Array(n);
  for(let i=0;i<n;i++){
    const t=i/SR;
    // hiss 2600->700
    const f=2600*Math.pow(700/2600, t/sec);
    // approximate hiss as filtered noise
    const noise=(rng()*2-1)*Math.exp(-Math.pow((f-1500)/1800,2))*0.6;
    out[i]+= noise*Math.exp(-t*3.5)*0.4;
    if(t>0.03){
      const ft=120 + (60-120)*((t-0.03)/(sec-0.03));
      out[i]+= Math.sin(2*Math.PI*ft*(t-0.03))*Math.exp(-(t-0.03)*4)*0.35;
    }
  }
  return out;
}
function coinVariant(v, step=0){
  const sec=0.11; const n=Math.floor(sec*SR);
  const f=(900+v*90)*Math.pow(2, step/12);
  const out=new Float32Array(n);
  for(let i=0;i<n;i++){
    const t=i/SR;
    const env=Math.exp(-t*28);
    out[i]+= Math.sin(2*Math.PI*f*t)*env*0.35;
    out[i]+= Math.sin(2*Math.PI*f*1.5*t)*env*0.12;
    if(t<0.02) out[i]+= Math.sin(2*Math.PI*f*1.35*t)*0.06;
  }
  return out;
}
function orderIn(){
  const sec=0.55; const n=Math.floor(sec*SR);
  const out=new Float32Array(n);
  for(let i=0;i<n;i++){
    const t=i/SR;
    out[i]+= Math.sin(2*Math.PI*880*t)*Math.exp(-t*2.8)*0.22;
    out[i]+= Math.sin(2*Math.PI*1320*t)*Math.exp(-t*3.5)*0.10;
  }
  return out;
}
function charcoalLow(){
  const sec=0.42; const n=Math.floor(sec*SR);
  const out=new Float32Array(n);
  for(let i=0;i<n;i++){
    const t=i/SR;
    let beep=0;
    if(t<0.14) beep=Math.sin(2*Math.PI*(300-60*t/0.14)*t)*Math.exp(-t*8)*0.5;
    else if(t>0.2 && t<0.34) beep=Math.sin(2*Math.PI*(300-60*(t-0.2)/0.14)*(t-0.2))*Math.exp(-(t-0.2)*8)*0.5;
    out[i]=beep;
  }
  return out;
}
function uiTap(){
  const sec=0.07; const n=Math.floor(sec*SR);
  const out=new Float32Array(n);
  for(let i=0;i<n;i++){ const t=i/SR; out[i]=Math.sin(2*Math.PI*(700+200*t/0.07)*t)*Math.exp(-t*38)*0.35; }
  return out;
}
function uiBack(){
  const sec=0.09; const n=Math.floor(sec*SR);
  const out=new Float32Array(n);
  for(let i=0;i<n;i++){ const t=i/SR; out[i]=Math.sin(2*Math.PI*(480-160*t/0.09)*t)*Math.exp(-t*22)*0.3; }
  return out;
}
function uiError(){
  const sec=0.16; const n=Math.floor(sec*SR);
  const out=new Float32Array(n);
  for(let i=0;i<n;i++){
    const t=i/SR;
    // square-ish
    const f=220 - 60*t/0.16;
    const ph=(f*t)%1;
    out[i]=(ph<0.5?1:-1)*Math.exp(-t*9)*0.25;
  }
  return out;
}
function levelUp(){
  const sec=0.85; const n=Math.floor(sec*SR);
  const out=new Float32Array(n);
  const notes=[523,659,784,1046];
  notes.forEach((f, idx)=>{
    const st=Math.floor(idx*0.11*SR);
    for(let i=st;i<n;i++){
      const t=(i-st)/SR;
      out[i]+= Math.sin(2*Math.PI*f*t)*Math.exp(-t*4.2)*0.18;
      out[i]+= 0.04*Math.sin(2*Math.PI*f*2*t)*Math.exp(-t*5);
    }
  });
  return out;
}
function combo(tier){
  const sec=0.45; const n=Math.floor(sec*SR);
  const out=new Float32Array(n);
  const root=440*Math.pow(2, tier*2/12);
  for(let k=0;k<3;k++){
    const f=root*Math.pow(2, k*4/12);
    const st=Math.floor(k*0.07*SR);
    for(let i=st;i<n;i++){
      const t=(i-st)/SR;
      out[i]+= Math.sin(2*Math.PI*f*t)*Math.exp(-t*8)* (0.22 - k*0.03);
    }
  }
  return out;
}
function vipArrive(){
  const sec=0.6; const n=Math.floor(sec*SR);
  const rng=mulberry(0xbeef);
  const out=new Float32Array(n);
  for(let i=0;i<n;i++){
    const t=i/SR;
    let v=0;
    v+= Math.sin(2*Math.PI*587*t)*Math.exp(-t*3.2)*0.22;
    if(t>0.08) v+= Math.sin(2*Math.PI*880*(t-0.08))*Math.exp(-(t-0.08)*3.6)*0.14;
    if(t<0.4) v+= (rng()*2-1)*0.04*Math.exp(-t*6);
    out[i]=v;
  }
  return out;
}
// Music — golden-hour 3400K, 92 BPM, nylon guitar + cavaquinho + pandeiro (efficient)
function guitarString(f, dur, vel=0.5, sr=SR){
  const n=Math.floor(dur*sr);
  const out=new Float32Array(n);
  const period=Math.max(2, Math.floor(sr/f));
  const buf=new Float32Array(period);
  const rng=mulberry(Math.floor(f*1000)%2147483647);
  for(let i=0;i<period;i++) buf[i]=(rng()*2-1)*vel;
  let idx=0; let prev=0;
  for(let i=0;i<n;i++){
    const v=buf[idx];
    out[i]=v*0.65 + prev*0.25;
    const fb=(v+buf[(idx+1)%period])*0.5*0.995;
    buf[idx]=fb*0.996;
    prev=v;
    idx=(idx+1)%period;
  }
  for(let i=0;i<n;i++){
    const t=i/sr;
    const env=Math.exp(-t*1.15)*vel;
    out[i]=out[i]*env + Math.sin(2*Math.PI*f*2*t)*Math.exp(-t*2.5)*vel*0.06;
  }
  return out;
}
function musicLoop(name, sec, bpm, chords){
  const sr=SR;
  const n=Math.floor(sec*sr);
  const out=new Float32Array(n);
  const beat=60/bpm;
  const bar=beat*4;
  const shakerInterval=beat/2;
  const chordMap={
    'C':[261.63,329.63,392,523.25],
    'Am':[220,261.63,329.63,440],
    'F':[174.61,220,261.63,349.23],
    'G':[196,246.94,293.66,392],
  };
  const pickMap=[0,2,1,3,2,1,0,2];
  // place events deterministically
  const numEvents=Math.ceil(sec / shakerInterval)+2;
  for(let e=0;e<numEvents;e++){
    const ts=e*shakerInterval;
    if(ts>=sec) break;
    const at=Math.floor(ts*sr);
    const barIdx=Math.floor(ts/bar) % chords.length;
    const chord=chords[barIdx] || 'C';
    const freqs=chordMap[chord] || chordMap['C'];
    const eighth=e%8;
    const stringIdx=pickMap[eighth] ?? 0;
    const f=freqs[stringIdx % freqs.length];
    const grain=guitarString(f, 0.82, 0.26);
    for(let j=0;j<grain.length && at+j<n;j++){
      const env=Math.exp(-j/(0.82*sr))*0.9;
      out[at+j]+= grain[j]*env*0.16;
    }
    // shaker tick
    const shakerLen=Math.floor(0.035*sr);
    for(let j=0;j<shakerLen && at+j<n;j++){
      const env=Math.exp(-j/(shakerLen*0.35))*0.045;
      out[at+j]+= (Math.random()*2-1)*env * (eighth%2===1 ? 1.0 : 0.55);
    }
    // bass on beats 1 and 3 (e %4===0 or 2 and sub-beat alignment)
    const beatIdx=Math.floor(ts/beat);
    if(beatIdx%2===0){
      const root=freqs[0]/2;
      const bass=guitarString(root, 1.0, 0.30);
      for(let j=0;j<bass.length && at+j<n;j++){
        out[at+j]+= bass[j]*0.10*Math.exp(-j/(1.0*sr));
      }
    }
  }
  // warm pad underneath
  for(let i=0;i<n;i++){
    const ts=i/sr;
    const barIdx=Math.floor(ts/bar) % chords.length;
    const chord=chords[barIdx]||'C';
    const freqs=chordMap[chord] || chordMap['C'];
    const padF=freqs[0]/4;
    out[i]+= Math.sin(2*Math.PI*padF*ts)*0.015;
    out[i]+= Math.sin(2*Math.PI*padF*1.5*ts)*0.008;
  }
  // gentle lowpass + saturation 3400K
  let lp=0;
  for(let i=0;i<n;i++){
    lp+=0.07*(out[i]-lp);
    out[i]=Math.tanh(lp*1.15)*0.60;
  }
  const fade=Math.floor(0.7*sr);
  for(let i=0;i<fade;i++){ const w=i/fade; out[i]*=w; out[n-1-i]*=w; }
  return scale(out, 0.74);
}

async function writeWav(path, samples){
  const header=wavHeader(samples.length);
  const pcm=encodePCM(samples);
  await writeFile(path, Buffer.concat([header, pcm]));
}

async function main(){
  await mkdir(OUT, {recursive:true});
  await mkdir(PROTO_OUT, {recursive:true});
  await mkdir(join(ROOT,'store-assets','screenshots'), {recursive:true});
  const tasks=[
    ['sfx_grill_sizzle_loop.wav', sizzleLoop(2.2)],
    ['sfx_charcoal_crackle_loop.wav', charcoalCrackleLoop(3.0)],
    ['sfx_flip_01.wav', flipVariant(0)],
    ['sfx_flip_02.wav', flipVariant(1)],
    ['sfx_flip_03.wav', flipVariant(2)],
    ['sfx_flip_04.wav', flipVariant(3)],
    ['sfx_place_01.wav', placeVariant(0)],
    ['sfx_place_02.wav', placeVariant(1)],
    ['sfx_serve.wav', serve()],
    ['sfx_perfect_01.wav', perfectVariant(0)],
    ['sfx_perfect_02.wav', perfectVariant(1)],
    ['sfx_perfect_03.wav', perfectVariant(2)],
    ['sfx_good.wav', good()],
    ['sfx_burned.wav', burned()],
    ['sfx_coin_01.wav', coinVariant(0,0)],
    ['sfx_coin_02.wav', coinVariant(1,0)],
    ['sfx_coin_03.wav', coinVariant(2,0)],
    ['sfx_order_in.wav', orderIn()],
    ['sfx_charcoal_low.wav', charcoalLow()],
    ['sfx_ui_tap.wav', uiTap()],
    ['sfx_ui_back.wav', uiBack()],
    ['sfx_ui_error.wav', uiError()],
    ['sfx_level_up.wav', levelUp()],
    ['sfx_combo_05.wav', combo(1)],
    ['sfx_combo_10.wav', combo(2)],
    ['sfx_combo_15.wav', combo(3)],
    ['sfx_combo_20.wav', combo(4)],
    ['sfx_vip_arrive.wav', vipArrive()],
    // music 3400K
    ['mus_home.wav', musicLoop('home', 30, 92, ['C','Am','F','G'])],
    ['mus_gameplay.wav', musicLoop('gameplay', 38, 98, ['C','G','Am','F'])],
    ['mus_result.wav', musicLoop('result', 12, 88, ['F','G','C','C'])],
  ];
  for(const [name, samples] of tasks){
    await writeWav(join(OUT, name), samples);
    await writeWav(join(PROTO_OUT, name), samples);
    console.log(`[audio] ${name} ${samples.length} samples ${(samples.length/SR).toFixed(2)}s`);
  }
  // manifest
  const manifest={
    _comment:'REAL audio assets — warm acoustic 3400K. Replace with studio recordings by swapping files (same ids).',
    sampleRate: SR, bitDepth:16, channels:1,
    sfx:{
      grill:{ loop:'sfx_grill_sizzle_loop.wav', crackle:'sfx_charcoal_crackle_loop.wav' },
      flip:{ variants:['sfx_flip_01.wav','sfx_flip_02.wav','sfx_flip_03.wav','sfx_flip_04.wav'], noRepeat:true },
      place:{ variants:['sfx_place_01.wav','sfx_place_02.wav'] },
      serve:'sfx_serve.wav', perfect:{ variants:['sfx_perfect_01.wav','sfx_perfect_02.wav','sfx_perfect_03.wav'] },
      good:'sfx_good.wav', burned:'sfx_burned.wav',
      coin:{ variants:['sfx_coin_01.wav','sfx_coin_02.wav','sfx_coin_03.wav'], pitchRun:true },
      orderIn:'sfx_order_in.wav', vipArrive:'sfx_vip_arrive.wav',
      charcoalLow:'sfx_charcoal_low.wav', ui:{tap:'sfx_ui_tap.wav', back:'sfx_ui_back.wav', error:'sfx_ui_error.wav'},
      combo:{ '5':'sfx_combo_05.wav','10':'sfx_combo_10.wav','15':'sfx_combo_15.wav','20':'sfx_combo_20.wav' },
      levelUp:'sfx_level_up.wav'
    },
    music:{
      home:{ file:'mus_home.wav', loop:true, duckDb:-6 },
      gameplay:{ file:'mus_gameplay.wav', loop:true, duckDb:-6, intensityLayer:'combo>=5' },
      result:{ file:'mus_result.wav', loop:false }
    },
    buses:{ master:'0dB', music:'-4dB', sfx:'-1.4dB', voice:'-2dB', maxVoices:12 },
    license:'Synthesized placeholders — CC0 until studio foley replaces. No external samples.'
  };
  await writeFile(join(OUT,'manifest.json'), JSON.stringify(manifest,null,2));
  await writeFile(join(PROTO_OUT,'manifest.json'), JSON.stringify(manifest,null,2));
  console.log('[audio] manifest.json');
  console.log('[audio] done — REAL assets ready');
}
main().catch(e=>{console.error(e); process.exit(1);});
