import { DatabaseSync } from "node:sqlite";
import { beforeEach, describe, expect, it } from "vitest";
import { ensureMemoryIndexSchema } from "./memory-schema.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function openDb(): DatabaseSync {
  return new DatabaseSync(":memory:");
}

function tableNames(db: DatabaseSync): string[] {
  const rows = db
    .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name`)
    .all() as Array<{ name: string }>;
  return rows.map((r) => r.name);
}

function indexNames(db: DatabaseSync): string[] {
  const rows = db
    .prepare(`SELECT name FROM sqlite_master WHERE type = 'index' ORDER BY name`)
    .all() as Array<{ name: string }>;
  return rows.map((r) => r.name);
}

function columnNames(db: DatabaseSync, table: string): string[] {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  return rows.map((r) => r.name);
}

// ---------------------------------------------------------------------------
// Table creation
// ---------------------------------------------------------------------------

describe("ensureMemoryIndexSchema – table creation", () => {
  it("creates meta, files, chunks, and the custom cache table", () => {
    const db = openDb();
    ensureMemoryIndexSchema({
      db,
      embeddingCacheTable: "embedding_cache",
      ftsTable: "chunks_fts",
      ftsEnabled: false,
    });
    const tables = tableNames(db);
    expect(tables).toContain("meta");
    expect(tables).toContain("files");
    expect(tables).toContain("chunks");
    expect(tables).toContain("embedding_cache");
  });

  it("uses the caller-supplied embeddingCacheTable name", () => {
    const db = openDb();
    ensureMemoryIndexSchema({
      db,
      embeddingCacheTable: "my_custom_cache",
      ftsTable: "chunks_fts",
      ftsEnabled: false,
    });
    expect(tableNames(db)).toContain("my_custom_cache");
    expect(tableNames(db)).not.toContain("embedding_cache");
  });
});

// ---------------------------------------------------------------------------
// Idempotency (calling twice should not throw)
// ---------------------------------------------------------------------------

describe("ensureMemoryIndexSchema – idempotency", () => {
  it("can be called twice without error (CREATE IF NOT EXISTS)", () => {
    const db = openDb();
    const params = {
      db,
      embeddingCacheTable: "embedding_cache",
      ftsTable: "chunks_fts",
      ftsEnabled: false,
    };
    expect(() => {
      ensureMemoryIndexSchema(params);
      ensureMemoryIndexSchema(params);
    }).not.toThrow();
  });

  it("can be called twice with FTS enabled without error", () => {
    const db = openDb();
    const params = {
      db,
      embeddingCacheTable: "embedding_cache",
      ftsTable: "chunks_fts",
      ftsEnabled: true,
    };
    expect(() => {
      ensureMemoryIndexSchema(params);
      ensureMemoryIndexSchema(params);
    }).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// FTS disabled
// ---------------------------------------------------------------------------

describe("ensureMemoryIndexSchema – FTS disabled", () => {
  it("returns ftsAvailable: false when ftsEnabled is false", () => {
    const db = openDb();
    const result = ensureMemoryIndexSchema({
      db,
      embeddingCacheTable: "embedding_cache",
      ftsTable: "chunks_fts",
      ftsEnabled: false,
    });
    expect(result.ftsAvailable).toBe(false);
  });

  it("does not create the FTS virtual table when ftsEnabled is false", () => {
    const db = openDb();
    ensureMemoryIndexSchema({
      db,
      embeddingCacheTable: "embedding_cache",
      ftsTable: "chunks_fts",
      ftsEnabled: false,
    });
    expect(tableNames(db)).not.toContain("chunks_fts");
  });

  it("does not set ftsError when ftsEnabled is false", () => {
    const db = openDb();
    const result = ensureMemoryIndexSchema({
      db,
      embeddingCacheTable: "embedding_cache",
      ftsTable: "chunks_fts",
      ftsEnabled: false,
    });
    expect(result.ftsError).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// FTS enabled – fresh database
// ---------------------------------------------------------------------------

describe("ensureMemoryIndexSchema – FTS enabled (fresh db)", () => {
  it("returns ftsAvailable: true when FTS creation succeeds", () => {
    const db = openDb();
    const result = ensureMemoryIndexSchema({
      db,
      embeddingCacheTable: "embedding_cache",
      ftsTable: "chunks_fts",
      ftsEnabled: true,
    });
    expect(result.ftsAvailable).toBe(true);
  });

  it("creates the FTS virtual table with the caller-supplied name", () => {
    const db = openDb();
    ensureMemoryIndexSchema({
      db,
      embeddingCacheTable: "embedding_cache",
      ftsTable: "my_fts_table",
      ftsEnabled: true,
    });
    expect(tableNames(db)).toContain("my_fts_table");
  });

  it("does not set ftsError on success", () => {
    const db = openDb();
    const result = ensureMemoryIndexSchema({
      db,
      embeddingCacheTable: "embedding_cache",
      ftsTable: "chunks_fts",
      ftsEnabled: true,
    });
    expect(result.ftsError).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// FTS migration: old table without metadata column gets recreated
// ---------------------------------------------------------------------------

describe("ensureMemoryIndexSchema – FTS migration (missing metadata column)", () => {
  it("drops old FTS table, recreates it, and repopulates from chunks", () => {
    const db = openDb();

    // 1. Create base tables first (without FTS)
    ensureMemoryIndexSchema({
      db,
      embeddingCacheTable: "embedding_cache",
      ftsTable: "chunks_fts",
      ftsEnabled: false,
    });

    // 2. Manually create an old-style FTS table without metadata column
    db.exec(
      `CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
        text,
        id UNINDEXED,
        path UNINDEXED,
        source UNINDEXED,
        model UNINDEXED,
        start_line UNINDEXED,
        end_line UNINDEXED
      );`,
    );

    // 3. Insert a chunk row so repopulate can be tested
    db.exec(
      `INSERT INTO chunks (id, path, source, start_line, end_line, hash, model, text, embedding, updated_at)
       VALUES ('c1', 'file.md', 'memory', 1, 5, 'abc', 'test-model', 'hello world', '[]', 0);`,
    );

    // 4. Run migration
    const result = ensureMemoryIndexSchema({
      db,
      embeddingCacheTable: "embedding_cache",
      ftsTable: "chunks_fts",
      ftsEnabled: true,
    });

    expect(result.ftsAvailable).toBe(true);

    // 5. New FTS table should have the metadata column
    const cols = columnNames(db, "chunks_fts");
    expect(cols).toContain("metadata");

    // 6. Repopulated row should be searchable
    const rows = db
      .prepare(`SELECT id FROM chunks_fts WHERE chunks_fts MATCH 'hello'`)
      .all() as Array<{ id: string }>;
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].id).toBe("c1");
  });

  it("does not drop the FTS table if metadata column already exists", () => {
    const db = openDb();

    // Run once with FTS enabled → creates fresh table with metadata
    ensureMemoryIndexSchema({
      db,
      embeddingCacheTable: "embedding_cache",
      ftsTable: "chunks_fts",
      ftsEnabled: true,
    });

    // Insert a row into FTS directly
    db.exec(
      `INSERT INTO chunks_fts (text, id, path, source, model, start_line, end_line, metadata)
       VALUES ('sentinel', 'sentinel-id', 'f.md', 'memory', 'm', 1, 2, NULL);`,
    );

    // Run a second time — should NOT drop+recreate (row preserved)
    ensureMemoryIndexSchema({
      db,
      embeddingCacheTable: "embedding_cache",
      ftsTable: "chunks_fts",
      ftsEnabled: true,
    });

    const rows = db
      .prepare(`SELECT id FROM chunks_fts WHERE chunks_fts MATCH 'sentinel'`)
      .all() as Array<{ id: string }>;
    expect(rows.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// ensureColumn – adds missing columns idempotently
// ---------------------------------------------------------------------------

describe("ensureMemoryIndexSchema – ensureColumn idempotency", () => {
  it("adds source column to files if missing, without error on second call", () => {
    const db = openDb();
    // First call adds it; second call must be a no-op
    ensureMemoryIndexSchema({
      db,
      embeddingCacheTable: "embedding_cache",
      ftsTable: "chunks_fts",
      ftsEnabled: false,
    });
    const cols = columnNames(db, "files");
    expect(cols).toContain("source");

    // Re-running should not throw
    expect(() =>
      ensureMemoryIndexSchema({
        db,
        embeddingCacheTable: "embedding_cache",
        ftsTable: "chunks_fts",
        ftsEnabled: false,
      }),
    ).not.toThrow();
  });

  it("adds metadata column to chunks if missing", () => {
    const db = openDb();
    ensureMemoryIndexSchema({
      db,
      embeddingCacheTable: "embedding_cache",
      ftsTable: "chunks_fts",
      ftsEnabled: false,
    });
    const cols = columnNames(db, "chunks");
    expect(cols).toContain("metadata");
  });
});

// ---------------------------------------------------------------------------
// Performance indexes
// ---------------------------------------------------------------------------

describe("ensureMemoryIndexSchema – performance indexes", () => {
  let indexes: string[];

  beforeEach(() => {
    const db = openDb();
    ensureMemoryIndexSchema({
      db,
      embeddingCacheTable: "embedding_cache",
      ftsTable: "chunks_fts",
      ftsEnabled: false,
    });
    indexes = indexNames(db);
  });

  const expectedIndexes = [
    "idx_embedding_cache_updated_at",
    "idx_chunks_path",
    "idx_chunks_source",
    "idx_chunks_metadata_namespace",
    "idx_chunks_model",
    "idx_chunks_model_source",
    "idx_chunks_updated_at",
    "idx_files_source",
    "idx_files_path_source",
    "idx_chunks_path_source",
  ];

  for (const name of expectedIndexes) {
    it(`creates index: ${name}`, () => {
      expect(indexes).toContain(name);
    });
  }
});

// ---------------------------------------------------------------------------
// FTS error capture
// ---------------------------------------------------------------------------

describe("ensureMemoryIndexSchema – FTS error capture", () => {
  it("returns ftsAvailable: false and ftsError when FTS creation fails", () => {
    const real = openDb();

    // Wrap DatabaseSync.exec to throw on CREATE VIRTUAL TABLE
    const proxy = new Proxy(real, {
      get(target, prop) {
        if (prop === "exec") {
          return (sql: string) => {
            if (/CREATE\s+VIRTUAL\s+TABLE/i.test(sql)) {
              throw new Error("simulated FTS5 not available");
            }
            return (target as unknown as Record<string, (s: string) => unknown>)[prop as string](
              sql,
            );
          };
        }
        const val = (target as unknown as Record<string, unknown>)[prop as string];
        return typeof val === "function" ? val.bind(target) : val;
      },
    });

    const result = ensureMemoryIndexSchema({
      db: proxy,
      embeddingCacheTable: "embedding_cache",
      ftsTable: "chunks_fts",
      ftsEnabled: true,
    });

    expect(result.ftsAvailable).toBe(false);
    expect(result.ftsError).toContain("simulated FTS5 not available");
  });
});
