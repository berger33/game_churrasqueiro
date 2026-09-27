/**
 * tools/sim-core/src/meta.ts
 * Meta-progression systems: Collection (Livro do Mestre), Achievements,
 * Missions (Daily & Weekly), Passe da Brasa (Season Pass), and Rota da Brasa.
 */

export interface CollectionMasteryDef {
  xpFormula: { type: string; a: number; exponent: number };
  levels: Array<{ level: number; titleKey: string }>;
  rewardPerLevel: { coins: number; embersEvery5: number };
  cosmeticOnly: boolean;
}

export interface CollectionEntryDef {
  id: string;
  category: string;
  refType: string;
  refId: string;
  rarity: string;
  originKey: string;
}

export interface AchievementDef {
  id: string;
  nameKey: string;
  descKey: string;
  stat: string;
  goal: number;
  reward: { coins?: number; embers?: number };
  tier: number;
}

export interface MissionDef {
  id: string;
  nameKey: string;
  stat: string;
  goal: number;
  reward: { coins?: number; embers?: number };
  requiresIngredient?: string;
}

export interface RouteStopDef {
  index: number;
  id: string;
  nameKey: string;
  region: string;
  emberCost: number;
  challenge: { type: string; goal: number; ingredient?: string };
  reward: { coins?: number; embers?: number; ingredient?: string; decor?: string; skin?: string; equipment?: string };
  storyKey: string;
}

export interface MetaState {
  unlockedCollection: Record<string, boolean>;
  masteryLevels: Record<string, number>;
  masteryXp: Record<string, number>;
  claimedAchievements: Record<string, boolean>;
  dailyMissionProgress: Record<string, { stat: string; progress: number; completed: boolean; claimed: boolean }>;
  weeklyMissionProgress: Record<string, { stat: string; progress: number; completed: boolean; claimed: boolean }>;
  passXp: number;
  claimedPassTiers: { free: number[]; premium: number[] };
  hasPremiumPass: boolean;
  emberPoints: number;
  routeStopsUnlocked: number;
}

export function createInitialMetaState(): MetaState {
  return {
    unlockedCollection: {},
    masteryLevels: {},
    masteryXp: {},
    claimedAchievements: {},
    dailyMissionProgress: {},
    weeklyMissionProgress: {},
    passXp: 0,
    claimedPassTiers: { free: [], premium: [] },
    hasPremiumPass: false,
    emberPoints: 0,
    routeStopsUnlocked: 1
  };
}

/** Computes XP required to reach the next mastery level: 30 * (level ^ 1.5) */
export function xpForMasteryLevel(level: number, a = 30, exponent = 1.5): number {
  return Math.round(a * Math.pow(Math.max(1, level), exponent));
}

/** Calculates mastery level and progress for a given ingredient/item */
export function addMasteryXp(
  state: MetaState,
  entryId: string,
  xpGained: number
): { oldLevel: number; newLevel: number; coinsReward: number; embersReward: number } {
  const currentXp = (state.masteryXp[entryId] ?? 0) + xpGained;
  state.masteryXp[entryId] = currentXp;

  const currentLevel = state.masteryLevels[entryId] ?? 1;
  let level = currentLevel;
  let coins = 0;
  let embers = 0;

  while (level < 20) {
    const required = xpForMasteryLevel(level);
    if (state.masteryXp[entryId]! >= required) {
      level++;
      coins += 40;
      if (level % 5 === 0) embers += 3;
    } else {
      break;
    }
  }

  state.masteryLevels[entryId] = level;
  state.unlockedCollection[entryId] = true;

  return { oldLevel: currentLevel, newLevel: level, coinsReward: coins, embersReward: embers };
}

/** Evaluates all achievements against stat counters */
export function evaluateAchievements(
  achievements: AchievementDef[],
  stats: Record<string, number>,
  claimedAchievements: Record<string, boolean>
): { claimable: AchievementDef[]; totalCoins: number; totalEmbers: number } {
  const claimable: AchievementDef[] = [];
  let totalCoins = 0;
  let totalEmbers = 0;

  for (const ach of achievements) {
    if (claimedAchievements[ach.id]) continue;
    const value = stats[ach.stat] ?? 0;
    if (value >= ach.goal) {
      claimable.push(ach);
      totalCoins += ach.reward.coins ?? 0;
      totalEmbers += ach.reward.embers ?? 0;
    }
  }

  return { claimable, totalCoins, totalEmbers };
}

/** Claims an achievement, marking it as claimed */
export function claimAchievement(
  ach: AchievementDef,
  state: MetaState
): { coins: number; embers: number } {
  if (state.claimedAchievements[ach.id]) return { coins: 0, embers: 0 };
  state.claimedAchievements[ach.id] = true;
  return {
    coins: ach.reward.coins ?? 0,
    embers: ach.reward.embers ?? 0
  };
}

/** Updates mission progress with delta */
export function updateMissionProgress(
  missions: MissionDef[],
  missionMap: Record<string, { stat: string; progress: number; completed: boolean; claimed: boolean }>,
  statDeltas: Record<string, number>
): { newlyCompleted: string[] } {
  const newlyCompleted: string[] = [];

  for (const mission of missions) {
    const delta = statDeltas[mission.stat] ?? 0;
    if (delta <= 0) continue;

    const entry = missionMap[mission.id] ?? {
      stat: mission.stat,
      progress: 0,
      completed: false,
      claimed: false
    };

    if (!entry.completed) {
      entry.progress += delta;
      if (entry.progress >= mission.goal) {
        entry.completed = true;
        newlyCompleted.push(mission.id);
      }
    }
    missionMap[mission.id] = entry;
  }

  return { newlyCompleted };
}

/** Calculates current Season Pass tier from season XP (1000 XP/tier) */
export function passTierForXp(xp: number, xpPerTier = 1000, maxTiers = 50): number {
  return Math.min(maxTiers, Math.floor(xp / xpPerTier));
}

/** Checks whether a stop on Rota da Brasa can be unlocked */
export function canUnlockRouteStop(
  stop: RouteStopDef,
  currentUnlockedStops: number,
  emberPoints: number
): boolean {
  if (stop.index !== currentUnlockedStops + 1) return false;
  return emberPoints >= stop.emberCost;
}
