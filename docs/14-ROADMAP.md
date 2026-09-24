# 14 — Roadmap (§86)

Each version has explicit exit criteria. A version is not done until they are met.

## V0.1 — Prototype ✅ *(this repository)*
**Goal:** prove the grill is fun.
- [x] Data layer, cooking model, scoring, economy, save, level generator, balance simulator
- [x] Playable core running the real rules (`prototype/`)
- **Exit:** skill curve spans 26 % → 98 % perfect; a mid-skill player lands ~48 % perfects.

## V0.2 — Core Loop
**Goal:** the turn, end to end, in Unity.
- [ ] Unity project compiles; `Sim` port passes `SimParityTests`
- [ ] Grill scene with drag / flip / serve / zones / charcoal
- [ ] Orders, customers, patience, combo
- **Exit:** a 90-second turn is completable on a physical mid device at 60 FPS.

## V0.3 — Vertical Slice
**Goal:** one experience at final quality — the visual bar for everything after it.
- [ ] Food shader with real textures; grill marks; smoke; fat
- [ ] One character rig, 3 variants, 8 animations
- [ ] Quintal scene fully dressed
- [ ] Final UI kit, audio pass, haptics
- **Exit:** a stranger plays it and says it looks like a released game.

## V0.4 — Meta
- [ ] Home as a 3D establishment; upgrades physically change the scene
- [ ] Progression, missions, achievements, collection, route
- [ ] Save/load, settings, localisation (pt-BR)
- **Exit:** a 30-minute session has goals at the minute, hour and day horizons.

## V0.5 — Monetization
- [ ] UMP consent, AdMob rewarded ×8 + interstitial ×1 with caps
- [ ] Play Billing, 7 products, restore, validation, pending reconcile
- [ ] Starter Pack timing rules
- **Exit:** test purchases and rewarded flows verified on a physical device; no real ids in git.

## V0.6 — Analytics
- [ ] Firebase Analytics + Remote Config + Crashlytics
- [ ] Full taxonomy enforced at runtime; dashboards built
- **Exit:** the §60 funnel is answerable from live data.

## V0.7 — Content
- [ ] 60 authored turns, 16 ingredients, 11 customers, 57 achievements
- [ ] Establishment 2 complete; weekly + one seasonal event
- **Exit:** MVP content complete per §84.

## V0.8 — Polish
- [ ] All placeholders replaced (§82)
- [ ] Accessibility pass, colour-blind mode, reduce motion
- [ ] Performance pass on the LOW device tier
- **Exit:** no placeholder assets; performance gates met.

## V0.9 — Soft Launch
- [ ] Closed track, 300–1 000 BR users
- **Exit:** D1 ≥ 40 %, D7 ≥ 12 %, crash-free ≥ 99.3 %, tutorial completion ≥ 85 %.

## V1.0 — Production
- [ ] Open rollout 5 % → 100 %, ASO live, UA creatives shipping
- **Exit:** sustained KPIs at green for 14 days.

## V1.1+ (§85)
Third establishment · new ingredients · expanded collection · first full season ·
cloud save · Addressables · tablet layout · regions 3–5 content.
