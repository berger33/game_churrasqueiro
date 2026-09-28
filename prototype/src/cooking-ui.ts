/** Small, testable decisions shared by the bench renderer and pointer hit-testing. */
import { publicFlipReady, type FoodRuntime } from '../../tools/sim-core/src/cooking.ts';
import type { GameDatabase, Ingredient } from '../../tools/sim-core/src/types.ts';
import { type TutorialTable } from '../../tools/sim-core/src/tutorial.ts';

// One bench row only: the customer queue moved down to the thumb zone (docs/20), so the
// bottom third is shared by stock, prep and the two resource buttons. Five tiles + a pager
// tile of the same height keep every target >=48 px without a second row.
export const BENCH_PAGE_SIZE = 5;
export const BENCH_PAGER = { x: 352, y: 596, w: 54, h: 66 };
export function benchPageCount(items: readonly Ingredient[]): number { return Math.max(1, Math.ceil(items.length / BENCH_PAGE_SIZE)); }
export function benchPage(items: readonly Ingredient[], page: number): Ingredient[] {
  const count = benchPageCount(items);
  const start = ((page % count + count) % count) * BENCH_PAGE_SIZE;
  return items.slice(start, start + BENCH_PAGE_SIZE);
}
export function cookingFlipHint(db: GameDatabase, table: TutorialTable, food: FoodRuntime): boolean {
  // Same 'wait until browned, then tap' cue as the FTUE, honoring the recipe.
  return publicFlipReady(db, food);
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

// Separate station below the stock: five >=48px targets, paged up to restaurant+board capacity.
export const PREP_AREA = { x: 0, y: 674, w: 420, h: 54 };
export const PREP_PAGER = { x: 342, y: 680, w: 64, h: 48 };
export function prepPageCount(capacity: number): number { return Math.max(1, Math.ceil(capacity / 5)); }
export function prepSlotRects(capacity: number, page: number): { slot: number; x: number; y: number; w: number; h: number }[] {
  const start = ((page % prepPageCount(capacity) + prepPageCount(capacity)) % prepPageCount(capacity)) * 5;
  return Array.from({ length: Math.min(5, Math.max(0, capacity - start)) }, (_, i) =>
    ({ slot: start + i, x: 14 + i * 64, y: 680, w: 58, h: 48 }));
}

// Resource actions live on the very last row of the screen — the cheapest place to reach with a
// thumb, and out of the way of the order cards that now sit just above the bench. Both are 48px
// tall and never overlap the stock tiles or the prep targets above them.
export const CHARCOAL_REFILL = { x: 14, y: 730, w: 190, h: 48 };
export const STOCK_REFILL = { x: 218, y: 730, w: 188, h: 48 };
