# OpenClaw Handover — 2026-02-17

## Context

This document hands off the ClawdBot_Tulsbot 2.0 project to OpenClaw for Phase 4 sub-agent integration work. All Phase 1–3 work is complete. The codebase is clean and the test suite baseline is established.

---

## What Was Completed This Session

### 1. NotebookLLM JSON Parse Error Fix

- **Bug**: `execFileNoThrow` returns `{ stdout: "" }` when the binary is not found or command fails — it never throws. Code was calling `JSON.parse(stdout)` without guarding for empty string, causing log spam.
- **Fix**: Added guard: `if (!stdout.trim()) return ...` before any `JSON.parse(stdout)` call in nlm-related code.
- **Key pattern**: `execFileNoThrow` always returns `{ stdout, stderr, error? }`. Empty stdout must be guarded before `JSON.parse`.

### 2. LaunchAgent Restarts

All 4 sync services were restarted after code changes:

- `com.openclaw.sync-memory-watch` (continuous file watcher)
- `com.openclaw.sync-brain-knowledge` (3x/day: 9am/2pm/9pm)
- `com.openclaw.sync-memory-pull`
- `com.openclaw.sync-memory-push`

Restart command (required — `KeepAlive: true` keeps old process alive if you just save a file):

```bash
launchctl unload ~/Library/LaunchAgents/com.openclaw.<name>.plist && \
launchctl load ~/Library/LaunchAgents/com.openclaw.<name>.plist
```

Health check: `launchctl list | grep openclaw`
Live logs: `tail -f ~/.openclaw/logs/sync-watch-stdout.log`

### 3. Full Test Suite Run — Baseline Established

**Runner**: `pnpm run test:parallel` → `scripts/test-parallel.mjs`
**Output**: `/tmp/test-run-output.txt` (test names only — no stack traces)
**Stack traces**: `pnpm vitest run <path/to/test.ts> --reporter=verbose`

**Baseline: ~493 passing, 48 failing across 6 files**

---

## Failing Test Triage

### Group A — Expected Phase 4 TDD Scaffolding (39 failures) — DO NOT FIX YET

These tests are intentional scaffolding for Phase 4. They will remain red until sub-agents are implemented.

| File                                          | Failures | Reason                                                  |
| --------------------------------------------- | -------- | ------------------------------------------------------- |
| `src/agents/tulsbot/knowledge-loader.test.ts` | 12       | Phase 4 TDD — KnowledgeLoader sub-agent not implemented |
| `src/agents/tulsbot/delegate-tool.test.ts`    | 27       | Phase 4 TDD — DelegateTool sub-agent not implemented    |

**Do not attempt to fix these — they are the Phase 4 implementation targets.**

### Group B — Minor Logic Bugs (5 failures) — LOW PRIORITY

Small pre-existing issues unrelated to current work. Safe to fix when encountered.

| File                         | Failures | Notes                            |
| ---------------------------- | -------- | -------------------------------- |
| `src/utils/retry.test.ts`    | 2        | Edge case in backoff calculation |
| `src/memory/store.test.ts`   | 2        | Timing-sensitive assertion       |
| `src/gateway/router.test.ts` | 1        | Missing null guard               |

### Group C — Intermittent Process-Exit Failures (4 failures) — INVESTIGATE

These pass in isolation but occasionally fail in parallel runs. Suspected: process cleanup race conditions.

| File                                             | Failures | Notes                                                        |
| ------------------------------------------------ | -------- | ------------------------------------------------------------ |
| `src/agents/lobster/lobster-tool.test.ts`        | 2–4      | Subprocess lifecycle, may need `process.exit(0)` in fixtures |
| `src/gateway/server-http.error-recovery.test.ts` | 0–2      | New file, intermittent                                       |

**Key pattern** (from `MEMORY.md`): Subprocess test fixtures MUST call `process.exit(0)` after writing output. Without it, the Node.js event loop stays active and the subprocess never exits naturally.

---

## Phase 4 Roadmap

Phase 4 implements the 17 Tulsbot sub-agents. The TDD scaffolding (Group A above) defines the contracts.

### Entry Points

- `src/agents/tulsbot/knowledge-loader.test.ts` — implement `KnowledgeLoader`
- `src/agents/tulsbot/delegate-tool.test.ts` — implement `DelegateTool`

### Sub-Agent Roster (from `.agent/CLAUDE.md`)

| Agent                | Role                                 |
| -------------------- | ------------------------------------ |
| Orchestrator         | Central coordinator, routes tasks    |
| PM Specialist        | Project management, sprint planning  |
| Memory Heartbeat     | Periodic knowledge sync              |
| Intelligence Router  | Intent classification, query routing |
| License Control      | License management                   |
| Content Curator      | Content organization, tagging        |
| Analytics Engine     | Workspace analytics                  |
| Notification Manager | Alert routing, digest scheduling     |
| Template Engine      | Page/database template management    |
| Integration Bridge   | External service connections         |
| Search Indexer       | Workspace search optimization        |
| Workflow Automator   | Automation rule execution            |
| Quality Assurance    | Data validation, consistency checks  |
| Access Controller    | Permission management                |
| Backup Manager       | Workspace backup                     |
| Migration Assistant  | Data migration, schema evolution     |
| Debug Inspector      | Automation debugging                 |

Agent definitions are sourced from `Tulsbot/.tulsbot/core-app-knowledge.json`.

---

## Key Files

| File                                       | Purpose                                                     |
| ------------------------------------------ | ----------------------------------------------------------- |
| `AGENTS.md`                                | Main Claude Code guidelines (symlink target of `CLAUDE.md`) |
| `.claude.local.md`                         | Local machine notes (LaunchAgents, test suite quirks)       |
| `.agent/CLAUDE.md`                         | Tulsbot-specific agent guidelines                           |
| `REBUILD-PLAN.md`                          | Phased rebuild roadmap                                      |
| `Tulsbot/.tulsbot/core-app-knowledge.json` | Sub-agent definitions (synced from Notion)                  |
| `scripts/test-parallel.mjs`                | Parallel test runner                                        |
| `scripts/nlm-extract-tulsbot-knowledge.sh` | Knowledge extraction for NotebookLM                         |

---

## Useful Commands

```bash
# Run full test suite
pnpm run test:parallel

# Run single test file with stack traces
pnpm vitest run src/agents/tulsbot/knowledge-loader.test.ts --reporter=verbose

# Check LaunchAgent health
launchctl list | grep openclaw

# Restart a sync service
launchctl unload ~/Library/LaunchAgents/com.openclaw.sync-memory-watch.plist && \
launchctl load ~/Library/LaunchAgents/com.openclaw.sync-memory-watch.plist

# Live logs
tail -f ~/.openclaw/logs/sync-watch-stdout.log

# Type check
pnpm tsc --noEmit

# Build
pnpm build
```

---

## Important Patterns

### `execFileNoThrow` Contract

Always guard empty stdout before `JSON.parse`:

```typescript
const { stdout, stderr, error } = await execFileNoThrow("nlm", args);
if (!stdout.trim()) {
  // handle missing binary or command failure
  return null;
}
const result = JSON.parse(stdout);
```

### Subprocess Test Fixtures

Always call `process.exit(0)` at the end of fake subprocess scripts:

```typescript
const scriptBody = `process.stdout.write(JSON.stringify(data));\n` + `process.exit(0);\n`; // ← required, or subprocess hangs
```

### CLAUDE.md is a Symlink

`CLAUDE.md → AGENTS.md` — edit `AGENTS.md` directly. Writing to `CLAUDE.md` via path manipulation may fail due to symlink resolution.

---

## State at Handover

- **Branch**: `main`
- **Uncommitted changes**: None (all changes committed or intentionally untracked)
- **Phase 1**: ✅ Complete
- **Phase 2**: ✅ Complete (Agent 7)
- **Phase 3**: ✅ Complete (Agent 9)
- **Phase 4**: 🔲 Queued — this is the next work item
- **Phase 5**: Local LLM integration (blocked on Phase 4)
- **Phase 6**: Tulsbot integration (blocked on Phase 5)

---

_Generated: 2026-02-17_
