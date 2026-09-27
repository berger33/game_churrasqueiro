// MetaProgression.cs — Engine-free C# port of meta systems (collection, achievements, missions, pass, route).
// Targets netstandard2.1 / C# 9.0 with strict mathematical parity.
#nullable enable
using System;
using System.Collections.Generic;

namespace Churrasco.Core
{
    public sealed class MetaState
    {
        public Dictionary<string, bool> UnlockedCollection { get; set; } = new();
        public Dictionary<string, int> MasteryLevels { get; set; } = new();
        public Dictionary<string, int> MasteryXp { get; set; } = new();
        public Dictionary<string, bool> ClaimedAchievements { get; set; } = new();
        public Dictionary<string, MissionProgress> DailyMissions { get; set; } = new();
        public Dictionary<string, MissionProgress> WeeklyMissions { get; set; } = new();
        public int PassXp { get; set; }
        public List<int> ClaimedFreePassTiers { get; set; } = new();
        public List<int> ClaimedPremiumPassTiers { get; set; } = new();
        public bool HasPremiumPass { get; set; }
        public int EmberPoints { get; set; }
        public int RouteStopsUnlocked { get; set; } = 1;
    }

    public sealed class MissionProgress
    {
        public string Stat { get; set; } = "";
        public int Progress { get; set; }
        public bool Completed { get; set; }
        public bool Claimed { get; set; }
    }

    public sealed class AchievementData
    {
        public string Id { get; set; } = "";
        public string NameKey { get; set; } = "";
        public string DescKey { get; set; } = "";
        public string Stat { get; set; } = "";
        public int Goal { get; set; }
        public int RewardCoins { get; set; }
        public int RewardEmbers { get; set; }
        public int Tier { get; set; }
    }

    public sealed class MissionData
    {
        public string Id { get; set; } = "";
        public string NameKey { get; set; } = "";
        public string Stat { get; set; } = "";
        public int Goal { get; set; }
        public int RewardCoins { get; set; }
        public int RewardEmbers { get; set; }
    }

    public sealed class RouteStopData
    {
        public int Index { get; set; }
        public string Id { get; set; } = "";
        public string NameKey { get; set; } = "";
        public string Region { get; set; } = "";
        public int EmberCost { get; set; }
        public string ChallengeType { get; set; } = "";
        public int ChallengeGoal { get; set; }
        public int RewardCoins { get; set; }
        public int RewardEmbers { get; set; }
        public string StoryKey { get; set; } = "";
    }

    public static class MetaProgression
    {
        /// <summary>
        /// Computes XP required for mastery level: 30 * (level ^ 1.5) rounded
        /// </summary>
        public static int XpForMasteryLevel(int level, double a = 30.0, double exponent = 1.5)
        {
            return (int)Math.Round(a * Math.Pow(Math.Max(1, level), exponent), MidpointRounding.AwayFromZero);
        }

        /// <summary>
        /// Adds mastery XP and calculates level up and rewards
        /// </summary>
        public static (int oldLevel, int newLevel, int coinsReward, int embersReward) AddMasteryXp(
            MetaState state,
            string entryId,
            int xpGained)
        {
            state.MasteryXp.TryGetValue(entryId, out int currentXp);
            currentXp += xpGained;
            state.MasteryXp[entryId] = currentXp;

            state.MasteryLevels.TryGetValue(entryId, out int currentLevel);
            if (currentLevel < 1) currentLevel = 1;

            int level = currentLevel;
            int coins = 0;
            int embers = 0;

            while (level < 20)
            {
                int required = XpForMasteryLevel(level);
                if (currentXp >= required)
                {
                    level++;
                    coins += 40;
                    if (level % 5 == 0) embers += 3;
                }
                else
                {
                    break;
                }
            }

            state.MasteryLevels[entryId] = level;
            state.UnlockedCollection[entryId] = true;

            return (currentLevel, level, coins, embers);
        }

        /// <summary>
        /// Evaluates achievements against player stats
        /// </summary>
        public static List<AchievementData> EvaluateAchievements(
            IReadOnlyList<AchievementData> allAchievements,
            IReadOnlyDictionary<string, int> stats,
            IReadOnlyDictionary<string, bool> claimed)
        {
            var claimable = new List<AchievementData>();

            foreach (var ach in allAchievements)
            {
                if (claimed.TryGetValue(ach.Id, out bool isClaimed) && isClaimed)
                    continue;

                stats.TryGetValue(ach.Stat, out int statValue);
                if (statValue >= ach.Goal)
                {
                    claimable.Add(ach);
                }
            }

            return claimable;
        }

        /// <summary>
        /// Claims achievement and marks it claimed in state
        /// </summary>
        public static (int coins, int embers) ClaimAchievement(AchievementData ach, MetaState state)
        {
            if (state.ClaimedAchievements.TryGetValue(ach.Id, out bool claimed) && claimed)
                return (0, 0);

            state.ClaimedAchievements[ach.Id] = true;
            return (ach.RewardCoins, ach.RewardEmbers);
        }

        /// <summary>
        /// Updates mission progress given stats delta
        /// </summary>
        public static List<string> UpdateMissions(
            IReadOnlyList<MissionData> missions,
            Dictionary<string, MissionProgress> missionMap,
            IReadOnlyDictionary<string, int> statDeltas)
        {
            var newlyCompleted = new List<string>();

            foreach (var mission in missions)
            {
                if (!statDeltas.TryGetValue(mission.Stat, out int delta) || delta <= 0)
                    continue;

                if (!missionMap.TryGetValue(mission.Id, out var entry))
                {
                    entry = new MissionProgress { Stat = mission.Stat, Progress = 0, Completed = false, Claimed = false };
                    missionMap[mission.Id] = entry;
                }

                if (!entry.Completed)
                {
                    entry.Progress += delta;
                    if (entry.Progress >= mission.Goal)
                    {
                        entry.Completed = true;
                        newlyCompleted.Add(mission.Id);
                    }
                }
            }

            return newlyCompleted;
        }

        /// <summary>
        /// Calculates Season Pass tier from season XP (1000 XP per tier, up to 50 tiers)
        /// </summary>
        public static int PassTierForXp(int xp, int xpPerTier = 1000, int maxTiers = 50)
        {
            if (xpPerTier <= 0) return 0;
            return Math.Min(maxTiers, xp / xpPerTier);
        }

        /// <summary>
        /// Checks whether a route stop can be unlocked with current ember points
        /// </summary>
        public static bool CanUnlockRouteStop(RouteStopData stop, int currentUnlockedStops, int emberPoints)
        {
            if (stop.Index != currentUnlockedStops + 1) return false;
            return emberPoints >= stop.EmberCost;
        }
    }
}
