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
| `tools/sim-core/` | Reference implementation of the game rules in TypeScript. Deterministic, dependency-free, unit-tested. The Unity `Sim` assembly is a 1:1 port. |
| `tools/studio/` | Designer tooling: data validation, level generator, balance simulator, golden-vector generator. |
| `tools/studio/test/` | Automated QA (economy, cooking model, save integrity, data integrity). |
| `Assets/` | Unity project (scripts, prefabs, scenes, imported data). |
| `Packages/`, `ProjectSettings/` | Unity package manifest and project configuration. |
| `prototype/` | Design-verification prototype (playable in a browser) that runs the real `sim-core` rules. |
| `docs/` | Full documentation set — see below. |
| `marketing/` | Store assets: icon concepts, feature graphic, screenshot templates, ASO copy. |

### Why a TypeScript reference implementation?

The cooking model, the scoring rules and the entire economy are implemented **once** in
`tools/sim-core` and executed headlessly in CI. That gives us:

- balance numbers that come from *running the game* rather than from guesswork;
- an executable specification the Unity port can be verified against (golden vectors);
- designer tooling that needs no Unity Editor and no license.

The Unity client ports the same rules (`Assets/Scripts/Sim/`). Parity is checked by
`tools/studio/golden.test.ts` against checked-in vectors.

`npm run typecheck` is a gate, not a suggestion: the ideal-zone defect in
`tools/sim-core/src/policy.ts` (see `docs/18-STATUS.md` §4.1) survived two rounds of
green tests precisely because the strict `tsconfig.json` was never wired to a script.

## Quick start (no Unity required)

```bash
npm install

npm run gates             # the 14 per-PR CI gates, same list GitHub Actions runs
npm run typecheck         # tsc --noEmit over tools/, prototype/ and shared/ (strict)
npm run validate          # referential + semantic integrity of every data table
npm run check-schema      # every table against its JSON Schema contract (+ negative pass)
npm test                  # full automated QA suite (vitest)
npm run check-art         # all 16 ingredient silhouettes x 8 doneness levels render
npm run check-render      # drive the real prototype bundle through a full turn
npm run gen-levels        # regenerate the authored turn list
npm run sim               # economy simulation + balance guardrails (exits non-zero on breach)
LONG_HORIZON=1500 npm run sim   # multi-month pacing projection
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

## Current status

See [docs/18-STATUS.md](docs/18-STATUS.md) for an honest, itemised account of what is
implemented and verified versus what is still open. Short version:

- **Implemented and verified here:** the complete data layer, the cooking/scoring/economy
  rules, the level generator, the save system, the balance simulator with guardrails, a
  playable design-verification prototype, and the per-PR CI gates (`npm run gates` /
  `.github/workflows/ci.yml`).
- **Compiled and parity-checked in CI:** the engine-free C# core (`Assets/Scripts/Core` —
  data classes, cooking/scoring rules, the FTUE director, the analytics contract):
  `npm run check-csharp` builds it as Unity would and replays the golden vectors against it
  (it SKIPs on a machine without the .NET 8 SDK; CI always runs it).
- **Not yet compiled anywhere:** the Unity-side layer (`Assets/Scripts/Services`, scenes) —
  there is no Unity Editor in this environment. This is stated plainly rather than glossed over.
- **Not started:** 3D/2D art assets, recorded audio, Firebase/AdMob SDK integration
  (requires credentials and a store account).

## Legal / IP

All content is original. No assets, names or mechanics are copied from Cooking Fever,
Overcooked, Cooking Madness or any other title. Regional Brazilian cuisine references are
researched and treated respectfully (see `shared/data/regions.json`).
