// tools/csharp/parity — does the C# core agree with the TypeScript reference?
//
//   1. bind     every generated table class (Assets/Scripts/Core/Generated)
//               deserialises its shared/data table and serialises back to the
//               same values — no key unbound, no value lost or invented
//   2. data     GameData.Load() on the shipped tables reports no problems
//   3. golden   tools/golden/vectors.json replayed through Rules.cs
//   4. ftue     tools/golden/tutorial-vectors.json replayed through
//               Tutorial.cs + Analytics.cs
//
// Run by `npm run check-csharp` (CI gate, docs/12-BUILD.md §5). Vectors whose
// C# counterpart does not exist yet (EconomyRules.cs, TurnSimulation.cs) are
// listed as not ported, never silently skipped. Exit 0 = full agreement.

using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.Json.Serialization;
using Churrasco.Core;
using Churrasco.Core.Generated;

namespace Churrasco.Parity;

public static class Program
{
    private static readonly JsonSerializerOptions BindOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow,
        NumberHandling = JsonNumberHandling.Strict
    };

    private static readonly JsonSerializerOptions WriteOptions = new()
    {
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
    };

    private static string _root = "";
    private static double _eps = 1e-9;

    public static int Main(string[] args)
    {
        CultureInfo.DefaultThreadCurrentCulture = CultureInfo.InvariantCulture;
        CultureInfo.CurrentCulture = CultureInfo.InvariantCulture;
        _root = FindRoot(args.Length > 0 ? args[0] : Directory.GetCurrentDirectory());
        var report = new Report();

        Bind(report);
        var data = LoadGameData(report);
        if (data != null)
        {
            Golden(data, report);
            Ftue(data, report);
        }
        return report.Finish();
    }

    // ── 1. bind ─────────────────────────────────────────────────────────────

    private static void Bind(Report report)
    {
        var section = report.Section("bind");
        var tables = typeof(TutorialTable).Assembly.GetTypes()
            .Where(t => t.Namespace == "Churrasco.Core.Generated" && !t.IsNested && t.Name.EndsWith("Table", StringComparison.Ordinal))
            .OrderBy(t => t.Name, StringComparer.Ordinal)
            .ToList();
        var files = Directory.GetFiles(DataDir(), "*.json")
            .ToDictionary(f => Pascal(Path.GetFileNameWithoutExtension(f)), f => f, StringComparer.Ordinal);
        long leaves = 0;
        foreach (var type in tables)
        {
            var stem = type.Name.Substring(0, type.Name.Length - "Table".Length);
            if (!files.TryGetValue(stem, out var file))
            {
                section.Fail(type.Name, "no shared/data table for this class");
                continue;
            }
            var name = Path.GetFileName(file);
            var node = Stripped(File.ReadAllText(file));
            object? obj;
            try
            {
                obj = JsonSerializer.Deserialize(node.ToJsonString(), type, BindOptions);
            }
            catch (JsonException ex)
            {
                section.Fail(name, $"does not bind to {type.Name}: {ex.Message}");
                continue;
            }
            var back = JsonSerializer.SerializeToNode(obj, type, WriteOptions);
            var diffs = new List<string>();
            leaves += Compare(node, back, "$", diffs);
            if (diffs.Count > 0) section.Fail(name, $"{type.Name} loses data: {string.Join("; ", diffs.Take(4))}");
            else section.Pass();
        }
        section.Note($"{tables.Count} tables, {leaves:N0} values round-tripped");
    }

    /// <summary>Case-insensitive structural equality: data (a) vs what C# serialised back (b).</summary>
    private static long Compare(JsonNode? a, JsonNode? b, string path, List<string> diffs)
    {
        if (a == null) { if (b != null) diffs.Add($"{path}: null became {b.ToJsonString()}"); return 1; }
        if (b == null) { diffs.Add($"{path}: {Short(a)} was lost"); return 1; }
        switch (a)
        {
            case JsonObject ao when b is JsonObject bo:
            {
                long n = 0;
                var used = new HashSet<string>(StringComparer.Ordinal);
                foreach (var kv in ao)
                {
                    var match = bo.FirstOrDefault(p => string.Equals(p.Key, kv.Key, StringComparison.OrdinalIgnoreCase));
                    if (match.Key == null)
                    {
                        if (kv.Value != null) diffs.Add($"{path}.{kv.Key}: not bound");
                        continue;
                    }
                    used.Add(match.Key);
                    n += Compare(kv.Value, match.Value, $"{path}.{kv.Key}", diffs);
                }
                foreach (var kv in bo)
                    if (!used.Contains(kv.Key) && kv.Value != null) diffs.Add($"{path}.{kv.Key}: invented ({Short(kv.Value)})");
                return n;
            }
            case JsonArray aa when b is JsonArray ba:
            {
                if (aa.Count != ba.Count) { diffs.Add($"{path}: {aa.Count} items became {ba.Count}"); return 1; }
                long n = 0;
                for (int i = 0; i < aa.Count; i++) n += Compare(aa[i], ba[i], $"{path}[{i}]", diffs);
                return n;
            }
            case JsonValue av when b is JsonValue bv:
            {
                var ka = av.GetValueKind();
                var kb = bv.GetValueKind();
                bool same = ka == JsonValueKind.Number && kb == JsonValueKind.Number
                    ? av.GetValue<double>() == bv.GetValue<double>()
                    : ka == kb && av.ToJsonString() == bv.ToJsonString();
                if (!same) diffs.Add($"{path}: {av.ToJsonString()} became {bv.ToJsonString()}");
                return 1;
            }
            default:
                diffs.Add($"{path}: {a.GetValueKind()} became {b.GetValueKind()}");
                return 1;
        }
    }

    // ── 2. data ─────────────────────────────────────────────────────────────

    private static GameData? LoadGameData(Report report)
    {
        var section = report.Section("data");
        Json.Deserialiser = (json, type) => JsonSerializer.Deserialize(Stripped(json).ToJsonString(), type, BindOptions)!;
        try
        {
            var data = GameData.Load(f => File.ReadAllText(Path.Combine(DataDir(), f)), out var problems);
            if (problems.Count > 0) section.Fail("GameData.Load", string.Join("; ", problems.Take(6)));
            else section.Pass();
            section.Note($"GameData.Load: {problems.Count} problems, {data.AllIngredients.Count()} ingredients");
            return data;
        }
        catch (Exception ex)
        {
            section.Fail("GameData.Load", ex.Message);
            return null;
        }
    }

    // ── 3. golden (Rules.cs) ────────────────────────────────────────────────

    private static void Golden(GameData data, Report report)
    {
        var doc = JsonNode.Parse(File.ReadAllText(Path.Combine(_root, "tools", "golden", "vectors.json")))!;
        _eps = doc["epsilon"]!.GetValue<double>();
        // gen-vectors pins restaurant index 1 with no upgrades.
        var stats = CookingRules.DeriveStats(data, data.RestaurantByIndex(1)!, new Dictionary<string, int>());
        var cooking = report.Section("golden.cooking");
        foreach (var v in doc["cooking"]!.AsArray()) Cook(data, stats, v!, cooking);
        var scoring = report.Section("golden.scoring");
        foreach (var v in doc["scoring"]!.AsArray())
        {
            var id = Str(v!["id"]);
            if (id.StartsWith("flip.", StringComparison.Ordinal)) Flip(data, stats, v, scoring);
            else if (id.StartsWith("score.", StringComparison.Ordinal)) Score(data, v, scoring);
            else scoring.NotPorted(id, "unknown scoring vector");
        }
        var economy = report.Section("golden.economy");
        foreach (var v in doc["economy"]!.AsArray())
        {
            var id = Str(v!["id"]);
            if (id == "econ.effectiveHeat") EffectiveHeat(data, stats, v, economy);
            else economy.NotPorted(id, "EconomyRules.cs");
        }
        var turns = report.Section("golden.turns");
        foreach (var v in doc["turns"]!.AsArray()) turns.NotPorted(Str(v!["id"]), "TurnSimulation.cs");
    }

    private static void Cook(GameData data, DerivedStats stats, JsonNode v, Section s)
    {
        var id = Str(v["id"]);
        var input = v["input"]!;
        var ing = data.IngredientById(Str(input["ingredient"]))!;
        int zone = Int(input["zoneIndex"]);
        double step = Num(input["stepSec"]);
        var grill = CookingRules.CreateGrill(stats, data);
        var food = CookingRules.CreateFood(1, ing);
        CookingRules.PlaceOnGrill(grill, food, zone);
        var fails = new List<string>();
        var rate = input["derivedStats"]!["heatRatePerSec"];
        if (rate != null)
        {
            double mine = CookingRules.EffectiveHeat(grill, zone, data) * ing.HeatRate * stats.HeatRampRate / ing.SideCookSec;
            Near(fails, "heatRatePerSec", mine, Num(rate));
        }
        int ticks = 0;
        foreach (var row in v["expect"]!["trace"]!.AsArray())
        {
            int want = Int(row!["ticks"]);
            while (ticks < want) { CookingRules.TickGrill(grill, data, step); ticks++; }
            NearAll(fails, $"t={Num(row["tSec"])} sides", food.Sides, Nums(row["sides"]));
            Near(fails, $"t={Num(row["tSec"])} overall", CookingRules.OverallDoneness(food), Num(row["overall"]));
            Near(fails, $"t={Num(row["tSec"])} evenness", CookingRules.Evenness(food), Num(row["evenness"]));
            Eq(fails, $"t={Num(row["tSec"])} burned", food.Burned, Bool(row["burned"]));
        }
        s.Result(id, fails);
    }

    private static void Flip(GameData data, DerivedStats stats, JsonNode v, Section s)
    {
        var input = v["input"]!;
        var expect = v["expect"]!;
        var ing = data.IngredientById(Str(input["ingredient"]))!;
        const double step = 1.0 / 16;
        var grill = CookingRules.CreateGrill(stats, data);
        var food = CookingRules.CreateFood(7, ing);
        CookingRules.PlaceOnGrill(grill, food, 1);
        for (int i = 0; i < 40; i++) CookingRules.TickGrill(grill, data, step);
        var fails = new List<string>();
        NearAll(fails, "sidesBefore", food.Sides, Nums(expect["sidesBefore"]));
        bool flipped = CookingRules.FlipFood(grill, food, Num(input["flipAtSec"]), data);
        for (int i = 0; i < 40; i++) CookingRules.TickGrill(grill, data, step);
        Eq(fails, "flipped", flipped, Bool(expect["flipped"]));
        Eq(fails, "sideDownAfter", food.DownSide, Int(expect["sideDownAfter"]));
        NearAll(fails, "sidesAfter", food.Sides, Nums(expect["sidesAfter"]));
        Near(fails, "evenness", CookingRules.Evenness(food), Num(expect["evenness"]));
        s.Result(Str(v["id"]), fails);
    }

    private static void Score(GameData data, JsonNode v, Section s)
    {
        var input = v["input"]!;
        var ing = data.IngredientById(Str(input["ingredient"]))!;
        double burnAt = Num(input["burnedThreshold"]);
        var fails = new List<string>();
        var rows = v["expect"]!["rows"]!.AsArray();
        int i = 0;
        for (int d = 0; d <= 150; d += 5, i++)
        {
            double val = d / 100.0;
            var f = CookingRules.CreateFood(1, ing);
            for (int k = 0; k < f.Sides.Length; k++) f.Sides[k] = val;
            f.Burned = f.Sides.Any(x => x >= burnAt);
            var scored = CookingRules.ScoreItem(data, f, new ScoreContext
            {
                Target = Num(input["target"]),
                ToleranceScale = 1,
                PatienceRemaining = 0.5,
                Combo = 0,
                TipMult = 1,
                XpMult = 1,
                CustomerTipMult = 1,
                EventValueMult = 1,
                Tuning = CookingRules.RewardTuningOf(data)
            });
            var row = rows[i]!;
            var at = $"d={val}";
            Near(fails, $"{at} overall", CookingRules.OverallDoneness(f), Num(row["overall"]));
            Eq(fails, $"{at} quality", scored.Quality.ToString().ToLowerInvariant(), Str(row["quality"]));
            Eq(fails, $"{at} coins", scored.Coins, Int(row["coins"]));
            Eq(fails, $"{at} xp", scored.Xp, Int(row["xp"]));
            Eq(fails, $"{at} stage", CookingRules.StageOf(data, f), Str(row["stage"]));
            Near(fails, $"{at} evenness", CookingRules.Evenness(f), Num(row["evenness"]));
        }
        if (i != rows.Count) fails.Add($"expected {rows.Count} rows, replayed {i}");
        s.Result(Str(v["id"]), fails);
    }

    private static void EffectiveHeat(GameData data, DerivedStats stats, JsonNode v, Section s)
    {
        var ts = Nums(v["input"]!["charcoalT"]);
        var byZone = v["expect"]!["byZone"]!.AsArray();
        var fails = new List<string>();
        for (int z = 0; z < byZone.Count; z++)
        {
            var want = Nums(byZone[z]);
            for (int k = 0; k < ts.Length; k++)
            {
                var g = CookingRules.CreateGrill(stats, data);
                g.CharcoalT = ts[k];
                g.CharcoalEfficiency = CookingRules.SampleCurve(data.Grill.Charcoal.EfficiencyCurve, ts[k]);
                Near(fails, $"zone {z} t={ts[k]}", CookingRules.EffectiveHeat(g, z, data), want[k]);
            }
        }
        s.Result(Str(v["id"]), fails);
    }

    // ── 4. ftue (Tutorial.cs, Analytics.cs) ─────────────────────────────────

    private static void Ftue(GameData data, Report report)
    {
        var doc = JsonNode.Parse(File.ReadAllText(Path.Combine(_root, "tools", "golden", "tutorial-vectors.json")))!;
        _eps = doc["epsilon"]!.GetValue<double>();
        var table = Load<TutorialTable>("tutorial.json");
        var taxonomy = Load<AnalyticsTable>("analytics.json");

        var director = report.Section("ftue.director");
        var sent = new List<AnalyticsEvent>();
        foreach (var v in doc["director"]!.AsArray()) Director(table, v!, director, sent);
        foreach (var e in sent)
        {
            var problems = AnalyticsContract.Check(taxonomy, e);
            if (problems.Count > 0) director.Fail($"event {e.Name}", string.Join("; ", problems));
        }

        var restore = report.Section("ftue.restore");
        foreach (var v in doc["restore"]!.AsArray())
        {
            var input = v!["input"]!;
            var got = TutorialStates.Restore(table, StateFrom(input["raw"]), Bool(input["legacyDone"]));
            var fails = new List<string>();
            SameState(fails, "state", got, v["expect"]!["state"]!);
            restore.Result(Str(v["id"]), fails);
        }

        var coach = report.Section("ftue.coach");
        foreach (var v in doc["coach"]!.AsArray()) CoachGrid(data, table, v!, coach);

        var hand = report.Section("ftue.hand");
        foreach (var v in doc["hand"]!.AsArray()) Hand(data, table, v!, hand);

        var mask = report.Section("ftue.mask");
        foreach (var v in doc["mask"]!.AsArray()) Mask(table, v!, mask);

        var analytics = report.Section("ftue.analytics");
        foreach (var v in doc["analytics"]!.AsArray())
        {
            var input = v!["input"]!;
            var parameters = new Dictionary<string, object>();
            foreach (var kv in input["params"]!.AsObject()) parameters[kv.Key] = Scalar(kv.Value!);
            var got = AnalyticsContract.Check(taxonomy, new AnalyticsEvent(Str(input["name"]), parameters));
            var want = v["expect"]!["problems"]!.AsArray().Select(p => Str(p)).ToList();
            var fails = new List<string>();
            if (!got.SequenceEqual(want)) fails.Add($"problems [{string.Join(" | ", got)}] != [{string.Join(" | ", want)}]");
            analytics.Result(Str(v["id"]), fails);
        }
    }

    private static void Director(TutorialTable table, JsonNode v, Section s, List<AnalyticsEvent> sent)
    {
        var input = v["input"]!;
        var restore = input["restore"];
        var start = restore == null ? null : TutorialStates.Restore(table, StateFrom(restore["raw"]), Bool(restore["legacyDone"]));
        var events = new List<AnalyticsEvent>();
        var d = new TutorialDirector(table, start, events.Add);
        var ops = input["ops"]!.AsArray();
        var trace = v["expect"]!["trace"]!.AsArray();
        var fails = new List<string>();
        for (int i = 0; i < ops.Count; i++)
        {
            var op = ops[i]!.AsArray();
            var name = Str(op[0]);
            int before = events.Count;
            bool? ret = null;
            switch (name)
            {
                case "start": d.Start(); break;
                case "tick": d.Tick(Num(op[1])); break;
                case "report": ret = d.Report(Str(op[1])); break;
                case "miss": d.Miss(); break;
                case "skip": ret = d.Skip(); break;
                case "abandon": ret = d.Abandon(); break;
                case "restartTurn": d.RestartTurn(); break;
                default: fails.Add($"op {i}: unknown op {name}"); break;
            }
            var want = trace[i]!;
            var at = $"op {i} {name}{(op.Count > 1 ? " " + op[1]!.ToJsonString() : "")}";
            var wantRet = want["ret"];
            if (wantRet == null ? ret != null : ret != Bool(wantRet)) fails.Add($"{at}: returned {Show(ret)}, want {Show(wantRet)}");
            var step = want["step"];
            if ((d.Current?.Id) != (step == null ? null : Str(step))) fails.Add($"{at}: step {d.Current?.Id ?? "null"}, want {Show(step)}");
            Eq(fails, $"{at} done", d.Done, Bool(want["done"]));
            Eq(fails, $"{at} canSkip", d.CanSkip, Bool(want["canSkip"]));
            Near(fails, $"{at} elapsedMs", d.ElapsedMs, Num(want["elapsedMs"]));
            Eq(fails, $"{at} misses", d.State.Misses, Int(want["misses"]));
            var wantEvents = want["events"]!.AsArray();
            var got = events.Skip(before).ToList();
            if (got.Count != wantEvents.Count) fails.Add($"{at}: sent {got.Count} events, want {wantEvents.Count}");
            else
            {
                for (int k = 0; k < got.Count; k++)
                {
                    var diff = SameEvent(got[k], wantEvents[k]!);
                    if (diff != null) fails.Add($"{at}: {diff}");
                }
            }
        }
        SameState(fails, "final state", d.State, v["expect"]!["state"]!);
        sent.AddRange(events);
        s.Result(Str(v["id"]), fails);
    }

    private static void CoachGrid(GameData data, TutorialTable table, JsonNode v, Section s)
    {
        var plates = v["input"]!["plates"]!.AsArray();
        var rows = v["expect"]!["rows"]!.AsArray();
        var fails = new List<string>();
        for (int i = 0; i < plates.Count; i++)
        {
            var f = FoodFrom(data, plates[i]!);
            var want = rows[i]!;
            var at = $"plate {i} {plates[i]!["sides"]!.ToJsonString()} down {plates[i]!["downSide"]}";
            Eq(fails, $"{at} sideBrowned", TutorialCoachRules.SideBrowned(table, f), Bool(want["sideBrowned"]));
            Eq(fails, $"{at} flipReady", TutorialCoachRules.FlipReady(data, table, f), Bool(want["flipReady"]));
            Eq(fails, $"{at} serveReady", TutorialCoachRules.ServeReady(data, table, f), Bool(want["serveReady"]));
            Near(fails, $"{at} plateProgress", TutorialCoachRules.PlateProgress(data, table, f), Num(want["plateProgress"]));
            Near(fails, $"{at} holdCeiling", TutorialCoachRules.HoldCeiling(table, f), Num(want["holdCeiling"]));
            Eq(fails, $"{at} hold.clamped", TutorialCoachRules.HoldPlate(table, f), Bool(want["hold"]!["clamped"]));
            NearAll(fails, $"{at} hold.sides", f.Sides, Nums(want["hold"]!["sides"]));
        }
        s.Result($"{Str(v["id"])} ({plates.Count} plates)", fails);
    }

    private static void Hand(GameData data, TutorialTable table, JsonNode v, Section s)
    {
        var samples = v["input"]!["samples"]!.AsArray();
        var actions = v["expect"]!["actions"]!.AsArray();
        var fails = new List<string>();
        for (int i = 0; i < samples.Count; i++)
        {
            var smp = samples[i]!;
            var foods = smp["foods"]!.AsArray().Select(f => FoodFrom(data, f!)).ToList();
            var plate = smp["plate"] == null ? null : foods[Int(smp["plate"])];
            var plates = smp["plates"]!.AsArray().Select(p => foods[Int(p)]).ToList();
            var grill = new GrillRuntime { Stats = new DerivedStats { SlotsPerZone = Int(smp["slotsPerZone"]) } };
            var zones = Ints(smp["zones"]);
            for (int z = 0; z < zones.Length; z++)
            {
                var zr = new GrillZoneRuntime { Index = z };
                for (int k = 0; k < zones[z]; k++) zr.Items.Add(CookingRules.CreateFood(900 + z * 10 + k, plates.FirstOrDefault()?.Ingredient ?? data.AllIngredients.First()));
                grill.Zones.Add(zr);
            }
            var step = smp["step"] == null ? null : table.Steps[Int(smp["step"]) - 1];
            var got = TutorialCoachRules.ForStep(data, table, step, plate, plates, Int(smp["openLines"]), grill);
            var want = actions[i]!;
            var at = $"sample {i} (t={Num(smp["t"])}, step {Show(smp["step"])})";
            Eq(fails, $"{at} kind", got.Kind.ToString().ToLowerInvariant(), Str(want["kind"]));
            int? food = got.Food == null ? null : foods.IndexOf(got.Food);
            int? wantFood = want["food"] == null ? null : Int(want["food"]);
            if (food != wantFood) fails.Add($"{at} food: {Show(food)}, want {Show(wantFood)}");
            Eq(fails, $"{at} zoneIndex", got.ZoneIndex, Int(want["zoneIndex"]));
            Near(fails, $"{at} progress", got.Progress, Num(want["progress"]));
        }
        s.Result($"{Str(v["id"])} ({samples.Count} samples)", fails);
    }

    private static void Mask(TutorialTable table, JsonNode v, Section s)
    {
        var rows = v["input"]!["rows"]!.AsArray();
        var want = v["expect"]!["rows"]!.AsArray();
        var fails = new List<string>();
        for (int i = 0; i < rows.Count; i++)
        {
            var r = rows[i]!;
            var step = r["step"] == null ? null : table.Steps[Int(r["step"]) - 1];
            var at = $"step {Show(r["step"])} {Str(r["action"])} guidedPlate={Bool(r["onGuidedPlate"])} ready={Bool(r["plateReady"])}";
            Eq(fails, $"{at} allows", TutorialMask.Allows(step, Str(r["action"]), Bool(r["onGuidedPlate"]), Bool(r["plateReady"])), Bool(want[i]!["allows"]));
            Eq(fails, $"{at} guided", TutorialMask.Guided(step), Bool(want[i]!["guided"]));
        }
        s.Result($"{Str(v["id"])} ({rows.Count} rows)", fails);
    }

    // ── helpers ─────────────────────────────────────────────────────────────

    private static FoodRuntime FoodFrom(GameData data, JsonNode n)
    {
        var f = CookingRules.CreateFood(Int(n["uid"]), data.IngredientById(Str(n["ingredient"]))!);
        f.Sides = Nums(n["sides"]);
        f.DownSide = Int(n["downSide"]);
        f.OnGrill = Bool(n["onGrill"]);
        f.Burned = Bool(n["burned"]);
        f.Served = Bool(n["served"]);
        return f;
    }

    private static TutorialState? StateFrom(JsonNode? raw) =>
        raw == null ? null : JsonSerializer.Deserialize<TutorialState>(raw.ToJsonString(), BindOptions);

    private static void SameState(List<string> fails, string at, TutorialState got, JsonNode want)
    {
        Eq(fails, $"{at}.variant", got.Variant, Str(want["variant"]));
        Eq(fails, $"{at}.step", got.Step, Int(want["step"]));
        Eq(fails, $"{at}.reported", got.Reported, Int(want["reported"]));
        Near(fails, $"{at}.elapsedMs", got.ElapsedMs, Num(want["elapsedMs"]));
        Eq(fails, $"{at}.misses", got.Misses, Int(want["misses"]));
        Eq(fails, $"{at}.started", got.Started, Bool(want["started"]));
        Eq(fails, $"{at}.skipped", got.Skipped, Bool(want["skipped"]));
        Eq(fails, $"{at}.abandonedStep", got.AbandonedStep, Int(want["abandonedStep"]));
    }

    private static string? SameEvent(AnalyticsEvent got, JsonNode want)
    {
        if (got.Name != Str(want["name"])) return $"event {got.Name}, want {Str(want["name"])}";
        var wp = want["params"]!.AsObject();
        if (got.Params.Count != wp.Count) return $"{got.Name}: {got.Params.Count} params, want {wp.Count}";
        foreach (var kv in wp)
        {
            if (!got.Params.TryGetValue(kv.Key, out var value)) return $"{got.Name}: no param {kv.Key}";
            var expected = Scalar(kv.Value!);
            bool same = expected is string es ? value is string gs && gs == es
                : expected is bool eb ? value is bool gb && gb == eb
                : IsNumber(value) && Convert.ToDouble(value, CultureInfo.InvariantCulture) == Convert.ToDouble(expected, CultureInfo.InvariantCulture);
            if (!same) return $"{got.Name}.{kv.Key} = {AnalyticsContract.JsJson(value)}, want {kv.Value!.ToJsonString()}";
        }
        return null;
    }

    private static bool IsNumber(object v) => v is long || v is int || v is double || v is float;

    /// <summary>A JSON scalar as an analytics value: integral numbers become long, like the director's.</summary>
    private static object Scalar(JsonNode n)
    {
        var el = n.GetValue<JsonElement>();
        return el.ValueKind switch
        {
            JsonValueKind.String => el.GetString()!,
            JsonValueKind.True => true,
            JsonValueKind.False => false,
            JsonValueKind.Number => el.TryGetInt64(out var l) ? l : el.GetDouble(),
            _ => throw new InvalidOperationException($"not a scalar: {n.ToJsonString()}")
        };
    }

    private static T Load<T>(string file) where T : class =>
        JsonSerializer.Deserialize<T>(Stripped(File.ReadAllText(Path.Combine(DataDir(), file))).ToJsonString(), BindOptions)!;

    /// <summary>The table without `_comment`-style notes and `$schema` — the keys the generator skips too.</summary>
    private static JsonNode Stripped(string json)
    {
        var node = JsonNode.Parse(json)!;
        Strip(node);
        return node;
    }

    private static void Strip(JsonNode? node)
    {
        if (node is JsonObject o)
        {
            foreach (var key in o.Select(kv => kv.Key).Where(k => k.StartsWith('_') || k == "$schema").ToList()) o.Remove(key);
            foreach (var kv in o) Strip(kv.Value);
        }
        else if (node is JsonArray a)
        {
            foreach (var item in a) Strip(item);
        }
    }

    /// <summary>Same Pascal-casing as gen-csharp-types.mjs (`churrasqueiras` → `Churrasqueiras`).</summary>
    private static string Pascal(string s)
    {
        var sb = new System.Text.StringBuilder();
        bool up = true;
        foreach (var c in s)
        {
            if (!char.IsLetterOrDigit(c)) { up = true; continue; }
            sb.Append(up ? char.ToUpperInvariant(c) : c);
            up = false;
        }
        return sb.ToString();
    }

    private static string FindRoot(string from)
    {
        var dir = new DirectoryInfo(from);
        while (dir != null)
        {
            if (Directory.Exists(Path.Combine(dir.FullName, "shared", "data")) &&
                Directory.Exists(Path.Combine(dir.FullName, "tools", "golden"))) return dir.FullName;
            dir = dir.Parent;
        }
        throw new DirectoryNotFoundException($"no repository root (shared/data + tools/golden) above {from}");
    }

    private static string DataDir() => Path.Combine(_root, "shared", "data");

    private static string Str(JsonNode? n) => n!.GetValue<string>();
    private static bool Bool(JsonNode? n) => n!.GetValue<bool>();
    private static int Int(JsonNode? n) => (int)n!.GetValue<double>();
    private static double Num(JsonNode? n) => n!.GetValue<double>();
    private static double[] Nums(JsonNode? n) => n!.AsArray().Select(x => x!.GetValue<double>()).ToArray();
    private static int[] Ints(JsonNode? n) => n!.AsArray().Select(x => (int)x!.GetValue<double>()).ToArray();
    private static string Show(object? v) => v switch
    {
        null => "null",
        JsonNode j => j.ToJsonString(),
        bool b => b ? "true" : "false",
        _ => Convert.ToString(v, CultureInfo.InvariantCulture) ?? "?"
    };
    private static string Short(JsonNode n) { var s = n.ToJsonString(); return s.Length > 40 ? s.Substring(0, 40) + "…" : s; }

    private static void Near(List<string> fails, string what, double got, double want)
    {
        if (double.IsNaN(got) || Math.Abs(got - want) > _eps) fails.Add($"{what}: {got.ToString("R", CultureInfo.InvariantCulture)}, want {want.ToString("R", CultureInfo.InvariantCulture)}");
    }

    private static void NearAll(List<string> fails, string what, double[] got, double[] want)
    {
        if (got.Length != want.Length) { fails.Add($"{what}: {got.Length} values, want {want.Length}"); return; }
        for (int i = 0; i < got.Length; i++) Near(fails, $"{what}[{i}]", got[i], want[i]);
    }

    private static void Eq<T>(List<string> fails, string what, T got, T want)
    {
        if (!EqualityComparer<T>.Default.Equals(got, want)) fails.Add($"{what}: {Show(got)}, want {Show(want)}");
    }

    // ── reporting ───────────────────────────────────────────────────────────

    private sealed class Report
    {
        private readonly List<Section> _sections = new();

        public Section Section(string name)
        {
            var s = new Section(name);
            _sections.Add(s);
            return s;
        }

        public int Finish()
        {
            int failed = 0, passed = 0, notPorted = 0;
            foreach (var s in _sections)
            {
                var line = $"[parity] {s.Name,-16} {s.Passed} ok";
                if (s.Failures.Count > 0) line += $", {s.Failures.Count} FAILED";
                if (s.NotPortedIds.Count > 0) line += $", {s.NotPortedIds.Count} not ported ({string.Join(", ", s.NotPortedReasons)})";
                if (s.Notes.Count > 0) line += " — " + string.Join("; ", s.Notes);
                Console.WriteLine(line);
                foreach (var f in s.Failures.Take(12)) Console.WriteLine($"    ✗ {f}");
                if (s.Failures.Count > 12) Console.WriteLine($"    … and {s.Failures.Count - 12} more");
                failed += s.Failures.Count;
                passed += s.Passed;
                notPorted += s.NotPortedIds.Count;
            }
            if (failed > 0)
            {
                Console.WriteLine($"[parity] FAIL — {failed} check(s) disagree with the TypeScript reference");
                return 1;
            }
            Console.WriteLine($"[parity] OK — {passed} checks agree with the TypeScript reference; {notPorted} vectors wait for their C# port");
            return 0;
        }
    }

    private sealed class Section
    {
        public string Name { get; }
        public int Passed { get; private set; }
        public List<string> Failures { get; } = new();
        public List<string> NotPortedIds { get; } = new();
        public SortedSet<string> NotPortedReasons { get; } = new(StringComparer.Ordinal);
        public List<string> Notes { get; } = new();

        public Section(string name) { Name = name; }

        public void Pass() => Passed++;
        public void Fail(string id, string why) => Failures.Add($"{id}: {why}");
        public void Note(string note) => Notes.Add(note);

        public void NotPorted(string id, string waitsFor)
        {
            NotPortedIds.Add(id);
            NotPortedReasons.Add(waitsFor);
        }

        public void Result(string id, List<string> fails)
        {
            if (fails.Count == 0) { Passed++; return; }
            Failures.Add($"{id}: {string.Join("; ", fails.Take(3))}{(fails.Count > 3 ? $" (+{fails.Count - 3} more)" : "")}");
        }
    }
}
