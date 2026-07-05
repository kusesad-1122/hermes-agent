/**
 * Remote / bundled gateway-origin override.
 *
 * WHY THIS EXISTS
 *   Normally the dashboard SPA is *served by* the Python gateway, so it
 *   talks to it same-origin and reads a server-injected session token
 *   (window.__HERMES_SESSION_TOKEN__). That assumption breaks in two
 *   mobile scenarios the Android port needs:
 *     1. A bundled app (Capacitor/PWA .apk) whose HTML is NOT served by the
 *        gateway — window.location is the app shell, not the backend.
 *     2. A phone that should point at a Hermes "brain" running elsewhere —
 *        on-device Termux (http://127.0.0.1:9119) now, a home PC / VPS
 *        later — without rebuilding.
 *
 *   This module lets the app be pointed at an explicit gateway origin + a
 *   static session token, persisted on the device.
 *
 * SAFETY / NO-OP BY DEFAULT
 *   When nothing is configured, every getter returns "" and callers fall
 *   back to the exact legacy behaviour (same-origin + injected token). The
 *   normal dashboard/desktop flow is therefore byte-for-byte unchanged.
 *
 * PRECEDENCE (first non-empty wins)
 *   window.__HERMES_GATEWAY_ORIGIN__  (native bridge / bootstrap injection)
 *   localStorage["hermes.gateway.origin"]  (in-app Settings)
 */

const ORIGIN_KEY = "hermes.gateway.origin";
const TOKEN_KEY = "hermes.gateway.token";

declare global {
  interface Window {
    /** Optional origin injected by a native shell, e.g. "http://127.0.0.1:9119". */
    __HERMES_GATEWAY_ORIGIN__?: string;
    /** Optional static session token injected by a native shell. */
    __HERMES_GATEWAY_TOKEN__?: string;
  }
}

export interface GatewayTarget {
  /** ws:// vs wss:// scheme source, e.g. "http:" or "https:". */
  protocol: string;
  /** Host with optional port, e.g. "127.0.0.1:9119". */
  host: string;
}

/**
 * Normalise a user-entered origin into `scheme://host[:port]` with no path
 * and no trailing slash. A bare `host:port` (no scheme) defaults to http,
 * which is the right choice for on-device / LAN gateways. Returns "" for
 * empty / unparseable input so callers cleanly fall back to same-origin.
 */
export function normalizeGatewayOrigin(raw: string | null | undefined): string {
  const value = (raw ?? "").trim();
  if (!value) return "";
  const withScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(value)
    ? value
    : `http://${value}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    return `${url.protocol}//${url.host}`;
  } catch {
    return "";
  }
}

function readStorage(key: string): string {
  try {
    return localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

function writeStorage(key: string, value: string): void {
  try {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch {
    /* private mode / SSR — ignore */
  }
}

/** The configured gateway origin, normalised, or "" for same-origin. */
export function getGatewayOrigin(): string {
  const injected =
    typeof window !== "undefined" ? window.__HERMES_GATEWAY_ORIGIN__ : "";
  return normalizeGatewayOrigin(injected || readStorage(ORIGIN_KEY));
}

/** The configured static session token, or "" to use the injected one. */
export function getGatewayToken(): string {
  const injected =
    typeof window !== "undefined" ? window.__HERMES_GATEWAY_TOKEN__ : "";
  return (injected || readStorage(TOKEN_KEY)).trim();
}

/** True when an explicit remote/bundled gateway origin is configured. */
export function hasGatewayOverride(): boolean {
  return getGatewayOrigin() !== "";
}

/** REST URL prefix: the override origin, or "" for same-origin. */
export function apiOriginPrefix(): string {
  return getGatewayOrigin();
}

/**
 * The token to attach to requests: the override token if configured, else
 * the server-injected one (or "" when neither exists).
 */
export function effectiveSessionToken(): string {
  const override = getGatewayToken();
  if (override) return override;
  return (typeof window !== "undefined" && window.__HERMES_SESSION_TOKEN__) || "";
}

/**
 * Parse the override origin into the {host, protocol} that
 * buildHermesWebSocketUrl needs, or null when same-origin (let it read
 * window.location itself).
 */
export function gatewayWsTarget(): GatewayTarget | null {
  const origin = getGatewayOrigin();
  if (!origin) return null;
  try {
    const url = new URL(origin);
    return { host: url.host, protocol: url.protocol };
  } catch {
    return null;
  }
}

/** Persist (or clear, on empty origin) the in-app gateway configuration. */
export function setGatewayConfig(config: {
  origin: string;
  token?: string;
}): { origin: string; token: string } {
  const origin = normalizeGatewayOrigin(config.origin);
  const token = (config.token ?? "").trim();
  writeStorage(ORIGIN_KEY, origin);
  writeStorage(TOKEN_KEY, origin ? token : "");
  return { origin, token: origin ? token : "" };
}

/** Forget any configured gateway override (revert to same-origin). */
export function clearGatewayConfig(): void {
  writeStorage(ORIGIN_KEY, "");
  writeStorage(TOKEN_KEY, "");
}
