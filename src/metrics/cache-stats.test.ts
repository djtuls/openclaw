import { describe, it, expect, beforeEach } from "vitest";
import { cacheStats, getCacheStats } from "./cache-stats.js";

describe("CacheStatsTracker", () => {
  beforeEach(() => {
    cacheStats.reset();
  });

  it("starts with zero totals", () => {
    const s = cacheStats.getStats();
    expect(s.totalHits).toBe(0);
    expect(s.totalMisses).toBe(0);
    expect(s.totalEvictions).toBe(0);
    expect(s.hitRate).toBe(0);
    expect(Object.keys(s.namespaces)).toHaveLength(0);
  });

  it("records hits per namespace", () => {
    cacheStats.recordHit("embedding");
    cacheStats.recordHit("embedding");
    cacheStats.recordHit("fts");

    const s = cacheStats.getStats();
    expect(s.totalHits).toBe(3);
    expect(s.namespaces["embedding"].hits).toBe(2);
    expect(s.namespaces["fts"].hits).toBe(1);
  });

  it("records misses per namespace", () => {
    cacheStats.recordMiss("embedding");
    cacheStats.recordMiss("fts");
    cacheStats.recordMiss("fts");

    const s = cacheStats.getStats();
    expect(s.totalMisses).toBe(3);
    expect(s.namespaces["embedding"].misses).toBe(1);
    expect(s.namespaces["fts"].misses).toBe(2);
  });

  it("records evictions per namespace", () => {
    cacheStats.recordEviction("embedding");

    const s = cacheStats.getStats();
    expect(s.totalEvictions).toBe(1);
    expect(s.namespaces["embedding"].evictions).toBe(1);
  });

  it("computes hitRate correctly", () => {
    cacheStats.recordHit("a");
    cacheStats.recordHit("a");
    cacheStats.recordHit("a");
    cacheStats.recordMiss("a");

    const s = cacheStats.getStats();
    // 3 hits / (3 hits + 1 miss) = 0.75
    expect(s.hitRate).toBe(0.75);
    expect(s.namespaces["a"].hitRate).toBe(0.75);
  });

  it("returns 0 hitRate when no hits or misses (avoids division by zero)", () => {
    // Only evictions — no hits or misses
    cacheStats.recordEviction("x");

    const s = cacheStats.getStats();
    expect(s.hitRate).toBe(0);
    expect(s.namespaces["x"].hitRate).toBe(0);
  });

  it("aggregates across namespaces for global hitRate", () => {
    cacheStats.recordHit("a"); // 1 hit
    cacheStats.recordMiss("b"); // 1 miss

    const s = cacheStats.getStats();
    // 1 hit / (1 hit + 1 miss) = 0.5
    expect(s.hitRate).toBe(0.5);
  });

  it("reset() clears all state", () => {
    cacheStats.recordHit("a");
    cacheStats.recordMiss("a");
    cacheStats.recordEviction("a");
    cacheStats.reset();

    const s = cacheStats.getStats();
    expect(s.totalHits).toBe(0);
    expect(s.totalMisses).toBe(0);
    expect(s.totalEvictions).toBe(0);
    expect(Object.keys(s.namespaces)).toHaveLength(0);
  });

  it("getCacheStats() returns the same data as cacheStats.getStats()", () => {
    cacheStats.recordHit("ns");
    cacheStats.recordMiss("ns");

    const a = getCacheStats();
    const b = cacheStats.getStats();
    expect(a.totalHits).toBe(b.totalHits);
    expect(a.totalMisses).toBe(b.totalMisses);
    expect(a.hitRate).toBe(b.hitRate);
  });

  it("reports uptimeMs as a positive number", () => {
    const s = cacheStats.getStats();
    expect(s.uptimeMs).toBeGreaterThanOrEqual(0);
  });
});
