/**
 * src/metrics/collector.ts
 *
 * In-memory metrics collector. Zero external dependencies.
 *
 * Tracks:
 *   - Memory search latency (P50/P95/P99) per namespace
 *   - Routing decisions (count + latency) per agent type
 *   - API call counts and latency per provider
 *   - Generic counters and gauges
 *
 * Usage:
 *   import { metrics } from "./collector.js";
 *   const end = metrics.startTimer("memory.search", { namespace: "knowledge" });
 *   // ... do work ...
 *   end(); // records latency
 *
 *   metrics.increment("api.calls", { provider: "anthropic" });
 *
 *   // Dump snapshot (e.g., on SIGUSR1 or GET /metrics)
 *   const snap = metrics.snapshot();
 */

// ---------------------------------------------------------------------------
// Histogram helpers
// ---------------------------------------------------------------------------

/**
 * Compute a percentile from a sorted array of numbers.
 * p=0.5 → P50, p=0.95 → P95, p=0.99 → P99.
 */
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) {
    return 0;
  }
  const idx = Math.ceil(p * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(idx, sorted.length - 1))];
}

export interface HistogramStats {
  count: number;
  sum: number;
  min: number;
  max: number;
  mean: number;
  p50: number;
  p95: number;
  p99: number;
}

class Histogram {
  private readonly samples: number[] = [];
  private _sum = 0;
  private _min = Infinity;
  private _max = -Infinity;
  private _sorted = true;

  record(value: number): void {
    this.samples.push(value);
    this._sum += value;
    if (value < this._min) {
      this._min = value;
    }
    if (value > this._max) {
      this._max = value;
    }
    this._sorted = false;
  }

  stats(): HistogramStats {
    const count = this.samples.length;
    if (count === 0) {
      return { count: 0, sum: 0, min: 0, max: 0, mean: 0, p50: 0, p95: 0, p99: 0 };
    }
    if (!this._sorted) {
      this.samples.sort((a, b) => a - b);
      this._sorted = true;
    }
    return {
      count,
      sum: this._sum,
      min: this._min,
      max: this._max,
      mean: this._sum / count,
      p50: percentile(this.samples, 0.5),
      p95: percentile(this.samples, 0.95),
      p99: percentile(this.samples, 0.99),
    };
  }

  reset(): void {
    this.samples.length = 0;
    this._sum = 0;
    this._min = Infinity;
    this._max = -Infinity;
    this._sorted = true;
  }
}

// ---------------------------------------------------------------------------
// Counter
// ---------------------------------------------------------------------------

class Counter {
  private _value = 0;

  increment(by = 1): void {
    this._value += by;
  }

  get value(): number {
    return this._value;
  }

  reset(): void {
    this._value = 0;
  }
}

// ---------------------------------------------------------------------------
// MetricsCollector
// ---------------------------------------------------------------------------

/** Snapshot of all current metrics. */
export interface MetricsSnapshot {
  /** Unix epoch ms when the snapshot was taken. */
  timestamp: number;
  /** Uptime in milliseconds. */
  uptimeMs: number;
  /** Per-namespace memory search latency histograms (ms). */
  memorySearch: Record<string, HistogramStats>;
  /** Per-agent-type routing decision counters and latency histograms (ms). */
  routing: Record<string, { decisions: number; latency: HistogramStats }>;
  /** Per-provider API call counters and latency histograms (ms). */
  apiCalls: Record<string, { calls: number; latency: HistogramStats }>;
  /** Arbitrary named counters. */
  counters: Record<string, number>;
}

class MetricsCollector {
  private readonly startTime = Date.now();

  /** memory.search latency keyed by namespace */
  private readonly searchHistograms = new Map<string, Histogram>();
  /** routing latency + count keyed by agentType */
  private readonly routingHistograms = new Map<string, Histogram>();
  private readonly routingCounters = new Map<string, Counter>();
  /** API call latency + count keyed by provider */
  private readonly apiHistograms = new Map<string, Histogram>();
  private readonly apiCounters = new Map<string, Counter>();
  /** Generic named counters */
  private readonly counters = new Map<string, Counter>();

  // ── Helpers ──────────────────────────────────────────────────────────────

  private getOrCreate<T>(map: Map<string, T>, key: string, factory: () => T): T {
    let entry = map.get(key);
    if (!entry) {
      entry = factory();
      map.set(key, entry);
    }
    return entry;
  }

  // ── Timer factory ─────────────────────────────────────────────────────────

  /**
   * Start a high-resolution timer for a named metric category.
   *
   * @param category  One of "memory.search", "routing", "api"
   * @param labels    { namespace } for memory.search, { agentType } for routing,
   *                  { provider } for api
   * @returns A function to call when the operation completes; records the
   *          elapsed ms into the appropriate histogram.
   */
  startTimer(category: "memory.search", labels: { namespace: string }): () => void;
  startTimer(category: "routing", labels: { agentType: string }): () => void;
  startTimer(category: "api", labels: { provider: string }): () => void;
  startTimer(category: string, labels: Record<string, string>): () => void {
    const start = Date.now();
    return () => {
      const elapsedMs = Date.now() - start;
      if (category === "memory.search") {
        const ns = labels["namespace"] ?? "unknown";
        this.getOrCreate(this.searchHistograms, ns, () => new Histogram()).record(elapsedMs);
      } else if (category === "routing") {
        const agent = labels["agentType"] ?? "unknown";
        this.getOrCreate(this.routingHistograms, agent, () => new Histogram()).record(elapsedMs);
        this.getOrCreate(this.routingCounters, agent, () => new Counter()).increment();
      } else if (category === "api") {
        const provider = labels["provider"] ?? "unknown";
        this.getOrCreate(this.apiHistograms, provider, () => new Histogram()).record(elapsedMs);
        this.getOrCreate(this.apiCounters, provider, () => new Counter()).increment();
      }
    };
  }

  // ── Counters ──────────────────────────────────────────────────────────────

  /**
   * Increment a named counter.
   *
   * @param name  Dotted name, e.g. "api.errors", "cache.evictions"
   * @param by    Amount to increment (default: 1)
   */
  increment(name: string, by = 1): void {
    this.getOrCreate(this.counters, name, () => new Counter()).increment(by);
  }

  // ── Snapshot ──────────────────────────────────────────────────────────────

  /** Return an immutable snapshot of all current metrics. */
  snapshot(): MetricsSnapshot {
    const memorySearch: Record<string, HistogramStats> = {};
    for (const [ns, h] of this.searchHistograms) {
      memorySearch[ns] = h.stats();
    }

    const routing: Record<string, { decisions: number; latency: HistogramStats }> = {};
    for (const [agent, h] of this.routingHistograms) {
      routing[agent] = {
        decisions: this.routingCounters.get(agent)?.value ?? 0,
        latency: h.stats(),
      };
    }

    const apiCalls: Record<string, { calls: number; latency: HistogramStats }> = {};
    for (const [provider, h] of this.apiHistograms) {
      apiCalls[provider] = {
        calls: this.apiCounters.get(provider)?.value ?? 0,
        latency: h.stats(),
      };
    }

    const counters: Record<string, number> = {};
    for (const [name, c] of this.counters) {
      counters[name] = c.value;
    }

    return {
      timestamp: Date.now(),
      uptimeMs: Date.now() - this.startTime,
      memorySearch,
      routing,
      apiCalls,
      counters,
    };
  }

  /** Reset all metrics (useful in tests or after a periodic flush). */
  reset(): void {
    for (const h of this.searchHistograms.values()) {
      h.reset();
    }
    for (const h of this.routingHistograms.values()) {
      h.reset();
    }
    for (const h of this.apiHistograms.values()) {
      h.reset();
    }
    for (const c of this.routingCounters.values()) {
      c.reset();
    }
    for (const c of this.apiCounters.values()) {
      c.reset();
    }
    for (const c of this.counters.values()) {
      c.reset();
    }
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

/** Process-wide metrics collector. */
export const metrics = new MetricsCollector();

/**
 * Dump the current metrics snapshot as a formatted JSON string.
 * Suitable for a SIGUSR1 handler or a GET /metrics endpoint.
 */
export function dumpMetrics(): string {
  return JSON.stringify(metrics.snapshot(), null, 2);
}
