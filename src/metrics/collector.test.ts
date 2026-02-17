import { describe, it, expect, beforeEach } from "vitest";
import type { MetricsSnapshot } from "./collector.js";
import { metrics, dumpMetrics } from "./collector.js";

describe("MetricsCollector", () => {
  beforeEach(() => {
    metrics.reset();
  });

  // ── Snapshot structure ──────────────────────────────────────────────────

  it("snapshot returns expected top-level keys", () => {
    const snap = metrics.snapshot();
    expect(snap).toHaveProperty("timestamp");
    expect(snap).toHaveProperty("uptimeMs");
    expect(snap).toHaveProperty("memorySearch");
    expect(snap).toHaveProperty("routing");
    expect(snap).toHaveProperty("apiCalls");
    expect(snap).toHaveProperty("counters");
  });

  it("snapshot timestamp is a recent unix epoch ms", () => {
    const before = Date.now();
    const snap = metrics.snapshot();
    const after = Date.now();
    expect(snap.timestamp).toBeGreaterThanOrEqual(before);
    expect(snap.timestamp).toBeLessThanOrEqual(after);
  });

  it("uptimeMs is non-negative", () => {
    const snap = metrics.snapshot();
    expect(snap.uptimeMs).toBeGreaterThanOrEqual(0);
  });

  // ── startTimer: memory.search ───────────────────────────────────────────

  it("records memory.search latency by namespace", () => {
    const end = metrics.startTimer("memory.search", { namespace: "knowledge" });
    end();

    const snap = metrics.snapshot();
    expect(snap.memorySearch["knowledge"]).toBeDefined();
    expect(snap.memorySearch["knowledge"].count).toBe(1);
    expect(snap.memorySearch["knowledge"].sum).toBeGreaterThanOrEqual(0);
  });

  it("accumulates multiple memory.search samples in the same namespace", () => {
    for (let i = 0; i < 3; i++) {
      const end = metrics.startTimer("memory.search", { namespace: "ns" });
      end();
    }
    const snap = metrics.snapshot();
    expect(snap.memorySearch["ns"].count).toBe(3);
  });

  // ── startTimer: routing ─────────────────────────────────────────────────

  it("records routing decisions and latency by agentType", () => {
    const end = metrics.startTimer("routing", { agentType: "tulsbot" });
    end();

    const snap = metrics.snapshot();
    expect(snap.routing["tulsbot"]).toBeDefined();
    expect(snap.routing["tulsbot"].decisions).toBe(1);
    expect(snap.routing["tulsbot"].latency.count).toBe(1);
  });

  // ── startTimer: api ─────────────────────────────────────────────────────

  it("records API call count and latency by provider", () => {
    const end = metrics.startTimer("api", { provider: "anthropic" });
    end();

    const snap = metrics.snapshot();
    expect(snap.apiCalls["anthropic"]).toBeDefined();
    expect(snap.apiCalls["anthropic"].calls).toBe(1);
    expect(snap.apiCalls["anthropic"].latency.count).toBe(1);
  });

  // ── Generic counters ────────────────────────────────────────────────────

  it("increment creates and increments a named counter", () => {
    metrics.increment("api.errors");
    metrics.increment("api.errors");
    metrics.increment("cache.evictions", 5);

    const snap = metrics.snapshot();
    expect(snap.counters["api.errors"]).toBe(2);
    expect(snap.counters["cache.evictions"]).toBe(5);
  });

  // ── Histogram stats ─────────────────────────────────────────────────────

  it("histogram stats contain p50/p95/p99/min/max/mean", () => {
    // Record several values so percentiles are meaningful
    for (let i = 1; i <= 10; i++) {
      const end = metrics.startTimer("memory.search", { namespace: "hist" });
      // We can't control time precisely, but we can verify structure
      end();
    }
    const snap = metrics.snapshot();
    const h = snap.memorySearch["hist"];

    expect(h.count).toBe(10);
    expect(h.sum).toBeGreaterThanOrEqual(0);
    expect(h.min).toBeGreaterThanOrEqual(0);
    expect(h.max).toBeGreaterThanOrEqual(h.min);
    expect(h.mean).toBeGreaterThanOrEqual(0);
    expect(h.p50).toBeGreaterThanOrEqual(0);
    expect(h.p95).toBeGreaterThanOrEqual(0);
    expect(h.p99).toBeGreaterThanOrEqual(0);
  });

  it("all histograms are zeroed after reset", () => {
    // After reset(), histogram keys persist but values are zeroed
    const snap = metrics.snapshot();
    for (const h of Object.values(snap.memorySearch)) {
      expect(h.count).toBe(0);
      expect(h.sum).toBe(0);
    }
  });

  // ── reset() ─────────────────────────────────────────────────────────────

  it("reset clears all histograms and counters", () => {
    const end = metrics.startTimer("memory.search", { namespace: "a" });
    end();
    metrics.increment("test.counter");
    const end2 = metrics.startTimer("api", { provider: "openai" });
    end2();
    const end3 = metrics.startTimer("routing", { agentType: "main" });
    end3();

    metrics.reset();

    const snap = metrics.snapshot();
    // After reset, histograms exist but have zero counts
    for (const h of Object.values(snap.memorySearch)) {
      expect(h.count).toBe(0);
    }
    for (const r of Object.values(snap.routing)) {
      expect(r.decisions).toBe(0);
      expect(r.latency.count).toBe(0);
    }
    for (const a of Object.values(snap.apiCalls)) {
      expect(a.calls).toBe(0);
      expect(a.latency.count).toBe(0);
    }
    for (const v of Object.values(snap.counters)) {
      expect(v).toBe(0);
    }
  });

  // ── dumpMetrics ─────────────────────────────────────────────────────────

  it("dumpMetrics returns valid JSON string", () => {
    metrics.increment("test");
    const json = dumpMetrics();
    const parsed = JSON.parse(json) as MetricsSnapshot;

    expect(parsed.timestamp).toBeGreaterThan(0);
    expect(parsed.counters["test"]).toBe(1);
  });

  // ── Multiple namespaces/providers coexist ────────────────────────────────

  it("tracks multiple namespaces and providers independently", () => {
    const e1 = metrics.startTimer("memory.search", { namespace: "a" });
    e1();
    const e2 = metrics.startTimer("memory.search", { namespace: "b" });
    e2();
    const e3 = metrics.startTimer("api", { provider: "anthropic" });
    e3();
    const e4 = metrics.startTimer("api", { provider: "openai" });
    e4();

    const snap = metrics.snapshot();
    expect(Object.keys(snap.memorySearch)).toContain("a");
    expect(Object.keys(snap.memorySearch)).toContain("b");
    expect(Object.keys(snap.apiCalls)).toContain("anthropic");
    expect(Object.keys(snap.apiCalls)).toContain("openai");
    expect(snap.memorySearch["a"].count).toBe(1);
    expect(snap.memorySearch["b"].count).toBe(1);
  });
});
