import { StaffRuntime, staffAbility, type ActiveRole } from './staff.ts';
import { admitVip, newVipState, vipChance, type VipState } from './vip.ts';
import type { AnalyticsSink } from './analytics.ts';
import { clamp } from './data.ts';
import { Rng } from './rng.ts';
import {
  applyChurrasqueiraToStats,
  createFood,
  createGrill,
  deriveStats,
  effectiveHeat,
  flipFood,
  grillSlotsFree,
  overallDoneness,
  patchGrillForChurrasqueira,
  placeOnGrill,
  removeFromGrill,
  rewardTuning,
  scoreItem,
  stageOf,
  tickGrill,
  startCharcoalRefill,
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
  arrivedAt: number;
  state: CustomerState;
  slotIndex: number;
  totalValue: number;
  vipSource?: 'natural' | 'called';
}

export interface TurnConfig {
  /** Scripted FTUE teaches manual gestures; never delegate its curriculum. */
  staffEnabled?: boolean;
  /** Player progression at turn start, NOT the authored level index. Required, integer >= 1. */
  playerLevel: number;
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
    /**
     * `false` = no customer ever arrives on the spawn cadence; the caller admits
     * them with `spawnScriptedCustomer`. The FTUE's scripted turn uses this
     * (docs/05-UX_FLOW.md §4) so the first order is always the one being taught.
     */
    autoSpawn: boolean;
  }>;
  /** Production callers share the persisted ledger across turns. Isolated fixtures default to epoch day zero. */
  vip?: { state: VipState; startUnixSec: number; clock?: ()=>number; onChange?: ()=>void; analytics?: AnalyticsSink };
  /** Churrasqueira progression — overrides restaurant grill when present. */
  churrasqueiraId?: string;
  churrasqueiraLevel?: number;
}

export interface TurnCounters {
  customersSpawned: number;
  vipSpawned: number;
  vipServed: number;
  customersServed: number;
  customersLost: number;
  ordersCompleted: number;
  perfectCooks: number;
  goodCooks: number;
  /** Unique grill burn transitions, whether the plate is later served or discarded. */
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
  | { type: 'charcoal_auto_attempt'; success: boolean }
  | { type: 'stock_refilled' }
  | { type: 'staff_action'; role: ActiveRole; foodUid: number; customerUid?: number }
  | { type: 'staff_burn_risk'; foodUid: number }
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
  /** Free prep capacity; ready portions keep their slot until served/discarded. */
  prepSlotsFree: number;
  startPrep(food: FoodRuntime, slotIndex?: number): boolean;
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
  stockRemaining(id: string): number;
  refillStock(): boolean;
  db: GameDatabase;
}

export type TurnPolicy = (a: TurnActions) => void;

export class TurnSimulation {
  readonly db: GameDatabase;
  readonly stats: DerivedStats;
  readonly staff: StaffRuntime;
  readonly grill: GrillRuntime;
  readonly restaurant: RestaurantDef;
  readonly config: TurnConfig;

  /** Fixed station slots. Stock is inert until explicitly admitted; no hidden queue. */
  readonly prepSlots: (FoodRuntime | null)[];
  foods: FoodRuntime[] = [];
  bench: Ingredient[] = [];
  /** Shared eligible catalog for orders, bot stock and UI; frozen at turn start. */
  readonly availableIngredients: readonly Ingredient[];
  private readonly availableById: ReadonlyMap<string, Ingredient>;
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
  private readonly stock = new Map<string, number>();
  private readonly stockDebited = new WeakSet<FoodRuntime>();
  stockRefillRemaining = 0;
  autoRefillAttempts = 0;
  autoRefillSuccesses = 0;
  private tickCount = 0;
  private pendingServes: { customer: CustomerRuntime; food: FoodRuntime; at: number }[] = [];
  /** Owns the turn's randomness so two runs with the same seed are identical. */
  private readonly rng: Rng;
  private readonly vipRng: Rng;
  private readonly charcoalRng: Rng;
  readonly vipState: VipState;
  private readonly tuning: ReturnType<typeof rewardTuning>;

  counters: TurnCounters = {
    customersSpawned: 0,
    vipSpawned: 0,
    vipServed: 0,
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
    if (!Number.isInteger(config.playerLevel) || config.playerLevel < 1) {
      throw new Error('TurnSimulation: playerLevel must be a positive integer');
    }
    this.config = { ...config };
    this.rng = new Rng(seed ^ 0x5eed);
    this.vipRng = new Rng(seed ^ 0x71f5);
    this.charcoalRng = new Rng(seed ^ 0xc0a1);
    this.vipState = config.vip?.state ?? newVipState();
    vipChance(db, config.overrides?.vipChance, config.vip?.startUnixSec ?? 0);
    this.tuning = rewardTuning(db.economy);
    this.restaurant = db.restaurantByIndex.get(config.restaurantIndex) ?? db.restaurantByIndex.get(0)!;
    this.availableIngredients = Object.freeze(db.ingredients.items.filter(i =>
      i.unlock.restaurantIndex <= this.restaurant.index && i.unlock.level <= config.playerLevel
    ));
    if (!this.availableIngredients.length) throw new Error('TurnSimulation: no unlocked ingredients');
    this.availableById = new Map(this.availableIngredients.map(i => [i.id, i]));
    this.bench = [...this.availableIngredients];
    // base stats from restaurant + upgrades
    let stats = deriveStats(db, this.restaurant, config.upgradeLevels);
    // churrasqueira overrides (1F → 2F → 3F progression, data-driven)
    if (config.churrasqueiraId) {
      stats = applyChurrasqueiraToStats(
        stats, db, config.churrasqueiraId, config.churrasqueiraLevel ?? 1, this.restaurant
      );
    }
    // An authored limit is the BASE, never a replacement for purchased extra places.
    if (config.overrides?.maxOrdersOnScreen !== undefined) {
      const base = config.overrides.maxOrdersOnScreen;
      if (!Number.isSafeInteger(base) || base < 1) throw new Error('invalid order capacity');
      stats.maxOrdersOnScreen += base - this.restaurant.service.maxOrdersOnScreen;
    }
    if(config.staffEnabled!==false && this.availableIngredients.some(i=>i.cookMethod==='prep'))
      stats.prepSlots+=staffAbility(db,config.upgradeLevels,this.restaurant.index,'auxiliar')?.extraPrepSlots??0;
    this.stats = stats;
    for (const ing of this.availableIngredients) this.stock.set(ing.id, stats.rawStockCapacityPerIngredient);
    this.prepSlots = new Array(stats.prepSlots).fill(null);
    this.grill = createGrill(this.stats, db);
    this.staff = new StaffRuntime(this,seed,(c,f,tip)=>this.completeServe(c,f,tip));
    if (config.churrasqueiraId) {
      patchGrillForChurrasqueira(this.grill, db, config.churrasqueiraId, config.churrasqueiraLevel ?? 1);
    }
    this.timeLimit = config.overrides?.turnLengthSec ?? this.restaurant.turnLengthSec;
    this.spawnInterval = config.overrides?.spawnIntervalSec ?? 7.5;
    // An infinite timer never reaches zero, so tick() stays byte-identical for
    // every normal turn and the golden vectors cannot move.
    this.spawnTimer = config.overrides?.autoSpawn === false ? Number.POSITIVE_INFINITY : 1.2;
  }

  /**
   * Admit a customer with a fixed order. No dice are rolled, so the turn's RNG
   * stream is untouched. Lines are "any doneness" (`target` 0) and duplicate
   * ingredients collapse, exactly as the random spawner does.
   */
  spawnScriptedCustomer(customerId: string, ingredientIds: readonly string[], patienceSec: number): CustomerRuntime {
    const def = this.db.customerById.get(customerId);
    if (!def) throw new Error(`spawnScriptedCustomer: unknown customer "${customerId}"`);
    if (def.isVip) throw new Error('VIP: scripted admission bypasses quota; use the arrival service');
    const lines: OrderLine[] = [];
    for (const id of ingredientIds) {
      if (!this.db.ingredientById.has(id)) throw new Error(`spawnScriptedCustomer: unknown ingredient "${id}"`);
      if (!this.availableById.has(id)) throw new Error(`spawnScriptedCustomer: locked ingredient "${id}"`);
      if (lines.some((l) => l.ingredientId === id)) continue;
      lines.push({ ingredientId: id, target: 0, fulfilledBy: [] });
    }
    if (lines.length === 0) throw new Error('spawnScriptedCustomer: empty order');
    return this.admit(def, lines, Math.max(1, patienceSec));
  }

  /**
   * Bring the end of the turn forward to `sec` from now — never later than it
   * already is. The FTUE closes its scripted turn this way once the last order
   * lands (the 1.2 s wind-down of docs/05-UX_FLOW.md §3).
   */
  endAfter(sec: number): void {
    this.timeLimit = Math.min(this.timeLimit, this.time + Math.max(0, sec));
  }

  // ── Player / policy actions ────────────────────────────────────────────────

  /** Create a raw item on the bench and return it (models taking food from the cooler). */
  takeFromStock(ingredient: Ingredient): FoodRuntime {
    const unlocked = this.availableById.get(ingredient.id);
    if (!unlocked) throw new Error(`takeFromStock: locked or unknown ingredient "${ingredient.id}"`);
    const f = createFood(this.uidCounter++, unlocked);
    this.foods.push(f);
    return f;
  }

  stockRemaining(id: string): number { return this.stock.get(id) ?? 0; }

  refillStock(): boolean {
    if (this.finished || this.stockRefillRemaining > 0) return false;
    this.stockRefillRemaining = this.db.grill.stock.refillTimeSec;
    return true;
  }

  private commitStock(food: FoodRuntime): void {
    if (this.stockDebited.has(food)) return;
    this.stock.set(food.ingredient.id, this.stockRemaining(food.ingredient.id) - 1);
    this.stockDebited.add(food);
  }

  get prepSlotsFree(): number { return this.prepSlots.filter(f => f === null).length; }

  /** Start exactly once in a free station slot, retaining it even when ready. */
  startPrep(food: FoodRuntime, slotIndex = this.prepSlots.indexOf(null)): boolean {
    if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= this.prepSlots.length) return false;
    if (this.prepSlots[slotIndex] !== null || this.prepSlots.includes(food)) return false;
    if (!this.foods.includes(food) || food.served || food.burned || food.onGrill) return false;
    if (food.ingredient.cookMethod !== 'prep' || !(food.ingredient.prepSec! > 0)) return false;
    if (!this.stockDebited.has(food) && this.stockRemaining(food.ingredient.id) <= 0) return false;
    this.commitStock(food);
    this.prepSlots[slotIndex] = food;
    return true;
  }

  private releasePrep(food: FoodRuntime): void {
    const slot = this.prepSlots.indexOf(food);
    if (slot >= 0) this.prepSlots[slot] = null;
  }

  place(food: FoodRuntime, zoneIndex: number): boolean {
    if (!this.foods.includes(food) || food.ingredient.cookMethod !== 'grill' || food.burned || food.served) return false;
    if (!this.stockDebited.has(food) && this.stockRemaining(food.ingredient.id) <= 0) return false;
    if (!placeOnGrill(this.grill, this.db, food, zoneIndex)) return false;
    this.commitStock(food);
    return true;
  }

  move(food: FoodRuntime, zoneIndex: number): boolean {
    this.staff.observe();
    if (!this.foods.includes(food) || !food.onGrill || food.served) return false;
    // Moving an already admitted (even burned) plate is not a second stock admission.
    return placeOnGrill(this.grill, this.db, food, zoneIndex);
  }

  flip(food: FoodRuntime): boolean {
    this.staff.observe();
    const ok = flipFood(this.grill, food, this.time, this.db);
    if (ok) this.counters.flips++;
    return ok;
  }

  refillCharcoal(): boolean {
    if (this.finished) return false;
    const cost = this.db.grill.charcoal.refillCostCoins ?? 0;
    if (cost > 0) {
      if (this.coins < cost) return false;
      this.coins -= cost;
    }
    const started = startCharcoalRefill(this.grill, this.db);
    if (!started && cost > 0) {
      this.coins += cost;
      return false;
    }
    return started;
  }

  private tryAutoCharcoal(): void {
    const g = this.grill;
    if (this.finished || g.refilling > 0 || g.charcoalAutoAttempted || this.stats.autoRefillChance <= 0) return;
    if (g.charcoalT < 1 - this.db.grill.charcoal.lowWarningThreshold) return;
    g.charcoalAutoAttempted = true;
    this.autoRefillAttempts++;
    const success = this.charcoalRng.next() < this.stats.autoRefillChance && this.refillCharcoal();
    if (success) this.autoRefillSuccesses++;
    this.events.push({ type: 'charcoal_auto_attempt', success });
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
    this.staff.observe();
    this.releasePrep(food);
    removeFromGrill(this.grill, food);
    food.served = true;
    const i = this.foods.indexOf(food);
    if (i >= 0) this.foods.splice(i, 1);
  }

  serve(customer: CustomerRuntime, food: FoodRuntime): ScoredItem | null {
    this.staff.observe();
    return this.completeServe(customer,food,0);
  }

  private completeServe(customer: CustomerRuntime, food: FoodRuntime, autoServiceTipBonus: number): ScoredItem | null {
    if (customer.state !== 'waiting') return null;
    if (food.served) return null;
    // Prep items (vinagrete) never touch the grill; they are ready when prepped.
    const isPrep = food.ingredient.cookMethod === 'prep';
    if (isPrep) {
      if (!this.prepSlots.includes(food) || food.prepProgress < 1) return null;
    } else if (!food.onGrill) {
      return null;
    }

    const line = customer.lines.find((l) => l.ingredientId === food.ingredient.id && l.fulfilledBy.length < 1);
    if (!line) return null;

    const patienceRemaining = clamp(customer.patienceLeft / customer.patienceTotal, 0, 1);
    const scored = scoreItem(this.db, food, {
      restaurantIndex:this.restaurant.index,
      target: line.target,
      toleranceScale: customer.def.toleranceScale,
      patienceRemaining,
      combo: this.combo,
      tipMult: this.stats.tipMult,
      prestigeTipBonus: this.stats.prestigeTipBonus,
      autoServiceTipBonus,
      xpMult: this.stats.xpMult,
      customerTipMult: customer.def.tipMultiplier,
      tuning: this.tuning
    });

    line.fulfilledBy.push(food.uid);
    this.releasePrep(food);
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

    // Burned plates were already counted by tickGrill's one-shot onBurn transition.
    // Serving/discarding that plate must not turn one burned item into two.
    if (this.combo > this.counters.bestCombo) this.counters.bestCombo = this.combo;
    this.checkComboMilestone();
    this.events.push({ type: 'serve', customer, quality: scored.quality, coins: scored.coins, combo: this.combo });

    const complete = customer.lines.every((l) => l.fulfilledBy.length >= 1);
    if (complete) {
      customer.state = 'served';
      this.counters.customersServed++;
      this.counters.ordersCompleted++;
      if (customer.def.isVip) {
        this.counters.vipServed++;
        this.config.vip?.analytics?.({ name:'vip_served', params:{ source:customer.vipSource!, restaurant_index:this.restaurant.index, customer_id:customer.uid } });
      }
    }
    return scored;
  }

  // ── Simulation step ────────────────────────────────────────────────────────

  tick(dt: number, policy?: TurnPolicy): void {
    if (!Number.isFinite(dt) || dt < 0) throw new Error('TurnSimulation: invalid dt');
    this.tryAutoCharcoal(); // also handles a restored/runtime-loaded low sack
    this.time += dt;
    this.tickCount++;
    // Periodic compaction: finished food and departed customers are dropped from
    // the hot arrays so per-frame scans stay O(active) instead of O(ever).
    if ((this.tickCount & 31) === 0) this.compact();

    if (this.stockRefillRemaining > 0) {
      this.stockRefillRemaining = Math.max(0, this.stockRefillRemaining - dt);
      if (this.stockRefillRemaining < 1e-9) {
        this.stockRefillRemaining = 0;
        for (const id of this.stock.keys()) this.stock.set(id, this.stats.rawStockCapacityPerIngredient);
        this.events.push({ type: 'stock_refilled' });
      }
    }

    const refilled = tickGrill(this.grill, this.db, dt, (f) => {
      this.counters.burnedFood++;
      this.counters.flawless = false;
      this.breakCombo('burned');
      this.events.push({ type: 'burned', food: f });
    });
    if (refilled) { this.counters.charcoalRefills++; this.events.push({ type: 'charcoal_refilled' }); }
    this.tryAutoCharcoal();

    // Charcoal warning (one shot per load).
    const fuelLeft = 1 - this.grill.charcoalT;
    if (!this.lowWarned && fuelLeft < this.db.grill.charcoal.lowWarningThreshold) {
      this.lowWarned = true;
      this.events.push({ type: 'charcoal_low' });
    }
    if (fuelLeft > this.db.grill.charcoal.lowWarningThreshold) this.lowWarned = false;

    // Prep items (vinagrete etc.) finish off the grill. Their doneness is driven
    // to the window centre so the shared scoring path still applies.
    for (const f of this.prepSlots) {
      if (!f || f.served || f.burned || f.onGrill) continue;
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
      const cap = this.stats.maxOrdersOnScreen;
      if (active < cap) this.spawnCustomer();
    }

    this.staff.observe();

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

    this.staff.tick();

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
        prepSlotsFree: this.prepSlotsFree,
        startPrep: (f, slot) => this.startPrep(f, slot),
        place: (f, z) => this.place(f, z),
        move: (f, z) => this.move(f, z),
        flip: (f) => this.flip(f),
        serve: (c, f) => this.serve(c, f),
        serveDelayed: (c, f, d) => this.serveDelayed(c, f, d),
        discard: (f) => this.discard(f),
        stockRemaining: id => this.stockRemaining(id),
        refillStock: () => this.refillStock(),
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

  /**
   * Pure snapshot: includes the end bonus once in the returned payout, never in
   * the live accumulators. Repeated reads (including mid-turn inspection) cannot
   * award currency or freeze a premature result. Credit the finished result once
   * via the caller's wallet flow; applyTurnResult itself is not a claim ledger.
   */
  result(): TurnResult {
    const served = this.counters.customersServed;
    const total = Math.max(1, this.counters.customersSpawned);
    const ratio = served / total;
    const stars = ratio >= 0.9 ? 3 : ratio >= 0.65 ? 2 : ratio >= 0.35 ? 1 : 0;
    const bonus = this.db.economy.reward.turnEndBonus;
    const endBonus = Math.max(0, bonus.base + bonus.perPerfect * this.counters.perfectCooks + bonus.perLostCustomer * this.counters.customersLost);

    return {
      levelId: this.config.levelId,
      coins: Math.round(this.coins + endBonus),
      xp: Math.round(this.xp),
      stars,
      combo: this.counters.bestCombo,
      counters: { ...this.counters },
      durationSec: this.time,
      failed: stars === 0 && this.counters.customersLost > served,
      events: structuredClone(this.events)
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
    const menuFor = (c: CustomerDef): readonly Ingredient[] => c.unusualOnly
      ? this.availableIngredients.filter(i => i.rarity !== 'common') : this.availableIngredients;
    const pool = this.restaurant.customerPool
      .map((id) => this.db.customerById.get(id))
      .filter((c): c is CustomerDef => !!c && !c.isVip && c.weight > 0 && c.minRestaurant <= this.restaurant.index && menuFor(c).length > 0);

    const weights = pool.map((c) => c.weight);
    let def: CustomerDef;
    let source: 'natural' | 'called' | null = null;
    const vipDef = this.db.customerById.get('vip');
    if (!forcedId && vipDef && menuFor(vipDef).length > 0 && !this.finished && this.customers.filter(c=>c.state==='waiting').length < (this.stats.maxOrdersOnScreen)) {
      const now = this.config.vip?.clock?.() ?? (this.config.vip?.startUnixSec ?? 0) + this.time;
      source = admitVip(this.db,this.vipState,this.restaurant.index,now,
        vipChance(this.db,this.config.overrides?.vipChance,Math.max(now,this.vipState.lastClockUnixSec)),()=>this.vipRng.next());
    }
    if (source) def = this.db.customerById.get('vip')!;
    else if (forcedId) {
      const forced = this.db.customerById.get(forcedId);
      if (!forced) throw new Error(`spawnCustomer: unknown customer "${forcedId}"`);
      if (forced.isVip) throw new Error('VIP: use a reserved call, not forced admission');
      def = forced;
    } else {
      if (!pool.length) throw new Error('spawnCustomer: no eligible customers with unlocked ingredients');
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

    const available = menuFor(def);
    if (!available.length) throw new Error(`spawnCustomer: no unlocked ingredients for "${def.id}"`);
    const itemCount = Math.max(def.itemsMin, Math.min(def.itemsMax, 1 + Math.floor(rngPick.next() * def.itemsMax)));
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

    const customer = this.admit(def, lines, patience);
    if (source) {
      customer.vipSource = source;
      this.counters.vipSpawned++;
      this.config.vip?.onChange?.();
      this.config.vip?.analytics?.({ name:'vip_arrival', params:{ source, restaurant_index:this.restaurant.index, customer_id:customer.uid } });
    }
    return customer;
  }

  /** Shared bookkeeping for every arrival, random or scripted. */
  private admit(def: CustomerDef, lines: OrderLine[], patience: number): CustomerRuntime {
    const c: CustomerRuntime = {
      uid: this.uid++,
      def,
      lines,
      patienceTotal: patience,
      patienceLeft: patience,
      arrivedAt: this.time,
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
