/**
 * CHURRASCO! O Mestre da Brasa — design-verification prototype.
 *
 * Studio-grade visual overhaul:
 *   - Iconic Brazilian brick churrasqueira (alvenaria) replaces the generic metal box
 *   - Golden-hour backyard scene: sunset sky, silhouetted trees/house, string lights
 *   - Cinematic lighting: warm light pool, rim lights, coal flicker, heat shimmer
 *   - Polished UI: glass HUD chips, wooden bench with grain, richer cards
 *   - Premium CTA buttons with multi-layer lighting
 *   - Title screen with breathing logo + animated hero grill
 *   - Result screen with confetti, animated stars, cinematic scrim
 *
 * Gameplay logic unchanged — runs the same sim-core rules as the Unity client.
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
// Churrasqueira geometry (de alvenaria — a brick BBQ with chimney and bench).
// The firebox top is derived from the chimney height (drawn above), so
// GRILL_TOP is not a free constant — we compute it in code. To keep food
// placement math simple we fix it to the value drawChurrasqueira produces
// (topY + CHIMNEY_H + counterH = 100 + 78 + 14 = 192).
const CHIMNEY_H = 62;
const COUNTER_H = 12;
const GRILL_TOP = 224;                         // firebox opening top
const GRILL_BOTTOM = 472;                     // firebox opening bottom
const BENCH_TOP = 552;
const CHIMNEY_W = 68;
const GRILL_BODY_W = W - 40;

type Screen = 'title' | 'play' | 'result';

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

class Game {
  private db!: GameDatabase;
  private l10n!: L10n;
  private sim!: TurnSimulation;
  private screen: Screen = 'title';
  private levelIndex = 0;
  private levels: { id: string; restaurantIndex: number; turnLengthSec: number; spawnIntervalSec: number; patienceScalar: number; difficultyScalar: number; maxOrdersOnScreen: number }[] = [];

  private coins = 0;
  private totalCoins = 0;
  private xp = 0;
  private bestComboEver = 0;
  private upgradeLevel = 0;

  private particles: Particle[] = [];
  private floats: FloatText[] = [];
  private drag: Drag | null = null;
  private pointer = { x: 0, y: 0, down: false };
  private lastResult: { coins: number; xp: number; stars: number; perfect: number; burned: number; combo: number } | null = null;
  private flash = 0;
  private comboPulse = 0;
  private bannerText = '';
  private bannerLife = 0;
  /** 0..1 — screen shake on big moments (perfect, combo milestone). */
  private shake = 0;

  private unlocked: Ingredient[] = [];
  /** Cached backdrop — static layers drawn once. */
  private bgCache: HTMLCanvasElement | null = null;
  /** Monotonic clock in seconds, for idle animation. */
  private now = 0;
  /** Seconds since the result screen appeared, for its staggered entrance. */
  private resultT = 0;
  /** Continuous grill bed, started on the first unlocked gesture. */
  private sizzleBed: { setIntensity(v: number): void; stop(): void } | null = null;
  /** String lights twinkle phase offsets. */
  private readonly lightPhases: number[] = Array.from({ length: 9 }, (_, i) => i * 0.73);

  async init(canvas: HTMLCanvasElement): Promise<void> {
    const raw = await this.loadData();
    this.db = createDatabase(raw);
    this.l10n = await this.loadL10n();
    const problems = validateDatabase(this.db);
    if (problems.length) throw new Error(`data invalid: ${problems.join('; ')}`);

    const levels = await fetch('/data/levels.json').then((r) => r.json());
    this.levels = levels.levels;

    this.resize(canvas);
    this.bindInput(canvas);
    this.screen = 'title';

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

  private requestNextLevel(): void {
    const lvl = this.levels[this.levelIndex] ?? this.levels[this.levels.length - 1]!;
    this.sim = new TurnSimulation(
      this.db,
      {
        restaurantIndex: lvl.restaurantIndex,
        levelId: lvl.id,
        upgradeLevels: { grill_size: this.upgradeLevel },
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
    const restaurant = this.db.restaurantByIndex.get(lvl.restaurantIndex)!;
    this.unlocked = this.db.ingredients.items.filter(
      (i) => i.unlock.restaurantIndex <= restaurant.index && i.cookMethod === 'grill'
    );
    this.screen = 'play';
    this.bgCache = null; // rebuild backdrop for the new restaurant tint
    this.banner(`${this.l10n.t(restaurant.nameKey).toUpperCase()} · ${lvl.id}`);
  }

  // ── Update ────────────────────────────────────────────────────────────────
  private update(dt: number): void {
    this.now += dt;
    if (this.screen === 'result') this.resultT += dt;
    if (this.screen !== 'play') {
      this.updateEffects(dt);
      return;
    }

    const before = { ...this.sim.counters };
    this.sim.tick(dt);
    this.reactToEvents(before);

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
    this.coins += r.coins;
    this.totalCoins += r.coins;
    this.xp += r.xp;
    this.bestComboEver = Math.max(this.bestComboEver, r.counters.bestCombo);
    this.lastResult = {
      coins: r.coins, xp: r.xp, stars: r.stars,
      perfect: r.counters.perfectCooks, burned: r.counters.burnedFood, combo: r.counters.bestCombo
    };
    this.screen = 'result';
    this.resultT = 0;
    if (this.sizzleBed) { this.sizzleBed.stop(); this.sizzleBed = null; }
    // Celebration confetti on great results
    if (r.stars >= 2) {
      for (let i = 0; i < (r.stars === 3 ? 60 : 30); i++) {
        this.spawnConfetti(W / 2 + (Math.random() - 0.5) * 120, 200 + Math.random() * 60);
      }
    }
    audio.play('levelUp');
  }

  private updateEffects(dt: number): void {
    // Ambient embers rising from the grill (more when fire is hot).
    if (this.screen === 'play') {
      const eff = this.sim?.grill.charcoalEfficiency ?? 0.6;
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
      // Occasional smoke puff
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
    // Title screen drifting embers
    if (this.screen === 'title' && Math.random() < dt * 18) {
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
  private zoneCount(): number {
    return this.sim?.grill.zones.length ?? 3;
  }
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
    const w = 74;
    const gap = 8;
    return { x: 14 + (i % 5) * (w + gap), y: BENCH_TOP + 22 + Math.floor(i / 5) * 74, w, h: 66 };
  }
  private orderCardRect(i: number): { x: number; y: number; w: number; h: number } {
    const w = 128;
    const gap = 8;
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

      if (this.screen === 'title') {
        audio.play('uiTap');
        this.requestNextLevel();
        return;
      }
      if (this.screen === 'result') {
        this.levelIndex++;
        this.requestNextLevel();
        return;
      }

      for (let i = 0; i < this.unlocked.length; i++) {
        const r = this.benchItemRect(i);
        if (p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) {
          const food = this.sim.takeFromStock(this.unlocked[i]!);
          this.drag = { food, fromBench: true, x: p.x, y: p.y, startX: p.x, startY: p.y, moved: false, startTime: performance.now() };
          audio.play('uiTap');
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

      // Charcoal bar → refill
      if (p.y > GRILL_BOTTOM + 8 && p.y < GRILL_BOTTOM + 26) {
        if (this.sim.refillCharcoal()) {
          this.banner(this.l10n.t('ui.hud.charcoal'));
          this.burst(W / 2, GRILL_BOTTOM + 18, 14, C.chama, 'spark');
          audio.play('place');
        }
      }
    });

    canvas.addEventListener('pointermove', (e) => {
      const p = toLocal(e);
      this.pointer = { ...p, down: this.pointer.down };
      if (this.drag) {
        this.drag.x = p.x;
        this.drag.y = p.y;
        if (Math.hypot(p.x - this.drag.startX, p.y - this.drag.startY) > 12) this.drag.moved = true;
      }
    });

    const release = (): void => {
      const d = this.drag;
      this.pointer.down = false;
      if (!d) return;
      this.drag = null;
      const held = (performance.now() - d.startTime) / 1000;

      if (!d.moved && !d.fromBench && d.food.onGrill) {
        if (this.sim.flip(d.food)) {
          const pos = this.foodScreenPos(d.food);
          this.burst(pos.x, pos.y + 10, 10, C.chama, 'spark');
          this.float(pos.x, pos.y - 22, this.l10n.t('ui.feedback.flip'), C.creme, 15);
          audio.play('flip');
        }
        return;
      }
      if (!d.moved && !d.fromBench && held >= 0.45) {
        this.tryServe(d.food, this.bestCustomerFor(d.food));
        return;
      }

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
      x, y,
      vx: Math.cos(a) * s, vy: Math.sin(a) * s - 80,
      life: 0, max: 2 + Math.random() * 1.5,
      size: 3 + Math.random() * 3,
      color: colors[Math.floor(Math.random() * colors.length)]!,
      kind: 'confetti',
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 8,
      shape: Math.random() < 0.5 ? 'rect' : 'square',
    });
  }
  private float(x: number, y: number, text: string, color: string, size: number): void {
    this.floats.push({ x, y, text, life: 0, color, size });
  }
  private banner(text: string): void {
    this.bannerText = text;
    this.bannerLife = 2;
  }

  private resize(canvas: HTMLCanvasElement): void {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const availW = window.innerWidth;
    const availH = window.innerHeight;
    const scale = Math.min(availW / W, availH / H, 1.25);
    canvas.style.width = `${Math.floor(W * scale)}px`;
    canvas.style.height = `${Math.floor(H * scale)}px`;
    canvas.width = Math.floor(W * scale * dpr);
    canvas.height = Math.floor(H * scale * dpr);
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
  }

  // ── Draw ──────────────────────────────────────────────────────────────────

  /**
   * Backyard at golden hour: sunset sky gradient, silhouetted fence/trees,
   * warm light pool from the grill, a soft ground, hanging string lights,
   * and a vignette. Cached once and reused.
   */
  private drawBackdrop(ctx: CanvasRenderingContext2D): void {
    if (!this.bgCache) {
      const off = document.createElement('canvas');
      off.width = W;
      off.height = H;
      const c = off.getContext('2d')!;

      // Sunset sky — warm bands from amber horizon to deep charcoal above.
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

      // Sun disc — dipping behind the fence line, warm halo.
      const sunY = 440;
      const halo = c.createRadialGradient(W / 2, sunY, 5, W / 2, sunY, 220);
      halo.addColorStop(0, 'rgba(255,220,140,0.95)');
      halo.addColorStop(0.12, 'rgba(255,180,80,0.75)');
      halo.addColorStop(0.35, 'rgba(240,120,40,0.35)');
      halo.addColorStop(1, 'rgba(224,86,31,0)');
      c.fillStyle = halo;
      c.fillRect(0, 0, W, H);
      c.fillStyle = '#FFE2A8';
      c.beginPath();
      c.arc(W / 2, sunY, 34, 0, Math.PI * 2);
      c.fill();

      // Distant hills / tree line
      c.fillStyle = 'rgba(14,8,5,0.85)';
      c.beginPath();
      c.moveTo(0, 460);
      const hillPoints = [[40, 430], [80, 450], [130, 420], [190, 448], [240, 425], [290, 452], [340, 428], [390, 450], [W, 440]];
      for (const [px, py] of hillPoints) c.lineTo(px, py);
      c.lineTo(W, H); c.lineTo(0, H); c.closePath();
      c.fill();

      // Back fence with posts
      c.fillStyle = 'rgba(10,6,4,0.75)';
      for (let i = 0; i < 9; i++) {
        const bx = -10 + i * 54;
        c.fillRect(bx, 400, 34, 90);
        // pointy top
        c.beginPath();
        c.moveTo(bx, 400);
        c.lineTo(bx + 17, 390);
        c.lineTo(bx + 34, 400);
        c.closePath();
        c.fill();
      }
      c.fillStyle = 'rgba(10,6,4,0.8)';
      c.fillRect(0, 410, W, 6);
      c.fillRect(0, 456, W, 6);

      // Ground — patio/grass darkening toward the bottom
      const ground = c.createLinearGradient(0, 530, 0, H);
      ground.addColorStop(0, '#2A1910');
      ground.addColorStop(0.5, '#1A0F09');
      ground.addColorStop(1, '#0C0705');
      c.fillStyle = ground;
      c.fillRect(0, 520, W, H - 520);

      // Warm pool of light radiating from the grill position
      const pool = c.createRadialGradient(W / 2, 440, 30, W / 2, 440, 380);
      pool.addColorStop(0, 'rgba(255,160,60,0.28)');
      pool.addColorStop(0.4, 'rgba(224,86,31,0.14)');
      pool.addColorStop(1, 'rgba(224,86,31,0)');
      c.fillStyle = pool;
      c.fillRect(0, 0, W, H);

      // String lights above — a gentle curve of bulbs across the top third.
      c.strokeStyle = 'rgba(30,20,14,0.7)';
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(-20, 120);
      c.quadraticCurveTo(W / 2, 180, W + 20, 110);
      c.stroke();
      for (let i = 0; i < this.lightPhases.length; i++) {
        const t = i / (this.lightPhases.length - 1);
        // parabola y
        const lx = -20 + t * (W + 40);
        const ly = 120 + Math.sin(t * Math.PI) * 58 - 10;
        // cord drop
        c.strokeStyle = 'rgba(30,20,14,0.6)';
        c.beginPath(); c.moveTo(lx, 120 + Math.sin(t * Math.PI) * 58 - 20); c.lineTo(lx, ly + 4); c.stroke();
        // bulb glow (warm but dim in backdrop — will be drawn live with twinkle)
        const bg = c.createRadialGradient(lx, ly + 4, 0, lx, ly + 4, 14);
        bg.addColorStop(0, 'rgba(255,220,140,0.9)');
        bg.addColorStop(0.4, 'rgba(255,180,70,0.35)');
        bg.addColorStop(1, 'rgba(255,150,40,0)');
        c.fillStyle = bg;
        c.beginPath(); c.arc(lx, ly + 4, 14, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#FFE4A6';
        c.beginPath(); c.arc(lx, ly + 4, 2.2, 0, Math.PI * 2); c.fill();
      }

      // Vignette — focuses the eye on the grill
      const vig = c.createRadialGradient(W / 2, H * 0.5, H * 0.2, W / 2, H * 0.52, H * 0.85);
      vig.addColorStop(0, 'rgba(0,0,0,0)');
      vig.addColorStop(0.6, 'rgba(0,0,0,0.25)');
      vig.addColorStop(1, 'rgba(0,0,0,0.75)');
      c.fillStyle = vig;
      c.fillRect(0, 0, W, H);

      this.bgCache = off;
    }
    ctx.drawImage(this.bgCache, 0, 0);

    // Live twinkling string lights (over the cached backdrop, per-frame).
    for (let i = 0; i < this.lightPhases.length; i++) {
      const t = i / (this.lightPhases.length - 1);
      const lx = -20 + t * (W + 40);
      const ly = 120 + Math.sin(t * Math.PI) * 58 - 6;
      const tw = 0.72 + 0.28 * Math.abs(Math.sin(this.now * 2.4 + this.lightPhases[i]!));
      const g = ctx.createRadialGradient(lx, ly, 0, lx, ly, 18);
      g.addColorStop(0, `rgba(255,230,160,${0.7 * tw})`);
      g.addColorStop(0.5, `rgba(255,180,80,${0.25 * tw})`);
      g.addColorStop(1, 'rgba(255,160,60,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(lx, ly, 18, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `rgba(255,245,210,${0.85 * tw})`;
      ctx.beginPath(); ctx.arc(lx, ly, 2, 0, Math.PI * 2); ctx.fill();
    }
  }

  private draw(canvas: HTMLCanvasElement): void {
    const ctx = canvas.getContext('2d')!;
    ctx.save();
    // Screen shake on big moments
    if (this.shake > 0) {
      const s = this.shake * 6;
      ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
    }
    ctx.clearRect(-20, -20, W + 40, H + 40);
    this.drawBackdrop(ctx);

    if (this.screen === 'title') this.drawTitle(ctx);
    else if (this.screen === 'result') this.drawResult(ctx);
    else this.drawPlay(ctx);

    ctx.restore();
  }

  private drawPlay(ctx: CanvasRenderingContext2D): void {
    this.drawGrill(ctx);
    this.drawBench(ctx);
    this.drawOrders(ctx);
    this.drawParticles(ctx);
    this.drawFloats(ctx);
    if (this.drag) this.drawDragged(ctx);
    this.drawHud(ctx);
    if (this.bannerLife > 0) this.drawBanner(ctx);
    if (this.flash > 0) {
      const f = ctx.createRadialGradient(W / 2, GRILL_TOP + 120, 40, W / 2, GRILL_TOP + 120, W);
      f.addColorStop(0, `rgba(255,210,130,${this.flash * 0.35})`);
      f.addColorStop(1, 'rgba(255,200,120,0)');
      ctx.fillStyle = f;
      ctx.fillRect(0, 0, W, H);
    }
  }

  private drawTitle(ctx: CanvasRenderingContext2D): void {
    this.drawParticles(ctx);
    // Embers drawn by updateEffects; also add a soft warm haze near the grill
    const haze = ctx.createRadialGradient(W / 2, 440, 40, W / 2, 440, 280);
    haze.addColorStop(0, 'rgba(255,160,60,0.22)');
    haze.addColorStop(1, 'rgba(255,120,40,0)');
    ctx.fillStyle = haze;
    ctx.fillRect(0, 0, W, H);

    // Logo — CHURRASCO! with fire-tinted gradient
    const titleY = 158;
    ctx.save();
    ctx.translate(W / 2, titleY);
    const breathe = 1 + Math.sin(this.now * 1.8) * 0.012;
    ctx.scale(breathe, breathe);
    // Big outer glow
    const glow = ctx.createRadialGradient(0, 0, 10, 0, 0, 200);
    glow.addColorStop(0, 'rgba(255,180,70,0.35)');
    glow.addColorStop(1, 'rgba(224,86,31,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(-220, -80, 440, 160);
    // Title text (size tuned to fit 420px width with the heavy outline)
    const titleText = this.l10n.t('ui.app.title');
    const titleSize = titleText.length > 9 ? 46 : 52;
    outlinedText(ctx, titleText, 0, 0, C.offwhite, titleSize, {
      outline: 8, shadow: 16, shadowColor: 'rgba(224,86,31,0.5)'
    });
    // Fire gradient overlay on the title
    ctx.save();
    ctx.font = font(titleSize, 800, DISPLAY);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(18,11,8,0.9)';
    ctx.lineWidth = 8;
    ctx.strokeText(titleText, 0, 0);
    ctx.clip();
    const fg = ctx.createLinearGradient(0, -30, 0, 30);
    fg.addColorStop(0, '#FFF3D0');
    fg.addColorStop(0.5, C.chamaCore);
    fg.addColorStop(1, C.brasa);
    ctx.fillStyle = fg;
    ctx.fillText(titleText, 0, 0);
    ctx.restore();
    ctx.restore();

    // Subtitle
    outlinedText(ctx, this.l10n.t('ui.app.subtitle'), W / 2, 200, C.chama, 19, {
      weight: 700, outline: 4, shadow: 8, shadowColor: 'rgba(224,86,31,0.4)'
    });

    // Hero churrasqueira (alvenaria) with breathing coals. We draw it a bit
    // taller and place food on the grate inside the firebox rather than on the
    // counter, matching the gameplay framing.
    this.drawChurrasqueira(ctx, true);

    // Signature foods on the grill grate — placed mid-firebox (y ≈ 370)
    const hero = ['picanha', 'linguica_toscana', 'espetinho_frango'];
    hero.forEach((id, i) => {
      const ing = this.db?.ingredientById.get(id);
      if (!ing) return;
      const hover = Math.sin(this.now * 2 + i) * 2.5;
      drawFoodArt(ctx, ing, W / 2 - 60 + i * 60, 378 + hover, {
        doneness: 0.6, burned: false, scale: 0.95, glow: 1.3, heat: 1
      });
    });

    // Play button — premium CTA
    const bw = 256, bh = 68;
    const bx = W / 2 - bw / 2, by = 500;
    const breathe2 = 1 + Math.sin(this.now * 2.4) * 0.02;
    ctx.save();
    ctx.scale(breathe2, breathe2);
    premiumButton(ctx, bx, by, bw, bh, { variant: 'primary' });
    ctx.restore();
    outlinedText(ctx, this.l10n.t('ui.action.play'), W / 2, by + bh / 2 + 2, C.perola, 26, {
      outline: 3, weight: 800
    });

    // Tap hint
    const pulse = 0.3 + 0.4 * Math.sin(this.now * 2.8);
    ctx.globalAlpha = pulse;
    outlinedText(ctx, this.l10n.t('ui.title.tapToStart'), W / 2, 592, C.creme, 13, {
      weight: 600, family: UI, outline: 2
    });
    ctx.globalAlpha = 1;

    ctx.font = font(11, 600, UI);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(244,231,211,0.55)';
    const hint = this.l10n.t('ui.title.hint');
    const parts = hint.split('·');
    parts.forEach((seg, i) => {
      const line = seg.trim();
      if (line) ctx.fillText(line, W / 2, 640 + i * 17);
    });
  }

  private drawHud(ctx: CanvasRenderingContext2D): void {
    const sim = this.sim;
    const loc = this.l10n.locale;

    // Top HUD bar — frosted glass that floats over the scene.
    panel(ctx, 8, 8, W - 16, 48, {
      r: 22,
      top: 'rgba(30,20,14,0.72)',
      bottom: 'rgba(16,10,6,0.72)',
      border: 'rgba(255,214,160,0.22)',
      borderWidth: 1.5,
      shadow: 18,
      shadowAlpha: 0.55,
      innerGlow: true,
      glowTop: 'rgba(255,210,150,0.2)',
    });

    ctx.textBaseline = 'middle';

    // Coins chip (glass)
    const coinX = 20, coinY = 32;
    coinIcon(ctx, coinX + 14, coinY, 10);
    ctx.font = font(17, 900, DISPLAY);
    ctx.textAlign = 'left';
    ctx.fillStyle = C.ouroLight;
    ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 4;
    ctx.fillText(this.coins.toLocaleString(loc), coinX + 30, coinY);
    ctx.shadowBlur = 0;
    ctx.font = font(9, 700, UI);
    ctx.fillStyle = 'rgba(244,231,211,0.55)';
    ctx.fillText(`XP ${this.xp.toLocaleString(loc)}`, coinX + 30, coinY + 13);

    // Turn timer ring
    const left = Math.max(0, sim.timeLeft);
    const frac = sim.timeLimit > 0 ? clamp01(left / sim.timeLimit) : 0;
    const urgent = frac < 0.25;
    ctx.save();
    ctx.translate(W / 2, 32);
    // outer ring glow when urgent
    if (urgent) {
      const gg = ctx.createRadialGradient(0, 0, 7, 0, 0, 24);
      gg.addColorStop(0, `rgba(192,68,46,${0.3 + Math.sin(this.now * 8) * 0.15})`);
      gg.addColorStop(1, 'rgba(192,68,46,0)');
      ctx.fillStyle = gg;
      ctx.beginPath(); ctx.arc(0, 0, 24, 0, Math.PI * 2); ctx.fill();
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 4.5;
    ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = urgent ? C.telha : frac < 0.5 ? C.ambar : C.verdeClaro;
    ctx.lineWidth = 4.5;
    ctx.lineCap = 'round';
    ctx.shadowColor = ctx.strokeStyle as string;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(0, 0, 14, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.restore();
    outlinedText(
      ctx,
      `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}`,
      W / 2, 32, urgent ? C.telha : C.perola, 13, { outline: 2, weight: 800 }
    );

    // Combo or perfects
    if (sim.combo > 1) {
      const pop = 1 + this.comboPulse * 0.3;
      ctx.save();
      ctx.translate(W - 72, 32);
      ctx.scale(pop, pop);
      const cw = 76, ch = 26;
      glass(ctx, -cw / 2, -ch / 2, cw, ch, { alpha: 0.22, border: C.brasa });
      flameIcon(ctx, -20, 0, 8, sim.combo >= 5);
      ctx.font = font(15, 900, DISPLAY);
      ctx.textAlign = 'center';
      ctx.fillStyle = C.chamaCore;
      ctx.shadowColor = 'rgba(255,160,60,0.7)'; ctx.shadowBlur = 6;
      ctx.fillText(`×${sim.combo}`, 8, 1);
      ctx.shadowBlur = 0;
      ctx.restore();
    } else {
      const cw = 60, ch = 24;
      glass(ctx, W - 24 - cw, 32 - ch / 2, cw, ch, { alpha: 0.18, border: C.ouro });
      starIcon(ctx, W - 24 - cw + 16, 32, 8, { filled: true, glow: true });
      ctx.font = font(14, 900, DISPLAY);
      ctx.textAlign = 'center';
      ctx.fillStyle = C.ouroLight;
      ctx.shadowColor = 'rgba(231,194,74,0.45)'; ctx.shadowBlur = 6;
      ctx.fillText(String(sim.counters.perfectCooks), W - 22, 33);
      ctx.shadowBlur = 0;
    }

    // Charcoal gauge — on the front lip of the grill, drawn after the grill body
    // but positioned at the bottom firebox lip. Handled in drawGrill.
  }

  private drawOrders(ctx: CanvasRenderingContext2D): void {
    const waiting = this.sim.customers.filter((c) => c.state === 'waiting');
    waiting.forEach((c, i) => {
      const r = this.orderCardRect(i);
      const pct = clamp01(c.patienceLeft / c.patienceTotal);
      const barColor = pct > 0.5 ? C.verdeClaro : pct > 0.25 ? C.ambar : C.telha;
      const vip = c.def.isVip;

      // Card
      panel(ctx, r.x, r.y, r.w, r.h, {
        r: 14,
        top: vip ? 'rgba(70,52,28,0.97)' : 'rgba(44,32,24,0.92)',
        bottom: vip ? 'rgba(38,26,14,0.97)' : 'rgba(22,15,10,0.92)',
        border: vip ? C.ouro : 'rgba(255,214,160,0.18)',
        borderWidth: vip ? 2 : 1,
        shadow: 12,
        shadowAlpha: 0.55,
        innerGlow: true,
        glowTop: vip ? 'rgba(255,210,130,0.24)' : 'rgba(255,210,150,0.16)',
      });

      if (vip) {
        const vipGlow = ctx.createRadialGradient(r.x + 20, r.y + 20, 2, r.x + 20, r.y + 20, 30);
        vipGlow.addColorStop(0, 'rgba(231,194,74,0.18)');
        vipGlow.addColorStop(1, 'rgba(231,194,74,0)');
        ctx.fillStyle = vipGlow;
        roundRectPath(ctx, r.x, r.y, r.w, r.h, 14);
        ctx.fill();
      }

      const ax = r.x + 22, ay = r.y + 22;
      avatar(ctx, ax, ay, 15, vip ? C.ouro : C.telha, 'rgba(244,231,211,0.38)', { vip });

      ctx.font = font(12, 800, UI);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = vip ? C.ouroLight : C.madeiraPinho;
      ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 2;
      const name = this.l10n.t(c.def.nameKey);
      ctx.fillText(name.length > 14 ? name.slice(0, 13) + '…' : name, r.x + 42, r.y + 14);
      ctx.shadowBlur = 0;

      let ix = r.x + 42;
      for (const line of c.lines) {
        const done = line.fulfilledBy.length > 0;
        const ing = this.db.ingredientById.get(line.ingredientId);
        ctx.save();
        if (done) ctx.globalAlpha = 0.4;
        // chip background
        if (ing) drawFoodIcon(ctx, ing, ix + 11, r.y + 34, 22);
        ctx.restore();
        if (done) checkIcon(ctx, ix + 11, r.y + 34, 8, C.verdeClaro);
        ix += 26;
      }

      const bx = r.x + 10, by = r.y + r.h - 11, bw = r.w - 20, bh = 6;
      roundRectPath(ctx, bx, by, bw, bh, bh / 2);
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fill();
      if (pct > 0) {
        roundRectPath(ctx, bx, by, Math.max(bh, bw * pct), bh, bh / 2);
        const barG = ctx.createLinearGradient(bx, 0, bx + bw * pct, 0);
        barG.addColorStop(0, barColor);
        barG.addColorStop(1, rgb(shade(hex(barColor), -0.15)));
        ctx.fillStyle = barG;
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        roundRectPath(ctx, bx, by, Math.max(bh, bw * pct), bh * 0.45, bh * 0.22);
        ctx.fill();
      }
      if (pct < 0.25) {
        const a = 0.2 + Math.sin(this.now * 10) * 0.15;
        roundRectPath(ctx, r.x, r.y, r.w, r.h, 14);
        ctx.strokeStyle = `rgba(192,68,46,${a + 0.25})`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    });
  }

  /**
   * Churrasqueira de alvenaria — a brick barbecue with chimney, counter top,
   * brick skirt and a wooden side ledge.
   */
  private drawChurrasqueira(
    ctx: CanvasRenderingContext2D,
    heroMode = false
  ): void {
    // Dimensions (slightly larger/centered in hero mode)
    const cx = heroMode ? W / 2 : W / 2;
    const cy = heroMode ? 400 : 0;
    const overallW = heroMode ? 320 : GRILL_BODY_W + 28;
    const overallX = cx - overallW / 2;
    const topY = heroMode ? 260 : GRILL_TOP - CHIMNEY_H - 12;
    const baseY = heroMode ? 470 : GRILL_BOTTOM + 72;

    ctx.save();
    if (heroMode) ctx.translate(0, 0);

    // Shadow on the ground
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath();
    ctx.ellipse(cx, baseY + 8, overallW * 0.55, 18, 0, 0, Math.PI * 2);
    ctx.fill();

    // ── Chimney ──
    // Sits on the left brick pillar, fully inside the canvas, so the top
    // cap doesn't clip and the smoke reads clearly.
    const chimX = overallX + 22;
    const chimY = topY;
    // stack shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(chimX + 4, chimY + 4, CHIMNEY_W, CHIMNEY_H + 8);
    drawBrickwork(ctx, chimX, chimY, CHIMNEY_W, CHIMNEY_H, { brickH: 12, lit: true });
    // chimney cap (concrete)
    const capG = ctx.createLinearGradient(0, chimY - 8, 0, chimY + 6);
    capG.addColorStop(0, '#D4C3A8');
    capG.addColorStop(1, '#8B7A62');
    ctx.fillStyle = capG;
    roundRectPath(ctx, chimX - 6, chimY - 8, CHIMNEY_W + 12, 10, 3);
    ctx.fill();
    // rising smoke from chimney (in hero/play mode, animated softly)
    if (!heroMode || this.screen === 'title') {
      for (let i = 0; i < 3; i++) {
        const t = (this.now * 0.6 + i * 0.8) % 3;
        const sy = chimY - 10 - t * 22;
        const sx = chimX + CHIMNEY_W / 2 + Math.sin(this.now + i) * 6;
        ctx.fillStyle = `rgba(220,210,195,${0.22 * (1 - t / 3)})`;
        ctx.beginPath();
        ctx.arc(sx, sy, 6 + t * 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // ── Counter top (granite / stone lip) ──
    // In hero mode we pin the counter at a hand-tuned y. In play mode the
    // firebox top is GRILL_TOP so the counter sits immediately above it.
    const counterH = COUNTER_H;
    const counterY = heroMode ? 300 : GRILL_TOP - counterH;
    const cG = ctx.createLinearGradient(0, counterY, 0, counterY + counterH);
    cG.addColorStop(0, '#5E4E42');
    cG.addColorStop(0.4, '#3E322A');
    cG.addColorStop(1, '#2A201A');
    ctx.fillStyle = cG;
    roundRectPath(ctx, overallX - 6, counterY, overallW + 12, counterH, 4);
    ctx.fill();
    // polished highlight
    ctx.fillStyle = 'rgba(255,220,180,0.15)';
    ctx.fillRect(overallX - 4, counterY + 1, overallW + 8, 2);

    // ── Firebox interior ──
    const fx = overallX + 16;
    const fy = counterY + counterH;
    const fw = overallW - 32;
    const fh = heroMode ? 120 : GRILL_BOTTOM - (counterY + counterH);
    // dark interior
    ctx.fillStyle = '#0A0503';
    roundRectPath(ctx, fx, fy, fw, fh, 8);
    ctx.fill();
    // warm interior glow
    const intG = ctx.createLinearGradient(0, fy, 0, fy + fh);
    const eff = this.sim?.grill.charcoalEfficiency ?? 0.85;
    const ig0 = Math.min(0.95, 0.2 + eff * 0.5);
    intG.addColorStop(0, `rgba(180,60,20,${ig0})`);
    intG.addColorStop(0.4, `rgba(220,90,30,${ig0 * 0.9})`);
    intG.addColorStop(1, 'rgba(80,25,8,0.85)');
    roundRectPath(ctx, fx + 3, fy + 3, fw - 6, fh - 6, 6);
    ctx.fillStyle = intG;
    ctx.fill();

    // Coals + grate inside the firebox. In hero mode we draw a single full bed
    // so the title screen reads as complete; during gameplay drawGrill() handles
    // zoned coals per heat zone (different temperature bands matter for play).
    if (heroMode) {
    ctx.save();
    roundRectPath(ctx, fx + 6, fy + 6, fw - 12, fh - 12, 6);
    ctx.clip();
    ctx.fillStyle = 'rgba(40,25,15,0.45)';
    ctx.fillRect(fx + 6, fy + fh * 0.55, fw - 12, fh * 0.5);
    const seed = 42;
    for (let k = 0; k < 34; k++) {
      const fx2 = ((seed + k * 41) % 100) / 100;
      const fy2 = ((seed + k * 61) % 100) / 100;
      const cx = fx + 10 + fx2 * (fw - 20);
      const cy = fy + 10 + fy2 * (fh - 20);
      const rr = 2.4 + ((k * 13) % 4);
      const pulse = 0.5 + 0.5 * Math.sin(this.now * (1.8 + (k % 5) * 0.35) + k);
      const cg = ctx.createRadialGradient(cx, cy, 0.5, cx, cy, rr * 3.6);
      cg.addColorStop(0, `rgba(255,232,160,${0.75 * pulse * 0.8})`);
      cg.addColorStop(0.3, `rgba(248,140,40,${0.55 * pulse})`);
      cg.addColorStop(0.7, `rgba(220,80,20,${0.3 * pulse})`);
      cg.addColorStop(1, 'rgba(120,30,10,0)');
      ctx.fillStyle = cg;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rr * 3.2, rr * 2.2, k * 0.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(30,16,10,${0.7 - pulse * 0.25})`;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rr * 0.85, rr * 0.55, k * 0.7, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    ctx.save();
    roundRectPath(ctx, fx + 6, fy + 6, fw - 12, fh - 12, 6);
    ctx.clip();
    const grateY = fy + fh * 0.55;
    for (let gx = fx + 14; gx < fx + fw - 12; gx += 13) {
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(gx, fy + 8, 3, fh - 16);
      const barG = ctx.createLinearGradient(gx, 0, gx + 3, 0);
      barG.addColorStop(0, '#2A2320');
      barG.addColorStop(0.3, '#6B635D');
      barG.addColorStop(0.6, '#4A4440');
      barG.addColorStop(1, '#221C19');
      ctx.fillStyle = barG;
      ctx.fillRect(gx, fy + 9, 2.6, fh - 18);
      ctx.fillStyle = 'rgba(255,200,120,0.32)';
      ctx.fillRect(gx + 0.3, fy + 9, 0.8, fh - 18);
    }
    ctx.fillStyle = 'rgba(20,14,10,0.75)';
    ctx.fillRect(fx + 8, grateY - 2, fw - 16, 2);
    ctx.fillRect(fx + 8, grateY + fh * 0.2, fw - 16, 2);
    ctx.restore();
    roundRectPath(ctx, fx + 6, fy + 6, fw - 12, fh - 12, 6);
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 2;
    ctx.stroke();
    } // end heroMode-only coals/grate

    // ── Brick body (alvenaria) around the firebox ──
    // Left column
    drawBrickwork(ctx, overallX, counterY, 16, baseY - counterY, { brickH: 16, lit: true });
    // Right column
    drawBrickwork(ctx, overallX + overallW - 16, counterY, 16, baseY - counterY, { brickH: 16, lit: true });
    // Top header (above firebox, under counter)
    drawBrickwork(ctx, fx, fy - 10, fw, 12, { brickH: 10, lit: true });
    // Bottom skirt / base
    const skirtY = fy + fh;
    drawBrickwork(ctx, fx - 4, skirtY, fw + 8, baseY - skirtY, { brickH: 14, lit: false });
    // Concrete plinth at the bottom
    const plinthG = ctx.createLinearGradient(0, baseY - 10, 0, baseY + 6);
    plinthG.addColorStop(0, '#BDAA90');
    plinthG.addColorStop(1, '#7A6853');
    ctx.fillStyle = plinthG;
    roundRectPath(ctx, overallX - 10, baseY - 4, overallW + 20, 10, 3);
    ctx.fill();

    // ── Wooden side ledge on the right (rests tools / plate in artwork) ──
    // (skipped for simplicity in-game, the bench below serves this role)

    ctx.restore();

    // Return the firebox rectangle for food drawing (non-hero)
    return { fx, fy, fw, fh };
  }

  private drawGrill(ctx: CanvasRenderingContext2D): void {
    const n = this.zoneCount();
    const overallW = GRILL_BODY_W + 28;
    const overallX = W / 2 - overallW / 2;
    const counterY = GRILL_TOP - 14;
    const fx = overallX + 16;
    const fy = counterY + 14;
    const fw = overallW - 32;
    const fh = GRILL_BOTTOM - fy;

    // Draw the churrasqueira structure
    this.drawChurrasqueira(ctx, false);

    const efficiency = this.sim.grill.charcoalEfficiency;
    const zoneH = fh / n;

    for (let z = 0; z < n; z++) {
      const y = fy + zoneH * z;
      const zone = this.db.grill.zones[z]!;
      const heat = zone.heatMultiplier * efficiency;
      const zx = fx + 6, zw = fw - 12;

      // Coals bed (irregular heaped lumps — more visual than grid dots)
      ctx.save();
      roundRectPath(ctx, zx, y + 3, zw, zoneH - 6, 6);
      ctx.clip();
      // bed of ash
      ctx.fillStyle = 'rgba(40,25,15,0.5)';
      ctx.fillRect(zx, y + zoneH * 0.55, zw, zoneH * 0.5);
      // individual coals
      const seed = z * 97;
      for (let k = 0; k < 28; k++) {
        const fx2 = ((seed + k * 41) % 100) / 100;
        const fy2 = ((seed + k * 61) % 100) / 100;
        const cx = zx + 6 + fx2 * (zw - 12);
        const cy = y + 8 + fy2 * (zoneH - 14);
        const rr = 2.2 + ((k * 13) % 4);
        const pulse = 0.5 + 0.5 * Math.sin(this.now * (1.8 + (k % 5) * 0.35) + k);
        const cg = ctx.createRadialGradient(cx, cy, 0.5, cx, cy, rr * 3.6);
        cg.addColorStop(0, `rgba(255,232,160,${0.75 * pulse * (0.3 + heat * 0.6)})`);
        cg.addColorStop(0.3, `rgba(248,140,40,${0.55 * pulse})`);
        cg.addColorStop(0.7, `rgba(220,80,20,${0.3 * pulse})`);
        cg.addColorStop(1, 'rgba(120,30,10,0)');
        ctx.fillStyle = cg;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rr * 3.4, rr * 2.4, k * 0.7, 0, Math.PI * 2);
        ctx.fill();
        // coal lump
        ctx.fillStyle = `rgba(30,16,10,${0.75 - pulse * 0.25})`;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rr * 0.9, rr * 0.6, k * 0.7, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // Heat shimmer (distortion band) when very hot
      if (heat > 0.85) {
        ctx.save();
        ctx.globalAlpha = 0.05 + (heat - 0.85) * 0.2;
        for (let i = 0; i < 4; i++) {
          const sy = y + (zoneH / 4) * i + Math.sin(this.now * 4 + i + z) * 2;
          ctx.fillStyle = 'rgba(255,200,120,0.25)';
          ctx.fillRect(zx, sy, zw, 1);
        }
        ctx.restore();
      }

      // Grate — metal bars with warm highlight
      ctx.save();
      roundRectPath(ctx, zx, y + 2, zw, zoneH - 4, 6);
      ctx.clip();
      for (let gx = zx + 10; gx < zx + zw - 8; gx += 13) {
        // shadow under bar
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(gx, y + 3, 3.2, zoneH - 6);
        // bar
        const barG = ctx.createLinearGradient(gx, 0, gx + 3.2, 0);
        barG.addColorStop(0, '#2A2320');
        barG.addColorStop(0.3, '#6B635D');
        barG.addColorStop(0.6, '#4A4440');
        barG.addColorStop(1, '#221C19');
        ctx.fillStyle = barG;
        ctx.fillRect(gx, y + 4, 2.8, zoneH - 8);
        // hot top highlight
        ctx.fillStyle = `rgba(255,200,120,${0.18 + heat * 0.18})`;
        ctx.fillRect(gx + 0.3, y + 4, 0.8, zoneH - 8);
      }
      // cross bars
      ctx.fillStyle = 'rgba(20,14,10,0.7)';
      ctx.fillRect(zx + 4, y + zoneH * 0.25, zw - 8, 2);
      ctx.fillRect(zx + 4, y + zoneH * 0.7, zw - 8, 2);
      ctx.restore();

      // Rim of firebox
      roundRectPath(ctx, zx, y + 2, zw, zoneH - 4, 6);
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Flame pips heat indicator on the side brick
      for (let e = 0; e < zone.embers; e++) {
        flameIcon(ctx, overallX + 8 + e * 12, y + zoneH - 12, 5, heat > 0.9);
      }
    }

    // Food on the grill
    for (const f of this.sim.foods) {
      if (!f.onGrill || f.served) continue;
      if (this.drag?.food === f) continue;
      const p = this.foodScreenPos(f);
      this.drawFood(ctx, f, p.x, p.y, 1);
    }

    // ── Charcoal gauge (on the brick skirt under the firebox) ──
    this.drawCharcoalGauge(ctx, fx, GRILL_BOTTOM + 8, fw);
  }

  private drawCharcoalGauge(ctx: CanvasRenderingContext2D, bx: number, by: number, bw: number): void {
    const g = this.sim.grill;
    const remaining = clamp01(1 - g.charcoalT);
    const refilling = g.refilling > 0;
    const low = remaining < 0.3;
    const bh = 12;

    // recessed track
    roundRectPath(ctx, bx, by, bw, bh, bh / 2);
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    roundRectPath(ctx, bx + 1, by + 1, bw - 2, bh - 2, (bh - 2) / 2);
    ctx.fill();

    const fw = (bw - 2) * remaining;
    if (fw > 2) {
      roundRectPath(ctx, bx + 1, by + 1, fw, bh - 2, (bh - 2) / 2);
      const fill = ctx.createLinearGradient(bx, 0, bx + fw, 0);
      if (low) {
        const p = 0.5 + Math.sin(this.now * 8) * 0.3;
        fill.addColorStop(0, C.telha);
        fill.addColorStop(1, mix(hex(C.telha), hex(C.ambar), p));
      } else {
        fill.addColorStop(0, C.brasaHot);
        fill.addColorStop(0.5, C.chama);
        fill.addColorStop(1, C.brasa);
      }
      ctx.fillStyle = fill;
      ctx.fill();
      // sheen
      ctx.fillStyle = 'rgba(255,240,200,0.35)';
      roundRectPath(ctx, bx + 1, by + 1, fw, bh * 0.45, (bh - 2) * 0.22);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(255,214,160,0.22)';
    ctx.lineWidth = 1;
    roundRectPath(ctx, bx + 0.5, by + 0.5, bw - 1, bh - 1, (bh - 1) / 2);
    ctx.stroke();

    // Icon + label overlay
    flameIcon(ctx, bx + 12, by + bh / 2, 5.5, !low);
    ctx.font = font(10, 800, UI);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = low ? C.telha : C.creme;
    ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 3;
    ctx.fillText(this.l10n.t('ui.hud.charcoal'), bx + 24, by + bh / 2);
    ctx.shadowBlur = 0;
    if (refilling) {
      ctx.textAlign = 'right';
      ctx.fillStyle = C.ambar;
      ctx.fillText(`${g.refilling.toFixed(1)}s`, bx + bw - 10, by + bh / 2);
    } else if (low) {
      const pulse = 0.5 + Math.sin(this.now * 6) * 0.5;
      ctx.globalAlpha = pulse;
      ctx.textAlign = 'right';
      ctx.fillStyle = C.telha;
      ctx.font = font(10, 900, UI);
      ctx.fillText('!', bx + bw - 10, by + bh / 2);
      ctx.globalAlpha = 1;
    }
  }

  private drawFood(ctx: CanvasRenderingContext2D, f: FoodRuntime, x: number, y: number, scale: number): void {
    const d = overallDoneness(f);
    const ing = f.ingredient;
    const heat = f.onGrill ? (this.sim.grill.zones[f.zoneIndex]?.heatMultiplier ?? 1) * this.sim.grill.charcoalEfficiency : 0.4;

    drawFoodArt(ctx, ing, x, y, {
      doneness: d,
      burned: f.burned,
      scale,
      glow: f.onGrill ? 1 : 0.4,
      heat,
    });

    // Smoke while cooking — denser as it cooks
    if (d > 0.3 && Math.random() < 0.08) {
      const hh = ing.sides >= 4 ? 17 : 25;
      const w = ing.sides >= 4 ? 44 : 54;
      const col = d > 1 ? 'rgba(55,55,55,.55)' : 'rgba(220,210,195,.32)';
      this.particles.push({
        x: x + (Math.random() - 0.5) * w * 0.6, y: y - hh * scale,
        vx: (Math.random() - 0.5) * 8, vy: -26 - Math.random() * 18,
        life: 0, max: 1.1 + Math.random() * 0.7,
        size: 5 + Math.random() * 5,
        color: col, kind: 'smoke'
      });
    }

    // Stage label
    const stage = String(stageOf(this.db, f));
    const even = evenness(f);
    const hh = (ing.sides >= 4 ? 17 : 25) * scale;
    outlinedText(
      ctx, this.stageLabel(f, stage).toUpperCase(),
      x, y + hh / 2 + 14,
      f.burned ? C.telha : even < 0.6 ? C.ambar : 'rgba(244,231,211,0.85)',
      10, { weight: 800, family: UI, outline: 3 }
    );
    if (even < 0.6 && !f.burned) {
      outlinedText(
        ctx, this.l10n.t('ui.feedback.flipHint'),
        x, y + hh / 2 + 25, C.ambar, 9, { weight: 700, family: UI, outline: 2.5 }
      );
    }
  }

  private stageLabel(food: FoodRuntime, id: string): string {
    const ns = food.ingredient.stageOverrides?.length
      ? (food.ingredient.id === 'pao_de_alho' ? 'pao' : 'queijo')
      : null;
    const key = ns ? `stage.${ns}.${id}` : `ui.stage.${id}`;
    return this.l10n.t(key);
  }

  private drawBench(ctx: CanvasRenderingContext2D): void {
    const by = BENCH_TOP - 16, bh = H - by + 10;
    // shadow under bench lip
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(8, by - 4, W - 16, 8);

    // Wooden bench with grain
    ctx.save();
    roundRectPath(ctx, 6, by, W - 12, bh, 16);
    ctx.clip();
    drawWoodGrain(ctx, 6, by, W - 12, bh, { planks: 3 });
    ctx.restore();

    // Lip highlight
    ctx.save();
    roundRectPath(ctx, 6, by, W - 12, bh, 16);
    ctx.clip();
    const lip = ctx.createLinearGradient(0, by, 0, by + 8);
    lip.addColorStop(0, 'rgba(255,230,185,0.4)');
    lip.addColorStop(1, 'rgba(255,230,185,0)');
    ctx.fillStyle = lip;
    ctx.fillRect(6, by, W - 12, 8);
    ctx.restore();

    // Rounded border
    ctx.strokeStyle = 'rgba(255,214,160,0.22)';
    ctx.lineWidth = 1.5;
    roundRectPath(ctx, 6 + 0.75, by + 0.75, W - 12 - 1.5, bh - 1.5, 16 - 0.75);
    ctx.stroke();

    outlinedText(
      ctx, this.l10n.t('ui.hud.bench'),
      20, by + 12, 'rgba(255,235,205,0.75)', 11,
      { weight: 800, family: UI, align: 'left', outline: 2 }
    );

    this.unlocked.forEach((ing, i) => {
      const r = this.benchItemRect(i);
      if (r.y + r.h > H) return;
      const isDragging = this.drag !== null && this.drag.food.ingredient.id === ing.id;

      panel(ctx, r.x, r.y, r.w, r.h, {
        r: 12,
        top: 'rgba(50,35,26,0.95)',
        bottom: 'rgba(26,17,12,0.95)',
        border: isDragging ? C.brasa : 'rgba(255,214,160,0.18)',
        borderWidth: isDragging ? 2 : 1,
        shadow: 8,
        shadowAlpha: 0.4,
        innerGlow: true,
        glowTop: 'rgba(255,220,170,0.18)',
      });

      // Silhouette, name, value
      drawFoodIcon(ctx, ing, r.x + r.w / 2, r.y + 24, 32);

      const label = this.l10n.t(ing.nameKey);
      outlinedText(
        ctx, label.length > 13 ? label.slice(0, 12) + '…' : label,
        r.x + r.w / 2, r.y + 48, C.perola, 10,
        { weight: 800, family: UI, outline: 2 }
      );
      // value with coin
      ctx.save();
      glass(ctx, r.x + r.w / 2 - 22, r.y + r.h - 17, 44, 14, { r: 7, alpha: 0.18, border: 'rgba(231,194,74,0.4)' });
      coinIcon(ctx, r.x + r.w / 2 - 11, r.y + r.h - 10, 5.5);
      ctx.font = font(11, 900, UI);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = C.ouroLight;
      ctx.fillText(String(ing.value), r.x + r.w / 2 - 3, r.y + r.h - 10);
      ctx.restore();
    });
  }

  private drawDragged(ctx: CanvasRenderingContext2D): void {
    const d = this.drag!;
    const overGrill = d.y > GRILL_TOP - 4 && d.y < GRILL_BOTTOM + 4;

    if (overGrill) {
      const z = this.zoneAt(d.y);
      if (z >= 0) {
        const zh = (GRILL_BOTTOM - (GRILL_TOP)) / this.zoneCount();
        const overallX = W / 2 - (GRILL_BODY_W + 28) / 2;
        const zx = overallX + 22;
        const zw = GRILL_BODY_W - 12;
        const zy = (GRILL_TOP) + zh * z;
        // glowing target zone
        roundRectPath(ctx, zx, zy + 4, zw, zh - 8, 8);
        ctx.fillStyle = 'rgba(242,166,59,0.14)';
        ctx.fill();
        ctx.save();
        ctx.setLineDash([8, 5]);
        ctx.lineDashOffset = -this.now * 28;
        ctx.strokeStyle = C.chama;
        ctx.lineWidth = 2.5;
        ctx.shadowColor = C.chama;
        ctx.shadowBlur = 8;
        roundRectPath(ctx, zx, zy + 4, zw, zh - 8, 8);
        ctx.stroke();
        ctx.restore();
      }
    }

    ctx.save();
    ctx.translate(0, -6);
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = 20;
    ctx.shadowOffsetY = 12;
    this.drawFood(ctx, d.food, d.x, d.y, 1.22);
    ctx.restore();
  }

  private drawParticles(ctx: CanvasRenderingContext2D): void {
    for (const p of this.particles) {
      const t = p.life / p.max;
      ctx.globalAlpha = Math.max(0, 1 - t);
      if (p.kind === 'ring') {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 4 * (1 - t);
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size + t * 40, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;
      } else if (p.kind === 'confetti') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot ?? 0);
        ctx.fillStyle = p.color;
        const s = p.size * (1 - t * 0.3);
        if (p.shape === 'rect') ctx.fillRect(-s, -s / 2, s * 2, s);
        else ctx.fillRect(-s / 2, -s / 2, s, s);
        ctx.restore();
      } else if (p.kind === 'smoke') {
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * (1 + t));
        g.addColorStop(0, p.color);
        g.addColorStop(1, 'rgba(180,180,180,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1 + t), 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1 - t * 0.5), 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }
    ctx.globalAlpha = 1;
  }

  private drawFloats(ctx: CanvasRenderingContext2D): void {
    for (const f of this.floats) {
      const t = f.life / 1.2;
      const rise = ease.outCubic(clamp01(t)) * 32;
      ctx.globalAlpha = Math.max(0, 1 - t * t);
      ctx.save();
      ctx.translate(0, -4);
      outlinedText(
        ctx, f.text, f.x, f.y - rise, f.color, f.size,
        { weight: 900, family: DISPLAY, outline: 5, shadow: 6,
          shadowColor: f.color === C.ouroLight ? 'rgba(231,194,74,0.6)' : 'rgba(0,0,0,0.6)' }
      );
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  private drawBanner(ctx: CanvasRenderingContext2D): void {
    const life = clamp01(this.bannerLife);
    // Slide in from above the HUD (from y = 20 to y = 58) so it never covers the
    // HUD contents (coins/timer/combo live between y=8 and y=56).
    const t = clamp01((0.5 - life) / 0.5);
    const slide = (1 - ease.outBack(clamp01(t * 2.2))) * 40;
    ctx.globalAlpha = Math.min(1, life * 3);
    const w = 280, x = W / 2 - w / 2, y = 58 - slide;
    const bh = 28;
    ctx.save();
    ctx.shadowColor = 'rgba(224,86,31,0.6)';
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 4;
    const bG = ctx.createLinearGradient(0, y, 0, y + bh);
    bG.addColorStop(0, '#F07532');
    bG.addColorStop(1, C.vermelho);
    roundRectPath(ctx, x, y, w, bh, bh / 2);
    ctx.fillStyle = bG;
    ctx.fill();
    ctx.restore();
    roundRectPath(ctx, x + 1, y + 1, w - 2, bh * 0.5, bh * 0.25);
    ctx.fillStyle = 'rgba(255,240,215,0.25)';
    ctx.fill();
    outlinedText(ctx, this.bannerText, W / 2, y + bh / 2 + 1, C.perola, 14, { outline: 2.5, weight: 800 });
    ctx.globalAlpha = 1;
  }

  private drawResult(ctx: CanvasRenderingContext2D): void {
    const r = this.lastResult!;
    const t = this.resultT;
    this.drawParticles(ctx);

    // Scrim — darker, slightly warm
    ctx.fillStyle = 'rgba(6,3,2,0.82)';
    ctx.fillRect(0, 0, W, H);
    // warm rays behind the card when doing well
    if (r.stars >= 2) {
      ctx.save();
      ctx.translate(W / 2, 230);
      ctx.rotate(this.now * 0.15);
      for (let i = 0; i < 12; i++) {
        ctx.rotate(Math.PI * 2 / 12);
        const ray = ctx.createLinearGradient(0, 0, 0, -380);
        ray.addColorStop(0, 'rgba(255,200,100,0.12)');
        ray.addColorStop(1, 'rgba(255,180,80,0)');
        ctx.fillStyle = ray;
        ctx.beginPath();
        ctx.moveTo(-14, 0); ctx.lineTo(14, 0); ctx.lineTo(6, -380); ctx.lineTo(-6, -380);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }

    const enter = ease.outBack(clamp01(t / 0.5));
    const cw = 340, cx = W / 2 - cw / 2;
    const cy = 120 + (1 - enter) * 90;
    const ch = 400;

    // Ambient glow behind card
    const cardGlow = ctx.createRadialGradient(W / 2, cy + ch / 2, 40, W / 2, cy + ch / 2, 300);
    cardGlow.addColorStop(0, r.stars === 3 ? 'rgba(231,194,74,0.22)' : 'rgba(224,86,31,0.18)');
    cardGlow.addColorStop(1, 'rgba(224,86,31,0)');
    ctx.fillStyle = cardGlow;
    ctx.fillRect(0, 0, W, H);

    panel(ctx, cx, cy, cw, ch, {
      r: 24,
      top: 'rgba(58,42,30,0.98)',
      bottom: 'rgba(24,16,10,0.98)',
      border: r.stars === 3 ? C.ouro : 'rgba(255,214,160,0.28)',
      borderWidth: r.stars === 3 ? 2 : 1.5,
      shadow: 32,
      shadowAlpha: 0.7,
      glowTop: 'rgba(255,220,160,0.3)',
    });

    // inner top accent bar
    const accent = ctx.createLinearGradient(cx, cy + 14, cx + cw, cy + 14);
    accent.addColorStop(0, 'rgba(224,86,31,0)');
    accent.addColorStop(0.5, C.chama);
    accent.addColorStop(1, 'rgba(224,86,31,0)');
    ctx.fillStyle = accent;
    ctx.fillRect(cx + 20, cy + 14, cw - 40, 2);

    outlinedText(
      ctx, this.l10n.t('ui.result.title'),
      W / 2, cy + 48, C.perola, 34, { outline: 4, shadow: 6, shadowColor: 'rgba(0,0,0,0.7)' }
    );
    ctx.font = font(12, 700, UI);
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(244,231,211,0.5)';
    ctx.fillText(this.levels[this.levelIndex]?.id?.toUpperCase() ?? '', W / 2, cy + 72);

    // Stars — pop in with scale overshoot and glow
    for (let i = 0; i < 3; i++) {
      const st = clamp01((t - 0.4 - i * 0.2) / 0.3);
      if (st <= 0) continue;
      const sc = ease.outBack(st);
      const earned = i < r.stars;
      ctx.save();
      ctx.translate(W / 2 + (i - 1) * 58, cy + 122);
      ctx.scale(sc, sc);
      starIcon(ctx, 0, 0, 24, { filled: earned, glow: earned });
      ctx.restore();
    }

    // Stat rows
    const rows: [string, string, string][] = [
      [this.l10n.t('ui.result.coins'), `+${r.coins.toLocaleString(this.l10n.locale)}`, C.ouroLight],
      [this.l10n.t('ui.result.perfect'), String(r.perfect), C.chamaCore],
      [this.l10n.t('ui.result.burned'), String(r.burned), r.burned > 0 ? C.telha : 'rgba(244,231,211,0.5)'],
      [this.l10n.t('ui.result.bestCombo'), `×${r.combo}`, C.brasaHot],
      [this.l10n.t('ui.result.xp'), `+${r.xp.toLocaleString(this.l10n.locale)}`, C.perola],
    ];
    rows.forEach(([k, v, col], i) => {
      const st = clamp01((t - 0.9 - i * 0.08) / 0.25);
      if (st <= 0) return;
      const y = cy + 192 + i * 32;
      const slide = (1 - ease.outCubic(st)) * 22;
      ctx.globalAlpha = st;
      // row divider
      ctx.strokeStyle = 'rgba(255,214,160,0.08)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(cx + 28, y - 10); ctx.lineTo(cx + cw - 28, y - 10); ctx.stroke();

      ctx.font = font(14, 700, UI);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(244,231,211,0.7)';
      ctx.fillText(k, cx + 32 - slide, y);
      ctx.textAlign = 'right';
      ctx.fillStyle = col;
      ctx.font = font(17, 900, DISPLAY);
      ctx.shadowColor = col.startsWith('rgb') ? 'rgba(0,0,0,0.4)' : (col === C.ouroLight ? 'rgba(231,194,74,0.4)' : 'rgba(0,0,0,0.4)');
      ctx.shadowBlur = 4;
      ctx.fillText(v, cx + cw - 32 + slide, y);
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    });

    // Next button
    const btnT = clamp01((t - 1.4) / 0.35);
    if (btnT > 0) {
      const breathe = 1 + Math.sin(this.now * 2.4) * 0.015;
      const bw = 240 * breathe, bh = 60 * breathe;
      const bx = W / 2 - bw / 2, byy = cy + ch + 24;
      ctx.save();
      ctx.globalAlpha = btnT;
      premiumButton(ctx, bx, byy, bw, bh, { variant: r.stars === 3 ? 'gold' : 'primary' });
      ctx.restore();
      outlinedText(
        ctx, this.l10n.t('ui.action.next'),
        W / 2, byy + bh / 2 + 2, C.perola, 20, { outline: 3, weight: 900 }
      );
    }

    // Lifetime footer
    if (t > 1.6) {
      ctx.globalAlpha = clamp01((t - 1.6) / 0.4);
      ctx.font = font(12, 700, UI);
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(244,231,211,0.55)';
      ctx.fillText(
        `${this.l10n.t('ui.result.bestCombo')}: ×${this.bestComboEver}  ·  ` +
        `${this.totalCoins.toLocaleString(this.l10n.locale)} ${this.l10n.t('currency.coins').toLowerCase()}`,
        W / 2, cy + ch + 114
      );
      ctx.globalAlpha = 1;
    }
  }
}

// ── Bootstrap ───────────────────────────────────────────────────────────────
const canvas = document.getElementById('c') as HTMLCanvasElement;
const game = new Game();
game.init(canvas).catch((err) => {
  const ctx = canvas.getContext('2d')!;
  canvas.width = 420;
  canvas.height = 300;
  ctx.fillStyle = '#1C1512';
  ctx.fillRect(0, 0, 420, 300);
  ctx.fillStyle = '#F4E7D3';
  ctx.font = '14px system-ui';
  ctx.fillText('Falha ao iniciar: ' + String(err), 16, 40);
  console.error(err);
});
