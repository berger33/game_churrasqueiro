import { describe, expect, it } from 'vitest';
import { loadAndValidate, readJson } from '../load-data.ts';
import { upgradeCost, xpForLevel, totalXpForLevel, levelForXp } from '../../sim-core/src/data.ts';

describe('data tables', () => {
  it('are structurally valid and internally consistent', () => {
    const { db, problems } = loadAndValidate();
    expect(problems, problems.join('\n')).toEqual([]);
    expect(db.ingredientById.size).toBeGreaterThanOrEqual(12); // spec §8 minimum
    expect(db.customerById.size).toBeGreaterThanOrEqual(8); // spec §84 minimum
    expect(db.restaurantByIndex.size).toBeGreaterThanOrEqual(7); // spec §15
    expect(db.upgradeById.size).toBeGreaterThanOrEqual(20); // spec §84 minimum
  });

  it('ship the 12 launch ingredients named in the brief (spec §8)', () => {
    const { db } = loadAndValidate();
    const required = [
      'linguica_toscana', 'pao_de_alho', 'frango_coxa', 'coracao_frango', 'queijo_coalho',
      'picanha', 'fraldinha', 'contra_file', 'maminha', 'costela', 'legumes_grelhados', 'espetinho_misto'
    ];
    for (const id of required) expect(db.ingredientById.has(id), `missing ingredient ${id}`).toBe(true);
  });

  it('give every restaurant a reachable, non-empty customer pool', () => {
    const { db } = loadAndValidate();
    for (const r of db.restaurants.restaurants) {
      const usable = r.customerPool.filter((id) => {
        const c = db.customerById.get(id);
        return c && c.weight > 0 && c.minRestaurant <= r.index;
      });
      expect(usable.length, `${r.id} has no spawnable customer`).toBeGreaterThan(0);
    }
  });

  it('unlock every ingredient from a defined restaurant tier', () => {
    const { db } = loadAndValidate();
    const maxIndex = Math.max(...[...db.restaurantByIndex.keys()]);
    for (const ing of db.ingredients.items) {
      expect(ing.unlock.restaurantIndex).toBeLessThanOrEqual(maxIndex);
      expect(ing.unlock.level).toBeGreaterThanOrEqual(1);
    }
  });

  it('keep VIP out of the normal spawn rotation (spec §13)', () => {
    const { db } = loadAndValidate();
    const vip = db.customerById.get('vip');
    expect(vip).toBeDefined();
    expect(vip!.weight).toBe(0);
  });

  it('have no hardcoded localization strings in gameplay tables', () => {
    const tables = ['ingredients.json', 'customers.json', 'restaurants.json', 'upgrades.json', 'achievements.json', 'missions.json', 'events.json'];
    const forbidden = /[à-üÀ-Ü]/; // any accented char means a literal pt-BR string leaked in
    for (const t of tables) {
      const raw = JSON.stringify(readJson(t));
      expect(forbidden.test(raw), `${t} contains accented literal text — use *Key fields`).toBe(false);
    }
  });

  it('contain no real ad unit IDs outside the debug set', () => {
    const ads = readJson('ads.json') as { units: Record<string, { debug: string; release: string }>; androidAppId: { debug: string; release: string } };
    for (const [, unit] of Object.entries(ads.units)) {
      if (unit.release && unit.release !== 'REPLACE_IN_SECURE_CONFIG') {
        expect(unit.release.startsWith('ca-app-pub-3940256099942544'), 'Google test id must not ship in release').toBe(false);
      }
    }
    expect(ads.androidAppId.release).toBe('REPLACE_IN_SECURE_CONFIG');
  });

  it('declare at least 50 achievements (spec §29)', () => {
    const ach = readJson('achievements.json') as { achievements: { id: string; stat: string; goal: number }[] };
    expect(ach.achievements.length).toBeGreaterThanOrEqual(50);
    const ids = new Set(ach.achievements.map((a) => a.id));
    expect(ids.size).toBe(ach.achievements.length);
    for (const a of ach.achievements) {
      expect(a.goal).toBeGreaterThan(0);
      expect(a.stat.length).toBeGreaterThan(0);
    }
  });

  it('declare the analytics taxonomy required by the brief (spec §59)', () => {
    const tax = readJson('analytics.json') as { events: { name: string }[]; piiPolicy: { forbiddenParams: string[] } };
    const names = new Set(tax.events.map((e) => e.name));
    const required = [
      'first_open', 'tutorial_start', 'tutorial_step', 'tutorial_complete', 'session_start',
      'level_start', 'level_complete', 'level_fail', 'order_complete', 'order_failed',
      'perfect_cook', 'burned_food', 'combo_reached', 'restaurant_upgrade', 'currency_earned',
      'currency_spent', 'rewarded_offer', 'rewarded_start', 'rewarded_complete',
      'interstitial_impression', 'shop_open', 'iap_view', 'iap_start', 'iap_success', 'iap_fail',
      'daily_reward', 'daily_mission_complete', 'event_start', 'event_complete',
      'collection_unlock', 'churn_risk_signal'
    ];
    for (const r of required) expect(names.has(r), `missing analytics event ${r}`).toBe(true);
    expect(tax.piiPolicy.forbiddenParams.length).toBeGreaterThan(3);
  });
});

describe('economy formulae', () => {
  it('produce strictly increasing upgrade costs', () => {
    const { db } = loadAndValidate();
    for (const u of db.upgrades.tracks) {
      let prev = 0;
      for (let l = 1; l <= u.maxLevel; l++) {
        const c = upgradeCost(u.baseCost, u.growth, l);
        expect(c).toBeGreaterThan(prev);
        expect(c % 10).toBe(0);
        prev = c;
      }
    }
  });

  it('produce a monotonically increasing XP curve', () => {
    const { db } = loadAndValidate();
    const { a, exponent, minPerLevel } = db.economy.xp.formula;
    let prev = 0;
    for (let l = 1; l <= db.economy.xp.maxLevel; l++) {
      const need = xpForLevel(l, a, exponent, minPerLevel);
      expect(need).toBeGreaterThan(prev);
      prev = need;
    }
    expect(totalXpForLevel(2, a, exponent, minPerLevel)).toBe(xpForLevel(1, a, exponent, minPerLevel));
    expect(levelForXp(0, a, exponent, minPerLevel, 80)).toBe(1);
    expect(levelForXp(xpForLevel(1, a, exponent, minPerLevel), a, exponent, minPerLevel, 80)).toBe(2);
  });

  it('never let the player reach max level trivially', () => {
    const { db } = loadAndValidate();
    const { a, exponent, minPerLevel } = db.economy.xp.formula;
    const total = totalXpForLevel(db.economy.xp.maxLevel, a, exponent, minPerLevel);
    expect(total).toBeGreaterThan(100_000);
  });
});
