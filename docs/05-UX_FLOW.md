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
| 3 | steak near perfect | `ARRASTE PARA O CLIENTE` | served | `tutorial_step{step:serve}` |
| 4 | — | `PERFEITO!` burst + coins | reward lands | `tutorial_step{step:perfect}` |
| 5 | one order, one customer | — | order completed | `tutorial_complete` |
| 6 | upgrade card | `MELHORE SUA CHURRASQUEIRA` | first upgrade bought | `tutorial_step{step:upgrade}` |

Total target: **under 60 seconds**. No store, no ads, no pass, no more than one panel deep.
If the player abandons, `tutorial_abandon{step}` fires with the step index so the exact drop
point is visible in the funnel.

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
