# Android playtest shell

Wraps the design-verification prototype in a real Android app: full-screen
portrait, no browser bar, no server, works in airplane mode. It exists because a
tester needs to hold the *current* rules — the ones the gates validate — while
the Unity client is still not buildable (`docs/25-AUDITORIA_STATUS_E_BRANCHES.md`).

What it is not: a store build. Debug-signed, no billing, no ads, no analytics
upload, no Unity code. See `docs/27-TESTE_ANDROID.md` for the tester-facing flow.

| File | Role |
|---|---|
| `app/src/main/java/br/com/churrasco/playtest/MainActivity.java` | The whole shell: immersive full screen, virtual-origin asset serving, WebView settings |
| `app/src/main/assets/` | **Generated.** The `npm run export:android` tree (bundle, data, art, audio, fonts) |
| `app/src/main/res/` | Launcher icons (`tools/android/make-android-icons.mjs`, rendered from the approved store icon) and the platform-only theme |
| `app/build.gradle` | `minSdk 24`, `targetSdk 34`, release signed with the debug key on purpose |

## Build locally

```bash
# from the repository root
npm ci
npm run export:android                     # → build/android-webapp/
cp -r build/android-webapp/. android-shell/app/src/main/assets/

cd android-shell
gradle assembleRelease                     # needs JDK 17 + Android SDK 34
# → app/build/outputs/apk/release/app-release.apk
```

`./gradlew stageWeb` (or `gradle stageWeb`) does the export and the copy in one
step. A build with no staged assets fails on purpose, with the instruction to
run the export, rather than producing an APK with no game inside it.

## Publish (the path testers use)

`.github/workflows/android-playtest.yml` builds this shell on every
playtest-relevant push and uploads the APK to a release whose URL never changes:

```
https://github.com/berger33/game_churrasqueiro/releases/download/playtest-android/churrasco-playtest.apk
```

The QR code in `qr-playtest.png` (attached to the release) points at that URL, so
one printed code keeps working build after build.

## Tuning for a slow device

The canvas backing store is capped by the game's `dprcap` (default 2, see
`prototype/src/main.ts`). If a device drops frames, load the page with a lower
cap — in the shell that means editing the load URL in `MainActivity`, in the
browser it is just a query string:

```
https://<host>/index.html?maxscale=9&dprcap=1.25
```
