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

// ── Palette (docs/04-ART_STYLE.md) ──────────────────────────────────────────
const C = {
  carvao: '#1C1512', cinza: '#3A2E28', madeira: '#7A4A2A', madeiraClara: '#B98A55',
  creme: '#F4E7D3', offwhite: '#FBF5EC', brasa: '#E0561F', chama: '#F2A63B',
  vermelho: '#A32E1C', verde: '#6FA84A', ambar: '#E8B23C', telha: '#C0442E', ouro: '#E7C24A'
};

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
        this.float(W / 2, 300, `🔥 ${this.l10n.t('ui.feedback.comboMilestone', { n: ev.combo })}`, C.brasa, 34);
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
  private draw(canvas: HTMLCanvasElement): void {
    const ctx = canvas.getContext('2d')!;
    ctx.save();
    ctx.clearRect(0, 0, W, H);

    // Backyard backdrop
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#2A1D16');
    bg.addColorStop(0.55, '#20160F');
    bg.addColorStop(1, '#150E0A');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    if (this.screen === 'result') this.drawResult(ctx);
    else this.drawPlay(ctx);

    ctx.restore();
  }

  private drawPlay(ctx: CanvasRenderingContext2D): void {
    this.drawHud(ctx);
    this.drawOrders(ctx);
    this.drawGrill(ctx);
    this.drawBench(ctx);
    this.drawParticles(ctx);
    this.drawFloats(ctx);
    if (this.drag) this.drawDragged(ctx);
    if (this.bannerLife > 0) this.drawBanner(ctx);
    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255, 200, 120, ${this.flash * 0.18})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  private drawHud(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = 'rgba(0,0,0,.35)';
    this.roundRect(ctx, 8, 8, W - 16, 30, 10);
    ctx.fill();

    ctx.font = '600 15px system-ui';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = C.ouro;
    ctx.textAlign = 'left';
    ctx.fillText(`🪙 ${this.coins.toLocaleString(this.l10n.locale)}`, 18, 23);

    ctx.fillStyle = C.creme;
    ctx.textAlign = 'center';
    const left = Math.max(0, this.sim.timeLeft);
    ctx.fillText(`${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}`, W / 2, 23);

    ctx.textAlign = 'right';
    if (this.sim.combo > 1) {
      const pulse = 1 + this.comboPulse * 0.25;
      ctx.save();
      ctx.translate(W - 20, 23);
      ctx.scale(pulse, pulse);
      ctx.fillStyle = this.sim.combo >= 5 ? C.brasa : C.chama;
      ctx.fillText(`🔥 ×${this.sim.combo}`, 0, 0);
      ctx.restore();
    } else {
      ctx.fillStyle = '#6d5c50';
      ctx.fillText(`${this.l10n.t('ui.result.xp')} ${this.xp}`, W - 20, 23);
    }
  }

  private drawOrders(ctx: CanvasRenderingContext2D): void {
    const waiting = this.sim.customers.filter((c) => c.state === 'waiting');
    waiting.forEach((c, i) => {
      const r = this.orderCardRect(i);
      const pct = c.patienceLeft / c.patienceTotal;
      const barColor = pct > 0.5 ? C.verde : pct > 0.25 ? C.ambar : C.telha;

      ctx.fillStyle = 'rgba(28,21,18,.92)';
      this.roundRect(ctx, r.x, r.y, r.w, r.h, 12);
      ctx.fill();
      ctx.strokeStyle = c.def.isVip ? C.ouro : 'rgba(244,231,211,.16)';
      ctx.lineWidth = c.def.isVip ? 2 : 1;
      this.roundRect(ctx, r.x, r.y, r.w, r.h, 12);
      ctx.stroke();

      // patience ring/bar
      ctx.fillStyle = 'rgba(0,0,0,.45)';
      this.roundRect(ctx, r.x + 8, r.y + r.h - 10, r.w - 16, 5, 2.5);
      ctx.fill();
      ctx.fillStyle = barColor;
      this.roundRect(ctx, r.x + 8, r.y + r.h - 10, (r.w - 16) * Math.max(0, pct), 5, 2.5);
      ctx.fill();

      ctx.textAlign = 'left';
      ctx.font = '600 11px system-ui';
      ctx.fillStyle = c.def.isVip ? C.ouro : C.madeiraClara;
      ctx.fillText(c.def.isVip ? `⭐ ${this.l10n.t(c.def.nameKey)}` : this.l10n.t(c.def.nameKey), r.x + 10, r.y + 13);

      ctx.font = '600 12px system-ui';
      let x = r.x + 10;
      for (const line of c.lines) {
        const done = line.fulfilledBy.length > 0;
        ctx.fillStyle = done ? C.verde : C.creme;
        const label = done ? '✓' : this.emojiFor(line.ingredientId);
        ctx.fillText(label, x, r.y + 32);
        x += 20;
      }
    });
  }

  private drawGrill(ctx: CanvasRenderingContext2D): void {
    const n = this.zoneCount();
    const h = (GRILL_BOTTOM - GRILL_TOP) / n;

    // Body
    ctx.fillStyle = C.cinza;
    this.roundRect(ctx, 20, GRILL_TOP - 18, W - 40, GRILL_BOTTOM - GRILL_TOP + 36, 18);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.5)';
    ctx.lineWidth = 2;
    this.roundRect(ctx, 20, GRILL_TOP - 18, W - 40, GRILL_BOTTOM - GRILL_TOP + 36, 18);
    ctx.stroke();

    const efficiency = this.sim.grill.charcoalEfficiency;
    for (let z = 0; z < n; z++) {
      const y = GRILL_TOP + h * z;
      const zone = this.db.grill.zones[z]!;
      const heat = zone.heatMultiplier * efficiency;

      const g = ctx.createLinearGradient(0, y, 0, y + h);
      const a = Math.min(0.85, 0.22 + heat * 0.4);
      g.addColorStop(0, `rgba(224,86,31,${a * 0.5})`);
      g.addColorStop(0.5, `rgba(224,86,31,${a})`);
      g.addColorStop(1, `rgba(120,40,16,${a * 0.7})`);
      ctx.fillStyle = g;
      ctx.fillRect(34, y + 2, W - 68, h - 4);

      // grate
      ctx.strokeStyle = `rgba(20,14,10,${0.55 + heat * 0.15})`;
      ctx.lineWidth = 3;
      for (let gx = 44; gx < W - 44; gx += 16) {
        ctx.beginPath();
        ctx.moveTo(gx, y + 6);
        ctx.lineTo(gx, y + h - 6);
        ctx.stroke();
      }

      ctx.font = '600 10px system-ui';
      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(244,231,211,.55)';
      ctx.fillText('🔥'.repeat(zone.embers), 40, y + h - 10);
    }

    // charcoal bar
    const fuel = 1 - this.sim.grill.charcoalT;
    ctx.fillStyle = 'rgba(0,0,0,.5)';
    this.roundRect(ctx, 40, GRILL_BOTTOM + 8, W - 80, 8, 4);
    ctx.fill();
    ctx.fillStyle = fuel < this.db.grill.charcoal.lowWarningThreshold ? C.telha : C.brasa;
    this.roundRect(ctx, 40, GRILL_BOTTOM + 8, (W - 80) * fuel, 8, 4);
    ctx.fill();
    ctx.font = '600 10px system-ui';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(244,231,211,.5)';
    ctx.fillText(this.sim.grill.refilling > 0 ? this.l10n.t('ui.hud.charcoal.refilling') : `${this.l10n.t('ui.hud.charcoal')} — ${this.l10n.t('ui.hud.charcoal.refill')}`, W / 2, GRILL_BOTTOM + 28);

    // food
    for (const f of this.sim.foods) {
      if (!f.onGrill || f.served) continue;
      if (this.drag?.food === f) continue;
      const p = this.foodScreenPos(f);
      this.drawFood(ctx, f, p.x, p.y, 1);
    }
  }

  private drawFood(ctx: CanvasRenderingContext2D, f: FoodRuntime, x: number, y: number, scale: number): void {
    const d = overallDoneness(f);
    const art = f.ingredient.art;
    const raw = this.hex(art.rawColor);
    const cooked = this.hex(art.cookedColor);
    const burn = this.hex(art.burnColor);

    let col: string;
    if (d < 0.75) col = this.mix(raw, cooked, Math.min(1, d / 0.75));
    else col = this.mix(cooked, burn, Math.min(1, (d - 0.75) / 0.5));

    const w = f.ingredient.sides >= 4 ? 46 : 54;
    const hh = f.ingredient.sides >= 4 ? 16 : 24;

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    // heat glow underneath
    const glow = ctx.createRadialGradient(0, hh * 0.6, 2, 0, hh * 0.6, w * 0.8);
    glow.addColorStop(0, 'rgba(224,86,31,.45)');
    glow.addColorStop(1, 'rgba(224,86,31,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(-w, -hh, w * 2, hh * 2.4);

    // body
    ctx.fillStyle = col;
    this.roundRect(ctx, -w / 2, -hh / 2, w, hh, hh / 2);
    ctx.fill();

    // fat cap
    if (art.fatCap) {
      ctx.fillStyle = this.mix(this.hex('#F0E2C8'), col, Math.min(1, d * 0.8));
      this.roundRect(ctx, -w / 2, -hh / 2, w, hh * 0.3, hh * 0.15);
      ctx.fill();
    }

    // grill marks — alpha tracks browning
    const marks = Math.max(0, Math.min(1, (d - 0.25) / 0.5));
    if (marks > 0) {
      ctx.strokeStyle = `rgba(30,16,10,${0.25 + marks * 0.55})`;
      ctx.lineWidth = 3;
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(i * 13 - 4, -hh / 2 + 2);
        ctx.lineTo(i * 13 + 4, hh / 2 - 2);
        ctx.stroke();
      }
    }

    // sheen
    if (art.fatSheen && d > 0.3) {
      const sh = ctx.createLinearGradient(-w / 2, -hh / 2, w / 2, hh / 2);
      sh.addColorStop(0, `rgba(255,255,255,${0.05 + d * 0.16})`);
      sh.addColorStop(0.5, 'rgba(255,255,255,0)');
      ctx.fillStyle = sh;
      this.roundRect(ctx, -w / 2, -hh / 2, w, hh, hh / 2);
      ctx.fill();
    }

    // smoke while cooking hot
    if (d > 0.35 && Math.random() < 0.06) {
      this.particles.push({
        x: x + (Math.random() - 0.5) * w * 0.6, y: y - hh,
        vx: (Math.random() - 0.5) * 6, vy: -22 - Math.random() * 14,
        life: 0, max: 0.9 + Math.random() * 0.5, size: 4 + Math.random() * 4,
        color: d > 1 ? 'rgba(60,60,60,.5)' : 'rgba(220,210,200,.28)', kind: 'smoke'
      });
    }

    ctx.restore();

    // stage label
    const stage = String(stageOf(this.db, f));
    const even = evenness(f);
    ctx.font = '700 9px system-ui';
    ctx.textAlign = 'center';
    ctx.fillStyle = f.burned ? C.telha : even < 0.6 ? C.ambar : 'rgba(244,231,211,.75)';
    ctx.fillText(this.stageLabel(f, stage).toUpperCase(), x, y + hh / 2 + 12);
    if (even < 0.6 && !f.burned) {
      ctx.fillStyle = C.ambar;
      ctx.fillText(this.l10n.t('ui.feedback.flipHint'), x, y + hh / 2 + 22);
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
    ctx.fillStyle = 'rgba(58,46,40,.55)';
    this.roundRect(ctx, 8, BENCH_TOP - 16, W - 16, H - BENCH_TOP + 8, 14);
    ctx.fill();
    ctx.font = '600 10px system-ui';
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(244,231,211,.45)';
    ctx.fillText(this.l10n.t('ui.hud.bench'), 18, BENCH_TOP - 5);

    this.unlocked.forEach((ing, i) => {
      const r = this.benchItemRect(i);
      if (r.y + r.h > H) return;
      ctx.fillStyle = 'rgba(28,21,18,.8)';
      this.roundRect(ctx, r.x, r.y, r.w, r.h, 10);
      ctx.fill();
      ctx.strokeStyle = 'rgba(244,231,211,.12)';
      ctx.lineWidth = 1;
      this.roundRect(ctx, r.x, r.y, r.w, r.h, 10);
      ctx.stroke();

      ctx.font = '22px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(this.emojiFor(ing.id), r.x + r.w / 2, r.y + 26);
      ctx.font = '600 9px system-ui';
      ctx.fillStyle = C.creme;
      ctx.fillText(this.l10n.t(ing.nameKey).slice(0, 14), r.x + r.w / 2, r.y + 46);
      ctx.fillStyle = C.ouro;
      ctx.fillText(`🪙 ${ing.value}`, r.x + r.w / 2, r.y + 58);
    });
  }

  private drawDragged(ctx: CanvasRenderingContext2D): void {
    const d = this.drag!;
    ctx.save();
    ctx.globalAlpha = 0.92;
    this.drawFood(ctx, d.food, d.x, d.y, 1.15);
    ctx.restore();

    if (d.y > GRILL_TOP && d.y < GRILL_BOTTOM) {
      const z = this.zoneAt(d.y);
      if (z >= 0) {
        const h = (GRILL_BOTTOM - GRILL_TOP) / this.zoneCount();
        ctx.strokeStyle = C.chama;
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 5]);
        ctx.strokeRect(34, GRILL_TOP + h * z + 2, W - 68, h - 4);
        ctx.setLineDash([]);
      }
    }
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
      ctx.globalAlpha = Math.max(0, 1 - t * t);
      ctx.font = `800 ${f.size}px system-ui`;
      ctx.textAlign = 'center';
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(0,0,0,.6)';
      ctx.strokeText(f.text, f.x, f.y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
  }

  private drawBanner(ctx: CanvasRenderingContext2D): void {
    const a = Math.min(1, this.bannerLife);
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(0,0,0,.7)';
    this.roundRect(ctx, W / 2 - 130, 96, 260, 32, 16);
    ctx.fill();
    ctx.font = '700 14px system-ui';
    ctx.textAlign = 'center';
    ctx.fillStyle = C.creme;
    ctx.fillText(this.bannerText, W / 2, 113);
    ctx.globalAlpha = 1;
  }

  private drawResult(ctx: CanvasRenderingContext2D): void {
    const r = this.lastResult!;
    ctx.fillStyle = 'rgba(0,0,0,.72)';
    ctx.fillRect(0, 0, W, H);

    ctx.textAlign = 'center';
    ctx.font = '800 34px system-ui';
    ctx.fillStyle = C.creme;
    ctx.fillText(this.l10n.t('ui.result.title'), W / 2, 190);

    ctx.font = '40px system-ui';
    ctx.fillText('★'.repeat(r.stars) + '☆'.repeat(3 - r.stars), W / 2, 250);

    const rows: [string, string][] = [
      [this.l10n.t('ui.result.coins'), `+${r.coins.toLocaleString(this.l10n.locale)}`],
      [this.l10n.t('ui.result.perfect'), String(r.perfect)],
      [this.l10n.t('ui.result.burned'), String(r.burned)],
      [this.l10n.t('ui.result.bestCombo'), `×${r.combo}`],
      [this.l10n.t('ui.result.xp'), `+${r.xp}`]
    ];
    ctx.font = '600 17px system-ui';
    rows.forEach(([k, v], i) => {
      const y = 310 + i * 34;
      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(244,231,211,.65)';
      ctx.fillText(k, 90, y);
      ctx.textAlign = 'right';
      ctx.fillStyle = k === this.l10n.t('ui.result.burned') && r.burned > 0 ? C.telha : C.ouro;
      ctx.fillText(v, W - 90, y);
    });

    ctx.textAlign = 'center';
    ctx.fillStyle = C.brasa;
    this.roundRect(ctx, W / 2 - 110, 520, 220, 54, 27);
    ctx.fill();
    ctx.font = '800 18px system-ui';
    ctx.fillStyle = C.creme;
    ctx.fillText(this.l10n.t('ui.action.next'), W / 2, 549);

    ctx.font = '500 12px system-ui';
    ctx.fillStyle = 'rgba(244,231,211,.5)';
    ctx.fillText(`${this.l10n.t('ui.result.bestCombo')}: ×${this.bestComboEver} · ${this.totalCoins.toLocaleString(this.l10n.locale)} ${this.l10n.t('currency.coins').toLowerCase()}`, W / 2, 610);
  }

  // ── Utils ─────────────────────────────────────────────────────────────────
  private roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  private hex(h: string): [number, number, number] {
    const s = h.replace('#', '');
    return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
  }
  private mix(a: [number, number, number], b: [number, number, number], t: number): string {
    const k = Math.max(0, Math.min(1, t));
    const r = Math.round(a[0] + (b[0] - a[0]) * k);
    const g = Math.round(a[1] + (b[1] - a[1]) * k);
    const bl = Math.round(a[2] + (b[2] - a[2]) * k);
    return `rgb(${r},${g},${bl})`;
  }
  private emojiFor(id: string): string {
    const map: Record<string, string> = {
      linguica_toscana: '🌭', pao_de_alho: '🥖', queijo_coalho: '🧀', coracao_frango: '🍢',
      frango_coxa: '🍗', asinha_frango: '🍗', espetinho_frango: '🍢', espetinho_misto: '🍡',
      legumes_grelhados: '🥗', fraldinha: '🥩', contra_file: '🥩', maminha: '🥩',
      picanha: '🥩', costela: '🍖', cupim: '🍖', vinagrete: '🥣'
    };
    return map[id] ?? '🍽️';
  }
}

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
