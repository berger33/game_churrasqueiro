import { describe, expect, it } from 'vitest';
import { loadAndValidate } from '../load-data.ts';
import {
  applyTurnResult, buyUpgrade, canUnlockRestaurant, computeOfflineEarnings, costFor,
  createSessionEconomy, levelUpCoinReward, newPlayerState, recordLedger, unlockRestaurant
} from '../../sim-core/src/economy.ts';
import { levelForXp, totalXpForLevel, upgradeCost, xpForLevel } from '../../sim-core/src/data.ts';
import type { TurnResult } from '../../sim-core/src/turn.ts';

const { db } = loadAndValidate();

function turn(coins: number, xp: number, extra: Partial<TurnResult['counters']> = {}): TurnResult {
  return {
    levelId: 't',
    coins,
    xp,
    stars: 3,
    combo: 0,
    durationSec: 90,
    failed: false,
    events: [],
    counters: {
      customersSpawned: 5, customersServed: 5, customersLost: 0, ordersCompleted: 5,
      perfectCooks: 4, goodCooks: 1, burnedFood: 0, bestCombo: 4, flips: 6, itemsCooked: 6,
      charcoalRefills: 0, peakSimultaneousOrders: 2, flawless: true, ...extra
    }
  };
}

describe('economy service', () => {
  it('credits a turn and records ledger entries', () => {
    const p = newPlayerState();
    const res = applyTurnResult(db, p, turn(500, 40));
    expect(p.coins).toBeGreaterThanOrEqual(500);
    expect(res.coinsEarned).toBe(500);
    expect(res.ledger.some((e) => e.source === 'turn' && e.amount === 500)).toBe(true);
    expect(p.counters['coinsEarnedTotal']).toBeGreaterThanOrEqual(500);
  });

  it('levels up and grants level rewards', () => {
    const p = newPlayerState();
    const { a, exponent, minPerLevel } = db.economy.xp.formula;
    applyTurnResult(db, p, turn(0, xpForLevel(1, a, exponent, minPerLevel)));
    expect(p.level).toBe(2);
    expect(p.coins).toBe(levelUpCoinReward(db.economy.reward.levelUpCoins, 2));
  });

  it('pays level rewards on a polynomial curve, never exponential', () => {
    const cfg = db.economy.reward.levelUpCoins;
    const l10 = levelUpCoinReward(cfg, 10);
    const l47 = levelUpCoinReward(cfg, 47);
    const l80 = levelUpCoinReward(cfg, 80);
    // The bug this guards against: 100 * 1.28^46 = 10.3M coins for a single level.
    expect(l47).toBeLessThan(100_000);
    expect(l80).toBeLessThan(300_000);
    expect(l80 / l10).toBeLessThan(10);
    const total = Array.from({ length: 80 }, (_, i) => levelUpCoinReward(cfg, i + 1)).reduce((x, y) => x + y, 0);
    expect(total).toBeLessThan(5_000_000);
  });

  it('grants premium currency only on every nth level', () => {
    const every = db.economy.reward.levelUpEmbers.every;
    const p = newPlayerState();
    const { a, exponent, minPerLevel } = db.economy.xp.formula;
    for (let l = 1; l < every; l++) {
      applyTurnResult(db, p, turn(0, xpForLevel(l, a, exponent, minPerLevel)));
    }
    expect(p.level).toBe(every);
    expect(p.embers).toBe(db.economy.reward.levelUpEmbers.amount);
  });

  it('computes upgrade costs and refuses to exceed max level', () => {
    const t = db.upgradeById.get('grill_size')!;
    expect(costFor(db, 'grill_size', 0)).toBe(upgradeCost(t.baseCost, t.growth, 1));
    expect(costFor(db, 'grill_size', t.maxLevel)).toBe(Infinity);
    expect(costFor(db, 'does_not_exist', 0)).toBe(Infinity);
  });

  it('buys upgrades, deducts currency and blocks unaffordable purchases', () => {
    const p = newPlayerState();
    expect(buyUpgrade(db, p, 'grill_size')).toBeNull(); // no money
    p.coins = 10_000;
    const entry = buyUpgrade(db, p, 'grill_size');
    expect(entry).not.toBeNull();
    expect(p.upgradeLevels['grill_size']).toBe(1);
    expect(p.coins).toBe(10_000 - entry!.amount * -1);
    expect(p.counters['upgradesPurchased']).toBe(1);
  });

  it('caps upgrades at max level', () => {
    const p = newPlayerState();
    p.coins = 10_000_000;
    const t = db.upgradeById.get('grill_size')!;
    for (let i = 0; i < t.maxLevel + 5; i++) buyUpgrade(db, p, 'grill_size');
    expect(p.upgradeLevels['grill_size']).toBe(t.maxLevel);
  });

  it('unlocks restaurants in strict order', () => {
    const p = newPlayerState();
    p.coins = 99_999_999;
    p.level = 80;
    expect(canUnlockRestaurant(db, p, 2)).toBe(false); // cannot skip tier 1
    expect(unlockRestaurant(db, p, 1)).toBe(true);
    expect(p.restaurantIndex).toBe(1);
    expect(unlockRestaurant(db, p, 1)).toBe(false); // cannot re-buy
    expect(unlockRestaurant(db, p, 2)).toBe(true);
  });
});

describe('offline / idle earnings', () => {
  it('earns nothing before the idle tier', () => {
    const p = newPlayerState();
    p.restaurantIndex = 0;
    expect(computeOfflineEarnings(db, p, 3600, 0).coins).toBe(0);
  });

  it('scales with elapsed time', () => {
    const p = newPlayerState();
    p.restaurantIndex = 3;
    const short = computeOfflineEarnings(db, p, 600, 0);
    const long = computeOfflineEarnings(db, p, 3600, 0);
    expect(long.coins).toBeGreaterThan(short.coins);
  });

  it('caps at the configured maximum', () => {
    const p = newPlayerState();
    p.restaurantIndex = 3;
    const cap = db.economy.idle.maxOfflineHours * 3600;
    const atCap = computeOfflineEarnings(db, p, cap, 0);
    const overCap = computeOfflineEarnings(db, p, cap * 10, 0);
    expect(overCap.coins).toBe(atCap.coins);
    expect(overCap.capped).toBe(true);
    expect(atCap.capped).toBe(false);
  });

  it('applies the ramp so short absences are not over-rewarded', () => {
    const p = newPlayerState();
    p.restaurantIndex = 3;
    const perMin = db.economy.idle.coinsPerMinuteByRestaurant[3]!;
    const oneMin = computeOfflineEarnings(db, p, 60, 0);
    // Ramp starts at 50 % of nominal.
    expect(oneMin.coins).toBeLessThanOrEqual(Math.round(perMin));
    expect(oneMin.coins).toBeGreaterThanOrEqual(Math.round(perMin * 0.45));
  });

  it('handles zero and negative elapsed time', () => {
    const p = newPlayerState();
    p.restaurantIndex = 3;
    expect(computeOfflineEarnings(db, p, 0, 0).coins).toBe(0);
    expect(computeOfflineEarnings(db, p, -100, 0).coins).toBe(0);
  });
});

describe('session ledger', () => {
  it('separates faucets from sinks and computes the spend ratio', () => {
    const s = createSessionEconomy();
    recordLedger(s, [
      { currency: 'coins', amount: 1000, source: 'turn', balance: 1000 },
      { currency: 'coins', amount: -250, source: 'upgrade:x', balance: 750 },
      { currency: 'embers', amount: 5, source: 'level_up', balance: 5 }
    ]);
    expect(s.faucetTotal()).toBe(1000);
    expect(s.sinkTotal()).toBe(250);
    expect(s.spendRatio()).toBeCloseTo(0.25, 5);
  });

  it('ignores non-coin currency in the spend ratio', () => {
    const s = createSessionEconomy();
    recordLedger(s, [{ currency: 'embers', amount: -50, source: 'cosmetic', balance: 0 }]);
    expect(s.sinkTotal()).toBe(0);
  });
});

describe('xp curve', () => {
  it('is monotonic and reaches max level only with real play', () => {
    const { a, exponent, minPerLevel } = db.economy.xp.formula;
    let prev = 0;
    for (let l = 1; l <= db.economy.xp.maxLevel; l++) {
      const need = xpForLevel(l, a, exponent, minPerLevel);
      expect(need).toBeGreaterThan(prev);
      prev = need;
    }
    const total = totalXpForLevel(db.economy.xp.maxLevel, a, exponent, minPerLevel);
    expect(levelForXp(total - 1, a, exponent, minPerLevel, db.economy.xp.maxLevel)).toBe(db.economy.xp.maxLevel - 1);
    expect(levelForXp(total, a, exponent, minPerLevel, db.economy.xp.maxLevel)).toBe(db.economy.xp.maxLevel);
  });

  it('never exceeds max level', () => {
    const { a, exponent, minPerLevel } = db.economy.xp.formula;
    expect(levelForXp(1e12, a, exponent, minPerLevel, db.economy.xp.maxLevel)).toBe(db.economy.xp.maxLevel);
  });
});
