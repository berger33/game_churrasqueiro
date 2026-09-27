import {upgradeLevel} from './upgrades.ts';
import {grantExperience,type ExperienceWallet} from './economy.ts';
import type {GameDatabase} from './types.ts';
export interface OfflineSnapshot { restaurantIndex:number; eligible:boolean; coinsPerMinute:number; xpPerMinute:number; multiplier:number; autoMinutes:number; maxMinutes:number; rampMinutes:number; cooldownSec:number }
export interface OfflineBatch { id:number; minutes:number; autoMinutes:number; coinsRaw:number; xpRaw:number; autoCoinsRaw:number; autoXpRaw:number; paidCoins:number; paidXp:number; availableAt:number; settledAt:number|null; cooldownSec:number }
export interface OfflineReceipt { id:number; part:'auto'|'manual'; at:number; minutes:number; offlineCoins:number; offlineXp:number; levelCoins:number; levelEmbers:number; levelsGained:number }
export interface OfflineState { version:1; disabled:boolean; highWater:number; nextId:number; nextBatchAt:number; anchor:{at:number;snapshot:OfflineSnapshot}|null; batch:OfflineBatch|null; lastReceipt:OfflineReceipt|null }
export interface OfflineOwner extends ExperienceWallet { restaurantIndex:number; upgradeLevels:Record<string,number>; offline?:OfflineState }
export interface OfflineTransaction<T> { owner:T; receipt:OfflineReceipt|null }
const finite=(n:unknown):n is number=>typeof n==='number'&&Number.isFinite(n)&&n>=0;
export function newOfflineState(now=0):OfflineState {return {version:1,disabled:false,highWater:now,nextId:1,nextBatchAt:0,anchor:null,batch:null,lastReceipt:null};}
/** Fail closed on corrupt current ledgers; no repair can invent old absence or erase a wallet. */
export function restoreOfflineState(raw:unknown,now=0):OfflineState {
  if(raw===undefined)return newOfflineState(now);
  const s=raw as OfflineState;
  const validSnapshot=(x:OfflineSnapshot)=>x&&typeof x.eligible==='boolean'&&Number.isInteger(x.restaurantIndex)&&x.restaurantIndex>=0&&
    [x.coinsPerMinute,x.xpPerMinute,x.multiplier,x.autoMinutes,x.maxMinutes,x.rampMinutes,x.cooldownSec].every(finite)&&x.maxMinutes<=480&&x.autoMinutes<=480&&x.rampMinutes>0&&x.multiplier<=2.18+1e-9;
  let valid=!!s&&s.version===1&&typeof s.disabled==='boolean'&&finite(s.highWater)&&finite(s.nextBatchAt)&&Number.isSafeInteger(s.nextId)&&s.nextId>=1;
  if(valid&&s.anchor!==null)valid=!!s.anchor&&finite(s.anchor.at)&&s.anchor.at<=s.highWater&&validSnapshot(s.anchor.snapshot);
  if(valid&&s.batch!==null){const b=s.batch;valid=!!b&&Number.isSafeInteger(b.id)&&b.id>0&&b.id<s.nextId&&
    [b.minutes,b.autoMinutes,b.coinsRaw,b.xpRaw,b.autoCoinsRaw,b.autoXpRaw,b.paidCoins,b.paidXp,b.availableAt,b.cooldownSec].every(finite)&&
    b.minutes<=480+1e-9&&b.autoMinutes<=b.minutes+1e-9&&b.autoCoinsRaw<=b.coinsRaw+1e-8&&b.autoXpRaw<=b.xpRaw+1e-8&&
    Number.isSafeInteger(b.paidCoins)&&Number.isSafeInteger(b.paidXp)&&b.paidCoins<=Math.round(b.coinsRaw)&&b.paidXp<=Math.round(b.xpRaw)&&
    (b.settledAt===null||finite(b.settledAt));}
  if(valid&&s.lastReceipt!==null){const r=s.lastReceipt;valid=!!r&&Number.isSafeInteger(r.id)&&r.id>0&&r.id<s.nextId&&['auto','manual'].includes(r.part)&&
    [r.at,r.minutes,r.offlineCoins,r.offlineXp,r.levelCoins,r.levelEmbers,r.levelsGained].every(finite);}
  return valid?structuredClone(s):{...newOfflineState(now),disabled:true};
}
export function offlineSnapshot(db:GameDatabase,p:OfflineOwner):OfflineSnapshot {
  const idle=db.economy.idle,level=upgradeLevel(db,p.upgradeLevels,'caixa');
  const cashier=db.employees?.roles.find(r=>r.id==='caixa')?.abilities.find(a=>a.level===level);
  return {restaurantIndex:p.restaurantIndex,eligible:!!db.restaurantByIndex.get(p.restaurantIndex)&&p.restaurantIndex>=idle.unlockRestaurantIndex,
    coinsPerMinute:idle.coinsPerMinuteByRestaurant[p.restaurantIndex]??0,xpPerMinute:idle.xpPerMinuteByRestaurant[p.restaurantIndex]??0,
    multiplier:1+upgradeLevel(db,p.upgradeLevels,'gerente')*(db.upgradeById.get('gerente')?.effect.delta??0)+
      upgradeLevel(db,p.upgradeLevels,'imperio_logistica')*(db.upgradeById.get('imperio_logistica')?.effect.delta??0)+(cashier?.offlineRateBonus??0),
    autoMinutes:(cashier?.autoOfflineHours??0)*60,maxMinutes:idle.maxOfflineHours*60,rampMinutes:idle.rampInMinutes,cooldownSec:idle.minCollectIntervalMin*60};
}
/** Unrounded per-absence credit. A batch cap limits eligible time, not the number of returns. */
export function offlineCredit(snapshot:OfflineSnapshot,minutes:number,remaining=snapshot.maxMinutes){
  const m=snapshot.eligible&&finite(minutes)?Math.max(0,Math.min(minutes,remaining,snapshot.maxMinutes)):0;
  const factor=.5+.5*Math.min(1,m/snapshot.rampMinutes);
  return {minutes:m,coins:m*snapshot.coinsPerMinute*factor*snapshot.multiplier,xp:m*snapshot.xpPerMinute*factor*snapshot.multiplier};
}
function copy<T extends OfflineOwner>(p:T,now:number):T&{offline:OfflineState}{
  if(!finite(now))throw new Error('invalid offline clock');
  const owner=structuredClone(p) as T&{offline:OfflineState};owner.offline=restoreOfflineState(p.offline,now);
  owner.offline.highWater=Math.max(owner.offline.highWater,now);return owner;
}
export function beginOfflineAbsence<T extends OfflineOwner>(db:GameDatabase,p:T,now:number):OfflineTransaction<T>{
  const owner=copy(p,now),s=owner.offline;
  if(!s.disabled&&!s.anchor)s.anchor={at:s.highWater,snapshot:offlineSnapshot(db,p)};
  return {owner,receipt:null};
}
function settle<T extends OfflineOwner>(db:GameDatabase,owner:T&{offline:OfflineState},now:number,part:'auto'|'manual'):OfflineReceipt|null {
  const s=owner.offline,b=s.batch;
  if(s.disabled||s.anchor||!b||now<s.highWater||now<b.availableAt)return null;
  const fullyAuto=b.autoMinutes>=b.minutes-1e-9;
  const closing=part==='manual'||fullyAuto;
  const totalCoins=Math.round(b.coinsRaw),totalXp=Math.round(b.xpRaw);
  const coins=(closing?totalCoins:Math.floor(b.autoCoinsRaw))-b.paidCoins;
  const xp=(closing?totalXp:Math.floor(b.autoXpRaw))-b.paidXp;
  if(part==='auto'&&(b.autoMinutes<=0||coins<=0&&xp<=0))return null;
  if(coins<0||xp<0)throw new Error('offline conservation violation');
  owner.coins+=coins;
  owner.counters.offlineCoins=(owner.counters.offlineCoins??0)+coins;
  owner.counters.offlineXp=(owner.counters.offlineXp??0)+xp;
  owner.counters.coinsEarnedTotal=(owner.counters.coinsEarnedTotal??0)+coins;
  const levels=grantExperience(db,owner,xp);
  b.paidCoins+=coins;b.paidXp+=xp;
  if(b.settledAt===null){b.settledAt=now;s.nextBatchAt=now+b.cooldownSec;}
  const receipt:OfflineReceipt={id:b.id,part,at:now,minutes:b.minutes,offlineCoins:coins,offlineXp:xp,
    levelCoins:levels.levelUpCoins,levelEmbers:levels.levelUpEmbers,levelsGained:levels.levelsGained};
  s.lastReceipt=receipt;if(closing)s.batch=null;
  return receipt;
}
export function returnFromOffline<T extends OfflineOwner>(db:GameDatabase,p:T,now:number):OfflineTransaction<T>{
  const owner=copy(p,now),s=owner.offline;
  if(s.disabled)return {owner,receipt:null};
  const anchor=s.anchor;s.anchor=null; // even rollback must not bank subsequent online time
  if(anchor&&now>=anchor.at){
    const x=anchor.snapshot,credit=offlineCredit(x,(now-anchor.at)/60,x.maxMinutes-(s.batch?.minutes??0));
    if(credit.minutes>0){
      const b=s.batch??{id:s.nextId++,minutes:0,autoMinutes:0,coinsRaw:0,xpRaw:0,autoCoinsRaw:0,autoXpRaw:0,paidCoins:0,paidXp:0,availableAt:s.nextBatchAt,settledAt:null,cooldownSec:x.cooldownSec};
      const auto=Math.min(credit.minutes,Math.max(0,x.autoMinutes-b.autoMinutes)),share=auto/credit.minutes;
      b.minutes+=credit.minutes;b.autoMinutes+=auto;b.coinsRaw+=credit.coins;b.xpRaw+=credit.xp;
      b.autoCoinsRaw+=credit.coins*share;b.autoXpRaw+=credit.xp*share;s.batch=b;
    }
  }
  return {owner,receipt:settle(db,owner,now,'auto')};
}
export function claimOffline<T extends OfflineOwner>(db:GameDatabase,p:T,id:number,now:number):OfflineTransaction<T>{
  const owner=copy(p,now);
  return {owner,receipt:owner.offline.batch?.id===id?settle(db,owner,now,'manual'):null};
}
export function offlineView(db:GameDatabase,p:OfflineOwner,now:number){
  const s=restoreOfflineState(p.offline,now),b=s.batch;
  return {unlocked:p.restaurantIndex>=db.economy.idle.unlockRestaurantIndex,disabled:s.disabled,
    id:b?.id??null,minutes:b?.minutes??0,coins:b?Math.max(0,Math.round(b.coinsRaw)-b.paidCoins):0,xp:b?Math.max(0,Math.round(b.xpRaw)-b.paidXp):0,
    waitSec:Math.max(0,(b?.availableAt??0)-now,s.highWater-now),canClaim:!!b&&!s.disabled&&!s.anchor&&now>=b.availableAt&&now>=s.highWater,
    lastReceipt:s.lastReceipt,rewardedAvailable:false};
}
