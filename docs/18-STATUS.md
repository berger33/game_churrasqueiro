# 18 — Status Report

**Snapshot:** 2026-09-17 · branch `arena/01a0af75-game-churrasqueiro`

This report states plainly what is **done and verified**, what is **built but
unverified here**, and what is **not built**. Anything marked ⚠ was not executed
in this environment and must be re-run before it is trusted.

---

## 1. Verified in this environment

Every claim below was produced by a command run in this checkout.

| Area | Check | Result |
|---|---|---|
| Unit tests | `npx vitest run` | **135 passed / 0 failed** (8 files) |
| Localisation | `npm run check-l10n` | **OK** — 340 keys referenced by data, all translated in pt-BR (469 keys total); en-US / es-419 are declared 10.7 % stubs that fall back to pt-BR |
| Data integrity | `npm run validate` | **OK** — 20 tables, 16 ingredients, 11 customers, 7 restaurants, 27 upgrade tracks, 58 achievements, 37 collection entries, 47 analytics events, 60 authored levels |
| Short-horizon economy | `npm run sim` | **all 15 balance targets met** |
| Long-horizon economy | `npm run sim:long` (1500 turns) | **all 15 balance targets met** — see §3 |
| Economy report | `HORIZON=1500 npm run balance-report` | reaches **level 80**; income growth L5→L70 **×13.10** vs cost growth **×29.28** → costs outpace income, so purchases stay meaningful |
| Unity data copy | `npm run verify-data-sync` | **OK — Assets/Data matches shared/data (20 tables)** |
| Prototype bundle | `npx esbuild --bundle prototype/src/main.ts` | **342 kB, 0 errors** |
| Art coverage | `npm run check-art` | **OK** — 16 ingredients × 8 doneness levels + icons = **144 draws**, all painted |
| Render smoke | `npm run check-render` | **OK** — real bundle driven through init, a drag, a flip and a full turn; **12.3 M canvas ops, no exceptions** |
| Prototype server | `node prototype/dev-server.mjs` | listening on `0.0.0.0:5173`; `/`, `/bundle.js`, `/healthz`, `/data/*.json` all return **200** |

### The localisation gate caught a §56 violation

`check-l10n` failed on first run with 6 real problems:

1. `upgrade.board.name` / `.desc` were referenced by `upgrades.json` but never
   translated.
2. `regions.json` carried **literal Portuguese prose** in a `tradition` field for
   all five regions — exactly what §56 forbids. Converted to `traditionKey` and
   moved into `shared/l10n/pt-BR.json`.

It also proved the prototype was non-compliant: it derived display text by
string-munging keys (`nameKey.replace('food.','')`) and hardcoded ~26 Portuguese
literals. All of it now goes through `tools/sim-core/src/l10n.ts`, and
`?lang=en-US` switches the prototype's UI language.

### What the tests actually caught

These were real defects, not test-formality failures:

1. **Prep-only ingredients were unservable.** `TurnSimulation.serve()` required
   `food.onGrill`, so `vinagrete` (a `prep` item that never touches the grill)
   could never be handed to a customer. Customers who ordered it always left.
   Fixed in `turn.ts`.
2. **The skill policy respawned prep items every tick.** Its `alreadyCooking`
   scan only counted `onGrill` food, so it queued a fresh `vinagrete` 30 times a
   second — 865 live items in a 30-second turn. Fixed in `policy.ts`.
3. **Customer tips swung payouts 6×.** `customerTipMultiplier` was multiplying the
   whole plate. Now it scales only a damped tip term (`customerTipWeight` 0.35).
4. **Level-up rewards compounded into runaway inflation.** A geometric per-level
   reward grew without bound; replaced with polynomial `100 · level^0.85`.
5. **Endless levels were pre-generated at tier 0.** They are now generated lazily
   at the player's current tier.

### What bug #1 and #2 did to the economy

Both bugs destroyed roughly **10% of all customers** in simulation. After the
fix, customer loss at skill 0.30 fell from **10.5% → 0.4%** and perfect rate rose
**26.1% → 34.5%**. All earlier pacing measurements were therefore taken with a
leak in place and had to be re-derived — see §3.

---

## 2. Built but not verified here ⚠

| Deliverable | State | Why it is unverified |
|---|---|---|
| Unity C# client (`Assets/Scripts/Core/Types.cs`, `CookingRules.cs`) | Hand-written port of the tested TypeScript rules | **No C# toolchain in this sandbox.** `dotnet`, `mono`, `mcs`, `csc`, `java` and `unity` are all absent and every Microsoft/.NET endpoint is unreachable (SSL_ERROR_SYSCALL / HTTP 000), so nothing can be installed. |
| `Assets/Scripts/Core/{TurnSimulation,EconomyRules,GameDatabase,SaveSystem}.cs` | **Not yet written** | Sequenced after the port is compile-checked. |
| Unity layer (`GrillView`, `FoodView`, `CustomerCardView`, `TurnFlow`) | **Not yet written** | Needs the Editor to iterate on feel. |
| Unity localisation (load `shared/l10n`, resolve `*Key`) | **Not yet written** | The TS resolver (`tools/sim-core/src/l10n.ts`) is tested; the C# port is not. |
| `Packages/manifest.json`, `ProjectSettings/` | **Not yet written** | Needs the Unity Editor to generate authoritative values. |
| Golden-vector parity (TS ↔ C#) | **Not yet written** | Blocked on a C# compiler. |
| Final art assets, recorded audio, VFX | **Not present** | The prototype renders procedurally on canvas and synthesises its feedback with WebAudio (`prototype/src/audio.ts`). Both are placeholders, as allowed for a design-verification prototype — none of it ships (§82). See `10-AUDIO.md` §6 for which cues are wired. |
| Firebase / AdMob / IAP live integration | **Config only** | Requires real project credentials and a signed build. IDs are `REPLACE_IN_SECURE_CONFIG`; only Google **test** units are wired. |

**The C# code has never been compiled.** Treat it as a specification-shaped draft
until `dotnet build` passes in CI.

---

## 3. Long-horizon economy — verified

**15 of 15 balance targets met** on the current data (`restaurants` v6,
`economy` v11). Measured over a 1500-turn campaign at skill 0.55:

| Establishment | Turn | ≈ Day (12 turns/day) |
|---|---|---|
| Espetinho de Rua | 34 | 3 |
| Trailer | 90 | 8 |
| Churrascaria de Bairro | 146 | 12 |
| Churrascaria Premium | 247 | 21 |
| Festival | 430 | 36 |
| Rede Nacional | 1180 | 98 |

Daily coin income: **L5 11,122 · L15 44,669 · L30 97,761 · L50 123,278.**
Spend ratio **0.740**. Max ÷ median turn income **1.70**.
Perfect rate at skill 0.55: **48.4%**.

### Two design findings recorded from tuning

**Sink substitution.** Raising `churrascaria_bairro` from 12,000 to 15,000 coins
made it unlock **faster** (turn 185 → 146). The greedy harness spends the coins
it cannot sink into a pricier restaurant on upgrades instead, which raises income.
**Conclusion, now recorded in `economy.json._bandDerivationNote`:** never tune one
sink in isolation. Slow pacing by reducing income or by scaling *all* sinks together.

**Income plateau.** L30 and L50 income land within ~26% of each other because
difficulty is capped at `d = 1.0`. After level 30 progression is deliberately
horizontal — restaurants, collection, prestige, cosmetics — rather than bigger
numbers.

### Target checks (all PASS)

`turnsPerSession` 4 (3–5) · `firstUpgradeAffordableAfterTurns` turn 1 (1–2) ·
unlock pacing 34 / 90 / 146 / 247 / 430 / 1180 (bands 28–45, 72–115, 115–185,
195–315, 340–550, 950–1450) · income L5 11,122 · L15 44,669 · L30 97,761 ·
L50 123,278 · spend ratio 0.740 (0.70–0.99) · coin spike 1.70 (cap 6) ·
perfect rate at skill 0.55 = 48.4% (40–62%).

Skill curve on authored content (the difficulty contract):

| skill | perfect | good | burned | lost | coins/turn |
|---|---|---|---|---|---|
| 0.30 | 34.5% | 65.4% | 0.2% | 0.4% | 648 |
| 0.55 | 48.4% | — | 0.0% | — | — |

### Open balance item

The 430 → 1180 gap is **750 turns (≈ 62 days) with no new establishment.** It is
currently filled by the collection (37 entries), achievements (58), prestige
tracks, the region route, weekly events and the Brasa Pass. **Unvalidated risk:**
whether that is enough to hold a mid-core player through the gap. Needs real
telemetry (D30/D60 retention, `restaurant_unlock` funnel) before V1.0.

---

## 4. Known data defect — fixed and guarded

`achievements.json` → `collection_all_mvp` required **40** `collectionEntries`
while `collection.json` ships **37**, making the achievement unreachable.
**Fixed** (goal lowered to 37, `achievements.json` v3) and a validator rule now
fails the build if any achievement's goal exceeds the content that ships.
Verified by re-introducing the bug: `npm run validate` reported
`collection_all_mvp: goal 40 exceeds the 37 entries that ship — achievement is unreachable`.

---

## 5. Content floors vs. the brief (§8)

| Requirement | Floor | Actual | Status |
|---|---|---|---|
| Initial ingredients | ≥ 12 | **16** | ✅ |
| Customer types incl. VIP | ≥ 8 | **11** (incl. `vip`, weight 0 — summoned only) | ✅ |
| Restaurants for MVP | 2 | **7** (quintal → rede nacional) | ✅ |
| Levels | 50–80 | **60** authored + lazy endless | ✅ |
| Upgrades | 20+ | **27** coin tracks (24 + 3 prestige) + 5 ember cosmetic tracks | ✅ |
| Achievements | 30+ | **58** | ✅ |
| Daily challenges | 3 | pool of 8, **3** offered/day | ✅ |
| Weekly event | 1 | recurring weekly system, **4** event templates | ✅ |
| Currencies | exactly 2 | **2** — Moedas, Brasas | ✅ |

---

## 6. Documents

Written: `README`, `00-SPEC_AUDIT`, `01-ARCHITECTURE`, `02-GAME_DESIGN`,
`03-TECH_DESIGN`, `04-ART_STYLE`, `05-UX_FLOW`, `06-ECONOMY`, `07-MONETIZATION`,
`08-LIVEOPS`, `09-ANALYTICS`, `10-AUDIO`, `11-QA`, `12-BUILD`, `13-RELEASE`,
`14-ROADMAP`, `15-ASO`, `16-PRIVACY`, `17-BACKLOG`, `18-STATUS` (this file).

**Reconciliation:** `06-ECONOMY.md` §5 (target table) and §7 (measured pacing) were
drafted against older measurements and have been **updated to the verified v6/v11
numbers**, including two new subsections: §5.1 records the sink-substitution
finding, §5.2 records the two bug fixes that invalidated the earlier curve.
No other document cites pacing or income figures — verified by grepping the whole
`docs/` tree for the superseded values.

⚠ **Still unchecked:** docs 02–16 describe systems (audio, Unity, CI, store
rollout) that do not yet exist as code. They are specifications, not descriptions
of shipped behaviour.

**Partial exception — `04-ART_STYLE.md`:** §12 was added to separate the two. It
records what the design-verification prototype *actually renders* (theme,
per-ingredient silhouettes, composition), which rules are verified by
`npm run check-art` / `npm run check-render`, and states plainly that the §6 food
shader, §7 lighting rig, §8 VFX budgets and §11 asset registry remain
specification. The prototype proves art *direction*, not the art *budget*.

---

## 7. What to do next

1. **Compile the C# core** (`dotnet build` in CI) and add golden-vector parity. — blocking for Unity work
2. Write `TurnSimulation.cs`, `EconomyRules.cs`, `GameDatabase.cs`, `SaveSystem.cs`.
3. Write the Unity scene layer and run the feel pass.
4. `npm run gen-vectors` golden vectors.
5. Confirm the 750-turn mid-game gap with telemetry before V1.0.
6. Grow en-US / es-419 from 10.7 % stub to full coverage before any non-BR launch.
