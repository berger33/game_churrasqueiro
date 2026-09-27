import { expect, it } from 'vitest';
import { BENCH_PAGER, prepSlotRects, PREP_PAGER, prepPageCount } from '../../../prototype/src/cooking-ui.ts';
it('A-03: every prep slot is reachable at >=48px without overlapping stock or either pager', () => {
  for (const count of [1, 2, 5, 6, 10]) {
    const all = Array.from({ length: prepPageCount(count) }, (_, page) => prepSlotRects(count, page)).flat();
    expect(all.map(r => r.slot)).toEqual(Array.from({ length: count }, (_, i) => i));
    for (const r of all) {
      expect(r.w).toBeGreaterThanOrEqual(48); expect(r.h).toBeGreaterThanOrEqual(48);
      expect(r.y).toBeGreaterThanOrEqual(714); expect(r.y + r.h).toBeLessThanOrEqual(780);
      expect(r.x + r.w).toBeLessThanOrEqual(PREP_PAGER.x);
      expect(r.y).toBeGreaterThanOrEqual(BENCH_PAGER.y + BENCH_PAGER.h);
    }
  }
});
it('A-03: a small/absent station has no phantom slots, paging wraps', () => {
  expect(prepSlotRects(0, 0)).toEqual([]);
  expect(prepSlotRects(1, 0)).toHaveLength(1);
  expect(prepSlotRects(6, 2)).toEqual(prepSlotRects(6, 0));
  expect(PREP_PAGER.w).toBeGreaterThanOrEqual(48); expect(PREP_PAGER.h).toBeGreaterThanOrEqual(48);
});
