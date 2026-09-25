# 03 — Technical Design

## 1. Engine and packages

| Choice | Value | Why |
|---|---|---|
| Editor | Unity 6 LTS (6000.x) — pin the exact patch in `ProjectSettings/ProjectVersion.txt` | §2 asks for the current stable LTS. "6.3 LTS" is not a published line; the architecture uses nothing version-specific |
| Render pipeline | **URP** | Mobile-first, SRP Batcher cuts draw calls, mature and actively maintained — not experimental |
| Input | Input System (touch only) | Required for reliable multi-touch and gesture thresholds |
| UI | uGUI + a custom design system | UI Toolkit is not yet ideal for a gameplay-heavy portrait title |
| Addressables | **Not used for MVP** | Content volume is small; revisit at v1.1 when seasonal content ships per event |
| Ads | AdMob (mediation-ready) | Free, standard in BR, bidding-ready |
| Backend | Firebase Analytics / Remote Config / Crashlytics | Free tier covers soft launch (§97) |
| Billing | Google Play Billing Library v7 | Only sanctioned path on Play |

`Packages/manifest.json` pins every package to an exact version. No `latest`.

## 2. Assembly layout

```
Churrasco.Platform      (asmdef, no refs)          interfaces + adapters
Churrasco.Sim           (asmdef, no UnityEngine)   rules port — mirrors tools/sim-core
Churrasco.Data          (asmdef → Platform)        repositories over the JSON tables
Churrasco.Gameplay      (asmdef → Sim, Data, Platform)
Churrasco.Meta          (asmdef → Gameplay)
Churrasco.LiveOps       (asmdef → Meta)
Churrasco.Monetization  (asmdef → Platform, Meta)
Churrasco.Presentation  (asmdef → Gameplay)
Churrasco.UI            (asmdef → Presentation, Meta, LiveOps, Monetization)
Churrasco.Bootstrap     (asmdef → everything)      composition root only
Churrasco.EditorTools   (asmdef, Editor only)      balance/level inspectors
Churrasco.Tests         (asmdef, Test only)        EditMode + PlayMode
```

A circular dependency between any two of these is a **compile error**, not a review comment.

## 3. The Sim port

`Assets/Scripts/Sim/` is a line-by-line port of `tools/sim-core/src/`:

| TypeScript | C# |
|---|---|
| `rng.ts` → `Rng` | `Sim/Rng.cs` (mulberry32, identical bit ops) |
| `cooking.ts` → `tickGrill` | `Sim/GrillSimulator.Tick(float dt)` |
| `cooking.ts` → `scoreItem` | `Sim/Scoring.Score(...)` (struct in, struct out) |
| `data.ts` → `upgradeCost`, `xpForLevel`, `sampleCurve` | `Sim/EconomyMath.cs` |
| `save.ts` → `crc32`, `stableStringify`, `migrate` | `Sim/SaveSerializer.cs` |
| `turn.ts` → `TurnSimulation` | `Sim/TurnSimulator.cs` |

Rules for the port:

- **No `UnityEngine` reference.** `Sim` must compile in a plain .NET context so it can be
  unit-tested without the Editor.
- **`float` arithmetic in the documented order.** The golden vectors are generated with
  doubles in TS; the C# port uses `double` for doneness accumulation to keep parity, and
  `float` only for rendering.
- **No allocations in `Tick`.** No LINQ, no closures, no boxing, pre-sized arrays.

### Golden vectors

`tools/studio/golden.test.ts` writes deterministic fixtures to `tools/sim-core/golden/`:

```json
{ "seed": 20260917, "levelId": "level_012", "dt": 0.05,
  "expected": { "coins": 812, "xp": 63, "perfect": 7, "burned": 1, "bestCombo": 6,
                "donenessSamples": [0.0, 0.163, 0.327, ...] } }
```

The Unity EditMode test `SimParityTests` replays the same seeds and asserts the same outputs.
If the C# drifts, the test names the first divergent tick. **This is the mechanism that stops
the verified rules and the shipped rules from becoming two different games.**

**What runs today** (no Unity needed): `npm run gen-vectors` writes `tools/golden/vectors.json`
(cooking, scoring, economy, full turns) and `tools/golden/tutorial-vectors.json` (the FTUE), and
`npm run check-csharp` — a CI gate — builds `Assets/Scripts/Core` as netstandard2.1 / C# 9 and
replays them with `tools/csharp/parity` to 1e-9. Vectors for code that has no C# port yet
(`EconomyRules.cs`, `TurnSimulation.cs`) are reported as not ported. Two porting rules the
first run taught: round with `MathUtil.RoundHalfUp` (JavaScript's `Math.round`), never
`Math.Round` (halves to even); and the generated table classes need case-insensitive binding
(Newtonsoft's default; `PropertyNameCaseInsensitive` in System.Text.Json).

## 4. Frame budget

Target 60 FPS on HIGH/MEDIUM, 30 FPS on LOW (§2).

| Budget | HIGH | MEDIUM | LOW |
|---|---|---|---|
| Draw calls | 180 | 120 | 70 |
| Tris/frame | 250 k | 250 k | 250 k |
| GC per frame | ≤ 1 KB | ≤ 1 KB | ≤ 1 KB |
| Particle multiplier | 1.0 | 0.7 | 0.35 |
| Resolution scale | 1.0 | 0.9 | 0.75 |
| Shadows | soft | hard only | off |
| Dynamic lights | 5 | 3 | 1 |

Quality is auto-detected by sampling FPS for the first 3 s, with 5 FPS of hysteresis so it
cannot oscillate. The user can override; `performance_sample` telemetry (1-in-20 sessions)
reports the distribution.

**Gameplay must be identical on all three.** Quality levels change presentation only — the
simulation is the same code path.

## 5. Load path (§66)

```
App start
 ├─ sync: PlayerPrefs → in-memory settings            (< 20 ms)
 ├─ sync: splash + first scene load                   (< 1.5 s)
 ├─ sync: DataRepository.Load() from StreamingAssets  (< 150 ms, cached binary)
 └─ async, non-blocking:
      RemoteConfig fetch (8 s timeout, defaults used meanwhile)
      Firebase Analytics / Crashlytics init
      UMP consent → AdMob init → ad preload
```

No service may block the first frame. If Remote Config has not returned, the shipped defaults
are already in memory and the game is fully playable.

`DataRepository` reads the JSON once, parses it into indexed maps, then caches a binary blob
so cold start after the first run is faster still.

## 6. Save system (§57, §58)

- Envelope `{ v, crc, payload }`, CRC-32 over a **stably serialised** payload (sorted keys) so
  the checksum is reproducible across engines and cultures.
- **Two slots written alternately**; the newest valid one wins. Survives a crash mid-write.
- Migration is forward-only and never throws — a missing block falls back to defaults.
- Autosave: on turn end, on purchase, on app pause, and every 60 s.
- `deviceClockUnixSec` is stored; a backwards jump > 60 s is flagged
  (`detectClockTampering`) and offline earnings are clamped instead of granted.
- Cloud save seam exists (`ICloudSave`) but is not implemented — see
  [00-SPEC_AUDIT.md](00-SPEC_AUDIT.md#5-scope-decisions-for-the-commercial-mvp-84).

Schema history (`SAVE_SCHEMA_VERSION` = 3):

| Version | Adds | Migration from the previous version |
|---|---|---|
| v2 | `player.churrasqueiraId`, `player.churrasqueiraLevels` | grants the starter `lata_valente` at level 1 |
| v3 | `progress.tutorial` (`TutorialState \| null`), `progress.ftueDone` | the FTUE counts as done — a pre-v3 save belongs to someone who already played (05-UX_FLOW §4.3) |

All of this is implemented and unit-tested in `tools/sim-core/src/save.ts`; the C# port is
`Assets/Scripts/Platform/SaveService.cs`.

## 7. Security (§58)

| Threat | Mitigation |
|---|---|
| Save editing | CRC + dual slot; premium entitlements re-validated against Billing on launch |
| Clock manipulation | stored device clock + drift detection; offline earnings clamped |
| Duplicate rewarded reward | single-use reward token with a 1 h TTL, max one in-flight callback, mismatch logged |
| Fake IAP | Play Billing `queryProductDetails` + acknowledgement; purchase not granted until acknowledged; `pending` flag when offline |
| Client-side trust | premium rewards are the only thing that needs server trust — flagged `serverSideVerification: false` with the enablement path documented |

No heavy anti-cheat before there is a reason (§58).

## 8. Performance engineering

- Object pools for food, characters, plates, coins, particles, floating text. **No
  `Instantiate` during a turn** — asserted by a PlayMode test.
- One texture atlas per UI category; `SpriteAtlas` with tight packing; ASTC 6×6 for Android.
- SRP Batcher for all scene materials; GPU instancing for embers.
- Food uses one material with per-instance property blocks — no material instances.
- Audio: pooled `AudioSource`s, one per simultaneous voice, capped at 12.
- Async scene loading with a loading card; no synchronous `Resources.Load` in gameplay.

## 9. Determinism and testing seams

See [01-ARCHITECTURE.md](01-ARCHITECTURE.md#8-testability-seams). Every service that touches
the outside world is behind an interface with a fake. This is what allows the QA suite to test
offline behaviour, clock changes, ad failures and purchase failures without a device.

## 10. Known technical risks

| Risk | Plan |
|---|---|
| C# port drift | golden vectors + `SimParityTests` |
| Low-end thermal throttling during long turns | cap turn length at 180 s; quality auto-step down on sustained < 25 FPS |
| APK size growth per SDK | size gate in CI; each SDK added one at a time with a measured delta recorded in [12-BUILD.md](12-BUILD.md) |
| UI layout on 18:9 → 21:9 and tablets | safe-area driven layout, anchored HUD, no absolute positioning; tablet layout is a v1.1 stretch |
