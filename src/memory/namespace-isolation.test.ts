/**
 * Namespace Isolation Test
 *
 * Verifies that memory queries can be filtered by namespace to isolate
 * Tulsbot memories from other agent memories.
 */

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { OpenClawConfig } from "../config/config.js";
import { MemoryIndexManager } from "./manager.js";

// Mock the embedding provider to avoid requiring API keys in tests
vi.mock("./embeddings.js", () => ({
  createEmbeddingProvider: vi.fn(async () => ({
    provider: {
      id: "mock-provider",
      model: "mock-model",
      embedQuery: async (_text: string) => Array.from({ length: 1536 }, () => 0),
      embedBatch: async (texts: string[]) => texts.map(() => Array.from({ length: 1536 }, () => 0)),
    },
    requestedProvider: "openai" as const,
  })),
}));

describe("Memory Namespace Isolation", () => {
  let tempDir: string;
  let manager: MemoryIndexManager;

  beforeAll(async () => {
    // Create temporary directory for test
    tempDir = path.join(os.tmpdir(), `openclaw-namespace-test-${Date.now()}`);
    const memoryDir = path.join(tempDir, "memory");
    await fs.mkdir(memoryDir, { recursive: true });

    // Create test memory files with different namespaces (in memory/ subdirectory)
    const tulsbotMemory = path.join(memoryDir, "tulsbot-memory.md");
    await fs.writeFile(
      tulsbotMemory,
      `---
namespace: "tulsbot"
source: "notebooklm"
---

Tulsbot has 17 specialized sub-agents for knowledge management.
The Orchestrator sub-agent coordinates all other agents.`,
      "utf-8",
    );

    const defaultMemory = path.join(memoryDir, "default-memory.md");
    await fs.writeFile(
      defaultMemory,
      `---
source: "user"
---

This is a general memory without namespace.
It should be returned when no namespace filter is applied.`,
      "utf-8",
    );

    const otherAgentMemory = path.join(memoryDir, "other-agent-memory.md");
    await fs.writeFile(
      otherAgentMemory,
      `---
namespace: "research-agent"
source: "user"
---

This is a memory from the research agent.
It should be isolated from Tulsbot queries.`,
      "utf-8",
    );

    // Initialize memory manager using static get() method
    const testConfig: OpenClawConfig = {
      agentId: "test-agent",
      workspaceDir: tempDir,
      agents: {
        defaultModel: "gpt-4o-mini",
        defaults: {
          // Configure hybrid search to use only FTS since vector is disabled
          memorySearch: {
            query: {
              hybrid: {
                enabled: true,
                vectorWeight: 0,
                textWeight: 1,
              },
            },
          },
        },
        list: [
          {
            id: "test-agent",
            name: "Test Agent",
            enabled: true,
            channels: [],
            workspace: tempDir, // CRITICAL: resolveAgentWorkspaceDir reads this, not top-level workspaceDir
          },
        ],
      },
      memory: {
        file: {
          enabled: true,
          sources: ["memory"],
          embedProvider: {
            kind: "openai",
            model: "text-embedding-3-small",
          },
          vector: { enabled: false },
          fts: { enabled: true },
        },
      },
    };

    const result = await MemoryIndexManager.get({
      cfg: testConfig,
      agentId: "test-agent",
    });

    if (!result) {
      throw new Error("Failed to initialize MemoryIndexManager");
    }

    manager = result;

    // Sync to index all files
    await manager.sync({ reason: "test-setup", force: true });

    // Debug: Check if files were indexed
    const status = manager.status();
    console.log("Manager status after sync:", JSON.stringify(status, null, 2));
    console.log("\n=== Provider Info ===");
    console.log("Provider model:", status.model);

    // Debug: Check FTS error if available is false
    if (!status.fts.available) {
      console.log("\n=== FTS NOT AVAILABLE ===");
      console.log("FTS load error:", status.fts.loadError || "(no error message)");
    }
  });

  afterAll(async () => {
    // Cleanup
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("should return only Tulsbot memories when namespace filter is applied", async () => {
    // Debug: Check what's actually in the database tables
    const db = (manager as unknown as { db: import("better-sqlite3").Database }).db; // Access private db for debugging
    const chunksData = db.prepare("SELECT id, text, metadata, source, model FROM chunks").all();
    console.log("\n=== Database chunks table ===");
    console.log("Chunks count:", chunksData.length);
    chunksData.forEach((chunk: Record<string, unknown>, i: number) => {
      console.log(`\nChunk ${i + 1}:`);
      console.log("  text length:", (chunk.text as string)?.length || 0);
      console.log("  text preview:", (chunk.text as string)?.substring(0, 100) || "(empty)");
      console.log("  metadata:", chunk.metadata);
      console.log("  source:", chunk.source);
      console.log("  model:", chunk.model);
    });

    const ftsData = db.prepare("SELECT text, id, model FROM chunks_fts LIMIT 10").all();
    console.log("\n=== FTS table (chunks_fts) ===");
    console.log("FTS rows:", ftsData.length);
    ftsData.forEach((row: Record<string, unknown>, i: number) => {
      console.log(`FTS row ${i + 1}:`);
      console.log("  text:", (row.text as string)?.substring(0, 100) || "(empty)");
      console.log("  id:", row.id);
      console.log("  model:", row.model);
    });

    // Debug: Compare IDs between chunks and chunks_fts
    console.log("\n=== ID Comparison ===");
    const chunkIds = db.prepare("SELECT id FROM chunks ORDER BY id").all();
    const ftsIds = db.prepare("SELECT id FROM chunks_fts ORDER BY id").all();
    console.log("Chunks IDs:", chunkIds);
    console.log("FTS IDs:", ftsIds);
    console.log("IDs match?", JSON.stringify(chunkIds) === JSON.stringify(ftsIds));

    // Debug: Test simple JOIN query without any WHERE clause
    console.log("\n=== Simple JOIN Test (no WHERE) ===");
    try {
      const simpleJoin = db
        .prepare("SELECT COUNT(*) as count FROM chunks_fts f JOIN chunks c ON c.id = f.id")
        .get();
      console.log("Simple JOIN result:", simpleJoin);
    } catch (err) {
      console.log("Simple JOIN error:", err);
    }

    // Debug: Test JOIN with only FTS MATCH (no model/source filters)
    console.log("\n=== JOIN with MATCH Only ===");
    try {
      const joinWithMatch = db
        .prepare(
          "SELECT COUNT(*) as count FROM chunks_fts f JOIN chunks c ON c.id = f.id WHERE f MATCH 'Tulsbot'",
        )
        .get();
      console.log("JOIN with MATCH 'Tulsbot':", joinWithMatch);
    } catch (err) {
      console.log("JOIN with MATCH error:", err);
    }

    // Debug: Test FTS5 MATCH directly (no filters)
    console.log("\n=== Direct FTS5 MATCH Tests ===");
    try {
      const directMatch1 = db
        .prepare("SELECT COUNT(*) as count FROM chunks_fts WHERE chunks_fts MATCH 'Tulsbot'")
        .get();
      console.log("Direct MATCH 'Tulsbot':", directMatch1);

      const directMatch2 = db
        .prepare("SELECT COUNT(*) as count FROM chunks_fts WHERE chunks_fts MATCH 'agent'")
        .get();
      console.log("Direct MATCH 'agent':", directMatch2);

      const directMatch3 = db
        .prepare("SELECT COUNT(*) as count FROM chunks_fts WHERE chunks_fts MATCH 'Orchestrator'")
        .get();
      console.log("Direct MATCH 'Orchestrator':", directMatch3);

      const directMatch4 = db
        .prepare("SELECT COUNT(*) as count FROM chunks_fts WHERE chunks_fts MATCH 'sub'")
        .get();
      console.log("Direct MATCH 'sub':", directMatch4);
    } catch (err) {
      console.log("FTS5 MATCH error:", err);
    }

    // Debug: Check model values in FTS table
    console.log("\n=== Model Values in FTS Table ===");
    const ftsModels = db.prepare("SELECT DISTINCT model FROM chunks_fts").all();
    console.log("FTS table models:", ftsModels);

    // Debug: Check model values in chunks table
    const chunksModels = db.prepare("SELECT DISTINCT model FROM chunks").all();
    console.log("Chunks table models:", chunksModels);

    // Debug: Check what providerModel is being used
    const status = manager.status();
    console.log("Manager providerModel:", status.model);

    // Debug: Test FTS5 MATCH with model filter
    console.log("\n=== FTS5 MATCH with Model Filter ===");
    try {
      const withModel = db
        .prepare(
          "SELECT COUNT(*) as count FROM chunks_fts WHERE chunks_fts MATCH 'Tulsbot' AND model = ?",
        )
        .get("mock-model");
      console.log("MATCH 'Tulsbot' AND model = 'mock-model':", withModel);
    } catch (err) {
      console.log("FTS5 MATCH with model filter error:", err);
    }

    // Debug: Check what FTS query is generated
    const { buildFtsQuery } = await import("../memory/hybrid.js");
    console.log("\n=== FTS Query Generation ===");
    console.log("Input: 'sub-agents' -> FTS Query:", buildFtsQuery("sub-agents"));
    console.log("Input: 'Orchestrator' -> FTS Query:", buildFtsQuery("Orchestrator"));
    console.log("Input: 'Tulsbot' -> FTS Query:", buildFtsQuery("Tulsbot"));
    console.log("Input: 'agent' -> FTS Query:", buildFtsQuery("agent"));

    // Debug: Try searching without namespace first
    const allResults = await manager.search("sub-agents", { maxResults: 10 });
    console.log("\n=== Search 'sub-agents' (no namespace filter) ===");
    console.log("Results count:", allResults.length);
    if (allResults.length > 0) {
      console.log("First result:", JSON.stringify(allResults[0], null, 2));
    }

    // Try different search terms
    const agentResults = await manager.search("agent", { maxResults: 10 });
    console.log("\n=== Search 'agent' (no namespace filter) ===");
    console.log("Results count:", agentResults.length);

    const tulsbotResults = await manager.search("Tulsbot", { maxResults: 10 });
    console.log("\n=== Search 'Tulsbot' (no namespace filter) ===");
    console.log("Results count:", tulsbotResults.length);
    if (tulsbotResults.length > 0) {
      console.log("First result preview:", tulsbotResults[0].text?.substring(0, 100));
    }

    // Test non-hyphenated word first to verify FTS works
    const orchestratorResults = await manager.search("Orchestrator", { maxResults: 10 });
    console.log("\n=== Search 'Orchestrator' (no namespace filter) ===");
    console.log("Results count:", orchestratorResults.length);
    if (orchestratorResults.length > 0) {
      console.log("First result preview:", orchestratorResults[0].text?.substring(0, 100));
    }

    const results = await manager.search("sub-agents", {
      namespace: "tulsbot",
      maxResults: 10,
    });

    console.log("\n=== Search 'sub-agents' (namespace: tulsbot) ===");
    console.log("Results count:", results.length);

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].snippet).toContain("Tulsbot");
    expect(results[0].snippet).not.toContain("research agent");
  });

  it("should return only research-agent memories when namespace filter is applied", async () => {
    const results = await manager.search("memory", {
      namespace: "research-agent",
      maxResults: 10,
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].snippet).toContain("research agent");
    expect(results[0].snippet).not.toContain("sub-agents");
  });

  it("should return all memories when no namespace filter is applied", async () => {
    const results = await manager.search("memory", {
      maxResults: 10,
    });

    expect(results.length).toBeGreaterThan(0);
    // Should include results from multiple namespaces
    const texts = results.map((r) => r.snippet).join(" ");
    expect(texts).toContain("memory");
  });

  it("should return empty results when searching non-existent namespace", async () => {
    const results = await manager.search("anything", {
      namespace: "non-existent-namespace",
      maxResults: 10,
    });

    expect(results.length).toBe(0);
  });
});
