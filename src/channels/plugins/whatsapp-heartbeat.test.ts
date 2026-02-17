import { describe, expect, it, vi } from "vitest";
import type { OpenClawConfig } from "../../config/config.js";

// Mock the session store so we don't hit the filesystem.
const mockSessionStore: Record<string, unknown> = {};

vi.mock("../../config/sessions.js", () => ({
  resolveStorePath: () => "/fake/store.json",
  loadSessionStore: () => mockSessionStore,
}));

// Import AFTER mocks are set up.
const { resolveWhatsAppHeartbeatRecipients } = await import("./whatsapp-heartbeat.js");

function setSessionStore(entries: Record<string, unknown>) {
  // Clear then populate the mutable store reference.
  for (const key of Object.keys(mockSessionStore)) {
    delete mockSessionStore[key];
  }
  Object.assign(mockSessionStore, entries);
}

function baseCfg(overrides?: Partial<OpenClawConfig>): OpenClawConfig {
  return {
    ...overrides,
  } as OpenClawConfig;
}

describe("resolveWhatsAppHeartbeatRecipients", () => {
  it("returns the explicit --to flag when provided", () => {
    const result = resolveWhatsAppHeartbeatRecipients(baseCfg(), { to: "+15555550123" });
    expect(result).toEqual({
      recipients: ["+15555550123"],
      source: "flag",
    });
  });

  it("normalizes the --to flag value to E.164", () => {
    const result = resolveWhatsAppHeartbeatRecipients(baseCfg(), { to: "15555550123" });
    expect(result.recipients[0]).toBe("+15555550123");
  });

  it("returns allowFrom numbers when no sessions exist", () => {
    setSessionStore({});
    const cfg = baseCfg({
      channels: {
        whatsapp: { allowFrom: ["+15550001111", "+15550002222"] },
      },
    } as Partial<OpenClawConfig>);

    const result = resolveWhatsAppHeartbeatRecipients(cfg);
    expect(result.source).toBe("allowFrom");
    expect(result.recipients).toEqual(["+15550001111", "+15550002222"]);
  });

  it("filters out wildcard * from allowFrom", () => {
    setSessionStore({});
    const cfg = baseCfg({
      channels: {
        whatsapp: { allowFrom: ["*", "+15550001111"] },
      },
    } as Partial<OpenClawConfig>);

    const result = resolveWhatsAppHeartbeatRecipients(cfg);
    expect(result.recipients).toEqual(["+15550001111"]);
  });

  it("returns session-single when exactly one session matches", () => {
    setSessionStore({
      user1: {
        lastChannel: "whatsapp",
        lastTo: "+15550009999",
        updatedAt: Date.now(),
      },
    });
    const cfg = baseCfg();

    const result = resolveWhatsAppHeartbeatRecipients(cfg);
    expect(result.source).toBe("session-single");
    expect(result.recipients).toEqual(["+15550009999"]);
  });

  it("returns session-ambiguous when multiple sessions exist", () => {
    setSessionStore({
      user1: {
        lastChannel: "whatsapp",
        lastTo: "+15550001111",
        updatedAt: 2000,
      },
      user2: {
        lastChannel: "whatsapp",
        lastTo: "+15550002222",
        updatedAt: 1000,
      },
    });
    const cfg = baseCfg();

    const result = resolveWhatsAppHeartbeatRecipients(cfg);
    expect(result.source).toBe("session-ambiguous");
    expect(result.recipients).toHaveLength(2);
    // More recent first.
    expect(result.recipients[0]).toBe("+15550001111");
  });

  it("returns combined all sources when opts.all is true", () => {
    setSessionStore({
      user1: {
        lastChannel: "whatsapp",
        lastTo: "+15550001111",
        updatedAt: Date.now(),
      },
    });
    const cfg = baseCfg({
      channels: {
        whatsapp: { allowFrom: ["+15550002222"] },
      },
    } as Partial<OpenClawConfig>);

    const result = resolveWhatsAppHeartbeatRecipients(cfg, { all: true });
    expect(result.source).toBe("all");
    expect(result.recipients).toContain("+15550001111");
    expect(result.recipients).toContain("+15550002222");
  });

  it("deduplicates recipients in all mode", () => {
    setSessionStore({
      user1: {
        lastChannel: "whatsapp",
        lastTo: "+15550001111",
        updatedAt: Date.now(),
      },
    });
    const cfg = baseCfg({
      channels: {
        whatsapp: { allowFrom: ["+15550001111"] },
      },
    } as Partial<OpenClawConfig>);

    const result = resolveWhatsAppHeartbeatRecipients(cfg, { all: true });
    expect(result.recipients).toEqual(["+15550001111"]);
  });

  it("skips sessions for non-whatsapp channels", () => {
    setSessionStore({
      "telegram-user": {
        lastChannel: "telegram",
        lastTo: "+15550009999",
        updatedAt: Date.now(),
      },
    });
    const cfg = baseCfg();

    const result = resolveWhatsAppHeartbeatRecipients(cfg);
    expect(result.source).toBe("allowFrom");
    expect(result.recipients).toEqual([]);
  });

  it("skips group session keys", () => {
    setSessionStore({
      "whatsapp:group:123@g.us": {
        lastChannel: "whatsapp",
        lastTo: "123@g.us",
        updatedAt: Date.now(),
      },
    });
    const cfg = baseCfg();

    const result = resolveWhatsAppHeartbeatRecipients(cfg);
    expect(result.source).toBe("allowFrom");
    expect(result.recipients).toEqual([]);
  });

  it("skips cron session keys", () => {
    setSessionStore({
      "cron:daily": {
        lastChannel: "whatsapp",
        lastTo: "+15550001111",
        updatedAt: Date.now(),
      },
    });
    const cfg = baseCfg();

    const result = resolveWhatsAppHeartbeatRecipients(cfg);
    expect(result.source).toBe("allowFrom");
    expect(result.recipients).toEqual([]);
  });

  it("skips global and unknown keys", () => {
    setSessionStore({
      global: {
        lastChannel: "whatsapp",
        lastTo: "+15550001111",
        updatedAt: Date.now(),
      },
      unknown: {
        lastChannel: "whatsapp",
        lastTo: "+15550002222",
        updatedAt: Date.now(),
      },
    });
    const cfg = baseCfg();

    const result = resolveWhatsAppHeartbeatRecipients(cfg);
    expect(result.source).toBe("allowFrom");
    expect(result.recipients).toEqual([]);
  });

  it("returns empty allowFrom when no allowFrom is configured and no sessions", () => {
    setSessionStore({});
    const cfg = baseCfg();

    const result = resolveWhatsAppHeartbeatRecipients(cfg);
    expect(result.source).toBe("allowFrom");
    expect(result.recipients).toEqual([]);
  });
});
