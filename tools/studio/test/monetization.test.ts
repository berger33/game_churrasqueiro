import { describe, expect, it } from 'vitest';
import { readJson } from '../load-data.ts';

const ads = readJson('ads.json') as {
  mediation: Record<string, unknown>;
  consent: Record<string, unknown>;
  androidAppId: string;
  iosAppId: string;
  units: Record<string, { debug: string; release: string; enabled?: boolean }>;
  rewardedPlacements: { id: string; cooldownMin: number; maxPerDay: number }[];
  interstitial: Record<string, unknown>;
  antiFraud: { rewardTokenSingleUse: boolean; tokenTtlSec: number; maxConcurrentRewardCallbacks: number };
};
const iap = readJson('iap.json') as {
  ethics: Record<string, unknown>;
  products: { id: string; type: string; contents: unknown[]; oneTimePerAccount?: boolean; suggestedPriceBRL: number }[];
  emberValueTableBRL: { productId: string; brl: number; embers: number }[];
};

// ── Reference implementations of the runtime policies under test ────────────
// These mirror AdPlacementPolicy.cs and RewardTokenVault.cs; the Unity tests
// assert the same behaviour against the real classes.

class RewardTokenVault {
  private readonly used = new Map<string, number>();
  constructor(private readonly now: () => number, private readonly ttlSec: number) {}
  issue(id: string): string {
    const token = `${id}:${this.now()}:${Math.random().toString(36).slice(2, 8)}`;
    return token;
  }
  redeem(token: string): boolean {
    const parts = token.split(':');
    if (parts.length < 3) return false;
    const issuedAt = Number(parts[1]);
    if (!Number.isFinite(issuedAt)) return false;
    if (this.now() - issuedAt > this.ttlSec) return false; // expired
    if (this.used.has(token)) return false; // already redeemed
    this.used.set(token, this.now());
    return true;
  }
}

class PlacementPolicy {
  private perDay = new Map<string, number>();
  private lastAt = new Map<string, number>();
  constructor(private readonly cfg: { id: string; cooldownMin: number; maxPerDay: number }[]) {}
  canShow(id: string, nowSec: number): boolean {
    const c = this.cfg.find((x) => x.id === id);
    if (!c) return false;
    if ((this.perDay.get(id) ?? 0) >= c.maxPerDay) return false;
    const last = this.lastAt.get(id);
    if (last !== undefined && nowSec - last < c.cooldownMin * 60) return false;
    return true;
  }
  record(id: string, nowSec: number): void {
    this.perDay.set(id, (this.perDay.get(id) ?? 0) + 1);
    this.lastAt.set(id, nowSec);
  }
  resetDay(): void {
    this.perDay = new Map();
  }
}

class InterstitialPolicy {
  shown = 0;
  lastAt = -Infinity;
  constructor(private readonly cfg: {
    minSecondsBetween: number; maxPerSession: number; maxPerDay: number;
    skipFirstTurns: number; skipFirstSessions: number;
    suppressAfterIapHours: number; suppressAfterRewardedMin: number;
    suppressDuring: string[]; showProbability: number;
  }) {}
  decide(ctx: {
    turnsPlayed: number; sessionIndex: number; state: string;
    secondsSinceIap: number; secondsSinceRewarded: number;
    interstitialsToday: number; now: number; roll: number;
  }): { show: boolean; reason: string } {
    if (ctx.turnsPlayed < this.cfg.skipFirstTurns) return { show: false, reason: 'skip_first_turns' };
    if (ctx.sessionIndex < this.cfg.skipFirstSessions) return { show: false, reason: 'skip_first_sessions' };
    if (this.cfg.suppressDuring.includes(ctx.state)) return { show: false, reason: 'suppressed_state' };
    if (ctx.secondsSinceIap < this.cfg.suppressAfterIapHours * 3600) return { show: false, reason: 'after_iap' };
    if (ctx.secondsSinceRewarded < this.cfg.suppressAfterRewardedMin * 60) return { show: false, reason: 'after_rewarded' };
    if (ctx.interstitialsToday >= this.cfg.maxPerDay) return { show: false, reason: 'daily_cap' };
    if (this.shown >= this.cfg.maxPerSession) return { show: false, reason: 'session_cap' };
    if (ctx.now - this.lastAt < this.cfg.minSecondsBetween) return { show: false, reason: 'cooldown' };
    if (ctx.roll > this.cfg.showProbability) return { show: false, reason: 'probability' };
    this.shown++;
    this.lastAt = ctx.now;
    return { show: true, reason: 'shown' };
  }
}

class GrantOnce {
  private readonly granted = new Set<string>();
  grant(key: string): boolean {
    if (this.granted.has(key)) return false;
    this.granted.add(key);
    return true;
  }
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('rewarded ads policy', () => {
  it('enforces the per-placement daily cap', () => {
    const p = new PlacementPolicy(ads.rewardedPlacements);
    const cap = ads.rewardedPlacements.find((x) => x.id === 'double_turn')!.maxPerDay;
    for (let i = 0; i < cap; i++) {
      expect(p.canShow('double_turn', 1000 + i * 3600)).toBe(true);
      p.record('double_turn', 1000 + i * 3600);
    }
    expect(p.canShow('double_turn', 1000 + cap * 3600)).toBe(false);
  });

  it('enforces the cooldown', () => {
    const p = new PlacementPolicy(ads.rewardedPlacements);
    p.record('unburn_plate', 0);
    expect(p.canShow('unburn_plate', 30)).toBe(false);
    expect(p.canShow('unburn_plate', 2 * 60 + 1)).toBe(true);
  });

  it('resets caps on a new day', () => {
    const p = new PlacementPolicy(ads.rewardedPlacements);
    const cap = ads.rewardedPlacements.find((x) => x.id === 'revive_turn')!.maxPerDay;
    for (let i = 0; i < cap; i++) p.record('revive_turn', i * 3600);
    expect(p.canShow('revive_turn', cap * 3600)).toBe(false);
    p.resetDay();
    expect(p.canShow('revive_turn', cap * 3600)).toBe(true);
  });

  it('rejects unknown placements', () => {
    expect(new PlacementPolicy(ads.rewardedPlacements).canShow('not_a_placement', 0)).toBe(false);
  });
});

describe('reward token anti-fraud', () => {
  it('rejects a duplicated reward callback (spec §35)', () => {
    expect(ads.antiFraud.rewardTokenSingleUse).toBe(true);
    let t = 0;
    const v = new RewardTokenVault(() => t, ads.antiFraud.tokenTtlSec);
    const token = v.issue('double_turn');
    expect(v.redeem(token)).toBe(true);
    expect(v.redeem(token)).toBe(false); // replayed callback
  });

  it('rejects an expired token', () => {
    let t = 0;
    const v = new RewardTokenVault(() => t, ads.antiFraud.tokenTtlSec);
    const token = v.issue('double_turn');
    t = ads.antiFraud.tokenTtlSec + 1;
    expect(v.redeem(token)).toBe(false);
  });

  it('rejects malformed tokens', () => {
    const v = new RewardTokenVault(() => 0, 3600);
    expect(v.redeem('garbage')).toBe(false);
    expect(v.redeem('')).toBe(false);
  });

  it('allows only one concurrent reward callback', () => {
    expect(ads.antiFraud.maxConcurrentRewardCallbacks).toBe(1);
  });
});

describe('interstitial policy (spec §36)', () => {
  const cfg = ads.interstitial as unknown as ConstructorParameters<typeof InterstitialPolicy>[0];
  const base = {
    turnsPlayed: 10, sessionIndex: 3, state: 'turn_result',
    secondsSinceIap: Infinity, secondsSinceRewarded: Infinity,
    interstitialsToday: 0, now: 10_000, roll: 0.1
  };

  it('never shows during cooking, an active order, a critical action or the tutorial', () => {
    for (const state of cfg.suppressDuring) {
      const p = new InterstitialPolicy(cfg);
      expect(p.decide({ ...base, state }).show, `should not show during ${state}`).toBe(false);
    }
  });

  it('skips the first turns and first sessions', () => {
    const p = new InterstitialPolicy(cfg);
    expect(p.decide({ ...base, turnsPlayed: 0 }).show).toBe(false);
    expect(p.decide({ ...base, turnsPlayed: cfg.skipFirstTurns - 1 }).show).toBe(false);
    expect(p.decide({ ...base, sessionIndex: 0 }).show).toBe(false);
    expect(p.decide({ ...base, sessionIndex: cfg.skipFirstSessions }).show).toBe(true);
  });

  it('is suppressed after an IAP', () => {
    const p = new InterstitialPolicy(cfg);
    expect(p.decide({ ...base, secondsSinceIap: 60 }).show).toBe(false);
    expect(p.decide({ ...base, secondsSinceIap: cfg.suppressAfterIapHours * 3600 + 1 }).show).toBe(true);
  });

  it('is suppressed right after a rewarded view', () => {
    const p = new InterstitialPolicy(cfg);
    expect(p.decide({ ...base, secondsSinceRewarded: 30 }).show).toBe(false);
    expect(p.decide({ ...base, secondsSinceRewarded: cfg.suppressAfterRewardedMin * 60 + 1 }).show).toBe(true);
  });

  it('respects the session and daily caps', () => {
    const p = new InterstitialPolicy(cfg);
    let now = 10_000;
    let shown = 0;
    for (let i = 0; i < 20; i++) {
      now += cfg.minSecondsBetween + 1;
      if (p.decide({ ...base, now }).show) shown++;
    }
    expect(shown).toBe(cfg.maxPerSession);

    const q = new InterstitialPolicy(cfg);
    expect(q.decide({ ...base, interstitialsToday: cfg.maxPerDay }).show).toBe(false);
  });

  it('respects the cooldown between impressions', () => {
    const p = new InterstitialPolicy(cfg);
    expect(p.decide({ ...base, now: 10_000 }).show).toBe(true);
    expect(p.decide({ ...base, now: 10_000 + cfg.minSecondsBetween - 1 }).show).toBe(false);
    expect(p.decide({ ...base, now: 10_000 + cfg.minSecondsBetween + 1 }).show).toBe(true);
  });

  it('is probability gated', () => {
    const p = new InterstitialPolicy(cfg);
    expect(p.decide({ ...base, roll: 0.99 }).show).toBe(false);
  });

  it('only ever uses the single approved placement', () => {
    expect(cfg.suppressDuring).toEqual(expect.arrayContaining(['cooking', 'active_order', 'critical_action', 'tutorial']));
    expect(ads.interstitial['placement']).toBe('turn_result_to_lobby_only');
  });
});

describe('IAP catalogue', () => {
  it('ships the required products (spec §38)', () => {
    const ids = iap.products.map((p) => p.id);
    expect(ids).toContain('brasa.starterpack.v1');
    expect(ids).toContain('brasa.noads.v1');
    expect(ids).toContain('brasa.pass.season.v1');
    expect(ids.filter((i) => i.startsWith('brasa.coins.')).length).toBeGreaterThanOrEqual(3);
  });

  it('has unique product ids and non-empty contents', () => {
    const ids = iap.products.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of iap.products) expect(p.contents.length).toBeGreaterThan(0);
  });

  it('gives volume discounts on the currency packs', () => {
    const sorted = [...iap.emberValueTableBRL].sort((a, b) => a.brl - b.brl);
    const unit = sorted.map((p) => p.brl / p.embers);
    for (let i = 1; i < unit.length; i++) expect(unit[i]!).toBeLessThanOrEqual(unit[i - 1]!);
  });

  it('declares the ethics rules required by §98', () => {
    expect(iap.ethics['noDarkPatterns']).toBe(true);
    expect(iap.ethics['confirmBeforePurchase']).toBe(true);
    expect(iap.ethics['showRealPrice']).toBe(true);
    expect(iap.ethics['noFakeScarcity']).toBe(true);
    expect(iap.ethics['noDisguisedAds']).toBe(true);
    expect(iap.ethics['restoreAlwaysAvailable']).toBe(true);
  });

  it('does not show the starter pack on the first screen (spec §39)', () => {
    expect(iap.ethics['starterPackShownAfterTurns']).toBeGreaterThan(0);
    expect(iap.ethics['starterPackShownAfterFirstUpgrade']).toBe(true);
  });

  it('marks one-time products correctly', () => {
    const starter = iap.products.find((p) => p.id === 'brasa.starterpack.v1')!;
    const noads = iap.products.find((p) => p.id === 'brasa.noads.v1')!;
    expect(starter.oneTimePerAccount).toBe(true);
    expect(noads.oneTimePerAccount).toBe(true);
    expect(noads.type).toBe('nonconsumable');
  });
});

describe('purchase granting', () => {
  it('grants exactly once for a given purchase token', () => {
    const g = new GrantOnce();
    expect(g.grant('GPA.1234')).toBe(true);
    expect(g.grant('GPA.1234')).toBe(false);
    expect(g.grant('GPA.5678')).toBe(true);
  });
});

describe('ad configuration hygiene (spec §37, §93)', () => {
  it('uses Google test ids in debug and placeholders in release', () => {
    const TEST_ACCOUNT = 'ca-app-pub-3940256099942544';
    for (const [name, unit] of Object.entries(ads.units)) {
      if (unit.debug) expect(unit.debug).toContain(TEST_ACCOUNT);
      if (unit.release) expect(unit.release, `${name} release id must be a placeholder`).toBe('REPLACE_IN_SECURE_CONFIG');
    }
  });

  it('disables banners during gameplay (spec §34)', () => {
    expect(ads.units['banner']!.enabled).toBe(false);
  });

  it('initialises ads asynchronously and never blocks the first frame (spec §66)', () => {
    expect(ads.mediation['initializationStrategy']).toBe('async_non_blocking');
    expect(ads.mediation['neverBlockFirstFrame']).toBe(true);
  });

  it('declares a consent framework', () => {
    expect(ads.consent['framework']).toContain('UMP');
    expect(ads.consent['blockingFirstFrame']).toBe(false);
  });
});
