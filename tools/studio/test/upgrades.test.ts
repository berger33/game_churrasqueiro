import { describe, expect, it } from 'vitest';
import { loadDatabase } from '../load-data.ts';
import { buyUpgrade, canAfford, costFor, newPlayerState } from '../../sim-core/src/economy.ts';
import { TurnSimulation } from '../../sim-core/src/turn.ts';
import { deriveStats, overallDoneness } from '../../sim-core/src/cooking.ts';
const db = loadDatabase();
const offlineTracks = ['caixa','gerente','imperio_logistica'];
const rich = () => ({ ...newPlayerState(), coins: 100_000_000, level: 44, restaurantIndex: 4 });
const sim = (upgradeLevels: Record<string, number>, override?: number) => new TurnSimulation(db, {
  playerLevel: 44, restaurantIndex: 4, levelId: 'a061', seed: 42, upgradeLevels,
  overrides: { turnLengthSec: 150, spawnIntervalSec: .1, patienceScalar: 100, vipChance: 0,
    ...(override === undefined ? {} : { maxOrdersOnScreen: override }) }
});

describe('A-06.1: no purchase without an integrated consumer', () => {
  it.each(offlineTracks)('%s preserves purchases and now debits the next level with its offline consumer', id => {
    const p=rich();p.upgradeLevels[id]=1;const old=p.coins,cost=costFor(db,id,1);
    expect(canAfford(p,db,id)).toBe(true);expect(buyUpgrade(db,p,id)).not.toBeNull();
    expect(p.upgradeLevels[id]).toBe(2);expect(p.coins).toBe(old-cost);
  });
  it.each(['knife','board'])('%s requires an eligible prep recipe', id => {
    const p = rich(); p.level = 11;
    const before = structuredClone(p);
    expect(buyUpgrade(db, p, id)).toBeNull(); expect(p).toEqual(before);
    p.level = 12; expect(buyUpgrade(db, p, id)).not.toBeNull();
  });
  it.each([-1, .5, NaN, Infinity])('rejects malformed purchase levels %s, without repairing away history', level => {
    const p = rich(); p.upgradeLevels.grill_size = level;
    const before = structuredClone(p);
    expect(costFor(db, 'grill_size', level)).toBe(Infinity);
    expect(buyUpgrade(db, p, 'grill_size')).toBeNull(); expect(p).toEqual(before);
  });
  it('does not erase valid historical levels when a recipe gate is locked', () => {
    const p = rich(); p.level = 11; p.upgradeLevels.board = 3;
    const before = structuredClone(p); expect(buyUpgrade(db, p, 'board')).toBeNull(); expect(p).toEqual(before);
    p.level = 12; expect(buyUpgrade(db, p, 'board')).not.toBeNull(); expect(p.upgradeLevels.board).toBe(4);
  });
});

describe('A-06.1: benefits must reach gameplay, not only a derived stat', () => {
  it.each([[0,0,3],[2,0,5],[0,1,4],[2,1,6],[5,6,14]])('authored base3 + capacity%i + tables%i admits %i orders', (capacity,tables,count) => {
    const s = sim({capacity,tables},3);
    for (let i=0;i<100;i++) s.tick(.1);
    expect(s.customers.filter(c=>c.state==='waiting')).toHaveLength(count);
    expect(s.counters.peakSimultaneousOrders).toBe(count);
  });
  it('actually fills the largest default queue to17, without a caller override',()=>{
    const s=new TurnSimulation(db,{playerLevel:44,restaurantIndex:6,levelId:'a061_max',seed:42,
      upgradeLevels:{capacity:5,tables:6},overrides:{spawnIntervalSec:.1,patienceScalar:100,vipChance:0}});
    for(let i=0;i<100;i++)s.tick(.1);
    expect(s.stats.maxOrdersOnScreen).toBe(17);
    expect(s.customers.filter(c=>c.state==='waiting')).toHaveLength(17);
  });
  it('adds only extra tables, not restaurant base tables a second time', () => {
    const s=sim({capacity:2,tables:1}); for(let i=0;i<100;i++)s.tick(.1);
    expect(s.customers.filter(c=>c.state==='waiting')).toHaveLength(s.restaurant.service.maxOrdersOnScreen+3);
  });
  it.each([1,10,20])('clientela_fiel %i prolongs a real waiting customer', level => {
    const a=sim({}), b=sim({clientela_fiel:level});
    const ca=a.spawnCustomer('comum'), cb=b.spawnCustomer('comum');
    expect(cb.patienceTotal).toBeCloseTo(ca.patienceTotal*(1+.01*level));
    a.tick(5); b.tick(5); expect(cb.patienceLeft).toBeGreaterThan(ca.patienceLeft);
  });
  it.each([1,10,20])('brasa_mastery %i increases real served-plate coins', level => {
    const serve=(upgrades:Record<string,number>)=>{
      // Vinagrete's tiny payout rounds away even the max bonus on this first plate.
      // A real, higher-value cut exposes the marginal effect without changing table prices.
      const s=sim(upgrades); const c=s.spawnScriptedCustomer('comum',['picanha'],120);
      const f=s.takeFromStock(db.ingredientById.get('picanha')!);s.place(f,2);
      const target=(f.ingredient.perfectWindow[0]+f.ingredient.perfectWindow[1])/2;
      while(s.time<100&&overallDoneness(f)<target){
        s.tick(.01);
        if(!f.flips&&f.sides[f.downSide]!>=target/(1+db.ingredients.shared.carryoverRate))s.flip(f);
      }
      const scored=s.serve(c,f)!;expect(scored.quality).toBe('perfect');
      return {scored,coins:s.coins,xp:s.xp};
    };
    const a=serve({}), b=serve({brasa_mastery:level});
    expect(b.coins).toBeGreaterThan(a.coins); expect(b.scored.quality).toBe(a.scored.quality); expect(b.xp).toBe(a.xp);
  });
  it('normalizes effective levels without mutating the historical map', () => {
    const levels={capacity:999,tables:999,brasa_mastery:Infinity,clientela_fiel:-1,churrasqueiro:999,garcom:NaN,auxiliar:2.9};
    const before=structuredClone(levels);const s=deriveStats(db,db.restaurantByIndex.get(4)!,levels);
    expect(s.maxOrdersOnScreen).toBe(16); expect(s.tipMult).toBe(1); expect(s.patienceMult).toBe(1);
    expect(s.autoFlipLevel).toBe(5);expect(s.autoServeLevel).toBe(0);expect(s.autoPrepLevel).toBe(2);
    expect(levels).toEqual(before);
  });
});

import { quoteUpgrade, UPGRADE_PHASES, upgradeLevel } from '../../sim-core/src/upgrades.ts';
import { newSave, serializeSave, deserializeSave, SAVE_SCHEMA_VERSION } from '../../sim-core/src/save.ts';
import { simulateProgression } from '../run-sim.ts';
import { createFood, scoreItem, rewardTuning } from '../../sim-core/src/cooking.ts';

describe('A-06.1 shared quote, limits and persistence', () => {
  it('explicitly classifies exactly all27, with27 integrated after the real offline ledger', () => {
    expect(Object.keys(UPGRADE_PHASES).sort()).toEqual(db.upgrades.tracks.map(t=>t.id).sort());
    expect(Object.values(UPGRADE_PHASES).filter(x=>x==='active')).toHaveLength(27);
    const p=rich();
    for(const t of db.upgrades.tracks) {
      const q=quoteUpgrade(db,p,t.id); expect(q.canBuy,t.id).toBe(UPGRADE_PHASES[t.id]==='active'&&t.id!=='tray');
      expect(q.cost).toBe(costFor(db,t.id,0)); expect(q.effectDelta).toBe(t.effect.delta);
    }
    expect(quoteUpgrade(db,p,'unknown').reasons).toEqual(['unknown']);
  });
  it.each(db.employees!.roles)('$id reads its real restaurant gate even while integration is pending', role=>{
    const p=rich();p.restaurantIndex=role.unlock.restaurantIndex-1;
    expect(quoteUpgrade(db,p,role.id).reasons).toContain('restaurant_locked');
    p.restaurantIndex++;expect(quoteUpgrade(db,p,role.id).reasons).not.toContain('restaurant_locked');
    expect(quoteUpgrade(db,p,role.id).reasons.includes('feature_pending')).toBe(UPGRADE_PHASES[role.id]!=='active');
  });
  it('gates tray on waiter and logistics on the approved offline restaurant',()=>{
    const p=rich();expect(quoteUpgrade(db,p,'tray').reasons).toContain('dependency_locked');
    p.upgradeLevels.garcom=1;expect(quoteUpgrade(db,p,'tray').reasons).not.toContain('dependency_locked');
    p.restaurantIndex=2;expect(quoteUpgrade(db,p,'imperio_logistica').reasons).toContain('restaurant_locked');
    p.restaurantIndex=3;expect(quoteUpgrade(db,p,'imperio_logistica').reasons).not.toContain('restaurant_locked');
    expect(buyUpgrade(db,p,'imperio_logistica')).not.toBeNull();
  });
  it('does not infer prep eligibility from player level alone',()=>{
    const custom=structuredClone(db);
    custom.ingredients.items=custom.ingredients.items.map(i=>i.cookMethod==='prep'?{...i,unlock:{...i.unlock,restaurantIndex:3}}:i);
    const p=rich();p.restaurantIndex=2;
    expect(quoteUpgrade(custom,p,'knife').reasons).toContain('recipe_locked');
    p.restaurantIndex=3;expect(quoteUpgrade(custom,p,'knife').canBuy).toBe(true);
  });
  it('revalidates price, wallet and max on each call, including successive clicks',()=>{
    const p=rich(), initial=p.coins;
    const first=quoteUpgrade(db,p,'grill_size');buyUpgrade(db,p,'grill_size');
    const second=quoteUpgrade(db,p,'grill_size');expect(second.cost).not.toBe(first.cost);
    buyUpgrade(db,p,'grill_size');expect(p.coins).toBe(initial-first.cost-second.cost);
    expect(p.counters.upgradesPurchased).toBe(2);expect(p.counters.coinsSpentTotal).toBe(first.cost+second.cost);
    p.coins=0;const before=structuredClone(p);expect(buyUpgrade(db,p,'grill_size')).toBeNull();expect(p).toEqual(before);
    p.coins=initial;p.upgradeLevels.grill_size=8;const max=structuredClone(p);
    expect(buyUpgrade(db,p,'grill_size')).toBeNull();expect(p).toEqual(max);
  });
  it.each([NaN,Infinity,-1])('rejects invalid wallet %s without mutating levels',coins=>{
    const p=rich();p.coins=coins;const before=structuredClone(p);
    expect(buyUpgrade(db,p,'grill_size')).toBeNull();expect(p).toEqual(before);
  });
  it('honors the currency declared by the track, not a hardcoded coin debit',()=>{
    const custom=structuredClone(db),t=custom.upgradeById.get('grill_size')!;t.currency='embers';
    const p=rich();p.embers=1000;const coins=p.coins;
    expect(buyUpgrade(custom,p,t.id)?.currency).toBe('embers');
    expect(p.coins).toBe(coins);expect(p.embers).toBe(820);expect(p.counters.embersSpentTotal).toBe(180);
  });
  it('preserves every historical level, wallet, claims and counters through the existing CRC save',()=>{
    const save=newSave('a061',1000);save.player=rich();
    for(const t of db.upgrades.tracks)save.player.upgradeLevels[t.id]=t.maxLevel;
    save.player.vip.claimedAchievements=['vip_1'];save.player.vip.servedTotal=1;
    save.player.counters.restaurantsUnlocked=5;save.player.counters.upgradesPurchased=123;
    const before=structuredClone(save.player);
    for(const t of db.upgrades.tracks)expect(buyUpgrade(db,save.player,t.id)).toBeNull();
    const loaded=deserializeSave(serializeSave(save));expect(loaded.ok).toBe(true);
    if(loaded.ok){expect(loaded.save.schemaVersion).toBe(SAVE_SCHEMA_VERSION);expect(loaded.save.player).toEqual(before);}
  });
  it('bot can purchase offline tracks, but the comparable active campaign injects no absence',()=>{
    const r=simulateProgression({maxTurns:300,stepSec:1/12});
    for(const id of offlineTracks)expect(r.player.upgradeLevels[id]??0,id).toBeGreaterThan(0);
    expect(r.player.counters.offlineCoins??0).toBe(0);expect(r.player.offline.batch).toBeNull();
    for(const id of ['tables','capacity','brasa_mastery','clientela_fiel'])expect(r.player.upgradeLevels[id],id).toBeGreaterThan(0);
  },30000);
  it('new prestige is additive and only affects the tip portion; old Plates/Decor payout stays unchanged',()=>{
    const food=createFood(1,db.ingredientById.get('picanha')!);food.sides=[.7,.7];
    const tuning=rewardTuning(db.economy);
    const base={target:0,toleranceScale:1,patienceRemaining:1,combo:0,xpMult:1,tuning};
    const tips=tuning.orderBaseTip+tuning.perfectTipBonus+tuning.speedBonusMax;
    const value=food.ingredient.value*food.ingredient.satisfaction;
    for(const level of [0,1,10,20]){
      const legacy=1+.06*2+.05*3,bonus=.012*level;
      const actual=scoreItem(db,food,{...base,tipMult:legacy+bonus,prestigeTipBonus:bonus});
      expect(actual.coins).toBe(Math.round(value*((1+tips)*legacy+tips*bonus)));
      if(level>0)expect(actual.coins).toBeLessThan(Math.round(value*(1+tips)*(legacy+bonus)));
    }
  });
  it('VIP can use an extra purchased place without changing quota or bypassing a full queue',()=>{
    const s=new TurnSimulation(db,{playerLevel:44,restaurantIndex:4,levelId:'a061_vip',seed:42,
      upgradeLevels:{capacity:2},overrides:{maxOrdersOnScreen:3,vipChance:1,spawnIntervalSec:.1}});
    for(let i=0;i<3;i++)s.spawnScriptedCustomer('comum',['picanha'],120);
    s.tick(1.2);expect(s.customers.filter(c=>c.def.isVip)).toHaveLength(1);expect(s.vipState.usedToday).toBe(1);
    s.tick(.1);expect(s.customers.filter(c=>c.state==='waiting')).toHaveLength(5);
    s.tick(.1);expect(s.customers.filter(c=>c.state==='waiting')).toHaveLength(5);expect(s.vipState.usedToday).toBe(2);
  });
  it.each(db.upgrades.tracks)('$id uses integer bounded levels without erasing the input',track=>{
    const map={[track.id]:track.maxLevel+100};expect(upgradeLevel(db,map,track.id)).toBe(track.maxLevel);
    expect(map[track.id]).toBe(track.maxLevel+100);
    for(const bad of [-1,NaN,Infinity])expect(upgradeLevel(db,{[track.id]:bad},track.id)).toBe(0);
  });
});
