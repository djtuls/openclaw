# Core Knowledge Policy (MANDATORY)

**⚠️ CRITICAL: Agent Memory and Health pages are considered core app knowledge.**

## Policy Statement

**Agent Memory and Health pages in Notion are automatically ingested into the semantic memory system as core app knowledge** with special classification tags and metadata.

## Scope

### Core Knowledge Sources

1. **Agent Memory Pages** (memoryId from Agent Registry)
   - Contains session summaries, insights, operational knowledge

   - Tracks agent-specific learnings and patterns

   - Updated after each significant action

1. **Agent Health Pages** (healthId from Agent Registry)
   - Contains session logs, status, blockers

   - Tracks agent health and operational state

   - Updated at session start, on blockers, at completion

### Classification

All content from Memory/Health pages is automatically tagged with:

- core-knowledge - Primary classification tag

- agent-memory or agent-health - Page type tag

- {agent-slug} - Agent identifier tag

Metadata includes:

- core_knowledge: true - Boolean flag for filtering

- agent_name - Human-readable agent name

- agent_slug - Agent identifier slug

- page_type - Either "memory" or "health"

- source: 'notion' - Source identifier

- page_id - Notion page ID

## Implementation

### Automatic Ingestion

The proactive learning worker (services/context-manager/src/worker.ts) includes a function ingestAgentCorePages() that:

1. Iterates through all agents in AGENTS array (agents-shared.ts)

1. Skips agents with placeholder IDs

1. Extracts content from Memory and Health pages

1. Chunks text appropriately

1. Stores in Qdrant vector memory with core knowledge tags

1. Runs as part of the learning cycle (every 6 hours by default)

### Integration

- **Function:** ingestAgentCorePages() in worker.ts

- **Schedule:** Runs as part of runLearningCycle()

- **Frequency:** Every 6 hours (configurable via LEARNING_CRON)

- **Priority:** High - core knowledge is ingested before other sources

## Benefits

1. **Persistent Knowledge:** Agent learnings persist across sessions

1. **Searchable:** Core knowledge is searchable via semantic search

1. **Tagged:** Easy to filter and query core knowledge specifically

1. **Automatic:** No manual intervention required

1. **Comprehensive:** Captures all agent Memory/Health content

## Querying Core Knowledge

To search specifically for core knowledge:

```typescript
// Search with core_knowledge filter
const results = await searchMemory(query, 10, {
  core_knowledge: true,
  agent_slug: "knowledge-manager", // Optional: filter by agent
});
```

Or search by tags:

```typescript
const results = await searchMemory(query, 10, {
  tags: ["core-knowledge", "agent-memory"],
});
```

## Agent Registry

All agents are defined in services/context-manager/src/agents-shared.ts with:

- memoryId - Notion Memory page ID

- healthId - Notion Health page ID

Agents with placeholder IDs are automatically skipped during ingestion.

**Related Documentation:** docs/file-cabinet/CORE_KNOWLEDGE_POLICY.md

---

---

# Handshakes & Bot Coordination

## Tulsbot ↔ TulsCodex Handshake

- **Date**: 2026-02-08

- **Notion DB**: botshandshakes (30151bf9-731e-81d9-8934-eab5cdc495be)

- **Entry**: 30151bf9-731e-815a-b5f1-fa9325a010dd

- **Summary**: Recorded manifest review plus quick-command prompt, status set to "Waiting on Tulsbot".

The handshake lives in Notion and this file mirrors it for the shared brain.

---

---

# Recent Improvements

- Telegram Bot: Complete grammY upgrade (was 33% complete, now 100%)

- TypeScript: Fixed 4 pre-existing errors

- Documentation: Comprehensive stack analysis and implementation plans

- Agent Handoff: Structured handoff process with HITL checkpoints

- Config Files Sync: Real-time bidirectional sync to Supabase Storage (2026-02-11)

---

---

# Active Processes

- **Memory Heartbeat**: Every 30 min (Phase 0-4: health → scan → compact → promote → cleanup)

- **Notion Sync**: Incremental (30 min), Health Push (15 min), Deep Sync (daily 6:30 AM)

- **Agent Broadcasts**: Polling Supabase every 2 minutes

- **Documentation Sync**: Bidirectional .claude/memory ↔ Notion

- **Config Files Sync**: Real-time file watching and sync to Supabase Storage (2026-02-11)

---

---

# Memory Churning Status

**Status**: ✅ Active

**Schedule**: Every 30 minutes

**Last Run**: Check memory_heartbeat_log table

**Manual Trigger**: POST /api/memory-tiers/heartbeat

**All Agents**: Adhere to memory churning processes - sync workspaces, record activity, activate heartbeat.

---

---

# Agent Registry

## 17 Agents Total

1. **Tulsbot 1.0 (Orchestrator)** — Central orchestrator

1. **PM Specialist** — Project management

1. **Accounts Payable** — Invoice processing

1. **Self-Analysis Engine** — System introspection

1. **Memory Heartbeat** — Memory lifecycle

1. **Intelligence Router** — Intent classification

1. **Pattern Learner** — Usage pattern detection

1. **Metrics Aggregator** — Metrics collection

1. **Skill Executor** — Skill execution

1. **Memory Librarian** — Memory search

1. **Inbox Capture** — Universal inbox capture pipeline

1. **Ollama Gateway** — Local LLM interface

1. **TulsCodex** — Autonomous OpenAI agent

1. **TulsCodex Mirror** — TulsCodex partner

1. **Token Guardian** — Token-aware data migration

1. **Knowledge Manager** — Maintains Tulsbot.md

1. **Tuls_SOP** — SOP database manager

## Workspace Agents

### Hardware Manager

- **Agent Page**: 30251bf9-731e-81bf-b5d2-df2097c7b18d

- **Registry**: 30251bf9-731e-81c8-a47e-fd2eea40bdad

- **Scope**: Backend services, Docker infrastructure, database schemas, API endpoints, deployment automation, environment configuration, external integrations

### OS Orchestrator

- **Agent Page**: 30251bf9-731e-8117-8ff8-da6c9185e1d5

- **Registry**: 30251bf9-731e-8112-bc82-ef75edd958b0

- **Scope**: Agent coordination, skills management, workflow automation, health check coordination, prompt engineering, channel adapter management, task scheduling

### Brain Architect

- **Agent Page**: 30251bf9-731e-81a9-8ad2-caecd0ef74ba

- **Registry**: 30251bf9-731e-81b8-a073-f05224a3016b

- **Scope**: Tiered memory system, knowledge graph curation, vector embeddings optimization, LLM routing strategy, knowledge indexing, memory consolidation, Claude Code memory sync

### Inbox Capture

- **Main Page**: 30051bf9-731e-8167-91c9-e00cd14cafca

- **Instructions**: 30051bf9-731e-81d6-8253-e6712cd61042

- **Memory**: 30051bf9-731e-8107-b887-e4a899e38114

- **Health**: 30051bf9-731e-81d2-aac3-c321f1a079c8

- **Super Inbox DB**: 61efc873884b4c11925bc096ba38ec55

- **Discord Channel**: #inbox-capture (ID: 1469842470606078054)

---

---

# Core Knowledge Policy (MANDATORY)

**⚠️ CRITICAL: Agent Memory and Health pages are considered core app knowledge.**

## Policy Statement

**Agent Memory and Health pages in Notion are automatically ingested into the semantic memory system as core app knowledge** with special classification tags and metadata.

## Scope

### Core Knowledge Sources

1. **Agent Memory Pages** (memoryId from Agent Registry)
   - Contains session summaries, insights, operational knowledge

   - Tracks agent-specific learnings and patterns

   - Updated after each significant action

1. **Agent Health Pages** (healthId from Agent Registry)
   - Contains session logs, status, blockers

   - Tracks agent health and operational state

   - Updated at session start, on blockers, at completion

### Classification

All content from Memory/Health pages is automatically tagged with:

- core-knowledge - Primary classification tag

- agent-memory or agent-health - Page type tag

- {agent-slug} - Agent identifier tag

Metadata includes:

- core_knowledge: true - Boolean flag for filtering

- agent_name - Human-readable agent name

- agent_slug - Agent identifier slug

- page_type - Either "memory" or "health"

- source: 'notion' - Source identifier

- page_id - Notion page ID

## Implementation

### Automatic Ingestion

The proactive learning worker (services/context-manager/src/worker.ts) includes a function ingestAgentCorePages() that:

1. Iterates through all agents in AGENTS array (agents-shared.ts)

1. Skips agents with placeholder IDs

1. Extracts content from Memory and Health pages

1. Chunks text appropriately

1. Stores in Qdrant vector memory with core knowledge tags

1. Runs as part of the learning cycle (every 6 hours by default)

### Integration

- **Function:** ingestAgentCorePages() in worker.ts

- **Schedule:** Runs as part of runLearningCycle()

- **Frequency:** Every 6 hours (configurable via LEARNING_CRON)

- **Priority:** High - core knowledge is ingested before other sources

## Benefits

1. **Persistent Knowledge:** Agent learnings persist across sessions

1. **Searchable:** Core knowledge is searchable via semantic search

1. **Tagged:** Easy to filter and query core knowledge specifically

1. **Automatic:** No manual intervention required

1. **Comprehensive:** Captures all agent Memory/Health content

## Querying Core Knowledge

To search specifically for core knowledge:

```typescript
// Search with core_knowledge filter
const results = await searchMemory(query, 10, {
  core_knowledge: true,
  agent_slug: "knowledge-manager", // Optional: filter by agent
});
```

Or search by tags:

```typescript
const results = await searchMemory(query, 10, {
  tags: ["core-knowledge", "agent-memory"],
});
```

## Agent Registry

All agents are defined in services/context-manager/src/agents-shared.ts with:

- memoryId - Notion Memory page ID

- healthId - Notion Health page ID

Agents with placeholder IDs are automatically skipped during ingestion.

**Related Documentation:** docs/file-cabinet/CORE_KNOWLEDGE_POLICY.md

---

---

# Handshakes & Bot Coordination

## Tulsbot ↔ TulsCodex Handshake

- **Date**: 2026-02-08

- **Notion DB**: botshandshakes (30151bf9-731e-81d9-8934-eab5cdc495be)

- **Entry**: 30151bf9-731e-815a-b5f1-fa9325a010dd

- **Summary**: Recorded manifest review plus quick-command prompt, status set to "Waiting on Tulsbot".

The handshake lives in Notion and this file mirrors it for the shared brain.

---

---

# Recent Improvements

- Telegram Bot: Complete grammY upgrade (was 33% complete, now 100%)

- TypeScript: Fixed 4 pre-existing errors

- Documentation: Comprehensive stack analysis and implementation plans

- Agent Handoff: Structured handoff process with HITL checkpoints

- Config Files Sync: Real-time bidirectional sync to Supabase Storage (2026-02-11)

---

---

# Active Processes

- **Memory Heartbeat**: Every 30 min (Phase 0-4: health → scan → compact → promote → cleanup)

- **Notion Sync**: Incremental (30 min), Health Push (15 min), Deep Sync (daily 6:30 AM)

- **Agent Broadcasts**: Polling Supabase every 2 minutes

- **Documentation Sync**: Bidirectional .claude/memory ↔ Notion

- **Config Files Sync**: Real-time file watching and sync to Supabase Storage (2026-02-11)

---

---

# Memory Churning Status

**Status**: ✅ Active

**Schedule**: Every 30 minutes

**Last Run**: Check memory_heartbeat_log table

**Manual Trigger**: POST /api/memory-tiers/heartbeat

**All Agents**: Adhere to memory churning processes - sync workspaces, record activity, activate heartbeat.

---

---

# Agent Definitions (Structured)

| #   | Name                       | Role                                                                             | Status |
| --- | -------------------------- | -------------------------------------------------------------------------------- | ------ |
| 1   | Tulsbot 1.0 (Orchestrator) | Central orchestrator — routes tasks, manages agents, handles general chat        | active |
| 2   | PM Specialist              | Project management — tasks, boards, sprints, planning                            | active |
| 3   | Accounts Payable           | Invoice processing, payment tracking, financial operations                       | active |
| 4   | Self-Analysis Engine       | System introspection — daily analysis, performance insights                      | active |
| 5   | Memory Heartbeat           | Memory lifecycle — compaction, promotion, archival                               | active |
| 6   | Intelligence Router        | Intent classification, smart tool routing                                        | active |
| 7   | Pattern Learner            | Usage pattern detection, tool sequence learning                                  | active |
| 8   | Metrics Aggregator         | Metrics collection, aggregation, reporting                                       | active |
| 9   | Skill Executor             | Skill execution, tool invocation, integration orchestration                      | active |
| 10  | Memory Librarian           | Memory search, Q&A across tiers, knowledge retrieval                             | active |
| 11  | Inbox Capture              | Universal inbox capture pipeline — multi-channel ingestion, dedup, triage, pr... | active |
| 12  | Ollama Gateway             | Local LLM interface — thin Ollama protocol adapter to CM orchestrator            | active |
| 13  | TulsCodex                  | Autonomous OpenAI agent — multi-step research, analysis, code review via Assi... | active |
| 14  | TulsCodex Mirror           | Dedicated partner for TulsCodex (OpenAI side) — handles handoffs, sync, and h... | active |
| 15  | Token Guardian             | Token-aware data migration orchestrator. Monitors usage, detects spikes, paus... | active |
| 16  | Knowledge Manager          | Maintains Tulsbot.md as central brain, creates concise knowledge index for No... | active |
| 17  | Tuls_SOP                   | SOP database manager — monitors chats for procedural commands, maintains deci... | active |
