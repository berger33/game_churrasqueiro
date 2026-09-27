import type { GameDatabase } from './types.ts';

/** Narrow consumers only: this is not the full LiveOps, ads or achievement service. */
export interface VipEventsTable {
  version: number;
  defaults: { vipBaseChance: number; vipMaxPerDay: number };
  weeklyRecurring: { id: string; dayOfWeek: string; durationHours: number;
    modifiers: { type: string; valueAdd?: number }[] }[];
}
export interface VipAdsTable {
  version: number;
  rewardedPlacements: { id: string; cooldownMin: number; maxPerDay: number }[];
  antiFraud: { tokenTtlSec: number };
}
export interface VipAchievementsTable {
  version: number;
  achievements: { id: string; stat: string; goal: number; reward: { coins?: number; embers?: number } }[];
}
export interface VipState {
  day: number;
  /** Arrivals + one reserved call. A reservation carried overnight occupies the new day's quota too. */
  usedToday: number;
  callsToday: number;
  lastCallUnixSec: number;
  lastClockUnixSec: number;
  sequence: number;
  pendingCall: string | null;
  offer: { token: string; expiresUnixSec: number } | null;
  servedTotal: number;
  claimedAchievements: string[];
  blocked: boolean;
}
export function newVipState(): VipState {
  return { day:-1, usedToday:0, callsToday:0, lastCallUnixSec:-1, lastClockUnixSec:0,
    sequence:0, pendingCall:null, offer:null, servedTotal:0, claimedAchievements:[], blocked:false };
}
/** Missing pre-v4 ledger migrates cleanly; malformed current ledgers fail closed without touching the wallet. */
export function restoreVipState(raw: unknown): VipState {
  if (raw === undefined) return newVipState();
  const s = raw as VipState | null;
  const integer = (n: unknown, min=0) => typeof n==='number' && Number.isSafeInteger(n) && n>=min;
  if (!s || !integer(s.day,-1) || !integer(s.usedToday) || !integer(s.callsToday)
    || !Number.isFinite(s.lastCallUnixSec) || s.lastCallUnixSec < -1 || !Number.isFinite(s.lastClockUnixSec)
    || s.lastClockUnixSec < 0 || !integer(s.sequence) || !integer(s.servedTotal)
    || typeof s.blocked !== 'boolean' || !(s.pendingCall===null || typeof s.pendingCall==='string' && !!s.pendingCall)
    || !(s.offer===null || s.offer && typeof s.offer.token==='string' && !!s.offer.token && Number.isFinite(s.offer.expiresUnixSec))
    || s.callsToday > s.usedToday || (s.pendingCall !== null && (s.usedToday < 1 || s.lastCallUnixSec < 0 || s.offer !== null))
    || s.lastCallUnixSec > s.lastClockUnixSec || (s.day >= 0 && s.day !== Math.floor(s.lastClockUnixSec/86400))
    || !Array.isArray(s.claimedAchievements) || !s.claimedAchievements.every(id=>typeof id==='string')) {
    return { ...newVipState(), blocked:true };
  }
  return structuredClone(s);
}
/** Injected time only. Backwards clock changes cannot reset quota/cooldown or resurrect a spent offer. */
export function refreshVipDay(s: VipState, unixSec: number): number {
  if (!Number.isFinite(unixSec) || unixSec < 0) throw new Error('VIP: invalid clock');
  const now = Math.max(unixSec, s.lastClockUnixSec);
  s.lastClockUnixSec = now;
  const day = Math.floor(now / 86400);
  if (day > s.day) {
    s.day = day;
    s.usedToday = s.pendingCall ? 1 : 0;
    s.callsToday = 0;
  }
  if (s.offer && now >= s.offer.expiresUnixSec) s.offer = null;
  return now;
}
export function vipChance(db: GameDatabase, explicit: number | undefined, unixSec: number): number {
  const base = explicit ?? db.events?.defaults.vipBaseChance ?? 0;
  if (!Number.isFinite(base) || base < 0 || base > 1) throw new Error('VIP: chance must be in [0,1]');
  if (base === 0) return 0;
  const weekdays = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
  const weekSec = new Date(unixSec * 1000).getUTCDay() * 86400 + unixSec % 86400;
  let add = 0;
  for (const e of db.events?.weeklyRecurring ?? []) {
    const elapsed = (weekSec - weekdays.indexOf(e.dayOfWeek) * 86400 + 604800) % 604800;
    if (elapsed < e.durationHours * 3600) {
      for (const m of e.modifiers) if (m.type === 'vipChance') add += m.valueAdd ?? 0;
    }
  }
  return Math.max(0, Math.min(1, base + add));
}
export function vipEligible(db: GameDatabase, restaurantIndex: number): boolean {
  const vip = db.customerById.get('vip');
  return db.restaurantByIndex.has(restaurantIndex) && !!vip?.isVip && restaurantIndex >= vip.minRestaurant && (db.events?.defaults.vipMaxPerDay ?? 0) > 0;
}
export function vipCallStatus(db: GameDatabase, s: VipState, restaurantIndex: number, unixSec: number): string {
  const now = refreshVipDay(s, unixSec);
  const cfg = db.ads?.rewardedPlacements.find(p=>p.id==='call_vip');
  if (s.blocked || !cfg) return 'unavailable';
  if (!vipEligible(db, restaurantIndex)) return 'locked';
  if (s.pendingCall) return 'reserved';
  if (s.usedToday >= db.events!.defaults.vipMaxPerDay || s.callsToday >= cfg.maxPerDay) return 'limit';
  if (s.lastCallUnixSec >= 0 && now - s.lastCallUnixSec < cfg.cooldownMin * 60) return 'cooldown';
  return 'ready';
}
export function beginVipCall(db: GameDatabase, s: VipState, restaurantIndex: number, unixSec: number): string | null {
  if (vipCallStatus(db,s,restaurantIndex,unixSec)!=='ready' || s.offer) return null;
  const token = `vip-test-${++s.sequence}`;
  s.offer = { token, expiresUnixSec:s.lastClockUnixSec + db.ads!.antiFraud.tokenTtlSec };
  return token;
}
/** Callback must match the sole live offer. Cancel/fail never grants; tokens are consumed once, including rejected callbacks. */
export function finishVipCall(db: GameDatabase, s: VipState, restaurantIndex: number, unixSec: number, token: string, completed: boolean): boolean {
  const status = vipCallStatus(db,s,restaurantIndex,unixSec);
  if (!s.offer || s.offer.token !== token) return false;
  s.offer = null;
  if (!completed || status !== 'ready') return false;
  s.pendingCall = token;
  s.usedToday++;
  s.callsToday++;
  s.lastCallUnixSec = s.lastClockUnixSec;
  return true;
}
/** Called only at a real free arrival slot, never on a blocked cadence. */
export function admitVip(db: GameDatabase, s: VipState, restaurantIndex: number, unixSec: number, chance: number, roll: ()=>number): 'natural' | 'called' | null {
  if(!Number.isFinite(chance)||chance<0||chance>1)throw new Error('VIP: chance must be in [0,1]');
  refreshVipDay(s,unixSec);
  if (s.blocked || !vipEligible(db,restaurantIndex)) return null;
  if (s.pendingCall) { s.pendingCall=null; return 'called'; }
  if (s.usedToday >= db.events!.defaults.vipMaxPerDay || chance <= 0) return null;
  if (roll() >= chance) return null;
  s.usedToday++;
  return 'natural';
}
/** Credit once with the completed turn, like its wallet payout. Only the two vipServed achievements are in A-05 scope. */
export function applyVipProgress(db: GameDatabase, s: VipState, served: number): { coins:number; embers:number; unlocked:string[] } {
  if(!Number.isSafeInteger(served)||served<0)throw new Error('VIP: invalid served count');
  s.servedTotal += served;
  let coins=0, embers=0;
  const unlocked: string[]=[];
  for (const a of db.achievements?.achievements ?? []) {
    if (a.stat!=='vipServed' || s.servedTotal<a.goal || s.claimedAchievements.includes(a.id)) continue;
    s.claimedAchievements.push(a.id); unlocked.push(a.id);
    coins+=a.reward.coins??0; embers+=a.reward.embers??0;
  }
  return { coins, embers, unlocked };
}
