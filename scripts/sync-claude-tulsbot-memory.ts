#!/usr/bin/env tsx

/**
 * Bidirectional memory sync between Claude Code and OpenClaw Tulsbot
 *
 * Syncs:
 * - Claude Code memory: ~/.claude/projects/-Users-tulioferro-Backend-local-Macbook-openclaw-repo/memory/
 * - Tulsbot memory: ~/.openclaw/workspace-tulsbot/memory/
 *
 * Strategy:
 * 1. Read all files from both locations
 * 2. Compare timestamps to determine which is newer
 * 3. Sync newer files to both locations
 * 4. Merge MEMORY.md files intelligently (preserve both contents)
 */

import * as fs from "fs/promises";
import { homedir } from "os";
import * as path from "path";

const homeDir = homedir();
const claudeMemoryDir = path.join(
  homeDir,
  ".claude/projects/-Users-tulioferro-Backend-local-Macbook-openclaw-repo/memory",
);
const tulsbotMemoryDir = path.join(homeDir, ".openclaw/workspace-tulsbot/memory");

interface FileInfo {
  path: string;
  name: string;
  mtime: Date;
  content?: string;
}

async function getFilesFromDir(dir: string): Promise<FileInfo[]> {
  try {
    const files = await fs.readdir(dir);
    const fileInfos: FileInfo[] = [];

    for (const file of files) {
      if (!file.endsWith(".md")) {
        continue;
      }

      const filePath = path.join(dir, file);
      const stats = await fs.stat(filePath);

      if (stats.isFile()) {
        fileInfos.push({
          path: filePath,
          name: file,
          mtime: stats.mtime,
        });
      }
    }

    return fileInfos;
  } catch (err) {
    console.error(`Error reading directory ${dir}:`, err);
    return [];
  }
}

async function syncMemoryFiles() {
  console.log("🔄 Starting bidirectional memory sync...\n");

  // Get files from both locations
  console.log("📂 Scanning Claude Code memory...");
  const claudeFiles = await getFilesFromDir(claudeMemoryDir);
  console.log(`   Found ${claudeFiles.length} files\n`);

  console.log("📂 Scanning Tulsbot memory...");
  const tulsbotFiles = await getFilesFromDir(tulsbotMemoryDir);
  console.log(`   Found ${tulsbotFiles.length} files\n`);

  // Create lookup maps
  const claudeMap = new Map(claudeFiles.map((f) => [f.name, f]));
  const tulsbotMap = new Map(tulsbotFiles.map((f) => [f.name, f]));

  let copiedToClaude = 0;
  let copiedToTulsbot = 0;
  let merged = 0;

  // Special handling for MEMORY.md - merge instead of overwrite
  if (claudeMap.has("MEMORY.md") && tulsbotMap.has("MEMORY.md")) {
    console.log("🔀 Merging MEMORY.md files...");

    const claudeMemory = claudeMap.get("MEMORY.md")!;
    const tulsbotMemory = tulsbotMap.get("MEMORY.md")!;

    const claudeContent = await fs.readFile(claudeMemory.path, "utf-8");
    const tulsbotContent = await fs.readFile(tulsbotMemory.path, "utf-8");

    // Simple merge: Claude content + separator + Tulsbot content (if different)
    if (claudeContent.trim() !== tulsbotContent.trim()) {
      const mergedContent = `${claudeContent.trim()}\n\n---\n\n# Tulsbot Memory\n\n${tulsbotContent.trim()}\n`;

      await fs.writeFile(claudeMemory.path, mergedContent, "utf-8");
      console.log(`   ✅ Merged MEMORY.md (Claude + Tulsbot content)\n`);
      merged++;
    } else {
      console.log(`   ℹ️  MEMORY.md files are identical\n`);
    }

    // Remove from maps so they're not processed again
    claudeMap.delete("MEMORY.md");
    tulsbotMap.delete("MEMORY.md");
  }

  // Sync files from Tulsbot to Claude (only if Claude doesn't have them)
  console.log("⬆️  Syncing Tulsbot → Claude Code...");
  for (const [name, tulsbotFile] of tulsbotMap) {
    const claudeFile = claudeMap.get(name);

    if (!claudeFile) {
      // File only exists in Tulsbot, copy to Claude
      const content = await fs.readFile(tulsbotFile.path, "utf-8");
      const destPath = path.join(claudeMemoryDir, name);
      await fs.writeFile(destPath, content, "utf-8");
      copiedToClaude++;
      console.log(`   ✅ ${name}`);
    } else if (tulsbotFile.mtime > claudeFile.mtime) {
      // Tulsbot file is newer, update Claude
      const content = await fs.readFile(tulsbotFile.path, "utf-8");
      await fs.writeFile(claudeFile.path, content, "utf-8");
      copiedToClaude++;
      console.log(`   🔄 ${name} (updated)`);
    }
  }
  console.log();

  // Sync files from Claude to Tulsbot (only if Tulsbot doesn't have them)
  console.log("⬇️  Syncing Claude Code → Tulsbot...");
  for (const [name, claudeFile] of claudeMap) {
    const tulsbotFile = tulsbotMap.get(name);

    if (!tulsbotFile) {
      // File only exists in Claude, copy to Tulsbot
      const content = await fs.readFile(claudeFile.path, "utf-8");
      const destPath = path.join(tulsbotMemoryDir, name);
      await fs.writeFile(destPath, content, "utf-8");
      copiedToTulsbot++;
      console.log(`   ✅ ${name}`);
    } else if (claudeFile.mtime > tulsbotFile.mtime) {
      // Claude file is newer, update Tulsbot
      const content = await fs.readFile(claudeFile.path, "utf-8");
      await fs.writeFile(tulsbotFile.path, content, "utf-8");
      copiedToTulsbot++;
      console.log(`   🔄 ${name} (updated)`);
    }
  }
  console.log();

  // Summary
  console.log("━".repeat(50));
  console.log("✨ Sync complete!\n");
  console.log(`   📊 Statistics:`);
  console.log(`      • Files copied to Claude Code: ${copiedToClaude}`);
  console.log(`      • Files copied to Tulsbot: ${copiedToTulsbot}`);
  console.log(`      • Files merged: ${merged}`);
  console.log(`      • Total Claude Code files: ${claudeFiles.length + copiedToClaude}`);
  console.log(`      • Total Tulsbot files: ${tulsbotFiles.length + copiedToTulsbot}`);
  console.log("━".repeat(50));
}

// Add bidirectional sync that keeps anythingllm always in sync
async function continuousSync(intervalMinutes: number = 5) {
  console.log(`🔁 Starting continuous bidirectional sync (every ${intervalMinutes} minutes)...\n`);
  console.log("   Press Ctrl+C to stop\n");

  // Run initial sync
  await syncMemoryFiles();

  // Then run on interval
  setInterval(
    async () => {
      console.log(`\n⏰ Running scheduled sync at ${new Date().toLocaleTimeString()}...\n`);
      await syncMemoryFiles();
    },
    intervalMinutes * 60 * 1000,
  );
}

// Check command line args
const args = process.argv.slice(2);
const watchMode = args.includes("--watch") || args.includes("-w");
const intervalArg = args.find((arg) => arg.startsWith("--interval="));
const interval = intervalArg ? parseInt(intervalArg.split("=")[1]) : 5;

if (watchMode) {
  continuousSync(interval).catch((err) => {
    console.error("❌ Continuous sync failed:", err);
    process.exit(1);
  });
} else {
  // Run once and exit
  syncMemoryFiles().catch((err) => {
    console.error("❌ Sync failed:", err);
    process.exit(1);
  });
}
