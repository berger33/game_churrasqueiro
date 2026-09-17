# 12 — Build

## 1. Requirements

| Item | Value |
|---|---|
| Unity | 6 LTS — exact patch pinned in `ProjectSettings/ProjectVersion.txt` |
| Modules | Android Build Support, OpenJDK, Android SDK & NDK Tools |
| Target API | 36 (or the current Play requirement, whichever is higher) |
| Min API | 26 (Android 8.0) |
| Package name | `com.<studio>.churrascomestredabrasa` — **must be final before the first upload**; it cannot be changed later |
| Scripting backend | IL2CPP |
| Architectures | ARM64 (required), ARMv7 (optional) |
| Output | **AAB** for Play, APK only for local device testing |

## 2. Credentials (§93)

Nothing sensitive is committed. `.gitignore` excludes `google-services.json`,
`*.keystore`, `secrets.json`, `.env`.

`SecureConfig` reads, in order:

1. `Assets/StreamingAssets/credentials.json` (present only on the build machine, gitignored)
2. environment variables (`CHURRASCO_FIREBASE_*`, `CHURRASCO_ADMOB_*`)
3. baked defaults in `shared/data/remoteconfig_defaults.json` and the Google **test** ad ids

`shared/data/secrets.example.json` documents the exact shape. If no release id is present the
build uses test ids and logs a warning — it never fails silently with a real id missing.

## 3. Signing

- Upload key generated once, stored outside the repository, enrolled in **Play App Signing**.
- Never regenerate. Record the fingerprint in the team password manager, not in git.
- CI signs with a key retrieved from CI secrets at build time.

## 4. Build steps

```bash
# 1. data
npm ci
npm run validate && npm test
npm run gen-levels
npm run sim && npm run sim:long
npm run sync-data            # shared/data → Assets/Data

# 2. Unity batch build
Unity -batchmode -quit -projectPath . \
      -executeMethod Churrasco.EditorTools.BuildPipeline.BuildAndroidAab \
      -buildTarget Android -logFile -

# 3. verify
bundletool get-size total --bundle=build/churrasco.aab --dimensions=ABI
```

## 5. CI gates (fail the build)

1. `npm run validate` — data integrity
2. `npm test` — full QA suite
3. `npm run sim` — economy guardrails
4. `npm run sim:long` — pacing guardrails (nightly, not per-PR: ~7 min)
5. Unity compile + EditMode tests
6. AAB size gate (≤ 90 MB base)
7. Asset registry check (no asset without a licence row)

## 6. Versioning

```
PlayerSettings.bundleVersion      = <major>.<minor>.<patch>     e.g. 1.0.0
PlayerSettings.Android.bundleVersionCode = monotonically increasing integer
```

`content_version` (the data-table version) is reported separately in analytics, so a Remote
Config content change is distinguishable from a binary change.

## 7. Size budget

| Component | Budget |
|---|---|
| Code (IL2CPP, ARM64) | 22 MB |
| Textures (ASTC) | 40 MB |
| Audio (Vorbis) | 18 MB |
| Scenes + prefabs | 6 MB |
| Data + localisation | 2 MB |
| SDKs (Firebase + AdMob + Billing) | ~18 MB |
| **Total** | **≤ 90 MB** |

Each SDK is added one at a time with its measured delta recorded here (§2 of the brief:
verify compatibility, licence, cost, maintenance, size and privacy **before** adopting).
