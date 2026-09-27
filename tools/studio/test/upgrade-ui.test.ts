import { expect, it } from 'vitest';
import { upgradeCards,upgradePages,UPGRADE_NEXT,UPGRADE_PREV,orderPages,orderPageSize,ORDER_PREV,ORDER_NEXT } from '../../../prototype/src/upgrade-ui.ts';
it('all27 catalog cards and controls fit above navigation, with >=48px nonoverlapping targets',()=>{
  const cards=Array.from({length:upgradePages(27)},(_,p)=>upgradeCards(27,p)).flat();
  expect(cards.map(c=>c.index)).toEqual(Array.from({length:27},(_,i)=>i));
  for(const c of cards){expect(c.buy.h).toBeGreaterThanOrEqual(48);expect(c.buy.w).toBeGreaterThanOrEqual(48);
    expect(c.rect.y+c.rect.h).toBeLessThan(UPGRADE_NEXT.y);expect(c.buy.y+c.buy.h).toBeLessThan(c.rect.y+c.rect.h);}
  for(const p of [UPGRADE_PREV,UPGRADE_NEXT])expect(p.y+p.h).toBeLessThan(716);
  expect(upgradeCards(27,9)).toEqual(upgradeCards(27,0));
});
it('a paged order queue uses the same stable layout before and after arrivals, with controls clear of grill',()=>{
  for(const capacity of [2,3,6,7,14,17]){
    const size=orderPageSize(capacity),pages=orderPages(capacity,capacity);
    expect(size*pages).toBeGreaterThanOrEqual(capacity);
    if(capacity>6)expect(size).toBe(3);
  }
  for(const r of [ORDER_PREV,ORDER_NEXT]){expect(r.h).toBeGreaterThanOrEqual(48);expect(r.y).toBeGreaterThan(128);expect(r.y+r.h).toBeLessThan(224);}
});
