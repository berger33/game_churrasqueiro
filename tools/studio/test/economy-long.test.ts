/** A short run must not silently skip the three late-game acceptance failures. */
import {it,expect} from 'vitest';
import {simulateProgression,checkTargets,measureSkillCurve} from '../run-sim.ts';
it('meets every original target over1500 active turns with no rewarded/offline injection',()=>{
 const r=simulateProgression({maxTurns:1500,stepSec:1/12});
 const checks=checkTargets(r,4,{skillCurve:measureSkillCurve()});
 expect(checks).toHaveLength(18);
 expect(checks.filter(c=>!c.pass)).toEqual([]);
 expect(r.player.counters.offlineCoins??0).toBe(0);
 expect(r.player.offline.batch).toBeNull();
 expect(r.totalCoinsEarned-r.totalCoinsSpent).toBe(r.player.coins);
},120_000);
