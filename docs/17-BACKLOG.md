# 17 — Backlog

Prioritised backlog, ordered by the project's own priority stack
(**1** fun · **2** retention · **3** stability · **4** experience · **5** monetisation · **6** content, spec §114).

Effort: S < 1 day · M 1–3 days · L 1 week+ · XL multi-week.
Every item states its **done** condition — "funciona mas falta polimento" is not done (§81).

---

## Now — finish the playable core (V0.1 → V0.2)

| # | Item | Effort | Done when |
|---|---|---|---|
| 1 | Port `TurnSimulation` + `CookingRules` into the Unity scene (GrillView, FoodView, CustomerCardView, TurnFlow) | L | A turn plays in the Unity Editor with the same rules as the prototype; golden vectors match to 1e-9 |
| 2 | Real art for the grill scene: grill, 3 zone treatments, 6 food silhouettes, 4 customer types | L | No grey boxes anywhere in the turn screen; style bible colours and outlines honoured |
| 3 | Drag/flip/serve feel pass in Unity (haptics, squash-and-stretch, trail, sizzle) | M | 3 test players report the flip feels "satisfying" unprompted |
| 4 | Audio pass for the turn (sizzle, flip, chop, ding, coin, charcoal) | M | All 9 SFX in §2 of docs/10-AUDIO.md trigger correctly with ducking |
| 5 | Tutorial (6 steps) in Unity — port `tools/sim-core/src/tutorial.ts` + `shared/data/tutorial.json` (the prototype FTUE is done, docs/05 §4). Skippable after 2 s, per docs/20–21 (was "non-skippable", see 05 §4.2) | M | A new player completes a perfect serve with zero text explanation — the prototype proves it with a driver that only follows the hand (0 misses, first PERFEITO at 16 s) |
| 6 | `SaveSystem` wired to `Application.persistentDataPath` + atomic write | S | Kill the app mid-turn, reopen, state is intact and no crash |

## Next — vertical slice (V0.3 → V0.4)

| # | Item | Effort | Done when |
|---|---|---|---|
| 7 | Meta loop: lobby, upgrades, restaurant selection, level map | L | All four screens functional, navigable one-handed in portrait |
| 8 | Remaining 10 food silhouettes + 7 customer types + 6 restaurant backdrops | L | 16 ingredients, 11 customers and 7 restaurants visually distinct |
| 9 | Full pt-BR localisation table + key-coverage checker in CI | M | 0 untranslated keys; build fails on a missing key |
| 10 | Daily missions, daily reward calendar, achievements UI | M | All three loops grant and claim correctly; 58 achievements tracked |
| 11 | Analytics SDK integration (Firebase) with the 48-event taxonomy | M | Every event in `analytics.json` fires in a debug build and appears in DebugView |
| 12 | Ads + IAP integration (test units / test products only) | L | All 8 rewarded placements, interstitial policy and 5 products work against test IDs |
| 13 | Performance pass against `performance.json` budgets | M | LOW/MEDIUM/HIGH profiles each hold their frame-rate and draw-call budget |
| 14 | Golden-vector parity test in CI | M | `npm run gen-vectors` output matches the C# runner bit-for-bit |

## Later — polish, content, LiveOps (V0.5 → V1.0)

| # | Item | Effort | Done when |
|---|---|---|---|
| 15 | Region route + festival + national-chain restaurants as distinct play spaces | XL | 7 restaurants with their own layout, music and unlocks |
| 16 | Employees (churrasqueiro, assistente, caixa, garçom, influencer) with visible effects | L | Each role changes play observably, not just a number |
| 17 | Weekly event system driven by `events.json` | L | 2 events run back-to-back with modifiers, banners and rewards |
| 18 | Brasa Pass season 1 | L | 24 tiers, free + premium tracks, purchase → unlock verified |
| 19 | Offline rewards + manager auto-cook loop | M | Return after 8 h offline, collect, and it matches the documented rates |
| 20 | Collection / trophies UI with share cards | M | 37 entries display; share card renders correctly |
| 21 | en-US and es-419 localisation | L | Full coverage; no pt-BR leakage |
| 22 | Device-tier matrix QA on 6 real devices | M | No tier-3 device below 30 fps on a 5-customer turn |
| 23 | Accessibility: colour-blind-safe doneness cues, text size, reduced motion | M | Every quality readable without colour; motion reducible |
| 24 | LGPD consent + Data Safety submission | M | UMP flow live; store form matches docs/16-PRIVACY.md |

## Icebox

- Multiplayer / co-op grill (spec §115 explicitly descopes it for MVP).
- User-generated recipes.
- Seasonal ingredient sets beyond the four regions.
- Landscape / tablet layout.
- Cloud save across platforms.

---

## Definition of done (every item)

An item is done only when all of these hold (§81):

1. Functional — works on a tier-3 device at target frame rate.
2. Visual — final art, no placeholder, matches docs/04-ART_STYLE.md.
3. Audio — final sound, mixed per docs/10-AUDIO.md.
4. Analytics — events fire per docs/09-ANALYTICS.md.
5. Tested — automated test or a logged manual case in docs/11-QA.md.
6. Documented — the relevant doc section updated in the same change.

## Explicitly not in scope for MVP (§115)

Multiplayer, real-time PvP, user accounts beyond anonymous + platform sign-in,
UGC, cloud save, subscription billing, ads during active cooking, and any
mechanic that requires the network to play the core loop (§96 offline-first).
