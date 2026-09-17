/**
 * CHURRASCO! O Mestre da Brasa — design-verification prototype.
 *
 * This is NOT the shipping client. It exists to answer one question as fast as
 * possible: is the grill fun? It runs the REAL rules from `tools/sim-core` — the
 * same cooking integration, scoring, patience and combo code that the Unity
 * client ports — so what feels good here is what will feel good there.
 *
 * Deliberately excluded: 3D, real assets, audio assets, meta screens. Placeholders
 * only, and every one is listed as such in docs/18-STATUS.md (spec §82).
 */
import { createDatabase, validateDatabase } from '../../tools/sim-core/src/data.ts';
import { overallDoneness, evenness, stageOf, type FoodRuntime } from '../../tools/sim-core/src/cooking.ts';
import { TurnSimulation, type CustomerRuntime } from '../../tools/sim-core/src/turn.ts';
import type { GameDatabase, Ingredient, RawDataBundle } from '../../tools/sim-core/src/types.ts';
import { createL10n, type L10n, type L10nTable } from '../../tools/sim-core/src/l10n.ts';
import {
  C, DISPLAY, UI, avatar, checkIcon, clamp01, clockIcon, coinIcon, ease, flameIcon,
  font, hex, mix, outlinedText, panel, pill, roundRectPath, shade, starIcon
} from './theme.ts';
import { drawFood as drawFoodArt, drawFoodIcon } from './foods.ts';

const W = 420;
const H = 780;
const GRILL_TOP = 178;
const GRILL_BOTTOM = 556;
const BENCH_TOP = 600;

type Screen = 'title' | 'play' | 'result';

interface Particle {
  x: number; y: number; vx: number; vy: number; life: number; max: number;
  size: number; color: string; kind: 'smoke' | 'spark' | 'coin' | 'ring';
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

  private benchScroll = 0;
  private unlocked: Ingredient[] = [];
  /** Cached backdrop — the static layers never change, so they are drawn once. */
  private bgCache: HTMLCanvasElement | null = null;
  /** Monotonic clock in seconds, for idle animation. */
  private now = 0;
  /** Seconds since the result screen appeared, for its staggered entrance. */
  private resultT = 0;

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
    this.requestNextLevel();

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

  /**
   * Loads the locale table. `?lang=` switches locale; anything incomplete falls
   * back to pt-BR, the authored language (§56).
   */
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

    if (this.sim.finished) this.finishTurn();
    this.updateEffects(dt);
  }

  private reactToEvents(before: TurnSimulation['counters']): void {
    for (const ev of this.sim.events) {
      if (ev.type === 'perfect') {
        const p = this.foodScreenPos(ev.food);
        this.float(p.x, p.y - 20, this.l10n.t('ui.quality.perfect'), C.ouro, 26);
        this.burst(p.x, p.y, 12, C.chama, 'spark');
        this.ring(p.x, p.y);
        this.comboPulse = 1;
        this.flash = 0.35;
      } else if (ev.type === 'burned') {
        const p = this.foodScreenPos(ev.food);
        this.float(p.x, p.y - 16, this.l10n.t('ui.quality.burned'), C.telha, 22);
        this.burst(p.x, p.y, 10, '#4a4a4a', 'smoke');
      } else if (ev.type === 'left') {
        this.float(W / 2, 150, this.l10n.t('ui.feedback.customerLeft'), C.telha, 16);
      } else if (ev.type === 'combo' && ev.milestone) {
        this.float(W / 2, 300, this.l10n.t('ui.feedback.comboMilestone', { n: ev.combo }), C.brasa, 34);
        this.flash = 0.6;
      } else if (ev.type === 'charcoal_low') {
        this.banner(this.l10n.t('ui.hud.charcoal.low'));
      }
    }
    this.sim.events.length = 0;

    if (this.sim.counters.customersServed > before.customersServed) {
      this.burst(W - 40, 60, 8, C.ouro, 'coin');
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
  }

  private updateEffects(dt: number): void {
    // Ambient ember glow from the coals.
    if (this.screen === 'play' && Math.random() < dt * 14) {
      const z = 2;
      this.particles.push({
        x: 40 + Math.random() * (W - 80),
        y: this.zoneY(z) + 20 + Math.random() * 30,
        vx: (Math.random() - 0.5) * 8, vy: -18 - Math.random() * 22,
        life: 0, max: 1.4 + Math.random(), size: 1.5 + Math.random() * 2,
        color: Math.random() < 0.5 ? C.brasa : C.chama, kind: 'spark'
      });
    }
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]!;
      p.life += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.kind === 'smoke') {
        p.vy -= 6 * dt;
        p.size += 14 * dt;
      } else {
        p.vy += 60 * dt;
      }
      if (p.life >= p.max) this.particles.splice(i, 1);
    }
    for (let i = this.floats.length - 1; i >= 0; i--) {
      const f = this.floats[i]!;
      f.life += dt;
      f.y -= 26 * dt;
      if (f.life > 1.1) this.floats.splice(i, 1);
    }
    this.flash = Math.max(0, this.flash - dt * 2);
    this.comboPulse = Math.max(0, this.comboPulse - dt * 2.4);
    this.bannerLife = Math.max(0, this.bannerLife - dt);
  }

  // ── Geometry ──────────────────────────────────────────────────────────────
  private zoneCount(): number {
    return this.sim.grill.zones.length;
  }
  private zoneY(zoneIndex: number): number {
    const n = this.zoneCount();
    const h = (GRILL_BOTTOM - GRILL_TOP) / n;
    // index 0 = low = top, last = high = bottom
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
    const usable = W - 90;
    const step = usable / cap;
    return 45 + step * (slot + 0.5);
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
    return { x: 14 + (i % 5) * (w + gap), y: BENCH_TOP + Math.floor(i / 5) * 74, w, h: 66 };
  }
  private orderCardRect(i: number): { x: number; y: number; w: number; h: number } {
    const w = 128;
    const gap = 8;
    return { x: 10 + (i % 3) * (w + gap), y: 46 + Math.floor(i / 3) * 62, w, h: 56 };
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

      if (this.screen === 'title') {
        this.screen = 'play';
        return;
      }
      if (this.screen === 'result') {
        this.levelIndex++;
        this.requestNextLevel();
        return;
      }

      // Bench → start a new item
      for (let i = 0; i < this.unlocked.length; i++) {
        const r = this.benchItemRect(i);
        if (p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) {
          const food = this.sim.takeFromStock(this.unlocked[i]!);
          this.drag = { food, fromBench: true, x: p.x, y: p.y, startX: p.x, startY: p.y, moved: false, startTime: performance.now() };
          return;
        }
      }

      // Grill → pick up an existing item
      for (const f of this.sim.foods) {
        if (!f.onGrill || f.served) continue;
        const pos = this.foodScreenPos(f);
        if (Math.abs(p.x - pos.x) < 30 && Math.abs(p.y - pos.y) < 24) {
          this.drag = { food: f, fromBench: false, x: p.x, y: p.y, startX: p.x, startY: p.y, moved: false, startTime: performance.now() };
          return;
        }
      }

      // Charcoal bar → refill
      if (p.y > GRILL_BOTTOM + 6 && p.y < GRILL_BOTTOM + 30) {
        if (this.sim.refillCharcoal()) this.banner(this.l10n.t('ui.hud.charcoal'));
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

      // Tap (no drag) → flip
      if (!d.moved && !d.fromBench && d.food.onGrill) {
        if (this.sim.flip(d.food)) {
          const pos = this.foodScreenPos(d.food);
          this.burst(pos.x, pos.y + 10, 6, C.chama, 'spark');
          this.float(pos.x, pos.y - 22, this.l10n.t('ui.feedback.flip'), C.creme, 15);
        }
        return;
      }
      // Long press on a cooked item → serve to the first matching customer
      if (!d.moved && !d.fromBench && held >= 0.45) {
        this.tryServe(d.food, this.bestCustomerFor(d.food));
        return;
      }

      // Dropped on a customer card → serve
      for (let i = 0; i < this.sim.customers.length; i++) {
        const c = this.sim.customers[i]!;
        if (c.state !== 'waiting') continue;
        const r = this.orderCardRect(this.visibleIndexOf(c));
        if (d.x >= r.x - 6 && d.x <= r.x + r.w + 6 && d.y >= r.y - 6 && d.y <= r.y + r.h + 6) {
          this.tryServe(d.food, c);
          return;
        }
      }

      // Dropped on the grill → place / move
      if (d.y > GRILL_TOP && d.y < GRILL_BOTTOM) {
        const z = this.zoneAt(d.y);
        if (z >= 0) {
          const ok = d.fromBench ? this.sim.place(d.food, z) : this.sim.move(d.food, z);
          if (!ok) this.float(d.x, d.y, this.l10n.t('ui.quality.grillFull'), C.telha, 14);
        }
        return;
      }

      // Dropped back on the bench → discard
      if (d.y > BENCH_TOP - 20) {
        if (!d.fromBench) this.sim.discard(d.food);
        else this.sim.discard(d.food);
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
      /* handled by the event stream */
    } else if (scored.quality === 'good') {
      this.float(pos.x, pos.y, this.l10n.t('ui.quality.good'), C.verde, 22);
    } else if (scored.quality === 'burned') {
      this.float(pos.x, pos.y, 'QUEIMADO', C.telha, 22);
    } else {
      this.float(pos.x, pos.y, this.l10n.t(scored.quality === 'raw' ? 'ui.quality.raw' : 'ui.quality.overcooked'), C.ambar, 20);
    }
    if (scored.coins > 0) this.float(pos.x, pos.y + 24, `+${scored.coins}`, C.ouro, 18);
  }

  // ── Effects helpers ───────────────────────────────────────────────────────
  private burst(x: number, y: number, n: number, color: string, kind: Particle['kind']): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 40 + Math.random() * 90;
      this.particles.push({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 30,
        life: 0, max: 0.5 + Math.random() * 0.5, size: kind === 'smoke' ? 6 + Math.random() * 6 : 2 + Math.random() * 2.5,
        color, kind
      });
    }
  }
  private ring(x: number, y: number): void {
    this.particles.push({ x, y, vx: 0, vy: 0, life: 0, max: 0.45, size: 8, color: C.ouro, kind: 'ring' });
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
    const availH = window.innerHeight - 40;
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
   * Backyard at golden hour (docs/04-ART_STYLE.md §1): a warm sky gradient, a
   * soft light pool behind the grill, and a vignette to focus the centre.
   * Cached — it never changes frame to frame.
   */
  private drawBackdrop(ctx: CanvasRenderingContext2D): void {
    if (!this.bgCache) {
      const off = document.createElement('canvas');
      off.width = W;
      off.height = H;
      const c = off.getContext('2d')!;

      const sky = c.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, '#3B2418');
      sky.addColorStop(0.32, '#2C1B12');
      sky.addColorStop(0.68, '#20140D');
      sky.addColorStop(1, '#150D08');
      c.fillStyle = sky;
      c.fillRect(0, 0, W, H);

      // warm light pool behind the grill (key light, R4)
      const pool = c.createRadialGradient(W / 2, 380, 20, W / 2, 380, 340);
      pool.addColorStop(0, 'rgba(224,86,31,0.20)');
      pool.addColorStop(0.5, 'rgba(224,86,31,0.07)');
      pool.addColorStop(1, 'rgba(224,86,31,0)');
      c.fillStyle = pool;
      c.fillRect(0, 0, W, H);

      // fence silhouettes — depth without detail (R2)
      c.fillStyle = 'rgba(12,8,6,0.5)';
      for (let i = 0; i < 7; i++) {
        const bx = -10 + i * 64;
        c.fillRect(bx, 96, 46, 96);
      }
      c.fillStyle = 'rgba(12,8,6,0.34)';
      c.fillRect(0, 92, W, 10);
      c.fillRect(0, 150, W, 8);

      // vignette
      const vig = c.createRadialGradient(W / 2, H * 0.46, H * 0.26, W / 2, H * 0.5, H * 0.78);
      vig.addColorStop(0, 'rgba(0,0,0,0)');
      vig.addColorStop(1, 'rgba(0,0,0,0.55)');
      c.fillStyle = vig;
      c.fillRect(0, 0, W, H);

      this.bgCache = off;
    }
    ctx.drawImage(this.bgCache, 0, 0);
  }

  private draw(canvas: HTMLCanvasElement): void {
    const ctx = canvas.getContext('2d')!;
    ctx.save();
    ctx.clearRect(0, 0, W, H);
    this.drawBackdrop(ctx);

    if (this.screen === 'result') this.drawResult(ctx);
    else this.drawPlay(ctx);

    ctx.restore();
  }

  private drawPlay(ctx: CanvasRenderingContext2D): void {
    this.drawOrders(ctx);
    this.drawGrill(ctx);
    this.drawBench(ctx);
    this.drawParticles(ctx);
    this.drawHud(ctx);
    this.drawFloats(ctx);
    if (this.drag) this.drawDragged(ctx);
    if (this.bannerLife > 0) this.drawBanner(ctx);
    if (this.flash > 0) {
      const f = ctx.createRadialGradient(W / 2, H * 0.45, 40, W / 2, H * 0.45, W);
      f.addColorStop(0, `rgba(255,206,128,${this.flash * 0.26})`);
      f.addColorStop(1, 'rgba(255,206,128,0)');
      ctx.fillStyle = f;
      ctx.fillRect(0, 0, W, H);
    }
  }

  private drawHud(ctx: CanvasRenderingContext2D): void {
    const sim = this.sim;
    const loc = this.l10n.locale;

    // A single raised strip so the stats read as one object, not floating text.
    panel(ctx, -20, -14, W + 40, 58, {
      r: 0,
      top: 'rgba(38,26,20,0.96)',
      bottom: 'rgba(20,14,10,0.96)',
      border: 'none',
      shadow: 12,
      innerGlow: false
    });
    const edge = ctx.createLinearGradient(0, 42, 0, 46);
    edge.addColorStop(0, 'rgba(224,86,31,0.6)');
    edge.addColorStop(1, 'rgba(224,86,31,0)');
    ctx.fillStyle = edge;
    ctx.fillRect(0, 42, W, 4);

    ctx.textBaseline = 'middle';

    // Coins
    coinIcon(ctx, 26, 22, 9);
    ctx.font = font(16, 800, DISPLAY);
    ctx.textAlign = 'left';
    ctx.fillStyle = C.ouro;
    ctx.fillText(this.coins.toLocaleString(loc), 40, 23);

    // XP
    ctx.font = font(11, 600, UI);
    ctx.fillStyle = 'rgba(244,231,211,0.55)';
    ctx.fillText(`${this.l10n.t('ui.result.xp')} ${this.xp.toLocaleString(loc)}`, 40, 37);

    // Turn timer: a draining ring that shifts amber, then red.
    const left = Math.max(0, sim.timeLeft);
    const frac = sim.timeLimit > 0 ? clamp01(left / sim.timeLimit) : 0;
    const urgent = frac < 0.25;
    ctx.save();
    ctx.translate(W / 2, 22);
    ctx.strokeStyle = 'rgba(255,255,255,0.13)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, 13, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = urgent ? C.vermelho : frac < 0.5 ? C.ambar : C.brasa;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(0, 0, 13, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac);
    ctx.stroke();
    ctx.restore();
    outlinedText(
      ctx,
      `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}`,
      W / 2, 23, urgent ? C.vermelho : C.creme, 13, { outline: 2 }
    );

    // Combo chip — pops on increment rather than pulsing forever.
    if (sim.combo > 1) {
      const pop = 1 + this.comboPulse * 0.3;
      ctx.save();
      ctx.translate(W - 56, 22);
      ctx.scale(pop, pop);
      pill(ctx, -34, -11, 68, 22, 'rgba(224,86,31,0.28)', { border: C.brasa });
      flameIcon(ctx, -20, 0, 7, sim.combo >= 5);
      ctx.font = font(13, 800, DISPLAY);
      ctx.textAlign = 'center';
      ctx.fillStyle = C.chama;
      ctx.fillText(`×${sim.combo}`, 6, 1);
      ctx.restore();
    } else {
      starIcon(ctx, W - 74, 22, 7, { filled: true });
      ctx.font = font(13, 800, DISPLAY);
      ctx.textAlign = 'center';
      ctx.fillStyle = C.ouro;
      ctx.fillText(String(sim.counters.perfectCooks), W - 50, 23);
    }

    // Charcoal gauge. `charcoalT` is progress through the current load, so the
    // bar shows what is LEFT; it pulses red under the low-fuel threshold.
    const g = sim.grill;
    const remaining = clamp01(1 - g.charcoalT);
    const refilling = g.refilling > 0;
    const low = remaining < 0.3;
    const bx = 14, by = 52, bw = W - 28, bh = 9;

    roundRectPath(ctx, bx, by, bw, bh, bh / 2);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fill();
    roundRectPath(ctx, bx + 1, by + 1, bw - 2, bh - 2, (bh - 2) / 2);
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fill();

    const fw = (bw - 2) * remaining;
    if (fw > 1) {
      roundRectPath(ctx, bx + 1, by + 1, fw, bh - 2, (bh - 2) / 2);
      const fill = ctx.createLinearGradient(bx, 0, bx + fw, 0);
      if (low) {
        const p = 0.5 + Math.sin(this.now * 9) * 0.3;
        fill.addColorStop(0, C.vermelho);
        fill.addColorStop(1, mix(hex(C.vermelho), hex(C.ambar), p));
      } else {
        fill.addColorStop(0, C.brasa);
        fill.addColorStop(1, C.chama);
      }
      ctx.fillStyle = fill;
      ctx.fill();
    }
    roundRectPath(ctx, bx + 0.5, by + 0.5, bw - 1, bh - 1, (bh - 1) / 2);
    ctx.strokeStyle = 'rgba(244,231,211,0.16)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.font = font(10, 700, UI);
    ctx.textAlign = 'left';
    ctx.fillStyle = low ? C.vermelho : 'rgba(244,231,211,0.6)';
    ctx.fillText(this.l10n.t('ui.hud.charcoal'), bx, 74);
    if (refilling) {
      ctx.textAlign = 'right';
      ctx.fillStyle = C.ambar;
      ctx.fillText(`${g.refilling.toFixed(1)}s`, bx + bw, 74);
    }
  }

  private drawOrders(ctx: CanvasRenderingContext2D): void {
    const waiting = this.sim.customers.filter((c) => c.state === 'waiting');
    waiting.forEach((c, i) => {
      const r = this.orderCardRect(i);
      const pct = clamp01(c.patienceLeft / c.patienceTotal);
      const barColor = pct > 0.5 ? C.verde : pct > 0.25 ? C.ambar : C.telha;
      const vip = c.def.isVip;

      // Card. VIP gets a gold rim and a slightly warmer body.
      panel(ctx, r.x, r.y, r.w, r.h, {
        r: 12,
        top: vip ? 'rgba(62,48,28,0.97)' : 'rgba(44,32,25,0.95)',
        bottom: vip ? 'rgba(34,26,16,0.97)' : 'rgba(22,15,11,0.95)',
        border: vip ? C.ouro : 'rgba(244,231,211,0.14)',
        borderWidth: vip ? 2 : 1,
        shadow: 9,
        innerGlow: false
      });

      // Avatar disc on the left — a readable face beats a name in a list.
      const ax = r.x + 21, ay = r.y + 20;
      avatar(ctx, ax, ay, 13, vip ? C.ouro : C.telha, 'rgba(244,231,211,0.34)');
      if (vip) starIcon(ctx, ax + 10, ay - 10, 5.5, { filled: true });

      // Name
      ctx.font = font(11, 700, UI);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = vip ? C.ouro : C.madeiraClara;
      const name = this.l10n.t(c.def.nameKey);
      ctx.fillText(name.length > 16 ? name.slice(0, 15) + '…' : name, r.x + 40, r.y + 13);

      // Ordered items as small silhouettes, ticked when fulfilled.
      let ix = r.x + 42;
      for (const line of c.lines) {
        const done = line.fulfilledBy.length > 0;
        const ing = this.db.ingredientById.get(line.ingredientId);
        ctx.save();
        if (done) ctx.globalAlpha = 0.42;
        if (ing) drawFoodIcon(ctx, ing, ix + 9, r.y + 30, 20);
        else {
          roundRectPath(ctx, ix, r.y + 23, 18, 14, 5);
          ctx.fillStyle = C.cinza;
          ctx.fill();
        }
        ctx.restore();
        if (done) checkIcon(ctx, ix + 9, r.y + 30, 8, C.verde);
        ix += 24;
      }

      // Patience bar in a recessed track.
      const bx = r.x + 8, by = r.y + r.h - 11, bw = r.w - 16, bh = 5;
      roundRectPath(ctx, bx, by, bw, bh, bh / 2);
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fill();
      if (pct > 0) {
        roundRectPath(ctx, bx, by, Math.max(bh, bw * pct), bh, bh / 2);
        ctx.fillStyle = barColor;
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.28)';
        roundRectPath(ctx, bx, by, Math.max(bh, bw * pct), bh * 0.45, bh * 0.22);
        ctx.fill();
      }
      // Urgency pulse when the customer is about to walk.
      if (pct < 0.25) {
        const a = 0.12 + Math.sin(this.now * 10) * 0.1;
        roundRectPath(ctx, r.x, r.y, r.w, r.h, 12);
        ctx.strokeStyle = `rgba(163,46,28,${Math.max(0, a + 0.2)})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    });
  }

  private drawGrill(ctx: CanvasRenderingContext2D): void {
    const n = this.zoneCount();
    const h = (GRILL_BOTTOM - GRILL_TOP) / n;
    const bodyX = 20, bodyW = W - 40;
    const bodyY = GRILL_TOP - 20, bodyH = GRILL_BOTTOM - GRILL_TOP + 40;

    // ── Body: brushed metal over a dark firebox, with a cast-iron rim. ──
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 6;
    roundRectPath(ctx, bodyX, bodyY, bodyW, bodyH, 18);
    const body = ctx.createLinearGradient(bodyX, 0, bodyX + bodyW, 0);
    body.addColorStop(0, '#3E3A38');
    body.addColorStop(0.16, '#5E5854');
    body.addColorStop(0.5, '#4A4441');
    body.addColorStop(0.86, '#565050');
    body.addColorStop(1, '#322E2C');
    ctx.fillStyle = body;
    ctx.fill();
    ctx.restore();

    // Rim highlight along the top, shadow along the bottom.
    roundRectPath(ctx, bodyX, bodyY, bodyW, bodyH, 18);
    ctx.clip();
    const rim = ctx.createLinearGradient(0, bodyY, 0, bodyY + 14);
    rim.addColorStop(0, 'rgba(255,236,206,0.30)');
    rim.addColorStop(1, 'rgba(255,236,206,0)');
    ctx.fillStyle = rim;
    ctx.fillRect(bodyX, bodyY, bodyW, 14);
    const foot = ctx.createLinearGradient(0, bodyY + bodyH - 18, 0, bodyY + bodyH);
    foot.addColorStop(0, 'rgba(0,0,0,0)');
    foot.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = foot;
    ctx.fillRect(bodyX, bodyY + bodyH - 18, bodyW, 18);
    ctx.restore();

    ctx.strokeStyle = 'rgba(12,8,6,0.7)';
    ctx.lineWidth = 2;
    roundRectPath(ctx, bodyX + 1, bodyY + 1, bodyW - 2, bodyH - 2, 18);
    ctx.stroke();

    const efficiency = this.sim.grill.charcoalEfficiency;

    for (let z = 0; z < n; z++) {
      const y = GRILL_TOP + h * z;
      const zone = this.db.grill.zones[z]!;
      const heat = zone.heatMultiplier * efficiency;
      const zx = 34, zw = W - 68;

      // Firebox: dark pit, glowing brighter with heat.
      const pit = ctx.createLinearGradient(0, y, 0, y + h);
      const a = Math.min(0.9, 0.24 + heat * 0.42);
      pit.addColorStop(0, `rgba(196,62,20,${a})`);
      pit.addColorStop(0.45, `rgba(224,86,31,${a})`);
      pit.addColorStop(1, `rgba(96,30,12,${a * 0.85})`);
      roundRectPath(ctx, zx, y + 2, zw, h - 4, 8);
      ctx.fillStyle = pit;
      ctx.fill();

      // Coals — deterministic per zone so they do not flicker every frame.
      ctx.save();
      roundRectPath(ctx, zx, y + 2, zw, h - 4, 8);
      ctx.clip();
      const seed = z * 97;
      for (let k = 0; k < 22; k++) {
        const fx = ((seed + k * 37) % 100) / 100;
        const fy = ((seed + k * 61) % 100) / 100;
        const cx = zx + 6 + fx * (zw - 12);
        const cy = y + 6 + fy * (h - 12);
        const rr = 2.5 + ((k * 13) % 4);
        // breathing: each coal pulses on its own offset
        const pulse = 0.55 + 0.45 * Math.sin(this.now * (1.6 + (k % 5) * 0.35) + k);
        const g = ctx.createRadialGradient(cx, cy, 0.5, cx, cy, rr * 3.1);
        g.addColorStop(0, `rgba(255,226,150,${0.55 * pulse * (0.5 + heat * 0.4)})`);
        g.addColorStop(0.35, `rgba(236,116,34,${0.42 * pulse})`);
        g.addColorStop(1, 'rgba(120,34,10,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(cx, cy, rr * 3.1, 0, Math.PI * 2);
        ctx.fill();
        // the coal itself
        ctx.fillStyle = `rgba(40,22,16,${0.55 + 0.25 * (1 - pulse)})`;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rr, rr * 0.72, k * 0.7, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // Grate: bars with a warm top edge so they read as metal, not lines.
      const barW = 3.2;
      for (let gx = zx + 8; gx < zx + zw - 6; gx += 15) {
        ctx.fillStyle = `rgba(16,11,8,${0.62 + heat * 0.12})`;
        ctx.fillRect(gx, y + 5, barW, h - 10);
        ctx.fillStyle = `rgba(255,196,132,${0.16 + heat * 0.12})`;
        ctx.fillRect(gx, y + 5, 1, h - 10);
      }
      // two cross rails
      ctx.fillStyle = 'rgba(16,11,8,0.5)';
      ctx.fillRect(zx + 4, y + h * 0.3, zw - 8, 2);
      ctx.fillRect(zx + 4, y + h * 0.7, zw - 8, 2);

      // Heat label — flame pips instead of emoji.
      for (let e = 0; e < zone.embers; e++) {
        flameIcon(ctx, zx + 8 + e * 11, y + h - 9, 4.5, heat > 0.9);
      }
    }

    // Food on the grill (dragged item is drawn on top by drawDragged).
    for (const f of this.sim.foods) {
      if (!f.onGrill || f.served) continue;
      if (this.drag?.food === f) continue;
      const p = this.foodScreenPos(f);
      this.drawFood(ctx, f, p.x, p.y, 1);
    }
  }

  /**
   * Delegates the silhouette to `foods.ts` and layers the readable state on top:
   * stage label, evenness warning, and the smoke the cook reads for timing.
   */
  private drawFood(ctx: CanvasRenderingContext2D, f: FoodRuntime, x: number, y: number, scale: number): void {
    const d = overallDoneness(f);
    const ing = f.ingredient;

    drawFoodArt(ctx, ing, x, y, {
      doneness: d,
      burned: f.burned,
      scale,
      glow: f.onGrill ? 1 : 0.35
    });

    // Smoke while cooking — the timing cue players learn in seconds.
    if (d > 0.35 && Math.random() < 0.06) {
      const hh = ing.sides >= 4 ? 17 : 25;
      const w = ing.sides >= 4 ? 44 : 54;
      this.particles.push({
        x: x + (Math.random() - 0.5) * w * 0.6, y: y - hh * scale,
        vx: (Math.random() - 0.5) * 6, vy: -22 - Math.random() * 14,
        life: 0, max: 0.9 + Math.random() * 0.5, size: 4 + Math.random() * 4,
        color: d > 1 ? 'rgba(60,60,60,.5)' : 'rgba(220,210,200,.28)', kind: 'smoke'
      });
    }

    // Stage label + evenness warning.
    const stage = String(stageOf(this.db, f));
    const even = evenness(f);
    const hh = (ing.sides >= 4 ? 17 : 25) * scale;
    outlinedText(
      ctx, this.stageLabel(f, stage).toUpperCase(),
      x, y + hh / 2 + 12,
      f.burned ? C.telha : even < 0.6 ? C.ambar : 'rgba(244,231,211,0.78)',
      9, { weight: 700, family: UI, outline: 2.5 }
    );
    if (even < 0.6 && !f.burned) {
      outlinedText(
        ctx, this.l10n.t('ui.feedback.flipHint'),
        x, y + hh / 2 + 22, C.ambar, 8, { weight: 600, family: UI, outline: 2.5 }
      );
    }
  }

  /**
   * Stage display name. Per-food stages (garlic bread, coalho) live in their own
   * namespace; meat stages share `ui.stage.*`. Both come from the locale table —
   * never from a hardcoded map.
   */
  private stageLabel(food: FoodRuntime, id: string): string {
    const ns = food.ingredient.stageOverrides?.length
      ? (food.ingredient.id === 'pao_de_alho' ? 'pao' : 'queijo')
      : null;
    const key = ns ? `stage.${ns}.${id}` : `ui.stage.${id}`;
    return this.l10n.t(key);
  }

  private drawBench(ctx: CanvasRenderingContext2D): void {
    // Wooden bench top: a slab with a lit edge and visible grain.
    const by = BENCH_TOP - 20, bh = H - by + 10;
    panel(ctx, 6, by, W - 12, bh, {
      r: 14,
      top: 'rgba(122,74,42,0.96)',
      bottom: 'rgba(58,34,19,0.96)',
      border: 'rgba(255,214,160,0.16)',
      shadow: 14,
      innerGlow: true
    });
    ctx.save();
    roundRectPath(ctx, 6, by, W - 12, bh, 14);
    ctx.clip();
    ctx.strokeStyle = 'rgba(48,26,13,0.30)';
    ctx.lineWidth = 1.4;
    for (let k = 0; k < 9; k++) {
      const gy = by + 12 + k * 17;
      ctx.beginPath();
      ctx.moveTo(8, gy);
      ctx.bezierCurveTo(W * 0.35, gy + 2.5, W * 0.62, gy - 2.5, W - 8, gy);
      ctx.stroke();
    }
    ctx.restore();

    outlinedText(
      ctx, this.l10n.t('ui.hud.bench'),
      18, by + 9, 'rgba(244,231,211,0.62)', 10,
      { weight: 700, family: UI, align: 'left', outline: 2 }
    );

    this.unlocked.forEach((ing, i) => {
      const r = this.benchItemRect(i);
      if (r.y + r.h > H) return;
      const isDragging = this.drag !== null && this.drag.food.ingredient.id === ing.id;

      panel(ctx, r.x, r.y, r.w, r.h, {
        r: 10,
        top: 'rgba(46,33,26,0.94)',
        bottom: 'rgba(24,17,12,0.94)',
        border: 'rgba(244,231,211,0.14)',
        shadow: 6,
        shadowAlpha: 0.35,
        innerGlow: false
      });

      if (isDragging) {
        roundRectPath(ctx, r.x, r.y, r.w, r.h, 10);
        ctx.strokeStyle = 'rgba(224,86,31,0.5)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Silhouette, then name, then value with a real coin.
      drawFoodIcon(ctx, ing, r.x + r.w / 2, r.y + 24, 30);

      const label = this.l10n.t(ing.nameKey);
      outlinedText(
        ctx, label.length > 13 ? label.slice(0, 12) + '…' : label,
        r.x + r.w / 2, r.y + 46, C.creme, 9,
        { weight: 700, family: UI, outline: 2 }
      );
      coinIcon(ctx, r.x + r.w / 2 - 13, r.y + 59, 5.5);
      ctx.font = font(10, 700, UI);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = C.ouro;
      ctx.fillText(String(ing.value), r.x + r.w / 2 - 5, r.y + 59);
    });
  }

  private drawDragged(ctx: CanvasRenderingContext2D): void {
    const d = this.drag!;
    const overGrill = d.y > GRILL_TOP && d.y < GRILL_BOTTOM;

    // Highlight the target zone BEFORE the drop, so the drop is never a guess.
    if (overGrill) {
      const z = this.zoneAt(d.y);
      if (z >= 0) {
        const zh = (GRILL_BOTTOM - GRILL_TOP) / this.zoneCount();
        const zy = GRILL_TOP + zh * z;
        roundRectPath(ctx, 34, zy + 2, W - 68, zh - 4, 8);
        ctx.fillStyle = 'rgba(242,166,59,0.14)';
        ctx.fill();
        ctx.save();
        ctx.setLineDash([7, 5]);
        ctx.lineDashOffset = -this.now * 22;
        ctx.strokeStyle = C.chama;
        ctx.lineWidth = 2;
        roundRectPath(ctx, 34, zy + 2, W - 68, zh - 4, 8);
        ctx.stroke();
        ctx.restore();
      }
    }

    // Lift the item: slight scale-up, soft shadow beneath the finger.
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 8;
    this.drawFood(ctx, d.food, d.x, d.y, 1.18);
    ctx.restore();
  }

  private drawParticles(ctx: CanvasRenderingContext2D): void {
    for (const p of this.particles) {
      const t = p.life / p.max;
      ctx.globalAlpha = Math.max(0, 1 - t);
      if (p.kind === 'ring') {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 3 * (1 - t);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size + t * 34, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (p.kind === 'smoke' ? 1 + t : 1 - t * 0.6), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  private drawFloats(ctx: CanvasRenderingContext2D): void {
    for (const f of this.floats) {
      const t = f.life / 1.1;
      // rise with ease-out so the number settles rather than drifts linearly
      const rise = ease.outCubic(clamp01(t)) * 26;
      ctx.globalAlpha = Math.max(0, 1 - t * t);
      outlinedText(
        ctx, f.text, f.x, f.y - rise, f.color, f.size,
        { weight: 800, family: DISPLAY, outline: 4, shadow: 3 }
      );
    }
    ctx.globalAlpha = 1;
  }

  private drawBanner(ctx: CanvasRenderingContext2D): void {
    // slides in with a back-out overshoot, then fades
    const life = clamp01(this.bannerLife);
    const t = clamp01((0.6 - life) / 0.6);
    const slide = (1 - ease.outBack(clamp01(t * 2.4))) * 40;
    ctx.globalAlpha = Math.min(1, life * 3);
    const w = 280, x = W / 2 - w / 2, y = 92 - slide;
    panel(ctx, x, y, w, 38, {
      r: 19,
      top: 'rgba(224,86,31,0.95)',
      bottom: 'rgba(163,46,28,0.95)',
      border: 'rgba(255,226,180,0.4)',
      shadow: 12
    });
    outlinedText(ctx, this.bannerText, W / 2, y + 20, C.offwhite, 15, { outline: 2 });
    ctx.globalAlpha = 1;
  }

  private drawResult(ctx: CanvasRenderingContext2D): void {
    const r = this.lastResult!;
    const t = this.resultT;

    // Dim + blur-like scrim.
    ctx.fillStyle = 'rgba(8,5,4,0.78)';
    ctx.fillRect(0, 0, W, H);

    // Card slides up with an overshoot.
    const enter = ease.outBack(clamp01(t / 0.45));
    const cw = 320, cx = W / 2 - cw / 2;
    const cy = 130 + (1 - enter) * 70;
    const ch = 356;
    panel(ctx, cx, cy, cw, ch, {
      r: 20,
      top: 'rgba(48,34,26,0.98)',
      bottom: 'rgba(22,15,11,0.98)',
      border: 'rgba(255,214,160,0.22)',
      borderWidth: 1.5,
      shadow: 26,
      shadowAlpha: 0.6
    });

    outlinedText(
      ctx, this.l10n.t('ui.result.title'),
      W / 2, cy + 40, C.creme, 30, { outline: 3, shadow: 4 }
    );

    // Stars pop in one at a time — earned, not displayed.
    for (let i = 0; i < 3; i++) {
      const st = clamp01((t - 0.35 - i * 0.18) / 0.28);
      if (st <= 0) continue;
      const sc = ease.outBack(st);
      const earned = i < r.stars;
      ctx.save();
      ctx.translate(W / 2 + (i - 1) * 52, cy + 96);
      ctx.scale(sc, sc);
      starIcon(ctx, 0, 0, 20, { filled: earned });
      ctx.restore();
    }

    // Stat rows, staggered.
    const rows: [string, string, string][] = [
      [this.l10n.t('ui.result.coins'), `+${r.coins.toLocaleString(this.l10n.locale)}`, C.ouro],
      [this.l10n.t('ui.result.perfect'), String(r.perfect), C.chama],
      [this.l10n.t('ui.result.burned'), String(r.burned), r.burned > 0 ? C.telha : 'rgba(244,231,211,0.45)'],
      [this.l10n.t('ui.result.bestCombo'), `×${r.combo}`, C.brasa],
      [this.l10n.t('ui.result.xp'), `+${r.xp.toLocaleString(this.l10n.locale)}`, C.creme]
    ];
    rows.forEach(([k, v, col], i) => {
      const st = clamp01((t - 0.75 - i * 0.08) / 0.25);
      if (st <= 0) return;
      const y = cy + 158 + i * 30;
      const slide = (1 - ease.outCubic(st)) * 18;
      ctx.globalAlpha = st;
      ctx.font = font(14, 600, UI);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(244,231,211,0.62)';
      ctx.fillText(k, cx + 30 - slide, y);
      ctx.textAlign = 'right';
      ctx.fillStyle = col;
      ctx.font = font(15, 800, DISPLAY);
      ctx.fillText(v, cx + cw - 30 + slide, y);
      ctx.globalAlpha = 1;
    });

    // Primary button — breathes gently so the thumb finds it.
    const btnT = clamp01((t - 1.25) / 0.3);
    if (btnT > 0) {
      const breathe = 1 + Math.sin(this.now * 2.4) * 0.012;
      const bw = 220 * breathe, bh = 54 * breathe;
      const bx = W / 2 - bw / 2, byy = cy + ch + 26;
      ctx.save();
      ctx.globalAlpha = btnT;
      ctx.shadowColor = 'rgba(224,86,31,0.45)';
      ctx.shadowBlur = 20;
      ctx.shadowOffsetY = 5;
      const bg = ctx.createLinearGradient(0, byy, 0, byy + bh);
      bg.addColorStop(0, '#F0712F');
      bg.addColorStop(1, C.vermelho);
      roundRectPath(ctx, bx, byy, bw, bh, bh / 2);
      ctx.fillStyle = bg;
      ctx.fill();
      ctx.restore();
      roundRectPath(ctx, bx + 1, byy + 1, bw - 2, bh * 0.5, bh * 0.25);
      ctx.fillStyle = 'rgba(255,236,206,0.18)';
      ctx.fill();
      outlinedText(
        ctx, this.l10n.t('ui.action.next'),
        W / 2, byy + bh / 2 + 1, C.offwhite, 18, { outline: 2 }
      );
    }

    // Lifetime footer.
    if (t > 1.4) {
      ctx.globalAlpha = clamp01((t - 1.4) / 0.4);
      ctx.font = font(12, 600, UI);
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(244,231,211,0.48)';
      ctx.fillText(
        `${this.l10n.t('ui.result.bestCombo')}: ×${this.bestComboEver}  ·  ` +
        `${this.totalCoins.toLocaleString(this.l10n.locale)} ${this.l10n.t('currency.coins').toLowerCase()}`,
        W / 2, cy + ch + 108
      );
      ctx.globalAlpha = 1;
    }
  }

}

// ── Bootstrap ───────────────────────────────────────────────────────────────
// Without this the `Game` class is never instantiated and the bundler tree-shakes
// the whole module away. If startup fails we draw the reason on the canvas rather
// than leaving a blank screen with the error only in the console.
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
