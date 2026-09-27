// CHURRASCO! O Mestre da Brasa — save system, versioning and migrations.
//
// EXACT port of tools/sim-core/src/save.ts (spec §57 / §58).
// Preserves schema v5, IEEE CRC32, clock tamper detection, forward migrations,
// and daily streak logic with grace day support.

#nullable enable
using System;
using System.Collections.Generic;

namespace Churrasco.Core
{
    public sealed class DailyState
    {
        public int Streak;
        public int LastClaimDayIndex;
        public long LastClaimUnixDay;
        public int MissionsRerolledToday;
        public long LastMissionResetUnixDay;
        public List<string> MissionIds = new List<string>();
        public List<string> WeeklyMissionIds = new List<string>();
        public long LastWeeklyResetUnixDay;

        public DailyState Clone() => new DailyState
        {
            Streak = Streak,
            LastClaimDayIndex = LastClaimDayIndex,
            LastClaimUnixDay = LastClaimUnixDay,
            MissionsRerolledToday = MissionsRerolledToday,
            LastMissionResetUnixDay = LastMissionResetUnixDay,
            MissionIds = new List<string>(MissionIds),
            WeeklyMissionIds = new List<string>(WeeklyMissionIds),
            LastWeeklyResetUnixDay = LastWeeklyResetUnixDay
        };
    }

    public sealed class SettingsState
    {
        public double MusicVolume = 0.6;
        public double SfxVolume = 0.85;
        public bool Haptics = true;
        public string QualityLevel = "AUTO";
        public string Locale = "pt-BR";
        public bool Notifications = true;
        public bool ColorBlindMode;
        public bool ReduceMotion;

        public SettingsState Clone() => new SettingsState
        {
            MusicVolume = MusicVolume,
            SfxVolume = SfxVolume,
            Haptics = Haptics,
            QualityLevel = QualityLevel,
            Locale = Locale,
            Notifications = Notifications,
            ColorBlindMode = ColorBlindMode,
            ReduceMotion = ReduceMotion
        };
    }

    public sealed class PassState
    {
        public string SeasonId = "";
        public double Xp;
        public List<int> ClaimedFree = new List<int>();
        public List<int> ClaimedPremium = new List<int>();
        public bool PremiumOwned;

        public PassState Clone() => new PassState
        {
            SeasonId = SeasonId,
            Xp = Xp,
            ClaimedFree = new List<int>(ClaimedFree),
            ClaimedPremium = new List<int>(ClaimedPremium),
            PremiumOwned = PremiumOwned
        };
    }

    public sealed class AdState
    {
        public Dictionary<string, int> RewardedToday = new Dictionary<string, int>(StringComparer.Ordinal);
        public int InterstitialsToday;
        public long LastInterstitialUnixSec;
        public long DayStamp;

        public AdState Clone()
        {
            var a = new AdState
            {
                InterstitialsToday = InterstitialsToday,
                LastInterstitialUnixSec = LastInterstitialUnixSec,
                DayStamp = DayStamp
            };
            foreach (var kv in RewardedToday) a.RewardedToday[kv.Key] = kv.Value;
            return a;
        }
    }

    public sealed class ProgressState
    {
        public Dictionary<string, double> Achievements = new Dictionary<string, double>(StringComparer.Ordinal);
        public Dictionary<string, bool> Collection = new Dictionary<string, bool>(StringComparer.Ordinal);
        public Dictionary<string, double> Mastery = new Dictionary<string, double>(StringComparer.Ordinal);
        public int RouteStop = 1;
        public double RouteEmberPoints;
        public List<string> UnlockedIngredients = new List<string>();
        public List<string> CosmeticsOwned = new List<string>();
        public Dictionary<string, string> Equipped = new Dictionary<string, string>(StringComparer.Ordinal);
        public PassState Pass = new PassState();
        public Dictionary<string, double> Leaderboards = new Dictionary<string, double>(StringComparer.Ordinal);
        public AdState AdState = new AdState();
        public List<string> Entitlements = new List<string>();
        public bool FtueDone;

        public ProgressState Clone()
        {
            var p = new ProgressState
            {
                RouteStop = RouteStop,
                RouteEmberPoints = RouteEmberPoints,
                UnlockedIngredients = new List<string>(UnlockedIngredients),
                CosmeticsOwned = new List<string>(CosmeticsOwned),
                Pass = Pass.Clone(),
                AdState = AdState.Clone(),
                Entitlements = new List<string>(Entitlements),
                FtueDone = FtueDone
            };
            foreach (var kv in Achievements) p.Achievements[kv.Key] = kv.Value;
            foreach (var kv in Collection) p.Collection[kv.Key] = kv.Value;
            foreach (var kv in Mastery) p.Mastery[kv.Key] = kv.Value;
            foreach (var kv in Equipped) p.Equipped[kv.Key] = kv.Value;
            foreach (var kv in Leaderboards) p.Leaderboards[kv.Key] = kv.Value;
            return p;
        }
    }

    public sealed class SaveGame
    {
        public int SchemaVersion = SaveSystem.SaveSchemaVersion;
        public long SavedAtUnixSec;
        public long DeviceClockUnixSec;
        public double TotalPlayTimeSec;
        public string InstallId = "";
        public PlayerState Player = new PlayerState();
        public DailyState Daily = new DailyState();
        public SettingsState Settings = new SettingsState();
        public ProgressState Progress = new ProgressState();

        public SaveGame Clone() => new SaveGame
        {
            SchemaVersion = SchemaVersion,
            SavedAtUnixSec = SavedAtUnixSec,
            DeviceClockUnixSec = DeviceClockUnixSec,
            TotalPlayTimeSec = TotalPlayTimeSec,
            InstallId = InstallId,
            Player = Player.Clone(),
            Daily = Daily.Clone(),
            Settings = Settings.Clone(),
            Progress = Progress.Clone()
        };
    }

    public sealed class SaveEnvelope
    {
        public int V;
        public uint Crc;
        public SaveGame Payload = null!;
    }

    public static class SaveSystem
    {
        public const int SaveSchemaVersion = 5;

        public static SettingsState DefaultSettings() => new SettingsState();

        public static DailyState DefaultDaily() => new DailyState();

        public static ProgressState DefaultProgress() => new ProgressState();

        public static SaveGame NewSave(string installId, long nowUnixSec)
        {
            return new SaveGame
            {
                SchemaVersion = SaveSchemaVersion,
                SavedAtUnixSec = nowUnixSec,
                DeviceClockUnixSec = nowUnixSec,
                TotalPlayTimeSec = 0,
                InstallId = installId,
                Player = EconomyRules.NewPlayerState(),
                Daily = DefaultDaily(),
                Settings = DefaultSettings(),
                Progress = DefaultProgress()
            };
        }

        /// <summary>IEEE 802.3 CRC32 calculation identical to JS implementation.</summary>
        public static uint Crc32(string str)
        {
            uint c = ~0u;
            for (int i = 0; i < str.Length; i++)
            {
                c ^= (uint)str[i];
                for (int k = 0; k < 8; k++)
                {
                    c = (c >> 1) ^ ((c & 1u) != 0 ? 0xedb88320u : 0u);
                }
            }
            return ~c;
        }

        public static SaveGame Migrate(SaveGame save, int fromVersion)
        {
            var outSave = save.Clone();
            if (fromVersion < 1) outSave.Player = EconomyRules.NewPlayerState();
            // A-07: Repair restaurantsUnlocked count
            outSave.Player.Counters["restaurantsUnlocked"] = outSave.Player.RestaurantIndex + 1;

            // v2: equipped grill
            if (string.IsNullOrEmpty(outSave.Player.ChurrasqueiraId))
                outSave.Player.ChurrasqueiraId = EconomyRules.StarterChurrasqueiraId;
            if (!outSave.Player.ChurrasqueiraLevels.ContainsKey(outSave.Player.ChurrasqueiraId))
                outSave.Player.ChurrasqueiraLevels[outSave.Player.ChurrasqueiraId] = 1;

            // v3: FTUE
            if (fromVersion < 3)
            {
                outSave.Progress.FtueDone = true;
            }

            // v4: VIP
            if (fromVersion < 4)
            {
                outSave.Player.Vip = new VipState();
            }

            // v5: offline
            if (fromVersion < 5)
            {
                outSave.Player.Offline = EconomyRules.NewOfflineState(0);
            }

            outSave.SchemaVersion = SaveSchemaVersion;
            return outSave;
        }

        public static (bool Tampered, double DriftSec) DetectClockTampering(SaveGame save, double nowUnixSec)
        {
            double drift = nowUnixSec - save.DeviceClockUnixSec;
            return (drift < -60.0, drift);
        }

        public static long UnixDay(double unixSec) => (long)Math.Floor(unixSec / 86400.0);

        public static (int DayIndex, int Streak, bool CanClaim) ResolveDailyClaim(
            SaveGame save, double nowUnixSec, int cycleDays, int graceDays)
        {
            long today = UnixDay(nowUnixSec);
            long last = save.Daily.LastClaimUnixDay;
            if (last == today)
            {
                return (save.Daily.LastClaimDayIndex, save.Daily.Streak, false);
            }
            long gap = today - last;
            int streak = save.Daily.Streak;
            int dayIndex;
            if (last == 0)
            {
                streak = 1;
                dayIndex = 0;
            }
            else if (gap == 1)
            {
                streak += 1;
                dayIndex = (save.Daily.LastClaimDayIndex + 1) % cycleDays;
            }
            else if (gap <= 1 + graceDays)
            {
                // Grace day: holds streak (5->5), advances dayIndex
                dayIndex = (save.Daily.LastClaimDayIndex + 1) % cycleDays;
            }
            else
            {
                streak = 1;
                dayIndex = 0;
            }
            return (dayIndex, streak, true);
        }
    }
}
