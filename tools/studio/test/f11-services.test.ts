import { describe, expect, it } from 'vitest';
import { readJson } from '../load-data.ts';

const ads = readJson('ads.json') as {
  mediation: { provider: string; initializationStrategy: string; neverBlockFirstFrame: boolean };
  units: Record<string, { debug: string; release: string; enabled?: boolean }>;
  rewardedPlacements: { id: string; context: string; cooldownMin: number; maxPerDay: number; analytics: string }[];
  interstitial: {
    enabled: boolean;
    placement: string;
    minSecondsBetween: number;
    maxPerSession: number;
    maxPerDay: number;
    skipFirstTurns: number;
    skipFirstSessions: number;
    suppressAfterIapHours: number;
    suppressAfterRewardedMin: number;
    suppressDuring: string[];
    showProbability: number;
  };
  consent: { framework: string; regions: Record<string, string>; requestOnFirstLaunch: boolean; blockingFirstFrame: boolean };
  antiFraud: { rewardTokenSingleUse: boolean; tokenTtlSec: number; maxConcurrentRewardCallbacks: number };
};

const iap = readJson('iap.json') as {
  version: number;
  ethics: {
    noDarkPatterns: boolean;
    confirmBeforePurchase: boolean;
    showRealPrice: boolean;
    noFakeScarcity: boolean;
    noDisguisedAds: boolean;
    restoreAlwaysAvailable: boolean;
    starterPackShownAfterTurns: number;
    starterPackShownAfterFirstUpgrade: boolean;
    purchaseCooldownAfterAnyPurchaseHours: number;
  };
  products: {
    id: string;
    type: string;
    contents: { currency?: string; amount?: number; type?: string; id?: string }[];
    oneTimePerAccount?: boolean;
    suggestedPriceBRL: number;
  }[];
  emberValueTableBRL: { productId: string; brl: number; embers: number }[];
  receiptValidation: {
    mode: string;
    serverSideVerification: string;
    fallback: string;
    retryPolicy: { attempts: number; backoffMs: number[] };
    gracefulOffline: string;
  };
};

const remoteConfig = readJson('remoteconfig_defaults.json') as {
  version: number;
  config: Record<string, unknown>;
  fetchPolicy: {
    minimumFetchIntervalSecondsRelease: number;
    minimumFetchIntervalSecondsDebug: number;
    timeoutSeconds: number;
    blockingStartup: boolean;
  };
};

const analytics = readJson('analytics.json') as {
  version: number;
  provider: string;
  piiPolicy: {
    forbiddenParams: string[];
    forbiddenParamSubstrings: string[];
    userIdAllowed: string;
  };
  events: { name: string; params: Record<string, string> }[];
};

// ── Service logic models under test (mirrors C# implementations) ────────────

class PiiFilter {
  constructor(
    private readonly forbiddenParams: Set<string>,
    private readonly forbiddenSubstrings: string[]
  ) {}

  sanitize(params: Record<string, unknown>): { clean: Record<string, unknown>; dropped: string[] } {
    const clean: Record<string, unknown> = {};
    const dropped: string[] = [];

    for (const [k, v] of Object.entries(params)) {
      const lower = k.toLowerCase();
      if (this.forbiddenParams.has(lower) || this.forbiddenSubstrings.some((sub) => lower.includes(sub))) {
        dropped.push(k);
      } else {
        clean[k] = v;
      }
    }
    return { clean, dropped };
  }
}

class TokenVault {
  private readonly used = new Map<string, number>();
  private inFlight = 0;

  constructor(private readonly now: () => number, private readonly ttlSec: number) {}

  issue(placement: string): string {
    return `${placement}:${this.now()}:${Math.random().toString(36).slice(2, 8)}`;
  }

  beginCallback(): boolean {
    if (this.inFlight >= 1) return false;
    this.inFlight++;
    return true;
  }

  endCallback(): void {
    if (this.inFlight > 0) this.inFlight--;
  }

  redeem(token: string): boolean {
    const parts = token.split(':');
    if (parts.length < 3) return false;
    const ts = Number(parts[1]);
    if (!Number.isFinite(ts)) return false;
    if (this.now() - ts > this.ttlSec) return false;
    if (this.used.has(token)) return false;
    this.used.set(token, this.now());
    return true;
  }
}

class StarterPackGate {
  constructor(
    private readonly minTurns: number,
    private readonly requireFirstUpgrade: boolean,
    private readonly cooldownHours: number
  ) {}

  canOffer(ctx: {
    completedTurns: number;
    hasUpgraded: boolean;
    alreadyPurchased: boolean;
    hoursSinceLastPurchase: number;
  }): { allowed: boolean; reason: string } {
    if (ctx.alreadyPurchased) return { allowed: false, reason: 'already_purchased' };
    if (ctx.completedTurns < this.minTurns) return { allowed: false, reason: 'turns_requirement_unmet' };
    if (this.requireFirstUpgrade && !ctx.hasUpgraded) return { allowed: false, reason: 'first_upgrade_unmet' };
    if (ctx.hoursSinceLastPurchase < this.cooldownHours) return { allowed: false, reason: 'purchase_cooldown_24h' };
    return { allowed: true, reason: 'eligible' };
  }
}

class GrantRegistry {
  private readonly granted = new Set<string>();

  tryGrant(token: string): boolean {
    if (!token || this.granted.has(token)) return false;
    this.granted.add(token);
    return true;
  }
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('F11 — Firebase Telemetry & PII Protection', () => {
  it('enforces anonymous install UUID only and declares zero PII params', () => {
    expect(analytics.provider).toBe('firebase_analytics');
    expect(analytics.piiPolicy.userIdAllowed).toBe('anonymous_install_uuid_only');
    expect(analytics.piiPolicy.forbiddenParams).toContain('email');
    expect(analytics.piiPolicy.forbiddenParams).toContain('phone');
    expect(analytics.piiPolicy.forbiddenParams).toContain('cpf');
    expect(analytics.piiPolicy.forbiddenParams).toContain('device_id_raw');
  });

  it('drops any forbidden PII parameter from event payloads before dispatch', () => {
    const filter = new PiiFilter(
      new Set(analytics.piiPolicy.forbiddenParams.map((s) => s.toLowerCase())),
      analytics.piiPolicy.forbiddenParamSubstrings
    );

    const payload = {
      turn_index: 5,
      score: 1200,
      user_email: 'test@example.com',
      player_cpf: '12345678900',
      gps_lat: -23.5505,
      quality_level: 'HIGH'
    };

    const result = filter.sanitize(payload);
    expect(result.clean).toEqual({
      turn_index: 5,
      score: 1200,
      quality_level: 'HIGH'
    });
    expect(result.dropped).toEqual(expect.arrayContaining(['user_email', 'player_cpf', 'gps_lat']));
  });

  it('registers all 50 required telemetry events with non-empty schemas', () => {
    expect(analytics.events.length).toBe(50);
    const eventNames = new Set(analytics.events.map((e) => e.name));
    expect(eventNames.size).toBe(50);
    expect(eventNames).toContain('tutorial_start');
    expect(eventNames).toContain('tutorial_complete');
    expect(eventNames).toContain('level_complete');
    expect(eventNames).toContain('vip_arrival');
    expect(eventNames).toContain('rewarded_complete');
    expect(eventNames).toContain('iap_success');
  });
});

describe('F11 — Remote Config Policies & Baked Defaults', () => {
  it('configures safe non-blocking fetch with 8s timeout (§62, §66)', () => {
    expect(remoteConfig.fetchPolicy.blockingStartup).toBe(false);
    expect(remoteConfig.fetchPolicy.timeoutSeconds).toBe(8);
    expect(remoteConfig.fetchPolicy.minimumFetchIntervalSecondsDebug).toBe(0);
    expect(remoteConfig.fetchPolicy.minimumFetchIntervalSecondsRelease).toBe(21600);
  });

  it('contains valid baked defaults for all critical simulation scalars', () => {
    const c = remoteConfig.config;
    expect(c['difficulty_scalar']).toBe(1.0);
    expect(c['charcoal_duration_seconds']).toBe(150);
    expect(c['vip_chance']).toBe(0.06);
    expect(c['vip_max_per_day']).toBe(2);
    expect(c['idle_max_offline_hours']).toBe(8);
    expect(c['ads_interstitial_enabled']).toBe(true);
    expect(c['ads_interstitial_show_probability']).toBe(0.6);
    expect(c['kill_switch_iap']).toBe(false);
    expect(c['kill_switch_ads']).toBe(false);
  });
});

describe('F11 — AdMob, Rewarded Placements & Anti-Fraud Single-Use', () => {
  it('defines exactly 8 rewarded placements matching spec §34', () => {
    expect(ads.rewardedPlacements.length).toBe(8);
    const placementIds = ads.rewardedPlacements.map((p) => p.id);
    expect(placementIds).toEqual([
      'double_offline',
      'double_turn',
      'unburn_plate',
      'revive_turn',
      'call_vip',
      'extra_chest',
      'speed_upgrade',
      'reroll_reward'
    ]);
  });

  it('enforces single-use reward tokens and rejects duplicate redemptions', () => {
    let now = 1000;
    const vault = new TokenVault(() => now, ads.antiFraud.tokenTtlSec);

    const token = vault.issue('double_turn');
    expect(vault.redeem(token)).toBe(true);
    expect(vault.redeem(token)).toBe(false); // replay attempt blocked
  });

  it('rejects expired reward tokens past 3600s TTL', () => {
    let now = 1000;
    const vault = new TokenVault(() => now, ads.antiFraud.tokenTtlSec);

    const token = vault.issue('double_offline');
    now += ads.antiFraud.tokenTtlSec + 5;
    expect(vault.redeem(token)).toBe(false); // expired
  });

  it('limits concurrent reward callbacks to 1', () => {
    const vault = new TokenVault(() => 1000, 3600);
    expect(vault.beginCallback()).toBe(true);
    expect(vault.beginCallback()).toBe(false); // second simultaneous callback blocked
    vault.endCallback();
    expect(vault.beginCallback()).toBe(true);
  });

  it('configures UMP consent with non-blocking first frame', () => {
    expect(ads.consent.framework).toContain('UMP');
    expect(ads.consent.blockingFirstFrame).toBe(false);
    expect(ads.consent.regions['brazil']).toBe('lgpd_notice');
    expect(ads.consent.regions['eeaUk']).toBe('required');
  });
});

describe('F11 — Play Billing v7, Débito B-07 & Ethical Purchases', () => {
  it('resolves Débito B-07: currency pack SKUs are brasa.embers.* rather than brasa.coins.*', () => {
    const ids = iap.products.map((p) => p.id);
    expect(ids).toContain('brasa.embers.small.v1');
    expect(ids).toContain('brasa.embers.medium.v1');
    expect(ids).toContain('brasa.embers.large.v1');
    expect(ids).not.toContain('brasa.coins.small.v1');
    expect(ids).not.toContain('brasa.coins.medium.v1');
    expect(ids).not.toContain('brasa.coins.large.v1');

    // Ember value table alignment
    for (const entry of iap.emberValueTableBRL) {
      expect(entry.productId).toMatch(/^brasa\.embers\./);
    }
  });

  it('verifies non-consumables and seasonal pass products in catalogue', () => {
    const ids = iap.products.map((p) => p.id);
    expect(ids).toContain('brasa.starterpack.v1');
    expect(ids).toContain('brasa.noads.v1');
    expect(ids).toContain('brasa.pass.season.v1');
    expect(ids).toContain('brasa.pass.bundle.v1');
  });

  it('enforces starter pack ethical timing guards (§39, §98)', () => {
    const gate = new StarterPackGate(
      iap.ethics.starterPackShownAfterTurns,
      iap.ethics.starterPackShownAfterFirstUpgrade,
      iap.ethics.purchaseCooldownAfterAnyPurchaseHours
    );

    // Turn 1, no upgrade
    expect(gate.canOffer({ completedTurns: 1, hasUpgraded: false, alreadyPurchased: false, hoursSinceLastPurchase: 100 }).allowed).toBe(false);
    // Turn 4, no upgrade
    expect(gate.canOffer({ completedTurns: 4, hasUpgraded: false, alreadyPurchased: false, hoursSinceLastPurchase: 100 }).allowed).toBe(false);
    // Turn 4, upgraded, eligible
    expect(gate.canOffer({ completedTurns: 4, hasUpgraded: true, alreadyPurchased: false, hoursSinceLastPurchase: 100 }).allowed).toBe(true);
    // Within 24h of another purchase
    expect(gate.canOffer({ completedTurns: 5, hasUpgraded: true, alreadyPurchased: false, hoursSinceLastPurchase: 12 }).allowed).toBe(false);
    // Already owned
    expect(gate.canOffer({ completedTurns: 5, hasUpgraded: true, alreadyPurchased: true, hoursSinceLastPurchase: 100 }).allowed).toBe(false);
  });

  it('enforces receipt validation retry policy with 3 attempts and backoff [500, 2000, 8000] ms', () => {
    expect(iap.receiptValidation.mode).toBe('google_play_billing_v7');
    expect(iap.receiptValidation.fallback).toBe('local_signature_check');
    expect(iap.receiptValidation.retryPolicy.attempts).toBe(3);
    expect(iap.receiptValidation.retryPolicy.backoffMs).toEqual([500, 2000, 8000]);
    expect(iap.receiptValidation.gracefulOffline).toBe('grant_pending_flag');
  });

  it('deduplicates purchase grant tokens to prevent duplicate grants', () => {
    const registry = new GrantRegistry();
    const token = 'GPA.1234-5678-9012';

    expect(registry.tryGrant(token)).toBe(true);
    expect(registry.tryGrant(token)).toBe(false); // duplicate blocked
    expect(registry.tryGrant('GPA.9999-0000-1111')).toBe(true);
  });
});
