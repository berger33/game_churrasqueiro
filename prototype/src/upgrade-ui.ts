import type { Rect } from './ftue.ts';
export const UPGRADE_PAGE_SIZE=3;
export const UPGRADE_PREV:Rect={x:14,y:648,w:88,h:48};
export const UPGRADE_NEXT:Rect={x:318,y:648,w:88,h:48};
export function upgradePages(count:number):number{return Math.max(1,Math.ceil(count/UPGRADE_PAGE_SIZE));}
export function upgradeCards(count:number,page:number):{index:number;rect:Rect;buy:Rect}[]{
  const start=((page%upgradePages(count))+upgradePages(count))%upgradePages(count)*UPGRADE_PAGE_SIZE;
  return Array.from({length:Math.min(UPGRADE_PAGE_SIZE,Math.max(0,count-start))},(_,i)=>({
    index:start+i,rect:{x:14,y:314+i*108,w:392,h:98},buy:{x:310,y:354+i*108,w:84,h:48}
  }));
}
/** Large queues use a fixed three-card page for the entire turn, not a layout that jumps at seven arrivals. */
export const ORDER_PREV:Rect={x:14,y:140,w:64,h:48};
export const ORDER_NEXT:Rect={x:342,y:140,w:64,h:48};
export function orderPageSize(capacity:number):number{return capacity>6?3:6;}
export function orderPages(waiting:number,capacity:number):number{return Math.max(1,Math.ceil(waiting/orderPageSize(capacity)));}
