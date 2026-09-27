// CHURRASCO! O Mestre da Brasa — economy, progression and offline rules.
//
// EXACT port of tools/sim-core/src/economy.ts and tools/sim-core/src/offline.ts.
// Matches formulas, level curves, upgrade pricing snap, offline calculations
// and ledger recording down to 1e-9.

#nullable enable
using System;
using System.Collections.Generic;
using System.Linq;
using Churrasco.Core.Generated;

namespace Churrasco.Core
{
    public sealed class PlayerState
    {
        public OfflineState Offline = EconomyRules.NewOfflineState(0);
        public long Coins;
        public long Embers;
        public double Xp;
        public int Level = 1;
        public int RestaurantIndex;
        public Dictionary<string, int> UpgradeLevels = new Dictionary<string, int>(StringComparer.Ordinal);
        public string ChurrasqueiraId = EconomyRules.StarterChurrasqueiraId;
        public Dictionary<string, int> ChurrasqueiraLevels = new Dictionary<string, int>(StringComparer.Ordinal);
        public Dictionary<string, double> Counters = new Dictionary<string, double>(StringComparer.Ordinal);
        public long LastSeenUnixSec;
        public VipState Vip = new VipState();

        public PlayerState Clone()
        {
            var p = new PlayerState
            {
                Offline = Offline.Clone(),
                Coins = Coins,
                Embers = Embers,
                Xp = Xp,
                Level = Level,
                RestaurantIndex = RestaurantIndex,
                ChurrasqueiraId = ChurrasqueiraId,
                LastSeenUnixSec = LastSeenUnixSec,
                Vip = Vip.Clone()
            };
            foreach (var kv in UpgradeLevels) p.UpgradeLevels[kv.Key] = kv.Value;
            foreach (var kv in ChurrasqueiraLevels) p.ChurrasqueiraLevels[kv.Key] = kv.Value;
            foreach (var kv in Counters) p.Counters[kv.Key] = kv.Value;
            return p;
        }
    }

    public sealed class LedgerEntry
    {
        public string Currency = "coins"; // "coins" | "embers"
        public double Amount;
        public string Source = "";
        public double Balance;
    }

    public sealed class ApplyTurnResultOutcome
    {
        public double CoinsEarned;
        public double XpEarned;
        public int LevelsGained;
        public double LevelUpRewardCoins;
        public double LevelUpRewardEmbers;
        public List<LedgerEntry> Ledger = new List<LedgerEntry>();
    }

    public sealed class GrantExperienceOutcome
    {
        public int LevelsGained;
        public double LevelUpCoins;
        public double LevelUpEmbers;
        public List<LedgerEntry> Ledger = new List<LedgerEntry>();
    }

    public sealed class OfflineSnapshot
    {
        public int RestaurantIndex;
        public bool Eligible;
        public double CoinsPerMinute;
        public double XpPerMinute;
        public double Multiplier;
        public double AutoMinutes;
        public double MaxMinutes;
        public double RampMinutes;
        public double CooldownSec;

        public OfflineSnapshot Clone() => new OfflineSnapshot
        {
            RestaurantIndex = RestaurantIndex,
            Eligible = Eligible,
            CoinsPerMinute = CoinsPerMinute,
            XpPerMinute = XpPerMinute,
            Multiplier = Multiplier,
            AutoMinutes = AutoMinutes,
            MaxMinutes = MaxMinutes,
            RampMinutes = RampMinutes,
            CooldownSec = CooldownSec
        };
    }

    public sealed class OfflineAnchor
    {
        public double At;
        public OfflineSnapshot Snapshot = null!;

        public OfflineAnchor Clone() => new OfflineAnchor { At = At, Snapshot = Snapshot.Clone() };
    }

    public sealed class OfflineBatch
    {
        public int Id;
        public double Minutes;
        public double AutoMinutes;
        public double CoinsRaw;
        public double XpRaw;
        public double AutoCoinsRaw;
        public double AutoXpRaw;
        public long PaidCoins;
        public long PaidXp;
        public double AvailableAt;
        public double? SettledAt;
        public double CooldownSec;

        public OfflineBatch Clone() => new OfflineBatch
        {
            Id = Id,
            Minutes = Minutes,
            AutoMinutes = AutoMinutes,
            CoinsRaw = CoinsRaw,
            XpRaw = XpRaw,
            AutoCoinsRaw = AutoCoinsRaw,
            AutoXpRaw = AutoXpRaw,
            PaidCoins = PaidCoins,
            PaidXp = PaidXp,
            AvailableAt = AvailableAt,
            SettledAt = SettledAt,
            CooldownSec = CooldownSec
        };
    }

    public sealed class OfflineReceipt
    {
        public int Id;
        public string Part = "manual"; // "auto" | "manual"
        public double At;
        public double Minutes;
        public double OfflineCoins;
        public double OfflineXp;
        public double LevelCoins;
        public double LevelEmbers;
        public int LevelsGained;

        public OfflineReceipt Clone() => new OfflineReceipt
        {
            Id = Id,
            Part = Part,
            At = At,
            Minutes = Minutes,
            OfflineCoins = OfflineCoins,
            OfflineXp = OfflineXp,
            LevelCoins = LevelCoins,
            LevelEmbers = LevelEmbers,
            LevelsGained = LevelsGained
        };
    }

    public sealed class OfflineState
    {
        public int Version = 1;
        public bool Disabled;
        public double HighWater;
        public int NextId = 1;
        public double NextBatchAt;
        public OfflineAnchor? Anchor;
        public OfflineBatch? Batch;
        public OfflineReceipt? LastReceipt;

        public OfflineState Clone() => new OfflineState
        {
            Version = Version,
            Disabled = Disabled,
            HighWater = HighWater,
            NextId = NextId,
            NextBatchAt = NextBatchAt,
            Anchor = Anchor?.Clone(),
            Batch = Batch?.Clone(),
            LastReceipt = LastReceipt?.Clone()
        };
    }

    public sealed class OfflineCreditResult
    {
        public double Minutes;
        public double Coins;
        public double Xp;
    }

    public sealed class OfflineTransaction
    {
        public PlayerState Owner = null!;
        public OfflineReceipt? Receipt;
    }

    public readonly struct OfflineEarnings
    {
        public OfflineEarnings(double minutes, double coins, double xp, bool capped)
        {
            Minutes = minutes; Coins = coins; Xp = xp; Capped = capped;
        }
        public double Minutes { get; }
        public double Coins { get; }
        public double Xp { get; }
        public bool Capped { get; }
    }

    public sealed class ChurrasqueiraStep
    {
        public string Kind = "evolve"; // "evolve" | "unlock"
        public string Id = "";
        public int ToLevel;
        public int CostCoins;
        public int CostEmbers;
    }

    public sealed class VipOffer
    {
        public string Token = "";
        public double ExpiresUnixSec;
        public VipOffer Clone() => new VipOffer { Token = Token, ExpiresUnixSec = ExpiresUnixSec };
    }

    public sealed class VipState
    {
        public int Day = -1;
        public int UsedToday;
        public int CallsToday;
        public double LastCallUnixSec = -1;
        public double LastClockUnixSec;
        public int Sequence;
        public string? PendingCall;
        public VipOffer? Offer;
        public int ServedTotal;
        public List<string> ClaimedAchievements = new List<string>();
        public bool Blocked;

        // Legacy / compat accessors
        public double LastResetUnixDay { get => Day; set => Day = (int)value; }
        public string? ReservedCustomerDefId { get => PendingCall; set => PendingCall = value; }
        public bool ReservationUsed { get => UsedToday > 0; set { } }

        public VipState Clone()
        {
            var s = new VipState
            {
                Day = Day,
                UsedToday = UsedToday,
                CallsToday = CallsToday,
                LastCallUnixSec = LastCallUnixSec,
                LastClockUnixSec = LastClockUnixSec,
                Sequence = Sequence,
                PendingCall = PendingCall,
                Offer = Offer?.Clone(),
                ServedTotal = ServedTotal,
                Blocked = Blocked
            };
            s.ClaimedAchievements.AddRange(ClaimedAchievements);
            return s;
        }
    }

    public static class VipRules
    {
        public const double DefaultVipBaseChance = 0.06;
        public const int DefaultVipMaxPerDay = 2;

        public static double RefreshVipDay(VipState s, double unixSec)
        {
            if (double.IsNaN(unixSec) || unixSec < 0) throw new ArgumentException("VIP: invalid clock");
            double now = Math.Max(unixSec, s.LastClockUnixSec);
            s.LastClockUnixSec = now;
            int day = (int)Math.Floor(now / 86400.0);
            if (day > s.Day)
            {
                s.Day = day;
                s.UsedToday = !string.IsNullOrEmpty(s.PendingCall) ? 1 : 0;
                s.CallsToday = 0;
            }
            if (s.Offer != null && now >= s.Offer.ExpiresUnixSec) s.Offer = null;
            return now;
        }

        public static double VipChance(GameData db, double? explicitChance, double unixSec)
        {
            double baseChance = explicitChance ?? DefaultVipBaseChance;
            if (double.IsNaN(baseChance) || baseChance < 0 || baseChance > 1)
                throw new ArgumentException("VIP: chance must be in [0,1]");
            if (baseChance == 0) return 0;

            var dto = DateTimeOffset.FromUnixTimeSeconds((long)unixSec);
            double secondOfDay = unixSec % 86400.0;
            if (secondOfDay < 0) secondOfDay += 86400.0;
            double weekSec = (int)dto.DayOfWeek * 86400.0 + secondOfDay;

            double add = 0;
            // Weekly recurring: fds_brasa Saturday 48h (+0.04)
            double elapsed = (weekSec - 6 * 86400.0 + 604800.0) % 604800.0;
            if (elapsed < 48 * 3600.0)
            {
                add += 0.04;
            }

            return Math.Max(0.0, Math.Min(1.0, baseChance + add));
        }

        public static bool VipEligible(GameData db, int restaurantIndex)
        {
            var vip = db.CustomerById("vip");
            return db.RestaurantByIndex(restaurantIndex) != null &&
                   vip?.IsVip == true &&
                   restaurantIndex >= vip.MinRestaurant &&
                   DefaultVipMaxPerDay > 0;
        }

        public static string? AdmitVip(GameData db, VipState s, int restaurantIndex, double unixSec, double chance, Func<double> roll)
        {
            if (double.IsNaN(chance) || chance < 0 || chance > 1)
                throw new ArgumentException("VIP: chance must be in [0,1]");
            RefreshVipDay(s, unixSec);
            if (s.Blocked || !VipEligible(db, restaurantIndex)) return null;
            if (!string.IsNullOrEmpty(s.PendingCall))
            {
                s.PendingCall = null;
                return "called";
            }
            if (s.UsedToday >= DefaultVipMaxPerDay || chance <= 0) return null;
            if (roll() >= chance) return null;
            s.UsedToday++;
            return "natural";
        }

        public static VipProgressOutcome ApplyVipProgress(GameData db, VipState s, int served)
        {
            if (served < 0) throw new ArgumentException("VIP: invalid served count");
            s.ServedTotal += served;
            int coins = 0, embers = 0;
            var unlocked = new List<string>();
            if (s.ServedTotal >= 1 && !s.ClaimedAchievements.Contains("vip_1"))
            {
                s.ClaimedAchievements.Add("vip_1");
                unlocked.Add("vip_1");
                coins += 1000;
                embers += 3;
            }
            if (s.ServedTotal >= 25 && !s.ClaimedAchievements.Contains("vip_25"))
            {
                s.ClaimedAchievements.Add("vip_25");
                unlocked.Add("vip_25");
                coins += 15000;
                embers += 30;
            }
            return new VipProgressOutcome { Coins = coins, Embers = embers, Unlocked = unlocked };
        }
    }

    public sealed class VipProgressOutcome
    {
        public int Coins;
        public int Embers;
        public List<string> Unlocked = new List<string>();
    }

    public static class EconomyRules
    {
        public const string StarterChurrasqueiraId = "lata_valente";

        public static PlayerState NewPlayerState()
        {
            var p = new PlayerState
            {
                Offline = NewOfflineState(0),
                Coins = 0,
                Embers = 0,
                Xp = 0,
                Level = 1,
                RestaurantIndex = 0,
                ChurrasqueiraId = StarterChurrasqueiraId,
                LastSeenUnixSec = 0,
                Vip = new VipState()
            };
            p.ChurrasqueiraLevels[StarterChurrasqueiraId] = 1;
            p.Counters["restaurantsUnlocked"] = 1;
            return p;
        }

        // ── Formulas (data.ts) ──────────────────────────────────────────────

        public static double UpgradeCost(double baseCost, double growth, int level)
        {
            if (level < 1) return 0;
            double raw = baseCost * Math.Pow(growth, level - 1);
            return MathUtil.RoundHalfUp(raw / 10.0) * 10.0;
        }

        public static double XpForLevel(int level, double a, double exponent, double minPerLevel)
        {
            if (level < 1) return minPerLevel;
            return Math.Max(minPerLevel, MathUtil.RoundHalfUp(a * Math.Pow(level, exponent)));
        }

        public static int LevelForXp(double xp, double a, double exponent, double minPerLevel, int maxLevel)
        {
            int level = 1;
            double remaining = xp;
            while (level < maxLevel)
            {
                double need = XpForLevel(level, a, exponent, minPerLevel);
                if (remaining < need) break;
                remaining -= need;
                level++;
            }
            return level;
        }

        public static double LevelUpCoinReward(double baseReward, double exponent, int level)
        {
            return MathUtil.RoundHalfUp(baseReward * Math.Pow(Math.Max(1, level), exponent));
        }

        // ── Upgrades ────────────────────────────────────────────────────────

        public static int UpgradeLevel(PlayerState p, string trackId)
        {
            return p.UpgradeLevels.TryGetValue(trackId, out var lv) ? lv : 0;
        }

        public static double CostFor(GameData data, string trackId, int currentLevel)
        {
            var t = data.UpgradeById(trackId);
            if (t == null) return double.PositiveInfinity;
            if (currentLevel >= t.MaxLevel) return double.PositiveInfinity;
            return UpgradeCost(t.BaseCost, t.Growth, currentLevel + 1);
        }

        public static bool CanAfford(PlayerState p, GameData data, string trackId)
        {
            var t = data.UpgradeById(trackId);
            if (t == null) return false;
            int cur = UpgradeLevel(p, trackId);
            if (cur >= t.MaxLevel) return false;
            double cost = UpgradeCost(t.BaseCost, t.Growth, cur + 1);
            return t.Currency == "embers" ? p.Embers >= cost : p.Coins >= cost;
        }

        public static LedgerEntry? BuyUpgrade(GameData data, PlayerState p, string trackId)
        {
            var t = data.UpgradeById(trackId);
            if (t == null) return null;
            int cur = UpgradeLevel(p, trackId);
            if (cur >= t.MaxLevel) return null;
            double cost = UpgradeCost(t.BaseCost, t.Growth, cur + 1);
            bool isEmbers = t.Currency == "embers";
            if (isEmbers)
            {
                if (p.Embers < cost) return null;
                p.Embers -= (long)cost;
            }
            else
            {
                if (p.Coins < cost) return null;
                p.Coins -= (long)cost;
            }
            p.UpgradeLevels[trackId] = cur + 1;
            AddCounter(p, "upgradesPurchased", 1);
            AddCounter(p, isEmbers ? "embersSpentTotal" : "coinsSpentTotal", cost);
            AddCounter(p, "coinsSpentSession", isEmbers ? 0 : cost);
            return new LedgerEntry
            {
                Currency = t.Currency ?? "coins",
                Amount = -cost,
                Source = $"upgrade:{trackId}",
                Balance = isEmbers ? p.Embers : p.Coins
            };
        }

        // ── Restaurants ─────────────────────────────────────────────────────

        public static bool CanUnlockRestaurant(GameData data, PlayerState p, int index)
        {
            var r = data.RestaurantByIndex(index);
            if (r == null) return false;
            if (index != p.RestaurantIndex + 1) return false;
            return p.Level >= r.RequiredLevel && p.Coins >= r.UnlockCostCoins;
        }

        public static bool UnlockRestaurant(GameData data, PlayerState p, int index)
        {
            if (!CanUnlockRestaurant(data, p, index)) return false;
            var r = data.RestaurantByIndex(index)!;
            p.Coins -= r.UnlockCostCoins;
            AddCounter(p, "coinsSpentTotal", r.UnlockCostCoins);
            p.RestaurantIndex = index;
            p.Counters["restaurantsUnlocked"] = index + 1;
            return true;
        }

        // ── Churrasqueira progression ────────────────────────────────────────

        public static List<ChurrasqueirasChurrasqueiras> ChurrasqueirasInOrder(GameData data)
        {
            return (data.Churrasqueiras?.Churrasqueiras ?? new List<ChurrasqueirasChurrasqueiras>())
                .OrderBy(c => c.Index)
                .ToList();
        }

        public static ChurrasqueirasChurrasqueiras? EquippedChurrasqueira(GameData data, PlayerState p)
        {
            var owned = data.ChurrasqueiraById(p.ChurrasqueiraId);
            if (owned != null) return owned;
            return ChurrasqueirasInOrder(data).FirstOrDefault();
        }

        public static ChurrasqueirasChurrasqueirasEvolutions? EquippedEvolution(GameData data, PlayerState p)
        {
            var ch = EquippedChurrasqueira(data, p);
            if (ch == null) return null;
            p.ChurrasqueiraLevels.TryGetValue(ch.Id, out int lv);
            if (lv < 1) lv = 1;
            return ch.Evolutions.FirstOrDefault(e => e.Level == lv) ?? ch.Evolutions.FirstOrDefault();
        }

        public static ChurrasqueiraStep? NextChurrasqueiraStep(GameData data, PlayerState p)
        {
            var ch = EquippedChurrasqueira(data, p);
            if (ch == null) return null;
            p.ChurrasqueiraLevels.TryGetValue(ch.Id, out int lv);
            if (lv < 1) lv = 1;
            var nextEvo = ch.Evolutions.FirstOrDefault(e => e.Level == lv + 1);
            if (nextEvo != null)
            {
                return new ChurrasqueiraStep
                {
                    Kind = "evolve",
                    Id = ch.Id,
                    ToLevel = nextEvo.Level,
                    CostCoins = nextEvo.CostCoins,
                    CostEmbers = 0
                };
            }
            var all = ChurrasqueirasInOrder(data);
            var next = all.FirstOrDefault(c => c.Index == ch.Index + 1);
            if (next == null) return null;
            if (p.Level < next.UnlockLevel) return null;
            return new ChurrasqueiraStep
            {
                Kind = "unlock",
                Id = next.Id,
                CostCoins = next.UnlockCostCoins,
                CostEmbers = 0
            };
        }

        public static double NextChurrasqueiraCost(GameData data, PlayerState p)
        {
            var step = NextChurrasqueiraStep(data, p);
            return step != null ? step.CostCoins : double.PositiveInfinity;
        }

        public static LedgerEntry? EvolveChurrasqueira(GameData data, PlayerState p)
        {
            var step = NextChurrasqueiraStep(data, p);
            if (step == null || step.Kind != "evolve") return null;
            if (p.Coins < step.CostCoins || p.Embers < step.CostEmbers) return null;
            p.Coins -= step.CostCoins;
            p.Embers -= step.CostEmbers;
            p.ChurrasqueiraLevels[step.Id] = step.ToLevel;
            AddCounter(p, "churrasqueiraEvolutions", 1);
            if (step.CostCoins > 0)
            {
                AddCounter(p, "coinsSpentTotal", step.CostCoins);
                AddCounter(p, "coinsSpentSession", step.CostCoins);
            }
            if (step.CostEmbers > 0)
            {
                AddCounter(p, "embersSpentTotal", step.CostEmbers);
            }
            if (step.CostCoins == 0 && step.CostEmbers > 0)
            {
                return new LedgerEntry
                {
                    Currency = "embers",
                    Amount = -step.CostEmbers,
                    Source = $"churrasqueira_evolve:{step.Id}",
                    Balance = p.Embers
                };
            }
            return new LedgerEntry
            {
                Currency = "coins",
                Amount = -step.CostCoins,
                Source = $"churrasqueira_evolve:{step.Id}",
                Balance = p.Coins
            };
        }

        public static LedgerEntry? UnlockChurrasqueira(GameData data, PlayerState p, string id)
        {
            var step = NextChurrasqueiraStep(data, p);
            if (step == null || step.Kind != "unlock" || step.Id != id) return null;
            var next = data.ChurrasqueiraById(id);
            if (next == null || p.Level < next.UnlockLevel || p.Coins < step.CostCoins) return null;
            p.Coins -= step.CostCoins;
            p.ChurrasqueiraId = id;
            p.ChurrasqueiraLevels[id] = 1;
            AddCounter(p, "churrasqueirasUnlocked", 1);
            AddCounter(p, "coinsSpentTotal", step.CostCoins);
            AddCounter(p, "coinsSpentSession", step.CostCoins);
            return new LedgerEntry
            {
                Currency = "coins",
                Amount = -step.CostCoins,
                Source = $"churrasqueira_unlock:{id}",
                Balance = p.Coins
            };
        }

        public static LedgerEntry? BuyNextChurrasqueira(GameData data, PlayerState p)
        {
            var step = NextChurrasqueiraStep(data, p);
            if (step == null) return null;
            return step.Kind == "evolve" ? EvolveChurrasqueira(data, p) : UnlockChurrasqueira(data, p, step.Id);
        }

        // ── Offline System (offline.ts) ──────────────────────────────────────

        public static OfflineState NewOfflineState(double now = 0)
        {
            return new OfflineState
            {
                Version = 1,
                Disabled = false,
                HighWater = now,
                NextId = 1,
                NextBatchAt = 0,
                Anchor = null,
                Batch = null,
                LastReceipt = null
            };
        }

        public static OfflineSnapshot OfflineSnapshot(GameData db, PlayerState p)
        {
            var idle = db.Economy.Idle;
            int caixaLevel = UpgradeLevel(p, "caixa");
            var cashier = db.Employees?.Roles?.FirstOrDefault(r => r.Id == "caixa")?.Abilities?.FirstOrDefault(a => a.Level == caixaLevel);
            double deltaGerente = db.UpgradeById("gerente")?.Effect?.Delta ?? 0.0;
            double deltaLogistica = db.UpgradeById("imperio_logistica")?.Effect?.Delta ?? 0.0;
            double mult = 1.0 + UpgradeLevel(p, "gerente") * deltaGerente + UpgradeLevel(p, "imperio_logistica") * deltaLogistica + (cashier?.OfflineRateBonus ?? 0.0);

            double coinsPerMin = (idle.CoinsPerMinuteByRestaurant != null && p.RestaurantIndex < idle.CoinsPerMinuteByRestaurant.Count)
                ? idle.CoinsPerMinuteByRestaurant[p.RestaurantIndex] : 0.0;
            double xpPerMin = (idle.XpPerMinuteByRestaurant != null && p.RestaurantIndex < idle.XpPerMinuteByRestaurant.Count)
                ? idle.XpPerMinuteByRestaurant[p.RestaurantIndex] : 0.0;

            bool eligible = db.RestaurantByIndex(p.RestaurantIndex) != null && p.RestaurantIndex >= idle.UnlockRestaurantIndex;

            return new OfflineSnapshot
            {
                RestaurantIndex = p.RestaurantIndex,
                Eligible = eligible,
                CoinsPerMinute = coinsPerMin,
                XpPerMinute = xpPerMin,
                Multiplier = mult,
                AutoMinutes = (cashier?.AutoOfflineHours ?? 0.0) * 60.0,
                MaxMinutes = idle.MaxOfflineHours * 60.0,
                RampMinutes = idle.RampInMinutes,
                CooldownSec = idle.MinCollectIntervalMin * 60.0
            };
        }

        public static OfflineCreditResult OfflineCredit(OfflineSnapshot snapshot, double minutes, double remaining = double.NaN)
        {
            if (double.IsNaN(remaining)) remaining = snapshot.MaxMinutes;
            double m = snapshot.Eligible && minutes >= 0 && !double.IsNaN(minutes)
                ? Math.Max(0.0, Math.Min(minutes, Math.Min(remaining, snapshot.MaxMinutes)))
                : 0.0;
            double factor = 0.5 + 0.5 * Math.Min(1.0, snapshot.RampMinutes > 0 ? m / snapshot.RampMinutes : 1.0);
            return new OfflineCreditResult
            {
                Minutes = m,
                Coins = m * snapshot.CoinsPerMinute * factor * snapshot.Multiplier,
                Xp = m * snapshot.XpPerMinute * factor * snapshot.Multiplier
            };
        }

        public static OfflineTransaction BeginOfflineAbsence(GameData db, PlayerState p, double now)
        {
            var owner = p.Clone();
            owner.Offline.HighWater = Math.Max(owner.Offline.HighWater, now);
            var s = owner.Offline;
            if (!s.Disabled && s.Anchor == null)
            {
                s.Anchor = new OfflineAnchor { At = s.HighWater, Snapshot = OfflineSnapshot(db, p) };
            }
            return new OfflineTransaction { Owner = owner, Receipt = null };
        }

        private static OfflineReceipt? Settle(GameData db, PlayerState owner, double now, string part)
        {
            var s = owner.Offline;
            var b = s.Batch;
            if (s.Disabled || s.Anchor != null || b == null || now < s.HighWater || now < b.AvailableAt) return null;
            bool fullyAuto = b.AutoMinutes >= b.Minutes - 1e-9;
            bool closing = part == "manual" || fullyAuto;
            long totalCoins = (long)MathUtil.RoundHalfUp(b.CoinsRaw);
            long totalXp = (long)MathUtil.RoundHalfUp(b.XpRaw);
            long coins = (closing ? totalCoins : (long)Math.Floor(b.AutoCoinsRaw)) - b.PaidCoins;
            long xp = (closing ? totalXp : (long)Math.Floor(b.AutoXpRaw)) - b.PaidXp;
            if (part == "auto" && (b.AutoMinutes <= 0 || (coins <= 0 && xp <= 0))) return null;
            if (coins < 0 || xp < 0) throw new InvalidOperationException("offline conservation violation");

            owner.Coins += coins;
            AddCounter(owner, "offlineCoins", coins);
            AddCounter(owner, "offlineXp", xp);
            AddCounter(owner, "coinsEarnedTotal", coins);
            var levels = GrantExperience(db, owner, xp);
            b.PaidCoins += coins;
            b.PaidXp += xp;
            if (b.SettledAt == null)
            {
                b.SettledAt = now;
                s.NextBatchAt = now + b.CooldownSec;
            }
            var receipt = new OfflineReceipt
            {
                Id = b.Id,
                Part = part,
                At = now,
                Minutes = b.Minutes,
                OfflineCoins = coins,
                OfflineXp = xp,
                LevelCoins = levels.LevelUpCoins,
                LevelEmbers = levels.LevelUpEmbers,
                LevelsGained = levels.LevelsGained
            };
            s.LastReceipt = receipt;
            if (closing) s.Batch = null;
            return receipt;
        }

        public static OfflineTransaction ReturnFromOffline(GameData db, PlayerState p, double now)
        {
            var owner = p.Clone();
            owner.Offline.HighWater = Math.Max(owner.Offline.HighWater, now);
            var s = owner.Offline;
            if (s.Disabled) return new OfflineTransaction { Owner = owner, Receipt = null };
            var anchor = s.Anchor;
            s.Anchor = null;
            if (anchor != null && now >= anchor.At)
            {
                var x = anchor.Snapshot;
                double rem = x.MaxMinutes - (s.Batch?.Minutes ?? 0.0);
                var credit = OfflineCredit(x, (now - anchor.At) / 60.0, rem);
                if (credit.Minutes > 0)
                {
                    var b = s.Batch ?? new OfflineBatch
                    {
                        Id = s.NextId++,
                        Minutes = 0,
                        AutoMinutes = 0,
                        CoinsRaw = 0,
                        XpRaw = 0,
                        AutoCoinsRaw = 0,
                        AutoXpRaw = 0,
                        PaidCoins = 0,
                        PaidXp = 0,
                        AvailableAt = s.NextBatchAt,
                        SettledAt = null,
                        CooldownSec = x.CooldownSec
                    };
                    double auto = Math.Min(credit.Minutes, Math.Max(0.0, x.AutoMinutes - b.AutoMinutes));
                    double share = auto / credit.Minutes;
                    b.Minutes += credit.Minutes;
                    b.AutoMinutes += auto;
                    b.CoinsRaw += credit.Coins;
                    b.XpRaw += credit.Xp;
                    b.AutoCoinsRaw += credit.Coins * share;
                    b.AutoXpRaw += credit.Xp * share;
                    s.Batch = b;
                }
            }
            return new OfflineTransaction { Owner = owner, Receipt = Settle(db, owner, now, "auto") };
        }

        public static OfflineTransaction ClaimOffline(GameData db, PlayerState p, int id, double now)
        {
            var owner = p.Clone();
            owner.Offline.HighWater = Math.Max(owner.Offline.HighWater, now);
            return new OfflineTransaction
            {
                Owner = owner,
                Receipt = owner.Offline.Batch?.Id == id ? Settle(db, owner, now, "manual") : null
            };
        }

        public static OfflineEarnings ComputeOfflineEarnings(GameData db, PlayerState p, double elapsedSec, double nowSec)
        {
            var snapshot = OfflineSnapshot(db, p);
            var credit = OfflineCredit(snapshot, elapsedSec / 60.0);
            return new OfflineEarnings(
                MathUtil.RoundHalfUp(credit.Minutes),
                MathUtil.RoundHalfUp(credit.Coins),
                MathUtil.RoundHalfUp(credit.Xp),
                snapshot.Eligible && elapsedSec / 60.0 > snapshot.MaxMinutes
            );
        }

        // ── Level progression & Turn application ─────────────────────────────

        public static GrantExperienceOutcome GrantExperience(GameData db, PlayerState p, double amount)
        {
            if (double.IsNaN(amount) || amount < 0) throw new ArgumentException("invalid experience");
            var econ = db.Economy;
            var ledger = new List<LedgerEntry>();
            int levelsGained = 0;
            double levelUpCoins = 0;
            double levelUpEmbers = 0;
            double xp = p.Xp + amount;
            var f = econ.Xp.Formula;
            int level = p.Level;
            while (level < econ.Xp.MaxLevel)
            {
                double need = XpForLevel(level, f.A, f.Exponent, f.MinPerLevel);
                if (xp < need) break;
                xp -= need;
                level++;
                levelsGained++;
                levelUpCoins += LevelUpCoinReward(econ.Reward.LevelUpCoins.Base, econ.Reward.LevelUpCoins.Exponent, level);
                if (level % econ.Reward.LevelUpEmbers.Every == 0)
                {
                    levelUpEmbers += econ.Reward.LevelUpEmbers.Amount;
                }
            }
            p.Xp = xp;
            p.Level = level;
            if (levelUpCoins > 0)
            {
                p.Coins += (long)levelUpCoins;
                ledger.Add(new LedgerEntry { Currency = "coins", Amount = levelUpCoins, Source = "level_up", Balance = p.Coins });
                AddCounter(p, "coinsEarnedTotal", levelUpCoins);
            }
            if (levelUpEmbers > 0)
            {
                p.Embers += (long)levelUpEmbers;
                ledger.Add(new LedgerEntry { Currency = "embers", Amount = levelUpEmbers, Source = "level_up", Balance = p.Embers });
            }
            return new GrantExperienceOutcome
            {
                LevelsGained = levelsGained,
                LevelUpCoins = levelUpCoins,
                LevelUpEmbers = levelUpEmbers,
                Ledger = ledger
            };
        }

        public static ApplyTurnResultOutcome ApplyTurnResult(GameData db, PlayerState p, TurnResult r)
        {
            var ledger = new List<LedgerEntry>();
            p.Coins += r.Coins;
            ledger.Add(new LedgerEntry { Currency = "coins", Amount = r.Coins, Source = "turn", Balance = p.Coins });
            AddCounter(p, "coinsEarnedTotal", r.Coins);
            AddCounter(p, "coinsEarnedSession", r.Coins);
            AddCounter(p, "turnsPlayed", 1);
            AddCounter(p, "perfectCooks", r.Counters.PerfectCooks);
            AddCounter(p, "burnedFood", r.Counters.BurnedFood);
            AddCounter(p, "customersServed", r.Counters.CustomersServed);
            AddCounter(p, "ordersCompleted", r.Counters.OrdersCompleted);
            AddCounter(p, "vipServed", r.Counters.VipServed);

            p.Counters.TryGetValue("bestCombo", out double curBest);
            AddCounter(p, "bestCombo", Math.Max(curBest, r.Counters.BestCombo) - curBest);
            if (r.Counters.Flawless && r.Counters.CustomersLost == 0) AddCounter(p, "flawlessTurns", 1);

            var xpOutcome = GrantExperience(db, p, r.Xp);
            ledger.AddRange(xpOutcome.Ledger);

            return new ApplyTurnResultOutcome
            {
                CoinsEarned = r.Coins,
                XpEarned = r.Xp,
                LevelsGained = xpOutcome.LevelsGained,
                LevelUpRewardCoins = xpOutcome.LevelUpCoins,
                LevelUpRewardEmbers = xpOutcome.LevelUpEmbers,
                Ledger = ledger
            };
        }

        public static void AddCounter(PlayerState p, string key, double delta)
        {
            p.Counters.TryGetValue(key, out double cur);
            p.Counters[key] = cur + delta;
        }

        public static void AddFoodCounter(PlayerState p, string ingredientId, string kind, double delta = 1)
        {
            AddCounter(p, $"food.{ingredientId}.{kind}", delta);
        }
    }
}
