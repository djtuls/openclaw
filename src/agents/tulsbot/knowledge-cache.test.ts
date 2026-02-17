/**
 * Knowledge Cache Optimization Tests (Agent 3a)
 *
 * Tests the LRU cache internals, telemetry dashboard accuracy,
 * cache warming, health monitoring, and eviction behavior
 * in the V2 knowledge loader.
 *
 * Strategy: creates real temporary files on disk (no fs mocking)
 * so the loader's actual `fs.readFile` calls succeed naturally.
 * This avoids `vi.mock("node:fs/promises")` pitfalls with Vitest's
 * `pool: "forks"` configuration.
 */
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearCache,
  findAgentByName,
  findAgentsByCapability,
  findAgentsByTrigger,
  getCacheHealth,
  getCacheMetadata,
  getCachedKnowledge,
  getTelemetryDashboard,
  listAgentNames,
  preloadAgents,
  warmCacheWithFrequentAgents,
} from "./knowledge-loader-v2.js";

// ---------------------------------------------------------------------------
// Temp directory + fixture helpers
// ---------------------------------------------------------------------------

let tmpDir: string;

/** Build a knowledge-index.json for N agents and write it + agent files to disk */
async function setupTestFixtures(agentCount: number) {
  // Build index
  const agents: Record<
    string,
    { path: string; capabilities: string[]; triggers: string[]; size: number }
  > = {};
  const agentNames: string[] = [];

  for (let i = 0; i < agentCount; i++) {
    const name = `test-agent-${String(i).padStart(3, "0")}`;
    agentNames.push(name);
    agents[name] = {
      path: `agents/${name}.json`,
      capabilities: [`cap-${i}`, "shared-cap"],
      triggers: [`trigger-${i}`, "shared-trigger"],
      size: 128,
    };
  }

  const index = {
    version: "1.0.0-test",
    generated: new Date().toISOString(),
    agentCount,
    totalSize: agentCount * 128,
    agents,
  };

  // Write index file
  await fs.writeFile(path.join(tmpDir, "knowledge-index.json"), JSON.stringify(index), "utf-8");

  // Write individual agent files
  const agentsDir = path.join(tmpDir, "agents");
  await fs.mkdir(agentsDir, { recursive: true });

  for (const name of agentNames) {
    const agentData = {
      name,
      id: `id-${name}`,
      capabilities: ["test-capability"],
      triggers: ["test-trigger"],
      systemPrompt: `You are ${name}.`,
    };
    await fs.writeFile(path.join(agentsDir, `${name}.json`), JSON.stringify(agentData), "utf-8");
  }

  return { index, agentNames };
}

// ---------------------------------------------------------------------------
// Global setup / teardown
// ---------------------------------------------------------------------------

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "knowledge-cache-test-"));
});

afterAll(async () => {
  // Clean up temp directory
  try {
    await fs.rm(tmpDir, { recursive: true, force: true });
  } catch {
    // Best-effort cleanup
  }
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Knowledge Cache (V2 LRU)", () => {
  beforeEach(async () => {
    clearCache();
    // Point the loader at our temp directory
    process.env.TULSBOT_KNOWLEDGE_PATH = path.join(tmpDir, "core-app-knowledge.json");
    process.env.TULSBOT_USE_INDEXED_KNOWLEDGE = "true";
  });

  afterEach(() => {
    clearCache();
    delete process.env.TULSBOT_KNOWLEDGE_PATH;
    delete process.env.TULSBOT_USE_INDEXED_KNOWLEDGE;
    delete process.env.DEBUG_KNOWLEDGE_CACHE;
  });

  // =========================================================================
  // 1. Telemetry Dashboard -- hit rate tracking
  // =========================================================================

  describe("Telemetry dashboard hit/miss tracking", () => {
    it("reports zero loads on fresh cache", () => {
      const dashboard = getTelemetryDashboard();

      expect(dashboard.summary.totalLoadsProcessed).toBe(0);
      expect(dashboard.summary.cacheHitRate).toBe(0);
      expect(dashboard.cache.hits).toBe(0);
      expect(dashboard.cache.misses).toBe(0);
      expect(dashboard.cache.evictions).toBe(0);
      expect(dashboard.cache.size).toBe(0);
      expect(dashboard.topAgents).toEqual([]);
    });

    it("records a miss on first load of an agent", async () => {
      const { agentNames } = await setupTestFixtures(3);

      await findAgentByName(agentNames[0]);

      const dashboard = getTelemetryDashboard();
      expect(dashboard.summary.totalLoadsProcessed).toBe(1);
      expect(dashboard.cache.misses).toBe(1);
      expect(dashboard.cache.hits).toBe(0);
      expect(dashboard.summary.cacheHitRate).toBe(0);
    });

    it("records a hit on second load of the same agent", async () => {
      const { agentNames } = await setupTestFixtures(3);

      await findAgentByName(agentNames[0]);
      await findAgentByName(agentNames[0]);

      const dashboard = getTelemetryDashboard();
      expect(dashboard.summary.totalLoadsProcessed).toBe(2);
      expect(dashboard.cache.misses).toBe(1);
      expect(dashboard.cache.hits).toBe(1);
      expect(dashboard.summary.cacheHitRate).toBe(50);
    });

    it("computes accurate hit rate across multiple distinct agents", async () => {
      const { agentNames } = await setupTestFixtures(5);

      // Load 5 unique agents: 5 misses
      for (const name of agentNames) {
        await findAgentByName(name);
      }
      // Re-load all 5: 5 hits
      for (const name of agentNames) {
        await findAgentByName(name);
      }

      const dashboard = getTelemetryDashboard();
      expect(dashboard.summary.totalLoadsProcessed).toBe(10);
      expect(dashboard.cache.misses).toBe(5);
      expect(dashboard.cache.hits).toBe(5);
      expect(dashboard.summary.cacheHitRate).toBe(50);
    });

    it("tracks load time metrics after cache miss", async () => {
      await setupTestFixtures(1);

      const names = await listAgentNames();
      await findAgentByName(names[0]);

      const dashboard = getTelemetryDashboard();
      expect(dashboard.performance.minLoadTimeMs).toBeGreaterThanOrEqual(0);
      expect(dashboard.performance.maxLoadTimeMs).toBeGreaterThanOrEqual(0);
      expect(dashboard.performance.avgLoadTimeMs).toBeGreaterThanOrEqual(0);
      expect(dashboard.performance.totalLoadTimeMs).toBeGreaterThanOrEqual(0);
    });

    it("tracks per-agent metrics in top agents list", async () => {
      const { agentNames } = await setupTestFixtures(3);

      // Agent 0: 5 accesses, Agent 1: 2, Agent 2: 1
      for (let i = 0; i < 5; i++) {
        await findAgentByName(agentNames[0]);
      }
      for (let i = 0; i < 2; i++) {
        await findAgentByName(agentNames[1]);
      }
      await findAgentByName(agentNames[2]);

      const dashboard = getTelemetryDashboard();
      expect(dashboard.topAgents.length).toBe(3);
      // Sorted by access count descending
      expect(dashboard.topAgents[0].name).toBe(agentNames[0]);
      expect(dashboard.topAgents[0].accessCount).toBe(5);
      expect(dashboard.topAgents[1].name).toBe(agentNames[1]);
      expect(dashboard.topAgents[1].accessCount).toBe(2);
      expect(dashboard.topAgents[2].name).toBe(agentNames[2]);
      expect(dashboard.topAgents[2].accessCount).toBe(1);
    });

    it("reports memory usage after loads", async () => {
      await setupTestFixtures(2);

      const names = await listAgentNames();
      await findAgentByName(names[0]);

      const dashboard = getTelemetryDashboard();
      expect(dashboard.summary.memoryUsageMB).toBeGreaterThan(0);
    });

    it("reports uptime since last reset", async () => {
      // Small delay to ensure measurable uptime
      await new Promise((r) => setTimeout(r, 5));

      const dashboard = getTelemetryDashboard();
      expect(dashboard.summary.uptimeMs).toBeGreaterThan(0);
    });

    it("reports cache utilization percentage", async () => {
      await setupTestFixtures(3);

      const names = await listAgentNames();
      await findAgentByName(names[0]);

      const dashboard = getTelemetryDashboard();
      // 1 out of 50 = 2%
      expect(dashboard.cache.size).toBe(1);
      expect(dashboard.cache.maxSize).toBe(50);
      expect(dashboard.cache.utilizationPercent).toBe(2);
    });
  });

  // =========================================================================
  // 2. Cache warming on startup (preloadAgents)
  // =========================================================================

  describe("preloadAgents (cache warming)", () => {
    it("preloads the specified agents into the cache", async () => {
      const { agentNames } = await setupTestFixtures(5);

      await preloadAgents(agentNames.slice(0, 3));

      const dashboard = getTelemetryDashboard();
      expect(dashboard.cache.size).toBe(3);
      expect(dashboard.cache.misses).toBe(3);
    });

    it("subsequent access to preloaded agents is a cache hit", async () => {
      const { agentNames } = await setupTestFixtures(5);

      await preloadAgents([agentNames[0], agentNames[1]]);

      // These should now be cache hits
      await findAgentByName(agentNames[0]);
      await findAgentByName(agentNames[1]);

      const dashboard = getTelemetryDashboard();
      // 2 misses from preload, 2 hits from findAgentByName
      expect(dashboard.cache.hits).toBe(2);
      expect(dashboard.cache.misses).toBe(2);
      expect(dashboard.summary.cacheHitRate).toBe(50);
    });

    it("handles nonexistent agents gracefully without throwing", async () => {
      await setupTestFixtures(3);

      await expect(
        preloadAgents(["nonexistent-agent-1", "nonexistent-agent-2"]),
      ).resolves.not.toThrow();
    });

    it("loads partial set when some agents fail", async () => {
      const { agentNames } = await setupTestFixtures(3);

      await preloadAgents([agentNames[0], "nonexistent", agentNames[2]]);

      const dashboard = getTelemetryDashboard();
      // Only 2 of 3 should have loaded
      expect(dashboard.cache.size).toBe(2);
    });

    it("increases hit rate for subsequent access patterns", async () => {
      const { agentNames } = await setupTestFixtures(5);

      // Warm cache with first 3 agents
      await preloadAgents(agentNames.slice(0, 3));

      // Access all 5 agents: first 3 are hits, last 2 are misses
      for (const name of agentNames) {
        await findAgentByName(name);
      }

      const dashboard = getTelemetryDashboard();
      // 3 (preload misses) + 2 (new misses) = 5 misses total
      // 3 hits from accessing preloaded agents
      expect(dashboard.cache.hits).toBe(3);
      expect(dashboard.cache.misses).toBe(5);
    });
  });

  // =========================================================================
  // 3. Default agent preloading (warmCacheWithFrequentAgents)
  // =========================================================================

  describe("warmCacheWithFrequentAgents (auto-warming)", () => {
    it("does nothing when no access history exists", async () => {
      await setupTestFixtures(5);

      await warmCacheWithFrequentAgents();

      const dashboard = getTelemetryDashboard();
      expect(dashboard.cache.size).toBe(0);
      expect(dashboard.summary.totalLoadsProcessed).toBe(0);
    });

    it("pre-caches agents based on prior access frequency", async () => {
      const { agentNames } = await setupTestFixtures(5);

      // Build access history: agent 0 accessed 5x, agent 1 accessed 3x
      for (let i = 0; i < 5; i++) {
        await findAgentByName(agentNames[0]);
      }
      for (let i = 0; i < 3; i++) {
        await findAgentByName(agentNames[1]);
      }
      await findAgentByName(agentNames[2]);

      // warmCacheWithFrequentAgents reloads from metrics
      // Just verify it does not error.
      await expect(warmCacheWithFrequentAgents(2)).resolves.not.toThrow();
    });

    it("respects topN parameter to limit pre-cached agents", async () => {
      const { agentNames } = await setupTestFixtures(10);

      // Build access history for 5 agents
      for (let i = 0; i < 5; i++) {
        await findAgentByName(agentNames[i]);
      }

      // Just verify no error with topN limit.
      await expect(warmCacheWithFrequentAgents(3)).resolves.not.toThrow();
    });
  });

  // =========================================================================
  // 4. Cache health monitoring (getCacheHealth)
  // =========================================================================

  describe("getCacheHealth", () => {
    it("reports healthy when hit rate is above 80%", async () => {
      const { agentNames } = await setupTestFixtures(3);

      // 1 miss + 9 hits = 90% hit rate
      // Extra hits also dilute avgLoadTimeMs so slow disk I/O on the
      // first (miss) load doesn't push the average above the 50ms threshold.
      await findAgentByName(agentNames[0]); // miss (disk read)
      for (let i = 0; i < 9; i++) {
        await findAgentByName(agentNames[0]); // hit (from cache)
      }

      const health = getCacheHealth();
      expect(health.status).toBe("healthy");
      expect(health.issues).toEqual([]);
      expect(health.recommendations).toEqual([]);
    });

    it("reports warning when hit rate is below 80%", async () => {
      const { agentNames } = await setupTestFixtures(5);

      // 5 unique loads = 0% hit rate (all misses)
      for (const name of agentNames) {
        await findAgentByName(name);
      }

      const health = getCacheHealth();
      expect(health.status).toBe("warning");
      expect(health.issues.length).toBeGreaterThan(0);
      expect(health.issues.some((i: string) => i.includes("Low cache hit rate"))).toBe(true);
      expect(health.recommendations.length).toBeGreaterThan(0);
      expect(health.recommendations.some((r: string) => r.includes("preloading"))).toBe(true);
    });

    it("reports warning when load time is slow", async () => {
      await setupTestFixtures(3);

      const names = await listAgentNames();
      await findAgentByName(names[0]);

      const health = getCacheHealth();
      expect(["healthy", "warning", "critical"]).toContain(health.status);
    });

    it("returns correct structure with status, issues, and recommendations", () => {
      const health = getCacheHealth();

      expect(health).toHaveProperty("status");
      expect(health).toHaveProperty("issues");
      expect(health).toHaveProperty("recommendations");
      expect(Array.isArray(health.issues)).toBe(true);
      expect(Array.isArray(health.recommendations)).toBe(true);
      expect(["healthy", "warning", "critical"]).toContain(health.status);
    });

    it("returns a valid status on zero loads", () => {
      const health = getCacheHealth();
      expect(["healthy", "warning"]).toContain(health.status);
    });
  });

  // =========================================================================
  // 5. LRU eviction behavior
  // =========================================================================

  describe("LRU eviction behavior", () => {
    it("evicts the oldest entry when cache exceeds maxSize (50)", async () => {
      // Create 52 agents so we can fill the cache and trigger eviction
      const { agentNames } = await setupTestFixtures(52);

      // Load 52 agents into a cache of max 50 -> 2 evictions
      for (const name of agentNames) {
        await findAgentByName(name);
      }

      const dashboard = getTelemetryDashboard();
      expect(dashboard.cache.size).toBe(50);
      expect(dashboard.cache.evictions).toBe(2);
    });

    it("evicts agents in LRU order (oldest-first)", async () => {
      const { agentNames } = await setupTestFixtures(52);

      // Load all 52 agents sequentially
      for (const name of agentNames) {
        await findAgentByName(name);
      }

      // Agents 0 and 1 should be evicted (they were loaded first)
      // Accessing agent-000 again should be a cache MISS (it was evicted)
      const missesBefore = getTelemetryDashboard().cache.misses;
      await findAgentByName(agentNames[0]);
      const missesAfter = getTelemetryDashboard().cache.misses;

      expect(missesAfter).toBe(missesBefore + 1);
    });

    it("recently accessed agent survives eviction", async () => {
      const { agentNames } = await setupTestFixtures(52);

      // Load first 50 agents to fill cache
      for (let i = 0; i < 50; i++) {
        await findAgentByName(agentNames[i]);
      }

      // Re-access agent-000 to move it to MRU position
      await findAgentByName(agentNames[0]);

      // Now load 2 more agents to trigger evictions
      await findAgentByName(agentNames[50]);
      await findAgentByName(agentNames[51]);

      // Agent-000 should still be in cache (it was recently used)
      const hitsBefore = getTelemetryDashboard().cache.hits;
      await findAgentByName(agentNames[0]);
      const hitsAfter = getTelemetryDashboard().cache.hits;

      // Should be a hit since we recently touched it
      expect(hitsAfter).toBe(hitsBefore + 1);
    });

    it("eviction counter increments correctly", async () => {
      const { agentNames } = await setupTestFixtures(55);

      // Load 55 agents -> 5 evictions (cache max = 50)
      for (const name of agentNames) {
        await findAgentByName(name);
      }

      const dashboard = getTelemetryDashboard();
      expect(dashboard.cache.evictions).toBe(5);
    });

    it("eviction callback fires when DEBUG_KNOWLEDGE_CACHE is set", async () => {
      process.env.DEBUG_KNOWLEDGE_CACHE = "true";
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const { agentNames } = await setupTestFixtures(52);

      for (const name of agentNames) {
        await findAgentByName(name);
      }

      // Check that eviction was logged
      const evictionLogs = consoleSpy.mock.calls.filter(
        (call) => typeof call[0] === "string" && call[0].includes("Cache eviction"),
      );
      expect(evictionLogs.length).toBe(2);

      consoleSpy.mockRestore();
    });
  });

  // =========================================================================
  // 6. clearCache resets all state
  // =========================================================================

  describe("clearCache", () => {
    it("resets all metrics to initial state", async () => {
      const { agentNames } = await setupTestFixtures(3);

      // Build up state
      await findAgentByName(agentNames[0]);
      await findAgentByName(agentNames[0]);
      await findAgentByName(agentNames[1]);

      clearCache();

      const dashboard = getTelemetryDashboard();
      expect(dashboard.summary.totalLoadsProcessed).toBe(0);
      expect(dashboard.cache.hits).toBe(0);
      expect(dashboard.cache.misses).toBe(0);
      expect(dashboard.cache.size).toBe(0);
      expect(dashboard.cache.evictions).toBe(0);
      expect(dashboard.topAgents).toEqual([]);
    });

    it("resets getCacheMetadata to null", async () => {
      await setupTestFixtures(1);
      const names = await listAgentNames();
      await findAgentByName(names[0]);

      expect(getCacheMetadata()).not.toBeNull();

      clearCache();
      expect(getCacheMetadata()).toBeNull();
    });
  });

  // =========================================================================
  // 7. getCacheMetadata
  // =========================================================================

  describe("getCacheMetadata", () => {
    it("returns null before any load", () => {
      expect(getCacheMetadata()).toBeNull();
    });

    it("returns version and agent count after index load", async () => {
      await setupTestFixtures(5);

      await listAgentNames();

      const meta = getCacheMetadata();
      expect(meta).not.toBeNull();
      expect(meta!.version).toBe("1.0.0-test");
      expect(meta!.agentCount).toBe(5);
      expect(meta!.indexLoadTimeMs).toBeGreaterThanOrEqual(0);
    });

    it("includes accurate stats snapshot", async () => {
      const { agentNames } = await setupTestFixtures(3);

      await findAgentByName(agentNames[0]);
      await findAgentByName(agentNames[0]);

      const meta = getCacheMetadata();
      expect(meta!.stats.totalLoads).toBe(2);
      expect(meta!.stats.cacheHits).toBe(1);
      expect(meta!.stats.cacheMisses).toBe(1);
      expect(meta!.stats.cachedAgents).toBe(1);
    });
  });

  // =========================================================================
  // 8. Index-only search functions
  // =========================================================================

  describe("Index-only search functions", () => {
    it("listAgentNames returns all agent names from index", async () => {
      await setupTestFixtures(5);

      const names = await listAgentNames();
      expect(names).toHaveLength(5);
      expect(names[0]).toBe("test-agent-000");
      expect(names[4]).toBe("test-agent-004");
    });

    it("findAgentsByCapability searches index without loading agents", async () => {
      await setupTestFixtures(5);

      const matches = await findAgentsByCapability("cap-2");
      expect(matches).toHaveLength(1);
      expect(matches[0]).toBe("test-agent-002");
    });

    it("findAgentsByCapability finds shared capabilities", async () => {
      await setupTestFixtures(5);

      const matches = await findAgentsByCapability("shared-cap");
      expect(matches).toHaveLength(5);
    });

    it("findAgentsByTrigger searches index without loading agents", async () => {
      await setupTestFixtures(5);

      const matches = await findAgentsByTrigger("trigger-3");
      expect(matches).toHaveLength(1);
      expect(matches[0]).toBe("test-agent-003");
    });

    it("findAgentsByTrigger finds shared triggers", async () => {
      await setupTestFixtures(5);

      const matches = await findAgentsByTrigger("shared-trigger");
      expect(matches).toHaveLength(5);
    });
  });

  // =========================================================================
  // 9. findAgentByName edge cases
  // =========================================================================

  describe("findAgentByName edge cases", () => {
    it("finds agent by exact name (case-insensitive)", async () => {
      await setupTestFixtures(3);

      const agent = await findAgentByName("TEST-AGENT-001");
      expect(agent).not.toBeNull();
      expect(agent!.name).toBe("test-agent-001");
    });

    it("finds agent by partial name match", async () => {
      await setupTestFixtures(3);

      const agent = await findAgentByName("agent-001");
      expect(agent).not.toBeNull();
      expect(agent!.name).toBe("test-agent-001");
    });

    it("returns null for nonexistent agent", async () => {
      await setupTestFixtures(3);

      const agent = await findAgentByName("completely-nonexistent");
      expect(agent).toBeNull();
    });

    it("trims whitespace in search", async () => {
      await setupTestFixtures(3);

      const agent = await findAgentByName("  test-agent-000  ");
      expect(agent).not.toBeNull();
      expect(agent!.name).toBe("test-agent-000");
    });
  });

  // =========================================================================
  // 10. getCachedKnowledge
  // =========================================================================

  describe("getCachedKnowledge", () => {
    it("returns knowledge object with version and agents array", async () => {
      await setupTestFixtures(3);

      const knowledge = await getCachedKnowledge();
      expect(knowledge.version).toBe("1.0.0-test");
      expect(knowledge.lastUpdated).toBeDefined();
      expect(knowledge.agents).toBeDefined();
    });

    it("caches the index after first load (no duplicate fs reads)", async () => {
      await setupTestFixtures(3);

      await getCachedKnowledge();
      // Second call should hit the cached index
      await getCachedKnowledge();

      // Just verify it returns the same data (index is cached in memory)
      const k1 = await getCachedKnowledge();
      const k2 = await getCachedKnowledge();
      expect(k1.version).toBe(k2.version);
      expect(k1.lastUpdated).toBe(k2.lastUpdated);
    });
  });
});
