/** Small, testable decisions shared by the bench renderer and pointer hit-testing. */
import { type FoodRuntime } from '../../tools/sim-core/src/cooking.ts';
import type { GameDatabase, Ingredient } from '../../tools/sim-core/src/types.ts';
import { flipReady, type TutorialTable } from '../../tools/sim-core/src/tutorial.ts';

export const BENCH_PAGE_SIZE = 8;
export const BENCH_PAGER = { x: 266, y: 652, w: 140, h: 56 };
export function benchPageCount(items: readonly Ingredient[]): number { return Math.max(1, Math.ceil(items.length / BENCH_PAGE_SIZE)); }
export function benchPage(items: readonly Ingredient[], page: number): Ingredient[] {
  const count = benchPageCount(items);
  const start = ((page % count + count) % count) * BENCH_PAGE_SIZE;
  return items.slice(start, start + BENCH_PAGE_SIZE);
}
export function cookingFlipHint(db: GameDatabase, table: TutorialTable, food: FoodRuntime): boolean {
  // Same 'wait until browned, then tap' cue as the FTUE, honoring the recipe.
  return food.ingredient.flipNeeded && flipReady(db, table, food);
}

/** Resolve overlapping 64×56 food targets without shrinking their touch area. */
export function grilledFoodHit<T extends { x: number; y: number }>(items: readonly T[], point: { x: number; y: number }): T | undefined {
  let nearest: T | undefined;
  let distance = Infinity;
  for (const p of items) {
    if (Math.abs(point.x - p.x) >= 32 || Math.abs(point.y - p.y) >= 28) continue;
    const d = (point.x - p.x) ** 2 + (point.y - p.y) ** 2;
    if (d < distance) { nearest = p; distance = d; }
  }
  return nearest;
}
