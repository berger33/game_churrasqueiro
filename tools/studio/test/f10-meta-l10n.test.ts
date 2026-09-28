/**
 * tools/studio/test/f10-meta-l10n.test.ts
 * Phase F10 validation: verifies localization coverage (all 381 referenced keys translated in en-US and es-419),
 * meta-progression rules (collection mastery, achievements, missions, pass, route), and accessibility options.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  xpForMasteryLevel,
  addMasteryXp,
  evaluateAchievements,
  updateMissionProgress,
  passTierForXp,
  canUnlockRouteStop,
  createInitialMetaState
} from '../../sim-core/src/meta.ts';

const ROOT = join(import.meta.dirname, '..', '..', '..');
const DATA_DIR = join(ROOT, 'shared', 'data');
const L10N_DIR = join(ROOT, 'shared', 'l10n');

const KEY_FIELDS = /^(nameKey|descKey|taglineKey|reactionPerfectKey|reactionGoodKey|reactionBurnedKey|reactionLostKey|effectKey|titleKey|subtitleKey|labelKey|hintKey|introKey|bodyKey|ctaKey|blurbKey|voiceKey|flavorKey)$/;

function collectReferencedKeys(): Set<string> {
  const referenced = new Set<string>();
  function walk(node: unknown): void {
    if (Array.isArray(node)) {
      for (const v of node) walk(v);
      return;
    }
    if (node && typeof node === 'object') {
      for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
        if (typeof v === 'string' && KEY_FIELDS.test(k)) referenced.add(v);
        walk(v);
      }
    }
  }
  for (const file of readdirSync(DATA_DIR).filter((f) => f.endsWith('.json'))) {
    walk(JSON.parse(readFileSync(join(DATA_DIR, file), 'utf8')));
  }
  return referenced;
}

describe('Phase F10 — Localization Coverage', () => {
  const ptBR = JSON.parse(readFileSync(join(L10N_DIR, 'pt-BR.json'), 'utf8'));
  const enUS = JSON.parse(readFileSync(join(L10N_DIR, 'en-US.json'), 'utf8'));
  const es419 = JSON.parse(readFileSync(join(L10N_DIR, 'es-419.json'), 'utf8'));
  const referenced = collectReferencedKeys();

  it('translates 100% of data-referenced keys in en-US and es-419', () => {
    // 381 + the Escola da Brasa deck (title/open + 6 lessons × title/body + 4 shorts).
    expect(referenced.size).toBe(394);

    const missingEn = [...referenced].filter((k) => !(k in enUS));
    const missingEs = [...referenced].filter((k) => !(k in es419));

    expect(missingEn).toEqual([]);
    expect(missingEs).toEqual([]);
  });

  it('ensures en-US and es-419 contain no orphan keys absent from pt-BR', () => {
    const ptKeys = new Set(Object.keys(ptBR));
    const orphanEn = Object.keys(enUS).filter((k) => !ptKeys.has(k));
    const orphanEs = Object.keys(es419).filter((k) => !ptKeys.has(k));

    expect(orphanEn).toEqual([]);
    expect(orphanEs).toEqual([]);
  });

  it('achieves at least 80% total key coverage in secondary locales', () => {
    const totalPtKeys = Object.keys(ptBR).length;
    const enCoverage = (Object.keys(enUS).length / totalPtKeys) * 100;
    const esCoverage = (Object.keys(es419).length / totalPtKeys) * 100;

    expect(enCoverage).toBeGreaterThanOrEqual(80.0);
    expect(esCoverage).toBeGreaterThanOrEqual(80.0);
  });
});

describe('Phase F10 — Meta-Progression Systems', () => {
  it('calculates mastery XP according to power formula (a=30, exponent=1.5)', () => {
    expect(xpForMasteryLevel(1)).toBe(30);
    expect(xpForMasteryLevel(5)).toBe(335);
    expect(xpForMasteryLevel(10)).toBe(949);
    expect(xpForMasteryLevel(20)).toBe(2683);
  });

  it('progresses mastery level and awards coins and embers at intervals', () => {
    const state = createInitialMetaState();
    const res1 = addMasteryXp(state, 'picanha', 50);
    expect(res1.newLevel).toBe(2);
    expect(res1.coinsReward).toBe(40);
    expect(res1.embersReward).toBe(0);

    // Give enough XP to hit level 5
    const res2 = addMasteryXp(state, 'picanha', 400);
    expect(res2.newLevel).toBeGreaterThanOrEqual(5);
    expect(res2.embersReward).toBe(3); // Awarded at level 5
    expect(state.unlockedCollection['picanha']).toBe(true);
  });

  it('evaluates achievements against player stats without duplicate claims', () => {
    const achievements = [
      { id: 'first_perfect', nameKey: '', descKey: '', stat: 'perfectCooks', goal: 1, reward: { coins: 80, embers: 1 }, tier: 1 },
      { id: 'perfect_25', nameKey: '', descKey: '', stat: 'perfectCooks', goal: 25, reward: { coins: 200, embers: 3 }, tier: 2 },
      { id: 'customers_10', nameKey: '', descKey: '', stat: 'customersServed', goal: 10, reward: { coins: 100 }, tier: 1 }
    ];

    const stats = { perfectCooks: 15, customersServed: 5 };
    const claimed: Record<string, boolean> = {};

    const eval1 = evaluateAchievements(achievements, stats, claimed);
    expect(eval1.claimable.map((a) => a.id)).toEqual(['first_perfect']);
    expect(eval1.totalCoins).toBe(80);
    expect(eval1.totalEmbers).toBe(1);

    // Mark as claimed
    claimed['first_perfect'] = true;

    // Advance stats
    stats.perfectCooks = 30;
    stats.customersServed = 12;

    const eval2 = evaluateAchievements(achievements, stats, claimed);
    expect(eval2.claimable.map((a) => a.id)).toEqual(['perfect_25', 'customers_10']);
    expect(eval2.totalCoins).toBe(300);
    expect(eval2.totalEmbers).toBe(3);
  });

  it('tracks daily and weekly mission completion', () => {
    const missions = [
      { id: 'd_serve_20', nameKey: '', stat: 'customersServed', goal: 20, reward: { coins: 400 } },
      { id: 'd_perfect_10', nameKey: '', stat: 'perfectCooks', goal: 10, reward: { coins: 450 } }
    ];

    const map: Record<string, { stat: string; progress: number; completed: boolean; claimed: boolean }> = {};

    const res1 = updateMissionProgress(missions, map, { customersServed: 12, perfectCooks: 4 });
    expect(res1.newlyCompleted).toEqual([]);
    expect(map['d_serve_20']?.progress).toBe(12);
    expect(map['d_serve_20']?.completed).toBe(false);

    const res2 = updateMissionProgress(missions, map, { customersServed: 10, perfectCooks: 8 });
    expect(res2.newlyCompleted).toContain('d_serve_20');
    expect(res2.newlyCompleted).toContain('d_perfect_10');
    expect(map['d_serve_20']?.completed).toBe(true);
    expect(map['d_perfect_10']?.completed).toBe(true);
  });

  it('calculates Season Pass tier and Rota da Brasa unlocks', () => {
    expect(passTierForXp(0)).toBe(0);
    expect(passTierForXp(999)).toBe(0);
    expect(passTierForXp(1000)).toBe(1);
    expect(passTierForXp(45000)).toBe(45);
    expect(passTierForXp(80000)).toBe(50); // Capped at 50 tiers

    const stop1 = { index: 1, id: 'stop_1', nameKey: '', region: 'sudeste', emberCost: 0, challenge: { type: 'serve', goal: 5 }, reward: {}, storyKey: '' };
    const stop2 = { index: 2, id: 'stop_2', nameKey: '', region: 'sudeste', emberCost: 40, challenge: { type: 'perfect', goal: 8 }, reward: {}, storyKey: '' };

    expect(canUnlockRouteStop(stop2, 1, 30)).toBe(false);
    expect(canUnlockRouteStop(stop2, 1, 45)).toBe(true);
    expect(canUnlockRouteStop(stop2, 2, 45)).toBe(false); // Already past stop 2
  });
});
