import type {OfflineState,OfflineTransaction,OfflineOwner} from '../../tools/sim-core/src/offline.ts';
/** Shared rectangles: drawn CTA and pointer target must be identical. */
export const OFFLINE_UI={entry:{x:134,y:14,w:112,h:48},panel:{x:28,y:196,w:364,h:400},claim:{x:64,y:476,w:292,h:48},close:{x:64,y:534,w:292,h:48}};
export interface OfflineMeta {coins:number;embers:number;xp:number;level:number;offline:OfflineState;offlineCounters:Record<string,number>}
/** One localStorage JSON write includes wallet, XP, level rewards AND claim. Never publish a failed write. */
export function commitOfflineMeta<T extends OfflineMeta>(meta:T,tx:OfflineTransaction<OfflineOwner>,persist:(next:T)=>boolean):T|null {
  const p=tx.owner;
  const next={...meta,coins:p.coins,embers:p.embers,xp:p.xp,level:p.level,offline:p.offline!,offlineCounters:p.counters};
  try{return persist(next)?next:null;}catch{return null;}
}
