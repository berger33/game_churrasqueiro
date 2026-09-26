/**
 * The engine's bed and the art gate's bed are one number, twice written (TS and .mjs). This test is
 * the only thing keeping them equal — if they drift, `check-grill-geometry` grades art against a
 * scale the game never uses, which is how a grill ends up "approved" with food overlapping.
 * Docs: docs/22-ARTE_2D_PLANO.md §6.8.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { grillBedWidthOnScreen } from '../../../tools/sim-core/src/grill-art.ts';
import { requiredMouth } from '../../art/grill-geometry.mjs';

const ROOT = join(import.meta.dirname, '..', '..', '..');
const grill = JSON.parse(readFileSync(join(ROOT, 'shared', 'data', 'grill.json'), 'utf8'));
const churr = JSON.parse(readFileSync(join(ROOT, 'shared', 'data', 'churrasqueiras.json'), 'utf8'));

describe('grill art standard: engine × art gate', () => {
  const art = grill.art;

  it('ships the art block the engine reads', () => {
    expect(art, 'shared/data/grill.json must carry the `art` block').toBeTruthy();
    for (const key of ['bedWidthOnScreen', 'maxBedWidthOnScreen', 'foodU', 'cellSlackW', 'cellSlackH',
      'foodFootprint', 'proceduralBedWidth', 'proceduralBedHeight', 'maxTiltDeg']) {
      expect(art[key], `grill.art.${key}`).toBeDefined();
    }
    // The same file the Unity build ships must agree, or the client draws a different bed than the
    // tools measured (verify-data-sync covers content; this names the field that would silently move).
    const synced = JSON.parse(readFileSync(join(ROOT, 'Assets', 'Data', 'grill.json'), 'utf8'));
    expect(synced.art).toEqual(art);
  });

  it('computes the same bed for every evolution of every grill', () => {
    const checked: string[] = [];
    for (const ch of churr.churrasqueiras) {
      for (const evo of ch.evolutions) {
        const cap = { zoneCount: evo.zoneCount, slotsPerZone: evo.slotsPerZone };
        const tsBed = grillBedWidthOnScreen(art, cap);
        const mjsBed = requiredMouth(art, cap).bedW;
        checked.push(`${ch.id} e${evo.level}`);
        expect(tsBed, `bed width for ${ch.id} evo${evo.level} (art gate ${mjsBed}, engine ${tsBed})`).toBe(mjsBed);
      }
    }
    expect(checked.length).toBeGreaterThanOrEqual(12);
  });

  it('the bed grows with the number of slots per row, and stays inside the clamp', () => {
    // The bed is about the *row*, not the total: a 1×3 drum and a 3×2 parrilla hold the same six
    // dishes but need different widths, so the ladder is measured per slotsPerZone (the capacity
    // ladder is check-grill-geometry's job, and churrasqueiras' own monotonic promise).
    const bySlots = new Map<number, number[]>();
    for (const ch of churr.churrasqueiras) {
      for (const evo of ch.evolutions) {
        const bed = grillBedWidthOnScreen(art, evo);
        const list = bySlots.get(evo.slotsPerZone) ?? [];
        list.push(bed);
        bySlots.set(evo.slotsPerZone, list);
      }
    }
    const steps = [...bySlots.entries()].sort((a, b) => a[0] - b[0]);
    let maxBelow = 0;
    for (const [slots, beds] of steps) {
      const bed = beds[0] ?? -1;
      expect(Math.max(...beds), `${slots} slots/row must all agree on one bed`).toBe(Math.min(...beds));
      expect(bed, `bed at ${slots} slots/row`).toBeGreaterThanOrEqual(art.bedWidthOnScreen);
      expect(bed, `bed at ${slots} slots/row`).toBeLessThanOrEqual(art.maxBedWidthOnScreen);
      expect(bed).toBeGreaterThanOrEqual(maxBelow);
      maxBelow = bed;
    }
    expect(steps.length).toBeGreaterThanOrEqual(3);
  });
});
