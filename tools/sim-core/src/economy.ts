import { clamp, levelForXp, upgradeCost, xpForLevel } from './data.ts';
import type { GameDatabase } from './types.ts';
import type { TurnResult } from './turn.ts';

export interface PlayerState {
  coins: number;
  embers: number;
  xp: number;
  level: number;
  restaurantIndex: number;
  upgradeLevels: Record<string, number>;
  counters: Record<string, number>;
  lastSeenUnixSec: number;
}

export function newPlayerState(): PlayerState {
  return {
    coins: 0,
    embers: 0,
    xp: 0,
    level: 1,
    restaurantIndex: 0,
    upgradeLevels: {},
    counters: {},
    lastSeenUnixSec: 0
  };
}

export interface LedgerEntry {
  currency: 'coins' | 'embers';
  amount: number;
  source: string;
  balance: number;
}

export interface ApplyTurnResult {
  coinsEarned: number;
  xpEarned: number;
  levelsGained: number;
  levelUpRewardCoins: number;
  levelUpRewardEmbers: number;
  ledger: LedgerEntry[];
}

/** Credit a finished turn, roll level-ups and return the analytics ledger entries. */
export function applyTurnResult(db: GameDatabase, p: PlayerState, r: TurnResult): ApplyTurnResult {
  const ledger: LedgerEntry[] = [];
  const econ = db.economy;

  p.coins += r.coins;
  ledger.push({ currency: 'coins', amount: r.coins, source: 'turn', balance: p.coins });
  addCounter(p, 'coinsEarnedTotal', r.coins);
  addCounter(p, 'coinsEarnedSession', r.coins);
  addCounter(p, 'turnsPlayed', 1);
  addCounter(p, 'perfectCooks', r.counters.perfectCooks);
  addCounter(p, 'burnedFood', r.counters.burnedFood);
  addCounter(p, 'customersServed', r.counters.customersServed);
  addCounter(p, 'ordersCompleted', r.counters.ordersCompleted);
  addCounter(p, 'bestCombo', Math.max(p.counters['bestCombo'] ?? 0, r.counters.bestCombo));
  if (r.counters.flawless && r.counters.customersLost === 0) addCounter(p, 'flawlessTurns', 1);

  let levelsGained = 0;
  let levelUpCoins = 0;
  let levelUpEmbers = 0;
  let xp = p.xp + r.xp;
  const { a, exponent, minPerLevel } = econ.xp.formula;
  let level = p.level;
  while (level < econ.xp.maxLevel) {
    const need = xpForLevel(level, a, exponent, minPerLevel);
    if (xp < need) break;
    xp -= need;
    level++;
    levelsGained++;
    levelUpCoins += levelUpCoinReward(econ.reward.levelUpCoins, level);
    if (level % econ.reward.levelUpEmbers.every === 0) levelUpEmbers += econ.reward.levelUpEmbers.amount;
  }
  p.xp = xp;
  p.level = level;
  if (levelUpCoins > 0) {
    p.coins += levelUpCoins;
    ledger.push({ currency: 'coins', amount: levelUpCoins, source: 'level_up', balance: p.coins });
    addCounter(p, 'coinsEarnedTotal', levelUpCoins);
  }
  if (levelUpEmbers > 0) {
    p.embers += levelUpEmbers;
    ledger.push({ currency: 'embers', amount: levelUpEmbers, source: 'level_up', balance: p.embers });
  }

  return { coinsEarned: r.coins, xpEarned: r.xp, levelsGained, levelUpRewardCoins: levelUpCoins, levelUpRewardEmbers: levelUpEmbers, ledger };
}

/** Coins granted on reaching `level`. Polynomial on purpose — see ECONOMY.md. */
export function levelUpCoinReward(cfg: { base: number; exponent: number }, level: number): number {
  return Math.round(cfg.base * Math.pow(Math.max(1, level), cfg.exponent));
}

export function addCounter(p: PlayerState, key: string, delta: number): void {
  p.counters[key] = (p.counters[key] ?? 0) + delta;
}

/** Dot-path counters used by achievements/missions, e.g. `food.picanha.perfect`. */
export function addFoodCounter(p: PlayerState, ingredientId: string, kind: 'served' | 'perfect' | 'burned', delta = 1): void {
  addCounter(p, `food.${ingredientId}.${kind}`, delta);
}

export function costFor(db: GameDatabase, trackId: string, currentLevel: number): number {
  const t = db.upgradeById.get(trackId);
  if (!t) return Infinity;
  if (currentLevel >= t.maxLevel) return Infinity;
  return upgradeCost(t.baseCost, t.growth, currentLevel + 1);
}

export function canAfford(p: PlayerState, db: GameDatabase, trackId: string): boolean {
  const t = db.upgradeById.get(trackId);
  if (!t) return false;
  const cost = costFor(db, trackId, p.upgradeLevels[trackId] ?? 0);
  return (t.currency === 'coins' ? p.coins : p.embers) >= cost;
}

export function buyUpgrade(db: GameDatabase, p: PlayerState, trackId: string): LedgerEntry | null {
  const t = db.upgradeById.get(trackId);
  if (!t) return null;
  const level = p.upgradeLevels[trackId] ?? 0;
  if (level >= t.maxLevel) return null;
  const cost = upgradeCost(t.baseCost, t.growth, level + 1);
  if (t.currency === 'coins') {
    if (p.coins < cost) return null;
    p.coins -= cost;
  } else {
    if (p.embers < cost) return null;
    p.embers -= cost;
  }
  p.upgradeLevels[trackId] = level + 1;
  addCounter(p, 'upgradesPurchased', 1);
  addCounter(p, t.currency === 'coins' ? 'coinsSpentTotal' : 'embersSpentTotal', cost);
  addCounter(p, 'coinsSpentSession', t.currency === 'coins' ? cost : 0);
  return { currency: t.currency, amount: -cost, source: `upgrade:${trackId}`, balance: t.currency === 'coins' ? p.coins : p.embers };
}

export function canUnlockRestaurant(db: GameDatabase, p: PlayerState, index: number): boolean {
  const r = db.restaurantByIndex.get(index);
  if (!r) return false;
  if (index !== p.restaurantIndex + 1) return false;
  return p.level >= r.requiredLevel && p.coins >= r.unlockCostCoins;
}

export function unlockRestaurant(db: GameDatabase, p: PlayerState, index: number): boolean {
  if (!canUnlockRestaurant(db, p, index)) return false;
  const r = db.restaurantByIndex.get(index)!;
  p.coins -= r.unlockCostCoins;
  addCounter(p, 'coinsSpentTotal', r.unlockCostCoins);
  p.restaurantIndex = index;
  addCounter(p, 'restaurantsUnlocked', index + 1);
  return true;
}

// ── Idle / offline ───────────────────────────────────────────────────────────

export interface OfflineEarnings {
  minutes: number;
  coins: number;
  xp: number;
  capped: boolean;
}

/**
 * Offline production. Uses a linear ramp so short absences are not over-rewarded
 * and caps at `idle.maxOfflineHours` (spec §18).
 */
export function computeOfflineEarnings(db: GameDatabase, p: PlayerState, elapsedSec: number, nowSec: number): OfflineEarnings {
  const idle = db.economy.idle;
  if (p.restaurantIndex <= 0 || elapsedSec <= 0) return { minutes: 0, coins: 0, xp: 0, capped: false };

  const maxSec = idle.maxOfflineHours * 3600 * (p.upgradeLevels['caixa'] ? 1 : 1);
  const capped = elapsedSec > maxSec;
  const effective = Math.min(elapsedSec, maxSec);
  const minutes = effective / 60;
  const ramp = clamp(minutes / idle.rampInMinutes, 0, 1);
  const factor = 0.5 + 0.5 * ramp; // never below 50% of nominal rate
  const perMinCoins = idle.coinsPerMinuteByRestaurant[p.restaurantIndex] ?? 0;
  const perMinXp = idle.xpPerMinuteByRestaurant[p.restaurantIndex] ?? 0;
  const gerenteMult = 1 + (p.upgradeLevels['gerente'] ?? 0) * (db.upgradeById.get('gerente')?.effect.delta ?? 0.18);

  void nowSec;
  return {
    minutes: Math.round(minutes),
    coins: Math.round(minutes * perMinCoins * factor * gerenteMult),
    xp: Math.round(minutes * perMinXp * factor * gerenteMult),
    capped
  };
}

// ── Session economy accounting ───────────────────────────────────────────────

export interface SessionEconomy {
  faucets: Record<string, number>;
  sinks: Record<string, number>;
  faucetTotal(): number;
  sinkTotal(): number;
  spendRatio(): number;
}

export function createSessionEconomy(): SessionEconomy {
  const faucets: Record<string, number> = {};
  const sinks: Record<string, number> = {};
  return {
    faucets,
    sinks,
    faucetTotal: () => sum(faucets),
    sinkTotal: () => sum(sinks),
    spendRatio: () => {
      const f = sum(faucets);
      return f <= 0 ? 0 : sum(sinks) / f;
    }
  };
}

export function recordLedger(s: SessionEconomy, entries: readonly LedgerEntry[]): void {
  for (const e of entries) {
    if (e.currency !== 'coins') continue;
    if (e.amount >= 0) s.faucets[e.source] = (s.faucets[e.source] ?? 0) + e.amount;
    else s.sinks[e.source] = (s.sinks[e.source] ?? 0) + -e.amount;
  }
}

function sum(o: Record<string, number>): number {
  let t = 0;
  for (const k of Object.keys(o)) t += o[k]!;
  return t;
}

export { levelForXp, xpForLevel, upgradeCost };
