import {describe,it,expect} from 'vitest';
import {loadDatabase} from '../load-data.ts';
import {validateDatabase} from '../../sim-core/src/data.ts';
import {createFood,rewardTuning,scoreItem} from '../../sim-core/src/cooking.ts';
import {TurnSimulation} from '../../sim-core/src/turn.ts';
import {computeOfflineEarnings,newPlayerState} from '../../sim-core/src/economy.ts';
const db=loadDatabase();
const payout=(restaurantIndex:number,combo=10)=>{
 const food=createFood(1,db.ingredientById.get('picanha')!);food.sides=[.7,.7];
 return scoreItem(db,food,{target:0,toleranceScale:1,patienceRemaining:1,combo,tipMult:1,xpMult:1,tuning:rewardTuning(db.economy),restaurantIndex});
};
describe('Authorized A-06.4 late-income rebalance',()=>{
 it.each([0,1,2,3])('preserves the full plate payout in early restaurant%i',restaurantIndex=>{
  expect(payout(restaurantIndex)).toEqual(payout(0));
 });
 it.each([4,5,6])('reduces coins, never XP or cooking quality, in late restaurant%i',restaurantIndex=>{
  const a=payout(0),b=payout(restaurantIndex);
  expect(b.coins).toBeLessThan(a.coins);expect(b.coins).toBeGreaterThan(0);
  expect({...b,coins:a.coins}).toEqual(a);
 });
 it('keeps skilled cooking economically useful, rather than capping every plate to a flat sum',()=>{
  expect(payout(6,20).coins).toBeGreaterThan(payout(6,0).coins);
 });
 it('applies in the runtime legal serving path, not only the progression simulator',()=>{
  const serve=(restaurantIndex:number)=>{
   const s=new TurnSimulation(db,{restaurantIndex,playerLevel:44,levelId:'income-runtime',seed:12,upgradeLevels:{},overrides:{autoSpawn:false}});
   const c=s.spawnScriptedCustomer('comum',['vinagrete'],100);
   const f=s.takeFromStock(db.ingredientById.get('vinagrete')!);s.startPrep(f);s.tick(10);
   return {sim:s,scored:s.serve(c,f)!};
  };
  const a=serve(3),b=serve(6);
  expect(b.scored.coins).toBeLessThan(a.scored.coins);expect(b.scored.xp).toBe(a.scored.xp);
  expect(b.sim.events.find(e=>e.type==='serve'&&e.coins===b.scored.coins)).toBeTruthy();
  expect(b.sim.coins).toBe(b.scored.coins);
 });
 it('does not change the separate offline contract at any restaurant',()=>{
  for(const [restaurantIndex,rate] of [[3,42],[4,96],[5,210],[6,430]]){
   const p={...newPlayerState(),restaurantIndex:restaurantIndex!};
   expect(computeOfflineEarnings(db,p,3600,1e6).coins).toBe(60*rate!);
  }
 });
 it.each([[],[1,1,1,1,.8,.6,-1],[1,1,1,1,.8,.6,NaN],[.5,1,1,1,.8,.6,.5],[1,1,1,1,.8,.6,2]].map(curve=>({curve})))('rejects a malformed/incompatible restaurant income curve $curve',({curve:values})=>{
  const bad=structuredClone(db);(bad.economy.reward as any).activeCoinMultiplierByRestaurant=values;
  expect(validateDatabase(bad).some(p=>p.includes('active income'))).toBe(true);
 });
});

describe('late-income boundaries and accounting',()=>{
 it.each([4,5,6])('rounds only once after the full tip/combo/VIP calculation, restaurant%i',restaurantIndex=>{
  const f=createFood(1,db.ingredientById.get('picanha')!);f.sides=[.7,.7];
  const t=db.economy.reward,ctx={restaurantIndex,target:0,toleranceScale:1,patienceRemaining:1,combo:12,
   tipMult:1.56,prestigeTipBonus:.12,autoServiceTipBonus:.1,xpMult:1.12,customerTipMult:3,tuning:rewardTuning(db.economy)};
  const tips=t.orderBaseTip+t.perfectTipBonus+t.speedBonusMax;
  const raw=f.ingredient.value*f.ingredient.satisfaction*((1+tips)*(1.56-.12)+tips*.12+tips*1.56*.1)*t.comboCap*(1+2*t.customerTipWeight);
  const result=scoreItem(db,f,ctx);
  expect(result.coins).toBe(Math.round(raw*t.activeCoinMultiplierByRestaurant[restaurantIndex]!));
  expect(result.xp).toBe(Math.round(f.ingredient.xp*1.12*1.35));
 });
 it('does not increase an owned wallet retroactively or reprice an upgrade',()=>{
  const p={...newPlayerState(),coins:9999,restaurantIndex:6,upgradeLevels:{plates:3,gerente:4}};
  const before=structuredClone(p);payout(p.restaurantIndex);expect(p).toEqual(before);
  expect(db.upgradeById.get('plates')!.baseCost).toBe(160);
 });
 it.each([4,5,6])('burned stays zero and level XP is not income-scaled in restaurant%i',restaurantIndex=>{
  const f=createFood(1,db.ingredientById.get('picanha')!);f.sides=[1.2,1.2];f.burned=true;
  const r=scoreItem(db,f,{restaurantIndex,target:0,toleranceScale:1,patienceRemaining:1,combo:40,tipMult:2,xpMult:1,tuning:rewardTuning(db.economy)});
  expect(r.coins).toBe(0);expect(r.xp).toBe(0);expect(r.quality).toBe('burned');
 });
});
