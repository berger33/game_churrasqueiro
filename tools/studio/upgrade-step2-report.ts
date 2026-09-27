/** A-06.2 economics, reproducible against the recorded A-06.1 natural/no-rewarded baseline. */
import { readFileSync } from 'node:fs';
import { loadDatabase } from './load-data.ts';
import { simulateProgression } from './run-sim.ts';
import { UPGRADE_PHASES, quoteUpgrade } from '../sim-core/src/upgrades.ts';
import { upgradeCost } from '../sim-core/src/data.ts';
import { newPlayerState } from '../sim-core/src/economy.ts';
const db=loadDatabase();
const baseline=JSON.parse(readFileSync(new URL('../../docs/evidence/a06/step1/economy-comparison.json',import.meta.url),'utf8')).after;
const r=simulateProgression({maxTurns:1500,stepSec:1/12});
const starter=newPlayerState();starter.coins=100_000_000;
const tracks=db.upgrades.tracks.map(t=>{
  const q=quoteUpgrade(db,starter,t.id),level=r.player.upgradeLevels[t.id]??0;
  const sum=(n:number)=>Array.from({length:n},(_,i)=>upgradeCost(t.baseCost,t.growth,i+1)).reduce((a,b)=>a+b,0);
  const spent=r.session.sinks[`upgrade:${t.id}`]??0;
  if(sum(level)!==spent)throw new Error(`purchase ledger/cost mismatch: ${t.id}`);
  if(UPGRADE_PHASES[t.id]!=='active'&&spent!==0)throw new Error(`pending sink: ${t.id}`);
  return {id:t.id,phase:UPGRADE_PHASES[t.id],starterCanBuy:q.canBuy,starterReasons:q.reasons,
    maxLevel:t.maxLevel,maxCost:sum(t.maxLevel),purchasedLevel:level,spent};
});
const after={income:r.totalCoinsEarned,spent:r.totalCoinsSpent,balance:r.player.coins,
  spend:r.session.spendRatio(),level:r.player.level,restaurant:r.player.restaurantIndex,
  unlocks:r.turnsToUnlock,grills:r.turnsToUnlockGrill,dailyIncome:r.dailyCoinIncomeAtLevel,
  perfect:r.perfectRate,burned:r.burnedRate,lost:r.lostRate,duration:r.avgTurnDurationSec,
  faucets:r.session.faucets,sinks:r.session.sinks,vipArrived:r.outcomes.reduce((n,t)=>n+t.vipSnapshot.arrived,0),vipServed:r.player.vip.servedTotal};
const sum=(items:typeof tracks)=>items.reduce((n,t)=>n+t.maxCost,0);
console.log(JSON.stringify({checkpoint:'A-06.2, not completed A-06',seed:20260917,turns:1500,stepSec:1/12,
  clock:'UTC 2026-09-21, 12 turns/day; natural VIP only; no rewarded calls; no offline income',
  note:'No price/reward/target tuning. Blocked capacity is not a refund. Active campaign only; offline awaits A-06.4.',
  baseline,after,delta:{income:after.income-baseline.income,spent:after.spent-baseline.spent,balance:after.balance-baseline.balance},
  trackCapacity:{all:sum(tracks),integrated:sum(tracks.filter(t=>t.phase==='active')),temporarilyBlocked:sum(tracks.filter(t=>t.phase!=='active'))},tracks},null,2));
