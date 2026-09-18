// CHURRASCO! O Mestre da Brasa — the indexed data database.
//
// C# counterpart of createDatabase() in tools/sim-core/src/data.ts. The Unity
// client loads the JSON tables from Assets/Data (synced verbatim from
// shared/data by `npm run sync-data`) and builds this index once at boot.
//
// Rules code takes a GameData rather than reaching for singletons, so the same
// rules can run against a modified dataset in tests and in the editor tooling.
//
// WARNING: not compiled — no C# toolchain in the authoring environment.

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
        public Ingredients Ingredients = null!;
        public Grill Grill = null!;
        public Customers Customers = null!;
        public Restaurants Restaurants = null!;
        public Upgrades Upgrades = null!;
        public Economy Economy = null!;
        public Levels Levels = null!;

        private readonly Dictionary<string, IngredientsItems> _ingredientById =
            new Dictionary<string, IngredientsItems>(StringComparer.Ordinal);
        private readonly Dictionary<string, CustomersCustomers> _customerById =
            new Dictionary<string, CustomersCustomers>(StringComparer.Ordinal);
        private readonly Dictionary<int, RestaurantsRestaurants> _restaurantByIndex =
            new Dictionary<int, RestaurantsRestaurants>();
        private readonly Dictionary<string, UpgradesTracks> _upgradeById =
            new Dictionary<string, UpgradesTracks>(StringComparer.Ordinal);

        public IngredientsItems? IngredientById(string id) =>
            _ingredientById.TryGetValue(id, out var v) ? v : null;

        public CustomersCustomers? CustomerById(string id) =>
            _customerById.TryGetValue(id, out var v) ? v : null;

        public RestaurantsRestaurants? RestaurantByIndex(int index) =>
            _restaurantByIndex.TryGetValue(index, out var v) ? v : null;

        public UpgradesTracks? UpgradeById(string id) =>
            _upgradeById.TryGetValue(id, out var v) ? v : null;

        public IEnumerable<IngredientsItems> AllIngredients => _ingredientById.Values;
        public IEnumerable<CustomersCustomers> AllCustomers => _customerById.Values;
        public IEnumerable<RestaurantsRestaurants> AllRestaurants => _restaurantByIndex.Values;
        public IEnumerable<UpgradesTracks> AllUpgrades => _upgradeById.Values;

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
                    if (c.PatienceSec <= 0) problems.Add($"customer \"{c.Id}\": patienceSec must be > 0");
                    if (c.MinOrders > c.MaxOrders)
                        problems.Add($"customer \"{c.Id}\": minOrders > maxOrders");
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

            if (Economy?.Reward == null) problems.Add("economy.json: missing reward block");
            if (Economy?.Xp?.Formula == null) problems.Add("economy.json: missing xp.formula");

            return problems;
        }

        /// <summary>
        /// Deserialises the ten modelled tables and builds the index.
        /// `readJson` is injected so the caller owns file IO (Addressables in the
        /// client, File.ReadAllText in the editor tools, a string in tests).
        /// </summary>
        public static GameData Load(Func<string, string> readJson, out List<string> problems)
        {
            var data = new GameData
            {
                Ingredients = Deserialise<Ingredients>(readJson, "ingredients.json"),
                Grill = Deserialise<Grill>(readJson, "grill.json"),
                Customers = Deserialise<Customers>(readJson, "customers.json"),
                Restaurants = Deserialise<Restaurants>(readJson, "restaurants.json"),
                Upgrades = Deserialise<Upgrades>(readJson, "upgrades.json"),
                Economy = Deserialise<Economy>(readJson, "economy.json"),
                Levels = Deserialise<Levels>(readJson, "levels.json")
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
        public static Func<string, T> Deserialiser<T> { get; set; } = null!;

        public static T Deserialize<T>(string json) where T : class
        {
            if (Deserialiser<T> == null)
                throw new InvalidOperationException(
                    "Json.Deserialiser<T> is not configured. Assign it at boot " +
                    "(e.g. JsonConvert.DeserializeObject<T>) before loading data.");
            return Deserialiser<T>(json);
        }

        public static readonly CultureInfo Invariant = CultureInfo.InvariantCulture;
    }
}
