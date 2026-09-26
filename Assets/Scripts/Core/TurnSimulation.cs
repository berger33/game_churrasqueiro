#nullable enable
using System;
using System.Collections.Generic;
using Churrasco.Core.Generated;

namespace Churrasco.Core
{
    /// <summary>One order line of a customer.</summary>
    public sealed class OrderLine
    {
        public string IngredientId = "";
        /// <summary>Requested overall doneness target; 0 = "any point, just cook it".</summary>
        public double Target;
        public List<int> FulfilledBy = new List<int>();
    }

    public enum CustomerState { WalkingIn, Waiting, Served, Left }

    public sealed class CustomerRuntime
    {
        public int Uid;
        public CustomersCustomers Def = null!;
        public List<OrderLine> Lines = new List<OrderLine>();
        public double PatienceTotal;
        public double PatienceLeft;
        public CustomerState State;
        public int SlotIndex;
        public double TotalValue;
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
        /// <summary>
        /// False = no customer ever arrives on the spawn cadence; the caller admits them with
        /// <see cref="TurnSimulation.SpawnScriptedCustomer"/>. The FTUE's scripted turn uses this
        /// (docs/05 §4) so the first order is always the one being taught.
        /// </summary>
        public bool? AutoSpawn;
    }

    public sealed class TurnConfig
    {
        public int RestaurantIndex;
        public string LevelId = "";
        public Dictionary<string, int> UpgradeLevels = new Dictionary<string, int>(StringComparer.Ordinal);
        public double Seed;
        public TurnOverrides? Overrides;
        /// <summary>Churrasqueira progression — overrides the restaurant grill when present.</summary>
        public string? ChurrasqueiraId;
        public int? ChurrasqueiraLevel;
        /// <summary>
        /// Equipped charcoal type ("comum" / "vegetal" / "briquete"). Absent or unmatched = the
        /// pre-ladder game: 1,00× duration, 1,00× heat and the table's refill price. That is what
        /// keeps the golden vectors standing.
        /// </summary>
        public string? CharcoalType;
    }

    public sealed class TurnCounters
    {
        public int CustomersSpawned;
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
        /// <summary>Coins the charcoal ate this turn (drain on the turn's purse); null when zero.</summary>
        public double? CharcoalSpend;

        /// <summary>
        /// Named access, so the parity harness compares *every* key the vector carries without a
        /// hand-written list that quietly stops covering new counters when they are added.
        /// </summary>
        public double? Counter(string name) => name switch
        {
            "customersSpawned" => CustomersSpawned,
            "customersServed" => CustomersServed,
            "customersLost" => CustomersLost,
            "ordersCompleted" => OrdersCompleted,
            "perfectCooks" => PerfectCooks,
            "goodCooks" => GoodCooks,
            "burnedFood" => BurnedFood,
            "bestCombo" => BestCombo,
            "flips" => Flips,
            "itemsCooked" => ItemsCooked,
            "charcoalRefills" => CharcoalRefills,
            "peakSimultaneousOrders" => PeakSimultaneousOrders,
            "charcoalSpend" => CharcoalSpend,
            _ => (double?)null
        };
    }

    /// <summary>
    /// What happened during the turn, in order. The client animates from this; the golden vectors
    /// do not read it, so it is deliberately a flat record instead of the TypeScript union.
    /// </summary>
    public sealed class TurnEvent
    {
        public string Type = "";
        public CustomerRuntime? Customer;
        public FoodRuntime? Food;
        public ScoredItem? Scored;
        public double Coins;
        public int Combo;
        public bool Milestone;
    }

    public sealed class TurnResult
    {
        public string LevelId = "";
        public long Coins;
        public long Xp;
        public int Stars;
        public int Combo;
        public TurnCounters Counters = new TurnCounters();
        /// <summary>Raw turn spend; the <c>counters</c> view hides it when it is zero.</summary>
        public double CharcoalSpend;
        public double DurationSec;
        public bool Failed;
        public List<TurnEvent> Events = new List<TurnEvent>();
    }

    /// <summary>
    /// The turn. Direct transcription of <c>tools/sim-core/src/turn.ts</c>.
    ///
    /// Two structural differences from the reference, both deliberate and noted here rather than
    /// hidden: the per-tick <c>TurnActions</c> bag becomes the simulation itself (the TypeScript
    /// allocates one object with eight closures every frame, which is what the compaction comment
    /// is working around), and the callback-typed policy becomes <see cref="ITurnPolicy"/>. The
    /// arithmetic order is copied line for line — that is what the golden turn vectors check.
    /// </summary>
    public sealed class TurnSimulation
    {
        public readonly GameData Db;
        public DerivedStats Stats;
        public readonly GrillRuntime Grill;
        public readonly RestaurantsRestaurants Restaurant;
        public readonly TurnConfig Config;

        public List<FoodRuntime> Foods = new List<FoodRuntime>();
        public List<IngredientsItems> Bench = new List<IngredientsItems>();
        public List<CustomerRuntime> Customers = new List<CustomerRuntime>();
        public List<TurnEvent> Events = new List<TurnEvent>();

        public double Time;
        public double TimeLimit;
        public double SpawnTimer;
        public double SpawnInterval;
        public int Combo;
        public double Coins;
        public double Xp;
        public double CharcoalSpend;
        public TurnCounters Counters = new TurnCounters();

        private int _uid = 1;
        private int _nextSpawnCount;
        private int _uidCounter = 1;
        private bool _lowWarned;
        private double _refillTimer;
        private int _tickCount;
        private readonly List<PendingServe> _pendingServes = new List<PendingServe>();
        /// <summary>Owns the turn's randomness so two runs with the same seed are identical.</summary>
        private readonly Rng _rng;
        private readonly RewardTuning _tuning;

        private sealed class PendingServe
        {
            public CustomerRuntime Customer = null!;
            public FoodRuntime Food = null!;
            public double At;
        }

        /// <summary><paramref name="seed"/> overrides <c>config.Seed</c> exactly as the reference's optional third argument does.</summary>
        public TurnSimulation(GameData data, TurnConfig config, double? seed = null)
        {
            Db = data;
            Config = config;
            // JS: `new Rng(seed ^ 0x5eed)` — the xor lands in int32 and Rng then ToUint32's it, so
            // the bit pattern the stream starts from is `ToUint32(seed) ^ 0x5eed` (negative and
            // wrapped results are the same 32 bits either way). Doing it in `unchecked` keeps that.
            _rng = new Rng(unchecked(Rng.ToUint32(seed ?? config.Seed) ^ 0x5eedu));
            _tuning = CookingRules.RewardTuningOf(data);
            Restaurant = data.RestaurantByIndex(config.RestaurantIndex) ?? data.RestaurantByIndex(0)!;

            var stats = CookingRules.DeriveStats(data, Restaurant, config.UpgradeLevels);
            if (!string.IsNullOrEmpty(config.ChurrasqueiraId))
            {
                stats = CookingRules.ApplyChurrasqueiraToStats(
                    stats, data, config.ChurrasqueiraId!, config.ChurrasqueiraLevel ?? 1, Restaurant);
            }
            // Charcoal goes on top of both layers: it is the only thing that multiplies the burn
            // after grill and restaurant have already talked to each other (cooking.ts explains why).
            Stats = CookingRules.ApplyCharcoalTypeToStats(stats, data, config.CharcoalType);
            Grill = CookingRules.CreateGrill(Stats, data);
            if (!string.IsNullOrEmpty(config.ChurrasqueiraId))
            {
                CookingRules.PatchGrillForChurrasqueira(
                    Grill, data, config.ChurrasqueiraId!, config.ChurrasqueiraLevel ?? 1);
            }

            var ov = config.Overrides;
            TimeLimit = ov?.TurnLengthSec ?? Restaurant.TurnLengthSec;
            SpawnInterval = ov?.SpawnIntervalSec ?? 7.5;
            // An infinite timer never reaches zero, so Tick stays byte-identical for every normal
            // turn and the golden vectors cannot move.
            SpawnTimer = ov?.AutoSpawn == false ? double.PositiveInfinity : 1.2;
        }

        // ── Public entry points the FTUE uses ───────────────────────────────

        /// <summary>
        /// Admit a customer with a fixed order. No dice are rolled, so the turn's RNG stream is
        /// untouched. Lines are "any doneness" (target 0) and duplicate ingredients collapse, exactly
        /// as the random spawner does.
        /// </summary>
        public CustomerRuntime SpawnScriptedCustomer(string customerId, IReadOnlyList<string> ingredientIds, double patienceSec)
        {
            var def = Db.CustomerById(customerId)
                ?? throw new InvalidOperationException($"SpawnScriptedCustomer: unknown customer \"{customerId}\"");
            var lines = new List<OrderLine>();
            for (int i = 0; i < ingredientIds.Count; i++)
            {
                var id = ingredientIds[i];
                if (Db.IngredientById(id) == null)
                    throw new InvalidOperationException($"SpawnScriptedCustomer: unknown ingredient \"{id}\"");
                bool dup = false;
                for (int k = 0; k < lines.Count; k++) if (lines[k].IngredientId == id) { dup = true; break; }
                if (dup) continue;
                lines.Add(new OrderLine { IngredientId = id, Target = 0 });
            }
            if (lines.Count == 0) throw new InvalidOperationException("SpawnScriptedCustomer: empty order");
            return Admit(def, lines, Math.Max(1, patienceSec));
        }

        /// <summary>
        /// Bring the end of the turn forward to <paramref name="sec"/> from now — never later than it
        /// already is. The FTUE closes its scripted turn this way once the last order lands.
        /// </summary>
        public void EndAfter(double sec)
        {
            TimeLimit = Math.Min(TimeLimit, Time + Math.Max(0, sec));
        }

        // ── Player / policy actions ─────────────────────────────────────────

        /// <summary>Create a raw item on the bench and return it (models taking food from the cooler).</summary>
        public FoodRuntime TakeFromStock(IngredientsItems ingredient)
        {
            var f = CookingRules.CreateFood(_uidCounter++, ingredient);
            Foods.Add(f);
            return f;
        }

        public bool Place(FoodRuntime food, int zoneIndex)
        {
            if (food.Burned || food.Served) return false;
            return CookingRules.PlaceOnGrill(Grill, food, zoneIndex);
        }

        public bool Move(FoodRuntime food, int zoneIndex)
        {
            if (!food.OnGrill) return false;
            return CookingRules.PlaceOnGrill(Grill, food, zoneIndex);
        }

        public bool Flip(FoodRuntime food)
        {
            bool ok = CookingRules.FlipFood(Grill, food, Time, Db);
            if (ok) Counters.Flips++;
            return ok;
        }

        /// <summary>
        /// Refill the coals. The type's price comes out of the turn's own purse: if there is no coin
        /// to pay, the refill comes from the kitchen float and is free — so the charcoal choice never
        /// stalls the loop nor punishes a broke player (docs/23 §4).
        /// </summary>
        public bool RefillCharcoal()
        {
            if (_refillTimer > 0) return false;
            double cost = CookingRules.CharcoalRefillCost(Db, Config.CharcoalType);
            if (cost > 0 && Coins >= cost)
            {
                Coins -= cost;
                CharcoalSpend += cost;
            }
            _refillTimer = Db.Grill.Charcoal.RefillTimeSec;
            Grill.Refilling = _refillTimer;
            return true;
        }

        /// <summary>Price of the next refill with the current type (for HUD and policy).</summary>
        public double CharcoalRefillCostCoins => CookingRules.CharcoalRefillCost(Db, Config.CharcoalType);

        public void ServeDelayed(CustomerRuntime customer, FoodRuntime food, double delaySec)
        {
            if (delaySec <= 0) { Serve(customer, food); return; }
            // Do not double-queue the same plate while the tap is "in flight".
            for (int i = 0; i < _pendingServes.Count; i++)
                if (ReferenceEquals(_pendingServes[i].Food, food)) return;
            _pendingServes.Add(new PendingServe { Customer = customer, Food = food, At = Time + delaySec });
        }

        public void Discard(FoodRuntime food)
        {
            CookingRules.RemoveFromGrill(Grill, food);
            food.Served = true;
            int i = Foods.IndexOf(food);
            if (i >= 0) Foods.RemoveAt(i);
        }

        public ScoredItem? Serve(CustomerRuntime customer, FoodRuntime food)
        {
            if (customer.State != CustomerState.Waiting) return null;
            if (food.Served) return null;
            // Prep items (vinagrete) never touch the grill; they are ready when prepped.
            bool isPrep = food.Ingredient.CookMethod == "prep";
            if (isPrep) { if (food.PrepProgress < 1) return null; }
            else if (!food.OnGrill) return null;

            OrderLine? line = null;
            for (int i = 0; i < customer.Lines.Count; i++)
            {
                var l = customer.Lines[i];
                if (l.IngredientId == food.Ingredient.Id && l.FulfilledBy.Count < 1) { line = l; break; }
            }
            if (line == null) return null;

            double patienceRemaining = MathUtil.Clamp(customer.PatienceLeft / customer.PatienceTotal, 0, 1);
            var scored = CookingRules.ScoreItem(Db, food, new ScoreContext
            {
                Target = line.Target,
                ToleranceScale = customer.Def.ToleranceScale,
                PatienceRemaining = patienceRemaining,
                Combo = Combo,
                TipMult = Stats.TipMult,
                XpMult = Stats.XpMult,
                CustomerTipMult = customer.Def.TipMultiplier,
                Tuning = _tuning
            });

            line.FulfilledBy.Add(food.Uid);
            CookingRules.RemoveFromGrill(Grill, food);
            food.Served = true;
            Counters.ItemsCooked++;

            Coins += scored.Coins;
            Xp += scored.Xp;

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
                BreakCombo();
            }

            if (scored.Quality == ServeQuality.Burned) Counters.BurnedFood++;
            if (Combo > Counters.BestCombo) Counters.BestCombo = Combo;
            CheckComboMilestone();
            Events.Add(new TurnEvent
            {
                Type = "serve", Customer = customer, Scored = scored, Coins = scored.Coins, Combo = Combo
            });

            bool complete = true;
            for (int i = 0; i < customer.Lines.Count; i++)
                if (customer.Lines[i].FulfilledBy.Count < 1) { complete = false; break; }
            if (complete)
            {
                customer.State = CustomerState.Served;
                Counters.CustomersServed++;
                Counters.OrdersCompleted++;
            }
            return scored;
        }

        // ── Simulation step ─────────────────────────────────────────────────

        public void Tick(double dt, ITurnPolicy? policy = null)
        {
            Time += dt;
            _tickCount++;
            // Periodic compaction: finished food and departed customers are dropped from the hot
            // lists so per-frame scans stay O(active) instead of O(ever).
            if ((_tickCount & 31) == 0) Compact();

            if (_refillTimer > 0)
            {
                _refillTimer -= dt;
                if (_refillTimer <= 0)
                {
                    _refillTimer = 0;
                    Counters.CharcoalRefills++;
                    Events.Add(new TurnEvent { Type = "charcoal_refilled" });
                }
            }

            CookingRules.TickGrill(Grill, Db, dt, f =>
            {
                Counters.BurnedFood++;
                Counters.Flawless = false;
                BreakCombo();
                Events.Add(new TurnEvent { Type = "burned", Food = f });
            });

            // Charcoal warning (one shot per load).
            double fuelLeft = 1 - Grill.CharcoalT;
            if (!_lowWarned && fuelLeft < Db.Grill.Charcoal.LowWarningThreshold)
            {
                _lowWarned = true;
                Events.Add(new TurnEvent { Type = "charcoal_low" });
            }
            if (fuelLeft > Db.Grill.Charcoal.LowWarningThreshold) _lowWarned = false;

            // Prep items (vinagrete etc.) finish off the grill. Their doneness is driven to the
            // window centre so the shared scoring path still applies.
            for (int i = 0; i < Foods.Count; i++)
            {
                var f = Foods[i];
                if (f.Served || f.Burned || f.OnGrill) continue;
                var ing = f.Ingredient;
                if (ing.CookMethod != "prep" || ing.PrepSec == null || ing.PrepSec.Value == 0) continue;
                f.PrepProgress = MathUtil.Clamp(
                    f.PrepProgress + (dt * Stats.PrepSpeedMult) / ing.PrepSec.Value, 0, 1);
                double centre = (ing.PerfectWindow[0] + ing.PerfectWindow[1]) / 2;
                // `|| 0.8` in the reference: 0 and NaN fall back, everything else stands.
                if (centre == 0 || double.IsNaN(centre)) centre = 0.8;
                f.Sides[0] = f.PrepProgress * centre;
            }

            // Customer spawning. (Single pass — this runs every frame.)
            SpawnTimer -= dt * Stats.CustomerSpawnRate;
            int active = 0;
            for (int i = 0; i < Customers.Count; i++)
                if (Customers[i].State == CustomerState.Waiting) active++;

            if (SpawnTimer <= 0)
            {
                SpawnTimer = SpawnInterval;
                int cap = Config.Overrides?.MaxOrdersOnScreen ?? Stats.MaxOrdersOnScreen;
                if (active < cap) SpawnCustomer();
            }

            // Resolve queued serves whose tap has landed.
            if (_pendingServes.Count > 0)
            {
                int w = 0;
                for (int i = 0; i < _pendingServes.Count; i++)
                {
                    var ps = _pendingServes[i];
                    if (ps.At <= Time)
                    {
                        if (ps.Customer.State == CustomerState.Waiting && !ps.Food.Served && !ps.Food.Burned)
                            Serve(ps.Customer, ps.Food);
                    }
                    else
                    {
                        _pendingServes[w++] = ps;
                    }
                }
                _pendingServes.RemoveRange(w, _pendingServes.Count - w);
            }

            // Patience.
            for (int i = 0; i < Customers.Count; i++)
            {
                var c = Customers[i];
                if (c.State != CustomerState.Waiting) continue;
                c.PatienceLeft -= dt;
                if (c.PatienceLeft <= 0)
                {
                    c.PatienceLeft = 0;
                    c.State = CustomerState.Left;
                    for (int k = _pendingServes.Count - 1; k >= 0; k--)
                        if (ReferenceEquals(_pendingServes[k].Customer, c)) _pendingServes.RemoveAt(k);
                    Counters.CustomersLost++;
                    Counters.Flawless = false;
                    BreakCombo();
                    Events.Add(new TurnEvent { Type = "left", Customer = c });
                }
            }

            if (active > Counters.PeakSimultaneousOrders) Counters.PeakSimultaneousOrders = active;

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
                    if (!ps.Food.Served && ps.Customer.State == CustomerState.Waiting) _pendingServes[w++] = ps;
                }
                _pendingServes.RemoveRange(w, _pendingServes.Count - w);
            }
            {
                int w = 0;
                for (int i = 0; i < Foods.Count; i++)
                    if (!Foods[i].Served) Foods[w++] = Foods[i];
                Foods.RemoveRange(w, Foods.Count - w);
            }
            if (Customers.Count > 8)
            {
                int w = 0;
                for (int i = 0; i < Customers.Count; i++)
                    if (Customers[i].State == CustomerState.Waiting) Customers[w++] = Customers[i];
                Customers.RemoveRange(w, Customers.Count - w);
            }
        }

        public double TimeLeft => Math.Max(0, TimeLimit - Time);

        public bool Finished => Time >= TimeLimit;

        public TurnResult Result()
        {
            int served = Counters.CustomersServed;
            int total = Math.Max(1, Counters.CustomersSpawned);
            double ratio = served / (double)total;
            int stars = ratio >= 0.9 ? 3 : ratio >= 0.65 ? 2 : ratio >= 0.35 ? 1 : 0;
            var bonus = Db.Economy.Reward.TurnEndBonus;
            double endBonus = Math.Max(0, bonus.Base + bonus.PerPerfect * Counters.PerfectCooks
                + bonus.PerLostCustomer * Counters.CustomersLost);
            Coins += endBonus;
            Xp = MathUtil.RoundHalfUp(Xp);

            var counters = new TurnCounters
            {
                CustomersSpawned = Counters.CustomersSpawned,
                CustomersServed = Counters.CustomersServed,
                CustomersLost = Counters.CustomersLost,
                OrdersCompleted = Counters.OrdersCompleted,
                PerfectCooks = Counters.PerfectCooks,
                GoodCooks = Counters.GoodCooks,
                BurnedFood = Counters.BurnedFood,
                BestCombo = Counters.BestCombo,
                Flips = Counters.Flips,
                ItemsCooked = Counters.ItemsCooked,
                CharcoalRefills = Counters.CharcoalRefills,
                PeakSimultaneousOrders = Counters.PeakSimultaneousOrders,
                Flawless = Counters.Flawless,
                CharcoalSpend = CharcoalSpend > 0 ? CharcoalSpend : (double?)null
            };

            return new TurnResult
            {
                LevelId = Config.LevelId,
                Coins = (long)MathUtil.RoundHalfUp(Coins),
                Xp = (long)Xp,
                Stars = stars,
                Combo = Counters.BestCombo,
                Counters = counters,
                CharcoalSpend = CharcoalSpend,
                DurationSec = Time,
                Failed = stars == 0 && Counters.CustomersLost > served,
                Events = Events
            };
        }

        // ── internals ──────────────────────────────────────────────────────

        private void BreakCombo()
        {
            if (Combo > 0) Events.Add(new TurnEvent { Type = "combo", Combo = Combo, Milestone = false });
            Combo = 0;
        }

        private void CheckComboMilestone()
        {
            var m = Db.Grill.Scoring.ComboMilestones;
            if (m != null && m.Contains(Combo))
                Events.Add(new TurnEvent { Type = "combo", Combo = Combo, Milestone = true });
        }

        /// <summary>
        /// Deterministic customer + order generation. Mirrors <c>OrderGenerator.cs</c>. The item list
        /// is walked in table order (<c>Ingredients.Items</c>) because the dice index into it — going
        /// through the id dictionary would have made the pick depend on hash ordering.
        /// </summary>
        public CustomerRuntime SpawnCustomer(string? forcedId = null)
        {
            var pool = new List<CustomersCustomers>();
            var customerIds = Restaurant.CustomerPool;
            if (customerIds != null)
            {
                for (int i = 0; i < customerIds.Count; i++)
                {
                    var c = Db.CustomerById(customerIds[i]);
                    if (c != null && c.Weight > 0 && c.MinRestaurant <= Restaurant.Index) pool.Add(c);
                }
            }

            CustomersCustomers def;
            if (!string.IsNullOrEmpty(forcedId))
            {
                def = Db.CustomerById(forcedId!) ?? (pool.Count > 0 ? pool[0] : null)
                    ?? throw new InvalidOperationException("spawnCustomer: no customer pool");
            }
            else
            {
                double total = 0;
                for (int i = 0; i < pool.Count; i++) total += pool[i].Weight;
                double roll = _rng.Next() * total;
                int idx = 0;
                for (int i = 0; i < pool.Count; i++)
                {
                    roll -= pool[i].Weight;
                    if (roll <= 0) { idx = i; break; }
                }
                def = idx < pool.Count && pool.Count > 0 ? pool[idx] : pool[0];
            }

            int itemCount = Math.Max(def.ItemsMin,
                Math.Min(def.ItemsMax, 1 + (int)Math.Floor(_rng.Next() * def.ItemsMax)));

            var available = new List<IngredientsItems>();
            var items = Db.Ingredients.Items;
            bool unusualOnly = def.UnusualOnly ?? false;
            for (int i = 0; i < items.Count; i++)
            {
                var it = items[i];
                if (it.Unlock != null && it.Unlock.RestaurantIndex <= Restaurant.Index
                    && (!unusualOnly || it.Rarity != "common")) available.Add(it);
            }

            var lines = new List<OrderLine>();
            for (int i = 0; i < itemCount && available.Count > 0; i++)
            {
                var ing = available[(int)Math.Floor(_rng.Next() * available.Count)];
                bool dup = false;
                for (int k = 0; k < lines.Count; k++) if (lines[k].IngredientId == ing.Id) { dup = true; break; }
                if (dup) continue;
                double lo = ing.PerfectWindow[0], hi = ing.PerfectWindow[1];
                double centre = (lo + hi) / 2;
                bool specific = def.AllowsSpecificDoneness && _rng.Next() < 0.7;
                lines.Add(new OrderLine { IngredientId = ing.Id, Target = specific ? centre : 0 });
            }
            if (lines.Count == 0 && available.Count > 0)
            {
                var ing = available[0];
                lines.Add(new OrderLine { IngredientId = ing.Id, Target = 0 });
            }

            var p = Db.Customers.Patience;
            var ov = Config.Overrides;
            double patienceScale = (ov?.PatienceScalar ?? 1) / (ov?.DifficultyScalar ?? 1);
            double patience = Math.Max(p.MinSeconds,
                (p.BaseSeconds + p.PerItemSeconds * lines.Count) * def.PatienceMultiplier
                * Stats.PatienceMult * patienceScale);

            return Admit(def, lines, patience);
        }

        /// <summary>Shared bookkeeping for every arrival, random or scripted.</summary>
        private CustomerRuntime Admit(CustomersCustomers def, List<OrderLine> lines, double patience)
        {
            double totalValue = 0;
            for (int i = 0; i < lines.Count; i++)
            {
                var ing = Db.IngredientById(lines[i].IngredientId);
                if (ing != null) totalValue += ing.Value;
            }
            var c = new CustomerRuntime
            {
                Uid = _uid++,
                Def = def,
                Lines = lines,
                PatienceTotal = patience,
                PatienceLeft = patience,
                State = CustomerState.Waiting,
                SlotIndex = _nextSpawnCount++,
                TotalValue = totalValue
            };
            Customers.Add(c);
            Counters.CustomersSpawned++;
            Events.Add(new TurnEvent { Type = "spawn", Customer = c });
            return c;
        }
    }
}
