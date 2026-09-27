import { describe, expect, it } from 'vitest';
import { loadDatabase, readJson } from '../load-data.ts';
import { TurnSimulation } from '../../sim-core/src/turn.ts';
import { type TutorialTable } from '../../sim-core/src/tutorial.ts';
import { BENCH_PAGER, grilledFoodHit, benchPage, benchPageCount, cookingFlipHint } from '../../../prototype/src/cooking-ui.ts';
const db = loadDatabase();
const table = readJson('tutorial.json') as TutorialTable;
const grilled = db.ingredients.items.filter(i => i.cookMethod === 'grill');

describe('A-01 UI: every grilled recipe is reachable without altering the FTUE', () => {
  it('makes costela/cupim reachable beyond the old eight-item truncation', () => {
    const visible = Array.from({ length: benchPageCount(grilled) }, (_, p) => benchPage(grilled, p)).flat();
    expect(visible.map(i => i.id)).toEqual(grilled.map(i => i.id));
    expect(benchPage(grilled, 1).map(i => i.id)).toEqual(expect.arrayContaining(['costela', 'cupim']));
  });
  it('wraps pages with at most eight items, while the FTUE stays on one page', () => {
    expect(benchPageCount(grilled)).toBe(2);
    expect(benchPageCount([])).toBe(1);
    expect(benchPage([], 3)).toEqual([]);
    expect(benchPage(grilled, 2)).toEqual(benchPage(grilled, 0));
    expect(benchPage(grilled, -1)).toEqual(benchPage(grilled, 1));
    for (let page = 0; page < 4; page++) expect(benchPage(grilled, page).length).toBeLessThanOrEqual(8);
    const ftue = [db.ingredientById.get(table.turn.ingredientId)!];
    expect(benchPageCount(ftue)).toBe(1);
    expect(benchPage(ftue, 99)).toEqual(ftue);
  });
  it('places the pager in the two unused bench slots with a >=48px target', () => {
    const r = BENCH_PAGER;
    expect(r.w).toBeGreaterThanOrEqual(48); expect(r.h).toBeGreaterThanOrEqual(48);
    expect(r.x + r.w).toBeLessThanOrEqual(420); expect(r.y + r.h).toBeLessThanOrEqual(780);
    for (let i = 0; i < 8; i++) {
      const b = { x: 14 + (i % 5) * 82, y: 574 + Math.floor(i / 5) * 74, w: 74, h: 66 };
      const overlap = r.x < b.x + b.w && r.x + r.w > b.x && r.y < b.y + b.h && r.y + r.h > b.y;
      expect(overlap).toBe(false);
    }
  });
  for (const id of ['costela', 'cupim']) {
    it(`${id} asks to flip only after browning, stops after flipping and never prompts off-grill`, () => {
      const sim = new TurnSimulation(db, { restaurantIndex: 4, levelId: 'ui', upgradeLevels: {}, seed: 1 });
      const f = sim.takeFromStock(db.ingredientById.get(id)!);
      expect(cookingFlipHint(db, table, f)).toBe(false);
      sim.place(f, 0);
      sim.tick(db.grill.interaction.flipCooldownSec + 0.1);
      f.sides = [0.1, 0.012];
      expect(cookingFlipHint(db, table, f)).toBe(false); // old UI immediately said vire!
      f.sides = [table.coach.flipPromptAtSideDoneness, table.coach.flipPromptAtSideDoneness * db.ingredients.shared.carryoverRate];
      expect(cookingFlipHint(db, table, f)).toBe(true);
      expect(sim.flip(f)).toBe(true);
      expect(cookingFlipHint(db, table, f)).toBe(false);
      f.burned = true; expect(cookingFlipHint(db, table, f)).toBe(false);
      f.burned = false; sim.discard(f); expect(cookingFlipHint(db, table, f)).toBe(false);
    });
  }
  it('never asks to flip a prep recipe', () => {
    const sim = new TurnSimulation(db, { restaurantIndex: 4, levelId: 'ui', upgradeLevels: {}, seed: 1 });
    const f = sim.takeFromStock(db.ingredientById.get('vinagrete')!);
    expect(cookingFlipHint(db, table, f)).toBe(false);
  });
});


describe('A-01 pointer dependency: neighboring plates on the painted grill', () => {
  it('selects the nearest plate, not always the first item in overlapping targets', () => {
    const plates = [{ id: 'costela', x: 100, y: 100 }, { id: 'cupim', x: 125, y: 100 }];
    expect(grilledFoodHit(plates, { x: 125, y: 100 })?.id).toBe('cupim');
    expect(grilledFoodHit(plates, { x: 100, y: 100 })?.id).toBe('costela');
    expect(grilledFoodHit([...plates].reverse(), { x: 125, y: 100 })?.id).toBe('cupim');
  });
  it('preserves the existing touch size and returns nothing outside all plates', () => {
    const plates = [{ x: 100, y: 100 }];
    expect(grilledFoodHit(plates, { x: 130, y: 126 })).toBe(plates[0]);
    expect(grilledFoodHit(plates, { x: 133, y: 100 })).toBeUndefined();
    expect(grilledFoodHit([], { x: 100, y: 100 })).toBeUndefined();
  });
});
