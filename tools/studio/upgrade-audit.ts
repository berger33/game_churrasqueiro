import { UPGRADE_PHASES } from '../sim-core/src/upgrades.ts';
/** A-06 diagnostic only. No tuning, purchases in the real save, or production rule changes. */
import { loadDatabase } from './load-data.ts';
import { TurnSimulation } from '../sim-core/src/turn.ts';
import { SkillPolicy } from '../sim-core/src/policy.ts';
import { Rng } from '../sim-core/src/rng.ts';
import { buyUpgrade, computeOfflineEarnings, newPlayerState } from '../sim-core/src/economy.ts';
import { upgradeCost } from '../sim-core/src/data.ts';
const db=loadDatabase();
// Historical cohort from A-05: these are NOT all still no-ops after A-06.1.
const noOps=['grill_stability','charcoal_quality','charcoal_auto','counter','tray','tables',
  'garcom','auxiliar','churrasqueiro','caixa','brasa_mastery','clientela_fiel','imperio_logistica'];
function run(levels:Record<string,number>,skill:number) {
  const s=new TurnSimulation(db,{playerLevel:44,restaurantIndex:4,levelId:'a06-control',seed:42,
    upgradeLevels:levels,churrasqueiraId:'fornalha_dragao_manso',churrasqueiraLevel:3,
    overrides:{vipChance:0}});
  const policy=new SkillPolicy(new Rng(901),{skill});
  while(!s.finished)s.tick(1/12,a=>policy.act(a));
  return s.result();
}
const controls=[.3,.85].map(skill=>({skill,result:run({},skill)}));
const unchanged=noOps.map(id=>({id,maxLevel:db.upgradeById.get(id)!.maxLevel,
  traces:controls.map(c=>({skill:c.skill,wholeResultIdentical:JSON.stringify(c.result)===JSON.stringify(run({[id]:db.upgradeById.get(id)!.maxLevel},c.skill))}))}));
function queue(level:number,authored:boolean) {
  const base=db.restaurantByIndex.get(1)!.service.maxOrdersOnScreen;
  const s=new TurnSimulation(db,{playerLevel:12,restaurantIndex:1,levelId:'capacity',seed:42,
    upgradeLevels:{capacity:level},overrides:{vipChance:0,spawnIntervalSec:.2,...(authored?{maxOrdersOnScreen:base}:{})}});
  for(let i=0;i<100;i++)s.tick(.1);
  return {level,authoredOverride:authored,derivedCap:s.stats.maxOrdersOnScreen,waiting:s.customers.filter(c=>c.state==='waiting').length};
}
const boughtAtStarter=db.upgrades.tracks.map(t=>{
  const p=newPlayerState();p.coins=100_000_000;
  const entry=buyUpgrade(db,p,t.id);
  return {id:t.id,accepted:!!entry,debited:100_000_000-p.coins};
});
const offline=[0,4].map(level=>{const p=newPlayerState();p.restaurantIndex=4;p.upgradeLevels.gerente=level;
  return {level,payout:computeOfflineEarnings(db,p,3600,1000000)};});
const tracks=db.upgrades.tracks.map(t=>({id:t.id,stat:t.effect.stat,delta:t.effect.delta,maxLevel:t.maxLevel,
  category:t.category,totalCostAtCurrentTable:Array.from({length:t.maxLevel},(_,i)=>upgradeCost(t.baseCost,t.growth,i+1)).reduce((a,b)=>a+b,0),
  phase:UPGRADE_PHASES[t.id], status:UPGRADE_PHASES[t.id]==='active'?(['caixa','gerente','imperio_logistica'].includes(t.id)?'integrated absence ledger consumer':'integrated turn consumer'):t.id==='gerente'?'reference offline only; purchase blocked pending integration':'no integrated consumer; purchase blocked'}));
console.log(JSON.stringify({base:'e50ce15 + local A-03/A-04/A-05/A-06.4',method:'Static consumer inspection plus paired complete-turn traces at skill .3/.85, VIP disabled only in the controlled probe. Equal traces alone are not proof of absence of a consumer.',tracks,unchanged,capacity:[queue(0,true),queue(2,true),queue(2,false)],boughtAtStarter,offline,
  baselineNoOpCohortMaxSpend:tracks.filter(t=>noOps.includes(t.id)).reduce((a,t)=>a+t.totalCostAtCurrentTable,0)},null,2));
