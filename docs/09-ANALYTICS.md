# 09 — Analytics

## 1. Provider and policy

Firebase Analytics. **No PII.** The taxonomy file
(`shared/data/analytics.json`) declares a forbidden parameter list and forbidden substrings
(`email`, `phone`, `cpf`, `address`, `ip_addr`, `lat`, `lng`, `gps`). A data test fails the
build if any declared event uses one, and the runtime `AnalyticsService` drops and logs any
parameter that is not declared for that event — so a stray field cannot ship silently.

`user_id` is an anonymous install UUID only.

## 2. Taxonomy

47 events, every one declared with its parameters and types. The full list lives in
`shared/data/analytics.json`; the brief's §59 minimum set is asserted by
`tools/studio/test/data.test.ts`.

Common parameters attached to every event: `session_id`, `ab_test_id`, `app_version`,
`content_version`, `quality_level`.

## 3. The funnel (§60)

Every question in the brief maps to a query:

| Question | Query |
|---|---|
| How many installed? | `count(distinct users) where event = first_open` |
| How many started the tutorial? | `tutorial_start` |
| How many finished it? | `tutorial_complete` — and `tutorial_abandon{step}` says exactly where the rest stopped |
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
