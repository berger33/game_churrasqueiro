import {describe,it,expect} from 'vitest';
import {loadDatabase} from '../load-data.ts';
import * as E from '../../sim-core/src/economy.ts';
const db=loadDatabase(),api=E as any,T=1_000_000;
const player=(restaurantIndex=3,upgradeLevels:Record<string,number>={})=>({...E.newPlayerState(),restaurantIndex,upgradeLevels,level:80});
const away=(p:any,start:number,end:number)=>api.returnFromOffline(db,api.beginOfflineAbsence(db,p,start).owner,end);
describe('A-06.4 real offline ledger',()=>{
 it.each([0,1,2])('restaurant%i cannot earn offline',r=>expect(E.computeOfflineEarnings(db,player(r),3600,T).coins).toBe(0));
 it('approved additive maximum is2.18, not separate multipliers',()=>{
  const p=player(4,{gerente:4,imperio_logistica:20,caixa:4});
  expect(E.computeOfflineEarnings(db,p,3600,T).coins).toBe(Math.round(60*96*2.18));
 });
 it('migration without anchor invents no historical absence or payout',()=>{
  const p=player();p.coins=555;p.xp=17;const r=api.returnFromOffline(db,p,T);
  expect(r.owner.coins).toBe(555);expect(r.owner.xp).toBe(17);expect(r.owner.offline.batch).toBeNull();
 });
 it('first short absence uses ramp, not a30-minute minimum',()=>{
  const r=away(player(),T,T+600),b=r.owner.offline.batch;
  expect(b.minutes).toBe(10);expect(b.coinsRaw).toBe(10*42*.75);expect(r.owner.coins).toBe(0);
  const claim=api.claimOffline(db,r.owner,b.id,T+600);expect(claim.owner.coins).toBe(315);expect(claim.receipt.offlineXp).toBe(18);
 });
 it('snapshot at departure cannot be upgraded retroactively',()=>{
  let p=api.beginOfflineAbsence(db,player(),T).owner;p.restaurantIndex=6;p.upgradeLevels={gerente:4,caixa:4,imperio_logistica:20};
  const r=api.returnFromOffline(db,p,T+3600);expect(r.owner.offline.batch.coinsRaw).toBe(60*42);expect(r.receipt).toBeNull();
 });
 it('cashier1 advances2/6 of six hours; manual remainder is immediately claimable',()=>{
  const r=away(player(3,{caixa:1}),T,T+21600),b=r.owner.offline.batch;
  expect(r.receipt.offlineCoins).toBe(120*42);expect(b.minutes).toBe(360);expect(b.autoMinutes).toBe(120);
  const c=api.claimOffline(db,r.owner,b.id,T+21600);
  expect(c.receipt.offlineCoins).toBe(240*42);expect(c.owner.coins).toBe(360*42);expect(c.owner.xp).toBe(864);expect(c.owner.offline.batch).toBeNull();
 });
 it('repeated returns/callbacks/reload neither lose pending credit nor pay twice',()=>{
  const r=away(player(),T,T+3600),id=r.owner.offline.batch.id,p=JSON.parse(JSON.stringify(r.owner));
  expect(api.returnFromOffline(db,p,T+7200).owner.offline.batch.minutes).toBe(60);
  const c=api.claimOffline(db,p,id,T+3600),repeat=api.claimOffline(db,c.owner,id,T+3600);
  expect(repeat.receipt).toBeNull();expect(repeat.owner.coins).toBe(c.owner.coins);expect(p.coins).toBe(0);
 });
 it('pending cap is8h across absences, not8h per popup; cashier allowance is also per batch',()=>{
  const r=away(player(3,{caixa:1}),T,T+21600),again=away(r.owner,T+25000,T+46600);
  expect(again.owner.offline.batch.minutes).toBe(480);expect(again.owner.offline.batch.autoMinutes).toBe(120);expect(again.receipt).toBeNull();
  const c=api.claimOffline(db,again.owner,again.owner.offline.batch.id,T+46600);expect(c.owner.coins).toBe(480*42);
 });
 it('cooldown waits on a NEW batch, accumulating only actual absences and fractional credits',()=>{
  let r=away(player(),T,T+60);let p=api.claimOffline(db,r.owner,r.owner.offline.batch.id,T+60).owner;
  const paid=p.coins;
  for(let i=0;i<10;i++){r=away(p,T+100+i*60,T+101+i*60);p=r.owner;expect(api.claimOffline(db,p,p.offline.batch.id,T+101+i*60).receipt).toBeNull();}
  expect(p.offline.batch.minutes).toBeCloseTo(10/60,10);
  expect(p.offline.batch.coinsRaw).toBeCloseTo(10*(1/60)*42*(.5+.5*(1/60)/20),10);
  const c=api.claimOffline(db,p,p.offline.batch.id,T+1860);expect(c.owner.coins-paid).toBe(Math.round(p.offline.batch.coinsRaw));
 });
 it('rollback cannot create negative time, a new window or later credit for online time',()=>{
  let p=api.beginOfflineAbsence(db,player(),T).owner;p=api.returnFromOffline(db,p,T-100).owner;
  expect(p.offline.highWater).toBe(T);expect(p.offline.batch).toBeNull();
  p=api.returnFromOffline(db,p,T+3600).owner;expect(p.offline.batch).toBeNull();
 });
 it('duplicate hide does not reset anchor or snapshot',()=>{
  const p=api.beginOfflineAbsence(db,player(),T).owner;
  const again=api.beginOfflineAbsence(db,p,T+600).owner;expect(again.offline.anchor).toEqual(p.offline.anchor);
  expect(api.returnFromOffline(db,again,T+3600).owner.offline.batch.minutes).toBe(60);
 });
 it.each([1,2,3,4])('cashier%i never extends8h and conserves coins/XP after split',level=>{
  const r=away(player(4,{caixa:level}),T,T+20*3600),expected=E.computeOfflineEarnings(db,player(4,{caixa:level}),20*3600,T);
  const p=r.owner.offline.batch?api.claimOffline(db,r.owner,r.owner.offline.batch.id,T+20*3600).owner:r.owner;
  expect(p.coins).toBe(expected.coins);expect(p.xp).toBe(expected.xp);expect(p.counters.turnsPlayed??0).toBe(0);expect(p.counters.vipServed??0).toBe(0);
 });
 it('invalid ledger fails closed without erasing wallet',()=>{
  const p={...player(),coins:999,offline:{version:1,batch:{coinsRaw:Infinity}}};const r=api.returnFromOffline(db,p,T);
  expect(r.owner.coins).toBe(999);expect(r.owner.offline.disabled).toBe(true);expect(r.receipt).toBeNull();
 });
});

import {newSave,serializeSave,deserializeSave} from '../../sim-core/src/save.ts';
import {offlineView,offlineSnapshot,restoreOfflineState} from '../../sim-core/src/offline.ts';
import {commitOfflineMeta} from '../../../prototype/src/offline-ui.ts';
import {validateDatabase} from '../../sim-core/src/data.ts';
import {quoteUpgrade} from '../../sim-core/src/upgrades.ts';
describe('A-06.4 persistence, XP and integration contracts',()=>{
 it('offline XP uses the same level rewards, separated in the receipt, without fake activity',()=>{
  const p=player();p.level=4;p.xp=0;p.coins=111;p.embers=7;
  p.counters={turnsPlayed:9,ordersServed:10,vipServed:2};
  const r=away(p,T,T+8*3600);const c=api.claimOffline(db,r.owner,r.owner.offline.batch.id,T+8*3600);
  const expected=structuredClone(p),xp=c.receipt.offlineXp;
  const rewards=E.grantExperience(db,expected,xp);
  expect(c.owner.level).toBe(expected.level);expect(c.owner.xp).toBe(expected.xp);
  expect(c.owner.coins).toBe(expected.coins+c.receipt.offlineCoins);expect(c.owner.embers).toBe(expected.embers);
  expect(c.receipt.levelCoins).toBe(rewards.levelUpCoins);expect(c.receipt.levelEmbers).toBe(rewards.levelUpEmbers);
  expect(c.receipt.levelsGained).toBeGreaterThan(0);
  expect(c.owner.counters).toMatchObject({turnsPlayed:9,ordersServed:10,vipServed:2,offlineXp:xp});
 });
 it('CRC reload preserves anchor, snapshot, paid portion, cooldown and claim id',()=>{
  const save=newSave('offline',T);save.player=api.beginOfflineAbsence(db,player(3,{caixa:1}),T).owner;
  const load=deserializeSave(serializeSave(save));expect(load.ok).toBe(true);if(!load.ok)return;
  expect(load.save.player.offline).toEqual(save.player.offline);
  save.player=api.returnFromOffline(db,load.save.player,T+21600).owner;
  const partial=deserializeSave(serializeSave(save));expect(partial.ok).toBe(true);if(!partial.ok)return;
  const p=api.claimOffline(db,partial.save.player,partial.save.player.offline.batch!.id,T+21600).owner;
  expect(p.coins).toBe(360*42);expect(p.offline.batch).toBeNull();
 });
 it('v4 migration preserves wallet/history but ignores any untrusted historical offline field',()=>{
  const save=newSave('legacy',T);save.schemaVersion=4;save.player=player();save.player.coins=987;
  save.player.upgradeLevels={caixa:4,gerente:4,imperio_logistica:20};
  save.player.offline=api.beginOfflineAbsence(db,save.player,T-999999).owner.offline;
  const env=JSON.parse(serializeSave(save));env.v=4;
  const result=deserializeSave(JSON.stringify(env));expect(result.ok).toBe(true);if(!result.ok)return;
  expect(result.save.schemaVersion).toBe(5);expect(result.save.player.coins).toBe(987);
  expect(result.save.player.upgradeLevels).toEqual(save.player.upgradeLevels);expect(result.save.player.offline.anchor).toBeNull();
  expect(api.returnFromOffline(db,result.save.player,T).receipt).toBeNull();
 });
 it('atomic browser adapter never publishes failed wallet/XP/claim; a retry persists all once',()=>{
  const p=away(player(3,{caixa:1}),T,T+21600).owner;
  const meta={...p,offlineCounters:p.counters};const tx=api.claimOffline(db,p,p.offline.batch.id,T+21600);
  const before=structuredClone(meta);expect(commitOfflineMeta(meta,tx,()=>false)).toBeNull();
  expect(commitOfflineMeta(meta,tx,()=>{throw Error('quota');})).toBeNull();expect(meta).toEqual(before);
  let written:any;const result=commitOfflineMeta(meta,tx,next=>{written=JSON.parse(JSON.stringify(next));return true;});
  expect(written).toEqual(result);expect(written.offline.batch).toBeNull();expect(written.coins).toBe(360*42);
 });
 it('claiming the open batch during absence cannot settle it or change the anchor',()=>{
  let p=away(player(),T,T+60).owner;p=api.beginOfflineAbsence(db,p,T+100).owner;
  const r=api.claimOffline(db,p,p.offline.batch.id,T+120);expect(r.receipt).toBeNull();expect(r.owner.offline.anchor).toEqual(p.offline.anchor);
 });
 it('each accumulated absence keeps its own restaurant, rate, cashier and ramp',()=>{
  let p=away(player(),T,T+600).owner;p.restaurantIndex=4;p.upgradeLevels={gerente:4,caixa:1};
  const r=away(p,T+1000,T+2200);expect(r.owner.offline.batch.minutes).toBe(30);
  expect(r.owner.offline.batch.coinsRaw).toBeCloseTo(10*42*.75+20*96*1.72,7);
  expect(r.owner.offline.batch.autoMinutes).toBe(20);
  const c=api.claimOffline(db,r.owner,r.owner.offline.batch.id,T+2200);
  expect(c.owner.coins).toBe(Math.round(10*42*.75+20*96*1.72));
 });
 it('rollback after a paid batch never bypasses new-batch cooldown',()=>{
  let p=away(player(3,{caixa:4}),T,T+3600).owner;
  p=away(p,T+3700,T+3800).owner;
  expect(api.claimOffline(db,p,p.offline.batch.id,T+3500).receipt).toBeNull();
  expect(offlineView(db,p,T+3500).canClaim).toBe(false);
  expect(api.claimOffline(db,p,p.offline.batch.id,T+5400).receipt).not.toBeNull();
 });
 it('frozen snapshot and read-only view never rewrite historical purchases',()=>{
  const p=player(4,{caixa:999,gerente:999,imperio_logistica:999});const before=structuredClone(p);
  expect(offlineSnapshot(db,p).multiplier).toBeCloseTo(2.18);offlineView(db,p,T);expect(p).toEqual(before);
  expect(restoreOfflineState({version:1,anchor:{at:Infinity}},T).disabled).toBe(true);
 });
 it.each(['caixa','gerente','imperio_logistica'])('%s becomes purchasable only now with a tested offline consumer',id=>{
  const p=player(4);p.coins=1e9;expect(quoteUpgrade(db,p,id).canBuy).toBe(true);expect(E.buyUpgrade(db,p,id)).not.toBeNull();
  if(id==='caixa')expect(offlineSnapshot(db,p).autoMinutes).toBe(120);
  else expect(offlineSnapshot(db,p).multiplier).toBeGreaterThan(1);
 });
 it.each(['unlock','cap','ramp','cashier','bonus'])('rejects malformed approved offline data: %s',kind=>{
  const bad=structuredClone(db);
  if(kind==='unlock')bad.economy.idle.unlockRestaurantIndex=1;
  if(kind==='cap')bad.economy.idle.maxOfflineHours=9;
  if(kind==='ramp')bad.economy.idle.rampInMinutes=0;
  if(kind==='cashier')bad.employees!.roles.find(r=>r.id==='caixa')!.abilities[0]!.autoOfflineHours=9;
  if(kind==='bonus')bad.employees!.roles.find(r=>r.id==='caixa')!.abilities[0]!.offlineRateBonus=.5;
  expect(validateDatabase(bad).some(p=>p.includes('offline'))).toBe(true);
 });
});
