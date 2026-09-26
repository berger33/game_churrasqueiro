/**
 * FTUE — the six-step first run of docs/05-UX_FLOW.md §4, engine-free.
 *
 *   TutorialDirector  step machine + analytics (tutorial_start / _step /
 *                     _complete / _abandon / _skip), persisted between launches
 *   coach rules       when the plate is ready to flip / to serve, and what the
 *                     hand points at next (`coachAction`)
 *   holdPlate         docs/19 §6 "impossível falhar": no plate in the scripted
 *                     turn can overcook or burn — burning is session 2's lesson
 *   TutorialTurn      the scripted turn: no random customers, input masking,
 *                     triggers wired to the director
 *
 * The prototype (`prototype/src/main.ts`) feeds it canvas input; the Unity
 * `TutorialDirector` (docs/01-ARCHITECTURE.md) ports it 1:1. Every number lives
 * in `shared/data/tutorial.json`; every event it sends is declared in
 * `shared/data/analytics.json` — both asserted by `npm run validate` and
 * `tools/studio/test/tutorial.test.ts`.
 */
import { clamp } from './data.ts';
import { evenness, overallDoneness, type FoodRuntime, type ScoredItem } from './cooking.ts';
import { TurnSimulation, type CustomerRuntime } from './turn.ts';
import type { GameDatabase, Ingredient } from './types.ts';
import type { AnalyticsSink, AnalyticsValue } from './analytics.ts';

// ── Data contract (shared/data/tutorial.json) ────────────────────────────────

export const TUTORIAL_TRIGGERS = [
  'placed', 'flipped', 'served', 'reward_landed', 'order_completed', 'upgrade_bought'
] as const;
export type TutorialTrigger = (typeof TUTORIAL_TRIGGERS)[number];

/** Every event the director can send, with exactly the parameters it attaches. */
export const TUTORIAL_EVENT_PARAMS: Readonly<Record<string, readonly string[]>> = {
  tutorial_start: ['variant'],
  tutorial_step: ['step', 'step_index', 'elapsed_ms'],
  tutorial_complete: ['duration_ms', 'misses'],
  tutorial_abandon: ['step', 'step_index'],
  tutorial_skip: ['step', 'step_index', 'elapsed_ms']
};

export interface TutorialStepDef {
  id: string;
  /** 1-based; the value `step_index` reports. */
  index: number;
  screen: 'play' | 'home';
  gesture: 'drag' | 'tap' | 'none';
  completesOn: TutorialTrigger;
  /** Event sent when the step completes. Exactly one step sends `tutorial_complete`. */
  event: 'tutorial_step' | 'tutorial_complete';
  /** Short imperative prompt (l10n key). Absent = the hand alone teaches it. */
  hintKey?: string;
}

export interface TutorialTable {
  version: number;
  variant: string;
  targetDurationSec: number;
  turn: {
    /** The scripted turn *is* this level's first clear (its rewards pay for step 6). */
    levelId: string;
    churrasqueiraId: string;
    ingredientId: string;
    /** Arrive in order: the first at turn start, the rest when the guided serve's reward lands. */
    customers: { customerId: string; order: string[] }[];
    customerPatienceSec: number;
    safetyLimitSec: number;
    windDownSec: number;
  };
  coach: {
    /** The flip prompt waits until the face-down side has browned this far (docs/20 "espere dourar"). */
    flipPromptAtSideDoneness: number;
    /** The serve prompt waits until overall doneness reaches this (inside the perfect window). */
    serveReadyMinDoneness: number;
    /** The guided plate is held this far under the perfect window's top edge. */
    holdBelowWindowHi: number;
    /** Step 5 has no prompt; the hand comes back only after this much idle time. */
    idleHintSec: number;
    /** One bench → grill arc of the hand (docs/20: ~900 ms loop, not a wobble). */
    handLoopSec: number;
  };
  skip: { showAfterSec: number; hitSizePx: number; labelKey: string };
  upgradeTrackId: string;
  steps: TutorialStepDef[];
}

// ── Persisted state ──────────────────────────────────────────────────────────

export interface TutorialState {
  variant: string;
  /** 1-based index of the step in progress; `steps.length + 1` once finished. */
  step: number;
  /** Highest step index already reported — a resumed run never re-sends it. */
  reported: number;
  /** Active FTUE time: only accrues while the director is ticked. */
  elapsedMs: number;
  misses: number;
  started: boolean;
  skipped: boolean;
  /** Step index the last `tutorial_abandon` went out for (one per step). */
  abandonedStep: number;
}

export function newTutorialState(table: TutorialTable): TutorialState {
  return { variant: table.variant, step: 1, reported: 0, elapsedMs: 0, misses: 0, started: false, skipped: false, abandonedStep: 0 };
}

/** State for a player who finished an earlier FTUE (old saves only stored `ftueDone`). */
export function finishedTutorialState(table: TutorialTable): TutorialState {
  const n = table.steps.length;
  return { ...newTutorialState(table), step: n + 1, reported: n, started: true };
}

/**
 * Rebuild the state from whatever a save holds. A missing, malformed or
 * other-variant state starts a fresh run — unless the save says the FTUE was
 * already done, which always wins (never make a returning player redo it).
 */
export function restoreTutorialState(table: TutorialTable, raw: unknown, legacyDone = false): TutorialState {
  if (legacyDone) return finishedTutorialState(table);
  const r = raw as Partial<TutorialState> | null | undefined;
  const n = table.steps.length;
  const int = (v: unknown, lo: number, hi: number): number | null =>
    typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi ? v : null;
  if (!r || typeof r !== 'object' || r.variant !== table.variant) return newTutorialState(table);
  const step = int(r.step, 1, n + 1);
  const reported = int(r.reported, 0, n);
  if (step === null || reported === null) return newTutorialState(table);
  return {
    variant: table.variant,
    step,
    // `reported` may run ahead of `step`: a replayed turn re-walks reported steps.
    reported,
    elapsedMs: typeof r.elapsedMs === 'number' && r.elapsedMs >= 0 ? r.elapsedMs : 0,
    misses: int(r.misses, 0, Number.MAX_SAFE_INTEGER) ?? 0,
    started: r.started === true,
    skipped: r.skipped === true,
    abandonedStep: int(r.abandonedStep, 0, n + 1) ?? 0
  };
}

// ── Director ─────────────────────────────────────────────────────────────────

export class TutorialDirector {
  readonly table: TutorialTable;
  private readonly sink: AnalyticsSink;
  private s: TutorialState;

  constructor(table: TutorialTable, state: TutorialState | null | undefined, sink: AnalyticsSink) {
    this.table = table;
    this.sink = sink;
    this.s = state ? { ...state } : newTutorialState(table);
  }

  /** A copy — safe to persist. */
  get state(): TutorialState {
    return { ...this.s };
  }

  get done(): boolean {
    return this.s.skipped || this.s.step > this.table.steps.length;
  }

  get current(): TutorialStepDef | null {
    return this.done ? null : this.table.steps[this.s.step - 1] ?? null;
  }

  get elapsedMs(): number {
    return this.s.elapsedMs;
  }

  /** The skip button shows after `skip.showAfterSec` of FTUE time (docs/21: 2 s). */
  get canSkip(): boolean {
    return !this.done && this.s.started && this.s.elapsedMs >= this.table.skip.showAfterSec * 1000;
  }

  /** Idempotent: `tutorial_start` goes out once per install, not once per attempt. */
  start(): void {
    if (this.s.started || this.done) return;
    this.s.started = true;
    this.emit('tutorial_start', { variant: this.table.variant });
  }

  tick(dtSec: number): void {
    if (!this.s.started || this.done) return;
    this.s.elapsedMs += Math.max(0, dtSec) * 1000;
  }

  /**
   * The player did something. Completes the current step when it is what the
   * step waits for; anything else is ignored. Returns true if a step completed.
   */
  report(trigger: TutorialTrigger): boolean {
    const step = this.current;
    if (!step || !this.s.started || step.completesOn !== trigger) return false;
    if (step.index > this.s.reported) {
      if (step.event === 'tutorial_complete') {
        this.emit('tutorial_complete', { duration_ms: this.ms(), misses: this.s.misses });
      } else {
        this.emit('tutorial_step', { step: step.id, step_index: step.index, elapsed_ms: this.ms() });
      }
      this.s.reported = step.index;
    }
    this.s.step++;
    return true;
  }

  /** An attempted action that did not do what the step teaches (see docs/05 §4 "misses"). */
  miss(): void {
    if (this.s.started && !this.done) this.s.misses++;
  }

  skip(): boolean {
    const step = this.current;
    if (!step) return false;
    this.emit('tutorial_skip', { step: step.id, step_index: step.index, elapsed_ms: this.ms() });
    this.s.skipped = true;
    return true;
  }

  /** The app went to the background mid-FTUE. One event per step, however often it happens. */
  abandon(): boolean {
    const step = this.current;
    if (!step || !this.s.started || this.s.abandonedStep === step.index) return false;
    this.s.abandonedStep = step.index;
    this.emit('tutorial_abandon', { step: step.id, step_index: step.index });
    return true;
  }

  /**
   * A scripted turn cannot survive the app dying, so a resumed FTUE replays it
   * from its first step. Reported steps are not re-sent.
   */
  restartTurn(): void {
    if (this.done) return;
    const first = this.table.steps.find((st) => st.screen === 'play');
    if (first) this.s.step = first.index;
  }

  private ms(): number {
    return Math.round(this.s.elapsedMs);
  }

  private emit(name: string, params: Record<string, AnalyticsValue>): void {
    this.sink({ name, params });
  }
}

// ── Coach rules ──────────────────────────────────────────────────────────────

function downSide(f: FoodRuntime): number {
  return f.sides[f.downSide] ?? 0;
}

/**
 * The face-down side has browned past the prompt threshold. Step 2's readiness:
 * before this the prompt stays hidden — showing "TOQUE PARA VIRAR" the moment
 * the plate lands is what made testers flip early and score BOM (docs/20, step 2).
 */
export function sideBrowned(table: TutorialTable, f: FoodRuntime): boolean {
  if (!f.onGrill || f.burned || f.served || f.sides.length < 2) return false;
  return downSide(f) >= table.coach.flipPromptAtSideDoneness;
}

/**
 * A flip helps right now: the browned side is the most-done one and the rest
 * lags behind. The free-play coach (step 5) uses this, so it never suggests a
 * flip that would not change the outcome.
 */
export function flipReady(db: GameDatabase, table: TutorialTable, f: FoodRuntime): boolean {
  if (!sideBrowned(table, f)) return false;
  const down = downSide(f);
  for (const s of f.sides) if (s > down + 1e-9) return false;
  return evenness(f) < db.ingredients.shared.minEvennessForPerfect;
}

/** In the perfect window and even enough: a serve now scores PERFEITO. */
export function serveReady(db: GameDatabase, table: TutorialTable, f: FoodRuntime): boolean {
  if (!f.onGrill || f.burned || f.served) return false;
  const d = overallDoneness(f);
  return d >= table.coach.serveReadyMinDoneness
    && d <= f.ingredient.perfectWindow[1]
    && evenness(f) >= db.ingredients.shared.minEvennessForPerfect;
}

/**
 * 0..1 progress toward the plate's next prompt: the flip while the face-down
 * side is the one lagging nothing, the serve afterwards. Drives the ring the
 * overlay draws around a plate that is not ready yet.
 */
export function plateProgress(db: GameDatabase, table: TutorialTable, f: FoodRuntime): number {
  const down = downSide(f);
  const needsFlip = f.sides.length >= 2
    && f.sides.every((s) => s <= down + 1e-9)
    && evenness(f) < db.ingredients.shared.minEvennessForPerfect;
  if (needsFlip) return clamp(down / table.coach.flipPromptAtSideDoneness, 0, 1);
  return clamp(overallDoneness(f) / table.coach.serveReadyMinDoneness, 0, 1);
}

/** Per-side ceiling for the guided plate: just under the perfect window's top edge. */
export function holdCeiling(table: TutorialTable, f: FoodRuntime): number {
  return f.ingredient.perfectWindow[1] - table.coach.holdBelowWindowHi;
}

/**
 * docs/19 §6 "impossível falhar": no side of a plate in the scripted turn may
 * pass the ceiling. It can then neither overcook nor burn — "things burn" is
 * session 2's lesson (docs/02 §11, docs/05 §5) — and it converges on PERFEITO
 * however long the player hesitates. Returns true if anything was clamped.
 */
export function holdPlate(table: TutorialTable, f: FoodRuntime): boolean {
  if (!f.onGrill || f.burned || f.served) return false;
  const cap = holdCeiling(table, f);
  let clamped = false;
  for (let s = 0; s < f.sides.length; s++) {
    if (f.sides[s]! > cap) {
      f.sides[s] = cap;
      clamped = true;
    }
  }
  return clamped;
}

export type CoachAction =
  | { kind: 'place'; zoneIndex: number }
  | { kind: 'flip'; food: FoodRuntime }
  | { kind: 'serve'; food: FoodRuntime; customer: CustomerRuntime }
  | { kind: 'discard'; food: FoodRuntime }
  | { kind: 'wait'; food: FoodRuntime | null; progress: number };

/**
 * What a player following the hand should do next in the scripted turn. The
 * overlay points at it; the tests drive a bot with nothing else. If that bot
 * cannot finish the FTUE, the hand is lying.
 */
export function coachAction(sim: TurnSimulation, table: TutorialTable): CoachAction {
  const ingId = table.turn.ingredientId;
  const openLines = (c: CustomerRuntime): number =>
    c.state === 'waiting' ? c.lines.filter((l) => l.ingredientId === ingId && l.fulfilledBy.length === 0).length : 0;
  const customer = sim.customers.find((c) => openLines(c) > 0) ?? null;
  const plates = sim.foods.filter((f) => f.onGrill && !f.served && f.ingredient.id === ingId);

  for (const f of plates) if (f.burned) return { kind: 'discard', food: f };
  if (customer) {
    for (const f of plates) if (serveReady(sim.db, table, f)) return { kind: 'serve', food: f, customer };
    // Past the window but not burned yet: serving beats watching it char.
    for (const f of plates) if (overallDoneness(f) > f.ingredient.perfectWindow[1]) return { kind: 'serve', food: f, customer };
  }
  for (const f of plates) if (flipReady(sim.db, table, f)) return { kind: 'flip', food: f };

  let open = 0;
  for (const c of sim.customers) open += openLines(c);
  if (plates.length < open) {
    const cap = sim.grill.stats.slotsPerZone;
    const zone = sim.grill.zones.findIndex((z) => z.items.length < cap);
    if (zone >= 0) return { kind: 'place', zoneIndex: zone };
  }
  const food = plates[0] ?? null;
  return { kind: 'wait', food, progress: food ? plateProgress(sim.db, table, food) : 0 };
}

// ── The scripted turn ────────────────────────────────────────────────────────

export type TutorialAction = 'take' | 'place' | 'move' | 'flip' | 'serve' | 'discard' | 'refill';

export interface TutorialTurnOptions {
  restaurantIndex: number;
  upgradeLevels?: Record<string, number>;
  churrasqueiraLevel?: number;
  seed?: number;
}

/**
 * Steps 1–5: one linguiça on the 1-zone starter grill, customers admitted by
 * script (never by dice), input masked to the action being taught, every plate
 * held so nothing can fail, and the turn closed by the last order.
 *
 * Every action returns false / null when it was masked or failed — that counts
 * as a miss — so a caller simply routes input here instead of to the sim.
 */
export class TutorialTurn {
  readonly db: GameDatabase;
  readonly table: TutorialTable;
  readonly director: TutorialDirector;
  readonly sim: TurnSimulation;
  readonly ingredient: Ingredient;
  /** The plate the guided steps are about: the first one placed in step 1. */
  plate: FoodRuntime | null = null;
  private admitted = 0;

  constructor(db: GameDatabase, table: TutorialTable, director: TutorialDirector, opts: TutorialTurnOptions) {
    const ing = db.ingredientById.get(table.turn.ingredientId);
    if (!ing) throw new Error(`tutorial: unknown ingredient "${table.turn.ingredientId}"`);
    this.db = db;
    this.table = table;
    this.director = director;
    this.ingredient = ing;
    this.sim = new TurnSimulation(db, {
      restaurantIndex: opts.restaurantIndex,
      levelId: table.turn.levelId,
      upgradeLevels: { ...(opts.upgradeLevels ?? {}) },
      seed: opts.seed ?? 1,
      overrides: { turnLengthSec: table.turn.safetyLimitSec, autoSpawn: false },
      churrasqueiraId: table.turn.churrasqueiraId,
      churrasqueiraLevel: opts.churrasqueiraLevel ?? 1
    });
    this.sim.bench = [ing];
    director.restartTurn();
    director.start();
    this.admitNext();
  }

  get step(): TutorialStepDef | null {
    return this.director.current;
  }

  /** True while a guided (masked) step is running. Step 5 plays freely. */
  get guided(): boolean {
    const on = this.step?.completesOn;
    return on === 'placed' || on === 'flipped' || on === 'served' || on === 'reward_landed';
  }

  /** The guided plate is ready for what the current step teaches. */
  get plateReady(): boolean {
    const p = this.plate;
    if (!p) return false;
    const on = this.step?.completesOn;
    if (on === 'flipped') return sideBrowned(this.table, p);
    if (on === 'served') return serveReady(this.db, this.table, p);
    return false;
  }

  /** Input masking (docs/01-ARCHITECTURE.md, TutorialDirector: "contextual steps, masking, completion"). */
  allows(action: TutorialAction, food?: FoodRuntime): boolean {
    const step = this.step;
    if (!step || step.screen !== 'play') return true;
    switch (step.completesOn) {
      case 'placed':
        return action === 'take' || action === 'place' || action === 'discard';
      case 'flipped':
        return action === 'flip' && food === this.plate && this.plateReady;
      case 'served':
        return action === 'serve' && food === this.plate && this.plateReady;
      case 'reward_landed':
        return false;
      default:
        return true;
    }
  }

  /**
   * What the hand points at. Guided steps point at exactly the action being
   * taught (or wait, with the plate's progress for the ring); step 5 falls back
   * to the free-play coach.
   */
  coach(): CoachAction {
    const on = this.step?.completesOn;
    const p = this.plate;
    if (on === 'flipped' && p) {
      return this.plateReady
        ? { kind: 'flip', food: p }
        : { kind: 'wait', food: p, progress: clamp(downSide(p) / this.table.coach.flipPromptAtSideDoneness, 0, 1) };
    }
    if (on === 'served' && p) {
      const customer = this.sim.customers.find((c) => c.state === 'waiting'
        && c.lines.some((l) => l.ingredientId === p.ingredient.id && l.fulfilledBy.length === 0));
      if (this.plateReady && customer) return { kind: 'serve', food: p, customer };
      return { kind: 'wait', food: p, progress: clamp(overallDoneness(p) / this.table.coach.serveReadyMinDoneness, 0, 1) };
    }
    if (on === 'reward_landed') return { kind: 'wait', food: null, progress: 1 };
    return coachAction(this.sim, this.table);
  }

  tick(dt: number): void {
    const burnedBefore = this.sim.counters.burnedFood;
    this.sim.tick(dt);
    this.director.tick(dt);
    if (this.step?.screen === 'play') {
      for (const f of this.sim.grill.zones.flatMap((z) => z.items)) holdPlate(this.table, f);
    }
    // Only the grill burns food inside tick(); a burned plate served later is counted by serve().
    for (let i = burnedBefore; i < this.sim.counters.burnedFood; i++) this.director.miss();
  }

  take(): FoodRuntime | null {
    if (!this.allows('take')) return this.rejected(null);
    return this.sim.takeFromStock(this.ingredient);
  }

  place(food: FoodRuntime, zoneIndex: number): boolean {
    if (!this.allows('place')) return this.rejected(false);
    if (!this.sim.place(food, zoneIndex)) return this.rejected(false);
    if (!this.plate) this.plate = food;
    this.director.report('placed');
    return true;
  }

  move(food: FoodRuntime, zoneIndex: number): boolean {
    if (!this.allows('move', food)) return this.rejected(false);
    return this.sim.move(food, zoneIndex) || this.rejected(false);
  }

  flip(food: FoodRuntime): boolean {
    if (!this.allows('flip', food)) return this.rejected(false);
    if (!this.sim.flip(food)) return false; // cooldown: a double tap, not a mistake
    if (food === this.plate) this.director.report('flipped');
    return true;
  }

  serve(customer: CustomerRuntime, food: FoodRuntime): ScoredItem | null {
    if (!this.allows('serve', food)) return this.rejected(null);
    const scored = this.sim.serve(customer, food);
    if (!scored) return this.rejected(null);
    if (scored.quality !== 'perfect') this.director.miss();
    if (food === this.plate) this.director.report('served');
    if (customer.state === 'served' && this.director.report('order_completed')) {
      this.sim.endAfter(this.table.turn.windDownSec);
    }
    return scored;
  }

  /**
   * A plate dropped off the grill (on the bench, or nowhere). Always a miss.
   * Masked while the guided plate is being taught, so it can never vanish mid-lesson.
   */
  discard(food: FoodRuntime): boolean {
    if (!this.allows('discard', food)) return this.rejected(false);
    this.sim.discard(food);
    if (food === this.plate) this.plate = null;
    this.director.miss();
    return true;
  }

  /** The guided serve's coins reached the counter: step 4 is over, the next customer walks in. */
  rewardLanded(): boolean {
    if (!this.director.report('reward_landed')) return false;
    this.admitNext();
    return true;
  }

  private admitNext(): void {
    const spec = this.table.turn.customers[this.admitted];
    if (!spec) return;
    this.admitted++;
    this.sim.spawnScriptedCustomer(spec.customerId, spec.order, this.table.turn.customerPatienceSec);
  }

  private rejected<T>(value: T): T {
    this.director.miss();
    return value;
  }
}
