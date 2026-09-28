import { describe, expect, it } from 'vitest';
import { loadDatabase } from '../load-data.ts';
import { TurnSimulation } from '../../sim-core/src/turn.ts';
import { deriveStats, effectiveHeat } from '../../sim-core/src/cooking.ts';
import { sampleCurve } from '../../sim-core/src/data.ts';
import { Rng } from '../../sim-core/src/rng.ts';
import { SkillPolicy } from '../../sim-core/src/policy.ts';
const db=loadDatabase(), meat=db.ingredientById.get('linguica_toscana')!, prep=db.ingredientById.get('vinagrete')!;
const turn=(levels:Record<string,number>={},seed=42)=>new TurnSimulation(db,{restaurantIndex:4,playerLevel:44,levelId:'a062',seed,upgradeLevels:levels,overrides:{autoSpawn:false,turnLengthSec:600,vipChance:0}});

describe('A-06.2 real fuel and bounded stock',()=>{
  it.each([1,3,6])('stability%i recovers losses in effective heat and actual cooking',level=>{
    const a=turn(),b=turn({grill_stability:level});
    a.grill.charcoalT=b.grill.charcoalT=.8;
    const fa=a.takeFromStock(meat),fb=b.takeFromStock(meat);a.place(fa,0);b.place(fb,0);
    a.tick(.1);b.tick(.1);
    const e=sampleCurve(db.grill.charcoal.efficiencyCurve,a.grill.charcoalT);
    expect(b.grill.charcoalEfficiency).toBeCloseTo(e+.04*level*(1-e),10);
    expect(fb.sides[0]).toBeGreaterThan(fa.sides[0]!);
  });
  it.each([1,3,6])('quality%i increases the late-sack efficiency floor',level=>{
    const s=turn({charcoal_quality:level}),base=turn();s.grill.charcoalT=base.grill.charcoalT=.999;
    const f=s.takeFromStock(meat),control=base.takeFromStock(meat);s.place(f,0);base.place(control,0);s.tick(.01);base.tick(.01);
    expect(s.grill.charcoalEfficiency).toBeCloseTo(.62+.05*level,10);
    expect(f.sides[0]).toBeGreaterThan(control.sides[0]!);
  });
  it('combines quality/stability without changing duration or generating heat while empty/refilling',()=>{
    const s=turn({grill_stability:6,charcoal_quality:6});s.grill.charcoalT=.999;s.tick(.01);
    expect(s.grill.charcoalEfficiency).toBeCloseTo(.9392,10);
    expect(s.stats.charcoalDurationSec).toBe(turn().stats.charcoalDurationSec);
    const f=s.takeFromStock(meat);s.place(f,0);s.grill.charcoalT=1;s.tick(1);
    expect(effectiveHeat(s.grill,0,db)).toBe(0);expect(f.sides[0]).toBe(0);
    expect(s.refillCharcoal()).toBe(true);expect(s.refillCharcoal()).toBe(false);
    s.tick(2);expect(f.sides[0]).toBe(0);expect(effectiveHeat(s.grill,0,db)).toBe(0);
    s.tick(.2);expect(s.counters.charcoalRefills).toBe(1);
    s.tick(.1);expect(f.sides[0]).toBeGreaterThan(0);
  });
  it('automatically attempts a low sack and does not double-start a manual refill',()=>{
    const s=turn({charcoal_auto:3},42),f=s.takeFromStock(meat);s.place(f,0);s.grill.charcoalT=.8;s.tick(.01);
    expect(f.sides[0]).toBe(0);
    expect(s.grill.refilling).toBeGreaterThan(0);
    expect(s.refillCharcoal()).toBe(false);
    s.tick(3);expect(s.counters.charcoalRefills).toBe(1);expect(f.sides[0]).toBeGreaterThan(0);
    expect(s.events.filter(e=>e.type==='charcoal_auto_attempt')).toHaveLength(1);
  });
  it('a raw item is charged only at legal admission, and move/flip/cancel never charges twice',()=>{
    const s=turn(),f=s.takeFromStock(meat);
    expect(s.stockRemaining(meat.id)).toBe(6);
    expect(s.place(f,-1)).toBe(false);expect(s.stockRemaining(meat.id)).toBe(6);
    expect(s.place(f,0)).toBe(true);expect(s.stockRemaining(meat.id)).toBe(5);
    s.move(f,1);s.flip(f);s.place(f,0);expect(s.stockRemaining(meat.id)).toBe(5);
    s.discard(f);expect(s.stockRemaining(meat.id)).toBe(5);
    const cancelled=s.takeFromStock(meat);s.discard(cancelled);expect(s.stockRemaining(meat.id)).toBe(5);
  });
  it.each([0,1,5])('counter%i supplies per-ingredient units, then denies until a real3s refill',level=>{
    const s=turn({counter:level});
    for(let i=0;i<6+level;i++){const f=s.takeFromStock(meat);expect(s.place(f,0)).toBe(true);s.discard(f);}
    const denied=s.takeFromStock(meat);expect(s.place(denied,0)).toBe(false);
    expect(s.stockRemaining(meat.id)).toBe(0);expect(s.stockRemaining(prep.id)).toBe(6+level);
    expect(s.refillStock()).toBe(true);s.tick(2.9);expect(s.stockRemaining(meat.id)).toBe(0);
    expect(s.refillStock()).toBe(false);s.tick(.1);expect(s.stockRemaining(meat.id)).toBe(6+level);
    expect(s.place(denied,0)).toBe(true);expect(s.coins).toBe(0);
  });
  it('prep requires both a slot and stock; cancelled or full attempts preserve stock',()=>{
    const s=turn(),f=s.takeFromStock(prep);expect(s.startPrep(f,-1)).toBe(false);
    expect(s.stockRemaining(prep.id)).toBe(6);expect(s.startPrep(f)).toBe(true);
    expect(s.stockRemaining(prep.id)).toBe(5);expect(s.startPrep(f)).toBe(false);
    for(let i=1;i<6;i++){s.discard(f);const other=s.takeFromStock(prep);expect(s.startPrep(other)).toBe(true);s.discard(other);}
    const empty=s.takeFromStock(prep);expect(s.startPrep(empty)).toBe(false);
  });
  it('the policy does not create an orphan raw food each tick when every grill zone is full',()=>{
    const s=turn();
    for(const z of s.grill.zones)for(let i=0;i<s.stats.slotsPerZone;i++){
      const ing=db.ingredients.items.filter(i=>i.cookMethod==='grill')[z.index]!;
      const f=s.takeFromStock(ing);expect(s.place(f,z.index)).toBe(true);
    }
    s.spawnScriptedCustomer('comum',['picanha'],300);
    const bot=new SkillPolicy(new Rng(55),{skill:.55});
    for(let i=0;i<40;i++)s.tick(.001,a=>bot.act(a));
    expect(s.foods.filter(f=>!f.served&&!f.onGrill&&f.ingredient.cookMethod==='grill')).toHaveLength(0);
  });
});

describe('A-06.2 boundaries, isolated RNG, shared actors',()=>{
  const seedFor=(lo:number,hi:number)=>{
    for(let seed=1;seed<10000;seed++){const roll=new Rng(seed^0xc0a1).next();if(roll>=lo&&roll<hi)return seed;}
    throw new Error('missing seed');
  };
  const seeded=(seed:number,levels:Record<string,number>)=>new TurnSimulation(db,{playerLevel:44,restaurantIndex:4,levelId:'a062-rng',seed,upgradeLevels:levels,overrides:{autoSpawn:false,turnLengthSec:1000}});
  it.each([1,2,3])('auto level%i uses exactly33/66/99%, not guaranteed success',level=>{
    const p=.33*level;
    for(const [lo,hi,success] of [[p-.001,p,true],[p,p+.001,false]] as const){
      const s=seeded(seedFor(lo,hi),{charcoal_auto:level});s.grill.charcoalT=.78;s.tick(0);
      expect(s.events.find(e=>e.type==='charcoal_auto_attempt')).toMatchObject({success});
      expect(s.autoRefillAttempts).toBe(1);expect(s.autoRefillSuccesses).toBe(Number(success));
    }
  });
  it('failed chance cannot reroll with frame count; manual completion enables the next sack',()=>{
    for(const dt of [0,1/60,1/12,.1]){
      const s=seeded(seedFor(.66,.99),{charcoal_auto:1});s.grill.charcoalT=.9;
      for(let i=0;i<100;i++)s.tick(dt);
      expect(s.autoRefillAttempts).toBe(1);expect(s.autoRefillSuccesses).toBe(0);
      expect(s.refillCharcoal()).toBe(true);s.tick(2.2);expect(s.grill.charcoalAutoAttempted).toBe(false);
      s.grill.charcoalT=.9;s.tick(0);expect(s.autoRefillAttempts).toBe(2);
    }
  });
  it('loaded below threshold attempts once; loaded attempted sack does not; level0 never rolls',()=>{
    const s=seeded(42,{charcoal_auto:3});s.grill.charcoalT=.95;s.grill.charcoalAutoAttempted=true;s.tick(.1);
    expect(s.autoRefillAttempts).toBe(0);s.grill.charcoalAutoAttempted=false;s.tick(0);expect(s.autoRefillAttempts).toBe(1);
    const zero=seeded(42,{});zero.grill.charcoalT=.99;zero.tick(5);expect(zero.autoRefillAttempts).toBe(0);
  });
  it('automatic RNG consumes neither normal order nor VIP RNG sequences',()=>{
    const a=seeded(55,{}),b=seeded(55,{charcoal_auto:3});
    b.grill.charcoalT=.9;b.tick(0);
    const sample=(s:TurnSimulation)=>Array.from({length:30},()=>{const c=s.spawnCustomer();return[c.def.id,c.lines,c.patienceTotal]});
    expect(sample(a)).toEqual(sample(b));
    expect((a as any).vipRng.next()).toBe((b as any).vipRng.next());
  });
  it('refill and exhaustion integrate only live-fuel seconds, including a partial frame',()=>{
    const s=turn({grill_stability:6,charcoal_quality:6}),f=s.takeFromStock(meat);s.place(f,1);
    s.refillCharcoal();s.tick(2);const before=[...f.sides];s.tick(.2);expect(f.sides).toEqual(before);
    s.tick(.1);expect(f.sides[0]).toBeGreaterThan(before[0]!);
    const t=turn({}),g=t.takeFromStock(meat);t.place(g,1);t.grill.charcoalT=1-.01/t.stats.charcoalDurationSec;
    t.tick(1);const side=g.sides[0]!;expect(side).toBeGreaterThan(0);expect(g.timeOnGrill).toBeCloseTo(.01,8);
    t.tick(1);expect(g.sides[0]).toBe(side);expect(effectiveHeat(t.grill,1,db)).toBe(0);
  });
  it('quality/stability do not guarantee perfect or prevent burning; legacy restaurant field stays separate',()=>{
    const s=turn({grill_stability:6,charcoal_quality:6}),f=s.takeFromStock(meat);s.place(f,2);s.tick(100);
    expect(f.burned).toBe(true);expect(s.counters.burnedFood).toBe(1);
    expect(deriveStats(db,db.restaurants.restaurants[0]!,{grill_stability:6}).stabilityRecoveryFraction).toBe(.24);
    expect(s.stats.heatStability).toBe(s.restaurant.grill.heatStability);
  });
  it('stock refill can start early, leaves other actions/patience/cooking running, and never pays coins',()=>{
    const s=turn({}),c=s.spawnScriptedCustomer('comum',[meat.id],50),f=s.takeFromStock(meat);s.place(f,0);
    const before=c.patienceLeft;expect(s.refillStock()).toBe(true);const another=s.takeFromStock(meat);expect(s.place(another,1)).toBe(true);
    s.tick(2);expect(f.sides[0]).toBeGreaterThan(0);expect(c.patienceLeft).toBeLessThan(before);expect(s.stockRemaining(meat.id)).toBe(4);
    s.tick(1);expect(s.stockRemaining(meat.id)).toBe(6);expect(s.coins).toBe(0);expect(s.events.filter(e=>e.type==='stock_refilled')).toHaveLength(1);
    s.tick(1);expect(s.events.filter(e=>e.type==='stock_refilled')).toHaveLength(1);
  });
  it('policy uses explicit three-second replenishment for demanded empty stock',()=>{
    const s=turn({});for(let i=0;i<6;i++){const f=s.takeFromStock(meat);expect(s.place(f,0)).toBe(true);s.discard(f);}
    s.spawnScriptedCustomer('comum',[meat.id],50);const bot=new SkillPolicy(new Rng(8),{skill:1});
    s.tick(.1,a=>bot.act(a));expect(s.stockRefillRemaining).toBe(3);expect(s.foods.filter(f=>!f.served)).toHaveLength(0);
    s.tick(2.9);expect(s.stockRemaining(meat.id)).toBe(0);s.tick(.1,a=>bot.act(a));
    expect(s.stockRemaining(meat.id)).toBe(5);expect(s.grill.zones.flatMap(z=>z.items)).toHaveLength(1);
  });
});

import { buyUpgrade, newPlayerState } from '../../sim-core/src/economy.ts';
import { quoteUpgrade, UPGRADE_PHASES } from '../../sim-core/src/upgrades.ts';
import { readFileSync } from 'node:fs';
import { CHARCOAL_REFILL, STOCK_REFILL, PREP_AREA } from '../../../prototype/src/cooking-ui.ts';
describe('A-06.2 shared resource purchases/UI geometry',()=>{
  it.each(['grill_stability','charcoal_quality','charcoal_auto','counter'])('%s is purchasable without rewriting history',id=>{
    const p=newPlayerState();p.level=44;p.restaurantIndex=4;p.coins=100000;p.upgradeLevels[id]=1;
    const q=quoteUpgrade(db,p,id);expect(q.canBuy).toBe(true);expect(q.phase).toBe('active');
    expect(buyUpgrade(db,p,id)).not.toBeNull();expect(p.coins).toBe(100000-q.cost);expect(p.upgradeLevels[id]).toBe(2);
  });
  it('resource controls sit on the last row, still touch-sized and clear of prep',()=>{
    for(const r of [CHARCOAL_REFILL,STOCK_REFILL]){
      expect(r.h).toBeGreaterThanOrEqual(48);expect(r.w).toBeGreaterThanOrEqual(48);
      expect(r.y).toBeGreaterThanOrEqual(PREP_AREA.y+PREP_AREA.h); // below the prep station, not over it
      expect(r.y+r.h).toBeLessThanOrEqual(780);                    // and inside the 420x780 screen
      expect(r.y+r.h).toBeGreaterThan(770);                        // as low as the screen allows
    }
    expect(CHARCOAL_REFILL.x+CHARCOAL_REFILL.w).toBeLessThan(STOCK_REFILL.x);
  });
});

describe('stock rejects invalid station indices before commitment',()=>{
  it.each([.5,NaN,Infinity,-1,999])('prep slot %s cannot consume stock or create a hidden prep entry',index=>{
    const s=turn(),f=s.takeFromStock(prep);
    expect(s.startPrep(f,index)).toBe(false);expect(s.stockRemaining(prep.id)).toBe(6);
    expect(s.prepSlots.every(f=>f===null)).toBe(true);
  });
  it('depleted ingredient stays in the ordinary order pool',()=>{
    const s=turn();for(let i=0;i<6;i++){const f=s.takeFromStock(meat);s.place(f,0);s.discard(f);}
    expect(s.stockRemaining(meat.id)).toBe(0);
    expect(Array.from({length:60},()=>s.spawnCustomer().lines).flat().some(l=>l.ingredientId===meat.id)).toBe(true);
  });
});

it('every active catalog effect has a real pt-BR label, never a dynamic key placeholder',()=>{
  const pt=JSON.parse(readFileSync(new URL('../../../shared/l10n/pt-BR.json',import.meta.url),'utf8'));
  for(const t of db.upgrades.tracks.filter(t=>UPGRADE_PHASES[t.id]==='active')) {
    const stat=t.id==='brasa_mastery'?'prestigeTip':t.effect.stat;
    expect(pt[`ui.upgrades.stat.${stat}`],t.id).toBeTypeOf('string');
  }
});
