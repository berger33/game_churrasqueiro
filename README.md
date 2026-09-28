# CHURRASCO! O Mestre da Brasa

> Comece fazendo churrasco no quintal e torne-se o maior Mestre da Brasa do Brasil.

Mobile cooking + skill + management + idle + collection + live-service game.
**Primary target:** Android / Google Play, portrait, one-handed. **Engine:** Unity 6 LTS (URP), C#.
**Audience:** Brazilian casual players. **Business model:** rewarded-first, ethical IAP.

> **Status audit — 2026-09-27:** the browser prototype passes its local gates, but
> Android release is blocked. Unity runtime/core APIs and scene references are
> inconsistent; production services are still simulated. CI reports 13 unvalidated
> C# turn vectors. PRs #7/#8 are now reconciled in the consolidation branch;
> see [the merge record](docs/26-MERGE_PR7_PR8.md) for conflict decisions and delivery checks.
> See [the current audit and ordered delivery plan](docs/25-AUDITORIA_STATUS_E_BRANCHES.md).

---

## Repository layout

| Path | What lives there |
|---|---|
| `shared/data/` | **Single source of truth.** All gameplay, economy and LiveOps tables (JSON). Nothing is hardcoded in C#. |
| `tools/sim-core/` | Reference implementation of the game rules in TypeScript. Deterministic, dependency-free, unit-tested; target contract for the incomplete C# port. |
| `tools/studio/` | Designer tooling: data validation, level generator, balance simulator, golden-vector generator. |
| `tools/studio/test/` | Automated QA (economy, cooking model, save integrity, data integrity). |
| `Assets/` | Approved art/audio and data, engine-free C# core, Unity runtime scaffolding, scenes/prefabs and simulated services. Unity integration is not release-ready. |
| `Packages/`, `ProjectSettings/` | Unity 6 project configuration exists; full Editor/runtime compilation and Android validation remain blocked (see current audit). |
| `prototype/` | Design-verification prototype (playable in a browser) that runs the real `sim-core` rules. |
| `android-shell/` | Real-device playtest APK: the prototype in a full-screen, offline WebView. Published to a stable release URL by [Android playtest](.github/workflows/android-playtest.yml) — see [docs/27](docs/27-TESTE_ANDROID.md). |
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
vectors. Full-turn parity is still incomplete; the current runner suppresses some turn divergences (see the audit).

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

# Real-device playtest (Android). The export is self-contained: no server, no CDN.
npm run export:android    # → build/android-webapp (bundle, data, art, audio, fonts)
npm run serve:android     # serve that export on http://0.0.0.0:8080 for a phone
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
| [24-PROMPT_PROXIMA_SESSAO.md](docs/24-PROMPT_PROXIMA_SESSAO.md) | Historical handoff, with a current audit override (pt-BR) |
| [26-MERGE_PR7_PR8.md](docs/26-MERGE_PR7_PR8.md) | Real merge, conflict decisions, recovered tools and validation (pt-BR) |
| [27-TESTE_ANDROID.md](docs/27-TESTE_ANDROID.md) | Installing the playtest APK on a real phone: QR, sideload steps, test script, limitations (pt-BR) |
| [25-AUDITORIA_STATUS_E_BRANCHES.md](docs/25-AUDITORIA_STATUS_E_BRANCHES.md) | Verified status, conflicting branches, release blockers and ordered delivery plan (pt-BR) |

## Current status

The current source of status is [the 2026-09-27 audit](docs/25-AUDITORIA_STATUS_E_BRANCHES.md),
which supersedes earlier claims that all phases are complete. Branch reconciliation
is recorded separately in [the merge report](docs/26-MERGE_PR7_PR8.md).

- **Verified locally after reconciliation:** 756 tests in 38 files, 14 of 15 CI gates (C# skipped locally
  because .NET is absent), and all 18 long-horizon economy targets over 1,500 turns.
- **Approved art:** 244 runtime sprites; registry, rendering and prototype screenshots pass.
- **C# CI:** the engine-free core compiles, but the latest main check reports 13
  unvalidated turn vectors. A runner fallback hides their failures as “not ported”.
  This is not full parity and must be fixed before relying on the gate.
- **Unity:** project settings, scenes, prefabs and scripts exist, but runtime/core API
  mismatches, invalid scene script GUIDs and missing gameplay wiring block delivery.
- **Production:** ads, billing, consent and Firebase adapters are still simulated;
  save/autosave integration, Android localization, signed builds and real-device QA
  remain open. No Android build or publication was verified in this audit.
- **Branches:** the #8 history (which contains #7) has been reconciled by a real merge,
  preserving current gameplay/approved art and recovering useful research/art tools.
  Obsolete 10-grill tuning is not activated. See the merge report for all 198 path decisions;
  branch cleanup requires confirmed ancestry in remote main and a green consolidation PR.
- **Recovered tools:** `npm run art:preview` previews without rewriting the atlas;
  `npm run art:guide -- <out.png> [width] --grill <id> --evo <n>` creates authoring guides.
  `npm run probe:monetization` runs isolated experiments. `art:inspect` compares against
  a proposed authoring standard, not the current renderer or art approval policy.


## Legal / IP

All content is original. No assets, names or mechanics are copied from Cooking Fever,
Overcooked, Cooking Madness or any other title. Regional Brazilian cuisine references are
researched and treated respectfully (see `shared/data/regions.json`).
