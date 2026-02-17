/**
 * Benchmark Test: SQLite Index Performance
 *
 * Verifies that the indexes added in migration 002 are present and make
 * common query patterns complete within generous wall-clock budgets.
 * Thresholds are intentionally wide to pass on slow CI machines.
 *
 * Thresholds (after warm-up)
 * --------------------------
 *   namespace query  < 500 ms
 *   session_id query  < 200 ms
 *   model filter      < 500 ms
 *   source filter     < 200 ms
 *   updated_at range  < 200 ms
 */

import type { DatabaseSync } from "node:sqlite";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { ensureMemoryIndexSchema } from "./memory-schema.js";
import { requireNodeSqlite } from "./sqlite.js";

const RECORD_COUNT = 1000;
const MODEL = "text-embedding-3-small";
const EMBEDDING_STUB = JSON.stringify(Array.from({ length: 16 }, () => 0.1));

function makeId(i: number): string {
  return `chunk-${String(i).padStart(6, "0")}`;
}

function makeNamespace(i: number): string {
  return `namespace-${i % 10}`;
}

function makeSessionId(i: number): string {
  return `session-${i % 20}`;
}

function makeSource(i: number): "memory" | "sessions" {
  return i % 2 === 0 ? "memory" : "sessions";
}

function elapsed(start: number): number {
  return performance.now() - start;
}

describe("SQLite index performance benchmarks", () => {
  let db: DatabaseSync;

  beforeAll(() => {
    const sqlite = requireNodeSqlite();
    db = new sqlite.DatabaseSync(":memory:");

    ensureMemoryIndexSchema({
      db,
      embeddingCacheTable: "embedding_cache",
      ftsTable: "memory_fts",
      ftsEnabled: false,
    });

    const now = Date.now();
    const insert = db.prepare(
      `INSERT INTO chunks
         (id, path, source, start_line, end_line, hash, model, text, embedding, updated_at, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );

    db.exec("BEGIN");
    for (let i = 0; i < RECORD_COUNT; i++) {
      const ns = makeNamespace(i);
      const sid = makeSessionId(i);
      insert.run(
        makeId(i),
        `/memory/file-${i}.md`,
        makeSource(i),
        i,
        i + 10,
        `hash-${i}`,
        MODEL,
        `Test chunk ${i} ns=${ns} sid=${sid}.`,
        EMBEDDING_STUB,
        now - i * 1000,
        JSON.stringify({ namespace: ns, session_id: sid }),
      );
    }
    db.exec("COMMIT");

    // Warm-up: run each query once so the Node.js JIT and SQLite query planner
    // are both primed before we measure timings.
    db.prepare(`SELECT id FROM chunks WHERE json_extract(metadata, '$.namespace') = ?`).all(
      "namespace-0",
    );
    db.prepare(`SELECT id FROM chunks WHERE json_extract(metadata, '$.session_id') = ?`).all(
      "session-0",
    );
    db.prepare(`SELECT id FROM chunks WHERE model = ?`).all(MODEL);
    db.prepare(`SELECT id FROM chunks WHERE source = ?`).all("memory");
    db.prepare(`SELECT id FROM chunks WHERE updated_at >= ?`).all(Date.now() - 200 * 1000);
    db.prepare(`SELECT id FROM chunks WHERE model = ? AND source = ?`).all(MODEL, "sessions");
  });

  afterAll(() => {
    try {
      db.close();
    } catch {
      // ignore
    }
  });

  it("query by namespace completes < 500 ms", () => {
    const target = makeNamespace(3);
    const stmt = db.prepare(
      `SELECT id FROM chunks WHERE json_extract(metadata, '$.namespace') = ?`,
    );
    const t0 = performance.now();
    const rows = stmt.all(target) as Array<{ id: string }>;
    const ms = elapsed(t0);
    expect(rows.length).toBe(RECORD_COUNT / 10);
    expect(ms).toBeLessThan(500);
  });

  it("query by session_id completes < 200 ms", () => {
    const targetSession = makeSessionId(7);
    const stmt = db.prepare(
      `SELECT id FROM chunks WHERE json_extract(metadata, '$.session_id') = ?`,
    );
    const t0 = performance.now();
    const rows = stmt.all(targetSession) as Array<{ id: string }>;
    const ms = elapsed(t0);
    expect(rows.length).toBe(RECORD_COUNT / 20);
    expect(ms).toBeLessThan(200);
  });

  it("query by model completes < 500 ms", () => {
    const stmt = db.prepare(`SELECT id FROM chunks WHERE model = ?`);
    const t0 = performance.now();
    const rows = stmt.all(MODEL) as Array<{ id: string }>;
    const ms = elapsed(t0);
    expect(rows.length).toBe(RECORD_COUNT);
    expect(ms).toBeLessThan(500);
  });

  it("query by source completes < 200 ms", () => {
    const stmt = db.prepare(`SELECT id FROM chunks WHERE source = ?`);
    const t0 = performance.now();
    const rows = stmt.all("memory") as Array<{ id: string }>;
    const ms = elapsed(t0);
    expect(rows.length).toBe(RECORD_COUNT / 2);
    expect(ms).toBeLessThan(200);
  });

  it("time-range query on updated_at completes < 200 ms", () => {
    const now = Date.now();
    const since = now - 200 * 1000;
    const stmt = db.prepare(`SELECT id FROM chunks WHERE updated_at >= ?`);
    const t0 = performance.now();
    const rows = stmt.all(since) as Array<{ id: string }>;
    const ms = elapsed(t0);
    expect(rows.length).toBeGreaterThan(0);
    expect(ms).toBeLessThan(200);
  });

  it("composite model + source query completes < 200 ms", () => {
    const stmt = db.prepare(`SELECT id FROM chunks WHERE model = ? AND source = ?`);
    const t0 = performance.now();
    const rows = stmt.all(MODEL, "sessions") as Array<{ id: string }>;
    const ms = elapsed(t0);
    expect(rows.length).toBe(RECORD_COUNT / 2);
    expect(ms).toBeLessThan(200);
  });

  it("all migration-002 indexes are present in the schema", () => {
    const rows = db
      .prepare(`SELECT name FROM sqlite_master WHERE type = 'index' ORDER BY name`)
      .all() as Array<{ name: string }>;
    const names = new Set(rows.map((r) => r.name));

    // Original indexes
    expect(names.has("idx_chunks_path")).toBe(true);
    expect(names.has("idx_chunks_source")).toBe(true);
    expect(names.has("idx_chunks_metadata_namespace")).toBe(true);
    expect(names.has("idx_embedding_cache_updated_at")).toBe(true);

    // Migration 002 indexes
    expect(names.has("idx_chunks_model")).toBe(true);
    expect(names.has("idx_chunks_model_source")).toBe(true);
    expect(names.has("idx_chunks_updated_at")).toBe(true);
    expect(names.has("idx_files_source")).toBe(true);
    expect(names.has("idx_files_path_source")).toBe(true);
  });
});
