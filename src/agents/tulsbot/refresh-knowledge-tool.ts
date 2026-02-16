/**
 * Tulsbot NotebookLM Knowledge Refresh Tool
 *
 * Provides manual refresh capability for Tulsbot's knowledge base by:
 * 1. Running the extraction script to parse core-app-knowledge.json into domain slices
 * 2. Importing the extracted markdown files into OpenClaw's vector memory
 *
 * This tool wraps the two-phase knowledge integration pipeline into a single invocable tool.
 */

import fs from "node:fs/promises";
import path from "node:path";
import type { OpenClawConfig } from "../../config/config.js";
import type { AnyAgentTool } from "../tools/common.js";
import { getMemorySearchManager } from "../../memory/index.js";
import { runExec } from "../../process/exec.js";
import { resolveSessionAgentId } from "../agent-scope.js";
import {
  importNotebookLMKnowledge,
  type BatchImportSummary,
  formatImportSummary,
} from "./notebooklm-importer.js";

export interface RefreshKnowledgeToolOptions {
  config?: OpenClawConfig;
  agentSessionKey?: string;
}

export interface RefreshKnowledgeResult {
  status: "success" | "partial" | "error";
  extraction: {
    scriptPath: string;
    exitCode: number;
    duration: number;
  };
  import: BatchImportSummary | null;
  error?: string;
  formattedSummary?: string;
}

/**
 * Creates the tulsbot_refresh_knowledge tool for manual knowledge base refresh
 *
 * Usage:
 * - Invoked by Tulsbot agent to refresh knowledge from NotebookLM extracts
 * - Runs extraction script then imports into memory backend
 * - Returns detailed summary of extraction + import operations
 */
export function createTulsbotRefreshKnowledgeTool(
  options: RefreshKnowledgeToolOptions,
): AnyAgentTool {
  return {
    label: "Tulsbot Refresh Knowledge",
    name: "tulsbot_refresh_knowledge",
    description:
      "Manually refresh Tulsbot's knowledge base from NotebookLM extracts. " +
      "Runs extraction script to parse core-app-knowledge.json into domain slices, " +
      "then imports the extracted markdown files into vector memory for query access.",
    parameters: {
      type: "object" as const,
      properties: {
        namespace: {
          type: "string",
          description: 'Memory namespace for imported knowledge (default: "tulsbot")',
        },
        chunkSize: {
          type: "number",
          description: "Maximum chunk size in characters (default: 2000)",
        },
        chunkOverlap: {
          type: "number",
          description: "Overlap between chunks in characters (default: 200)",
        },
        verbose: {
          type: "boolean",
          description: "Include detailed extraction output in result (default: false)",
        },
      },
    },

    async execute(
      _toolCallId: string,
      params: Record<string, unknown>,
    ): Promise<{ content: { type: "text"; text: string }[]; details: RefreshKnowledgeResult }> {
      const input = params as {
        namespace?: string;
        chunkSize?: number;
        chunkOverlap?: number;
        verbose?: boolean;
      };
      const namespace = input.namespace ?? "tulsbot";
      const chunkSize = input.chunkSize ?? 2000;
      const chunkOverlap = input.chunkOverlap ?? 200;
      const verbose = input.verbose ?? false;

      // Obtain memory manager dynamically (OpenClaw pattern)
      const cfg = options?.config;
      if (!cfg) {
        const result: RefreshKnowledgeResult = {
          status: "error",
          extraction: { scriptPath: "", exitCode: -1, duration: 0 },
          import: null,
          error: "No config available - cannot access memory backend",
        };
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
          details: result,
        };
      }

      const agentId = resolveSessionAgentId({
        sessionKey: options.agentSessionKey,
        config: cfg,
      });

      const { manager, error: managerError } = await getMemorySearchManager({
        cfg,
        agentId,
      });

      if (!manager) {
        const result: RefreshKnowledgeResult = {
          status: "error",
          extraction: { scriptPath: "", exitCode: -1, duration: 0 },
          import: null,
          error: `Memory manager unavailable: ${managerError ?? "Unknown error"}`,
        };
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
          details: result,
        };
      }

      // Create file-based MemoryBackend that writes markdown files for sync
      // MemoryIndexManager requires file-based ingestion via sync() method
      const tempDir = path.resolve(process.cwd(), "memory", "tulsbot");
      await fs.mkdir(tempDir, { recursive: true });

      const writtenFiles: string[] = [];
      const memoryBackend = {
        store: async (memory: any) => {
          // Write each chunk to a temporary markdown file
          const filename = `chunk-${Date.now()}-${Math.random().toString(36).slice(2, 9)}.md`;
          const filePath = path.join(tempDir, filename);

          // Format with metadata as markdown frontmatter
          const frontmatter = Object.entries(memory.metadata || {})
            .map(([key, val]) => `${key}: ${JSON.stringify(val)}`)
            .join("\n");
          const content = `---\n${frontmatter}\n---\n\n${memory.content}`;

          await fs.writeFile(filePath, content, "utf-8");
          writtenFiles.push(filePath);
        },
      };

      // Phase 1: Run extraction script
      const scriptPath = path.resolve(process.cwd(), "scripts", "nlm-extract-tulsbot-knowledge.sh");

      let extractionResult: {
        exitCode: number;
        duration: number;
        stdout?: string;
        stderr?: string;
      };

      try {
        // Verify script exists before attempting execution
        await fs.access(scriptPath);

        const startTime = Date.now();

        // Execute extraction script (bash script with Python subprocess)
        const result = await runExec("bash", [scriptPath], {
          timeoutMs: 60_000, // 1 minute timeout for 824KB file processing
        });

        extractionResult = {
          exitCode: 0,
          duration: Date.now() - startTime,
          stdout: verbose ? result.stdout : undefined,
          stderr: verbose ? result.stderr : undefined,
        };
      } catch (error: any) {
        // Extraction failed - return error details
        const result: RefreshKnowledgeResult = {
          status: "error",
          extraction: {
            scriptPath,
            exitCode: error.exitCode ?? -1,
            duration: error.duration ?? 0,
          },
          import: null,
          error: `Extraction script failed: ${error.message || "Unknown error"}`,
        };
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
          details: result,
        };
      }

      // Phase 2: Import extracted files into memory
      const extractedDir = path.resolve(process.cwd(), ".local", "nlm", "tulsbot");

      let importSummary: BatchImportSummary;
      try {
        importSummary = await importNotebookLMKnowledge({
          extractedDir,
          memoryBackend,
          namespace,
          chunkSize,
          chunkOverlap,
        });

        // Phase 3: Trigger sync to index all written files
        if (writtenFiles.length > 0 && manager.sync) {
          await manager.sync({
            reason: "NotebookLM knowledge import",
            force: true,
          });
        }
      } catch (error: any) {
        // Import failed - extraction succeeded but import failed
        const result: RefreshKnowledgeResult = {
          status: "partial",
          extraction: {
            scriptPath,
            exitCode: extractionResult.exitCode,
            duration: extractionResult.duration,
          },
          import: null,
          error: `Knowledge import failed: ${error.message || "Unknown error"}`,
        };
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
          details: result,
        };
      }

      // Success: Both phases completed
      const formattedSummary = formatImportSummary(importSummary);

      const result: RefreshKnowledgeResult = {
        status: importSummary.errors.length === 0 ? "success" : "partial",
        extraction: {
          scriptPath,
          exitCode: extractionResult.exitCode,
          duration: extractionResult.duration,
        },
        import: importSummary,
        formattedSummary,
      };

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
        details: result,
      };
    },
  };
}
