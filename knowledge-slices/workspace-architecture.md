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

# Internal Container: File Storage Architecture

## Canonical Location

**Tulsbot File Cabinet** — Google Drive

- **URL**: https://drive.google.com/drive/folders/1sET8R2rJBlHmv2Lfy49f7ktci62_gPhN

- **Folder ID**: 1sET8R2rJBlHmv2Lfy49f7ktci62_gPhN

## Principle

**The Internal Container** is a Google Drive–backed folder that serves as the **storage container** (SOT) for actual files. Notion stores **only links** to these files, never the file content itself.

## Flow

| What | Where |

|------|-------|

| **Actual files** (audio, PDF, Microsoft docs, etc.) | Internal Container (Google Drive) |

| **Links / references** | Notion |

| **Sync** | Local folder + Google Drive cloud |

## Internal Container Capabilities

- **Create folders** via API

- **Edit** files and structure

- **Churn data** as needed or when commanded

- Acts as the **internal file cabinet** for Tulsbot

## File Types

- Audio files

- PDFs

- Microsoft documents (Word, Excel, PowerPoint, etc.)

- Other binary/document types

All such files are uploaded to the Internal Container; Notion holds only the link/URL.

## Configuration

| Env Var | Purpose | Default |

|---------|---------|---------|

| FILE_CABINET_DRIVE_FOLDER_ID | Drive folder ID (Internal Container) | 1sET8R2rJBlHmv2Lfy49f7ktci62_gPhN |

| FILE_CABINET_LOCAL_PATH | Local path where Drive syncs the folder | (empty) |

| FILE_CABINET_ACCESS_MODE | local or online | local if FILE_CABINET_LOCAL_PATH set, else online |

**Local path discovery**: Google Drive for Desktop does not expose a programmatic path. Set FILE_CABINET_LOCAL_PATH to the folder on disk.

## Always Embed Drive Link Rule

**Whenever a file is stored or referenced** (chat attachments, Notion, capture pipeline):

1. Store the **Drive link** in metadata / Notion URL property

1. File: https://drive.google.com/file/d/{fileId}/view

1. Folder: https://drive.google.com/drive/folders/{folderId}

1. Format for references: { driveLink, localPath?, fileId, folderId }

1. Notion stores only the Drive link; never the file content

---

---

# Conflict Resolution Policy

- **Notion Agent Registry**: Source of truth for agent skills

- **Agent workspace files**: Notion always wins

- **Non-agent files**: Manual review (HITL checkpoint)

---

---

# Archive & Transcript References

## Cursor Archive Transcripts

- .cursor/archive/2026-02-11_build-per-contract-test-fixes_chat-transcript.md ← **Latest**

- .cursor/archive/2026-02-10_memory-migration-build-2.0_chat-transcript.md

- .cursor/archive/2026-02-10_branding-book-report-templates_chat-transcript.md

- .cursor/archive/2026-02-10_notion-orchestration-mandatory-enforcement_chat-transcript.md

- .cursor/archive/2026-02-10_capture-inbox-implementation_chat-transcript.md

- .cursor/archive/2026-02-10_env-vault-sop-implementation_chat-transcript.md

- .cursor/archive/2026-02-10_agent-workspace-sync-implementation_chat-transcript.md

- .cursor/archive/2026-02-10_slack-bot-improvements-archive_chat-transcript.md

- .cursor/archive/2026-02-10_1430_tulsbot-2-production-ready_chat-transcript.md

---

**Document Status**: ✅ Complete — All memory files consolidated

**Last Consolidated**: 2026-02-11

**Next Update**: On next memory heartbeat or major system change

| 2026-02-10 | **Archive this chat** — User requested archive; full handoff completed (transcript appended, memory, todo, tulsbot changelog). |

| 2026-02-10 | **Slack bot improvements + archive** — Assessed Slack bot, made build-ready (Dockerfile, docker-compose, package.json). Implemented all 10 improvements: activity tracker, slash commands, reaction actions, thread context, Block Kit, retry, rate limiting, message editing, file attachments. Full archive workflow completed. |

| 2026-02-11 | **Config Files Sync System + Knowledge Manager Extension** — Created real-time bidirectional sync of 13 critical files (.env, memory.md, tulsbot.md, agents-shared.ts, core docs) to Supabase Storage. Extended Knowledge Manager to scan docs/ directory. Consolidated all memory files into tulsbot.md. Created comprehensive sync documentation. |

| 2026-02-10 | **Archive chat** — User requested archive; full handoff workflow completed (transcript, memory, todo). |

| 2026-02-10 | **Files organize & dedup** — Moved accidentally added files into project: music-library-workflow.json → workflows/, openapi_schema.json → schemas/; added READMEs; verified no duplicates; archived chat. |

| 2026-02-10 | **MANDATORY Notion Orchestration Rule Enforced** — Created mandatory Notion orchestration rule (.cursor/rules/notion-orchestration-mandatory.mdc), updated all agent skill templates with mandatory Notion-first protocol, updated context-handoff rule with Notion sync requirements, regenerated all 17 agent skills with mandatory compliance sections. Notion is now THE PLACE - all agents must orchestrate through Notion. |

| 2026-02-10 | **Tulsbot 2.0 Production Ready System** — Complete implementation: License Control System (037), Templates System (038), Master Boot System, Backup & Mirror System (039). All migrations executed successfully. 12 tables created, default data inserted. System ready for production use. |

| 2026-02-10 | Agent workspace scanner implemented - Tulsbot 3.0 consolidated workspace structure, scans all locations (.cursor/skills/, skills/, .claude/agents/, .claude/memory/), maps files to Notion pages, 11 unit tests passing |

| 2026-02-10 | Conflict resolution policy implemented - Notion Agent Registry is source of truth for agent skills, agent workspace files automatically resolve to Notion wins, non-agent files require manual review |

| 2026-02-10 | Stack analysis report created - comprehensive review of capabilities, deprecated features, prototype differences, and new features |

| 2026-02-10 | Telegram Bot upgrade completed - grammY migration (8 files: bot.ts, commands.ts, dispatch.ts, render.ts, buffering.ts, groups.ts, media.ts, streaming.ts) |

| 2026-02-10 | TypeScript errors fixed - license_id→licenseId, TaskCategory 'memory'→'sync', UserIdentity channel property, classifyAndRoute parameters |

| 2026-02-10 | Agent workspace sync implementation plan created - comprehensive handoff with HITL checkpoints for autonomous agent implementation |

| 2026-02-10 | Memory churning and heartbeat activation broadcast sent to all agents |

---

---

# Current System State

**Agents**: 17 total (10 active)

**Endpoints**: 118+ API endpoints

**Databases**: 9 Notion databases, PostgreSQL (50+ tables)

**Memory**: 3-tier system (T1 Permanent, T2 Specific, T3 Temporary)

**Heartbeat**: Active every 30 minutes

**Version**: Tulsbot 2.0 Production Ready

**Status**: ✅ Production Ready

**Database Migrations**: All applied (037, 038, 039, 040-044)

**Notion Integration**: Configured and ready

---

---

# Internal Container: File Storage Architecture

## Canonical Location

**Tulsbot File Cabinet** — Google Drive

- **URL**: https://drive.google.com/drive/folders/1sET8R2rJBlHmv2Lfy49f7ktci62_gPhN

- **Folder ID**: 1sET8R2rJBlHmv2Lfy49f7ktci62_gPhN

## Principle

**The Internal Container** is a Google Drive–backed folder that serves as the **storage container** (SOT) for actual files. Notion stores **only links** to these files, never the file content itself.

## Flow

| What | Where |

|------|-------|

| **Actual files** (audio, PDF, Microsoft docs, etc.) | Internal Container (Google Drive) |

| **Links / references** | Notion |

| **Sync** | Local folder + Google Drive cloud |

## Internal Container Capabilities

- **Create folders** via API

- **Edit** files and structure

- **Churn data** as needed or when commanded

- Acts as the **internal file cabinet** for Tulsbot

## File Types

- Audio files

- PDFs

- Microsoft documents (Word, Excel, PowerPoint, etc.)

- Other binary/document types

All such files are uploaded to the Internal Container; Notion holds only the link/URL.

## Configuration

| Env Var | Purpose | Default |

|---------|---------|---------|

| FILE_CABINET_DRIVE_FOLDER_ID | Drive folder ID (Internal Container) | 1sET8R2rJBlHmv2Lfy49f7ktci62_gPhN |

| FILE_CABINET_LOCAL_PATH | Local path where Drive syncs the folder | (empty) |

| FILE_CABINET_ACCESS_MODE | local or online | local if FILE_CABINET_LOCAL_PATH set, else online |

**Local path discovery**: Google Drive for Desktop does not expose a programmatic path. Set FILE_CABINET_LOCAL_PATH to the folder on disk.

## Always Embed Drive Link Rule

**Whenever a file is stored or referenced** (chat attachments, Notion, capture pipeline):

1. Store the **Drive link** in metadata / Notion URL property

1. File: https://drive.google.com/file/d/{fileId}/view

1. Folder: https://drive.google.com/drive/folders/{folderId}

1. Format for references: { driveLink, localPath?, fileId, folderId }

1. Notion stores only the Drive link; never the file content

---

---

# Conflict Resolution Policy

- **Notion Agent Registry**: Source of truth for agent skills

- **Agent workspace files**: Notion always wins

- **Non-agent files**: Manual review (HITL checkpoint)

---

---

# Archive & Transcript References

## Cursor Archive Transcripts

- .cursor/archive/2026-02-11_build-per-contract-test-fixes_chat-transcript.md ← **Latest**

- .cursor/archive/2026-02-10_memory-migration-build-2.0_chat-transcript.md

- .cursor/archive/2026-02-10_branding-book-report-templates_chat-transcript.md

- .cursor/archive/2026-02-10_notion-orchestration-mandatory-enforcement_chat-transcript.md

- .cursor/archive/2026-02-10_capture-inbox-implementation_chat-transcript.md

- .cursor/archive/2026-02-10_env-vault-sop-implementation_chat-transcript.md

- .cursor/archive/2026-02-10_agent-workspace-sync-implementation_chat-transcript.md

- .cursor/archive/2026-02-10_slack-bot-improvements-archive_chat-transcript.md

- .cursor/archive/2026-02-10_1430_tulsbot-2-production-ready_chat-transcript.md

---

**Document Status**: ✅ Complete — All memory files consolidated

**Last Consolidated**: 2026-02-11

**Next Update**: On next memory heartbeat or major system change

| 2026-02-10 | **Archive this chat** — User requested archive; full handoff completed (transcript appended, memory, todo, tulsbot changelog). |

| 2026-02-10 | **Slack bot improvements + archive** — Assessed Slack bot, made build-ready (Dockerfile, docker-compose, package.json). Implemented all 10 improvements: activity tracker, slash commands, reaction actions, thread context, Block Kit, retry, rate limiting, message editing, file attachments. Full archive workflow completed. |

| 2026-02-10 | **Archive chat** — User requested archive; full handoff workflow completed (transcript, memory, todo). |

| 2026-02-10 | **Files organize & dedup** — Moved accidentally added files into project: music-library-workflow.json → workflows/, openapi_schema.json → schemas/; added READMEs; verified no duplicates; archived chat. |

| 2026-02-10 | **MANDATORY Notion Orchestration Rule Enforced** — Created mandatory Notion orchestration rule (.cursor/rules/notion-orchestration-mandatory.mdc), updated all agent skill templates with mandatory Notion-first protocol, updated context-handoff rule with Notion sync requirements, regenerated all 17 agent skills with mandatory compliance sections. Notion is now THE PLACE - all agents must orchestrate through Notion. |

| 2026-02-10 | **Tulsbot 2.0 Production Ready System** — Complete implementation: License Control System (037), Templates System (038), Master Boot System, Backup & Mirror System (039). All migrations executed successfully. 12 tables created, default data inserted. System ready for production use. |

| 2026-02-10 | Agent workspace scanner implemented - Tulsbot 3.0 consolidated workspace structure, scans all locations (.cursor/skills/, skills/, .claude/agents/, .claude/memory/), maps files to Notion pages, 11 unit tests passing |

| 2026-02-10 | Conflict resolution policy implemented - Notion Agent Registry is source of truth for agent skills, agent workspace files automatically resolve to Notion wins, non-agent files require manual review |

| 2026-02-10 | Stack analysis report created - comprehensive review of capabilities, deprecated features, prototype differences, and new features |

| 2026-02-10 | Telegram Bot upgrade completed - grammY migration (8 files: bot.ts, commands.ts, dispatch.ts, render.ts, buffering.ts, groups.ts, media.ts, streaming.ts) |

| 2026-02-10 | TypeScript errors fixed - license_id→licenseId, TaskCategory 'memory'→'sync', UserIdentity channel property, classifyAndRoute parameters |

| 2026-02-10 | Agent workspace sync implementation plan created - comprehensive handoff with HITL checkpoints for autonomous agent implementation |

| 2026-02-10 | Memory churning and heartbeat activation broadcast sent to all agents |

---

---

# Current System State

**Agents**: 17 total (10 active)

**Endpoints**: 118+ API endpoints

**Databases**: 9 Notion databases, PostgreSQL (50+ tables)

**Memory**: 3-tier system (T1 Permanent, T2 Specific, T3 Temporary)

**Heartbeat**: Active every 30 minutes

**Version**: Tulsbot 2.0 Production Ready

**Status**: ✅ Production Ready

**Database Migrations**: All applied (037, 038, 039, 040-044)

**Notion Integration**: Configured and ready

---
