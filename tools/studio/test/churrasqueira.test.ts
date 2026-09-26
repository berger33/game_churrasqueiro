/**
 * Churrasqueira progression (1F → 2F → 3F → Fornalha) inside the sim-core.
 *
 * `shared/data/churrasqueiras.json` lets the equipped grill override the
 * restaurant's zone count, slots, zone heat and charcoal duration. It shipped
 * with no tests, and the first run of the skill policy on it crashed: the
 * starter grills have 1 and 2 zones, but ingredient `idealZone` ids were resolved
 * against the 3-zone `db.grill.zones` table, so `high` pointed at a zone that did
 * not exist (`Cannot read properties of undefined (reading 'items')`).
 *
 * The policy also estimated cook rate from the table's `heatMultiplier`, while
 * the cooking model (`effectiveHeat`) reads the churrasqueira-patched zone heat —
 * so on an upgraded grill the simulated player aimed at the wrong flip time.
 *
 * These tests drive real turns on every churrasqueira × evolution.
 */
import { describe, expect, it } from 'vitest';
import { loadAndValidate } from '../load-data.ts';
import { generateLevels } from '../gen-levels.ts';
import { TurnSimulation, type TurnCounters } from '../../sim-core/src/turn.ts';
import { SkillPolicy } from '../../sim-core/src/policy.ts';
import { Rng } from '../../sim-core/src/rng.ts';
import { CHURRASQUEIRA_HEAT_CAP, churrasqueiraZoneHeat, effectiveHeat, runtimeZoneIndex } from '../../sim-core/src/cooking.ts';

const { db } = loadAndValidate();
const LEVELS = generateLevels([[0, 12]]).levels;
const CHURRASQUEIRAS = db.churrasqueiras?.churrasqueiras ?? [];

function makeSim(churrasqueiraId: string | undefined, churrasqueiraLevel: number, i: number): TurnSimulation {
  const level = LEVELS[i % LEVELS.length]!;
  return new TurnSimulation(
    db,
    {
      restaurantIndex: level.restaurantIndex,
      levelId: level.id,
      upgradeLevels: {},
      seed: 3000 + i,
      churrasqueiraId,
      churrasqueiraLevel
    },
    3000 + i
  );
}

function playTurns(churrasqueiraId: string | undefined, churrasqueiraLevel: number, skill: number, turns = 8): TurnCounters {
  const total: TurnCounters = {
    customersSpawned: 0, customersServed: 0, customersLost: 0, ordersCompleted: 0,
    perfectCooks: 0, goodCooks: 0, burnedFood: 0, bestCombo: 0, flips: 0,
    itemsCooked: 0, charcoalRefills: 0, peakSimultaneousOrders: 0, flawless: true
  };
  for (let i = 0; i < turns; i++) {
    const sim = makeSim(churrasqueiraId, churrasqueiraLevel, i);
    const policy = new SkillPolicy(new Rng(3000 + i * 7919), { skill });
    let guard = 0;
    while (!sim.finished && guard++ < 40000) {
      sim.tick(1 / 20, (a) => {
        policy.act(a);
        // Every placement must land on a zone the grill actually has.
        for (const f of a.grill.zones.flatMap((z) => z.items)) {
          expect(f.zoneIndex).toBeLessThan(a.grill.zones.length);
        }
      });
    }
    expect(sim.finished).toBe(true);
    const c = sim.counters;
    total.customersSpawned += c.customersSpawned;
    total.customersServed += c.customersServed;
    total.customersLost += c.customersLost;
    total.perfectCooks += c.perfectCooks;
    total.burnedFood += c.burnedFood;
  }
  return total;
}

describe('churrasqueira data', () => {
  it('ships ten grills of the progression, each with evolutions 1..3', () => {
    expect(CHURRASQUEIRAS.map((c) => c.id)).toEqual([
      'lata_valente', 'grelha_de_praca', 'ze_da_esquina', 'espeto_do_neno', 'parrilla_chef_cisma',
      'tambor_vertical', 'fornalha_dragao_manso', 'parrilla_do_cais', 'fornalha_da_orla', 'cozinha_do_campeao'
    ]);
    for (const ch of CHURRASQUEIRAS) expect(ch.evolutions.map((e) => e.level)).toEqual([1, 2, 3]);
  });

  it('keeps the ladder honest: capacity never drops, no rung is a pure loss', () => {
    const cap = (e: { zoneCount: number; slotsPerZone: number }) => e.zoneCount * e.slotsPerZone;
    const rungs = CHURRASQUEIRAS.flatMap((c) => c.evolutions.map((e) => ({
      cap: cap(e), heat: e.heatBase, burn: e.charcoalBonus ?? 0
    })));
    expect(rungs).toHaveLength(30);
    for (let i = 1; i < rungs.length; i++) {
      const a = rungs[i - 1]!, b = rungs[i]!;
      expect(b.cap).toBeGreaterThanOrEqual(a.cap);
      expect(b.heat).toBeGreaterThanOrEqual(a.heat);
      if (b.cap === a.cap) expect(b.burn).toBeGreaterThanOrEqual(a.burn);
      expect(b.cap > a.cap || b.heat > a.heat || b.burn > a.burn).toBe(true);
    }
    // 4 fileiras é o teto do padrão de arte (boca = Z*60 <= 248 px).
    for (const r of rungs) expect(r.cap).toBeLessThanOrEqual(4 * 5);
  });
});

describe('runtimeZoneIndex — table zone id → runtime zone', () => {
  const grillWith = (zoneCount: number) => makeSim(CHURRASQUEIRAS.find((c) => c.evolutions[0]!.zoneCount === zoneCount)!.id, 1, 0).grill;

  it('is the identity on a grill with as many zones as the table', () => {
    const g = makeSim(undefined, 1, 0).grill;
    expect(g.zones.length).toBe(db.grill.zones.length);
    for (const z of db.grill.zones) expect(runtimeZoneIndex(g, db, z.id)).toBe(z.index);
  });

  it('maps every id onto the single zone of a 1-zone grill', () => {
    const g = grillWith(1);
    for (const z of db.grill.zones) expect(runtimeZoneIndex(g, db, z.id)).toBe(0);
  });

  it('keeps the cool end cool and the hot end hot on a 2-zone grill', () => {
    const g = grillWith(2);
    expect(runtimeZoneIndex(g, db, 'low')).toBe(0);
    expect(runtimeZoneIndex(g, db, 'high')).toBe(1);
  });

  it('returns -1 for "none" and unknown ids', () => {
    const g = makeSim(undefined, 1, 0).grill;
    expect(runtimeZoneIndex(g, db, 'none')).toBe(-1);
    expect(runtimeZoneIndex(g, db, 'volcano')).toBe(-1);
  });
});

describe('churrasqueira overrides reach the turn', () => {
  for (const ch of CHURRASQUEIRAS) {
    for (const evo of ch.evolutions) {
      it(`${ch.id} evo ${evo.level}: ${evo.zoneCount} zone(s) × ${evo.slotsPerZone} slots, heat from heatBase`, () => {
        const sim = makeSim(ch.id, evo.level, 0);
        expect(sim.grill.zones.length).toBe(evo.zoneCount);
        expect(sim.stats.slotsPerZone).toBe(evo.slotsPerZone);
        expect(sim.stats.charcoalDurationSec).toBeCloseTo(db.grill.charcoal.baseDurationSec * (1 + (evo.charcoalBonus ?? 0)), 9);
        expect(sim.grill.zones[0]!.heat).toBeCloseTo(churrasqueiraZoneHeat(evo, 0, db), 9);
        // Zones heat up monotonically from the cool end to the hot end. Estrito até o
        // teto: numa grelha de 4 fileiras com heatBase alto, as duas zonas do fogo forte
        // encostam no CAP juntas — é a recompensa ser espaço, não temperatura.
        for (let i = 1; i < sim.grill.zones.length; i++) {
          const cur = sim.grill.zones[i]!.heat;
          const prev = sim.grill.zones[i - 1]!.heat;
          expect(cur).toBeGreaterThanOrEqual(prev);
          if (cur < CHURRASQUEIRA_HEAT_CAP - 1e-9) expect(cur).toBeGreaterThan(prev);
        }
        // …and the cooking model actually reads the patched heat.
        const top = sim.grill.zones.length - 1;
        expect(effectiveHeat(sim.grill, top, db)).toBeCloseTo(
          (sim.grill.zones[top]!.heat + sim.stats.highZoneBonus) * sim.grill.charcoalEfficiency, 9
        );
      });
    }
  }
});

describe('skill policy plays every churrasqueira', () => {
  for (const ch of CHURRASQUEIRAS) {
    it(`${ch.id}: full turns complete, customers are served, skill still separates quality`, () => {
      const clumsy = playTurns(ch.id, 1, 0.3);
      const skilled = playTurns(ch.id, 1, 0.85);
      for (const r of [clumsy, skilled]) {
        expect(r.customersServed).toBeGreaterThan(0);
        expect(r.customersLost / Math.max(1, r.customersSpawned)).toBeLessThan(0.1);
      }
      expect(skilled.perfectCooks).toBeGreaterThan(clumsy.perfectCooks * 1.5);
      // A skilled player on the right heat estimate does not burn food.
      expect(skilled.burnedFood / Math.max(1, skilled.customersServed)).toBeLessThan(0.05);
    });
  }

  it('the top evolution of every grill is playable too', () => {
    for (const ch of CHURRASQUEIRAS) {
      const r = playTurns(ch.id, 3, 0.55, 4);
      expect(r.customersServed).toBeGreaterThan(0);
    }
  });
});

describe('churrasqueira zone heat', () => {
  it('cooks the 1-zone starter at heatBase so the FTUE is slow and hard to burn', () => {
    const lata = CHURRASQUEIRAS[0]!;
    expect(lata.evolutions[0]!.zoneCount).toBe(1);
    expect(churrasqueiraZoneHeat(lata.evolutions[0]!, 0, db)).toBe(lata.evolutions[0]!.heatBase);
  });

  it('caps the fornalha so a hotter grill is not an incinerator', () => {
    const fornalha = CHURRASQUEIRAS.find((c) => c.id === 'fornalha_dragao_manso')!;
    const evo3 = fornalha.evolutions[2]!;
    for (let i = 0; i < evo3.zoneCount; i++) {
      expect(churrasqueiraZoneHeat(evo3, i, db)).toBeLessThanOrEqual(1.7);
    }
    // The old heatBase + 0.85·t ramp peaked at 2.47 and burned 20% of a campaign.
    expect(evo3.heatBase + 0.85).toBeGreaterThan(1.7);
  });
});

describe('churrasqueira keeps additive upgrades', () => {
  it('grill_size still adds slots on top of the equipped evolution', () => {
    const ch = CHURRASQUEIRAS[0]!;
    const evo = ch.evolutions[0]!;
    const base = makeSim(ch.id, evo.level, 0);
    const bumped = new TurnSimulation(
      db,
      {
        restaurantIndex: 0,
        levelId: 't',
        upgradeLevels: { grill_size: 2 },
        seed: 1,
        churrasqueiraId: ch.id,
        churrasqueiraLevel: evo.level
      },
      1
    );
    expect(base.stats.slotsPerZone).toBe(evo.slotsPerZone);
    expect(bumped.stats.slotsPerZone).toBe(evo.slotsPerZone + 2);
    expect(bumped.stats.zoneCount).toBe(evo.zoneCount);
  });
});
