import { describe, expect, it, vi } from "vitest";
import { createInMemorySessionStore } from "./session.js";

const BASE_PARAMS = {
  sessionKey: "discord:user:123",
  cwd: "/tmp/test",
};

// ---------------------------------------------------------------------------
// createSession
// ---------------------------------------------------------------------------

describe("createSession", () => {
  it("stores sessionKey and cwd on the returned session", async () => {
    const store = createInMemorySessionStore();
    const session = await store.createSession(BASE_PARAMS);
    expect(session.sessionKey).toBe("discord:user:123");
    expect(session.cwd).toBe("/tmp/test");
  });

  it("generates a UUID sessionId when none is provided", async () => {
    const store = createInMemorySessionStore();
    const session = await store.createSession(BASE_PARAMS);
    expect(typeof session.sessionId).toBe("string");
    expect(session.sessionId.length).toBeGreaterThan(0);
  });

  it("uses the caller-supplied sessionId when provided", async () => {
    const store = createInMemorySessionStore();
    const session = await store.createSession({ ...BASE_PARAMS, sessionId: "my-id" });
    expect(session.sessionId).toBe("my-id");
  });

  it("initialises abortController to null", async () => {
    const store = createInMemorySessionStore();
    const session = await store.createSession(BASE_PARAMS);
    expect(session.abortController).toBeNull();
  });

  it("initialises activeRunId to null", async () => {
    const store = createInMemorySessionStore();
    const session = await store.createSession(BASE_PARAMS);
    expect(session.activeRunId).toBeNull();
  });

  it("sets a createdAt timestamp close to now", async () => {
    const before = Date.now();
    const store = createInMemorySessionStore();
    const session = await store.createSession(BASE_PARAMS);
    const after = Date.now();
    expect(session.createdAt).toBeGreaterThanOrEqual(before);
    expect(session.createdAt).toBeLessThanOrEqual(after);
  });

  it("creates independent sessions for different calls", async () => {
    const store = createInMemorySessionStore();
    const s1 = await store.createSession(BASE_PARAMS);
    const s2 = await store.createSession({ ...BASE_PARAMS, sessionKey: "telegram|999" });
    expect(s1.sessionId).not.toBe(s2.sessionId);
    expect(s1.sessionKey).not.toBe(s2.sessionKey);
  });
});

// ---------------------------------------------------------------------------
// getSession
// ---------------------------------------------------------------------------

describe("getSession", () => {
  it("returns the session after creation", async () => {
    const store = createInMemorySessionStore();
    const created = await store.createSession(BASE_PARAMS);
    const found = store.getSession(created.sessionId);
    expect(found).toBeDefined();
    expect(found!.sessionId).toBe(created.sessionId);
  });

  it("returns undefined for an unknown sessionId", () => {
    const store = createInMemorySessionStore();
    expect(store.getSession("ghost")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// getSessionByRunId
// ---------------------------------------------------------------------------

describe("getSessionByRunId", () => {
  it("returns the session after setActiveRun", async () => {
    const store = createInMemorySessionStore();
    const session = await store.createSession(BASE_PARAMS);
    const ac = new AbortController();
    store.setActiveRun(session.sessionId, "run-1", ac);
    const found = store.getSessionByRunId("run-1");
    expect(found).toBeDefined();
    expect(found!.sessionId).toBe(session.sessionId);
  });

  it("returns undefined for an unknown runId", () => {
    const store = createInMemorySessionStore();
    expect(store.getSessionByRunId("no-such-run")).toBeUndefined();
  });

  it("returns undefined after clearActiveRun removes the mapping", async () => {
    const store = createInMemorySessionStore();
    const session = await store.createSession(BASE_PARAMS);
    const ac = new AbortController();
    store.setActiveRun(session.sessionId, "run-2", ac);
    store.clearActiveRun(session.sessionId);
    expect(store.getSessionByRunId("run-2")).toBeUndefined();
  });

  it("returns undefined after cancelActiveRun removes the mapping", async () => {
    const store = createInMemorySessionStore();
    const session = await store.createSession(BASE_PARAMS);
    const ac = new AbortController();
    store.setActiveRun(session.sessionId, "run-3", ac);
    store.cancelActiveRun(session.sessionId);
    expect(store.getSessionByRunId("run-3")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// setActiveRun
// ---------------------------------------------------------------------------

describe("setActiveRun", () => {
  it("sets activeRunId and abortController on the session", async () => {
    const store = createInMemorySessionStore();
    const session = await store.createSession(BASE_PARAMS);
    const ac = new AbortController();
    store.setActiveRun(session.sessionId, "run-x", ac);
    const updated = store.getSession(session.sessionId)!;
    expect(updated.activeRunId).toBe("run-x");
    expect(updated.abortController).toBe(ac);
  });

  it("enables reverse lookup via getSessionByRunId", async () => {
    const store = createInMemorySessionStore();
    const session = await store.createSession(BASE_PARAMS);
    const ac = new AbortController();
    store.setActiveRun(session.sessionId, "run-y", ac);
    expect(store.getSessionByRunId("run-y")).toBeDefined();
  });

  it("is a no-op for an unknown sessionId", () => {
    const store = createInMemorySessionStore();
    expect(() => store.setActiveRun("ghost", "run-z", new AbortController())).not.toThrow();
    expect(store.getSessionByRunId("run-z")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// clearActiveRun
// ---------------------------------------------------------------------------

describe("clearActiveRun", () => {
  it("nulls activeRunId and abortController", async () => {
    const store = createInMemorySessionStore();
    const session = await store.createSession(BASE_PARAMS);
    store.setActiveRun(session.sessionId, "run-a", new AbortController());
    store.clearActiveRun(session.sessionId);
    const updated = store.getSession(session.sessionId)!;
    expect(updated.activeRunId).toBeNull();
    expect(updated.abortController).toBeNull();
  });

  it("removes the runId from the reverse-lookup map", async () => {
    const store = createInMemorySessionStore();
    const session = await store.createSession(BASE_PARAMS);
    store.setActiveRun(session.sessionId, "run-b", new AbortController());
    store.clearActiveRun(session.sessionId);
    expect(store.getSessionByRunId("run-b")).toBeUndefined();
  });

  it("is a no-op for an unknown sessionId", () => {
    const store = createInMemorySessionStore();
    expect(() => store.clearActiveRun("ghost")).not.toThrow();
  });

  it("is a no-op when there is no active run", async () => {
    const store = createInMemorySessionStore();
    const session = await store.createSession(BASE_PARAMS);
    // No setActiveRun called — clearActiveRun should not throw
    expect(() => store.clearActiveRun(session.sessionId)).not.toThrow();
    const updated = store.getSession(session.sessionId)!;
    expect(updated.activeRunId).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// cancelActiveRun
// ---------------------------------------------------------------------------

describe("cancelActiveRun", () => {
  it("returns false for an unknown sessionId", () => {
    const store = createInMemorySessionStore();
    expect(store.cancelActiveRun("ghost")).toBe(false);
  });

  it("returns false when there is no active AbortController", async () => {
    const store = createInMemorySessionStore();
    const session = await store.createSession(BASE_PARAMS);
    expect(store.cancelActiveRun(session.sessionId)).toBe(false);
  });

  it("calls abort() on the AbortController", async () => {
    const store = createInMemorySessionStore();
    const session = await store.createSession(BASE_PARAMS);
    const ac = new AbortController();
    const abortSpy = vi.spyOn(ac, "abort");
    store.setActiveRun(session.sessionId, "run-c", ac);
    store.cancelActiveRun(session.sessionId);
    expect(abortSpy).toHaveBeenCalledOnce();
  });

  it("returns true when a run was successfully cancelled", async () => {
    const store = createInMemorySessionStore();
    const session = await store.createSession(BASE_PARAMS);
    store.setActiveRun(session.sessionId, "run-d", new AbortController());
    const result = store.cancelActiveRun(session.sessionId);
    expect(result).toBe(true);
  });

  it("nulls activeRunId and abortController after cancellation", async () => {
    const store = createInMemorySessionStore();
    const session = await store.createSession(BASE_PARAMS);
    store.setActiveRun(session.sessionId, "run-e", new AbortController());
    store.cancelActiveRun(session.sessionId);
    const updated = store.getSession(session.sessionId)!;
    expect(updated.activeRunId).toBeNull();
    expect(updated.abortController).toBeNull();
  });

  it("removes the runId from the reverse-lookup map after cancellation", async () => {
    const store = createInMemorySessionStore();
    const session = await store.createSession(BASE_PARAMS);
    store.setActiveRun(session.sessionId, "run-f", new AbortController());
    store.cancelActiveRun(session.sessionId);
    expect(store.getSessionByRunId("run-f")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// clearAllSessionsForTest
// ---------------------------------------------------------------------------

describe("clearAllSessionsForTest", () => {
  it("removes all sessions from the store", async () => {
    const store = createInMemorySessionStore();
    const s1 = await store.createSession(BASE_PARAMS);
    const s2 = await store.createSession({ ...BASE_PARAMS, sessionKey: "telegram|1" });
    store.clearAllSessionsForTest();
    expect(store.getSession(s1.sessionId)).toBeUndefined();
    expect(store.getSession(s2.sessionId)).toBeUndefined();
  });

  it("aborts all active AbortControllers", async () => {
    const store = createInMemorySessionStore();
    const s1 = await store.createSession(BASE_PARAMS);
    const s2 = await store.createSession({ ...BASE_PARAMS, sessionKey: "telegram|2" });
    const ac1 = new AbortController();
    const ac2 = new AbortController();
    store.setActiveRun(s1.sessionId, "run-g", ac1);
    store.setActiveRun(s2.sessionId, "run-h", ac2);
    store.clearAllSessionsForTest();
    expect(ac1.signal.aborted).toBe(true);
    expect(ac2.signal.aborted).toBe(true);
  });

  it("clears the runId reverse-lookup map", async () => {
    const store = createInMemorySessionStore();
    const session = await store.createSession(BASE_PARAMS);
    store.setActiveRun(session.sessionId, "run-i", new AbortController());
    store.clearAllSessionsForTest();
    expect(store.getSessionByRunId("run-i")).toBeUndefined();
  });

  it("leaves the store empty (getSession returns undefined for all prior IDs)", async () => {
    const store = createInMemorySessionStore();
    const ids: string[] = [];
    for (let i = 0; i < 3; i++) {
      const s = await store.createSession({ ...BASE_PARAMS, sessionKey: `key-${i}` });
      ids.push(s.sessionId);
    }
    store.clearAllSessionsForTest();
    for (const id of ids) {
      expect(store.getSession(id)).toBeUndefined();
    }
  });

  it("is a no-op on an empty store", () => {
    const store = createInMemorySessionStore();
    expect(() => store.clearAllSessionsForTest()).not.toThrow();
  });
});
