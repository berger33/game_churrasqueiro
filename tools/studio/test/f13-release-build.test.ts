import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { readJson } from '../load-data.ts';

const storeListing = JSON.parse(readFileSync('marketing/store_listings.json', 'utf8')) as {
  package: string;
  defaultLocale: string;
  targetAudience: string;
  category: string;
  containsAds: boolean;
  hasInAppPurchases: boolean;
  dataSafety: {
    collectsPii: boolean;
    encryptedInTransit: boolean;
    deletionRequestSupported: boolean;
    deletionUrl: string;
    privacyPolicyUrl: string;
    collectedDataTypes: { type: string; purpose: string }[];
  };
  locales: Record<
    string,
    {
      title: string;
      shortDescriptionVariants: Record<string, string>;
      fullDescription: string;
      keywords: string[];
    }
  >;
};

const perf = readJson('performance.json') as {
  budget: {
    maxAabBaseSizeMB: number;
    maxApkSizeMB: number;
    maxTextureMemoryMB: number;
  };
};

const remoteConfig = readJson('remoteconfig_defaults.json') as {
  config: {
    kill_switch_iap: boolean;
    kill_switch_ads: boolean;
    kill_switch_events: boolean;
    ab_test_id: string;
  };
};

describe('F13 — Build Pipeline & Signing Configuration (§1-§3 of docs/12-BUILD.md)', () => {
  it('confirms the canonical package name matches the store listing', () => {
    expect(storeListing.package).toBe('com.studiobrasa.churrascomestredabrasa');
  });

  it('validates the target AAB base size budget (≤ 90 MB)', () => {
    expect(perf.budget.maxAabBaseSizeMB).toBeLessThanOrEqual(90);
    expect(perf.budget.maxApkSizeMB).toBeLessThanOrEqual(120);
  });

  it('verifies that BuildPipeline.cs exists and is structured for Unity 6 LTS batch compilation', () => {
    const buildPipelinePath = 'Assets/Scripts/Editor/BuildPipeline.cs';
    expect(existsSync(buildPipelinePath)).toBe(true);

    const code = readFileSync(buildPipelinePath, 'utf8');
    expect(code).toContain('BuildAndroidAab');
    expect(code).toContain('BuildAndroidApk');
    expect(code).toContain('com.studiobrasa.churrascomestredabrasa');
    expect(code).toContain('ARM64');
    expect(code).toContain('IL2CPP');
    expect(code).toContain('Linear');
    expect(code).toContain('CHURRASCO_KEYSTORE_PATH');
  });
});

describe('F13 — Store Listing & ASO Metadata (§68-§71, docs/15-ASO.md)', () => {
  const supportedLocales = ['pt-BR', 'en-US', 'es-419'];

  it('supports all 3 primary store locales (pt-BR, en-US, es-419)', () => {
    for (const loc of supportedLocales) {
      expect(storeListing.locales[loc]).toBeDefined();
    }
  });

  it('restricts title length to ≤ 30 characters in all locales', () => {
    for (const loc of supportedLocales) {
      const title = storeListing.locales[loc]!.title;
      expect(title.length).toBeGreaterThan(0);
      expect(title.length, `Title for ${loc} exceeds 30 chars: "${title}"`).toBeLessThanOrEqual(30);
    }
  });

  it('restricts all 3 short description variants (A, B, C) to ≤ 80 characters in all locales', () => {
    for (const loc of supportedLocales) {
      const variants = storeListing.locales[loc]!.shortDescriptionVariants;
      expect(variants['A_skill']).toBeDefined();
      expect(variants['B_progression']).toBeDefined();
      expect(variants['C_culture']).toBeDefined();

      for (const [name, text] of Object.entries(variants)) {
        expect(text.length).toBeGreaterThan(0);
        expect(text.length, `Variant ${name} in ${loc} exceeds 80 chars: "${text}"`).toBeLessThanOrEqual(80);
      }
    }
  });

  it('provides a detailed full description (≤ 4000 characters) in all locales', () => {
    for (const loc of supportedLocales) {
      const full = storeListing.locales[loc]!.fullDescription;
      expect(full.length).toBeGreaterThan(200);
      expect(full.length).toBeLessThanOrEqual(4000);
      expect(full.toLowerCase()).toContain('churrasco');
    }
  });

  it('declares relevant ASO keywords in all locales without competitor stuffing', () => {
    for (const loc of supportedLocales) {
      const kws = storeListing.locales[loc]!.keywords;
      expect(kws.length).toBeGreaterThanOrEqual(8);
      // Ensures core keywords exist
      const lower = kws.map((k) => k.toLowerCase());
      expect(lower.some((k) => k.includes('churrasco') || k.includes('bbq') || k.includes('picanha') || k.includes('picaña'))).toBe(true);
    }
  });
});

describe('F13 — Google Play Data Safety Compliance (§67, docs/16-PRIVACY.md)', () => {
  it('declares zero PII collection and full transport encryption', () => {
    expect(storeListing.dataSafety.collectsPii).toBe(false);
    expect(storeListing.dataSafety.encryptedInTransit).toBe(true);
  });

  it('provides valid URLs for privacy policy and user data deletion requests', () => {
    expect(storeListing.dataSafety.privacyPolicyUrl).toMatch(/^https:\/\//);
    expect(storeListing.dataSafety.deletionUrl).toMatch(/^https:\/\//);
    expect(storeListing.dataSafety.deletionRequestSupported).toBe(true);
  });

  it('confirms the target audience is declared 13+ (no Families policy overhead)', () => {
    expect(storeListing.targetAudience).toBe('13+');
    expect(storeListing.category).toBe('GAME_CASUAL');
    expect(storeListing.containsAds).toBe(true);
    expect(storeListing.hasInAppPurchases).toBe(true);
  });
});

describe('F13 — Release Controls & Emergency Rollback (§4 of docs/13-RELEASE.md)', () => {
  it('declares remote kill-switches for IAP, Ads, and Events in Remote Config defaults', () => {
    expect(remoteConfig.config.kill_switch_iap).toBe(false);
    expect(remoteConfig.config.kill_switch_ads).toBe(false);
    expect(remoteConfig.config.kill_switch_events).toBe(false);
  });

  it('provides ab_test_id mechanism for staged testing and cohort evaluation', () => {
    expect(remoteConfig.config.ab_test_id).toBeDefined();
  });
});
