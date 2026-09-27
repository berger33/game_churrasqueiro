import {describe,it,expect} from 'vitest';
import {loadDatabase} from '../load-data.ts';
import {TurnSimulation} from '../../sim-core/src/turn.ts';
import {Rng} from '../../sim-core/src/rng.ts';
const db=loadDatabase(),meat=db.ingredientById.get('picanha')!,prep=db.ingredientById.get('vinagrete')!;
const make=(levels:Record<string,number>={},restaurantIndex=4,seed=42)=>new TurnSimulation(db,{playerLevel:44,restaurantIndex,levelId:'a063',seed,upgradeLevels:levels,overrides:{autoSpawn:false,turnLengthSec:1000,vipChance:0}});
// Boundary fixtures use actual admission/scoring; only doneness/fuel are fixed to isolate budgets.
function ready(s:TurnSimulation,n:number,doneness=.8){
 const customers=Array.from({length:n},()=>s.spawnScriptedCustomer('comum',[meat.id],300));s.tick(2);
 const foods=customers.map((_,i)=>{const f=s.takeFromStock(meat);expect(s.place(f,Math.floor(i/s.stats.slotsPerZone))).toBe(true);f.sides.fill(doneness);return f;});
 s.grill.charcoalT=1;return{customers,foods};
}
describe('A-06.3 bounded real staff',()=>{
 it('waiter serves real ready prep, not a derived stat or synthetic bot reaction',()=>{
  const s=make({garcom:5,board:1});for(let i=0;i<4;i++){s.spawnScriptedCustomer('comum',[prep.id],100);expect(s.startPrep(s.takeFromStock(prep))).toBe(true);}
  s.tick(4);expect(s.counters.itemsCooked).toBe(2);expect(s.coins).toBeGreaterThan(0);expect(s.prepSlots.filter(Boolean)).toHaveLength(2);
 });
 it.each([1,2,3,4,5])('waiter level%i uses a strict floor budget including manual serves',level=>{
  const s=make({garcom:level}),{customers,foods}=ready(s,6);
  expect(s.serve(customers[0]!,foods[0]!)).not.toBeNull();
  for(let i=0;i<8;i++)s.tick(2);
  const allowed=Math.floor([0,.2,.4,.5,.5,.5][level]!*6);
  expect(s.counters.itemsCooked).toBe(1+allowed);
  expect(s.staff.snapshot.serve.eligible).toBe(6);expect(s.staff.snapshot.serve.used).toBe(allowed);
 });
 it('one eligible plate cannot round coverage up to100%',()=>{
  const s=make({garcom:5,churrasqueiro:5}),{foods}=ready(s,1);s.tick(100);
  expect(foods[0]!.served).toBe(false);expect(s.staff.snapshot.serve.used).toBe(0);
 });
 it('tray changes real waiter cadence, not manual service',()=>{
  for(const tray of [0,5]){const s=make({garcom:3,tray});ready(s,6);s.tick(0);expect(s.counters.itemsCooked).toBe(1);s.tick(1);expect(s.counters.itemsCooked).toBe(tray?2:1);}
 });
 it('waiter5 carries at most two per trip; lag never produces a backlog burst',()=>{
  const s=make({garcom:5});ready(s,6);s.tick(100);expect(s.counters.itemsCooked).toBe(2);s.tick(0);expect(s.counters.itemsCooked).toBe(2);
 });
 it.each([1,2,3,4,5])('helper level%i uses declared cadence/chance and actual prep slots',level=>{
  const interval=[0,6,4.5,3.5,3,2.5][level]!;
  let seed=1;while(new Rng(seed^0xa063).next()>=.2)seed++;
  const s=make({auxiliar:level},4,seed);s.spawnScriptedCustomer('comum',[prep.id],100);
  expect(s.prepSlots.length).toBe(db.restaurants.restaurants[4]!.service.prepSlots+(level>=3?1:0));
  s.tick(interval-.01);expect(s.prepSlots.filter(Boolean)).toHaveLength(0);s.tick(.01);
  expect(s.prepSlots.filter(Boolean)).toHaveLength(1);expect(s.stockRemaining(prep.id)).toBe(5);
 });
 it('helper never admits meat, duplicates covered demand, or serves food',()=>{
  const s=make({auxiliar:5});s.spawnScriptedCustomer('comum',[prep.id,meat.id],100);s.tick(2.5);s.tick(10);
  expect(s.prepSlots.filter(Boolean)).toHaveLength(1);expect(s.foods.filter(f=>f.onGrill)).toHaveLength(0);expect(s.counters.itemsCooked).toBe(0);
 });
 it.each([1,2,3,4,5])('cook level%i flips only the public cue, bounded once per plate, without moving zones',level=>{
  const s=make({churrasqueiro:level});s.tick(.5);const foods=Array.from({length:6},(_,i)=>{const f=s.takeFromStock(meat);s.place(f,Math.floor(i/s.stats.slotsPerZone));f.sides[0]=.6;f.sides[1]=.1;return f;});s.grill.charcoalT=1;
  expect(s.flip(foods[0]!)).toBe(true);for(let i=0;i<20;i++)s.tick(5);
  expect(s.counters.flips).toBe(1+Math.floor([0,.2,.3,.4,.5,.6][level]!*6));
  expect(foods.map(f=>f.zoneIndex)).toEqual(foods.map((_,i)=>Math.floor(i/s.stats.slotsPerZone)));
 });
});

import {scoreItem,rewardTuning,effectiveHeat,publicFlipReady} from '../../sim-core/src/cooking.ts';
import {buyUpgrade,newPlayerState} from '../../sim-core/src/economy.ts';
import {quoteUpgrade} from '../../sim-core/src/upgrades.ts';
import {readFileSync} from 'node:fs';
describe('A-06.3 races, tips, bounded eligibility and failure paths',()=>{
 it.each([1,2,4,5])('waiter%i bonus scales only actual tip, once, with the shared final rounding',level=>{
  const s=make({garcom:level,plates:3,brasa_mastery:10}),{customers,foods}=ready(s,6);
  const c=customers[0]!,f=foods[0]!,ctx={restaurantIndex:s.restaurant.index,target:c.lines[0]!.target,toleranceScale:c.def.toleranceScale,
    patienceRemaining:c.patienceLeft/c.patienceTotal,combo:0,tipMult:s.stats.tipMult,prestigeTipBonus:s.stats.prestigeTipBonus,
    xpMult:s.stats.xpMult,customerTipMult:c.def.tipMultiplier,tuning:rewardTuning(db.economy)};
  const bonus=level>=4?.1:level>=2?.05:0;
  const base=scoreItem(db,f,ctx),expected=scoreItem(db,f,{...ctx,autoServiceTipBonus:bonus});
  s.tick(0);const paid=s.events.find(e=>e.type==='serve');expect(paid).toMatchObject({coins:expected.coins});
  expect(expected.xp).toBe(base.xp);if(bonus)expect(expected.coins).toBeGreaterThan(base.coins);
  expect(s.serve(c,f)).toBeNull();
  const manual=make({garcom:level,plates:3,brasa_mastery:10}),r=ready(manual,1);
  expect(manual.serve(r.customers[0]!,r.foods[0]!)?.coins).toBe(base.coins);
 });
 it('tip multiplier does not affect a zero-tip base or XP',()=>{
  const s=make(),{foods}=ready(s,1),f=foods[0]!;
  const ctx={target:0,toleranceScale:1,patienceRemaining:0,combo:0,tipMult:2,prestigeTipBonus:.2,xpMult:1,
    tuning:{...rewardTuning(db.economy),orderBaseTip:0,perfectTipBonus:0,speedBonusMax:0}};
  expect(scoreItem(db,f,{...ctx,autoServiceTipBonus:.1})).toEqual(scoreItem(db,f,ctx));
 });
 it('strict wait >1.5s, and FIFO client/plate order, not best-scoring selection',()=>{
  const s=make({garcom:3}),cs=[s.spawnScriptedCustomer('comum',[meat.id],50),s.spawnScriptedCustomer('comum',[meat.id],50)];
  s.tick(1.5);const fs=cs.map(()=>{const f=s.takeFromStock(meat);s.place(f,0);f.sides.fill(meat.perfectWindow[0]-db.grill.scoring.goodWindowPadding/2);return f;});s.grill.charcoalT=1;
  s.tick(0);expect(s.staff.snapshot.serve.eligible).toBe(0);s.tick(.001);
  expect(s.events.find(e=>e.type==='serve')).toMatchObject({quality:'good'});
  expect(cs[0]!.state).toBe('served');expect(fs[0]!.served).toBe(true);expect(cs[1]!.state).toBe('waiting');
 });
 it.each([1,2,3,4,5,6,7,8,9,10])('strict budgets for n=%i distinct eligible plates, no frame rerolls',n=>{
  const s=make({garcom:5,counter:5});ready(s,n);
  for(let i=0;i<200;i++){s.tick(.1);expect(s.staff.snapshot.serve.used).toBeLessThanOrEqual(Math.floor(.5*s.staff.snapshot.serve.eligible));}
  expect(s.staff.snapshot.serve.eligible).toBe(n);expect(s.staff.snapshot.serve.used).toBe(Math.floor(.5*n));
 });
 it('manual queued serve wins once; failed/stale actions do not burn automatic budget',()=>{
  const s=make({garcom:3}),{customers,foods}=ready(s,4);
  s.serveDelayed(customers[0]!,foods[0]!,1);s.tick(1);
  expect(s.counters.itemsCooked).toBe(2);expect(s.staff.snapshot.serve.used).toBe(1);
  s.serveDelayed(customers[0]!,foods[0]!,1);s.tick(1);expect(s.counters.itemsCooked).toBe(2);
  customers[2]!.state='left';customers[3]!.state='left';s.tick(5);expect(s.staff.snapshot.serve.used).toBe(1);
 });
 it('raw/burned/new/unmatched plates cannot inflate serve or flip credit',()=>{
  const s=make({garcom:5,churrasqueiro:5});s.spawnScriptedCustomer('comum',[prep.id],100);s.tick(2);
  for(let i=0;i<6;i++){const f=s.takeFromStock(meat);s.place(f,Math.floor(i/s.stats.slotsPerZone));if(i>=3){f.burned=true;f.sides.fill(1.3);}}
  s.grill.charcoalT=1;for(let i=0;i<50;i++)s.tick(.1);
  expect(s.staff.snapshot.serve.eligible).toBe(0);expect(s.staff.snapshot.flip.eligible).toBe(0);
 });
 it('helper failed chance and empty/full stock paths do not debit or leak a raw',()=>{
  let seed=1;while(new Rng(seed^0xa063).next()<.2)seed++;
  const s=make({auxiliar:1},4,seed);s.spawnScriptedCustomer('comum',[prep.id],100);s.tick(6);
  expect(s.staff.snapshot.prep.attempts).toBe(1);expect(s.foods).toHaveLength(0);expect(s.stockRemaining(prep.id)).toBe(6);
  const t=make({auxiliar:5});for(let i=0;i<6;i++){const f=t.takeFromStock(prep);t.startPrep(f);t.discard(f);}t.spawnScriptedCustomer('comum',[prep.id],100);t.tick(100);
  expect(t.stockRemaining(prep.id)).toBe(0);expect(t.stockRefillRemaining).toBe(0);expect(t.foods).toHaveLength(0);
  const full=make({auxiliar:5});for(let i=0;i<full.prepSlots.length;i++)full.startPrep(full.takeFromStock(prep));
  for(let i=0;i<8;i++)full.spawnScriptedCustomer('comum',[prep.id],100);full.tick(50);
  expect(full.foods).toHaveLength(full.prepSlots.length);expect(full.staff.snapshot.prep.used).toBe(0);
 });
 it('helper lag has only one opportunity; knife speeds the real portion; extra slot only once',()=>{
  const s=make({auxiliar:5,knife:5,board:5});for(let i=0;i<8;i++)s.spawnScriptedCustomer('comum',[prep.id],200);
  s.tick(60);expect(s.staff.snapshot.prep.used).toBe(1);expect(s.prepSlots.length).toBe(db.restaurants.restaurants[4]!.service.prepSlots+6);
  s.tick(.01);expect(s.staff.snapshot.prep.used).toBe(1);expect(s.prepSlots[0]!.prepProgress).toBeCloseTo(.01*s.stats.prepSpeedMult/prep.prepSec!,10);
 });
 it('helper RNG cannot consume order or VIP sequences',()=>{
  const a=make(),b=make({auxiliar:5});for(const s of [a,b]){s.spawnScriptedCustomer('comum',[prep.id],200);s.tick(2.5);}
  const sample=(s:TurnSimulation)=>Array.from({length:30},()=>{const c=s.spawnCustomer();return[c.def.id,c.lines]});
  expect(sample(a)).toEqual(sample(b));expect((a as any).vipRng.next()).toBe((b as any).vipRng.next());
 });
 it('runtime gates preserve historical levels without letting staff act before unlock',()=>{
  const s=make({garcom:5,auxiliar:5,churrasqueiro:5,tray:5},0);s.tick(100);
  expect(s.staff.snapshot.serve.level).toBe(0);expect(s.staff.snapshot.prep.level).toBe(0);expect(s.staff.snapshot.flip.level).toBe(0);
  expect(s.config.upgradeLevels.garcom).toBe(5);
 });
 it('public cue is shared with the original FTUE threshold; never an optimal-score timer',()=>{
  const tutorial=JSON.parse(readFileSync(new URL('../../../shared/data/tutorial.json',import.meta.url),'utf8'));
  expect(db.grill.interaction.flipPromptAtSideDoneness).toBe(tutorial.coach.flipPromptAtSideDoneness);
  const s=make(),f=s.takeFromStock(meat);s.place(f,0);f.sides=[.54,.1];expect(publicFlipReady(db,f)).toBe(false);f.sides[0]=.55;expect(publicFlipReady(db,f)).toBe(true);
 });
 it('waiter3 warns around1s with real current heat, but never saves a plate',()=>{
  const s=make({garcom:3}),f=s.takeFromStock(meat);s.place(f,2);
  const rate=effectiveHeat(s.grill,2,db)*meat.heatRate*s.stats.heatRampRate/meat.sideCookSec;
  f.sides[0]=db.ingredients.shared.burnedThreshold-.8*rate;s.tick(0);
  expect(s.staff.snapshot.riskFoodIds).toContain(f.uid);s.refillCharcoal();s.tick(.01);expect(s.staff.snapshot.riskFoodIds).not.toContain(f.uid);
  s.tick(2.2);s.tick(2);expect(f.burned).toBe(true);expect(s.counters.burnedFood).toBe(1);
 });
});
it.each(['garcom','auxiliar','churrasqueiro','tray'])('%s purchase is shared, preserves historical level and charges exactly the quote',id=>{
 const p=newPlayerState();p.level=44;p.restaurantIndex=4;p.coins=100000;p.upgradeLevels.garcom=1;p.upgradeLevels[id]=1;
 const q=quoteUpgrade(db,p,id);expect(q.canBuy).toBe(true);expect(buyUpgrade(db,p,id)).not.toBeNull();expect(p.coins).toBe(100000-q.cost);expect(p.upgradeLevels[id]).toBe(2);
});
import {validateDatabase} from '../../sim-core/src/data.ts';
it.each(['interval','coverage','cap','tip','slots'])('employee data rejects invalid %s before simulation',kind=>{
 const copy=structuredClone(db),e=copy.employees!;
 if(kind==='interval')e.roles.find(r=>r.id==='auxiliar')!.abilities[0]!.intervalSec=0;
 if(kind==='coverage')e.roles.find(r=>r.id==='churrasqueiro')!.abilities[0]!.coverage=.8;
 if(kind==='cap')e.automationCap.autoServeMaxCoverage=1;
 if(kind==='tip')e.roles.find(r=>r.id==='garcom')!.abilities[0]!.tipBonus=-1;
 if(kind==='slots')e.roles.find(r=>r.id==='auxiliar')!.abilities[2]!.extraPrepSlots=2;
 expect(validateDatabase(copy).some(p=>p.startsWith('employees:'))).toBe(true);
});

it('max board + helper adds one real eleventh prep slot, not repeated capacity or hidden queue',()=>{
 const s=make({auxiliar:5,board:5,counter:5},6);expect(s.prepSlots).toHaveLength(11);
 for(let i=0;i<11;i++)expect(s.startPrep(s.takeFromStock(prep),i)).toBe(true);
 expect(s.prepSlotsFree).toBe(0);expect(s.stockRemaining(prep.id)).toBe(0);
 expect(s.startPrep(s.takeFromStock(prep),11)).toBe(false);expect(s.prepSlots).toHaveLength(11);
});
