# 07 — Monetization

> **Em aberto, medido:** `docs/24-COMANDAS_SOPRADOR_E_BRASA.md` estuda a comanda (boost de fila), as
> ferramentas por fileira e a pia da moeda premium. Nada lá foi aplicado; as regras abaixo continuam
> valendo para o que está implementado.

## 1. Philosophy (§34, §98)

A free player must be able to **play, progress and enjoy** the whole game. Money buys time and
appearance, never power. Concretely, and testably:

| Rule | Enforcement |
|---|---|
| No pay-to-win | No product grants doneness, tolerance or grill capacity that an upgrade does not also grant |
| No dark patterns | Purchase always shows the real store price and a confirm step |
| No fake scarcity | No countdown timers that reset; no "last chance" that is not last |
| No disguised ads | Rewarded offers are labelled with the reward before the ad plays |
| No accidental purchase | Two-tap minimum on every product; no product adjacent to a gameplay button |
| Restore always available | Permanent, visible, in Settings and in the Shop |
| No banners in gameplay | `ads.json → units.banner.enabled = false` |

Priority order: **rewarded → IAP → moderated interstitial.**

## 2. Rewarded placements

Eight voluntary placements, each with its own cooldown and daily cap
(`shared/data/ads.json → rewardedPlacements`):

| id | Context | Cap/day | Reward |
|---|---|---|---|
| `double_offline` | idle collect | 4 | 2× offline earnings |
| `double_turn` | turn result | 6 | 2× turn coins |
| `unburn_plate` | burned food | 3 | rescue the plate |
| `revive_turn` | failed turn | 2 | continue the turn |
| `call_vip` | home | 2 | summon a VIP now |
| `extra_chest` | mission complete | 2 | bonus chest |
| `speed_upgrade` | upgrade screen | 3 | halve an upgrade timer |
| `reroll_reward` | reward screen | 3 | reroll the reward |

Rules:
- The reward is shown **before** the ad starts and granted on `rewarded_complete`.
- Reward tokens are single-use with a 1 h TTL; a duplicate callback is dropped and logged.
- Server-side verification is flagged off with the enablement path documented (needs a backend).
- Debug builds always use Google's public test unit ids — enforced by a data test.

## 3. Interstitial policy (§36)

One placement only: `turn_result_to_lobby_only`.

```
minSecondsBetween   180        maxPerSession   3
maxPerDay           8          showProbability 0.6
skipFirstTurns      6          skipFirstSessions 2
suppressAfterIap    24 h       suppressAfterRewarded 10 min
suppressDuring      cooking, active_order, critical_action, tutorial
```

Every suppression fires `interstitial_suppressed{reason}` so the cap is observable rather than
assumed. All values are Remote-Config driven.

## 4. IAP catalogue

| Product id | Type | Suggested BRL | Contents |
|---|---|---|---|
| `brasa.starterpack.v1` | once per account | 9,90 | 100 Brasas + 5 000 moedas + exclusive apron + 3 tip boosters |
| `brasa.noads.v1` | non-consumable | 19,90 | removes interstitials (rewarded stays optional) |
| `brasa.coins.small.v1` | consumable | 4,90 | 120 Brasas |
| `brasa.coins.medium.v1` | consumable | 14,90 | 400 Brasas |
| `brasa.coins.large.v1` | consumable | 39,90 | 1 200 Brasas |
| `brasa.pass.season.v1` | seasonal | 24,90 | premium pass track + 60 Brasas |
| `brasa.pass.bundle.v1` | seasonal | 49,90 | premium pass + 10 tier jump + 120 Brasas |

Brasa unit price falls 4,08 → 3,73 → 3,33 centavos across the three packs — a normal volume
discount, disclosed by the price itself, with no "best value" badge lying about it.

## 5. Starter Pack timing (§39)

Shown only after **4 completed turns AND the first upgrade** (`iap.json → ethics`). Never on
the first screen, never during the FTUE, never more than once per 24 h after any purchase.
The card states plainly what it contains and that it is a one-time offer.

## 6. Purchase flow

```
tap product → shop_iap_view → confirm sheet (real store price)
   → BillingClient.launchBillingFlow → iap_start
   → onPurchasesUpdated
       ├─ OK → validate → acknowledge → grant → iap_success → (no ads for 24 h)
       ├─ USER_CANCELED → iap_fail{error:user_canceled}
       └─ ERROR / network → retry (500 ms, 2 s, 8 s) → pending flag → grant on next launch
```

Purchase is **not** granted until the purchase is acknowledged. If the app dies between grant
and acknowledgement, the pending flag reconciles on next launch — no lost purchase, no double
grant (tested in `tools/studio/test/monetization.test.ts`).

## 7. Metrics

ARPDAU · ARPU · ARPPU · IAP conversion · rewarded views/DAU · impressions/DAU · eCPM ·
offer CTR · starter-pack attach rate. Definitions in [09-ANALYTICS.md](09-ANALYTICS.md).

## 8. What is deliberately not monetised

- No energy system. Turns are unlimited.
- No loot boxes / randomised paid content.
- No paid characters. Employees are bought with coins and level up with play.
- No ads in the first 6 turns or first 2 sessions.
