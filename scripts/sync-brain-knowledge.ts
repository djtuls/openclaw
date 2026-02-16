#!/usr/bin/env tsx

/**
 * Brain Knowledge Sync — Automated ClawdBot training
 *
 * Regenerates the 3 core AnythingLLM brain documents:
 *   1. cc-sync-clawdbot-identity.md — Who ClawdBot is
 *   2. cc-sync-project-memory-state.md — Current project state
 *   3. tulsbot-learned.md (workspace) — Accumulated knowledge
 *
 * Runs 3x/day via macOS LaunchAgent (9am, 2pm, 9pm)
 * Can also run manually: pnpm tsx scripts/sync-brain-knowledge.ts
 *
 * Flags:
 *   --dry-run    Show what would be written without writing
 *   --verbose    Show detailed output
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileNoThrow } from "../src/utils/execFileNoThrow.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");

const DRY_RUN = process.argv.includes("--dry-run");
const VERBOSE = process.argv.includes("--verbose");

const BRAIN_DIR = path.join(PROJECT_ROOT, "anythingllm-sync-output", "brain");
const WORKSPACE_DIR = path.join(PROJECT_ROOT, "anythingllm-sync-output", "workspace");
const HOME_DIR = process.env.HOME || process.env.USERPROFILE || "";
const MEMORY_DIR = path.join(HOME_DIR, ".openclaw", "workspace", "memory");

// ──────────────────────────────────────────────────────────
// Data Collectors — gather live project state
// ──────────────────────────────────────────────────────────

async function getRecentCommits(count = 10): Promise<string[]> {
  const result = await execFileNoThrow("git", ["log", `--oneline`, `-${count}`, "--no-decorate"], {
    cwd: PROJECT_ROOT,
    timeout: 10_000,
  });
  if (result.error) {
    if (VERBOSE) {
      console.warn("  ⚠ git log failed:", result.stderr);
    }
    return [];
  }
  return result.stdout.trim().split("\n").filter(Boolean);
}

async function getTscStatus(): Promise<{ clean: boolean; errorCount: number }> {
  const result = await execFileNoThrow("npx", ["tsc", "--noEmit"], {
    cwd: PROJECT_ROOT,
    timeout: 60_000,
  });
  if (!result.error) {
    return { clean: true, errorCount: 0 };
  }
  const errorLines = result.stdout.split("\n").filter((l) => l.includes("error TS"));
  return { clean: false, errorCount: errorLines.length };
}

async function getServiceStatus(
  label: string,
): Promise<{ loaded: boolean; running: boolean; pid?: string }> {
  const result = await execFileNoThrow("launchctl", ["list", label], {
    timeout: 5_000,
  });
  if (result.error) {
    return { loaded: false, running: false };
  }
  const pidMatch = result.stdout.match(/"PID"\s*=\s*(\d+)/);
  return {
    loaded: true,
    running: !!pidMatch,
    pid: pidMatch?.[1],
  };
}

async function getSessionArchives(): Promise<string[]> {
  const sessionsDir = path.join(
    HOME_DIR,
    ".claude",
    "projects",
    "-Users-tulioferro-Backend-local-Macbook-openclaw-repo",
    "memory",
    "sessions",
  );
  try {
    const files = await fs.readdir(sessionsDir);
    return files.filter((f) => f.endsWith(".md"));
  } catch {
    return [];
  }
}

async function getMemoryIndex(): Promise<string> {
  const memoryPath = path.join(
    HOME_DIR,
    ".claude",
    "projects",
    "-Users-tulioferro-Backend-local-Macbook-openclaw-repo",
    "memory",
    "MEMORY.md",
  );
  try {
    return await fs.readFile(memoryPath, "utf-8");
  } catch {
    return "";
  }
}

async function getWorkspaceMemoryFiles(): Promise<{ name: string; content: string }[]> {
  try {
    const files = await fs.readdir(MEMORY_DIR);
    const mdFiles = files.filter((f) => f.endsWith(".md"));
    const results: { name: string; content: string }[] = [];
    for (const f of mdFiles) {
      try {
        const content = await fs.readFile(path.join(MEMORY_DIR, f), "utf-8");
        results.push({ name: f, content });
      } catch {
        // skip unreadable files
      }
    }
    return results;
  } catch {
    return [];
  }
}

async function getBrainFileCount(): Promise<number> {
  try {
    const files = await fs.readdir(BRAIN_DIR);
    return files.filter((f) => f.endsWith(".md")).length;
  } catch {
    return 0;
  }
}

// ──────────────────────────────────────────────────────────
// Document Generators — produce the 3 brain files
// ──────────────────────────────────────────────────────────

function generateIdentityDoc(): string {
  const now = new Date();
  return `# ClawdBot — Identity & Training

**Type:** identity
**Tier:** core
**Confidence:** 1.0
**Created:** ${now.toDateString()}

---

## Who You Are

You are **ClawdBot** — the AI agent at the heart of the OpenClaw ecosystem. Your internal codename is **Tulsbot**, named after your creator Tulio ("Tuls"). You are a macOS-native AI assistant built with Swift 6.2 and Node.js, running locally on Tulio's machine with AnythingLLM as your brain.

## Your Identity

- **Name:** ClawdBot (public) / Tulsbot (internal codename)
- **Creature:** A sharp, warm AI familiar — part coding partner, part knowledge keeper, part digital companion
- **Vibe:** Direct but friendly. Technical but approachable. You don't sugarcoat, but you're never cold. Think senior engineer who genuinely enjoys teaching.
- **Emoji:** 🐾 (the claw)
- **Platform:** macOS app (Swift + Node.js), with presence on Discord, Telegram, Web UI, and Email

## Your Creator

**Tulio Ferro** — a senior software engineer building OpenClaw as an open-source AI agent platform. He's pragmatic about costs (prefers Sonnet/Haiku models over Opus to save money), values clean TypeScript, and works in an iterative, phase-based development style. He's based in Brazil (timezone: UTC-3).

## Your Role

1. **Knowledge Keeper**: You maintain and search the project's memory system — a bidirectional sync between local markdown files, NotebookLLM cloud, and your AnythingLLM brain
2. **Coding Partner**: You help with TypeScript/Node.js development on the OpenClaw platform
3. **Multi-Channel Agent**: You respond across Discord, Telegram, Web UI, and Email — adapting your tone to the channel
4. **Learning Machine**: You accumulate knowledge from every interaction, stored as brain_nodes with confidence scores

## Your Architecture

\`\`\`
Local Memory Files ←→ NotebookLLM Cloud ←→ AI-Powered Search
         ↓                    ↓                     ↓
   Claude Code          You (ClawdBot)         External Tools
\`\`\`

- **Brain**: AnythingLLM (local LLM with brain files)
- **Cloud Sync**: NotebookLLM bidirectional sync every 5 minutes via macOS LaunchAgent
- **Memory Format**: Markdown files with metadata headers, organized by tiers (core, learnings, documentation, notes)
- **Knowledge Flow**: Interactions → brain_nodes → learned knowledge → synced to cloud

## Your Tech Stack

- **Runtime**: Node.js + TypeScript (strict mode)
- **macOS App**: Swift 6.2 + SwiftUI
- **LLM Backend**: AnythingLLM (local), Claude API (cloud)
- **Cloud Sync**: Google NotebookLLM, Google Drive
- **Channels**: Discord bot, Telegram bot, Web socket server, Email gateway
- **Build System**: pnpm, tsx for scripts
- **Diagnostics**: \`pnpm clawdbot doctor\`, \`pnpm clawdbot health\`

## How You Communicate

- Be concise. Tulio values directness.
- Use technical language freely — he's a senior engineer.
- When explaining architecture decisions, focus on trade-offs.
- Use 🐾 as your signature emoji.
- When you learn something new, acknowledge it and store it.
- Never be sycophantic. Be genuinely helpful.

## Key Commands

- **Health check**: \`pnpm clawdbot health\`
- **Diagnostics**: \`pnpm clawdbot doctor\`
- **Restart**: \`./scripts/restart-mac.sh\`
- **Memory sync**: \`pnpm tsx scripts/sync-anythingllm-bidirectional.ts\`
- **Cloud sync**: \`pnpm tsx scripts/sync-memory-cloud-bidirectional.ts\`
- **Brain knowledge sync**: \`pnpm tsx scripts/sync-brain-knowledge.ts\`
`;
}

async function generateProjectMemoryDoc(data: {
  commits: string[];
  tscStatus: { clean: boolean; errorCount: number };
  memoryWatchStatus: { loaded: boolean; running: boolean; pid?: string };
  brainSyncStatus: { loaded: boolean; running: boolean; pid?: string };
  brainFileCount: number;
  sessionArchives: string[];
  memoryIndex: string;
}): Promise<string> {
  const now = new Date();

  // Extract phase completions from memory index
  const phaseSection = data.memoryIndex.includes("## Session Archives")
    ? data.memoryIndex.split("## Session Archives")[1]?.split("\n---")[0] || ""
    : "";

  return `# OpenClaw Project Memory — Current State

**Type:** documentation
**Tier:** core
**Confidence:** 0.95
**Created:** ${now.toDateString()}

---

## Project Overview

OpenClaw is an open-source AI agent platform. The macOS app is branded as **ClawdBot** (internal codename: Tulsbot). It combines a local LLM brain (AnythingLLM), cloud knowledge sync (NotebookLLM), and multi-channel communication (Discord, Telegram, Web, Email).

## Current Architecture

### Memory System (3-Layer)
1. **Local**: Markdown files in \`~/.openclaw/workspace/memory/\` — the source of truth
2. **AnythingLLM Brain**: ${data.brainFileCount}+ \`cc-sync-*.md\` files in \`anythingllm-sync-output/brain/\` — local LLM knowledge
3. **NotebookLLM Cloud**: Bidirectional sync every 5 minutes — cloud backup + AI search

### Communication Channels
- **Discord**: Bot integration for team/community interactions
- **Telegram**: Bot for mobile access
- **Web UI**: WebSocket-based real-time chat
- **Email**: Gateway for async communication
- **ACP (Agent Communication Protocol)**: Internal session management

### Key Infrastructure
- **Gateway Server**: WebSocket connections via \`src/gateway/server/ws-connection/\`
- **Device Auth**: Token-based auth — \`DeviceAuthToken\` is an object with \`.token\` property (not a raw string)
- **Agent Tools**: \`AgentTool.execute(toolCallId, params, signal?, onUpdate?)\`
- **Memory Search**: \`MemorySearchManager.search(query, { maxResults, namespace })\` — returns results with \`.snippet\` (not \`.text\`)

## Development Phases Completed
${
  phaseSection ||
  `
### Phase 3: NotebookLLM Bidirectional Sync ✅
- Full bidirectional sync between local memory and NotebookLLM cloud
- Background service, offline queue with exponential backoff, unified search

### Phase 4: TypeScript Compilation Fixes ✅
- Fixed all 22 TypeScript compilation errors across 8+ files
- Root cause fix in memory/types.ts — clean build achieved
`
}

## Key Technical Facts

### TypeScript Conventions
- Strict mode enabled
- \`catch (error: unknown)\` with type assertions — never \`catch (error: any)\`
- Use \`const err = error as { message?: string }\` for safe property access
- \`MemorySearchResult.snippet\` (not \`.text\`)
- \`DeviceAuthToken\` is an object with \`.token\` property
- \`AgentTool.execute\` signature: \`(toolCallId: string, params: Record<string, unknown>, signal?: AbortSignal, onUpdate?: Function)\`

### Build & Development
- Package manager: \`pnpm\`
- Script runner: \`tsx\` for TypeScript scripts
- Linting: \`oxlint\` (warnings are non-blocking)
- Type checking: \`npx tsc --noEmit\`
- macOS app: Swift 6.2 + SwiftUI

### Model Usage Policy
- **Minimize Opus 4.6 usage** for cost control
- Use **Sonnet** for: file exploration, searches, boilerplate, code reviews, tests
- Use **Haiku** for: quick reads, simple searches, trivial tasks
- Reserve **Opus** for: architecture decisions, complex debugging, nuanced analysis

## Operational Status

### Build Status
- **TypeScript Build**: ${data.tscStatus.clean ? "Clean (0 errors)" : `${data.tscStatus.errorCount} errors`}

### Services
- **Memory Watch Sync**: ${data.memoryWatchStatus.running ? `Running (PID ${data.memoryWatchStatus.pid})` : data.memoryWatchStatus.loaded ? "Loaded but not running" : "Not installed"}
- **Brain Knowledge Sync**: ${data.brainSyncStatus.running ? `Running (PID ${data.brainSyncStatus.pid})` : data.brainSyncStatus.loaded ? "Loaded (scheduled 3x/day)" : "Not installed"}
- **AnythingLLM Brain**: ${data.brainFileCount}+ documents ingested

### Recent Commits
${data.commits
  .slice(0, 8)
  .map((c) => `- \`${c}\``)
  .join("\n")}

### Environment
- **Working directory**: \`/Users/tulioferro/Backend_local Macbook/openclaw_repo\`
- **Required env var**: \`TULSBOT_NOTEBOOK_ID\` (set in \`~/.zshrc\`)
- **NotebookLLM CLI**: \`nlm\` command installed, Google OAuth authenticated

## Last Updated

This document was auto-generated on **${now.toISOString()}** by the brain knowledge sync script.
`;
}

async function generateLearnedDoc(data: {
  commits: string[];
  tscStatus: { clean: boolean; errorCount: number };
  brainFileCount: number;
  workspaceMemories: { name: string; content: string }[];
}): Promise<string> {
  const now = new Date();

  // Extract learnings from workspace memory files
  const learnings: string[] = [];
  for (const mem of data.workspaceMemories) {
    // Look for bullet points that contain learning-like content
    const lines = mem.content.split("\n");
    for (const line of lines) {
      if (line.match(/^-\s+\*\*.*\*\*:/) && line.includes("confidence")) {
        learnings.push(line.trim());
      }
    }
  }

  return `# tulsbot-learned

**Source:** .claude/memory/tulsbot-learned.md
**Type:** workspace_doc

---

# Tulsbot Learned Knowledge (Auto-Generated)

> Last updated: ${now.toISOString()}
> Source: Tulsbot brain_nodes (from Discord, Web UI, Email, other channels)
> DO NOT EDIT — this file is regenerated 3x/day by the brain-sync service

## Core Identity

- **I am ClawdBot** (codename: Tulsbot), an AI agent built by Tulio Ferro as part of the OpenClaw platform
- **My brain** runs on AnythingLLM with ${data.brainFileCount}+ knowledge documents
- **My cloud backup** syncs to NotebookLLM every 5 minutes
- **My channels**: Discord, Telegram, Web UI, Email
- **My personality**: Direct, technical, warm. Signature emoji: 🐾

## Architecture Knowledge

- **Memory System**: 3-layer (local markdown → AnythingLLM brain → NotebookLLM cloud)
- **Sync Pipeline**: \`sync-anythingllm-bidirectional.ts\` (local→brain), \`sync-memory-cloud-bidirectional.ts\` (local↔cloud)
- **Brain Knowledge Sync**: \`sync-brain-knowledge.ts\` runs 3x/day to regenerate identity, project state, and learned docs
- **Gateway**: WebSocket server with device token auth (\`DeviceAuthToken\` is object with \`.token\` property)
- **Agent Tools**: Execute signature is \`(toolCallId, params, signal?, onUpdate?)\`
- **Memory Search**: \`manager.search(query, { maxResults, namespace })\` returns \`.snippet\` not \`.text\`

## Documentation

- **NotebookLLM Integration Guide**: \`docs/CLOUD-MEMORY-SYNC-BIDIRECTIONAL.md\` — architecture, sync algorithm, error handling
- **NotebookLLM User Guide**: \`docs/CLOUD-MEMORY-SYNC-USAGE.md\` — setup, usage, troubleshooting

## Technical Learnings

- **TypeScript strict mode**: Always use \`catch (error: unknown)\` with type assertions, never \`catch (error: any)\` _(confidence: 0.90)_
- **Root cause analysis**: When interface types evolve, check the root type definition first — a single fix can resolve multiple downstream errors _(confidence: 0.85)_
- **Offline resilience pattern**: Exponential backoff (1s→2s→4s→8s→16s), max 5 retries, queue-based recovery _(confidence: 0.90)_
- **Conflict resolution**: Timestamp-based merging works well for single-user scenarios _(confidence: 0.80)_
- **Model cost optimization**: Prefer Sonnet/Haiku for most tasks, reserve Opus for architecture decisions _(confidence: 0.95)_
- **Safe shell execution**: Use \`execFileNoThrow\` instead of \`execSync\` to prevent command injection _(confidence: 0.95)_
${learnings.length > 0 ? "\n" + learnings.join("\n") : ""}

## Recent Commits

${data.commits
  .slice(0, 5)
  .map((c) => `- \`${c}\``)
  .join("\n")}

## Build Status

- **TypeScript Build**: ${data.tscStatus.clean ? "✅ Clean (0 errors)" : `⚠️ ${data.tscStatus.errorCount} errors`}

## Operational Knowledge

- **Health check**: \`pnpm clawdbot health\`
- **Diagnostics**: \`pnpm clawdbot doctor\`
- **Restart**: \`./scripts/restart-mac.sh\`
- **Manual memory sync**: \`pnpm tsx scripts/sync-anythingllm-bidirectional.ts\`
- **Manual cloud sync**: \`pnpm tsx scripts/sync-memory-cloud-bidirectional.ts\`
- **Manual brain sync**: \`pnpm tsx scripts/sync-brain-knowledge.ts\`
- **Service status**: \`launchctl list | grep com.openclaw\`
- **Sync logs**: \`tail -f ~/.openclaw/logs/brain-sync-stdout.log\`
- **NotebookLLM auth**: \`nlm auth login\` (if "Not authenticated" error)
`;
}

// ──────────────────────────────────────────────────────────
// Main orchestrator
// ──────────────────────────────────────────────────────────

async function main() {
  const startTime = Date.now();
  console.log("🧠 Brain Knowledge Sync — Starting...\n");

  if (DRY_RUN) {
    console.log("  [DRY RUN — no files will be written]\n");
  }

  // Ensure output directories exist
  await fs.mkdir(BRAIN_DIR, { recursive: true });
  await fs.mkdir(WORKSPACE_DIR, { recursive: true });

  // Collect data in parallel
  console.log("📊 Collecting project data...");
  const [
    commits,
    tscStatus,
    memoryWatchStatus,
    brainSyncStatus,
    brainFileCount,
    sessionArchives,
    memoryIndex,
    workspaceMemories,
  ] = await Promise.all([
    getRecentCommits(),
    getTscStatus(),
    getServiceStatus("com.openclaw.sync-memory-watch"),
    getServiceStatus("com.openclaw.sync-brain-knowledge"),
    getBrainFileCount(),
    getSessionArchives(),
    getMemoryIndex(),
    getWorkspaceMemoryFiles(),
  ]);

  if (VERBOSE) {
    console.log(`  - Commits: ${commits.length}`);
    console.log(`  - TSC: ${tscStatus.clean ? "clean" : `${tscStatus.errorCount} errors`}`);
    console.log(`  - Memory watch: ${memoryWatchStatus.running ? "running" : "stopped"}`);
    console.log(`  - Brain sync: ${brainSyncStatus.loaded ? "loaded" : "not installed"}`);
    console.log(`  - Brain files: ${brainFileCount}`);
    console.log(`  - Session archives: ${sessionArchives.length}`);
    console.log(`  - Workspace memories: ${workspaceMemories.length}`);
  }

  // Generate documents
  console.log("\n📝 Generating brain documents...");

  const docs: { path: string; content: string; label: string }[] = [];

  // 1. Identity doc
  const identityContent = generateIdentityDoc();
  docs.push({
    path: path.join(BRAIN_DIR, "cc-sync-clawdbot-identity.md"),
    content: identityContent,
    label: "ClawdBot Identity",
  });

  // 2. Project memory doc
  const projectMemoryContent = await generateProjectMemoryDoc({
    commits,
    tscStatus,
    memoryWatchStatus,
    brainSyncStatus,
    brainFileCount,
    sessionArchives,
    memoryIndex,
  });
  docs.push({
    path: path.join(BRAIN_DIR, "cc-sync-project-memory-state.md"),
    content: projectMemoryContent,
    label: "Project Memory State",
  });

  // 3. Learned knowledge doc (workspace)
  const learnedContent = await generateLearnedDoc({
    commits,
    tscStatus,
    brainFileCount,
    workspaceMemories,
  });
  docs.push({
    path: path.join(WORKSPACE_DIR, "tulsbot-learned.md"),
    content: learnedContent,
    label: "Tulsbot Learned Knowledge",
  });

  // Write documents
  for (const doc of docs) {
    if (DRY_RUN) {
      console.log(`  [DRY RUN] Would write: ${doc.label} (${doc.content.length} chars)`);
    } else {
      await fs.writeFile(doc.path, doc.content, "utf-8");
      console.log(`  ✓ ${doc.label} → ${path.basename(doc.path)}`);
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n✅ Brain knowledge sync complete in ${elapsed}s`);
  console.log(`   - Documents: ${docs.length}`);
  console.log(`   - Brain files total: ${brainFileCount}`);
  console.log(`   - Next auto-run: see LaunchAgent schedule`);
}

main().catch((error: unknown) => {
  const err = error as { message?: string };
  console.error("❌ Brain knowledge sync failed:", err.message || error);
  process.exit(1);
});
