import { bench, describe } from "vitest";
import { cacheStats } from "../../src/metrics/cache-stats.js";
import { metrics } from "../../src/metrics/collector.js";
import { checkRateLimit, resetAllRateLimits } from "../../src/middleware/rate-limiter.js";

// ── MetricsCollector benchmarks ─────────────────────────────────────────────

describe("MetricsCollector", () => {
  bench("startTimer + end (memory.search)", () => {
    const end = metrics.startTimer("memory.search", { namespace: "bench" });
    end();
  });

  bench("startTimer + end (routing)", () => {
    const end = metrics.startTimer("routing", { agentType: "tulsbot" });
    end();
  });

  bench("startTimer + end (api)", () => {
    const end = metrics.startTimer("api", { provider: "anthropic" });
    end();
  });

  bench("increment counter", () => {
    metrics.increment("bench.ops");
  });

  bench("snapshot (cold — after reset)", () => {
    metrics.reset();
    metrics.snapshot();
  });

  bench("snapshot (warm — 100 samples pre-loaded)", () => {
    // Setup is included in timing, but the snapshot is the expensive part
    for (let i = 0; i < 100; i++) {
      const end = metrics.startTimer("memory.search", { namespace: "warm" });
      end();
    }
    metrics.snapshot();
  });
});

// ── CacheStatsTracker benchmarks ────────────────────────────────────────────

describe("CacheStatsTracker", () => {
  bench("recordHit", () => {
    cacheStats.recordHit("bench-ns");
  });

  bench("recordMiss", () => {
    cacheStats.recordMiss("bench-ns");
  });

  bench("recordEviction", () => {
    cacheStats.recordEviction("bench-ns");
  });

  bench("getStats (single namespace)", () => {
    cacheStats.getStats();
  });

  bench("getStats (10 namespaces)", () => {
    // Spread across namespaces to stress aggregation
    for (let i = 0; i < 10; i++) {
      cacheStats.recordHit(`ns-${i}`);
      cacheStats.recordMiss(`ns-${i}`);
    }
    cacheStats.getStats();
  });

  bench("reset + getStats cycle", () => {
    cacheStats.reset();
    cacheStats.recordHit("a");
    cacheStats.recordMiss("a");
    cacheStats.getStats();
  });
});

// ── Rate limiter benchmarks ─────────────────────────────────────────────────

describe("RateLimiter", () => {
  bench("checkRateLimit (single user, under limit)", () => {
    resetAllRateLimits();
    checkRateLimit("bench-user", "bench-chan");
  });

  bench("checkRateLimit (burst — 20 requests same user)", () => {
    resetAllRateLimits();
    for (let i = 0; i < 20; i++) {
      checkRateLimit("burst-user", "burst-chan");
    }
  });

  bench("checkRateLimit (denied — over limit)", () => {
    resetAllRateLimits();
    for (let i = 0; i < 21; i++) {
      checkRateLimit("over-user", "over-chan");
    }
  });

  bench("checkRateLimit (10 distinct users)", () => {
    resetAllRateLimits();
    for (let i = 0; i < 10; i++) {
      checkRateLimit(`user-${i}`, "shared-chan");
    }
  });

  bench("resetAllRateLimits", () => {
    resetAllRateLimits();
  });
});
