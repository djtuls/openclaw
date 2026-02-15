#!/usr/bin/env tsx

/**
 * Force SQLite reindexing of OpenClaw memory files
 *
 * This script triggers a full reindex when memory files have been imported
 * or modified externally (bypassing OpenClaw's dirty flag tracking).
 *
 * Usage:
 *   pnpm tsx scripts/force-memory-reindex.ts
 */

import { MemoryIndexManager } from "../src/memory/manager.js";
import { resolveAgentDir, resolveAgentWorkspaceDir } from "../src/agents/agent-scope.js";
import type { OpenClawConfig } from "../src/types/config.js";
import path from "node:path";
import fs from "node:fs/promises";

async function main() {
  console.log("🔄 Starting forced memory reindex...\n");

  // Determine workspace directory
  const homeDir = process.env.HOME || process.env.USERPROFILE || "";
  const workspaceDir = path.join(homeDir, ".openclaw", "workspace");
  const memoryDir = path.join(workspaceDir, "memory");

  // Count memory files to be indexed
  const exists = await fs.access(memoryDir).then(() => true).catch(() => false);
  if (!exists) {
    console.error(`❌ Memory directory not found: ${memoryDir}`);
    console.log("\n💡 Run import-anythingllm-backup.ts first to restore memory files.");
    process.exit(1);
  }

  const files = await fs.readdir(memoryDir);
  const mdFiles = files.filter((f) => f.endsWith(".md"));
  console.log(`📚 Found ${mdFiles.length} memory files in: ${memoryDir}\n`);

  if (mdFiles.length === 0) {
    console.log("⚠️  No memory files to index. Exiting.");
    process.exit(0);
  }

  // Create minimal OpenClawConfig for memory manager
  const agentId = "force-reindex-agent";
  const stateDir = path.join(homeDir, ".openclaw");

  const cfg: OpenClawConfig = {
    stateDir,
    agents: {
      [agentId]: {
        workspaceDir,
        memorySearch: {
          enabled: true,
          provider: "anthropic",
          model: "claude-sonnet-4-5-20250929",
          chunking: { tokens: 512, overlap: 64 },
          fts: { enabled: true },
          sources: ["memory"],
        },
      },
    },
  } as OpenClawConfig;

  console.log("🔧 Initializing memory manager...");
  const memoryManager = await MemoryIndexManager.get({
    cfg,
    agentId,
  });

  if (!memoryManager) {
    console.error("❌ Failed to create memory manager - check configuration");
    process.exit(1);
  }

  // Progress tracking
  let lastProgress = { completed: 0, total: 0 };
  const progressCallback = (update: { completed: number; total: number; label?: string }) => {
    if (update.total !== lastProgress.total || update.completed !== lastProgress.completed) {
      const percent = update.total > 0 ? Math.round((update.completed / update.total) * 100) : 0;
      console.log(`  ⏳ ${update.label || "Indexing"}: ${update.completed}/${update.total} (${percent}%)`);
      lastProgress = update;
    }
  };

  try {
    console.log("\n🚀 Starting forced sync with full reindex...\n");

    await memoryManager.sync({
      force: true,
      reason: "post-import-reindex",
      progress: progressCallback,
    });

    console.log("\n✅ Memory reindex complete!");
    console.log(`📊 SQLite database: ${dbPath}`);
    console.log("\n🎯 Next steps:");
    console.log("   1. Test memory retrieval:");
    console.log("      openclaw agent --local --session-id test-memory --message 'What do you remember?'");
    console.log("   2. Start bidirectional sync (optional):");
    console.log("      pnpm tsx scripts/sync-anythingllm-bidirectional.ts --watch");
  } catch (error: any) {
    console.error("\n❌ Reindex failed:", error.message);
    if (error.stack) {
      console.error("\nStack trace:");
      console.error(error.stack);
    }
    process.exit(1);
  } finally {
    await memoryManager.close();
  }
}

main().catch((error) => {
  console.error("❌ Fatal error:", error);
  process.exit(1);
});
