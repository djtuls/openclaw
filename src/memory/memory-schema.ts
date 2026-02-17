import type { DatabaseSync } from "node:sqlite";
import { createLogger } from "../utils/logger.js";

const log = createLogger("memory/schema");

export function ensureMemoryIndexSchema(params: {
  db: DatabaseSync;
  embeddingCacheTable: string;
  ftsTable: string;
  ftsEnabled: boolean;
}): { ftsAvailable: boolean; ftsError?: string } {
  params.db.exec(`
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
  params.db.exec(`
    CREATE TABLE IF NOT EXISTS files (
      path TEXT PRIMARY KEY,
      source TEXT NOT NULL DEFAULT 'memory',
      hash TEXT NOT NULL,
      mtime INTEGER NOT NULL,
      size INTEGER NOT NULL
    );
  `);
  params.db.exec(`
    CREATE TABLE IF NOT EXISTS chunks (
      id TEXT PRIMARY KEY,
      path TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'memory',
      start_line INTEGER NOT NULL,
      end_line INTEGER NOT NULL,
      hash TEXT NOT NULL,
      model TEXT NOT NULL,
      text TEXT NOT NULL,
      embedding TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      metadata TEXT
    );
  `);
  params.db.exec(`
    CREATE TABLE IF NOT EXISTS ${params.embeddingCacheTable} (
      provider TEXT NOT NULL,
      model TEXT NOT NULL,
      provider_key TEXT NOT NULL,
      hash TEXT NOT NULL,
      embedding TEXT NOT NULL,
      dims INTEGER,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (provider, model, provider_key, hash)
    );
  `);
  params.db.exec(
    `CREATE INDEX IF NOT EXISTS idx_embedding_cache_updated_at ON ${params.embeddingCacheTable}(updated_at);`,
  );

  let ftsAvailable = false;
  let ftsError: string | undefined;
  log.info("ensureMemoryIndexSchema", { ftsEnabled: params.ftsEnabled });
  if (params.ftsEnabled) {
    try {
      // Check if FTS table needs migration (missing metadata column)
      const tableInfo = params.db.prepare(`PRAGMA table_info(${params.ftsTable})`).all() as Array<{
        name: string;
      }>;
      const hasMetadataColumn = tableInfo.some((col) => col.name === "metadata");
      log.info("ensureMemoryIndexSchema tableInfo", {
        tableInfoLength: tableInfo.length,
        hasMetadataColumn,
      });

      if (tableInfo.length > 0 && !hasMetadataColumn) {
        // Drop old FTS table (cannot ALTER VIRTUAL TABLE)
        log.info("dropping old FTS table for migration");
        params.db.exec(`DROP TABLE IF EXISTS ${params.ftsTable};`);
      }

      log.info("creating FTS table");
      params.db.exec(
        `CREATE VIRTUAL TABLE IF NOT EXISTS ${params.ftsTable} USING fts5(\n` +
          `  text,\n` +
          `  id UNINDEXED,\n` +
          `  path UNINDEXED,\n` +
          `  source UNINDEXED,\n` +
          `  model UNINDEXED,\n` +
          `  start_line UNINDEXED,\n` +
          `  end_line UNINDEXED,\n` +
          `  metadata UNINDEXED\n` +
          `);`,
      );

      // Repopulate FTS table from chunks after migration
      if (tableInfo.length > 0 && !hasMetadataColumn) {
        log.info("repopulating FTS table after migration");
        params.db.exec(
          `INSERT INTO ${params.ftsTable} (text, id, path, source, model, start_line, end_line, metadata)\n` +
            `SELECT text, id, path, source, model, start_line, end_line, metadata FROM chunks;`,
        );
      }

      ftsAvailable = true;
      log.info("FTS creation successful");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      ftsAvailable = false;
      ftsError = message;
    }
  }

  ensureColumn(params.db, "files", "source", "TEXT NOT NULL DEFAULT 'memory'");
  ensureColumn(params.db, "chunks", "source", "TEXT NOT NULL DEFAULT 'memory'");
  ensureColumn(params.db, "chunks", "metadata", "TEXT");
  params.db.exec(`CREATE INDEX IF NOT EXISTS idx_chunks_path ON chunks(path);`);
  params.db.exec(`CREATE INDEX IF NOT EXISTS idx_chunks_source ON chunks(source);`);
  params.db.exec(
    `CREATE INDEX IF NOT EXISTS idx_chunks_metadata_namespace ON chunks(json_extract(metadata, '$.namespace'));`,
  );

  // Migration 002: performance indexes (see migrations/002-performance-indexes.sql)
  // chunks(model): nearly every search query filters by model
  params.db.exec(`CREATE INDEX IF NOT EXISTS idx_chunks_model ON chunks(model);`);
  // chunks(model, source): composite covering the dominant filter combination
  params.db.exec(`CREATE INDEX IF NOT EXISTS idx_chunks_model_source ON chunks(model, source);`);
  // chunks(updated_at): supports time-range queries and cache-eviction scans
  params.db.exec(`CREATE INDEX IF NOT EXISTS idx_chunks_updated_at ON chunks(updated_at);`);
  // files(source): used in SELECT/DELETE WHERE source = ? for stale-file cleanup
  params.db.exec(`CREATE INDEX IF NOT EXISTS idx_files_source ON files(source);`);
  // files(path, source): covers the common (path = ? AND source = ?) pattern
  params.db.exec(`CREATE INDEX IF NOT EXISTS idx_files_path_source ON files(path, source);`);
  // chunks(path, source): covers DELETE FROM chunks WHERE path = ? AND source = ? and the correlated
  // subquery SELECT id FROM chunks WHERE path = ? AND source = ? used in vector/FTS stale-chunk cleanup
  params.db.exec(`CREATE INDEX IF NOT EXISTS idx_chunks_path_source ON chunks(path, source);`);

  return { ftsAvailable, ...(ftsError ? { ftsError } : {}) };
}

function ensureColumn(
  db: DatabaseSync,
  table: "files" | "chunks",
  column: string,
  definition: string,
): void {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (rows.some((row) => row.name === column)) {
    return;
  }
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}
