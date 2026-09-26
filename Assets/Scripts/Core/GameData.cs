// CHURRASCO! O Mestre da Brasa — the indexed data database.
//
// C# counterpart of createDatabase() in tools/sim-core/src/data.ts. The Unity
// client loads the JSON tables from Assets/Data (synced verbatim from
// shared/data by `npm run sync-data`) and builds this index once at boot.
//
// Rules code takes a GameData rather than reaching for singletons, so the same
// rules can run against a modified dataset in tests and in the editor tooling.
//
// Compiled (netstandard2.1, C# 9 — Unity's profile) and exercised against the
// real tables by tools/csharp on every PR (docs/12-BUILD.md §5).

#nullable enable
using System;
using System.Collections.Generic;
using System.Globalization;
using Churrasco.Core.Generated;

namespace Churrasco.Core
{
    /// <summary>
    /// Immutable, indexed view of every gameplay table. Build once with
    /// <see cref="Load"/>, then pass by reference.
    /// </summary>
    public sealed class GameData
    {
        public IngredientsTable Ingredients = null!;
        public GrillTable Grill = null!;
        public CustomersTable Customers = null!;
        public RestaurantsTable Restaurants = null!;
        public UpgradesTable Upgrades = null!;
        public EconomyTable Economy = null!;
        public LevelsTable Levels = null!;
        public ChurrasqueirasTable Churrasqueiras = null!;

        private readonly Dictionary<string, IngredientsItems> _ingredientById =
            new Dictionary<string, IngredientsItems>(StringComparer.Ordinal);
        private readonly Dictionary<string, CustomersCustomers> _customerById =
            new Dictionary<string, CustomersCustomers>(StringComparer.Ordinal);
        private readonly Dictionary<int, RestaurantsRestaurants> _restaurantByIndex =
            new Dictionary<int, RestaurantsRestaurants>();
        private readonly Dictionary<string, UpgradesTracks> _upgradeById =
            new Dictionary<string, UpgradesTracks>(StringComparer.Ordinal);
        private readonly Dictionary<string, ChurrasqueirasChurrasqueiras> _churrasqueiraById =
            new Dictionary<string, ChurrasqueirasChurrasqueiras>(StringComparer.Ordinal);

        public IngredientsItems? IngredientById(string id) =>
            _ingredientById.TryGetValue(id, out var v) ? v : null;

        public CustomersCustomers? CustomerById(string id) =>
            _customerById.TryGetValue(id, out var v) ? v : null;

        public RestaurantsRestaurants? RestaurantByIndex(int index) =>
            _restaurantByIndex.TryGetValue(index, out var v) ? v : null;

        public UpgradesTracks? UpgradeById(string id) =>
            _upgradeById.TryGetValue(id, out var v) ? v : null;

        public ChurrasqueirasChurrasqueiras? ChurrasqueiraById(string id) =>
            id != null && _churrasqueiraById.TryGetValue(id, out var v) ? v : null;

        public IEnumerable<IngredientsItems> AllIngredients => _ingredientById.Values;
        public IEnumerable<CustomersCustomers> AllCustomers => _customerById.Values;
        public IEnumerable<RestaurantsRestaurants> AllRestaurants => _restaurantByIndex.Values;
        public IEnumerable<UpgradesTracks> AllUpgrades => _upgradeById.Values;
        public IEnumerable<ChurrasqueirasChurrasqueiras> AllChurrasqueiras => _churrasqueiraById.Values;

        /// <summary>
        /// Builds the index and returns every structural problem found. An empty
        /// list means the dataset is sound; the caller decides whether to fail.
        /// Mirrors validateDatabase() in data.ts.
        /// </summary>
        public List<string> Build()
        {
            var problems = new List<string>();

            if (Ingredients?.Items == null) { problems.Add("ingredients.json: no items"); return problems; }
            _ingredientById.Clear();
            foreach (var it in Ingredients.Items)
            {
                if (it.Id == null) { problems.Add("ingredient: missing id"); continue; }
                if (_ingredientById.ContainsKey(it.Id))
                    problems.Add($"ingredient: duplicate id \"{it.Id}\"");
                _ingredientById[it.Id] = it;

                if (it.CookMethod == "grill" && it.SideCookSec <= 0)
                    problems.Add($"ingredient \"{it.Id}\": cookMethod grill requires sideCookSec > 0");
                if (it.Sides <= 0)
                    problems.Add($"ingredient \"{it.Id}\": sides must be > 0");
                if (it.PerfectWindow == null || it.PerfectWindow.Count != 2)
                    problems.Add($"ingredient \"{it.Id}\": perfectWindow must have exactly 2 entries");
                else if (it.PerfectWindow[0] >= it.PerfectWindow[1])
                    problems.Add($"ingredient \"{it.Id}\": perfectWindow must be ascending");
                if (it.Value < 0) problems.Add($"ingredient \"{it.Id}\": value must be >= 0");
            }

            if (Grill?.Zones == null || Grill.Zones.Count == 0)
                problems.Add("grill.json: no zones");
            else
            {
                for (int i = 0; i < Grill.Zones.Count; i++)
                {
                    if (Grill.Zones[i].Index != i)
                        problems.Add($"grill zone {i}: index field is {Grill.Zones[i].Index}, expected {i}");
                    if (Grill.Zones[i].HeatMultiplier <= 0)
                        problems.Add($"grill zone {i}: heatMultiplier must be > 0");
                }
                var curve = Grill.Charcoal?.EfficiencyCurve;
                if (curve == null || curve.Count < 2)
                    problems.Add("grill.charcoal.efficiencyCurve needs at least 2 points");
                else
                {
                    for (int i = 1; i < curve.Count; i++)
                        if (curve[i].T <= curve[i - 1].T)
                            problems.Add("grill.charcoal.efficiencyCurve t values must be strictly ascending");
                }
            }

            if (Customers?.Customers == null) problems.Add("customers.json: no customers");
            else
            {
                _customerById.Clear();
                foreach (var c in Customers.Customers)
                {
                    if (c.Id == null) { problems.Add("customer: missing id"); continue; }
                    if (_customerById.ContainsKey(c.Id))
                        problems.Add($"customer: duplicate id \"{c.Id}\"");
                    _customerById[c.Id] = c;
                    // Same rules as validateDatabase() in data.ts.
                    if (c.ItemsMin < 1) problems.Add($"customer \"{c.Id}\": itemsMin must be >= 1");
                    if (c.ItemsMax < c.ItemsMin) problems.Add($"customer \"{c.Id}\": itemsMax < itemsMin");
                    if (c.PatienceMultiplier <= 0) problems.Add($"customer \"{c.Id}\": patienceMultiplier must be > 0");
                }
            }

            if (Restaurants?.Restaurants == null) problems.Add("restaurants.json: no restaurants");
            else
            {
                _restaurantByIndex.Clear();
                foreach (var r in Restaurants.Restaurants)
                {
                    if (_restaurantByIndex.ContainsKey(r.Index))
                        problems.Add($"restaurant: duplicate index {r.Index}");
                    _restaurantByIndex[r.Index] = r;
                    if (r.Grill == null) problems.Add($"restaurant \"{r.Id}\": missing grill block");
                    else if (r.Grill.SlotsPerZone <= 0)
                        problems.Add($"restaurant \"{r.Id}\": grill.slotsPerZone must be > 0");
                    if (r.TurnLengthSec <= 0) problems.Add($"restaurant \"{r.Id}\": turnLengthSec must be > 0");
                }
                // Indices must be contiguous from 0 so unlock ordering is unambiguous.
                for (int i = 0; i < _restaurantByIndex.Count; i++)
                    if (!_restaurantByIndex.ContainsKey(i))
                        problems.Add($"restaurant: missing index {i} (indices must be contiguous from 0)");
            }

            if (Upgrades?.Tracks == null) problems.Add("upgrades.json: no tracks");
            else
            {
                _upgradeById.Clear();
                foreach (var u in Upgrades.Tracks)
                {
                    if (u.Id == null) { problems.Add("upgrade: missing id"); continue; }
                    if (_upgradeById.ContainsKey(u.Id))
                        problems.Add($"upgrade: duplicate id \"{u.Id}\"");
                    _upgradeById[u.Id] = u;
                    if (u.MaxLevel <= 0) problems.Add($"upgrade \"{u.Id}\": maxLevel must be > 0");
                    if (u.BaseCost < 0) problems.Add($"upgrade \"{u.Id}\": baseCost must be >= 0");
                    if (u.Growth < 1) problems.Add($"upgrade \"{u.Id}\": growth must be >= 1 or costs fall");
                }
            }

            if (Churrasqueiras?.Churrasqueiras == null) problems.Add("churrasqueiras.json: no grills");
            else
            {
                // The ladder's shape (docs/23 §2): unique ids and contiguous indices, exactly three
                // evolutions each, level 1 free, and `fileiras` equal to evo 1's zoneCount — that last
                // one is what keeps the painted bed and the mechanic agreeing.
                _churrasqueiraById.Clear();
                var seenIds = new HashSet<string>(StringComparer.Ordinal);
                var seenIndices = new HashSet<int>();
                var indices = new List<int>();
                foreach (var ch in Churrasqueiras.Churrasqueiras)
                {
                    if (ch.Id == null) { problems.Add("churrasqueira: missing id"); continue; }
                    if (!seenIds.Add(ch.Id)) problems.Add($"churrasqueira: duplicate id \"{ch.Id}\"");
                    _churrasqueiraById[ch.Id] = ch;
                    if (!seenIndices.Add(ch.Index)) problems.Add($"churrasqueira {ch.Id}: duplicate index {ch.Index}");
                    indices.Add(ch.Index);
                    if (ch.Fileiras < 1 || ch.Fileiras > 4) problems.Add($"churrasqueira {ch.Id}: fileiras must be 1..4");
                    if (ch.Evolutions == null || ch.Evolutions.Count == 0)
                    { problems.Add($"churrasqueira {ch.Id}: no evolutions"); continue; }
                    if (ch.Fileiras != ch.Evolutions[0].ZoneCount)
                        problems.Add($"churrasqueira {ch.Id}: fileiras mismatch zoneCount of evo 1");
                    if (ch.Evolutions.Count != 3) problems.Add($"churrasqueira {ch.Id}: expected 3 evolutions");
                    for (int i = 0; i < ch.Evolutions.Count; i++)
                    {
                        var evo = ch.Evolutions[i];
                        if (evo.Level != i + 1)
                            problems.Add($"churrasqueira {ch.Id} evo {evo.Level}: level should be {i + 1}");
                        if (evo.ZoneCount < 1 || evo.ZoneCount > 4)
                            problems.Add($"churrasqueira {ch.Id} evo {evo.Level}: zoneCount 1..4");
                        if (evo.SlotsPerZone < 2 || evo.SlotsPerZone > 5)
                            problems.Add($"churrasqueira {ch.Id} evo {evo.Level}: slotsPerZone 2..5");
                        if (evo.HeatBase < 0.5 || evo.HeatBase > 1.7)
                            problems.Add($"churrasqueira {ch.Id} evo {evo.Level}: heatBase out of range");
                    }
                    if (ch.UnlockLevel < 1) problems.Add($"churrasqueira {ch.Id}: unlockLevel must be >=1");
                    if (ch.Evolutions[0].CostCoins != 0)
                        problems.Add($"churrasqueira {ch.Id}: evolution 1 must cost 0 (granted on unlock)");
                }
                indices.Sort();
                for (int i = 0; i < indices.Count; i++)
                    if (indices[i] != i)
                        problems.Add($"churrasqueira indices must be contiguous from 0 (found {indices[i]} at {i})");
                ChurrasqueirasChurrasqueiras? starter = null;
                foreach (var kv in _churrasqueiraById) if (kv.Value.Index == 0) starter = kv.Value;
                if (starter != null && (starter.UnlockLevel != 1 || starter.UnlockCostCoins != 0))
                    problems.Add($"churrasqueira {starter.Id}: starter (index 0) must be free at level 1");
            }

            if (Economy?.Reward == null) problems.Add("economy.json: missing reward block");
            if (Economy?.Xp?.Formula == null) problems.Add("economy.json: missing xp.formula");

            return problems;
        }

        /// <summary>
        /// Deserialises the eight modelled tables and builds the index.
        /// `readJson` is injected so the caller owns file IO (Addressables in the
        /// client, File.ReadAllText in the editor tools, a string in tests).
        /// </summary>
        public static GameData Load(Func<string, string> readJson, out List<string> problems)
        {
            var data = new GameData
            {
                Ingredients = Deserialise<IngredientsTable>(readJson, "ingredients.json"),
                Grill = Deserialise<GrillTable>(readJson, "grill.json"),
                Customers = Deserialise<CustomersTable>(readJson, "customers.json"),
                Restaurants = Deserialise<RestaurantsTable>(readJson, "restaurants.json"),
                Upgrades = Deserialise<UpgradesTable>(readJson, "upgrades.json"),
                Economy = Deserialise<EconomyTable>(readJson, "economy.json"),
                Levels = Deserialise<LevelsTable>(readJson, "levels.json"),
                Churrasqueiras = Deserialise<ChurrasqueirasTable>(readJson, "churrasqueiras.json")
            };
            problems = data.Build();
            return data;
        }

        // The concrete JSON library is a Unity-side decision (Newtonsoft ships
        // with Unity 6; System.Text.Json needs an extra assembly). Kept behind
        // one method so swapping it touches a single line.
        private static T Deserialise<T>(Func<string, string> readJson, string file) where T : class
        {
            var json = readJson(file);
            if (string.IsNullOrEmpty(json))
                throw new InvalidOperationException($"data table not found: {file}");
            return Json.Deserialize<T>(json);
        }
    }

    /// <summary>
    /// Single seam for the JSON provider. Culture-invariant parsing matters: a
    /// device with a comma decimal separator must not misread 0.12 as 12.
    /// </summary>
    public static class Json
    {
        /// <summary>
        /// (json, target type) → instance. Assign once at boot, e.g. Newtonsoft:
        /// <c>Json.Deserialiser = (s, t) => JsonConvert.DeserializeObject(s, t)!;</c>
        /// or System.Text.Json with <c>PropertyNameCaseInsensitive = true</c> (the
        /// generated classes need case-insensitive binding; tools/csharp/parity uses it).
        /// Not generic: a generic property (<c>Deserialiser&lt;T&gt;</c>) is not C#.
        /// </summary>
        public static Func<string, Type, object>? Deserialiser { get; set; }

        public static T Deserialize<T>(string json) where T : class
        {
            var deserialiser = Deserialiser ?? throw new InvalidOperationException(
                "Json.Deserialiser is not configured. Assign it at boot " +
                "(e.g. (s, t) => JsonConvert.DeserializeObject(s, t)) before loading data.");
            return (T)deserialiser(json, typeof(T));
        }

        public static readonly CultureInfo Invariant = CultureInfo.InvariantCulture;
    }
}
