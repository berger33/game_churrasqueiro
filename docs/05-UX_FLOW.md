# 05 — UX Flow

## 1. Screen map

```
                       ┌─────────────┐
        cold start ───►│   Splash    │ (≤ 1.5 s, never blocks on a service)
                       └──────┬──────┘
                              ▼
                       ┌─────────────┐   first launch
                       │   Home      │◄──────────────┐
                       │ (establish- │               │
                       │   ment 3D)  │        ┌──────┴───────┐
                       └──┬───┬───┬──┘        │   FTUE       │
        ┌─────────┬───────┘   │   └────────┐  │ (grill only) │
        ▼         ▼           ▼            ▼  └──────────────┘
   ┌────────┐ ┌────────┐ ┌─────────┐ ┌─────────┐
   │COZINHAR│ │  LOJA  │ │ EVENTO  │ │  MAPA   │  … also COLEÇÃO, MISSÕES,
   │ (turn) │ │        │ │         │ │ (Rota)  │      CONFIG, PERFIL
   └───┬────┘ └────────┘ └─────────┘ └─────────┘
       ▼
   ┌──────────────┐   ┌───────────────────┐
   │ Turn result  │──►│ interstitial?     │──► Home
   │ stars/coins  │   │ (capped, gated)   │
   └──────────────┘   └───────────────────┘
```

**Rule:** Home is a *place*, not a menu. Establishments are rendered scenes and the entries are
diegetic where possible (the grill to cook, the sign for the shop, the banner for events).
Abstract panels are only used where a 3D affordance would be slower.

## 2. HUD (§44 — only what is needed)

```
┌───────────────────────────────────────┐
│  [order] [order] [order]        🪙 1 240│   top: active orders + coin counter
│                                        │
│                                        │
│           ╔══════════════╗             │
│           ║   ZONA ALTA  ║             │   centre: the grill
│           ║  ▓▓  ▓▓  ▓▓  ║             │
│           ║   ZONA MÉDIA ║             │
│           ║  ▓▓  ▓▓  ▓▓  ║             │
│           ║   ZONA BAIXA ║             │
│           ╚══════════════╝             │
│  carvão ▮▮▮▮▯▯        COMBO ×4 🔥      │
│                                        │
│  [🥩][🍞][🧀][🍗][🌽]  ── bancada ──    │   base: raw stock to drag from
└───────────────────────────────────────┘
```

Nothing else. No pause button in the play area (system gesture), no minimap, no timers other
than the charcoal bar and per-order patience rings.

## 3. Turn flow

```
turn start (0.8 s intro: location card)
  → customers arrive on a spawn cadence
  → player cooks / flips / moves zones / serves
  → charcoal decays; low warning at 22 %; refill costs 2.2 s
  → turn timer ends → 1.2 s wind-down (last orders resolved)
  → result card: stars, coins, XP, best combo, perfect count
  → [optional] rewarded 2× → [gated] interstitial → Home
```

The result card is the **only** permitted interstitial placement. Never during cooking, an
active order, a critical action or the tutorial.

## 4. FTUE script (§40, §41, §76)

| # | On screen | Prompt | Completes when | Analytics |
|---|---|---|---|---|
| 1 | grill, one linguiça on the bench | *hand drag animation* | linguiça placed on any zone | `tutorial_step{step:place}` |
| 2 | linguiça browning | `TOQUE PARA VIRAR` | flip performed | `tutorial_step{step:flip}` |
| 3 | linguiça near perfect | `ARRASTE PARA O CLIENTE` | served | `tutorial_step{step:serve}` |
| 4 | — | `PERFEITO!` burst + coins | reward lands | `tutorial_step{step:perfect}` |
| 5 | one order, one customer | — | order completed | `tutorial_complete` |
| 6 | upgrade card | `MELHORE SUA CHURRASQUEIRA` | first upgrade bought | `tutorial_step{step:upgrade}` |

Total target: **under 60 seconds**. No store, no ads, no pass, no more than one panel deep.
If the player abandons, `tutorial_abandon{step}` fires with the step index so the exact drop
point is visible in the funnel.

### 4.1 How it is built

The script is data (`shared/data/tutorial.json`), the rules are engine-free and tested
(`tools/sim-core/src/tutorial.ts`: `TutorialDirector`, `TutorialTurn`, the coach rules), and
the prototype only draws them (`prototype/src/main.ts` + `prototype/src/ftue.ts`). The Unity
`TutorialDirector` (01-ARCHITECTURE) ports the TypeScript 1:1 in `Assets/Scripts/Core/Tutorial.cs`
— director, restore, coach rules, the hand, masking — and `npm run check-csharp` replays 44
vectors from the TypeScript against it (`tools/golden/tutorial-vectors.json`, including two
recorded FTUE runs). Only `TutorialTurn`'s glue is not ported: it owns a `TurnSimulation`,
which has no C# port yet.

**Path.** First launch: splash → title (`JOGAR`) → steps 1–5 as **one scripted turn** →
a simplified result card (`CONTINUAR` only) → Home, where step 6 waits. Relaunch: splash →
Home. The scripted turn *is* `level_001`'s first clear, on the free 1-zone `lata_valente`.

**One variable at a time.** One linguiça on the bench; scripted customers (`comum`, then
`vizinho`) who order only linguiça; no random arrivals; no clock. The HUD drops the timer,
combo, streak and pause — six step dots take the timer's place, with no "Passo x/6" text.
Order cards sit 40 px lower so the thumb does not cover the drag target (docs/20).

**Masking.** During steps 1–4 only the taught action goes through: step 1 takes and places,
step 2 taps the plate, step 3 drags it to the customer. Anything else is ignored with a soft
tick and a ring shake — never an error buzz — and counted as a miss. Step 5 plays freely.

**"Espere dourar."** The flip prompt waits until the face-down side has browned
(`coach.flipPromptAtSideDoneness` 0.55); until then a ring fills around the plate. The serve
prompt waits until a serve scores PERFEITO (overall ≥ `coach.serveReadyMinDoneness` 0.74 and
evenness ≥ 0.6). Showing `TOQUE PARA VIRAR` the moment the plate landed is what made testers
flip early and score BOM (docs/20, step 2).

**Impossible to fail** (docs/19 §6). No side of any plate in the scripted turn may pass
`perfectWindow[1] − coach.holdBelowWindowHi` (0.86 for linguiça): nothing overcooks or
burns — "things burn" is session 2's lesson (§5, docs/02 §11) — and a plate converges on
PERFEITO however long the player hesitates. Customers wait 900 s, longer than the 600 s safety
limit; if that limit ever expires the scripted turn replays rather than failing.

**Step 5** has no prompt: the hand returns only after `coach.idleHintSec` (4 s) without input,
pointing at whatever the coach says is next. **Step 6** dims all of Home except the
`Grelha Maior` card (`grill_size`, 180 coins); nothing else responds, and no daily or offline
popup opens while the FTUE is running.

**The hand** is a vector drawing (never the 👆 emoji), arcs bench → grill on a 0.9 s loop
(`coach.handLoopSec`) carrying a ghost linguiça, and taps for flips and the upgrade. Prompts
wrap on word boundaries only.

### 4.2 Spec inconsistencies and how they were resolved

1. **"steak" in step 3.** It is the linguiça from step 1: the first food is always linguiça
   (docs/19 §6), and switching cuts mid-lesson would teach two variables at once.
2. **`tutorial_complete` at step 5, with step 6 after it.** Kept literally: it closes the core
   loop, and the funnel in `analytics.json` orders `tutorial_complete` → `level_complete`
   (`level_001`) → `upgrade_purchase`. Step 6 reports `tutorial_step{step:upgrade}` plus the
   funnel's `upgrade_purchase`.
3. **Skippable?** BACKLOG #5 says "non-skippable"; the later, measured audits (docs/20 P1 #8,
   docs/21) say players felt trapped and that the 36×28 ✕ was found by only 60 %. Followed the
   audits: `PULAR` on a 48 px target after 2 s (`skip` in `tutorial.json`). Skipping goes
   straight to Home with no reward and sends `tutorial_skip{step, step_index, elapsed_ms}`
   (new in `analytics.json` v5). It is hidden during the 1.2 s wind-down after step 5.
4. **Can a fresh install afford step 6?** It starts with 0 coins (`newPlayerState()`). The
   scripted turn pays `level_001`'s reward and first-clear bonus exactly as `run-sim` does
   (80 + 150), so two PERFEITOs end at 316 coins against a 180 upgrade. `npm run validate`
   fails the build if the *guaranteed* income (level reward + first clear + turn-end bonus
   for the one guided PERFEITO = 263) ever drops below the upgrade's cost.

### 4.3 Analytics semantics

| Event | When |
|---|---|
| `tutorial_start{variant}` | the scripted turn starts — once per install, not per attempt |
| `tutorial_step{step, step_index, elapsed_ms}` | a step completes — once per step; a resumed run never re-sends it |
| `tutorial_complete{duration_ms, misses}` | step 5 completes |
| `tutorial_abandon{step, step_index}` | the app is backgrounded or closed mid-FTUE — once per step |
| `tutorial_skip{step, step_index, elapsed_ms}` | `PULAR` |

`elapsed_ms` / `duration_ms` count active FTUE time: the scripted turn, its result card and
step 6 on Home. `misses` counts actions the current step rejected, drops that missed the
grill, rejected or non-PERFEITO serves, and burns.

**Resume.** A scripted turn cannot survive the app dying, so a relaunch mid-turn replays it
from step 1 (reported steps are not re-sent). Step 6 only counts once the turn's result is
saved; if the app died in the wind-down, the turn replays too.

**Persistence.** The director's `TutorialState` lives in the save: `SaveGame` v3 carries
`progress.tutorial` (`null` until the first launch creates it) and `progress.ftueDone`
(finished or skipped — it always wins on restore, so nobody redoes the first run). Restore with
`restoreTutorialState(table, progress.tutorial, progress.ftueDone)`. A save written before v3
belongs to someone who has already played, so the v2 → v3 migration marks the FTUE done
(`tools/studio/test/save.test.ts`). The prototype keeps the same two fields in its
localStorage meta (`churrasco_meta_v2`).

**Measured** (`npm run check-shots`, a driver that only follows the hand, 0.6 s reaction):
first PERFEITO at 16.1 s, `tutorial_complete` at 32.9 s, step 6 bought at 38.3 s, 0 misses.
The sim-level bot in `tools/studio/test/tutorial.test.ts` finishes steps 1–5 in 30.8 s, and
in 38.6 s with 2.5 s reactions.

## 5. Session choreography

| Session | Unlocks | Explicitly withheld |
|---|---|---|
| 1 | grill, flip, serve, coins, one upgrade | everything else |
| 2 | pão de alho (burns fast) | zones |
| 3 | apressado (patience) | combo |
| 4 | combo + daily missions | employees, shop, pass |
| 5+ | shop, collection, route | idle (restaurant 4) |

## 6. Interaction model (one-handed, portrait)

| Gesture | Action |
|---|---|
| Drag from bench | take a raw item |
| Drop on a zone | place it there (vertical position = heat) |
| Drag between zones | move it (re-heat) |
| Tap a cooking item | **flip** |
| Long-press a cooked item (0.45 s) | serve to the matching customer |
| Drag a cooked item to a customer | serve (alternative, discoverable) |
| Tap the charcoal bar | refill |

Everything is reachable in the **lower 60 %** of the screen. The top 40 % is display-only
(orders, counters) so a thumb never covers the information it needs.

## 7. Feedback contract

Every player action must produce, within one frame: **visual + audio**, and where appropriate
**haptic**. Never colour alone (§55).

| Event | Visual | Audio | Haptic |
|---|---|---|---|
| place | item settles, dust puff | thud | none |
| flip | item rotates, sparks | **TSSSS** | none |
| progress | colour + grill marks + smoke | sizzle intensity ↑ | none |
| perfect | `PERFEITO!` + ring + sparks | bright sting | light |
| good | `BOM` | soft blip | none |
| burned | black + acrid smoke | hiss + thud | **heavy** |
| combo milestone | screen-edge glow + counter | rising sting | medium |
| customer leaves | grey-out + walk-off | disappointed grunt | none |
| upgrade | level-up rays on the object | coin cascade | medium |

## 8. Accessibility (§55)

- Minimum caption size 22 px; contrast ≥ 4.5:1.
- Doneness is signalled by **colour + grill marks + smoke + sound**, never colour alone.
- `colorBlindMode` adds a shape badge to each doneness stage and shifts the palette to a
  deuteranopia-safe ramp.
- Independent music / SFX volumes, haptics toggle, `reduceMotion`, notifications toggle.
- All interactive targets ≥ 48 dp.

## 9. Empty and error states

Every screen has a designed empty state (no missions yet, no ads available, offline) and a
designed error state. **No screen may show a spinner for more than 400 ms** without a message,
and no gameplay may be blocked by a network call (§96 offline-first).
