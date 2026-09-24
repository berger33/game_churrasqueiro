# 00 — Specification Audit

Audit of the 117-point brief, performed before any implementation. This document records
**dependencies, conflicts, risks and decisions** — including the places where the brief
could not be satisfied as literally written.

---

## 1. Verdict

The brief describes a **live-service mobile F2P title with a multi-year content plan**. It is
internally consistent and, unusually, its priorities are stated explicitly (§114: fun →
retention → stability → experience → monetization → content). That ordering is respected
everywhere in this project.

What the brief does *not* contain, and what had to be decided here:

| Gap | Decision | Rationale |
|---|---|---|
| No numeric economy values | Derived from a simulator, not guessed | §20 explicitly demands a simulator; guessing would violate it |
| No definition of "perfect" | A doneness interval per ingredient, plus a side-evenness gate | Makes flipping mechanically necessary instead of decorative |
| No FTUE script | Written in [05-UX_FLOW.md](05-UX_FLOW.md) | §40/§41 require it but do not specify it |
| No difficulty model | Difficulty = spawn rate × patience × order size | Three orthogonal knobs are tunable remotely without new mechanics |
| No definition of "done" | Feature-complete = functional + visual + audio + analytics + tested + documented (§81) | Used as the acceptance gate in QA.md |

---

## 2. Dependency graph (critical path)

```
Data layer (JSON schema)
   ├─> Reference rules (sim-core) ──> Balance simulator ──> ECONOMY targets
   ├─> Unity Sim port ──────────────> Gameplay scene
   └─> Level generator ─────────────> Authored content

Art direction (style bible)
   └─> Food shader ──> Food models ──> Character rig ──> Environments
        (must exist before any asset is produced in volume — §83)

Services
   ├─ Firebase (Analytics/RemoteConfig/Crashlytics)  ← needs google-services.json
   ├─ AdMob (UMP + rewarded + interstitial)          ← needs an AdMob app id
   └─ Play Billing                                   ← needs a Play Console listing
```

**Critical path:** data layer → cooking model → food shader → vertical slice.
Everything else (LiveOps, monetization, collection, route) hangs off that spine and can be
built in parallel once it exists.

**Hard external blockers** (cannot be resolved inside this repository):

1. A Google Play Console developer account — required for package name, signing key,
   Play Billing product ids and internal testing tracks.
2. A Firebase project — `google-services.json` is a credential and must never be committed.
3. An AdMob account — real unit ids are configuration, not code.
4. A Unity Editor install — required to compile and run the C# client.

A `secrets.example.json` contract and a `SecureConfig` loader are provided so these slot in
without code changes.

---

## 3. Conflicts found in the brief, and how they were resolved

### 3.1 §6 "tolerância de cocção" vs §1 "5 a 10 seconds to learn"

A per-ingredient tolerance plus five doneness states plus heat zones plus flipping is a lot
of simultaneous information. **Resolution:** the tutorial teaches exactly one variable at a
time (drag → flip → serve). Zone choice is only introduced from turn 6, and specific-doneness
requests only appear from restaurant 2 onward (`customer.allowsSpecificDoneness`).

### 3.2 §17 automation vs §1 "hard to master"

Employees that auto-flip and auto-serve would delete the skill game.
**Resolution:** hard automation caps in `employees.json`:

```json
"automationCap": { "autoFlipMaxCoverage": 0.6, "autoServeMaxCoverage": 0.5,
                   "neverAutomates": ["zone_choice", "perfect_timing_call"] }
```

Automation raises the *floor*, never the *ceiling*. The player's own timing always beats the
staff, which keeps the skill layer alive into the idle phase.

### 3.3 §34 "rewarded first" vs §36 "interstitial"

Rewarded-first monetization is incompatible with aggressive interstitials.
**Resolution:** interstitials are restricted to one placement (`turn_result_to_lobby_only`),
probability-gated at 0.6, capped at 3 per session and 8 per day, suppressed for the first 6
turns and first 2 sessions, and suppressed for 24 h after any IAP and 10 min after any
rewarded view. All of this is Remote-Config driven (`shared/data/ads.json`).

### 3.4 §29 "50 achievements" vs §84 "30+ achievements for MVP"

**Resolution:** 57 are shipped in data (exceeds both), and the runtime system is generic over
the counter namespace, so hundreds more need no code.

### 3.5 §2 "Unity 6.3 LTS"

Unity does not publish a "6.3 LTS" at the time of writing; the current LTS line is Unity 6.
**Resolution:** `ProjectSettings/ProjectVersion.txt` targets **Unity 6 LTS (6000.x)** and
[12-BUILD.md](12-BUILD.md) records the exact editor version to pin. The architecture uses
nothing version-specific, so a different 6.x LTS patch costs nothing.

### 3.6 §64 "Addressables only if justified"

**Resolution:** *not* used for MVP. Content volume is small enough that AssetBundles add cost
without benefit. Addressables are scheduled for V1.1 when seasonal content starts shipping
per-event, with the trigger condition documented in [03-TECH_DESIGN.md](03-TECH_DESIGN.md).

---

## 4. Risks

| # | Risk | Impact | Mitigation |
|---|---|---|---|
| R1 | Cooking does not feel satisfying | Fatal — it is the whole product | Proven first, in isolation, before any meta system (milestone **PLAYABLE CORE**) |
| R2 | Economy inflates | Retention collapse | Simulator guardrails fail the build; two exponential blow-ups were already caught and fixed (see [06-ECONOMY.md](06-ECONOMY.md)) |
| R3 | Art looks AI-generated / asset-flip | Store rejection by players, not by Google | Style bible before assets; one material system for all food; no mixed styles |
| R4 | Low-end device performance | Uninstalls in the BR mid-range | 3 quality levels, 70 draw call budget on LOW, particle multipliers, sampled FPS telemetry |
| R5 | Regional content reads as stereotype | Brand damage | Each region gets equal depth and researched specifics (`regions.json`), reviewed against §23 |
| R6 | SDK bloat pushes APK over budget | Install conversion drops | Budget 90 MB AAB base; SDKs added one at a time with a size gate |
| R7 | Reward duplication / save editing | Economic damage | Single-use reward tokens, checksummed dual-slot save, clock-tamper detection |
| R8 | C# port drifts from the verified rules | Silent balance breakage | Golden vectors + parity test |

---

## 5. Scope decisions for the commercial MVP (§84)

Shipped in data and rules:

- 2 establishments playable (Quintal, Espetinho de Rua); 7 defined in data
- 16 ingredients (brief asks for 12)
- 11 customer archetypes (brief asks for 8+), incl. VIP
- 60 authored turns (brief asks for 50–80)
- 27 upgrade tracks (brief asks for 20+)
- 57 achievements (brief asks for 30+)
- 3 daily + 3 weekly missions, 4 recurring weekly events, 7 seasonal events
- Rewarded placements ×8, interstitial ×1, IAP ×7
- Full analytics taxonomy, Remote Config defaults, save system, settings, tutorial, pt-BR

Deliberately **not** in MVP, with the reason recorded (§113 — never silently reduced):

| Feature | Status | Reason |
|---|---|---|
| Real-time multiplayer | Not started | §105 explicitly defers it; architecture keeps leaderboards asynchronous |
| Cloud save | Deferred to V1.1 | Needs a backend; local save is checksummed and dual-slotted meanwhile |
| Server-side ad verification | Deferred | Requires a backend; `ads.json` has the flag ready |
| iOS build | Architecture ready | §2 makes Android the priority; no iOS-specific code paths exist yet |
| Regions 3–5 content (Centro-Oeste, Norte) | Data only | Needs researched ingredient art; `regions.json` reserves the slots |

---

## 6. First milestone definition (§116)

**PLAYABLE CORE** — one executable experience containing: grill, heat, linguiça, picanha,
visual cooking, flip, order, customer, serve, evaluation, coins, perfect, error, sound, VFX.

This is implemented as the **design-verification prototype** (`prototype/`) running the real
`sim-core` rules, plus the Unity scene assembly described in
[03-TECH_DESIGN.md](03-TECH_DESIGN.md). The prototype exists because the sandbox has no Unity
Editor; it is the fastest possible way to answer the only question that matters at this
stage — *is the grill fun?* — and it is built on the same rules the client will use.
