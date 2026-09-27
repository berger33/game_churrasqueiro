/** A-01 reproducible probe: actual windows + fixed-skill advanced turns on the owned grill.
 * Read-only, stdout JSON. This supplements (does not replace) sim:long and its guardrails.
 * Run on each revision for before/after; no recipe overrides or economic retuning.
 */
import { loadDatabase } from './load-data.ts';
import { TurnSimulation } from '../sim-core/src/turn.ts';
import { createFood, tickGrill, flipFood, placeOnGrill, scoreItem, rewardTuning } from '../sim-core/src/cooking.ts';
import { SkillPolicy, optimalFlipPoint } from '../sim-core/src/policy.ts';
import { Rng } from '../sim-core/src/rng.ts';

const db = loadDatabase();
const windows = [];
const windowZoneCount = new TurnSimulation(db, { playerLevel:44, restaurantIndex:4, levelId:'zones', seed:1, upgradeLevels:{} }).grill.zones.length;
for (const id of ['costela', 'cupim']) for (let zone=0;zone<windowZoneCount;zone++) {
  const ing = db.ingredientById.get(id)!;
  const sim = new TurnSimulation(db, { playerLevel: 44, restaurantIndex: 4, levelId: 'window', upgradeLevels: {}, seed: 1 });
  const f = createFood(1, ing);
  placeOnGrill(sim.grill, db, f, zone);
  const flipAt = optimalFlipPoint((ing.perfectWindow[0] + ing.perfectWindow[1]) / 2, ing.sides, db.ingredients.shared.carryoverRate);
  let firstPerfect: number | null = null, lastPerfect: number | null = null, perfectTicks = 0, ticks = 0;
  while (!f.burned && ticks < 3600) {
    ticks++;
    tickGrill(sim.grill, db, 0.05);
    if (ing.flipNeeded && !f.flips && f.sides[f.downSide]! >= flipAt) flipFood(sim.grill, f, ticks * 0.05, db);
    const q = scoreItem(db, f, { target: 0, toleranceScale: 1, patienceRemaining: 1, combo: 0, tipMult: 1, xpMult: 1, tuning: rewardTuning(db.economy) }).quality;
    if (q === 'perfect') { firstPerfect ??= ticks * 0.05; lastPerfect = ticks * 0.05; perfectTicks++; }
  }
  windows.push({ id, zone, flipNeeded: ing.flipNeeded, flips: f.flips, firstPerfect, lastPerfect, perfectSec: perfectTicks * 0.05, burnedAt: f.burned ? ticks * 0.05 : null });
}
const advanced = [];
for (const restaurantIndex of [3, 4, 5, 6]) for (const skill of [0.3, 0.55, 0.85, 1]) {
  let perfect = 0, cooked = 0, burned = 0, lost = 0, spawned = 0, coins = 0, flips = 0;
  const qualities: Record<string, number> = {};
  for (let seed = 1; seed <= 8; seed++) {
    const sim = new TurnSimulation(db, { playerLevel: 44,
      restaurantIndex, levelId: 'advanced-probe', seed, upgradeLevels: {},
      churrasqueiraId: 'fornalha_dragao_manso', churrasqueiraLevel: 3
    });
    const policy = new SkillPolicy(new Rng(seed * 7919), { skill });
    while (!sim.finished) sim.tick(1 / 20, a => policy.act(a));
    const r = sim.result();
    perfect += r.counters.perfectCooks; cooked += r.counters.itemsCooked; burned += r.counters.burnedFood;
    lost += r.counters.customersLost; spawned += r.counters.customersSpawned; coins += r.coins; flips += r.counters.flips;
    for (const e of r.events) if (e.type === 'serve') qualities[e.quality] = (qualities[e.quality] ?? 0) + 1;
  }
  advanced.push({ restaurantIndex, skill, perfect, cooked, burned, lost, spawned, flips, qualities,
    perfectPerServedItem: perfect / Math.max(1, cooked), burnsPerServedItem: burned / Math.max(1, cooked),
    lostPerSpawn: lost / Math.max(1, spawned), coinsPerTurn: coins / 8 });
}
console.log(JSON.stringify({ ingredientsVersion: db.ingredients.version,
  scenario: { playerLevel: 44, stepWindowSec: 0.05, stepTurnSec: 0.05, seeds: [1, 2, 3, 4, 5, 6, 7, 8],
    churrasqueiraId: 'fornalha_dragao_manso', churrasqueiraLevel: 3, upgrades: {},
    note: 'Advanced probe uses restaurant defaults, not campaign upgrades/endless difficulty. Windows use default restaurant 4 grill.' },
  windows, advanced }, null, 2));
