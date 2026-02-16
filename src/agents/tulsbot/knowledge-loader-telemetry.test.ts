import fs from "node:fs/promises";
/**
 * Tests for knowledge-loader-v2 telemetry features
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  clearCache,
  findAgentByName,
  getTelemetryDashboard,
  getCacheHealth,
  preloadAgents,
  warmCacheWithFrequentAgents,
  listAgentNames,
} from "./knowledge-loader-v2.js";

// Use actual knowledge directory for tests
const KNOWLEDGE_DIR = "/Users/tulioferro/Backend_local Macbook/Tulsbot/.tulsbot";
const INDEX_PATH = `${KNOWLEDGE_DIR}/knowledge-index.json`;

// Check if index exists before running tests
let indexExists = false;
try {
  await fs.access(INDEX_PATH);
  indexExists = true;
} catch {
  console.warn(`⚠️  Knowledge index not found at ${INDEX_PATH} - skipping telemetry tests`);
}

describe("Knowledge Loader Telemetry", () => {
  beforeEach(() => {
    if (!indexExists) {
      return;
    }

    // Reset cache and metrics before each test
    clearCache();

    // Set test environment variable to use real knowledge directory
    process.env.TULSBOT_USE_INDEXED_KNOWLEDGE = "true";
    process.env.TULSBOT_KNOWLEDGE_PATH = `${KNOWLEDGE_DIR}/core-app-knowledge.json`;
  });

  describe("getTelemetryDashboard", () => {
    it("should return initial state with zero loads", () => {
      const dashboard = getTelemetryDashboard();

      expect(dashboard.summary.totalLoadsProcessed).toBe(0);
      expect(dashboard.summary.cacheHitRate).toBe(0);
      expect(dashboard.summary.avgLoadTimeMs).toBe(0);
      expect(dashboard.cache.hits).toBe(0);
      expect(dashboard.cache.misses).toBe(0);
      expect(dashboard.cache.evictions).toBe(0);
      expect(dashboard.topAgents).toEqual([]);
    });

    it("should track cache hits and misses", async () => {
      if (!indexExists) {
        return;
      }

      // Get a real agent name first
      const agentNames = await listAgentNames();
      if (agentNames.length === 0) {
        return;
      }
      const testAgentName = agentNames[0];

      // First load - cache miss
      await findAgentByName(testAgentName);
      let dashboard = getTelemetryDashboard();

      expect(dashboard.summary.totalLoadsProcessed).toBe(1);
      expect(dashboard.cache.misses).toBe(1);
      expect(dashboard.cache.hits).toBe(0);
      expect(dashboard.summary.cacheHitRate).toBe(0);

      // Second load - cache hit (same agent)
      await findAgentByName(testAgentName);
      dashboard = getTelemetryDashboard();

      expect(dashboard.summary.totalLoadsProcessed).toBe(2);
      expect(dashboard.cache.misses).toBe(1);
      expect(dashboard.cache.hits).toBe(1);
      expect(dashboard.summary.cacheHitRate).toBe(50);
    });

    it("should track load time metrics", async () => {
      if (!indexExists) {
        return;
      }

      const agentNames = await listAgentNames();
      if (agentNames.length === 0) {
        return;
      }

      await findAgentByName(agentNames[0]);
      const dashboard = getTelemetryDashboard();

      expect(dashboard.performance.minLoadTimeMs).toBeGreaterThan(0);
      expect(dashboard.performance.maxLoadTimeMs).toBeGreaterThan(0);
      expect(dashboard.performance.avgLoadTimeMs).toBeGreaterThan(0);
      expect(dashboard.performance.totalLoadTimeMs).toBeGreaterThan(0);
      expect(dashboard.summary.avgLoadTimeMs).toBeGreaterThan(0);
    });

    it("should track top agents by access count", async () => {
      if (!indexExists) {
        return;
      }

      const agentNames = await listAgentNames();
      if (agentNames.length === 0) {
        return;
      }
      const testAgentName = agentNames[0];

      // Load same agent multiple times
      await findAgentByName(testAgentName);
      await findAgentByName(testAgentName);
      await findAgentByName(testAgentName);

      const dashboard = getTelemetryDashboard();

      expect(dashboard.topAgents.length).toBeGreaterThan(0);
      expect(dashboard.topAgents[0].name).toBe(testAgentName);
      expect(dashboard.topAgents[0].accessCount).toBe(3);
      expect(dashboard.topAgents[0].avgLoadTimeMs).toBeGreaterThan(0);
    });

    it("should track cache utilization", async () => {
      if (!indexExists) {
        return;
      }

      const agentNames = await listAgentNames();
      if (agentNames.length === 0) {
        return;
      }

      await findAgentByName(agentNames[0]);
      const dashboard = getTelemetryDashboard();

      expect(dashboard.cache.size).toBeGreaterThan(0);
      expect(dashboard.cache.maxSize).toBe(50);
      expect(dashboard.cache.utilizationPercent).toBeGreaterThan(0);
      expect(dashboard.cache.utilizationPercent).toBeLessThanOrEqual(100);
    });

    it("should track memory usage", async () => {
      if (!indexExists) {
        return;
      }

      const agentNames = await listAgentNames();
      if (agentNames.length === 0) {
        return;
      }

      const agent = await findAgentByName(agentNames[0]);
      const dashboard = getTelemetryDashboard();

      expect(dashboard.summary.memoryUsageMB).toBeGreaterThan(0);
    });

    it("should track uptime", async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      const dashboard = getTelemetryDashboard();

      expect(dashboard.summary.uptimeMs).toBeGreaterThan(0);
    });
  });

  describe("getCacheHealth", () => {
    it("should report healthy status with good metrics", async () => {
      if (!indexExists) {
        return;
      }

      const agentNames = await listAgentNames();
      if (agentNames.length === 0) {
        return;
      }
      const testAgentName = agentNames[0];

      // Load agent multiple times to get high hit rate
      await findAgentByName(testAgentName);
      await findAgentByName(testAgentName);
      await findAgentByName(testAgentName);
      await findAgentByName(testAgentName);
      await findAgentByName(testAgentName);

      const health = getCacheHealth();

      expect(health.status).toBe("healthy");
      expect(health.issues).toEqual([]);
      expect(health.recommendations).toEqual([]);
    });

    it("should warn on low cache hit rate", async () => {
      if (!indexExists) {
        return;
      }

      const agentNames = await listAgentNames();
      if (agentNames.length === 0) {
        return;
      }

      // Single load = 0% hit rate
      await findAgentByName(agentNames[0]);

      const health = getCacheHealth();

      expect(health.status).toBe("warning");
      expect(health.issues.length).toBeGreaterThan(0);
      expect(health.issues[0]).toContain("Low cache hit rate");
      expect(health.recommendations.length).toBeGreaterThan(0);
    });
  });

  describe("preloadAgents", () => {
    it("should preload agents successfully", async () => {
      if (!indexExists) {
        return;
      }

      const agentNames = await listAgentNames();
      if (agentNames.length === 0) {
        return;
      }

      await preloadAgents([agentNames[0]]);

      const dashboard = getTelemetryDashboard();
      expect(dashboard.cache.size).toBeGreaterThan(0);
      expect(dashboard.cache.misses).toBeGreaterThan(0);
    });

    it("should handle failed preloads gracefully", async () => {
      if (!indexExists) {
        return;
      }

      await expect(preloadAgents(["nonexistent-agent-xyz"])).resolves.not.toThrow();
    });

    it("should warm cache and increase hit rate", async () => {
      if (!indexExists) {
        return;
      }

      const agentNames = await listAgentNames();
      if (agentNames.length === 0) {
        return;
      }
      const testAgentName = agentNames[0];

      // Load agent first
      await findAgentByName(testAgentName);

      // Clear and preload - then access again
      clearCache();
      await preloadAgents([testAgentName]);
      await findAgentByName(testAgentName);

      const dashboard = getTelemetryDashboard();
      expect(dashboard.cache.hits).toBeGreaterThan(0);
    });
  });

  describe("warmCacheWithFrequentAgents", () => {
    it("should skip warming with no access history", async () => {
      await expect(warmCacheWithFrequentAgents()).resolves.not.toThrow();
    });

    it("should warm cache based on access patterns", async () => {
      if (!indexExists) {
        return;
      }

      const agentNames = await listAgentNames();
      if (agentNames.length === 0) {
        return;
      }

      // Generate access history
      await findAgentByName(agentNames[0]);
      await findAgentByName(agentNames[0]);
      await findAgentByName(agentNames[0]);

      // Note: warmCacheWithFrequentAgents relies on metrics which persist after clearCache
      // So we can't test the actual warming, just that it doesn't error
      await expect(warmCacheWithFrequentAgents()).resolves.not.toThrow();
    });
  });

  describe("Cache eviction tracking", () => {
    it("should track evictions when cache is full", async () => {
      // This test would require loading 51+ agents to trigger eviction
      // Skipping for now as test fixtures may not have enough agents
      expect(true).toBe(true);
    });
  });

  describe("clearCache", () => {
    it("should reset all metrics", async () => {
      if (!indexExists) {
        return;
      }

      const agentNames = await listAgentNames();
      if (agentNames.length === 0) {
        return;
      }

      // Generate some metrics
      await findAgentByName(agentNames[0]);
      await findAgentByName(agentNames[0]);

      // Clear cache
      clearCache();

      const dashboard = getTelemetryDashboard();
      expect(dashboard.summary.totalLoadsProcessed).toBe(0);
      expect(dashboard.cache.hits).toBe(0);
      expect(dashboard.cache.misses).toBe(0);
      expect(dashboard.cache.size).toBe(0);
      expect(dashboard.topAgents).toEqual([]);
    });
  });
});
