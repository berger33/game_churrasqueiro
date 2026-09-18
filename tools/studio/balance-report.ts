/**
 * balance-report.mts — the automatic economy report required by the brief:
 * time-to-upgrade, sinks/faucets, and inflation.
 *
 *   npm run balance-report            short report (authored content)
 *   HORIZON=1500 npm run balance-report   full campaign projection
 *
 * It replays a simulated campaign with `simulateProgression` (the same harness
 * `npm run sim` uses) and prints a human-readable report. Exit code 0 always —
 * this is a *report*, not a gate; `npm run sim` is the gate.
 */
import { simulateProgression, type ProgressionReport } from './run-sim.ts';
import { loadAndValidate } from './load-data.ts';
import { xpForLevel } from '../sim-core/src/economy.ts';
import { costFor } from '../sim-core/src/economy.ts';

const HORIZON = Number(process.env.HORIZON ?? 0);
const { db } = loadAndValidate();

const fmt = (n: number): string => Math.round(n).toLocaleString('en-US');
const pct = (n: number): string => `${(n * 100).toFixed(1)}%`;

function hr(title: string): void {
  console.log('');
  console.log(`── ${title} ${'─'.repeat(Math.max(0, 62 - title.length))}`);
}

const report: ProgressionReport = simulateProgression(HORIZON > 0 ? { maxTurns: HORIZON } : {});
const turns = report.outcomes.length;
const turnsPerDay = 12;
const xpFormula = db.economy.xp.formula;

console.log('══════════════════════════════════════════════════════════════');
console.log('  CHURRASCO! — economy balance report');
console.log(`  ${turns} simulated turns · skill ramp 0.55 · seed deterministic`);
console.log(`  ≈ ${(turns / turnsPerDay).toFixed(0)} days at ${turnsPerDay} turns/day`);
console.log('══════════════════════════════════════════════════════════════');

// ── 1. Sinks and faucets ────────────────────────────────────────────────────
hr('FAUCETS (coins in)');
const faucets = Object.entries(report.session.faucets).sort((a, b) => b[1] - a[1]);
const faucetTotal = report.session.faucetTotal();
for (const [k, v] of faucets) {
  console.log(`  ${k.padEnd(22)} ${fmt(v).padStart(12)}  ${pct(v / faucetTotal).padStart(6)}`);
}
console.log(`  ${'TOTAL'.padEnd(22)} ${fmt(faucetTotal).padStart(12)}`);

hr('SINKS (coins out)');
const sinks = Object.entries(report.session.sinks).sort((a, b) => b[1] - a[1]);
const sinkTotal = report.session.sinkTotal();
for (const [k, v] of sinks) {
  console.log(`  ${k.padEnd(22)} ${fmt(v).padStart(12)}  ${pct(v / sinkTotal).padStart(6)}`);
}
console.log(`  ${'TOTAL'.padEnd(22)} ${fmt(sinkTotal).padStart(12)}`);

hr('SINK HEALTH');
const ratio = report.session.spendRatio();
const verdict =
  ratio < 0.7 ? 'INFLATION RISK — coins accumulate faster than they can be spent'
  : ratio > 0.99 ? 'DEFLATION RISK — players will stall with nothing affordable'
  : 'healthy — players stay just short of the next purchase';
console.log(`  spend ratio  ${ratio.toFixed(3)}   (${pct(ratio)} of everything earned is spent)`);
console.log(`  verdict      ${verdict}`);
console.log(`  unspent      ${fmt(faucetTotal - sinkTotal)} coins left on the balance`);

// ── 2. Time-to-upgrade ──────────────────────────────────────────────────────
hr('TIME TO NEXT PURCHASE');
console.log('  Track                 next cost      income/turn   turns to buy   days');
const coinsPerTurn = turns > 0 ? faucetTotal / turns : 0;
const tracks = ['grill_size', 'grill_heat', 'charcoal_duration', 'plates', 'capacity', 'gerente'];
for (const id of tracks) {
  const track = db.upgradeById.get(id);
  if (!track) continue;
  const current = report.player.upgradeLevels[id] ?? 0;
  if (current >= track.maxLevel) {
    console.log(`  ${id.padEnd(21)} ${'MAXED'.padStart(11)}`);
    continue;
  }
  const cost = costFor(db, id, current);
  const turnsToBuy = coinsPerTurn > 0 ? cost / coinsPerTurn : Infinity;
  console.log(
    `  ${id.padEnd(21)} ${fmt(cost).padStart(11)}  ${fmt(coinsPerTurn).padStart(13)}  ` +
    `${turnsToBuy.toFixed(1).padStart(13)}  ${(turnsToBuy / turnsPerDay).toFixed(1).padStart(6)}`
  );
}

hr('ESTABLISHMENT UNLOCK PACING');
const order = [...db.restaurantByIndex.keys()].sort((a, b) => a - b);
for (const idx of order) {
  const r = db.restaurantByIndex.get(idx)!;
  const at = report.turnsToUnlock[r.id];
  const label = at ? `turn ${String(at).padStart(5)}  (day ${(at / turnsPerDay).toFixed(0)})` : 'not reached';
  console.log(`  ${String(idx).padStart(2)} ${r.id.padEnd(22)} ${fmt(r.unlockCostCoins).padStart(11)} coins   ${label}`);
}

// ── 3. Inflation ────────────────────────────────────────────────────────────
hr('INFLATION CHECK');
console.log('  Income must grow, but slower than the costs it buys. If income/turn');
console.log('  outgrows upgrade cost, every purchase becomes instant and the loop dies.');
console.log('');

// Only levels this run actually reached are measurable. Reporting a hypothetical
// level 70 row against the player's level-11 upgrade state would be a lie, so we
// print what the campaign produced and say so.
const reachedLevels = [5, 15, 30, 50, 70].filter((l) => report.dailyCoinIncomeAtLevel[String(l)] !== undefined);
if (reachedLevels.length === 0) {
  console.log('  no measured income samples — the run did not reach level 5.');
} else {
  console.log('  Level    xp for next     income/day     income/turn');
  for (const level of reachedLevels) {
    const income = report.dailyCoinIncomeAtLevel[String(level)]!;
    const need = xpForLevel(level, xpFormula.a, xpFormula.exponent, xpFormula.minPerLevel);
    console.log(
      `  ${String(level).padStart(5)}  ${fmt(need).padStart(13)}  ` +
      `${fmt(income).padStart(13)}  ${fmt(income / turnsPerDay).padStart(14)}`
    );
  }
  if (reachedLevels.length >= 2) {
    const first = reachedLevels[0]!;
    const last = reachedLevels[reachedLevels.length - 1]!;
    const i0 = report.dailyCoinIncomeAtLevel[String(first)]!;
    const i1 = report.dailyCoinIncomeAtLevel[String(last)]!;
    const c0 = costFor(db, 'grill_size', 0);
    const track = db.upgradeById.get('grill_size')!;
    const c1 = costFor(db, 'grill_size', Math.max(0, track.maxLevel - 1));
    const incomeGrowth = i1 / i0;
    const costGrowth = c1 / c0;
    console.log('');
    console.log(`  income growth  L${first}->L${last}   x${incomeGrowth.toFixed(2)}`);
    console.log(`  cost growth    grill_size 0->${track.maxLevel - 1}   x${costGrowth.toFixed(2)}`);
    console.log(
      `  verdict        ${
        costGrowth > incomeGrowth
          ? 'costs outpace income — purchases stay meaningful as the player grows'
          : 'INFLATION — income outpaces costs; the loop will flatten out'
      }`
    );
  }
}
console.log('');
console.log(`  final level reached: ${report.player.level} — run HORIZON=1500 npm run balance-report`);
console.log('  for the full campaign projection.');

// ── 4. Per-tier throughput ──────────────────────────────────────────────────
hr('THROUGHPUT BY ESTABLISHMENT');
console.log('  index   turns    avg coins/turn    min    max    spread');
for (const [idxRaw, s] of Object.entries(report.coinsPerTurnByRestaurant)) {
  const idx = Number(idxRaw);
  const r = db.restaurantByIndex.get(idx);
  const spread = s.avg > 0 ? s.max / s.avg : 0;
  console.log(
    `  ${String(idx).padStart(5)}  ${String(s.turns).padStart(6)}  ${fmt(s.avg).padStart(16)}  ` +
    `${fmt(s.min).padStart(6)}  ${fmt(s.max).padStart(6)}  ${spread.toFixed(2).padStart(7)}`
  );
}

hr('QUALITY');
console.log(`  perfect rate   ${pct(report.perfectRate)}`);
console.log(`  burned rate    ${pct(report.burnedRate)}`);
console.log(`  lost rate      ${pct(report.lostRate)}`);
console.log(`  avg turn       ${report.avgTurnDurationSec.toFixed(1)} s`);
console.log(`  session        ${report.sessionLengthMinutes.toFixed(1)} min`);
console.log(`  final level    ${report.player.level}   restaurant index ${report.player.restaurantIndex}`);
console.log('');
console.log('  Gate: `npm run sim` (short) and `npm run sim:long` (1500 turns).');
console.log('  Bands live in shared/data/economy.json → targets.');
console.log('');
