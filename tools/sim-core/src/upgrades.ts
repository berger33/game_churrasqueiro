import { upgradeCost } from './data.ts';
import type { GameDatabase } from './types.ts';

/** Integration registry, NOT player progress or a remotely editable entitlement. */
export const UPGRADE_PHASES: Readonly<Record<string, 'active' | 'resources' | 'staff' | 'offline'>> = Object.freeze({
  grill_size:'active', grill_heat:'active', grill_stability:'active', grill_speed:'active',
  charcoal_duration:'active', charcoal_quality:'active', charcoal_auto:'active',
  knife:'active', board:'active', counter:'active', plates:'active', tray:'active',
  patience_charm:'active', tables:'active', decor:'active', lighting:'active', capacity:'active',
  sign:'active', music:'active', garcom:'active', auxiliar:'active', churrasqueiro:'active',
  caixa:'active', gerente:'active', brasa_mastery:'active', clientela_fiel:'active', imperio_logistica:'active'
});
export interface UpgradeBuyer {
  coins: number; embers: number; level: number; restaurantIndex: number;
  upgradeLevels: Record<string, number>; counters: Record<string, number>;
}
export type UpgradeBlock = 'unknown' | 'invalid' | 'maxed' | 'restaurant_locked' | 'recipe_locked' | 'dependency_locked' | 'feature_pending' | 'funds';
export interface UpgradeQuote {
  id: string; recordedLevel: number; effectiveLevel: number; maxLevel: number; cost: number;
  currency: 'coins' | 'embers'; canBuy: boolean; reasons: UpgradeBlock[];
  requiredRestaurant?: number; phase: string; effectStat: string; effectDelta: number;
}
/** Normalize for USE only. Never rewrite or reimburse the saved historical levels. */
export function upgradeLevel(db: GameDatabase, levels: Record<string, number>, id: string): number {
  const n = levels[id] ?? 0, max = db.upgradeById.get(id)?.maxLevel ?? 0;
  return Number.isFinite(n) ? Math.max(0, Math.min(max, Math.floor(n))) : 0;
}
export function upgradePrice(db: GameDatabase, id: string, current: number): number {
  const t = db.upgradeById.get(id);
  if (!t || !Number.isSafeInteger(current) || current < 0 || current >= t.maxLevel) return Infinity;
  return upgradeCost(t.baseCost, t.growth, current + 1);
}
/** One read-only quote for UI, purchase service and simulation policy. */
export function quoteUpgrade(db: GameDatabase, p: UpgradeBuyer, id: string): UpgradeQuote {
  const t=db.upgradeById.get(id), n=p.upgradeLevels[id] ?? 0;
  const q:UpgradeQuote={id,recordedLevel:n,effectiveLevel:upgradeLevel(db,p.upgradeLevels,id),
    maxLevel:t?.maxLevel??0,cost:upgradePrice(db,id,n),currency:t?.currency??'coins',canBuy:false,reasons:[],
    phase:UPGRADE_PHASES[id]??'unknown',effectStat:t?.effect.stat??'',effectDelta:t?.effect.delta??0};
  if(!t){q.reasons.push('unknown');return q;}
  if(!Number.isSafeInteger(n)||n<0||!Number.isInteger(p.level)||p.level<1||!db.restaurantByIndex.has(p.restaurantIndex)) q.reasons.push('invalid');
  if(n>=t.maxLevel)q.reasons.push('maxed');
  const employee=db.employees?.roles.find(r=>r.unlock.upgradeTrack===id);
  const isEmployee=['garcom','auxiliar','churrasqueiro','caixa','gerente'].includes(id);
  if(isEmployee&&!employee)q.reasons.push('invalid'); // missing data must never bypass a gate
  const required=employee?.unlock.restaurantIndex ?? (id==='imperio_logistica'?3:undefined);
  q.requiredRestaurant=required;
  if(required!==undefined&&p.restaurantIndex<required)q.reasons.push('restaurant_locked');
  if(['knife','board','auxiliar'].includes(id)&&!db.ingredients.items.some(i=>i.cookMethod==='prep'&&i.unlock.level<=p.level&&i.unlock.restaurantIndex<=p.restaurantIndex))q.reasons.push('recipe_locked');
  if(id==='tray'&&upgradeLevel(db,p.upgradeLevels,'garcom')<1)q.reasons.push('dependency_locked');
  if(q.phase!=='active')q.reasons.push('feature_pending');
  const balance=t.currency==='coins'?p.coins:p.embers;
  if(!Number.isFinite(balance)||balance<0)q.reasons.push('invalid');
  else if(Number.isFinite(q.cost)&&balance<q.cost)q.reasons.push('funds');
  q.canBuy=q.reasons.length===0;
  return q;
}
