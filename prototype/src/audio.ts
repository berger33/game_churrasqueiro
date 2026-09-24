/**
 * WebAudio-synthesised feedback layer for the prototype.
 *
 * docs/10-AUDIO.md §6 states the prototype "uses WebAudio-synthesised
 * placeholders so the *rhythm* of the feedback can be evaluated". Until now that
 * was not true — there was no audio at all. This module makes it true.
 *
 * These are PLACEHOLDERS, not shippable assets (§82). They are synthesised so the
 * prototype needs no audio files and works offline (§96). Every cue keeps the id
 * from §3's asset list so swapping in recordings is a one-line change per cue.
 *
 * Direction follows §1: warm and acoustic. Low-passed noise beds rather than
 * bright synth stabs, and no percussion shorthand.
 */

/** Cue ids — exactly the ones in docs/10-AUDIO.md §3. */
export type SfxId =
  | 'flip' | 'place' | 'serve' | 'perfect' | 'good' | 'burned'
  | 'coin' | 'orderIn' | 'combo' | 'levelUp' | 'charcoalLow'
  | 'uiTap' | 'uiBack' | 'uiError' | 'vipArrive';

interface CtxLike {
  currentTime: number;
  sampleRate: number;
  destination: AudioNode;
  state: string;
  resume(): Promise<void>;
  createGain(): GainNode;
  createOscillator(): OscillatorNode;
  createBufferSource(): AudioBufferSourceNode;
  createBiquadFilter(): BiquadFilterNode;
  createBuffer(channels: number, length: number, sampleRate: number): AudioBuffer;
}

export class PrototypeAudio {
  private ctx: CtxLike | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  /** Last variant used per cue, so repeats are not identical in a row (§2). */
  private lastVariant = new Map<string, number>();
  /** Coin pitch climbs through a run, then resets (§3). */
  private coinRun = 0;
  private coinRunAt = 0;
  muted = false;

  /**
   * Browsers block audio until a user gesture, so the context is created lazily
   * and resumed on the first input rather than at construction.
   */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const Ctor = (globalThis as { AudioContext?: typeof AudioContext }).AudioContext;
    if (!Ctor) return; // no WebAudio (Node harness) — cues become no-ops
    try {
      const ctx = new Ctor() as unknown as CtxLike;
      this.ctx = ctx;
      const master = ctx.createGain();
      master.gain.value = 0.85;
      master.connect(ctx.destination);
      this.master = master;
      this.noise = this.makeNoise(ctx);
      if (ctx.state === 'suspended') void ctx.resume();
    } catch {
      this.ctx = null;
    }
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.85;
  }

  /** White-noise buffer, reused by every sizzle/crackle/hiss cue. */
  private makeNoise(ctx: CtxLike): AudioBuffer {
    const len = Math.floor(ctx.sampleRate * 2);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  /** Next variant index for a cue, never repeating the previous one. */
  private variant(cue: string, count: number): number {
    let v = Math.floor(Math.random() * count);
    if (count > 1 && v === this.lastVariant.get(cue)) v = (v + 1) % count;
    this.lastVariant.set(cue, v);
    return v;
  }

  private get now(): number {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  /** A filtered noise burst — the workhorse for sizzle, crackle and hiss. */
  private noiseBurst(
    t0: number, dur: number, gain: number,
    filter: BiquadFilterType, freq: number, q = 1, sweepTo?: number
  ): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    src.playbackRate.value = 0.9 + Math.random() * 0.25;

    const bq = ctx.createBiquadFilter();
    bq.type = filter;
    bq.frequency.setValueAtTime(freq, t0);
    bq.Q.value = q;
    if (sweepTo !== undefined) bq.frequency.exponentialRampToValueAtTime(Math.max(40, sweepTo), t0 + dur);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t0 + dur * 0.15);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    src.connect(bq);
    bq.connect(g);
    g.connect(this.master!);
    src.start(t0, Math.random() * 1.5);
    src.stop(t0 + dur + 0.02);
  }

  /** A single pitched tone with an optional glide — used for stings and bells. */
  private tone(
    t0: number, dur: number, freq: number, gain: number,
    type: OscillatorType = 'sine', glideTo?: number, attack = 0.008
  ): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (glideTo !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(20, glideTo), t0 + dur);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    osc.connect(g);
    g.connect(this.master!);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  /**
   * Play a cue. Silent no-op when muted, when the context is not yet unlocked,
   * or when running outside a browser.
   */
  play(id: SfxId, opts: { combo?: number; intensity?: number } = {}): void {
    if (this.muted || !this.ctx || !this.master || !this.noise) return;
    const t = this.now;
    const combo = opts.combo ?? 0;

    switch (id) {
      // §2: a short TSSSS transient with a pitch drop plus a crackle burst,
      // four variants so no two flips sound identical in a row.
      case 'flip': {
        const v = this.variant('flip', 4);
        const base = 1500 + v * 220;
        this.noiseBurst(t, 0.3, 0.16 + v * 0.01, 'highpass', base, 0.8, base * 0.45);
        for (let i = 0; i < 3 + v; i++) {
          this.noiseBurst(t + 0.02 + i * 0.035, 0.05, 0.05, 'bandpass', 2400 + Math.random() * 1800, 6);
        }
        break;
      }

      // Two variants, a soft thud of food meeting the grate.
      case 'place': {
        const v = this.variant('place', 2);
        this.noiseBurst(t, 0.16, 0.13, 'bandpass', 900 + v * 260, 1.4, 420);
        this.tone(t, 0.12, 150 - v * 18, 0.1, 'sine', 80);
        break;
      }

      case 'serve':
        this.tone(t, 0.1, 620, 0.09, 'triangle', 880);
        this.noiseBurst(t + 0.02, 0.14, 0.06, 'highpass', 3200, 0.7);
        break;

      // Three variants of a bright but warm sting.
      case 'perfect': {
        const v = this.variant('perfect', 3);
        const root = 660 * Math.pow(2, v / 12);
        this.tone(t, 0.34, root, 0.13, 'triangle');
        this.tone(t + 0.05, 0.3, root * 1.5, 0.09, 'sine');
        this.tone(t + 0.1, 0.34, root * 2, 0.07, 'sine');
        break;
      }

      case 'good':
        this.tone(t, 0.16, 520, 0.09, 'sine', 640);
        break;

      // Hiss plus a dull thud — failure must read clearly without being harsh.
      case 'burned':
        this.noiseBurst(t, 0.45, 0.14, 'highpass', 2600, 0.6, 700);
        this.tone(t + 0.03, 0.28, 120, 0.14, 'sine', 60);
        break;

      // Three variants; pitch climbs through a run, then resets (§3).
      case 'coin': {
        const runT = (this.ctx as unknown as { currentTime: number }).currentTime;
        if (runT - this.coinRunAt > 1.2) this.coinRun = 0;
        this.coinRunAt = runT;
        const step = Math.min(this.coinRun++, 7);
        const v = this.variant('coin', 3);
        const f = (900 + v * 90) * Math.pow(2, step / 12);
        this.tone(t, 0.09, f, 0.085, 'triangle', f * 1.35);
        this.tone(t + 0.02, 0.07, f * 1.5, 0.05, 'sine');
        break;
      }

      // A soft bell, warm not shrill.
      case 'orderIn':
        this.tone(t, 0.5, 880, 0.1, 'sine');
        this.tone(t, 0.32, 1320, 0.05, 'sine');
        break;

      // Rising series — the milestone pitch tracks the combo tier.
      case 'combo': {
        const tier = combo >= 20 ? 4 : combo >= 15 ? 3 : combo >= 10 ? 2 : combo >= 5 ? 1 : 0;
        const root = 440 * Math.pow(2, tier * 2 / 12);
        for (let i = 0; i < 3; i++) {
          this.tone(t + i * 0.07, 0.22, root * Math.pow(2, i * 4 / 12), 0.1 - i * 0.02, 'triangle');
        }
        break;
      }

      case 'levelUp': {
        const notes = [523, 659, 784, 1046];
        notes.forEach((f, i) => this.tone(t + i * 0.1, 0.4, f, 0.11, 'triangle'));
        break;
      }

      // Two low pulses — a warning, not an alarm.
      case 'charcoalLow':
        this.tone(t, 0.14, 300, 0.1, 'sine', 240);
        this.tone(t + 0.2, 0.14, 300, 0.1, 'sine', 240);
        break;

      case 'uiTap':
        this.tone(t, 0.06, 700, 0.06, 'sine', 900);
        break;
      case 'uiBack':
        this.tone(t, 0.08, 480, 0.06, 'sine', 320);
        break;
      case 'uiError':
        this.tone(t, 0.14, 220, 0.09, 'square', 160);
        break;

      case 'vipArrive': {
        this.tone(t, 0.5, 587, 0.11, 'triangle');
        this.tone(t + 0.08, 0.45, 880, 0.08, 'sine');
        this.noiseBurst(t, 0.4, 0.04, 'highpass', 4200, 0.6);
        break;
      }
    }
  }

  /**
   * Continuous grill bed. Intensity 0..1 drives gain and filter cutoff, so a
   * dying fire audibly calms down (§2). Returns a handle the caller can stop.
   */
  startSizzleBed(): { setIntensity(v: number): void; stop(): void } {
    const noop = { setIntensity: () => {}, stop: () => {} };
    if (this.muted || !this.ctx || !this.master || !this.noise) return noop;

    const ctx = this.ctx;
    const t = this.now;

    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    src.playbackRate.value = 0.85;

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 900;

    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 260;

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.02, t + 0.6);

    src.connect(hp);
    hp.connect(lp);
    lp.connect(g);
    g.connect(this.master);
    src.start(t);

    // Random crackle on top of the bed.
    const crackle = globalThis.setInterval(() => {
      if (!this.ctx || !this.master || this.muted) return;
      if (Math.random() < 0.55) {
        this.noiseBurst(this.now, 0.045, 0.035, 'bandpass', 1800 + Math.random() * 2600, 8);
      }
    }, 220);

    return {
      setIntensity: (v: number) => {
        const k = v < 0 ? 0 : v > 1 ? 1 : v;
        const nowT = this.ctx ? this.ctx.currentTime : 0;
        g.gain.setTargetAtTime(0.006 + k * 0.05, nowT, 0.25);
        lp.frequency.setTargetAtTime(500 + k * 2200, nowT, 0.3);
      },
      stop: () => {
        globalThis.clearInterval(crackle);
        try {
          const nowT = this.ctx ? this.ctx.currentTime : 0;
          g.gain.setTargetAtTime(0.0001, nowT, 0.1);
          src.stop(nowT + 0.4);
        } catch { /* already stopped */ }
      }
    };
  }
}

/** One shared instance — the prototype never needs two audio engines. */
export const audio = new PrototypeAudio();
