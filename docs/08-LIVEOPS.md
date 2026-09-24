# 08 — LiveOps

## 1. Principle (§30)

No LiveOps content may require an app update. Events, modifiers, offers and level overrides are
all Remote-Config payloads; the client ships the *machinery*, not the content.

Kill switches: `kill_switch_iap`, `kill_switch_ads`, `kill_switch_events`.

## 2. Weekly recurring events

| id | Day | Modifier | Objective |
|---|---|---|---|
| `segunda_linguica` | Mon | linguiça value & XP ×1.5 | serve 30 |
| `terca_picanha` | Tue | picanha value ×1.6, XP ×1.4 | 12 perfect picanhas |
| `quarta_espetinho` | Wed | skewer category ×1.5 | serve 40 skewers |
| `fds_brasa` | Sat–Sun | global tips ×1.25, VIP chance +4 % | serve 80 |

Milestone rewards at 3 steps each. All of it is data.

## 3. Seasonal calendar (§31)

| Event | Window | Adds |
|---|---|---|
| Carnaval | carnival −7 d, 12 days | apron skin, bandeirinhas decor |
| Festa Junina | 1–30 Jun | pão de milho, balloon decor, straw hat |
| Férias | 1–21 Jul | beach decor |
| Festival de Inverno | 10–30 Jul | fire-side costela, fireplace decor |
| Primavera | 22 Sep – 12 Oct | floral decor, seasonal vegetables |
| Natal | 10 Dec – 4 Jan | Santa apron, lights, chester |
| Ano Novo | 28 Dec – 4 Jan | fireworks decor, chest |

Overlap policy: `seasonal_wins_visuals_weekly_wins_modifiers` — a seasonal event owns the
scene dressing while a weekly event still owns its value modifiers, so the two never fight.

## 4. Passe da Brasa (§32)

28 days, 50 tiers, 1 000 season XP per tier.

| XP source | Amount |
|---|---|
| turn complete | 120 |
| perfect cook | 25 |
| customer served | 20 |
| all dailies | 400 |
| all weeklies | 1 200 |
| event objective | 250 |
| combo milestone | 60 |

Two tracks. **The free track never contains essential gameplay** (asserted by a data test:
`pass.json → rules.freeTrackContainsEssentialGameplay = false`). Premium is mostly cosmetic,
plus coins and Brasas. At most one tier-jump purchase per season. Unclaimed free-track rewards
expire **with an explicit notice**, never silently.

## 5. Rota da Brasa (§24)

Sixteen stops across the five regions. Earn Pontos da Brasa by playing:

| Source | Points |
|---|---|
| perfect cook | 1 |
| customer served | 1 |
| flawless turn | 5 |
| combo milestone | 3 |
| all dailies | 10 |
| all weeklies | 30 |

Each stop is a challenge + reward + story beat. Six new stops per season ship as Remote Config;
the map renderer is data-driven and needs no client change.

## 6. Sabores do Brasil (§23)

Five regions, unlocked in the order Sudeste → Sul → Nordeste → Centro-Oeste → Norte.
Each region gets ingredients, equipment, decor and a signature challenge, with **equal depth**
and researched specifics (`shared/data/regions.json` carries the tradition text for each).
No stereotypes: the content is about food and technique, not about caricature.

## 7. Missions (§25, §26)

- **Daily:** 3 from a pool of 10, reset 04:00 local, all-three bonus 500 moedas + 2 Brasas,
  one free reroll per day then 5 Brasas.
- **Weekly:** 3 from a pool of 6, reset Monday, all-three bonus 5 000 moedas + 20 Brasas.

## 8. Daily reward and streak (§27, §28)

7-day cycle: moedas → ingrediente → Brasas → moedas → booster → Brasas → baú especial.

The streak has a **grace day**: missing one day does not reset it, it just does not advance.
`resolveDailyClaim` is unit-tested for the exact-day, one-day-gap, grace-day and reset cases.
Cycle completion adds +15 % per cycle rather than restarting from zero.

## 9. Notifications (§75)

Only four triggers, all opt-out, all deduplicated per day:

```
🔥 Sua churrascaria terminou a produção.
⭐ O Festival da Brasa começou.
🎁 Seu presente diário está disponível.
🏆 Novo desafio na Rota da Brasa.
```

Never more than two per day. Never between 22:00 and 08:00 local.

## 10. A/B testing (§73)

`ab_test_id` is a common parameter on every event, sourced from Remote Config. Test one
variable at a time: icon, onboarding variant, difficulty scalar, price point, offer copy,
rewarded placement, paywall timing. Minimum sample and significance thresholds are defined in
[09-ANALYTICS.md](09-ANALYTICS.md#7-experiments).
