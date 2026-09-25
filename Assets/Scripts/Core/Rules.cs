// CHURRASCO! O Mestre da Brasa — cooking rules (Unity client).
//
// EXACT port of tools/sim-core/src/cooking.ts. That file is the reference
// implementation: it is covered by unit tests and drives the balance simulator.
// tools/golden/vectors.json freezes 98 input->output pairs generated from it, and
// tools/csharp/parity replays the ones this file covers (cooking, flip, scoring,
// effective heat) — every value must match to 1e-9.
//
// Change a formula here, change it there, regenerate the vectors, and the CI
// gates (npm test, npm run check-vectors, npm run check-csharp) must stay green.
//
// Compiled as netstandard2.1 / C# 9 (Unity's profile) with warnings as errors,
// and replayed against tools/golden/vectors.json, by `npm run check-csharp` on
// every PR. Its first run found two divergences, now fixed: StageOf had no
// "rare" band, and ScoreItem rounded halves to even (a 24.5-coin plate paid 24,
// not 25). A third — EffectiveHeat ignoring the runtime zone heat a churrasqueira
// sets — was found reading this file against cooking.ts; no vector covers it
// until the churrasqueira functions are ported with TurnSimulation.cs.

#nullable enable
using System;
using System.Collections.Generic;
using Churrasco.Core.Generated;

namespace Churrasco.Core
{
    // ── Runtime state ───────────────────────────────────────────────────────

    /// <summary>
    /// Per-item cooking state. Mirrors FoodRuntime in cooking.ts field for field.
    /// Pooled at runtime; call <see cref="Reset"/> rather than allocating.
    /// </summary>
    public sealed class FoodRuntime
    {
        public int Uid;
        public IngredientsItems Ingredient = null!;
        /// <summary>Per-side doneness in [0, ~2]. Overall = mean of all sides.</summary>
        public double[] Sides = Array.Empty<double>();
        /// <summary>Index of the side currently facing the coals.</summary>
        public int DownSide;
        /// <summary>-1 = on the bench/tray/prep, otherwise the grill zone index.</summary>
        public int ZoneIndex = -1;
        public bool OnGrill;
        public double TimeOnGrill;
        public int Flips;
        public bool Burned;
        public bool Served;
        /// <summary>0..1 progress for cookMethod == "prep" items.</summary>
        public double PrepProgress;
        public double LastFlipAt;

        public void Reset(IngredientsItems ing, int uid)
        {
            Ingredient = ing;
            Uid = uid;
            int n = ing.Sides;
            if (Sides.Length != n) Sides = new double[n];
            else for (int i = 0; i < n; i++) Sides[i] = 0;
            DownSide = 0;
            ZoneIndex = -1;
            OnGrill = false;
            TimeOnGrill = 0;
            Flips = 0;
            Burned = false;
            Served = false;
            PrepProgress = 0;
            LastFlipAt = 0;
        }
    }

    public sealed class GrillZoneRuntime
    {
        public int Index;
        public double Heat;
        public List<FoodRuntime> Items = new List<FoodRuntime>();
    }

    /// <summary>Mirrors GrillRuntime in cooking.ts.</summary>
    public sealed class GrillRuntime
    {
        public List<GrillZoneRuntime> Zones = new List<GrillZoneRuntime>();
        /// <summary>0..1 progress of the current charcoal load.</summary>
        public double CharcoalT;
        public double CharcoalEfficiency = 1;
        /// <summary>Seconds remaining on a refill; 0 when not refilling.</summary>
        public double Refilling;
        public DerivedStats Stats = null!;
    }

    /// <summary>
    /// Mirrors DerivedStats in cooking.ts — restaurant tier plus upgrade levels
    /// collapsed into the values the simulation actually reads.
    /// </summary>
    public sealed class DerivedStats
    {
        public int SlotsPerZone;
        public int ZoneCount;
        public double HeatStability;
        public double CharcoalDurationSec;
        public double HighZoneBonus;
        public double HeatRampRate;
        public int PrepSlots;
        public double PrepSpeedMult;
        public double TipMult;
        public double ServeSpeedMult;
        public double PatienceMult;
        public int MaxOrdersOnScreen;
        public int Tables;
        public double XpMult;
        public double CustomerSpawnRate;
        public int AutoFlipLevel;
        public int AutoServeLevel;
        public int AutoPrepLevel;
        public double IdleRateMult;
        public int RawStockPerTurn;
    }

    public enum ServeQuality { Perfect, Good, Overcooked, Raw, Burned }

    public sealed class ScoredItem
    {
        public ServeQuality Quality;
        public double Doneness;
        public double Evenness;
        public double WindowLo;
        public double WindowHi;
        public int Coins;
        public int Xp;
    }

    /// <summary>
    /// Payout tuning. Always sourced from economy.json -> reward so money rules
    /// live in exactly one place (mirrors RewardTuning).
    /// </summary>
    public sealed class RewardTuning
    {
        public double OrderBaseTip;
        public double PerfectTipBonus;
        public double SpeedBonusMax;
        public double ComboStep;
        public double ComboCap;
        public double CustomerTipWeight;
    }

    /// <summary>Mirrors ScoreContext.</summary>
    public sealed class ScoreContext
    {
        public double Target;
        public double ToleranceScale = 1;
        public double PatienceRemaining = 1;
        public double Combo;
        public double TipMult = 1;
        public double XpMult = 1;
        public double CustomerTipMult = 1;
        public double EventValueMult = 1;
        public RewardTuning Tuning = null!;
    }

    public static class MathUtil
    {
        public static double Clamp(double v, double lo, double hi) => v < lo ? lo : v > hi ? hi : v;
        public static double Clamp01(double v) => Clamp(v, 0, 1);

        /// <summary>
        /// JavaScript's <c>Math.round</c>: halves round toward +∞ (2.5 → 3, -2.5 → -2).
        /// <c>Math.Round</c> rounds halves to even (2.5 → 2), which is not the rule
        /// the TypeScript reference — and every golden vector — was produced with.
        /// </summary>
        public static double RoundHalfUp(double v)
        {
            if (double.IsNaN(v) || double.IsInfinity(v)) return v;
            double r = Math.Floor(v);
            return v - r >= 0.5 ? r + 1 : r;
        }
    }

    /// <summary>
    /// The cooking model. Every method is a direct transcription of cooking.ts;
    /// the source line is cited where the mapping is not obvious.
    /// </summary>
    public static class CookingRules
    {
        // ── Derived stats ───────────────────────────────────────────────────

        /// <summary>Port of deriveStats(db, restaurant, levels).</summary>
        public static DerivedStats DeriveStats(
            GameData data, RestaurantsRestaurants restaurant, Dictionary<string, int> levels)
        {
            double Get(string trackId)
            {
                if (!levels.TryGetValue(trackId, out var lvl) || lvl <= 0) return 0;
                var track = data.UpgradeById(trackId);
                if (track == null) return 0;
                double delta = track.Effect?.Delta ?? 0;
                return delta * Math.Min(lvl, track.MaxLevel);
            }
            int Level(string trackId) => levels.TryGetValue(trackId, out var l) ? l : 0;

            var r = restaurant;
            return new DerivedStats
            {
                SlotsPerZone = r.Grill.SlotsPerZone + (int)Math.Floor(Get("grill_size")),
                ZoneCount = r.Grill.ZoneCount,
                HeatStability = r.Grill.HeatStability + Get("grill_stability"),
                CharcoalDurationSec = data.Grill.Charcoal.BaseDurationSec
                    * (1 + r.Grill.CharcoalDurationBonus + Get("charcoal_duration")),
                HighZoneBonus = Get("grill_heat"),
                HeatRampRate = 1 + Get("grill_speed"),
                PrepSlots = r.Service.PrepSlots + (int)Math.Floor(Get("board")),
                PrepSpeedMult = 1 + Get("knife"),
                TipMult = 1 + Get("plates") + Get("decor"),
                ServeSpeedMult = 1 + Get("tray"),
                PatienceMult = 1 + Get("patience_charm") + Get("music"),
                MaxOrdersOnScreen = r.Service.MaxOrdersOnScreen + (int)Math.Floor(Get("capacity")),
                Tables = r.Service.Tables + (int)Math.Floor(Get("tables")),
                XpMult = 1 + Get("lighting"),
                CustomerSpawnRate = 1 + Get("sign"),
                // Matches the TS: autoFlipLevel is purely the churrasqueiro level.
                AutoFlipLevel = Level("churrasqueiro"),
                AutoServeLevel = Level("garcom"),
                AutoPrepLevel = Level("auxiliar"),
                IdleRateMult = 1 + Get("gerente"),
                RawStockPerTurn = 6 + (int)Math.Floor(Get("counter"))
            };
        }

        // ── Grill creation ──────────────────────────────────────────────────

        /// <summary>
        /// Port of createGrill(stats, db): one runtime zone per table zone, up to
        /// the derived zone count, each starting at the table's heat multiplier.
        /// </summary>
        public static GrillRuntime CreateGrill(DerivedStats stats, GameData data)
        {
            var g = new GrillRuntime { Stats = stats, CharcoalT = 0, CharcoalEfficiency = 1, Refilling = 0 };
            int count = Math.Min(stats.ZoneCount, data.Grill.Zones.Count);
            for (int i = 0; i < count; i++)
                g.Zones.Add(new GrillZoneRuntime { Index = i, Heat = data.Grill.Zones[i].HeatMultiplier });
            return g;
        }

        // ── Food creation ───────────────────────────────────────────────────

        public static FoodRuntime CreateFood(int uid, IngredientsItems ing)
        {
            var f = new FoodRuntime();
            f.Reset(ing, uid);
            return f;
        }

        // ── Doneness ────────────────────────────────────────────────────────

        /// <summary>overallDoneness(f): mean of all sides.</summary>
        public static double OverallDoneness(FoodRuntime f)
        {
            double sum = 0;
            for (int i = 0; i < f.Sides.Length; i++) sum += f.Sides[i];
            return sum / f.Sides.Length;
        }

        /// <summary>
        /// evenness(f) = min/max side doneness. 1 means perfectly uniform.
        /// NOTE: this is min/max, NOT 1 - (max-min)/max.
        /// </summary>
        public static double Evenness(FoodRuntime f)
        {
            double min = double.PositiveInfinity, max = 0;
            for (int i = 0; i < f.Sides.Length; i++)
            {
                var s = f.Sides[i];
                if (s < min) min = s;
                if (s > max) max = s;
            }
            if (max <= 1e-6) return 1;
            return min / max;
        }

        // ── Grill placement ─────────────────────────────────────────────────

        public static int SlotsFree(GrillRuntime g)
        {
            int cap = g.Stats.SlotsPerZone, free = 0;
            for (int i = 0; i < g.Zones.Count; i++)
                free += Math.Max(0, cap - g.Zones[i].Items.Count);
            return free;
        }

        public static bool ZoneIsFull(GrillRuntime g, int zoneIndex)
        {
            if (zoneIndex < 0 || zoneIndex >= g.Zones.Count) return true;
            return g.Zones[zoneIndex].Items.Count >= g.Stats.SlotsPerZone;
        }

        public static bool PlaceOnGrill(GrillRuntime g, FoodRuntime f, int zoneIndex)
        {
            if (ZoneIsFull(g, zoneIndex)) return false;
            RemoveFromGrill(g, f);
            f.ZoneIndex = zoneIndex;
            f.OnGrill = true;
            g.Zones[zoneIndex].Items.Add(f);
            return true;
        }

        public static void RemoveFromGrill(GrillRuntime g, FoodRuntime f)
        {
            if (!f.OnGrill) return;
            if (f.ZoneIndex >= 0 && f.ZoneIndex < g.Zones.Count)
                g.Zones[f.ZoneIndex].Items.Remove(f);
            f.OnGrill = false;
            f.ZoneIndex = -1;
        }

        /// <summary>
        /// effectiveHeat(g, zoneIndex, db). The top zone gets the full upgrade
        /// bonus; lower zones get a share of it scaled by position. The base is
        /// the runtime zone's heat — a churrasqueira patches it (the FTUE's 1-zone
        /// lata cooks at its heatBase) — and the table value only for a zone the
        /// grill does not have, exactly like the TypeScript.
        /// </summary>
        public static double EffectiveHeat(GrillRuntime g, int zoneIndex, GameData data)
        {
            double baseHeat = zoneIndex >= 0 && zoneIndex < g.Zones.Count
                ? g.Zones[zoneIndex].Heat
                : zoneIndex >= 0 && zoneIndex < data.Grill.Zones.Count
                    ? data.Grill.Zones[zoneIndex].HeatMultiplier
                    : 1;
            int top = g.Zones.Count - 1;
            double bonus = zoneIndex == top
                ? g.Stats.HighZoneBonus
                : g.Stats.HighZoneBonus * (zoneIndex / (double)Math.Max(1, top)) * 0.5;
            return (baseHeat + bonus) * g.CharcoalEfficiency;
        }

        // ── Flip ────────────────────────────────────────────────────────────

        /// <summary>flipFood(g, f, now, db). Cooldown comes from grill.interaction.</summary>
        public static bool FlipFood(GrillRuntime g, FoodRuntime f, double now, GameData data)
        {
            if (!f.OnGrill) return false;
            if (now - f.LastFlipAt < data.Grill.Interaction.FlipCooldownSec) return false;
            f.DownSide = (f.DownSide + 1) % f.Sides.Length;
            f.Flips++;
            f.LastFlipAt = now;
            return true;
        }

        // ── Charcoal ────────────────────────────────────────────────────────

        public static bool StartCharcoalRefill(GrillRuntime g)
        {
            if (g.Refilling > 0) return false;
            g.Refilling = 1e-6; // marker; caller supplies the real duration
            return true;
        }

        public static double CharcoalRefillDuration(GameData data) => data.Grill.Charcoal.RefillTimeSec;

        /// <summary>
        /// sampleCurve(points, t): piecewise-linear interpolation with flat
        /// extension past both ends. Mirrors data.ts.
        /// </summary>
        public static double SampleCurve(List<GrillCharcoalEfficiencyCurve> points, double t)
        {
            if (points == null || points.Count == 0) return 1;
            double c = MathUtil.Clamp01(t);
            if (c <= points[0].T) return points[0].Value;
            var last = points[points.Count - 1];
            if (c >= last.T) return last.Value;
            for (int i = 0; i < points.Count - 1; i++)
            {
                var a = points[i];
                var b = points[i + 1];
                if (c >= a.T && c <= b.T)
                {
                    double span = b.T - a.T;
                    double k = span <= 0 ? 0 : (c - a.T) / span;
                    return a.Value + (b.Value - a.Value) * k;
                }
            }
            return last.Value;
        }

        // ── The authoritative cooking step ──────────────────────────────────

        /// <summary>
        /// tickGrill(g, db, dt, onBurn). The single source of truth for how food
        /// cooks; mirrored exactly by the simulator and the client.
        /// </summary>
        public static void TickGrill(GrillRuntime g, GameData data, double dt, Action<FoodRuntime>? onBurn = null)
        {
            if (g.Refilling > 0)
            {
                g.Refilling -= dt;
                if (g.Refilling <= 0)
                {
                    g.Refilling = 0;
                    g.CharcoalT = 0;
                }
            }
            else
            {
                g.CharcoalT = MathUtil.Clamp01(g.CharcoalT + dt / g.Stats.CharcoalDurationSec);
            }
            g.CharcoalEfficiency = SampleCurve(data.Grill.Charcoal.EfficiencyCurve, g.CharcoalT);

            double carry = data.Ingredients.Shared.CarryoverRate;
            double burnAt = data.Ingredients.Shared.BurnedThreshold;

            for (int zi = 0; zi < g.Zones.Count; zi++)
            {
                var zone = g.Zones[zi];
                if (zone.Items.Count == 0) continue;
                double heat = EffectiveHeat(g, zone.Index, data);
                for (int i = 0; i < zone.Items.Count; i++)
                {
                    var f = zone.Items[i];
                    if (f.Burned) continue;
                    var ing = f.Ingredient;
                    if (ing.CookMethod != "grill" || ing.SideCookSec <= 0) continue;
                    double rate = (heat * ing.HeatRate * g.Stats.HeatRampRate) / ing.SideCookSec;
                    f.TimeOnGrill += dt;
                    for (int s = 0; s < f.Sides.Length; s++)
                    {
                        double k = s == f.DownSide ? 1 : carry;
                        f.Sides[s] += dt * rate * k;
                    }
                    for (int s = 0; s < f.Sides.Length; s++)
                    {
                        if (f.Sides[s] >= burnAt)
                        {
                            f.Burned = true;
                            onBurn?.Invoke(f);
                            break;
                        }
                    }
                }
            }
        }

        // ── Stage ───────────────────────────────────────────────────────────

        /// <summary>
        /// stageOf(db, f). Per-food overrides (garlic bread, coalho) take
        /// precedence; otherwise the shared thresholds decide.
        /// </summary>
        public static string StageOf(GameData data, FoodRuntime f)
        {
            double d = OverallDoneness(f);
            var overrides = f.Ingredient.StageOverrides;
            if (overrides != null && overrides.Count > 0)
            {
                for (int i = 0; i < overrides.Count; i++)
                    if (d < overrides[i].Max) return overrides[i].Id;
                return overrides[overrides.Count - 1].Id;
            }
            var t = data.Ingredients.Shared.StageThresholds;
            if (f.Burned || d >= t.WELL_MAX) return "burned";
            if (d >= t.MEDIUM_MAX) return "well";
            if (d >= t.RARE_MAX) return "medium";
            if (d >= t.RAW_MAX) return "rare"; // was "raw": the rare band did not exist in C# (caught by tools/csharp/parity)
            return "raw";
        }

        // ── Scoring ─────────────────────────────────────────────────────────

        public static RewardTuning RewardTuningOf(GameData data)
        {
            var r = data.Economy.Reward;
            return new RewardTuning
            {
                OrderBaseTip = r.OrderBaseTip,
                PerfectTipBonus = r.PerfectTipBonus,
                SpeedBonusMax = r.SpeedBonusMax,
                ComboStep = r.ComboStep,
                ComboCap = r.ComboCap,
                CustomerTipWeight = r.CustomerTipWeight
            };
        }

        /// <summary>
        /// scoreItem(db, f, ctx). Deterministic and side-effect free.
        ///
        /// Payout identity (economy.json -> reward._note):
        ///   coins = value * satisfaction * (1 + baseTip + perfectBonus*[perfect]
        ///           + speedBonus) * comboMult * tipMult * eventMult
        ///           * (1 + (customerTipMult - 1) * customerTipWeight)
        /// Customer generosity scales a DAMPED tip term, never the whole plate —
        /// otherwise a VIP swings a turn by 6x (a measured bug, docs/06 §8).
        /// </summary>
        public static ScoredItem ScoreItem(GameData data, FoodRuntime f, ScoreContext ctx)
        {
            var ing = f.Ingredient;
            double doneness = OverallDoneness(f);
            double ev = Evenness(f);
            double padding = data.Grill.Scoring.GoodWindowPadding;
            var t = ctx.Tuning;

            double rawLo = ing.PerfectWindow[0];
            double rawHi = ing.PerfectWindow[1];
            double centre = ctx.Target > 0 ? ctx.Target : (rawLo + rawHi) / 2;
            double tol = ctx.ToleranceScale;
            double lo = centre - (centre - rawLo) * tol;
            double hi = centre + (rawHi - centre) * tol;

            ServeQuality quality;
            if (f.Burned || doneness >= data.Ingredients.Shared.BurnedThreshold)
                quality = ServeQuality.Burned;
            else if (doneness >= lo && doneness <= hi
                     && ev >= data.Ingredients.Shared.MinEvennessForPerfect)
                quality = ServeQuality.Perfect;
            else if (doneness >= lo - padding && doneness <= hi + padding)
                quality = ServeQuality.Good;
            else if (doneness < lo - padding)
                quality = ServeQuality.Raw;
            else
                quality = ServeQuality.Overcooked;

            double p = ctx.PatienceRemaining;
            double speedBonus = t.SpeedBonusMax * MathUtil.Clamp01((p - 0.15) / 0.7);
            double comboMult = MathUtil.Clamp(1 + ctx.Combo * t.ComboStep, 1, t.ComboCap);
            double eventMult = ctx.EventValueMult;
            double customerMult = 1 + (ctx.CustomerTipMult - 1) * t.CustomerTipWeight;

            double coins = 0;
            double xp = ing.Xp * ctx.XpMult;

            switch (quality)
            {
                case ServeQuality.Perfect:
                    coins = ing.Value * ing.Satisfaction
                        * (1 + t.OrderBaseTip + t.PerfectTipBonus + speedBonus)
                        * comboMult * ctx.TipMult * eventMult * customerMult;
                    xp *= 1.35;
                    break;
                case ServeQuality.Good:
                    coins = ing.Value * ing.Satisfaction
                        * (1 + t.OrderBaseTip + speedBonus)
                        * comboMult * ctx.TipMult * eventMult * customerMult;
                    break;
                case ServeQuality.Overcooked:
                case ServeQuality.Raw:
                    coins = ing.Value * 0.35;
                    xp *= 0.4;
                    break;
                case ServeQuality.Burned:
                    coins = 0;
                    xp = 0;
                    break;
            }

            return new ScoredItem
            {
                Quality = quality,
                Doneness = doneness,
                Evenness = ev,
                WindowLo = lo,
                WindowHi = hi,
                // JS Math.round, not Math.Round: a 24.5-coin plate pays 25 in the
                // reference and paid 24 here (espetinho_misto, tools/csharp/parity).
                Coins = (int)MathUtil.RoundHalfUp(coins),
                Xp = (int)MathUtil.RoundHalfUp(xp)
            };
        }
    }
}
