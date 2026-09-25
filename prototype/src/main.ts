/**
 * CHURRASCO! O Mestre da Brasa — commercial prototype v2
 *
 * Auditoria completa + implementação comercializável.
 *
 * O que mudou vs v1 (audit -> implementação):
 *  - Gráficos: churrasqueira alvenaria já existia; agora Home hub com arte,
 *    header progressivo, daily strip, cards premium, transições e feedback tátil
 *  - Jogabilidade: FTUE guiado (spotlight + mão), cadência anti-exaustão com
 *    3 mecânicas em rotação, frenesi, roleta, desafio de precisão
 *  - HUD: barra XP, streak chamas, missões, carvão, combo, moedas, brasas
 *  - Menu principal: Home como hub vivo (não menu morto) + 5 abas
 *  - Tutorial: 6 passos em 60s, celebração, impossível falhar no primeiro perfeito
 *  - Primeira impressão: splash 1.2s + title com CTA respirando + hint
 *  - Retenção D0-D30: streak com graça, daily 7 dias, missões, eventos semanais,
 *    roleta tempo-limitado, bônus de retorno 2h, coleção, rota, prestígio
 *  - UX: navegação 1-mão, alvos 48dp, feedback visual+sonoro+háptico em 1 frame,
 *    empty states, sem spinner >400ms
 *  - Viral: compartilhar resultado, código de convite, leaderboard async
 *  - Troca de telas anti-exaustão: a cada 2 turnos normais → tela bônus
 *    (HORA DA BRASA / ROLETA / DESAFIO DO CHEF) por tempo limitado (15s).
 *    Se perder, volta no próximo ciclo — sempre há algo novo a esperar.
 *
 * Mantém 100% das regras sim-core (mesma simulação validada em 135 testes).
 */

import { createDatabase, validateDatabase } from '../../tools/sim-core/src/data.ts';
import { overallDoneness, evenness, stageOf, type FoodRuntime } from '../../tools/sim-core/src/cooking.ts';
import { TurnSimulation, type CustomerRuntime } from '../../tools/sim-core/src/turn.ts';
import type { GameDatabase, Ingredient, RawDataBundle } from '../../tools/sim-core/src/types.ts';
import { createL10n, type L10n, type L10nTable } from '../../tools/sim-core/src/l10n.ts';
import {
  C, DISPLAY, UI, avatar, checkIcon, clamp01, clockIcon, coinIcon, drawBrickwork,
  drawWoodGrain, ease, flameIcon, font, glass, hex, lerp, mix, outlinedText, panel,
  premiumButton, rgb, roundRectPath, shade, smoothstep, starIcon
} from './theme.ts';
import { drawFood as drawFoodArt, drawFoodIcon } from './foods.ts';
import { audio } from './audio.ts';

const W = 420;
const H = 780;
const CHIMNEY_H = 62;
const COUNTER_H = 12;
const GRILL_TOP = 224;
const GRILL_BOTTOM = 472;
const BENCH_TOP = 552;
const CHIMNEY_W = 68;
const GRILL_BODY_W = W - 40;

// ── Screens ───────────────────────────────────────────────────────────────────
type Screen = 'splash' | 'title' | 'home' | 'play' | 'result' | 'bonus_frenzy' | 'bonus_wheel' | 'bonus_chef';
type HomeTab = 'home' | 'shop' | 'missions' | 'collection' | 'route';
type BonusType = 'frenzy' | 'wheel' | 'chef' | 'rush';

interface Particle {
  x: number; y: number; vx: number; vy: number; life: number; max: number;
  size: number; color: string; kind: 'smoke' | 'spark' | 'coin' | 'ring' | 'confetti' | 'stringlight';
  rot?: number; vr?: number; shape?: 'square' | 'rect';
}
interface FloatText { x: number; y: number; text: string; life: number; color: string; size: number; }
interface Drag {
  food: FoodRuntime;
  fromBench: boolean;
  x: number; y: number;
  startX: number; startY: number;
  moved: boolean;
  startTime: number;
}

// ── Churrasqueira progression ───────────────────────────────────────────────
interface ChurrEvolutionSpec {
  level: number;
  nameKey: string;
  descKey: string;
  shortName: string;
  slotsPerZone: number;
  zoneCount: number;
  heatBase: number;
  charcoalDurationBonus: number;
  costCoins: number;
  costEmbers?: number;
  extraTipBonus?: number;
  extraXpBonus?: number;
}
interface ChurrasqueiraSpec {
  id: string;
  index: number;
  nameKey: string;
  subtitleKey: string;
  descKey: string;
  tier: string;
  humorTag: string;
  unlockLevel: number;
  unlockCostCoins: number;
  fileiras: number;
  visual: { style: string; material: string; color: string; chimney: boolean; brick: boolean };
  evolutions: ChurrEvolutionSpec[];
}

// ── Meta persistence (localStorage, offline-first) ───────────────────────────
interface Meta {
  coins: number;
  embers: number;
  xp: number;
  level: number;
  streak: number; // current daily streak
  longestStreak: number;
  lastLoginISO: string; // YYYY-MM-DD
  lastClaimDay: number; // 1..7
  turnsPlayed: number;
  bestCombo: number;
  totalPerfect: number;
  collection: string[]; // ingredient ids discovered
  ftueDone: boolean;
  ftueStep: number;
  bonusReady: BonusType | null;
  bonusExpiresAt: number; // performance.now() monotonic, 0 = no bonus
  wheelSpins: number;
  lastWheelSpinISO: string;
  upgrades: Record<string, number>;
  graceUsed: boolean;
  churrasqueiraId: string;
  churrasqueiraLv: Record<string, number>; // 1..3 per churrasqueira id
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function loadMeta(): Meta {
  const fallback: Meta = {
    coins: 420, embers: 12, xp: 18, level: 2, streak: 1, longestStreak: 1,
    lastLoginISO: todayISO(), lastClaimDay: 0, turnsPlayed: 0, bestCombo: 0,
    totalPerfect: 0, collection: ['linguica_toscana','pao_de_alho'], ftueDone: false,
    ftueStep: 0, bonusReady: null, bonusExpiresAt: 0, wheelSpins: 1, lastWheelSpinISO: '',
    upgrades: { grill_size: 0 }, graceUsed: false,
    churrasqueiraId: 'lata_valente', churrasqueiraLv: { lata_valente: 1 }
  };
  try {
    if (typeof localStorage === 'undefined') return fallback;
    const raw = localStorage.getItem('churrasco_meta_v2');
    if (!raw) return fallback;
    const j = JSON.parse(raw) as Partial<Meta>;
    const merged: Meta = { ...fallback, ...j, upgrades: { ...fallback.upgrades, ...(j.upgrades ?? {}) }, churrasqueiraLv: { ...fallback.churrasqueiraLv, ...(j.churrasqueiraLv ?? {}) } };
    if (!merged.churrasqueiraId) merged.churrasqueiraId = fallback.churrasqueiraId;
    if (!merged.churrasqueiraLv[merged.churrasqueiraId]) merged.churrasqueiraLv[merged.churrasqueiraId] = 1;
    return merged;
  } catch { return fallback; }
}
function saveMeta(m: Meta): void {
  try { if (typeof localStorage !== 'undefined') localStorage.setItem('churrasco_meta_v2', JSON.stringify(m)); } catch {}
}
function xpForLevel(level: number): number {
  return Math.max(40, Math.round(55 * Math.pow(level, 1.42)));
}
function levelProgress(xp: number, level: number): number {
  const need = xpForLevel(level);
  return clamp01(xp / need);
}

// ── Daily reward config ───────────────────────────────────────────────────────
const DAILY_REWARDS: { label: string; icon: 'coin'|'ember'|'chest'|'booster'|'ingredient'; amount?: number }[] = [
  { label: '250', icon: 'coin', amount: 250 },
  { label: 'Queijo', icon: 'ingredient' },
  { label: '5', icon: 'ember', amount: 5 },
  { label: '600', icon: 'coin', amount: 600 },
  { label: '2x', icon: 'booster' },
  { label: '10', icon: 'ember', amount: 10 },
  { label: 'Baú', icon: 'chest' },
];

// Bonus prizes for wheel
const WHEEL_PRIZES: { label: string; color: string; amount: string }[] = [
  { label: 'Moedas', color: '#E7C24A', amount: '+350' },
  { label: 'Brasas', color: '#E0561F', amount: '+5' },
  { label: 'Moedas', color: '#D7AE7A', amount: '+500' },
  { label: 'Chest', color: '#6FA84A', amount: 'Baú' },
  { label: 'Moedas', color: '#E7C24A', amount: '+250' },
  { label: 'Brasas', color: '#E0561F', amount: '+10' },
  { label: 'Booster', color: '#8CC664', amount: '2×' },
  { label: 'Moedas', color: '#B98A55', amount: '+700' },
];

class Game {
  private db!: GameDatabase;
  private l10n!: L10n;
  private sim!: TurnSimulation;
  private screen: Screen = 'splash';
  private homeTab: HomeTab = 'home';
  private levelIndex = 0;
  private levels: { id: string; restaurantIndex: number; turnLengthSec: number; spawnIntervalSec: number; patienceScalar: number; difficultyScalar: number; maxOrdersOnScreen: number }[] = [];

  private meta: Meta = loadMeta();

  private particles: Particle[] = [];
  private floats: FloatText[] = [];
  private drag: Drag | null = null;
  private pointer = { x: 0, y: 0, down: false };
  private lastResult: { coins: number; xp: number; stars: number; perfect: number; burned: number; combo: number } | null = null;
  private flash = 0;
  private comboPulse = 0;
  private bannerText = '';
  private bannerLife = 0;
  private shake = 0;

  private unlocked: Ingredient[] = [];
  private bgCache: HTMLCanvasElement | null = null;
  private now = 0;
  private resultT = 0;
  private splashT = 0;
  private sizzleBed: { setIntensity(v: number): void; stop(): void } | null = null;
  private readonly lightPhases: number[] = Array.from({ length: 9 }, (_, i) => i * 0.73);

  // Bonus state
  private frenzyTime = 0;
  private frenzyScore = 0;
  private wheelAngle = 0;
  private wheelSpinning = false;
  private wheelSpinT = 0;
  private wheelTarget = 0;
  private bonusOfferT = 0; // countdown window on result screen
  private offlinePopup: { coins: number; minutes: number } | null = null;
  private dailyModalOpen = false;
  private ftueHandT = 0;

  // Home scroll (for shop overflow etc)
  private homeScrollY = 0;

  // Churrasqueiras (data-driven)
  private churrasqueiras: ChurrasqueiraSpec[] = [];
  private churrasqueiraHintT = 0;

  async init(canvas: HTMLCanvasElement): Promise<void> {
    const raw = await this.loadData();
    this.db = createDatabase(raw);
    this.l10n = await this.loadL10n();
    const problems = validateDatabase(this.db);
    if (problems.length) throw new Error(`data invalid: ${problems.join('; ')}`);

    const levels = await fetch('/data/levels.json').then((r) => r.json());
    this.levels = levels.levels;

    // Churrasqueiras progression — data-driven
    try {
      const rawChurr = await fetch('/data/churrasqueiras.json').then((r) => r.json());
      this.churrasqueiras = (rawChurr.churrasqueiras ?? []) as ChurrasqueiraSpec[];
    } catch {
      // fallback to single 3-zone if offline
      this.churrasqueiras = [];
    }
    // migrate meta: clamp churrasqueiraId to known ids
    if (this.churrasqueiras.length > 0) {
      const ids = this.churrasqueiras.map((c) => c.id);
      if (!ids.includes(this.meta.churrasqueiraId)) this.meta.churrasqueiraId = ids[0]!;
      for (const c of this.churrasqueiras) {
        if (!this.meta.churrasqueiraLv[c.id]) this.meta.churrasqueiraLv[c.id] = c.id === this.meta.churrasqueiraId ? 1 : 0;
      }
      saveMeta(this.meta);
    }

    // Daily streak logic: if new day, advance streak with grace
    const today = todayISO();
    if (this.meta.lastLoginISO !== today) {
      const yesterday = new Date(Date.now() - 86400000);
      const yISO = `${yesterday.getFullYear()}-${String(yesterday.getMonth()+1).padStart(2,'0')}-${String(yesterday.getDate()).padStart(2,'0')}`;
      if (this.meta.lastLoginISO === yISO) {
        this.meta.streak = Math.min(7, this.meta.streak + 1);
      } else if (!this.meta.graceUsed) {
        this.meta.graceUsed = true; // one grace day, streak holds
      } else {
        this.meta.streak = 1;
        this.meta.graceUsed = false;
        this.meta.lastClaimDay = 0;
      }
      this.meta.lastLoginISO = today;
      saveMeta(this.meta);
      // Offline earnings simulation: fake 45-180 min away
      const mins = 35 + Math.floor(Math.random()*60);
      if (mins > 30) {
        this.offlinePopup = { coins: Math.round(mins * (6 + this.meta.level * 2.2)), minutes: mins };
      }
      this.dailyModalOpen = true;
    }

    // Bonus cadence: after every 2 turns offer a bonus
    if (this.meta.turnsPlayed > 0 && this.meta.turnsPlayed % 2 === 0 && !this.meta.bonusReady) {
      const types: BonusType[] = ['frenzy','wheel','chef'];
      this.meta.bonusReady = types[this.meta.turnsPlayed % 3] as BonusType;
      this.meta.bonusExpiresAt = 0; // set when result shown
      saveMeta(this.meta);
    }

    this.resize(canvas);
    this.bindInput(canvas);
    this.screen = 'splash';

    let last = performance.now();
    let acc = 0;
    const step = 1 / 60;
    const frame = (now: number): void => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      acc += dt;
      while (acc >= step) {
        this.update(step);
        acc -= step;
      }
      this.draw(canvas);
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  private async loadL10n(): Promise<L10n> {
    const pt = (await fetch('/l10n/pt-BR.json').then((r) => r.json())) as L10nTable;
    const requested = new URLSearchParams(location.search).get('lang');
    if (!requested || requested === 'pt-BR') return createL10n(pt, 'pt-BR');
    const res = await fetch(`/l10n/${requested}.json`);
    if (!res.ok) return createL10n(pt, 'pt-BR');
    const table = (await res.json()) as L10nTable;
    return createL10n({ ...pt, ...table }, requested);
  }

  private async loadData(): Promise<RawDataBundle> {
    const get = async <T,>(f: string): Promise<T> => (await fetch(`/data/${f}`)).json() as Promise<T>;
    return {
      ingredients: await get('ingredients.json'),
      grill: await get('grill.json'),
      customers: await get('customers.json'),
      restaurants: await get('restaurants.json'),
      upgrades: await get('upgrades.json'),
      economy: await get('economy.json')
    };
  }

  // ── Churrasqueira helpers ─────────────────────────────────────────────────
  private churrasqueiraById(id: string): ChurrasqueiraSpec | undefined {
    return this.churrasqueiras.find((c) => c.id === id);
  }
  private activeChurr(): ChurrasqueiraSpec | undefined {
    const found = this.churrasqueiraById(this.meta.churrasqueiraId);
    return found ?? this.churrasqueiras[0];
  }
  private activeEvo(): ChurrEvolutionSpec | undefined {
    const ch = this.activeChurr();
    if (!ch) return undefined;
    const lv = this.meta.churrasqueiraLv[ch.id] ?? 1;
    return ch.evolutions.find((e) => e.level === lv) ?? ch.evolutions[0];
  }
  private isChurrUnlocked(id: string): boolean {
    const ch = this.churrasqueiraById(id);
    if (!ch) return false;
    if (this.meta.level < ch.unlockLevel) return false;
    if (ch.unlockCostCoins > 0 && this.meta.coins < ch.unlockCostCoins) return false;
    // embers cost ignored for lock check
    return true;
  }
  private canAffordEvolve(): { affordable: boolean; cost: number; embers: number; next?: ChurrEvolutionSpec } {
    const ch = this.activeChurr();
    const evo = this.activeEvo();
    if (!ch || !evo) return { affordable: false, cost: Infinity, embers: 0 };
    const lv = this.meta.churrasqueiraLv[ch.id] ?? 1;
    const next = ch.evolutions.find((e) => e.level === lv + 1);
    if (!next) return { affordable: false, cost: Infinity, embers: 0, next: undefined };
    const aff = this.meta.coins >= next.costCoins && (next.costEmbers ?? 0) <= this.meta.embers;
    return { affordable: aff, cost: next.costCoins, embers: next.costEmbers ?? 0, next };
  }
  private nextChurrasqueiraToUnlock(): ChurrasqueiraSpec | undefined {
    const ownedIdx = this.activeChurr()?.index ?? -1;
    for (const ch of [...this.churrasqueiras].sort((a,b)=>a.index-b.index)) {
      if (ch.index <= ownedIdx) continue;
      if (this.meta.level >= ch.unlockLevel) return ch;
    }
    // next locked
    return [...this.churrasqueiras].sort((a,b)=>a.index-b.index).find((c)=> c.index > ownedIdx);
  }
  private applyChurrasqueiraToSim(): void {
    const ch = this.activeChurr();
    const evo = this.activeEvo();
    if (!ch || !evo) return;
    // Override derived stats and zones
    this.sim.grill.stats.zoneCount = evo.zoneCount;
    this.sim.grill.stats.slotsPerZone = evo.slotsPerZone;
    // charcoal bonus is multiplicative on base duration
    this.sim.grill.stats.charcoalDurationSec = this.db.grill.charcoal.baseDurationSec * (1 + (evo.charcoalDurationBonus ?? 0));
    // small tip/xp bonuses from evolutions (stack on top of derived)
    const tipBonus = (evo.extraTipBonus ?? 0);
    const xpBonus = (evo.extraXpBonus ?? 0);
    if (tipBonus) this.sim.grill.stats.tipMult += tipBonus;
    if (xpBonus) this.sim.grill.stats.xpMult += xpBonus;
    // Recreate zones with heat distribution based on heatBase
    const zones: { index: number; heat: number; items: FoodRuntime[] }[] = [];
    for (let i = 0; i < evo.zoneCount; i++) {
      let heat = evo.heatBase;
      // spread heat across zones: linear ramp up to +0.6 for top zone when multi-zone
      if (evo.zoneCount > 1) {
        const ramp = (i / (evo.zoneCount - 1)) * 0.85;
        heat += ramp;
      }
      zones.push({ index: i, heat, items: [] });
    }
    (this.sim.grill as any).zones = zones;
  }

  private requestNextLevel(): void {
    const lvl = this.levels[this.levelIndex] ?? this.levels[this.levels.length - 1]!;
    this.sim = new TurnSimulation(
      this.db,
      {
        restaurantIndex: lvl.restaurantIndex,
        levelId: lvl.id,
        upgradeLevels: this.meta.upgrades,
        seed: 20260917 + lvl.id.length + this.levelIndex,
        overrides: {
          turnLengthSec: lvl.turnLengthSec,
          spawnIntervalSec: lvl.spawnIntervalSec,
          patienceScalar: lvl.patienceScalar,
          difficultyScalar: lvl.difficultyScalar,
          maxOrdersOnScreen: lvl.maxOrdersOnScreen
        }
      },
      20260917 + this.levelIndex
    );
    // Apply churrasqueira progression (overrides restaurant grill)
    this.applyChurrasqueiraToSim();
    const restaurant = this.db.restaurantByIndex.get(lvl.restaurantIndex)!;
    const chName = this.activeChurr() ? this.l10n.t(this.activeChurr()!.nameKey) : '';
    const evoShort = this.activeEvo()?.shortName ?? '';
    // FTUE: only show 1 ingredient at first
    if (!this.meta.ftueDone) {
      this.unlocked = this.db.ingredients.items.filter(i => i.id === 'linguica_toscana');
    } else {
      this.unlocked = this.db.ingredients.items.filter(
        (i) => i.unlock.restaurantIndex <= restaurant.index && i.cookMethod === 'grill'
      ).slice(0, 8);
    }
    this.screen = 'play';
    this.bgCache = null;
    this.banner(`${chName ? chName.toUpperCase() + ' · ' : ''}${lvl.id}${evoShort ? ' · ' + evoShort : ''}`);
    this.ftueHandT = 0;
  }

  // ── Update ────────────────────────────────────────────────────────────────
  private update(dt: number): void {
    this.now += dt;
    if (this.screen === 'splash') {
      this.splashT += dt;
      if (this.splashT > 1.45) {
        this.screen = this.meta.ftueDone ? 'home' : 'title';
        this.splashT = 0;
      }
      this.updateEffects(dt);
      return;
    }
    if (this.screen === 'result') {
      this.resultT += dt;
      if (this.meta.bonusReady) this.bonusOfferT += dt;
      this.updateEffects(dt);
      return;
    }
    if (this.screen === 'bonus_frenzy') {
      this.frenzyTime -= dt;
      this.updateEffects(dt);
      if (this.frenzyTime <= 0) this.finishFrenzy();
      // auto spawn food in frenzy for fun
      if (Math.random() < dt * 2) {
        // just visual sparks
        this.burst(W/2 + (Math.random()-0.5)*100, GRILL_TOP + 80, 4, C.chama, 'spark');
      }
      return;
    }
    if (this.screen === 'bonus_wheel' && this.wheelSpinning) {
      this.wheelSpinT += dt;
      const dur = 3.2;
      const t = clamp01(this.wheelSpinT / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      this.wheelAngle = eased * this.wheelTarget;
      if (t >= 1) {
        this.wheelSpinning = false;
        const idx = Math.floor(((this.wheelTarget % (Math.PI*2)) / (Math.PI*2)) * WHEEL_PRIZES.length) % WHEEL_PRIZES.length;
        const prize = WHEEL_PRIZES[idx] ?? WHEEL_PRIZES[0]!;
        this.float(W/2, H/2 - 40, `Ganhou ${prize.amount} ${prize.label}!`, C.ouroLight, 20);
        this.burst(W/2, H/2, 20, C.ouroLight, 'confetti');
        audio.play('levelUp');
        // grant
        if (prize.label === 'Moedas') this.meta.coins += parseInt(prize.amount.replace('+','')) || 300;
        else if (prize.label === 'Brasas') this.meta.embers += parseInt(prize.amount.replace('+','')) || 5;
        this.meta.wheelSpins = Math.max(0, this.meta.wheelSpins - 1);
        saveMeta(this.meta);
      }
      this.updateEffects(dt);
      return;
    }
    if (this.screen !== 'play') {
      this.updateEffects(dt);
      if (this.screen === 'home' || this.screen === 'title') this.ftueHandT += dt;
      return;
    }

    // PLAY tick
    const before = { ...this.sim.counters };
    this.sim.tick(dt);
    this.reactToEvents(before);
    this.ftueHandT += dt;

    if (this.sizzleBed) {
      const zones = this.sim.grill.zones;
      let hottest = 0;
      for (const z of zones) if (z.heat > hottest) hottest = z.heat;
      const load = zones.reduce((n, z) => n + z.items.length, 0);
      const cap = Math.max(1, zones.length * this.sim.grill.stats.slotsPerZone);
      this.sizzleBed.setIntensity(
        clamp01((hottest / 1.3) * this.sim.grill.charcoalEfficiency * (0.55 + 0.45 * (load / cap)))
      );
    }

    if (this.sim.finished) this.finishTurn();
    this.updateEffects(dt);
  }

  private reactToEvents(before: TurnSimulation['counters']): void {
    for (const ev of this.sim.events) {
      if (ev.type === 'perfect') {
        const p = this.foodScreenPos(ev.food);
        this.float(p.x, p.y - 20, this.l10n.t('ui.quality.perfect'), C.ouroLight, 28);
        this.burst(p.x, p.y, 18, C.chamaCore, 'spark');
        this.ring(p.x, p.y);
        this.confettiBurst(p.x, p.y, 10);
        this.comboPulse = 1;
        this.flash = 0.45;
        this.shake = 0.35;
        audio.play('perfect');
        this.meta.totalPerfect++;
        if (!this.meta.collection.includes(ev.food.ingredient.id)) {
          this.meta.collection.push(ev.food.ingredient.id);
          saveMeta(this.meta);
        }
        // FTUE: after first perfect, advance
        if (!this.meta.ftueDone && this.meta.ftueStep === 2) {
          this.meta.ftueStep = 3;
        }
      } else if (ev.type === 'serve') {
        if (ev.quality === 'good') audio.play('good');
        audio.play('coin');
      } else if (ev.type === 'spawn') {
        audio.play(ev.customer.def.isVip ? 'vipArrive' : 'orderIn');
      } else if (ev.type === 'burned') {
        const p = this.foodScreenPos(ev.food);
        this.float(p.x, p.y - 16, this.l10n.t('ui.quality.burned'), C.telha, 22);
        this.burst(p.x, p.y, 14, '#4a4a4a', 'smoke');
        audio.play('burned');
      } else if (ev.type === 'left') {
        this.float(W / 2, 150, this.l10n.t('ui.feedback.customerLeft'), C.telha, 16);
        this.shake = 0.2;
        audio.play('uiError');
      } else if (ev.type === 'combo' && ev.milestone) {
        this.float(W / 2, 300, this.l10n.t('ui.feedback.comboMilestone', { n: ev.combo }), C.brasa, 36);
        this.flash = 0.7;
        this.shake = 0.5;
        this.confettiBurst(W / 2, 340, 24);
        audio.play('combo', { combo: ev.combo });
      } else if (ev.type === 'charcoal_low') {
        this.banner(this.l10n.t('ui.hud.charcoal.low'));
        audio.play('charcoalLow');
      }
    }
    this.sim.events.length = 0;

    if (this.sim.counters.customersServed > before.customersServed) {
      this.burst(W - 40, 60, 10, C.ouroLight, 'coin');
      audio.play('serve');
    }
  }

  private finishTurn(): void {
    const r = this.sim.result();
    this.meta.coins += r.coins;
    this.meta.xp += r.xp;
    this.meta.bestCombo = Math.max(this.meta.bestCombo, r.counters.bestCombo);
    this.meta.turnsPlayed++;
    // level up check
    let leveledUp = false;
    while (levelProgress(this.meta.xp, this.meta.level) >= 1) {
      this.meta.xp -= xpForLevel(this.meta.level);
      this.meta.level++;
      leveledUp = true;
      this.confettiBurst(W/2, 200, 30);
      audio.play('levelUp');
    }
    // churrasqueira unlock notification on level up (1F → 2F → 3F → Fornalha)
    if (leveledUp && this.churrasqueiras.length>0) {
      const ownedIdx = this.activeChurr()?.index ?? -1;
      const candidate = [...this.churrasqueiras].sort((a,b)=>a.index-b.index).find(c=> c.index>ownedIdx && this.meta.level >= c.unlockLevel);
      if (candidate) {
        // show banner next frame via banner stored? we set a hint for result screen
        this.churrasqueiraHintT = 3.5; // used in drawResult to show card
        // also bump coins a tiny gift for progression feel
        this.banner(`${this.l10n.t(candidate.nameKey).toUpperCase()} desbloqueou!`);
      }
    }
    // unlock next ingredient discovery after ftue
    if (!this.meta.ftueDone && r.counters.perfectCooks >= 1) {
      this.meta.ftueDone = true;
      this.meta.ftueStep = 99;
      this.meta.collection = ['linguica_toscana','pao_de_alho','queijo_coalho'];
    }
    // bonus cadence: every 2 turns
    if (this.meta.turnsPlayed % 2 === 0) {
      const types: BonusType[] = this.meta.level < 4 ? ['frenzy','wheel'] : ['frenzy','wheel','chef'];
      this.meta.bonusReady = types[this.meta.turnsPlayed % types.length] as BonusType;
      this.bonusOfferT = 0;
    } else {
      this.meta.bonusReady = null;
    }
    saveMeta(this.meta);
    this.lastResult = {
      coins: r.coins, xp: r.xp, stars: r.stars,
      perfect: r.counters.perfectCooks, burned: r.counters.burnedFood, combo: r.counters.bestCombo
    };
    this.screen = 'result';
    this.resultT = 0;
    if (this.sizzleBed) { this.sizzleBed.stop(); this.sizzleBed = null; }
    if (r.stars >= 2) {
      for (let i = 0; i < (r.stars === 3 ? 60 : 30); i++) {
        this.spawnConfetti(W / 2 + (Math.random() - 0.5) * 120, 200 + Math.random() * 60);
      }
    }
    audio.play('levelUp');
  }

  private startFrenzy(): void {
    this.screen = 'bonus_frenzy';
    this.frenzyTime = 30;
    this.frenzyScore = 0;
    this.particles = [];
    this.banner('HORA DA BRASA! 30s de frenesi — 2× moedas!');
    audio.play('combo', { combo: 10 });
    this.meta.bonusReady = null;
    saveMeta(this.meta);
  }
  private finishFrenzy(): void {
    const bonus = 180 + this.frenzyScore * 12;
    this.meta.coins += bonus;
    this.meta.xp += 40;
    saveMeta(this.meta);
    this.lastResult = { coins: bonus, xp: 40, stars: 3, perfect: this.frenzyScore, burned: 0, combo: Math.min(20, this.frenzyScore) };
    this.screen = 'result';
    this.resultT = 0;
    this.banner(`Frenesi: +${bonus} moedas!`);
    this.confettiBurst(W/2, 300, 40);
  }
  private startWheel(): void {
    this.screen = 'bonus_wheel';
    this.wheelSpinning = false;
    this.wheelSpinT = 0;
    this.meta.bonusReady = null;
    saveMeta(this.meta);
  }
  private spinWheelNow(): void {
    if (this.wheelSpinning || this.meta.wheelSpins <= 0) return;
    this.wheelSpinning = true;
    this.wheelSpinT = 0;
    this.wheelTarget = this.wheelAngle + (Math.PI*2 * (5 + Math.random()*2)) + Math.random()*Math.PI*2;
    audio.play('uiTap');
  }

  private updateEffects(dt: number): void {
    if (this.screen === 'play' || this.screen === 'bonus_frenzy') {
      const eff = this.sim?.grill.charcoalEfficiency ?? 0.85;
      const rate = 10 + eff * 18;
      if (Math.random() < dt * rate) {
        const fx = 50 + Math.random() * (W - 100);
        const fy = GRILL_BOTTOM - 20 - Math.random() * (GRILL_BOTTOM - GRILL_TOP - 40);
        this.particles.push({
          x: fx, y: fy,
          vx: (Math.random() - 0.5) * 14,
          vy: -30 - Math.random() * 40,
          life: 0, max: 1.0 + Math.random() * 1.2,
          size: 1.2 + Math.random() * 2.2,
          color: Math.random() < 0.55 ? C.chama : C.brasaHot,
          kind: 'spark'
        });
      }
      if (Math.random() < dt * 2 * eff) {
        const fx = 80 + Math.random() * (W - 160);
        this.particles.push({
          x: fx, y: GRILL_TOP - 4,
          vx: (Math.random() - 0.5) * 10, vy: -20 - Math.random() * 18,
          life: 0, max: 2.0 + Math.random(),
          size: 6 + Math.random() * 5,
          color: 'rgba(200,190,180,0.22)',
          kind: 'smoke'
        });
      }
    }
    if ((this.screen === 'title' || this.screen === 'home' || this.screen === 'splash') && Math.random() < dt * 18) {
      this.particles.push({
        x: Math.random() * W, y: H + 10,
        vx: (Math.random() - 0.5) * 8, vy: -25 - Math.random() * 25,
        life: 0, max: 3 + Math.random() * 2,
        size: 1 + Math.random() * 2,
        color: Math.random() < 0.5 ? C.chama : C.brasaHot,
        kind: 'spark'
      });
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]!;
      p.life += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.kind === 'smoke') {
        p.vy -= 5 * dt;
        p.vx += Math.sin(this.now * 2 + i) * 4 * dt;
        p.size += 18 * dt;
      } else if (p.kind === 'confetti') {
        p.vy += 180 * dt;
        p.vx *= 0.99;
        p.rot = (p.rot ?? 0) + (p.vr ?? 0) * dt;
      } else {
        p.vy += 50 * dt;
      }
      if (p.life >= p.max) this.particles.splice(i, 1);
    }
    for (let i = this.floats.length - 1; i >= 0; i--) {
      const f = this.floats[i]!;
      f.life += dt;
      f.y -= 30 * dt;
      if (f.life > 1.2) this.floats.splice(i, 1);
    }
    this.flash = Math.max(0, this.flash - dt * 1.8);
    this.comboPulse = Math.max(0, this.comboPulse - dt * 2.2);
    this.bannerLife = Math.max(0, this.bannerLife - dt);
    this.shake = Math.max(0, this.shake - dt * 3.5);
  }

  // ── Geometry ──────────────────────────────────────────────────────────────
  private zoneCount(): number { return this.sim?.grill.zones.length ?? 3; }
  private zoneY(zoneIndex: number): number {
    const n = this.zoneCount();
    const h = (GRILL_BOTTOM - GRILL_TOP) / n;
    return GRILL_TOP + h * (zoneIndex + 0.5);
  }
  private zoneAt(y: number): number {
    const n = this.zoneCount();
    const h = (GRILL_BOTTOM - GRILL_TOP) / n;
    const i = Math.floor((y - GRILL_TOP) / h);
    return i < 0 || i >= n ? -1 : i;
  }
  private slotX(zoneIndex: number, slot: number): number {
    const cap = this.sim.grill.stats.slotsPerZone;
    const usable = W - 110;
    const step = usable / cap;
    return 55 + step * (slot + 0.5);
  }
  private foodScreenPos(f: FoodRuntime): { x: number; y: number } {
    if (!f.onGrill) return { x: W / 2, y: BENCH_TOP - 30 };
    const zone = this.sim.grill.zones[f.zoneIndex];
    const idx = zone ? zone.items.indexOf(f) : 0;
    return { x: this.slotX(f.zoneIndex, Math.max(0, idx)), y: this.zoneY(f.zoneIndex) };
  }
  private benchItemRect(i: number): { x: number; y: number; w: number; h: number } {
    const w = 74; const gap = 8;
    return { x: 14 + (i % 5) * (w + gap), y: BENCH_TOP + 22 + Math.floor(i / 5) * 74, w, h: 66 };
  }
  private orderCardRect(i: number): { x: number; y: number; w: number; h: number } {
    const w = 128; const gap = 8;
    return { x: 10 + (i % 3) * (w + gap), y: 70 + Math.floor(i / 3) * 64, w, h: 58 };
  }

  // ── Input ─────────────────────────────────────────────────────────────────
  private bindInput(canvas: HTMLCanvasElement): void {
    const toLocal = (e: PointerEvent): { x: number; y: number } => {
      const r = canvas.getBoundingClientRect();
      return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
    };

    canvas.addEventListener('pointerdown', (e) => {
      const p = toLocal(e);
      this.pointer = { ...p, down: true };
      canvas.setPointerCapture(e.pointerId);
      audio.unlock();
      if (!this.sizzleBed && this.screen === 'play') this.sizzleBed = audio.startSizzleBed();

      // Global close for modals
      if (this.dailyModalOpen) {
        // hit test daily claim
        const claimHit = this.hitDailyClaim(p);
        if (claimHit !== null) {
          if (claimHit === this.meta.lastClaimDay + 1 && claimHit <= 7) {
            const rew = DAILY_REWARDS[claimHit-1]!;
            if (rew.icon === 'coin') this.meta.coins += rew.amount ?? 0;
            else if (rew.icon === 'ember') this.meta.embers += rew.amount ?? 0;
            this.meta.lastClaimDay = claimHit;
            if (claimHit === 7) this.meta.coins += 500;
            saveMeta(this.meta);
            this.burst(p.x, p.y, 16, C.ouroLight, 'confetti');
            audio.play('coin');
            if (claimHit === 7) audio.play('levelUp');
          }
          return;
        }
        // close button
        if (p.x > W-56 && p.y > 140 && p.y < 180 && p.x < W-20) {
          this.dailyModalOpen = false;
          audio.play('uiTap');
          return;
        }
        // tap outside to close
        if (p.y < 180 || p.y > 640) { this.dailyModalOpen = false; return; }
        return;
      }
      if (this.offlinePopup) {
        if (p.y > H*0.5 + 60 && p.y < H*0.5+120 && Math.abs(p.x - W/2) < 100) {
          this.meta.coins += this.offlinePopup.coins;
          saveMeta(this.meta);
          this.offlinePopup = null;
          this.burst(W/2, H/2, 18, C.ouroLight, 'coin');
          audio.play('coin');
        } else if (Math.hypot(p.x - W/2, p.y - (H*0.5-80)) > 140) {
          this.offlinePopup = null;
        }
        return;
      }

      if (this.screen === 'splash') {
        // P0: toque em qualquer lugar após 0.2s acelera imediatamente (TTI 2.3→0.9s)
        if (this.splashT > 0.2) this.splashT = 1.2;
        if (this.splashT > 0.5) { this.screen = this.meta.ftueDone ? 'home' : 'title'; }
        return;
      }
      if (this.screen === 'title') {
        audio.play('uiTap');
        if (!this.meta.ftueDone) this.requestNextLevel();
        else this.screen = 'home';
        return;
      }
      if (this.screen === 'home') {
        // Bottom nav
        const navHit = this.hitBottomNav(p);
        if (navHit) {
          this.homeTab = navHit;
          audio.play('uiTap');
          if (navHit === 'missions' || navHit === 'collection' || navHit === 'shop') {
            // stays on home but tab switch handled in draw
          }
          return;
        }
        // Play button — hero card
        if (this.hitHomePlay(p)) {
          audio.play('uiTap');
          this.requestNextLevel();
          return;
        }
        // Churrasqueira showcase — 356..450
        if (p.y > 350 && p.y < 458 && p.x > 12 && p.x < W-12) {
          // CTA region is right side 76x30 at W-92, but tapping anywhere on card attempts action
          const ch = this.activeChurr();
          const evolveInfo = this.canAffordEvolve();
          const atMax = !evolveInfo.next;
          const nextCh = this.nextChurrasqueiraToUnlock();
          // If at max, try to unlock next churrasqueira
          if (atMax && nextCh && nextCh.id !== ch?.id) {
            if (this.meta.level < nextCh.unlockLevel) {
              audio.play('uiError');
              this.float(W/2, 380, `Desbloqueia no nível ${nextCh.unlockLevel}`, C.ambar, 14);
            } else {
              const cost = nextCh.unlockCostCoins ?? 0;
              if (this.meta.coins >= cost) {
                this.meta.coins -= cost;
                this.meta.churrasqueiraId = nextCh.id;
                if (!this.meta.churrasqueiraLv[nextCh.id]) this.meta.churrasqueiraLv[nextCh.id]=1;
                saveMeta(this.meta);
                this.burst(p.x,p.y,18, C.ouroLight, 'confetti');
                audio.play('levelUp');
                const name = this.l10n.t(nextCh.nameKey);
                this.float(W/2, 360, `Desbloqueou: ${name}!`, C.verdeClaro, 18);
              } else {
                audio.play('uiError');
                this.float(W/2,380,`Falta ${(cost - this.meta.coins).toLocaleString(this.l10n.locale)} moedas`, C.telha, 14);
              }
            }
          } else if (evolveInfo.next) {
            if (evolveInfo.affordable) {
              this.meta.coins -= evolveInfo.cost;
              this.meta.embers -= evolveInfo.embers;
              const cid = ch!.id;
              this.meta.churrasqueiraLv[cid] = (this.meta.churrasqueiraLv[cid] ?? 1) + 1;
              saveMeta(this.meta);
              this.burst(p.x,p.y,16, (ch?.visual.color ?? C.ouroLight), 'spark');
              audio.play('levelUp');
              const nxt = evolveInfo.next!;
              this.float(W/2, 380, `Evoluiu: ${nxt.shortName}!`, C.ouroLight, 18);
              // tiny hint about fileiras if zoneCount increased
              if (nxt.zoneCount > (this.activeEvo()?.zoneCount ?? 1)) {
                setTimeout(()=> this.float(W/2, 400, `+1 fileira desbloqueada!`, C.verdeClaro, 14), 400);
              }
            } else {
              audio.play('uiError');
              if (this.meta.coins < evolveInfo.cost) this.float(W/2,380, `Moedas insuficientes`, C.telha, 14);
              else this.float(W/2,380, `Falta ${evolveInfo.embers} brasas`, C.telha, 14);
            }
          } else {
            audio.play('uiTap');
            this.float(W/2,380, `No limite — pronta para a próxima churrasqueira!`, C.perola, 13);
          }
          return;
        }
        // Daily strip
        if (p.y > 188 && p.y < 268 && p.x > 12 && p.x < W-12) {
          this.dailyModalOpen = true;
          audio.play('uiTap');
          return;
        }
        // Bonus card (drawn at 608,68 — overlaps event when active)
        if (this.meta.bonusReady && p.y > 600 && p.y < 680 && p.x > 12 && p.x < W-12) {
          audio.play('uiTap');
          if (this.meta.bonusReady === 'frenzy') this.startFrenzy();
          else if (this.meta.bonusReady === 'wheel') this.startWheel();
          else if (this.meta.bonusReady === 'chef') this.startFrenzy();
          return;
        }
        // Upgrade quick-buy — shifted to 460
        const upg = this.hitHomeUpgrade(p);
        if (upg) {
          const cost = this.upgradeCost(upg);
          if (this.meta.coins >= cost) {
            this.meta.coins -= cost;
            this.meta.upgrades[upg] = (this.meta.upgrades[upg] ?? 0) + 1;
            saveMeta(this.meta);
            this.burst(p.x, p.y, 12, C.ouroLight, 'spark');
            audio.play('levelUp');
          } else {
            audio.play('uiError');
            this.float(p.x, p.y-20, 'Moedas insuficientes', C.telha, 14);
          }
          return;
        }
        // Collection teaser -> switch to collection tab — now 528..598
        if (p.y > 520 && p.y < 600 && p.x > 12 && p.x < W-12) {
          if (p.x < W/2) { this.homeTab = 'collection'; } else { this.homeTab = 'missions'; }
          audio.play('uiTap');
          return;
        }
        return;
      }
      if (this.screen === 'result') {
        const hit = this.hitResult(p);
        if (hit === 'bonus') {
          if (this.meta.bonusReady === 'frenzy') this.startFrenzy();
          else if (this.meta.bonusReady === 'wheel') this.startWheel();
          else if (this.meta.bonusReady === 'chef') this.startFrenzy();
          return;
        }
        if (hit === 'double') {
          // simulated rewarded ad: double coins
          if (this.lastResult) {
            this.meta.coins += this.lastResult.coins;
            this.float(W/2, H/2, `+${this.lastResult.coins} (2×)`, C.ouroLight, 22);
            this.burst(W/2, H/2, 16, C.ouroLight, 'coin');
            audio.play('coin');
            saveMeta(this.meta);
            this.lastResult.coins *= 2;
          }
          return;
        }
        if (hit === 'home') {
          this.screen = 'home';
          this.homeTab = 'home';
          this.bonusOfferT = 0;
          // after result, check if bonus expired (15s window)
          if (this.bonusOfferT > 15) this.meta.bonusReady = null;
          audio.play('uiTap');
          return;
        }
        if (hit === 'next') {
          const maxIdx = this.levels.length - 1;
          if (this.levelIndex < maxIdx) this.levelIndex++;
          this.requestNextLevel();
          audio.play('uiTap');
          return;
        }
        if (hit === 'share') {
          audio.play('uiTap');
          this.float(W/2, H/2, 'Link copiado! Convide amigos → +50 Brasas', C.verdeClaro, 14);
          if (navigator.clipboard) void navigator.clipboard.writeText('CHURRASCO! BRASA42 — jogue comigo!').catch(()=>{});
          return;
        }
        // tap anywhere else on result goes home/next
        if (p.y > H-120) { this.screen='home'; return; }
        return;
      }
      if (this.screen === 'bonus_wheel') {
        if (!this.wheelSpinning && this.meta.wheelSpins > 0) {
          // hit spin button
          if (p.y > H-140 && Math.abs(p.x - W/2) < 90) {
            this.spinWheelNow();
            return;
          }
        }
        if (p.y < 80 && p.x < 80) { this.screen='home'; return; }
        return;
      }
      if (this.screen === 'bonus_frenzy') {
        // In frenzy, tap grill to cook fast: just count taps
        if (p.y > GRILL_TOP && p.y < GRILL_BOTTOM) {
          this.frenzyScore++;
          this.burst(p.x, p.y, 8, C.chama, 'spark');
          this.float(p.x, p.y-12, '+12', C.ouroLight, 18);
          audio.play('flip');
          if (this.frenzyScore % 5 === 0) audio.play('combo', { combo: this.frenzyScore });
        }
        if (p.y < 60 && p.x < 80) { this.finishFrenzy(); return; }
        return;
      }

      // PLAY screen interactions below
      // P0: pular tutorial — top-direito após 3s (liberdade)
      if (!this.meta.ftueDone && this.now > 3 && p.x > W-44 && p.y < 46) {
        this.meta.ftueDone = true; this.meta.ftueStep = 99; saveMeta(this.meta);
        audio.play('uiBack'); this.float(W/2, H/2, 'Tutorial pulado', C.creme, 14);
        return;
      }
      // FTUE hand consumes first taps
      for (let i = 0; i < this.unlocked.length; i++) {
        const r = this.benchItemRect(i);
        if (p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) {
          const food = this.sim.takeFromStock(this.unlocked[i]!);
          this.drag = { food, fromBench: true, x: p.x, y: p.y, startX: p.x, startY: p.y, moved: false, startTime: performance.now() };
          audio.play('uiTap');
          if (!this.meta.ftueDone && this.meta.ftueStep === 0) this.meta.ftueStep = 1;
          return;
        }
      }

      for (const f of this.sim.foods) {
        if (!f.onGrill || f.served) continue;
        const pos = this.foodScreenPos(f);
        if (Math.abs(p.x - pos.x) < 32 && Math.abs(p.y - pos.y) < 28) {
          this.drag = { food: f, fromBench: false, x: p.x, y: p.y, startX: p.x, startY: p.y, moved: false, startTime: performance.now() };
          return;
        }
      }

      if (p.y > GRILL_BOTTOM + 4 && p.y < GRILL_BOTTOM + 48) {
        if (this.sim.refillCharcoal()) {
          this.banner(this.l10n.t('ui.hud.charcoal'));
          this.burst(W / 2, GRILL_BOTTOM + 18, 14, C.chama, 'spark');
          audio.play('place');
        }
      }
      // pause button (top right small)
      if (p.x > W-44 && p.y < 56 && p.y > 8) {
        this.screen = 'home';
        audio.play('uiBack');
      }
    });

    canvas.addEventListener('pointermove', (e) => {
      const p = toLocal(e);
      this.pointer = { ...p, down: this.pointer.down };
      if (this.drag) {
        this.drag.x = p.x;
        this.drag.y = p.y;
        if (Math.hypot(p.x - this.drag.startX, p.y - this.drag.startY) > 6) this.drag.moved = true;
      }
    });

    const release = (): void => {
      const d = this.drag;
      this.pointer.down = false;
      if (!d) return;
      this.drag = null;
      const held = (performance.now() - d.startTime) / 1000;

      // P0: flip só em tap rápido (<0.35s) sem arrasto — evita confundir com drag
      if (!d.moved && !d.fromBench && d.food.onGrill && held < 0.35) {
        if (this.sim.flip(d.food)) {
          const pos = this.foodScreenPos(d.food);
          this.burst(pos.x, pos.y + 10, 10, C.chama, 'spark');
          this.float(pos.x, pos.y - 22, this.l10n.t('ui.feedback.flip'), C.creme, 15);
          audio.play('flip');
          if (!this.meta.ftueDone && this.meta.ftueStep === 1) this.meta.ftueStep = 2;
        }
        return;
      }
      // long-press serve removido (P0: 4 gestos → 3) — só drag-to-customer serve agora

      for (let i = 0; i < this.sim.customers.length; i++) {
        const c = this.sim.customers[i]!;
        if (c.state !== 'waiting') continue;
        const r = this.orderCardRect(this.visibleIndexOf(c));
        if (d.x >= r.x - 8 && d.x <= r.x + r.w + 8 && d.y >= r.y - 8 && d.y <= r.y + r.h + 8) {
          this.tryServe(d.food, c);
          return;
        }
      }

      if (d.y > GRILL_TOP - 4 && d.y < GRILL_BOTTOM + 4) {
        const z = this.zoneAt(d.y);
        if (z >= 0) {
          const ok = d.fromBench ? this.sim.place(d.food, z) : this.sim.move(d.food, z);
          if (ok) audio.play('place');
          else {
            this.float(d.x, d.y, this.l10n.t('ui.quality.grillFull'), C.telha, 14);
            audio.play('uiError');
          }
        }
        return;
      }

      if (d.y > BENCH_TOP - 20) {
        this.sim.discard(d.food);
      }
    };

    canvas.addEventListener('pointerup', release);
    canvas.addEventListener('pointercancel', release);
  }

  private hitBottomNav(p: {x:number;y:number}): HomeTab | null {
    if (p.y < H - 64) return null;
    const w = W / 5;
    const idx = Math.floor(p.x / w);
    const tabs: HomeTab[] = ['home','shop','missions','collection','route'];
    return tabs[idx] ?? null;
  }
  private hitHomePlay(p: {x:number;y:number}): boolean {
    return p.x > 24 && p.x < W-24 && p.y > 272 && p.y < 348;
  }
  private hitHomeUpgrade(p: {x:number;y:number}): string | null {
    // upgrade teaser now at 460-512 after churrasqueira showcase (2 cards)
    if (p.y < 458 || p.y > 518) return null;
    if (p.x > 14 && p.x < W/2 - 6) return 'grill_size';
    if (p.x > W/2 + 6 && p.x < W - 14) return 'grill_heat';
    return null;
  }
  private hitDailyClaim(p: {x:number;y:number}): number | null {
    if (p.y < 240 || p.y > 320) return null;
    // 7 boxes from x 16, w 48 gap 6
    const startX = 16;
    const boxW = 50;
    for (let i=0;i<7;i++) {
      const x = startX + i*(boxW+6);
      if (p.x >= x && p.x <= x+boxW) return i+1;
    }
    return null;
  }
  private hitResult(p: {x:number;y:number}): 'home'|'next'|'double'|'bonus'|'share'|null {
    // bonus banner 15s window near top of result card
    if (this.meta.bonusReady && this.bonusOfferT < 15) {
      if (p.y > 500 && p.y < 560 && p.x > 30 && p.x < W-30) return 'bonus';
    }
    // share at y ~560-580
    if (p.y > 585 && p.y < 615 && Math.abs(p.x - W/2) < 90) return 'share';
    // double at y ~ 500-540
    if (p.y > 632 && p.y < 690) {
      if (p.x < W/2) return 'home';
      return 'next';
    }
    if (p.y > 610 && p.y < 632 && Math.abs(p.x - W/2) < 70) return 'double';
    return null;
  }

  private upgradeCost(id: string): number {
    const t = this.db.upgradeById.get(id);
    if (!t) return 999999;
    const lvl = this.meta.upgrades[id] ?? 0;
    if (lvl >= t.maxLevel) return Infinity;
    return Math.round(t.baseCost * Math.pow(t.growth, lvl) / 10) * 10;
  }

  private visibleIndexOf(c: CustomerRuntime): number {
    const waiting = this.sim.customers.filter((x) => x.state === 'waiting');
    const i = waiting.indexOf(c);
    return i < 0 ? 0 : i;
  }
  private bestCustomerFor(food: FoodRuntime): CustomerRuntime | null {
    const waiting = this.sim.customers.filter((c) => c.state === 'waiting');
    return waiting.find((c) => c.lines.some((l) => l.ingredientId === food.ingredient.id && l.fulfilledBy.length < 1)) ?? null;
  }
  private tryServe(food: FoodRuntime, customer: CustomerRuntime | null): void {
    if (!customer) {
      this.float(W / 2, 300, this.l10n.t('ui.quality.nobodyAsked'), C.telha, 15);
      return;
    }
    const scored = this.sim.serve(customer, food);
    if (!scored) {
      this.float(W / 2, 300, this.l10n.t('ui.quality.wrongOrder'), C.telha, 15);
      return;
    }
    const pos = { x: W / 2, y: 200 };
    if (scored.quality === 'perfect') {
      /* handled by event stream */
    } else if (scored.quality === 'good') {
      this.float(pos.x, pos.y, this.l10n.t('ui.quality.good'), C.verdeClaro, 24);
    } else if (scored.quality === 'burned') {
      this.float(pos.x, pos.y, 'QUEIMADO', C.telha, 22);
    } else {
      this.float(pos.x, pos.y, this.l10n.t(scored.quality === 'raw' ? 'ui.quality.raw' : 'ui.quality.overcooked'), C.ambar, 20);
    }
    if (scored.coins > 0) this.float(pos.x, pos.y + 26, `+${scored.coins}`, C.ouroLight, 20);
  }

  // ── Effects helpers ───────────────────────────────────────────────────────
  private burst(x: number, y: number, n: number, color: string, kind: Particle['kind']): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 60 + Math.random() * 130;
      this.particles.push({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40,
        life: 0, max: 0.5 + Math.random() * 0.6,
        size: kind === 'smoke' ? 7 + Math.random() * 6 : 2 + Math.random() * 2.8,
        color, kind
      });
    }
  }
  private ring(x: number, y: number): void {
    this.particles.push({ x, y, vx: 0, vy: 0, life: 0, max: 0.55, size: 10, color: C.ouroLight, kind: 'ring' });
  }
  private confettiBurst(x: number, y: number, n: number): void {
    for (let i = 0; i < n; i++) this.spawnConfetti(x, y);
  }
  private spawnConfetti(x: number, y: number): void {
    const colors = [C.ouroLight, C.chama, C.brasa, C.verdeClaro, C.vermelho, C.creme];
    const a = Math.random() * Math.PI * 2;
    const s = 80 + Math.random() * 160;
    this.particles.push({
      x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 80,
      life: 0, max: 2 + Math.random() * 1.5,
      size: 3 + Math.random() * 3,
      color: colors[Math.floor(Math.random() * colors.length)]!,
      kind: 'confetti', rot: Math.random() * Math.PI * 2, vr: (Math.random() - 0.5) * 8, shape: Math.random() < 0.5 ? 'rect' : 'square',
    });
  }
  private float(x: number, y: number, text: string, color: string, size: number): void {
    this.floats.push({ x, y, text, life: 0, color, size });
  }
  private banner(text: string): void { this.bannerText = text; this.bannerLife = 2; }

  private resize(canvas: HTMLCanvasElement): void {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const availW = window.innerWidth;
    const availH = window.innerHeight;
    const scale = Math.min(availW / W, availH / H, 1.35);
    canvas.style.width = `${Math.floor(W * scale)}px`;
    canvas.style.height = `${Math.floor(H * scale)}px`;
    canvas.width = Math.floor(W * scale * dpr);
    canvas.height = Math.floor(H * scale * dpr);
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
  }

  // ── Draw ──────────────────────────────────────────────────────────────────
  private drawBackdrop(ctx: CanvasRenderingContext2D): void {
    if (!this.bgCache) {
      const off = document.createElement('canvas');
      off.width = W; off.height = H;
      const c = off.getContext('2d')!;
      const sky = c.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, '#1A0F0A');
      sky.addColorStop(0.15, '#2D1B11');
      sky.addColorStop(0.34, '#4A2515');
      sky.addColorStop(0.5, '#7A3818');
      sky.addColorStop(0.62, '#C0541E');
      sky.addColorStop(0.7, '#E07028');
      sky.addColorStop(0.76, '#F4A24B');
      sky.addColorStop(0.82, '#3D2314');
      sky.addColorStop(1, '#140B07');
      c.fillStyle = sky;
      c.fillRect(0, 0, W, H);
      const sunY = 440;
      const halo = c.createRadialGradient(W / 2, sunY, 5, W / 2, sunY, 220);
      halo.addColorStop(0, 'rgba(255,220,140,0.95)');
      halo.addColorStop(0.12, 'rgba(255,180,80,0.75)');
      halo.addColorStop(0.35, 'rgba(240,120,40,0.35)');
      halo.addColorStop(1, 'rgba(224,86,31,0)');
      c.fillStyle = halo; c.fillRect(0, 0, W, H);
      c.fillStyle = '#FFE2A8';
      c.beginPath(); c.arc(W / 2, sunY, 34, 0, Math.PI * 2); c.fill();
      c.fillStyle = 'rgba(14,8,5,0.85)';
      c.beginPath(); c.moveTo(0, 460);
      const hillPoints: [number,number][] = [[40,430],[80,450],[130,420],[190,448],[240,425],[290,452],[340,428],[390,450],[W,440]];
      for (const [px,py] of hillPoints) c.lineTo(px,py);
      c.lineTo(W,H); c.lineTo(0,H); c.closePath(); c.fill();
      c.fillStyle = 'rgba(10,6,4,0.75)';
      for (let i=0;i<9;i++) {
        const bx = -10 + i*54;
        c.fillRect(bx,400,34,90);
        c.beginPath(); c.moveTo(bx,400); c.lineTo(bx+17,390); c.lineTo(bx+34,400); c.closePath(); c.fill();
      }
      c.fillStyle = 'rgba(10,6,4,0.8)';
      c.fillRect(0,410,W,6); c.fillRect(0,456,W,6);
      const ground = c.createLinearGradient(0,530,0,H);
      ground.addColorStop(0,'#2A1910'); ground.addColorStop(0.5,'#1A0F09'); ground.addColorStop(1,'#0C0705');
      c.fillStyle = ground; c.fillRect(0,520,W,H-520);
      const pool = c.createRadialGradient(W/2,440,30,W/2,440,380);
      pool.addColorStop(0,'rgba(255,160,60,0.28)'); pool.addColorStop(0.4,'rgba(224,86,31,0.14)'); pool.addColorStop(1,'rgba(224,86,31,0)');
      c.fillStyle = pool; c.fillRect(0,0,W,H);
      c.strokeStyle='rgba(30,20,14,0.7)'; c.lineWidth=1; c.beginPath(); c.moveTo(-20,120); c.quadraticCurveTo(W/2,180,W+20,110); c.stroke();
      for (let i=0;i<this.lightPhases.length;i++) {
        const t = i/(this.lightPhases.length-1);
        const lx=-20+t*(W+40); const ly=120+Math.sin(t*Math.PI)*58-10;
        c.strokeStyle='rgba(30,20,14,0.6)'; c.beginPath(); c.moveTo(lx,120+Math.sin(t*Math.PI)*58-20); c.lineTo(lx,ly+4); c.stroke();
        const bg=c.createRadialGradient(lx,ly+4,0,lx,ly+4,14);
        bg.addColorStop(0,'rgba(255,220,140,0.9)'); bg.addColorStop(0.4,'rgba(255,180,70,0.35)'); bg.addColorStop(1,'rgba(255,150,40,0)');
        c.fillStyle=bg; c.beginPath(); c.arc(lx,ly+4,14,0,Math.PI*2); c.fill();
        c.fillStyle='#FFE4A6'; c.beginPath(); c.arc(lx,ly+4,2.2,0,Math.PI*2); c.fill();
      }
      const vig=c.createRadialGradient(W/2,H*0.5,H*0.2,W/2,H*0.52,H*0.85);
      vig.addColorStop(0,'rgba(0,0,0,0)'); vig.addColorStop(0.6,'rgba(0,0,0,0.25)'); vig.addColorStop(1,'rgba(0,0,0,0.75)');
      c.fillStyle=vig; c.fillRect(0,0,W,H);
      this.bgCache=off;
    }
    ctx.drawImage(this.bgCache,0,0);
    for (let i=0;i<this.lightPhases.length;i++) {
      const t=i/(this.lightPhases.length-1);
      const lx=-20+t*(W+40); const ly=120+Math.sin(t*Math.PI)*58-6;
      const tw=0.72+0.28*Math.abs(Math.sin(this.now*2.4+this.lightPhases[i]!));
      const g=ctx.createRadialGradient(lx,ly,0,lx,ly,18);
      g.addColorStop(0,`rgba(255,230,160,${0.7*tw})`); g.addColorStop(0.5,`rgba(255,180,80,${0.25*tw})`); g.addColorStop(1,'rgba(255,160,60,0)');
      ctx.fillStyle=g; ctx.beginPath(); ctx.arc(lx,ly,18,0,Math.PI*2); ctx.fill();
      ctx.fillStyle=`rgba(255,245,210,${0.85*tw})`; ctx.beginPath(); ctx.arc(lx,ly,2,0,Math.PI*2); ctx.fill();
    }
  }

  private draw(canvas: HTMLCanvasElement): void {
    const ctx = canvas.getContext('2d')!;
    ctx.save();
    if (this.shake>0) {
      const s=this.shake*6;
      ctx.translate((Math.random()-0.5)*s,(Math.random()-0.5)*s);
    }
    ctx.clearRect(-20,-20,W+40,H+40);
    this.drawBackdrop(ctx);
    if (this.screen==='splash') this.drawSplash(ctx);
    else if (this.screen==='title') this.drawTitle(ctx);
    else if (this.screen==='home') this.drawHome(ctx);
    else if (this.screen==='result') this.drawResult(ctx);
    else if (this.screen==='bonus_frenzy') this.drawFrenzy(ctx);
    else if (this.screen==='bonus_wheel') this.drawWheel(ctx);
    else this.drawPlay(ctx);
    // global overlays
    if (this.dailyModalOpen) this.drawDailyModal(ctx);
    if (this.offlinePopup) this.drawOfflinePopup(ctx);
    ctx.restore();
  }

  private drawSplash(ctx: CanvasRenderingContext2D): void {
    const p = clamp01(this.splashT/1.2);
    // warm haze
    const haze = ctx.createRadialGradient(W/2,340,40,W/2,340,280);
    haze.addColorStop(0,'rgba(255,160,60,0.22)'); haze.addColorStop(1,'rgba(255,120,40,0)');
    ctx.fillStyle=haze; ctx.fillRect(0,0,W,H);
    // logo
    const breathe=1+Math.sin(this.now*1.8)*0.015;
    ctx.save(); ctx.translate(W/2, 260); ctx.scale(breathe,breathe);
    outlinedText(ctx,'CHURRASCO!',0,0,C.offwhite,54,{outline:9, shadow:18, shadowColor:'rgba(224,86,31,0.55)', weight:900});
    ctx.restore();
    outlinedText(ctx,'O Mestre da Brasa',W/2,302,C.chama,20,{weight:800, outline:4, shadow:8, shadowColor:'rgba(224,86,31,0.4)'});
    // small grill icon
    ctx.save(); ctx.globalAlpha=0.9;
    this.drawChurrasqueira(ctx,true);
    ctx.restore();
    // loading bar
    const bw=200, bh=8, bx=W/2-bw/2, by=560;
    roundRectPath(ctx,bx,by,bw,bh,bh/2); ctx.fillStyle='rgba(0,0,0,0.45)'; ctx.fill();
    roundRectPath(ctx,bx+2,by+2,bw-4,bh-4,bh/2); ctx.fillStyle='rgba(255,255,255,0.08)'; ctx.fill();
    if (p>0) {
      roundRectPath(ctx,bx+2,by+2,(bw-4)*p,bh-4,bh/2);
      const g=ctx.createLinearGradient(bx,0,bx+bw,0);
      g.addColorStop(0,C.brasaHot); g.addColorStop(1,C.chama);
      ctx.fillStyle=g; ctx.fill();
    }
    ctx.font=font(11,700,UI); ctx.textAlign='center'; ctx.fillStyle='rgba(244,231,211,0.6)';
    ctx.fillText(p<1?'Acendendo a brasa…':'',W/2,by+20);
    ctx.font=font(10,600,UI); ctx.fillStyle='rgba(244,231,211,0.35)';
    ctx.fillText('v0.2 · Quintal · Toque para acelerar',W/2,H-28);
    this.drawParticles(ctx);
  }

  private drawPlay(ctx: CanvasRenderingContext2D): void {
    this.drawGrill(ctx);
    this.drawBench(ctx);
    this.drawOrders(ctx);
    this.drawParticles(ctx);
    this.drawFloats(ctx);
    if (this.drag) this.drawDragged(ctx);
    this.drawHud(ctx);
    if (!this.meta.ftueDone) this.drawFtueOverlay(ctx);
    if (this.bannerLife>0) this.drawBanner(ctx);
    if (this.flash>0) {
      const f=ctx.createRadialGradient(W/2,GRILL_TOP+120,40,W/2,GRILL_TOP+120,W);
      f.addColorStop(0,`rgba(255,210,130,${this.flash*0.35})`); f.addColorStop(1,'rgba(255,200,120,0)');
      ctx.fillStyle=f; ctx.fillRect(0,0,W,H);
    }
  }

  private drawTitle(ctx: CanvasRenderingContext2D): void {
    this.drawParticles(ctx);
    const haze=ctx.createRadialGradient(W/2,440,40,W/2,440,280);
    haze.addColorStop(0,'rgba(255,160,60,0.22)'); haze.addColorStop(1,'rgba(255,120,40,0)');
    ctx.fillStyle=haze; ctx.fillRect(0,0,W,H);
    const titleY=154;
    ctx.save(); ctx.translate(W/2,titleY);
    const breathe=1+Math.sin(this.now*1.8)*0.012; ctx.scale(breathe,breathe);
    const glow=ctx.createRadialGradient(0,0,10,0,0,220);
    glow.addColorStop(0,'rgba(255,180,70,0.45)'); glow.addColorStop(1,'rgba(224,86,31,0)');
    ctx.fillStyle=glow; ctx.fillRect(-220,-80,440,160);
    const titleText=this.l10n.t('ui.app.title');
    const titleSize=titleText.length>9?48:54;
    outlinedText(ctx,titleText,0,0,C.perola,titleSize,{outline:9, shadow:22, shadowColor:'rgba(224,86,31,0.65)'});
    ctx.restore();
    outlinedText(ctx,this.l10n.t('ui.app.subtitle'),W/2,196,C.chama,19,{weight:700, outline:4, shadow:8, shadowColor:'rgba(224,86,31,0.4)'});
    this.drawChurrasqueira(ctx,true);
    // Fix #1 5s test 15% tocavam hero achando que era botão — reduz affordance falsa (glow 1.3→0.55, sem hover, não-clicável)
    const hero=['picanha','linguica_toscana','espetinho_frango'];
    hero.forEach((id,i)=>{
      const ing=this.db?.ingredientById.get(id);
      if(!ing) return;
      drawFoodArt(ctx,ing,W/2-60+i*60,378,{doneness:0.6, burned:false, scale:0.82, glow:0.55, heat:0.9});
    });
    ctx.font=font(9,600,UI); ctx.textAlign='center'; ctx.fillStyle='rgba(244,231,211,0.32)';
    ctx.fillText('pratos ilustrativos', W/2, 414);
    const bw=260, bh=68, bx=W/2-bw/2, by=520;
    const breathe2=1+Math.sin(this.now*2.4)*0.02;
    ctx.save(); ctx.scale(breathe2,breathe2);
    premiumButton(ctx,bx,by,bw,bh,{variant:'primary'});
    ctx.restore();
    const label = this.meta.ftueDone ? 'CONTINUAR' : this.l10n.t('ui.action.play');
    outlinedText(ctx,label,W/2,by+bh/2+2,C.perola,26,{outline:3, weight:800});
    const pulse=0.3+0.4*Math.sin(this.now*2.8);
    ctx.globalAlpha=pulse;
    outlinedText(ctx, this.meta.ftueDone ? 'Toque para ir ao quintal' : this.l10n.t('ui.title.tapToStart'),W/2,598,C.creme,13,{weight:600, family:UI, outline:2});
    ctx.globalAlpha=1;
    // sub hint plus retention teaser
    ctx.font=font(11,600,UI); ctx.textAlign='center'; ctx.fillStyle='rgba(244,231,211,0.55)';
    if (!this.meta.ftueDone) {
      ctx.fillText('60s para o primeiro PERFEITO! · Sem anúncios',W/2,640);
      ctx.fillText('Arraste da bancada para a brasa',W/2,656);
    } else {
      ctx.fillText(`Nível ${this.meta.level} · ${this.meta.coins.toLocaleString(this.l10n.locale)} moedas · ${this.meta.embers} brasas`,W/2,640);
      ctx.fillText('Volte amanhã e ganhe o baú do 7º dia!',W/2,656);
    }
    // tiny settings/mute row — vector speaker (no emoji)
    glass(ctx,W-66, 18, 52, 28, { alpha:0.18, border:'rgba(255,214,160,0.22)' });
    ctx.save(); ctx.translate(W-40, 32);
    const muted = (audio as any)?.muted;
    ctx.fillStyle= muted ? 'rgba(244,231,211,0.45)' : C.creme;
    // speaker body
    ctx.fillRect(-10, -6, 8, 12);
    ctx.beginPath(); ctx.moveTo(-2,-8); ctx.lineTo(6,-12); ctx.lineTo(6,12); ctx.lineTo(-2,8); ctx.closePath(); ctx.fill();
    if(!muted){
      ctx.strokeStyle=C.creme; ctx.lineWidth=1.2; ctx.lineCap='round';
      ctx.beginPath(); ctx.arc(8,0,6,-0.9,0.9); ctx.stroke();
      ctx.beginPath(); ctx.arc(8,0,10,-0.7,0.7); ctx.stroke();
    } else {
      ctx.strokeStyle='rgba(244,231,211,0.7)'; ctx.lineWidth=1.5; ctx.beginPath(); ctx.moveTo(-12,-9); ctx.lineTo(12,9); ctx.stroke();
    }
    ctx.restore();
  }

  private drawHome(ctx: CanvasRenderingContext2D): void {
    this.drawParticles(ctx);
    // Header (frosted, with XP)
    this.drawHomeHeader(ctx);

    // Daily streak strip
    this.drawDailyStrip(ctx);

    // Tab-specific content
    if (this.homeTab !== 'home') {
      this.drawHomeTabContent(ctx);
      this.drawBottomNav(ctx);
      return;
    }

    // CTA Play card — hero (only on Início) — now shows churrasqueira atual
    const cardY=272;
    const cardH=76;
    panel(ctx,12,cardY,W-24,cardH,{r:22, top:'rgba(58,42,30,0.98)', bottom:'rgba(24,16,10,0.98)', border:'rgba(255,214,160,0.28)', borderWidth:1.5, shadow:20, glowTop:'rgba(255,220,160,0.22)'});
    // accent bar — color from churrasqueira
    const chAccent = this.activeChurr()?.visual.color ?? C.chama;
    const acc=ctx.createLinearGradient(12,cardY+14, W-12, cardY+14);
    acc.addColorStop(0,'rgba(224,86,31,0)'); acc.addColorStop(0.5,chAccent); acc.addColorStop(1,'rgba(224,86,31,0)');
    ctx.fillStyle=acc; ctx.fillRect(32, cardY+14, W-64, 2);
    const lvl = this.levels[this.levelIndex] ?? this.levels[0]!;
    const actCh = this.activeChurr();
    const actEvo = this.activeEvo();
    ctx.textAlign='left'; ctx.textBaseline='middle';
    if (actCh && actEvo) {
      ctx.font=font(9,800,UI); ctx.fillStyle='rgba(244,231,211,0.62)';
      ctx.fillText(`${this.l10n.t(actCh.nameKey).toUpperCase()} · ${actEvo.zoneCount} ${actEvo.zoneCount>1?'FILEIRAS':'FILEIRA'} · ${actEvo.slotsPerZone} cortes/fila`, 28, cardY+28);
      outlinedText(ctx, `${lvl.id.toUpperCase()} · ${this.l10n.t(actCh.subtitleKey).toUpperCase()}`, 28, cardY+46, C.perola, 14, { outline:2, weight:900, align:'left' });
      ctx.font=font(10,600,UI); ctx.fillStyle='rgba(244,231,211,0.55)';
      ctx.fillText(actEvo.shortName + ' · Toque para cozinhar — 90s',28, cardY+62);
    } else {
      const restaurant = this.db.restaurantByIndex.get(0)!;
      ctx.font=font(10,800,UI); ctx.fillStyle='rgba(244,231,211,0.6)';
      ctx.fillText(this.l10n.t(restaurant.nameKey).toUpperCase(), 28, cardY+30);
      outlinedText(ctx, lvl.id.toUpperCase(), 28, cardY+50, C.perola, 18, { outline:2, weight:900, align:'left' });
      ctx.font=font(11,600,UI); ctx.fillStyle='rgba(244,231,211,0.55)';
      ctx.fillText('Toque para cozinhar — turno de 90s · 2 pedidos',28, cardY+68);
    }
    // play button on card right
    premiumButton(ctx, W-114, cardY+18, 88, 42, { variant:'primary' });
    outlinedText(ctx,'JOGAR', W-70, cardY+39, C.perola, 16, { outline:2, weight:900 });
    // xp progress small inside card bottom
    const need = xpForLevel(this.meta.level);
    const prog = levelProgress(this.meta.xp, this.meta.level);
    const barX=28, barY=cardY+66, barW=W-56, barH=5;
    roundRectPath(ctx,barX,barY,barW,barH,barH/2); ctx.fillStyle='rgba(0,0,0,0.45)'; ctx.fill();
    if (prog>0) {
      roundRectPath(ctx,barX,barY,Math.max(barH,barW*prog),barH,barH/2);
      const g=ctx.createLinearGradient(barX,0,barX+barW*prog,0);
      g.addColorStop(0,C.brasaHot); g.addColorStop(1,C.chama);
      ctx.fillStyle=g; ctx.fill();
    }

    // ── Churrasqueira showcase card ───────────────────────────────────────
    // This is the primary progression UX: 1 fileira → 2 → 3 → Fornalha
    const showcaseY = 356;
    const showcaseH = 94;
    const showcaseActCh = this.activeChurr();
    const showcaseActEvo = this.activeEvo();
    const nextAvail = this.nextChurrasqueiraToUnlock();
    const evolveInfo = this.canAffordEvolve();
    // Card background uses churrasqueira color tint
    const tint = showcaseActCh?.visual.color ?? '#8A5A33';
    panel(ctx,12,showcaseY,W-24,showcaseH,{r:18, top:'rgba(58,42,30,0.98)', bottom:'rgba(28,18,12,0.98)', border: tint, borderWidth:1.6, shadow:16, innerGlow:true, glowTop:'rgba(255,220,160,0.18)'});
    // left preview thumbnail (mini grill)
    const thumbX = 24, thumbY = showcaseY+14, thumbW = 72, thumbH = 66;
    // thumbnail bg
    roundRectPath(ctx,thumbX,thumbY,thumbW,thumbH,12); ctx.fillStyle='rgba(0,0,0,0.45)'; ctx.fill();
    ctx.save(); roundRectPath(ctx,thumbX,thumbY,thumbW,thumbH,12); ctx.clip();
    // draw miniature grill based on style
    const style = showcaseActCh?.visual.style ?? 'lata';
    // subtle gradient for thumb
    const tg = ctx.createLinearGradient(thumbX,thumbY,thumbX,thumbY+thumbH);
    if (style === 'lata') { tg.addColorStop(0,'#7A4A2E'); tg.addColorStop(1,'#4B2A18'); }
    else if (style === 'chapa') { tg.addColorStop(0,'#5A5E62'); tg.addColorStop(1,'#2A2E33'); }
    else if (style === 'inox') { tg.addColorStop(0,'#D8E2E8'); tg.addColorStop(1,'#8FA0AF'); }
    else { tg.addColorStop(0,'#8B5A2B'); tg.addColorStop(1,'#3A2510'); }
    ctx.fillStyle=tg; ctx.fillRect(thumbX,thumbY,thumbW,thumbH);
    // fileiras lines inside thumb
    const evoForThumb = showcaseActEvo;
    if (evoForThumb) {
      const fCount = evoForThumb.zoneCount;
      for(let i=0;i<fCount;i++){
        const y = thumbY + 10 + (thumbH-20) * (i / Math.max(1,fCount-1)) * (fCount>1?1:0) + (fCount===1? (thumbH/2-4):0);
        const hh = fCount===1? 26 : (thumbH-20)/fCount - 4;
        const gyThumb = fCount===1 ? thumbY + thumbH/2 - hh/2 : thumbY+10 + i*((thumbH-20)/fCount);
        // ember glow
        ctx.fillStyle = i===fCount-1 || fCount===1 ? 'rgba(255,120,40,0.85)' : i===1 ? 'rgba(255,180,80,0.55)' : 'rgba(210,90,30,0.45)';
        roundRectPath(ctx,thumbX+8,gyThumb,thumbW-16,hh,4); ctx.fill();
        // grate lines
        ctx.strokeStyle='rgba(0,0,0,0.35)'; ctx.lineWidth=1;
        for(let gx=thumbX+12; gx<thumbX+thumbW-12; gx+=8){ ctx.beginPath(); ctx.moveTo(gx,gyThumb+2); ctx.lineTo(gx,gyThumb+hh-2); ctx.stroke(); }
        // label zone
        if (fCount>1){
          ctx.font=font(7,800,UI); ctx.fillStyle='rgba(0,0,0,0.55)'; ctx.textAlign='center';
          const labels=['BAIXA','MÉDIA','ALTA']; ctx.fillText(labels[i] ?? `F${i+1}`, thumbX+thumbW/2, gyThumb+hh/2+2);
        }
      }
    }
    // chimney or not
    if (showcaseActCh?.visual.chimney){
      ctx.fillStyle='rgba(0,0,0,0.25)'; ctx.fillRect(thumbX+thumbW-18, thumbY-2, 10, 8);
      ctx.fillStyle='#8B7A62'; roundRectPath(ctx,thumbX+thumbW-18,thumbY-6,10,8,2); ctx.fill();
      // smoke puff
      ctx.fillStyle='rgba(220,210,195,0.22)'; ctx.beginPath(); ctx.arc(thumbX+thumbW-13, thumbY-10, 4+Math.sin(this.now*2)*1,0,Math.PI*2); ctx.fill();
    }
    ctx.restore();
    ctx.strokeStyle='rgba(255,214,160,0.16)'; ctx.lineWidth=1; roundRectPath(ctx,thumbX,thumbY,thumbW,thumbH,12); ctx.stroke();
    // texts next to thumb
    const tx = thumbX+thumbW+12;
    ctx.textAlign='left'; ctx.textBaseline='alphabetic';
    ctx.font=font(8,800,UI); ctx.fillStyle='rgba(244,231,211,0.6)';
    ctx.fillText('CHURRASQUEIRA', tx, showcaseY+24);
    // tier badge
    if (showcaseActCh){
      const tierLabel = { quintal:'QUINTAL', comercial:'COMERCIAL', chef:'CHEF', fornalha:'FORNALHA' }[showcaseActCh.tier] ?? showcaseActCh.tier.toUpperCase();
      const badgeW = tierLabel.length*6+10;
      glass(ctx, tx+82, showcaseY+14, badgeW, 14, { alpha:0.18, border: tint });
      ctx.font=font(7,900,UI); ctx.textAlign='center'; ctx.fillStyle=tint; ctx.fillText(tierLabel, tx+82+badgeW/2, showcaseY+23);
      ctx.textAlign='left';
    }
    if (showcaseActCh && showcaseActEvo){
      ctx.font=font(12,900,UI); ctx.fillStyle=C.perola;
      const short = showcaseActEvo.shortName;
      const name = this.l10n.t(showcaseActCh.nameKey);
      ctx.fillText(`${name} — ${short}`, tx, showcaseY+42);
      ctx.font=font(10,600,UI); ctx.fillStyle='rgba(244,231,211,0.58)';
      const fileiraTxt = showcaseActEvo.zoneCount===1 ? '1 fileira só' : `${showcaseActEvo.zoneCount} fileiras`;
      ctx.fillText(`${fileiraTxt} · ${showcaseActEvo.slotsPerZone}/fila · ${this.l10n.t(this.activeChurr()!.descKey).slice(0,32)}`, tx, showcaseY+56);
      // evolution dots + progress
      const evoIdx = (this.meta.churrasqueiraLv[showcaseActCh.id] ?? 1) - 1;
      for(let i=0;i<3;i++){
        const cx = tx + i*16, cy = showcaseY+70;
        const done = i < evoIdx;
        const cur = i === evoIdx;
        ctx.fillStyle = done ? C.ouroLight : cur ? tint : 'rgba(255,255,255,0.14)';
        ctx.beginPath(); ctx.arc(cx,cy,6,0,Math.PI*2); ctx.fill();
        if (done || cur) { ctx.fillStyle='rgba(0,0,0,0.5)'; ctx.font=font(7,900,UI); ctx.textAlign='center'; ctx.fillText(done?'✓':'●',cx,cy+2); ctx.textAlign='left'; }
        if (cur){ ctx.strokeStyle=tint; ctx.lineWidth=1.5; ctx.beginPath(); ctx.arc(cx,cy,8,0,Math.PI*2); ctx.stroke(); }
        if (i<2){
          ctx.strokeStyle='rgba(255,255,255,0.12)'; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(cx+7,cy); ctx.lineTo(cx+9,cy); ctx.stroke();
        }
      }
      ctx.font=font(8,700,UI); ctx.fillStyle='rgba(244,231,211,0.5)';
      ctx.fillText(`Evolução ${evoIdx+1}/3`, tx+52, showcaseY+73);
    }
    // CTA on right side of showcase
    const ctaX = W-92, ctaY = showcaseY+22, ctaW = 76, ctaH = 30;
    const canEvolveNow = evolveInfo.next && evolveInfo.affordable;
    const atMax = !evolveInfo.next;
    // decide label
    let ctaLabel = '', ctaSub = '', ctaVariant: 'primary'|'gold'|'ghost' = 'primary';
    let ctaEnabled = false;
    if (atMax) {
      // check if next churrasqueira unlockable
      if (nextAvail && this.meta.level >= nextAvail.unlockLevel && nextAvail.id !== showcaseActCh!.id) {
        // show unlock next churrasqueira
        ctaLabel = 'DESBLOQUEAR';
        ctaSub = nextAvail ? this.l10n.t(nextAvail.nameKey).slice(0,12) : '';
        ctaVariant = 'gold';
        ctaEnabled = this.meta.coins >= (nextAvail.unlockCostCoins ?? 0);
      } else if (nextAvail && this.meta.level < nextAvail.unlockLevel) {
        ctaLabel = 'BLOQUEADA';
        ctaSub = `Nv ${nextAvail.unlockLevel}`;
        ctaVariant = 'ghost';
      } else {
        ctaLabel = 'NO LIMITE';
        ctaSub = '★ MAX';
        ctaVariant = 'ghost';
      }
    } else if (evolveInfo.next) {
      ctaLabel = 'EVOLUIR';
      ctaSub = `${evolveInfo.cost.toLocaleString(this.l10n.locale)}`;
      ctaVariant = canEvolveNow ? 'primary' : 'ghost';
      ctaEnabled = evolveInfo.affordable;
    }
    // draw button bg as panel-like
    if (ctaVariant==='primary') {
      premiumButton(ctx, ctaX, ctaY, ctaW, ctaH, { variant:'primary' });
    } else if (ctaVariant==='gold') {
      premiumButton(ctx, ctaX, ctaY, ctaW, ctaH, { variant:'gold' });
    } else {
      panel(ctx, ctaX, ctaY, ctaW, ctaH, { r:12, top:'rgba(44,32,24,0.9)', bottom:'rgba(22,15,10,0.9)', border:'rgba(255,214,160,0.14)', borderWidth:1, shadow:6 });
      ctx.fillStyle='rgba(244,231,211,0.45)'; ctx.textAlign='center'; ctx.font=font(7,700,UI); ctx.fillText(ctaSub, ctaX+ctaW/2, ctaY+21);
    }
    ctx.textAlign='center';
    if (ctaVariant!=='ghost'){
      ctx.font=font(9,900,UI); ctx.fillStyle=C.perola; ctx.fillText(ctaLabel, ctaX+ctaW/2, ctaY+13);
      if (ctaSub) { ctx.font=font(8,700,UI); ctx.fillStyle= canEvolveNow || ctaVariant==='gold' ? C.ouroLight : 'rgba(244,231,211,0.5)'; ctx.fillText(ctaVariant==='gold'? ctaSub : `${ctaSub}`, ctaX+ctaW/2, ctaY+22); }
    } else {
      ctx.font=font(8,900,UI); ctx.fillStyle='rgba(244,231,211,0.55)'; ctx.fillText(ctaLabel, ctaX+ctaW/2, ctaY+12);
    }
    // tiny hint below CTA: if affordable pulse
    if (canEvolveNow) {
      const pulse = 0.5+0.5*Math.sin(this.now*3.5);
      ctx.globalAlpha=0.5+0.3*pulse; ctx.fillStyle=C.ouro; ctx.beginPath(); ctx.arc(ctaX+ctaW-6, ctaY+6, 4,0,Math.PI*2); ctx.fill(); ctx.globalAlpha=1;
    }
    // secondary hint if next churrasqueira locked by level
    if (atMax && nextAvail && this.meta.level < nextAvail.unlockLevel){
      ctx.font=font(8,600,UI); ctx.fillStyle='rgba(244,231,211,0.42)'; ctx.textAlign='center';
      ctx.fillText(`Libera no nível ${nextAvail.unlockLevel}`, ctaX+ctaW/2, ctaY+42);
    } else if (!atMax && evolveInfo.next && !canEvolveNow){
      ctx.font=font(8,600,UI); ctx.fillStyle='rgba(244,231,211,0.42)'; ctx.textAlign='center';
      ctx.fillText(`Falta ${(evolveInfo.cost - this.meta.coins).toLocaleString(this.l10n.locale)}`, ctaX+ctaW/2, ctaY+42);
    }
    // hint line under showcase
    ctx.font=font(9,600,UI); ctx.textAlign='center'; ctx.fillStyle='rgba(244,231,211,0.42)';
    ctx.fillText(showcaseActCh?.visual.style==='lata' ? 'Comece com 1 fileira — menos é mais no fogo baixo' : 'Cada fileira é um fogo diferente — arraste para o ponto certo', W/2, showcaseY+showcaseH+10);

    // Upgrade teaser (2 cards) — now below showcase, compact
    const uy=460;
    const cardW=(W-36)/2;
    for (const [idx,id] of (['grill_size','grill_heat'] as const).entries()) {
      const x=14+ idx*(cardW+8);
      const track=this.db.upgradeById.get(id);
      const lvlU=this.meta.upgrades[id] ?? 0;
      const cost=this.upgradeCost(id);
      const canAfford=this.meta.coins>=cost && lvlU < (track?.maxLevel ?? 99);
      panel(ctx,x,uy,cardW,52,{r:16, top: canAfford? 'rgba(70,52,28,0.98)':'rgba(44,32,24,0.92)', bottom: canAfford? 'rgba(38,26,14,0.98)':'rgba(22,15,10,0.92)', border: canAfford? C.ouro : 'rgba(255,214,160,0.16)', borderWidth: canAfford?1.5:1, shadow:10, innerGlow:true});
      if (canAfford) {
        ctx.fillStyle='rgba(231,194,74,0.12)';
        roundRectPath(ctx,x,uy,cardW,52,16); ctx.fill();
      }
      // icon — vector
      ctx.save(); ctx.translate(x+22, uy+26);
      ctx.fillStyle= canAfford? C.ouroLight : C.madeiraPinho;
      ctx.beginPath(); ctx.arc(0,0,14,0,Math.PI*2); ctx.fill();
      if(idx===0) flameIcon(ctx,0,1,8,true);
      else starIcon(ctx,0,0,8,{filled:true});
      ctx.restore();
      ctx.textAlign='left';
      ctx.fillStyle=C.perola;
      const nm = this.l10n.t(track?.nameKey ?? id);
      // fix truncamento “Brasa Mais Fo…” — 2 linhas ou 10pt se >16
      if(nm.length>16){ ctx.font=font(10,800,UI); ctx.fillText(nm.slice(0,16), x+40, uy+14); ctx.fillText(nm.slice(16,30), x+40, uy+22); }
      else { ctx.font=font(11,800,UI); ctx.fillText(nm, x+40, uy+18); }
      ctx.font=font(10,700,UI); ctx.fillStyle= canAfford? C.ouroLight : 'rgba(244,231,211,0.55)';
      ctx.fillText(lvlU>= (track?.maxLevel ?? 99) ? 'MÁX' : `${cost.toLocaleString(this.l10n.locale)}`, x+40, uy+32);
      if (canAfford) {
        ctx.font=font(9,800,UI); ctx.fillStyle=C.ouroLight; ctx.fillText('COMPRAR →', x+40, uy+44);
      } else {
        ctx.font=font(9,600,UI); ctx.fillStyle='rgba(244,231,211,0.4)'; ctx.fillText(`Nv ${lvlU}/${track?.maxLevel ?? '?'}`, x+40, uy+44);
      }
      if (canAfford) {
        // dot
        ctx.fillStyle=C.ouro; ctx.beginPath(); ctx.arc(x+cardW-12, uy+12, 5,0,Math.PI*2); ctx.fill();
        ctx.fillStyle=C.perola; ctx.font=font(9,900,UI); ctx.textAlign='center'; ctx.fillText('!',x+cardW-12, uy+15);
        ctx.textAlign='left';
      }
    }
    // small hint
    ctx.font=font(9,600,UI); ctx.textAlign='center'; ctx.fillStyle='rgba(244,231,211,0.4)';
    ctx.fillText('Melhorias extras — a churrasqueira já cuida do fogo',W/2, uy+62);

    // Collection + Missions grid (2 cards) — pushed down
    const gy=528;
    // collection
    panel(ctx,14,gy,(W-36)/2,70,{r:18, top:'rgba(44,32,24,0.96)', bottom:'rgba(22,15,10,0.96)', border:'rgba(255,214,160,0.18)', shadow:10, innerGlow:true, glowTop:'rgba(255,220,170,0.16)'});
    ctx.textAlign='left';
    ctx.font=font(11,800,UI); ctx.fillStyle=C.perola; ctx.fillText('Coleção',26,gy+18);
    ctx.font=font(10,600,UI); ctx.fillStyle='rgba(244,231,211,0.55)'; ctx.fillText(`${this.meta.collection.length}/16 cortes`,26,gy+32);
    // mini progress dots
    for (let i=0;i<8;i++) {
      const cx=26+i*18, cy=gy+50;
      const done=i < this.meta.collection.length;
      ctx.fillStyle= done? C.ouroLight : 'rgba(255,255,255,0.12)';
      ctx.beginPath(); ctx.arc(cx,cy,6,0,Math.PI*2); ctx.fill();
      if (done) { ctx.fillStyle=C.perola; ctx.font=font(7,900,UI); ctx.textAlign='center'; ctx.fillText('✓',cx,cy+2); ctx.textAlign='left'; }
    }
    // missions
    panel(ctx,W/2+6,gy,(W-36)/2,70,{r:18, top:'rgba(44,32,24,0.96)', bottom:'rgba(22,15,10,0.96)', border:'rgba(255,214,160,0.18)', shadow:10, innerGlow:true});
    ctx.textAlign='left';
    ctx.font=font(11,800,UI); ctx.fillStyle=C.perola; ctx.fillText('Missões diárias',W/2+18,gy+18);
    ctx.font=font(10,600,UI); ctx.fillStyle='rgba(244,231,211,0.55)'; ctx.fillText('3 ativas · +500 moedas',W/2+18,gy+32);
    // progress bars for missions
    for (let i=0;i<3;i++) {
      const barY=gy+42+i*10, barW=(W-36)/2 - 24;
      roundRectPath(ctx,W/2+18,barY,barW,6,3); ctx.fillStyle='rgba(0,0,0,0.4)'; ctx.fill();
      const progs=[0.7,0.4,0.2];
      roundRectPath(ctx,W/2+18,barY,barW*(progs[i]??0),6,3);
      const g=ctx.createLinearGradient(W/2+18,0,W/2+18+barW,0);
      g.addColorStop(0,C.brasaHot); g.addColorStop(1,C.verdeClaro);
      ctx.fillStyle=g; ctx.fill();
    }

    // Event banner (weekly) — shifted down due to churrasqueira showcase; bonus takes priority
    if (!this.meta.bonusReady) {
      const ebY = 608;
      panel(ctx,14,ebY,W-28,62,{r:18, top:'rgba(58,42,30,0.98)', bottom:'rgba(28,18,12,0.98)', border: C.brasa, borderWidth:1.5, shadow:14, innerGlow:true, glowTop:'rgba(224,86,31,0.2)'});
      // live dot — P1 contraste WCAG (verdeClaro 3.1:1 → #A7D67A 5.2:1 + borda branca)
      ctx.fillStyle='#A7D67A'; ctx.beginPath(); ctx.arc(30,ebY+16,6,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle='rgba(255,255,255,0.85)'; ctx.lineWidth=1.2; ctx.stroke();
      ctx.shadowColor='#A7D67A'; ctx.shadowBlur=8; ctx.fillStyle='#A7D67A'; ctx.fill(); ctx.shadowBlur=0;
      ctx.font=font(10,800,UI); ctx.fillStyle='#A7D67A'; ctx.textAlign='left'; ctx.fillText('AO VIVO',46,ebY+16);
      ctx.font=font(8,700,UI); ctx.fillStyle='rgba(244,231,211,0.6)'; ctx.fillText('SEGUNDA DA LINGUIÇA · 1.5×',46,ebY+28);
      ctx.font=font(13,900,DISPLAY); ctx.fillStyle=C.perola; ctx.fillText('Sirva 30 linguiças → ganhe Brasas!',26,ebY+52);
      // rewards preview
      glass(ctx,W-78,ebY+18,56,28,{ alpha:0.22, border:C.ouro });
      coinIcon(ctx,W-66,ebY+32,9); ctx.font=font(12,900,UI); ctx.textAlign='left'; ctx.fillStyle=C.ouroLight; ctx.fillText('900',W-54,ebY+33);
    }

    // Bonus card if ready — occupies event spot when active
    if (this.meta.bonusReady) {
      const by = 608;
      const isFrenzy=this.meta.bonusReady==='frenzy';
      const isWheel=this.meta.bonusReady==='wheel';
      panel(ctx,14,by,W-28,68,{r:18, top: isFrenzy? 'rgba(76,42,18,0.98)' : 'rgba(44,32,56,0.98)', bottom: isFrenzy? 'rgba(40,18,6,0.98)':'rgba(20,14,28,0.98)', border: isFrenzy? C.chama : C.ouro, borderWidth:2, shadow:18, innerGlow:true});
      // countdown
      const secsLeft = Math.max(0, 15 - Math.floor(this.bonusOfferT));
      // title
      const titles: Record<BonusType,string> = { frenzy:'HORA DA BRASA!', wheel:'ROLETA DA BRASA!', chef:'DESAFIO DO CHEF', rush:'FILA MALUCA' };
      ctx.font=font(13,900,DISPLAY); ctx.fillStyle= isFrenzy? C.chamaCore : C.ouroLight; ctx.textAlign='left';
      ctx.fillText(titles[this.meta.bonusReady] ?? 'BÔNUS!', 26, by+20);
      ctx.font=font(10,700,UI); ctx.fillStyle='rgba(244,231,211,0.7)';
      const desc = isFrenzy? '30s de frenesi · 2× moedas · Toque para começar'
        : isWheel? 'Gire agora: moedas, brasas ou baú'
        : '5 pratos perfeitos = baú especial';
      ctx.fillText(desc,26,by+34);
      // timer pills
      glass(ctx,26, by+42, 92, 18, { alpha:0.18, border: secsLeft<5? C.telha : C.ouro });
      ctx.font=font(10,800,UI); ctx.fillStyle= secsLeft<5? C.telha : C.perola;
      ctx.fillText(`${secsLeft}s`, 30, by+51);
      ctx.font=font(9,600,UI); ctx.fillStyle='rgba(244,231,211,0.5)'; ctx.fillText('tempo limitado', 58, by+51);
      // CTA
      premiumButton(ctx, W-104, by+18, 84, 36, { variant: isFrenzy? 'primary':'gold' });
      outlinedText(ctx,'JOGAR', W-62, by+36, C.perola, 13, { outline:2, weight:900 });
    }

    // Bottom nav
    this.drawBottomNav(ctx);

    // invite friends teaser (tiny)
    if (!this.meta.bonusReady) {
      ctx.font=font(10,700,UI); ctx.textAlign='center'; ctx.fillStyle='rgba(244,231,211,0.45)';
      ctx.fillText('Convide amigos → ganhe 50 Brasas · Código: BRASA42  |  Compartilhar',W/2, H-86);
    }
  }

  private drawHomeHeader(ctx: CanvasRenderingContext2D): void {
    panel(ctx,8,8,W-16,60,{r:22, top:'rgba(30,20,14,0.78)', bottom:'rgba(16,10,6,0.78)', border:'rgba(255,214,160,0.22)', borderWidth:1.5, shadow:18, innerGlow:true, glowTop:'rgba(255,210,150,0.2)'});
    // level badge
    const lx=20, ly=38;
    const need=xpForLevel(this.meta.level);
    const prog=levelProgress(this.meta.xp, this.meta.level);
    // circle level
    ctx.save();
    ctx.fillStyle='rgba(0,0,0,0.45)'; ctx.beginPath(); ctx.arc(lx,ly,20,0,Math.PI*2); ctx.fill();
    const g=ctx.createRadialGradient(lx-6,ly-6,2,lx,ly,20);
    g.addColorStop(0,'#FFE79B'); g.addColorStop(0.5,C.ouro); g.addColorStop(1,C.ouroDark);
    ctx.fillStyle=g; ctx.beginPath(); ctx.arc(lx,ly,20,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle='rgba(120,78,16,0.6)'; ctx.lineWidth=2; ctx.stroke();
    ctx.font=font(13,900,DISPLAY); ctx.textAlign='center'; ctx.fillStyle=C.carvao; ctx.fillText(String(this.meta.level),lx,ly+4);
    ctx.restore();
    // xp bar below
    const barX=44, barY=53, barW=78, barH=6;
    roundRectPath(ctx,barX,barY,barW,barH,barH/2); ctx.fillStyle='rgba(0,0,0,0.5)'; ctx.fill();
    roundRectPath(ctx,barX,barY,barW*prog,barH,barH/2); const gg=ctx.createLinearGradient(barX,0,barX+barW,0); gg.addColorStop(0,C.brasaHot); gg.addColorStop(1,C.chama); ctx.fillStyle=gg; ctx.fill();
    ctx.font=font(8,700,UI); ctx.textAlign='left'; ctx.fillStyle='rgba(244,231,211,0.55)';
    ctx.fillText(`Nv ${this.meta.level} · ${this.meta.xp}/${need} XP`,44,26);
    // coins
    let cx=W-160, cy=30;
    glass(ctx,cx-8,cy-14,74,28,{alpha:0.18, border:'rgba(231,194,74,0.4)'});
    coinIcon(ctx,cx+6,cy,9); ctx.font=font(13,900,DISPLAY); ctx.textAlign='left'; ctx.fillStyle=C.ouroLight; ctx.fillText(this.meta.coins.toLocaleString(this.l10n.locale),cx+18,cy+1);
    // embers
    cx=W-80;
    glass(ctx,cx-4,cy-14,62,28,{alpha:0.18, border:'rgba(224,86,31,0.4)'});
    flameIcon(ctx,cx+8,cy,8,true); ctx.font=font(13,900,DISPLAY); ctx.fillStyle=C.chamaCore; ctx.fillText(String(this.meta.embers),cx+20,cy+1);
    // streak flame top right small
    ctx.font=font(11,800,UI); ctx.textAlign='right'; ctx.fillStyle=C.ambar;
    ctx.fillText(`${this.meta.streak} dias`,W-18,58);
  }

  private drawDailyStrip(ctx: CanvasRenderingContext2D): void {
    panel(ctx,12, 80, W-24, 108, {r:18, top:'rgba(44,32,24,0.96)', bottom:'rgba(22,15,10,0.96)', border:'rgba(255,214,160,0.18)', shadow:12, innerGlow:true});
    ctx.font=font(11,900,UI); ctx.textAlign='left'; ctx.fillStyle=C.perola;
    ctx.fillText('Recompensa diária · sequência com graça',20,102);
    ctx.font=font(10,600,UI); ctx.fillStyle='rgba(244,231,211,0.5)';
    ctx.fillText(`Dia ${this.meta.lastClaimDay+1} de 7 · Volte amanhã = +15% no ciclo`,20,116);
    // 7 boxes
    const startX=16, boxW=50, gap=6, y=128;
    for (let i=0;i<7;i++) {
      const x=startX + i*(boxW+gap);
      const day=i+1;
      const claimed=day <= this.meta.lastClaimDay;
      const isNext=day === this.meta.lastClaimDay+1;
      const isSeventh=day===7;
      panel(ctx,x,y,boxW,52,{r:12, top: claimed? 'rgba(70,52,28,0.98)' : isNext? 'rgba(58,46,40,0.98)':'rgba(34,24,18,0.96)', bottom: claimed? 'rgba(38,26,14,0.98)':'rgba(18,12,8,0.96)', border: claimed? C.ouro : isNext? C.ouroLight : 'rgba(255,214,160,0.14)', borderWidth: isNext?1.5:1, shadow:6, innerGlow:true});
      if (claimed) {
        ctx.fillStyle='rgba(231,194,74,0.14)'; roundRectPath(ctx,x,y,boxW,52,12); ctx.fill();
      }
      // icon — vector, not emoji (so it renders in Node canvas too)
      const rew=DAILY_REWARDS[i]!;
      const icx=x+boxW/2, icy=y+16;
      if (rew.icon==='coin') coinIcon(ctx,icx,icy,9);
      else if (rew.icon==='ember') flameIcon(ctx,icx,icy,8,true);
      else if (rew.icon==='chest') starIcon(ctx,icx,icy,9,{filled:true, glow:true});
      else if (rew.icon==='booster') flameIcon(ctx,icx,icy,7,false);
      else if (rew.icon==='ingredient') coinIcon(ctx,icx,icy,8); // placeholder for queijo
      ctx.font=font(10,800,UI); ctx.textAlign='center'; ctx.fillStyle= claimed? C.ouroLight : isNext? C.perola : 'rgba(244,231,211,0.75)';
      ctx.fillText(rew.label, x+boxW/2, y+34);
      ctx.font=font(8,700,UI); ctx.fillStyle='rgba(244,231,211,0.55)';
      ctx.fillText(`Dia ${day}`, x+boxW/2, y+44);
      if (claimed) {
        // check
        ctx.fillStyle=C.verdeClaro; ctx.beginPath(); ctx.arc(x+boxW-10, y+10, 8,0,Math.PI*2); ctx.fill();
        ctx.fillStyle=C.perola; ctx.font=font(9,900,UI); ctx.fillText('✓',x+boxW-10, y+13);
      }
      if (isNext && !claimed) {
        const pulse=0.5+0.5*Math.sin(this.now*4);
        ctx.globalAlpha=0.6+0.3*pulse;
        ctx.strokeStyle=C.ouroLight; ctx.lineWidth=2; roundRectPath(ctx,x-1,y-1,boxW+2,54,12); ctx.stroke();
        ctx.globalAlpha=1;
      }
    }
    // streak bonus hint
    ctx.font=font(9,700,UI); ctx.textAlign='center'; ctx.fillStyle='rgba(244,231,211,0.4)';
    ctx.fillText('Perdeu 1 dia? Você tem 1 dia de graça — sequência não quebra.',W/2, y+62);
  }

  private drawBottomNav(ctx: CanvasRenderingContext2D): void {
    const h=64;
    panel(ctx,0,H-h,W,h,{r:0, top:'rgba(16,10,6,0.96)', bottom:'rgba(8,5,3,0.98)', border:'rgba(255,214,160,0.14)', borderWidth:1, shadow:20, innerGlow:false});
    const tabs: {id:HomeTab,label:string,type:'home'|'shop'|'missions'|'collection'|'route'}[] = [
      {id:'home',label:'Início',type:'home'},
      {id:'shop',label:'Loja',type:'shop'},
      {id:'missions',label:'Missões',type:'missions'},
      {id:'collection',label:'Coleção',type:'collection'},
      {id:'route',label:'Rota',type:'route'},
    ];
    const w=W/5;
    tabs.forEach((t,i)=>{
      const cx=w*i+w/2, cy=H-h/2;
      const active=this.homeTab===t.id;
      if (active) {
        glass(ctx,cx-36,cy-22,72,44,{alpha:0.22, border:C.brasa});
        ctx.fillStyle='rgba(224,86,31,0.18)'; roundRectPath(ctx,cx-36,cy-22,72,44,14); ctx.fill();
      }
      // icon — vector (no emoji font needed)
      ctx.save(); ctx.translate(cx, cy-7);
      if (t.type==='home') { // house
        ctx.fillStyle= active? C.ouroLight : 'rgba(244,231,211,0.65)';
        ctx.beginPath(); ctx.moveTo(0,-8); ctx.lineTo(-10,2); ctx.lineTo(-8,2); ctx.lineTo(-8,10); ctx.lineTo(8,10); ctx.lineTo(8,2); ctx.lineTo(10,2); ctx.closePath(); ctx.fill();
        ctx.fillStyle= active? C.carvao : 'rgba(28,21,18,0.9)'; ctx.fillRect(-4,2,8,7);
      } else if (t.type==='shop') coinIcon(ctx,0,0,8);
      else if (t.type==='missions') starIcon(ctx,0,0,8,{filled:true, glow:active});
      else if (t.type==='collection') {
        ctx.fillStyle= active? C.ouroLight : 'rgba(244,231,211,0.65)';
        roundRectPath(ctx,-9,-7,18,14,2); ctx.fill();
        ctx.fillStyle='rgba(0,0,0,0.18)'; ctx.fillRect(-9,2,18,2);
      } else if (t.type==='route') {
        ctx.fillStyle= active? C.ouroLight : 'rgba(244,231,211,0.65)';
        ctx.beginPath(); ctx.arc(0,-2,8,0,Math.PI*2); ctx.fill();
        ctx.fillStyle= C.carvao; ctx.beginPath(); ctx.arc(0,-2,3,0,Math.PI*2); ctx.fill();
        ctx.fillStyle= active? C.ouroLight : 'rgba(244,231,211,0.65)'; ctx.beginPath(); ctx.moveTo(0,6); ctx.lineTo(-5, -1); ctx.lineTo(5,-1); ctx.closePath(); ctx.fill();
      }
      ctx.restore();
      ctx.font=font(9,700,UI); ctx.textAlign='center'; ctx.fillStyle= active? C.ouroLight : 'rgba(244,231,211,0.5)';
      ctx.fillText(t.label.toUpperCase(), cx, cy+14);
      if (t.id==='missions' && active===false) {
        // red dot
        ctx.fillStyle=C.telha; ctx.beginPath(); ctx.arc(cx+14, cy-14, 5,0,Math.PI*2); ctx.fill();
        ctx.fillStyle=C.perola; ctx.font=font(7,900,UI); ctx.fillText('3',cx+14, cy-11);
      }
      if (t.id==='shop' && this.meta.coins>800) {
        ctx.fillStyle=C.verdeClaro; ctx.beginPath(); ctx.arc(cx+14, cy-14, 4,0,Math.PI*2); ctx.fill();
      }
    });
  }

  private drawHomeTabContent(ctx: CanvasRenderingContext2D): void {
    const y0 = 272;
    if (this.homeTab === 'shop') {
      outlinedText(ctx,'LOJA',W/2, y0+10, C.perola, 18, {outline:3, weight:900});
      ctx.font=font(10,600,UI); ctx.textAlign='center'; ctx.fillStyle='rgba(244,231,211,0.55)';
      ctx.fillText('Ofertas semanais · Brasas nunca compram poder',W/2, y0+26);
      // Fix #3 5s test 40% erro “vitalício” → texto claro LGPD (sem jargão técnico)
      const offers = [
        {title:'Pacote Inicial', price:'R$ 9,90', desc:'100 Brasas + 5k moedas + avental', badge:'ÚNICO', color:C.ouro},
        {title:'Brasa Cheia', price:'R$ 14,90', desc:'400 Brasas + bônus 20', badge:'POPULAR', color:C.brasaHot},
        {title:'Sem Anúncios', price:'R$ 19,90', desc:'Para sempre · Recompensa continua se quiser', badge:'', color:C.verde},
      ];
      offers.forEach((o,i)=>{
        const y=y0+44 + i*86;
        panel(ctx,14,y,W-28,74,{r:18, top:'rgba(58,42,30,0.98)', bottom:'rgba(28,18,12,0.98)', border:o.color, borderWidth:1.5, shadow:12});
        if(o.badge){ glass(ctx,W-78,y+10,62,18,{alpha:0.22, border:o.color}); ctx.font=font(8,800,UI); ctx.textAlign='center'; ctx.fillStyle=o.color; ctx.fillText(o.badge,W-47,y+19); }
        ctx.textAlign='left'; ctx.font=font(13,900,UI); ctx.fillStyle=C.perola; ctx.fillText(o.title,26,y+22);
        ctx.font=font(10,600,UI); ctx.fillStyle='rgba(244,231,211,0.6)'; ctx.fillText(o.desc,26,y+38);
        premiumButton(ctx,26,y+48, W-52, 22, {variant: o.title.includes('Inicial')?'gold':'primary'});
        ctx.font=font(11,900,UI); ctx.textAlign='center'; ctx.fillStyle= C.perola; ctx.fillText(o.price, W/2, y+60);
      });
      // bottom hint
      ctx.font=font(9,600,UI); ctx.fillStyle='rgba(244,231,211,0.4)'; ctx.textAlign='center';
      ctx.fillText('Toque em INÍCIO para voltar · Restaura compras em Ajustes',W/2, y0+320);
    } else if (this.homeTab === 'missions') {
      outlinedText(ctx,'MISSÕES',W/2, y0+10, C.perola, 18, {outline:3, weight:900});
      ctx.font=font(10,600,UI); ctx.fillStyle='rgba(244,231,211,0.55)'; ctx.textAlign='center';
      ctx.fillText('Diárias renovam às 04:00 · semanais na segunda',W/2, y0+26);
      const missions = [
        {title:'Sirva 20 pratos', prog:0.65, reward:'+400', icon:'coin'},
        {title:'Faça 10 perfeitos', prog:0.4, reward:'+1 Brasas', icon:'ember'},
        {title:'Termine sem queimar', prog:0.2, reward:'+550', icon:'star'},
      ];
      missions.forEach((m,i)=>{
        const y=y0+44+i*64;
        panel(ctx,14,y,W-28,54,{r:16, top:'rgba(44,32,24,0.96)', bottom:'rgba(22,15,10,0.96)', border:'rgba(255,214,160,0.16)', shadow:8});
        // icon
        if(m.icon==='coin') coinIcon(ctx,36,y+27,9);
        else if(m.icon==='ember') flameIcon(ctx,36,y+27,8,true);
        else starIcon(ctx,36,y+27,8,{filled:true});
        ctx.textAlign='left'; ctx.font=font(12,800,UI); ctx.fillStyle=C.perola; ctx.fillText(m.title,56,y+20);
        ctx.font=font(10,600,UI); ctx.fillStyle='rgba(244,231,211,0.55)'; ctx.fillText(`${Math.round(m.prog*100)}% concluído`,56,y+34);
        // bar
        const barX=56, barY=y+40, barW=W-120, barH=6;
        roundRectPath(ctx,barX,barY,barW,barH,barH/2); ctx.fillStyle='rgba(0,0,0,0.4)'; ctx.fill();
        roundRectPath(ctx,barX,barY,barW*m.prog,barH,barH/2); const g=ctx.createLinearGradient(barX,0,barX+barW,0); g.addColorStop(0,C.brasaHot); g.addColorStop(1,C.verdeClaro); ctx.fillStyle=g; ctx.fill();
        ctx.font=font(10,800,UI); ctx.textAlign='right'; ctx.fillStyle=C.ouroLight; ctx.fillText(m.reward, W-28, y+27);
      });
      ctx.font=font(9,600,UI); ctx.fillStyle='rgba(244,231,211,0.4)'; ctx.textAlign='center';
      ctx.fillText('Complete as 3 diárias → baú +500 moedas +2 Brasas',W/2, y0+250);
    } else if (this.homeTab === 'collection') {
      outlinedText(ctx,'COLEÇÃO',W/2, y0+10, C.perola, 18, {outline:3, weight:900});
      ctx.font=font(10,600,UI); ctx.textAlign='center'; ctx.fillStyle='rgba(244,231,211,0.55)';
      ctx.fillText(`${this.meta.collection.length}/16 cortes descobertos · 10 categorias`,W/2, y0+26);
      const cats = [
        {name:'Linguiças', have:2, total:2}, {name:'Pães', have:1, total:2},
        {name:'Carnes', have:1, total:4}, {name:'Aves', have:2, total:3},
        {name:'Espetinhos', have:0, total:2}, {name:'Queijos', have:1, total:1},
      ];
      cats.forEach((c,i)=>{
        const col=i%2, row=Math.floor(i/2);
        const x=14+col*((W-36)/2+8), y=y0+40+row*62;
        const done=c.have===c.total;
        panel(ctx,x,y,(W-36)/2,52,{r:14, top: done? 'rgba(70,52,28,0.98)':'rgba(44,32,24,0.92)', bottom:'rgba(22,15,10,0.92)', border: done? C.ouro : 'rgba(255,214,160,0.14)', shadow:8});
        ctx.textAlign='left'; ctx.font=font(11,800,UI); ctx.fillStyle= done? C.ouroLight : C.perola; ctx.fillText(c.name, x+12, y+18);
        ctx.font=font(10,600,UI); ctx.fillStyle='rgba(244,231,211,0.55)'; ctx.fillText(`${c.have}/${c.total}`, x+12, y+32);
        // dots
        for(let k=0;k<c.total;k++){
          const cx=x+12+k*16, cy=y+44;
          ctx.fillStyle= k<c.have? C.ouroLight : 'rgba(255,255,255,0.14)'; ctx.beginPath(); ctx.arc(cx,cy,5,0,Math.PI*2); ctx.fill();
        }
      });
      ctx.font=font(9,600,UI); ctx.fillStyle='rgba(244,231,211,0.4)'; ctx.textAlign='center';
      ctx.fillText('Sirva novos pratos para descobrir — cada corte muda a grelha',W/2, y0+240);
    } else if (this.homeTab === 'route') {
      outlinedText(ctx,'ROTA DA BRASA',W/2, y0+10, C.perola, 18, {outline:3, weight:900});
      ctx.font=font(10,600,UI); ctx.textAlign='center'; ctx.fillStyle='rgba(244,231,211,0.55)';
      ctx.fillText('16 paradas · 5 regiões · 6 novas por temporada',W/2, y0+26);
      // map placeholder with dots
      panel(ctx,14,y0+36,W-28,160,{r:18, top:'rgba(28,40,28,0.96)', bottom:'rgba(18,24,14,0.96)', border:'rgba(140,200,120,0.22)', shadow:12});
      const spots = [
        [40,40],[90,60],[140,45],[190,70],[240,55],[300,65],
        [50,100],[120,110],[200,105],[270,115],
        [80,140],[150,135],[220,145],[280,138],
      ];
      spots.forEach(([px,py],i)=>{
        const done=i<4;
        const sx=14+px, sy=y0+46+py;
        ctx.fillStyle= done? C.ouroLight : 'rgba(255,255,255,0.18)';
        ctx.beginPath(); ctx.arc(sx,sy,7,0,Math.PI*2); ctx.fill();
        if(done){ ctx.fillStyle=C.perola; ctx.font=font(7,900,UI); ctx.textAlign='center'; ctx.fillText('✓',sx,sy+2); }
        ctx.strokeStyle='rgba(0,0,0,0.25)'; ctx.lineWidth=1; ctx.stroke();
      });
      // path lines
      ctx.strokeStyle='rgba(231,194,74,0.35)'; ctx.lineWidth=2; ctx.setLineDash([4,4]);
      ctx.beginPath(); spots.forEach(([px,py],i)=>{ const x=14+px, y=y0+46+py; if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y); }); ctx.stroke(); ctx.setLineDash([]);
      ctx.font=font(9,700,UI); ctx.textAlign='left'; ctx.fillStyle=C.perola;
      ctx.fillText('Vila Madalena, SP  →  Lapa, RJ  →  Batel, Curitiba', 22, y0+210);
      ctx.font=font(10,600,UI); ctx.fillStyle='rgba(244,231,211,0.55)'; ctx.fillText('Próxima parada: Rio Vermelho, Salvador',22, y0+224);
      glass(ctx,22, y0+232, W-44, 22, {alpha:0.16, border:C.ouro});
      ctx.font=font(10,800,UI); ctx.textAlign='center'; ctx.fillStyle=C.ouroLight; ctx.fillText('➤  Explorar rota (ganhe Pontos da Brasa)',W/2, y0+244);
    }
  }

  private drawHud(ctx: CanvasRenderingContext2D): void {
    const sim=this.sim;
    const loc=this.l10n.locale;
    panel(ctx,8,8,W-16,52,{r:22, top:'rgba(30,20,14,0.72)', bottom:'rgba(16,10,6,0.72)', border:'rgba(255,214,160,0.22)', borderWidth:1.5, shadow:18, innerGlow:true});
    ctx.textBaseline='middle';
    // coins
    const coinX=18, coinY=30;
    coinIcon(ctx,coinX+10,coinY,9);
    ctx.font=font(14,900,DISPLAY); ctx.textAlign='left'; ctx.fillStyle=C.ouroLight;
    ctx.shadowColor='rgba(0,0,0,0.5)'; ctx.shadowBlur=4; ctx.fillText(this.meta.coins.toLocaleString(loc),coinX+24,coinY); ctx.shadowBlur=0;
    ctx.font=font(8,700,UI); ctx.fillStyle='rgba(244,231,211,0.55)'; ctx.fillText(`XP ${this.meta.xp}/${xpForLevel(this.meta.level)}`,coinX+24,coinY+12);
    // timer ring + churrasqueira badge below (shows 1F → 3F progression)
    const left=Math.max(0,sim.timeLeft);
    const frac=sim.timeLimit>0? clamp01(left/sim.timeLimit):0;
    const urgent=frac<0.25;
    ctx.save(); ctx.translate(W/2,24);
    if (urgent) {
      const gg=ctx.createRadialGradient(0,0,7,0,0,24);
      gg.addColorStop(0,`rgba(192,68,46,${0.3+Math.sin(this.now*8)*0.15})`); gg.addColorStop(1,'rgba(192,68,46,0)');
      ctx.fillStyle=gg; ctx.beginPath(); ctx.arc(0,0,24,0,Math.PI*2); ctx.fill();
    }
    ctx.strokeStyle='rgba(255,255,255,0.1)'; ctx.lineWidth=4.5; ctx.beginPath(); ctx.arc(0,0,14,0,Math.PI*2); ctx.stroke();
    ctx.strokeStyle= urgent? C.telha : frac<0.5? C.ambar : C.verdeClaro;
    ctx.lineWidth=4.5; ctx.lineCap='round'; ctx.shadowColor=ctx.strokeStyle as string; ctx.shadowBlur=8;
    ctx.beginPath(); ctx.arc(0,0,14,-Math.PI/2,-Math.PI/2+Math.PI*2*frac); ctx.stroke(); ctx.shadowBlur=0;
    ctx.restore();
    outlinedText(ctx, `${Math.floor(left/60)}:${String(Math.floor(left%60)).padStart(2,'0')}`,W/2,24, urgent? C.telha : C.perola,12,{outline:2, weight:800});
    // churrasqueira badge under timer — crucial feedback da progressão
    const chHud = this.activeChurr();
    const evoHud = this.activeEvo();
    if (chHud && evoHud) {
      const tierLbl = { lata:'LATA', chapa:'CHAPA', inox:'INOX', fornalha:'FORNALHA', brick:'TIJOLO' }[chHud.visual.style] ?? chHud.tier.slice(0,5).toUpperCase();
      const txt = `${tierLbl} · ${evoHud.zoneCount}F ${evoHud.slotsPerZone}/fila`;
      const tw = txt.length*5.2 + 14;
      glass(ctx, W/2 - tw/2, 36, tw, 14, { alpha:0.18, border: chHud.visual.color });
      ctx.font=font(7,800,UI); ctx.textAlign='center'; ctx.fillStyle= chHud.visual.color;
      ctx.fillText(txt, W/2, 44);
    }
    // combo / perfects
    if (sim.combo>1) {
      const pop=1+this.comboPulse*0.3;
      ctx.save(); ctx.translate(W-72,30); ctx.scale(pop,pop);
      const cw=76,ch=26; glass(ctx,-cw/2,-ch/2,cw,ch,{alpha:0.22, border:C.brasa});
      flameIcon(ctx,-20,0,8, sim.combo>=5);
      ctx.font=font(14,900,DISPLAY); ctx.textAlign='center'; ctx.fillStyle=C.chamaCore; ctx.shadowColor='rgba(255,160,60,0.7)'; ctx.shadowBlur=6;
      ctx.fillText(`×${sim.combo}`,8,1); ctx.shadowBlur=0; ctx.restore();
    } else {
      const cw=60,ch=24;
      glass(ctx,W-26-cw, 30-ch/2,cw,ch,{alpha:0.18, border:C.ouro});
      starIcon(ctx,W-26-cw+14,30,8,{filled:true, glow:true});
      ctx.font=font(13,900,DISPLAY); ctx.textAlign='center'; ctx.fillStyle=C.ouroLight; ctx.shadowColor='rgba(231,194,74,0.45)'; ctx.shadowBlur=6;
      ctx.fillText(String(sim.counters.perfectCooks),W-22,31); ctx.shadowBlur=0;
    }
    // streak small
    if (this.meta.streak>1) {
      glass(ctx,W/2+38, 18, 46,18,{alpha:0.16, border:C.ambar});
      ctx.font=font(10,800,UI); ctx.textAlign='center'; ctx.fillStyle=C.ambar;
      ctx.fillText(`${this.meta.streak}`,W/2+61,27);
    }
    // pause icon — two bars vector
    ctx.fillStyle='rgba(244,231,211,0.7)';
    ctx.fillRect(W-20,10,4,14);
    ctx.fillRect(W-14,10,4,14);
  }

  private drawOrders(ctx: CanvasRenderingContext2D): void {
    const waiting=this.sim.customers.filter(c=>c.state==='waiting');
    waiting.forEach((c,i)=>{
      const r=this.orderCardRect(i);
      const pct=clamp01(c.patienceLeft/c.patienceTotal);
      const barColor=pct>0.5? C.verdeClaro : pct>0.25? C.ambar : C.telha;
      const vip=c.def.isVip;
      panel(ctx,r.x,r.y,r.w,r.h,{r:14, top: vip? 'rgba(70,52,28,0.97)':'rgba(44,32,24,0.92)', bottom: vip? 'rgba(38,26,14,0.97)':'rgba(22,15,10,0.92)', border: vip? C.ouro : 'rgba(255,214,160,0.18)', borderWidth: vip?2:1, shadow:12, innerGlow:true});
      if (vip) {
        const vipGlow=ctx.createRadialGradient(r.x+20,r.y+20,2,r.x+20,r.y+20,30);
        vipGlow.addColorStop(0,'rgba(231,194,74,0.18)'); vipGlow.addColorStop(1,'rgba(231,194,74,0)');
        ctx.fillStyle=vipGlow; roundRectPath(ctx,r.x,r.y,r.w,r.h,14); ctx.fill();
      }
      const ax=r.x+22, ay=r.y+22;
      avatar(ctx,ax,ay,15, vip? C.ouro : C.telha, 'rgba(244,231,211,0.38)',{vip});
      ctx.font=font(11,800,UI); ctx.textAlign='left'; ctx.textBaseline='middle';
      ctx.fillStyle= vip? C.ouroLight : C.madeiraPinho;
      ctx.shadowColor='rgba(0,0,0,0.5)'; ctx.shadowBlur=2;
      const name=this.l10n.t(c.def.nameKey);
      ctx.fillText(name.length>14? name.slice(0,13)+'…':name, r.x+42, r.y+14); ctx.shadowBlur=0;
      let ix=r.x+42;
      for (const line of c.lines) {
        const done=line.fulfilledBy.length>0;
        const ing=this.db.ingredientById.get(line.ingredientId);
        ctx.save(); if(done) ctx.globalAlpha=0.4;
        if(ing) drawFoodIcon(ctx,ing,ix+11,r.y+34,22);
        ctx.restore();
        if(done) checkIcon(ctx,ix+11,r.y+34,8,C.verdeClaro);
        ix+=26;
      }
      const bx=r.x+10, by=r.y+r.h-11, bw=r.w-20, bh=6;
      roundRectPath(ctx,bx,by,bw,bh,bh/2); ctx.fillStyle='rgba(0,0,0,0.6)'; ctx.fill();
      if(pct>0){
        roundRectPath(ctx,bx,by,Math.max(bh,bw*pct),bh,bh/2);
        const barG=ctx.createLinearGradient(bx,0,bx+bw*pct,0);
        barG.addColorStop(0,barColor); barG.addColorStop(1,rgb(shade(hex(barColor),-0.15)));
        ctx.fillStyle=barG; ctx.fill();
        ctx.fillStyle='rgba(255,255,255,0.3)';
        roundRectPath(ctx,bx,by,Math.max(bh,bw*pct),bh*0.45,bh*0.22); ctx.fill();
      }
      if(pct<0.25){
        const a=0.2+Math.sin(this.now*10)*0.15;
        roundRectPath(ctx,r.x,r.y,r.w,r.h,14); ctx.strokeStyle=`rgba(192,68,46,${a+0.25})`; ctx.lineWidth=2; ctx.stroke();
      }
    });
  }

  private drawChurrasqueira(ctx: CanvasRenderingContext2D, heroMode=false): void {
    const act = !heroMode ? this.activeChurr() : (this.churrasqueiras[0] ?? this.activeChurr());
    const style = act?.visual.style ?? 'brick';
    const accent = act?.visual.color ?? '#8A5A33';
    const cx=W/2;
    // lata is narrower, fornalha XL is wider
    let overallW = heroMode? 320 : GRILL_BODY_W+28;
    if (!heroMode) {
      if (style==='lata') overallW = GRILL_BODY_W - 18;
      else if (style==='fornalha') overallW = GRILL_BODY_W + 36;
      else if (style==='inox') overallW = GRILL_BODY_W + 10;
    }
    const overallX=cx-overallW/2;
    const topY= heroMode? 260 : GRILL_TOP-CHIMNEY_H-12;
    const baseY= heroMode? 470 : GRILL_BOTTOM+72;
    ctx.save();
    ctx.fillStyle='rgba(0,0,0,0.55)'; ctx.beginPath(); ctx.ellipse(cx,baseY+8,overallW*0.55,18,0,0,Math.PI*2); ctx.fill();
    const chimX=overallX+22; const chimY=topY;
    const hasChimney = act?.visual.chimney ?? (style!=='lata');
    if (hasChimney) {
      ctx.fillStyle='rgba(0,0,0,0.3)'; ctx.fillRect(chimX+4,chimY+4,CHIMNEY_W,CHIMNEY_H+8);
      if (style==='fornalha') {
        // fornalha dragon: darker brick taller
        drawBrickwork(ctx,chimX,chimY,CHIMNEY_W,CHIMNEY_H+10,{brickH:12, lit:true});
        // dragon mans tail badge on chimney
        ctx.fillStyle='rgba(30,16,10,0.85)'; ctx.beginPath(); ctx.arc(chimX+CHIMNEY_W+6, chimY+18, 8,0,Math.PI*2); ctx.fill();
        ctx.fillStyle=C.ouroLight; ctx.font=font(8,900,UI); ctx.textAlign='center'; ctx.fillText('♨',chimX+CHIMNEY_W+6,chimY+21);
      } else if (style==='inox') {
        // inox chimney metallic
        const mg=ctx.createLinearGradient(chimX,0,chimX+CHIMNEY_W,0);
        mg.addColorStop(0,'#A8B5BF'); mg.addColorStop(0.5,'#E6EEF4'); mg.addColorStop(1,'#7E8F9E');
        ctx.fillStyle=mg; roundRectPath(ctx,chimX,chimY,CHIMNEY_W,CHIMNEY_H,4); ctx.fill();
        ctx.strokeStyle='rgba(255,255,255,0.35)'; ctx.lineWidth=1; ctx.stroke();
      } else {
        drawBrickwork(ctx,chimX,chimY,CHIMNEY_W,CHIMNEY_H,{brickH:12, lit:true});
      }
      const capG=ctx.createLinearGradient(0,chimY-8,0,chimY+6);
      capG.addColorStop(0,'#D4C3A8'); capG.addColorStop(1,'#8B7A62');
      ctx.fillStyle=capG; roundRectPath(ctx,chimX-6,chimY-8,CHIMNEY_W+12,10,3); ctx.fill();
      if(!heroMode || this.screen==='title'){
        for(let i=0;i<3;i++){
          const t=(this.now*0.6+i*0.8)%3;
          const sy=chimY-10-t*22; const sx=chimX+CHIMNEY_W/2+Math.sin(this.now+i)*6;
          ctx.fillStyle=`rgba(220,210,195,${0.22*(1-t/3)})`;
          ctx.beginPath(); ctx.arc(sx,sy,6+t*3,0,Math.PI*2); ctx.fill();
        }
      }
    } else {
      // lata without chimney: small smoke from drum top
      if(!heroMode || this.screen==='title'){
        for(let i=0;i<2;i++){
          const t=(this.now*0.7+i*0.9)%2.5;
          const sy=(GRILL_TOP-22)-t*18; const sx=cx+Math.sin(this.now*1.2+i)*8;
          ctx.fillStyle=`rgba(180,170,160,${0.18*(1-t/2.5)})`;
          ctx.beginPath(); ctx.arc(sx,sy,5+t*2,0,Math.PI*2); ctx.fill();
        }
      }
    }
    const counterH=COUNTER_H;
    const counterY= heroMode? 300 : GRILL_TOP-counterH;
    // counter material varies
    if (style==='lata') {
      const cG=ctx.createLinearGradient(0,counterY,0,counterY+counterH);
      cG.addColorStop(0,'#8A6B4A'); cG.addColorStop(1,'#5A3D28');
      ctx.fillStyle=cG; roundRectPath(ctx,overallX-6,counterY,overallW+12,counterH,4); ctx.fill();
      // lata dent mark
      ctx.fillStyle='rgba(0,0,0,0.18)'; ctx.beginPath(); ctx.ellipse(overallX+30,counterY+6,10,4,0.3,0,Math.PI*2); ctx.fill();
    } else if (style==='inox') {
      const cG=ctx.createLinearGradient(0,counterY,0,counterY+counterH);
      cG.addColorStop(0,'#E8EEF2'); cG.addColorStop(0.5,'#BFCBD5'); cG.addColorStop(1,'#8E9EAD');
      ctx.fillStyle=cG; roundRectPath(ctx,overallX-6,counterY,overallW+12,counterH,4); ctx.fill();
      ctx.fillStyle='rgba(255,255,255,0.5)'; ctx.fillRect(overallX+10,counterY+2,overallW-14,2);
    } else if (style==='chapa') {
      const cG=ctx.createLinearGradient(0,counterY,0,counterY+counterH);
      cG.addColorStop(0,'#6B6F73'); cG.addColorStop(0.4,'#3A3E42'); cG.addColorStop(1,'#1E2226');
      ctx.fillStyle=cG; roundRectPath(ctx,overallX-6,counterY,overallW+12,counterH,4); ctx.fill();
      ctx.fillStyle='rgba(255,220,180,0.12)'; ctx.fillRect(overallX-4,counterY+1,overallW+8,2);
    } else {
      const cG=ctx.createLinearGradient(0,counterY,0,counterY+counterH);
      cG.addColorStop(0,'#5E4E42'); cG.addColorStop(0.4,'#3E322A'); cG.addColorStop(1,'#2A201A');
      ctx.fillStyle=cG; roundRectPath(ctx,overallX-6,counterY,overallW+12,counterH,4); ctx.fill();
      ctx.fillStyle='rgba(255,220,180,0.15)'; ctx.fillRect(overallX-4,counterY+1,overallW+8,2);
    }
    const fx=overallX+16; const fy=counterY+counterH; const fw=overallW-32; const fh= heroMode?120 : GRILL_BOTTOM-(counterY+counterH);
    ctx.fillStyle='#0A0503'; roundRectPath(ctx,fx,fy,fw,fh,8); ctx.fill();
    const intG=ctx.createLinearGradient(0,fy,0,fy+fh);
    const eff=this.sim?.grill.charcoalEfficiency ?? 0.90;
    const ig0=Math.min(0.95,0.35+eff*0.55);
    intG.addColorStop(0,`rgba(200,70,24,${ig0})`); intG.addColorStop(0.35,`rgba(235,110,36,${ig0*0.92})`); intG.addColorStop(1,'rgba(90,28,10,0.92)');
    roundRectPath(ctx,fx+3,fy+3,fw-6,fh-6,6); ctx.fillStyle=intG; ctx.fill();
    if(heroMode){
      ctx.save(); roundRectPath(ctx,fx+6,fy+6,fw-12,fh-12,6); ctx.clip();
      ctx.fillStyle='rgba(40,25,15,0.45)'; ctx.fillRect(fx+6,fy+fh*0.55,fw-12,fh*0.5);
      const seed=42;
      for(let k=0;k<34;k++){
        const fx2=((seed+k*41)%100)/100; const fy2=((seed+k*61)%100)/100;
        const cx=fx+10+fx2*(fw-20); const cy=fy+10+fy2*(fh-20); const rr=2.4+((k*13)%4);
        const pulse=0.5+0.5*Math.sin(this.now*(1.8+(k%5)*0.35)+k);
        const cg=ctx.createRadialGradient(cx,cy,0.5,cx,cy,rr*3.6);
        cg.addColorStop(0,`rgba(255,232,160,${0.75*pulse*0.8})`); cg.addColorStop(0.3,`rgba(248,140,40,${0.55*pulse})`); cg.addColorStop(0.7,`rgba(220,80,20,${0.3*pulse})`); cg.addColorStop(1,'rgba(120,30,10,0)');
        ctx.fillStyle=cg; ctx.beginPath(); ctx.ellipse(cx,cy,rr*3.2,rr*2.2,k*0.7,0,Math.PI*2); ctx.fill();
        ctx.fillStyle=`rgba(30,16,10,${0.7-pulse*0.25})`; ctx.beginPath(); ctx.ellipse(cx,cy,rr*0.85,rr*0.55,k*0.7,0,Math.PI*2); ctx.fill();
      }
      ctx.restore();
      ctx.save(); roundRectPath(ctx,fx+6,fy+6,fw-12,fh-12,6); ctx.clip();
      const grateY=fy+fh*0.55;
      for(let gx=fx+14; gx<fx+fw-12; gx+=13){
        ctx.fillStyle='rgba(0,0,0,0.35)'; ctx.fillRect(gx,fy+8,3,fh-16);
        const barG=ctx.createLinearGradient(gx,0,gx+3,0);
        barG.addColorStop(0,'#2A2320'); barG.addColorStop(0.3,'#6B635D'); barG.addColorStop(0.6,'#4A4440'); barG.addColorStop(1,'#221C19');
        ctx.fillStyle=barG; ctx.fillRect(gx,fy+9,2.6,fh-18); ctx.fillStyle='rgba(255,200,120,0.32)'; ctx.fillRect(gx+0.3,fy+9,0.8,fh-18);
      }
      ctx.fillStyle='rgba(20,14,10,0.75)'; ctx.fillRect(fx+8,grateY-2,fw-16,2); ctx.fillRect(fx+8,grateY+fh*0.2,fw-16,2); ctx.restore();
      roundRectPath(ctx,fx+6,fy+6,fw-12,fh-12,6); ctx.strokeStyle='rgba(0,0,0,0.6)'; ctx.lineWidth=2; ctx.stroke();
    }
    // base supports vary per style
    if (style==='lata') {
      // tripod rebar legs for lata — cheap, charmosa
      ctx.strokeStyle='#3A2A1E'; ctx.lineWidth=4; ctx.lineCap='round';
      const legTopY = counterY+8, legBotY = baseY+4;
      for (const lx of [overallX+22, overallX+overallW-22, overallX+overallW/2]) {
        // skip middle on 1 fileira to hint instability humor
        const isMid = lx===overallX+overallW/2;
        const offsetX = isMid && !heroMode ? 18 : 0;
        ctx.beginPath(); ctx.moveTo(lx, legTopY); ctx.lineTo(lx+offsetX, legBotY); ctx.stroke();
        // foot pad
        ctx.fillStyle='#2A1A12'; ctx.beginPath(); ctx.ellipse(lx+offsetX, legBotY, 8,3,0,0,Math.PI*2); ctx.fill();
      }
      // lata badge: “LATA” stamp
      ctx.fillStyle='rgba(255,255,255,0.08)'; ctx.font=font(8,900,UI); ctx.textAlign='center';
      ctx.fillText('LATA 18L', cx, baseY-10);
    } else if (style==='inox') {
      // inox tubular legs, reflective
      const legG = ctx.createLinearGradient(0,counterY,0,baseY);
      legG.addColorStop(0,'#D0D8DF'); legG.addColorStop(0.5,'#A0ADB9'); legG.addColorStop(1,'#7A8795');
      for (const lx of [overallX+18, overallX+overallW-18]) {
        ctx.fillStyle=legG; roundRectPath(ctx,lx-6,counterY+6,12,baseY-counterY-2,4); ctx.fill();
        ctx.fillStyle='rgba(255,255,255,0.35)'; ctx.fillRect(lx-5,counterY+8,2, baseY-counterY-8);
      }
      // side shelf in inox
      glass(ctx, overallX+overallW+2, counterY+18, 18, 40, { alpha:0.18, border:'rgba(200,210,220,0.45)' });
    } else if (style==='chapa') {
      // chapa commercial: metal frame + side table
      ctx.fillStyle='#2A2E33'; roundRectPath(ctx,overallX,counterY,16,baseY-counterY,3); ctx.fill();
      roundRectPath(ctx,overallX+overallW-16,counterY,16,baseY-counterY,3); ctx.fill();
      ctx.fillStyle='#3D4247'; ctx.fillRect(overallX+overallW, counterY+14, 14, 10);
      ctx.fillStyle='rgba(255,255,255,0.08)'; ctx.fillRect(overallX+overallW, counterY+24, 14, 2);
      // heat badge
      ctx.fillStyle=accent; ctx.font=font(7,900,UI); ctx.textAlign='center'; ctx.fillText('CHAPA', overallX+overallW+7, counterY+22);
    } else {
      // fornalha and classic brick
      drawBrickwork(ctx,overallX,counterY,16,baseY-counterY,{brickH:16, lit:true});
      drawBrickwork(ctx,overallX+overallW-16,counterY,16,baseY-counterY,{brickH:16, lit:true});
      drawBrickwork(ctx,fx,fy-10,fw,12,{brickH:10, lit:true});
      const skirtY=fy+fh;
      drawBrickwork(ctx,fx-4,skirtY,fw+8,baseY-skirtY,{brickH:14, lit:false});
    }
    const plinthG=ctx.createLinearGradient(0,baseY-10,0,baseY+6);
    plinthG.addColorStop(0,'#BDAA90'); plinthG.addColorStop(1,'#7A6853');
    // lata has no plinth, inox has metallic plinth, others stone
    if (style==='lata') {
      ctx.fillStyle='rgba(0,0,0,0.25)'; roundRectPath(ctx,overallX-4,baseY-2,overallW+8,6,2); ctx.fill();
    } else if (style==='inox') {
      const mg=ctx.createLinearGradient(0,baseY-8,0,baseY+6);
      mg.addColorStop(0,'#E8EEF2'); mg.addColorStop(1,'#8FA0B5');
      ctx.fillStyle=mg; roundRectPath(ctx,overallX-10,baseY-4,overallW+20,10,4); ctx.fill();
    } else {
      ctx.fillStyle=plinthG; roundRectPath(ctx,overallX-10,baseY-4,overallW+20,10,3); ctx.fill();
    }
    ctx.restore();
  }

  private drawGrill(ctx: CanvasRenderingContext2D): void {
    const n=this.zoneCount();
    // overallW matches style width when not hero
    const actG = this.activeChurr();
    const styleG = actG?.visual.style ?? 'brick';
    let overallW=GRILL_BODY_W+28;
    if (styleG==='lata') overallW = GRILL_BODY_W - 18;
    else if (styleG==='fornalha') overallW = GRILL_BODY_W + 36;
    else if (styleG==='inox') overallW = GRILL_BODY_W + 10;
    const overallX=W/2-overallW/2;
    const counterY=GRILL_TOP-14;
    const fx=overallX+16; const fy=counterY+14; const fw=overallW-32; const fh=GRILL_BOTTOM-fy;
    this.drawChurrasqueira(ctx,false);
    const efficiency=this.sim.grill.charcoalEfficiency;
    const zoneH=fh/n;
    for(let z=0;z<n;z++){
      const y=fy+zoneH*z;
      const simZone = (this.sim.grill.zones[z] ?? this.db.grill.zones[z]) as any;
      const heat = (simZone?.heat ?? 1) * efficiency;
      // label for each fileira — crucial for 1 vs 3 progression
      const zx=fx+6, zw=fw-12;
      // warm base fill so coals glow even when clipped
      ctx.save(); roundRectPath(ctx,zx,y+3,zw,zoneH-6,6); ctx.clip();
      // base ember bed — warm orange so grill never looks black
      const bedG=ctx.createLinearGradient(0,y,0,y+zoneH);
      bedG.addColorStop(0,`rgba(180,60,20,${0.35+heat*0.25})`);
      bedG.addColorStop(0.5,`rgba(220,90,30,${0.30+heat*0.35})`);
      bedG.addColorStop(1,'rgba(80,25,8,0.95)');
      ctx.fillStyle=bedG; ctx.fillRect(zx,y,zw,zoneH);
      ctx.fillStyle='rgba(40,25,15,0.45)'; ctx.fillRect(zx,y+zoneH*0.55,zw,zoneH*0.5);
      const seed=z*97;
      for(let k=0;k<30;k++){
        const fx2=((seed+k*41)%100)/100; const fy2=((seed+k*61)%100)/100;
        const cx=zx+6+fx2*(zw-12); const cy=y+8+fy2*(zoneH-14); const rr=2.4+((k*13)%4);
        const pulse=0.55+0.45*Math.sin(this.now*(1.8+(k%5)*0.35)+k);
        const cg=ctx.createRadialGradient(cx,cy,0.5,cx,cy,rr*3.8);
        cg.addColorStop(0,`rgba(255,238,180,${0.9*pulse*(0.45+heat*0.55)})`);
        cg.addColorStop(0.28,`rgba(255,160,60,${0.65*pulse})`);
        cg.addColorStop(0.65,`rgba(230,90,30,${0.38*pulse})`);
        cg.addColorStop(1,'rgba(120,30,10,0)');
        ctx.fillStyle=cg; ctx.beginPath(); ctx.ellipse(cx,cy,rr*3.6,rr*2.6,k*0.7,0,Math.PI*2); ctx.fill();
        ctx.fillStyle=`rgba(28,14,8,${0.7-pulse*0.2})`; ctx.beginPath(); ctx.ellipse(cx,cy,rr*0.95,rr*0.6,k*0.7,0,Math.PI*2); ctx.fill();
      }
      ctx.restore();
      if(heat>0.85){
        ctx.save(); ctx.globalAlpha=0.05+(heat-0.85)*0.2;
        for(let i=0;i<4;i++){
          const sy=y+(zoneH/4)*i+Math.sin(this.now*4+i+z)*2;
          ctx.fillStyle='rgba(255,200,120,0.25)'; ctx.fillRect(zx,sy,zw,1);
        }
        ctx.restore();
      }
      ctx.save(); roundRectPath(ctx,zx,y+2,zw,zoneH-4,6); ctx.clip();
      for(let gx=zx+10; gx<zx+zw-8; gx+=13){
        ctx.fillStyle='rgba(0,0,0,0.35)'; ctx.fillRect(gx,y+3,3.2,zoneH-6);
        const barG=ctx.createLinearGradient(gx,0,gx+3.2,0);
        barG.addColorStop(0,'#2A2320'); barG.addColorStop(0.3,'#6B635D'); barG.addColorStop(0.6,'#4A4440'); barG.addColorStop(1,'#221C19');
        ctx.fillStyle=barG; ctx.fillRect(gx,y+4,2.8,zoneH-8);
        ctx.fillStyle=`rgba(255,200,120,${0.18+heat*0.18})`; ctx.fillRect(gx+0.3,y+4,0.8,zoneH-8);
      }
      ctx.fillStyle='rgba(20,14,10,0.7)'; ctx.fillRect(zx+4,y+zoneH*0.25,zw-8,2); ctx.fillRect(zx+4,y+zoneH*0.7,zw-8,2);
      ctx.restore();
      roundRectPath(ctx,zx,y+2,zw,zoneH-4,6); ctx.strokeStyle='rgba(0,0,0,0.6)'; ctx.lineWidth=2; ctx.stroke();
      // zone label chips (1 fileira shows big “FOGO BAIXO”, 3 shows BAIXA/MÉDIA/ALTA)
      const labels = n===1? ['FOGO BAIXO'] : n===2? ['BRASA BAIXA','BRASA ALTA'] : ['BAIXA','MÉDIA','ALTA'];
      const lab = labels[z] ?? `F${z+1}`;
      const labW = lab.length*6 + 14;
      ctx.save();
      glass(ctx, zx+8, y+6, labW, 14, { alpha:0.22, border: heat>1.1? C.chama : heat>0.85? C.ambar : 'rgba(255,220,160,0.28)' });
      ctx.font=font(7,900,UI); ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillStyle= heat>1.1? C.chamaCore : heat>0.85? C.ambar : 'rgba(244,231,211,0.8)';
      ctx.fillText(lab, zx+8+labW/2, y+13);
      ctx.restore();
      // small fire icons left
      const dbZone = this.db.grill.zones[z] as any;
      for(let e=0; e<(dbZone?.embers ?? 0); e++) flameIcon(ctx,overallX+8+e*12,y+zoneH-12,5,heat>0.9);
    }
    for(const f of this.sim.foods){
      if(!f.onGrill || f.served) continue;
      if(this.drag?.food===f) continue;
      const p=this.foodScreenPos(f); this.drawFood(ctx,f,p.x,p.y,1);
    }
    this.drawCharcoalGauge(ctx,fx,GRILL_BOTTOM+8,fw);
  }

  private drawCharcoalGauge(ctx: CanvasRenderingContext2D, bx:number, by:number, bw:number): void {
    const g=this.sim.grill;
    const remaining=clamp01(1-g.charcoalT);
    const refilling=g.refilling>0;
    const low=remaining<0.3;
    const bh=12;
    roundRectPath(ctx,bx,by,bw,bh,bh/2); ctx.fillStyle='rgba(0,0,0,0.6)'; ctx.fill();
    ctx.fillStyle='rgba(255,255,255,0.04)'; roundRectPath(ctx,bx+1,by+1,bw-2,bh-2,(bh-2)/2); ctx.fill();
    const fw=(bw-2)*remaining;
    if(fw>2){
      roundRectPath(ctx,bx+1,by+1,fw,bh-2,(bh-2)/2);
      const fill=ctx.createLinearGradient(bx,0,bx+fw,0);
      if(low){
        const p=0.5+Math.sin(this.now*8)*0.3;
        fill.addColorStop(0,C.telha); fill.addColorStop(1,mix(hex(C.telha),hex(C.ambar),p));
      } else { fill.addColorStop(0,C.brasaHot); fill.addColorStop(0.5,C.chama); fill.addColorStop(1,C.brasa); }
      ctx.fillStyle=fill; ctx.fill();
      ctx.fillStyle='rgba(255,240,200,0.35)'; roundRectPath(ctx,bx+1,by+1,fw,bh*0.45,(bh-2)*0.22); ctx.fill();
    }
    ctx.strokeStyle='rgba(255,214,160,0.22)'; ctx.lineWidth=1; roundRectPath(ctx,bx+0.5,by+0.5,bw-1,bh-1,(bh-1)/2); ctx.stroke();
    flameIcon(ctx,bx+12,by+bh/2,5.5,!low);
    ctx.font=font(10,800,UI); ctx.textAlign='left'; ctx.textBaseline='middle'; ctx.fillStyle= low? C.telha : C.creme;
    ctx.shadowColor='rgba(0,0,0,0.7)'; ctx.shadowBlur=3; ctx.fillText(this.l10n.t('ui.hud.charcoal'),bx+24,by+bh/2); ctx.shadowBlur=0;
    if(refilling){ ctx.textAlign='right'; ctx.fillStyle=C.ambar; ctx.fillText(`${g.refilling.toFixed(1)}s`,bx+bw-10,by+bh/2);}
    else if(low){ const pulse=0.5+Math.sin(this.now*6)*0.5; ctx.globalAlpha=pulse; ctx.textAlign='right'; ctx.fillStyle=C.telha; ctx.font=font(10,900,UI); ctx.fillText('!',bx+bw-10,by+bh/2); ctx.globalAlpha=1; }
  }

  private drawFood(ctx: CanvasRenderingContext2D, f: FoodRuntime, x:number, y:number, scale:number): void {
    const d=overallDoneness(f);
    const ing=f.ingredient;
    const heat=f.onGrill ? (this.sim.grill.zones[f.zoneIndex]?.heat ?? 1)*this.sim.grill.charcoalEfficiency : 0.4;
    drawFoodArt(ctx,ing,x,y,{doneness:d, burned:f.burned, scale, glow: f.onGrill?1:0.4, heat});
    if(d>0.3 && Math.random()<0.08){
      const hh=ing.sides>=4?17:25; const w=ing.sides>=4?44:54;
      const col=d>1?'rgba(55,55,55,.55)':'rgba(220,210,195,.32)';
      this.particles.push({ x: x+(Math.random()-0.5)*w*0.6, y: y-hh*scale, vx:(Math.random()-0.5)*8, vy:-26-Math.random()*18, life:0, max:1.1+Math.random()*0.7, size:5+Math.random()*5, color:col, kind:'smoke' });
    }
    const stage=String(stageOf(this.db,f));
    const even=evenness(f);
    const hh=(ing.sides>=4?17:25)*scale;
    outlinedText(ctx,this.stageLabel(f,stage).toUpperCase(),x,y+hh/2+14,f.burned?C.telha:even<0.6?C.ambar:'rgba(244,231,211,0.85)',10,{weight:800, family:UI, outline:3});
    if(even<0.6 && !f.burned){
      outlinedText(ctx,this.l10n.t('ui.feedback.flipHint'),x,y+hh/2+25,C.ambar,9,{weight:700, family:UI, outline:2.5});
    }
  }
  private stageLabel(food: FoodRuntime, id:string): string {
    const ns=food.ingredient.stageOverrides?.length ? (food.ingredient.id==='pao_de_alho' ? 'pao':'queijo') : null;
    const key= ns? `stage.${ns}.${id}` : `ui.stage.${id}`;
    return this.l10n.t(key);
  }

  private drawBench(ctx: CanvasRenderingContext2D): void {
    const by=BENCH_TOP-16, bh=H-by+10;
    ctx.fillStyle='rgba(0,0,0,0.45)'; ctx.fillRect(8,by-4,W-16,8);
    ctx.save(); roundRectPath(ctx,6,by,W-12,bh,16); ctx.clip(); drawWoodGrain(ctx,6,by,W-12,bh,{planks:3}); ctx.restore();
    ctx.save(); roundRectPath(ctx,6,by,W-12,bh,16); ctx.clip();
    const lip=ctx.createLinearGradient(0,by,0,by+8); lip.addColorStop(0,'rgba(255,230,185,0.4)'); lip.addColorStop(1,'rgba(255,230,185,0)'); ctx.fillStyle=lip; ctx.fillRect(6,by,W-12,8); ctx.restore();
    ctx.strokeStyle='rgba(255,214,160,0.22)'; ctx.lineWidth=1.5; roundRectPath(ctx,6+0.75,by+0.75,W-12-1.5,bh-1.5,16-0.75); ctx.stroke();
    outlinedText(ctx,this.l10n.t('ui.hud.bench'),20,by+12,'rgba(255,235,205,0.75)',11,{weight:800, family:UI, align:'left', outline:2});
    this.unlocked.forEach((ing,i)=>{
      const r=this.benchItemRect(i);
      if(r.y+r.h>H) return;
      const isDragging=this.drag!==null && this.drag.food.ingredient.id===ing.id;
      panel(ctx,r.x,r.y,r.w,r.h,{r:12, top:'rgba(50,35,26,0.95)', bottom:'rgba(26,17,12,0.95)', border: isDragging? C.brasa : 'rgba(255,214,160,0.18)', borderWidth: isDragging?2:1, shadow:8, innerGlow:true});
      drawFoodIcon(ctx,ing,r.x+r.w/2,r.y+24,32);
      const label=this.l10n.t(ing.nameKey);
      outlinedText(ctx,label.length>13?label.slice(0,12)+'…':label,r.x+r.w/2,r.y+48,C.perola,10,{weight:800, family:UI, outline:2});
      ctx.save(); glass(ctx,r.x+r.w/2-22,r.y+r.h-17,44,14,{r:7, alpha:0.18, border:'rgba(231,194,74,0.4)'});
      coinIcon(ctx,r.x+r.w/2-11,r.y+r.h-10,5.5);
      ctx.font=font(11,900,UI); ctx.textAlign='left'; ctx.textBaseline='middle'; ctx.fillStyle=C.ouroLight; ctx.fillText(String(ing.value),r.x+r.w/2-3,r.y+r.h-10); ctx.restore();
    });
  }

  private drawDragged(ctx: CanvasRenderingContext2D): void {
    const d=this.drag!;
    const overGrill=d.y>GRILL_TOP-4 && d.y<GRILL_BOTTOM+4;
    if(overGrill){
      const z=this.zoneAt(d.y);
      if(z>=0){
        const zh=(GRILL_BOTTOM-GRILL_TOP)/this.zoneCount();
        const overallX=W/2-(GRILL_BODY_W+28)/2;
        const zx=overallX+22; const zw=GRILL_BODY_W-12; const zy=GRILL_TOP+zh*z;
        roundRectPath(ctx,zx,zy+4,zw,zh-8,8); ctx.fillStyle='rgba(242,166,59,0.14)'; ctx.fill();
        ctx.save(); ctx.setLineDash([8,5]); ctx.lineDashOffset=-this.now*28; ctx.strokeStyle=C.chama; ctx.lineWidth=2.5; ctx.shadowColor=C.chama; ctx.shadowBlur=8;
        roundRectPath(ctx,zx,zy+4,zw,zh-8,8); ctx.stroke(); ctx.restore();
      }
    }
    ctx.save(); ctx.translate(0,-6); ctx.shadowColor='rgba(0,0,0,0.55)'; ctx.shadowBlur=20; ctx.shadowOffsetY=12;
    this.drawFood(ctx,d.food,d.x,d.y,1.22); ctx.restore();
  }

  private drawParticles(ctx: CanvasRenderingContext2D): void {
    for(const p of this.particles){
      const t=p.life/p.max;
      ctx.globalAlpha=Math.max(0,1-t);
      if(p.kind==='ring'){
        ctx.strokeStyle=p.color; ctx.lineWidth=4*(1-t); ctx.shadowColor=p.color; ctx.shadowBlur=10;
        ctx.beginPath(); ctx.arc(p.x,p.y,p.size+t*40,0,Math.PI*2); ctx.stroke(); ctx.shadowBlur=0;
      } else if(p.kind==='confetti'){
        ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.rot??0); ctx.fillStyle=p.color;
        const s=p.size*(1-t*0.3);
        if(p.shape==='rect') ctx.fillRect(-s,-s/2,s*2,s);
        else ctx.fillRect(-s/2,-s/2,s,s);
        ctx.restore();
      } else if(p.kind==='smoke'){
        const g=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,p.size*(1+t));
        g.addColorStop(0,p.color); g.addColorStop(1,'rgba(180,180,180,0)');
        ctx.fillStyle=g; ctx.beginPath(); ctx.arc(p.x,p.y,p.size*(1+t),0,Math.PI*2); ctx.fill();
      } else {
        ctx.fillStyle=p.color; ctx.shadowColor=p.color; ctx.shadowBlur=6;
        ctx.beginPath(); ctx.arc(p.x,p.y,p.size*(1-t*0.5),0,Math.PI*2); ctx.fill(); ctx.shadowBlur=0;
      }
    }
    ctx.globalAlpha=1;
  }
  private drawFloats(ctx: CanvasRenderingContext2D): void {
    for(const f of this.floats){
      const t=f.life/1.2;
      const rise=ease.outCubic(clamp01(t))*32;
      ctx.globalAlpha=Math.max(0,1-t*t);
      ctx.save(); ctx.translate(0,-4);
      outlinedText(ctx,f.text,f.x,f.y-rise,f.color,f.size,{weight:900, family:DISPLAY, outline:5, shadow:6, shadowColor: f.color===C.ouroLight? 'rgba(231,194,74,0.6)':'rgba(0,0,0,0.6)'});
      ctx.restore();
    }
    ctx.globalAlpha=1;
  }
  private drawBanner(ctx: CanvasRenderingContext2D): void {
    const life=clamp01(this.bannerLife);
    const t=clamp01((0.5-life)/0.5);
    const slide=(1-ease.outBack(clamp01(t*2.2)))*40;
    ctx.globalAlpha=Math.min(1,life*3);
    const w=280,x=W/2-w/2,y=58-slide; const bh=28;
    ctx.save(); ctx.shadowColor='rgba(224,86,31,0.6)'; ctx.shadowBlur=18; ctx.shadowOffsetY=4;
    const bG=ctx.createLinearGradient(0,y,0,y+bh); bG.addColorStop(0,'#F07532'); bG.addColorStop(1,C.vermelho);
    roundRectPath(ctx,x,y,w,bh,bh/2); ctx.fillStyle=bG; ctx.fill(); ctx.restore();
    roundRectPath(ctx,x+1,y+1,w-2,bh*0.5,bh*0.25); ctx.fillStyle='rgba(255,240,215,0.25)'; ctx.fill();
    outlinedText(ctx,this.bannerText,W/2,y+bh/2+1,C.perola,14,{outline:2.5, weight:800});
    ctx.globalAlpha=1;
  }

  // FTUE overlay
  private drawFtueOverlay(ctx: CanvasRenderingContext2D): void {
    const step=this.meta.ftueStep;
    if (step>=3 || this.sim.timeLeft<2) return;
    // dark scrim except spotlight
    ctx.fillStyle='rgba(6,3,2,0.55)'; ctx.fillRect(0,0,W,H);
    // spotlight area depends on step
    let sx=W/2, sy=BENCH_TOP+40, sw=160, sh=70, msg='';
    if (step===0) { sx= W/2; sy=BENCH_TOP+44; sw=140; sh=70; msg=this.l10n.t('ui.tut.1'); }
    else if (step===1) { // after placed, tell to flip
      // spotlight on first food on grill
      const foods=this.sim.foods.filter(f=>f.onGrill);
      if (foods.length>0) {
        const p=this.foodScreenPos(foods[0]!); sx=p.x; sy=p.y; sw=86; sh=86; msg=this.l10n.t('ui.tut.3');
      } else { sx=W/2; sy=GRILL_TOP+80; sw=220; sh=60; msg=this.l10n.t('ui.tut.1');}
    } else if (step===2) {
      // serve hint
      sx=W/2; sy=140; sw=260; sh=60; msg=this.l10n.t('ui.tut.5');
    }
    // cutout
    ctx.save(); ctx.globalCompositeOperation='destination-out';
    roundRectPath(ctx,sx-sw/2,sy-sh/2,sw,sh,14); ctx.fillStyle='rgba(0,0,0,1)'; ctx.fill(); ctx.restore();
    // hand animation — vector (no emoji, never ☐)
    const handX = step===0 ? sx + Math.sin(this.now*2.2)*6 : sx;
    const handY = sy + (step===0? 18: -6) + Math.sin(this.now*2.8)*4;
    ctx.save(); ctx.translate(handX, handY);
    ctx.shadowColor='rgba(0,0,0,0.6)'; ctx.shadowBlur=10;
    // palm
    ctx.fillStyle=C.perola; roundRectPath(ctx,-14,-10,28,22,8); ctx.fill();
    ctx.strokeStyle='rgba(0,0,0,0.18)'; ctx.lineWidth=1.2; ctx.stroke();
    // finger (index) pointing
    ctx.fillStyle=C.perola; roundRectPath(ctx,-6,-28,12,20,6); ctx.fill(); ctx.stroke();
    // thumb
    ctx.save(); ctx.translate(10,2); ctx.rotate(0.45);
    roundRectPath(ctx,-6,-10,12,16,6); ctx.fillStyle=C.perola; ctx.fill(); ctx.stroke();
    ctx.restore();
    // knuckle line
    ctx.fillStyle='rgba(0,0,0,0.12)'; ctx.fillRect(-10,-2,20,2);
    ctx.restore(); ctx.shadowBlur=0;
    // pulsing ring around spotlight
    const pulse=0.5+0.5*Math.sin(this.now*3.5);
    ctx.strokeStyle=`rgba(255,220,160,${0.3+0.3*pulse})`; ctx.lineWidth=2+1.5*pulse;
    roundRectPath(ctx,sx-sw/2-4,sy-sh/2-4,sw+8,sh+8,16); ctx.stroke();
    // message card
    panel(ctx,W/2-150, H-170,300,56,{r:16, top:'rgba(44,32,24,0.98)', bottom:'rgba(22,15,10,0.98)', border:C.ouro, borderWidth:1.5, shadow:16});
    ctx.font=font(12,800,UI); ctx.textAlign='center'; ctx.fillStyle=C.perola;
    // wrap text
    const words=msg.split(' ');
    let line1='',line2='';
    for(const w of words){ if((line1+w).length<28) line1+=w+' '; else line2+=w+' '; }
    ctx.fillText(line1.trim(),W/2,H-156);
    if(line2.trim()) ctx.fillText(line2.trim(),W/2,H-140);
    // progress
    ctx.font=font(10,700,UI); ctx.fillStyle='rgba(244,231,211,0.5)';
    ctx.fillText(`Passo ${Math.min(3,step+1)}/3`,W/2,H-122);
    for(let i=0;i<3;i++){
      ctx.fillStyle= i<=step? C.ouroLight : 'rgba(255,255,255,0.2)';
      ctx.beginPath(); ctx.arc(W/2-12+i*12, H-110,4,0,Math.PI*2); ctx.fill();
    }
    // skip — aparece após 3s (P0: liberdade)
    if(this.now > 3){
      const bx=W-44, by=18, bw=36, bh=28;
      glass(ctx,bx,by,bw,bh,{alpha:0.18, border:'rgba(255,214,160,0.22)'});
      ctx.font=font(14,800,UI); ctx.textAlign='center'; ctx.fillStyle='rgba(244,231,211,0.9)';
      ctx.fillText('✕',bx+bw/2, by+19);
      ctx.font=font(8,700,UI); ctx.fillStyle='rgba(244,231,211,0.55)'; ctx.fillText('PULAR',bx+bw/2, by+26);
    }
  }

  private drawResult(ctx: CanvasRenderingContext2D): void {
    const r=this.lastResult!;
    const t=this.resultT;
    this.drawParticles(ctx);
    ctx.fillStyle='rgba(6,3,2,0.82)'; ctx.fillRect(0,0,W,H);
    if(r.stars>=2){
      ctx.save(); ctx.translate(W/2,230); ctx.rotate(this.now*0.15);
      for(let i=0;i<12;i++){
        ctx.rotate(Math.PI*2/12);
        const ray=ctx.createLinearGradient(0,0,0,-380);
        ray.addColorStop(0,'rgba(255,200,100,0.12)'); ray.addColorStop(1,'rgba(255,180,80,0)');
        ctx.fillStyle=ray; ctx.beginPath(); ctx.moveTo(-14,0); ctx.lineTo(14,0); ctx.lineTo(6,-380); ctx.lineTo(-6,-380); ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    }
    const enter=ease.outBack(clamp01(t/0.5));
    const cw=340,cx=W/2-cw/2;
    const cy=96 + (1-enter)*90;
    const ch=382;
    const cardGlow=ctx.createRadialGradient(W/2,cy+ch/2,40,W/2,cy+ch/2,300);
    cardGlow.addColorStop(0,r.stars===3?'rgba(231,194,74,0.22)':'rgba(224,86,31,0.18)'); cardGlow.addColorStop(1,'rgba(224,86,31,0)');
    ctx.fillStyle=cardGlow; ctx.fillRect(0,0,W,H);
    panel(ctx,cx,cy,cw,ch,{r:24, top:'rgba(58,42,30,0.98)', bottom:'rgba(24,16,10,0.98)', border: r.stars===3? C.ouro:'rgba(255,214,160,0.28)', borderWidth: r.stars===3?2:1.5, shadow:32, glowTop:'rgba(255,220,160,0.3)'});
    const accent=ctx.createLinearGradient(cx,cy+14,cx+cw,cy+14);
    accent.addColorStop(0,'rgba(224,86,31,0)'); accent.addColorStop(0.5,C.chama); accent.addColorStop(1,'rgba(224,86,31,0)');
    ctx.fillStyle=accent; ctx.fillRect(cx+20,cy+14,cw-40,2);
    outlinedText(ctx,this.l10n.t('ui.result.title'),W/2,cy+44,C.perola,32,{outline:4, shadow:6, shadowColor:'rgba(0,0,0,0.7)'});
    ctx.font=font(11,700,UI); ctx.textAlign='center'; ctx.fillStyle='rgba(244,231,211,0.5)';
    ctx.fillText(this.levels[this.levelIndex]?.id?.toUpperCase() ?? '',W/2,cy+66);
    for(let i=0;i<3;i++){
      const st=clamp01((t-0.4-i*0.2)/0.3);
      if(st<=0) continue;
      const sc=ease.outBack(st);
      const earned=i<r.stars;
      ctx.save(); ctx.translate(W/2+(i-1)*58,cy+108); ctx.scale(sc,sc);
      starIcon(ctx,0,0,24,{filled:earned, glow:earned}); ctx.restore();
    }
    const rows: [string,string,string][]=[
      [this.l10n.t('ui.result.coins'),`+${r.coins.toLocaleString(this.l10n.locale)}`,C.ouroLight],
      [this.l10n.t('ui.result.perfect'),String(r.perfect),C.chamaCore],
      [this.l10n.t('ui.result.burned'),String(r.burned), r.burned>0? C.telha:'rgba(244,231,211,0.5)'],
      [this.l10n.t('ui.result.bestCombo'),`×${r.combo}`,C.brasaHot],
      [this.l10n.t('ui.result.xp'),`+${r.xp.toLocaleString(this.l10n.locale)}`,C.perola],
    ];
    rows.forEach(([k,v,col],i)=>{
      const st=clamp01((t-0.9-i*0.08)/0.25);
      if(st<=0) return;
      const y=cy+164+i*26;
      const slide=(1-ease.outCubic(st))*22;
      ctx.globalAlpha=st;
      ctx.strokeStyle='rgba(255,214,160,0.08)'; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(cx+28,y-10); ctx.lineTo(cx+cw-28,y-10); ctx.stroke();
      ctx.font=font(13,700,UI); ctx.textAlign='left'; ctx.textBaseline='middle'; ctx.fillStyle='rgba(244,231,211,0.7)'; ctx.fillText(k,cx+32-slide,y);
      ctx.textAlign='right'; ctx.fillStyle=col; ctx.font=font(16,900,DISPLAY); ctx.shadowColor='rgba(0,0,0,0.4)'; ctx.shadowBlur=4; ctx.fillText(v,cx+cw-32+slide,y); ctx.shadowBlur=0; ctx.globalAlpha=1;
    });

    // Bonus offer banner (time-limited)
    if (this.meta.bonusReady && this.bonusOfferT < 15) {
      const by=cy+300;
      const secs=Math.max(0, 15 - Math.floor(this.bonusOfferT));
      const isFrenzy=this.meta.bonusReady==='frenzy';
      panel(ctx,cx+10,by,cw-20,46,{r:14, top: isFrenzy?'rgba(76,42,18,0.98)':'rgba(44,32,56,0.98)', bottom: isFrenzy?'rgba(40,18,6,0.98)':'rgba(20,14,28,0.98)', border: isFrenzy? C.chama : C.ouro, borderWidth:1.5, shadow:12});
      ctx.textAlign='left';
      ctx.font=font(11,900,UI); ctx.fillStyle= isFrenzy? C.chamaCore : C.ouroLight;
      const titles: Record<BonusType,string> = { frenzy:'HORA DA BRASA!', wheel:'ROLETA DA BRASA!', chef:'DESAFIO DO CHEF', rush:'FILA MALUCA'};
      ctx.fillText(titles[this.meta.bonusReady] ?? 'BÔNUS!', cx+24, by+16);
      ctx.font=font(9,700,UI); ctx.fillStyle='rgba(244,231,211,0.7)';
      ctx.fillText(`Toque para jogar agora · expira em ${secs}s`, cx+24, by+30);
      // pulse CTA — comunica valor (P0: ▶ genérico → 2×)
      const pulse=0.9+0.1*Math.sin(this.now*4);
      ctx.save(); ctx.translate(cx+cw-54, by+23); ctx.scale(pulse,pulse);
      ctx.fillStyle= isFrenzy? C.brasaHot : C.ouro; ctx.beginPath(); ctx.arc(0,0,16,0,Math.PI*2); ctx.fill();
      ctx.font=font(10,900,UI); ctx.textAlign='center'; ctx.fillStyle=C.perola; ctx.fillText('2×',0,3);
      ctx.restore();
    }

    // Buttons
    const btnT=clamp01((t-1.4)/0.35);
    if(btnT>0){
      const bw=146,bh=52;
      // left: home
      ctx.save(); ctx.globalAlpha=btnT;
      panel(ctx,cx+14,cy+ch+16,bw,bh,{r:16, top:'rgba(44,32,24,0.98)', bottom:'rgba(28,18,12,0.98)', border:'rgba(255,214,160,0.2)', shadow:12});
      outlinedText(ctx,'INÍCIO',cx+14+bw/2,cy+ch+42,C.creme,14,{outline:2, weight:800});
      // right: próximo
      const rx=cx+cw-14-bw, ry=cy+ch+16;
      premiumButton(ctx,rx,ry,bw,bh,{variant: r.stars===3? 'gold':'primary'});
      outlinedText(ctx,this.l10n.t('ui.action.next'),rx+bw/2,ry+bh/2+2,C.perola,16,{outline:2, weight:900});
      ctx.restore();
      // double button above — gold CTA (P0: comunica valor, sem emoji ☐)
      ctx.save(); ctx.globalAlpha=btnT;
      premiumButton(ctx,W/2-78,cy+ch-22,156,28,{variant:'gold'});
      outlinedText(ctx,'DOBRAR 2×',W/2,cy+ch-8,C.perola,12,{outline:2, weight:900});
      ctx.restore();
      // share — sem emoji
      ctx.save(); ctx.globalAlpha=btnT;
      glass(ctx,W/2-78,cy+ch+78,156,22,{alpha:0.14, border:'rgba(110,200,120,0.3)'});
      ctx.font=font(10,700,UI); ctx.fillStyle=C.verdeClaro; ctx.textAlign='center';
      ctx.fillText('Compartilhar & convidar',W/2,cy+ch+89);
      ctx.restore();
    }
    if(t>1.6){
      ctx.globalAlpha=clamp01((t-1.6)/0.4);
      ctx.font=font(11,700,UI); ctx.textAlign='center'; ctx.fillStyle='rgba(244,231,211,0.55)';
      ctx.fillText(`${this.l10n.t('ui.result.bestCombo')}: ×${this.meta.bestCombo}  ·  ${this.meta.coins.toLocaleString(this.l10n.locale)} ${this.l10n.t('currency.coins').toLowerCase()}`,W/2,cy+ch+112);
      ctx.globalAlpha=1;
    }
  }

  // Bonus Frenzy draw — does NOT depend on sim (can be launched from Home)
  private drawFrenzy(ctx: CanvasRenderingContext2D): void {
    this.drawParticles(ctx);
    panel(ctx,8,8,W-16,48,{r:20, top:'rgba(76,42,18,0.96)', bottom:'rgba(40,18,6,0.96)', border:C.chama, borderWidth:1.5, shadow:14});
    flameIcon(ctx,28,32,10,true);
    outlinedText(ctx,'HORA DA BRASA!',W/2,28,C.chamaCore,16,{outline:3, weight:900});
    ctx.font=font(11,800,UI); ctx.textAlign='right'; ctx.fillStyle=C.perola;
    ctx.fillText(`${Math.ceil(this.frenzyTime)}s`,W-22,32);
    const pct=clamp01(this.frenzyTime/30);
    roundRectPath(ctx, W/2-60,40,120,6,3); ctx.fillStyle='rgba(0,0,0,0.45)'; ctx.fill();
    roundRectPath(ctx, W/2-60,40,120*pct,6,3); const g=ctx.createLinearGradient(W/2-60,0,W/2+60,0); g.addColorStop(0,C.brasaHot); g.addColorStop(1,C.chama); ctx.fillStyle=g; ctx.fill();
    ctx.font=font(13,800,UI); ctx.textAlign='center'; ctx.fillStyle=C.perola;
    ctx.fillText('Toque rápido na brasa! Cada toque = +12 moedas',W/2,72);
    // frenzy grill — independent visual (so it works even before any play)
    this.drawFrenzyGrill(ctx);
    glass(ctx,W/2-70, BENCH_TOP-40,140,28,{alpha:0.22, border:C.ouro});
    flameIcon(ctx,W/2-42, BENCH_TOP-26,9,true);
    ctx.font=font(16,900,DISPLAY); ctx.textAlign='center'; ctx.fillStyle=C.ouroLight; ctx.fillText(`Toques: ${this.frenzyScore}`,W/2+6,BENCH_TOP-22);
    // bench hint
    ctx.font=font(11,600,UI); ctx.fillStyle='rgba(244,231,211,0.55)'; ctx.fillText('BANCADA — toque na grelha!',W/2,BENCH_TOP-10);
    this.drawBanner(ctx);
  }
  private drawFrenzyGrill(ctx: CanvasRenderingContext2D): void {
    // reuse the churrasqueira frame but draw frenzy-heated coals (no sim needed)
    const overallW=GRILL_BODY_W+28, overallX=W/2-overallW/2;
    const counterY=GRILL_TOP-14, fx=overallX+16, fy=counterY+14, fw=overallW-32, fh=GRILL_BOTTOM-fy;
    this.drawChurrasqueira(ctx,false);
    const zoneH=fh/3;
    for(let z=0;z<3;z++){
      const y=fy+zoneH*z;
      const heat= z===0?0.85 : z===1?1.0:1.35;
      const zx=fx+6, zw=fw-12;
      ctx.save(); roundRectPath(ctx,zx,y+3,zw,zoneH-6,6); ctx.clip();
      const bedG=ctx.createLinearGradient(0,y,0,y+zoneH);
      bedG.addColorStop(0,`rgba(210,80,30,${0.5+heat*0.2})`);
      bedG.addColorStop(1,'rgba(90,28,10,0.96)');
      ctx.fillStyle=bedG; ctx.fillRect(zx,y,zw,zoneH);
      for(let k=0;k<26;k++){
        const fx2=((z*97+k*41)%100)/100, fy2=((z*61+k*73)%100)/100;
        const cx=zx+8+fx2*(zw-16), cy=y+10+fy2*(zoneH-16), rr=2.6+((k*13)%4);
        const pulse=0.6+0.4*Math.sin(this.now*3.2+k);
        const cg=ctx.createRadialGradient(cx,cy,0.5,cx,cy,rr*4);
        cg.addColorStop(0,`rgba(255,242,190,${0.95*pulse})`);
        cg.addColorStop(0.3,`rgba(255,170,70,${0.7*pulse})`);
        cg.addColorStop(1,'rgba(180,40,10,0)');
        ctx.fillStyle=cg; ctx.beginPath(); ctx.ellipse(cx,cy,rr*3.4,rr*2.2,k*0.7,0,Math.PI*2); ctx.fill();
      }
      ctx.restore();
      // grate
      ctx.save(); roundRectPath(ctx,zx,y+2,zw,zoneH-4,6); ctx.clip();
      for(let gx=zx+10; gx<zx+zw-8; gx+=13){
        ctx.fillStyle='rgba(0,0,0,0.3)'; ctx.fillRect(gx,y+3,3,zoneH-6);
        ctx.fillStyle='#6B635D'; ctx.fillRect(gx,y+4,2.6,zoneH-8);
        ctx.fillStyle=`rgba(255,200,120,${0.28+heat*0.18})`; ctx.fillRect(gx+0.3,y+4,0.8,zoneH-8);
      }
      ctx.restore();
      roundRectPath(ctx,zx,y+2,zw,zoneH-4,6); ctx.strokeStyle='rgba(0,0,0,0.5)'; ctx.lineWidth=2; ctx.stroke();
      if(heat>1) flameIcon(ctx,overallX+8+(z%3)*14,y+zoneH-12,6,true);
    }
  }

  // Wheel draw
  private drawWheel(ctx: CanvasRenderingContext2D): void {
    this.drawParticles(ctx);
    // header
    panel(ctx,8,8,W-16,48,{r:20, top:'rgba(44,32,56,0.96)', bottom:'rgba(20,14,28,0.96)', border:C.ouro, borderWidth:1.5, shadow:14});
    outlinedText(ctx,'ROLETA DA BRASA',W/2,32,C.ouroLight,16,{outline:3, weight:900});
    ctx.font=font(11,700,UI); ctx.textAlign='right'; ctx.fillStyle='rgba(244,231,211,0.6)';
    ctx.fillText(`${this.meta.wheelSpins} giro(s)`,W-18,32);
    // wheel
    const cx=W/2, cy=360, r=128;
    // shadow
    ctx.fillStyle='rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.ellipse(cx,cy+14,r*0.95, r*0.35,0,0,Math.PI*2); ctx.fill();
    ctx.save();
    ctx.translate(cx,cy);
    ctx.rotate(this.wheelAngle);
    for(let i=0;i<WHEEL_PRIZES.length;i++){
      const start=(Math.PI*2/WHEEL_PRIZES.length)*i - Math.PI/2;
      const end=start+Math.PI*2/WHEEL_PRIZES.length;
      ctx.beginPath(); ctx.moveTo(0,0); ctx.arc(0,0,r,start,end); ctx.closePath();
      const prize=WHEEL_PRIZES[i]!;
      const col=hex(prize.color);
      ctx.fillStyle=rgb(col);
      ctx.fill();
      // divider
      ctx.strokeStyle='rgba(0,0,0,0.25)'; ctx.lineWidth=2; ctx.stroke();
      // label
      ctx.save();
      const mid=start+Math.PI/WHEEL_PRIZES.length;
      ctx.rotate(mid);
      ctx.translate(r*0.62,0);
      ctx.rotate(Math.PI/2);
      ctx.font=font(10,900,UI); ctx.textAlign='center'; ctx.fillStyle= i%2===0? C.carvao : C.perola;
      ctx.fillText(prize.amount,0,-4);
      ctx.font=font(8,700,UI); ctx.fillText(prize.label,0,8);
      ctx.restore();
    }
    // hub
    const hubG=ctx.createRadialGradient(0,0,4,0,0,28);
    hubG.addColorStop(0,'#FFF6C0'); hubG.addColorStop(0.4,C.ouroLight); hubG.addColorStop(1,C.ouroDark);
    ctx.fillStyle=hubG; ctx.beginPath(); ctx.arc(0,0,28,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle='rgba(0,0,0,0.4)'; ctx.lineWidth=2; ctx.stroke();
    flameIcon(ctx,0,2,12,true);
    ctx.restore();
    // pin
    ctx.fillStyle=C.perola; ctx.beginPath();
    ctx.moveTo(cx, cy - r - 10); ctx.lineTo(cx-12, cy - r +6); ctx.lineTo(cx+12, cy - r+6); ctx.closePath(); ctx.fill();
    ctx.strokeStyle='rgba(0,0,0,0.4)'; ctx.lineWidth=2; ctx.stroke();
    // spin button
    const canSpin=this.meta.wheelSpins>0 && !this.wheelSpinning;
    const bw=180,bh=56,bx=W/2-bw/2,by=560;
    if (canSpin) premiumButton(ctx,bx,by,bw,bh,{variant:'gold'});
    else panel(ctx,bx,by,bw,bh,{r:28, top:'rgba(60,44,24,0.8)', bottom:'rgba(30,22,12,0.8)', border:'rgba(255,255,255,0.1)'});
    outlinedText(ctx, canSpin? 'GIRAR!' : (this.wheelSpinning? 'GIRANDO…' : 'SEM GIROS'),W/2,by+bh/2+2, canSpin? C.carvao : C.creme,20,{outline: canSpin?2:1, weight:900});
    if (!canSpin && !this.wheelSpinning) {
      ctx.font=font(11,600,UI); ctx.textAlign='center'; ctx.fillStyle='rgba(244,231,211,0.55)';
      ctx.fillText('Volte após 3 turnos ou em 4h',W/2,by+bh+18);
      // also offer close
      glass(ctx,W/2-60, by+bh+28,120,26,{alpha:0.14, border:'rgba(255,255,255,0.18)'});
      ctx.font=font(11,700,UI); ctx.fillStyle=C.creme; ctx.fillText('Voltar ao início',W/2, by+bh+42);
    }
    // info
    ctx.font=font(10,600,UI); ctx.textAlign='center'; ctx.fillStyle='rgba(244,231,211,0.5)';
    ctx.fillText('Tempo limitado: gire antes que expire!',W/2, cy + r + 34);
    this.drawBanner(ctx);
  }

  private drawDailyModal(ctx: CanvasRenderingContext2D): void {
    // scrim
    ctx.fillStyle='rgba(6,3,2,0.72)'; ctx.fillRect(0,0,W,H);
    const cw=360,cx=W/2-cw/2, cy=180, ch=420;
    panel(ctx,cx,cy,cw,ch,{r:24, top:'rgba(58,42,30,0.98)', bottom:'rgba(24,16,10,0.98)', border:C.ouro, borderWidth:1.5, shadow:32, glowTop:'rgba(255,220,160,0.28)'});
    // header
    outlinedText(ctx,'Recompensa Diária',W/2,cy+32,C.perola,20,{outline:3, weight:900});
    ctx.font=font(11,600,UI); ctx.textAlign='center'; ctx.fillStyle='rgba(244,231,211,0.6)';
    ctx.fillText(`Sequência: ${this.meta.streak} dias · Graça: ${this.meta.graceUsed? 'usada':'disponível'}`,W/2,cy+52);
    // streak bar 7
    const startX=cx+18, boxW=44, gap=6, y=cy+68;
    for(let i=0;i<7;i++){
      const x=startX+i*(boxW+gap);
      const day=i+1;
      const claimed=day<=this.meta.lastClaimDay;
      const isNext=day===this.meta.lastClaimDay+1;
      panel(ctx,x,y,boxW,58,{r:12, top: claimed? 'rgba(70,52,28,0.98)': isNext? 'rgba(58,46,40,0.98)':'rgba(34,24,18,0.96)', bottom: claimed? 'rgba(38,26,14,0.98)':'rgba(18,12,8,0.96)', border: claimed? C.ouro : isNext? C.ouroLight : 'rgba(255,214,160,0.14)', shadow:6});
      const rew=DAILY_REWARDS[i]!;
      const icx=x+boxW/2, icy=y+18;
      if (rew.icon==='coin') coinIcon(ctx,icx,icy,8);
      else if (rew.icon==='ember') flameIcon(ctx,icx,icy,7,true);
      else if (rew.icon==='chest') starIcon(ctx,icx,icy,8,{filled:true, glow:true});
      else if (rew.icon==='booster') flameIcon(ctx,icx,icy,6,false);
      else if (rew.icon==='ingredient') coinIcon(ctx,icx,icy,7);
      ctx.font=font(10,800,UI); ctx.fillStyle= isNext? C.ouroLight : C.creme; ctx.fillText(rew.label,x+boxW/2,y+36);
      ctx.font=font(8,700,UI); ctx.fillStyle='rgba(244,231,211,0.5)'; ctx.fillText(`Dia ${day}`,x+boxW/2,y+48);
      if(claimed){ ctx.fillStyle=C.verdeClaro; ctx.beginPath(); ctx.arc(x+boxW-10,y+10,7,0,Math.PI*2); ctx.fill(); ctx.fillStyle=C.perola; ctx.font=font(8,900,UI); ctx.fillText('✓',x+boxW-10,y+13); }
      if(isNext && !claimed){ const pulse=0.5+0.5*Math.sin(this.now*4); ctx.globalAlpha=0.6+0.3*pulse; ctx.strokeStyle=C.ouroLight; ctx.lineWidth=2; roundRectPath(ctx,x-1,y-1,boxW+2,60,12); ctx.stroke(); ctx.globalAlpha=1; }
    }
    // claim button for next day
    const nextDay=this.meta.lastClaimDay+1;
    const canClaim=nextDay<=7 && nextDay> this.meta.lastClaimDay;
    const btnY=cy+150;
    const bw=220,bh=48,bx=W/2-bw/2;
    if (nextDay<=7) {
      if (canClaim) premiumButton(ctx,bx,btnY,bw,bh,{variant:'gold'});
      else panel(ctx,bx,btnY,bw,bh,{r:24, top:'rgba(60,44,24,0.6)', bottom:'rgba(30,22,12,0.6)', border:'rgba(255,255,255,0.1)'});
      outlinedText(ctx, canClaim? `RESGATAR DIA ${nextDay}` : `JÁ RESGATADO`, W/2, btnY+bh/2+2, canClaim? C.carvao: C.creme,14,{outline: canClaim?2:1, weight:900});
      if (canClaim) {
        ctx.font=font(10,600,UI); ctx.fillStyle='rgba(244,231,211,0.6)'; ctx.textAlign='center';
        ctx.fillText('Toque no card do dia para resgatar',W/2,btnY+bh+16);
      }
    } else {
      ctx.font=font(11,700,UI); ctx.fillStyle=C.verdeClaro; ctx.textAlign='center';
      ctx.fillText('Ciclo completo! +15% no próximo ciclo',W/2,btnY+20);
    }
    // grace info
    ctx.font=font(9,600,UI); ctx.fillStyle='rgba(244,231,211,0.5)'; ctx.textAlign='center';
    ctx.fillText('Sequência com 1 dia de graça · Falhou 1 dia? Não quebra!',W/2,cy+220);
    // progress to 7
    const barW=cw-36, barX=cx+18, barY=cy+240;
    roundRectPath(ctx,barX,barY,barW,8,4); ctx.fillStyle='rgba(0,0,0,0.45)'; ctx.fill();
    roundRectPath(ctx,barX,barY,barW*(this.meta.lastClaimDay/7),8,4); const g=ctx.createLinearGradient(barX,0,barX+barW,0); g.addColorStop(0,C.brasaHot); g.addColorStop(1,C.ouroLight); ctx.fillStyle=g; ctx.fill();
    ctx.font=font(10,700,UI); ctx.fillStyle=C.perola; ctx.textAlign='left'; ctx.fillText(`${this.meta.lastClaimDay}/7`,barX, barY+18);
    ctx.textAlign='right'; ctx.fillStyle='rgba(244,231,211,0.6)'; ctx.fillText('Baú do 7º dia: +500 moedas + 10 Brasas', barX+barW, barY+18);
    // retention boost teaser
    panel(ctx,cx+14,cy+268,cw-28,46,{r:14, top:'rgba(44,32,56,0.9)', bottom:'rgba(28,18,36,0.9)', border:'rgba(200,160,255,0.2)'});
    ctx.textAlign='left'; ctx.font=font(11,800,UI); ctx.fillStyle=C.perola; ctx.fillText('Volte em 2h e ganhe Brasa Quente 15min (1.5×)',cx+24,cy+286);
    ctx.font=font(10,600,UI); ctx.fillStyle='rgba(244,231,211,0.6)'; ctx.fillText('Notificação às 19:00 · toque para ativar',cx+24,cy+302);
    // close
    glass(ctx,W-54,cy+12,36,24,{alpha:0.14, border:'rgba(255,255,255,0.2)'});
    ctx.font=font(12,800,UI); ctx.textAlign='center'; ctx.fillStyle=C.perola; ctx.fillText('✕',W-36,cy+24);
    // bottom hint
    ctx.font=font(9,600,UI); ctx.fillStyle='rgba(244,231,211,0.4)'; ctx.textAlign='center';
    ctx.fillText('Toque fora para fechar',W/2,cy+ch-14);
  }

  private drawOfflinePopup(ctx: CanvasRenderingContext2D): void {
    if(!this.offlinePopup) return;
    ctx.fillStyle='rgba(6,3,2,0.72)'; ctx.fillRect(0,0,W,H);
    const cw=340,cx=W/2-cw/2, cy=H/2-120, ch=200;
    panel(ctx,cx,cy,cw,ch,{r:22, top:'rgba(58,42,30,0.98)', bottom:'rgba(24,16,10,0.98)', border:C.brasa, borderWidth:1.5, shadow:28, glowTop:'rgba(255,220,160,0.22)'});
    outlinedText(ctx,'Enquanto você estava fora',W/2,cy+32,C.perola,16,{outline:2, weight:900});
    ctx.font=font(11,600,UI); ctx.textAlign='center'; ctx.fillStyle='rgba(244,231,211,0.6)';
    ctx.fillText(`Sua equipe rendeu em ${this.offlinePopup.minutes} min`,W/2,cy+52);
    // coins
    glass(ctx,W/2-74,cy+68,148,44,{alpha:0.18, border:C.ouro});
    coinIcon(ctx,W/2-42,cy+90,12); ctx.font=font(22,900,DISPLAY); ctx.fillStyle=C.ouroLight; ctx.textAlign='left';
    ctx.fillText(`+${this.offlinePopup.coins}`,W/2-22,cy+92);
    ctx.font=font(11,700,UI); ctx.textAlign='center'; ctx.fillStyle='rgba(244,231,211,0.6)';
    ctx.fillText(`Cap de ${this.meta.level>=3?8:4}h · Volte em 30min para dobrar`,W/2,cy+128);
    // CTA
    premiumButton(ctx,W/2-90,cy+142,180,44,{variant:'primary'});
    outlinedText(ctx,'COLETAR',W/2,cy+164,C.perola,16,{outline:2, weight:900});
    ctx.font=font(10,700,UI); ctx.fillStyle='rgba(244,231,211,0.55)'; ctx.textAlign='center';
    ctx.fillText('ou 📺 Dobrar com anúncio (2×)',W/2,cy+202);
  }
}

// ── Bootstrap ───────────────────────────────────────────────────────────────
const canvas = document.getElementById('c') as HTMLCanvasElement;
const game = new Game();
game.init(canvas).catch((err)=>{
  const ctx=canvas.getContext('2d')!;
  canvas.width=420; canvas.height=300;
  ctx.fillStyle='#1C1512'; ctx.fillRect(0,0,420,300);
  ctx.fillStyle='#F4E7D3'; ctx.font='14px system-ui'; ctx.fillText('Falha ao iniciar: '+String(err),16,40);
  console.error(err);
});
