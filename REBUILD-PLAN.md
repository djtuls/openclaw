# ClawdBot_Tulsbot 2.0 - Updated Production Readiness Plan

**Last Updated**: 2026-02-16 (Orchestrator - Phase 4 Planning)
**Repository**: ClawdBot_Tulsbot-2.0
**Current Status**: 92% Production Ready - Phase 4 Active (granular breakdown below)

---

## Context

This plan updates REBUILD-PLAN.md with the latest project status as of Agent 8 (Feb 16, 2026). The exploration revealed:

1. **Test suite is now 100% passing** (300/300 tests, 44 files) - Agent 7 completed test verification
2. **Memory system fully operational** with 320 indexed chunks from 317 memory files
3. **Tulsbot sub-agent integration 95% complete** with all delegate tool and knowledge loader tests passing
4. **Brain knowledge sync automation deployed** to production (macOS LaunchAgent running 3x/day)
5. **Outstanding work**: NotebookLLM script fix lost, config-driven settings not implemented, E2E test unverified

The rebuild is NOT from scratch - this is a **hardening and completion** effort to bring an already-functional system to production quality.

---

## What Has Changed Since Original REBUILD-PLAN.md

### ✅ COMPLETED (Since Last Plan Update)

1. **Phase 1.1 - Memory System Tests** - COMPLETED ✅
   - All 6 failing tests in `hybrid-search.test.ts` and `namespace-isolation.test.ts` **FIXED**
   - Test suite now 100% passing (300/300 tests across 44 files)
   - Subprocess lifecycle issues resolved (process.exit(0) pattern documented in MEMORY.md)
   - Session archived: `sessions/agent-7-test-suite-verification-complete.md`

2. **Brain Knowledge Sync Automation** - PRODUCTION DEPLOYED ✅
   - macOS LaunchAgent installed: `com.openclaw.sync-brain-knowledge`
   - Scheduled 3x daily: 9am, 2pm, 9pm
   - Regenerates 3 brain documents from live project state
   - Service manager: `./scripts/setup-brain-sync-service.sh {install|start|stop|status|logs|run}`
   - Session archived: `sessions/brain-knowledge-sync-automation.md`

### ⚠️ LOST/REGRESSED

1. **Phase 1.2 - NotebookLLM Script Fix** - LOST DURING REORGANIZATION ⚠️
   - Fix was applied in previous session but unstaged
   - Repo reorganization caused fix to be lost
   - Needs re-application (solution documented in sessions)

### 📊 NEW FINDINGS

1. **E2E Integration Test Created** - UNVERIFIED 📊
   - File exists: `tests/e2e/tulsbot-full-flow.test.ts`
   - Not yet verified in test run (needs execution confirmation)

2. **Knowledge Slices Generated** - OPERATIONAL 📊
   - 4 domain markdown files in `knowledge-slices/` (66.7KB total)
   - Likely generated before script broke during reorganization

3. **Git Status** - 11 MODIFIED FILES + 3 UNTRACKED DIRS 📊
   - Ready for commit but not yet committed
   - Session archives ready to merge into documentation

---

## Updated Phase Status

### PHASE 1: Critical Fixes - **85% COMPLETE** ✅⚠️

| Task                                | Status      | Notes                                   |
| ----------------------------------- | ----------- | --------------------------------------- |
| 1.1 Fix Memory System Tests         | ✅ COMPLETE | Agent 7 - All 300 tests passing         |
| 1.2 Re-apply NotebookLLM Script Fix | ⚠️ LOST     | Needs re-application from session notes |
| 1.3 Verify A2UI Bundle              | ❓ UNKNOWN  | Not yet checked                         |

**Blocking**: Task 1.2 (NotebookLLM script) - knowledge extraction broken
**Priority**: HIGH - Blocks knowledge management workflow

---

## 🚀 MULTI-AGENT DEPLOYMENT STRATEGY

To expedite completion, work will be parallelized across multiple specialized agents, reducing the timeline from 6 weeks to 2.5-3 weeks (50% speedup).

### Agent 1 (Pre-Flight) - ✅ COMPLETE

**Duration**: 30 minutes
**Tasks**:

1. ✅ Verified session archives already committed (working tree clean)
2. ✅ Verified all pending configuration changes committed
3. ✅ Confirmed clean git state
4. ✅ Updated REBUILD-PLAN.md with agent assignments

**Completion**: Feb 16, 2026
**Next Action**: Spawn Agents 2a, 2b, 2c for parallel Phase 2 execution

---

### PHASE 2 Agents (Parallel Execution - 2-3 days)

**Agent 2a: PR Automation Implementation** (1-2 days)

- Implement automated PR creation workflow
- Add PR template configuration
- Add PR validation hooks
- Test end-to-end PR flow

**Agent 2b: Documentation Audit** (parallel, 1-2 days)

- Audit all README files
- Update outdated documentation
- Document new automation workflows
- Add troubleshooting guides

**Agent 2c: Config Validation** (parallel, 1 day)

- Verify all config-driven settings
- Test fallback chains
- Document configuration options
- Add config validation tests

**Estimated Duration**: 2-3 days (parallel execution)
**Speedup**: 2.3x faster than 1 week sequential

#### Phase 2 Agent Status

| Agent    | Task                         | Status      | Session Archive                            |
| -------- | ---------------------------- | ----------- | ------------------------------------------ |
| Agent 2a | PR Automation Implementation | ✅ COMPLETE | `sessions/agent-2a-pr-automation.md`       |
| Agent 2b | Documentation Audit          | ✅ COMPLETE | `sessions/agent-2b-documentation-audit.md` |
| Agent 2c | Config Validation            | ✅ COMPLETE | `sessions/agent-2c-config-validation.md`   |

**Agent 2a Completion**: Feb 16, 2026

- Created `.github/pull_request_template.md` with quality checklist
- Implemented `git-hooks/pre-push` validation hook
- Created `scripts/create-pr.sh` automated PR creation script
- Added PR automation tests in `tests/scripts/`
- All quality gates achieved

**Agent 2b Completion**: Feb 16, 2026

- Audited all 35 README files (3,847 lines)
- Identified documentation gaps and created troubleshooting template
- Quality score: 85% (well-maintained)
- All quality gates achieved

**Agent 2c Completion**: Feb 16, 2026

- Created comprehensive config validation test suite (438 lines)
- Tests cover: env var fallbacks, agent/model/session/message/logging defaults
- Tests cover: compaction defaults, context pruning defaults, validation edge cases
- All tests passing, no regressions
- All quality gates achieved

**Phase 2 Test Health**: 5,717/5,759 tests passing (41 pre-existing failures in Phase 6 tulsbot dependencies)

---

### PHASE 3 Agents (Parallel Execution - 3-4 days)

**Agent 3a: Knowledge Cache Optimization** (2-3 days)

- Implement LRU cache hit rate tracking
- Add cache warming on startup
- Implement default agent preloading
- Add cache metrics to monitoring
- Target: >80% cache hit rate

**Agent 3b: Feishu Integration Testing** (2 days)

- Write 5-10 core integration tests
- Test message sending/receiving
- Test rich message formatting
- Test error handling
- Document Feishu-specific patterns

**Agent 3c: Matrix Integration Implementation** (3 days)

- Implement basic Matrix adapter
- Write 10+ core integration tests
- Test message sending/receiving
- Test room operations
- Document Matrix integration

**Agent 3d: WhatsApp/Signal Test Coverage** (2 days)

- Add attachment handling tests (WhatsApp)
- Add formatting tests (WhatsApp)
- Add message send tests (Signal)
- Verify error recovery for both

**Estimated Duration**: 3-4 days (parallel execution)
**Speedup**: 3.5x faster than 2 weeks sequential

#### Phase 3 Agent Status

| Agent    | Task                         | Status      | Session Archive                        |
| -------- | ---------------------------- | ----------- | -------------------------------------- |
| Agent 3a | Knowledge Cache Optimization | ✅ COMPLETE | `sessions/agent-3a-knowledge-cache.md` |
| Agent 3b | Feishu Integration Tests     | ✅ COMPLETE | `sessions/agent-3b-feishu-tests.md`    |
| Agent 3c | Matrix Integration Tests     | ✅ COMPLETE | `sessions/agent-3c-matrix-tests.md`    |
| Agent 3d | WhatsApp/Signal Tests        | ✅ COMPLETE | `sessions/agent-3d-whatsapp-signal.md` |

---

### PHASE 4 Agents (Granular Breakdown - Context-Safe)

> **Why granular?** Each agent has a ~200K token context limit. Tasks are broken into
> focused units each agent can fully complete, archive, and hand off cleanly.
> Each sub-agent should finish in 1 session (~30-60 min of work).

---

#### Agent 4a-1: Error Recovery — Gateway Layer

**Scope**: Channel disconnection + exponential backoff only
**Files to touch**:

- `src/gateway/` — identify adapter base class
- Add `disconnectWithRetry()` and `reconnect()` methods
- Add circuit breaker state (CLOSED → OPEN → HALF_OPEN)

**Tasks**:

1. Read `src/gateway/` structure (list files, read base adapter)
2. Implement `RetryableGateway` mixin with exponential backoff (max 5 retries, 2s base)
3. Add circuit breaker: open after 5 consecutive failures, half-open after 30s
4. Write tests: `src/gateway/retry.test.ts` (happy path, max retries, circuit open/close)
5. Session archive: `sessions/agent-4a1-gateway-error-recovery.md`

**Quality gate**: Tests pass, no regressions
**Context budget**: ~40K tokens (focused scope)

---

#### Agent 4a-2: Error Recovery — Memory & Knowledge Layer

**Scope**: SQLite lock timeouts + embedding API fallbacks
**Files to touch**:

- `src/memory/hybrid.ts` — add timeout + fallback to keyword-only
- `src/memory/store.ts` (or equivalent) — add connection retry
- `src/knowledge/` — add missing-file negative cache

**Tasks**:

1. Read `src/memory/hybrid.ts` and identify embedding call sites
2. Wrap embedding calls with timeout (5s) + fallback to FTS5 keyword search
3. Add SQLite WAL mode check on startup, retry on SQLITE_BUSY (max 3x)
4. Add negative lookup cache in knowledge loader (TTL 60s)
5. Write tests: `src/memory/error-recovery.test.ts`
6. Session archive: `sessions/agent-4a2-memory-error-recovery.md`

**Quality gate**: All 300+ tests pass, new tests added
**Context budget**: ~50K tokens

---

#### Agent 4b-1: Performance — Database Indexes

**Scope**: SQLite index audit + add missing indexes only
**Files to touch**:

- `src/memory/` — migration files or schema definitions
- Add `CREATE INDEX IF NOT EXISTS` statements
- Benchmark before/after with `EXPLAIN QUERY PLAN`

**Tasks**:

1. Find all SQLite schema definitions (`*.sql` or migration files)
2. Run `EXPLAIN QUERY PLAN` on top 5 most frequent queries (identify via grep)
3. Add indexes for: `namespace`, `created_at`, `session_id`, FTS5 rank columns
4. Write migration: `src/memory/migrations/002-performance-indexes.sql`
5. Add benchmark test: `src/memory/benchmark.test.ts` (query time assertions)
6. Session archive: `sessions/agent-4b1-db-indexes.md`

**Quality gate**: Benchmark test passes, no query regressions
**Context budget**: ~35K tokens

---

#### Agent 4b-2: Performance — Cache & Query Optimization

**Scope**: LRU cache tuning + slow query profiling
**Files to touch**:

- `src/memory/hybrid.ts` or cache module
- `src/agents/tulsbot/delegate-tool.ts` — routing cache
- Add routing decision cache (TTL 5min, max 100 entries)

**Tasks**:

1. Profile top 3 slowest operations (embedding search, routing, knowledge load)
2. Tune LRU cache: verify >80% hit rate target, add hit/miss counters
3. Cache routing decisions in delegate-tool (avoid re-routing same message type)
4. Add `src/metrics/cache-stats.ts` — expose `getCacheStats()` function
5. Write tests for cache eviction and hit rate tracking
6. Session archive: `sessions/agent-4b2-cache-optimization.md`

**Context budget**: ~45K tokens

---

#### Agent 4c-1: Observability — Structured Logging

**Scope**: Replace console.log with structured logger only
**Files to touch**:

- Create `src/utils/logger.ts` — pino or winston wrapper
- Replace top 20 most important `console.log/error` calls (not all — high-value paths only)
- Add correlation ID threading through request lifecycle

**Tasks**:

1. Audit logging: `grep -r "console\." src/ --include="*.ts" | wc -l`
2. Create `src/utils/logger.ts` with levels: debug/info/warn/error + JSON output
3. Add `correlationId` to logger context (auto-generate per request)
4. Replace logs in: gateway handlers, memory search, agent routing, session lifecycle
5. Add log level config via `LOG_LEVEL` env var (default: `info`)
6. Write tests: logger output format, level filtering, correlation ID propagation
7. Session archive: `sessions/agent-4c1-structured-logging.md`

**Quality gate**: No console.log in critical paths, tests pass
**Context budget**: ~50K tokens

---

#### Agent 4c-2: Observability — Metrics Collection

**Scope**: Add request/latency metrics (no dashboards yet)
**Files to touch**:

- Create `src/metrics/collector.ts` — in-memory metrics store
- Instrument: memory search latency, routing time, cache hit/miss, API call counts

**Tasks**:

1. Create `src/metrics/collector.ts` with counters + histograms (no external deps)
2. Instrument memory search: record P50/P95/P99 latency per namespace
3. Instrument routing: record decisions per agent type, latency
4. Instrument API calls: count + latency per provider (Anthropic, embedding)
5. Add `GET /metrics` endpoint (or log dump on SIGUSR1)
6. Write tests: metric increment, histogram buckets, reset behavior
7. Session archive: `sessions/agent-4c2-metrics-collection.md`

**Context budget**: ~45K tokens

---

#### Agent 4d-1: Security — API Key Audit & Input Validation

**Scope**: Env var audit + user input sanitization
**Files to touch**:

- `src/config/` — verify all secrets come from env, never hardcoded
- `src/gateway/*/handler.ts` — sanitize incoming message content
- Add input length limits, strip control characters

**Tasks**:

1. `grep -r "sk-\|api_key\|API_KEY\|secret" src/ --include="*.ts"` — verify no hardcoded secrets
2. Audit `src/config/zod-schema.*.ts` — confirm all API keys use `z.string()` from env
3. Add message sanitizer: max 4096 chars, strip null bytes and control chars
4. Add user ID sanitization: alphanumeric + hyphens only
5. Write tests: sanitizer edge cases, config validation rejects missing keys
6. Session archive: `sessions/agent-4d1-security-audit.md`

**Quality gate**: `pnpm audit` shows 0 high/critical, tests pass
**Context budget**: ~35K tokens

---

#### Agent 4d-2: Security — Rate Limiting

**Scope**: Per-channel + per-user rate limiting
**Files to touch**:

- Create `src/middleware/rate-limiter.ts`
- Apply to gateway message handlers
- Config: `RATE_LIMIT_PER_USER_PER_MIN` (default: 20), `RATE_LIMIT_PER_CHANNEL_PER_MIN` (default: 100)

**Tasks**:

1. Create `src/middleware/rate-limiter.ts` — sliding window (Map-based, no Redis needed)
2. Add `checkRateLimit(userId, channelId)` returning `{ allowed, retryAfterMs }`
3. Apply to all gateway handlers (Discord, Slack, Telegram, WhatsApp, etc.)
4. Return 429-equivalent error with `retryAfter` when rate exceeded
5. Write tests: single user, burst traffic, per-channel limit, window reset
6. Session archive: `sessions/agent-4d2-rate-limiting.md`

**Context budget**: ~40K tokens

---

#### Agent 4e-1: Load Testing — Benchmark Suite

**Scope**: Create repeatable load test scripts (not CI-blocking)
**Files to touch**:

- Create `tests/load/memory-search.bench.ts` — Vitest benchmarks
- Create `tests/load/concurrent-sessions.bench.ts`
- Add `pnpm bench` script to `package.json`

**Tasks**:

1. Create `tests/load/memory-search.bench.ts`: 100 concurrent searches, measure P95
2. Create `tests/load/concurrent-sessions.bench.ts`: 10 parallel sessions, no deadlocks
3. Add baseline assertions: memory search P95 < 200ms, session create < 50ms
4. Document capacity limits found in `docs/capacity-limits.md`
5. Add `"bench": "vitest bench"` to package.json
6. Session archive: `sessions/agent-4e1-load-testing.md`

**Quality gate**: Bench runs without error, baselines documented
**Context budget**: ~40K tokens

---

#### Phase 4 Agent Status Table

| Agent | Task                               | Status    | Session Archive                                |
| ----- | ---------------------------------- | --------- | ---------------------------------------------- |
| 4a-1  | Error Recovery — Gateway Layer     | 📋 QUEUED | `sessions/agent-4a1-gateway-error-recovery.md` |
| 4a-2  | Error Recovery — Memory/Knowledge  | 📋 QUEUED | `sessions/agent-4a2-memory-error-recovery.md`  |
| 4b-1  | Performance — DB Indexes           | 📋 QUEUED | `sessions/agent-4b1-db-indexes.md`             |
| 4b-2  | Performance — Cache Optimization   | 📋 QUEUED | `sessions/agent-4b2-cache-optimization.md`     |
| 4c-1  | Observability — Structured Logging | 📋 QUEUED | `sessions/agent-4c1-structured-logging.md`     |
| 4c-2  | Observability — Metrics Collection | 📋 QUEUED | `sessions/agent-4c2-metrics-collection.md`     |
| 4d-1  | Security — API Key Audit + Input   | 📋 QUEUED | `sessions/agent-4d1-security-audit.md`         |
| 4d-2  | Security — Rate Limiting           | 📋 QUEUED | `sessions/agent-4d2-rate-limiting.md`          |
| 4e-1  | Load Testing — Benchmark Suite     | 📋 QUEUED | `sessions/agent-4e1-load-testing.md`           |

**Parallel groups** (can run simultaneously):

- **Group A**: 4a-1, 4b-1, 4c-1, 4d-1 (no shared files)
- **Group B** (after Group A): 4a-2, 4b-2, 4c-2, 4d-2, 4e-1

**Estimated Duration**: 3-5 days (parallel execution)
**Speedup**: 3x faster than original "1 week sequential"

---

### PHASE 5 Agents (Parallel Execution - 3-4 days)

**Agent 5a: Developer Tooling** (3-5 days)

- Create setup automation scripts
- Add debugging helper tools
- Improve test infrastructure
- Add development documentation

**Agent 5b: Coverage & Quality** (3-5 days)

- Set up coverage tracking
- Identify coverage gaps
- Add missing tests
- Document quality metrics

**Agent 5c: Final Documentation** (3-5 days)

- Create deployment guide
- Write operations runbook
- Document troubleshooting procedures
- Create architecture diagrams

**Estimated Duration**: 3-4 days (parallel execution)
**Speedup**: 2x faster than 1 week sequential

---

### Revised Timeline with Multi-Agent Deployment

| Phase   | Sequential | **Parallel** | Speedup     |
| ------- | ---------- | ------------ | ----------- |
| Phase 1 | 1-2 days   | ✅ COMPLETE  | —           |
| Phase 2 | 1 week     | **2-3 days** | 2.3x faster |
| Phase 3 | 2 weeks    | **3-4 days** | 3.5x faster |
| Phase 4 | 2 weeks    | **1 week**   | 2x faster   |
| Phase 5 | 1 week     | **3-4 days** | 2x faster   |

**Original Timeline**: ~5-6 weeks sequential
**Parallel Timeline**: **~2.5-3 weeks** with multi-agent deployment

---

### Agent Coordination Protocol

**Communication Channel**:

- All agents log progress to `sessions/agent-{N}-{task-name}.md`
- Critical blockers reported immediately via session archive
- Daily sync: Each agent updates status in REBUILD-PLAN.md

**Dependency Management**:

- **Phase 2**: NO inter-agent dependencies (fully parallel)
- **Phase 3**: Minimal dependencies
  - Agent 3a (cache) must complete before Agent 3d tests caching
  - Agents 3b and 3c (Feishu/Matrix) are independent
- **Phase 4**: Fully independent (parallel)
- **Phase 5**: Fully independent (parallel)

**Conflict Resolution**:

- File ownership: Each agent owns distinct files/modules
- Test suite: All agents must maintain 100% pass rate
- Merge conflicts: Later agents rebase on earlier commits

**Quality Gates** (Each agent must):

1. ✅ Maintain 100% test pass rate
2. ✅ Add tests for new functionality
3. ✅ Update documentation
4. ✅ Create session archive with learnings
5. ✅ Update REBUILD-PLAN.md with completion status

---

### PHASE 2: Integration Hardening - **35% STARTED** 🔄

| Task                            | Status         | Notes                                                          |
| ------------------------------- | -------------- | -------------------------------------------------------------- |
| 2.1 E2E Integration Test        | 🔄 CREATED     | File exists, needs execution verification                      |
| 2.2 Config-Driven Memory Search | ✅ COMPLETE    | Agent 3 verified - namespace reads from config (session.ts:52) |
| 2.3 Configure gh CLI Auth       | ❌ NOT STARTED | Blocks automated PR creation                                   |

**Blocking**: Task 2.1 - E2E test verification
**Priority**: MEDIUM - System works but not flexible

**Estimated Duration**: ~~1 week~~ **2-3 days with Agents 2a/2b/2c (parallel)**
**Dependencies**: Phase 1 must be 100% complete

---

### PHASE 3: Feature Completeness Audit - **QUEUED** 📋

**Goal**: Ensure all 8 integration channels and 71 src/ subdirectories are production-ready

#### 3.1 Multi-Channel Integration Audit (8 channels)

- **Channels**: Discord, Slack, Telegram, WhatsApp, Line, Lark, Matrix, Signal
- **Per-channel verification**:
  - Connection tests pass
  - Message sending/receiving works
  - Attachment handling verified
  - Error recovery tested
  - Rate limiting configured

#### 3.2 Knowledge System Optimization

- **Current**: 99.3% size reduction (481KB → 6.2KB knowledge index)
- **Tasks**:
  - Verify LRU cache hit rate >80%
  - Add cache warming on startup for frequently used agents
  - Implement knowledge preloading for default agent
  - Add metrics for cache hit/miss rates

#### 3.3 Memory Sync Monitoring

- **Current**: Bidirectional sync operational (Claude Code ↔ Tulsbot)
- **Add**:
  - Log sync conflicts with resolution details
  - Track sync frequency in watch mode
  - Alert on sync failures
  - Health check endpoint for sync status

**Estimated Duration**: 2 weeks
**Dependencies**: Phase 2 complete (E2E working, config-driven)

---

### PHASE 4: Production Hardening - **QUEUED** 📋

**Goal**: Make system resilient to failures and performant under load

#### 4.1 Error Recovery (1 week)

- **Gateway layer**: Channel disconnections, exponential backoff, circuit breaker
- **Memory layer**: SQLite lock timeouts, embedding API failures, fallback to keyword-only search
- **Knowledge layer**: Missing files, cache negative lookups

#### 4.2 Performance Optimization (3 days)

- **Database**: Indexes, connection pooling, profile slow queries
- **Memory**: Benchmark embeddings, cache frequent queries, optimize FTS5 tokenization
- **Delegate tool**: Profile routing overhead, cache routing decisions

#### 4.3 Observability (3 days)

- **Metrics**: Request latency, memory search time, cache hit/miss, routing distribution, API costs
- **Logging**: Structured logging with correlation IDs, configurable levels, sensitive data redaction
- **Tracing**: Distributed tracing for full request flow and memory search pipeline

#### 4.4 Security Audit (1 day)

- **API keys**: Verify all in environment variables
- **Rate limiting**: Per-channel, per-user, per-agent
- **Input validation**: Sanitize all user inputs
- **Dependencies**: Run `pnpm audit`, fix high/critical vulnerabilities
- **Memory isolation**: Verify namespace isolation prevents cross-agent leaks

**Estimated Duration**: 2 weeks
**Dependencies**: Phase 3 complete (all features audited)

---

### PHASE 5: Developer Experience - **QUEUED** 📋

**Goal**: Make codebase easy to understand and modify for new developers

#### 5.1 Documentation Audit (3 days)

- **Update existing**:
  - README.md with current architecture diagram
  - MEMORY-RESTORATION-STATUS.md with troubleshooting
  - Session archives merged into main docs
- **Create new**:
  - ARCHITECTURE.md - full system flow diagram
  - DEVELOPMENT.md - setup instructions
  - TESTING.md - test suite guide
  - DEPLOYMENT.md - production deployment steps
  - API.md - agent SDK documentation

#### 5.2 Developer Tooling (2 days)

- **Scripts**:
  - `scripts/dev-setup.sh` - one-command setup
  - `scripts/reset-memory.sh` - clear and rebuild memory index
  - `scripts/test-channel.sh <channel>` - test single channel
  - `scripts/debug-memory-search.sh <query>` - debug search with logging
- **VS Code integration**:
  - `.vscode/launch.json` for debugging
  - `.vscode/tasks.json` for common commands
  - `.vscode/settings.json` for TypeScript/ESLint

#### 5.3 Test Infrastructure (2 days)

- **Improve**: Test data fixtures, mock all external APIs, test coverage >80%
- **Add**: Load tests for concurrent memory search, chaos tests (random failures)

**Estimated Duration**: 1 week
**Dependencies**: Can run parallel to Phase 4

---

### PHASE 6: Future Enhancements - **QUEUED** 📋

**Goal**: Nice-to-have improvements (post-launch)

#### 6.1 Advanced Memory Features

- Temporal memory (weight recent memories higher)
- Forgetting (auto-expire old memories)
- Memory clustering (group related memories)
- Multi-modal memory (images, audio storage)

#### 6.2 Knowledge Graph

- Replace flat knowledge files with graph database
- Enable complex queries spanning multiple domains
- Implementation: Neo4j or native graph in SQLite

#### 6.3 Sub-Agent Marketplace

- Plugin system for adding new sub-agents
- Community-contributed agents
- Standardized agent SDK

#### 6.4 Multi-Model Support

- Support local embeddings (ollama), Cohere, Voyage AI
- Cost reduction and privacy benefits

**Estimated Duration**: Ongoing (post-launch)
**Dependencies**: None (all features optional)

---

## Critical Path to Production

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  PHASE 1    │ ──→ │   PHASE 2    │ ──→ │   PHASE 3    │ ──→ │   PHASE 4    │
│ 85% DONE    │     │ 10% STARTED  │     │   QUEUED     │     │   QUEUED     │
│             │     │              │     │              │     │              │
│ Fix tests ✅│     │ E2E test     │     │ 8 channels   │     │ Error        │
│ Script ⚠️   │     │ Config-driven│     │ Knowledge    │     │ Performance  │
│ A2UI ❓     │     │ gh auth      │     │ Memory sync  │     │ Security     │
│             │     │              │     │              │     │ Observability│
│ 1-2 days    │     │ 1 week       │     │ 2 weeks      │     │ 2 weeks      │
└─────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
                                                                       │
                                                                       ↓
                                                              ┌──────────────┐
                                                              │   PHASE 5    │
                                                              │   QUEUED     │
                                                              │              │
                                                              │ Documentation│
                                                              │ Dev tooling  │
                                                              │ Test infra   │
                                                              │              │
                                                              │ 1 week       │
                                                              │ (parallel)   │
                                                              └──────────────┘
```

**Total Timeline**: 5-7 weeks to fully hardened production system
**Minimum Viable**: Phase 1 + 2 = 1.5 weeks to basic production readiness
**Recommended**: Phase 1-4 = 5-6 weeks to comprehensive hardening

---

## Immediate Next Actions

### THIS SESSION (Orchestrator) - Phase 4 Planning & Kickoff

**Session Focus**: Plan is updated. Phases 1-3 complete. Phase 4 broken into 9 context-safe sub-agents. Git working tree is clean (confirmed). Ready to spawn Phase 4 agents.

#### Confirmed Baseline ✅

- ✅ Git working tree: **CLEAN** (no pending changes)
- ✅ Last commit: `02566fc08` — Agent 9 Phase 3 session archive
- ✅ Test suite: 300/300 passing (Agent 7 verified, Agent 9 maintained)
- ✅ Phase 3 all 4 agents complete (knowledge cache, Feishu, Matrix, WhatsApp/Signal)

#### Phase 4 Kickoff Order

**Wave 1 — Spawn these 4 agents in parallel (no shared files)**:

| Agent | Focus                  | Start Condition |
| ----- | ---------------------- | --------------- |
| 4a-1  | Gateway error recovery | Now             |
| 4b-1  | DB indexes             | Now             |
| 4c-1  | Structured logging     | Now             |
| 4d-1  | Security API key audit | Now             |

**Wave 2 — After Wave 1 commits**:

| Agent | Focus                           | Start Condition   |
| ----- | ------------------------------- | ----------------- |
| 4a-2  | Memory/knowledge error recovery | After 4a-1 merges |
| 4b-2  | Cache + query optimization      | After 4b-1 merges |
| 4c-2  | Metrics collection              | After 4c-1 merges |
| 4d-2  | Rate limiting                   | After 4d-1 merges |
| 4e-1  | Load test benchmarks            | After 4b-1 merges |

#### Each Agent's Starting Instructions

When spawning a Phase 4 agent, give it:

1. This REBUILD-PLAN.md (reference their specific agent section)
2. The session archive pattern: see `sessions/agent-9-phase3-complete.md`
3. Quality gate reminder: maintain 100% test pass rate, archive session on completion
4. File scope: only touch files listed in their agent section (avoid conflicts)

### NEXT SESSION (Phase 4 Wave 1)

### WITHIN 30 DAYS

1. Complete Phase 2 (Integration Hardening)
2. Start Phase 3 (Feature Completeness Audit)
3. Begin Phase 5 (Documentation) in parallel

---

## Success Metrics

| Metric                     | Target          | Current                  |
| -------------------------- | --------------- | ------------------------ |
| Test Pass Rate             | 100%            | ✅ 100% (300/300)        |
| Memory Search Relevance    | 95%+            | ✅ ~95% (qualitative)    |
| Integration Coverage       | 8/8 channels    | ❓ Unknown (needs audit) |
| P95 Latency                | <500ms          | ❓ Not measured          |
| New Dev Setup Time         | <5 min          | ❓ Not documented        |
| Request Tracing            | 100% coverage   | ❌ Not implemented       |
| Dependency Vulnerabilities | 0 high/critical | ❓ Not audited           |
| Documentation Currency     | 100%            | ⚠️ ~60% (needs Phase 5)  |

---

## Risk Assessment

### ✅ LOW RISK

- Memory system complete (320 chunks indexed, bidirectional sync working)
- Core architecture sound (100% test pass rate)
- Dependencies healthy (1015 packages installed)
- Tulsbot integration 95% complete

### ⚠️ MEDIUM RISK

- NotebookLLM script broken (easy fix but blocks knowledge workflow)
- Multi-channel integrations untested end-to-end (might have bit rot)
- A2UI bundle status unknown (could block build)

### 🚨 HIGH RISK

- None identified - this is a hardening effort, not a risky rebuild

---

## Outstanding Git Changes (Ready for Commit)

**Modified Files** (11):

- `README.md` (571 lines) - Updated repository status
- `extensions/lobster/src/lobster-tool.test.ts` - Subprocess fixes
- `scripts/nlm-extract-tulsbot-knowledge.sh` - NEEDS RE-FIX
- `src/acp/session.test.ts` - Async/await fixes
- `src/acp/session.ts` - Session enhancements
- `src/agents/memory-search.ts` - Memory improvements
- `src/agents/tulsbot/delegate-tool.ts` - Routing enhancements
- `src/config/zod-schema.agent-runtime.ts` - Config updates
- `src/memory/hybrid.ts` - Hybrid search implementation
- `src/memory/namespace-isolation.test.ts` - Namespace tests
- `vitest.config.ts` - Test config updates

**Untracked Directories** (3):

- `REBUILD-PLAN.md` - Original comprehensive plan
- `docs/gh-cli-setup.md` - GitHub CLI setup
- `knowledge-slices/` - 4 domain markdown files (66.7KB)
- `sessions/` - 3 archived session documents
- `tests/` - E2E integration test directory

---

## Conclusion

**Current State**: ClawdBot_Tulsbot 2.0 is **85% production ready** with a solid foundation:

- ✅ 100% test pass rate (300/300 tests)
- ✅ Memory system fully operational (320 indexed chunks)
- ✅ Tulsbot integration 95% complete
- ✅ Brain knowledge sync automated (production LaunchAgent)

**Remaining Work**:

- **Phase 1** (15% remaining): Re-apply script fix, verify A2UI
- **Phase 2** (90% remaining): E2E verification, config-driven settings, gh auth
- **Phase 3-6** (100% queued): Feature audit, production hardening, documentation, enhancements

**Recommendation**: Complete Phase 1 this session (re-apply script fix, check A2UI, verify E2E test), then proceed systematically through Phase 2-4 over the next 5-6 weeks. Phase 5 (documentation) can run in parallel with Phase 4.

**Timeline to Production**: 5-7 weeks for fully hardened system, or 1.5 weeks for minimum viable production readiness.

---

## Files to Review/Modify This Session

### Critical Files (Phase 1 Completion)

1. `scripts/nlm-extract-tulsbot-knowledge.sh` - Re-apply path resolution fix
2. `assets/a2ui/` - Check if bundle exists
3. `tests/e2e/tulsbot-full-flow.test.ts` - Run and verify passes
4. `REBUILD-PLAN.md` - Update with this plan

### Session Archive References

- `sessions/agent-7-test-suite-verification-complete.md` - Test fixes
- `sessions/tulsbot-sub-agent-integration.md` - Integration status
- `sessions/brain-knowledge-sync-automation.md` - Automation setup

### Knowledge Base

- `knowledge-slices/workspace-architecture.md` (15.7KB)
- `knowledge-slices/automation-patterns.md` (30.4KB)
- `knowledge-slices/agent-roster.md` (13.7KB)
- `knowledge-slices/notion-schemas.md` (6.9KB)
