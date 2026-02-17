-- Migration 002: Performance indexes
-- Adds missing indexes identified by query pattern analysis.
-- All statements use CREATE INDEX IF NOT EXISTS for idempotency.

-- chunks(model): nearly every search query filters by model
CREATE INDEX IF NOT EXISTS idx_chunks_model ON chunks(model);

-- chunks(model, source): composite covering the dominant filter combination
-- (WHERE model = ? AND source = ?) used in vector and FTS search paths
CREATE INDEX IF NOT EXISTS idx_chunks_model_source ON chunks(model, source);

-- chunks(updated_at): supports time-range queries and cache eviction scans
CREATE INDEX IF NOT EXISTS idx_chunks_updated_at ON chunks(updated_at);

-- files(source): used in SELECT/DELETE WHERE source = ? for stale-file cleanup
CREATE INDEX IF NOT EXISTS idx_files_source ON files(source);

-- files(path, source): covers the common (path = ? AND source = ?) pattern
-- used in hash-check lookups before re-indexing
CREATE INDEX IF NOT EXISTS idx_files_path_source ON files(path, source);
