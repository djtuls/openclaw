# Brain Knowledge Sync Automation - Session Archive

**Date**: 2026-02-16
**Session ID**: 86c08775-02c2-44ad-8076-75bf34182249
**Branch**: `tulsbot-core-v1`
**Status**: ✅ Complete (Production)
**Commit**: `ad8e74765`

---

## Executive Summary

Built and deployed a complete automation system that keeps ClawdBot (local AnythingLLM brain) synchronized with live project state. The system runs 3 times daily via macOS LaunchAgent and regenerates 3 brain documents from current commits, build status, services, session archives, and learned knowledge.

**Key Achievement**: ClawdBot now has real-time awareness of project state without manual updates.

---

## Deliverables

### 1. Core Sync Script

**File**: `scripts/sync-brain-knowledge.ts` (~380 lines)

- Regenerates 3 brain documents from live project state:
  - `brain/cc-sync-clawdbot-identity.md` — ClawdBot identity, personality, capabilities
  - `brain/cc-sync-project-memory-state.md` — project architecture, phases, build status, environment
  - `workspace/tulsbot-learned.md` — technical learnings, conventions, operational commands
- Uses `execFileNoThrow` for all shell operations (project security hook requirement)
- Includes dry-run mode: `pnpm tsx scripts/sync-brain-knowledge.ts --dry-run`
- First production run: 13.3s to generate all 3 documents

### 2. macOS LaunchAgent

**File**: `scripts/com.openclaw.sync-brain-knowledge.plist`

- Scheduled to run 3 times daily: 9am, 2pm, 9pm
- `RunAtLoad: true` for immediate first run on service load
- Uses `StartCalendarInterval` array for multiple daily schedules
- Logs to `~/.openclaw/logs/brain-knowledge-{stdout,stderr}.log`

### 3. Service Manager

**File**: `scripts/setup-brain-sync-service.sh` (~150 lines, executable)

- Commands: `install`, `uninstall`, `start`, `stop`, `restart`, `status`, `logs`, `follow`, `run`
- `status` - check if service is running
- `logs` - view last 50 lines of output
- `follow` - tail -f the logs
- `run` - manual trigger (bypass launchd scheduler)
- Complete service lifecycle management

### 4. Documentation

**File**: `docs/PEER-REVIEW-REPORT.md`

- Peer review rebuild plan analysis from previous session
- Committed alongside automation files

---

## Technical Implementation

### Security Compliance

All shell operations use `execFileNoThrow` instead of `execSync` to comply with project security hook:

```typescript
import { execFileNoThrow } from "../tools/src/shared/shell.js";

const gitLog = await execFileNoThrow("git", ["log", "--oneline", "-10"]);
```

### LaunchAgent Schedule Configuration

```xml
<key>StartCalendarInterval</key>
<array>
    <dict><key>Hour</key><integer>9</integer><key>Minute</key><integer>0</integer></dict>
    <dict><key>Hour</key><integer>14</integer><key>Minute</key><integer>0</integer></dict>
    <dict><key>Hour</key><integer>21</integer><key>Minute</key><integer>0</integer></dict>
</array>
```

### Brain Document Format

Each document includes metadata header:

```markdown
---
Type: [ClawdBot Identity | Project Memory State | Learned Knowledge]
Tier: [1-Critical | 2-High | 3-Medium]
Confidence: [0.95-1.0]
Created: [ISO timestamp]
---
```

---

## Installation & Verification

### Service Installation

```bash
./scripts/setup-brain-sync-service.sh install
```

### Verification Steps

1. **Check service status**:

   ```bash
   ./scripts/setup-brain-sync-service.sh status
   # Should show: ✓ Brain knowledge sync service is running
   ```

2. **View logs**:

   ```bash
   ./scripts/setup-brain-sync-service.sh logs
   # Should show successful runs with timing
   ```

3. **Manual trigger** (test without waiting for schedule):

   ```bash
   ./scripts/setup-brain-sync-service.sh run
   ```

4. **Verify output files**:
   ```bash
   ls -lh brain/cc-sync-*.md workspace/tulsbot-learned.md
   ```

---

## Git Workflow & Fixes

### Files Committed

- `scripts/sync-brain-knowledge.ts` (new file)
- `scripts/com.openclaw.sync-brain-knowledge.plist` (new file)
- `scripts/setup-brain-sync-service.sh` (new file, executable)
- `docs/PEER-REVIEW-REPORT.md` (new file)
- `.gitignore` (modified)

### Runtime Artifact Exclusion

Added to `.gitignore`:

```
# Brain knowledge sync runtime state
.sync-state.db
```

**Rationale**: `.sync-state.db` is a SQLite database that changes on every sync run. Including it in git would create merge conflicts and bloat history.

### Commit Details

```
Commit: ad8e74765
Message: feat(scripts): add brain knowledge sync automation and peer review docs
Stats: 5 files changed, 1,341 insertions(+)
Checks: ✓ Lint passed, ✓ Format passed
```

---

## Bug Fixes During Session

### 1. Duplicate Closing Tags in LaunchAgent Plist

**Issue**: The plist file had duplicate `</dict></plist>` closing tags at lines 59-61.

**Detection**: Caught proactively by reading the file immediately after creation.

**Fix**: Removed duplicate block using Edit tool, validated with `plutil -lint`.

**Root Cause**: Write tool included closing tags twice.

### 2. `.gitignore` Staging Issue

**Issue**: `.gitignore` showed in both staged and unstaged sections after first `git add`.

**Fix**: Re-ran `git add .gitignore` to capture the append operation that added `.sync-state.db` exclusion.

---

## MEMORY.md Updates

### Session Archive Entry

Added to **Session Archives** section:

```markdown
### Brain Knowledge Sync Automation - 2026-02-16

- **Status**: ✅ Production (running as macOS LaunchAgent)
- **Key Deliverables**:
  - `scripts/sync-brain-knowledge.ts` — regenerates 3 brain docs from live project state
  - `scripts/com.openclaw.sync-brain-knowledge.plist` — LaunchAgent scheduled 3x/day
  - `scripts/setup-brain-sync-service.sh` — service manager
- **Brain Documents Generated**:
  - `brain/cc-sync-clawdbot-identity.md` — ClawdBot identity, personality, capabilities
  - `brain/cc-sync-project-memory-state.md` — project architecture, phases, build status
  - `workspace/tulsbot-learned.md` — technical learnings, conventions, operational commands
- **Security Note**: Uses `execFileNoThrow` for all shell calls
- **Service Commands**: status, logs, run, install/uninstall/start/stop/restart
```

### Operational Notes Section

Added new section for quick operational reference:

```markdown
## Operational Notes

### Brain Knowledge Sync (3x/day)

- **What it does**: Regenerates 3 AnythingLLM brain docs from live project state
- **Schedule**: 9am, 2pm, 9pm via macOS LaunchAgent (`com.openclaw.sync-brain-knowledge`)
- **Quick check**: `./scripts/setup-brain-sync-service.sh status`
- **Logs**: `~/.openclaw/logs/brain-knowledge-{stdout,stderr}.log`
- **Manual run**: `pnpm tsx scripts/sync-brain-knowledge.ts` or `./scripts/setup-brain-sync-service.sh run`
- **If broken**: `./scripts/setup-brain-sync-service.sh restart` or reinstall

### Background Services (macOS LaunchAgents)

- `com.openclaw.sync-brain-knowledge` — brain knowledge sync 3x/day
- Check all: `launchctl list | grep com.openclaw`
```

---

## 3-Layer Memory Architecture

This automation completes the project's 3-layer memory system:

1. **Local Markdown** (source of truth)
   - `MEMORY.md`, session archives, workspace docs
   - Version controlled in git

2. **AnythingLLM Brain** (ClawdBot - local AI)
   - Synced 3x/day via this automation
   - Provides conversational access to project knowledge

3. **NotebookLLM Cloud** (Phase 3 integration)
   - Bidirectional sync with local markdown
   - Offline queue with retry logic
   - Background service running every 5min

---

## Command Reference

### Service Management

```bash
# Install and start
./scripts/setup-brain-sync-service.sh install

# Check status
./scripts/setup-brain-sync-service.sh status

# View recent logs
./scripts/setup-brain-sync-service.sh logs

# Follow logs in real-time
./scripts/setup-brain-sync-service.sh follow

# Manual trigger (bypass schedule)
./scripts/setup-brain-sync-service.sh run

# Restart service
./scripts/setup-brain-sync-service.sh restart

# Stop service
./scripts/setup-brain-sync-service.sh stop

# Uninstall completely
./scripts/setup-brain-sync-service.sh uninstall
```

### Direct Script Execution

```bash
# Normal run
pnpm tsx scripts/sync-brain-knowledge.ts

# Dry run (preview without writing)
pnpm tsx scripts/sync-brain-knowledge.ts --dry-run

# Check launchd service
launchctl list | grep com.openclaw.sync-brain-knowledge

# View service logs
tail -f ~/.openclaw/logs/brain-knowledge-stdout.log
tail -f ~/.openclaw/logs/brain-knowledge-stderr.log
```

---

## Next Steps (Pending User Confirmation)

Based on user's explicit request "Please commit all of my changes so we can make a PR", the natural next steps are:

1. **Push branch to remote**:

   ```bash
   git push origin tulsbot-core-v1
   ```

2. **Create Pull Request**:
   - Title: "feat(scripts): Add brain knowledge sync automation"
   - Base: `main`
   - Compare: `tulsbot-core-v1`
   - Description: Include deliverables, technical implementation, and verification steps

**Status**: Awaiting user confirmation to proceed (user requested "archive this chat" before confirming).

---

## Session Timeline

1. **Previous Session Compacted**: User requested to share memory with ClawdBot and create 3x/day automation
2. **Session Started**: Tasks 2-4 pending (LaunchAgent, service manager, installation)
3. **LaunchAgent Created**: `com.openclaw.sync-brain-knowledge.plist`
4. **Duplicate Tag Bug Fixed**: Proactive detection and fix before commit
5. **Service Manager Created**: `setup-brain-sync-service.sh` with full lifecycle commands
6. **Service Installed**: First run completed successfully in 13.3s
7. **User Request**: "add this to sop and mental note"
8. **MEMORY.md Updated**: Added session archive and operational notes
9. **User Request**: "Please commit all of my changes so we can make a PR."
10. **Git Workflow**: Staged files, excluded runtime artifact, created commit
11. **Commit Successful**: `ad8e74765` - 5 files, 1,341 insertions, all checks passed
12. **User Request**: "archive this chat"
13. **Archive Created**: This document

---

## Related Documentation

- [Phase 3: NotebookLLM Integration](sessions/phase3-notebookllm-integration-complete.md) - Bidirectional sync with cloud
- [MEMORY.md](MEMORY.md) - Project memory and session archives
- [ARCHIVAL-PROCESS.md](ARCHIVAL-PROCESS.md) - Session archival guidelines (referenced in Phase 3)

---

## Lessons Learned

### Technical

1. **LaunchAgent Array Scheduling**: Use `StartCalendarInterval` array for multiple daily runs instead of multiple plist files
2. **execFileNoThrow Pattern**: Essential for project security compliance - always use instead of `execSync`
3. **Runtime Artifact Management**: Exclude databases/caches from git early to prevent commit bloat
4. **Service Management Pattern**: Single shell script with subcommands (install/status/logs/run) provides excellent UX

### Process

1. **Proactive Bug Detection**: Reading files immediately after creation catches errors before commit
2. **Operational Documentation**: Adding "Operational Notes" to MEMORY.md provides quick reference for future sessions
3. **Session Archiving**: Comprehensive archives with timeline, fixes, and lessons learned provide valuable context for future work

### Automation

1. **3x/Day Frequency**: Balances freshness with resource usage (9am/2pm/9pm covers work hours + evening)
2. **RunAtLoad**: Ensures immediate first run on service install for verification
3. **Dry-Run Mode**: Critical for testing and debugging without side effects

---

**Session End**: Ready for push and PR creation upon user confirmation.
