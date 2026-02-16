# Tulsbot Sub-Agent Integration Session

**Date**: 2026-02-16
**Status**: Partially Complete (repo relocated mid-session)
**Branch**: `tulsbot-core-v1` (deleted — merged to main by another agent)
**Plan**: `/Users/tulioferro/.claude/plans/deep-sleeping-rabbit.md`

## Summary

Multi-session effort to integrate Tulsbot as a first-class sub-agent within OpenClaw. Tulsbot is the "working brain" (cognitive processing, 17 internal sub-agents) while OpenClaw is the "master orchestrator" (connections, routing, sessions).

## Key Discovery

Steps 2-6 of the original plan were **already complete**. The core implementation (delegate tool, knowledge loader, session enhancement, namespace isolation, memory integration) was production-ready. Work focused on Step 1 (Agent Registration & Routing) plus supporting tooling.

## What Was Accomplished

### 1. Agent Registration & Config (Complete)

- Found agent config at `~/.openclaw/openclaw.json` (not in repo code)
- Tulsbot was already in `agents.list` — added `"default": true` and `"memorySearch": { "enabled": true }`
- Fixed broken `channel: "*"` binding — `matchesChannel` does exact match only, wildcards don't work
- Set bindings to `[]`, relying on Tulsbot being default agent

### 2. Knowledge Index Generation (Complete)

- Created/fixed `scripts/generate-knowledge-index.ts` (201 lines)
- Successfully generated `knowledge-index.json` (3.38KB) + 17 individual agent JSON files
- Splits 481KB `core-app-knowledge.json` into per-agent files (6.2KB total — 99.3% savings)
- V2 knowledge loader can now use index-based on-demand loading with LRU cache

### 3. NotebookLM Extraction Script (Fix Applied, Then Lost)

- `scripts/nlm-extract-tulsbot-knowledge.sh` had broken path resolution for sibling repo structure
- Fixed: bash wrapper uses `TULSBOT_ROOT` env var with fallback chain
- Fixed: embedded Python uses `os.environ["KNOWLEDGE_JSON"]` and `os.environ["OUTPUT_DIR"]` instead of constructing own paths (single-quoted heredoc `'PYEOF'` prevents bash variable expansion)
- Verified working — produced 4 domain markdown slices (66.7KB total):
  - `workspace-architecture.md`: 1,340 lines, 15,715 bytes
  - `automation-patterns.md`: 4,218 lines, 30,389 bytes
  - `agent-roster.md`: 991 lines, 13,667 bytes
  - `notion-schemas.md`: 767 lines, 6,949 bytes
- **WARNING**: Fix was unstaged, then lost when another agent reorganized the repo. Needs re-application.

### 4. Test Results (All Passing)

- Delegate tool tests: 33/33 passed (1.17s)
- Knowledge loader tests: 12/12 passed (920ms)
- TypeScript compilation: 0 errors

### 5. Branch & PR (Superseded)

- `tulsbot-core-v1` branch pushed to origin
- `gh pr create` failed (auth error — gh CLI not authenticated)
- Another agent subsequently worked on the branch, merged to main, then deleted it

## Repo Relocation (By Other Agent)

During this session, another agent reorganized the repository:

- **Old path**: `~/Backend_local Macbook/openclaw_repo/`
- **New path**: `~/Backend_local Macbook/Clawdbot_Tulsbot 2.0/`
- Old directory still exists but has no `.git`
- Commits now on main: `1cbc60e86 refactor: reorganize repository structure for rebuild`

## What Still Needs Work

1. **Re-apply extraction script fix** — `scripts/nlm-extract-tulsbot-knowledge.sh` lost the sibling repo path resolution fix during repo reorganization. The diff was:
   - Bash: `TULSBOT_ROOT` env var with fallback chain instead of hardcoded `$REPO_ROOT/Tulsbot/`
   - Bash: `export KNOWLEDGE_JSON OUTPUT_DIR` before Python heredoc
   - Python: `os.environ["KNOWLEDGE_JSON"]` instead of `os.path.join(REPO_ROOT, "Tulsbot", ...)`

2. **E2E integration test** — Full flow test: gateway → routing → Tulsbot session → knowledge + memory → delegate tool → response

3. **`memorySearch` config consumption** — The `memorySearch` config in `openclaw.json` is NOT consumed by `session.ts` — namespace isolation is hardcoded to `"tulsbot"`. This works but is not config-driven.

4. **gh CLI authentication** — `gh auth login` needed for automated PR creation

## Key Files

| File                                        | Location     | Purpose                                    |
| ------------------------------------------- | ------------ | ------------------------------------------ |
| `~/.openclaw/openclaw.json`                 | Outside repo | Agent registration, bindings, config       |
| `src/agents/tulsbot/delegate-tool.ts`       | In repo      | 17 sub-agent routing (737 lines)           |
| `src/agents/tulsbot/knowledge-loader-v2.ts` | In repo      | Index-based on-demand loading (444 lines)  |
| `scripts/generate-knowledge-index.ts`       | In repo      | V2 index generator (201 lines)             |
| `scripts/nlm-extract-tulsbot-knowledge.sh`  | In repo      | NotebookLM extraction pipeline (289 lines) |
| `src/routing/resolve-route.ts`              | In repo      | Routing priority cascade (293 lines)       |
| `src/config/zod-schema.agents.ts`           | In repo      | Agent config Zod validation (61 lines)     |

## Technical Insights

- **Binding wildcard gotcha**: `matchesChannel` is exact match only — no glob support
- **Default agent**: First entry with `default: true` in `agents.list`, or falls back to first entry
- **Heredoc variable passing**: Single-quoted `'PYEOF'` prevents bash expansion — must `export` vars and use `os.environ` in Python
- **Entry-point guard**: `import.meta.url` vs `process.argv[1]` comparison using `fileURLToPath` + `path.resolve` for proper tsx support
- **Sibling repo**: Tulsbot lives at `~/Backend_local Macbook/Tulsbot/` as a sibling, not inside the openclaw repo
