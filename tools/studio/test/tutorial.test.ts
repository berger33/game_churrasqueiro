/**
 * FTUE — docs/05-UX_FLOW.md §4, "a new player completes a perfect serve with
 * zero text explanation" (BACKLOG #5).
 *
 * The strongest check here is the hand-following bot: it plays the scripted
 * turn using nothing but `coachAction` (what the overlay's hand points at), with
 * a human reaction delay. If it cannot finish — or finishes without a PERFEITO —
 * the hand is lying.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadDatabase, readJson } from '../load-data.ts';
import { TurnSimulation } from '../../sim-core/src/turn.ts';
import { overallDoneness, evenness, type ScoredItem } from '../../sim-core/src/cooking.ts';
import { costFor } from '../../sim-core/src/economy.ts';
import { checkAnalyticsEvent, type AnalyticsEvent, type AnalyticsTaxonomy } from '../../sim-core/src/analytics.ts';
import {
  TUTORIAL_EVENT_PARAMS,
  TutorialDirector,
  TutorialTurn,
  coachAction,
  finishedTutorialState,
  flipReady,
  holdCeiling,
  newTutorialState,
  restoreTutorialState,
  serveReady,
  type CoachAction,
  type TutorialTable
} from '../../sim-core/src/tutorial.ts';

const db = loadDatabase();
const table = readJson('tutorial.json') as TutorialTable;
const tax = readJson('analytics.json') as AnalyticsTaxonomy;
const ptBR = JSON.parse(readFileSync(join(import.meta.dirname, '..', '..', '..', 'shared', 'l10n', 'pt-BR.json'), 'utf8')) as Record<string, string>;
const levels = (readJson('levels.json') as { levels: { id: string; restaurantIndex: number; rewards: { coins: number; firstClearBonus: { coins: number } } }[] }).levels;
const level = levels.find((l) => l.id === table.turn.levelId)!;
const DT = 1 / 60;

function recorder(): { events: AnalyticsEvent[]; sink: (e: AnalyticsEvent) => void } {
  const events: AnalyticsEvent[] = [];
  return { events, sink: (e) => events.push(e) };
}

function newTurn(state?: ReturnType<typeof newTutorialState>) {
  const rec = recorder();
  const director = new TutorialDirector(table, state, rec.sink);
  const turn = new TutorialTurn(db, table, director, { restaurantIndex: level.restaurantIndex, seed: 7 });
  return { ...rec, director, turn };
}

interface BotOptions {
  /** Seconds between the hand appearing and the bot acting on it. */
  reaction?: number;
  /** Extra hesitation before every action (the "careful" player). */
  hesitate?: number;
  /** Seconds the coin flight takes to reach the counter (prototype: ~0.9 s). */
  coinFlight?: number;
  maxSec?: number;
}

/**
 * Plays the scripted turn by following the hand. In guided steps the hand is
 * visible whenever `coachAction` has something to do; in step 5 only after
 * `idleHintSec` without input — exactly the prototype's overlay rules.
 */
function playByHand(turn: TutorialTurn, opts: BotOptions = {}) {
  const reaction = opts.reaction ?? 0.6;
  const hesitate = opts.hesitate ?? 0;
  const coinFlight = opts.coinFlight ?? 0.9;
  const maxSec = opts.maxSec ?? 240;
  const serves: ScoredItem[] = [];
  let seenKey = '';
  let seenAt = 0;
  let lastInput = 0;
  let rewardAt = -1;
  let completeAt = -1;

  const keyOf = (a: CoachAction): string => a.kind === 'wait' ? 'wait' : `${a.kind}:${'food' in a ? a.food.uid : a.zoneIndex}`;

  while (turn.sim.time < maxSec && !turn.sim.finished) {
    turn.tick(DT);
    turn.sim.events.length = 0;
    const t = turn.sim.time;
    const step = turn.step;
    if (!step || step.screen !== 'play') break;

    if (step.completesOn === 'reward_landed') {
      if (rewardAt < 0) rewardAt = t + coinFlight;
      if (t >= rewardAt) turn.rewardLanded();
      continue;
    }

    const hint = turn.coach();
    const handVisible = hint.kind !== 'wait' && (turn.guided || t - lastInput >= table.coach.idleHintSec);
    if (!handVisible) { seenKey = ''; continue; }
    const key = keyOf(hint);
    if (key !== seenKey) { seenKey = key; seenAt = t; }
    if (t - seenAt < reaction + hesitate) continue;

    lastInput = t;
    seenKey = '';
    if (hint.kind === 'place') {
      const f = turn.take();
      if (f && !turn.place(f, hint.zoneIndex)) turn.discard(f);
    } else if (hint.kind === 'flip') {
      turn.flip(hint.food);
    } else if (hint.kind === 'serve') {
      const s = turn.serve(hint.customer, hint.food);
      if (s) serves.push(s);
    } else if (hint.kind === 'discard') {
      turn.discard(hint.food);
    }
    if (completeAt < 0 && turn.director.state.step > 5) completeAt = t;
  }
  return { serves, completeAt };
}

describe('tutorial.json follows docs/05-UX_FLOW.md §4', () => {
  it('has the six steps in the documented order', () => {
    expect(table.steps.map((s) => s.id)).toEqual(['place', 'flip', 'serve', 'perfect', 'order', 'upgrade']);
    expect(table.steps.map((s) => s.index)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(table.steps.map((s) => s.screen)).toEqual(['play', 'play', 'play', 'play', 'play', 'home']);
  });

  it('sends tutorial_complete at step 5 and tutorial_step everywhere else', () => {
    expect(table.steps.map((s) => s.event)).toEqual([
      'tutorial_step', 'tutorial_step', 'tutorial_step', 'tutorial_step', 'tutorial_complete', 'tutorial_step'
    ]);
  });

  it('uses the documented prompts, and no text at all where the doc has none', () => {
    const prompt = (id: string): string | undefined => {
      const k = table.steps.find((s) => s.id === id)!.hintKey;
      return k ? ptBR[k] : undefined;
    };
    expect(prompt('place')).toBeUndefined(); // hand drag animation only
    expect(prompt('flip')).toBe('TOQUE PARA VIRAR');
    expect(prompt('serve')).toBe('ARRASTE PARA O CLIENTE');
    expect(prompt('order')).toBeUndefined();
    expect(prompt('upgrade')).toBe('MELHORE SUA CHURRASQUEIRA');
    expect(ptBR[table.skip.labelKey]).toBe('PULAR');
  });

  it('starts on the free 1-zone grill with one linguiça (docs/19 §6)', () => {
    expect(table.turn.ingredientId).toBe('linguica_toscana');
    const ch = db.churrasqueiraById.get(table.turn.churrasqueiraId)!;
    expect(ch.unlockCostCoins).toBe(0);
    expect(ch.evolutions[0]!.zoneCount).toBe(1);
  });
});

describe('TutorialDirector', () => {
  it('declares exactly the params analytics.json declares', () => {
    for (const [name, params] of Object.entries(TUTORIAL_EVENT_PARAMS)) {
      const def = tax.events.find((e) => e.name === name);
      expect(def, `analytics.json lacks ${name}`).toBeDefined();
      expect(Object.keys(def!.params).sort()).toEqual([...params].sort());
    }
  });

  it('sends tutorial_start once, then one event per completed step', () => {
    const { events, sink } = recorder();
    const d = new TutorialDirector(table, null, sink);
    d.start();
    d.start();
    d.tick(1.5);
    expect(d.report('flipped')).toBe(false); // not what step 1 waits for
    expect(d.report('placed')).toBe(true);
    d.tick(2);
    d.report('flipped');
    d.report('served');
    d.report('reward_landed');
    d.miss();
    d.report('order_completed');
    d.report('upgrade_bought');
    expect(d.done).toBe(true);
    expect(d.report('placed')).toBe(false);
    expect(events.map((e) => e.name)).toEqual([
      'tutorial_start', 'tutorial_step', 'tutorial_step', 'tutorial_step', 'tutorial_step', 'tutorial_complete', 'tutorial_step'
    ]);
    expect(events[1]!.params).toEqual({ step: 'place', step_index: 1, elapsed_ms: 1500 });
    expect(events[5]!.params).toEqual({ duration_ms: 3500, misses: 1 });
    expect(events[6]!.params).toEqual({ step: 'upgrade', step_index: 6, elapsed_ms: 3500 });
    for (const e of events) expect(checkAnalyticsEvent(tax, e), JSON.stringify(e)).toEqual([]);
  });

  it('abandons once per step and never after it is done', () => {
    const { events, sink } = recorder();
    const d = new TutorialDirector(table, null, sink);
    expect(d.abandon()).toBe(false); // not started
    d.start();
    expect(d.abandon()).toBe(true);
    expect(d.abandon()).toBe(false);
    d.report('placed');
    expect(d.abandon()).toBe(true);
    const abandons = events.filter((e) => e.name === 'tutorial_abandon');
    expect(abandons.map((e) => e.params)).toEqual([{ step: 'place', step_index: 1 }, { step: 'flip', step_index: 2 }]);
    for (const e of events) expect(checkAnalyticsEvent(tax, e)).toEqual([]);
  });

  it('shows PULAR only after skip.showAfterSec, and a skip ends it with tutorial_skip', () => {
    const { events, sink } = recorder();
    const d = new TutorialDirector(table, null, sink);
    d.start();
    d.tick(table.skip.showAfterSec - 0.1);
    expect(d.canSkip).toBe(false);
    d.tick(0.2);
    expect(d.canSkip).toBe(true);
    d.report('placed');
    expect(d.skip()).toBe(true);
    expect(d.done).toBe(true);
    expect(d.skip()).toBe(false);
    const skip = events.find((e) => e.name === 'tutorial_skip')!;
    expect(skip.params).toMatchObject({ step: 'flip', step_index: 2 });
    expect(checkAnalyticsEvent(tax, skip)).toEqual([]);
    d.abandon();
    expect(events.filter((e) => e.name === 'tutorial_abandon')).toHaveLength(0);
  });

  it('replays the scripted turn after a relaunch without re-sending reported steps', () => {
    const first = recorder();
    const d1 = new TutorialDirector(table, null, first.sink);
    d1.start();
    d1.report('placed');
    d1.report('flipped');
    const saved = JSON.parse(JSON.stringify(d1.state));

    const second = recorder();
    const d2 = new TutorialDirector(table, restoreTutorialState(table, saved), second.sink);
    d2.restartTurn();
    d2.start();
    expect(d2.current!.id).toBe('place');
    d2.report('placed');
    d2.report('flipped');
    d2.report('served');
    expect(second.events.map((e) => `${e.name}:${e.params['step'] ?? ''}`)).toEqual(['tutorial_step:serve']);
  });

  it('restores defensively: garbage or another variant starts fresh, a legacy done flag wins', () => {
    expect(restoreTutorialState(table, null)).toEqual(newTutorialState(table));
    expect(restoreTutorialState(table, { variant: 'old_three_step', step: 3 })).toEqual(newTutorialState(table));
    expect(restoreTutorialState(table, { variant: table.variant, step: 99, reported: 0 })).toEqual(newTutorialState(table));
    expect(restoreTutorialState(table, undefined, true)).toEqual(finishedTutorialState(table));
    const done = new TutorialDirector(table, finishedTutorialState(table), () => { throw new Error('no events'); });
    done.start();
    done.tick(5);
    done.abandon();
    expect(done.done).toBe(true);
  });
});

describe('coach rules and the guided-plate hold', () => {
  it('hides the flip prompt until the face-down side has browned (docs/20: espere dourar)', () => {
    const { turn } = newTurn();
    const f = turn.take()!;
    turn.place(f, 0);
    expect(flipReady(db, table, f)).toBe(false);
    let t = 0;
    while (!flipReady(db, table, f) && t < 30) { turn.tick(DT); t += DT; }
    expect(f.sides[f.downSide]!).toBeGreaterThanOrEqual(table.coach.flipPromptAtSideDoneness);
    expect(t).toBeGreaterThan(3);
    expect(t).toBeLessThan(10);
  });

  it('never lets the guided plate overcook or burn, however long the player waits', () => {
    const { turn } = newTurn();
    const f = turn.take()!;
    turn.place(f, 0);
    // Ignore the flip prompt for two minutes. Carry-over heat evens the plate
    // out under the ceiling; the flip must still be offered and accepted, or
    // step 2 deadlocks (regression: a "does a flip help" rule refused it).
    for (let i = 0; i < 120 / DT; i++) turn.tick(DT);
    expect(f.burned).toBe(false);
    for (const s of f.sides) expect(s).toBeLessThanOrEqual(holdCeiling(table, f) + 1e-12);
    expect(evenness(f)).toBeGreaterThan(0.9);
    expect(turn.coach()).toMatchObject({ kind: 'flip', food: f });
    expect(turn.flip(f)).toBe(true);
    // Ignore the serve prompt for two more minutes.
    for (let i = 0; i < 120 / DT; i++) turn.tick(DT);
    expect(f.burned).toBe(false);
    expect(serveReady(db, table, f)).toBe(true);
    const c = turn.sim.customers[0]!;
    expect(turn.serve(c, f)!.quality).toBe('perfect');
  });

  it('masks everything but the taught action during the guided steps', () => {
    const { turn, director } = newTurn();
    const f = turn.take()!;
    expect(turn.flip(f)).toBe(false); // step 1 teaches placing
    turn.place(f, 0);
    expect(director.current!.id).toBe('flip');
    expect(turn.take()).toBeNull(); // no second plate mid-lesson
    expect(turn.flip(f)).toBe(false); // too early: not browned yet
    expect(turn.discard(f)).toBe(false); // the plate cannot vanish mid-lesson
    expect(director.state.misses).toBe(4);
    expect(turn.plate).toBe(f);
  });

  it('burns nothing in the whole scripted turn — burning is session 2\'s lesson (docs/05 §5)', () => {
    const { turn, director } = newTurn();
    playByHand(turn, { maxSec: 0.1 });
    const f = turn.take()!;
    turn.place(f, 0);
    while (!turn.plateReady) turn.tick(DT);
    turn.flip(f);
    while (!turn.plateReady) turn.tick(DT);
    turn.serve(turn.sim.customers[0]!, f);
    turn.rewardLanded();
    expect(director.current!.id).toBe('order');
    const g = turn.take()!; // step 5: unguided, never flipped, never served
    turn.place(g, 0);
    for (let i = 0; i < 180 / DT; i++) turn.tick(DT);
    expect(g.burned).toBe(false);
    expect(turn.sim.counters.burnedFood).toBe(0);
    expect(overallDoneness(g)).toBeLessThanOrEqual(g.ingredient.perfectWindow[1]);
  });

  it('keeps random customers out of the scripted turn', () => {
    const { turn } = newTurn();
    for (let i = 0; i < 120 / DT; i++) turn.tick(DT);
    expect(turn.sim.customers).toHaveLength(1);
    expect(turn.sim.customers[0]!.lines.map((l) => l.ingredientId)).toEqual([table.turn.ingredientId]);
    expect(turn.sim.customers[0]!.state).toBe('waiting');
  });
});

describe('a player who only follows the hand', () => {
  it('lands a PERFEITO on the guided serve and finishes steps 1–5 in well under a minute', () => {
    const { turn, events, director } = newTurn();
    const { serves, completeAt } = playByHand(turn);
    expect(serves[0]!.quality).toBe('perfect');
    expect(director.current!.id).toBe('upgrade');
    expect(events.map((e) => e.name === 'tutorial_step' ? `step:${e.params['step']}` : e.name)).toEqual([
      'tutorial_start', 'step:place', 'step:flip', 'step:serve', 'step:perfect', 'tutorial_complete'
    ]);
    for (const e of events) expect(checkAnalyticsEvent(tax, e), JSON.stringify(e)).toEqual([]);
    // Leave room in the 60 s budget for the result card and step 6 on Home.
    expect(completeAt).toBeGreaterThan(0);
    expect(completeAt).toBeLessThan(table.targetDurationSec - 12);
    expect(turn.sim.counters.burnedFood).toBe(0);
    expect(turn.sim.counters.customersLost).toBe(0);
    expect(turn.sim.counters.customersSpawned).toBe(table.turn.customers.length);
  });

  it('can afford step 6 from a fresh install (0 coins) with what the turn pays', () => {
    const { turn, director, events } = newTurn();
    playByHand(turn);
    while (!turn.sim.finished) turn.tick(DT); // the wind-down after the last order
    const r = turn.sim.result();
    const coins = 0 + r.coins + level.rewards.coins + level.rewards.firstClearBonus.coins;
    const cost = costFor(db, table.upgradeTrackId, 0);
    expect(coins).toBeGreaterThanOrEqual(cost);
    expect(director.report('upgrade_bought')).toBe(true);
    expect(director.done).toBe(true);
    expect(events.at(-1)).toMatchObject({ name: 'tutorial_step', params: { step: 'upgrade', step_index: 6 } });
  });

  it('still gets its PERFEITO when it hesitates 20 s before every action', () => {
    const { turn } = newTurn();
    const { serves } = playByHand(turn, { hesitate: 20 });
    expect(serves[0]!.quality).toBe('perfect');
    expect(turn.director.current!.id).toBe('upgrade');
  });

  it('finishes step 5 even for a sloppy player, and counts the slop as misses', () => {
    const { turn, director, events } = newTurn();
    playByHand(turn, { maxSec: 0.1 }); // just admit customer 1
    // Guided part, done right.
    const f = turn.take()!;
    turn.place(f, 0);
    while (!flipReady(db, table, f)) turn.tick(DT);
    turn.flip(f);
    while (!serveReady(db, table, f)) turn.tick(DT);
    turn.serve(turn.sim.customers[0]!, f);
    turn.rewardLanded();
    expect(director.current!.id).toBe('order');
    // Step 5, sloppy: never flips and serves late.
    const g = turn.take()!;
    turn.place(g, 0);
    while (overallDoneness(g) < 0.6 && !g.burned) turn.tick(DT);
    const late = turn.serve(turn.sim.customers.find((c) => c.state === 'waiting')!, g)!;
    expect(late.quality).not.toBe('perfect');
    expect(evenness(g)).toBeLessThan(0.6);
    expect(director.current!.id).toBe('upgrade');
    const complete = events.find((e) => e.name === 'tutorial_complete')!;
    expect(complete.params['misses']).toBeGreaterThan(0);
  });
});

describe('TurnSimulation hooks the FTUE needs', () => {
  const base = { restaurantIndex: 0, levelId: 'level_001', upgradeLevels: {}, seed: 3 };

  it('spawnScriptedCustomer admits a fixed order with normal bookkeeping', () => {
    const sim = new TurnSimulation(db, { ...base, overrides: { autoSpawn: false } });
    const c = sim.spawnScriptedCustomer('comum', ['linguica_toscana', 'linguica_toscana'], 42);
    expect(c.lines).toEqual([{ ingredientId: 'linguica_toscana', target: 0, fulfilledBy: [] }]);
    expect(c.patienceTotal).toBe(42);
    expect(sim.counters.customersSpawned).toBe(1);
    expect(sim.events).toContainEqual({ type: 'spawn', customer: c });
    expect(() => sim.spawnScriptedCustomer('nobody', ['linguica_toscana'], 10)).toThrow();
    expect(() => sim.spawnScriptedCustomer('comum', ['no_such_food'], 10)).toThrow();
  });

  it('autoSpawn defaults on, so ordinary turns are unchanged', () => {
    const sim = new TurnSimulation(db, base);
    for (let i = 0; i < 2 / DT; i++) sim.tick(DT);
    expect(sim.counters.customersSpawned).toBeGreaterThan(0);
  });

  it('endAfter only ever brings the end forward', () => {
    const sim = new TurnSimulation(db, { ...base, overrides: { turnLengthSec: 90 } });
    sim.endAfter(500);
    expect(sim.timeLimit).toBe(90);
    for (let i = 0; i < 60; i++) sim.tick(DT);
    sim.endAfter(1.2);
    expect(sim.timeLimit).toBeCloseTo(2.2, 6);
    expect(coachAction.length).toBe(2);
  });
});
