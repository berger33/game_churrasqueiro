import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { readJson } from '../load-data.ts';

const audioManifest = JSON.parse(readFileSync('Assets/Audio/manifest.json', 'utf8')) as {
  sampleRate: number;
  bitDepth: number;
  channels: number;
  buses: { master: string; music: string; sfx: string; voice: string; maxVoices: number };
  music: {
    home: { file: string; loop?: boolean; duckDb?: number };
    gameplay: { file: string; loop?: boolean; duckDb?: number };
    result: { file: string; loop?: boolean; duckDb?: number };
  };
  sfx: Record<string, unknown>;
};

const perf = readJson('performance.json') as {
  budget: {
    targetFpsHigh: number;
    targetFpsMedium: number;
    targetFpsLow: number;
    maxDrawCallsHigh: number;
    maxDrawCallsMedium: number;
    maxDrawCallsLow: number;
    maxTrisPerFrame: number;
    maxGcAllocPerFrameBytes: number;
    maxSceneLoadMs: number;
  };
  qualityLevels: {
    id: string;
    resolutionScale: number;
    particlesMultiplier: number;
    dynamicLights: number;
    maxActiveCustomers: number;
  }[];
  autoDetect: {
    sampleSeconds: number;
    fpsLowToMedium: number;
    fpsMediumToHigh: number;
    hysteresisFps: number;
  };
};

// ── Models under test (mirroring C# runtime managers) ───────────────────────

class VoicePoolManager {
  private inUse = 0;
  constructor(private readonly maxVoices: number) {}

  acquire(): boolean {
    if (this.inUse >= this.maxVoices) return false;
    this.inUse++;
    return true;
  }

  release(): void {
    if (this.inUse > 0) this.inUse--;
  }

  get activeVoices(): number {
    return this.inUse;
  }
}

class PitchRunCalculator {
  private streak = 0;
  private lastTime = -100;

  nextPitch(nowSec: number): number {
    if (nowSec - this.lastTime < 1.5) {
      this.streak = Math.min(this.streak + 1, 8);
    } else {
      this.streak = 0;
    }
    this.lastTime = nowSec;
    return 1.0 + this.streak * 0.05;
  }
}

class FlipSampler {
  private lastIdx = -1;
  sample(count: number, rng: () => number): number {
    if (count <= 1) return 0;
    let next = Math.floor(rng() * count);
    if (next === this.lastIdx) {
      next = (next + 1) % count;
    }
    this.lastIdx = next;
    return next;
  }
}

class QualityAutoDetector {
  constructor(
    private readonly lowToMed: number,
    private readonly medToHigh: number,
    private readonly hysteresis: number
  ) {}

  classify(fps: number, currentTier?: 'LOW' | 'MEDIUM' | 'HIGH'): 'LOW' | 'MEDIUM' | 'HIGH' {
    if (currentTier === 'HIGH') {
      if (fps < this.medToHigh - this.hysteresis) {
        return fps < this.lowToMed ? 'LOW' : 'MEDIUM';
      }
      return 'HIGH';
    }
    if (currentTier === 'MEDIUM') {
      if (fps >= this.medToHigh + this.hysteresis) return 'HIGH';
      if (fps < this.lowToMed - this.hysteresis) return 'LOW';
      return 'MEDIUM';
    }
    // LOW or unclassified
    if (fps >= this.medToHigh) return 'HIGH';
    if (fps >= this.lowToMed) return 'MEDIUM';
    return 'LOW';
  }
}

class ClockRollbackGuard {
  constructor(private readonly maxBackwardToleranceSec: number) {}

  checkClock(nowSec: number, lastPersistedSec: number): { rollback: boolean; validIntervalSec: number } {
    if (nowSec < lastPersistedSec - this.maxBackwardToleranceSec) {
      return { rollback: true, validIntervalSec: 0 };
    }
    const elapsed = Math.max(0, nowSec - lastPersistedSec);
    return { rollback: false, validIntervalSec: elapsed };
  }
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('F12 — Audio System Architecture & Assets', () => {
  it('verifies that all audio files referenced in manifest.json exist in Assets/Audio/', () => {
    const audioDir = 'Assets/Audio';
    expect(existsSync(join(audioDir, audioManifest.music.home.file))).toBe(true);
    expect(existsSync(join(audioDir, audioManifest.music.gameplay.file))).toBe(true);
    expect(existsSync(join(audioDir, audioManifest.music.result.file))).toBe(true);

    // Common SFX
    const sfxFiles = [
      'sfx_burned.wav',
      'sfx_charcoal_crackle_loop.wav',
      'sfx_charcoal_low.wav',
      'sfx_coin_01.wav',
      'sfx_flip_01.wav',
      'sfx_good.wav',
      'sfx_grill_sizzle_loop.wav',
      'sfx_level_up.wav',
      'sfx_order_in.wav',
      'sfx_perfect_01.wav',
      'sfx_place_01.wav',
      'sfx_serve.wav',
      'sfx_vip_arrive.wav'
    ];
    for (const f of sfxFiles) {
      expect(existsSync(join(audioDir, f)), `Missing audio clip: ${f}`).toBe(true);
    }
  });

  it('enforces a strict maximum of 12 simultaneous audio voices (§8)', () => {
    expect(audioManifest.buses.maxVoices).toBe(12);
    const pool = new VoicePoolManager(audioManifest.buses.maxVoices);

    for (let i = 0; i < 12; i++) {
      expect(pool.acquire()).toBe(true);
    }
    // 13th voice cannot be acquired without voice stealing/recycling
    expect(pool.acquire()).toBe(false);
    expect(pool.activeVoices).toBe(12);

    pool.release();
    expect(pool.acquire()).toBe(true);
  });

  it('defines ducking parameters (-6 dB) on priority events and loops correctly', () => {
    expect(audioManifest.music.home.duckDb).toBe(-6);
    expect(audioManifest.music.gameplay.duckDb).toBe(-6);
    expect(audioManifest.music.home.loop).toBe(true);
    expect(audioManifest.music.gameplay.loop).toBe(true);
    expect(audioManifest.music.result.loop).toBe(false);
  });

  it('guarantees flip SFX no-repeat rule across consecutive calls', () => {
    const sampler = new FlipSampler();
    const deterministicRngs = [() => 0.1, () => 0.1, () => 0.5, () => 0.5, () => 0.9];
    let last = -1;

    for (const rng of deterministicRngs) {
      const idx = sampler.sample(4, rng);
      expect(idx).not.toBe(last);
      last = idx;
    }
  });

  it('increases coin pickup pitch progressively on rapid collection (pitchRun)', () => {
    const calc = new PitchRunCalculator();
    const p1 = calc.nextPitch(10.0);
    const p2 = calc.nextPitch(10.2);
    const p3 = calc.nextPitch(10.4);

    expect(p1).toBe(1.0);
    expect(p2).toBeGreaterThan(p1);
    expect(p3).toBeGreaterThan(p2);

    // After idle > 1.5s, resets to base pitch 1.0
    const pReset = calc.nextPitch(13.0);
    expect(pReset).toBe(1.0);
  });
});

describe('F12 — Performance Budget & Quality Tiers', () => {
  it('satisfies target frame rates and draw call budgets for all 3 tiers (§4)', () => {
    expect(perf.budget.targetFpsHigh).toBe(60);
    expect(perf.budget.targetFpsMedium).toBe(60);
    expect(perf.budget.targetFpsLow).toBe(30);

    expect(perf.budget.maxDrawCallsHigh).toBe(180);
    expect(perf.budget.maxDrawCallsMedium).toBe(120);
    expect(perf.budget.maxDrawCallsLow).toBe(70);

    expect(perf.budget.maxGcAllocPerFrameBytes).toBe(1024); // ≤ 1 KB/frame
    expect(perf.budget.maxSceneLoadMs).toBeLessThanOrEqual(1500);
  });

  it('defines valid scaling parameters across LOW, MEDIUM, and HIGH quality levels', () => {
    const low = perf.qualityLevels.find((q) => q.id === 'LOW')!;
    const med = perf.qualityLevels.find((q) => q.id === 'MEDIUM')!;
    const high = perf.qualityLevels.find((q) => q.id === 'HIGH')!;

    expect(low.resolutionScale).toBeLessThan(med.resolutionScale);
    expect(med.resolutionScale).toBeLessThan(high.resolutionScale);

    expect(low.particlesMultiplier).toBeLessThan(med.particlesMultiplier);
    expect(med.particlesMultiplier).toBeLessThan(high.particlesMultiplier);

    expect(low.maxActiveCustomers).toBeLessThanOrEqual(med.maxActiveCustomers);
    expect(med.maxActiveCustomers).toBeLessThanOrEqual(high.maxActiveCustomers);
  });

  it('accurately classifies device performance with hysteresis auto-detection', () => {
    const detector = new QualityAutoDetector(
      perf.autoDetect.fpsLowToMedium, // 45
      perf.autoDetect.fpsMediumToHigh, // 55
      perf.autoDetect.hysteresisFps // 5
    );

    // Initial detection
    expect(detector.classify(58)).toBe('HIGH');
    expect(detector.classify(48)).toBe('MEDIUM');
    expect(detector.classify(35)).toBe('LOW');

    // Hysteresis: from HIGH, must drop below (55 - 5) = 50 to downgrade
    expect(detector.classify(52, 'HIGH')).toBe('HIGH');
    expect(detector.classify(49, 'HIGH')).toBe('MEDIUM');

    // Hysteresis: from MEDIUM, must rise to (55 + 5) = 60 to upgrade to HIGH
    expect(detector.classify(58, 'MEDIUM')).toBe('MEDIUM');
    expect(detector.classify(61, 'MEDIUM')).toBe('HIGH');
  });
});

describe('F12 — QA Resilience, Clock Rollback & Lifecycle', () => {
  it('detects backward clock drift > 60s and clamps offline earnings (§57, §58)', () => {
    const guard = new ClockRollbackGuard(60);

    // Normal forward progression of 3600 seconds (1h)
    const normal = guard.checkClock(1000 + 3600, 1000);
    expect(normal.rollback).toBe(false);
    expect(normal.validIntervalSec).toBe(3600);

    // Backward clock manipulation: device clock moved back 2 hours
    const rollback = guard.checkClock(1000 - 7200, 1000);
    expect(rollback.rollback).toBe(true);
    expect(rollback.validIntervalSec).toBe(0); // offline earnings clamped to 0
  });

  it('allows small jitter within 60s tolerance window without false rollback flag', () => {
    const guard = new ClockRollbackGuard(60);
    const smallJitter = guard.checkClock(1000 - 30, 1000); // 30s backward jitter
    expect(smallJitter.rollback).toBe(false);
    expect(smallJitter.validIntervalSec).toBe(0);
  });
});
