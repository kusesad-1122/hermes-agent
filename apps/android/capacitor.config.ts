import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor configuration for the Hermes Agent Android app.
 *
 * The app is a thin native WebView shell around the Hermes web dashboard
 * (../../web, built into ../../hermes_cli/web_dist). It does NOT run Python
 * on the phone — it connects to a Hermes "brain" (the `hermes dashboard`
 * server) that runs either:
 *   • on-device in Termux at http://127.0.0.1:9119   (default below), or
 *   • on your PC / VPS at https://<your-host>          (edit server.url).
 *
 * TWO WAYS TO POINT THE APP AT A GATEWAY
 *
 * 1) server.url (simplest, recommended for the first build)
 *    The WebView loads the live dashboard straight from the gateway, so it's
 *    same-origin — the server injects the session token and everything works
 *    with no in-app config. Set server.url below.
 *      - On-device (Termux):  http://127.0.0.1:9119  + androidScheme 'http'
 *        + cleartext true (loopback http is fine; CORS allows localhost).
 *      - Remote PC/VPS:       https://your-host        (use https/wss).
 *
 * 2) Bundled assets + in-app gateway setting (offline shell)
 *    Remove server.url so the WebView loads the bundled build from webDir,
 *    then set the gateway origin + token at runtime via the override in
 *    web/src/lib/gateway-origin.ts (window.__HERMES_GATEWAY_ORIGIN__ /
 *    __HERMES_GATEWAY_TOKEN__, or an in-app Settings screen). The remote
 *    gateway must allow this app's origin via
 *    HERMES_DASHBOARD_EXTRA_CORS_ORIGINS.
 *
 * See apps/android/README.md and docs/android/使用指南.zh-CN.md.
 */
const config: CapacitorConfig = {
  appId: "com.nousresearch.hermes",
  appName: "Hermes",
  // Built dashboard bundle. Produce it first with:
  //   npm --workspace web run build   (outputs to hermes_cli/web_dist)
  webDir: "../../hermes_cli/web_dist",
  android: {
    // http scheme so the WebView origin is http://localhost, which can fetch
    // the on-device http://127.0.0.1:9119 gateway without mixed-content
    // blocking. For a pure remote-https setup you can switch this to 'https'.
    allowMixedContent: true,
  },
  server: {
    // On-device default: talk to the Termux gateway on loopback.
    // Change to your PC/VPS URL (https://...) when the agent runs remotely,
    // or delete `url` to load the bundled webDir instead.
    url: "http://127.0.0.1:9119",
    androidScheme: "http",
    cleartext: true,
  },
};

export default config;
