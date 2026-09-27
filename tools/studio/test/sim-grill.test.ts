/**
 * The economy harness used to play every turn on the restaurant's default
 * 3-zone grill. Players actually start on 1-zone `lata_valente` and spend coins
 * to evolve / unlock along 1F→2F→3F→Fornalha. These tests pin that wiring so
 * the 15 balance targets describe the game the player plays.
 */
import { describe, expect, it } from 'vitest';
import { simulateProgression } from '../run-sim.ts';
import { STARTER_CHURRASQUEIRA_ID } from '../../sim-core/src/economy.ts';

describe('progression sim plays the owned grill', () => {
  it('starts on the starter and spends on the grill path', () => {
    const report = simulateProgression({ maxTurns: 16, stepSec: 1 / 12 });
    expect(report.player.churrasqueiraId).toBeTruthy();
    expect(report.player.churrasqueiraLevels[STARTER_CHURRASQUEIRA_ID] ?? 0).toBeGreaterThanOrEqual(1);

    const grillSinks = Object.entries(report.session.sinks)
      .filter(([k]) => k.startsWith('churrasqueira_'))
      .reduce((a, [, v]) => a + v, 0);
    expect(grillSinks).toBeGreaterThan(0);
    // 320 coins for lata evo 2; even the 1-zone starter should afford that quickly.
    expect(report.player.churrasqueiraLevels[STARTER_CHURRASQUEIRA_ID]).toBeGreaterThanOrEqual(2);
  }, 30_000);

  it('never unlocks a later grill before an earlier one', () => {
    const report = simulateProgression({ maxTurns: 16, stepSec: 1 / 12 });
    const unlocked = Object.keys(report.turnsToUnlockGrill);
    const order = ['ze_da_esquina', 'parrilla_chef_cisma', 'fornalha_dragao_manso'];
    let prev = -1;
    for (const id of unlocked) {
      const i = order.indexOf(id);
      expect(i).toBeGreaterThanOrEqual(0);
      expect(i).toBeGreaterThan(prev);
      prev = i;
    }
  }, 30_000);
});

describe('A-04: real progression passes the restaurant AND equipment expansion context', () => {
  it('keeps three zones before Premium and reports four actual zones after unlock', () => {
    // A-06.4 adds real offline sinks: Premium now arrives on277, not272.
    // Extend observation, not an economy target or any four-zone assertion.
    const report=simulateProgression({maxTurns:300,stepSec:1/12});
    const before=report.outcomes.filter(t=>t.restaurantIndex===3);
    const after=report.outcomes.filter(t=>t.restaurantIndex===4);
    expect(before.length).toBeGreaterThan(0);expect(after.length).toBeGreaterThan(0);
    for(const t of before) expect(t.grillSnapshot.zoneCount).toBe(3);
    for(const t of after) {
      expect(t.grillSnapshot.id).toBe('fornalha_dragao_manso');
      expect(t.grillSnapshot.zoneCount).toBe(4);
      expect(t.grillSnapshot.zoneHeats[3]).toBe(t.grillSnapshot.zoneHeats[1]);
      expect(t.grillSnapshot.occupiedTicksByZone).toHaveLength(4);
    }
  },30_000);
});
