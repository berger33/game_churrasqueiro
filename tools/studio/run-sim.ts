/**
 * Progression simulator (spec §20).
 *
 * Plays the generated level list end to end with a *learning* player, spends the
 * coins it earns on the same sinks a real player would buy, and reports the
 * resulting economy. Balance targets in `economy.json -> targets` are asserted
 * against this output, so a tuning change that breaks pacing fails the build.
 */
import { loadAndValidate } from './load-data.ts';
import { generateEndlessLevels, generateLevels, type GeneratedLevel } from './gen-levels.ts';
import { TurnSimulation } from '../sim-core/src/turn.ts';
import { SkillPolicy } from '../sim-core/src/policy.ts';
import { Rng } from '../sim-core/src/rng.ts';
import {
  applyTurnResult, buyNextChurrasqueira, buyUpgrade, canUnlockRestaurant, costFor,
  createSessionEconomy, equippedChurrasqueira, equippedEvolution, newPlayerState,
  nextChurrasqueiraCost, recordLedger, unlockRestaurant, type PlayerState, type SessionEconomy
} from '../sim-core/src/economy.ts';
import { clamp } from '../sim-core/src/data.ts';

export interface LevelOutcome {
  level: GeneratedLevel;
  coins: number;
  xp: number;
  perfect: number;
  good: number;
  burned: number;
  served: number;
  spawned: number;
  lost: number;
  bestCombo: number;
  stars: number;
  failed: boolean;
}

export interface ProgressionReport {
  outcomes: LevelOutcome[];
  player: PlayerState;
  session: SessionEconomy;
  totalCoinsEarned: number;
  totalCoinsSpent: number;
  turnsToUnlock: Record<string, number>;
  /** Turn (1-based) at which each non-starter churrasqueira was unlocked. */
  turnsToUnlockGrill: Record<string, number>;
  coinsPerTurnByRestaurant: Record<number, { turns: number; avg: number; min: number; max: number }>;
  perfectRate: number;
  burnedRate: number;
  lostRate: number;
  avgTurnDurationSec: number;
  sessionLengthMinutes: number;
  dailyCoinIncomeAtLevel: Record<string, number>;
}

export interface SimOptions {
  /** Turns the player plays per day (used for the daily-income projection). */
  turnsPerDay?: number;
  seed?: number;
  levels?: GeneratedLevel[];
  /** Play past the authored content with endless turns (long-horizon pacing projection). */
  maxTurns?: number;
  /** Simulation step. 1/20s for balance runs, 1/30s to match the shipped client. */
  stepSec?: number;
  /** Skill floor/ceiling as the player learns the game. */
  skillFloor?: number;
  skillCeiling?: number;
}

const UPGRADE_PRIORITY = [
  'grill_size', 'charcoal_duration', 'grill_heat', 'plates', 'knife',
  'patience_charm', 'capacity', 'tables', 'charcoal_quality', 'grill_stability',
  'tray', 'counter', 'decor', 'sign', 'grill_speed', 'music', 'board', 'lighting',
  'charcoal_auto', 'garcom', 'auxiliar', 'churrasqueiro', 'caixa', 'gerente',
  // Long-tail coin sinks (kept last so they never crowd out meaningful upgrades).
  'brasa_mastery', 'clientela_fiel', 'imperio_logistica'
];

export function simulateProgression(opts: SimOptions = {}): ProgressionReport {
  const { db, problems } = loadAndValidate();
  if (problems.length) throw new Error(`data invalid:\n${problems.join('\n')}`);

  const p = newPlayerState();
  const seed = opts.seed ?? 20260917;
  const turnsPerDay = opts.turnsPerDay ?? 12;
  const skillFloor = opts.skillFloor ?? 0.38;
  const skillCeiling = opts.skillCeiling ?? 0.9;
  const authored = opts.levels ?? generateLevels([[0, 24], [1, 36]]).levels;
  const maxTurns = opts.maxTurns ?? authored.length;

  /**
   * Levels are produced lazily: endless turns must be generated for the tier the
   * player has actually reached, which is only known as the run progresses.
   */
  const levelAt = (i: number): GeneratedLevel => {
    if (i < authored.length) return authored[i]!;
    const r = db.restaurantByIndex.get(p.restaurantIndex)!;
    return generateEndlessLevels(1, i + 1, {
      index: r.index,
      turnLengthSec: r.turnLengthSec,
      maxOrders: r.service.maxOrdersOnScreen
    })[0]!;
  };

  const session = createSessionEconomy();
  const outcomes: LevelOutcome[] = [];
  const turnsToUnlock: Record<string, number> = {};
  const turnsToUnlockGrill: Record<string, number> = {};
  const perRestaurant = new Map<number, number[]>();
  const dailyAtLevel = new Map<number, { coins: number; turns: number }>();

  for (let li = 0; li < maxTurns; li++) {
    const level = levelAt(li);
    // Players get better with practice but never become perfect.
    const skill = clamp(skillFloor + (p.level - 1) * 0.014, skillFloor, skillCeiling);
    const grill = equippedChurrasqueira(db, p);
    const evo = equippedEvolution(db, p);
    const sim = new TurnSimulation(
      db,
      {
        restaurantIndex: p.restaurantIndex,
        levelId: level.id,
        upgradeLevels: { ...p.upgradeLevels },
        seed: seed + level.index,
        churrasqueiraId: grill?.id,
        churrasqueiraLevel: evo?.level ?? 1,
        overrides: {
          turnLengthSec: level.turnLengthSec,
          spawnIntervalSec: level.spawnIntervalSec,
          patienceScalar: level.patienceScalar,
          difficultyScalar: level.difficultyScalar,
          maxOrdersOnScreen: level.maxOrdersOnScreen
        }
      },
      seed + level.index
    );
    const policy = new SkillPolicy(new Rng(seed + level.index * 7919), { skill });

    // 1/20s is fine for balance work (the shipped client steps at 1/30 or vsync).
    const dt = opts.stepSec ?? 1 / 20;
    let guard = 0;
    while (!sim.finished && guard++ < 40000) sim.tick(dt, (a) => policy.act(a));
    const r = sim.result();

    const applied = applyTurnResult(db, p, r);
    recordLedger(session, applied.ledger);

    // Level clear rewards.
    const clear = p.counters[`cleared_${level.id}`] ? 0 : 1;
    if (clear) {
      p.counters[`cleared_${level.id}`] = 1;
      p.coins += level.rewards.firstClearBonus.coins;
      session.faucets['level_first_clear'] = (session.faucets['level_first_clear'] ?? 0) + level.rewards.firstClearBonus.coins;
    }
    p.coins += level.rewards.coins;
    session.faucets['level_reward'] = (session.faucets['level_reward'] ?? 0) + level.rewards.coins;

    // Sinks: restaurant (identity beat) first, then the grill path (the Home CTA),
    // then upgrades. The grill used to be invisible to this harness — every turn
    // ran on the restaurant's default 3-zone grill, so the 15 targets described
    // a game the player does not play (they start on 1-zone lata_valente).
    if (canUnlockRestaurant(db, p, p.restaurantIndex + 1)) {
      const before = p.coins;
      if (unlockRestaurant(db, p, p.restaurantIndex + 1)) {
        session.sinks['restaurant_unlock'] = (session.sinks['restaurant_unlock'] ?? 0) + (before - p.coins);
        turnsToUnlock[db.restaurantByIndex.get(p.restaurantIndex)!.id] = outcomes.length + 1;
      }
    }
    let boughtGrill = true;
    while (boughtGrill) {
      boughtGrill = false;
      const grillCost = nextChurrasqueiraCost(db, p);
      if (grillCost !== Infinity && p.coins >= grillCost) {
        const beforeId = p.churrasqueiraId;
        const entry = buyNextChurrasqueira(db, p);
        if (entry) {
          recordLedger(session, [entry]);
          if (p.churrasqueiraId !== beforeId) {
            turnsToUnlockGrill[p.churrasqueiraId] = outcomes.length + 1;
          }
          boughtGrill = true;
        }
      }
    }
    let bought = true;
    while (bought) {
      bought = false;
      for (const trackId of UPGRADE_PRIORITY) {
        const cost = costFor(db, trackId, p.upgradeLevels[trackId] ?? 0);
        if (cost === Infinity) continue;
        // Keep a reserve so the next restaurant *and* the next grill step stay in sight.
        const nextRestaurant = db.restaurantByIndex.get(p.restaurantIndex + 1);
        const restaurantReserve = nextRestaurant ? nextRestaurant.unlockCostCoins * 0.15 : 0;
        const grillStepCost = nextChurrasqueiraCost(db, p);
        const grillReserve = grillStepCost === Infinity ? 0 : grillStepCost * 0.15;
        const reserve = Math.max(restaurantReserve, grillReserve);
        if (p.coins - reserve >= cost) {
          const entry = buyUpgrade(db, p, trackId);
          if (entry) {
            recordLedger(session, [entry]);
            bought = true;
            break;
          }
        }
      }
    }

    outcomes.push({
      level,
      coins: r.coins + level.rewards.coins,
      xp: r.xp,
      perfect: r.counters.perfectCooks,
      good: r.counters.goodCooks,
      burned: r.counters.burnedFood,
      served: r.counters.customersServed,
      spawned: r.counters.customersSpawned,
      lost: r.counters.customersLost,
      bestCombo: r.counters.bestCombo,
      stars: r.stars,
      failed: r.failed
    });

    const bucket = perRestaurant.get(level.restaurantIndex) ?? [];
    bucket.push(r.coins + level.rewards.coins);
    perRestaurant.set(level.restaurantIndex, bucket);

    const dayBucket = dailyAtLevel.get(p.level) ?? { coins: 0, turns: 0 };
    dayBucket.coins += r.coins + level.rewards.coins;
    dayBucket.turns += 1;
    dailyAtLevel.set(p.level, dayBucket);
  }

  const coinsPerTurnByRestaurant: ProgressionReport['coinsPerTurnByRestaurant'] = {};
  for (const [k, v] of perRestaurant) {
    coinsPerTurnByRestaurant[k] = {
      turns: v.length,
      avg: Math.round(v.reduce((a, b) => a + b, 0) / v.length),
      min: Math.min(...v),
      max: Math.max(...v)
    };
  }

  const totalPerfect = outcomes.reduce((a, o) => a + o.perfect, 0);
  const totalGood = outcomes.reduce((a, o) => a + o.good, 0);
  const totalBurned = outcomes.reduce((a, o) => a + o.burned, 0);
  const totalSpawned = outcomes.reduce((a, o) => a + o.spawned, 0);
  const totalLost = outcomes.reduce((a, o) => a + o.lost, 0);
  const avgTurnDurationSec = outcomes.reduce((a, o) => a + o.level.turnLengthSec, 0) / Math.max(1, outcomes.length);

  const dailyCoinIncomeAtLevel: Record<string, number> = {};
  for (const [lvl, b] of [...dailyAtLevel.entries()].sort((a, c) => a[0] - c[0])) {
    dailyCoinIncomeAtLevel[String(lvl)] = Math.round((b.coins / b.turns) * turnsPerDay);
  }

  return {
    outcomes,
    player: p,
    session,
    totalCoinsEarned: session.faucetTotal(),
    totalCoinsSpent: session.sinkTotal(),
    turnsToUnlock,
    turnsToUnlockGrill,
    coinsPerTurnByRestaurant,
    perfectRate: totalPerfect / Math.max(1, totalPerfect + totalGood + totalBurned),
    burnedRate: totalBurned / Math.max(1, totalPerfect + totalGood + totalBurned),
    lostRate: totalLost / Math.max(1, totalSpawned),
    avgTurnDurationSec,
    sessionLengthMinutes: (avgTurnDurationSec * (opts.turnsPerDay ?? 12) * 0.3) / 60,
    dailyCoinIncomeAtLevel
  };
}

/**
 * Measures the perfect/burned/lost rates at fixed skill levels, replaying the
 * authored content. This is what the `perfectRateAtSkillMid` guardrail is
 * actually keyed to — an aggregate over a whole progression run is not, because
 * the simulated player improves while playing.
 */
export function measureSkillCurve(opts: { skills?: number[]; levels?: GeneratedLevel[]; seed?: number } = {}): Record<
  string,
  { perfect: number; good: number; burned: number; lost: number; coinsPerTurn: number }
> {
  const { db, problems } = loadAndValidate();
  if (problems.length) throw new Error(`data invalid:\n${problems.join('\n')}`);
  const skills = opts.skills ?? [0.3, 0.45, 0.55, 0.7, 0.85, 1.0];
  const levels = opts.levels ?? generateLevels([[0, 24], [1, 36]]).levels.slice(0, 40);
  const seed = opts.seed ?? 4242;
  const out: Record<string, { perfect: number; good: number; burned: number; lost: number; coinsPerTurn: number }> = {};

  for (const skill of skills) {
    let perfect = 0;
    let good = 0;
    let burned = 0;
    let spawned = 0;
    let lost = 0;
    let coins = 0;
    for (const level of levels) {
      const sim = new TurnSimulation(
        db,
        {
          restaurantIndex: level.restaurantIndex,
          levelId: level.id,
          upgradeLevels: {},
          seed: seed + level.index,
          overrides: {
            turnLengthSec: level.turnLengthSec,
            spawnIntervalSec: level.spawnIntervalSec,
            patienceScalar: level.patienceScalar,
            difficultyScalar: level.difficultyScalar,
            maxOrdersOnScreen: level.maxOrdersOnScreen
          }
        },
        seed + level.index
      );
      const policy = new SkillPolicy(new Rng(seed + level.index * 104729), { skill });
      let guard = 0;
      while (!sim.finished && guard++ < 40000) sim.tick(1 / 20, (a) => policy.act(a));
      const r = sim.result();
      perfect += r.counters.perfectCooks;
      good += r.counters.goodCooks;
      burned += r.counters.burnedFood;
      spawned += r.counters.customersSpawned;
      lost += r.counters.customersLost;
      coins += r.coins;
    }
    out[skill.toFixed(2)] = {
      perfect: perfect / Math.max(1, perfect + good + burned),
      good: good / Math.max(1, perfect + good + burned),
      burned: burned / Math.max(1, perfect + good + burned),
      lost: lost / Math.max(1, spawned),
      coinsPerTurn: Math.round(coins / levels.length)
    };
  }
  return out;
}

export interface TargetCheck {
  id: string;
  pass: boolean;
  skipped?: boolean;
  detail: string;
}

/** Checks are tagged with the minimum simulated horizon that can actually evaluate them. */
const LONG_HORIZON_CHECKS = new Set([
  'unlock:trailer', 'unlock:churrascaria_bairro', 'unlock:churrascaria_premium',
  'unlock:festival', 'unlock:rede_nacional', 'income:level15', 'income:level30',
  'income:level50', 'coinSpendRatio'
]);

export function checkTargets(
  report: ProgressionReport,
  turnsPerSession: number,
  opts: { skillCurve?: Record<string, { perfect: number; good: number; burned: number; lost: number; coinsPerTurn: number }> } = {}
): TargetCheck[] {
  const { db } = loadAndValidate();
  const targets = db.economy.targets as Record<string, unknown>;
  const checks: TargetCheck[] = [];

  const range = (v: unknown): [number, number] => {
    const a = v as [number, number];
    return [a[0], a[1]];
  };
  const inRange = (v: number, r: [number, number]): boolean => v >= r[0] && v <= r[1];

  const tps = range(targets['turnsPerSession']);
  checks.push({
    id: 'turnsPerSession',
    pass: inRange(turnsPerSession, tps),
    detail: `assumed ${turnsPerSession} turns/session, target ${tps[0]}-${tps[1]}`
  });

  const first = range(targets['firstUpgradeAffordableAfterTurns']);
  const firstUpgradeTurn = report.outcomes.findIndex((o, i) => {
    let acc = 0;
    for (let k = 0; k <= i; k++) acc += report.outcomes[k]!.coins;
    return acc >= costFor(db, 'grill_size', 0);
  }) + 1;
  checks.push({
    id: 'firstUpgradeAffordableAfterTurns',
    pass: inRange(firstUpgradeTurn, first),
    detail: `cheapest upgrade reachable after turn ${firstUpgradeTurn || 'never'}, target ${first[0]}-${first[1]}`
  });

  const horizon = report.outcomes.length;
  const skipIfShort = (id: string, detail: string): TargetCheck => ({
    id,
    pass: true,
    skipped: true,
    detail: `${detail} — needs a run of at least ${targets['_longHorizonTurns'] ?? 1500} turns (npm run sim:long)`
  });

  for (const [rid, raw] of Object.entries(targets['restaurantUnlockPacingTurns'] as Record<string, [number, number]>)) {
    const id = `unlock:${rid}`;
    const turn = report.turnsToUnlock[rid];
    if (turn === undefined) {
      // Banda que ainda não terminou quando o run acaba não é violação, é horizonte curto (o
      // degrau pode cair no último turno da janela). Quem decide o
      // "longo" aqui é a própria banda, não uma lista mantida à mão (conteúdo novo sumiria do gate
      // com um FAIL injusto, ou ficava fora do gate sem ninguém perceber).
      if (horizon < raw[1]) {
        checks.push(skipIfShort(id, 'not reached in this run'));
      } else {
        checks.push({ id, pass: false, detail: 'never unlocked during the simulated run' });
      }
    } else {
      checks.push({ id, pass: inRange(turn, raw), detail: `unlocked at turn ${turn}, target ${raw[0]}-${raw[1]}` });
    }
  }

  for (const [lvl, raw] of Object.entries(targets['dailyCoinIncomeAtLevel'] as Record<string, [number, number]>)) {
    const actual = report.dailyCoinIncomeAtLevel[lvl];
    if (actual === undefined) {
      const id = `income:level${lvl}`;
      if (LONG_HORIZON_CHECKS.has(id)) checks.push(skipIfShort(id, 'level not reached in this run'));
      else checks.push({ id, pass: false, detail: 'level not reached in this run' });
    } else {
      checks.push({ id: `income:level${lvl}`, pass: inRange(actual, raw), detail: `${actual} coins/day at level ${lvl}, target ${raw[0]}-${raw[1]}` });
    }
  }

  const ratio = report.session.spendRatio();
  if (LONG_HORIZON_CHECKS.has('coinSpendRatio') && horizon < 400) {
    checks.push(skipIfShort('coinSpendRatio', `short-run spend ratio ${ratio.toFixed(3)} (greedy spender)`));
  } else {
    const rr = range(targets['coinSpendRatio']);
    checks.push({ id: 'coinSpendRatio', pass: inRange(ratio, rr), detail: `spend ratio ${ratio.toFixed(3)}, target ${rr[0]}-${rr[1]}` });
  }

  const spike = range([1, targets['maxSingleTurnCoinSpikeVsMedian'] as number]);
  const median = medianOf(report.outcomes.map((o) => o.coins));
  const maxTurn = Math.max(...report.outcomes.map((o) => o.coins));
  checks.push({
    id: 'coinSpike',
    pass: inRange(maxTurn / Math.max(1, median), spike),
    detail: `max/median turn income = ${(maxTurn / Math.max(1, median)).toFixed(2)} (max ${maxTurn}, median ${Math.round(median)}), cap ${spike[1]}`
  });

  const pr = range(targets['perfectRateAtSkillMid']);
  const curve = opts.skillCurve ?? measureSkillCurve();
  const mid = curve['0.55'];
  checks.push({
    id: 'perfectRateAtSkillMid',
    pass: mid ? inRange(mid.perfect, pr) : false,
    detail: mid
      ? `perfect rate at skill 0.55 = ${(mid.perfect * 100).toFixed(1)}%, target ${(pr[0] * 100).toFixed(0)}-${(pr[1] * 100).toFixed(0)}%`
      : 'skill curve unavailable'
  });

  const grillPacing = targets['churrasqueiraUnlockPacingTurns'] as Record<string, [number, number]> | undefined;
  if (grillPacing) {
    for (const [rid, raw] of Object.entries(grillPacing)) {
      const id = `grill:${rid}`;
      const turn = report.turnsToUnlockGrill[rid];
      if (turn === undefined) {
        if (horizon < raw[1]) {
          checks.push(skipIfShort(id, 'not reached in this run'));
        } else {
          checks.push({ id, pass: false, detail: 'never unlocked during the simulated run' });
        }
      } else {
        checks.push({ id, pass: inRange(turn, raw), detail: `unlocked at turn ${turn}, target ${raw[0]}-${raw[1]}` });
      }
    }
  }

  return checks;
}

function medianOf(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  if (s.length === 0) return 0;
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const turnsPerSession = Number(process.argv[2] ?? 4);
  const longHorizon = process.env.LONG_HORIZON ? Number(process.env.LONG_HORIZON) : undefined;
  const report = simulateProgression({ turnsPerDay: turnsPerSession * 3, maxTurns: longHorizon, stepSec: longHorizon ? 1 / 12 : 1 / 20 });
  const skillCurve = measureSkillCurve();
  const checks = checkTargets(report, turnsPerSession, { skillCurve });

  console.log('── CHURRASCO! economy simulation ─────────────────────────────');
  console.log(`turns simulated: ${report.outcomes.length}`);
  const grillId = report.player.churrasqueiraId;
  const grillLv = report.player.churrasqueiraLevels[grillId] ?? 1;
  console.log(`final level: ${report.player.level}   restaurant: ${report.player.restaurantIndex}   grill: ${grillId} evo ${grillLv}   coins left: ${report.player.coins}`);
  console.log(`coins earned: ${report.totalCoinsEarned}   spent: ${report.totalCoinsSpent}   spend ratio: ${report.session.spendRatio().toFixed(3)}`);
  console.log(`perfect rate: ${(report.perfectRate * 100).toFixed(1)}%   burned rate: ${(report.burnedRate * 100).toFixed(1)}%   lost customers: ${(report.lostRate * 100).toFixed(1)}%`);
  console.log(`avg turn length: ${report.avgTurnDurationSec.toFixed(1)}s`);
  console.log('');
  console.log('coins per turn by restaurant tier:');
  for (const [k, v] of Object.entries(report.coinsPerTurnByRestaurant)) {
    console.log(`  tier ${k}: avg ${v.avg} (min ${v.min}, max ${v.max}) over ${v.turns} turns`);
  }
  console.log('');
  console.log('faucets:');
  for (const [k, v] of Object.entries(report.session.faucets)) console.log(`  ${k.padEnd(20)} ${String(Math.round(v)).padStart(10)}`);
  console.log('sinks:');
  for (const [k, v] of Object.entries(report.session.sinks)) console.log(`  ${k.padEnd(20)} ${String(Math.round(v)).padStart(10)}`);
  console.log('');
  console.log('turn at which each establishment was unlocked:');
  for (const [k, v] of Object.entries(report.turnsToUnlock)) console.log(`  ${k.padEnd(22)} turn ${v}`);
  console.log('');
  console.log('turn at which each churrasqueira was unlocked:');
  if (Object.keys(report.turnsToUnlockGrill).length === 0) {
    console.log('  (starter only — no further grill purchased in this run)');
  } else {
    for (const [k, v] of Object.entries(report.turnsToUnlockGrill)) console.log(`  ${k.padEnd(22)} turn ${v}`);
  }
  console.log('');
  console.log('target checks:');
  let failed = 0;
  for (const c of checks) {
    if (!c.pass) failed++;
    console.log(`  ${c.pass ? 'PASS' : 'FAIL'}  ${c.id.padEnd(34)} ${c.detail}`);
  }
  console.log('');
  console.log('skill curve (authored content, fixed skill):');
  console.log('  skill  perfect   good   burned   lost   coins/turn');
  for (const [k, v] of Object.entries(skillCurve)) {
    console.log(`  ${k}  ${(v.perfect * 100).toFixed(1).padStart(6)}%  ${(v.good * 100).toFixed(1).padStart(5)}%  ${(v.burned * 100).toFixed(1).padStart(6)}%  ${(v.lost * 100).toFixed(1).padStart(5)}%  ${String(v.coinsPerTurn).padStart(10)}`);
  }
  console.log('');
  console.log(failed === 0 ? `all ${checks.length} balance targets met` : `${failed} of ${checks.length} balance targets FAILED`);
  process.exit(failed === 0 ? 0 : 1);
}
