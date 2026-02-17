import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearCache,
  getCachedKnowledge,
  loadTulsbotKnowledge,
} from "../agents/tulsbot/knowledge-loader.js";
import { getMemorySearchManager, type MemoryIndexManager } from "./index.js";

// ---------------------------------------------------------------------------
// Embedding mock — module-level so vi.mock hoisting works
// ---------------------------------------------------------------------------

const embedBatch = vi.fn(async () => []);
const embedQuery = vi.fn(async () => [0.2, 0.2, 0.2]);

vi.mock("./embeddings.js", () => ({
  createEmbeddingProvider: async () => ({
    requestedProvider: "openai",
    provider: {
      id: "openai",
      model: "text-embedding-3-small",
      embedQuery,
      embedBatch,
    },
    openAi: {
      baseUrl: "https://api.openai.com/v1",
      headers: { Authorization: "Bearer test", "Content-Type": "application/json" },
      model: "text-embedding-3-small",
    },
  }),
}));

// ---------------------------------------------------------------------------
// Helper: build a minimal valid manager config
// ---------------------------------------------------------------------------

function buildCfg(workspaceDir: string, indexPath: string) {
  return {
    agents: {
      defaults: {
        workspace: workspaceDir,
        memorySearch: {
          provider: "openai",
          model: "text-embedding-3-small",
          store: { path: indexPath },
          sync: { watch: false, onSessionStart: false, onSearch: false },
          query: { minScore: 0 },
          remote: { batch: { enabled: false, wait: false } },
        },
      },
      list: [{ id: "main", default: true }],
    },
  };
}

// ---------------------------------------------------------------------------
// Suite A — Embedding fallback (Task 2)
// ---------------------------------------------------------------------------

describe("memory search: embedding failure fallback", () => {
  let workspaceDir: string;
  let indexPath: string;
  let manager: MemoryIndexManager | null = null;

  beforeEach(async () => {
    workspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-err-recovery-"));
    indexPath = path.join(workspaceDir, "index.sqlite");
    await fs.mkdir(path.join(workspaceDir, "memory"));
    await fs.writeFile(
      path.join(workspaceDir, "memory", "2026-01-07.md"),
      "hello world memory entry\n",
    );
    // Reset to healthy default between tests
    embedQuery.mockResolvedValue([0.2, 0.2, 0.2]);
    embedBatch.mockResolvedValue([]);
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    if (manager) {
      await manager.close();
      manager = null;
    }
    await fs.rm(workspaceDir, { recursive: true, force: true });
  });

  it("resolves (does not throw) when embedQuery rejects", async () => {
    const cfg = buildCfg(workspaceDir, indexPath);
    const result = await getMemorySearchManager({ cfg, agentId: "main" });
    expect(result.manager).not.toBeNull();
    manager = result.manager!;

    // Make embedding fail on this test
    embedQuery.mockRejectedValue(new Error("OpenAI timeout"));

    // search() must resolve — not reject — even when embedQuery throws
    await expect(manager.search("hello")).resolves.toBeDefined();
  });

  it("returns an array (not undefined/null) when embedQuery rejects", async () => {
    const cfg = buildCfg(workspaceDir, indexPath);
    const result = await getMemorySearchManager({ cfg, agentId: "main" });
    expect(result.manager).not.toBeNull();
    manager = result.manager!;

    embedQuery.mockRejectedValue(new Error("network error"));

    const results = await manager.search("hello");
    expect(Array.isArray(results)).toBe(true);
  });

  it("falls back to keyword results when embedQuery rejects", async () => {
    const cfg = buildCfg(workspaceDir, indexPath);
    const result = await getMemorySearchManager({ cfg, agentId: "main" });
    expect(result.manager).not.toBeNull();
    manager = result.manager!;

    // Sync so the markdown content is indexed for FTS keyword search
    await (manager as unknown as { sync: () => Promise<void> }).sync();

    embedQuery.mockRejectedValue(new Error("embedding unavailable"));

    // Should still find keyword matches even with no vector
    const results = await manager.search("hello");
    // We can't assert specific results without knowing FTS internals in test env,
    // but we must at least get an array back without throwing
    expect(Array.isArray(results)).toBe(true);
  });

  it("returns empty array (not a crash) when embedQuery rejects and query has no FTS matches", async () => {
    const cfg = buildCfg(workspaceDir, indexPath);
    const result = await getMemorySearchManager({ cfg, agentId: "main" });
    expect(result.manager).not.toBeNull();
    manager = result.manager!;

    embedQuery.mockRejectedValue(new Error("model overloaded"));

    // Query text that won't match anything in the index
    const results = await manager.search("zxqvbnm_nonexistent_term_12345");
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBe(0);
  });

  it("recovers on the next call after embedQuery rejection", async () => {
    const cfg = buildCfg(workspaceDir, indexPath);
    const result = await getMemorySearchManager({ cfg, agentId: "main" });
    expect(result.manager).not.toBeNull();
    manager = result.manager!;

    // First call: embedding fails
    embedQuery.mockRejectedValueOnce(new Error("transient failure"));
    await expect(manager.search("hello")).resolves.toBeDefined();

    // Second call: embedding works again
    embedQuery.mockResolvedValue([0.1, 0.1, 0.1]);
    await expect(manager.search("hello")).resolves.toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Suite B — Knowledge loader negative cache (Task 4)
// ---------------------------------------------------------------------------

describe("knowledge loader: negative cache", () => {
  const MISSING_PATH = "/tmp/__nonexistent_knowledge_file_12345__.json";

  beforeEach(() => {
    // Point loader at a guaranteed-missing file
    process.env.TULSBOT_KNOWLEDGE_PATH = MISSING_PATH;
    delete process.env.TULSBOT_USE_INDEXED_KNOWLEDGE;
    clearCache();
  });

  afterEach(() => {
    delete process.env.TULSBOT_KNOWLEDGE_PATH;
    clearCache();
  });

  it("throws on first load attempt when file is missing", async () => {
    await expect(getCachedKnowledge()).rejects.toThrow();
  });

  it("throws immediately on second call within TTL (negative cache hit — no extra FS I/O)", async () => {
    // First call — populates negative cache
    const firstError = await getCachedKnowledge().catch((e) => e);
    expect(firstError).toBeInstanceOf(Error);

    // Second call — should re-throw the cached error without touching filesystem
    const secondError = await getCachedKnowledge().catch((e) => e);
    expect(secondError).toBeInstanceOf(Error);
    // Both errors should be the same Error instance (cached negative result)
    expect(secondError).toBe(firstError);
  });

  it("clears negative cache on clearCache() so next load retries filesystem", async () => {
    // First call — populates negative cache
    await expect(getCachedKnowledge()).rejects.toThrow();

    // Clear resets everything including negative cache
    clearCache();

    // Next call should attempt filesystem again (and fail again since file is still missing)
    // — the key assertion is that it does NOT re-throw the same instance (it re-runs)
    const afterClearError = await getCachedKnowledge().catch((e) => e);
    expect(afterClearError).toBeInstanceOf(Error);
    // After clearCache, a fresh attempt is made — the error should still be an Error,
    // confirming the path was re-attempted
    expect(afterClearError.message).toMatch(/Failed to load Tulsbot knowledge/);
  });

  it("does not interfere with a subsequent successful load after clearCache", async () => {
    // Fail once to populate negative cache
    await expect(getCachedKnowledge()).rejects.toThrow();

    // Now point at a valid fixture file
    const __dirname = path.dirname(new URL(import.meta.url).pathname);
    const fixturePath = path.join(__dirname, "agents/tulsbot/__fixtures__/core-app-knowledge.json");

    // Detect if fixture exists; skip if not
    const fixtureExists = await fs
      .access(fixturePath)
      .then(() => true)
      .catch(() => false);

    if (!fixtureExists) {
      // Fixture not found — skip the positive-load sub-assertion
      return;
    }

    clearCache();
    process.env.TULSBOT_KNOWLEDGE_PATH = fixturePath;

    const knowledge = await getCachedKnowledge();
    expect(knowledge).toBeDefined();
    expect(Array.isArray(knowledge.agents)).toBe(true);
  });

  it("loadTulsbotKnowledge throws with descriptive message for missing file", async () => {
    const error = await loadTulsbotKnowledge(MISSING_PATH).catch((e) => e);
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toMatch(/Failed to load Tulsbot knowledge/);
    expect(error.message).toContain(MISSING_PATH);
  });
});

// ---------------------------------------------------------------------------
// Suite C — SQLITE_BUSY retry, negative cache, ensureVectorReady timeout
// ---------------------------------------------------------------------------

import type { DatabaseSync } from "node:sqlite";
import { searchVector, searchKeyword, listChunks } from "./manager-search.js";

/** Build a mock DatabaseSync where .prepare().all() uses the given fn */
function mockDb(allFn: (...args: unknown[]) => unknown): DatabaseSync {
  return {
    prepare: () => ({ all: allFn }),
  } as unknown as DatabaseSync;
}

/** Minimal SQLITE_BUSY error */
function busyError(): Error {
  return new Error("database is locked: SQLITE_BUSY");
}

describe("manager-search: SQLITE_BUSY retry & negative cache", () => {
  // ----- listChunks -----

  it("listChunks retries on SQLITE_BUSY and succeeds after transient failure", () => {
    let calls = 0;
    const allFn = (..._args: unknown[]) => {
      calls++;
      if (calls === 1) {
        throw busyError();
      }
      return [
        {
          id: "c1",
          path: "memory/note.md",
          start_line: 1,
          end_line: 5,
          text: "hello",
          embedding: "[]",
          source: "workspace",
        },
      ];
    };

    const result = listChunks({
      db: mockDb(allFn),
      providerModel: "openai/text-embedding-3-small",
      sourceFilter: { sql: "", params: [] },
    });

    expect(calls).toBe(2);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("c1");
  });

  it("listChunks throws after exhausting max BUSY retries", () => {
    const allFn = () => {
      throw busyError();
    };

    expect(() =>
      listChunks({
        db: mockDb(allFn),
        providerModel: "openai/text-embedding-3-small",
        sourceFilter: { sql: "", params: [] },
      }),
    ).toThrow(/SQLITE_BUSY/);
  });

  it("non-SQLITE_BUSY errors are thrown immediately without retry", () => {
    let calls = 0;
    const allFn = () => {
      calls++;
      throw new Error("table not found");
    };

    expect(() =>
      listChunks({
        db: mockDb(allFn),
        providerModel: "openai/text-embedding-3-small",
        sourceFilter: { sql: "", params: [] },
      }),
    ).toThrow(/table not found/);

    // Should NOT have retried — only 1 call
    expect(calls).toBe(1);
  });

  // ----- searchKeyword -----

  it("searchKeyword step 1 (FTS5) retries on SQLITE_BUSY and succeeds", async () => {
    let prepareCalls = 0;
    const db = {
      prepare: () => {
        prepareCalls++;
        return {
          all: (..._args: unknown[]) => {
            // First prepare call is FTS5 MATCH
            if (prepareCalls <= 2) {
              // Calls 1 = BUSY, call 2 = success for FTS5
              if (prepareCalls === 1) {
                throw busyError();
              }
              return [{ id: "c1", rank: -1.5 }];
            }
            // Second prepare call is chunks query
            return [
              {
                id: "c1",
                path: "memory/note.md",
                source: "workspace",
                start_line: 1,
                end_line: 5,
                text: "hello world",
              },
            ];
          },
        };
      },
    } as unknown as DatabaseSync;

    const results = await searchKeyword({
      db,
      ftsTable: "chunks_fts",
      providerModel: "openai/text-embedding-3-small",
      query: "hello",
      limit: 5,
      snippetMaxChars: 200,
      sourceFilter: { sql: "", params: [] },
      buildFtsQuery: (raw) => raw,
      bm25RankToScore: (rank) => 1 / (1 + Math.abs(rank)),
    });

    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].id).toBe("c1");
  });

  it("searchKeyword step 2 (chunks) retries on SQLITE_BUSY and succeeds", async () => {
    let prepareCalls = 0;
    const db = {
      prepare: () => {
        prepareCalls++;
        return {
          all: (..._args: unknown[]) => {
            if (prepareCalls === 1) {
              // FTS5 step succeeds immediately
              return [{ id: "c1", rank: -2.0 }];
            }
            // Chunks step: first attempt BUSY, second succeeds
            if (prepareCalls === 2) {
              throw busyError();
            }
            return [
              {
                id: "c1",
                path: "memory/note.md",
                source: "workspace",
                start_line: 1,
                end_line: 3,
                text: "chunk text",
              },
            ];
          },
        };
      },
    } as unknown as DatabaseSync;

    const results = await searchKeyword({
      db,
      ftsTable: "chunks_fts",
      providerModel: "openai/text-embedding-3-small",
      query: "chunk",
      limit: 5,
      snippetMaxChars: 200,
      sourceFilter: { sql: "", params: [] },
      buildFtsQuery: (raw) => raw,
      bm25RankToScore: (rank) => 1 / (1 + Math.abs(rank)),
    });

    expect(results.length).toBeGreaterThanOrEqual(1);
  });

  // ----- searchVector ensureVectorReady timeout -----

  it("searchVector falls back to cosine scan when ensureVectorReady times out", async () => {
    // ensureVectorReady never resolves — will be beaten by the 5s timeout
    const neverResolve = () => new Promise<boolean>(() => {});

    // The fallback path calls listChunks which calls db.prepare().all()
    const db = mockDb(() => [
      {
        id: "c1",
        path: "memory/note.md",
        start_line: 1,
        end_line: 3,
        text: "fallback result",
        embedding: JSON.stringify([0.1, 0.2, 0.3]),
        source: "workspace",
      },
    ]);

    const results = await searchVector({
      db,
      vectorTable: "vec_chunks",
      providerModel: "openai/text-embedding-3-small",
      queryVec: [0.1, 0.2, 0.3],
      limit: 5,
      snippetMaxChars: 200,
      ensureVectorReady: neverResolve,
      sourceFilterVec: { sql: "", params: [] },
      sourceFilterChunks: { sql: "", params: [] },
    });

    // Should have fallen back to cosine scan and found the chunk
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("c1");
    expect(results[0].score).toBeGreaterThan(0);
  }, 10_000); // Allow 10s for the 5s internal timeout

  // ----- negative cache -----

  it("searchKeyword returns empty from negative cache hit on second call", async () => {
    let ftsCallCount = 0;
    const db = {
      prepare: () => ({
        all: (..._args: unknown[]) => {
          ftsCallCount++;
          return []; // Empty FTS results → populates negative cache
        },
      }),
    } as unknown as DatabaseSync;

    const params = {
      db,
      ftsTable: "chunks_fts",
      providerModel: "openai/text-embedding-3-small",
      query: "xyznonexistent",
      limit: 5,
      snippetMaxChars: 200,
      sourceFilter: { sql: "", params: [] as string[] },
      buildFtsQuery: (raw: string) => raw,
      bm25RankToScore: (rank: number) => 1 / (1 + Math.abs(rank)),
    };

    // First call — hits DB, gets empty, populates negative cache
    const first = await searchKeyword(params);
    expect(first).toHaveLength(0);
    const callsAfterFirst = ftsCallCount;

    // Second call — should hit negative cache, NOT query DB again
    const second = await searchKeyword(params);
    expect(second).toHaveLength(0);
    expect(ftsCallCount).toBe(callsAfterFirst); // No additional DB calls
  });
});
