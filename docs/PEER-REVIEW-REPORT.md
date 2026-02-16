# OpenClaw Repository — Peer-Review Audit Report

> **Scope**: Full codebase audit covering infrastructure, agent orchestration, memory systems, and architecture health.
> **Date**: 2025-02-15
> **Method**: Automated exploration of source tree, dependency graph, and runtime configuration.

---

## Table of Contents

1. [Infrastructure Layer](#1-infrastructure-layer)
2. [Tulsbot Information Flow](#2-tulsbot-information-flow)
3. [Brain Layer: Knowledge & Memory](#3-brain-layer-knowledge--memory)
4. [Content Classification: Internal Docs vs User Data](#4-content-classification)
5. [Knowledge Base per Container](#5-knowledge-base-per-container)
6. [Overall Architecture Blueprint](#6-overall-architecture-blueprint)
7. [Health Assessment & Recommendations](#7-health-assessment--recommendations)

---

## 1. Infrastructure Layer

### 1.1 Server Architecture

| Component        | Technology        | Port/Address      |
| ---------------- | ----------------- | ----------------- |
| WebSocket Server | `ws` library      | `:18789`          |
| HTTP Server      | Express 5.2.1     | `:18789` (shared) |
| Sandbox Bridge   | HTTP              | `:18790`          |
| ACP Server       | NDJSON over stdio | stdio pipes       |

**Core entry points**:

- `src/gateway/server.ts` / `server.impl.ts` — Main server orchestration
- `src/gateway/server-http.ts` — HTTP endpoints (Canvas, Slack webhooks, OpenAI-compatible API, hooks)
- `src/gateway/server-ws-runtime.ts` — WebSocket connection lifecycle
- `src/acp/server.ts` — `serveAcpGateway()` function, bridges ACP protocol ↔ Gateway via WebSocket + NDJSON

### 1.2 Authentication & Access

| Method        | Mechanism                             | File                         |
| ------------- | ------------------------------------- | ---------------------------- |
| Token auth    | `OPENCLAW_GATEWAY_TOKEN` header/query | `src/gateway/auth.ts`        |
| Password auth | `OPENCLAW_GATEWAY_PASSWORD`           | `src/gateway/auth.ts`        |
| IP fallback   | Private/loopback IPs bypass auth      | `src/gateway/auth.ts`        |
| Device auth   | Per-device token registration         | `src/gateway/device-auth.ts` |
| Rate limiting | 20 failures / 60s window              | `src/gateway/auth.ts`        |

### 1.3 Channel Integrations (7+ platforms)

| Channel    | Protocol                  | Key Files                  |
| ---------- | ------------------------- | -------------------------- |
| Telegram   | Bot API (polling/webhook) | `src/channels/telegram/`   |
| Discord    | Discord.js gateway        | `src/channels/discord/`    |
| Slack      | Bolt SDK + webhooks       | `src/channels/slack/`      |
| WhatsApp   | Baileys (unofficial API)  | `src/channels/whatsapp/`   |
| Signal     | signal-cli subprocess     | `src/channels/signal/`     |
| iMessage   | AppleScript bridge        | `src/channels/imessage/`   |
| Mattermost | WebSocket + REST          | `src/channels/mattermost/` |
| Lark       | Feishu SDK                | `src/channels/lark/`       |
| LINE       | LINE Messaging API        | `src/channels/line/`       |

### 1.4 AI Provider Integrations

| Provider      | SDK/Package                       | Usage                      |
| ------------- | --------------------------------- | -------------------------- |
| OpenAI        | `openai@4.100.0`                  | Primary LLM + embeddings   |
| Anthropic     | `@anthropic-ai/sdk@0.52.0`        | Claude models              |
| Google Gemini | `@google/generative-ai@0.24.0`    | Gemini models + embeddings |
| OpenRouter    | OpenAI-compatible                 | Model routing              |
| AWS Bedrock   | `@aws-sdk/client-bedrock-runtime` | AWS-hosted models          |
| MiniMax       | Custom REST                       | Specialized models         |
| ZAI           | Custom REST                       | Specialized models         |

### 1.5 Tools Inventory

**`src/agents/openclaw-tools.ts`** — Factory function `createOpenClawTools(options)` producing **60+ tools** across categories:

- **Memory tools**: store, recall, search, tag memories
- **Web tools**: browse, search, scrape, fetch URLs
- **Code tools**: execute code, file operations
- **Communication tools**: send messages across channels
- **Media tools**: image generation, TTS, STT
- **System tools**: shell execution, process management
- **Knowledge tools**: refresh knowledge, query knowledge base
- **Delegation tools**: hand off to specialized sub-agents

### 1.6 Dependencies Summary

- **116 runtime dependencies** (`package.json`)
- **Key frameworks**: Express 5.2.1, ws, better-sqlite3, zod
- **Build**: TypeScript 5.8.3, tsup bundler, vitest test runner
- **Deployment**: Docker with multi-stage build, security hardening (non-root user, dropped capabilities)

---

## 2. Tulsbot Information Flow

### 2.1 Message Lifecycle (End-to-End)

```
User Message (any channel)
    │
    ▼
┌─────────────────────────────┐
│  Channel Adapter             │  (Telegram/Discord/Slack/etc.)
│  Normalizes to OpenClaw msg  │
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│  Gateway Message Handler     │  src/gateway/server/ws-connection/message-handler.ts
│  Auth → Session → Route      │
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│  ACP Translator              │  src/acp/translator.ts
│  OpenClaw msg → ACP format   │
│  NDJSON streaming            │
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│  Agent Session               │  src/acp/session.ts
│  Manages conversation state  │
│  Tool execution context      │
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│  Tulsbot Delegation Engine   │  src/agents/tulsbot/delegate-tool.ts
│  1. analyzeIntent()          │  ← Similarity threshold: 0.7
│  2. matchToSubAgent()        │  ← Exact → Partial → Fuzzy → Fallback
│  3. Execute or hand off      │  ← Max 2 handoff levels
└──────────┬──────────────────┘
           │
     ┌─────┴──────┐
     ▼            ▼
┌─────────┐  ┌──────────────┐
│ Direct  │  │ Sub-Agent    │
│ Response│  │ Execution    │
│         │  │ (1 of 17)    │
└─────────┘  └──────┬───────┘
                    │
              ┌─────┴─────┐
              ▼           ▼
        ┌──────────┐ ┌──────────┐
        │Knowledge │ │ Memory   │
        │ Lookup   │ │ Store/   │
        │ (V1/V2)  │ │ Recall   │
        └──────────┘ └──────────┘
```

### 2.2 Multi-Agent Delegation System

**17 specialized sub-agents** across 6 domains:

| Domain        | Agents                            | Purpose               |
| ------------- | --------------------------------- | --------------------- |
| Code & Dev    | TulsCodex, CodeReviewer, Debugger | Development tasks     |
| Knowledge     | KnowledgeKeeper, Researcher       | Information retrieval |
| Creative      | Writer, Designer                  | Content creation      |
| Operations    | DevOps, Automator, Scheduler      | System operations     |
| Communication | Messenger, Translator             | Cross-channel comms   |
| Specialized   | Analyst, Tutor, HealthCheck, etc. | Domain-specific tasks |

**Delegation algorithm** (`delegate-tool.ts`):

1. `analyzeIntent(message)` — Compute similarity scores against agent capability vectors
2. `matchToSubAgent()` — Priority chain: exact match → partial match → fuzzy match → fallback to TulsCodex
3. Similarity threshold: **0.7** (below this, falls back)
4. Max handoff depth: **2 levels** (prevents infinite delegation loops)

### 2.3 Where Information Lives During Flow

| Stage               | Storage                                     | Location                                  |
| ------------------- | ------------------------------------------- | ----------------------------------------- |
| Active conversation | In-memory session                           | ACP session object                        |
| Message history     | Channel-specific                            | Per-channel adapter storage               |
| Knowledge queries   | V1: monolithic JSON / V2: index + on-demand | See §3.1                                  |
| Memory operations   | SQLite + sqlite-vec                         | `~/.openclaw/workspace-tulsbot/memory.db` |
| Sync queue          | SQLite                                      | `.sync-state.db` (repo root)              |

---

## 3. Brain Layer: Knowledge & Memory

### 3.1 Knowledge System (Dual Loader Architecture)

#### V1 — Eager Loader (`src/agents/tulsbot/knowledge-loader.ts`)

- Loads **824KB monolithic JSON** at startup
- File: `.tulsbot/core-app-knowledge.json`
- Load time: **~100ms**
- Contains all 45 agent definitions inline

#### V2 — Lazy Loader (`src/agents/tulsbot/knowledge-loader-v2.ts`)

- Loads **8KB index** at startup, agents loaded on-demand
- Index: `.tulsbot/knowledge-index.json` (45 entries)
- Agent files: `.tulsbot/agents/*.json`
- Load time: **~5ms** (95% faster than V1)
- Memory: **80% less** than V1
- **LRU cache**: max 50 agents, evicts least-recently-used

#### Knowledge Refresh Pipeline (`refresh-knowledge-tool.ts`)

```
Phase 1: Extract → Parse source files, identify knowledge domains
Phase 2: Import  → Chunk (2000 chars, 200 overlap), classify domains
Phase 3: Reindex → Rebuild V2 index, invalidate caches
```

**Domain classification** (from `notebooklm-importer.ts`):

- `workspace-architecture` — System structure docs
- `automation-patterns` — Workflow/automation knowledge
- `agent-roster` — Agent capabilities and configs
- `notion-schemas` — Notion database schemas

### 3.2 Memory System (Hybrid Search)

**Storage**: SQLite with extensions

- `better-sqlite3` — Core database engine
- `sqlite-vec` — Vector similarity (cosine distance)
- `FTS5` — Full-text search (BM25 ranking)

**Schema** (`src/memory/memory-schema.ts`):

```
Tables: meta, files, chunks, embedding_cache, chunks_fts
- chunks: id, file_id, content, embedding (BLOB), metadata (JSON)
- chunks_fts: FTS5 virtual table on chunk content
- embedding_cache: hash → embedding vector cache
```

**Hybrid search** (`src/memory/hybrid.ts`):

1. `searchVector()` — Cosine similarity via sqlite-vec
2. `searchKeyword()` — BM25 via FTS5 (two-step query to avoid expensive JOINs)
3. `mergeHybridResults()` — Weighted merge, default **50/50** vector:text

**Chunking strategy** (`src/memory/internal.ts`):

- Chunk size: **512 tokens** (~2048 chars)
- Overlap: **64 tokens**
- Hash: SHA256 per chunk (deduplication)
- Cosine similarity fallback for environments without sqlite-vec

**Embedding providers**:
| Provider | File | Notes |
|----------|------|-------|
| OpenAI | `embeddings-openai.ts` | Default, `text-embedding-3-small` |
| Google Gemini | `embeddings-gemini.ts` | `embedding-001` |
| Voyage AI | `embeddings-voyage.ts` | Batch processing support |

**Namespace isolation** (`src/memory/namespace-isolation.test.ts`):

- Multi-tenant via JSON `metadata` field on chunks
- Each workspace gets isolated memory space

### 3.3 Three-Way Bidirectional Sync

```
Local Markdown Files  ←→  AnythingLLM Brain  ←→  NotebookLLM Cloud
     (317 files)              (API)                  (Google)
         │                      │                       │
         └──────────┬───────────┘                       │
                    │                                   │
              sync-memory-cloud-bidirectional.ts ────────┘
```

- **Script**: `scripts/sync-memory-cloud-bidirectional.ts`
- **Offline queue**: SQLite `sync_queue` table in `.sync-state.db`
- **Background**: Runs every 5 minutes
- **Retry**: Exponential backoff on failure
- **Conflict resolution**: Last-write-wins with timestamps

---

## 4. Content Classification

### 4.1 Internal Documentation (Technical / Build-Related)

| Category            | Count | Key Locations                                                       |
| ------------------- | ----- | ------------------------------------------------------------------- |
| Architecture docs   | ~15   | `docs/architecture/`, README files                                  |
| API documentation   | ~10   | `docs/api/`, inline JSDoc                                           |
| Build configs       | 15+   | `tsconfig.json`, `Dockerfile`, `vitest.*.config.ts`, `.env.example` |
| CI/CD               | ~5    | Docker configs, deploy scripts                                      |
| Development guides  | ~10   | `CONTRIBUTING.md`, setup guides                                     |
| Test suites         | 200+  | `**/*.test.ts`, `**/*.e2e.test.ts`                                  |
| Migration guides    | ~5    | `docs/*-MIGRATION-GUIDE.md`                                         |
| Session archives    | ~10   | `docs/archived-sessions/`                                           |
| Phase documentation | ~8    | `docs/phase*`, `MEMORY-RESTORATION-*.md`                            |

**Total internal docs**: ~280 files

### 4.2 User Data (Workspace / INFT-hub / Workflows)

| Category               | Count          | Location                                    |
| ---------------------- | -------------- | ------------------------------------------- |
| Memory markdown files  | 317            | `~/.openclaw/workspace-tulsbot/memory/*.md` |
| Memory database        | 1 (320 chunks) | `~/.openclaw/workspace-tulsbot/memory.db`   |
| Knowledge index        | 1 (45 agents)  | `.tulsbot/knowledge-index.json`             |
| Agent definitions      | 45             | `.tulsbot/agents/*.json`                    |
| Core knowledge blob    | 1 (484KB)      | `.tulsbot/core-app-knowledge.json`          |
| Sync state             | 1              | `.sync-state.db`                            |
| Claude project memory  | ~5             | `~/.claude/projects/.../memory/`            |
| NotebookLLM cloud data | variable       | Google Cloud (synced)                       |
| AnythingLLM brain data | variable       | AnythingLLM API (synced)                    |

**Total user data files**: ~370+ files (local only, excludes cloud)

### 4.3 Code vs Scripts vs Config

| Type         | Count | Pattern                               |
| ------------ | ----- | ------------------------------------- |
| Source code  | ~400  | `src/**/*.ts`                         |
| Test files   | ~200  | `**/*.test.ts`, `**/*.e2e.test.ts`    |
| Scripts      | 83    | `scripts/*.ts`, `scripts/*.sh`        |
| Config files | 15+   | Root-level `.json`, `.yaml`, `.env.*` |

---

## 5. Knowledge Base per Container

### Container 1: Gateway Server

- **Purpose**: Connection routing, auth, message handling
- **Knowledge**: Channel configs, auth rules, rate limits
- **Files**: `src/gateway/` (~100 files)
- **Data**: Ephemeral (in-memory sessions, no persistent knowledge)

### Container 2: ACP Protocol Bridge

- **Purpose**: Translate between OpenClaw and Agent Client Protocol
- **Knowledge**: Protocol schemas, message format specs
- **Files**: `src/acp/` (14 files)
- **Data**: Stateless (passes through)

### Container 3: Tulsbot Agent System

- **Purpose**: Multi-agent orchestration, task delegation
- **Knowledge stored**:
  - 45 agent capability definitions (V2 index + individual files)
  - 484KB monolithic knowledge blob (V1)
  - Delegation rules and similarity thresholds
- **Files**: `src/agents/tulsbot/` (~20 files)
- **External data**: `.tulsbot/`

### Container 4: Memory Subsystem

- **Purpose**: Persistent recall, semantic search, knowledge storage
- **Knowledge stored**:
  - 317 markdown memory files
  - SQLite database with 320 embedded chunks
  - Embedding cache (avoid re-computing embeddings)
  - Frontmatter metadata per file
- **Files**: `src/memory/` (~50 files)
- **External data**: `~/.openclaw/workspace-tulsbot/memory/`

### Container 5: Sync Engine

- **Purpose**: Keep local, AnythingLLM, and NotebookLLM in sync
- **Knowledge stored**:
  - Sync state database (last sync timestamps, queue)
  - Conflict resolution history
- **Files**: `scripts/sync-memory-cloud-bidirectional.ts` + related
- **External data**: `.sync-state.db`, cloud APIs

### Container 6: Channel Adapters (per channel)

- **Purpose**: Platform-specific message translation
- **Knowledge**: Platform API schemas, message format rules
- **Files**: `src/channels/<platform>/` (per channel)
- **Data**: Channel-specific session state, webhook configs

### Container 7: Tools Layer

- **Purpose**: Agent capabilities (web, code, media, etc.)
- **Knowledge**: Tool schemas, execution rules, sandbox configs
- **Files**: `src/agents/tools/` + `src/agents/openclaw-tools.ts`
- **Data**: Stateless (tools execute and return)

---

## 6. Overall Architecture Blueprint

```
┌──────────────────────────────────────────────────────────────────┐
│                        EXTERNAL WORLD                            │
│  Users on: Telegram │ Discord │ Slack │ WhatsApp │ Signal │ ... │
└────────┬─────────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────────┐
│                     CHANNEL ADAPTERS                              │
│  Each channel has its own adapter that normalizes messages        │
│  into a common OpenClaw format                                   │
│  Files: src/channels/<platform>/                                 │
└────────┬─────────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────────┐
│                      GATEWAY SERVER                               │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐          │
│  │ WebSocket    │  │ HTTP Server  │  │ Auth Layer     │          │
│  │ :18789       │  │ Express 5    │  │ Token/Pass/IP  │          │
│  └──────┬──────┘  └──────┬───────┘  └────────────────┘          │
│         │                │                                       │
│         └───────┬────────┘                                       │
│                 ▼                                                 │
│         Message Handler                                          │
│         src/gateway/server/ws-connection/message-handler.ts      │
└────────┬─────────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────────┐
│                    ACP PROTOCOL BRIDGE                            │
│  Translates OpenClaw ↔ Agent Client Protocol                    │
│  NDJSON streaming over stdio                                     │
│  Files: src/acp/ (server.ts, session.ts, translator.ts)         │
└────────┬─────────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────────┐
│                    AGENT ORCHESTRATION                            │
│                                                                  │
│  ┌──────────────────────────────────────────────────────┐       │
│  │              Tulsbot Delegation Engine                 │       │
│  │  analyzeIntent() → matchToSubAgent() → execute        │       │
│  │  17 sub-agents │ 6 domains │ max 2 handoff levels     │       │
│  └───────┬────────────────────────────────┬──────────────┘       │
│          │                                │                      │
│          ▼                                ▼                      │
│  ┌───────────────┐              ┌─────────────────────┐         │
│  │  60+ TOOLS     │              │  KNOWLEDGE SYSTEM    │         │
│  │  Web, Code,    │              │  V1: 824KB eager     │         │
│  │  Media, Comms,  │              │  V2: 8KB lazy+LRU   │         │
│  │  System, etc.  │              │  45 agent defs       │         │
│  └───────────────┘              └─────────────────────┘         │
└────────┬─────────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────────┐
│                      BRAIN / MEMORY                               │
│                                                                  │
│  ┌──────────────────────────────────────────────────────┐       │
│  │  Hybrid Search Engine                                 │       │
│  │  SQLite + sqlite-vec (vector) + FTS5 (keyword)        │       │
│  │  Weighted merge: 50% vector / 50% text                │       │
│  └───────┬──────────────────────────────────┬────────────┘       │
│          │                                  │                    │
│          ▼                                  ▼                    │
│  ┌───────────────┐                 ┌──────────────────┐         │
│  │ 317 Markdown   │                 │ SQLite DB         │         │
│  │ memory files   │                 │ 320 chunks        │         │
│  │ (.md files)    │                 │ + embeddings      │         │
│  └───────┬───────┘                 └──────────┬───────┘         │
│          │                                    │                  │
│          └──────────────┬─────────────────────┘                  │
│                         ▼                                        │
│  ┌──────────────────────────────────────────────────────┐       │
│  │  Three-Way Bidirectional Sync                         │       │
│  │  Local ↔ AnythingLLM ↔ NotebookLLM                  │       │
│  │  Every 5 min │ Offline queue │ Retry logic            │       │
│  └──────────────────────────────────────────────────────┘       │
└──────────────────────────────────────────────────────────────────┘

                    AI PROVIDERS (External)
         ┌──────────────────────────────────────┐
         │ OpenAI │ Anthropic │ Gemini │ Bedrock │
         │ OpenRouter │ MiniMax │ ZAI            │
         └──────────────────────────────────────┘
```

---

## 7. Health Assessment & Recommendations

### 7.1 Current Health Status

| Area             | Status                 | Notes                           |
| ---------------- | ---------------------- | ------------------------------- |
| Gateway          | Healthy                | Stable multi-channel routing    |
| Auth             | Healthy                | Multiple layers, rate limiting  |
| ACP Bridge       | Healthy                | Clean protocol translation      |
| Agent Delegation | Healthy                | Well-structured 17-agent system |
| Knowledge V1     | Working but deprecated | 824KB eager load is wasteful    |
| Knowledge V2     | Healthy                | 95% performance improvement     |
| Memory System    | Healthy                | Hybrid search working well      |
| Sync Engine      | Healthy                | Three-way sync operational      |
| Test Coverage    | Moderate               | 200+ tests, some gaps in e2e    |

### 7.2 Untracked / Uncommitted Changes

**21 modified files** and **13+ new untracked files** detected. Notable:

- `.claude/` — Claude Code project memory (new)
- `.sync-state.db` — Sync state database (new)
- `MEMORY-RESTORATION-*.md` — Phase documentation (new)
- `docs/TULSBOT-*.md` — Tulsbot docs (new)
- `src/agents/tulsbot/knowledge-loader-v2.ts` — V2 loader (new)
- `src/agents/tulsbot/notebooklm-importer.ts` — NotebookLLM integration (new)
- `src/memory/frontmatter.ts` — Frontmatter parser (new)
- `test/channels-integration.e2e.test.ts` — Channel tests (new)

**Recommendation**: Commit and push these changes. Several are production-ready features (V2 loader, sync engine, frontmatter parser).

### 7.3 Architecture Observations

**Strengths**:

1. Clean separation of concerns (gateway → ACP → agents → memory)
2. Multi-channel abstraction is well-designed
3. V2 knowledge loader is a significant performance win
4. Hybrid search (vector + keyword) provides robust recall
5. Namespace isolation enables multi-tenant memory
6. Offline-first sync with retry is resilient

**Areas for Review**:

1. **V1 loader still present** — Consider removing once V2 is fully validated
2. **External file paths are hardcoded** — Knowledge files reference absolute paths
3. **Sync state DB in repo root** — `.sync-state.db` should be in `.gitignore` or moved to workspace dir
4. **116 runtime deps** — Large dependency surface; audit for unused packages
5. **Multiple embedding providers** — Good for flexibility, but increases maintenance surface
6. **Chunking parameters differ** — Memory uses 512 tokens/64 overlap, NotebookLLM importer uses 2000 chars/200 overlap — should these be unified?

### 7.4 Data Flow Summary

```
INPUT                    PROCESSING               STORAGE
─────                    ──────────               ───────
User message      →  Channel adapter    →  Session (ephemeral)
                  →  Gateway routing     →  Message handler
                  →  ACP translation     →  Agent context
                  →  Intent analysis     →  Delegation decision
                  →  Tool execution      →  Tool results
                  →  Knowledge query     →  V2 index + agent files
                  →  Memory search       →  SQLite + embeddings
                  →  Response compose    →  Channel adapter → User

SYNC (background, every 5 min):
Local .md files   ↔  AnythingLLM Brain  ↔  NotebookLLM Cloud
```

---

_End of audit report. Generated from comprehensive codebase analysis of the OpenClaw repository._
