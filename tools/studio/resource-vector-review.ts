/** Review only: unlimited-stock counterfactual, never used by shipped gameplay. */
import { readFileSync } from 'node:fs';
import { loadDatabase } from './load-data.ts';
import { TurnSimulation } from '../sim-core/src/turn.ts';
import { SkillPolicy } from '../sim-core/src/policy.ts';
import { Rng } from '../sim-core/src/rng.ts';
const db=loadDatabase();
const review=JSON.parse(readFileSync('docs/evidence/a06/step2/vector-review.json','utf8'));
const vectors=JSON.parse(readFileSync('tools/golden/vectors.json','utf8'));
const result=review.sections.turns.changed.map((change:any)=>{
  const {input}=vectors.turns.find((v:any)=>v.id===change.id),s=new TurnSimulation(db,{...input,upgradeLevels:input.upgradeLevels??{}});
  s.stockRemaining=()=>1_000_000; // counterfactual only: suppress scarcity/replenishment demand
  const policy=new SkillPolicy(new Rng(input.seed+input.levelIndex*104729),{skill:input.skill});
  while(!s.finished)s.tick(input.stepSec,a=>policy.act(a));
  const r=s.result(),counterfactual={coins:r.coins,xp:r.xp,stars:r.stars,failed:r.failed,finalTimeSec:Math.round(s.time*1e9)/1e9,counters:r.counters};
  const restoresOldExpected=JSON.stringify(counterfactual)===JSON.stringify(change.before);
  if(!restoresOldExpected)throw new Error(`${change.id}: unexplained drift remains without stock scarcity`);
  return {id:change.id,restoresOldExpected,counterfactual};
});
console.log(JSON.stringify({method:'Replay the seven changed legacy turn vectors with only stockRemaining overridden to unlimited. No production edits, prices or target changes. All old expected results restored; this isolates finite-stock admission/replenishment and the resulting policy scheduling.',result},null,2));
