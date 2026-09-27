import type { GameDatabase, RawDataBundle } from './types.ts';

/**
 * Builds an indexed, cross-validated database from the raw JSON tables.
 *
 * The same function is used by:
 *  - the Node studio tools (`tools/studio/*`)
 *  - the design-verification prototype (`prototype/`)
 * and is mirrored by `DataDatabase.FromJson()` in the Unity client.
 */
export function createDatabase(raw: RawDataBundle): GameDatabase {
  const db: GameDatabase = {
    events: raw.events, ads: raw.ads, achievements: raw.achievements,
    employees: raw.employees,
    ingredients: raw.ingredients,
    grill: raw.grill,
    customers: raw.customers,
    restaurants: raw.restaurants,
    upgrades: raw.upgrades,
    economy: raw.economy,
    churrasqueiras: raw.churrasqueiras,
    ingredientById: new Map(),
    customerById: new Map(),
    restaurantByIndex: new Map(),
    upgradeById: new Map(),
    churrasqueiraById: new Map()
  };

  for (const it of raw.ingredients.items) db.ingredientById.set(it.id, it);
  for (const c of raw.customers.customers) db.customerById.set(c.id, c);
  for (const r of raw.restaurants.restaurants) db.restaurantByIndex.set(r.index, r);
  for (const u of raw.upgrades.tracks) db.upgradeById.set(u.id, u);
  if (raw.churrasqueiras) {
    for (const ch of raw.churrasqueiras.churrasqueiras) db.churrasqueiraById.set(ch.id, ch);
  }

  return db;
}

/** Structural + referential validation. Returns a list of human-readable problems. */
export function validateDatabase(db: GameDatabase): string[] {
  const problems: string[] = [];
  const income=db.economy.reward.activeCoinMultiplierByRestaurant;
  if(!Array.isArray(income)||income.length!==db.restaurantByIndex.size||income.some((n,i)=>
    !Number.isFinite(n)||n<=0||n>1||(i<=3&&n!==1)||(i>0&&n>income[i-1]!)))problems.push('active income: invalid restaurant curve or changed early income');

  const idle=db.economy.idle;
  if(idle.unlockRestaurantIndex!==3||idle.maxOfflineHours!==8||idle.rampInMinutes!==20||idle.minCollectIntervalMin!==30)problems.push('offline: approved unlock/cap/ramp/cooldown contract');
  for(const rates of [idle.coinsPerMinuteByRestaurant,idle.xpPerMinuteByRestaurant])
    if(rates.length!==db.restaurantByIndex.size||rates.some(n=>!Number.isFinite(n)||n<0))problems.push('offline: invalid restaurant rates');
  const cashier=db.employees?.roles.find(r=>r.id==='caixa');
  if(!cashier||cashier.abilities.length!==4)problems.push('offline: missing cashier levels');
  else for(let level=1;level<=4;level++){
    const a=cashier.abilities.find(a=>a.level===level);
    if(a?.autoOfflineHours!==level*2||a?.offlineRateBonus!==[0,0,0,.03,.06][level])problems.push('offline: invalid cashier hours/bonus');
  }

  if(db.employees){
    const e=db.employees;
    if(e.automationCap.autoServeMaxCoverage!==.5||e.automationCap.autoFlipMaxCoverage!==.6)problems.push('employees: hard coverage caps');
    if(!Number.isFinite(e.service?.minimumWaitSec)||e.service.minimumWaitSec<0)problems.push('employees: invalid minimum wait');
    for(const role of e.roles.filter(r=>['garcom','auxiliar','churrasqueiro'].includes(r.id)))for(const a of role.abilities){
      if(!Number.isFinite(a.intervalSec)||a.intervalSec!<=0)problems.push(`employees: invalid interval ${role.id}`);
      const cap=role.id==='garcom'?.5:role.id==='churrasqueiro'?.6:1;
      if(!Number.isFinite(a.coverage)||a.coverage<0||a.coverage>cap)problems.push(`employees: invalid coverage ${role.id}`);
      if(role.id==='garcom'&&(!Number.isFinite(a.tipBonus)||a.tipBonus!<0||a.tipBonus!>.1||![1,2].includes(a.platesPerTrip!)))problems.push('employees: invalid service parameters');
      if(role.id==='auxiliar'&&(!Number.isInteger(a.extraPrepSlots)||a.extraPrepSlots!<0||a.extraPrepSlots!>1))problems.push('employees: invalid extra slots');
    }
  }

  const ids = new Set<string>();
  if (!Number.isSafeInteger(db.grill.stock.basePerIngredient) || db.grill.stock.basePerIngredient < 1) problems.push('stock: invalid capacity');
  if (!Number.isFinite(db.grill.stock.refillTimeSec) || db.grill.stock.refillTimeSec <= 0) problems.push('stock: invalid refill time');
  if (!Number.isFinite(db.grill.charcoal.refillTimeSec) || db.grill.charcoal.refillTimeSec <= 0) problems.push('charcoal: invalid refill time');

  if (db.events) {
    const {vipBaseChance:chance,vipMaxPerDay:cap}=db.events.defaults;
    if(!Number.isFinite(chance)||chance<0||chance>1)problems.push('VIP: invalid base chance');
    if(!Number.isInteger(cap)||cap<0)problems.push('VIP: invalid daily cap');
    if(!db.customerById.get('vip')?.isVip)problems.push('VIP: missing VIP customer');
    for(const e of db.events.weeklyRecurring) {
      if(!['sunday','monday','tuesday','wednesday','thursday','friday','saturday'].includes(e.dayOfWeek))problems.push('VIP: invalid event weekday');
      if(!Number.isFinite(e.durationHours)||e.durationHours<=0||e.durationHours>168)problems.push('VIP: invalid event duration');
      for(const m of e.modifiers)if(m.type==='vipChance'&&!Number.isFinite(m.valueAdd))problems.push('VIP: invalid event chance modifier');
    }
  }
  if(db.ads) {
    const cfg=db.ads.rewardedPlacements.find(p=>p.id==='call_vip');
    if(!cfg||!Number.isFinite(cfg.cooldownMin)||cfg.cooldownMin<0||!Number.isInteger(cfg.maxPerDay)||cfg.maxPerDay<0)problems.push('VIP: invalid call placement');
    if(!Number.isFinite(db.ads.antiFraud.tokenTtlSec)||db.ads.antiFraud.tokenTtlSec<=0)problems.push('VIP: invalid offer TTL');
  }

  for(const a of db.achievements?.achievements ?? [])if(a.stat==='vipServed') {
    if(!Number.isSafeInteger(a.goal)||a.goal<1)problems.push('VIP: invalid achievement goal');
    for(const value of [a.reward.coins??0,a.reward.embers??0])if(!Number.isSafeInteger(value)||value<0)problems.push('VIP: invalid achievement reward');
  }

  const zoneIds = new Set<string>();
  const primary = db.grill.zones.filter(z => !z.auxiliaryOf);
  if (primary.map(z => z.id).join(',') !== 'low,medium,high') {
    problems.push('grill zones: primary profile must remain low,medium,high; extra zones require auxiliaryOf');
  }
  for (const [index, zone] of db.grill.zones.entries()) {
    if (zoneIds.has(zone.id)) problems.push(`grill zone: duplicate id "${zone.id}"`);
    zoneIds.add(zone.id);
    if (zone.index !== index) problems.push(`grill zone ${zone.id}: index must be ${index}`);
    if (!Number.isFinite(zone.heatMultiplier) || zone.heatMultiplier <= 0) problems.push(`grill zone ${zone.id}: heat must be positive and finite`);
    if (zone.auxiliaryOf) {
      const source = primary.find(z => z.id === zone.auxiliaryOf);
      if (!source || source.index >= index) problems.push(`grill zone ${zone.id}: invalid auxiliary source`);
      if (source && source.heatMultiplier !== zone.heatMultiplier) problems.push(`grill zone ${zone.id}: auxiliary heat must match its source`);
      if (index < primary.length) problems.push(`grill zone ${zone.id}: auxiliary zones must follow the primary profile`);
    }
  }
  if (!primary.length) problems.push('grill zones: primary profile cannot be empty');
  for (const r of db.restaurants.restaurants) {
    if (!Number.isInteger(r.grill.zoneCount) || r.grill.zoneCount < 1 || r.grill.zoneCount > db.grill.zones.length) {
      problems.push(`restaurant ${r.id}: unsupported zoneCount ${r.grill.zoneCount}`);
    }
  }

  for (const it of db.ingredients.items) {
    if (ids.has(it.id)) problems.push(`ingredient: duplicate id "${it.id}"`);
    ids.add(it.id);
    if (it.sides < 1) problems.push(`ingredient ${it.id}: sides must be >= 1`);
    if (it.cookMethod === 'grill' && it.sideCookSec <= 0) {
      problems.push(`ingredient ${it.id}: grilled items need sideCookSec > 0`);
    }
    if (it.cookMethod === 'grill' && it.sides > 1 && !it.flipNeeded) {
      problems.push(`ingredient ${it.id}: multi-side grilling requires flipNeeded`);
    }
    if (it.cookMethod === 'prep' && !it.prepSec) {
      problems.push(`ingredient ${it.id}: prep items need prepSec > 0`);
    }
    const [lo, hi] = it.perfectWindow;
    if (!(lo < hi)) problems.push(`ingredient ${it.id}: perfectWindow must be ascending`);
    if (lo < 0 || hi > 1.2) problems.push(`ingredient ${it.id}: perfectWindow out of sane range`);
    if (it.value <= 0) problems.push(`ingredient ${it.id}: value must be > 0`);
    if (!Number.isInteger(it.unlock.level) || it.unlock.level < 1) {
      problems.push(`ingredient ${it.id}: unlock.level must be a positive integer`);
    }
    if (!db.restaurantByIndex.has(it.unlock.restaurantIndex)) {
      problems.push(`ingredient ${it.id}: unlock.restaurantIndex ${it.unlock.restaurantIndex} not defined`);
    }
  }

  for (const r of db.restaurants.restaurants) {
    for (const cid of r.customerPool) {
      if (!db.customerById.has(cid)) problems.push(`restaurant ${r.id}: unknown customer "${cid}" in pool`);
    }
    if (r.service.maxOrdersOnScreen < 1) problems.push(`restaurant ${r.id}: maxOrdersOnScreen must be >= 1`);
  }

  for (const c of db.customers.customers) {
    if (c.itemsMin < 1) problems.push(`customer ${c.id}: itemsMin must be >= 1`);
    if (c.itemsMax < c.itemsMin) problems.push(`customer ${c.id}: itemsMax < itemsMin`);
    if (c.patienceMultiplier <= 0) problems.push(`customer ${c.id}: patienceMultiplier must be > 0`);
  }

  // Restaurant indices must be contiguous starting at 0.
  const indices = [...db.restaurantByIndex.keys()].sort((a, b) => a - b);
  indices.forEach((v, i) => {
    if (v !== i) problems.push(`restaurant indices must be contiguous from 0 (found ${v} at position ${i})`);
  });

  // Upgrade costs must be monotonic within a track.
  for (const u of db.upgrades.tracks) {
    let prev = 0;
    for (let lvl = 1; lvl <= u.maxLevel; lvl++) {
      const cost = upgradeCost(u.baseCost, u.growth, lvl);
      if (cost <= prev) problems.push(`upgrade ${u.id}: non-monotonic cost at level ${lvl}`);
      prev = cost;
    }
    if (u.effect.delta === 0) problems.push(`upgrade ${u.id}: effect delta is 0`);
  }

  // Churrasqueiras validation (1F → 2F → 3F progression)
  if (db.churrasqueiras) {
    const seen = new Set<string>();
    const indices = new Set<number>();
    for (const ch of db.churrasqueiras.churrasqueiras) {
      if (seen.has(ch.id)) problems.push(`churrasqueira: duplicate id \"${ch.id}\"`);
      seen.add(ch.id);
      if (indices.has(ch.index)) problems.push(`churrasqueira ${ch.id}: duplicate index ${ch.index}`);
      indices.add(ch.index);
      if (ch.fileiras < 1 || ch.fileiras > 3) problems.push(`churrasqueira ${ch.id}: fileiras must be 1..3`);
      if (ch.fileiras !== ch.evolutions[0]?.zoneCount) problems.push(`churrasqueira ${ch.id}: fileiras mismatch zoneCount of evo 1`);
      if (ch.restaurantExpansion) {
        const expansion = ch.restaurantExpansion;
        const restaurant = db.restaurantByIndex.get(expansion.restaurantIndex);
        if (!restaurant) problems.push(`churrasqueira ${ch.id}: expansion restaurant does not exist`);
        if (!Number.isInteger(expansion.zoneCount) || expansion.zoneCount > db.grill.zones.length
          || expansion.zoneCount <= Math.max(...ch.evolutions.map(e => e.zoneCount))) {
          problems.push(`churrasqueira ${ch.id}: expansion zoneCount must add defined zones`);
        }
        if (restaurant && db.restaurants.restaurants.some(r => r.index >= restaurant.index && r.grill.zoneCount < expansion.zoneCount)) {
          problems.push(`churrasqueira ${ch.id}: expansion exceeds restaurant zoneCount`);
        }
      }
      if (ch.evolutions.length !== 3) problems.push(`churrasqueira ${ch.id}: expected 3 evolutions`);
      ch.evolutions.forEach((evo, i) => {
        if (evo.level !== i + 1) problems.push(`churrasqueira ${ch.id} evo ${evo.level}: level should be ${i + 1}`);
        if (evo.zoneCount < 1 || evo.zoneCount > 3) problems.push(`churrasqueira ${ch.id} evo ${evo.level}: zoneCount 1..3`);
        if (evo.slotsPerZone < 2 || evo.slotsPerZone > 4) problems.push(`churrasqueira ${ch.id} evo ${evo.level}: slotsPerZone 2..4`);
        if (evo.heatBase < 0.5 || evo.heatBase > 1.7) problems.push(`churrasqueira ${ch.id} evo ${evo.level}: heatBase out of range`);
      });
      // monotonic unlock levels
      if (ch.unlockLevel < 1) problems.push(`churrasqueira ${ch.id}: unlockLevel must be >=1`);
      const evo1 = ch.evolutions[0];
      if (evo1 && evo1.costCoins !== 0) problems.push(`churrasqueira ${ch.id}: evolution 1 must cost 0 (granted on unlock)`);
    }
    // indices contiguous 0..n-1
    const sorted = [...indices].sort((a,b)=>a-b);
    sorted.forEach((v,i)=> { if (v!==i) problems.push(`churrasqueira indices must be contiguous from 0 (found ${v} at ${i})`); });
    // fileiras monotonic non-decreasing by index
    const byIdx = [...db.churrasqueiras.churrasqueiras].sort((a,b)=>a.index-b.index);
    const starter = byIdx[0];
    if (starter && (starter.unlockCostCoins !== 0 || starter.unlockLevel !== 1)) {
      problems.push(`churrasqueira ${starter.id}: starter (index 0) must be free at level 1`);
    }
    for (let i=1;i<byIdx.length;i++) {
      if (byIdx[i]!.fileiras < byIdx[i-1]!.fileiras) problems.push(`churrasqueira ${byIdx[i]!.id}: fileiras must not decrease vs previous tier`);
      if (byIdx[i]!.unlockLevel <= byIdx[i-1]!.unlockLevel) problems.push(`churrasqueira ${byIdx[i]!.id}: unlockLevel must increase`);
    }
  }

  return problems;
}

/** cost(level) = round(base * growth^(level-1) / 10) * 10 — matches ECONOMY.md and the Unity port. */
export function upgradeCost(baseCost: number, growth: number, level: number): number {
  if (level < 1) return 0;
  const raw = baseCost * Math.pow(growth, level - 1);
  return Math.round(raw / 10) * 10;
}

/** XP required to go FROM `level` TO `level + 1`. */
export function xpForLevel(level: number, a: number, exponent: number, minPerLevel: number): number {
  if (level < 1) return minPerLevel;
  return Math.max(minPerLevel, Math.round(a * Math.pow(level, exponent)));
}

/** Cumulative XP needed to reach `level` (level 1 costs 0). */
export function totalXpForLevel(level: number, a: number, exponent: number, minPerLevel: number): number {
  let total = 0;
  for (let l = 1; l < level; l++) total += xpForLevel(l, a, exponent, minPerLevel);
  return total;
}

/** Level for a given cumulative XP amount. */
export function levelForXp(xp: number, a: number, exponent: number, minPerLevel: number, maxLevel: number): number {
  let level = 1;
  let remaining = xp;
  while (level < maxLevel) {
    const need = xpForLevel(level, a, exponent, minPerLevel);
    if (remaining < need) break;
    remaining -= need;
    level++;
  }
  return level;
}

/** Piecewise-linear curve lookup (used for the charcoal efficiency ramp). */
export function sampleCurve(points: { t: number; value: number }[], t: number): number {
  if (points.length === 0) return 1;
  const clamped = Math.max(0, Math.min(1, t));
  if (clamped <= points[0]!.t) return points[0]!.value;
  const last = points[points.length - 1]!;
  if (clamped >= last.t) return last.value;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]!;
    const b = points[i + 1]!;
    if (clamped >= a.t && clamped <= b.t) {
      const span = b.t - a.t;
      const k = span <= 0 ? 0 : (clamped - a.t) / span;
      return a.value + (b.value - a.value) * k;
    }
  }
  return last.value;
}

export const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);
