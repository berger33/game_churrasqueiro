// CHURRASCO! O Mestre da Brasa — AI player policy.
//
// EXACT port of tools/sim-core/src/policy.ts.
// Implements the same heuristics, latency modeling, perception noise and
// zone optimization used by the balance harness and golden vectors.

#nullable enable
using System;
using System.Collections.Generic;
using System.Linq;
using Churrasco.Core.Generated;

namespace Churrasco.Core
{
    public sealed class SkillPolicyOptions
    {
        public double Skill = 0.55;
        public double? ReactionSec;
        public bool PerfectOnly;
    }

    public sealed class SkillPolicy : ITurnPolicy
    {
        public double Skill { get; }
        public double ReactionSec { get; }
        public double Latency { get; }
        public double PerceptionQuant { get; }
        public bool PerfectOnly { get; }
        private readonly Rng _rng;

        public SkillPolicy(Rng rng, SkillPolicyOptions options)
        {
            Skill = MathUtil.Clamp01(options.Skill);
            ReactionSec = options.ReactionSec ?? (0.5 - Skill * 0.3);
            Latency = ReactionSec;
            PerceptionQuant = 0.08 - Skill * 0.045;
            PerfectOnly = options.PerfectOnly;
            _rng = rng;
        }

        public static double OptimalFlipPoint(double target, int sides, double carryover)
        {
            return target / (1.0 + (sides - 1) * carryover);
        }

        public static double OptimalCookDuration(double target, int sides, double carryover, double ratePerSec)
        {
            if (ratePerSec <= 0) return double.PositiveInfinity;
            return (target * sides) / (1.0 + (sides - 1) * carryover) / ratePerSec;
        }

        public void Act(ITurnActions a)
        {
            var db = a.Db;
            double carry = db.Ingredients.Shared.CarryoverRate;
            var foods = a.Foods;
            var customers = a.Customers;
            var zones = a.Grill.Zones;
            int slotsPerZone = a.Grill.Stats.SlotsPerZone;
            int prepFree = a.PrepSlotsFree;

            // 1. Keep the fire alive
            if (a.Grill.CharcoalT > 0.9 && a.Grill.Refilling <= 0 && a.TimeLeft > 12)
            {
                a.RefillCharcoal();
            }

            // 2. Clear burned food
            for (int i = foods.Count - 1; i >= 0; i--)
            {
                var f = foods[i];
                if (f.Burned && !f.Served) a.Discard(f);
            }

            // 3. Every outstanding order line needs something cooking
            for (int ci = 0; ci < customers.Count; ci++)
            {
                var c = customers[ci];
                if (c.State != "waiting") continue;
                for (int li = 0; li < c.Lines.Count; li++)
                {
                    var line = c.Lines[li];
                    if (line.FulfilledBy.Count > 0) continue;
                    bool alreadyCooking = false;
                    for (int fi = 0; fi < foods.Count; fi++)
                    {
                        var f = foods[fi];
                        if (f.Served || f.Burned) continue;
                        if (f.Ingredient.Id != line.IngredientId) continue;
                        if (f.OnGrill || f.Ingredient.CookMethod == "prep")
                        {
                            alreadyCooking = true;
                            break;
                        }
                    }
                    if (alreadyCooking) continue;
                    var ing = db.IngredientById(line.IngredientId);
                    if (ing == null) continue;
                    if (a.StockRemaining(ing.Id) <= 0) { a.RefillStock(); continue; }
                    if (ing.CookMethod == "prep")
                    {
                        if (prepFree <= 0) continue;
                        var f = a.Spawn(ing);
                        if (a.StartPrep(f)) prepFree--;
                        else a.Discard(f);
                        continue;
                    }
                    int targetZone = ZoneIndex(a, ing.IdealZone);
                    int zone = PickZoneFast(zones, slotsPerZone, targetZone);
                    if (zone >= 0)
                    {
                        var f = a.Spawn(ing);
                        if (!a.Place(f, zone)) a.Discard(f);
                    }
                }
            }

            // 4. Flip and correct zone
            for (int fi = 0; fi < foods.Count; fi++)
            {
                var f = foods[fi];
                if (!f.OnGrill || f.Burned || f.Served) continue;
                var ing = f.Ingredient;
                if (ing.CookMethod != "grill") continue;
                double target = TargetFor(a, f);
                double flipAt = OptimalFlipPoint(target, ing.Sides, carry) * (1.0 + Jitter(0.12));
                double downDoneness = f.DownSide < f.Sides.Length ? f.Sides[f.DownSide] : 0.0;
                if (ing.FlipNeeded && downDoneness >= flipAt && f.Flips < ing.Sides - 1)
                {
                    a.Flip(f);
                }

                int ideal = ZoneIndex(a, ing.IdealZone);
                if (Skill > 0.55 && ideal >= 0 && f.ZoneIndex != ideal && zones[ideal].Items.Count < slotsPerZone)
                {
                    a.Move(f, ideal);
                }
            }

            // 5. Serve
            for (int ci = 0; ci < customers.Count; ci++)
            {
                var c = customers[ci];
                if (c.State != "waiting") continue;
                for (int li = 0; li < c.Lines.Count; li++)
                {
                    var line = c.Lines[li];
                    if (line.FulfilledBy.Count > 0) continue;
                    double target = line.Target > 0 ? line.Target : DefaultTarget(a, line.IngredientId);
                    FoodRuntime? best = null;
                    double bestErr = double.PositiveInfinity;
                    for (int fi = 0; fi < foods.Count; fi++)
                    {
                        var f = foods[fi];
                        if (f.Served || f.Burned) continue;
                        if (f.Ingredient.Id != line.IngredientId) continue;
                        if (!f.OnGrill && f.Ingredient.CookMethod != "prep") continue;
                        double err = Math.Abs(CookingRules.OverallDoneness(f) - target);
                        if (err < bestErr)
                        {
                            bestErr = err;
                            best = f;
                        }
                    }
                    if (best == null) continue;
                    double d = CookingRules.OverallDoneness(best);
                    double rate = RateOf(a, best);
                    double releaseAt = target - rate * Latency + PerceptionNoise();
                    bool almostBurning = false;
                    for (int si = 0; si < best.Sides.Length; si++)
                    {
                        if (best.Sides[si] > 1.05) { almostBurning = true; break; }
                    }
                    if (d >= releaseAt || (almostBurning && d > target * 0.8))
                    {
                        if (Latency > 0) a.ServeDelayed(c, best, Latency);
                        else a.Serve(c, best);
                    }
                }
            }
        }

        private int ZoneIndex(ITurnActions a, string id)
        {
            return CookingRules.RuntimeZoneIndex(a.Grill, a.Db, id);
        }

        private double RateOf(ITurnActions a, FoodRuntime f)
        {
            if (f.ZoneIndex < 0) return 0.1;
            double heat = CookingRules.EffectiveHeat(a.Grill, f.ZoneIndex, a.Db);
            return (heat * f.Ingredient.HeatRate * a.Grill.Stats.HeatRampRate) / f.Ingredient.SideCookSec;
        }

        private int PickZoneFast(List<GrillZoneRuntime> zones, int slotsPerZone, int idealIdx)
        {
            if (idealIdx >= 0 && _rng.Next() <= Skill)
            {
                if (zones[idealIdx].Items.Count < slotsPerZone) return idealIdx;
                for (int i = zones.Count - 1; i >= 0; i--)
                {
                    if (i != idealIdx && zones[i].Items.Count < slotsPerZone) return i;
                }
                return -1;
            }
            _rng.Next();
            int order = zones.Count;
            for (int attempt = 0; attempt < order; attempt++)
            {
                int i = (int)Math.Floor(_rng.Next() * order);
                if (zones[i].Items.Count < slotsPerZone) return i;
            }
            return -1;
        }

        private double Jitter(double magnitude)
        {
            return (_rng.Next() * 2.0 - 1.0) * magnitude * (1.0 - Skill * 0.7);
        }

        private double PerceptionNoise()
        {
            double quant = PerceptionQuant;
            double coarse = (_rng.Next() * 2.0 - 1.0) * quant;
            double spread = (_rng.Next() * 2.0 - 1.0) * (0.032 + (1.0 - Skill) * 0.06);
            return coarse + spread;
        }

        private double TargetFor(ITurnActions a, FoodRuntime f)
        {
            for (int ci = 0; ci < a.Customers.Count; ci++)
            {
                var c = a.Customers[ci];
                if (c.State != "waiting") continue;
                for (int li = 0; li < c.Lines.Count; li++)
                {
                    var l = c.Lines[li];
                    if (l.IngredientId == f.Ingredient.Id && l.FulfilledBy.Count == 0 && l.Target > 0)
                        return l.Target;
                }
            }
            return DefaultTarget(a, f.Ingredient.Id);
        }

        private double DefaultTarget(ITurnActions a, string ingredientId)
        {
            var ing = a.Db.IngredientById(ingredientId);
            if (ing == null) return 0.8;
            return (ing.PerfectWindow[0] + ing.PerfectWindow[1]) / 2.0;
        }
    }
}
