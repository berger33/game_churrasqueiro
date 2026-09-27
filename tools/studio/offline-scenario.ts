import {newPlayerState} from '../sim-core/src/economy.ts';
import {beginOfflineAbsence,returnFromOffline,claimOffline} from '../sim-core/src/offline.ts';
import type {GameDatabase} from '../sim-core/src/types.ts';
export interface OfflineScenario {restaurantIndex:number;level:number;upgrades:Record<string,number>;steps:{kind:'hide'|'return'|'claim'|'change';at:number;restaurantIndex?:number;upgrades?:Record<string,number>}[]}
/** Explicit absence schedule, not a campaign tick or a simulated order. */
export function runOfflineScenario(db:GameDatabase,input:OfflineScenario){
 let p={...newPlayerState(),restaurantIndex:input.restaurantIndex,level:input.level,upgradeLevels:input.upgrades};
 const trace=[];
 for(const s of input.steps){
  let receipt=null;
  if(s.kind==='change'){p.restaurantIndex=s.restaurantIndex??p.restaurantIndex;p.upgradeLevels={...p.upgradeLevels,...s.upgrades};}
  else {const tx=s.kind==='hide'?beginOfflineAbsence(db,p,s.at):s.kind==='return'?returnFromOffline(db,p,s.at):claimOffline(db,p,p.offline.batch?.id??p.offline.lastReceipt?.id??0,s.at);p=tx.owner;receipt=tx.receipt;}
  trace.push({kind:s.kind,at:s.at,coins:p.coins,xp:p.xp,level:p.level,embers:p.embers,receipt,batch:structuredClone(p.offline.batch),highWater:p.offline.highWater,nextBatchAt:p.offline.nextBatchAt});
 }
 return {trace,counters:p.counters,final:{coins:p.coins,xp:p.xp,level:p.level,embers:p.embers,offline:p.offline}};
}
export const offlineScenarios:Record<string,OfflineScenario>={
 short:{restaurantIndex:3,level:80,upgrades:{},steps:[{kind:'hide',at:1000000},{kind:'return',at:1000600},{kind:'claim',at:1000600},{kind:'claim',at:1000600}]},
 partial:{restaurantIndex:3,level:80,upgrades:{caixa:1},steps:[{kind:'hide',at:1000000},{kind:'return',at:1021600},{kind:'claim',at:1021600},{kind:'return',at:1021600}]},
 cap:{restaurantIndex:4,level:80,upgrades:{caixa:4,gerente:4,imperio_logistica:20},steps:[{kind:'hide',at:1000000},{kind:'return',at:1072000}]},
 frozen:{restaurantIndex:3,level:80,upgrades:{},steps:[{kind:'hide',at:1000000},{kind:'change',at:1000100,restaurantIndex:6,upgrades:{caixa:4,gerente:4,imperio_logistica:20}},{kind:'return',at:1003600},{kind:'claim',at:1003600}]},
 cooldown:{restaurantIndex:3,level:80,upgrades:{caixa:1},steps:[{kind:'hide',at:1000000},{kind:'return',at:1000600},{kind:'hide',at:1000700},{kind:'return',at:1000710},{kind:'hide',at:1000800},{kind:'return',at:1000810},{kind:'claim',at:1000810},{kind:'claim',at:1002400}]},
 rollback:{restaurantIndex:3,level:80,upgrades:{caixa:1},steps:[{kind:'hide',at:1000000},{kind:'return',at:999900},{kind:'return',at:1003600}]},
 levels:{restaurantIndex:3,level:4,upgrades:{},steps:[{kind:'hide',at:1000000},{kind:'return',at:1028800},{kind:'claim',at:1028800}]}
};
