# 09 — Analytics

## 1. Provider and policy

Firebase Analytics. **No PII.** The taxonomy file
(`shared/data/analytics.json`) declares a forbidden parameter list and forbidden substrings
(`email`, `phone`, `cpf`, `address`, `ip_addr`, `lat`, `lng`, `gps`). A data test fails the
build if any declared event uses one, and the runtime `AnalyticsService` drops and logs any
parameter that is not declared for that event — so a stray field cannot ship silently.

`user_id` is an anonymous install UUID only.

## 2. Taxonomy

48 events, every one declared with its parameters and types. The full list lives in
`shared/data/analytics.json`; the brief's §59 minimum set is asserted by
`tools/studio/test/data.test.ts`.

`tools/sim-core/src/analytics.ts` is the runtime contract (`checkAnalyticsEvent`): unknown
event, missing or undeclared parameter, wrong type. The design prototype runs every event it
logs through it, drops undeclared parameters, and exposes the log as
`globalThis.__churrascoAnalytics`; `npm run check-shots` asserts the FTUE funnel from that log.
`npm run validate` fails if the FTUE director can send an event — or a parameter — that
`analytics.json` does not declare.

**FTUE events** (`tutorial_start`, `_step`, `_complete`, `_abandon`, `_skip`): exact firing
rules are in docs/05-UX_FLOW.md §4.3 — one `tutorial_step` per step per install (never
re-sent on resume), one `tutorial_abandon` per step, `elapsed_ms` = active FTUE time.
`tutorial_skip` was added in v5 when the FTUE became skippable (docs/20 P1 #8, docs/21).

**`daily_reward{day_index, streak}`** fires when a day of the 7-day calendar is claimed — at
most once per calendar day. `day_index` is 1-based (1–7, the day the card shows), like
`step_index`; `streak` is the login streak at the moment of the claim. The prototype sends it
from both claim paths (`RESGATAR` and the day's card); `npm run check-render` asserts one event
for one claim, and none for a second tap the same day.

Common parameters attached to every event: `session_id`, `ab_test_id`, `app_version`,
`content_version`, `quality_level`.

## 3. The funnel (§60)

Every question in the brief maps to a query:

| Question | Query |
|---|---|
| How many installed? | `count(distinct users) where event = first_open` |
| How many started the tutorial? | `tutorial_start` |
| How many finished it? | `tutorial_complete` — and `tutorial_abandon{step}` / `tutorial_skip{step}` say exactly where the rest stopped |
| How many finished the first match? | `level_complete where level_id = level_001` |
| Who came back tomorrow? | `session_start where days_since_install >= 1` |
| Who reached restaurant 2? | `restaurant_upgrade where restaurant_index >= 1` |
| Who watched a rewarded? | `rewarded_complete` |
| Who bought? | `iap_success` |
| Where did they abandon? | `level_fail{reason, progress_pct}` + `tutorial_abandon{step}` + `order_failed{reason}` |

## 4. KPIs (§61)

**Retention:** D1, D3, D7, D14, D30 · **Engagement:** DAU, MAU, DAU/MAU stickiness, session
length, sessions/user/day, turns/session, perfect rate · **Monetization:** ARPDAU, ARPU,
ARPPU, IAP conversion, rewarded/DAU, impressions/DAU, eCPM, LTV D7/D30/D90 ·
**Acquisition:** CPI, ROAS · **Stability:** crash-free users (> 99 % target), ANR rate.

Targets for soft launch (§89):

| KPI | Green | Yellow | Red |
|---|---|---|---|
| D1 | ≥ 40 % | 30–40 % | < 30 % |
| D7 | ≥ 12 % | 8–12 % | < 8 % |
| Tutorial completion | ≥ 85 % | 70–85 % | < 70 % |
| Crash-free users | ≥ 99.3 % | 99–99.3 % | < 99 % |
| ARPDAU (BR casual) | ≥ R$ 0,06 | 0,03–0,06 | < 0,03 |
| Rewardeds / DAU | ≥ 0.6 | 0.3–0.6 | < 0.3 |

## 5. Dashboards

`acquisition_funnel` · `retention` · `monetization` · `gameplay_health` · `stability`
(widget definitions in `analytics.json → dashboards`).

`gameplay_health` is the one that decides design changes: perfect rate by level, fail rate by
level, burned rate and abandon by level. A level with > 25 % abandon is a level to fix, not a
player to blame.

## 6. Decision rules (§90)

| Symptom | Diagnosis | Action |
|---|---|---|
| Drop-off in the tutorial | FTUE problem | Fix the tutorial; never touch marketing |
| D1 low, tutorial fine | core loop / FTUE reward | Rebalance turn 1–3 rewards |
| D1 good, D7 low | meta-game problem | More mid-term goals: missions, route, collection |
| Retention good, revenue low | economy / ads / IAP | Rewarded placement tuning, offer timing |
| Revenue good, CPI high | creative / ASO / positioning | New creatives, keyword work |

Rule: **never attribute a product problem to marketing.**

## 7. Experiments

One variable per experiment. `ab_test_id` on every event. Minimum 5 000 users per arm and
95 % confidence before a decision. Never change two variables at once (§73).
