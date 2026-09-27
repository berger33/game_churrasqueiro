import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { loadDatabase } from '../load-data.ts';
import { UPGRADE_PHASES, quoteUpgrade, upgradeLevel, upgradePrice } from '../../sim-core/src/upgrades.ts';
import { upgradeCost } from '../../sim-core/src/data.ts';
import { buyUpgrade, newPlayerState } from '../../sim-core/src/economy.ts';
import { deriveStats } from '../../sim-core/src/cooking.ts';
import { offlineSnapshot, restoreOfflineState } from '../../sim-core/src/offline.ts';
import { newSave, serializeSave, deserializeSave, SAVE_SCHEMA_VERSION } from '../../sim-core/src/save.ts';

const db = loadDatabase();
const pt = JSON.parse(readFileSync(new URL('../../../shared/l10n/pt-BR.json', import.meta.url), 'utf8'));

describe('A-06.5: final matrix review of all 27 tracks', () => {
  it('declares exactly 27 upgrade tracks with active phases across 7 categories', () => {
    expect(db.upgrades.tracks).toHaveLength(27);
    const trackIds = db.upgrades.tracks.map(t => t.id).sort();
    const phaseIds = Object.keys(UPGRADE_PHASES).sort();
    expect(phaseIds).toEqual(trackIds);
    for (const [id, phase] of Object.entries(UPGRADE_PHASES)) {
      expect(phase, `Track ${id} must be active`).toBe('active');
    }

    const categories = new Set(db.upgrades.tracks.map(t => t.category));
    expect(Array.from(categories).sort()).toEqual([
      'charcoal', 'employees', 'grill', 'prep', 'prestige', 'restaurant', 'service'
    ]);
  });

  it('calculates exact geometric costs for every level of all 27 tracks, summing to 6,358,620 coins', () => {
    let grandTotal = 0;
    for (const t of db.upgrades.tracks) {
      let trackTotal = 0;
      for (let lvl = 1; lvl <= t.maxLevel; lvl++) {
        const formulaCost = Math.round((t.baseCost * Math.pow(t.growth, lvl - 1)) / 10) * 10;
        const helperCost = upgradeCost(t.baseCost, t.growth, lvl);
        const priceFromZero = upgradePrice(db, t.id, lvl - 1);
        expect(helperCost).toBe(formulaCost);
        expect(priceFromZero).toBe(formulaCost);
        trackTotal += formulaCost;
      }
      expect(trackTotal).toBeGreaterThan(0);
      grandTotal += trackTotal;
    }
    expect(grandTotal).toBe(6_358_620);
  });

  it('verifies localized pt-BR names, descriptions, and explicit employee/prestige scope boundaries', () => {
    for (const t of db.upgrades.tracks) {
      expect(pt[t.nameKey], `Missing pt-BR name for ${t.id}`).toBeTruthy();
      expect(pt[t.descKey], `Missing pt-BR desc for ${t.id}`).toBeTruthy();
    }
    // Employee scope boundaries: Gerente is strictly offline, others are backlog
    expect(pt['upgrade.gerente.desc']).toContain('Renda offline +18% por nível');
    expect(pt['upgrade.gerente.desc']).toContain('Outros benefícios são backlog');

    // Prestige scope boundaries: Brasa mastery only affects tips
    expect(pt['upgrade.brasa_mastery.desc']).toContain('apenas a parcela de gorjeta');

    // Clientela Fiel affects patience
    expect(pt['upgrade.clientela.desc']).toContain('+1% de paciência');
  });

  it('enforces exact starter gating: 18 buyable, 9 gated on recipe/dependency/restaurant', () => {
    const starter = newPlayerState();
    starter.coins = 100_000_000;
    starter.level = 1;
    starter.restaurantIndex = 0;

    const buyable: string[] = [];
    const gated: Record<string, string[]> = {};

    for (const t of db.upgrades.tracks) {
      const q = quoteUpgrade(db, starter, t.id);
      if (q.canBuy) {
        buyable.push(t.id);
      } else {
        gated[t.id] = q.reasons;
      }
    }

    expect(buyable).toHaveLength(18);
    expect(Object.keys(gated)).toHaveLength(9);

    // Specific locks
    expect(gated.knife).toEqual(['recipe_locked']);
    expect(gated.board).toEqual(['recipe_locked']);
    expect(gated.tray).toEqual(['dependency_locked']);
    expect(gated.garcom).toEqual(['restaurant_locked']);
    expect(gated.auxiliar).toEqual(['restaurant_locked', 'recipe_locked']);
    expect(gated.churrasqueiro).toEqual(['restaurant_locked']);
    expect(gated.caixa).toEqual(['restaurant_locked']);
    expect(gated.gerente).toEqual(['restaurant_locked']);
    expect(gated.imperio_logistica).toEqual(['restaurant_locked']);
  });

  it('verifies that every single one of the 27 tracks has an active consumer that reads its effect delta', () => {
    const rest = db.restaurantByIndex.get(4)!;
    const baseStats = deriveStats(db, rest, {});

    for (const t of db.upgrades.tracks) {
      const single = { [t.id]: 1 };
      const derived = deriveStats(db, rest, single);

      switch (t.id) {
        case 'grill_size':
          expect(derived.slotsPerZone).toBe(baseStats.slotsPerZone + t.effect.delta);
          break;
        case 'grill_heat':
          expect(derived.highZoneBonus).toBeCloseTo(t.effect.delta, 5);
          break;
        case 'grill_stability':
          expect(derived.stabilityRecoveryFraction).toBeCloseTo(t.effect.delta, 5);
          break;
        case 'grill_speed':
          expect(derived.heatRampRate).toBeCloseTo(baseStats.heatRampRate + t.effect.delta, 5);
          break;
        case 'charcoal_duration':
          expect(derived.charcoalDurationSec).toBeGreaterThan(baseStats.charcoalDurationSec);
          break;
        case 'charcoal_quality':
          expect(derived.minCharcoalEfficiencyBonus).toBeCloseTo(t.effect.delta, 5);
          break;
        case 'charcoal_auto':
          expect(derived.autoRefillChance).toBeCloseTo(t.effect.delta, 5);
          break;
        case 'knife':
          expect(derived.prepSpeedMult).toBeCloseTo(baseStats.prepSpeedMult + t.effect.delta, 5);
          break;
        case 'board':
          expect(derived.prepSlots).toBe(baseStats.prepSlots + t.effect.delta);
          break;
        case 'counter':
          expect(derived.rawStockCapacityPerIngredient).toBe(baseStats.rawStockCapacityPerIngredient + t.effect.delta);
          break;
        case 'plates':
          expect(derived.tipMult).toBeCloseTo(baseStats.tipMult + t.effect.delta, 5);
          break;
        case 'tray':
          expect(derived.serveSpeedMult).toBeCloseTo(baseStats.serveSpeedMult + t.effect.delta, 5);
          break;
        case 'patience_charm':
          expect(derived.patienceMult).toBeCloseTo(baseStats.patienceMult + t.effect.delta, 5);
          break;
        case 'tables':
          expect(derived.tables).toBe(baseStats.tables + t.effect.delta);
          expect(derived.maxOrdersOnScreen).toBe(baseStats.maxOrdersOnScreen + t.effect.delta);
          break;
        case 'decor':
          expect(derived.tipMult).toBeCloseTo(baseStats.tipMult + t.effect.delta, 5);
          break;
        case 'lighting':
          expect(derived.xpMult).toBeCloseTo(baseStats.xpMult + t.effect.delta, 5);
          break;
        case 'capacity':
          expect(derived.maxOrdersOnScreen).toBe(baseStats.maxOrdersOnScreen + t.effect.delta);
          break;
        case 'sign':
          expect(derived.customerSpawnRate).toBeCloseTo(baseStats.customerSpawnRate + t.effect.delta, 5);
          break;
        case 'music':
          expect(derived.patienceMult).toBeCloseTo(baseStats.patienceMult + t.effect.delta, 5);
          break;
        case 'garcom':
          expect(derived.autoServeLevel).toBe(1);
          break;
        case 'auxiliar':
          expect(derived.autoPrepLevel).toBe(1);
          break;
        case 'churrasqueiro':
          expect(derived.autoFlipLevel).toBe(1);
          break;
        case 'caixa': {
          const snap = offlineSnapshot(db, {
            ...newPlayerState(),
            coins: 0,
            level: 44,
            restaurantIndex: 4,
            upgradeLevels: single
          });
          expect(snap.autoMinutes).toBe(120); // 2 hours auto at level 1
          break;
        }
        case 'gerente': {
          const snapBase = offlineSnapshot(db, {
            ...newPlayerState(),
            coins: 0,
            level: 44,
            restaurantIndex: 4,
            upgradeLevels: {}
          });
          const snapSingle = offlineSnapshot(db, {
            ...newPlayerState(),
            coins: 0,
            level: 44,
            restaurantIndex: 4,
            upgradeLevels: single
          });
          expect(snapSingle.multiplier).toBeCloseTo(snapBase.multiplier + t.effect.delta, 5);
          break;
        }
        case 'brasa_mastery':
          expect(derived.prestigeTipBonus).toBeCloseTo(t.effect.delta, 5);
          break;
        case 'clientela_fiel':
          expect(derived.patienceMult).toBeCloseTo(baseStats.patienceMult + t.effect.delta, 5);
          break;
        case 'imperio_logistica': {
          const snapBase = offlineSnapshot(db, {
            ...newPlayerState(),
            coins: 0,
            level: 44,
            restaurantIndex: 4,
            upgradeLevels: {}
          });
          const snapSingle = offlineSnapshot(db, {
            ...newPlayerState(),
            coins: 0,
            level: 44,
            restaurantIndex: 4,
            upgradeLevels: single
          });
          expect(snapSingle.multiplier).toBeCloseTo(snapBase.multiplier + t.effect.delta, 5);
          break;
        }
        default:
          throw new Error(`Unhandled track ${t.id} in consumer verification`);
      }
    }
  });

  it('all 27 tracks can be bought to max level respecting dependencies, without breaking wallet or counters', () => {
    const p = newPlayerState();
    p.coins = 10_000_000;
    p.level = 80;
    p.restaurantIndex = 6;

    let totalSpent = 0;
    let totalPurchased = 0;
    const totalMaxLevels = db.upgrades.tracks.reduce((sum, t) => sum + t.maxLevel, 0);

    let progress = true;
    while (progress && totalPurchased < totalMaxLevels) {
      progress = false;
      for (const t of db.upgrades.tracks) {
        if ((p.upgradeLevels[t.id] ?? 0) < t.maxLevel) {
          const entry = buyUpgrade(db, p, t.id);
          if (entry) {
            totalSpent += Math.abs(entry.amount);
            totalPurchased++;
            progress = true;
          }
        }
      }
    }

    expect(totalPurchased).toBe(totalMaxLevels);
    for (const t of db.upgrades.tracks) {
      expect(p.upgradeLevels[t.id], t.id).toBe(t.maxLevel);
      expect(buyUpgrade(db, p, t.id)).toBeNull();
      expect(quoteUpgrade(db, p, t.id).reasons).toContain('maxed');
    }

    expect(totalSpent).toBe(6_358_620);
    expect(p.counters.upgradesPurchased).toBe(totalPurchased);
    expect(p.counters.coinsSpentTotal).toBe(totalSpent);
    expect(p.coins).toBe(10_000_000 - 6_358_620);
  });

  it('all 27 track levels survive save serialization/deserialization and CRC validation', () => {
    const save = newSave('a06_final', 12345);
    save.player.coins = 500_000;
    save.player.level = 50;
    save.player.restaurantIndex = 5;

    for (const t of db.upgrades.tracks) {
      save.player.upgradeLevels[t.id] = Math.min(3, t.maxLevel);
    }

    const json = serializeSave(save);
    const loaded = deserializeSave(json);
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;

    expect(loaded.save.schemaVersion).toBe(SAVE_SCHEMA_VERSION);
    for (const t of db.upgrades.tracks) {
      const expected = Math.min(3, t.maxLevel);
      expect(loaded.save.player.upgradeLevels[t.id], t.id).toBe(expected);
      expect(upgradeLevel(db, loaded.save.player.upgradeLevels, t.id)).toBe(expected);
    }
  });

  it('restores offline ledger safely under schema v5 with all absence tracks configured', () => {
    const p = newPlayerState();
    p.restaurantIndex = 4;
    p.upgradeLevels.caixa = 2;
    p.upgradeLevels.gerente = 3;
    p.upgradeLevels.imperio_logistica = 5;

    const snap = offlineSnapshot(db, p);
    expect(snap.eligible).toBe(true);
    expect(snap.autoMinutes).toBe(240); // Caixa 2 = 4h = 240min
    // multiplier = 1 + 3 * 0.18 + 5 * 0.02 + 0 = 1.64
    expect(snap.multiplier).toBeCloseTo(1.64, 5);

    const restored = restoreOfflineState(undefined, 1000);
    expect(restored.version).toBe(1);
    expect(restored.disabled).toBe(false);
  });
});
