/** A-05 reproducible, no-rewarded control vs optional call. No balancing overrides. */
import { simulateProgression } from './run-sim.ts';
import { loadDatabase } from './load-data.ts';
import { newPlayerState, applyTurnResult } from '../sim-core/src/economy.ts';
import { beginVipCall, finishVipCall } from '../sim-core/src/vip.ts';
import { TurnSimulation } from '../sim-core/src/turn.ts';
import { SkillPolicy } from '../sim-core/src/policy.ts';
import { Rng } from '../sim-core/src/rng.ts';
const db=loadDatabase(),epoch=Date.UTC(2026,8,21)/1000;
const campaign=[];
for(const mode of ['disabled','natural','called'] as const) {
  const r=simulateProgression({maxTurns:1500,stepSec:1/12,disableNaturalVip:mode==='disabled',vipCalls:mode==='called'});
  const daily=new Map<number,number>();
  for(const t of r.outcomes)daily.set(t.vipSnapshot.day,(daily.get(t.vipSnapshot.day)??0)+t.vipSnapshot.arrived);
  campaign.push({mode,turns:r.outcomes.length,income:r.totalCoinsEarned,spent:r.totalCoinsSpent,balance:r.player.coins,
    spend:r.totalCoinsSpent/r.totalCoinsEarned,level:r.player.level,restaurant:r.player.restaurantIndex,
    unlocks:r.turnsToUnlock,grills:r.turnsToUnlockGrill,dailyIncome:r.dailyCoinIncomeAtLevel,
    perfect:r.perfectRate,burned:r.burnedRate,lost:r.lostRate,duration:r.avgTurnDurationSec,
    vipArrived:r.outcomes.reduce((n,t)=>n+t.vipSnapshot.arrived,0),vipServed:r.player.vip.servedTotal,
    called:r.outcomes.reduce((n,t)=>n+t.vipSnapshot.called,0),offers:r.player.vip.sequence,
    vipPlateCoins:r.outcomes.reduce((n,t)=>n+t.vipSnapshot.plateCoins,0),maxVipArrivalsPerDay:Math.max(...daily.values()),
    achievements:r.player.vip.claimedAchievements,achievementCoins:r.session.faucets.vip_achievement??0,
    finalVipLedger:r.player.vip});
}
// The ordinary first-40-level skill curve has no eligible VIP chance. Complement it
// with fixed unlocked restaurant1/level12/equipment, 3 seeds, 2 days x 12 turns.
const probe=[];
for(const skill of [.3,.55,.85,1])for(const mode of ['disabled','natural','called'] as const) {
  let coins=0,perfect=0,items=0,burned=0,lost=0,spawned=0,vip=0,servedVip=0;
  for(const seed of [7,25,4242]) {
    const p=newPlayerState();p.level=12;p.restaurantIndex=1;
    for(let turn=0;turn<24;turn++) {
      const start=epoch+turn*7200;
      if(mode==='called'){const token=beginVipCall(db,p.vip,1,start);if(token)finishVipCall(db,p.vip,1,start,token,true);}
      const sim=new TurnSimulation(db,{restaurantIndex:1,playerLevel:12,levelId:'vip-probe',upgradeLevels:{},seed:seed+turn,
        churrasqueiraId:'parrilla_chef_cisma',churrasqueiraLevel:3,
        vip:{state:p.vip,startUnixSec:start},overrides:{vipChance:mode==='disabled'?0:.12}});
      const policy=new SkillPolicy(new Rng(seed+turn*7919),{skill});
      while(!sim.finished)sim.tick(1/12,a=>policy.act(a));
      const result=sim.result(),paid=applyTurnResult(db,p,result);
      coins+=paid.ledger.filter(e=>e.currency==='coins'&&(e.source==='turn'||e.source==='vip_achievement')).reduce((n,e)=>n+e.amount,0);
      perfect+=result.counters.perfectCooks;items+=result.counters.itemsCooked;burned+=result.counters.burnedFood;
      lost+=result.counters.customersLost;spawned+=result.counters.customersSpawned;
      vip+=result.counters.vipSpawned;servedVip+=result.counters.vipServed;
    }
  }
  probe.push({skill,mode,turns:72,coinsPerTurn:coins/72,perfectPerServed:perfect/items,burned,lost,spawned,vipArrived:vip,vipServed:servedVip});
}
console.log(JSON.stringify({clock:'UTC, epoch 2026-09-21, 12 turns/day, step 1/12; no wall clock',
  note:'Called is an optional test callback, not a real ad. Total arrivals/day remains <=2. Probe has fixed level12/catalog/equipment, no purchases; coins include only turn and VIP achievement payouts.',campaign,probe},null,2));
