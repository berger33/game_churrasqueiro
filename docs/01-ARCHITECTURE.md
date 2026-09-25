# 01 — Architecture

## 1. Principles

1. **Data over code.** Every tunable number lives in `shared/data/*.json`. C# reads it.
   A designer changes balance without a build, and Remote Config can override any of it.
2. **One implementation of the rules.** Cooking, scoring and economy exist once in
   `tools/sim-core` (TypeScript, verified) and once as a port in `Assets/Scripts/Sim`
   (C#, deterministic, no `UnityEngine` dependency). Parity is asserted by golden vectors.
3. **Strict dependency direction.** Nothing depends "upward". Enforced by Unity assembly
   definitions, so a violation is a *compile* error, not a review comment.
4. **No global mutable state.** Systems are plain classes behind interfaces, composed at
   startup by a single `GameBootstrap`.
5. **Offline first.** No gameplay path awaits the network. Services initialise asynchronously
   and never block the first frame.

## 2. Dependency direction

```
            ┌──────────────────────────────────────────┐
   Layer 4  │  UI · Screens · HUD · Tutorial views      │
            └───────────────────┬──────────────────────┘
            ┌───────────────────▼──────────────────────┐
   Layer 3  │  Presentation: GrillView · FoodView ·     │
            │  CharacterView · VfxDirector · AudioBus   │
            └───────────────────┬──────────────────────┘
            ┌───────────────────▼──────────────────────┐
   Layer 2  │  Gameplay services: TurnDirector ·        │
            │  OrderService · CustomerService ·         │
            │  ProgressionService · MissionService ·    │
            │  EventService · CollectionService         │
            └───────────────────┬──────────────────────┘
            ┌───────────────────▼──────────────────────┐
   Layer 1  │  Sim (pure): GrillSimulator · Scoring ·   │
            │  Economy · SaveGame · Rng                 │   ← no UnityEngine
            └───────────────────┬──────────────────────┘
            ┌───────────────────▼──────────────────────┐
   Layer 0  │  Platform: DataRepository · SecureConfig ·│
            │  AnalyticsProvider · AdsProvider ·        │
            │  IapProvider · RemoteConfigProvider ·     │
            │  SaveStore · HapticsProvider · Localizer  │   ← interfaces + adapters
            └──────────────────────────────────────────┘
```

Rule: a layer may reference the layers below it, never above or beside it. `Sim` and
`Platform` know nothing about each other; `Gameplay` glues them.

## 3. Module map (§3 of the brief)

| Module | Assembly | Responsibility | Owns |
|---|---|---|---|
| **GameCore** | `Churrasco.Core` | Bootstrap, service locator-free DI, scene flow, event bus, object pooling | `GameBootstrap`, `ServiceRegistry`, `EventBus`, `Pool<T>` |
| **Gameplay** | `Churrasco.Gameplay` | Turn lifecycle, input routing, camera, HUD binding | `TurnDirector`, `InputRouter` |
| **Cooking** | `Churrasco.Sim` | Doneness integration, flipping, burning, staging | `GrillSimulator`, `FoodRuntime` |
| **Grill** | `Churrasco.Sim` | Zones, slots, charcoal lifecycle, heat resolution | `GrillRuntime`, `CharcoalModel` |
| **Ingredients** | `Churrasco.Data` | Ingredient table access, unlocks, mastery data | `IngredientRepository` |
| **Customers** | `Churrasco.Gameplay` | Archetype selection, patience, reactions, VIP | `CustomerService`, `PatienceModel` |
| **Orders** | `Churrasco.Gameplay` | Order generation, matching, completion | `OrderGenerator`, `OrderService` |
| **Progression** | `Churrasco.Meta` | XP, levels, restaurant unlocks, upgrades | `ProgressionService` |
| **Economy** | `Churrasco.Sim` | Currencies, pricing, tips, idle, ledger | `EconomyService`, `Ledger` |
| **Employees** | `Churrasco.Meta` | Hiring, levels, capped automation | `EmployeeService` |
| **Restaurants** | `Churrasco.Meta` | Establishment state, visual upgrade tiers | `RestaurantService` |
| **Inventory** | `Churrasco.Meta` | Raw stock, prep slots, boosters | `InventoryService` |
| **Collections** | `Churrasco.Meta` | Livro do Mestre, entries, mastery medals | `CollectionService` |
| **Achievements** | `Churrasco.Meta` | Counter-namespace driven, data-defined | `AchievementService` |
| **DailyChallenges** | `Churrasco.LiveOps` | Daily/weekly missions, reroll, streak | `MissionService`, `DailyRewardService` |
| **Events** | `Churrasco.LiveOps` | Weekly + seasonal events, modifiers | `EventService` |
| **LiveOps** | `Churrasco.LiveOps` | Season/pass, route, leaderboards (async) | `PassService`, `RouteService` |
| **Ads** | `Churrasco.Monetization` | Placement policy, caps, reward tokens | `AdService`, `RewardTokenVault` |
| **IAP** | `Churrasco.Monetization` | Catalogue, purchase, restore, validation | `StoreService`, `PurchaseValidator` |
| **Analytics** | `Churrasco.Platform` | Typed event API, taxonomy enforcement, batching | `AnalyticsService` |
| **SaveSystem** | `Churrasco.Platform` | Versioned, checksummed, dual-slot, migration | `SaveService`, `SaveSerializer` |
| **Audio** | `Churrasco.Presentation` | Pools, buses, ducking, one-shot scheduling | `AudioDirector` |
| **VFX** | `Churrasco.Presentation` | Pooled particle systems, quality gating | `VfxDirector` |
| **UI** | `Churrasco.UI` | Design system, screens, transitions | `DesignSystem`, `Screen` |
| **Localization** | `Churrasco.Platform` | Table lookup, pluralisation, fallback | `Localizer` |
| **RemoteConfig** | `Churrasco.Platform` | Fetch, defaults, typed accessors, kill switches | `RemoteConfigService` |
| **Tutorial** | `Churrasco.Gameplay` | Contextual steps, masking, completion | `TutorialDirector` — reference rules in `tools/sim-core/src/tutorial.ts`, script in `shared/data/tutorial.json` (docs/05 §4) |
| **Notifications** | `Churrasco.Platform` | Scheduling, opt-out, dedupe | `NotificationService` |
| **CloudServices** | `Churrasco.Platform` | Optional backend seam (deferred) | `ICloudSave`, `ILeaderboardBackend` |

## 4. Data flow

```
shared/data/*.json
   │  (npm run sync-data)
   ▼
Assets/Data/*.json ──► DataRepository.Load() ──► GameDatabase (indexed maps)
                                                    │
                       RemoteConfigService ─────────┤  overrides at runtime
                                                    ▼
                                              Derived stats
                                                    │
                     ┌──────────────────────────────┼───────────────────────────┐
                     ▼                              ▼                           ▼
              GrillSimulator.Tick()          OrderGenerator            EconomyService
                     │                              │                           │
                     └────────────► TurnDirector ◄──┴───────────────► Ledger ───┘
                                        │
                     ┌──────────────────┼──────────────────────┐
                     ▼                  ▼                      ▼
               Presentation        AnalyticsService        SaveService
```

`RemoteConfigService` never edits the loaded tables; it produces an **override layer** that
`Derived stats` reads through. That keeps the shipped defaults intact when offline and makes
every remote change auditable in one place.

## 5. Event bus

A typed, allocation-light bus (struct payloads, no boxing) carries cross-module signals:

```
TurnStarted · TurnEnded · FoodPlaced · FoodFlipped · FoodBurned · FoodServed
OrderSpawned · OrderCompleted · OrderFailed · CustomerLeft · ComboChanged
CharcoalLow · CharcoalRefilled · CurrencyChanged · LevelUp · RestaurantUnlocked
UpgradePurchased · AchievementUnlocked · CollectionUnlocked · MissionProgress
EventStarted · EventCompleted · AdShown · AdRewarded · PurchaseCompleted
```

Presentation and analytics subscribe; gameplay never calls them directly. This is what keeps
§81 ("feature done = visual + audio + analytics") mechanically enforceable: a new gameplay
event without a presentation and analytics subscriber is visible in one grep.

## 6. Object pooling

Pooled: food instances, characters, plates, coins, smoke/ember/spark particles, floating
score text, order cards. Pools are pre-warmed during scene load with counts from
`performance.json` × quality-level multiplier. Rule: **no `Instantiate` during a turn.**
A QA test asserts zero allocations in the hot path (see [11-QA.md](11-QA.md)).

## 7. Threading

All simulation runs on the main thread — the workload is tiny (≤ 24 food items, ≤ 6
customers) and determinism matters more than throughput. `SaveService` serialises on a
worker thread and writes atomically. Remote Config and Ads initialise on their own threads
and publish results back through the bus.

## 8. Testability seams

| Seam | Interface | Fake used in tests |
|---|---|---|
| Time | `ITimeSource` | `FakeClock` (drives offline/idle and streak tests) |
| Persistence | `ISaveStore` | `MemorySaveStore` (corruption & dual-slot tests) |
| Ads | `IAdsProvider` | `StubAdsProvider` (cap and dedupe tests) |
| IAP | `IIapProvider` | `StubIapProvider` (failure, restore, double-grant tests) |
| Analytics | `IAnalyticsProvider` | `RecordingAnalytics` (taxonomy assertions) |
| Remote Config | `IRemoteConfigProvider` | `MapRemoteConfig` (kill-switch tests) |
| Randomness | `Rng` | Fixed seeds → golden vectors |

## 9. What is deliberately *not* abstracted

- **The cooking model.** One implementation, ported once. No strategy pattern, no plugins.
- **Screens.** A small `Screen` base class, not a MVVM framework. Unity UI + a design system
  is enough; a framework would cost more than it saves at this scale.
- **ECS/DOTS.** Not used. The entity count is in the tens, and DOTS would complicate the
  art pipeline and the port. Revisit only if the festival scene needs hundreds of characters.
