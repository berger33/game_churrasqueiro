import { describe, it, expect } from 'vitest';
import { loadDatabase } from '../load-data.ts';
import {
  createFood,
  stageOf,
  deriveStats,
  TurnSimulation,
  SkillPolicy,
  Rng,
  newPlayerState,
  newSave,
  evolveChurrasqueira,
  computeOfflineEarnings,
  serializeSave,
  deserializeSave,
  type SaveGame
} from '../../sim-core/src/index.ts';

const db = loadDatabase();

describe('F5.1 — Sim-Core Mechanical Debts', () => {
  it('A-14: stageOf returns "burned" on stageOverrides ingredients when burned is true', () => {
    const pao = db.ingredientById.get('pao_de_alho')!;
    expect(pao.stageOverrides && pao.stageOverrides.length > 0).toBe(true);

    const f = createFood(1, pao);
    // 2 sides: side 0 is 1.25 (burned), side 1 is 0.1 -> overall is 0.675
    f.sides[0] = 1.25;
    f.sides[1] = 0.1;
    f.burned = true;

    // Previously, overall doneness (0.675) matched stageOverride 'crispy' (< 0.95), ignoring burned state.
    const stage = stageOf(db, f);
    expect(stage).toBe('burned');
  });

  it('A-14: stageOf returns correct non-burned stage on stageOverrides when not burned', () => {
    const pao = db.ingredientById.get('pao_de_alho')!;
    const f = createFood(2, pao);
    f.sides[0] = 0.5;
    f.sides[1] = 0.5;
    f.burned = false;

    const stage = stageOf(db, f);
    expect(stage).toBe('warm');
  });

  it('A-15: Bot reference policy does not leak items in 1-zone lata_valente', () => {
    const sim = new TurnSimulation(
      db,
      {
        restaurantIndex: 1,
        levelId: 'level_001',
        upgradeLevels: {},
        seed: 42,
        playerLevel: 10,
        churrasqueiraId: 'lata_valente',
        churrasqueiraLevel: 1
      },
      42
    );
    const pol = new SkillPolicy(new Rng(1), { skill: 0.6 });

    while (!sim.finished) {
      sim.tick(1 / 30, (a) => pol.act(a));
    }

    expect(sim.counters.itemsCooked).toBeGreaterThan(0);
    // foods array should stay compact and not leak thousands of spawned items
    expect(sim.foods.length).toBeLessThanOrEqual(5);
  });

  it('A-10: refillCharcoal respects and debits refillCostCoins when non-zero', () => {
    const prevCost = db.grill.charcoal.refillCostCoins;
    try {
      db.grill.charcoal.refillCostCoins = 50;

      const sim = new TurnSimulation(
        db,
        {
          restaurantIndex: 0,
          levelId: 'level_001',
          upgradeLevels: {},
          seed: 123,
          playerLevel: 1
        },
        123
      );

      // Initial turn coins = 0 -> cannot afford refill
      const failedRefill = sim.refillCharcoal();
      expect(failedRefill).toBe(false);

      // Give turn 100 coins -> can afford refill
      (sim as unknown as { coins: number }).coins = 100;
      const okRefill = sim.refillCharcoal();
      expect(okRefill).toBe(true);
      expect((sim as unknown as { coins: number }).coins).toBe(50);

      // Immediate second refill attempt while already refilling -> should fail and not charge
      const doubleRefill = sim.refillCharcoal();
      expect(doubleRefill).toBe(false);
      expect((sim as unknown as { coins: number }).coins).toBe(50);
    } finally {
      db.grill.charcoal.refillCostCoins = prevCost;
    }
  });

  it('A-11: evolveChurrasqueira records embersSpentTotal and handles ember cost', () => {
    const ch = db.churrasqueiras!.churrasqueiras.find((c) => c.id === 'lata_valente')!;
    const evo2 = ch.evolutions.find((e) => e.level === 2)!;
    const prevCoins = evo2.costCoins;
    const prevEmbers = evo2.costEmbers ?? 0;
    try {
      evo2.costCoins = 0;
      evo2.costEmbers = 5;

      const p = newPlayerState();
      p.embers = 10;
      p.churrasqueiraLevels['lata_valente'] = 1;

      const ledger = evolveChurrasqueira(db, p);
      expect(ledger).not.toBeNull();
      expect(ledger!.currency).toBe('embers');
      expect(ledger!.amount).toBe(-5);
      expect(p.embers).toBe(5);
      expect(p.counters.embersSpentTotal).toBe(5);
      expect(p.counters.churrasqueiraEvolutions).toBe(1);
    } finally {
      evo2.costCoins = prevCoins;
      evo2.costEmbers = prevEmbers;
    }
  });

  it('A-12 & A-13: computeOfflineEarnings clamps gerente to maxLevel and deriveStats clamps auto roles', () => {
    const p1 = newPlayerState();
    p1.restaurantIndex = 3;
    p1.upgradeLevels = { gerente: 4 };

    const p2 = newPlayerState();
    p2.restaurantIndex = 3;
    p2.upgradeLevels = { gerente: 14 }; // over maxLevel 4

    const e1 = computeOfflineEarnings(db, p1, 8 * 3600, 0);
    const e2 = computeOfflineEarnings(db, p2, 8 * 3600, 0);

    expect(e1.coins).toBe(e2.coins);
    expect(e1.xp).toBe(e2.xp);

    const r = db.restaurants.restaurants[0]!;
    const stats = deriveStats(db, r, {
      grill_size: 2,
      churrasqueiro: 10, // max is 5
      garcom: 8,         // max is 5
      auxiliar: 7        // max is 5
    });

    expect(stats.autoFlipLevel).toBe(5);
    expect(stats.autoServeLevel).toBe(5);
    expect(stats.autoPrepLevel).toBe(5);
    expect(stats.slotsPerZone).toBe(r.grill.slotsPerZone + 2);
  });

  it('A-20: stableStringify handles undefined fields without crashing serializeSave', () => {
    const save = newSave('test-install', 1000);
    save.player.coins = 12345;
    // Inject undefined in optional property
    const saveWithUndefined = {
      ...save,
      optionalTestField: undefined,
      nested: { a: 1, b: undefined }
    } as unknown as SaveGame;

    expect(() => serializeSave(saveWithUndefined)).not.toThrow();

    const serialized = serializeSave(saveWithUndefined);
    const loaded = deserializeSave(serialized);
    expect(loaded.ok).toBe(true);
    if (loaded.ok) {
      expect(loaded.save.player.coins).toBe(12345);
    }
  });
});
