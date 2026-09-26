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
| 4 churrasqueiras (unlock + 3 evolutions each) | 51 100 |
| **Total** | **11 420 220** |

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
| `unlock:espetinho_rua` | 28–45 | 32 |
| `unlock:trailer` | 72–115 | 89 |
| `unlock:churrascaria_bairro` | 115–185 | 147 |
| `unlock:churrascaria_premium` | 195–315 | 243 |
| `unlock:festival` | 340–550 | 418 |
| `unlock:rede_nacional` | 950–1450 | 1185 |
| `grill:ze_da_esquina` | 4–12 | 7 |
| `grill:parrilla_chef_cisma` | 32–60 | 45 |
| `grill:fornalha_dragao_manso` | 70–115 | 90 |
| `income:level5` | 9 000–14 000 | 10 793 |
| `income:level15` | 36 000–56 000 | 41 115 |
| `income:level30` | 78 000–122 000 | 98 262 |
| `income:level50` | 98 000–152 000 | 115 926 |
| `coinSpendRatio` | 0.70–0.99 | 0.741 |
| `coinSpike` (max ÷ median turn) | ≤ 6 | 1.70 |
| `perfectRateAtSkillMid` | 0.40–0.62 | 0.557 |

**18 of 18 met** on `restaurants` v6 + `economy` v12 (`npm run sim:long`, 1 500 turns). The skill-curve contract is still measured on the default 3-zone grill; campaign pacing now plays the grill the player actually owns.

Bands are ~±20 % around the measured value: tight enough to catch a regression, wide enough
that legitimate tuning does not trip them.

### 5.1 Tuning lesson: never tune one sink alone

Raising `churrascaria_bairro` from 12 000 to 15 000 coins made it unlock **faster**
(turn 185 → 146 at the time). The simulation harness is a greedy spender: the coins it can no
longer sink into a pricier restaurant go into upgrades instead, which raises income and speeds
up everything downstream. This is recorded in `economy.json → targets._bandDerivationNote`.

Re-measured after the policy fix in §5.3, the same establishment now lands at **turn 151** in
the greedy report (143 in `sim:long`). The lesson is unchanged — it is the *reason* the band
rule exists.

> Slow pacing by reducing income, or by scaling **all** sinks together — never one sink alone.

### 5.2 Two bug fixes moved the whole curve

`vinagrete` was unservable (a `prep` item that never touches the grill was rejected by
`serve()`), and the skill policy respawned prep items every tick. Together they destroyed
roughly **10 % of all customers**. After the fix, customer loss at skill 0.30 fell from
**10.5 % → 0.4 %** and perfect rate rose **26.1 % → 34.5 %**. Every pacing number measured
before that fix was invalid, and all of it had to be re-derived.

Re-measured on the current rules (after §5.3): loss **0.7 %**, perfect rate **35.4 %**.

### 5.3 Third bug: the ideal-zone mechanic never ran

The skill policy chose zones with `zones[i].id === ideal`. Runtime zones are
`{ index, heat, items }` — there is **no `id`** — so the comparison was always false and the
branch was dead code. At skill ≤ 0.55 nothing else corrected the choice either, so items were
placed at random: measured **31.9 %** ideal-zone hits against a **33.3 %** chance baseline for
three zones.

The project's own type-check would have caught it (`npm run typecheck`, added in the same
change) — it had never been wired up, which is also why the two defects below survived.

**Fix and effect:** resolve the zone id through `db.grill.zones` (the mapping `zoneIndex()`
already implemented, used two lines further down). Ideal-zone hits at skill 0.55 rose
**31.9 % → 68.2 %**, and the reference measurement moved:

| | before | after |
|---|---|---|
| perfect rate @ skill 0.55 | 48.4 % | **55.7 %** |
| coins/turn @ skill 0.55 | 712 | **793** |

All 15 restaurant/income targets still pass on both horizons, so this was a *fidelity* correction rather than a
rescue: the published numbers now describe the game as designed. Every figure in §5 and §7 was
re-derived, the 98 golden vectors were regenerated, and `tools/studio/test/policy.test.ts` now
asserts ideal-zone behaviour directly so the mechanic cannot silently stop running again.

### 5.4 Fourth fidelity gap: the sim never played the player's grill

`run-sim.ts` spent coins on restaurants and upgrades, then played every turn on the
restaurant's default 3-zone grill. Players start on 1-zone `lata_valente` and buy along
1F → 2F → 3F → Fornalha (51 100 coins, must max the current evolution before the next
unlock — same rule as the prototype Home CTA).

Wiring that path in (`economy` v12) surfaced a second defect: zone heat was
`heatBase + 0.85 · t`, so `fornalha_dragao_manso` evo 3 peaked at **2.47** against a
default `high` of 1.55. Campaign burn **20.3 %**, lost customers **11.4 %**, L15/L30
income **20 %** below band. The premium grill was an incinerator.

**Fix:** `churrasqueiraZoneHeat()` uses the default zone profile scaled by `heatBase`,
capped at 1.70. Additive upgrades (`grill_size`, `charcoal_duration`) still stack on
the equipped evolution — otherwise those tracks were a dead sink the moment a
churrasqueira was equipped.

Re-measured (1 500 turns): restaurant pacing stayed inside the existing bands, spend
ratio stayed **0.741**, campaign burn **5.7 %**. Three grill-unlock targets were added
around the measured 7 / 45 / 90.

## 7. Measured pacing

1 500 turns at 12 turns/day, playing the owned grill:

| Establishment | Turn | ≈ Day |
|---|---|---|
| Espetinho de Rua | 32 | 3 |
| Trailer | 89 | 7 |
| Churrascaria de Bairro | 147 | 12 |
| Churrascaria Premium | 243 | 20 |
| Festival | 418 | 35 |
| Rede Nacional | 1185 | 99 |

| Churrasqueira | Turn | ≈ Day |
|---|---|---|
| Zé da Esquina (2F) | 7 | 1 |
| Parrilla Chef Cisma (3F) | 45 | 4 |
| Fornalha Dragão Manso | 90 | 8 |

Coins per turn by tier: **913 → 2 712 → 6 631 → 8 019 → 8 014 → 10 329 → 12 021.**
Income per day by level: **10.8 k (L5) → 41.1 k (L15) → 98.3 k (L30) → 115.9 k (L50).**
Spend ratio **0.741**; earned 14 665 839 vs spent 10 873 220 over the campaign.

The first three establishments land inside the player's first fortnight — deliberate, since
early retention is priority 2. The **418 → 1185 gap (≈ 64 days)** carries no new restaurant
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
