#nullable enable
using System;
using System.Collections.Generic;
using Churrasco.Core.Generated;

namespace Churrasco.Core
{
    /// <summary>
    /// The persistent player state — the C# mirror of <c>PlayerState</c> in
    /// <c>tools/sim-core/src/economy.ts</c>. Owned here (not in a SaveSystem file) because the
    /// progression rules that mutate it are the economy's; <c>SaveSystem</c> only serialises it.
    /// </summary>
    public sealed class PlayerState
    {
        public long Coins;
        public long Embers;
        public double Xp;
        public int Level = 1;
        public int RestaurantIndex;
        public Dictionary<string, int> UpgradeLevels = new Dictionary<string, int>(StringComparer.Ordinal);
        /// <summary>Equipped grill id. Empty only on pre-v2 saves, before migrate.</summary>
        public string ChurrasqueiraId = EconomyRules.StarterChurrasqueiraId;
        /// <summary>Evolution 1..3 per owned grill; missing = not owned.</summary>
        public Dictionary<string, int> ChurrasqueiraLevels = new Dictionary<string, int>(StringComparer.Ordinal);
        /// <summary>
        /// Charcoal type from <c>grill.json.charcoal.types</c>. Absent on v2/v3 saves = "comum",
        /// which is the pre-ladder game by construction, so no replayed vector moves.
        /// </summary>
        public string? CharcoalType;
        public Dictionary<string, double> Counters = new Dictionary<string, double>(StringComparer.Ordinal);
        public long LastSeenUnixSec;
    }

    public sealed class LedgerEntry
    {
        public string Currency = "coins";   // "coins" | "embers"
        public double Amount;
        public string Source = "";
        public double Balance;
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

    /// <summary>
    /// Next spend on the grill path: evolve the equipped grill, or unlock the next one.
    /// C# has no unions, so <see cref="Kind"/> is "evolve" / "unlock" — the same two shapes
    /// <c>ChurrasqueiraStep</c> has in TypeScript.
    /// </summary>
    public sealed class ChurrasqueiraStep
    {
        public string Kind = "evolve";
        public string Id = "";
        public int ToLevel;
        public double CostCoins;
        public double CostEmbers;
    }

    /// <summary>
    /// Progression and session accounting. Every method is a transcription of
    /// <c>tools/sim-core/src/economy.ts</c>; where a rounding rule could silently differ from
    /// JavaScript, <see cref="MathUtil.RoundHalfUp"/> is used instead of <c>Math.Round</c>
    /// (banker's rounding would move golden vectors).
    /// </summary>
    public static class EconomyRules
    {
        /// <summary>Index-0 grill in <c>churrasqueiras.json</c>: free, one zone, the FTUE starter.</summary>
        public const string StarterChurrasqueiraId = "lata_valente";

        /// <summary>The type a save gets when it says nothing — identical to the pre-ladder game.</summary>
        public const string DefaultCharcoalType = "comum";

        // ── Formulas (data.ts) ──────────────────────────────────────────────

        /// <summary>Port of <c>upgradeCost</c>: cost of level <paramref name="level"/>, snapped to 10.</summary>
        public static double UpgradeCost(double baseCost, double growth, int level)
        {
            if (level < 1) return 0;
            double raw = baseCost * Math.Pow(growth, level - 1);
            return MathUtil.RoundHalfUp(raw / 10) * 10;
        }

        /// <summary>Port of <c>xpForLevel</c>: XP required to go FROM <paramref name="level"/> to the next.</summary>
        public static double XpForLevel(int level, double a, double exponent, double minPerLevel)
        {
            if (level < 1) return minPerLevel;
            return Math.Max(minPerLevel, MathUtil.RoundHalfUp(a * Math.Pow(level, exponent)));
        }

        /// <summary>Port of <c>levelForXp</c>: level reached with <paramref name="xp"/> cumulative XP.</summary>
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

        /// <summary>
        /// Coins granted on reaching <paramref name="level"/>. Polynomial on purpose — see
        /// docs/06-ECONOMIA.md. Port of <c>levelUpCoinReward</c>.
        /// </summary>
        public static double LevelUpCoinReward(double baseReward, double exponent, int level)
        {
            return MathUtil.RoundHalfUp(baseReward * Math.Pow(Math.Max(1, level), exponent));
        }

        // ── Counters ────────────────────────────────────────────────────────

        public static void AddCounter(PlayerState p, string key, double delta)
        {
            p.Counters.TryGetValue(key, out double cur);
            p.Counters[key] = cur + delta;
        }

        /// <summary>Dot-path counters used by achievements/missions, e.g. <c>food.picanha.perfect</c>.</summary>
        public static void AddFoodCounter(PlayerState p, string ingredientId, string kind, double delta = 1)
        {
            AddCounter(p, "food." + ingredientId + "." + kind, delta);
        }

        public static void NewPlayerState(PlayerState p)
        {
            p.Coins = 0; p.Embers = 0; p.Xp = 0; p.Level = 1; p.RestaurantIndex = 0;
            p.UpgradeLevels.Clear();
            p.ChurrasqueiraId = StarterChurrasqueiraId;
            p.ChurrasqueiraLevels.Clear();
            p.ChurrasqueiraLevels[StarterChurrasqueiraId] = 1;
            p.CharcoalType = DefaultCharcoalType;
            p.Counters.Clear();
            p.LastSeenUnixSec = 0;
        }

        // ── Upgrades and restaurants ───────────────────────────────────────

        /// <summary>Cost of the next level of a track; +∞ when unknown or maxed (the TS returns Infinity).</summary>
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
            p.UpgradeLevels.TryGetValue(trackId, out int level);
            double cost = CostFor(data, trackId, level);
            return (t.Currency == "coins" ? p.Coins : p.Embers) >= cost;
        }

        /// <summary>Buy one level. Returns the ledger entry, or null when it cannot happen.</summary>
        public static LedgerEntry? BuyUpgrade(GameData data, PlayerState p, string trackId)
        {
            var t = data.UpgradeById(trackId);
            if (t == null) return null;
            p.UpgradeLevels.TryGetValue(trackId, out int level);
            if (level >= t.MaxLevel) return null;
            double cost = UpgradeCost(t.BaseCost, t.Growth, level + 1);
            bool coins = t.Currency == "coins";
            if (coins)
            {
                if (p.Coins < cost) return null;
                p.Coins -= (long)cost;
            }
            else
            {
                if (p.Embers < cost) return null;
                p.Embers -= (long)cost;
            }
            p.UpgradeLevels[trackId] = level + 1;
            AddCounter(p, "upgradesPurchased", 1);
            AddCounter(p, coins ? "coinsSpentTotal" : "embersSpentTotal", cost);
            AddCounter(p, "coinsSpentSession", coins ? cost : 0);
            return new LedgerEntry
            {
                Currency = t.Currency,
                Amount = -cost,
                Source = "upgrade:" + trackId,
                Balance = coins ? p.Coins : p.Embers
            };
        }

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
            AddCounter(p, "restaurantsUnlocked", index + 1);
            return true;
        }

        // ── Churrasqueira progression (1F → 2F → 3F → Fornalha) ─────────────

        public static List<ChurrasqueirasChurrasqueiras> ChurrasqueirasInOrder(GameData data)
        {
            var list = new List<ChurrasqueirasChurrasqueiras>();
            var table = data.Churrasqueiras;
            if (table?.Churrasqueiras != null) list.AddRange(table.Churrasqueiras);
            list.Sort((a, b) => a.Index.CompareTo(b.Index));
            return list;
        }

        public static ChurrasqueirasChurrasqueiras? EquippedChurrasqueira(GameData data, PlayerState p)
        {
            var owned = data.ChurrasqueiraById(p.ChurrasqueiraId);
            if (owned != null) return owned;
            var ordered = ChurrasqueirasInOrder(data);
            return ordered.Count > 0 ? ordered[0] : null;
        }

        public static ChurrasqueirasChurrasqueirasEvolutions? EquippedEvolution(GameData data, PlayerState p)
        {
            var ch = EquippedChurrasqueira(data, p);
            if (ch == null) return null;
            p.ChurrasqueiraLevels.TryGetValue(ch.Id, out int lv);
            if (lv <= 0) lv = 1;
            return FindEvolution(ch, lv);
        }

        private static ChurrasqueirasChurrasqueirasEvolutions? FindEvolution(
            ChurrasqueirasChurrasqueiras ch, int level)
        {
            var evos = ch.Evolutions;
            if (evos == null) return null;
            for (int i = 0; i < evos.Count; i++)
                if (evos[i].Level == level) return evos[i];
            return evos.Count > 0 ? evos[0] : null;
        }

        /// <summary>
        /// Next spend on the grill path. You must max the equipped grill (evo 3) before the next
        /// one is offered — same rule the prototype Home CTA uses.
        /// </summary>
        public static ChurrasqueiraStep? NextChurrasqueiraStep(GameData data, PlayerState p)
        {
            var ch = EquippedChurrasqueira(data, p);
            if (ch == null) return null;
            p.ChurrasqueiraLevels.TryGetValue(ch.Id, out int lv);
            if (lv <= 0) lv = 1;
            var nextEvo = ch.Evolutions == null ? null : FindEvolutionExact(ch, lv + 1);
            if (nextEvo != null)
            {
                return new ChurrasqueiraStep
                {
                    Kind = "evolve",
                    Id = ch.Id,
                    ToLevel = nextEvo.Level,
                    CostCoins = nextEvo.CostCoins,
                    // The table has no per-evolution ember price, and the TS reads an optional
                    // `costEmbers ?? 0`; the field stays 0 so no caller invents one.
                    CostEmbers = 0
                };
            }
            var ordered = ChurrasqueirasInOrder(data);
            ChurrasqueirasChurrasqueiras? next = null;
            for (int i = 0; i < ordered.Count; i++)
                if (ordered[i].Index == ch.Index + 1) { next = ordered[i]; break; }
            if (next == null) return null;
            if (p.Level < next.UnlockLevel) return null;
            return new ChurrasqueiraStep { Kind = "unlock", Id = next.Id, CostCoins = next.UnlockCostCoins };
        }

        private static ChurrasqueirasChurrasqueirasEvolutions? FindEvolutionExact(
            ChurrasqueirasChurrasqueiras ch, int level)
        {
            var evos = ch.Evolutions;
            if (evos == null) return null;
            for (int i = 0; i < evos.Count; i++)
                if (evos[i].Level == level) return evos[i];
            return null;
        }

        public static double NextChurrasqueiraCost(GameData data, PlayerState p)
        {
            var step = NextChurrasqueiraStep(data, p);
            return step?.CostCoins ?? double.PositiveInfinity;
        }

        public static LedgerEntry? EvolveChurrasqueira(GameData data, PlayerState p)
        {
            var step = NextChurrasqueiraStep(data, p);
            if (step == null || step.Kind != "evolve") return null;
            if (p.Coins < step.CostCoins) return null;
            if (p.Embers < step.CostEmbers) return null;
            p.Coins -= (long)step.CostCoins;
            p.Embers -= (long)step.CostEmbers;
            p.ChurrasqueiraLevels[step.Id] = step.ToLevel;
            AddCounter(p, "churrasqueiraEvolutions", 1);
            AddCounter(p, "coinsSpentTotal", step.CostCoins);
            AddCounter(p, "coinsSpentSession", step.CostCoins);
            return new LedgerEntry
            {
                Currency = "coins",
                Amount = -step.CostCoins,
                Source = "churrasqueira_evolve:" + step.Id,
                Balance = p.Coins
            };
        }

        public static LedgerEntry? UnlockChurrasqueira(GameData data, PlayerState p, string id)
        {
            var step = NextChurrasqueiraStep(data, p);
            if (step == null || step.Kind != "unlock" || step.Id != id) return null;
            var next = data.ChurrasqueiraById(id);
            if (next == null) return null;
            if (p.Level < next.UnlockLevel) return null;
            if (p.Coins < step.CostCoins) return null;
            p.Coins -= (long)step.CostCoins;
            p.ChurrasqueiraId = id;
            p.ChurrasqueiraLevels[id] = 1;
            AddCounter(p, "churrasqueirasUnlocked", 1);
            AddCounter(p, "coinsSpentTotal", step.CostCoins);
            AddCounter(p, "coinsSpentSession", step.CostCoins);
            return new LedgerEntry
            {
                Currency = "coins",
                Amount = -step.CostCoins,
                Source = "churrasqueira_unlock:" + id,
                Balance = p.Coins
            };
        }

        /// <summary>Buy the next grill step (evolve current, else unlock next) if affordable.</summary>
        public static LedgerEntry? BuyNextChurrasqueira(GameData data, PlayerState p)
        {
            var step = NextChurrasqueiraStep(data, p);
            if (step == null) return null;
            return step.Kind == "evolve" ? EvolveChurrasqueira(data, p) : UnlockChurrasqueira(data, p, step.Id);
        }

        // ── Charcoal (docs/23 §4) ───────────────────────────────────────────

        /// <summary>Can the player use this type? Only past the level the table asks for.</summary>
        public static bool CharcoalTypeUnlocked(GameData data, PlayerState p, string typeId)
        {
            var t = CookingRules.CharcoalTypeFor(data, typeId);
            return t != null && p.Level >= t.UnlockLevel;
        }

        /// <summary>Equip a type. Refuses unknown or not-yet-unlocked ones (the TS returns false).</summary>
        public static bool EquipCharcoalType(GameData data, PlayerState p, string typeId)
        {
            var t = CookingRules.CharcoalTypeFor(data, typeId);
            if (t == null || p.Level < t.UnlockLevel) return false;
            p.CharcoalType = typeId;
            return true;
        }

        // ── Idle / offline ──────────────────────────────────────────────────

        /// <summary>
        /// Offline production, port of <c>computeOfflineEarnings</c>. Linear ramp so short
        /// absences are not over-rewarded, capped at <c>idle.maxOfflineHours</c> (docs/06 §18).
        /// Takes the two state fields it reads instead of a whole <see cref="PlayerState"/> so the
        /// golden vectors can drive it without a save model.
        /// </summary>
        public static OfflineEarnings ComputeOfflineEarnings(
            GameData data, Dictionary<string, int> upgradeLevels, int restaurantIndex, double elapsedSec)
        {
            var idle = data.Economy.Idle;
            if (restaurantIndex <= 0 || elapsedSec <= 0)
                return new OfflineEarnings(0, 0, 0, false);

            // The TS multiplied by `(levels['caixa'] ? 1 : 1)`, a placeholder that always yielded
            // 1; it was dropped here and in the reference in the same commit rather than mirrored.
            double maxSec = idle.MaxOfflineHours * 3600.0;
            bool capped = elapsedSec > maxSec;
            double effective = Math.Min(elapsedSec, maxSec);
            double minutes = effective / 60.0;
            double ramp = MathUtil.Clamp(minutes / idle.RampInMinutes, 0, 1);
            double factor = 0.5 + 0.5 * ramp;   // never below 50 % of the nominal rate
            double perMinCoins = At(idle.CoinsPerMinuteByRestaurant, restaurantIndex);
            double perMinXp = At(idle.XpPerMinuteByRestaurant, restaurantIndex);
            upgradeLevels.TryGetValue("gerente", out int gerenteLevel);
            var gerente = data.UpgradeById("gerente");
            double gerenteMult = 1 + gerenteLevel * (gerente?.Effect?.Delta ?? 0.18);

            return new OfflineEarnings(
                MathUtil.RoundHalfUp(minutes),
                MathUtil.RoundHalfUp(minutes * perMinCoins * factor * gerenteMult),
                MathUtil.RoundHalfUp(minutes * perMinXp * factor * gerenteMult),
                capped);
        }

        /// <summary>Out-of-range reads are 0, the way `list[i] ?? 0` behaves in the reference (the idle tables are shorter than the restaurant list).</summary>
        private static double At(List<int>? values, int index) =>
            values != null && index >= 0 && index < values.Count ? values[index] : 0;

        private static double At(List<double>? values, int index) =>
            values != null && index >= 0 && index < values.Count ? values[index] : 0;

        // ── Session economy accounting ──────────────────────────────────────

        /// <summary>
        /// Faucets/sinks for one session, so <c>coinSpendRatio</c> is measured on the same ledger
        /// the analytics events are built from (docs/06 §7).
        /// </summary>
        public sealed class SessionEconomy
        {
            public Dictionary<string, double> Faucets { get; } = new Dictionary<string, double>(StringComparer.Ordinal);
            public Dictionary<string, double> Sinks { get; } = new Dictionary<string, double>(StringComparer.Ordinal);

            public double FaucetTotal() => Sum(Faucets);
            public double SinkTotal() => Sum(Sinks);
            public double SpendRatio() { double f = Sum(Faucets); return f <= 0 ? 0 : Sum(Sinks) / f; }

            internal static double Sum(Dictionary<string, double> o)
            {
                double t = 0;
                foreach (var kv in o) t += kv.Value;
                return t;
            }
        }

        public static void RecordLedger(SessionEconomy s, IEnumerable<LedgerEntry> entries)
        {
            foreach (var e in entries)
            {
                if (e.Currency != "coins") continue;
                var bucket = e.Amount >= 0 ? s.Faucets : s.Sinks;
                bucket.TryGetValue(e.Source, out double cur);
                bucket[e.Source] = cur + (e.Amount >= 0 ? e.Amount : -e.Amount);
            }
        }
    }
}
