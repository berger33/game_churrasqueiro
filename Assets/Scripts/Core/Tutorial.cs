// CHURRASCO! O Mestre da Brasa — the six-step FTUE (Unity client).
//
// Port of tools/sim-core/src/tutorial.ts (docs/05-UX_FLOW.md §4), engine-free:
//
//   TutorialDirector  step machine + analytics (tutorial_start / _step /
//                     _complete / _abandon / _skip), persisted in the save
//                     (SaveGame v3: progress.tutorial + progress.ftueDone)
//   TutorialStates    new / finished / restore-from-save
//   TutorialCoachRules  when the plate is ready to flip / to serve, the hold that
//                     makes the scripted turn impossible to fail, and what the
//                     hand points at next (guided steps and free play)
//   TutorialMask      input masking: which actions each step lets through
//
// Not ported yet: the TypeScript TutorialTurn, which owns a TurnSimulation
// (scripted customers, tick → hold wiring). It is glue over the pieces above
// and waits for TurnSimulation.cs (docs/18-STATUS.md §7). Every number comes
// from shared/data/tutorial.json (generated class: TutorialTable).
//
// tools/csharp/parity replays the TypeScript on the same inputs
// (tools/golden/vectors.json → tutorial): director scenarios, restores, the
// coach rules over a grid of plates, the hand over a recorded FTUE run,
// masking, and the analytics contract.

#nullable enable
using System;
using System.Collections.Generic;
using Churrasco.Core.Generated;

namespace Churrasco.Core
{
    /// <summary>What a step waits for (<c>steps[].completesOn</c> in tutorial.json).</summary>
    public static class TutorialTriggers
    {
        public const string Placed = "placed";
        public const string Flipped = "flipped";
        public const string Served = "served";
        public const string RewardLanded = "reward_landed";
        public const string OrderCompleted = "order_completed";
        public const string UpgradeBought = "upgrade_bought";

        public static readonly string[] All =
            { Placed, Flipped, Served, RewardLanded, OrderCompleted, UpgradeBought };
    }

    /// <summary>Player actions the scripted turn can mask (TS <c>TutorialAction</c>).</summary>
    public static class TutorialActions
    {
        public const string Take = "take";
        public const string Place = "place";
        public const string Move = "move";
        public const string Flip = "flip";
        public const string Serve = "serve";
        public const string Discard = "discard";
        public const string Refill = "refill";
    }

    // ── Persisted state ─────────────────────────────────────────────────────

    /// <summary>
    /// The director's state, as the save stores it (<c>progress.tutorial</c>).
    /// Mirrors TutorialState in tutorial.ts field for field.
    /// </summary>
    public sealed class TutorialState
    {
        public string Variant { get; set; } = "";
        /// <summary>1-based index of the step in progress; steps.Count + 1 once finished.</summary>
        public int Step { get; set; } = 1;
        /// <summary>Highest step index already reported — a resumed run never re-sends it.</summary>
        public int Reported { get; set; }
        /// <summary>Active FTUE time: only accrues while the director is ticked.</summary>
        public double ElapsedMs { get; set; }
        public int Misses { get; set; }
        public bool Started { get; set; }
        public bool Skipped { get; set; }
        /// <summary>Step index the last tutorial_abandon went out for (one per step).</summary>
        public int AbandonedStep { get; set; }

        public TutorialState Copy() => (TutorialState)MemberwiseClone();
    }

    public static class TutorialStates
    {
        public static TutorialState New(TutorialTable table) => new TutorialState { Variant = table.Variant, Step = 1 };

        /// <summary>A player who finished an earlier FTUE (old saves only stored <c>ftueDone</c>).</summary>
        public static TutorialState Finished(TutorialTable table)
        {
            var s = New(table);
            s.Step = table.Steps.Count + 1;
            s.Reported = table.Steps.Count;
            s.Started = true;
            return s;
        }

        /// <summary>
        /// Rebuild the state from whatever the save holds. A missing, out-of-range
        /// or other-variant state starts a fresh run — unless the save says the
        /// FTUE was already done, which always wins (never make a returning
        /// player redo it). Port of restoreTutorialState(); type-level damage
        /// (a string where a number belongs) is the deserialiser's to reject.
        /// </summary>
        public static TutorialState Restore(TutorialTable table, TutorialState? raw, bool legacyDone = false)
        {
            if (legacyDone) return Finished(table);
            int n = table.Steps.Count;
            if (raw == null || raw.Variant != table.Variant) return New(table);
            if (raw.Step < 1 || raw.Step > n + 1 || raw.Reported < 0 || raw.Reported > n) return New(table);
            return new TutorialState
            {
                Variant = table.Variant,
                Step = raw.Step,
                // Reported may run ahead of Step: a replayed turn re-walks reported steps.
                Reported = raw.Reported,
                ElapsedMs = raw.ElapsedMs >= 0 ? raw.ElapsedMs : 0,
                Misses = raw.Misses >= 0 ? raw.Misses : 0,
                Started = raw.Started,
                Skipped = raw.Skipped,
                AbandonedStep = raw.AbandonedStep >= 0 && raw.AbandonedStep <= n + 1 ? raw.AbandonedStep : 0
            };
        }
    }

    // ── Director ────────────────────────────────────────────────────────────

    /// <summary>
    /// Step machine + analytics. Feed it what the player did (<see cref="Report"/>),
    /// tick it while the FTUE is on screen, persist <see cref="State"/>.
    /// </summary>
    public sealed class TutorialDirector
    {
        public TutorialTable Table { get; }
        private readonly Action<AnalyticsEvent> _sink;
        private readonly TutorialState _s;

        public TutorialDirector(TutorialTable table, TutorialState? state, Action<AnalyticsEvent> sink)
        {
            Table = table;
            _sink = sink;
            _s = state != null ? state.Copy() : TutorialStates.New(table);
        }

        /// <summary>A copy — safe to persist.</summary>
        public TutorialState State => _s.Copy();

        public bool Done => _s.Skipped || _s.Step > Table.Steps.Count;

        public TutorialSteps? Current
        {
            get
            {
                if (Done) return null;
                int i = _s.Step - 1;
                return i >= 0 && i < Table.Steps.Count ? Table.Steps[i] : null;
            }
        }

        public double ElapsedMs => _s.ElapsedMs;

        /// <summary>The skip button shows after skip.showAfterSec of FTUE time (docs/21: 2 s).</summary>
        public bool CanSkip => !Done && _s.Started && _s.ElapsedMs >= Table.Skip.ShowAfterSec * 1000.0;

        /// <summary>Idempotent: tutorial_start goes out once per install, not once per attempt.</summary>
        public void Start()
        {
            if (_s.Started || Done) return;
            _s.Started = true;
            Emit("tutorial_start", new Dictionary<string, object> { ["variant"] = Table.Variant });
        }

        public void Tick(double dtSec)
        {
            if (!_s.Started || Done) return;
            _s.ElapsedMs += Math.Max(0, dtSec) * 1000;
        }

        /// <summary>
        /// The player did something. Completes the current step when it is what
        /// the step waits for; anything else is ignored. True if a step completed.
        /// </summary>
        public bool Report(string trigger)
        {
            var step = Current;
            if (step == null || !_s.Started || step.CompletesOn != trigger) return false;
            if (step.Index > _s.Reported)
            {
                if (step.Event == "tutorial_complete")
                {
                    Emit("tutorial_complete", new Dictionary<string, object>
                    {
                        ["duration_ms"] = Ms(),
                        ["misses"] = (long)_s.Misses
                    });
                }
                else
                {
                    Emit("tutorial_step", new Dictionary<string, object>
                    {
                        ["step"] = step.Id,
                        ["step_index"] = (long)step.Index,
                        ["elapsed_ms"] = Ms()
                    });
                }
                _s.Reported = step.Index;
            }
            _s.Step++;
            return true;
        }

        /// <summary>An attempted action that did not do what the step teaches (docs/05 §4.3 "misses").</summary>
        public void Miss()
        {
            if (_s.Started && !Done) _s.Misses++;
        }

        public bool Skip()
        {
            var step = Current;
            if (step == null) return false;
            Emit("tutorial_skip", new Dictionary<string, object>
            {
                ["step"] = step.Id,
                ["step_index"] = (long)step.Index,
                ["elapsed_ms"] = Ms()
            });
            _s.Skipped = true;
            return true;
        }

        /// <summary>The app went to the background mid-FTUE. One event per step, however often it happens.</summary>
        public bool Abandon()
        {
            var step = Current;
            if (step == null || !_s.Started || _s.AbandonedStep == step.Index) return false;
            _s.AbandonedStep = step.Index;
            Emit("tutorial_abandon", new Dictionary<string, object>
            {
                ["step"] = step.Id,
                ["step_index"] = (long)step.Index
            });
            return true;
        }

        /// <summary>
        /// A scripted turn cannot survive the app dying, so a resumed FTUE replays
        /// it from its first step. Reported steps are not re-sent.
        /// </summary>
        public void RestartTurn()
        {
            if (Done) return;
            foreach (var st in Table.Steps)
            {
                if (st.Screen == "play") { _s.Step = st.Index; return; }
            }
        }

        private long Ms() => (long)MathUtil.RoundHalfUp(_s.ElapsedMs);

        private void Emit(string name, Dictionary<string, object> parameters) =>
            _sink(new AnalyticsEvent(name, parameters));
    }

    // ── Coach ───────────────────────────────────────────────────────────────

    public enum CoachKind { Place, Flip, Serve, Discard, Wait }

    /// <summary>
    /// What the hand points at (TS <c>CoachAction</c>). For <see cref="CoachKind.Serve"/>
    /// the caller pairs <see cref="Food"/> with the first waiting customer that
    /// still has an open line for the FTUE ingredient — the one TS picks.
    /// </summary>
    public readonly struct CoachAction
    {
        public CoachKind Kind { get; }
        public FoodRuntime? Food { get; }
        /// <summary>Target zone for <see cref="CoachKind.Place"/>, otherwise -1.</summary>
        public int ZoneIndex { get; }
        /// <summary>0..1 ring progress for <see cref="CoachKind.Wait"/>.</summary>
        public double Progress { get; }

        private CoachAction(CoachKind kind, FoodRuntime? food, int zoneIndex, double progress)
        {
            Kind = kind; Food = food; ZoneIndex = zoneIndex; Progress = progress;
        }

        public static CoachAction Place(int zoneIndex) => new CoachAction(CoachKind.Place, null, zoneIndex, 0);
        public static CoachAction Flip(FoodRuntime f) => new CoachAction(CoachKind.Flip, f, -1, 0);
        public static CoachAction Serve(FoodRuntime f) => new CoachAction(CoachKind.Serve, f, -1, 0);
        public static CoachAction Discard(FoodRuntime f) => new CoachAction(CoachKind.Discard, f, -1, 0);
        public static CoachAction Wait(FoodRuntime? f, double progress) => new CoachAction(CoachKind.Wait, f, -1, progress);
    }

    public static class TutorialCoachRules
    {
        private static double DownSide(FoodRuntime f) =>
            f.DownSide >= 0 && f.DownSide < f.Sides.Length ? f.Sides[f.DownSide] : 0;

        /// <summary>
        /// The face-down side has browned past the prompt threshold — step 2's
        /// readiness. Showing "TOQUE PARA VIRAR" the moment the plate lands is what
        /// made testers flip early and score BOM (docs/20, step 2).
        /// </summary>
        public static bool SideBrowned(TutorialTable table, FoodRuntime f)
        {
            if (!f.OnGrill || f.Burned || f.Served || f.Sides.Length < 2) return false;
            return DownSide(f) >= table.Coach.FlipPromptAtSideDoneness;
        }

        /// <summary>
        /// A flip helps right now: the browned side is the most-done one and the
        /// rest lags behind. The free-play coach (step 5) only suggests flips that
        /// change the outcome.
        /// </summary>
        public static bool FlipReady(GameData data, TutorialTable table, FoodRuntime f)
        {
            if (!SideBrowned(table, f)) return false;
            double down = DownSide(f);
            foreach (var s in f.Sides) if (s > down + 1e-9) return false;
            return CookingRules.Evenness(f) < data.Ingredients.Shared.MinEvennessForPerfect;
        }

        /// <summary>In the perfect window and even enough: a serve now scores PERFEITO.</summary>
        public static bool ServeReady(GameData data, TutorialTable table, FoodRuntime f)
        {
            if (!f.OnGrill || f.Burned || f.Served) return false;
            double d = CookingRules.OverallDoneness(f);
            return d >= table.Coach.ServeReadyMinDoneness
                && d <= f.Ingredient.PerfectWindow[1]
                && CookingRules.Evenness(f) >= data.Ingredients.Shared.MinEvennessForPerfect;
        }

        /// <summary>
        /// 0..1 progress toward the plate's next prompt: the flip while the
        /// face-down side is the one lagging nothing, the serve afterwards.
        /// </summary>
        public static double PlateProgress(GameData data, TutorialTable table, FoodRuntime f)
        {
            double down = DownSide(f);
            bool needsFlip = f.Sides.Length >= 2
                && AllAtMost(f.Sides, down + 1e-9)
                && CookingRules.Evenness(f) < data.Ingredients.Shared.MinEvennessForPerfect;
            if (needsFlip) return MathUtil.Clamp(down / table.Coach.FlipPromptAtSideDoneness, 0, 1);
            return MathUtil.Clamp(CookingRules.OverallDoneness(f) / table.Coach.ServeReadyMinDoneness, 0, 1);
        }

        /// <summary>Per-side ceiling for the guided plate: just under the perfect window's top edge.</summary>
        public static double HoldCeiling(TutorialTable table, FoodRuntime f) =>
            f.Ingredient.PerfectWindow[1] - table.Coach.HoldBelowWindowHi;

        /// <summary>
        /// docs/19 §6 "impossível falhar": no side of a plate in the scripted turn
        /// may pass the ceiling, so it neither overcooks nor burns and converges on
        /// PERFEITO however long the player hesitates. True if anything was clamped.
        /// Call it on every plate on the grill after each tick of the scripted turn.
        /// </summary>
        public static bool HoldPlate(TutorialTable table, FoodRuntime f)
        {
            if (!f.OnGrill || f.Burned || f.Served) return false;
            double cap = HoldCeiling(table, f);
            bool clamped = false;
            for (int s = 0; s < f.Sides.Length; s++)
            {
                if (f.Sides[s] > cap)
                {
                    f.Sides[s] = cap;
                    clamped = true;
                }
            }
            return clamped;
        }

        /// <summary>The guided plate is ready for what the current step teaches.</summary>
        public static bool PlateReady(GameData data, TutorialTable table, TutorialSteps? step, FoodRuntime? plate)
        {
            if (plate == null || step == null) return false;
            if (step.CompletesOn == TutorialTriggers.Flipped) return SideBrowned(table, plate);
            if (step.CompletesOn == TutorialTriggers.Served) return ServeReady(data, table, plate);
            return false;
        }

        /// <summary>
        /// Free-play coach (TS <c>coachAction</c>): what a player following the hand
        /// should do next. <paramref name="plates"/> = the FTUE ingredient's plates
        /// on the grill and not yet served, in the turn's food order;
        /// <paramref name="openLines"/> = unfulfilled lines for that ingredient
        /// across waiting customers (a serve target exists iff it is &gt; 0).
        /// </summary>
        public static CoachAction Next(GameData data, TutorialTable table, IReadOnlyList<FoodRuntime> plates,
            int openLines, GrillRuntime grill)
        {
            foreach (var f in plates) if (f.Burned) return CoachAction.Discard(f);
            if (openLines > 0)
            {
                foreach (var f in plates) if (ServeReady(data, table, f)) return CoachAction.Serve(f);
                // Past the window but not burned yet: serving beats watching it char.
                foreach (var f in plates)
                    if (CookingRules.OverallDoneness(f) > f.Ingredient.PerfectWindow[1]) return CoachAction.Serve(f);
            }
            foreach (var f in plates) if (FlipReady(data, table, f)) return CoachAction.Flip(f);

            if (plates.Count < openLines)
            {
                int cap = grill.Stats.SlotsPerZone;
                for (int z = 0; z < grill.Zones.Count; z++)
                {
                    if (grill.Zones[z].Items.Count < cap) return CoachAction.Place(z);
                }
            }
            var food = plates.Count > 0 ? plates[0] : null;
            return CoachAction.Wait(food, food != null ? PlateProgress(data, table, food) : 0);
        }

        /// <summary>
        /// What the hand points at during the scripted turn (TS
        /// <c>TutorialTurn.coach()</c>): guided steps point at exactly the action
        /// being taught — or wait, with the guided plate's ring progress — and
        /// step 5 falls back to <see cref="Next"/>.
        /// </summary>
        public static CoachAction ForStep(GameData data, TutorialTable table, TutorialSteps? step, FoodRuntime? plate,
            IReadOnlyList<FoodRuntime> plates, int openLines, GrillRuntime grill)
        {
            var on = step?.CompletesOn;
            if (on == TutorialTriggers.Flipped && plate != null)
            {
                return PlateReady(data, table, step, plate)
                    ? CoachAction.Flip(plate)
                    : CoachAction.Wait(plate, MathUtil.Clamp(DownSide(plate) / table.Coach.FlipPromptAtSideDoneness, 0, 1));
            }
            if (on == TutorialTriggers.Served && plate != null)
            {
                if (PlateReady(data, table, step, plate) && openLines > 0) return CoachAction.Serve(plate);
                return CoachAction.Wait(plate,
                    MathUtil.Clamp(CookingRules.OverallDoneness(plate) / table.Coach.ServeReadyMinDoneness, 0, 1));
            }
            if (on == TutorialTriggers.RewardLanded) return CoachAction.Wait(null, 1);
            return Next(data, table, plates, openLines, grill);
        }

        private static bool AllAtMost(double[] values, double max)
        {
            foreach (var v in values) if (v > max) return false;
            return true;
        }
    }

    // ── Masking ─────────────────────────────────────────────────────────────

    public static class TutorialMask
    {
        /// <summary>True while a guided (masked) step runs. Step 5 plays freely.</summary>
        public static bool Guided(TutorialSteps? step)
        {
            var on = step?.CompletesOn;
            return on == TutorialTriggers.Placed || on == TutorialTriggers.Flipped
                || on == TutorialTriggers.Served || on == TutorialTriggers.RewardLanded;
        }

        /// <summary>
        /// Input masking (docs/01-ARCHITECTURE.md, TutorialDirector: "contextual
        /// steps, masking, completion"). A masked action is ignored with a soft
        /// tick and counted as a miss. <paramref name="onGuidedPlate"/>: the action
        /// targets the plate placed in step 1; <paramref name="plateReady"/>:
        /// <see cref="TutorialCoachRules.PlateReady"/> for that plate.
        /// </summary>
        public static bool Allows(TutorialSteps? step, string action, bool onGuidedPlate, bool plateReady)
        {
            if (step == null || step.Screen != "play") return true;
            switch (step.CompletesOn)
            {
                case TutorialTriggers.Placed:
                    return action == TutorialActions.Take || action == TutorialActions.Place || action == TutorialActions.Discard;
                case TutorialTriggers.Flipped:
                    return action == TutorialActions.Flip && onGuidedPlate && plateReady;
                case TutorialTriggers.Served:
                    return action == TutorialActions.Serve && onGuidedPlate && plateReady;
                case TutorialTriggers.RewardLanded:
                    return false;
                default:
                    return true;
            }
        }
    }
}
