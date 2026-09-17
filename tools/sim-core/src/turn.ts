import { clamp } from './data.ts';
import { Rng } from './rng.ts';
import {
  createFood,
  createGrill,
  deriveStats,
  effectiveHeat,
  flipFood,
  grillSlotsFree,
  overallDoneness,
  placeOnGrill,
  removeFromGrill,
  rewardTuning,
  scoreItem,
  stageOf,
  tickGrill,
  zoneIsFull,
  type DerivedStats,
  type FoodRuntime,
  type GrillRuntime,
  type ServeQuality,
  type ScoredItem
} from './cooking.ts';
import type { CustomerDef, GameDatabase, Ingredient, RestaurantDef } from './types.ts';

export interface OrderLine {
  ingredientId: string;
  /** Requested overall doneness target; 0 = "any point, just cook it". */
  target: number;
  fulfilledBy: number[];
}

export type CustomerState = 'walking_in' | 'waiting' | 'served' | 'left';

export interface CustomerRuntime {
  uid: number;
  def: CustomerDef;
  lines: OrderLine[];
  patienceTotal: number;
  patienceLeft: number;
  state: CustomerState;
  slotIndex: number;
  totalValue: number;
}

export interface TurnConfig {
  restaurantIndex: number;
  levelId: string;
  upgradeLevels: Record<string, number>;
  seed: number;
  /** Optional overrides for balance tests / Remote Config. */
  overrides?: Partial<{
    turnLengthSec: number;
    spawnIntervalSec: number;
    difficultyScalar: number;
    /** Direct multiplier on the patience budget (< 1 = impatient customers). */
    patienceScalar: number;
    vipChance: number;
    maxOrdersOnScreen: number;
    tipBase: number;
  }>;
}

export interface TurnCounters {
  customersSpawned: number;
  customersServed: number;
  customersLost: number;
  ordersCompleted: number;
  perfectCooks: number;
  goodCooks: number;
  burnedFood: number;
  bestCombo: number;
  flips: number;
  itemsCooked: number;
  charcoalRefills: number;
  peakSimultaneousOrders: number;
  flawless: boolean;
}

export type TurnEvent =
  | { type: 'spawn'; customer: CustomerRuntime }
  | { type: 'serve'; customer: CustomerRuntime; quality: ServeQuality; coins: number; combo: number }
  | { type: 'perfect'; food: FoodRuntime; scored: ScoredItem; combo: number }
  | { type: 'burned'; food: FoodRuntime }
  | { type: 'left'; customer: CustomerRuntime }
  | { type: 'combo'; combo: number; milestone: boolean }
  | { type: 'charcoal_low' }
  | { type: 'charcoal_refilled' }
  | { type: 'turn_end' };

export interface TurnResult {
  levelId: string;
  coins: number;
  xp: number;
  stars: number;
  combo: number;
  counters: TurnCounters;
  durationSec: number;
  failed: boolean;
  events: TurnEvent[];
}

/** Everything a player policy (human or AI) may do during a turn. */
export interface TurnActions {
  bench: Ingredient[];
  foods: FoodRuntime[];
  customers: CustomerRuntime[];
  grill: GrillRuntime;
  now: number;
  timeLeft: number;
  combo: number;
  /** Pull a raw item out of the cooler onto the bench. */
  spawn(ingredient: Ingredient): FoodRuntime;
  place(food: FoodRuntime, zoneIndex: number): boolean;
  move(food: FoodRuntime, zoneIndex: number): boolean;
  flip(food: FoodRuntime): boolean;
  serve(customer: CustomerRuntime, food: FoodRuntime): ScoredItem | null;
  /**
   * Queue a serve that lands `delaySec` later, modelling decide → tap latency.
   * The shipped client passes 0 (a tap is instant); the balance harness passes a
   * human reaction time so the skill axis is measurable.
   */
  serveDelayed(customer: CustomerRuntime, food: FoodRuntime, delaySec: number): void;
  discard(food: FoodRuntime): void;
  refillCharcoal(): boolean;
  db: GameDatabase;
}

export type TurnPolicy = (a: TurnActions) => void;

export class TurnSimulation {
  readonly db: GameDatabase;
  readonly stats: DerivedStats;
  readonly grill: GrillRuntime;
  readonly restaurant: RestaurantDef;
  readonly config: TurnConfig;

  foods: FoodRuntime[] = [];
  bench: Ingredient[] = [];
  customers: CustomerRuntime[] = [];
  events: TurnEvent[] = [];

  time = 0;
  timeLimit: number;
  spawnTimer: number;
  spawnInterval: number;
  combo = 0;
  coins = 0;
  xp = 0;
  private uid = 1;
  private nextSpawnCount = 0;
  private uidCounter = 1;
  private lowWarned = false;
  private refillTimer = 0;
  private tickCount = 0;
  private pendingServes: { customer: CustomerRuntime; food: FoodRuntime; at: number }[] = [];
  /** Owns the turn's randomness so two runs with the same seed are identical. */
  private readonly rng: Rng;
  private readonly tuning: ReturnType<typeof rewardTuning>;

  counters: TurnCounters = {
    customersSpawned: 0,
    customersServed: 0,
    customersLost: 0,
    ordersCompleted: 0,
    perfectCooks: 0,
    goodCooks: 0,
    burnedFood: 0,
    bestCombo: 0,
    flips: 0,
    itemsCooked: 0,
    charcoalRefills: 0,
    peakSimultaneousOrders: 0,
    flawless: true
  };

  constructor(db: GameDatabase, config: TurnConfig, seed: number = config.seed) {
    this.db = db;
    this.config = config;
    this.rng = new Rng(seed ^ 0x5eed);
    this.tuning = rewardTuning(db.economy);
    this.restaurant = db.restaurantByIndex.get(config.restaurantIndex) ?? db.restaurantByIndex.get(0)!;
    this.stats = deriveStats(db, this.restaurant, config.upgradeLevels);
    this.grill = createGrill(this.stats, db);
    this.timeLimit = config.overrides?.turnLengthSec ?? this.restaurant.turnLengthSec;
    this.spawnInterval = config.overrides?.spawnIntervalSec ?? 7.5;
    this.spawnTimer = 1.2;
  }

  // ── Player / policy actions ────────────────────────────────────────────────

  /** Create a raw item on the bench and return it (models taking food from the cooler). */
  takeFromStock(ingredient: Ingredient): FoodRuntime {
    const f = createFood(this.uidCounter++, ingredient);
    this.foods.push(f);
    return f;
  }

  place(food: FoodRuntime, zoneIndex: number): boolean {
    if (food.burned || food.served) return false;
    return placeOnGrill(this.grill, this.db, food, zoneIndex);
  }

  move(food: FoodRuntime, zoneIndex: number): boolean {
    if (!food.onGrill) return false;
    return placeOnGrill(this.grill, this.db, food, zoneIndex);
  }

  flip(food: FoodRuntime): boolean {
    const ok = flipFood(this.grill, food, this.time, this.db);
    if (ok) this.counters.flips++;
    return ok;
  }

  refillCharcoal(): boolean {
    if (this.refillTimer > 0) return false;
    this.refillTimer = this.db.grill.charcoal.refillTimeSec;
    this.grill.refilling = this.refillTimer;
    return true;
  }

  serveDelayed(customer: CustomerRuntime, food: FoodRuntime, delaySec: number): void {
    if (delaySec <= 0) {
      this.serve(customer, food);
      return;
    }
    // Do not double-queue the same plate while the tap is "in flight".
    for (let i = 0; i < this.pendingServes.length; i++) {
      if (this.pendingServes[i]!.food === food) return;
    }
    this.pendingServes.push({ customer, food, at: this.time + delaySec });
  }

  discard(food: FoodRuntime): void {
    removeFromGrill(this.grill, food);
    food.served = true;
    const i = this.foods.indexOf(food);
    if (i >= 0) this.foods.splice(i, 1);
  }

  serve(customer: CustomerRuntime, food: FoodRuntime): ScoredItem | null {
    if (customer.state !== 'waiting') return null;
    if (food.served) return null;
    // Prep items (vinagrete) never touch the grill; they are ready when prepped.
    const isPrep = food.ingredient.cookMethod === 'prep';
    if (isPrep) {
      if (food.prepProgress < 1) return null;
    } else if (!food.onGrill) {
      return null;
    }

    const line = customer.lines.find((l) => l.ingredientId === food.ingredient.id && l.fulfilledBy.length < 1);
    if (!line) return null;

    const patienceRemaining = clamp(customer.patienceLeft / customer.patienceTotal, 0, 1);
    const scored = scoreItem(this.db, food, {
      target: line.target,
      toleranceScale: customer.def.toleranceScale,
      patienceRemaining,
      combo: this.combo,
      tipMult: this.stats.tipMult,
      xpMult: this.stats.xpMult,
      customerTipMult: customer.def.tipMultiplier,
      tuning: this.tuning
    });

    line.fulfilledBy.push(food.uid);
    removeFromGrill(this.grill, food);
    food.served = true;
    this.counters.itemsCooked++;

    this.coins += scored.coins;
    this.xp += scored.xp;

    if (scored.quality === 'perfect') {
      this.combo++;
      this.counters.perfectCooks++;
      this.events.push({ type: 'perfect', food, scored, combo: this.combo });
    } else if (scored.quality === 'good') {
      this.combo++;
      this.counters.goodCooks++;
    } else {
      this.breakCombo('burned');
    }

    if (scored.quality === 'burned') this.counters.burnedFood++;
    if (this.combo > this.counters.bestCombo) this.counters.bestCombo = this.combo;
    this.checkComboMilestone();
    this.events.push({ type: 'serve', customer, quality: scored.quality, coins: scored.coins, combo: this.combo });

    const complete = customer.lines.every((l) => l.fulfilledBy.length >= 1);
    if (complete) {
      customer.state = 'served';
      this.counters.customersServed++;
      this.counters.ordersCompleted++;
    }
    return scored;
  }

  // ── Simulation step ────────────────────────────────────────────────────────

  tick(dt: number, policy?: TurnPolicy): void {
    this.time += dt;
    this.tickCount++;
    // Periodic compaction: finished food and departed customers are dropped from
    // the hot arrays so per-frame scans stay O(active) instead of O(ever).
    if ((this.tickCount & 31) === 0) this.compact();

    if (this.refillTimer > 0) {
      this.refillTimer -= dt;
      if (this.refillTimer <= 0) {
        this.refillTimer = 0;
        this.counters.charcoalRefills++;
        this.events.push({ type: 'charcoal_refilled' });
      }
    }

    tickGrill(this.grill, this.db, dt, (f) => {
      this.counters.burnedFood++;
      this.counters.flawless = false;
      this.breakCombo('burned');
      this.events.push({ type: 'burned', food: f });
    });

    // Charcoal warning (one shot per load).
    const fuelLeft = 1 - this.grill.charcoalT;
    if (!this.lowWarned && fuelLeft < this.db.grill.charcoal.lowWarningThreshold) {
      this.lowWarned = true;
      this.events.push({ type: 'charcoal_low' });
    }
    if (fuelLeft > this.db.grill.charcoal.lowWarningThreshold) this.lowWarned = false;

    // Prep items (vinagrete etc.) finish off the grill. Their doneness is driven
    // to the window centre so the shared scoring path still applies.
    for (const f of this.foods) {
      if (f.served || f.burned || f.onGrill) continue;
      const ing = f.ingredient;
      if (ing.cookMethod !== 'prep' || !ing.prepSec) continue;
      f.prepProgress = clamp(f.prepProgress + (dt * this.stats.prepSpeedMult) / ing.prepSec, 0, 1);
      const centre = (ing.perfectWindow[0] + ing.perfectWindow[1]) / 2 || 0.8;
      f.sides[0] = f.prepProgress * centre;
    }

    // Customer spawning. (Single pass — this runs every frame.)
    this.spawnTimer -= dt * this.stats.customerSpawnRate;
    let active = 0;
    for (let i = 0; i < this.customers.length; i++) if (this.customers[i]!.state === 'waiting') active++;

    if (this.spawnTimer <= 0) {
      this.spawnTimer = this.spawnInterval;
      const cap = this.config.overrides?.maxOrdersOnScreen ?? this.stats.maxOrdersOnScreen;
      if (active < cap) this.spawnCustomer();
    }

    // Resolve queued serves whose tap has landed.
    if (this.pendingServes.length > 0) {
      let w = 0;
      for (let i = 0; i < this.pendingServes.length; i++) {
        const ps = this.pendingServes[i]!;
        if (ps.at <= this.time) {
          if (ps.customer.state === 'waiting' && !ps.food.served && !ps.food.burned) this.serve(ps.customer, ps.food);
        } else {
          this.pendingServes[w++] = ps;
        }
      }
      this.pendingServes.length = w;
    }

    // Patience.
    for (const c of this.customers) {
      if (c.state !== 'waiting') continue;
      c.patienceLeft -= dt;
      if (c.patienceLeft <= 0) {
        c.patienceLeft = 0;
        c.state = 'left';
        for (let i = this.pendingServes.length - 1; i >= 0; i--) {
          if (this.pendingServes[i]!.customer === c) this.pendingServes.splice(i, 1);
        }
        this.counters.customersLost++;
        this.counters.flawless = false;
        this.breakCombo('lost');
        this.events.push({ type: 'left', customer: c });
      }
    }

    if (active > this.counters.peakSimultaneousOrders) this.counters.peakSimultaneousOrders = active;

    if (policy) {
      policy({
        db: this.db,
        bench: this.bench,
        foods: this.foods,
        customers: this.customers,
        grill: this.grill,
        now: this.time,
        timeLeft: Math.max(0, this.timeLimit - this.time),
        combo: this.combo,
        spawn: (ing) => this.takeFromStock(ing),
        place: (f, z) => this.place(f, z),
        move: (f, z) => this.move(f, z),
        flip: (f) => this.flip(f),
        serve: (c, f) => this.serve(c, f),
        serveDelayed: (c, f, d) => this.serveDelayed(c, f, d),
        discard: (f) => this.discard(f),
        refillCharcoal: () => this.refillCharcoal()
      });
    }
  }

  private compact(): void {
    if (this.pendingServes.length > 8) {
      let w = 0;
      for (let i = 0; i < this.pendingServes.length; i++) {
        const ps = this.pendingServes[i]!;
        if (!ps.food.served && ps.customer.state === 'waiting') this.pendingServes[w++] = ps;
      }
      this.pendingServes.length = w;
    }
    {
      let w = 0;
      for (let i = 0; i < this.foods.length; i++) {
        const f = this.foods[i]!;
        if (!f.served) this.foods[w++] = f;
      }
      this.foods.length = w;
    }
    if (this.customers.length > 8) {
      let w = 0;
      for (let i = 0; i < this.customers.length; i++) {
        const c = this.customers[i]!;
        if (c.state === 'waiting') this.customers[w++] = c;
      }
      this.customers.length = w;
    }
  }

  get timeLeft(): number {
    return Math.max(0, this.timeLimit - this.time);
  }

  get finished(): boolean {
    return this.time >= this.timeLimit;
  }

  result(): TurnResult {
    const served = this.counters.customersServed;
    const total = Math.max(1, this.counters.customersSpawned);
    const ratio = served / total;
    const stars = ratio >= 0.9 ? 3 : ratio >= 0.65 ? 2 : ratio >= 0.35 ? 1 : 0;
    const bonus = this.db.economy.reward.turnEndBonus;
    const endBonus = Math.max(0, bonus.base + bonus.perPerfect * this.counters.perfectCooks + bonus.perLostCustomer * this.counters.customersLost);
    this.coins += endBonus;
    this.xp = Math.round(this.xp);

    return {
      levelId: this.config.levelId,
      coins: Math.round(this.coins),
      xp: this.xp,
      stars,
      combo: this.counters.bestCombo,
      counters: { ...this.counters },
      durationSec: this.time,
      failed: stars === 0 && this.counters.customersLost > served,
      events: this.events
    };
  }

  // ── internals ──────────────────────────────────────────────────────────────

  private breakCombo(_reason: string): void {
    if (this.combo > 0) this.events.push({ type: 'combo', combo: this.combo, milestone: false });
    this.combo = 0;
  }

  private checkComboMilestone(): void {
    const m = this.db.grill.scoring.comboMilestones;
    if (m.includes(this.combo)) this.events.push({ type: 'combo', combo: this.combo, milestone: true });
  }

  /** Deterministic customer + order generation. Mirrors `OrderGenerator.cs`. */
  spawnCustomer(forcedId?: string): CustomerRuntime {
    const rngPick = this.rng;
    const pool = this.restaurant.customerPool
      .map((id) => this.db.customerById.get(id))
      .filter((c): c is CustomerDef => !!c && c.weight > 0 && c.minRestaurant <= this.restaurant.index);

    const weights = pool.map((c) => c.weight);
    let def: CustomerDef;
    if (forcedId) {
      def = this.db.customerById.get(forcedId) ?? pool[0]!;
    } else {
      let total = 0;
      for (const w of weights) total += w;
      let roll = rngPick.next() * total;
      let idx = 0;
      for (let i = 0; i < weights.length; i++) {
        roll -= weights[i]!;
        if (roll <= 0) {
          idx = i;
          break;
        }
      }
      def = pool[idx] ?? pool[0]!;
    }

    const itemCount = Math.max(def.itemsMin, Math.min(def.itemsMax, 1 + Math.floor(rngPick.next() * def.itemsMax)));
    const available = this.db.ingredients.items.filter(
      (i) => i.unlock.restaurantIndex <= this.restaurant.index && (!def.unusualOnly || i.rarity !== 'common')
    );
    const lines: OrderLine[] = [];
    for (let i = 0; i < itemCount && available.length > 0; i++) {
      const ing = available[Math.floor(rngPick.next() * available.length)]!;
      if (lines.some((l) => l.ingredientId === ing.id)) continue;
      const [lo, hi] = ing.perfectWindow;
      const centre = (lo + hi) / 2;
      const specific = def.allowsSpecificDoneness && rngPick.next() < 0.7;
      lines.push({ ingredientId: ing.id, target: specific ? centre : 0, fulfilledBy: [] });
    }
    if (lines.length === 0 && available.length > 0) {
      const ing = available[0]!;
      lines.push({ ingredientId: ing.id, target: 0, fulfilledBy: [] });
    }

    const p = this.db.customers.patience;
    const patienceScale = (this.config.overrides?.patienceScalar ?? 1) / (this.config.overrides?.difficultyScalar ?? 1);
    const patience = Math.max(
      p.minSeconds,
      (p.baseSeconds + p.perItemSeconds * lines.length) * def.patienceMultiplier * this.stats.patienceMult * patienceScale
    );

    const c: CustomerRuntime = {
      uid: this.uid++,
      def,
      lines,
      patienceTotal: patience,
      patienceLeft: patience,
      state: 'waiting',
      slotIndex: this.nextSpawnCount++,
      totalValue: lines.reduce((s, l) => s + (this.db.ingredientById.get(l.ingredientId)?.value ?? 0), 0)
    };
    this.customers.push(c);
    this.counters.customersSpawned++;
    this.events.push({ type: 'spawn', customer: c });
    return c;
  }
}


// Re-exports used by the prototype renderer.
export { overallDoneness, stageOf, effectiveHeat, grillSlotsFree, zoneIsFull, deriveStats };
export type { FoodRuntime, GrillRuntime, DerivedStats, ServeQuality, ScoredItem };
