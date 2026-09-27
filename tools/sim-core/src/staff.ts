import {effectiveHeat, publicFlipReady, scoreItem, rewardTuning, type FoodRuntime, type ScoredItem} from './cooking.ts';
import {upgradeLevel} from './upgrades.ts';
import {Rng} from './rng.ts';
import type {GameDatabase} from './types.ts';
import type {TurnSimulation, CustomerRuntime} from './turn.ts';
export type ActiveRole='garcom'|'auxiliar'|'churrasqueiro';
export function staffAbility(db:GameDatabase,levels:Record<string,number>,restaurant:number,id:ActiveRole){
  const role=db.employees?.roles.find(r=>r.id===id);
  if(!role||restaurant<role.unlock.restaurantIndex)return undefined;
  return role.abilities.find(a=>a.level===upgradeLevel(db,levels,role.unlock.upgradeTrack));
}

/** Per-turn budgets; raw/failed attempts and repeated frames never create credit. */
export class StaffRuntime {
  private readonly serveSeen=new Set<number>();
  private readonly flipSeen=new Map<number,number>();
  private readonly warned=new Set<number>();
  private readonly rng:Rng;
  private serveUsed=0; private flipUsed=0; private prepUsed=0; private prepAttempts=0;
  private nextServe=0; private nextFlip=0; private nextPrep=0;
  private risks:number[]=[];
  private readonly waiter; private readonly helper; private readonly cook;
  private readonly s:TurnSimulation;
  private readonly serveAuto:(c:CustomerRuntime,f:FoodRuntime,tipBonus:number)=>ScoredItem|null;
  constructor(s:TurnSimulation,seed:number,
    serveAuto:(c:CustomerRuntime,f:FoodRuntime,tipBonus:number)=>ScoredItem|null){
    this.s=s;this.serveAuto=serveAuto;
    this.rng=new Rng(seed^0xa063);
    const enabled=s.config.staffEnabled!==false;
    this.waiter=enabled?staffAbility(s.db,s.config.upgradeLevels,s.restaurant.index,'garcom'):undefined;
    this.helper=enabled&&s.availableIngredients.some(i=>i.cookMethod==='prep')?staffAbility(s.db,s.config.upgradeLevels,s.restaurant.index,'auxiliar'):undefined;
    this.cook=enabled?staffAbility(s.db,s.config.upgradeLevels,s.restaurant.index,'churrasqueiro'):undefined;
    this.nextFlip=this.cook?.intervalSec??Infinity;this.nextPrep=this.helper?.intervalSec??Infinity;
  }
  private get serveCoverage(){return Math.min(this.waiter?.coverage??0,this.s.db.employees?.automationCap.autoServeMaxCoverage??0);}
  private get flipCoverage(){return Math.min(this.cook?.coverage??0,this.s.db.employees?.automationCap.autoFlipMaxCoverage??0);}
  private get tripInterval(){return (this.waiter?.intervalSec??1.5)/this.s.stats.serveSpeedMult;}
  get snapshot(){return {serve:{level:this.waiter?.level??0,eligible:this.serveSeen.size,used:this.serveUsed,
      limit:Math.floor(this.serveCoverage*this.serveSeen.size),coverage:this.serveCoverage,interval:this.tripInterval,nextAt:this.nextServe},
    flip:{level:this.cook?.level??0,eligible:this.flipSeen.size,used:this.flipUsed,limit:Math.floor(this.flipCoverage*this.flipSeen.size),coverage:this.flipCoverage,nextAt:Number.isFinite(this.nextFlip)?this.nextFlip:null},
    prep:{level:this.helper?.level??0,used:this.prepUsed,attempts:this.prepAttempts,nextAt:Number.isFinite(this.nextPrep)?this.nextPrep:null},riskFoodIds:[...this.risks]};}
  private matches(c:CustomerRuntime,f:FoodRuntime):boolean {
    if(c.state!=='waiting'||this.s.time-c.arrivedAt<=(this.s.db.employees?.service.minimumWaitSec??1.5))return false;
    if(f.served||f.burned)return false;
    const line=c.lines.find(l=>l.ingredientId===f.ingredient.id&&!l.fulfilledBy.length);if(!line)return false;
    if(f.ingredient.cookMethod==='prep')return this.s.prepSlots.includes(f)&&f.prepProgress>=1;
    if(!f.onGrill)return false;
    const q=scoreItem(this.s.db,f,{restaurantIndex:this.s.restaurant.index,target:line.target,toleranceScale:c.def.toleranceScale,patienceRemaining:0,combo:0,
      tipMult:1,xpMult:1,tuning:rewardTuning(this.s.db.economy)}).quality;
    return q==='good'||q==='perfect';
  }
  /** Called before manual removal/flip as well as each tick, so manual play remains in the denominator. */
  observe():void {
    if(!this.waiter&&!this.cook)return;
    for(const f of this.s.foods){
      if(this.cook&&f.flips===0&&publicFlipReady(this.s.db,f)&&!this.flipSeen.has(f.uid))this.flipSeen.set(f.uid,this.s.time);
      if(this.waiter&&!this.serveSeen.has(f.uid)&&this.s.customers.some(c=>this.matches(c,f)))this.serveSeen.add(f.uid);
    }
  }
  tick():void {
    if(this.s.finished)return;
    this.observe();const now=this.s.time;
    if(this.helper&&now+1e-9>=this.nextPrep){
      this.nextPrep=now+this.helper.intervalSec!; // one opportunity, never catch up missed cycles
      const prepared=new Map<string,number>();
      for(const f of this.s.prepSlots)if(f&&!f.served)prepared.set(f.ingredient.id,(prepared.get(f.ingredient.id)??0)+1);
      const demand=this.s.customers.filter(c=>c.state==='waiting').sort((a,b)=>a.uid-b.uid).flatMap(c=>c.lines.filter(l=>!l.fulfilledBy.length));
      for(const line of demand){
        const id=line.ingredientId,ing=this.s.availableIngredients.find(i=>i.id===id&&i.cookMethod==='prep');
        if(!ing)continue;
        const covered=prepared.get(id)??0;
        if(covered>0){prepared.set(id,covered-1);continue;}
        if(this.s.prepSlotsFree<=0||this.s.stockRemaining(id)<=0)continue;
        this.prepAttempts++;
        if(this.rng.next()<this.helper.coverage){
          const f=this.s.takeFromStock(ing);
          if(this.s.startPrep(f)){this.prepUsed++;this.action('auxiliar',f);}else this.s.discard(f);
        }
        break;
      }
    }
    if(this.cook&&now+1e-9>=this.nextFlip){
      this.nextFlip=now+this.cook.intervalSec!;
      if(this.flipUsed<Math.floor(this.flipCoverage*this.flipSeen.size)){
        const f=this.s.foods.filter(f=>this.flipSeen.has(f.uid)&&f.flips===0&&publicFlipReady(this.s.db,f))
          .sort((a,b)=>this.flipSeen.get(a.uid)!-this.flipSeen.get(b.uid)!||a.uid-b.uid)[0];
        if(f&&this.s.flip(f)){this.flipUsed++;this.action('churrasqueiro',f);}
      }
    }
    if(this.waiter&&now+1e-9>=this.nextServe){
      let served=0;
      for(const c of this.s.customers.filter(c=>c.state==='waiting').sort((a,b)=>a.uid-b.uid)){
        for(const f of [...this.s.foods].sort((a,b)=>a.uid-b.uid)){
          if(served>=(this.waiter.platesPerTrip??1)||this.serveUsed>=Math.floor(this.serveCoverage*this.serveSeen.size))break;
          if(!this.serveSeen.has(f.uid)||!this.matches(c,f))continue;
          if(this.serveAuto(c,f,this.waiter.tipBonus??0)){this.serveUsed++;served++;this.action('garcom',f,c);}
        }
      }
      if(served)this.nextServe=now+this.tripInterval;
    }
    this.risks=[];
    if(this.waiter?.burnWarningSec)for(const f of this.s.foods){
      if(!f.onGrill||f.burned||f.served)continue;
      const heat=effectiveHeat(this.s.grill,f.zoneIndex,this.s.db);
      const rate=heat*f.ingredient.heatRate*this.s.stats.heatRampRate/f.ingredient.sideCookSec;
      if(rate<=0)continue;
      const left=Math.min(...f.sides.map((side,i)=>(this.s.db.ingredients.shared.burnedThreshold-side)/(rate*(i===f.downSide?1:this.s.db.ingredients.shared.carryoverRate))));
      if(left>=0&&left<=this.waiter.burnWarningSec){
        this.risks.push(f.uid);
        if(!this.warned.has(f.uid)){this.warned.add(f.uid);this.s.events.push({type:'staff_burn_risk',foodUid:f.uid});}
      }
    }
  }
  private action(role:ActiveRole,f:FoodRuntime,c?:CustomerRuntime){this.s.events.push({type:'staff_action',role,foodUid:f.uid,customerUid:c?.uid});}
}
