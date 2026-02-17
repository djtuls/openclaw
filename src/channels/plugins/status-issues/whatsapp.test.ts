import { describe, expect, it } from "vitest";
import type { ChannelAccountSnapshot } from "../types.js";
import { collectWhatsAppStatusIssues } from "./whatsapp.js";

function snap(overrides: Partial<ChannelAccountSnapshot> = {}): ChannelAccountSnapshot {
  return {
    accountId: "default",
    enabled: true,
    linked: true,
    running: true,
    connected: true,
    ...overrides,
  };
}

describe("collectWhatsAppStatusIssues", () => {
  it("returns no issues for a healthy connected account", () => {
    expect(collectWhatsAppStatusIssues([snap()])).toEqual([]);
  });

  it("returns no issues for an empty account list", () => {
    expect(collectWhatsAppStatusIssues([])).toEqual([]);
  });

  it("skips disabled accounts", () => {
    expect(collectWhatsAppStatusIssues([snap({ enabled: false, linked: false })])).toEqual([]);
  });

  it("reports auth issue when not linked", () => {
    const issues = collectWhatsAppStatusIssues([snap({ linked: false })]);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      channel: "whatsapp",
      accountId: "default",
      kind: "auth",
      message: expect.stringContaining("Not linked"),
    });
    expect(issues[0].fix).toContain("channels login");
  });

  it("reports runtime issue when linked but disconnected", () => {
    const issues = collectWhatsAppStatusIssues([snap({ connected: false })]);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      channel: "whatsapp",
      accountId: "default",
      kind: "runtime",
      message: expect.stringContaining("disconnected"),
    });
  });

  it("does not report runtime issue when not running", () => {
    // If the process is not running, disconnected state is expected.
    const issues = collectWhatsAppStatusIssues([snap({ running: false, connected: false })]);
    expect(issues).toEqual([]);
  });

  it("includes reconnect attempts in runtime message", () => {
    const issues = collectWhatsAppStatusIssues([snap({ connected: false, reconnectAttempts: 5 })]);
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain("reconnectAttempts=5");
  });

  it("includes last error in runtime message", () => {
    const issues = collectWhatsAppStatusIssues([
      snap({ connected: false, lastError: "Connection closed" }),
    ]);
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain("Connection closed");
  });

  it("handles multiple accounts with different states", () => {
    const issues = collectWhatsAppStatusIssues([
      snap({ accountId: "work", linked: false }),
      snap({ accountId: "personal", connected: false, lastError: "timeout" }),
      snap({ accountId: "healthy" }),
    ]);
    expect(issues).toHaveLength(2);
    expect(issues[0].accountId).toBe("work");
    expect(issues[0].kind).toBe("auth");
    expect(issues[1].accountId).toBe("personal");
    expect(issues[1].kind).toBe("runtime");
  });

  it("defaults accountId to 'default' when missing", () => {
    const issues = collectWhatsAppStatusIssues([
      { linked: false, enabled: true } as unknown as ChannelAccountSnapshot,
    ]);
    expect(issues).toHaveLength(1);
    expect(issues[0].accountId).toBe("default");
  });

  it("skips non-record entries", () => {
    const issues = collectWhatsAppStatusIssues([
      null as unknown as ChannelAccountSnapshot,
      undefined as unknown as ChannelAccountSnapshot,
    ]);
    expect(issues).toEqual([]);
  });

  it("does not report both auth and runtime for unlinked account", () => {
    // When not linked, we should only get the auth issue (continue skips runtime check)
    const issues = collectWhatsAppStatusIssues([
      snap({ linked: false, running: true, connected: false }),
    ]);
    expect(issues).toHaveLength(1);
    expect(issues[0].kind).toBe("auth");
  });
});
