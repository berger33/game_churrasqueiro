import { describe, expect, it } from 'vitest';
import { loadDatabase } from '../load-data.ts';
import { TurnSimulation } from '../../sim-core/src/turn.ts';
import { newVipState, vipChance, vipCallStatus, beginVipCall, finishVipCall, admitVip, applyVipProgress, restoreVipState } from '../../sim-core/src/vip.ts';
import { newSave, serializeSave, deserializeSave, migrate } from '../../sim-core/src/save.ts';
import { applyTurnResult } from '../../sim-core/src/economy.ts';
import { checkAnalyticsEvent, type AnalyticsEvent, type AnalyticsTaxonomy } from '../../sim-core/src/analytics.ts';
import { readJson } from '../load-data.ts';
import { simulateProgression } from '../run-sim.ts';
import { validateDatabase } from '../../sim-core/src/data.ts';

const db = loadDatabase();
function turn(restaurantIndex=1, vipChance=1) {
  return new TurnSimulation(db, { playerLevel:12, restaurantIndex, levelId:'vip-test', seed:12,
    upgradeLevels:{}, overrides:{vipChance, turnLengthSec:180,spawnIntervalSec:1} });
}
describe('A-05: VIP admission regressions',()=>{
  it('chance one admits a natural VIP with a nonempty unlocked menu',()=>{
    const s=turn(); s.tick(1.3);
    expect(s.customers[0]?.def.id).toBe('vip');
    expect(s.customers[0]!.lines.length).toBeGreaterThan(0);
  });
  it('zero chance and initial restaurant keep natural VIP blocked',()=>{
    for(const s of [turn(1,0),turn(0,1)]) { while(!s.finished)s.tick(.1); expect(s.events.filter(e=>e.type==='spawn'&&e.customer.def.isVip)).toHaveLength(0); }
  });
  it('natural visits reach but never exceed the configured two/day',()=>{
    const s=turn();while(!s.finished)s.tick(.1);
    expect(s.events.filter(e=>e.type==='spawn'&&e.customer.def.isVip)).toHaveLength(2);
  });
  it('direct forced or scripted VIP cannot bypass the daily ledger',()=>{
    expect(()=>turn().spawnCustomer('vip')).toThrow(/VIP/);
    expect(()=>turn().spawnScriptedCustomer('vip',['linguica_toscana'],60)).toThrow(/VIP/);
  });
});

const MON=Date.parse('2026-09-21T12:00:00Z')/1000;
const SAT=Date.parse('2026-09-26T00:00:00Z')/1000;
const tax=readJson('analytics.json') as AnalyticsTaxonomy;
function configured(state=newVipState(), time=MON, chance=1, restaurantIndex=1, analytics?: (e:AnalyticsEvent)=>void) {
  return new TurnSimulation(db,{playerLevel:12,restaurantIndex,levelId:'vip',seed:12,upgradeLevels:{},
    vip:{state,startUnixSec:time,analytics},overrides:{vipChance:chance,spawnIntervalSec:1,turnLengthSec:180}});
}
function call(s=newVipState(), now=MON) {
  const token=beginVipCall(db,s,1,now)!;
  expect(token).toBeTruthy();
  expect(finishVipCall(db,s,1,now,token,true)).toBe(true);
  return s;
}
describe('VIP chance source and deterministic admission',()=>{
  it('uses level override, fallback and only the active weekly additive modifier',()=>{
    expect(vipChance(db,undefined,MON)).toBe(.06);
    expect(vipChance(db,.12,MON)).toBe(.12);
    expect(vipChance(db,undefined,SAT)).toBeCloseTo(.10);
    expect(vipChance(db,.12,SAT+86400)).toBeCloseTo(.16);
    expect(vipChance(db,.12,SAT+172800)).toBe(.12);
    expect(vipChance(db,0,SAT)).toBe(0);
    expect(vipChance(db,1,SAT)).toBe(1);
  });
  it.each([-1,1.01,NaN,Infinity])('rejects invalid override %s',chance=>expect(()=>configured(undefined,MON,chance)).toThrow(/chance/));
  it('reproduces seeded VIP arrivals without consuming ordinary RNG when disabled',()=>{
    const run=()=>{const s=configured();while(!s.finished)s.tick(.1);return s.result();};
    expect(run()).toEqual(run());
    const a=configured(undefined,MON,0),b=configured(undefined,SAT,0);
    while(!a.finished){a.tick(.1);b.tick(.1);} expect(a.result()).toEqual(b.result());
  });
  it('never rolls a blocked/full slot or silently drops the reservation',()=>{
    const state=call(),s=configured(state,MON,0);
    for(let i=0;i<s.stats.maxOrdersOnScreen;i++)s.spawnScriptedCustomer('comum',['linguica_toscana'],500);
    s.tick(1.3); expect(state.pendingCall).toBeTruthy();expect(s.counters.vipSpawned).toBe(0);
    s.customers[0]!.state='served';s.tick(1.1);
    expect(s.counters.vipSpawned).toBe(1);expect(state.pendingCall).toBeNull();expect(state.usedToday).toBe(1);
  });
  it('uses one persisted quota over multiple turns and restores, not a fresh cap per turn',()=>{
    const save=newSave('vip',MON);
    for(let i=0;i<2;i++){const s=configured(save.player.vip);s.tick(1.3);expect(s.counters.vipSpawned).toBe(1);}
    const loaded=deserializeSave(serializeSave(save));expect(loaded.ok).toBe(true);
    if(!loaded.ok)throw Error('load');
    const third=configured(loaded.save.player.vip);third.tick(1.3);expect(third.counters.vipSpawned).toBe(0);
    const tomorrow=configured(loaded.save.player.vip,MON+86400);tomorrow.tick(1.3);expect(tomorrow.counters.vipSpawned).toBe(1);
    expect(loaded.save.player.vip.usedToday).toBe(1);
  });
});
describe('VIP reward callback, reservation and UTC ledger',()=>{
  it('cancel, wrong token, duplicate callback and expiry grant nothing extra',()=>{
    const s=newVipState(),t=beginVipCall(db,s,1,MON)!;
    expect(beginVipCall(db,s,1,MON)).toBeNull();
    expect(finishVipCall(db,s,1,MON,'wrong',true)).toBe(false);
    expect(finishVipCall(db,s,1,MON,t,false)).toBe(false);expect(s.usedToday).toBe(0);
    expect(finishVipCall(db,s,1,MON,t,true)).toBe(false);
    const next=beginVipCall(db,s,1,MON)!;expect(next).not.toBe(t);
    expect(finishVipCall(db,s,1,MON+3600,next,true)).toBe(false);expect(s.usedToday).toBe(0);
    call(s,MON+3600);expect(finishVipCall(db,s,1,MON+3600,next,true)).toBe(false);expect(s.usedToday).toBe(1);
  });
  it('revalidates a callback if natural visits used the cap while it was open',()=>{
    const s=newVipState(),t=beginVipCall(db,s,1,MON)!;
    admitVip(db,s,1,MON,1,()=>0);admitVip(db,s,1,MON,1,()=>0);
    expect(finishVipCall(db,s,1,MON,t,true)).toBe(false);expect(s.pendingCall).toBeNull();expect(s.usedToday).toBe(2);
  });
  it('reserves one shared slot, consumes once and enforces cooldown across relaunch',()=>{
    const s=call(); expect(vipCallStatus(db,s,1,MON)).toBe('reserved');
    expect(admitVip(db,s,1,MON,0,()=>1)).toBe('called');
    const restored=restoreVipState(s);
    expect(vipCallStatus(db,restored,1,MON+3599)).toBe('cooldown');
    expect(vipCallStatus(db,restored,1,MON+3600)).toBe('ready');
    call(restored,MON+3600);expect(admitVip(db,restored,1,MON+3600,0,()=>1)).toBe('called');
    expect(admitVip(db,restored,1,MON+7200,1,()=>0)).toBeNull();
    expect(vipCallStatus(db,restored,1,MON+7200)).toBe('limit');
  });
  it('retains a pending visit overnight, counting it in the new UTC day; rollback never resets quota',()=>{
    const midnight=Math.floor(MON/86400)*86400+86400;
    const s=call(newVipState(),midnight-1);
    expect(vipCallStatus(db,s,1,midnight)).toBe('reserved');expect(s.usedToday).toBe(1);
    expect(admitVip(db,s,1,midnight,0,()=>1)).toBe('called');
    expect(admitVip(db,s,1,midnight,1,()=>0)).toBe('natural');
    expect(admitVip(db,s,1,midnight-3600,1,()=>0)).toBeNull();expect(s.usedToday).toBe(2);
  });
  it('keeps a reservation through ineligible restaurants and supports a zero-natural-chance turn',()=>{
    const s=call();expect(beginVipCall(db,newVipState(),0,MON)).toBeNull();
    expect(admitVip(db,s,0,MON,1,()=>0)).toBeNull();expect(s.pendingCall).toBeTruthy();
    const sim=configured(s,MON,0);sim.tick(1.3);
    expect(sim.customers[0]!.vipSource).toBe('called');expect(s.pendingCall).toBeNull();
  });
  it('migrates v3 without resetting wallet/tutorial and fails closed for malformed VIP state',()=>{
    const old=newSave('old',MON);delete (old.player as Partial<typeof old.player>).vip;
    old.player.coins=1234;old.progress.ftueDone=true;
    const saved=migrate(old,3);expect(saved.schemaVersion).toBe(5);expect(saved.player.vip).toEqual(newVipState());
    expect(saved.player.coins).toBe(1234);expect(saved.progress.ftueDone).toBe(true);
    const s=restoreVipState({usedToday:-1});expect(s.blocked).toBe(true);
    expect(beginVipCall(db,s,1,MON)).toBeNull();expect(admitVip(db,s,1,MON,1,()=>0)).toBeNull();
  });
});
describe('VIP completed service, economy and analytics',()=>{
  it('pays normal damped VIP tips, counts a whole order once and credits achievement once',()=>{
    const events:AnalyticsEvent[]=[],save=newSave('p',MON),sim=configured(save.player.vip,MON,1,1,e=>events.push(e));
    sim.tick(1.3);const c=sim.customers[0]!;expect(c.def.isVip).toBe(true);
    for(const [index,line] of c.lines.entries()) {
      const f=sim.takeFromStock(db.ingredientById.get(line.ingredientId)!);
      if(f.ingredient.cookMethod==='prep') {sim.startPrep(f);sim.tick(3);}
      else {sim.place(f,0);f.sides.fill((f.ingredient.perfectWindow[0]+f.ingredient.perfectWindow[1])/2);}
      const scored=sim.serve(c,f);expect(scored?.coins).toBeGreaterThan(0);expect(sim.serve(c,f)).toBeNull();
      expect(sim.counters.vipServed).toBe(index===c.lines.length-1?1:0);
    }
    applyTurnResult(db,save.player,sim.result());
    expect(save.player.counters.vipServed).toBe(1);expect(save.player.vip.servedTotal).toBe(1);
    expect(save.player.vip.claimedAchievements).toEqual(['vip_1']);
    expect(applyVipProgress(db,save.player.vip,0)).toEqual({coins:0,embers:0,unlocked:[]});
    const reward=applyVipProgress(db,save.player.vip,24);expect(reward).toEqual({coins:15000,embers:30,unlocked:['vip_25']});
    expect(events.map(e=>e.name)).toEqual(['vip_arrival','vip_served']);
    for(const event of events)expect(checkAnalyticsEvent(tax,event)).toEqual([]);
  });
  it('lost VIP consumes the visit but does not grant served achievement',()=>{
    const sim=configured();while(!sim.finished)sim.tick(.1);
    expect(sim.counters.vipServed).toBe(0);expect(sim.vipState.usedToday).toBe(2);
    expect(applyVipProgress(db,sim.vipState,0).unlocked).toEqual([]);
  });
  it('real progression has natural VIP without rewarded and obeys a persisted daily cap',()=>{
    const report=simulateProgression({maxTurns:90,stepSec:1/12});
    expect(report.player.vip.servedTotal).toBeGreaterThan(0);
    expect(report.player.vip.sequence).toBe(0);
    const daily=new Map<number,number>();
    for(const t of report.outcomes) {
      daily.set(t.vipSnapshot.day,(daily.get(t.vipSnapshot.day)??0)+t.vipSnapshot.arrived);
      if(t.level.vipChance===0)expect(t.vipSnapshot.arrived).toBe(0);
    }
    for(const n of daily.values())expect(n).toBeLessThanOrEqual(2);
  },30000);
});
describe('VIP data validation',()=>{
  it.each(['chance','cap','duration','day','bonus','cooldown','adCap','ttl'])('rejects broken %s configuration',kind=>{
    const d=structuredClone(db);
    if(kind==='chance')d.events!.defaults.vipBaseChance=NaN;
    if(kind==='cap')d.events!.defaults.vipMaxPerDay=-1;
    if(kind==='duration')d.events!.weeklyRecurring[0]!.durationHours=-1;
    if(kind==='day')d.events!.weeklyRecurring[0]!.dayOfWeek='bogus';
    if(kind==='bonus')d.events!.weeklyRecurring[3]!.modifiers.find(m=>m.type==='vipChance')!.valueAdd=Infinity;
    const cfg=d.ads!.rewardedPlacements.find(p=>p.id==='call_vip')!;
    if(kind==='cooldown')cfg.cooldownMin=-1;if(kind==='adCap')cfg.maxPerDay=.5;if(kind==='ttl')d.ads!.antiFraud.tokenTtlSec=0;
    expect(validateDatabase(d).join('\n')).toMatch(/VIP/);
  });
});

describe('VIP boundary validation and recovery',()=>{
  it.each([-1,NaN,Infinity,1.1])('service rejects invalid probability %s before admitting',chance=>{
    expect(()=>admitVip(db,newVipState(),1,MON,chance,()=>0)).toThrow(/VIP/);
  });
  it.each([-1,.5,NaN])('cannot corrupt lifetime counters with invalid served delta %s',served=>{
    const s=newVipState();expect(()=>applyVipProgress(db,s,served)).toThrow(/VIP/);expect(s.servedTotal).toBe(0);
  });
  it('fails closed on a reservation without its reserved budget or inconsistent clock',()=>{
    const s=call();s.usedToday=0;expect(restoreVipState(s).blocked).toBe(true);
    const next=call();next.day++;expect(restoreVipState(next).blocked).toBe(true);
  });
  it('validates VIP achievement goals/rewards rather than paying a no-service achievement',()=>{
    const d=structuredClone(db);d.achievements!.achievements.find(a=>a.stat==='vipServed')!.goal=0;
    expect(validateDatabase(d).join('\n')).toMatch(/VIP/);
    const e=structuredClone(db);e.achievements!.achievements.find(a=>a.stat==='vipServed')!.reward.coins=-1;
    expect(validateDatabase(e).join('\n')).toMatch(/VIP/);
  });
  it('never rolls RNG when quota, chance, eligibility or a reservation already decide admission',()=>{
    let rolls=0;const roll=()=>{rolls++;return 0;};
    const s=newVipState();admitVip(db,s,0,MON,1,roll);admitVip(db,s,1,MON,0,roll);expect(rolls).toBe(0);
    admitVip(db,s,1,MON,1,roll);admitVip(db,s,1,MON,1,roll);admitVip(db,s,1,MON,1,roll);expect(rolls).toBe(2);
    const called=call();admitVip(db,called,1,MON,0,roll);expect(rolls).toBe(2);
  });
  it('natural and called VIP give identical menu and payouts with the same skill/seed',()=>{
    const a=configured(),b=configured(call(),MON,0);a.tick(1.3);b.tick(1.3);
    expect(a.customers[0]!.lines).toEqual(b.customers[0]!.lines);
    for(const sim of [a,b])for(const line of sim.customers[0]!.lines) {
      const f=sim.takeFromStock(db.ingredientById.get(line.ingredientId)!);
      if(f.ingredient.cookMethod==='prep'){sim.startPrep(f);sim.tick(3);}
      else {sim.place(f,0);f.sides.fill((f.ingredient.perfectWindow[0]+f.ingredient.perfectWindow[1])/2);}
      sim.serve(sim.customers[0]!,f);
    }
    expect(a.coins).toBeGreaterThan(0);expect(a.coins).toBe(b.coins);expect(a.xp).toBe(b.xp);
    expect(a.counters.vipServed).toBe(1);expect(b.counters.vipServed).toBe(1);
  });
  it('disabled daily cap suppresses natural and called VIP without destroying a previously earned reservation',()=>{
    const d=structuredClone(db);d.events!.defaults.vipMaxPerDay=0;const s=call();
    expect(admitVip(d,s,1,MON,1,()=>0)).toBeNull();expect(s.pendingCall).toBeTruthy();
    expect(beginVipCall(d,newVipState(),1,MON)).toBeNull();
  });
});

describe('VIP current-save and context safety',()=>{
  it('does not interpret a missing v4 ledger as an old install',()=>{
    const save=newSave('missing',MON);save.player.coins=999;delete (save.player as Partial<typeof save.player>).vip;
    const restored=deserializeSave(serializeSave(save));expect(restored.ok).toBe(true);
    if(!restored.ok)throw Error('load');
    expect(restored.save.player.vip.blocked).toBe(true);expect(restored.save.player.coins).toBe(999);
  });
  it('does not reserve for a nonexistent restaurant',()=>expect(beginVipCall(db,newVipState(),999,MON)).toBeNull());
});

it('A-05 keeps a reservation if a configured unusual-only VIP has no unlocked menu',()=>{
  const d=structuredClone(db);d.customerById.get('vip')!.unusualOnly=true;
  for(const i of d.ingredients.items)i.rarity='common';
  const state=call();
  const sim=new TurnSimulation(d,{playerLevel:1,restaurantIndex:1,levelId:'menu',seed:12,upgradeLevels:{},vip:{state,startUnixSec:MON},overrides:{vipChance:1}});
  expect(()=>sim.tick(1.3)).not.toThrow();expect(sim.counters.vipSpawned).toBe(0);
  expect(state.pendingCall).toBeTruthy();expect(state.usedToday).toBe(1);
  expect(sim.customers[0]!.lines.length).toBeGreaterThan(0);
});
