// CHURRASCO! O Mestre da Brasa — turn simulation engine.
//
// EXACT port of tools/sim-core/src/turn.ts and tools/sim-core/src/staff.ts.
// Replays identical event sequence, customer queues, prep actions, cooking ticks,
// burn tracking, charcoal automation and pure snapshot results down to 1e-9.

#nullable enable
using System;
using System.Collections.Generic;
using System.Linq;
using Churrasco.Core.Generated;

namespace Churrasco.Core
{
    public sealed class OrderLine
    {
        public string IngredientId = "";
        public double Target;
        public List<int> FulfilledBy = new List<int>();

        public OrderLine Clone() => new OrderLine
        {
            IngredientId = IngredientId,
            Target = Target,
            FulfilledBy = new List<int>(FulfilledBy)
        };
    }

    public sealed class CustomerRuntime
    {
        public int Uid;
        public CustomersCustomers Def = null!;
        public List<OrderLine> Lines = new List<OrderLine>();
        public double PatienceTotal;
        public double PatienceLeft;
        public double ArrivedAt;
        public string State = "waiting"; // "waiting" | "served" | "left"
        public int SlotIndex;
        public double TotalValue;
        public string? VipSource;

        public CustomerRuntime Clone() => new CustomerRuntime
        {
            Uid = Uid,
            Def = Def,
            Lines = Lines.Select(l => l.Clone()).ToList(),
            PatienceTotal = PatienceTotal,
            PatienceLeft = PatienceLeft,
            ArrivedAt = ArrivedAt,
            State = State,
            SlotIndex = SlotIndex,
            TotalValue = TotalValue,
            VipSource = VipSource
        };
    }

    public sealed class TurnOverrides
    {
        public double? TurnLengthSec;
        public double? SpawnIntervalSec;
        public double? DifficultyScalar;
        public double? PatienceScalar;
        public double? VipChance;
        public int? MaxOrdersOnScreen;
        public double? TipBase;
        public bool? AutoSpawn;
    }

    public sealed class TurnConfig
    {
        public bool StaffEnabled = true;
        public int PlayerLevel = 1;
        public int RestaurantIndex;
        public string LevelId = "";
        public Dictionary<string, int> UpgradeLevels = new Dictionary<string, int>(StringComparer.Ordinal);
        public double Seed;
        public TurnOverrides? Overrides;
        public string? ChurrasqueiraId;
        public int? ChurrasqueiraLevel;
        public VipState? VipState;
        public double? VipStartUnixSec;
        public int StaffPrepCustomers;
        public bool StaffPolicy = true;
    }

    public sealed class TurnCounters
    {
        public int CustomersSpawned;
        public int VipSpawned;
        public int VipServed;
        public int CustomersServed;
        public int CustomersLost;
        public int OrdersCompleted;
        public int PerfectCooks;
        public int GoodCooks;
        public int BurnedFood;
        public int BestCombo;
        public int Flips;
        public int ItemsCooked;
        public int CharcoalRefills;
        public int PeakSimultaneousOrders;
        public bool Flawless = true;

        public TurnCounters Clone() => new TurnCounters
        {
            CustomersSpawned = CustomersSpawned,
            VipSpawned = VipSpawned,
            VipServed = VipServed,
            CustomersServed = CustomersServed,
            CustomersLost = CustomersLost,
            OrdersCompleted = OrdersCompleted,
            PerfectCooks = PerfectCooks,
            GoodCooks = GoodCooks,
            BurnedFood = BurnedFood,
            BestCombo = BestCombo,
            Flips = Flips,
            ItemsCooked = ItemsCooked,
            CharcoalRefills = CharcoalRefills,
            PeakSimultaneousOrders = PeakSimultaneousOrders,
            Flawless = Flawless
        };
    }

    public sealed class TurnEvent
    {
        public string Type = "";
        public CustomerRuntime? Customer;
        public FoodRuntime? Food;
        public ScoredItem? Scored;
        public ServeQuality? Quality;
        public int? Coins;
        public int? Combo;
        public bool? Milestone;
        public bool? Success;
        public int? FoodUid;
        public int? CustomerUid;
        public string? Role;
    }

    public sealed class TurnResult
    {
        public string LevelId = "";
        public int Coins;
        public int Xp;
        public int Stars;
        public int Combo;
        public TurnCounters Counters = new TurnCounters();
        public double DurationSec;
        public bool Failed;
        public List<TurnEvent> Events = new List<TurnEvent>();
    }

    public interface ITurnActions
    {
        GameData Db { get; }
        List<IngredientsItems> Bench { get; }
        List<FoodRuntime> Foods { get; }
        List<CustomerRuntime> Customers { get; }
        GrillRuntime Grill { get; }
        double Now { get; }
        double TimeLeft { get; }
        int Combo { get; }
        int PrepSlotsFree { get; }
        FoodRuntime Spawn(IngredientsItems ing);
        bool StartPrep(FoodRuntime food, int slotIndex = -1);
        bool Place(FoodRuntime food, int zoneIndex);
        bool Move(FoodRuntime food, int zoneIndex);
        bool Flip(FoodRuntime food);
        ScoredItem? Serve(CustomerRuntime customer, FoodRuntime food);
        void ServeDelayed(CustomerRuntime customer, FoodRuntime food, double delaySec);
        void Discard(FoodRuntime food);
        int StockRemaining(string id);
        bool RefillStock();
        bool RefillCharcoal();
    }

    public interface ITurnPolicy
    {
        void Act(ITurnActions a);
    }

    public sealed class TurnSimulation : ITurnActions
    {
        public GameData Db { get; }
        public DerivedStats Stats { get; private set; }
        public GrillRuntime Grill { get; }
        public RestaurantsRestaurants Restaurant { get; }
        public TurnConfig Config { get; }

        public List<FoodRuntime?> PrepSlots { get; }
        public List<FoodRuntime> Foods { get; } = new List<FoodRuntime>();
        public List<IngredientsItems> Bench { get; } = new List<IngredientsItems>();
        public List<IngredientsItems> AvailableIngredients { get; }
        private readonly Dictionary<string, IngredientsItems> _availableById = new Dictionary<string, IngredientsItems>(StringComparer.Ordinal);
        public List<CustomerRuntime> Customers { get; } = new List<CustomerRuntime>();
        public List<TurnEvent> Events { get; } = new List<TurnEvent>();

        public double Time { get; private set; }
        public double Now => Time;
        public double TimeLimit { get; private set; }
        public double SpawnTimer { get; private set; }
        public double SpawnInterval { get; private set; }
        public int Combo { get; private set; }
        public double CoinsAccum { get; private set; }
        public double XpAccum { get; private set; }

        private int _uid = 1;
        private int _nextSpawnCount;
        private int _uidCounter = 1;
        private bool _lowWarned;
        private readonly Dictionary<string, int> _stock = new Dictionary<string, int>(StringComparer.Ordinal);
        private readonly HashSet<int> _stockDebitedUids = new HashSet<int>();
        public double StockRefillRemaining { get; private set; }
        public int AutoRefillAttempts { get; private set; }
        public int AutoRefillSuccesses { get; private set; }
        private int _tickCount;

        private sealed class PendingServe
        {
            public CustomerRuntime Customer = null!;
            public FoodRuntime Food = null!;
            public double At;
        }
        private readonly List<PendingServe> _pendingServes = new List<PendingServe>();

        private readonly Rng _rng;
        private readonly Rng _vipRng;
        private readonly Rng _charcoalRng;
        public VipState VipState { get; }
        private readonly RewardTuning _tuning;

        public TurnCounters Counters { get; } = new TurnCounters();

        public int StaffServeUsed => _staffServeUsed;
        public int StaffFlipUsed => _staffFlipUsed;
        public int StaffPrepUsed => _staffPrepUsed;
        public int StaffPrepAttempts => _staffPrepAttempts;

        // Staff sub-runtime
        private readonly HashSet<int> _staffServeSeen = new HashSet<int>();
        private readonly Dictionary<int, double> _staffFlipSeen = new Dictionary<int, double>();
        private readonly HashSet<int> _staffWarned = new HashSet<int>();
        private readonly Rng _staffRng;
        private int _staffServeUsed;
        private int _staffFlipUsed;
        private int _staffPrepUsed;
        private int _staffPrepAttempts;
        private double _staffNextServe;
        private double _staffNextFlip;
        private double _staffNextPrep;
        private readonly EmployeesRolesAbilities? _staffWaiter;
        private readonly EmployeesRolesAbilities? _staffHelper;
        private readonly EmployeesRolesAbilities? _staffCook;

        public TurnSimulation(GameData db, TurnConfig config, double? seed = null)
        {
            Db = db;
            if (config.PlayerLevel < 1) throw new ArgumentException("TurnSimulation: playerLevel must be >= 1");
            Config = config;
            double s = seed ?? config.Seed;
            _rng = new Rng(Rng.ToUint32(s) ^ 0x5eedu);
            _vipRng = new Rng(Rng.ToUint32(s) ^ 0x71f5u);
            _charcoalRng = new Rng(Rng.ToUint32(s) ^ 0xc0a1u);
            _staffRng = new Rng(Rng.ToUint32(s) ^ 0xa063u);

            VipState = config.VipState ?? new VipState();
            VipRules.VipChance(db, config.Overrides?.VipChance, config.VipStartUnixSec ?? 0.0);
            _tuning = CookingRules.RewardTuningOf(db);
            Restaurant = db.RestaurantByIndex(config.RestaurantIndex) ?? db.RestaurantByIndex(0)!;

            AvailableIngredients = db.AllIngredients
                .Where(i => i.Unlock.RestaurantIndex <= Restaurant.Index && i.Unlock.Level <= config.PlayerLevel)
                .ToList();
            if (AvailableIngredients.Count == 0) throw new InvalidOperationException("TurnSimulation: no unlocked ingredients");
            foreach (var ing in AvailableIngredients) _availableById[ing.Id] = ing;
            Bench.AddRange(AvailableIngredients);

            var stats = CookingRules.DeriveStats(db, Restaurant, config.UpgradeLevels);
            if (!string.IsNullOrEmpty(config.ChurrasqueiraId))
            {
                stats = CookingRules.ApplyChurrasqueiraToStats(
                    stats, db, config.ChurrasqueiraId!, config.ChurrasqueiraLevel ?? 1, Restaurant);
            }
            if (config.Overrides?.MaxOrdersOnScreen != null)
            {
                int baseOrders = config.Overrides.MaxOrdersOnScreen.Value;
                stats.MaxOrdersOnScreen += baseOrders - Restaurant.Service.MaxOrdersOnScreen;
            }

            // Staff auxiliary extra prep slots
            bool staffEnabled = config.StaffEnabled;
            if (staffEnabled && AvailableIngredients.Any(i => i.CookMethod == "prep"))
            {
                var helperAbility = StaffAbility("auxiliar");
                if (helperAbility?.ExtraPrepSlots != null) stats.PrepSlots += helperAbility.ExtraPrepSlots.Value;
            }
            Stats = stats;

            foreach (var ing in AvailableIngredients) _stock[ing.Id] = stats.RawStockCapacityPerIngredient;
            PrepSlots = new List<FoodRuntime?>(new FoodRuntime?[stats.PrepSlots]);

            Grill = CookingRules.CreateGrill(Stats, db);
            if (!string.IsNullOrEmpty(config.ChurrasqueiraId))
            {
                CookingRules.PatchGrillForChurrasqueira(Grill, db, config.ChurrasqueiraId!, config.ChurrasqueiraLevel ?? 1);
            }

            TimeLimit = config.Overrides?.TurnLengthSec ?? Restaurant.TurnLengthSec;
            SpawnInterval = config.Overrides?.SpawnIntervalSec ?? 7.5;
            SpawnTimer = config.Overrides?.AutoSpawn == false ? double.PositiveInfinity : 1.2;

            // Staff initialization
            _staffWaiter = staffEnabled ? StaffAbility("garcom") : null;
            _staffHelper = staffEnabled && AvailableIngredients.Any(i => i.CookMethod == "prep") ? StaffAbility("auxiliar") : null;
            _staffCook = staffEnabled ? StaffAbility("churrasqueiro") : null;
            _staffNextFlip = _staffCook?.IntervalSec ?? double.PositiveInfinity;
            _staffNextPrep = _staffHelper?.IntervalSec ?? double.PositiveInfinity;
        }

        private EmployeesRolesAbilities? StaffAbility(string roleId)
        {
            var role = Db.Employees?.Roles?.FirstOrDefault(r => r.Id == roleId);
            if (role == null || Restaurant.Index < role.Unlock.RestaurantIndex) return null;
            int level = Config.UpgradeLevels.TryGetValue(role.Unlock.UpgradeTrack, out var lv) ? lv : 0;
            return role.Abilities?.FirstOrDefault(a => a.Level == level);
        }

        public CustomerRuntime SpawnScriptedCustomer(string customerId, IReadOnlyList<string> ingredientIds, double patienceSec)
        {
            var def = Db.CustomerById(customerId);
            if (def == null) throw new ArgumentException($"spawnScriptedCustomer: unknown customer \"{customerId}\"");
            var lines = new List<OrderLine>();
            foreach (var id in ingredientIds)
            {
                if (Db.IngredientById(id) == null) throw new ArgumentException($"spawnScriptedCustomer: unknown ingredient \"{id}\"");
                if (!_availableById.ContainsKey(id)) throw new ArgumentException($"spawnScriptedCustomer: locked ingredient \"{id}\"");
                if (lines.Any(l => l.IngredientId == id)) continue;
                lines.Add(new OrderLine { IngredientId = id, Target = 0 });
            }
            if (lines.Count == 0) throw new ArgumentException("spawnScriptedCustomer: empty order");
            return Admit(def, lines, Math.Max(1.0, patienceSec));
        }

        public void EndAfter(double sec)
        {
            TimeLimit = Math.Min(TimeLimit, Time + Math.Max(0.0, sec));
        }

        public FoodRuntime TakeFromStock(IngredientsItems ingredient)
        {
            if (!_availableById.TryGetValue(ingredient.Id, out var unlocked))
                throw new ArgumentException($"takeFromStock: locked or unknown ingredient \"{ingredient.Id}\"");
            var f = CookingRules.CreateFood(_uidCounter++, unlocked);
            Foods.Add(f);
            return f;
        }

        public FoodRuntime Spawn(IngredientsItems ing) => TakeFromStock(ing);

        public int StockRemaining(string id) => _stock.TryGetValue(id, out int count) ? count : 0;

        public bool RefillStock()
        {
            if (Finished || StockRefillRemaining > 0) return false;
            StockRefillRemaining = Db.Grill.Stock.RefillTimeSec;
            return true;
        }

        private void CommitStock(FoodRuntime food)
        {
            if (_stockDebitedUids.Contains(food.Uid)) return;
            int cur = StockRemaining(food.Ingredient.Id);
            _stock[food.Ingredient.Id] = cur - 1;
            _stockDebitedUids.Add(food.Uid);
        }

        public int PrepSlotsFree => PrepSlots.Count(f => f == null);

        public bool StartPrep(FoodRuntime food, int slotIndex = -1)
        {
            if (slotIndex < 0) slotIndex = PrepSlots.IndexOf(null);
            if (slotIndex < 0 || slotIndex >= PrepSlots.Count) return false;
            if (PrepSlots[slotIndex] != null || PrepSlots.Contains(food)) return false;
            if (!Foods.Contains(food) || food.Served || food.Burned || food.OnGrill) return false;
            if (food.Ingredient.CookMethod != "prep" || !(food.Ingredient.PrepSec > 0)) return false;
            if (!_stockDebitedUids.Contains(food.Uid) && StockRemaining(food.Ingredient.Id) <= 0) return false;
            CommitStock(food);
            PrepSlots[slotIndex] = food;
            return true;
        }

        private void ReleasePrep(FoodRuntime food)
        {
            int slot = PrepSlots.IndexOf(food);
            if (slot >= 0) PrepSlots[slot] = null;
        }

        public bool Place(FoodRuntime food, int zoneIndex)
        {
            if (!Foods.Contains(food) || food.Ingredient.CookMethod != "grill" || food.Burned || food.Served) return false;
            if (!_stockDebitedUids.Contains(food.Uid) && StockRemaining(food.Ingredient.Id) <= 0) return false;
            if (!CookingRules.PlaceOnGrill(Grill, food, zoneIndex)) return false;
            CommitStock(food);
            return true;
        }

        public bool Move(FoodRuntime food, int zoneIndex)
        {
            StaffObserve();
            if (!Foods.Contains(food) || !food.OnGrill || food.Served) return false;
            return CookingRules.PlaceOnGrill(Grill, food, zoneIndex);
        }

        public bool Flip(FoodRuntime food)
        {
            StaffObserve();
            bool ok = CookingRules.FlipFood(Grill, food, Time, Db);
            if (ok) Counters.Flips++;
            return ok;
        }

        public bool RefillCharcoal()
        {
            if (Finished) return false;
            double cost = Db.Grill.Charcoal.RefillCostCoins;
            if (cost > 0)
            {
                if (CoinsAccum < cost) return false;
                CoinsAccum -= cost;
            }
            bool started = CookingRules.StartCharcoalRefill(Grill, Db);
            if (!started && cost > 0)
            {
                CoinsAccum += cost;
                return false;
            }
            return started;
        }

        private void TryAutoCharcoal()
        {
            var g = Grill;
            if (Finished || g.Refilling > 0 || g.CharcoalAutoAttempted || Stats.AutoRefillChance <= 0) return;
            if (g.CharcoalT < 1.0 - Db.Grill.Charcoal.LowWarningThreshold) return;
            g.CharcoalAutoAttempted = true;
            AutoRefillAttempts++;
            bool success = _charcoalRng.Next() < Stats.AutoRefillChance && RefillCharcoal();
            if (success) AutoRefillSuccesses++;
            Events.Add(new TurnEvent { Type = "charcoal_auto_attempt", Success = success });
        }

        public void ServeDelayed(CustomerRuntime customer, FoodRuntime food, double delaySec)
        {
            if (delaySec <= 0)
            {
                Serve(customer, food);
                return;
            }
            for (int i = 0; i < _pendingServes.Count; i++)
            {
                if (_pendingServes[i].Food == food) return;
            }
            _pendingServes.Add(new PendingServe { Customer = customer, Food = food, At = Time + delaySec });
        }

        public void Discard(FoodRuntime food)
        {
            StaffObserve();
            ReleasePrep(food);
            CookingRules.RemoveFromGrill(Grill, food);
            food.Served = true;
            Foods.Remove(food);
        }

        public ScoredItem? Serve(CustomerRuntime customer, FoodRuntime food)
        {
            StaffObserve();
            return CompleteServe(customer, food, 0.0);
        }

        private ScoredItem? CompleteServe(CustomerRuntime customer, FoodRuntime food, double autoServiceTipBonus)
        {
            if (customer.State != "waiting") return null;
            if (food.Served) return null;
            bool isPrep = food.Ingredient.CookMethod == "prep";
            if (isPrep)
            {
                if (!PrepSlots.Contains(food) || food.PrepProgress < 1.0) return null;
            }
            else if (!food.OnGrill)
            {
                return null;
            }

            var line = customer.Lines.FirstOrDefault(l => l.IngredientId == food.Ingredient.Id && l.FulfilledBy.Count == 0);
            if (line == null) return null;

            double patienceRemaining = MathUtil.Clamp01(customer.PatienceLeft / customer.PatienceTotal);
            var scored = CookingRules.ScoreItem(Db, food, new ScoreContext
            {
                RestaurantIndex = Restaurant.Index,
                Target = line.Target,
                ToleranceScale = customer.Def.ToleranceScale,
                PatienceRemaining = patienceRemaining,
                Combo = Combo,
                TipMult = Stats.TipMult,
                PrestigeTipBonus = Stats.PrestigeTipBonus,
                AutoServiceTipBonus = autoServiceTipBonus,
                XpMult = Stats.XpMult,
                CustomerTipMult = customer.Def.TipMultiplier,
                Tuning = _tuning
            });

            line.FulfilledBy.Add(food.Uid);
            ReleasePrep(food);
            CookingRules.RemoveFromGrill(Grill, food);
            food.Served = true;
            Counters.ItemsCooked++;

            CoinsAccum += scored.Coins;
            XpAccum += scored.Xp;

            if (scored.Quality == ServeQuality.Perfect)
            {
                Combo++;
                Counters.PerfectCooks++;
                Events.Add(new TurnEvent { Type = "perfect", Food = food, Scored = scored, Combo = Combo });
            }
            else if (scored.Quality == ServeQuality.Good)
            {
                Combo++;
                Counters.GoodCooks++;
            }
            else
            {
                Counters.Flawless = false;
                BreakCombo();
            }

            if (Combo > Counters.BestCombo) Counters.BestCombo = Combo;
            CheckComboMilestone();
            Events.Add(new TurnEvent
            {
                Type = "serve",
                Customer = customer,
                Quality = scored.Quality,
                Coins = scored.Coins,
                Combo = Combo
            });

            bool complete = customer.Lines.All(l => l.FulfilledBy.Count >= 1);
            if (complete)
            {
                customer.State = "served";
                Counters.CustomersServed++;
                Counters.OrdersCompleted++;
                if (customer.Def.IsVip == true)
                {
                    Counters.VipServed++;
                }
            }
            return scored;
        }

        public void Tick(double dt, ITurnPolicy? policy = null)
        {
            if (double.IsNaN(dt) || dt < 0) throw new ArgumentException("TurnSimulation: invalid dt");
            TryAutoCharcoal();
            Time += dt;
            _tickCount++;
            if ((_tickCount & 31) == 0) Compact();

            if (StockRefillRemaining > 0)
            {
                StockRefillRemaining = Math.Max(0.0, StockRefillRemaining - dt);
                if (StockRefillRemaining < 1e-9)
                {
                    StockRefillRemaining = 0;
                    foreach (var id in _stock.Keys.ToList()) _stock[id] = Stats.RawStockCapacityPerIngredient;
                    Events.Add(new TurnEvent { Type = "stock_refilled" });
                }
            }

            bool refilled = CookingRules.TickGrill(Grill, Db, dt, (f) =>
            {
                Counters.BurnedFood++;
                Counters.Flawless = false;
                BreakCombo();
                Events.Add(new TurnEvent { Type = "burned", Food = f });
            });
            if (refilled)
            {
                Counters.CharcoalRefills++;
                Events.Add(new TurnEvent { Type = "charcoal_refilled" });
            }
            TryAutoCharcoal();

            double fuelLeft = 1.0 - Grill.CharcoalT;
            if (!_lowWarned && fuelLeft < Db.Grill.Charcoal.LowWarningThreshold)
            {
                _lowWarned = true;
                Events.Add(new TurnEvent { Type = "charcoal_low" });
            }
            if (fuelLeft > Db.Grill.Charcoal.LowWarningThreshold) _lowWarned = false;

            for (int i = 0; i < PrepSlots.Count; i++)
            {
                var f = PrepSlots[i];
                if (f == null || f.Served || f.Burned || f.OnGrill) continue;
                var ing = f.Ingredient;
                if (ing.CookMethod != "prep" || ing.PrepSec == null || ing.PrepSec <= 0) continue;
                f.PrepProgress = MathUtil.Clamp01(f.PrepProgress + (dt * Stats.PrepSpeedMult) / ing.PrepSec.Value);
                double centre = (ing.PerfectWindow[0] + ing.PerfectWindow[1]) / 2.0;
                f.Sides[0] = f.PrepProgress * centre;
            }

            SpawnTimer -= dt * Stats.CustomerSpawnRate;
            int active = Customers.Count(c => c.State == "waiting");
            if (SpawnTimer <= 0)
            {
                SpawnTimer = SpawnInterval;
                if (active < Stats.MaxOrdersOnScreen) SpawnCustomer();
            }

            StaffObserve();

            if (_pendingServes.Count > 0)
            {
                int w = 0;
                for (int i = 0; i < _pendingServes.Count; i++)
                {
                    var ps = _pendingServes[i];
                    if (ps.At <= Time)
                    {
                        if (ps.Customer.State == "waiting" && !ps.Food.Served && !ps.Food.Burned)
                            Serve(ps.Customer, ps.Food);
                    }
                    else
                    {
                        _pendingServes[w++] = ps;
                    }
                }
                while (_pendingServes.Count > w) _pendingServes.RemoveAt(_pendingServes.Count - 1);
            }

            for (int i = 0; i < Customers.Count; i++)
            {
                var c = Customers[i];
                if (c.State != "waiting") continue;
                c.PatienceLeft -= dt;
                if (c.PatienceLeft <= 0)
                {
                    c.PatienceLeft = 0;
                    c.State = "left";
                    for (int pi = _pendingServes.Count - 1; pi >= 0; pi--)
                    {
                        if (_pendingServes[pi].Customer == c) _pendingServes.RemoveAt(pi);
                    }
                    Counters.CustomersLost++;
                    Counters.Flawless = false;
                    BreakCombo();
                    Events.Add(new TurnEvent { Type = "left", Customer = c });
                }
            }

            if (active > Counters.PeakSimultaneousOrders) Counters.PeakSimultaneousOrders = active;

            StaffTick();

            policy?.Act(this);
        }

        private void Compact()
        {
            if (_pendingServes.Count > 8)
            {
                int w = 0;
                for (int i = 0; i < _pendingServes.Count; i++)
                {
                    var ps = _pendingServes[i];
                    if (!ps.Food.Served && ps.Customer.State == "waiting") _pendingServes[w++] = ps;
                }
                while (_pendingServes.Count > w) _pendingServes.RemoveAt(_pendingServes.Count - 1);
            }
            {
                int w = 0;
                for (int i = 0; i < Foods.Count; i++)
                {
                    var f = Foods[i];
                    if (!f.Served) Foods[w++] = f;
                }
                while (Foods.Count > w) Foods.RemoveAt(Foods.Count - 1);
            }
            if (Customers.Count > 8)
            {
                int w = 0;
                for (int i = 0; i < Customers.Count; i++)
                {
                    var c = Customers[i];
                    if (c.State == "waiting") Customers[w++] = c;
                }
                while (Customers.Count > w) Customers.RemoveAt(Customers.Count - 1);
            }
        }

        public double TimeLeft => Math.Max(0.0, TimeLimit - Time);
        public bool Finished => Time >= TimeLimit;

        public TurnResult Result()
        {
            int served = Counters.CustomersServed;
            int total = Math.Max(1, Counters.CustomersSpawned);
            double ratio = (double)served / total;
            int stars = ratio >= 0.9 ? 3 : ratio >= 0.65 ? 2 : ratio >= 0.35 ? 1 : 0;
            var bonus = Db.Economy.Reward.TurnEndBonus;
            double endBonus = Math.Max(0, bonus.Base + bonus.PerPerfect * Counters.PerfectCooks + bonus.PerLostCustomer * Counters.CustomersLost);

            return new TurnResult
            {
                LevelId = Config.LevelId,
                Coins = (int)MathUtil.RoundHalfUp(CoinsAccum + endBonus),
                Xp = (int)MathUtil.RoundHalfUp(XpAccum),
                Stars = stars,
                Combo = Counters.BestCombo,
                Counters = Counters.Clone(),
                DurationSec = Time,
                Failed = stars == 0 && Counters.CustomersLost > served,
                Events = Events.Select(e => new TurnEvent
                {
                    Type = e.Type,
                    Customer = e.Customer,
                    Food = e.Food,
                    Scored = e.Scored,
                    Quality = e.Quality,
                    Coins = e.Coins,
                    Combo = e.Combo,
                    Milestone = e.Milestone,
                    Success = e.Success,
                    FoodUid = e.FoodUid,
                    CustomerUid = e.CustomerUid,
                    Role = e.Role
                }).ToList()
            };
        }

        private void BreakCombo()
        {
            if (Combo > 0) Events.Add(new TurnEvent { Type = "combo", Combo = Combo, Milestone = false });
            Combo = 0;
        }

        private void CheckComboMilestone()
        {
            var m = Db.Grill.Scoring.ComboMilestones;
            if (m != null && m.Contains(Combo)) Events.Add(new TurnEvent { Type = "combo", Combo = Combo, Milestone = true });
        }

        public CustomerRuntime SpawnCustomer(string? forcedId = null)
        {
            List<IngredientsItems> MenuFor(CustomersCustomers c) => c.UnusualOnly == true
                ? AvailableIngredients.Where(i => i.Rarity != "common").ToList()
                : AvailableIngredients;

            var pool = Restaurant.CustomerPool
                .Select(id => Db.CustomerById(id))
                .Where(c => c != null && c.IsVip != true && c.Weight > 0 && c.MinRestaurant <= Restaurant.Index && MenuFor(c!).Count > 0)
                .ToList()!;

            CustomersCustomers def;
            string? source = null;
            var vipDef = Db.CustomerById("vip");

            if (string.IsNullOrEmpty(forcedId) && vipDef != null && MenuFor(vipDef).Count > 0 && !Finished && Customers.Count(c => c.State == "waiting") < Stats.MaxOrdersOnScreen)
            {
                double now = (Config.VipStartUnixSec ?? 0.0) + Time;
                double chance = VipRules.VipChance(Db, Config.Overrides?.VipChance, Math.Max(now, VipState.LastClockUnixSec));
                source = VipRules.AdmitVip(Db, VipState, Restaurant.Index, now, chance, () => _vipRng.Next());
            }

            if (source != null)
            {
                def = Db.CustomerById("vip")!;
            }
            else if (!string.IsNullOrEmpty(forcedId))
            {
                def = Db.CustomerById(forcedId!) ?? throw new ArgumentException($"spawnCustomer: unknown customer \"{forcedId}\"");
                if (def.IsVip == true) throw new InvalidOperationException("VIP: use a reserved call, not forced admission");
            }
            else
            {
                if (pool.Count == 0) throw new InvalidOperationException("spawnCustomer: no eligible customers with unlocked ingredients");
                double total = pool.Sum(c => (double)c!.Weight);
                double roll = _rng.Next() * total;
                int idx = 0;
                for (int i = 0; i < pool.Count; i++)
                {
                    roll -= pool[i]!.Weight;
                    if (roll <= 0) { idx = i; break; }
                }
                def = pool[idx]!;
            }

            var available = MenuFor(def);
            if (available.Count == 0) throw new InvalidOperationException($"spawnCustomer: no unlocked ingredients for \"{def.Id}\"");

            int itemCount = Math.Max(def.ItemsMin, Math.Min(def.ItemsMax, 1 + (int)Math.Floor(_rng.Next() * def.ItemsMax)));
            var lines = new List<OrderLine>();
            for (int i = 0; i < itemCount && available.Count > 0; i++)
            {
                var ing = available[(int)Math.Floor(_rng.Next() * available.Count)];
                if (lines.Any(l => l.IngredientId == ing.Id)) continue;
                double centre = (ing.PerfectWindow[0] + ing.PerfectWindow[1]) / 2.0;
                bool specific = def.AllowsSpecificDoneness && _rng.Next() < 0.7;
                lines.Add(new OrderLine { IngredientId = ing.Id, Target = specific ? centre : 0.0 });
            }
            if (lines.Count == 0 && available.Count > 0)
            {
                lines.Add(new OrderLine { IngredientId = available[0].Id, Target = 0.0 });
            }

            var p = Db.Customers.Patience;
            double patienceScale = (Config.Overrides?.PatienceScalar ?? 1.0) / (Config.Overrides?.DifficultyScalar ?? 1.0);
            double patience = Math.Max(
                p.MinSeconds,
                (p.BaseSeconds + p.PerItemSeconds * lines.Count) * def.PatienceMultiplier * Stats.PatienceMult * patienceScale
            );

            var customer = Admit(def, lines, patience);
            if (source != null)
            {
                customer.VipSource = source;
                Counters.VipSpawned++;
            }
            return customer;
        }

        private CustomerRuntime Admit(CustomersCustomers def, List<OrderLine> lines, double patience)
        {
            var c = new CustomerRuntime
            {
                Uid = _uid++,
                Def = def,
                Lines = lines,
                PatienceTotal = patience,
                PatienceLeft = patience,
                ArrivedAt = Time,
                State = "waiting",
                SlotIndex = _nextSpawnCount++,
                TotalValue = lines.Sum(l => (double)(Db.IngredientById(l.IngredientId)?.Value ?? 0))
            };
            Customers.Add(c);
            Counters.CustomersSpawned++;
            Events.Add(new TurnEvent { Type = "spawn", Customer = c });
            return c;
        }

        // ── Staff Subsystem ──────────────────────────────────────────────────

        private double ServeCoverage => Math.Min(_staffWaiter?.Coverage ?? 0.0, Db.Employees?.AutomationCap?.AutoServeMaxCoverage ?? 0.0);
        private double FlipCoverage => Math.Min(_staffCook?.Coverage ?? 0.0, Db.Employees?.AutomationCap?.AutoFlipMaxCoverage ?? 0.0);
        private double TripInterval => (_staffWaiter?.IntervalSec ?? 1.5) / Stats.ServeSpeedMult;

        private bool StaffMatches(CustomerRuntime c, FoodRuntime f)
        {
            if (c.State != "waiting" || Time - c.ArrivedAt <= (Db.Employees?.Service?.MinimumWaitSec ?? 1.5)) return false;
            if (f.Served || f.Burned) return false;
            var line = c.Lines.FirstOrDefault(l => l.IngredientId == f.Ingredient.Id && l.FulfilledBy.Count == 0);
            if (line == null) return false;
            if (f.Ingredient.CookMethod == "prep") return PrepSlots.Contains(f) && f.PrepProgress >= 1.0;
            if (!f.OnGrill) return false;
            var q = CookingRules.ScoreItem(Db, f, new ScoreContext
            {
                RestaurantIndex = Restaurant.Index,
                Target = line.Target,
                ToleranceScale = c.Def.ToleranceScale,
                PatienceRemaining = 0.0,
                Combo = 0,
                TipMult = 1.0,
                XpMult = 1.0,
                Tuning = _tuning
            }).Quality;
            return q == ServeQuality.Good || q == ServeQuality.Perfect;
        }

        private void StaffObserve()
        {
            if (_staffWaiter == null && _staffCook == null) return;
            for (int i = 0; i < Foods.Count; i++)
            {
                var f = Foods[i];
                if (_staffCook != null && f.Flips == 0 && CookingRules.PublicFlipReady(Db, f) && !_staffFlipSeen.ContainsKey(f.Uid))
                {
                    _staffFlipSeen[f.Uid] = Time;
                }
                if (_staffWaiter != null && !_staffServeSeen.Contains(f.Uid) && Customers.Any(c => StaffMatches(c, f)))
                {
                    _staffServeSeen.Add(f.Uid);
                }
            }
        }

        private void StaffTick()
        {
            if (Finished) return;
            StaffObserve();
            double now = Time;

            // Helper (prep)
            if (_staffHelper != null && now + 1e-9 >= _staffNextPrep)
            {
                _staffNextPrep = now + (_staffHelper.IntervalSec ?? 2.0);
                var prepared = new Dictionary<string, int>(StringComparer.Ordinal);
                for (int i = 0; i < PrepSlots.Count; i++)
                {
                    var f = PrepSlots[i];
                    if (f != null && !f.Served)
                    {
                        prepared.TryGetValue(f.Ingredient.Id, out int cnt);
                        prepared[f.Ingredient.Id] = cnt + 1;
                    }
                }
                var demand = Customers.Where(c => c.State == "waiting").OrderBy(c => c.Uid)
                    .SelectMany(c => c.Lines.Where(l => l.FulfilledBy.Count == 0));
                foreach (var line in demand)
                {
                    string id = line.IngredientId;
                    var ing = AvailableIngredients.FirstOrDefault(i => i.Id == id && i.CookMethod == "prep");
                    if (ing == null) continue;
                    prepared.TryGetValue(id, out int cov);
                    if (cov > 0) { prepared[id] = cov - 1; continue; }
                    if (PrepSlotsFree <= 0 || StockRemaining(id) <= 0) continue;
                    _staffPrepAttempts++;
                    if (_staffRng.Next() < _staffHelper.Coverage)
                    {
                        var f = TakeFromStock(ing);
                        if (StartPrep(f))
                        {
                            _staffPrepUsed++;
                            Events.Add(new TurnEvent { Type = "staff_action", Role = "auxiliar", FoodUid = f.Uid });
                        }
                        else Discard(f);
                    }
                    break;
                }
            }

            // Cook (flip)
            if (_staffCook != null && now + 1e-9 >= _staffNextFlip)
            {
                _staffNextFlip = now + (_staffCook.IntervalSec ?? 2.0);
                int limit = (int)Math.Floor(FlipCoverage * _staffFlipSeen.Count);
                if (_staffFlipUsed < limit)
                {
                    var f = Foods.Where(food => _staffFlipSeen.ContainsKey(food.Uid) && food.Flips == 0 && CookingRules.PublicFlipReady(Db, food))
                        .OrderBy(food => _staffFlipSeen[food.Uid]).ThenBy(food => food.Uid)
                        .FirstOrDefault();
                    if (f != null && Flip(f))
                    {
                        _staffFlipUsed++;
                        Events.Add(new TurnEvent { Type = "staff_action", Role = "churrasqueiro", FoodUid = f.Uid });
                    }
                }
            }

            // Waiter (serve)
            if (_staffWaiter != null && now + 1e-9 >= _staffNextServe)
            {
                int served = 0;
                int maxPlates = _staffWaiter.PlatesPerTrip ?? 1;
                int limit = (int)Math.Floor(ServeCoverage * _staffServeSeen.Count);
                foreach (var c in Customers.Where(c => c.State == "waiting").OrderBy(c => c.Uid))
                {
                    foreach (var f in Foods.OrderBy(food => food.Uid))
                    {
                        if (served >= maxPlates || _staffServeUsed >= limit) break;
                        if (!_staffServeSeen.Contains(f.Uid) || !StaffMatches(c, f)) continue;
                        if (CompleteServe(c, f, _staffWaiter.TipBonus ?? 0.0) != null)
                        {
                            _staffServeUsed++;
                            served++;
                            Events.Add(new TurnEvent { Type = "staff_action", Role = "garcom", FoodUid = f.Uid, CustomerUid = c.Uid });
                        }
                    }
                }
                if (served > 0) _staffNextServe = now + TripInterval;
            }

            // Burn warning
            if (_staffWaiter?.BurnWarningSec != null)
            {
                double warnSec = _staffWaiter.BurnWarningSec.Value;
                for (int i = 0; i < Foods.Count; i++)
                {
                    var f = Foods[i];
                    if (!f.OnGrill || f.Burned || f.Served) continue;
                    double heat = CookingRules.EffectiveHeat(Grill, f.ZoneIndex, Db);
                    double rate = heat * f.Ingredient.HeatRate * Stats.HeatRampRate / f.Ingredient.SideCookSec;
                    if (rate <= 0) continue;
                    double carry = Db.Ingredients.Shared.CarryoverRate;
                    double burnThreshold = Db.Ingredients.Shared.BurnedThreshold;
                    double minLeft = double.PositiveInfinity;
                    for (int s = 0; s < f.Sides.Length; s++)
                    {
                        double k = s == f.DownSide ? 1.0 : carry;
                        double left = (burnThreshold - f.Sides[s]) / (rate * k);
                        if (left < minLeft) minLeft = left;
                    }
                    if (minLeft >= 0 && minLeft <= warnSec)
                    {
                        if (!_staffWarned.Contains(f.Uid))
                        {
                            _staffWarned.Add(f.Uid);
                            Events.Add(new TurnEvent { Type = "staff_burn_risk", FoodUid = f.Uid });
                        }
                    }
                }
            }
        }
    }
}
