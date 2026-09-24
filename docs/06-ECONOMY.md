# 06 — Economy Design

Everything here is **measured**, not asserted. The numbers come from
`tools/studio/run-sim.ts`, which plays the generated level list end to end with a learning
player, spends the coins on the same sinks a real player would buy, and reports the result.

```bash
npm run sim            # 60 authored turns + skill curve + FTUE/spike guardrails  (~20 s)
npm run sim:long       # 1 500-turn multi-month pacing projection                   (~7 min)
```

Both exit non-zero when a guardrail in `shared/data/economy.json → targets` is breached.

---

## 1. Currencies (§19)

Exactly two, as mandated.

| | Moedas | Brasas |
|---|---|---|
| Icon | coin | glowing coal |
| Premium | no | yes |
| Faucets | turns, levels, missions, events, idle | achievements, level-up every 5, events, VIP, IAP |
| Sinks | upgrades, establishments, prestige tracks | cosmetics, acceleration, pass, convenience |
| Cap | 999 999 999 | 999 999 |

Rule: **Brasas never buy raw power.** They buy time, appearance and convenience.

## 2. Payout identity

```
coins = value · satisfaction
      · (1 + perfectTipBonus·[perfect] + speedBonus)
      · comboMult
      · tipMult(upgrades) · eventMult(LiveOps)
      · (1 + (customerTipMultiplier − 1) · customerTipWeight)
```

| Constant | Value | Lives in |
|---|---|---|
| `orderBaseTip` | 0.10 | `economy.json` |
| `perfectTipBonus` | 0.25 | `economy.json` |
| `speedBonusMax` | 0.25 | `economy.json` |
| `comboStep` / `comboCap` | 0.06 / 1.60 | `economy.json` |
| `customerTipWeight` | 0.35 | `economy.json` |
| `goodWindowPadding` | 0.08 | `grill.json` (gameplay, not economy) |

**These constants exist in exactly one file.** An earlier revision duplicated tip and combo
numbers into `grill.json`; the duplication was removed and `grill.json → scoring` now carries
only labels, combo milestones and the padded-window width.

Maximum theoretical multiplier on a plate:
`1.60 (perfect+speed) × 1.60 (combo cap) × 1.70 (VIP) × tipMult(upgrades) ≈ 4.35 × tipMult`.

## 3. XP and levels

```
xpToNext(level) = max(40, round(55 · level^1.42))
```

Cumulative XP to level 80 exceeds 100 000 (asserted by test), so max level is never trivial.

Level-up reward:

```
coins  = round(100 · level^0.85)
embers = 3, granted only on every 5th level
```

## 4. Sinks

| Sink | Total capacity |
|---|---|
| 24 progression upgrade tracks | 1 084 000 |
| 3 prestige tracks (long-tail) | 5 274 620 |
| 7 establishments | 5 010 500 |
| **Total** | **11 369 120** |

Upgrade cost curve: `cost(l) = round(base · growth^(l−1) / 10) · 10` — always a multiple of 10
and strictly increasing (asserted by test for every track).

Prestige tracks exist for one reason: without them every sink is exhausted around level 40 and
the spend ratio collapses. They are priced last in the buy-priority order so they never crowd
out a meaningful upgrade.

## 5. Idle (§18)

```
coinsPerMinute by restaurant: [—, 6, 16, 42, 96, 210, 430]
xpPerMinute by restaurant:    [—, 0.4, 1.0, 2.4, 5.0, 9.0, 16.0]
ramp: 20 minutes (factor 0.5 → 1.0)   cap: 8 hours   gerente: +18 % per level
```

The ramp matters: without it a player who backgrounds the app for 20 minutes gets the same
rate as one who is away for 8 hours, which makes short absences strictly better than playing.

## 6. Guardrails

`shared/data/economy.json → targets`, checked by the simulator:

| Target | Band | Measured |
|---|---|---|
| `turnsPerSession` | 3–5 | 4 (assumed) |
| `firstUpgradeAffordableAfterTurns` | 1–2 | 1 |
| `unlock:espetinho_rua` | 28–45 | 34 |
| `unlock:trailer` | 72–115 | 90 |
| `unlock:churrascaria_bairro` | 115–185 | 146 |
| `unlock:churrascaria_premium` | 195–315 | 247 |
| `unlock:festival` | 340–550 | 430 |
| `unlock:rede_nacional` | 950–1450 | 1180 |
| `income:level5` | 9 000–14 000 | 11 122 |
| `income:level15` | 36 000–56 000 | 44 669 |
| `income:level30` | 78 000–122 000 | 97 761 |
| `income:level50` | 98 000–152 000 | 123 278 |
| `coinSpendRatio` | 0.70–0.99 | 0.740 |
| `coinSpike` (max ÷ median turn) | ≤ 6 | 1.70 |
| `perfectRateAtSkillMid` | 0.40–0.62 | 0.484 |

**15 of 15 met** on `restaurants` v6 + `economy` v11 (`npm run sim:long`, 1 500 turns, skill 0.55).

Bands are ~±20 % around the measured value: tight enough to catch a regression, wide enough
that legitimate tuning does not trip them.

### 5.1 Tuning lesson: never tune one sink alone

Raising `churrascaria_bairro` from 12 000 to 15 000 coins made it unlock **faster**
(turn 185 → 146). The simulation harness is a greedy spender: the coins it can no longer
sink into a pricier restaurant go into upgrades instead, which raises income and speeds up
everything downstream. This is recorded in `economy.json → targets._bandDerivationNote`.

> Slow pacing by reducing income, or by scaling **all** sinks together — never one sink alone.

### 5.2 Two bug fixes moved the whole curve

`vinagrete` was unservable (a `prep` item that never touches the grill was rejected by
`serve()`), and the skill policy respawned prep items every tick. Together they destroyed
roughly **10 % of all customers**. After the fix, customer loss at skill 0.30 fell from
**10.5 % → 0.4 %** and perfect rate rose **26.1 % → 34.5 %**. Every pacing number measured
before that fix was invalid, and all of it had to be re-derived.

## 7. Measured pacing

1 500 turns at 12 turns/day:

| Establishment | Turn | ≈ Day |
|---|---|---|
| Espetinho de Rua | 34 | 3 |
| Trailer | 90 | 8 |
| Churrascaria de Bairro | 146 | 12 |
| Churrascaria Premium | 247 | 21 |
| Festival | 430 | 36 |
| Rede Nacional | 1180 | 98 |

Coins per turn by tier: **879 → 2 846 → 7 345 → 8 036 → 7 917 → 10 339 → 11 823.**
Income per day by level: **11 k (L5) → 45 k (L15) → 98 k (L30) → 123 k (L50).**
Spend ratio **0.740**; earned 14 619 931 vs spent 10 822 120 over the campaign.

The first three establishments land inside the player's first fortnight — deliberate, since
early retention is priority 2. The **430 → 1180 gap (≈ 62 days)** carries no new restaurant
and is filled by the collection (37), achievements (58), prestige tracks, the region route,
weekly events and the Brasa Pass. Whether that holds a mid-core player is **unvalidated**;
it needs D30/D60 telemetry before V1.0 (see docs/18-STATUS.md §3).

## 8. Measured failures and fixes

This section exists because the simulator earned its keep. Every one of these was found by
running the game, not by reading the numbers.

### 8.1 Perfect rate was 100 % at every skill level

The original perfect windows were ~0.26 doneness units wide — about **1.6 s** of timing
latitude at picanha's cook rate. There was no skill to master.

**Fix:** tiered windows (0.10–0.18 by rarity), `goodWindowPadding` 0.12 → 0.08. Result: the
skill curve in [02-GAME_DESIGN.md](02-GAME_DESIGN.md#measured-skill-curve) now spans
26 % → 98 %.

### 8.2 Level-up rewards grew at 1.28^level — 10.3 M coins at level 47

The single worst bug in the project. `levelUpCoins` used a geometric curve, producing
**46.8 M coins** of level-up income against 2.5 M of turn income over 1 500 turns. This is
exactly the "economia que explode exponencialmente cedo demais" that §20 warns about, and it
was invisible until the ledger was printed.

**Fix:** polynomial curve `100 · level^0.85`; level-up embers reduced to every 5th level.
Post-fix level-up income over the same run: **44 k** (was 46.8 M).

### 8.3 Customer generosity multiplied the whole plate

`tipMultiplier` was applied to the entire coin value, so a VIP (3.0) vs a stingy customer
(0.5) was a **6× swing per plate** and turn income spiked 7.7× the median.

**Fix:** `customerTipWeight = 0.35` damps it into a tip term. VIP now pays **+70 %**.
Max ÷ median turn income fell from 7.74 to 2.02.

### 8.4 Income plateaued at restaurant 3

Throughput was capped by a fixed `maxOrdersOnScreen` in the projection generator, so tiers 3–6
all paid ~3 700–4 500 per turn while sinks grew geometrically — a guaranteed mid-game stall.

**Fix:** endless turns are generated from the *player's current establishment* (its real turn
length and capacity). Income now scales 5 742 → 9 039 across tiers 3–6.

### 8.5 Sinks ran out at level 40

Once all 24 tracks and 7 establishments were bought (~1.08 M + 2.2 M), the spend ratio fell to
**0.036** with 48 M coins banked.

**Fix:** three prestige tracks (5.27 M total capacity). Spend ratio is now **0.921**.
Further long-tail sinks (coin cosmetics, Rota tolls, franchise expansion) are scheduled for
v1.1 — the sizing method is the same: project income at day 180, keep total sink capacity at
~1.2× that.

## 9. How to change balance safely

1. Edit `shared/data/*.json`. Never edit a number in C#.
2. `npm run sim` — checks FTUE affordability, coin spikes and the skill curve.
3. `npm run sim:long` — checks multi-month pacing, income and spend ratio.
4. If a target fails, decide deliberately: change the tuning, or change the target **and write
   down why in this file**. A target that is silently widened is a target that no longer works.
5. `npm run sync-data` before opening Unity, so the client and the simulator read the same file.

## 10. Remote-Config surface

Every constant above is overridable without a build
(`shared/data/remoteconfig_defaults.json`): `economy_tip_base`, `economy_tip_perfect_bonus`,
`economy_combo_step`, `economy_combo_cap`, `economy_xp_a`, `economy_xp_exponent`,
`upgrade_cost_discount`, `difficulty_scalar`, `patience_base_seconds`,
`charcoal_duration_seconds`, `idle_max_offline_hours`, plus kill switches
(`kill_switch_iap`, `kill_switch_ads`, `kill_switch_events`).
