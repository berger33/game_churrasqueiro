# 13 — Release

## 1. Store listing (§68, §69)

| Field | Value |
|---|---|
| Title | `CHURRASCO! O Mestre da Brasa` (30 chars) |
| Short description | see [15-ASO.md](15-ASO.md) — 3 variants |
| Category | Games › Casual |
| Content rating | questionnaire → likely Everyone/Livre |
| Ads | Contains ads (rewarded + interstitial) |
| IAP | R$ 4,90 – R$ 49,90 |
| Data safety | see [16-PRIVACY.md](16-PRIVACY.md) |
| Target audience | 13+ (avoids the Families policy overhead while staying casual) |

Required assets: 512×512 icon, 1024×500 feature graphic, 2–8 phone screenshots (16:9 or 9:16),
privacy policy URL, contact email.

## 2. Tracks

```
internal  (≤ 100 testers, team + friends)
   ↓  crash-free > 99 %, tutorial completion > 80 %
closed    (300–1 000, BR only)          ← SOFT LAUNCH (§89)
   ↓  D1 ≥ 40 %, D7 ≥ 12 %, ARPDAU ≥ R$ 0,03, crash-free ≥ 99.3 %
open      (staged 5 % → 20 % → 50 % → 100 %)
production
```

**Do not spend on UA before the closed track is green.** §89 is explicit: scale only after
positive signals.

## 3. Release checklist

**Binary**
- [ ] `bundleVersionCode` incremented
- [ ] Target API ≥ 36, min API 26
- [ ] AAB signed with the upload key enrolled in Play App Signing
- [ ] AAB base ≤ 90 MB
- [ ] Release ad unit ids present (not Google test ids) — verified by a build-time assert
- [ ] `google-services.json` present and matches the Firebase project

**Quality**
- [ ] `npm test` green
- [ ] `npm run sim` and `npm run sim:long` green
- [ ] Unity EditMode + PlayMode tests green
- [ ] `SimParityTests` green (C# matches the verified rules)
- [ ] Smoke test on one LOW, one MID, one HIGH device
- [ ] Offline, background-kill and clock-change manual passes
- [ ] Crash-free ≥ 99.3 % on the previous build

**Compliance**
- [ ] Privacy policy URL live and matches the Data Safety form
- [ ] UMP consent flow tested in EEA and BR builds
- [ ] IAP products active in Play Console and purchasable in the internal track
- [ ] Ads.txt published on the developer domain
- [ ] Content rating questionnaire completed

**Listing**
- [ ] Icon legible at 48 px
- [ ] Screenshots show real gameplay (never mocked — §69)
- [ ] Descriptions proofread in pt-BR
- [ ] What's New written for humans

## 4. Rollback

If crash-free drops below 99 % after a staged rollout: halt the rollout, keep the previous
version live, and use the Remote Config kill switches for the implicated subsystem
(`kill_switch_ads`, `kill_switch_iap`, `kill_switch_events`) before shipping a fix.

## 5. Post-launch cadence

| Cadence | Content |
|---|---|
| Weekly | recurring event rotation (Remote Config, no build) |
| Bi-weekly | balance pass from live telemetry |
| 4-weekly | season + pass + 6 new Rota stops |
| Quarterly | new establishment or region |
