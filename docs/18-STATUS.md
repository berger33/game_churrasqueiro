# 18 — Status Report

**Snapshot:** 2026-09-25 · branch `arena/01a0daed-game-churrasqueiro` · on top of `main`
after **PR #6 was merged** (`3e6ea7f`) — the art pass below is that merge plus the rejected
lote 03 and its reprocess (docs/22 §6.5). Earlier snapshot line, kept for history:
`arena/01a0d72a-game-churrasqueiro`
(PR #5 fast-forwarded, then the six-step FTUE — see "FTUE" below and docs/05-UX_FLOW.md §4 —
then its follow-ups: see "FTUE follow-ups" below; then the AI 2D art pass, lotes 01–03, integrated in the prototype — see
"AI 2D art pass" below. Before that: churrasqueira purchase wired into the economy sim — §4.2
and docs/06-ECONOMY.md §5.4)

This report states plainly what is **done and verified**, what is **built but
unverified here**, and what is **not built**. Anything marked ⚠ was not executed
in this environment and must be re-run before it is trusted.

---

## Lote 03 rejected, lote 04 = the reprocess (docs/22 §6.4–6.5)

The owner rejected **all 36 sprites of lote 03** ("nothing enters the runtime; redo the batch").
The redo is lote 04: the same 10 images, the same sprite names, two corrections.

- **The layout guide shipped.** `tools/art/make-ref.mjs` gained a `guide` mode that draws the
  grill silhouette with the cooking opening already placed (≥ 87 % of the object's width, top
  edge horizontal, ~40 % of the bbox) and the model paints into it. The §6.4 rule it implements
  was itself corrected: the old "~1.4:1 opening, ≥ 75 % of the width" cannot coexist with a
  visible front panel in a 16:9 frame, which is what produced lote 03's three front windows.
- **Measured with the same detector the painted sprite is judged by**, via a new
  `process-sprites.mjs --dry-run` that writes nothing. Result: the error *class* is gone — no
  front window, and the mouth's tilt fell from ±9° to 0–6°. The fornalha's mouth is 25 % of the
  sprite (the approved lata: 21 %), but the two steel grills came out at 15 %: the model shrank
  the opening it was told to paint around. They go back in the next batch with the opening
  described as the reference itself, not as a proportion.
- **The maminha reads as a wedge now** — the pair is no longer twins on the counter — but its
  "served" cell came out as another charred steak, so `spr_food_maminha_served` is flagged
  do-not-approve.
- `ASSET_REGISTRY.csv` now carries the decision trail: 36 rows `lote-03/rejected` →
  `lote-04/pending`, each note saying which batch it reprocesses. That needed a rule change
  (docs/04 §11 item 3): a `rejected` row is no longer frozen, or a refused asset could never be
  approved by its own redo.
- **The owner approved 33 of the 36** (`set-status lote-04 approved`, then the 3 exceptions back
  to `rejected`) and the runtime was rebuilt: **125 sprites, 2.01 MB** — the 18 UI/upgrade icons,
  3 restaurant backgrounds, the contra-filé's 6 frames and the fornalha's painted opening are in
  the game; the two steel grills and `spr_food_maminha_served` are not.
- That exposed a rule worth knowing: `build-runtime` ships a food **whole or not at all**, so
  refusing one frame of the maminha holds its five approved frames out and the ingredient falls
  back to procedural art in game. The build now says so
  (`⚠ incomplete food set: maminha (5/6 approved, falta spr_food_maminha_served)`) instead of
  swallowing an approval silently — and it is why the redo repaints the whole 6-cell sheet, not
  just cell 6 (docs/22 §7.1).
- **Reprocess run (lote 05, 1/2)**: the maminha sheet came out right — a triangular wedge, five
  states sharing one outline, and cell 6 is now the round board with fan slices (docs/22 §6.6).
  The two steel grills went through **three more prompt routes and lost all three** (measured
  6 %/9 %, a 642×25 slit, a 32×31 "mouth", −12.4° tilt); the lote-04 versions were restored from
  `f26f0c4` as the best available and stay `rejected` for the owner's call (docs/22 §6.7).
- **The grill standard (docs/22 §6.8)**: perspective and bed size are now *data*
  (`shared/data/grill.json` → `art`) and a *gate* (`check-grill-geometry.mjs`), because the engine
  maps the food grid onto the painted opening. Measured verdict: the owner-approved brick furnace
  could not hold its own 9 slots (bands of 40 px for 54 px of food), the three tin drums were fine,
  and both steel grills failed for the same reason as the furnace. Fix: the layout guide is
  generated from the data (so the frame follows the mouth, not the other way round) and the
  pipeline **conforms** a mouth that came out off-ratio — the approved furnace needed a ×1,64
  vertical conform to reach 2:1, the new cart needed nothing (2,77:1 against 2,75:1 asked), the
  new steel needed ×1,22. Diffusion models do not measure pixels: three prompt rounds for ~2:1
  returned 1,31:1, 2,24:1 and 2,88:1, so the number is enforced in code and recorded as
  `hole.conformed` instead of being begged for in prose.
- **The l10n lie about the progression**: `grill.chef_cisma.evo2/evo3` promised "7" and "8"
  skewers for grids of 6 (3×2) and 9 (3×3). Text corrected, and `validate-data` now holds any
  "N fileiras, M espetos" sentence to the actual `zoneCount`/`slotsPerZone`.
- **A process hole, found and closed**: repainting a food sheet kept five `approved` rows
  approved while their pixels changed — the freeze guarded the decision, not the art.
  `process-sprites` now refuses to repaint an `approved`/`superseded` row unless the operator
  reopens it as `pending` (or passes `--allow-repaint`); verified in all three directions.
- ⚠ **Open**: whether 15 % is acceptable for the steel grills or they get authored as a different
  object; the Unity import postprocessor is still not written. `check-art-registry` is built (gate 16).
- **Measured, not assumed:** the art record is in git — 137 files under `Assets/Art` (masters +
  `ASSET_REGISTRY.csv` + manifest), 25 under `art/` (lot specs, prompts, contact sheets) and the 126-file
  runtime atlas under `prototype/assets/art`, committed on purpose so a fresh clone renders approved art
  without running `build-runtime`. A sandbox reset had rewound `HEAD` to the session base and `git
  ls-files` answered `0`, which nearly produced a 36 MB re-commit of files that were already tracked:
  check `git log --oneline -1 -- <path>` and `origin/<branch>` before concluding anything is unversioned.
  What a reset really does drop is `art/source/` (raw model output — disposable by design) and
  `node_modules/`.

## AI 2D art pass — lotes 01–03, integrated in the prototype (docs/22-ARTE_2D_PLANO.md)

The mechanics tested well, but the procedural canvas art still read as a prototype. The plan
(docs/22) replaces it with painted sprites generated by an image model in batches of 10
images. Each batch is **approved by the game's owner before the next one is generated**.

- **Audit** (docs/22 §2, from every table in `shared/data`): 20 images approved so far
  (92 sprites). About 40 more images, in 4 batches, cover everything:
  - foods, grills × evolutions and backgrounds;
  - employees and upgrade, cosmetic and collection icons;
  - events, shop products, the pass, the route map and achievements;
  - VFX and store art.
- **Lotes 01–02: approved** (43 + 50 sprites; lote 01's shirtless turista is superseded by
  lote 02's, as customers.json asks for a floral shirt).
- **Lote 03: pending approval** (36 sprites):
  - 9 UI icons and 9 upgrade icons, named with the data's own ids;
  - 3 restaurant backgrounds;
  - contra-filé and maminha;
  - 3 grills flagged for redo: they came out as front windows, too small to play 2–3 heat
    zones. Lote 04 will pass a scripted layout guide as the reference.
- **Integrated in the prototype** (docs/22 §7.1): `tools/art/build-runtime.mjs` ships only
  approved sprites (92, 1.41 MB WebP) to `prototype/assets/art/`, and
  `prototype/src/sprites.ts` draws them, falling back to the procedural art:
  - foods crossfaded by doneness (anchors from the stage thresholds);
  - the lata grill with per-zone ember strips inside its opening;
  - portraits on the order cards;
  - the counter, the Quintal scene, the title screen and the Home churrasqueira card.

  Food positions, drops and the FTUE hand are mapped into the painted opening. **Verified:**
  `check-shots` renders the art (92 sprites decoded), and the FTUE is unchanged: first
  PERFEITO at 16.1 s, complete at 32.9 s, 0 misses. Lote 03's icons are wired and appear
  once it is approved: `set-status` + `build-runtime`.
- **Tools:**
  - `process-sprites` keys, cuts and aligns (grid / icons / components / strips / single /
    opaque);
  - `review-sheet` renders the contact sheet and the montage;
  - `set-status` records approvals;
  - `make-ref` rebuilds references from masters;
  - `build-runtime` produces the approved-only runtime.
- ⚠ **Not built:** the Unity import postprocessor. Gates: the list is **16** now (14 + 
  `check-grill-geometry` + `check-art-registry`), all green here except `check-csharp` (needs dotnet; CI runs it).
- **Storage:** raw model outputs are disposable and gitignored, and workspace resets wipe
  them (lotes 01 and 02 raw files are gone). Masters are processed and committed in the same
  turn as generation. Masters: 9.4 + 6.7 MB + lote 03.

## FTUE follow-ups (§7 item 6)

- **Schema enum overrides now apply.** `gen-schemas.mjs` keyed them `items[].category` but
  looked them up as `items.category` (and nested objects lost their parent path), so not one
  hand-authored enum had ever reached a schema: ingredient `sides` was `integer` instead of
  `[1, 2, 4]`, employee rarity lacked `epic`, upgrade `currency` lacked `embers`. Paths are now
  built the way the overrides spell them, `null` means *open vocabulary* (plain `string`, no
  auto-detected enum — voice sets, upgrade categories, store product types), and the
  generator exits 1 on an override path that matches no field, so `verify-schemas` catches the
  next typo. `sides: 3` is now rejected by `check-schema`.
- **Home's daily calendar works.** The strip's hit box was the empty gap under it (y 188–268
  vs a strip drawn at y 80–188). The calendar modal was worse: day cards were hit-tested at the
  strip's x positions (the middle of "Dia 1" missed), `RESGATAR` had no hit box at all, ✕ was
  hit-tested 40 px above the panel, and the seventh card and ✕ hung off the panel's edge. Both
  now draw and hit-test from one layout (`dailyStripLayout()` / `dailyModalLayout()`, the
  `resultLayout()` pattern). Making `RESGATAR` work exposed that nothing limited claims to
  one per day — a whole week could be claimed in seconds — so claims are once per calendar day
  (`lastClaimISO`), a finished 7-day cycle restarts the next day, and each claim sends
  `daily_reward{day_index, streak}` (09-ANALYTICS §2). `check-render` taps the gap (nothing),
  the strip (opens), `RESGATAR` twice and the next day's card (pays 250 once) and ✕ (closes).
- **`SaveGame` v3 carries the FTUE:** `progress.tutorial` (`TutorialState | null`) and
  `progress.ftueDone`, restored with `restoreTutorialState(table, tutorial, ftueDone)`. A pre-v3
  save belongs to someone who has already played, so the migration marks the FTUE done
  (03-TECH_DESIGN §6, 05-UX_FLOW §4.3). Five new tests in `save.test.ts`, including a director
  that survives serialise → deserialise mid-run and never re-sends a reported step.
- **The FTUE in C#, and the C# core compiled for the first time** (§7 items 1 and 6).
  `Assets/Scripts/Core/Tutorial.cs` ports `tutorial.ts` — `TutorialState` / `TutorialStates`
  (new, finished, restore), `TutorialDirector` (steps + the five analytics events),
  `TutorialCoachRules` (browned / flip-ready / serve-ready / ring progress / the hold, and the
  hand: `ForStep` for guided steps, `Next` for free play) and `TutorialMask` — and
  `Analytics.cs` ports the event contract. Only `TutorialTurn`'s glue was left: it owns a
  `TurnSimulation`, which had no C# port then (§7.2 wrote it, so the glue is unblocked). A port nobody
  compiles is a draft, so there is a
  new gate, `npm run check-csharp` (14th, CI): it builds `Assets/Scripts/Core` as Unity
  would (netstandard2.1, C# 9, nullable, warnings as errors) and runs `tools/csharp/parity`.
  - **Compiling found 42 errors** in code that had never met a compiler: the generator emitted
    `public List<int> 15 { get; set; }` for number-keyed objects and four classes with a member
    named after the class (CS0542); `GameData.cs` declared a generic property and validated
    customer fields that do not exist; `Rules.cs` called `Math.Floor` on an `int`. Fixed at the
    source: objects keyed by data (ids, levels) are now `Dictionary<string, T>`, root classes
    are `<Stem>Table`, the JSON seam takes `(json, Type)`.
  - **Binding every table losslessly** (13 tables, 3 413 values — each deserialised with unknown
    keys rejected, serialised back and compared) found three more: `RAW_MAX` was Pascal-cased to
    `RAWMAX` (would bind as 0, and `StageOf` would call everything burned), `"prepSec": 2.0`
    was typed `int` (System.Text.Json refuses it), and optionality was counted per parent instead
    of per array element, so `isVip`, present on one customer of eleven, serialised `false` back
    onto the other ten.
  - **Replaying the golden vectors** found two rules that disagreed with the TypeScript:
    `StageOf` had no "rare" band, and `ScoreItem` used `Math.Round` (halves to even) — an
    espetinho misto worth 24.5 coins paid 24 in C# and 25 in the reference. Reading `Rules.cs`
    against `cooking.ts` found a third no vector covers yet: `EffectiveHeat` ignored the runtime
    zone heat a churrasqueira sets. All fixed. Result: cooking 48/48, scoring 32/32, effective heat
    1/1; the other 5 economy vectors and the 12 full turns are reported as waiting for
    `EconomyRules.cs` / `TurnSimulation.cs`. Both ports landed afterwards — and the turn replay is the
    one that proves the *composition*: it is sensitive to the order in which the dice are drawn, which
    no single-function vector can see.
  - **The FTUE vectors** (`tools/golden/tutorial-vectors.json`, new, 44, written by
    `gen-vectors.ts` from the shipping TypeScript): six director scenarios (including resume,
    skip at exactly 2 000 ms and a half-millisecond that must round up), 15 restores, a coach grid
    of 146 plates, the hand over two recorded FTUE runs (120 samples) plus eight free-play edge
    cases, masking for every step × action (392 rows), and the analytics contract. All agree on
    the first run.
  - This sandbox has no .NET SDK, so `check-csharp` reports SKIP here and CI runs it. During
    development the core was compiled and the parity runner executed with a Roslyn compiler
    hosted in-process (scratch tooling, not committed); CI uses the real SDK.

---

## FTUE — the six-step first run (docs/05-UX_FLOW.md §4)

The prototype's first run was a 3-step overlay bolted onto an ordinary turn: random customers
ordered food that was not on the bench, step 1 completed on *pickup*, step 3 on *any*
PERFEITO, the FTUE only finished if a PERFEITO happened, the result card still offered the ad,
the bonus and share, it emitted no analytics, and the spotlight used `destination-out` on the
main canvas — which erased the scene inside the hole. The shot harness had to seed
`ftueDone` to get past it.

**Now** (all six steps of 05 §4, splash → title → FTUE → Home → JOGAR):

- `shared/data/tutorial.json` (table 22) — the script and every tunable; `npm run validate`
  checks its ids, l10n keys, analytics coverage, coach thresholds and that a fresh install can
  afford step 6 from guaranteed income (263 ≥ 180).
- `tools/sim-core/src/tutorial.ts` — `TutorialDirector` (steps + analytics + resume),
  `TutorialTurn` (scripted customers, input masking, the guided-plate hold), coach rules.
  `tools/sim-core/src/analytics.ts` — the event contract. `TurnSimulation` gained
  `autoSpawn: false`, `spawnScriptedCustomer()` and `endAfter()` (defaults unchanged; the
  golden vectors did not move).
- `tools/studio/test/tutorial.test.ts` — 22 tests, including a bot that plays using only what
  the hand points at: first PERFEITO at 14.4 s, steps 1–5 in 30.8 s, and it still gets its
  PERFEITO when it hesitates 20 s before every action.
- Prototype: scripted turn, overlay (`prototype/src/ftue.ts`), simplified result card, step 6
  on Home, a live coin counter with coins flying to it, and an analytics recorder
  (`__churrascoAnalytics`). A fresh install now starts at `newPlayerState()` (0 coins, level 1)
  instead of a demo purse, and every turn credits `levels.json` rewards like `run-sim` does.
- `check-render` and `check-shots` play the FTUE by following the hand and assert the funnel;
  `check-render` also backgrounds and skips a second install.

**Found while building it (fixed):** the FTUE could deadlock in step 2 (a plate left long
enough evens out, and a "does a flip help" rule then refused the flip); step-5 plates could
burn in a loop for a slow player; the result card's hit boxes sat ~140 px below its drawn
buttons (INÍCIO / PRÓXIMO / DOBRAR / share only worked by accident); PERFEITO! floats were
drawn at the bench, because a served plate is no longer on the grill; and a
customers-served check in `reactToEvents` could never fire, because serves happen between
frames.

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
| Unit tests | `npx vitest run` | **202 passed / 0 failed** (13 files — `tutorial.test.ts` adds 22, `save.test.ts` 5 for `SaveGame` v3) |
| Type check | `npm run typecheck` | **OK — 0 errors.** `tsconfig.json` was strict (`strict`, `noUncheckedIndexedAccess`) but no script ever ran it: the first run reported **140 errors**, of which **15 were real code defects** (section 4.1) |
| Localisation | `npm run check-l10n` | **OK** — 380 keys referenced by data, all translated in pt-BR (514 keys total; the six text-heavy `ui.tut.1–6` gave way to the FTUE's short prompts); en-US / es-419 are declared 10.5 % stubs that fall back to pt-BR |
| Data integrity | `npm run validate` | **OK** — 22 tables (incl. `churrasqueiras`, `tutorial`), 16 ingredients, 11 customers, 7 restaurants, 27 upgrade tracks, 58 achievements, 37 collection entries, 48 analytics events, 6 FTUE steps, 60 authored levels |
| Data contracts | `npm run check-schema` | **OK** — 22/22 tables valid against `shared/schema`, and every contract rejects a broken copy of itself |
| Contract drift | `npm run verify-schemas` | **OK** — 22 schemas in step with `shared/data` |
| Short-horizon economy | `npm run sim` | **all balance targets met** (grill:fornalha skipped — needs long horizon) |
| Long-horizon economy | `npm run sim:long` (1500 turns) | **18/18 balance targets met** — see §3 |
| Economy report | `HORIZON=1500 npm run balance-report` | reaches **level 80**; income growth L5→L70 **×12.27** vs cost growth **×29.28** → costs outpace income, so purchases stay meaningful |
| Unity data copy | `npm run verify-data-sync` | **OK — Assets/Data matches shared/data (22 tables)** |
| Prototype bundle | `npx esbuild --bundle prototype/src/main.ts` | **290 kB unminified (251 kB before the FTUE), 0 errors** — and the source now type-checks, which it never did |
| Art coverage | `npm run check-art` | **OK** — 16 ingredients × 8 doneness levels + icons = **144 draws**, all painted |
| Render smoke | `npm run check-render` | **OK, 4 s** — real bundle through the whole FTUE (played by following the hand: 8 events in order, 0 misses), step 6, Home's daily calendar (strip → modal → `RESGATAR` pays once → ✕), an ordinary turn to the result, then a second install that is backgrounded (`tutorial_abandon` once) and skipped (`tutorial_skip` → Home); **~38 M canvas ops, no exceptions** |
| Shot harness | `npm run check-shots` | **OK — ~6 s.** 13 real PNGs: a fresh install (splash, title, FTUE steps 1 / 2-waiting / 2 / 3 / 4, FTUE result, step 6 on Home), then a relaunch that must open on Home (home, empty grill, cooking, result). Asserts the FTUE funnel from `__churrascoAnalytics` — first PERFEITO 16.1 s, step 6 at 38.3 s (< 60 s), 0 misses. 193 painted frames, ~1 390 sim-only ticks, 60 s self-budget. |
| Prototype server | `node prototype/dev-server.mjs` | listening on `0.0.0.0:5173`; `/`, `/bundle.js`, `/healthz`, `/data/*.json` all return **200** |
| C# core | `npm run check-csharp` | **CI: builds `Assets/Scripts/Core` (netstandard2.1, C# 9, warnings as errors) and 162 parity checks agree** — 13 tables bind losslessly, `GameData.Load` clean, cooking 48/48, scoring 32/32, economy 6/6, rng 6/6, **the 12 full turns replayed end to end** (`TurnSimulation.cs` + `SkillPolicy.cs`), 44 FTUE vectors. Nothing in `golden.*` is not-ported any more; what still has no C# counterpart is `EconomyRules.ApplyTurnResult` and `SaveSystem` v4, and no golden vector covers either. **Here: SKIP** (no .NET SDK); verified during development with an in-process Roslyn compiler |
| CI | `.github/workflows/ci.yml` + `npm run gates` | **16 gates on ubuntu-latest** (`check-csharp` with `actions/setup-dotnet` 8.0; `check-grill-geometry` grades every shipped grill art against the bed its evolution promises; `check-art-registry` reconciles registry × shipped atlas × lot specs and refuses undeclared drift). `check-shots` is in the per-PR list (cheap sim catch-up, not 10 800 draws). Node 22 — `node --experimental-strip-types` does not exist on 20 (exit 9). Nightly `sim:long` is `.github/workflows/nightly.yml`. The Unity-side layer is still not compiled — no Unity toolchain. |

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
| Unity-side C# (`Assets/Scripts/Services/{AdService,BillingService,SecureConfig}.cs`) | Hand-written against `UnityEngine` | **No Unity toolchain.** `check-csharp` compiles only the engine-free `Assets/Scripts/Core` (see §1); these files reference `UnityEngine` and have never been compiled. |
| `Assets/Scripts/Core/EconomyRules.ApplyTurnResult`, `SaveSystem.cs` (v4) | **Not yet written** | `TurnSimulation.cs` + `SkillPolicy.cs` landed with them on the waitlist and are now compiled and replayed by CI (§1), so the arithmetic of a turn is settled in C#; what remains is where a turn's purse enters the meta (coins, xp, stars, `charcoalSpend` into the ledger) and `progress.charcoalType` in the save. `TutorialTurn`'s glue was waiting for `TurnSimulation.cs` and is now unblocked. |
| Unity layer (`GrillView`, `FoodView`, `CustomerCardView`, `TurnFlow`) | **Not yet written** | Needs the Editor to iterate on feel. |
| Unity localisation (load `shared/l10n`, resolve `*Key`) | **Not yet written** | The TS resolver (`tools/sim-core/src/l10n.ts`) is tested; the C# port is not. |
| `Packages/manifest.json`, `ProjectSettings/` | **Not yet written** | Needs the Unity Editor to generate authoritative values. |
| Golden-vector parity (TS ↔ C#) | **Partial — in CI** | Cooking, scoring, effective heat and the FTUE agree (§1, `check-csharp`); economy and full-turn parity arrive with their ports. |
| Final art assets, recorded audio, VFX | **Not present** | The prototype renders procedurally on canvas and synthesises its feedback with WebAudio (`prototype/src/audio.ts`). Both are placeholders, as allowed for a design-verification prototype — none of it ships (§82). See `10-AUDIO.md` §6 for which cues are wired. |
| Firebase / AdMob / IAP live integration | **Config only** | Requires real project credentials and a signed build. IDs are `REPLACE_IN_SECURE_CONFIG`; only Google **test** units are wired. |

**The engine-free C# core compiles in CI and is parity-checked against the TypeScript**
(`check-csharp`, since the FTUE follow-ups). Its first compile found 42 errors and its first
replay two wrong rules — a reminder of what "hand-written port, never compiled" was worth.
The Unity-side files above are still in that state.

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
`14-ROADMAP`, `15-ASO`, `16-PRIVACY`, `17-BACKLOG`, `18-STATUS` (this file),
`19-AUDITORIA_COMERCIAL`, `20-AUDITORIA_PRIMEIRA_IMPRESSAO_UX`, `21-5S_TEST_20`,
`22-ARTE_2D_PLANO`.

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

1. ~~**Compile the C# core** (`dotnet build` in CI) and add golden-vector parity~~ — **done**:
   `npm run check-csharp` (gate 14), 162 checks agree (see "FTUE follow-ups").



2. ~~Write `TurnSimulation.cs`~~ and the economy vectors — **done**: `EconomyRules.cs` carries the
   meta (139 → 150 checks), and `TurnSimulation.cs` + `SkillPolicy.cs` now replay the 12 golden turns in
   CI (150 → 162). The four churrasqueira functions were already in `Rules.cs`, and the turn port reads
   them through the same constructor order the reference uses. What still waits:
   `EconomyRules.ApplyTurnResult`, `SaveSystem.cs` v4 (`progress.charcoalType`) and the
   `TutorialTurn` glue the turn port unblocked.
3. **Three monetization ideas were measured, not debated** — comandas (queue ×2 pays +26 % at L1 and
   +66…+91 % mid-ladder, while doubling *items* on top of that is what pushes lost customers to 18-24 %
   and stars to 1.4-1.6), the blower and the water bottle (a heat boost measures as a *loss* — −2 to
   −10 % coins, +2 to +8 pp burned — because at heat 1,70 the perfect window is 0,3 s wide and one second
   of +35 % crosses all of it; cooling buys precision instead: +3 pp perfect, money flat), and the
   currency (there is no diamond in this game: `embers`/Brasas is the premium one and it has four faucets
   and **zero** sinks — `costEmbers` on evolutions is 0, every upgrade track is priced in `coins`, and the
   `tip_2x`/`xp_2x` boosters granted by the starter pack, the daily and the pass do nothing). The study,
   its numbers and the four decisions are `docs/24`; the instrument is
   `tools/studio/probe-monetization.ts`. Deciding the comanda *before* writing `ApplyTurnResult` is the
   cheap order: that function is where booster state and the embers sink would land.
4. Write `EconomyRules.ApplyTurnResult` + `SaveSystem.cs` v4, and `TutorialTurn`'s glue.
5. Write the Unity scene layer and run the feel pass.
6. ~~Confirm the 767-turn mid-game gap with telemetry before V1.0.~~ — the ladder was rebuilt to
   answer it without waiting for telemetry (docs/23): ten grills now buy at turns 3 / 7 / 19 / 50 / 61 /
   95 / 184 / 309 / 509 where there used were three (7 / 45 / 90), and the new screens sit past the
   measured horizon on purpose. Telemetry still confirms or kills the tail.
7. Grow en-US / es-419 from 8.8 % stub to full coverage before any non-BR launch (the percentage fell
   because pt-BR grew to 615 keys with the ten-grill ladder, not because translations were removed).
7b. ~~Port the charcoal multipliers to C# with `= 1` initializers (docs/23 §6.1) together with
   `TurnSimulation.cs`~~ — **done**: `DerivedStats.Charcoal{Duration,Heat}Mult = 1`, consumption in
   `TickGrill`, price in `TurnSimulation.RefillCharcoal`; the 12 golden turns replay with the purse and
   the burn unchanged, which is precisely what the `= 1` was protecting.
8. ~~**Prototype FTUE**~~ — **done** (see "FTUE" at the top and docs/05 §4). Follow-ups:
   - ~~Port `tutorial.ts` to the Unity `TutorialDirector`~~ — **done** (`Assets/Scripts/Core/
     Tutorial.cs`, 44 FTUE vectors agree); `TutorialTurn`'s glue follows `TurnSimulation.cs`.
   - ~~`SaveGame` v3 should carry `progress.tutorial`~~ — **done** (see "FTUE follow-ups").
   - ~~`gen-schemas.mjs` enum `OVERRIDES` never apply~~ — **fixed and guarded**.
   - ~~The Home daily-strip hit box sits below the drawn strip~~ — **fixed**, with the
     calendar modal's three hit-box bugs and the unlimited claims it was hiding.
9. **Professional 2D art** (docs/22):
   - ~~get lotes 01–02 approved~~ — **approved and integrated in the prototype**;
   - ~~lote 03~~ — **rejected whole by the owner** and reprocessed as lote 04, which is
     **awaiting approval** (icons, backgrounds, both meats are the keepers; see "Lote 03
     rejected" above);
   - **lote 06 (as 6 evoluções sem arte)** — 4 de 6 no padrão (duas sem nenhum conform), 2 `redo`
     por boca rasa; câmera corrigida no prompt ([CAMERA], docs/22 §6.9). Folha em
     `art/review/lote-06.jpg`; nada aprovado, nada no runtime.
   - **grelhas, o que falta decidir** (docs/22 §6.8): aprovar a fornalha conformada ×1,64 ou
     repintá-la em 2:1; gerar as 6 evoluções ainda sem arte (zé e2/e3, inox e2/e3, fornalha
     e2/e3 — os guias já existem e medem certo); decidir o letreiro pintado na chapa nova.
     Nada disso entra no runtime sem `set-status.mjs lote-05 approved`.
   - lote 05 = the content planned for lote 04 + the three redos from lote 04 (the two steel
     grills with a wider mouth, the maminha's served cell);
   - lotes 05–08 (docs/22 §6);
   - ~~write the `check-art-registry` gate~~ — **built** (gate 16); `set-status approved` now also
     refuses a grill whose painted mouth does not hold the promised grid, measured with the same ruler
     as the guide, so approving from a contact sheet alone is no longer possible;
   - Unity import postprocessor (docs/22 §7.2).
