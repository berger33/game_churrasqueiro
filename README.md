# CHURRASCO! O Mestre da Brasa

> Comece fazendo churrasco no quintal e torne-se o maior Mestre da Brasa do Brasil.

Mobile cooking + skill + management + idle + collection + live-service game.
**Primary target:** Android / Google Play, portrait, one-handed. **Engine:** Unity 6 LTS (URP), C#.
**Audience:** Brazilian casual players. **Business model:** rewarded-first, ethical IAP.

---

## Repository layout

| Path | What lives there |
|---|---|
| `shared/data/` | **Single source of truth.** All gameplay, economy and LiveOps tables (JSON). Nothing is hardcoded in C#. |
| `tools/sim-core/` | Reference implementation of the game rules in TypeScript. Deterministic, dependency-free, unit-tested; target contract for the incomplete C# port. |
| `tools/studio/` | Designer tooling: data validation, level generator, balance simulator, golden-vector generator. |
| `tools/studio/test/` | Automated QA (economy, cooking model, save integrity, data integrity). |
| `Assets/` | Unity-oriented data, approved art/audio, engine-free C# core and service stubs. There are no scenes or prefabs yet. |
| `Packages/`, `ProjectSettings/` | **Not present yet.** Creating the Unity 6 project is a V0.2 task. |
| `prototype/` | Design-verification prototype (playable in a browser) that runs the real `sim-core` rules. |
| `docs/` | Full documentation set — see below. |
| `store-assets/` | Store icons, feature graphic, screenshots, ASO copy, privacy copy and test material. |

### Why a TypeScript reference implementation?

The cooking model, the scoring rules and the entire economy are implemented **once** in
`tools/sim-core` and executed headlessly in CI. That gives us:

- balance numbers that come from *running the game* rather than from guesswork;
- an executable specification the Unity port can be verified against (golden vectors);
- designer tooling that needs no Unity Editor and no license.

The future Unity client must port the same rules. The current engine-free subset lives in
`Assets/Scripts/Core/`; `npm run check-csharp` compiles it in CI and replays the checked-in
vectors. Economy and full-turn parity are still incomplete.

`npm run typecheck` is a gate, not a suggestion: the ideal-zone defect in
`tools/sim-core/src/policy.ts` (see `docs/18-STATUS.md` §4.1) survived two rounds of
green tests precisely because the strict `tsconfig.json` was never wired to a script.

## Quick start (no Unity required)

```bash
npm ci

npm run gates             # the 15 per-PR CI gates, same list GitHub Actions runs
npm run typecheck         # tsc --noEmit over tools/, prototype/ and shared/ (strict)
npm run validate          # referential + semantic integrity of every data table
npm run check-schema      # every table against its JSON Schema contract (+ negative pass)
npm test                  # full automated QA suite (vitest)
npm run check-art-registry # masters, registry, manifest and approved-only runtime agree
npm run check-art         # all 16 ingredient silhouettes x 8 doneness levels render
npm run check-render      # drive the real prototype bundle through a full turn
npm run gen-levels        # regenerate the authored turn list
npm run sim               # economy simulation + balance guardrails (exits non-zero on breach)
npm run sim:long          # 1,500-turn multi-month pacing projection
npm run balance-report    # human-readable tuning tables
npm run sync-data         # copy shared/data → Assets/Data for Unity
npm run proto             # design-verification prototype on http://0.0.0.0:5173
```

## Documentation

| Document | Contents |
|---|---|
| [00-SPEC_AUDIT.md](docs/00-SPEC_AUDIT.md) | Audit of the 117-point brief: dependencies, risks, decisions |
| [01-ARCHITECTURE.md](docs/01-ARCHITECTURE.md) | Module map, dependency rules, data flow |
| [02-GAME_DESIGN.md](docs/02-GAME_DESIGN.md) | Core loop, cooking model, systems, progression |
| [03-TECH_DESIGN.md](docs/03-TECH_DESIGN.md) | Unity implementation, performance, save, security |
| [04-ART_STYLE.md](docs/04-ART_STYLE.md) | Style bible: palette, typography, modelling rules |
| [05-UX_FLOW.md](docs/05-UX_FLOW.md) | Screens, navigation, FTUE, HUD |
| [06-ECONOMY.md](docs/06-ECONOMY.md) | Curves, sinks/faucets, measured pacing, simulator |
| [07-MONETIZATION.md](docs/07-MONETIZATION.md) | Rewarded placements, IAP catalogue, ethics rules |
| [08-LIVEOPS.md](docs/08-LIVEOPS.md) | Events, seasons, pass, calendar, Remote Config |
| [09-ANALYTICS.md](docs/09-ANALYTICS.md) | Event taxonomy, funnel, KPIs, dashboards |
| [10-AUDIO.md](docs/10-AUDIO.md) | Sound identity, asset list, music plan |
| [11-QA.md](docs/11-QA.md) | Test strategy, device matrix, checklists |
| [12-BUILD.md](docs/12-BUILD.md) | Build, signing, AAB, CI |
| [13-RELEASE.md](docs/13-RELEASE.md) | Store listing, rollout, soft launch |
| [14-ROADMAP.md](docs/14-ROADMAP.md) | V0.1 → V1.0 with exit criteria |
| [15-ASO.md](docs/15-ASO.md) | Keywords, icon concepts, screenshots, copy |
| [16-PRIVACY.md](docs/16-PRIVACY.md) | LGPD/GDPR, data disclosure, consent |
| [17-BACKLOG.md](docs/17-BACKLOG.md) | Prioritised backlog |
| [18-STATUS.md](docs/18-STATUS.md) | What is built, what is verified, what is open |
| [19-AUDITORIA_COMERCIAL.md](docs/19-AUDITORIA_COMERCIAL.md) | Commercial audit and what it changed (pt-BR) |
| [20-AUDITORIA_PRIMEIRA_IMPRESSAO_UX.md](docs/20-AUDITORIA_PRIMEIRA_IMPRESSAO_UX.md) | First-impression / first-90-seconds UX audit (pt-BR) |
| [21-5S_TEST_20.md](docs/21-5S_TEST_20.md) | Guided 5-second test, n=20 (pt-BR) |
| [22-ARTE_2D_PLANO.md](docs/22-ARTE_2D_PLANO.md) | Professional 2D art plan: AI generation in batches of 10, cut-out pipeline, approval, integration (pt-BR) |
| [23-PLANO_IMPLEMENTACAO.md](docs/23-PLANO_IMPLEMENTACAO.md) | Step-by-step implementation and improvement plan: phases, gates, progress log (pt-BR) |
| [23-AUDITORIA_TECNICA.md](docs/23-AUDITORIA_TECNICA.md) | Technical audit: bugs, errors and data/code/doc inconsistencies, with evidence and repro scripts (pt-BR) |
| [24-PROMPT_PROXIMA_SESSAO.md](docs/24-PROMPT_PROXIMA_SESSAO.md) | Complete resumption prompt for the PR #14 handoff: A-03 next, contracts, evidence and remaining release plan (pt-BR) |

## Current status

See [docs/18-STATUS.md](docs/18-STATUS.md) for an honest, itemised account of what is
implemented and verified versus what is still open. Short version:

- **Implemented and verified here:** 22 data tables and schemas, the TypeScript reference
  rules, level/save/balance tooling, a playable browser prototype, 351 tests and per-PR CI gates.
- **Approved 2D art:** 244 sprites / 3.98 MB WebP, covering all 16 foods and 7 restaurant
  backgrounds; registry state is 244 approved, 0 pending and 1 superseded.
- **Compiled and partially parity-checked in CI:** the engine-free C# core
  (`Assets/Scripts/Core`). Economy and 20 complete-turn vectors still await their C# ports.
- **Known technical debt:** `docs/23-AUDITORIA_TECNICA.md` records 47 findings, including
  9 original high-severity findings: A-07/A-08/A-09 are fixed in TypeScript. A-01 now requires flipping both slow cuts
  (owner decision), with functional tests/UI passed but **economic acceptance pending**:
  long sim fails 3/18 targets (late-game income, unlock timing and spend ratio). A-02 now
  applies player-level AND restaurant unlocks to orders/stock/UI; A-03–A-06 remain open.
  Current evidence: [A-02 report](docs/evidence/a02/README.md). Green gates do not prove those remaining design defects are fixed.
- **Not yet a Unity game:** there are no `Packages/`, `ProjectSettings/`, scenes, prefabs,
  APK or AAB. Unity services are stubs and have not been compiled against real SDKs.
- **Audio and store material exist**, but still need Unity integration, device validation,
  final mixing, signed builds and real Play Console/Firebase/AdMob test projects.

## Legal / IP

All content is original. No assets, names or mechanics are copied from Cooking Fever,
Overcooked, Cooking Madness or any other title. Regional Brazilian cuisine references are
researched and treated respectfully (see `shared/data/regions.json`).
