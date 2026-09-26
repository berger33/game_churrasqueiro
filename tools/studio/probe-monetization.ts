/**
 * Probe for the three monetization ideas studied in docs/24 (comandas, soprador/água,
 * the shape of the premium currency).
 *
 *   node --experimental-strip-types tools/studio/probe-monetization.ts
 *
 * It is not a gate and asserts nothing. It plays a fixed number of turns under a few
 * deliberate perturbations and prints what moved. The reason it exists is that "fila em
 * dobro rende o dobro?" is an arithmetic question about a grill with N slots, and the
 * answer is not obviously "double" — so the decision is taken against measured numbers,
 * not against the size of the idea.
 */
import { loadAndValidate } from './load-data.ts';
import { TurnSimulation, type TurnConfig } from '../sim-core/src/turn.ts';

type Ov = NonNullable<TurnConfig['overrides']>;
import { SkillPolicy } from '../sim-core/src/policy.ts';
import { Rng } from '../sim-core/src/rng.ts';
import { effectiveHeat } from '../sim-core/src/cooking.ts';

const STEP = 1 / 16;
const TURNS = Number(process.env['PROBE_TURNS'] ?? 24);
const SKILL = Number(process.env['PROBE_SKILL'] ?? 0.55);
/**
 * Slow hands: `SkillPolicyOptions.reactionSec` is the modelled decide→tap lag. A player who is
 * *late* is the only one a water bottle can help — measuring the rescue against a bot that already
 * releases early would prove nothing, so the lag is a dial of this probe (PROBE_REACTION=1.2).
 */
const REACTION = process.env['PROBE_REACTION'] ? Number(process.env['PROBE_REACTION']) : undefined;

type ToolMode = 'all' | 'laggard' | 'rescue';

interface Case {
  id: string;
  note: string;
  overrides?: Partial<Ov>;
  /** multiply how many items every customer orders (the "pedido em dobro" half of a comanda) */
  itemsMult?: number;
  /** soprador / garrafa: heat factor on the rows the tool is pointed at, while it runs */
  tool?: { boost: number; durSec: number; cooldownSec: number; mode: ToolMode; trigger?: number };
}

interface Row {
  coins: number; xp: number; perfectPct: number; burnedPct: number; lostPct: number;
  servedPerTurn: number; spawnedPerTurn: number; cookedPerTurn: number;
  peakOrders: number; stars: number; failedTurns: number; blastsPerTurn: number;
}

function doneness(f: any): number {
  const s = f.sides as number[];
  let sum = 0;
  for (let i = 0; i < s.length; i++) sum += s[i]!;
  return sum / s.length;
}

/**
 * Which rows the tool is pointed at this tick. `laggard` picks exactly one row (the plate
 * furthest below its window centre) because that is the only aiming a player can actually do
 * on a hot grill; `rescue` picks rows already past the top of their window; `all` is the
 * spam case, and it is here precisely to show what "just hold the button" does to the burn rate.
 */
function rowsToBlow(sim: any, mode: ToolMode, trigger: number): Set<number> {
  const zones = sim.grill.zones as any[];
  const out = new Set<number>();
  if (mode === 'laggard') {
    let worst = -1, worstGap = 0.12;
    for (let zi = 0; zi < zones.length; zi++) {
      for (const f of zones[zi]!.items as any[]) {
        const w = f.ingredient.perfectWindow as [number, number];
        const gap = (w[0] + w[1]) / 2 - doneness(f);
        if (gap > worstGap) { worstGap = gap; worst = zi; }
      }
    }
    if (worst >= 0) out.add(worst);
    return out;
  }
  for (let zi = 0; zi < zones.length; zi++) {
    const items = zones[zi]!.items as any[];
    if (items.length === 0) continue;
    if (mode === 'all') { out.add(zi); continue; }
    for (const f of items) {
      const w = f.ingredient.perfectWindow as [number, number];
      if (doneness(f) > w[1] * trigger) { out.add(zi); break; }
    }
  }
  return out;
}

function play(db: any, restaurantIndex: number, grillId: string | null, grillLevel: number, c: Case): Row {
  const rest = db.restaurantByIndex.get(restaurantIndex)!;
  const ids = rest.customerPool as string[];

  // The comanda's second half ("entrar pedidos em dobro") is a property of the customer
  // table, not of the turn, so it is applied here and taken back off afterwards: this probe
  // must not be able to leave a mutated table behind for the next caller.
  const saved = new Map<string, [number, number]>();
  if (c.itemsMult) {
    for (const id of ids) {
      const def = db.customerById.get(id);
      if (!def) continue;
      saved.set(id, [def.itemsMin, def.itemsMax]);
      def.itemsMin = Math.max(1, Math.round(def.itemsMin * c.itemsMult));
      def.itemsMax = Math.max(def.itemsMin, Math.round(def.itemsMax * c.itemsMult));
    }
  }

  let coins = 0, xp = 0, served = 0, spawned = 0, lost = 0, perfect = 0, burned = 0, cooked = 0;
  let stars = 0, failedTurns = 0, peakOrders = 0, totalBlasts = 0;

  for (let t = 0; t < TURNS; t++) {
    const seed = 4242 + t * 977;
    const sim = new TurnSimulation(db, {
      restaurantIndex,
      levelId: `probe.${c.id}`,
      upgradeLevels: {},
      seed,
      churrasqueiraId: grillId ?? undefined,
      churrasqueiraLevel: grillId ? grillLevel : undefined,
      overrides: c.overrides as Omit<Ov, never> | undefined
    });
    const policy = new SkillPolicy(new Rng(seed + restaurantIndex * 104729), { skill: SKILL, reactionSec: REACTION });

    const zones = sim.grill.zones as any[];
    const baseHeat = zones.map((z) => z.heat as number);
    let blasts = 0;
    let fired: Set<number> | null = null;
    const blast = zones.map(() => 0);
    const cool = zones.map(() => 0);

    let guard = 0;
    while (!sim.finished && guard++ < 40000) {
      if (c.tool) {
        const want = rowsToBlow(sim, c.tool.mode, c.tool.trigger ?? 0.96);
        fired = want;
        for (let zi = 0; zi < zones.length; zi++) {
          if (blast[zi]! > 0) blast[zi] = blast[zi]! - STEP;
          else if (cool[zi]! > 0) cool[zi] = cool[zi]! - STEP;
          else if (want.has(zi)) {
            blast[zi] = c.tool.durSec;
            cool[zi] = c.tool.durSec + c.tool.cooldownSec;
          }
          zones[zi]!.heat = baseHeat[zi]! * (blast[zi]! > 0 ? 1 + c.tool.boost : 1);
        }
        if (fired) for (const zi of fired) if (blast[zi]! === c.tool.durSec) blasts++;
      }
      sim.tick(STEP, (a: any) => policy.act(a));
    }
    const r = sim.result();
    coins += r.coins; xp += r.xp; stars += r.stars;
    served += r.counters.customersServed; spawned += r.counters.customersSpawned;
    lost += r.counters.customersLost; perfect += r.counters.perfectCooks;
    burned += r.counters.burnedFood; cooked += r.counters.itemsCooked;
    peakOrders = Math.max(peakOrders, r.counters.peakSimultaneousOrders);
    totalBlasts += blasts;
    if (r.failed) failedTurns++;
  }

  for (const [id, pair] of saved) {
    const def = db.customerById.get(id);
    if (!def) continue;
    def.itemsMin = pair[0];
    def.itemsMax = pair[1];
  }

  // perf% = pratos perfeitos sobre pratos servidos; queim% = queimados sobre pratos tocados
  // (na grelha um prato queima sem ser servido, então o denominador não pode ser o mesmo).
  const servedPlates = Math.max(1, cooked);
  const handled = Math.max(1, cooked + burned);
  return {
    coins: Math.round(coins / TURNS), xp: Math.round(xp / TURNS),
    perfectPct: Math.round((100 * perfect) / servedPlates),
    burnedPct: Math.round((100 * burned) / handled),
    lostPct: spawned > 0 ? Math.round((100 * lost) / spawned) : 0,
    servedPerTurn: +(served / TURNS).toFixed(1),
    spawnedPerTurn: +(spawned / TURNS).toFixed(1),
    cookedPerTurn: +(cooked / TURNS).toFixed(1),
    peakOrders, stars: +(stars / TURNS).toFixed(2), failedTurns, blastsPerTurn: +(totalBlasts / TURNS).toFixed(1)
  };
}

const { db } = loadAndValidate();

const cases: Case[] = [
  { id: 'baseline', note: 'turno normal, sem nada' },
  { id: 'comanda_fila', note: 'chegada 2× (spawnInterval ÷ 2)', overrides: { spawnIntervalSec: 3.75 } },
  {
    id: 'comanda_fila+2vagas', note: 'chegada 2× e +2 pedidos esperando',
    overrides: { spawnIntervalSec: 3.75, maxOrdersOnScreen: 6 }
  },
  {
    id: 'comanda_cheia', note: 'chegada 2×, +2 vagas e pedido em dobro',
    overrides: { spawnIntervalSec: 3.75, maxOrdersOnScreen: 6 }, itemsMult: 2
  },
  { id: 'comanda_prato2x', note: 'só o prato em dobro (chegada normal)', itemsMult: 2 },
  {
    id: 'soprador_tudo', note: 'soprador em toda fileira ocupada (+35 %, 3 s, freio 6 s)',
    tool: { boost: 0.35, durSec: 3, cooldownSec: 6, mode: 'all' }
  },
  {
    id: 'soprador_atrasado', note: 'soprador no prato mais atrasado (+35 %, 3 s, freio 6 s)',
    tool: { boost: 0.35, durSec: 3, cooldownSec: 6, mode: 'laggard' }
  },
  {
    id: 'agua_resgate', note: 'garrafa nas fileiras passando do ponto (−35 %, 3 s, 6 s)',
    tool: { boost: -0.35, durSec: 3, cooldownSec: 6, mode: 'rescue' }
  },
  {
    id: 'agua_cedo', note: 'garrafa assim que encosta no topo da janela (0,80×)',
    tool: { boost: -0.35, durSec: 3, cooldownSec: 6, mode: 'rescue', trigger: 0.8 }
  },
  {
    id: 'soprador_sem_freio', note: 'soprador forte e quase sem freio (+70 %, 6 s, 2 s)',
    tool: { boost: 0.7, durSec: 6, cooldownSec: 2, mode: 'all' }
  }
];

const boards: [string, number, string, number][] = [
  ['L1 · lata_valente e1 (1 zona × 2)', 0, 'lata_valente', 1],
  ['L8 · ze_da_esquina e2', 2, 'ze_da_esquina', 2],
  ['L24 · parrilla_chef_cisma e2', 3, 'parrilla_chef_cisma', 2],
  ['L46 · cozinha_do_campeao e3 (topo)', 9, 'cozinha_do_campeao', 3]
];

for (const [label, rest, grill, lvl] of boards) {
  console.log(`\n──── ${label} ────  skill ${SKILL}, ${TURNS} turnos, seed 4242+t·977`);
  console.log('caso                    moeda/turno    perf%  queim%  perdeu%  serv/t  ★     turnos-perdidos');
  for (const c of cases) {
    const r = play(db, rest, grill, lvl, c);
    const line = c.id.padEnd(23) + String(r.coins).padStart(9) + String(r.perfectPct).padStart(8) +
      String(r.burnedPct).padStart(8) + String(r.lostPct).padStart(9) +
      String(r.servedPerTurn).padStart(8) + String(r.stars).padStart(7) + String(r.failedTurns).padStart(9) + (c.tool ? String(r.blastsPerTurn).padStart(8) + ' sopros/t' : '');
    console.log(line + '   ← ' + c.note);
  }
}

console.log('\n──── o que vale 1 s de soprador (motor no calor real da fileira, prato ideal) ────');
console.log('grelha                        zona  calor   taxa   janela  +35%·1s  = % da janela');
for (const [gid, glvl] of [['lata_valente', 1], ['ze_da_esquina', 2], ['parrilla_chef_cisma', 2], ['cozinha_do_campeao', 3]] as [string, number][]) {
  const sim = new TurnSimulation(db, {
    restaurantIndex: 3, levelId: 'probe', upgradeLevels: {}, seed: 1,
    churrasqueiraId: gid, churrasqueiraLevel: glvl
  });
  const ing = db.ingredientById.get('espetinho_misto') ?? db.ingredients.items[0]!;
  const win = (ing.perfectWindow as [number, number])[1] - (ing.perfectWindow as [number, number])[0];
  for (let zi = 0; zi < (sim.grill.zones as any[]).length; zi++) {
    const heat = effectiveHeat(sim.grill, zi, db);
    const rate = (heat * ing.heatRate * sim.stats.heatRampRate) / ing.sideCookSec;
    const gain = rate * 0.35;
    console.log(
      `${gid} e${glvl}`.padEnd(27) + String(zi + 1).padStart(4) + String(heat.toFixed(2)).padStart(9) +
      (100 * rate).toFixed(1).padStart(8) + '%/s' + (win / rate).toFixed(1).padStart(9) + 's' +
      (100 * gain).toFixed(1).padStart(9) + '%' + String(Math.round((100 * gain) / win)).padStart(13) + '%'
    );
  }
}
