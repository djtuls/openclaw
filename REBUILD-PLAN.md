# ClawdBot_Tulsbot 2.0 - Updated Production Readiness Plan

**Last Updated**: 2026-02-16 (Current Session - Agent 8)
**Repository**: ClawdBot_Tulsbot-2.0
**Current Status**: 85% Production Ready - Hardening & Completion Phase

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

### PHASE 2: Integration Hardening - **35% STARTED** 🔄

| Task                            | Status         | Notes                                                          |
| ------------------------------- | -------------- | -------------------------------------------------------------- |
| 2.1 E2E Integration Test        | 🔄 CREATED     | File exists, needs execution verification                      |
| 2.2 Config-Driven Memory Search | ✅ COMPLETE    | Agent 3 verified - namespace reads from config (session.ts:52) |
| 2.3 Configure gh CLI Auth       | ❌ NOT STARTED | Blocks automated PR creation                                   |

**Blocking**: Task 2.1 - E2E test verification
**Priority**: MEDIUM - System works but not flexible

**Estimated Duration**: 1 week
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

### THIS SESSION (Agent 1) - Foundation Verification & Phase 1 Completion

**Session Focus**: Solidify the foundation by verifying all tests pass, re-applying lost fixes, and preparing for Phase 2 integration work.

#### Priority 1: Foundation Verification (CRITICAL - Do First) ⚡

1. ✅ Review and update rebuild plan (THIS TASK)
2. 🔄 **Run full test suite** to confirm baseline health:

   ```bash
   pnpm test
   ```

   - Expected: 300/300 tests passing across 44 files
   - If failures: Document which tests broke and why
   - Session archive pattern from Agent 7 as reference

3. 🔄 **Verify E2E integration tests** execute and pass:

   ```bash
   pnpm test tests/e2e/
   ```

   - `tulsbot-full-flow.test.ts` (main orchestration test)
   - `discord-integration.e2e.test.ts` (Discord channel)
   - `slack-integration.e2e.test.ts` (Slack channel)
   - `telegram-integration.e2e.test.ts` (UNTRACKED - decide git disposition)

4. 🔄 **Check A2UI bundle status**:
   ```bash
   ls -lh assets/a2ui/
   ```

   - Document if bundle exists and size
   - If missing: Determine if this blocks any functionality
   - Update Phase 1 status based on findings

#### Priority 2: NotebookLLM Script Fix (HIGH - Blocks Knowledge Workflow) 🔧

5. 🔄 **Re-apply lost fix** to `scripts/nlm-extract-tulsbot-knowledge.sh`:
   - **Problem**: Path resolution broke during repo reorganization
   - **Solution**: Check session archives for documented fix
   - **Test**: Run script manually to verify knowledge extraction works:
     ```bash
     ./scripts/nlm-extract-tulsbot-knowledge.sh
     ```
   - **Validation**: Check if `knowledge-slices/` files regenerate successfully

#### Priority 3: Git Hygiene & State Management (MEDIUM) 📦

6. 🔄 **Review and stage verified changes** (11 modified files):
   - Memory system improvements (`src/memory/hybrid.ts`, `namespace-isolation.test.ts`)
   - Test fixes (`src/acp/session.test.ts`, `extensions/lobster/src/lobster-tool.test.ts`)
   - Session enhancements (`src/acp/session.ts`)
   - Config updates (`src/config/zod-schema.agent-runtime.ts`)
   - Tulsbot integration (`src/agents/tulsbot/delegate-tool.ts`, `src/agents/memory-search.ts`)
   - Build config (`vitest.config.ts`)
   - Documentation (`README.md`)

7. 🔄 **Decide disposition of untracked files**:
   - ✅ `knowledge-slices/` (4 files, 66.7KB) → **COMMIT** (generated artifacts)
   - ✅ `REBUILD-PLAN.md` → **COMMIT** (critical planning doc)
   - ⚠️ `sessions/` (8 archives) → **KEEP UNTRACKED** or add to `.gitignore` (session history)
   - ❓ `tests/e2e/telegram-integration.e2e.test.ts` → **COMMIT IF VERIFIED** (untracked test)
   - ❓ `docs/gh-cli-setup.md` → **COMMIT** (setup documentation)

8. 🔄 **Create focused commit** (or multiple) with clear messages:

   ```bash
   git add <verified-files>
   git commit -m "test(core): fix memory system tests and subprocess lifecycle

   - Fix async/await in session tests
   - Add process.exit(0) to subprocess test fixtures
   - Update namespace isolation test assertions
   - Document subprocess lifecycle pattern in MEMORY.md

   All 300/300 tests now passing (Agent 7 verification)"
   ```

#### Priority 4: Phase 2 Preparation & Documentation (LOW) 📋

9. 🔄 **Audit config-driven memory search status**:
   - Read `src/acp/session.ts:52` to verify namespace config reading
   - Check if any additional config flexibility is needed
   - Document current implementation vs. Phase 2.2 requirements
   - Determine if "config-driven" is already complete or needs expansion

10. 🔄 **Create gh CLI auth setup checklist**:
    - Document required GitHub scopes for PR creation
    - Create `docs/gh-cli-setup.md` if not exists (or verify existing)
    - Test PR creation workflow manually (optional, low priority)
    - Prepare instructions for Agent 2 to implement automation

11. 🔄 **Update Phase 1 status** in this plan:
    - Change "85% COMPLETE" to actual percentage based on findings
    - Update task statuses (1.1 ✅, 1.2 ✅ or ⚠️, 1.3 ✅ or ❌)
    - Document any new blockers discovered

#### Success Criteria for Agent 1 ✅

Before handoff to Agent 2, verify:

- ✅ All core tests passing (300/300 maintained)
- ✅ E2E tests verified and status documented
- ✅ NotebookLLM script fix re-applied and tested
- ✅ A2UI bundle status known (exists or documented as not needed)
- ✅ Git working directory organized (staged vs untracked clear)
- ✅ Phase 1 completion percentage updated accurately
- ✅ Phase 2 prerequisites identified and documented

#### Handoff to Agent 2 📮

**What Agent 2 Should Focus On**:

1. **If Phase 1 at 100%**: Begin Phase 2 integration hardening
   - Expand config-driven flexibility if gaps found
   - Set up gh CLI authentication for automated PRs
   - Start multi-channel integration audit (Discord, Slack priority)

2. **If Phase 1 still incomplete**:
   - Address any remaining Phase 1 blockers discovered
   - Re-apply any additional lost fixes
   - Then proceed to Phase 2

**Known Handoff Context**:

- Config-driven memory search: Verify if `session.ts:52` implementation is sufficient
- Multi-channel testing: Discord, Slack, Telegram E2E tests exist - others need creation
- Brain sync automation: Already deployed (LaunchAgent running 3x/day)

### NEXT SESSION (Agent 2) - Integration Hardening

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
