/** Controlled absence economics, explicitly NOT the natural active 1500-turn campaign. */
import {loadDatabase} from './load-data.ts';
import {newPlayerState,computeOfflineEarnings} from '../sim-core/src/economy.ts';
import {beginOfflineAbsence,returnFromOffline,claimOffline,offlineView,type OfflineReceipt} from '../sim-core/src/offline.ts';
const db=loadDatabase(),start=Date.UTC(2026,8,21)/1000;
const profiles:Record<string,Record<string,number>>={base:{},caixa1:{caixa:1},caixa2:{caixa:2},caixa3:{caixa:3},caixa4:{caixa:4},gerente4:{gerente:4},logistica20:{imperio_logistica:20},maximum:{caixa:4,gerente:4,imperio_logistica:20}};
const schedule=[{hideMinute:30,returnMinute:390},{hideMinute:405,returnMinute:415},{hideMinute:480,returnMinute:1200}];
const rows=[];
for(const restaurantIndex of [3,4,6])for(const [profile,upgradeLevels] of Object.entries(profiles)){
 let p={...newPlayerState(),level:80,restaurantIndex,upgradeLevels},expectedCoins=0,expectedXp=0;
 const receipts:OfflineReceipt[]=[];
 for(let day=0;day<3;day++)for(const span of schedule){
  const hide=start+day*86400+span.hideMinute*60,back=start+day*86400+span.returnMinute*60;
  const expected=computeOfflineEarnings(db,p,back-hide,back);expectedCoins+=expected.coins;expectedXp+=expected.xp;
  p=beginOfflineAbsence(db,p,hide).owner;
  const tx=returnFromOffline(db,p,back);p=tx.owner;if(tx.receipt)receipts.push(tx.receipt);
  if(p.offline.batch){const view=offlineView(db,p,back);const c=claimOffline(db,p,p.offline.batch.id,back+view.waitSec);p=c.owner;if(c.receipt)receipts.push(c.receipt);}
 }
 if(p.coins!==expectedCoins||p.xp!==expectedXp||p.offline.batch)throw Error(`conservation: ${restaurantIndex}/${profile}`);
 if((p.counters.turnsPlayed??0)!==0||p.vip.servedTotal!==0)throw Error('fabricated active outcomes');
 rows.push({restaurantIndex,profile,upgradeLevels,coins:p.coins,xp:p.xp,autoCoins:receipts.filter(r=>r.part==='auto').reduce((n,r)=>n+r.offlineCoins,0),manualCoins:receipts.filter(r=>r.part==='manual').reduce((n,r)=>n+r.offlineCoins,0),receipts});
}
console.log(JSON.stringify({method:'Controlled owned-level fixtures; no turn/order/VIP/rewarded simulation or progression claims. Separate from active campaign. Level80 isolates offline income from level rewards (tested and vectored separately).',startUTC:new Date(start*1000).toISOString(),days:3,schedule,settlement:'Manual remainder claimed immediately when eligible; second return waits until07:00 (cooldown), no automatic background callback. Online gaps grant zero income.',actualAbsenceMinutesPerDay:1090,cappedMinutesPerDay:850,rampWeightedMinutesPerDay:847.5,rows},null,2));
