#nullable enable
using System;
using System.Collections.Generic;
using Churrasco.Core.Generated;

namespace Churrasco.Core
{
    /// <summary>
    /// What the simulation hands the actor each tick: the hot lists, the clock and the verbs.
    /// The TypeScript reference builds this as a fresh object of closures (<c>TurnActions</c>);
    /// here <see cref="TurnSimulation"/> implements it directly, which keeps the per-frame
    /// allocation at zero — the same reason the turn loop compacts in place.
    /// </summary>
    public interface ITurnPolicy
    {
        void Act(TurnSimulation a);
    }

    /// <summary>
    /// Bot policy: plays a turn like a human of a given skill, which is what lets the balance harness
    /// answer "is this level beatable by a good-but-not-perfect player?". Balance numbers come from
    /// actually playing the sim with this policy across the skill axis, not from guesswork.
    ///
    /// Direct transcription of <c>tools/sim-core/src/policy.ts</c>. Two things about it are load
    /// bearing and easy to "tidy" away:
    ///
    ///  * the policy owns its RNG and consumes draws in a fixed order — <c>pickZoneFast</c> burns a
    ///    draw on the skill test and another one even when it falls through to the random loop. Move
    ///    one call and every golden turn vector changes;
    ///  * no step returns early. A tick can fuel, discard, place, flip *and* serve, because that is
    ///    what a competent human does inside one 60 ms frame of the model.
    /// </summary>
    public sealed class SkillPolicy : ITurnPolicy
    {
        private readonly double _skill;
        /** Seconds of reaction lag before acting on new information. */
        private readonly double _latency;
        /** Granularity of the visual doneness cue. */
        private readonly double _perceptionQuant;
        private readonly Rng _rng;

        public SkillPolicy(Rng rng, double skill)
        {
            _rng = rng;
            _skill = MathUtil.Clamp01(skill);
            // skill 1.0 = an excellent human, not a frame-perfect bot: the modelled lag falls from
            // 0.5 s to 0.2 s, and at full skill the latency term is still nonzero.
            _latency = 0.5 - _skill * 0.3;
            _perceptionQuant = 0.08 - _skill * 0.045;
        }

        /// <summary>
        /// Optimal flip point for <paramref name="sides"/> sides with carryover <paramref name="carryover"/>:
        ///   flipAt = T / (1 + (n - 1) * c)
        /// The first flip comes late because the first side gets the whole ramped-up bed; later flips
        /// come earlier as the remaining heat per side falls.
        /// </summary>
        public static double OptimalFlipPoint(double target, int sides, double carryover) =>
            target / (1 + (sides - 1) * carryover);

        /// <summary>Total cook duration: D = T * n / (1 + (n - 1) * c) / ratePerSec.</summary>
        public static double OptimalCookDuration(double target, int sides, double carryover, double ratePerSec)
        {
            if (ratePerSec <= 0) return double.PositiveInfinity;
            return target * sides / (1 + (sides - 1) * carryover) / ratePerSec;
        }

        public void Act(TurnSimulation a)
        {
            var db = a.Db;
            double carry = db.Ingredients.Shared.CarryoverRate;
            var foods = a.Foods;
            var customers = a.Customers;
            var zones = a.Grill.Zones;
            int slotsPerZone = a.Stats.SlotsPerZone;

            // 1. Keep the fire alive.
            if (a.Grill.CharcoalT > 0.9 && a.Grill.Refilling <= 0 && a.TimeLeft > 12) a.RefillCharcoal();

            // 2. Clear burned food — it holds a slot and can never be served.
            for (int i = foods.Count - 1; i >= 0; i--)
            {
                var f = foods[i];
                if (f.Burned && !f.Served) a.Discard(f);
            }

            // 3. Every outstanding order line needs something cooking.
            for (int ci = 0; ci < customers.Count; ci++)
            {
                var c = customers[ci];
                if (c.State != CustomerState.Waiting) continue;
                var lines = c.Lines;
                for (int li = 0; li < lines.Count; li++)
                {
                    var line = lines[li];
                    if (line.FulfilledBy.Count > 0) continue;
                    bool alreadyCooking = false;
                    for (int fi = 0; fi < foods.Count; fi++)
                    {
                        var f = foods[fi];
                        if (f.Served || f.Burned) continue;
                        if (f.Ingredient.Id != line.IngredientId) continue;
                        // Prep items are never on the grill — counting only grilled items made the
                        // policy spawn a fresh one every single tick.
                        if (f.OnGrill || f.Ingredient.CookMethod == "prep")
                        {
                            alreadyCooking = true;
                            break;
                        }
                    }
                    if (alreadyCooking) continue;
                    var ing = db.IngredientById(line.IngredientId);
                    if (ing == null) continue;
                    var f2 = a.TakeFromStock(ing);
                    if (ing.CookMethod == "prep") continue; // prepped off-grill
                    int zone = PickZoneFast(zones, slotsPerZone, ZoneIndex(a, ing.IdealZone));
                    if (zone >= 0) a.Place(f2, zone);
                }
            }

            // 4. Flip, and correct the zone when the player is skilled enough to care.
            for (int fi = 0; fi < foods.Count; fi++)
            {
                var f = foods[fi];
                if (!f.OnGrill || f.Burned || f.Served) continue;
                var ing = f.Ingredient;
                if (ing.CookMethod != "grill") continue;
                double target = TargetFor(a, f);
                double flipAt = OptimalFlipPoint(target, ing.Sides, carry) * (1 + Jitter(0.12));
                if (ing.FlipNeeded && (f.DownSide < f.Sides.Length ? f.Sides[f.DownSide] : 0) >= flipAt
                    && f.Flips < ing.Sides - 1) a.Flip(f);

                int ideal = ZoneIndex(a, ing.IdealZone);
                if (_skill > 0.55 && ideal >= 0 && f.ZoneIndex != ideal && zones[ideal].Items.Count < slotsPerZone)
                    a.Move(f, ideal);
            }

            // 5. Serve — single pass, no allocations.
            for (int ci = 0; ci < customers.Count; ci++)
            {
                var c = customers[ci];
                if (c.State != CustomerState.Waiting) continue;
                var lines = c.Lines;
                for (int li = 0; li < lines.Count; li++)
                {
                    var line = lines[li];
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
                    // A human decides at `d` but the tap lands `latency` seconds later, so they
                    // must release EARLY by rate*latency. Perception is also coarse: doneness is
                    // read from a visual cue, not a number.
                    double releaseAt = target - rate * _latency + PerceptionNoise();
                    bool almostBurning = false;
                    for (int si = 0; si < best.Sides.Length; si++)
                    {
                        if (best.Sides[si] > 1.05)
                        {
                            almostBurning = true;
                            break;
                        }
                    }
                    if (d >= releaseAt || (almostBurning && d > target * 0.8))
                    {
                        if (_latency > 0) a.ServeDelayed(c, best, _latency);
                        else a.Serve(c, best);
                    }
                }
            }
        }

        /// <summary>
        /// Runtime zone index for an ingredient's ideal zone id. Delegates to
        /// <see cref="CookingRules.RuntimeZoneIndex"/> so the policy agrees with the grill it is
        /// actually playing on — churrasqueiras can have fewer zones than <c>db.Grill.Zones</c>.
        /// </summary>
        private static int ZoneIndex(TurnSimulation a, string id) =>
            CookingRules.RuntimeZoneIndex(a.Grill, a.Db, id);

        /// <summary>How fast this item is currently cooking (doneness units per second).</summary>
        private static double RateOf(TurnSimulation a, FoodRuntime f)
        {
            if (f.ZoneIndex < 0) return 0.1;
            // Exactly the heat tickGrill cooks with (zone heat + upgrade bonus, times charcoal
            // efficiency — omit the efficiency and the player serves early). Reading the data table's
            // heatMultiplier instead ignored churrasqueira zone heat, so on an upgraded grill the
            // policy aimed at the wrong flip time.
            double heat = CookingRules.EffectiveHeat(a.Grill, f.ZoneIndex, a.Db);
            return heat * f.Ingredient.HeatRate * a.Stats.HeatRampRate / f.Ingredient.SideCookSec;
        }

        /// <summary>
        /// Zone choice for a freshly spawned item. <paramref name="idealIdx"/> is the *resolved* zone
        /// index for the ingredient's <c>idealZone</c> id (-1 when the ingredient has no preference,
        /// e.g. <c>none</c>). The runtime zone objects carry no id of their own, so comparing against a
        /// field that does not exist made this a dead branch — every item was placed at random
        /// regardless of skill (measured: 31.9 % ideal-zone hits at skill 0.55 versus a 33.3 % chance
        /// baseline).
        /// </summary>
        private int PickZoneFast(List<GrillZoneRuntime> zones, int slotsPerZone, int idealIdx)
        {
            if (idealIdx >= 0 && _rng.Next() <= _skill)
            {
                if (zones[idealIdx].Items.Count < slotsPerZone) return idealIdx;
                for (int i = zones.Count - 1; i >= 0; i--)
                    if (i != idealIdx && zones[i].Items.Count < slotsPerZone) return i;
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

        private double Jitter(double magnitude) =>
            (_rng.Next() * 2 - 1) * magnitude * (1 - _skill * 0.7);

        /// <summary>
        /// Error in reading the visual doneness cue. Combines a coarse perception step (you cannot
        /// eyeball 0.01 doneness units) with a skill-dependent spread.
        /// </summary>
        private double PerceptionNoise()
        {
            double quant = _perceptionQuant;
            double coarse = (_rng.Next() * 2 - 1) * quant;
            double spread = (_rng.Next() * 2 - 1) * (0.032 + (1 - _skill) * 0.06);
            return coarse + spread;
        }

        private double TargetFor(TurnSimulation a, FoodRuntime f)
        {
            var customers = a.Customers;
            for (int ci = 0; ci < customers.Count; ci++)
            {
                var c = customers[ci];
                if (c.State != CustomerState.Waiting) continue;
                var lines = c.Lines;
                for (int li = 0; li < lines.Count; li++)
                {
                    var l = lines[li];
                    if (l.IngredientId == f.Ingredient.Id && l.FulfilledBy.Count == 0 && l.Target > 0)
                        return l.Target;
                }
            }
            return DefaultTarget(a, f.Ingredient.Id);
        }

        private static double DefaultTarget(TurnSimulation a, string ingredientId)
        {
            var ing = a.Db.IngredientById(ingredientId);
            if (ing == null) return 0.8;
            return (ing.PerfectWindow[0] + ing.PerfectWindow[1]) / 2;
        }
    }
}
