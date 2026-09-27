/** F4 Global Economic Revalidation Report: multi-seed analysis, sinks/faucets breakdown, and pacing. */
import { loadDatabase } from './load-data.ts';
import { simulateProgression, measureSkillCurve, checkTargets } from './run-sim.ts';
import { upgradeCost } from '../sim-core/src/data.ts';
import { newPlayerState } from '../sim-core/src/economy.ts';

const db = loadDatabase();
const seeds = [20260917, 20260918, 20260919];
const skillCurve = measureSkillCurve();

const runs = seeds.map(seed => {
  const r = simulateProgression({ maxTurns: 1500, stepSec: 1 / 12, seed });
  const checks = checkTargets(r, 4, { skillCurve });

  return {
    seed,
    income: r.totalCoinsEarned,
    spent: r.totalCoinsSpent,
    balance: r.player.coins,
    spendRatio: r.session.spendRatio(),
    level: r.player.level,
    restaurant: r.player.restaurantIndex,
    unlocks: r.turnsToUnlock,
    grills: r.turnsToUnlockGrill,
    dailyIncome: r.dailyCoinIncomeAtLevel,
    perfectRate: r.perfectRate,
    burnedRate: r.burnedRate,
    lostRate: r.lostRate,
    avgTurnDurationSec: r.avgTurnDurationSec,
    faucets: r.session.faucets,
    sinks: r.session.sinks,
    checksPassed: checks.filter(c => c.pass).length,
    checksTotal: checks.length,
    failures: checks.filter(c => !c.pass)
  };
});

const starter = newPlayerState();
starter.coins = 100_000_000;
const baseRun = runs[0]!;

const upgradeSinksDetail = db.upgrades.tracks.map(t => {
  const sum = (n: number) => Array.from({ length: n }, (_, i) => upgradeCost(t.baseCost, t.growth, i + 1)).reduce((a, b) => a + b, 0);
  const spent = baseRun.sinks[`upgrade:${t.id}`] ?? 0;
  return {
    id: t.id,
    category: t.category,
    maxLevel: t.maxLevel,
    maxCost: sum(t.maxLevel),
    spentInRun: spent,
    maxed: spent === sum(t.maxLevel)
  };
});

console.log(JSON.stringify({
  phase: 'F4 — Revalidação Econômica Global',
  timestamp: new Date().toISOString(),
  baselineSeed: 20260917,
  multiSeedRuns: runs.map(r => ({
    seed: r.seed,
    income: r.income,
    spent: r.spent,
    balance: r.balance,
    spendRatio: r.spendRatio,
    redeNacionalTurn: r.unlocks.rede_nacional,
    dailyIncomeL50: r.dailyIncome['50'],
    allPassed: r.checksPassed === r.checksTotal,
    checksPassed: r.checksPassed,
    checksTotal: r.checksTotal
  })),
  baselineDetails: {
    faucets: baseRun.faucets,
    sinks: baseRun.sinks,
    quality: {
      perfectRate: baseRun.perfectRate,
      burnedRate: baseRun.burnedRate,
      lostRate: baseRun.lostRate,
      avgTurnDurationSec: baseRun.avgTurnDurationSec
    },
    unlocks: baseRun.unlocks,
    grills: baseRun.grills,
    dailyIncome: baseRun.dailyIncome
  },
  upgradeTracksAudit: {
    totalTracks: upgradeSinksDetail.length,
    allMaxed: upgradeSinksDetail.every(u => u.maxed),
    totalUpgradeSink: upgradeSinksDetail.reduce((a, b) => a + b.spentInRun, 0),
    byCategory: Object.fromEntries(
      ['grill', 'charcoal', 'prep', 'service', 'restaurant', 'employees', 'prestige'].map(cat => [
        cat,
        upgradeSinksDetail.filter(u => u.category === cat).reduce((a, b) => a + b.spentInRun, 0)
      ])
    )
  }
}, null, 2));
