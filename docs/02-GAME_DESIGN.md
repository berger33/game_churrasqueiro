# 02 — Game Design Document

## 1. High concept

> **Comece fazendo churrasco no quintal e torne-se o maior Mestre da Brasa do Brasil.**

A one-handed portrait mobile game that starts as a pure timing/skill game at a backyard grill
and gradually becomes a management and idle game as the player builds an empire — wrapped in
Brazilian churrasco culture and operated as a live service.

**Differentiator (not "a Brazilian cooking game"):** the grill itself. Heat zones, side-by-side
doneness, flipping timing and the perfect-point window form a *physics-and-timing* skill core
that no competitor in the genre has. Everything else (empire, collection, LiveOps) hangs off
that core.

## 2. Design pillars

| # | Pillar | Consequence in design |
|---|---|---|
| P1 | **The grill is the product** | Every system must make grilling better, never replace it |
| P2 | **Readable at a glance** | Doneness is communicated by colour, grill marks, smoke and sound — never by a number |
| P3 | **Skill pays, money accelerates** | A great player always outperforms a paying player at the same progress |
| P4 | **Visible investment** | Every upgrade changes the scene physically |
| P5 | **Respectful Brazil** | Regional content is researched, specific and equal-depth |

## 3. Core loop

```
        ┌────────────────────────────────────────────────┐
        │                                                │
   PUT ON GRILL ──► WATCH HEAT ──► FLIP ──► SERVE ──► COINS + XP
        ▲                                       │
        │                                       ▼
     NEW CUT  ◄── UPGRADE ◄── RESTAURANT ◄── COMBO
```

**Micro loop (seconds):** place → watch → flip → serve.
**Turn loop (minutes):** a shift at the establishment; customers arrive, orders stack, the
charcoal burns down; the turn ends with a score, stars and coins.
**Session loop (hours):** upgrades, missions, collection, route.
**Meta loop (days–weeks):** new establishment, new cut, new customer, new employee.
**Live loop (weeks–months):** events, season pass, Rota da Brasa, regional content.

## 4. The cooking model (the heart of the product)

### 4.1 Doneness

Each food has **N sides** (2 for a steak, 4 for a skewer). Each side carries a scalar
`doneness` in `[0, ~2]`.

```
side doneness rate = zoneHeat × charcoalEfficiency × ingredient.heatRate × heatRampRate
                     ─────────────────────────────────────────────────────────────────
                                     ingredient.sideCookSec
```

- The **down side** cooks at the full rate.
- Every **other side** cooks at `carryoverRate` (0.12) — realistic carry-over heat, and the
  reason a steak left unflipped ends up charred on one face and raw on the other.
- Overall doneness = **mean of all sides**.
- A side at or above `burnedThreshold` (1.20) marks the whole item **QUEIMADO** — value 0,
  combo broken.

### 4.2 Stages

Default ladder:

| Stage | Overall doneness | Visual |
|---|---|---|
| CRU | < 0.35 | raw colour, no marks |
| MAL PASSADO | 0.35 – 0.60 | browning starts, light marks |
| **AO PONTO** | 0.60 – 0.95 | deep marks, fat rendering, smoke |
| BEM PASSADO | 0.95 – 1.20 | dark, dry, heavy smoke |
| QUEIMADO | ≥ 1.20 | black, ember particles, acrid smoke |

Some foods have their **own ladder** (§6 of the brief), declared in data:

- **Pão de alho:** FRIO → AQUECIDO → CROCANTE → QUEIMADO
- **Queijo coalho:** FRIO → MACIO → DOURADO → DERRETENDO → QUEIMADO

Implemented as `stageOverrides` on the ingredient — the renderer reads the same list, so the
label, the colour ramp and the sound cue can never disagree.

### 4.3 Flipping is mandatory, and the maths says when

For `n` sides and carryover `c`, flipping at the right moment makes all sides finish together:

```
flipAt = T / (1 + (n − 1) · c)          total time D = T · n / (1 + (n − 1) · c) / rate
```

For a 2-sided cut with `c = 0.12` that is `flipAt ≈ 0.73 · T`. Verified by
`cooking.test.ts > optimalFlipPoint equalises both sides`.

### 4.4 Evenness gate

```
evenness = min(sides) / max(sides)
```

A serve is only **PERFEITO** if the overall doneness is inside the window **and**
`evenness ≥ 0.60`. This is what makes flipping *necessary* rather than decorative: a player
who never flips can hit the right average doneness and still fail.

### 4.5 Perfect windows are tiered on purpose

| Tier | Example | Window width |
|---|---|---|
| Common / FTUE | linguiça, pão de alho, espetinho | 0.16 – 0.18 |
| Uncommon | frango, fraldinha, contra-filé | 0.14 |
| Rare / epic | picanha, maminha, costela, cupim | 0.10 – 0.12 |

A first-time player **must** be able to land a PERFEITO inside 60 seconds (§40), so the first
food they ever cook is a linguiça with the widest window. Premium cuts are the mastery
content. Note the emergent result: costela cooks at ~0.028 doneness/s on low heat, so its
0.12 window is **~4.3 seconds wide** — slow low-heat cooking is naturally forgiving, exactly
as it is in real life.

### 4.6 Charcoal

Efficiency follows a curve: 0.75 at ignition → 1.0 at 12 % of the load → plateau → 0.62 at
the end. Duration is upgradeable. Running low raises a warning (VFX + audio), and refilling
costs 2.2 s of attention — the source of the emergent "o carvão está acabando!" moment (§101).

### 4.7 Zones

Three bands across the grill bed, top → bottom = low → high (0.55 / 1.00 / 1.55). Portrait
layout means dragging a steak **down** the screen raises the heat — a single-finger,
one-handed gesture with no menus. A fourth zone unlocks at restaurant 5.

## 5. Scoring

```
quality ∈ {perfect, good, overcooked, raw, burned}

coins = value · satisfaction
      · (1 + perfectTipBonus·[perfect] + speedBonus)
      · comboMult
      · tipMult (upgrades)
      · eventMult (LiveOps)
      · (1 + (customerTipMultiplier − 1) · customerTipWeight)
```

- `speedBonus` scales with patience remaining (fast service tips better).
- `comboMult = 1 + combo · 0.06`, capped at **1.60**.
- `customerTipWeight = 0.35` damps generosity: a VIP pays **+70 %**, not ×3. Without this
  damping a single VIP swung a turn by 6× — measured, then fixed. See
  [06-ECONOMY.md](06-ECONOMY.md#measured-failures-and-fixes).
- `overcooked`/`raw` pay 35 % and 40 % of XP; `burned` pays nothing.

## 6. Combo

Perfect and good serves increment the combo; burned food, a wrong order or a lost customer
resets it. Milestones at **3 / 5 / 10 / 15 / 20** trigger a distinct visual + haptic + audio
sting and grant Pontos da Brasa. Displayed as `PERFEITO ×2 … ×4`, then `🔥 BRASA QUENTE ×5+`.

## 7. Customers

Eleven archetypes, all original characters (§12). Weights, patience, generosity and
tolerance are data.

| id | Persona | Patience | Tip | Tolerance | Notes |
|---|---|---|---|---|---|
| `comum` | Zé do Bairro | 1.00 | 1.00 | 1.00 | the baseline |
| `apressado` | Corre-Corre | 0.62 | 0.85 | 1.05 | 1 item, always in a hurry |
| `economico` | Dona Marlene | 1.10 | 0.50 | 1.10 | cheap but patient |
| `vizinho` | Vizinho Fofoqueiro | 0.95 | 0.90 | 1.00 | small orders |
| `generoso` | Seu Batista | 1.00 | 2.00 | 1.00 | tips well |
| `familia` | Família Souza | 1.25 | 1.10 | 1.00 | 3–5 items at once |
| `tio_do_churrasco` | Tio Cláudio | 0.90 | 1.30 | **0.68** | demands a specific point |
| `influencer` | Keka Live | 0.80 | 2.20 | 0.85 | films everything |
| `turista` | Gringo Curioso | 1.00 | 1.45 | 1.10 | orders unusual items |
| `rival` | Churrasqueiro Rival | 0.72 | 1.50 | **0.60** | hardest tolerance |
| `vip` | Convidado VIP | 1.35 | 3.00 | 0.80 | `weight: 0` — never in the normal rotation |

Patience budget: `(26 + 12 · items) · patienceMultiplier · upgradeMult · levelPatienceScalar`.
Below 35 % the character turns impatient; below 15 %, angry. They leave when it hits zero.

**VIP arrival** is an event, not a spawn: banner, sting, and an *optional* rewarded ad to
"call a VIP now" (§13). Never mandatory.

## 8. Progression

### Establishments (§15)

| # | Establishment | Unlock cost | Level | Introduces |
|---|---|---|---|---|
| 0 | Quintal | free | 1 | core grilling, flip, orders, patience |
| 1 | Espetinho de Rua | 3 500 | 8 | skewers, combo, garçom, VIP |
| 2 | Trailer | 12 000 | 16 | auxiliar, multi-order rush, influencer |
| 3 | Churrascaria de Bairro | 70 000 | 24 | **idle**, churrasqueiro, costela, caixa |
| 4 | Churrascaria Premium | 150 000 | 34 | gerente, cupim, 4th zone, personalização |
| 5 | Festival | 500 000 | 46 | multi-turn events, rush waves, regional cuts |
| 6 | Rede Nacional | 2 800 000 | 60 | empire management, async leaderboards |

Every tier introduces **mechanics**, not just bigger numbers.

### Upgrades

27 tracks in 6 categories: Churrasqueira, Carvão, Preparação, Serviço, Restaurante,
Funcionários — plus 3 prestige tracks that act as the long-tail coin sink. Cost curve:
`cost(level) = round(base · growth^(level−1) / 10) · 10`.

### Employees (§17)

Garçom → Auxiliar → Churrasqueiro → Caixa → Gerente. Automation is **capped**
(see [00-SPEC_AUDIT.md](00-SPEC_AUDIT.md#32-17-automation-vs-1-hard-to-master)):
auto-flip covers at most 60 % of items, auto-serve at most 50 %, and zone choice and
perfect-timing calls are **never** automated.

### Idle (§18)

From restaurant 4. Offline production ramps over 20 minutes (never below 50 % of nominal),
caps at 8 hours, and offers an optional rewarded 2×. Collect screen shows elapsed time,
coins, XP and anything that happened while away.

## 9. Retention horizons (§74 — mandatory)

| Horizon | System |
|---|---|
| Seconds | the grill |
| Minutes | the turn (shift) |
| Hours | upgrades, route stops |
| Days | daily missions, daily reward, streak |
| Weeks | weekly missions, weekly events, season pass |
| Months | Rota da Brasa, collection, regional unlocks |

## 10. Difficulty (§77)

Difficulty has exactly three knobs, all data-driven and all Remote-Config overridable:

```
spawnIntervalSec   (9.0 → 4.8)     how often customers arrive
patienceScalar     (1.28 → 0.76)   how long they wait
maxOrdersOnScreen  (2 → 4)         how much is in flight at once
```

Levels follow a **sawtooth**: three rising steps then a breather (`difficulty: reward`), so a
frustration streak can never form. Verified in the generator output:
`{easy: 17, reward: 15, medium: 18, hard: 10}`.

### Measured skill curve

The balance harness models human reaction latency and coarse visual perception, then plays the
authored content at fixed skill:

| skill | perfect | good | burned | lost | coins/turn |
|---|---|---|---|---|---|
| 0.30 (new player) | 26.1 % | 73.5 % | 0.4 % | 10.5 % | 465 |
| 0.45 | 35.3 % | 64.3 % | 0.4 % | 10.1 % | 480 |
| 0.55 (competent casual) | 47.5 % | 52.5 % | 0.0 % | 11.1 % | 530 |
| 0.70 | 68.2 % | 31.8 % | 0.0 % | 10.4 % | 634 |
| 0.85 (experienced) | 87.7 % | 12.3 % | 0.0 % | 10.7 % | 674 |
| 1.00 (expert) | 98.4 % | 1.6 % | 0.2 % | 10.3 % | 701 |

A new player lands a PERFEITO roughly one time in four — enough to feel it, rare enough to
chase. Expert play pays **1.51×** a beginner at the same content. Reproduce with
`npm run sim`.

## 11. FTUE (§40, §41, §76)

First 60 seconds — no store, no ads, no pass, no menus:

```
open → grill on screen → finger drags linguiça onto the coals
     → "TOQUE PARA VIRAR" → flip → PERFEITO! → coins fly to the counter
     → one customer, one order → serve → first upgrade offered
```

- Session 1: learn, succeed, upgrade.
- Session 2: a new cut (pão de alho — teaches that things burn fast).
- Session 3: a new customer (apressado — teaches patience management).
- Session 4: a new system (missions).

Nothing else is unlocked in session 1.

## 12. Emergent moments (§101)

The model produces these without scripting:

- five orders in flight, two of them picanha;
- pão de alho 0.2 s from burning while a steak needs flipping;
- the charcoal dropping below 22 % mid-rush;
- a VIP arriving during a rush;
- saving everything and hitting `🔥 COMBO ×10`.

They emerge because heat, patience, spawn rate and charcoal decay are **independent clocks**.
