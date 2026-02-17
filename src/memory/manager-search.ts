import type { DatabaseSync } from "node:sqlite";
import { truncateUtf16Safe } from "../utils.js";
import { createLogger } from "../utils/logger.js";
import { cosineSimilarity, parseEmbedding } from "./internal.js";

const log = createLogger("memory/search");

const vectorToBlob = (embedding: number[]): Buffer =>
  Buffer.from(new Float32Array(embedding).buffer);

export type SearchSource = string;

export type SearchRowResult = {
  id: string;
  path: string;
  startLine: number;
  endLine: number;
  score: number;
  snippet: string;
  source: SearchSource;
};

export async function searchVector(params: {
  db: DatabaseSync;
  vectorTable: string;
  providerModel: string;
  queryVec: number[];
  limit: number;
  snippetMaxChars: number;
  ensureVectorReady: (dimensions: number) => Promise<boolean>;
  sourceFilterVec: { sql: string; params: SearchSource[] };
  sourceFilterChunks: { sql: string; params: SearchSource[] };
}): Promise<SearchRowResult[]> {
  if (params.queryVec.length === 0 || params.limit <= 0) {
    return [];
  }
  if (await params.ensureVectorReady(params.queryVec.length)) {
    const rows = params.db
      .prepare(
        `SELECT c.id, c.path, c.start_line, c.end_line, c.text,\n` +
          `       c.source,\n` +
          `       vec_distance_cosine(v.embedding, ?) AS dist\n` +
          `  FROM ${params.vectorTable} v\n` +
          `  JOIN chunks c ON c.id = v.id\n` +
          ` WHERE c.model = ?${params.sourceFilterVec.sql}\n` +
          ` ORDER BY dist ASC\n` +
          ` LIMIT ?`,
      )
      .all(
        vectorToBlob(params.queryVec),
        params.providerModel,
        ...params.sourceFilterVec.params,
        params.limit,
      ) as Array<{
      id: string;
      path: string;
      start_line: number;
      end_line: number;
      text: string;
      source: SearchSource;
      dist: number;
    }>;
    return rows.map((row) => ({
      id: row.id,
      path: row.path,
      startLine: row.start_line,
      endLine: row.end_line,
      score: 1 - row.dist,
      snippet: truncateUtf16Safe(row.text, params.snippetMaxChars),
      source: row.source,
    }));
  }

  const candidates = listChunks({
    db: params.db,
    providerModel: params.providerModel,
    sourceFilter: params.sourceFilterChunks,
  });
  const scored = candidates
    .map((chunk) => ({
      chunk,
      score: cosineSimilarity(params.queryVec, chunk.embedding),
    }))
    .filter((entry) => Number.isFinite(entry.score));
  return scored
    .toSorted((a, b) => b.score - a.score)
    .slice(0, params.limit)
    .map((entry) => ({
      id: entry.chunk.id,
      path: entry.chunk.path,
      startLine: entry.chunk.startLine,
      endLine: entry.chunk.endLine,
      score: entry.score,
      snippet: truncateUtf16Safe(entry.chunk.text, params.snippetMaxChars),
      source: entry.chunk.source,
    }));
}

export function listChunks(params: {
  db: DatabaseSync;
  providerModel: string;
  sourceFilter: { sql: string; params: SearchSource[] };
}): Array<{
  id: string;
  path: string;
  startLine: number;
  endLine: number;
  text: string;
  embedding: number[];
  source: SearchSource;
}> {
  const rows = params.db
    .prepare(
      `SELECT id, path, start_line, end_line, text, embedding, source\n` +
        `  FROM chunks\n` +
        ` WHERE model = ?${params.sourceFilter.sql}`,
    )
    .all(params.providerModel, ...params.sourceFilter.params) as Array<{
    id: string;
    path: string;
    start_line: number;
    end_line: number;
    text: string;
    embedding: string;
    source: SearchSource;
  }>;

  return rows.map((row) => ({
    id: row.id,
    path: row.path,
    startLine: row.start_line,
    endLine: row.end_line,
    text: row.text,
    embedding: parseEmbedding(row.embedding),
    source: row.source,
  }));
}

export async function searchKeyword(params: {
  db: DatabaseSync;
  ftsTable: string;
  providerModel: string;
  query: string;
  limit: number;
  snippetMaxChars: number;
  sourceFilter: { sql: string; params: SearchSource[] };
  buildFtsQuery: (raw: string) => string | null;
  bm25RankToScore: (rank: number) => number;
}): Promise<Array<SearchRowResult & { textScore: number }>> {
  if (params.limit <= 0) {
    return [];
  }
  const ftsQuery = params.buildFtsQuery(params.query);
  if (!ftsQuery) {
    return [];
  }

  log.debug("searchKeyword called", {
    query: params.query,
    ftsQuery,
    providerModel: params.providerModel,
    ftsTable: params.ftsTable,
    sourceFilterSql: params.sourceFilter.sql,
    sourceFilterParams: params.sourceFilter.params,
    limit: params.limit,
  });

  // TWO-STEP QUERY APPROACH to avoid JOIN on UNINDEXED column:
  // Step 1: Query FTS5 table with MATCH to get matching ids and their BM25 ranks
  // Step 2: Use those ids to query chunks table with filters (model, source, namespace)

  // Step 1: FTS5 MATCH query - get all matching ids with ranks
  // Note: We intentionally fetch MORE results than limit because filtering in Step 2 may reduce count
  const ftsRows = params.db
    .prepare(
      `SELECT ${params.ftsTable}.id, bm25(${params.ftsTable}) AS rank\n` +
        `  FROM ${params.ftsTable}\n` +
        ` WHERE ${params.ftsTable} MATCH ?\n` +
        ` ORDER BY rank ASC\n` +
        ` LIMIT ?`,
    )
    .all(ftsQuery, params.limit * 3) as Array<{ id: string; rank: number }>;

  log.debug("FTS5 MATCH results", { count: ftsRows.length });

  if (ftsRows.length === 0) {
    log.debug("No FTS5 matches found");
    return [];
  }

  // Step 2: Query chunks table with id filter and other constraints
  const idList = ftsRows.map((r) => r.id);
  const placeholders = idList.map(() => "?").join(",");

  const chunksQuery =
    `SELECT c.id, c.path, c.source, c.start_line, c.end_line, c.text\n` +
    `  FROM chunks c\n` +
    ` WHERE c.id IN (${placeholders}) AND c.model = ?${params.sourceFilter.sql}`;

  log.debug("Chunks query", { chunksQuery });

  const chunkRows = params.db
    .prepare(chunksQuery)
    .all(...idList, params.providerModel, ...params.sourceFilter.params) as Array<{
    id: string;
    path: string;
    source: SearchSource;
    start_line: number;
    end_line: number;
    text: string;
  }>;

  log.debug("Chunks results", { count: chunkRows.length });

  // Create a map of id -> rank from FTS results
  const rankMap = new Map(ftsRows.map((r) => [r.id, r.rank]));

  // Join results: match chunks with their BM25 ranks
  const rows = chunkRows
    .map((chunk) => ({
      ...chunk,
      rank: rankMap.get(chunk.id) ?? 0,
    }))
    .toSorted((a, b) => a.rank - b.rank) // Sort by BM25 rank (lower is better)
    .slice(0, params.limit); // Apply final limit

  log.debug("Final results after joining and limiting", { count: rows.length });

  return rows.map((row) => {
    const textScore = params.bm25RankToScore(row.rank);
    return {
      id: row.id,
      path: row.path,
      startLine: row.start_line,
      endLine: row.end_line,
      score: textScore,
      textScore,
      snippet: truncateUtf16Safe(row.text, params.snippetMaxChars),
      source: row.source,
    };
  });
}
