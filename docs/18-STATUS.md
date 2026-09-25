# 18 — Status Report

**Snapshot:** 2026-09-25 · branch `arena/01a0d703-game-churrasqueiro`
(PR #4 fast-forwarded, then churrasqueira purchase wired into the economy sim — see §4.2 and docs/06-ECONOMY.md §5.4)

This report states plainly what is **done and verified**, what is **built but
unverified here**, and what is **not built**. Anything marked ⚠ was not executed
in this environment and must be re-run before it is trusted.

---

## Visual polish pass (studio-grade art direction)

The design-verification prototype was promoted from a flat, "prototype-looking"
canvas to a commercial, friendly, studio-quality presentation:

- **Iconic churrasqueira de alvenaria** replaces the generic metal box —
  procedural brickwork (`drawBrickwork` in `theme.ts`) with mortar joints,
  lit chimney, granite counter lip, concrete plinth, and a soft ground shadow.
- **Golden-hour backyard scene**: multi-band sunset sky, sun disc dipping behind
  a silhouetted picket fence with pointed posts, warm radial light pool from the
  grill, twinkling string lights on a gently drooping wire, deep vignette.
- **Cinematographic lighting**: multi-radial ember glow under every piece of
  food, warm bounce light from the coals, key-light rim highlights on every card
  and button, polished gloss streaks on CTA buttons, heat-shimmer bands on hot
  grill zones.
- **Food art re-rendered** (`foods.ts`): two-pass sear stripes (dark char + warm
  ruby halo), rendered fat cap with ripples, juice beads, sausage casing splits,
  crispy chicken skin bumps, melted-cheese drips, herb-butter pools on garlic
  bread, and a richer body gradient.
- **Frosted-glass HUD chips** (`glass()` in `theme.ts`) for coins, combo and
  perfect counters, replacing flat coloured pills.
- **Premium CTAs** (`premiumButton()`) with multi-layer fire/gold gradients,
  ambient glow, glossy top and pressed-shadow bottom.
- **Result screen** adds rotating light rays for 2/3-star results, staggered
  stat rows with back-and-forth slide, confetti on celebration, gold variant for
  perfect turns.
- **Title screen** adds breathing fire-gradient title, hero churrasqueira with
  animated coals, three floating signature foods, glowing CTA, animated embers.
- **VFX budget raised**: more sparks, softer smoke, screen-shake on perfects
  and combos, flash pulses on big moments, ring-bursts on perfect serves.
- **Polished customer avatars**: skin, hair, smile, shirt collar, VIP crown.
- **Protype banner removed** from `index.html`; rounded-corner window chrome with
  warm outer glow replaces the plain black rectangle.

All sim-core tests and every validation gate still pass — now including a
`tsc --noEmit` type-check gate, which had been configured but never wired to a
script (see section 4.1). The render smoke test drives ~44.9 M canvas ops without
throwing.

---

## 1. Verified in this environment

Every claim below was produced by a command run in this checkout.

| Area | Check | Result |
|---|---|---|
| Unit tests | `npx vitest run` | **174 passed / 0 failed** (11 files) |
| Type check | `npm run typecheck` | **OK — 0 errors.** `tsconfig.json` was strict (`strict`, `noUncheckedIndexedAccess`) but no script ever ran it: the first run reported **140 errors**, of which **15 were real code defects** (section 4.1) |
| Localisation | `npm run check-l10n` | **OK** — 376 keys referenced by data, all translated in pt-BR (514 keys total); en-US / es-419 are declared 9.7 % stubs that fall back to pt-BR |
| Data integrity | `npm run validate` | **OK** — 21 tables (incl. `churrasqueiras`), 16 ingredients, 11 customers, 7 restaurants, 27 upgrade tracks, 58 achievements, 37 collection entries, 47 analytics events, 60 authored levels |
| Data contracts | `npm run check-schema` | **OK** — 21/21 tables valid against `shared/schema`, and every contract rejects a broken copy of itself |
| Contract drift | `npm run verify-schemas` | **OK** — 21 schemas in step with `shared/data` |
| Short-horizon economy | `npm run sim` | **all balance targets met** (grill:fornalha skipped — needs long horizon) |
| Long-horizon economy | `npm run sim:long` (1500 turns) | **18/18 balance targets met** — see §3 |
| Economy report | `HORIZON=1500 npm run balance-report` | reaches **level 80**; income growth L5→L70 **×12.27** vs cost growth **×29.28** → costs outpace income, so purchases stay meaningful |
| Unity data copy | `npm run verify-data-sync` | **OK — Assets/Data matches shared/data (21 tables)** |
| Prototype bundle | `npx esbuild --bundle prototype/src/main.ts` | **135 kB, 0 errors** — and the source now type-checks, which it never did |
| Art coverage | `npm run check-art` | **OK** — 16 ingredients × 8 doneness levels + icons = **144 draws**, all painted |
| Render smoke | `npm run check-render` | **OK** — real bundle driven through init, a drag, a flip and a full turn; **~45 M canvas ops, no exceptions** |
| Shot harness | `npm run check-shots` | **OK — 6.6 s.** 5 real PNGs (splash, home/JOGAR, empty grill, cooking, result). 161 painted frames, 980 sim-only ticks. 60 s self-budget. The old tail was 10 800 full-scene draws (~3.8 GB RSS / 300 s timeout). |
| Prototype server | `node prototype/dev-server.mjs` | listening on `0.0.0.0:5173`; `/`, `/bundle.js`, `/healthz`, `/data/*.json` all return **200** |
| CI | `.github/workflows/ci.yml` + `npm run gates` | **green on ubuntu-latest (28 s), 13 gates.** `check-shots` is in the per-PR list (cheap sim catch-up, not 10 800 draws). Node 22 — `node --experimental-strip-types` does not exist on 20 (exit 9). Nightly `sim:long` is `.github/workflows/nightly.yml`. Unity compile is still absent — no toolchain. |

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
6. **The ideal-zone mechanic was dead code** — found by the new type-check gate,
   not by a test. `pickZoneFast` compared `zones[i].id === ideal`, but runtime
   zones are `{ index, heat, items }` and carry no `id`. Every grill item was
   placed in a random zone: **31.9%** ideal-zone hits at skill 0.55 against a
   **33.3%** chance baseline. Fixed, measured and guarded by a new test — see 4.1.

### What bug #1 and #2 did to the economy

Both bugs destroyed roughly **10% of all customers** in simulation. After the
fix, customer loss at skill 0.30 fell from **10.5% → 0.4%** and perfect rate rose
**26.1% → 34.5%**. All earlier pacing measurements were therefore taken with a
leak in place and had to be re-derived — see section 3.

A third defect (section 4.1) invalidated the numbers once more and they were
re-derived again; on the current rules the same two figures read **0.7%** and
**35.4%**.

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

**18 of 18 balance targets met** on the current data (`restaurants` v6,
`economy` v12). Measured over a 1500-turn campaign playing the owned grill:

| Establishment | Turn | ≈ Day (12 turns/day) |
|---|---|---|
| Espetinho de Rua | 32 | 3 |
| Trailer | 89 | 7 |
| Churrascaria de Bairro | 147 | 12 |
| Churrascaria Premium | 243 | 20 |
| Festival | 418 | 35 |
| Rede Nacional | 1185 | 99 |

| Churrasqueira | Turn | ≈ Day |
|---|---|---|
| Zé da Esquina | 7 | 1 |
| Parrilla Chef Cisma | 45 | 4 |
| Fornalha Dragão Manso | 90 | 8 |

Daily coin income: **L5 10,793 · L15 41,115 · L30 98,262 · L50 115,926.**
Spend ratio **0.741**. Max / median turn income **1.70**.
Perfect rate at skill 0.55 (default grill, difficulty contract): **55.7%**.
Campaign burn on the owned-grill path: **5.7%** (was 20.3% before the heat cap).

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
unlock pacing 32 / 89 / 147 / 243 / 418 / 1185 · grill path 7 / 45 / 90 ·
income L5 10,793 · L15 41,115 · L30 98,262 · L50 115,926 · spend ratio 0.741
(0.70–0.99) · coin spike 1.70 (cap 6) · perfect rate at skill 0.55 = 55.7% (40–62%).

Skill curve on authored content (the difficulty contract):

| skill | perfect | good | burned | lost | coins/turn |
|---|---|---|---|---|---|
| 0.30 | 35.4% | 64.5% | 0.1% | 0.7% | 671 |
| 0.55 | 55.7% | 44.3% | 0.0% | 0.0% | 793 |

### Open balance item

The 418 → 1185 gap is **767 turns (≈ 64 days) with no new establishment.** It is
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

### 4.1 Three defects the type-check gate caught

`tsconfig.json` has been strict since the project started, but no script ever ran
it — `npm run typecheck` did not exist. Wiring it up (`@types/node`,
`allowImportingTsExtensions`) surfaced **140 errors**: roughly 112 configuration
noise (missing Node types, `.ts` import extensions under
`--experimental-strip-types`) and **15 real code defects**. Three mattered:

1. **The ideal-zone mechanic was dead code** (`tools/sim-core/src/policy.ts`).
   `pickZoneFast` compared `zones[i].id === ideal`; runtime zones are
   `{ index, heat, items }` and carry no `id`. The comparison was always false, so
   every grill item went to a random zone — measured **31.9%** ideal-zone hits at
   skill 0.55 against a **33.3%** chance baseline for three zones. The mapping the
   code wanted already existed two lines below (`zoneIndex(a, id)`).

   Fixing it moved the reference measurement from **48.4% → 55.7%** perfects at
   skill 0.55 (**712 → 793** coins/turn). All 15 targets still pass on both
   horizons, so this was a *fidelity* correction rather than a rescue: the
   published numbers now describe the game as designed. Every figure in section 3
   was re-derived, the 98 golden vectors were regenerated, and the two suites that
   encode "skill matters" were tightened:
   `tools/studio/test/policy.test.ts` is new and asserts ideal-zone behaviour
   directly so the mechanic cannot silently stop running again, and
   `cooking.test.ts` now separates skill by *quality* (perfect rate, coins) because
   throughput saturates once the zone mechanic actually works — a clumsy player
   keeps up with this customer flow, and both sides serve all 13–14 customers.

2. **The prototype shaded every zone as the medium one** (`prototype/src/main.ts`).
   It read `zone.heatMultiplier`, which exists only on the *data* zone; the runtime
   zone stores `heat`, and the `?? 1` fallback hid the mistake. It now calls
   `effectiveHeat()`, the same function `tickGrill` cooks with, so the zone the
   player sees is the zone the food cooks in.

3. **The golden-vector contract had holes** (`tools/studio/gen-vectors.ts`). Two
   fields were written from paths that do not exist — `STATS.heatRatePerSec` and
   `db.grill.scoring.burnedCoinFactor` — and `JSON.stringify` drops `undefined`
   silently, so the file the C# port must satisfy never contained them.
   `heatRatePerSec` is now the real per-second doneness rate `tickGrill` applies
   (`heat * heatRate * heatRampRate / sideCookSec`), and the phantom
   `burnedCoinFactor` reference is gone: burned food pays a hard zero, which the
   expectation rows already pin down.

None of the three failed a gate, because the gate that would have caught them did
not exist. The new gate has teeth — reverting the policy fix makes it report the
error and `policy.test.ts` fail with 36.2% / 33.6% against thresholds of 0.6 / 0.43.
### 4.2 Integrating the churrasqueira progression — a crash no gate saw

Branch `arena/01a0d354` (never opened as a PR) added churrasqueira progression
(`shared/data/churrasqueiras.json`: `lata_valente` 1 zone → `ze_da_esquina` 2 →
`parrilla_chef_cisma` 3 → `fornalha_dragao_manso` 3, three evolutions each), real
audio, the commercial/shop screens and a photoreal art pass. On its own branch every
gate was green. Merging it with PR #3 surfaced three problems:

1. **9 type errors** (`noUncheckedIndexedAccess`) in `prototype/src/audio.ts` and
   `main.ts` — the code was written before the type-check gate existed. Fixed
   without behaviour change (a variant index past a short file list now falls back
   to the synth instead of passing `undefined`).
2. **The skill policy crashed on every starter grill.** Ingredient `idealZone` ids
   were resolved against the 3-zone `db.grill.zones` table, so on a 1- or 2-zone
   churrasqueira `high` pointed at a zone that does not exist:
   `TypeError: Cannot read properties of undefined (reading 'items')`. Nothing
   caught it because **nothing ever ran a turn with a churrasqueira equipped** — the
   feature had zero tests. New `runtimeZoneIndex()` in `cooking.ts` maps the id by
   relative position (identity when counts match).
3. **The policy aimed at the wrong heat.** It estimated cook rate from the table's
   `heatMultiplier`, while `effectiveHeat()` — what `tickGrill` cooks with — now
   reads the churrasqueira-patched zone heat. It now calls `effectiveHeat()`
   directly.

On the default grill (2) and (3) are bit-identical — the 98 golden vectors are
unchanged and all 15 balance targets still pass on both horizons.
`tools/studio/test/churrasqueira.test.ts` (22 tests) drives real turns on every
grill × evolution; against the pre-fix policy **5 of them fail** (the crash on the
1-/2-zone grills, the heat estimate on the 3-zone ones).

**Design observation, now a defect, now fixed:** at skill 0.30 the top grill
(`fornalha_dragao_manso`, heatBase 1.42) yielded ~12 % fewer perfects than the
default grill. Wiring it into the campaign sim made the real cost visible:
the `heatBase + 0.85·t` ramp peaked at 2.47 (default `high` is 1.55), campaign
burn **20.3 %**, lost customers **11.4 %**, L15/L30 income 20 % below band.
The premium grill was an incinerator. `churrasqueiraZoneHeat()` now uses the
default zone profile × `heatBase`, capped at 1.70. Re-measured burn **5.7 %**.
A hotter grill still rewards skill (high zone 1.70 vs 1.55); it no longer
deletes 1 in 5 plates.

### 18 dangling `$schema` references

Every table in `shared/data` declared a `$schema` field pointing at
`schema/<name>.schema.json`, and **none of those files existed**. Editors, CI and
any external consumer got a contract that resolved to nothing — the reference
looked like a guarantee and delivered none.

**Fixed.** `shared/schema/` now holds all 20 contracts, generated from the real
tables by `tools/studio/gen-schemas.mjs`, and `npm run check-schema` validates
every table by resolving its declared `$schema` rather than assuming the filename
pairing — so a table pointing at the wrong schema is caught instead of silently
checked against something else.

Deriving rather than hand-writing mattered: three hand-written assumptions were
wrong before the generator's first clean run. `stageOverrides` is
`{id, max, nameKey}` not `{stage, max, labelKey}`; `costela` and `cupim` are grill
items with `flipNeeded: false` **by design** (low-and-slow cuts you never flip),
so "grill implies flipNeeded" is false; and `vinagrete` is a prep item whose
`sideCookSec`/`heatRate`/`burnRate` are legitimately `0`.

`check-schema` also runs a **negative pass** — each contract is fed a broken copy
of its own table (a required field deleted, an unknown top-level key added) and
must reject it. Verified the guard has teeth by neutering
`ingredients.schema.json`: the check failed and exited 1. Restored, exit 0.

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

**Reconciliation:** `06-ECONOMY.md` section 5 (target table) and section 7
(measured pacing) were drafted against older measurements and have been **updated
to the verified v6/v11 numbers**, including three subsections: 5.1 records the
sink-substitution finding, 5.2 records the two bug fixes that invalidated the
earlier curve, 5.3 records the ideal-zone defect and the re-derivation it forced.
Every figure in `06-ECONOMY.md` and in this file was re-measured after that fix;
no other document cites pacing or income figures — verified by grepping the whole
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
4. Confirm the 767-turn mid-game gap with telemetry before V1.0.
5. Grow en-US / es-419 from 9.7 % stub to full coverage before any non-BR launch.
6. **Prototype FTUE** — rewrite the 6-step first-run so it matches the splash →
   home → JOGAR path the shot harness now drives. (`npm run check-shots` is done:
   sim catch-up at the 0.1s dt cap with `__churrascoSkipDraw`, 60s self-budget,
   PNGs of splash / home / empty grill / cooking / result.)
