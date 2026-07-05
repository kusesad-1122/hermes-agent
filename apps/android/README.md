# Hermes Agent — Android app (Capacitor)

A thin native **Android WebView shell** around the Hermes web dashboard
(`../../web`). It does **not** run Python on the phone — it connects to a
Hermes "brain" (`hermes dashboard`) running either on-device (Termux) or on
your PC/VPS.

This directory only holds the Capacitor **configuration**. The generated
native `android/` project and `node_modules/` are created on your machine
(they're git-ignored) — nothing here needs an Android SDK to *read*.

> **You need a computer for this.** Building an `.apk` requires the Android
> SDK + JDK + Gradle (via Android Studio), which cannot run on the phone in
> a sane way. If you don't have a computer yet, use the **PWA path** instead
> — it gives you an installable app icon today with no build. See
> [`docs/android/使用指南.zh-CN.md`](../../docs/android/使用指南.zh-CN.md).

---

## What you'll produce

An installable `Hermes.apk` that opens the full Hermes UI and connects to
your agent over WebSocket — the same UI the desktop app and web dashboard
use.

## Prerequisites (on your computer)

- Node.js ≥ 20
- [Android Studio](https://developer.android.com/studio) (installs the
  Android SDK + platform tools; bundles a JDK)
- Accept the Android SDK licenses once: `sdkmanager --licenses`

## Build steps

From the **repo root**:

```bash
# 1. Install JS deps (root workspace links web + apps/shared)
npm install

# 2. Build the dashboard bundle → hermes_cli/web_dist
npm --workspace web run build

# 3. Install Capacitor deps for this app
npm --workspace @hermes/android install

# 4. First time only: scaffold the native Android project
npm --workspace @hermes/android run add:android

# 5. Copy web build + config into the native project
npm --workspace @hermes/android run sync

# 6a. Open in Android Studio and press ▶ (build + install to a device):
npm --workspace @hermes/android run open
# 6b. …or build a debug APK from the CLI:
npm --workspace @hermes/android run build:apk
#     → apps/android/android/app/build/outputs/apk/debug/app-debug.apk
```

Copy the `.apk` to your phone and install it (allow "install from unknown
sources" for sideloading).

## Pointing the app at your agent

Edit [`capacitor.config.ts`](./capacitor.config.ts) → `server.url`, then
re-run `sync`:

| Where the agent runs | `server.url` | Notes |
| --- | --- | --- |
| On the **phone** (Termux) | `http://127.0.0.1:9119` | Default. `androidScheme: 'http'` + `cleartext: true` so loopback http works. Start it with `scripts/android/hermes-termux-run.sh`. |
| On your **PC / VPS** | `https://<your-host>` | Use HTTPS (wss). The WebView loads the dashboard same-origin, so the server injects auth — nothing else to configure. |

For an **offline bundled** build (no `server.url`), the WebView loads the
built assets from `webDir` and you set the gateway at runtime via the
override in [`web/src/lib/gateway-origin.ts`](../../web/src/lib/gateway-origin.ts)
(`window.__HERMES_GATEWAY_ORIGIN__` / `__HERMES_GATEWAY_TOKEN__`). A remote
gateway must then allow this app's origin via
`HERMES_DASHBOARD_EXTRA_CORS_ORIGINS` (see the run docs).

## Releasing (later)

For a Play Store `.aab` or a signed release APK you'll add a signing config
and run `./gradlew bundleRelease`. That's out of scope for a first sideload
build — start with the debug APK above.
