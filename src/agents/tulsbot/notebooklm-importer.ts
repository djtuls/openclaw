/**
 * NotebookLM Knowledge Importer
 *
 * Imports extracted NotebookLM knowledge slices into OpenClaw's SQLite vector memory.
 * Works with knowledge extracted by scripts/nlm-extract-tulsbot-knowledge.sh
 */

import { glob } from "glob";
import * as fs from "node:fs/promises";
import * as path from "node:path";

/**
 * Configuration for knowledge import operations
 */
export interface NotebookLMImportConfig {
  /** Directory containing extracted knowledge markdown files */
  extractedDir: string;
  /** Memory backend to store knowledge in */
  memoryBackend: MemoryBackend;
  /** Namespace tag for imported knowledge (default: "tulsbot") */
  namespace?: string;
  /** Maximum chunk size in characters (default: 2000) */
  chunkSize?: number;
  /** Overlap between chunks in characters (default: 200) */
  chunkOverlap?: number;
}

/**
 * Memory record interface for knowledge storage
 */
export interface MemoryRecord {
  content: string;
  metadata?: {
    source?: string;
    domain?: string;
    namespace?: string;
    timestamp?: string;
    filename?: string;
    chunkIndex?: number;
    totalChunks?: number;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

/**
 * Memory backend interface for knowledge storage
 */
export interface MemoryBackend {
  store(memory: Partial<MemoryRecord>): Promise<void>;
  search?(query: string, filters?: { namespace?: string }): Promise<MemoryRecord[]>;
}

/**
 * Domain classification based on filename
 */
export type KnowledgeDomain =
  | "workspace-architecture"
  | "automation-patterns"
  | "agent-roster"
  | "notion-schemas";

/**
 * Result of importing a single knowledge file
 */
export interface ImportResult {
  filename: string;
  domain: KnowledgeDomain;
  chunks: number;
  size: number;
  lineCount: number;
  errors: string[];
}

/**
 * Summary of batch import operation
 */
export interface BatchImportSummary {
  totalFiles: number;
  successfulImports: number;
  totalChunks: number;
  totalSize: number;
  results: ImportResult[];
  errors: Array<{ file: string; error: string }>;
}

/**
 * Infers knowledge domain from filename
 */
export function inferDomain(filename: string): KnowledgeDomain {
  const basename = path.basename(filename, ".md").toLowerCase();

  if (basename.includes("workspace")) {
    return "workspace-architecture";
  }
  if (basename.includes("automation")) {
    return "automation-patterns";
  }
  if (basename.includes("agent")) {
    return "agent-roster";
  }
  if (basename.includes("notion")) {
    return "notion-schemas";
  }

  // Default fallback
  return "workspace-architecture";
}

/**
 * Chunks content into overlapping segments for vector storage
 *
 * Strategy:
 * - Split on paragraph boundaries (double newlines) when possible
 * - Ensure chunks don't exceed maxSize
 * - Add overlap to preserve context across chunk boundaries
 */
export function chunkContent(
  content: string,
  maxSize: number = 2000,
  overlap: number = 200,
): string[] {
  if (content.length <= maxSize) {
    return [content];
  }

  const chunks: string[] = [];
  const paragraphs = content.split(/\n\n+/);
  let currentChunk = "";

  for (const para of paragraphs) {
    // If adding this paragraph would exceed maxSize, finalize current chunk
    if (currentChunk.length + para.length + 2 > maxSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());

      // Start new chunk with overlap from end of previous chunk
      const overlapText = currentChunk.slice(-overlap).trim();
      currentChunk = overlapText + "\n\n" + para;
    } else {
      currentChunk += (currentChunk ? "\n\n" : "") + para;
    }
  }

  // Add final chunk if non-empty
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

/**
 * Imports a single knowledge file into the memory backend
 */
export async function importKnowledgeFile(
  filePath: string,
  memoryBackend: MemoryBackend,
  options: {
    namespace?: string;
    chunkSize?: number;
    chunkOverlap?: number;
  } = {},
): Promise<ImportResult> {
  const namespace = options.namespace || "tulsbot";
  const chunkSize = options.chunkSize || 2000;
  const chunkOverlap = options.chunkOverlap || 200;

  const result: ImportResult = {
    filename: path.basename(filePath),
    domain: inferDomain(filePath),
    chunks: 0,
    size: 0,
    lineCount: 0,
    errors: [],
  };

  try {
    // Read file content
    const content = await fs.readFile(filePath, "utf-8");
    result.size = content.length;
    result.lineCount = content.split("\n").length;

    // Chunk content for vector storage
    const chunks = chunkContent(content, chunkSize, chunkOverlap);
    result.chunks = chunks.length;

    // Store each chunk in memory backend
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];

      try {
        await memoryBackend.store({
          content: chunk,
          metadata: {
            source: "notebooklm",
            domain: result.domain,
            namespace,
            timestamp: new Date().toISOString(),
            filename: result.filename,
            chunkIndex: i,
            totalChunks: chunks.length,
          },
        });
      } catch (err) {
        const errorMsg = `Chunk ${i + 1}/${chunks.length} failed: ${err instanceof Error ? err.message : String(err)}`;
        result.errors.push(errorMsg);
      }
    }
  } catch (err) {
    const errorMsg = `Failed to read file: ${err instanceof Error ? err.message : String(err)}`;
    result.errors.push(errorMsg);
  }

  return result;
}

/**
 * Imports all knowledge files from a directory into memory backend
 *
 * Searches for markdown files matching NotebookLM extraction patterns:
 * - workspace-architecture.md
 * - automation-patterns.md
 * - agent-roster.md
 * - notion-schemas.md
 */
export async function importNotebookLMKnowledge(
  config: NotebookLMImportConfig,
): Promise<BatchImportSummary> {
  const {
    extractedDir,
    memoryBackend,
    namespace = "tulsbot",
    chunkSize = 2000,
    chunkOverlap = 200,
  } = config;

  const summary: BatchImportSummary = {
    totalFiles: 0,
    successfulImports: 0,
    totalChunks: 0,
    totalSize: 0,
    results: [],
    errors: [],
  };

  try {
    // Find all markdown files in the extracted directory
    const pattern = path.join(extractedDir, "*.md");
    const files = await glob(pattern, { absolute: true });

    summary.totalFiles = files.length;

    if (files.length === 0) {
      summary.errors.push({
        file: extractedDir,
        error: "No markdown files found in extraction directory",
      });
      return summary;
    }

    // Import each file
    for (const filePath of files) {
      try {
        const result = await importKnowledgeFile(filePath, memoryBackend, {
          namespace,
          chunkSize,
          chunkOverlap,
        });

        summary.results.push(result);
        summary.totalChunks += result.chunks;
        summary.totalSize += result.size;

        if (result.errors.length === 0) {
          summary.successfulImports++;
        } else {
          summary.errors.push({
            file: result.filename,
            error: result.errors.join("; "),
          });
        }
      } catch (err) {
        summary.errors.push({
          file: path.basename(filePath),
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  } catch (err) {
    summary.errors.push({
      file: extractedDir,
      error: `Failed to scan directory: ${err instanceof Error ? err.message : String(err)}`,
    });
  }

  return summary;
}

/**
 * Formats import summary for human-readable display
 */
export function formatImportSummary(summary: BatchImportSummary): string {
  const lines: string[] = [
    "NotebookLM Knowledge Import Summary",
    "=".repeat(50),
    `Total files: ${summary.totalFiles}`,
    `Successful imports: ${summary.successfulImports}`,
    `Total chunks: ${summary.totalChunks}`,
    `Total size: ${(summary.totalSize / 1024).toFixed(2)} KB`,
    "",
  ];

  if (summary.results.length > 0) {
    lines.push("File Details:");
    lines.push("-".repeat(50));

    for (const result of summary.results) {
      lines.push(`  ${result.filename} (${result.domain}):`);
      lines.push(
        `    Chunks: ${result.chunks}, Size: ${(result.size / 1024).toFixed(2)} KB, Lines: ${result.lineCount}`,
      );

      if (result.errors.length > 0) {
        lines.push(`    ⚠️  Errors: ${result.errors.length}`);
        for (const error of result.errors) {
          lines.push(`      - ${error}`);
        }
      } else {
        lines.push(`    ✅ Imported successfully`);
      }
    }
    lines.push("");
  }

  if (summary.errors.length > 0) {
    lines.push("Errors:");
    lines.push("-".repeat(50));
    for (const { file, error } of summary.errors) {
      lines.push(`  ${file}: ${error}`);
    }
  }

  return lines.join("\n");
}
