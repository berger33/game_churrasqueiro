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

### A-02 reference contract — required player progression

`TurnConfig.playerLevel` is required and validated (integer >=1), distinct from campaign
`levelId/index`. The turn snapshots a catalog requiring both level and restaurant. Orders,
stock actions and UI use that catalog; scripted orders also reject locked ingredients.
Empty catalogs fail explicitly. Natural unusual-only customers are filtered when their
eligible menu is empty; forcing one without a menu errors, never grants locked content.

Production callers: progression p.level before payout, prototype meta.level, scripted FTUE1.
Skill benchmarks start at1 and accrue actual XP per skill; isolated mechanics fixtures use44
explicitly, not as a runtime default. Boundary/wiring regressions are in
`ingredient-unlock.test.ts` and `unlock-wiring.test.ts` (52 new tests).

`tools/golden/vectors.json` **version2** requires playerLevel in all20 turn inputs:9 early
expectations changed,11 preserved; cooking/scoring/economy and all44 FTUE cases unchanged.
No game-data/schema/save version changed. C# still lacks25 cases (5+20); port this contract
and F2/A-01/A-02 regressions in F8, not just old golden outputs. Global economy still fails
3 long targets, so C#/Unity remain blocked. See `docs/evidence/a02/README.md`.

### A-01 reference contract — historical checkpoint (2026-09-26 local / 27 UTC)

Costela/cupim are two-sided, `flipNeeded:true` (ingredients v6, owner decision).
The TS semantic validator rejects multi-side grill recipes with `flipNeeded:false`;
`SkillPolicy` already consumes the flag, so no bot formula changed. Use real cooking
integration/advanced bot tests in `tools/studio/test/slow-cuts.test.ts` when porting.
Normal UI uses the existing FTUE flip-readiness rule, recipe flag and an eight-item
bench pager; the guided FTUE contract is unchanged.

Golden coverage is **106 + 44 FTUE**: all old expectations intact, eight new advanced
turns (restaurants 3–6, two skill levels, equipped Fornalha evo 3). Full-turn inputs now
optionally carry `churrasqueiraId/Level`; advanced expectations include observed per-cut
usage retained across runtime compaction, with serves identified by order fulfillment
(not the `served` flag, also used by discard). C# has **25 unported cases** (5 economy +
20 turns), plus F2 save/result/counting regressions to port. No C# rule port was attempted.
Long-sim economic acceptance fails 3 targets; F8 remains blocked until F3/F4 stabilization.
See `docs/evidence/a01/README.md` for exact scopes and proofs.

### Golden vectors

`tools/studio/gen-vectors.ts` writes deterministic fixtures to `tools/golden/`;
`tools/studio/test/golden.test.ts` replays them:

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

Schema history (`SAVE_SCHEMA_VERSION` = 4 in the TS reference):

| Version | Adds | Migration from the previous version |
|---|---|---|
| v2 | `player.churrasqueiraId`, `player.churrasqueiraLevels` | grants the starter `lata_valente` at level 1 |
| v3 | `progress.tutorial` (`TutorialState \| null`), `progress.ftueDone` | the FTUE counts as done — a pre-v3 save belongs to someone who already played (05-UX_FLOW §4.3) |
| v4 | `player.vip` ledger/quota/reservation/claims | initialize missing v3 ledger; preserve wallet/FTUE/CRC; malformed current-v4 ledger blocks VIP |

**F2 reference contract (A-07):** after checking the original CRC, load/migrate recomputes
`player.counters.restaurantsUnlocked = player.restaurantIndex + 1` on v1/v2/v3 saves,
including saves written by the faulty v3 build. This is derived-state normalization, not a
schema-shape change: version stayed3 at F2 (A-05 later adds v4); other counters and already-claimed rewards are preserved.
Historical `burnedFood` cannot be repaired without a per-item journal and is not rewritten.
SaveGame persists player/progress, **not** an in-flight TurnSimulation.

The envelope/migrations above are implemented and tested in `tools/sim-core/src/save.ts`.
Dual-slot storage/cloud/Unity integration remain specifications; the planned engine-free
`Assets/Scripts/Core/SaveSystem.cs` port is not written yet (see docs/18).

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


## 11. Implemented TS prep contract (A-03, 2026-09-27)

`TurnSimulation.takeFromStock` creates an inert portion. `startPrep(food, slotIndex?)`
validates turn ownership, recipe and a free slot, then admits it once. `prepSlots` retain
preparing/ready portions until a successful serve or discard; no implicit queue.
Only admitted slots tick at `dt * prepSpeedMult / prepSec`, clamped to1. `TurnActions`
exposes admission and free capacity to the policy; normal public place actions reject prep.
`serve` requires station membership and progress1 before shared scoring/payout.

The web UI uses shared prep rectangles for drawing/pointer input and read-only harness
snapshots; stock cancellation removes unadmitted food, ready cancellation keeps its slot.
This is a **TS/web contract**, not a Unity implementation or save-of-active-turn feature.
Low-level generic cooking primitives/C# vectors are unchanged; port station semantics with
TurnSimulation in F8 after global TS/economic stabilization. Evidence: `evidence/a03/`.


## 12. Implemented TS fourth-zone contract (A-04, 2026-09-27)

`GrillZone.auxiliaryOf` identifies appended capacity without changing the primary thermal
profile. `ChurrasqueiraDef.restaurantExpansion` declares the joint hardware/restaurant
requirement. `churrasqueiraZoneCount` resolves it before grill creation; heat patching must
retain the resolved count. `runtimeZoneDefinition` is shared by heat/bonus/UI labels;
`runtimeZoneIndex` remaps primary IDs on1/2/3, returns-1 for locked auxiliary IDs.

`createGrill` rejects unsupported counts; the generic2-zone constructor now consistently
uses low/high (equipped2-zone gameplay already did). Auxiliary heat/upgrade weight comes
from the primary source, not from being the last row. No silent clamping/stretching.
Validators and negative fixtures protect both new contracts. Generated schemas/DTOs/data
copies are synchronized, but **C# rule consumption is deferred** along with full-turn parity.

`LevelOutcome.grillSnapshot` exposes actual equipment/evolution/count/heat/capacity and
post-policy occupied ticks by zone. This revealed why the unchanged long report does not
measure use of the extra row. Browser harness hooks remain read-only snapshots; actual
pointer events drive placement/move/flip/serve. No Unity scenes or active-turn save added.

## 13. VIP reference contract (A-05, 2026-09-27 UTC)

`vip.ts` is a narrow consumer of events/ads/achievements, not full services for those systems.
Production callers pass a shared `player.vip`/`Meta.vip` ledger and injected Unix clock in
`TurnConfig.vip`; standalone fixtures default to epoch0/new ledger. RNG uses separate salt
0x71f5. No draw when blocked/full/capped/zero or consuming a reservation. Default campaign
clock starts2026-09-21 UTC,12 turns/day; caller snapshots expose actual visits/quota/sources.

Save reference **v4** adds VIP day/used/calls/cooldown/clock high-water mark/sequence/offer/
reservation/served/claimed achievements. V3 absence migrates empty without changing wallet,
FTUE or progress; invalid/missing current-v4 ledger fails closed. CRC/envelope and slot logic
remain. Browser retains its separate Meta/localStorage save, not the CRC format. Callback
matches a single persisted offer token, expires in1h and grants at most once. Reservation
is already earned, so has no TTL; carries quota forward until admitted. Quota is charged
before turn result, including lost/abandoned visits. Complete-turn payout handles achievements.

Only `vipServed` achievements have a consumer now; future general achievement service must
consult/migrate `vip.claimedAchievements`. No blanket achievement implementation. Clock
rollback is bounded, but local state/clock are not trusted server proofs. No ad SDK/SSV,
network analytics or anti-fraud guarantees. C# SaveSerializer remains unported to v4.

Golden114+44:8 extra full-turn contracts,20 old outcomes unchanged+zero VIP counters;
44 FTUE payloads unchanged, analytics version metadata6. Current C# runner will enumerate
33 unported cases (5 economy+28 turns); not run without .NET. DTO generation alone is not
VIP or save parity. Price/recipe/heat/level generator behavior did not change.
