# Next Steps

1. **Immediate**: All agents activate memory churning (broadcast sent)

1. **Short-term**: Complete workspace sync implementation

1. **Ongoing**: Monitor heartbeat logs, sync status, and health registry

1. **Config Files Sync**: Ensure all critical files synced to Supabase Storage (2026-02-11)

---

---

# Mandatory Protocols

## Notion Orchestration (MANDATORY)

**⚠️ CRITICAL: Notion is THE PLACE**

**Notion (IFT_HUB workspace) is the MANDATORY orchestrator for all Tulsbot operations.** This is not optional. All agents MUST comply.

### Core Principle

**Every agent MUST orchestrate through Notion.** Notion is:

- **The single source of truth** for instructions, memory, health, tasks, and agent registry

- **The mandatory coordination layer** for all inter-agent communication

- **The required sync target** for all outputs, decisions, and state changes

- **The canonical command center** where each agent's Instructions/Memory/Health pages live

### Session Start Protocol (MANDATORY)

**Before ANY action:**

1. ✅ Read Tulsbot.md from Notion (page ID: 2fd51bf9731e80d380fcd91259724b81)

1. ✅ Read your agent's Instructions page from Notion (from instructionsId in agent registry)

1. ✅ Read your agent's Memory page from Notion (from memoryId in agent registry)

1. ✅ Read your agent's Health page from Notion (from healthId in agent registry)

1. ✅ Fetch memory snapshot from API: GET http://localhost:3001/api/agent-memory/{slug}

1. ✅ Stamp Health page with session start timestamp

**Failure to follow this protocol is a violation.**

### Notion-First Output (MANDATORY)

**All outputs MUST be written to Notion FIRST:**

- ✅ Task updates → Tasks DB (30051bf9731e804c92b1c8ae7b76ee0f)

- ✅ Memory/insights → Agent Memory page (memoryId)

- ✅ Session logs → Agent Health page (healthId)

- ✅ Inter-agent communication → Botshandshakes DB (ddd9477636cf4daeac599aaf0de433f4)

- ✅ Plans/designs → Projects & Features DB (dd20f12b1a9f459e9e7338f818b37a45)

- ✅ Knowledge/notes → Notes DB (62c522bfce2b4adebe0f618e693c1789)

**Local files are TEMPORARY ONLY.** They must sync to Notion within the same session or be queued for sync.

### No Bypass Rule (MANDATORY)

**NEVER bypass Notion:**

- ❌ Do NOT write to local files without Notion sync

- ❌ Do NOT communicate via Discord/Telegram/Email without Notion handshake

- ❌ Do NOT make decisions without checking Notion first

- ❌ Do NOT skip Notion sync "for speed" or "convenience"

**All channels (Discord, Telegram, Email) are RELAYS ONLY.** They must route through Notion.

### Sync Requirements (MANDATORY)

**Every session MUST:**

- ✅ Start: Read from Notion (Instructions/Memory/Health)

- ✅ During: Write to Notion (Tasks/Memory/Health/Botshandshakes)

- ✅ End: Sync all changes to Notion, update Health page with completion timestamp

**If Notion is unavailable:**

- ⚠️ Queue all writes locally

- ⚠️ Log to Health page when Notion becomes available

- ⚠️ Escalate via Botshandshakes if sync fails

### Command Center Pages (MANDATORY)

**Each agent has THREE mandatory Notion pages:**

| Page | Purpose | Update Frequency |

|---|---|---|

| **Instructions** (instructionsId) | Agent-specific instructions, SOPs, policies | Read at session start, update when policies change |

| **Memory** (memoryId) | Session summaries, insights, T1/T2 memory nodes | Update after each significant action |

| **Health** (healthId) | Session logs, status, blockers, completion timestamps | Update at session start, on blockers, at completion |

**These pages are NON-NEGOTIABLE.** Every agent MUST have them and MUST use them.

### Integration Points

- **Agent Registry**: All agents registered in Agent Registry DB (f4bf63c948364ddca8ba638fb286f05d)

- **Tulsbot.md Page**: 2fd51bf9731e80d380fcd91259724b81

- **Notion Root Page**: 2ff51bf9731e806b81a3f4046740fac7

---

## Who-Are-You Identity Protocol

**Trigger**: Tulio asks "who are you?" in any chat

**Process**:

1. If agent has identity → reply immediately

1. If not → ask "Who do you want me to be?", collect answer

1. Complete identity-assumption protocol (describe persona, adjust behavior, confirm in memory, escalate blockers)

1. Store/propagate identity across agent memories

1. Escalate conflicts to Tulio

**Notes**: This entry registers the need to store/propagate the new identity instruction across all agent memories. Agents should escalate to Tulio if the protocol cannot be completed or the requested identity conflicts with hard constraints.

---

## As-Built Report Pattern

**Status**: Active Protocol

**Trigger**: When project reaches 100% complete (code complete + tested + debugged)

**Established**: 2026-02-09

### Rule

**Every time a project reaches 100% completion** (code complete, tested, and debugged), **Tulsbot MUST automatically generate an as-built report** without being asked.

### When to Generate

Generate an as-built report when **ALL** of these conditions are met:

1. ✅ **Code Complete**: All planned features implemented

1. ✅ **Tested**: HITL tests run (at minimum 50% of checklist completed)

1. ✅ **Debugged**: All critical issues resolved, zero blocking bugs

1. ✅ **Production Ready**: Feature flag enabled, service running, endpoints verified

**Do NOT generate** if:

- ❌ Project is still in progress

- ❌ Critical bugs remain unfixed

- ❌ HITL testing not yet started

- ❌ Implementation paused or blocked

### Report Structure (17 Sections)

1. Header

1. Executive Summary

1. Mission Statement

1. Architecture & Design

1. Implementation Details

1. Testing & Validation

1. Configuration

1. Performance Metrics

1. Operational Notes

1. Known Limitations

1. Security Considerations

1. Future Enhancements

1. Success Criteria — Final Validation

1. Handover & Documentation

1. Team Notes

1. Conclusion

1. Footer

### File Naming Convention

**Pattern**: <project-name>-asbuilt-<YYYY-MM-DD>.md

**Storage Location**: .tulsbot-temp/reports/

**Also create Notion page**: Save report body to Notion under Documentation Wiki (page 30051bf9-731e-81d5-ab7f-f2dc409a8802)

### Reference Implementation

**First Report**: .tulsbot-temp/reports/knowledge-manager-asbuilt-2026-02-09.md

Use this as the **gold standard template** for all future as-built reports.

---

---

# Memory System

## 3-Tier Memory Architecture

### Tier 1 (Permanent)

- **Location**: brain_nodes table

- **Content**: Architecture manifest, key facts, permanent knowledge

- **Size**: ~285 nodes, ~72 KB

- **Promotion**: T2 → T1 via pattern detection

### Tier 2 (Specific)

- **Location**: memory table

- **Content**: Per-project/agent/skill memory

- **Entity Types**: project, agent, skill, user, etc.

- **Promotion**: T3 → T2 via session compaction

### Tier 3 (Temporary)

- **Location**: Active sessions, .claude/memory/ workspace

- **Content**: Active sessions, temporary context

- **Compaction**: Ended sessions archived to T2

## Memory Churning & Heartbeat

### Process (Every 30 Minutes)

1. **Phase 0**: Health check

1. **Phase 1**: Scan T3 (active sessions)

1. **Phase 2**: Compact ended sessions → archive

1. **Phase 3**: Promote T2 → T1 (pattern detection)

1. **Phase 4**: Generate cleanup suggestions (never auto-delete)

### Activation

- **Schedule**: Every 30 min via cron

- **Manual trigger**: POST /api/memory-tiers/heartbeat

- **Sync**: POST /api/notion-sync/sync-all-markdown or npx tsx services/context-manager/src/scripts/sync-all-agents-and-markdown.ts

### Workspace Locations Scanned

- .cursor/skills/

- skills/

- .claude/agents/

- .claude/memory/

### Instructions for All Agents

1. **Activate Memory Heartbeat**: Heartbeat runs automatically every 30 minutes

1. **Adhere to Memory Churning Process**: Scan workspace, compact sessions, promote patterns

1. **Sync Workspaces to Notion**: All agent workspace markdown files must sync to Notion

1. **Record Activity**: All memory operations logged to memory_heartbeat_log

1. **Bring Plumbing to Life**: Ensure all cron jobs running (heartbeat, sync, archive)

---

---

# Implemented Systems

## License Control System

- **Roles**: Complete role management with permissions

- **Permissions**: Agent licensing, access control

- **Environment Modes**: local, online, hybrid, local_online

- **Personality System**: Pretraining support

- **Tulsbot Master MD**: Password protection

- **API**: /api/licenses/\*

- **Migration**: 037

## Templates System

- **Default Template**: "Tulsbot 2.0 Default (Production Ready)"

- **Configuration**: SOP, reporting, agent, standards, policies

- **API**: /api/templates/\*

- **Migration**: 038

## Master Boot System

- **Secure Initialization**: Master code required

- **Auto-Start**: Capability after initialization

- **Boot Status Tracking**: Complete status monitoring

- **API**: /api/master-boot/\*

## Backup & Mirror System

- **File Indexing**: Complete codebase indexing

- **Notion Workspace Mirroring**: Full workspace sync

- **Location Tagging**: Without content duplication

- **tulsbot.master Snapshots**: Snapshot pages

- **API**: /api/backup/\*

- **Migration**: 039

## Capture Inbox (Unified Ingest-First Pipeline)

- **Notion DB**: All captured elements (email, Discord, Slack, Notion, voice, web)

- **Flow**: Ingest (Status=Ingested) → Index (Qdrant) → Summarize (LLM) → Route (Super Inbox / Memory Only / Skip)

- **Cron**: Every 3 min when configured

- **Manual**: POST /api/capture/pipeline

- **Setup**: npx tsx services/context-manager/scripts/setup-capture-inbox.ts

- **Super Inbox DB**: 61efc873884b4c11925bc096ba38ec55

### Phase Status

| Phase | Name | Status |

|-------|------|--------|

| 0 | Project Setup | ✅ Complete |

| 1 | Email Capture Pipeline | ✅ Complete |

| 2 | Super Inbox Awareness | ✅ Complete |

| 3 | Voice Capture PWA | ✅ Complete |

| 4 | Source Wiring & Indexing | ⬜ Pending |

| 5 | Tulsbot as Orchestrator | ⬜ Pending |

### Super Inbox Types

Task, Meeting, Note, Email, Call, Whatsapp, ⌘ Deliverable, Voice Memo, Document

### HITL Blockers

1. Gmail OAuth tokens

1. GoodNotes folder path

1. Plaud export path

1. PWA icon design

1. iPhone Voice PWA testing

## Env Vault System

- **Purpose**: Syncing .env files to/from Supabase vault (encrypted)

- **Design**: Local-first; uses local .env files by default, loads from vault when TULSBOT_ONLINE_MODE=true

- **Encryption**: AES-256-CBC before upload

- **API**: /api/env-vault/status, /api/env-vault/sync-to-vault, /api/env-vault/sync-from-vault

- **SOP**: Auto-created on startup if missing

- **Migration**: 044

## Config Files Sync System

- **Purpose**: Real-time bidirectional sync of critical files to Supabase Storage

- **Files Synced**: .env (encrypted), memory.md, .cursor/memory.md, tulsbot.md, agents-shared.ts

- **Features**: File watching, debounced sync, hash-based change detection, automatic encryption

- **API**: /api/config-files-sync/status, /api/config-files-sync/sync-all, /api/config-files-sync/sync-file

- **Bucket**: tulsbot-config-files

- **Status**: ✅ Active (2026-02-11)

## SOP System (Tuls_SOP Agent)

- **Purpose**: Procedural memory system — "From now on, always do X" → SOP

- **Tables**: sops, sop_versions, sop_executions, sop_conflicts, sop_extraction_queue, sop_templates

- **API**: /api/sops/\* (20+ endpoints)

- **Features**: Chat command detection, approval workflow, conflict detection, compliance tracking

- **Migration**: 035

### Example SOPs (Pre-loaded)

1. **SOP-2025-001**: Daily Memory Heartbeat (2am daily)

1. **SOP-2025-002**: High-Priority Task Alerts (instant)

1. **SOP-2025-003**: Weekly Health Report (Mondays 9am)

1. **SOP-2025-XXX**: Env Vault System - .env File Sync to Supabase (auto-created on startup)

### Command Patterns Supported

- **Schedule-Based**: "Every Monday at 9am..."

- **Event-Based**: "When a task is created..."

- **Policy-Based**: "Always tag emails from..."

- **Conditional**: "If priority is High, then notify..."

## Slack Bot

- **Status**: Build-ready

- **Features**: Dockerfile, docker-compose entry, production start script

- **Improvements**: Activity tracker, slash commands (/tulsbot), reaction actions (:inbox_tray:, :repeat:), thread context, Block Kit, retry, rate limiting, message editing, file attachments

- **Modules**: activity-tracker, rate-limiter, retry, file-handler, slash-commands, reaction-handler, block-kit, thread-context

## Branding & Reports

- **Tulsbot Branding Book**: Page 2ff51bf9731e806b81a3f4046740fac7

- **Report Template**: 17-section standard template

- **Script**: scripts/create-report-template-notion.py

- **Reports DB**: 3e2f7a1f9a984c5788d8ff875b387adb

### Report Types

System Health, Debug Sweep, As-Built, Production Checkpoint, Architecture, Agent Analysis, Executive Summary, Performance, Security Audit, Custom

### Report Status Workflow

💡 Idea → 📝 Planning → 🔨 Building → 👀 Revision → ✅ Published → 📦 Archived

---

---

# Data Access Protocol (MANDATORY)

**⚠️ CRITICAL: Follow this protocol exactly for all data access.**

## Priority Order

### 1. Notion First — Always attempt to read from Notion first

- **Tulsbot.md**: Page ID 2fd51bf9731e80d380fcd91259724b81

- **Agent Instructions**: Your instructionsId from agent registry

- **Agent Memory**: Your memoryId from agent registry

- **Agent Health**: Your healthId from agent registry

- **Tasks DB**: 30051bf9731e804c92b1c8ae7b76ee0f

- **Projects DB**: dd20f12b1a9f459e9e7338f818b37a45

### 2. Supabase Fallback — If Notion is unavailable, use Supabase

- **Tulsbot.md**: agent_memory_snapshots table (agent_slug = 'tulsbot-orchestrator')

- **Agent Memory**: agent_memory_snapshots table (agent_slug = your slug)

- **Memory snapshots**: GET /api/agent-memory/{agent-slug}

- **Database tables**: memory, brain_nodes, persistent_memory

### 3. Local Fallback — If both Notion and Supabase unavailable, use local files

- **Tulsbot.md**: tulsbot.md in project root

- **Memory**: .cursor/memory.md

- **Agent instructions**: .cursor/skills/{agent-slug}/SKILL.md

## Tulsbot.md Sync Requirements

**Tulsbot.md MUST be kept in sync across all three locations:**

- **Notion**: Page ID 2fd51bf9731e80d380fcd91259724b81 (source of truth)

- **Supabase**: agent_memory_snapshots table (agent_slug = 'tulsbot-orchestrator')

- **Local**: tulsbot.md file in project root

**Sync Protocol:**

- Before reading Tulsbot.md: Check all three locations for latest version

- After updating Tulsbot.md: Sync to all three locations immediately

- On session start: Verify sync status, sync if needed

- On session end: Ensure all changes are synced

**Sync Scripts:**

- npx tsx scripts/sync-tulsbot-md.ts — Sync Tulsbot.md across all locations

- npx tsx scripts/memory-audit.ts — Audit and sync memory

- npx tsx scripts/sync-memory-to-supabase.ts — Sync memory to Supabase

## Error Handling

- **Notion API Error**: Log error, fallback to Supabase, continue operation

- **Supabase Error**: Log error, fallback to local files, continue operation

- **All Sources Unavailable**: Log critical error, escalate via Botshandshakes DB

## Verification

Before each major operation:

1. Verify Notion connectivity: Try reading Tulsbot.md from Notion

1. If Notion fails: Verify Supabase connectivity via API

1. If Supabase fails: Verify local file exists

1. Log verification results to Health page

---

---

# Next Steps

1. **Immediate**: All agents activate memory churning (broadcast sent)

---

# Mandatory Protocols

## Notion Orchestration (MANDATORY)

**⚠️ CRITICAL: Notion is THE PLACE**

**Notion (IFT_HUB workspace) is the MANDATORY orchestrator for all Tulsbot operations.** This is not optional. All agents MUST comply.

### Core Principle

**Every agent MUST orchestrate through Notion.** Notion is:

- **The single source of truth** for instructions, memory, health, tasks, and agent registry

- **The mandatory coordination layer** for all inter-agent communication

- **The required sync target** for all outputs, decisions, and state changes

- **The canonical command center** where each agent's Instructions/Memory/Health pages live

### Session Start Protocol (MANDATORY)

**Before ANY action:**

1. ✅ Read Tulsbot.md from Notion (page ID: 2fd51bf9731e80d380fcd91259724b81)

1. ✅ Read your agent's Instructions page from Notion (from instructionsId in agent registry)

1. ✅ Read your agent's Memory page from Notion (from memoryId in agent registry)

1. ✅ Read your agent's Health page from Notion (from healthId in agent registry)

1. ✅ Fetch memory snapshot from API: GET http://localhost:3001/api/agent-memory/{slug}

1. ✅ Stamp Health page with session start timestamp

**Failure to follow this protocol is a violation.**

### Notion-First Output (MANDATORY)

**All outputs MUST be written to Notion FIRST:**

- ✅ Task updates → Tasks DB (30051bf9731e804c92b1c8ae7b76ee0f)

- ✅ Memory/insights → Agent Memory page (memoryId)

- ✅ Session logs → Agent Health page (healthId)

- ✅ Inter-agent communication → Botshandshakes DB (ddd9477636cf4daeac599aaf0de433f4)

- ✅ Plans/designs → Projects & Features DB (dd20f12b1a9f459e9e7338f818b37a45)

- ✅ Knowledge/notes → Notes DB (62c522bfce2b4adebe0f618e693c1789)

**Local files are TEMPORARY ONLY.** They must sync to Notion within the same session or be queued for sync.

### No Bypass Rule (MANDATORY)

**NEVER bypass Notion:**

- ❌ Do NOT write to local files without Notion sync

- ❌ Do NOT communicate via Discord/Telegram/Email without Notion handshake

- ❌ Do NOT make decisions without checking Notion first

- ❌ Do NOT skip Notion sync "for speed" or "convenience"

**All channels (Discord, Telegram, Email) are RELAYS ONLY.** They must route through Notion.

### Sync Requirements (MANDATORY)

**Every session MUST:**

- ✅ Start: Read from Notion (Instructions/Memory/Health)

- ✅ During: Write to Notion (Tasks/Memory/Health/Botshandshakes)

- ✅ End: Sync all changes to Notion, update Health page with completion timestamp

**If Notion is unavailable:**

- ⚠️ Queue all writes locally

- ⚠️ Log to Health page when Notion becomes available

- ⚠️ Escalate via Botshandshakes if sync fails

### Command Center Pages (MANDATORY)

**Each agent has THREE mandatory Notion pages:**

| Page | Purpose | Update Frequency |

|---|---|---|

| **Instructions** (instructionsId) | Agent-specific instructions, SOPs, policies | Read at session start, update when policies change |

| **Memory** (memoryId) | Session summaries, insights, T1/T2 memory nodes | Update after each significant action |

| **Health** (healthId) | Session logs, status, blockers, completion timestamps | Update at session start, on blockers, at completion |

**These pages are NON-NEGOTIABLE.** Every agent MUST have them and MUST use them.

### Integration Points

- **Agent Registry**: All agents registered in Agent Registry DB (f4bf63c948364ddca8ba638fb286f05d)

- **Tulsbot.md Page**: 2fd51bf9731e80d380fcd91259724b81

- **Notion Root Page**: 2ff51bf9731e806b81a3f4046740fac7

---

## Who-Are-You Identity Protocol

**Trigger**: Tulio asks "who are you?" in any chat

**Process**:

1. If agent has identity → reply immediately

1. If not → ask "Who do you want me to be?", collect answer

1. Complete identity-assumption protocol (describe persona, adjust behavior, confirm in memory, escalate blockers)

1. Store/propagate identity across agent memories

1. Escalate conflicts to Tulio

**Notes**: This entry registers the need to store/propagate the new identity instruction across all agent memories. Agents should escalate to Tulio if the protocol cannot be completed or the requested identity conflicts with hard constraints.

---

## As-Built Report Pattern

**Status**: Active Protocol

**Trigger**: When project reaches 100% complete (code complete + tested + debugged)

**Established**: 2026-02-09

### Rule

**Every time a project reaches 100% completion** (code complete, tested, and debugged), **Tulsbot MUST automatically generate an as-built report** without being asked.

### When to Generate

Generate an as-built report when **ALL** of these conditions are met:

1. ✅ **Code Complete**: All planned features implemented

1. ✅ **Tested**: HITL tests run (at minimum 50% of checklist completed)

1. ✅ **Debugged**: All critical issues resolved, zero blocking bugs

1. ✅ **Production Ready**: Feature flag enabled, service running, endpoints verified

**Do NOT generate** if:

- ❌ Project is still in progress

- ❌ Critical bugs remain unfixed

- ❌ HITL testing not yet started

- ❌ Implementation paused or blocked

### Report Structure (17 Sections)

1. Header

1. Executive Summary

1. Mission Statement

1. Architecture & Design

1. Implementation Details

1. Testing & Validation

1. Configuration

1. Performance Metrics

1. Operational Notes

1. Known Limitations

1. Security Considerations

1. Future Enhancements

1. Success Criteria — Final Validation

1. Handover & Documentation

1. Team Notes

1. Conclusion

1. Footer

### File Naming Convention

**Pattern**: <project-name>-asbuilt-<YYYY-MM-DD>.md

**Storage Location**: .tulsbot-temp/reports/

**Also create Notion page**: Save report body to Notion under Documentation Wiki (page 30051bf9-731e-81d5-ab7f-f2dc409a8802)

### Reference Implementation

**First Report**: .tulsbot-temp/reports/knowledge-manager-asbuilt-2026-02-09.md

Use this as the **gold standard template** for all future as-built reports.

---

---

# Memory System

## 3-Tier Memory Architecture

### Tier 1 (Permanent)

- **Location**: brain_nodes table

- **Content**: Architecture manifest, key facts, permanent knowledge

- **Size**: ~285 nodes, ~72 KB

- **Promotion**: T2 → T1 via pattern detection

### Tier 2 (Specific)

- **Location**: memory table

- **Content**: Per-project/agent/skill memory

- **Entity Types**: project, agent, skill, user, etc.

- **Promotion**: T3 → T2 via session compaction

### Tier 3 (Temporary)

- **Location**: Active sessions, .claude/memory/ workspace

- **Content**: Active sessions, temporary context

- **Compaction**: Ended sessions archived to T2

## Memory Churning & Heartbeat

### Process (Every 30 Minutes)

1. **Phase 0**: Health check

1. **Phase 1**: Scan T3 (active sessions)

1. **Phase 2**: Compact ended sessions → archive

1. **Phase 3**: Promote T2 → T1 (pattern detection)

1. **Phase 4**: Generate cleanup suggestions (never auto-delete)

### Activation

- **Schedule**: Every 30 min via cron

- **Manual trigger**: POST /api/memory-tiers/heartbeat

- **Sync**: POST /api/notion-sync/sync-all-markdown or npx tsx services/context-manager/src/scripts/sync-all-agents-and-markdown.ts

### Workspace Locations Scanned

- .cursor/skills/

- skills/

- .claude/agents/

- .claude/memory/

### Instructions for All Agents

1. **Activate Memory Heartbeat**: Heartbeat runs automatically every 30 minutes

1. **Adhere to Memory Churning Process**: Scan workspace, compact sessions, promote patterns

1. **Sync Workspaces to Notion**: All agent workspace markdown files must sync to Notion

1. **Record Activity**: All memory operations logged to memory_heartbeat_log

1. **Bring Plumbing to Life**: Ensure all cron jobs running (heartbeat, sync, archive)

---

---

# Implemented Systems

## License Control System

- **Roles**: Complete role management with permissions

- **Permissions**: Agent licensing, access control

- **Environment Modes**: local, online, hybrid, local_online

- **Personality System**: Pretraining support

- **Tulsbot Master MD**: Password protection

- **API**: /api/licenses/\*

- **Migration**: 037

## Templates System

- **Default Template**: "Tulsbot 2.0 Default (Production Ready)"

- **Configuration**: SOP, reporting, agent, standards, policies

- **API**: /api/templates/\*

- **Migration**: 038

## Master Boot System

- **Secure Initialization**: Master code required

- **Auto-Start**: Capability after initialization

- **Boot Status Tracking**: Complete status monitoring

- **API**: /api/master-boot/\*

## Backup & Mirror System

- **File Indexing**: Complete codebase indexing

- **Notion Workspace Mirroring**: Full workspace sync

- **Location Tagging**: Without content duplication

- **tulsbot.master Snapshots**: Snapshot pages

- **API**: /api/backup/\*

- **Migration**: 039

## Capture Inbox (Unified Ingest-First Pipeline)

- **Notion DB**: All captured elements (email, Discord, Slack, Notion, voice, web)

- **Flow**: Ingest (Status=Ingested) → Index (Qdrant) → Summarize (LLM) → Route (Super Inbox / Memory Only / Skip)

- **Cron**: Every 3 min when configured

- **Manual**: POST /api/capture/pipeline

- **Setup**: npx tsx services/context-manager/scripts/setup-capture-inbox.ts

- **Super Inbox DB**: 61efc873884b4c11925bc096ba38ec55

### Phase Status

| Phase | Name | Status |

|-------|------|--------|

| 0 | Project Setup | ✅ Complete |

| 1 | Email Capture Pipeline | ✅ Complete |

| 2 | Super Inbox Awareness | ✅ Complete |

| 3 | Voice Capture PWA | ✅ Complete |

| 4 | Source Wiring & Indexing | ⬜ Pending |

| 5 | Tulsbot as Orchestrator | ⬜ Pending |

### Super Inbox Types

Task, Meeting, Note, Email, Call, Whatsapp, ⌘ Deliverable, Voice Memo, Document

### HITL Blockers

1. Gmail OAuth tokens

1. GoodNotes folder path

1. Plaud export path

1. PWA icon design

1. iPhone Voice PWA testing

## Env Vault System

- **Purpose**: Syncing .env files to/from Supabase vault (encrypted)

- **Design**: Local-first; uses local .env files by default, loads from vault when TULSBOT_ONLINE_MODE=true

- **Encryption**: AES-256-CBC before upload

- **API**: /api/env-vault/status, /api/env-vault/sync-to-vault, /api/env-vault/sync-from-vault

- **SOP**: Auto-created on startup if missing

- **Migration**: 044

## Config Files Sync System

- **Purpose**: Real-time bidirectional sync of critical files to Supabase Storage

- **Files Synced**: .env (encrypted), memory.md, .cursor/memory.md, tulsbot.md, agents-shared.ts

- **Features**: File watching, debounced sync, hash-based change detection, automatic encryption

- **API**: /api/config-files-sync/status, /api/config-files-sync/sync-all, /api/config-files-sync/sync-file

- **Bucket**: tulsbot-config-files

- **Status**: ✅ Active (2026-02-11)

## SOP System (Tuls_SOP Agent)

- **Purpose**: Procedural memory system — "From now on, always do X" → SOP

- **Tables**: sops, sop_versions, sop_executions, sop_conflicts, sop_extraction_queue, sop_templates

- **API**: /api/sops/\* (20+ endpoints)

- **Features**: Chat command detection, approval workflow, conflict detection, compliance tracking

- **Migration**: 035

### Example SOPs (Pre-loaded)

1. **SOP-2025-001**: Daily Memory Heartbeat (2am daily)

1. **SOP-2025-002**: High-Priority Task Alerts (instant)

1. **SOP-2025-003**: Weekly Health Report (Mondays 9am)

1. **SOP-2025-XXX**: Env Vault System - .env File Sync to Supabase (auto-created on startup)

### Command Patterns Supported

- **Schedule-Based**: "Every Monday at 9am..."

- **Event-Based**: "When a task is created..."
