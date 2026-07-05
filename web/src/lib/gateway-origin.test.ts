import { afterEach, describe, expect, it, vi } from "vitest";

import {
  apiOriginPrefix,
  clearGatewayConfig,
  effectiveSessionToken,
  gatewayWsTarget,
  getGatewayOrigin,
  getGatewayToken,
  hasGatewayOverride,
  normalizeGatewayOrigin,
  setGatewayConfig,
} from "./gateway-origin";

// jsdom is not the default env for this suite (vitest.config uses node), so
// provide a tiny in-memory localStorage + window shim.
function installBrowserShim(): void {
  const store = new Map<string, string>();
  const ls = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  };
  vi.stubGlobal("localStorage", ls);
  vi.stubGlobal("window", {} as unknown as Window & typeof globalThis);
}

afterEach(() => {
  clearGatewayConfig();
  vi.unstubAllGlobals();
});

describe("normalizeGatewayOrigin", () => {
  it("returns '' for empty / nullish input", () => {
    expect(normalizeGatewayOrigin("")).toBe("");
    expect(normalizeGatewayOrigin(null)).toBe("");
    expect(normalizeGatewayOrigin(undefined)).toBe("");
    expect(normalizeGatewayOrigin("   ")).toBe("");
  });

  it("defaults a bare host:port to http (right for LAN / on-device)", () => {
    expect(normalizeGatewayOrigin("127.0.0.1:9119")).toBe("http://127.0.0.1:9119");
    expect(normalizeGatewayOrigin("192.168.1.5:9119")).toBe("http://192.168.1.5:9119");
  });

  it("preserves an explicit scheme and strips any path / trailing slash", () => {
    expect(normalizeGatewayOrigin("https://pc.example.com")).toBe("https://pc.example.com");
    expect(normalizeGatewayOrigin("https://pc.example.com/")).toBe("https://pc.example.com");
    expect(normalizeGatewayOrigin("http://10.0.0.2:9119/dashboard/")).toBe("http://10.0.0.2:9119");
  });

  it("rejects non-http(s) schemes", () => {
    expect(normalizeGatewayOrigin("ftp://x")).toBe("");
    expect(normalizeGatewayOrigin("javascript:alert(1)")).toBe("");
  });
});

describe("no override configured (default = legacy behaviour)", () => {
  it("all getters are empty / same-origin, token falls back to injected", () => {
    installBrowserShim();
    (window as { __HERMES_SESSION_TOKEN__?: string }).__HERMES_SESSION_TOKEN__ =
      "injected-tok";

    expect(getGatewayOrigin()).toBe("");
    expect(getGatewayToken()).toBe("");
    expect(hasGatewayOverride()).toBe(false);
    expect(apiOriginPrefix()).toBe(""); // → `${""}${BASE}` === same-origin
    expect(gatewayWsTarget()).toBeNull(); // → buildWsUrl reads window.location
    expect(effectiveSessionToken()).toBe("injected-tok");
  });
});

describe("override configured", () => {
  it("persists, normalises, and drives origin/token/ws-target", () => {
    installBrowserShim();
    (window as { __HERMES_SESSION_TOKEN__?: string }).__HERMES_SESSION_TOKEN__ =
      "injected-tok";

    const saved = setGatewayConfig({ origin: "127.0.0.1:9119", token: "dev-token" });
    expect(saved).toEqual({ origin: "http://127.0.0.1:9119", token: "dev-token" });

    expect(getGatewayOrigin()).toBe("http://127.0.0.1:9119");
    expect(hasGatewayOverride()).toBe(true);
    expect(apiOriginPrefix()).toBe("http://127.0.0.1:9119");
    expect(gatewayWsTarget()).toEqual({ host: "127.0.0.1:9119", protocol: "http:" });

    // Override token wins over the injected one.
    expect(effectiveSessionToken()).toBe("dev-token");
  });

  it("https origin yields wss target host/protocol", () => {
    installBrowserShim();
    setGatewayConfig({ origin: "https://mypc.tailnet.ts.net", token: "t" });
    expect(gatewayWsTarget()).toEqual({
      host: "mypc.tailnet.ts.net",
      protocol: "https:",
    });
  });

  it("clearing an origin also drops the stored token", () => {
    installBrowserShim();
    setGatewayConfig({ origin: "127.0.0.1:9119", token: "dev-token" });
    setGatewayConfig({ origin: "", token: "orphan" });
    expect(getGatewayOrigin()).toBe("");
    expect(getGatewayToken()).toBe("");
  });

  it("window injection beats localStorage", () => {
    installBrowserShim();
    setGatewayConfig({ origin: "127.0.0.1:9119", token: "ls-token" });
    (window as { __HERMES_GATEWAY_ORIGIN__?: string }).__HERMES_GATEWAY_ORIGIN__ =
      "https://injected.example.com";
    expect(getGatewayOrigin()).toBe("https://injected.example.com");
  });
});
