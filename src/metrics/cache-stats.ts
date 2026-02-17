/**
 * src/metrics/cache-stats.ts
 *
 * LRU cache hit/miss statistics tracker.
 * Provides getCacheStats() with hit rate, miss rate, eviction count,
 * and per-namespace breakdown. Zero external dependencies.
 *
 * Usage:
 *   import { cacheStats } from "./cache-stats.js";
 *   cacheStats.recordHit("embedding");
 *   cacheStats.recordMiss("embedding");
 *   const stats = cacheStats.getStats();
 */

export interface NamespaceStats {
  hits: number;
  misses: number;
  evictions: number;
  hitRate: number;
}

export interface CacheStats {
  totalHits: number;
  totalMisses: number;
  totalEvictions: number;
  hitRate: number;
  namespaces: Record<string, NamespaceStats>;
  uptimeMs: number;
}

class CacheStatsTracker {
  private readonly startTime = Date.now();
  private readonly namespaceHits = new Map<string, number>();
  private readonly namespaceMisses = new Map<string, number>();
  private readonly namespaceEvictions = new Map<string, number>();

  recordHit(namespace: string): void {
    this.namespaceHits.set(namespace, (this.namespaceHits.get(namespace) ?? 0) + 1);
  }

  recordMiss(namespace: string): void {
    this.namespaceMisses.set(namespace, (this.namespaceMisses.get(namespace) ?? 0) + 1);
  }

  recordEviction(namespace: string): void {
    this.namespaceEvictions.set(namespace, (this.namespaceEvictions.get(namespace) ?? 0) + 1);
  }

  getStats(): CacheStats {
    const allNamespaces = new Set([
      ...this.namespaceHits.keys(),
      ...this.namespaceMisses.keys(),
      ...this.namespaceEvictions.keys(),
    ]);

    let totalHits = 0;
    let totalMisses = 0;
    let totalEvictions = 0;
    const namespaces: Record<string, NamespaceStats> = {};

    for (const ns of allNamespaces) {
      const hits = this.namespaceHits.get(ns) ?? 0;
      const misses = this.namespaceMisses.get(ns) ?? 0;
      const evictions = this.namespaceEvictions.get(ns) ?? 0;
      const total = hits + misses;
      namespaces[ns] = {
        hits,
        misses,
        evictions,
        hitRate: total > 0 ? hits / total : 0,
      };
      totalHits += hits;
      totalMisses += misses;
      totalEvictions += evictions;
    }

    const grandTotal = totalHits + totalMisses;
    return {
      totalHits,
      totalMisses,
      totalEvictions,
      hitRate: grandTotal > 0 ? totalHits / grandTotal : 0,
      namespaces,
      uptimeMs: Date.now() - this.startTime,
    };
  }

  reset(): void {
    this.namespaceHits.clear();
    this.namespaceMisses.clear();
    this.namespaceEvictions.clear();
  }
}

/** Singleton cache stats tracker shared across the process. */
export const cacheStats = new CacheStatsTracker();

/** Convenience accessor returning a snapshot of all cache statistics. */
export function getCacheStats(): CacheStats {
  return cacheStats.getStats();
}
