# 18 — Status Report

**Snapshot:** 2026-09-27 · branch `arena/01a0e03e-game-churrasqueiro` · F1+F2 implementadas; A-01/A-02 funcionais validados, aceite econômico global pendente; merge do PR #14 autorizado para fechamento; confirmar integração no GitHub

**Fechamento da sessão:** o dono autorizou integrar PR #14 e limpar branches já
integradas, preservando explicitamente os PRs/branches #7/#8. O recibo de merge/CI está
no [PR #14](https://github.com/berger33/game_churrasqueiro/pull/14); confirmar MERGED e
base em main antes da retomada. Os registros abaixo conservam o estado histórico de
cada checkpoint (incluindo “sem merge” antes desta autorização).
Prompt consolidado em **docs/24-PROMPT_PROXIMA_SESSAO.md**; próximo A-03.
A autorização atual não se estende às mudanças da próxima sessão.

**Estado executivo:** 🟡 protótipo técnico sólido, com dados, regras de referência, FTUE,
automação, arte e protótipo web avançados; ainda não é um jogo Unity publicável. Não existem
`Packages/`, `ProjectSettings/`, cenas/prefabs Unity, APK ou AAB. A auditoria técnica
`docs/23-AUDITORIA_TECNICA.md` registra 47 achados originais (9 altos, 19 médios, 19 baixos). A-07/A-08/A-09 foram
corrigidos na referência TS. A-01 foi corrigido funcionalmente (virada obrigatória), mas a
economia longa falha em3 alvos. A-02 aplica nível E restaurante; A-03–A-06 seguem abertos. Não liberar a porta C#.

This report states plainly what is **done and verified**, what is **built but
unverified here**, and what is **not built**. Anything marked ⚠ was not executed
in this environment and must be re-run before it is trusted.

---

## AI 2D art pass — complete and approved (docs/22-ARTE_2D_PLANO.md)

The individual replacement sequence requested by the owner is complete. Lotes 08–11
replaced all 33 assets that had remained pending from lote 03 in rounds of 10 + 10 + 10 + 3.
The owner approved the final round and authorised the complete merge on 2026-09-26.

- **Registry:** 245 entries = **244 approved, 0 pending, 1 superseded**.
- **Approved runtime:** **244 sprites / 3.98 MB WebP**, containing all **16 foods**,
  **7 restaurant backgrounds**, 11 customers, 12 grill variants and 51 icons.
- **Coverage:** the runtime no longer depends on procedural fallback for contra-filé or
  maminha; both have five aligned cooking frames plus served art.
- **Lote 11 final assets:** served contra-filé, served maminha and Churrascaria de Bairro.
  Technical review: 3/3 ok, zero magenta residue on foods, opaque 9:16 background with the
  gameplay centre clear. The first background attempt was discarded before processing.
- **Approval trail:** exact prompts, batch specs, checks and contact sheets are versioned in
  `art/prompts/lote-08..11.md`, `art/lote-08..11.json` and `art/review/`.
- **Prototype integration:** `tools/art/build-runtime.mjs` ships approved-only WebP assets;
  `check-shots` decodes all 244 and the FTUE remains unchanged (first PERFEITO 16.1 s,
  completion 32.9 s, upgrade 38.3 s, zero misses).
- **Registry gate implemented:** `npm run check-art-registry` checks masters, CSV, batch specs,
  manifest, approved-only runtime and the 244-ID floor from PR #13; 52 contract tests include
  46 negative mutations. Unity still lacks an `AssetPostprocessor`/atlas import pipeline.
  Approved art does not implement the collection,
  events, IAP, pass, route or achievements screens by itself.

The art lifecycle is closed; the next work is rule remediation and platform implementation,
not another replacement batch.

## Post-art A-02 — vigente: nível E restaurante, economia global pendente

- `playerLevel` obrigatório no TurnConfig, inteiro positivo, separado do índice da fase;
  catálogo de início do turno exige nível e restaurante para pedidos/estoque/bancada.
  Roteirizados também respeitam; unusualOnly sem receita não entra no sorteio, forçado
  sem menu falha explicitamente. Não há pedido vazio nem bypass com nível omitido.
- Sim passa p.level, UI meta.level, FTUE1. Curva de skill acumula XP real a partir de1,
  mantendo skill fixa/sem compras. Fixtures de mecânica usam44 explicitamente; nenhuma
  receita antecipada nos chamadores reais. Dados/save/schema/tiposC# intactos.
- **351/351 testes**,18 arquivos:50 regressões originais red +2 wiring red; harness falha
  com bancada antiga, green com catálogo alinhado. **14/15 gates locais**, C# SKIP.
- **106+44 vetores**, formato principalv2: playerLevel obrigatório nos20 turnos,
 9 expectativas iniciais mudam;11 preservadas, cooking/scoring/economy e44 FTUE intactos.
  Revisão por caso em `evidence/a02/vector-review.json`. C# continua25 não portados.
- **19 screenshots/244 sprites**: save nos níveis1/5/6/7, bancada/pedidos coerentes,
  queijo visível/arrastável a partir de6, sem hitbox fantasma. FTUE16,1/32,9/38,3s e
  zero erros. Fixtures de UI não provam desbloqueio natural/metaprogressão completa.
- Longo **15/18, exit1**: rede883 vs950–1450, L50=192.223 vs98.000–152.000,
  spend0,489 vs0,70–0,99. Renda22.233.557, gasto10.873.220, saldo11.360.337;
  perfect75,7%, burned0,2%, lost3,5%, média172,5s. Restaurantes42/98/165/259/398/883,
  grills10/45/89. **Sem tuning/limites alterados**, economia global não estabilizada.
- Evidências/logs/curva em [`evidence/a02/README.md`](evidence/a02/README.md).
  npm audit mesmas5 vulnerabilidades, sem force-fix. Longo é evidência local (Nightly
  dispatch negado403 anteriormente). **CI A-02 15/15 aprovado** em44ccf11,
  [run36286427123](https://github.com/berger33/game_churrasqueiro/actions/runs/36286427123); C#139 checks/25 não portados.
- Próximo **A-03 prep/vinagrete**: a receita continua no pool após nível12/rest0, mas
  falta o fluxo não grelhado na UI. Não remover para esconder o problema. PR14 aberto,
  sem merge; A-04 ainda exige decisão, F3/F4/C#/Unity não liberados.

## Post-art A-01 — histórico: funcional validado, economia pendente

Dono escolheu **exigir virada**, rejeitando a recomendação de um lado. Ingredients v6:
costela/cupim permanecem `sides:2`, agora `flipNeeded:true`; validador semântico protege
contra regressão, bot já consumia o flag. Sem mudar tempos/janelas/preços/fórmulas/metas.

- **299/299 testes**, 16 arquivos (27 novos); regressões regras 17/19 vermelhas antes,
  UI 4/6, seleção de prato vizinho 1/8. Janelas perfeitas físicas nas três zonas;
  bot equipado validado nos restaurantes elegíveis 3–6 e curva avançada com 8 seeds.
- **14/15 gates locais**, C# SKIP. `sim` curto verde; **sim longo 15/18, exit 1**.
  Falhas: Rede Nacional **859** vs 950–1450; renda L50 **182.381** vs 98.000–152.000;
  spend **0,480** vs 0,70–0,99. Renda **22.675.447**, gasto **10.873.220**, perfect
  **75,9%**, burned **0,2%**, perdidos **3,7%**, média **173,4 s**. Não houve retuning.
- **106+44 vetores**: 98 antigos e 44 FTUE idênticos em inputs/expectativas; só versão
  ingredients e **8 turnos avançados novos**, com contagens reais por corte. Nenhum schema,
  nível autoral ou tipo C# regenerado. C# tem **25 casos não portados** (5+20), não 17.
- UI: bancada paginada, dica contextual após dourar, toque seleciona o prato mais próximo
  entre alvos sobrepostos. Textos pt/en/es; **17 screenshots**, 244 sprites inalterados.
  FTUE **16,1/32,9/38,3 s**, zero erros. Fixture avançada testa o bundle/input, **não**
  desbloqueio natural de restaurantes. Rótulos de pratos vizinhos ainda pedem polish.
- Dados/logs/revisão completos em [`evidence/a01/README.md`](evidence/a01/README.md).
  npm audit: mesmas 5 vulnerabilidades (1 crítica/1 alta/3 moderadas), sem force-fix.
- PR #14 aberto/sem merge; CI remoto A-01 **15/15 aprovado** em `8b042ca`,
  [run 36285270473](https://github.com/berger33/game_churrasqueiro/actions/runs/36285270473); C# 139 checks/25 não portados.
  Sim longo validado localmente; dispatch Nightly negado por permissão da integração (403). Próximo A-02,
  ainda F3; levar os 3 desvios à F4 depois de A-02–A-06. Não declarar F3/F4 encerradas.

## Post-art F2 — histórico (2026-09-26 local / 27 UTC)

- **A-07 resolvido:** restaurantes = 1 inicialmente, depois 2..7; repetição não altera
  estado. Saves v1/v2/v3 são normalizados por `restaurantIndex+1` após validação do checksum,
  sem alterar outros contadores, carteiras ou conquistas já resgatadas. Save continua v3.
- **A-08 resolvido:** um evento de queima por prato; servir não soma novamente. Testes reais
  de grelha/servir/descartar/múltiplos/resultado/save. Não se divide pela metade o histórico
  de saves antigos, pois não há informação por item para repará-lo.
- **A-09 resolvido:** `result()` puro, bônus só no retorno, moedas/XP vivos intactos;
  eventos/counters isolados de alterações externas. Repetir a leitura não reaplica bônus,
  nem congela o turno se consultado antes do fim. Crédito da carteira deve continuar único.
- Testes **254 → 272**, com red/green por achado; gates locais **14/15**, somente C# SKIP.
  Sim longo **18/18**, saída integral idêntica ao baseline; vetores **98+44 sem drift**,
  não regenerados. FTUE **16,1/32,9/38,3 s**, zero erros; 244 sprites e 13 screenshots.
- Dados/schemas/levels/arte/economia não retunados. As regressões novas exercitam casos que
  os vetores do bot não cobrem. C# não foi portado; permanece com 17 vetores não portados.
- Audit continua 5 vulnerabilidades (1 crítica/1 alta/3 moderadas); F6 isolada pendente.
- PR #14 ampliado para F1+F2, sem merge. CI remoto F2: **15/15 aprovado**, incluindo C#,
  em `faf2081`: [run 36283526080](https://github.com/berger33/game_churrasqueiro/actions/runs/36283526080). São 139 checks C# existentes, ainda 17 vetores não portados.
- **Próximo à época (superado acima):** A-01 com confirmação de produto (`sides:1` recomendado para costela/cupim,
  mantendo `flipNeeded:false`), testes de janela/bot e revalidação. A-01–A-06 continuam abertos.

## Post-art F1 verification — historical checkpoint (2026-09-27 UTC)

- Baseline: PR #13 merged at `4fe4f4f`; clean session branch; Node 22.22.3/npm 10.9.8.
- Tests **202 → 254**, all passing (14 files). `npm run gates`: **14/15 local gates**,
  only `check-csharp` skipped without .NET. CI now includes `check-art-registry` (gate 15).
- `sim:long`: **18/18**, full output unchanged from baseline: spend 0.741, burned 5.7%,
  perfect 71.8%, lost 6.9%, mean duration 169.8 s, level 80 after 1,500 turns.
- `npm audit`: unchanged **1 critical + 1 high + 3 moderate**, deferred to isolated F6.
- No gameplay semantics, vectors, data or art changed. **At the F1 checkpoint, all nine high findings remained open.**
- Next: **A-07 → A-08 → A-09**, then content/progression and economic revalidation, medium/low
  debt, tooling security, selective PR #7/#8 review, C# and Unity, in that order. Operational
  plan and exit criteria: `23-PLANO_IMPLEMENTACAO.md` §9 (supersedes historical sequences).
- Remote CI: **15/15 passed**, including C# compilation/checks, on `92976b2`,
  [run 36282761422](https://github.com/berger33/game_churrasqueiro/actions/runs/36282761422).
  [PR #14](https://github.com/berger33/game_churrasqueiro/pull/14) is open, **not merged**.

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
  `Analytics.cs` ports the event contract. Only `TutorialTurn`'s glue is left: it owns a
  `TurnSimulation`, which has no C# port yet. A port nobody compiles is a draft, so there is a
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
    `EconomyRules.cs` / `TurnSimulation.cs`.
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
| Unit tests | `npx vitest run` | **351 passed / 0 failed** (18 files; A-02 adds52) |
| Type check | `npm run typecheck` | **OK — 0 errors.** `tsconfig.json` was strict (`strict`, `noUncheckedIndexedAccess`) but no script ever ran it: the first run reported **140 errors**, of which **15 were real code defects** (section 4.1) |
| Localisation | `npm run check-l10n` | **OK** — 380 keys referenced by data, all translated in pt-BR (515 keys total; the six text-heavy `ui.tut.1–6` gave way to the FTUE's short prompts); en-US / es-419 are declared 11.1 % stubs that fall back to pt-BR |
| Data integrity | `npm run validate` | **OK** — 22 tables (incl. `churrasqueiras`, `tutorial`), 16 ingredients, 11 customers, 7 restaurants, 27 upgrade tracks, 58 achievements, 37 collection entries, 48 analytics events, 6 FTUE steps, 60 authored levels |
| Data contracts | `npm run check-schema` | **OK** — 22/22 tables valid against `shared/schema`, and every contract rejects a broken copy of itself |
| Contract drift | `npm run verify-schemas` | **OK** — 22 schemas in step with `shared/data` |
| Short-horizon economy | `npm run sim` | **all balance targets met** (grill:fornalha skipped — needs long horizon) |
| Long-horizon economy | `npm run sim:long` (1500 turns) | **15/18; exit 1** — A-02 income/unlock/spend failures; see current checkpoint above |
| Economy report | `HORIZON=1500 npm run balance-report` | **Historical pre-A-01, not revalidated:** reaches level 80; income growth L5→L70 **×12.27** vs cost growth **×29.28** → costs outpace income, so purchases stay meaningful |
| Unity data copy | `npm run verify-data-sync` | **OK — Assets/Data matches shared/data (22 tables)** |
| Prototype bundle | `npx esbuild --bundle prototype/src/main.ts` | **290 kB unminified (251 kB before the FTUE), 0 errors** — and the source now type-checks, which it never did |
| Art registry | `npm run check-art-registry` | **OK** — 245 masters/rows/manifest entries, 244 approved runtime sprites, 244 protected baseline IDs; 52 contract tests (46 negative). |
| Art coverage | `npm run check-art` | **OK** — 16 ingredients × 8 doneness levels + icons = **144 draws**, all painted |
| Render smoke | `npm run check-render` | **OK, 4 s** — real bundle through the whole FTUE (played by following the hand: 8 events in order, 0 misses), step 6, Home's daily calendar (strip → modal → `RESGATAR` pays once → ✕), an ordinary turn to the result, then a second install that is backgrounded (`tutorial_abandon` once) and skipped (`tutorial_skip` → Home); **~38 M canvas ops, no exceptions** |
| Shot harness | `npm run check-shots` | **OK — ~6 s.** 19 real PNGs (4 advanced-page/flip/perfect-window and2 level-boundary shots via real pointer input), plus the original13: a fresh install (splash, title, FTUE steps 1 / 2-waiting / 2 / 3 / 4, FTUE result, step 6 on Home), then a relaunch that must open on Home (home, empty grill, cooking, result). Asserts the FTUE funnel from `__churrascoAnalytics` — first PERFEITO 16.1 s, step 6 at 38.3 s (< 60 s), 0 misses. 199 painted frames, 1 913 sim-only ticks, 60 s self-budget. |
| Prototype server | `node prototype/dev-server.mjs` | **Historical check; no server currently running.** Configured for `0.0.0.0:5173`; `/`, `/bundle.js`, `/healthz`, `/data/*.json` all return **200** |
| C# core | `npm run check-csharp` | **CI: builds `Assets/Scripts/Core` (netstandard2.1, C# 9, warnings as errors) and 139 parity checks agree** — 13 tables bind losslessly, `GameData.Load` clean, cooking 48/48, scoring 32/32, effective heat, 44 FTUE vectors; 25 economy/turn vectors unported after A-01 (5+20); 139 checks confirmed by A-02 CI run36286427123. **Here: SKIP** (no .NET SDK); verified during development with an in-process Roslyn compiler |
| CI | `.github/workflows/ci.yml` + `npm run gates` | **15 gates on ubuntu-latest** (`check-csharp` added, with `actions/setup-dotnet` 8.0). `check-shots` is in the per-PR list (cheap sim catch-up, not 10 800 draws). Node 22 — `node --experimental-strip-types` does not exist on 20 (exit 9). Nightly `sim:long` is `.github/workflows/nightly.yml`. The Unity-side layer is still not compiled — no Unity toolchain. |

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
| `Assets/Scripts/Core/{TurnSimulation,EconomyRules,SaveSystem}.cs` | **Not yet written** | The compile + parity gate now exists (`check-csharp`); 17 golden vectors (5 economy, 12 full turns) are waiting for these ports. `TutorialTurn`'s C# glue waits for `TurnSimulation.cs`. |
| Unity layer (`GrillView`, `FoodView`, `CustomerCardView`, `TurnFlow`) | **Not yet written** | Needs the Editor to iterate on feel. |
| Unity localisation (load `shared/l10n`, resolve `*Key`) | **Not yet written** | The TS resolver (`tools/sim-core/src/l10n.ts`) is tested; the C# port is not. |
| `Packages/manifest.json`, `ProjectSettings/` | **Not yet written** | Needs the Unity Editor to generate authoritative values. |
| Golden-vector parity (TS ↔ C#) | **Partial — in CI** | Cooking, scoring, effective heat and the FTUE agree (§1, `check-csharp`); economy and full-turn parity arrive with their ports. |
| Approved 2D art | **Present and bundled** | 244 approved sprites / 3.98 MB WebP cover 16 foods, 7 backgrounds, customers, grills, UI, collection and meta art. Some approved meta assets are not yet wired to functional screens. |
| Audio/VFX finalisation | **Prototype assets present; final pass unverified** | 31 WAV files and approved visual VFX exist, but they have not been mixed, profiled or validated inside Unity on device. |
| Firebase / AdMob / IAP live integration | **Config only** | Requires real project credentials and a signed build. IDs are `REPLACE_IN_SECURE_CONFIG`; only Google **test** units are wired. |

**The engine-free C# core compiles in CI and is parity-checked against the TypeScript**
(`check-csharp`, since the FTUE follow-ups). Its first compile found 42 errors and its first
replay two wrong rules — a reminder of what "hand-written port, never compiled" was worth.
The Unity-side files above are still in that state.

---

## 3. Long-horizon economy — verified

> Historical pre-A-01 projection; current measurements and three failed targets are
> in the Post-art A-02 checkpoint above and docs/evidence/a01/. Do not treat these
> older green targets/gap/income values as the current balance.


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
items that **historically** had `flipNeeded:false`. That was later shown to be the
A-01 contradiction, not valid design: the owner chose two sides + mandatory flip;
v6 now validates multi-side grill recipes accordingly; and `vinagrete` is a prep item whose
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
shader, §7 lighting rig and §8 VFX budgets remain specification. The §11 asset registry now
has an executable inventory gate (`check-art-registry`, F1); Unity import remains pending.
The prototype proves art *direction*, not the art *budget*.

---

## 7. Historical next-step list — superseded by operational plan §9

**Do not start these ports yet:** remediate TypeScript/data/economy first. The current next
action is A-03 after functional A-01/A-02; global economic acceptance is still pending. The list below preserves the earlier port backlog.

1. ~~**Compile the C# core** (`dotnet build` in CI) and add golden-vector parity~~ — **done**:
   `npm run check-csharp` (gate 14), 139 checks agree (see "FTUE follow-ups").
2. Write `TurnSimulation.cs`, `EconomyRules.cs`, `SaveSystem.cs` (v3, with `progress.tutorial`)
   — `check-csharp` will pick up the 17 economy / full-turn vectors they unlock; port the
   churrasqueira functions (`applyChurrasqueiraToStats`, `churrasqueiraZoneHeat`,
   `patchGrillForChurrasqueira`, `runtimeZoneIndex`) with them, then `TutorialTurn`'s glue.
3. Write the Unity scene layer and run the feel pass.
4. Confirm the 767-turn mid-game gap with telemetry before V1.0.
5. Grow en-US / es-419 from 9.7 % stub to full coverage before any non-BR launch.
6. ~~**Prototype FTUE**~~ — **done** (see "FTUE" at the top and docs/05 §4). Follow-ups:
   - ~~Port `tutorial.ts` to the Unity `TutorialDirector`~~ — **done** (`Assets/Scripts/Core/
     Tutorial.cs`, 44 FTUE vectors agree); `TutorialTurn`'s glue follows `TurnSimulation.cs`.
   - ~~`SaveGame` v3 should carry `progress.tutorial`~~ — **done** (see "FTUE follow-ups").
   - ~~`gen-schemas.mjs` enum `OVERRIDES` never apply~~ — **fixed and guarded**.
   - ~~The Home daily-strip hit box sits below the drawn strip~~ — **fixed**, with the
     calendar modal's three hit-box bugs and the unlimited claims it was hiding.
7. **Professional 2D art** (docs/22):
   - lotes 01–11 closed; 244 approved, 0 pending, 1 superseded;
   - `check-art-registry` implemented and included in local/CI gate lists;
   - Unity import postprocessor remains pending (docs/22 §7.2), after reference/C# stability.
