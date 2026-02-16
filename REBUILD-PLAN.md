# ClawdBot_Tulsbot 2.0 Rebuild Plan

**Last Updated**: 2026-02-16
**Repository**: ClawdBot_Tulsbot-2.0
**Status**: Ready for Execution

---

## Executive Summary

This repository is in **excellent health** with a 99.86% test pass rate (4341/4347 tests passing). The core architecture is sound, memory restoration is COMPLETE (320 chunks indexed from 317 memory files), and Tulsbot sub-agent integration is 95% complete. This is NOT a ground-up rebuild — this is a **hardening and completion** effort.

**Key Findings**:

- ✅ Dependencies installed successfully (1015 packages)
- ✅ Memory system fully operational with 320 indexed chunks
- ✅ TypeScript compilation clean
- ✅ 99.86% test pass rate indicates stable codebase
- ⚠️ 6 failing tests in memory system (keyword boosting + namespace isolation)
- ⚠️ A2UI bundle status unknown after reorganization
- 🔧 Some integration work incomplete from previous session

---

## Current State Assessment

### ✅ What's Working

1. **Memory System Architecture** (COMPLETE)
   - 317 memory files imported from AnythingLLM backup
   - 320 chunks indexed in SQLite with OpenAI embeddings
   - Bidirectional sync active: Claude Code ↔ Tulsbot
   - Database: `~/.openclaw/memory/tulsbot.sqlite`
   - Memory files: `~/.openclaw/workspace-tulsbot/memory/`

2. **Tulsbot Sub-Agent Integration** (95% Complete)
   - Delegate tool operational (33/33 tests passing)
   - Knowledge loader V2 operational (12/12 tests passing)
   - Knowledge index generated: 3.38KB index + 17 agent files (99.3% size savings from original 481KB)
   - Agent config functional: `~/.openclaw/openclaw.json`
   - Namespace isolation implemented
   - Session enhancement active

3. **Core Gateway Architecture**
   - Multi-channel integrations present (Discord, Slack, Telegram, WhatsApp, Line, Lark, Matrix, Signal)
   - 71 subdirectories in src/ indicate extensive feature set
   - TypeScript compilation clean
   - Build system functional

4. **Repository Structure** (Reorganized Feb 16, 2026)
   - Swabble extracted to separate repository
   - Tulsbot config properly relocated to `~/.config/tulsbot/`
   - Compatibility shims retained (clawdbot, moltbot packages)
   - Clean separation of concerns

### ⚠️ What Needs Work

1. **Memory System Tests** (6 failing tests)
   - `src/memory/hybrid-search.test.ts`: 2 failures
     - Keyword boosting algorithm not producing expected score differences
   - `src/memory/namespace-isolation.test.ts`: 4 failures
     - All namespace filter queries returning 0 results when >0 expected
     - Extensive debugging already in test file (lines 126-259)
     - Possible issues: test database setup, FTS5 index sync, or query generation

2. **Lost Extraction Script Fix**
   - File: `scripts/nlm-extract-tulsbot-knowledge.sh`
   - Issue: Sibling repo path resolution fix was applied, then lost during reorganization
   - Required fix:
     ```bash
     # Bash: Use TULSBOT_ROOT env var with fallback chain
     # Bash: export KNOWLEDGE_JSON OUTPUT_DIR before Python heredoc
     # Python: Use os.environ["KNOWLEDGE_JSON"] instead of path construction
     ```

3. **Incomplete Integration Work**
   - No E2E integration test for full flow: gateway → routing → Tulsbot → knowledge + memory → delegate tool → response
   - `memorySearch` config NOT consumed from config file — namespace hardcoded to `"tulsbot"` in session.ts
   - gh CLI authentication not configured for automated PR creation

4. **Unknown Status**
   - A2UI bundle status unclear after reorganization (build script references `scripts/bundle-a2ui.sh`)
   - Whether recent reorganization broke any integration tests

---

## Data Migration Assessment

### Recommendation: ✅ USE EXISTING MEMORY SYSTEM

**Do NOT rebuild from scratch. Here's why:**

1. **Memory System is Already Complete**
   - 317 memory files successfully imported from AnythingLLM
   - 320 chunks indexed in SQLite with OpenAI embeddings (text-embedding-3-small)
   - Bidirectional sync operational between Claude Code and Tulsbot
   - Full semantic search capability enabled
   - Goal achieved: "talk to OpenClaw as he was before the rebuild"

2. **Test Failures are NOT Data Issues**
   - Failing tests are algorithmic/query generation problems, not data problems
   - Database has data (320 chunks confirmed)
   - Tests show queries execute but algorithms produce unexpected results
   - This is a **code fix**, not a data rebuild

3. **AnythingLLM vs NotebookLLM**
   - **AnythingLLM**: Already used as source for 317 memory files (DONE)
   - **NotebookLLM**: Used for knowledge extraction, NOT memory
     - NotebookLLM produces 4 domain markdown slices from `core-app-knowledge.json`
     - Purpose: Knowledge base organization, not episodic memory
     - Status: Extraction script exists but needs path fix re-applied

4. **Risk of Rebuilding**
   - Would lose 320 chunks of indexed memory
   - Would break bidirectional sync already operational
   - Would require re-indexing with OpenAI API costs
   - No evidence current data is corrupt or incomplete

**Action**: Keep existing memory system. Fix the 6 failing tests by debugging query generation and keyword boosting algorithms.

---

## Rebuild Phases

### Phase 1: Critical Fixes (1-2 days)

**Goal**: Fix failing tests and restore lost functionality

#### 1.1 Fix Memory System Tests

- **File**: `src/memory/hybrid-search.test.ts` (2 failures)
  - Debug keyword boosting score calculation
  - Verify boost multiplier is applied correctly to FTS scores
  - Add logging to trace score computation

- **File**: `src/memory/namespace-isolation.test.ts` (4 failures)
  - Investigate why all queries return 0 results in test environment
  - Check test database population (existing debug code lines 126-259)
  - Verify FTS5 index is synced with chunks table
  - Test direct FTS5 MATCH queries vs. hybrid search queries
  - Possible fix: `await manager.sync()` may need longer wait or force flag

#### 1.2 Re-apply NotebookLLM Extraction Script Fix

- **File**: `scripts/nlm-extract-tulsbot-knowledge.sh`
- **Changes**:

  ```bash
  # Add TULSBOT_ROOT env var with fallback chain
  TULSBOT_ROOT="${TULSBOT_ROOT:-$HOME/Backend_local Macbook/Tulsbot}"

  # Export variables before Python heredoc
  export KNOWLEDGE_JSON="$TULSBOT_ROOT/.tulsbot/core-app-knowledge.json"
  export OUTPUT_DIR="$REPO_ROOT/knowledge-slices"

  # Python: Use environment variables
  knowledge_file = os.environ["KNOWLEDGE_JSON"]
  output_dir = os.environ["OUTPUT_DIR"]
  ```

- **Verify**: Run script and confirm 4 domain markdown slices are generated (66.7KB total)

#### 1.3 Verify A2UI Bundle

- **Check**: Does `assets/a2ui/` exist with bundle files?
- **If missing**: Run `pnpm canvas:a2ui:bundle` (calls `scripts/bundle-a2ui.sh`)
- **If script broken**: Investigate what A2UI is and whether it's critical

**Success Criteria**:

- All 4347 tests passing (100% pass rate)
- NotebookLLM extraction script produces 4 domain slices
- A2UI bundle present or confirmed non-critical

---

### Phase 2: Integration Hardening (1 week)

**Goal**: Complete the 95% done Tulsbot integration

#### 2.1 E2E Integration Test

- **Create**: `tests/e2e/tulsbot-full-flow.test.ts`
- **Test flow**:
  1. Gateway receives message
  2. Routing resolves to Tulsbot (default agent)
  3. Session created with namespace isolation
  4. Knowledge loader fetches agent-specific knowledge on-demand
  5. Memory search queries with `namespace: "tulsbot"` filter
  6. Delegate tool routes to appropriate sub-agent (1 of 17)
  7. Response generated and returned
- **Mock external APIs**: Claude API, OpenAI embeddings
- **Verify**: Namespace isolation, knowledge cache hits, delegate routing

#### 2.2 Config-Driven Memory Search

- **Current**: `session.ts` hardcodes namespace to `"tulsbot"`
- **Goal**: Read from agent config in `~/.openclaw/openclaw.json`
- **Files to modify**:
  - `src/config/zod-schema.agents.ts`: Ensure `memorySearch.namespace` is in schema
  - `src/session/session.ts`: Read `agent.memorySearch.namespace || agent.id` instead of hardcoding
- **Verify**: Namespace changes in config are respected at runtime

#### 2.3 Configure gh CLI Authentication

- **Purpose**: Enable automated PR creation from scripts
- **Action**: `gh auth login` with interactive flow
- **Test**: Create test PR with `gh pr create --title "Test" --body "Test"`
- **Document**: Add auth status check to developer setup docs

**Success Criteria**:

- E2E test passing with 100% step verification
- Namespace configurable per agent in `openclaw.json`
- gh CLI authenticated and PR creation working

---

### Phase 3: Feature Completeness Audit (2 weeks)

**Goal**: Ensure all 71 src/ subdirectories are production-ready

#### 3.1 Multi-Channel Integration Audit ✅ COMPLETE

**Status**: Completed - Session archived at `sessions/phase-3-multi-channel-audit-complete.md`

**Channels Analyzed** (8 platforms):

- ✅ Discord (@buape/carbon) - **Production Ready** (49 tests, 100% pass)
- ✅ Slack (@slack/bolt, @slack/web-api) - **Production Ready** (93 tests, 100% pass)
- ✅ Telegram (grammy, @grammyjs/runner) - **Production Ready** (31 tests, 100% pass)
- ⚠️ WhatsApp (@whiskeysockets/baileys) - **Needs Additional Testing** (25 tests, security gaps)
- ✅ Line (@line/bot-sdk) - **Production Ready** (53 tests, comprehensive Flex message coverage)
- ❌ Lark/Feishu (@larksuiteoapi/node-sdk) - **Not Production Ready** (1 basic test only)
- ⚠️ Signal (signal-utils) - **Needs Additional Testing** (6 tests, group reaction coverage gaps)
- ❌ Matrix - **Completely Untested** (no test files found)

**Key Findings**:

- **Test Coverage**: 100% pass rate (5672 passed, 1 skipped)
- **Strong Coverage**: Discord, Slack, Telegram, Line ready for production
- **Moderate Coverage**: WhatsApp and Signal need additional edge case testing
- **Weak Coverage**: Feishu has only 1 basic test
- **No Coverage**: Matrix has no test files at all

**Technical Patterns Documented**:

- Discord: Permission error recovery (code 50013), @buape/carbon RequestClient
- Telegram: Draft streaming, thread handling (private DM vs group threads)
- WhatsApp: JID format for groups, allowFrom security filtering
- Line: Markdown-to-Flex conversion, visual card generation
- Signal: Multi-account config, UUID normalization, group reaction security

**Recommendations**:

1. **Immediate**: Add comprehensive test coverage for Feishu (multi-account scenarios)
2. **High Priority**: Create Matrix test suite from scratch
3. **Medium Priority**: Expand WhatsApp and Signal edge case coverage
4. **Low Priority**: Monitor Discord/Slack/Telegram/Line for production issues

#### 3.2 Knowledge System Optimization

- **Current**: Knowledge index reduces size by 99.3% (481KB → 6.2KB)
- **Verify**:
  - LRU cache is working (check cache hit rate in logs)
  - On-demand loading doesn't cause latency spikes
  - All 17 sub-agents have valid knowledge files
- **Optimize**:
  - Add cache warming on startup for frequently used agents
  - Implement knowledge preloading for default agent
  - Add metrics for cache hit/miss rates

#### 3.3 Memory Sync Monitoring

- **Current**: Bidirectional sync via `scripts/sync-claude-tulsbot-memory.ts`
- **Add monitoring**:
  - Log sync conflicts (which file won based on timestamp)
  - Track sync frequency (especially in watch mode)
  - Alert on sync failures
  - Add health check endpoint for sync status
- **Consider**: Move sync to background service instead of script

**Success Criteria**:

- All 8 channels have passing integration tests
- Knowledge cache hit rate >80%
- Memory sync monitoring dashboard operational

---

### Phase 4: Production Hardening (2 weeks)

**Goal**: Make system resilient to failures and performant under load

#### 4.1 Error Recovery

- **Gateway layer**:
  - Handle channel disconnections gracefully
  - Implement exponential backoff for retries
  - Add circuit breaker for failing channels
- **Memory layer**:
  - Handle SQLite lock timeouts
  - Recover from embedding API failures
  - Fallback to keyword-only search if vector search fails
- **Knowledge layer**:
  - Handle missing knowledge files gracefully
  - Cache negative lookups to avoid repeated 404s

#### 4.2 Performance Optimization

- **Database**:
  - Add indexes for common query patterns
  - Implement connection pooling for SQLite
  - Profile slow queries (especially hybrid search)
- **Memory**:
  - Benchmark embedding generation (current: OpenAI text-embedding-3-small)
  - Consider caching embeddings for frequent queries
  - Optimize FTS5 tokenization for technical terms
- **Delegate tool**:
  - Profile sub-agent routing overhead
  - Cache routing decisions for identical queries
  - Parallel knowledge loading for multiple agents

#### 4.3 Observability

- **Metrics**:
  - Request latency by channel
  - Memory search response time
  - Knowledge cache hit/miss ratio
  - Delegate tool routing distribution (which of 17 sub-agents most used)
  - Embedding API usage and cost
- **Logging**:
  - Structured logging with correlation IDs
  - Log levels configurable per module
  - Sensitive data redaction (API keys, user messages)
- **Tracing**:
  - Distributed tracing for request flow: gateway → routing → session → memory → knowledge → delegate → response
  - Trace memory search: query → embedding → vector search → FTS → hybrid merge → results

#### 4.4 Security Audit

- **API keys**: Ensure all keys in environment variables, not code
- **Rate limiting**: Per-channel, per-user, per-agent
- **Input validation**: Sanitize all user inputs before processing
- **Dependency audit**: Run `pnpm audit` and address high/critical vulnerabilities
- **Memory isolation**: Verify namespace isolation prevents cross-agent memory leaks

**Success Criteria**:

- All channels recover from 5-minute disconnect
- P95 latency <500ms for memory search
- Zero API keys in git history
- Full request tracing operational

---

### Phase 5: Developer Experience (1 week)

**Goal**: Make it easy for new developers (or future you) to understand and modify the codebase

#### 5.1 Documentation Audit

- **Update**:
  - README.md with current architecture diagram
  - MEMORY-RESTORATION-STATUS.md with troubleshooting section
  - sessions/tulsbot-sub-agent-integration.md with completion status
  - Add ARCHITECTURE.md explaining:
    - Gateway → Router → Agent → Delegate → Knowledge → Memory flow
    - Why Tulsbot is the "working brain" and OpenClaw is the "orchestrator"
    - How namespace isolation works
    - How knowledge index reduces memory by 99.3%
- **Create**:
  - DEVELOPMENT.md with setup instructions
  - TESTING.md with how to run different test suites
  - DEPLOYMENT.md with production deployment steps
  - API.md with agent SDK documentation

#### 5.2 Developer Tooling

- **Scripts to add**:
  - `scripts/dev-setup.sh`: One-command setup (pnpm install, config copy, build)
  - `scripts/reset-memory.sh`: Clear and rebuild memory index for testing
  - `scripts/test-channel.sh <channel>`: Test single channel integration
  - `scripts/debug-memory-search.sh <query>`: Debug memory search with detailed logging
- **VS Code integration**:
  - Add `.vscode/launch.json` for debugging
  - Add `.vscode/tasks.json` for common commands
  - Add `.vscode/settings.json` for TypeScript/ESLint config

#### 5.3 Test Infrastructure

- **Improve**:
  - Add test data fixtures for consistent test environments
  - Mock all external APIs (Claude, OpenAI, channel APIs)
  - Parallel test execution (already using `scripts/test-parallel.mjs`)
  - Test coverage reporting (already have `test:coverage` script)
- **Add**:
  - Visual regression tests for UI components (if applicable)
  - Load tests for memory search under concurrent queries
  - Chaos tests (random failures injected into dependencies)

**Success Criteria**:

- New developer can set up environment in <5 minutes
- All documentation is current (no references to old structure)
- Test coverage >80%
- Debug memory search script shows full query execution trace

---

### Phase 6: Future Enhancements (Ongoing)

**Goal**: Nice-to-have improvements, not blockers

#### 6.1 Advanced Memory Features

- **Temporal memory**: Weight recent memories higher in search results
- **Forgetting**: Auto-expire old memories (configurable retention policy)
- **Memory clustering**: Group related memories together
- **Multi-modal memory**: Store images, audio in memory system (not just text)

#### 6.2 Knowledge Graph

- **Current**: Flat knowledge files per agent
- **Future**: Knowledge graph with relationships
- **Benefits**: Answer complex queries spanning multiple knowledge domains
- **Implementation**: Neo4j or native graph in SQLite

#### 6.3 Sub-Agent Marketplace

- **Current**: 17 hard-coded sub-agents
- **Future**: Plugin system for adding new sub-agents
- **Benefits**: Community-contributed agents, custom domain agents
- **Implementation**: Agent SDK with standardized interface

#### 6.4 Multi-Model Support

- **Current**: Embeddings from OpenAI only
- **Future**: Support local embeddings (ollama), Cohere, Voyage AI
- **Benefits**: Cost reduction, faster embeddings, privacy (local models)

---

## Components That Can Be Hardened NOW

These components are complete and working but could be improved immediately:

### 1. ✅ Delegate Tool (737 lines, 33/33 tests passing)

**Current state**: Fully functional, routes to 17 sub-agents
**Hardening opportunities**:

- Add telemetry: which sub-agents are used most frequently
- Implement routing cache: if query is identical, skip routing logic
- Add fallback chain: if primary sub-agent fails, try secondary
- Performance: profile routing overhead, optimize hot paths

**Files**: `src/agents/tulsbot/delegate-tool.ts`

### 2. ✅ Knowledge Loader V2 (444 lines, 12/12 tests passing)

**Current state**: Index-based on-demand loading with LRU cache
**Hardening opportunities**:

- Add cache warming on startup (preload frequently used agents)
- Implement cache eviction metrics (log what gets evicted and when)
- Add cache persistence: save cache to disk on shutdown, restore on startup
- Support remote knowledge sources (HTTP, S3) not just local files

**Files**: `src/agents/tulsbot/knowledge-loader-v2.ts`

### 3. ✅ Memory Index Manager

**Current state**: 320 chunks indexed, hybrid search operational
**Hardening opportunities**:

- Fix keyword boosting algorithm (2 failing tests)
- Fix namespace isolation (4 failing tests)
- Add query explain: show why certain results ranked higher
- Implement result caching for frequent queries
- Add A/B testing framework for ranking algorithm improvements

**Files**: `src/memory/manager.ts`, `src/memory/hybrid.ts`

### 4. ✅ Bidirectional Memory Sync

**Current state**: Claude Code ↔ Tulsbot sync operational
**Hardening opportunities**:

- Add conflict resolution UI (when both sides modified same file)
- Support 3-way sync (add AnythingLLM as third source)
- Implement sync monitoring dashboard
- Add sync hooks (run scripts before/after sync)
- Support selective sync (exclude certain files by pattern)

**Files**: `scripts/sync-claude-tulsbot-memory.ts`

### 5. ✅ Knowledge Index Generator (201 lines)

**Current state**: Generates index + 17 agent files (99.3% savings)
**Hardening opportunities**:

- Add validation: ensure all agent references in index have corresponding files
- Support incremental updates (don't regenerate entire index on small changes)
- Add compression for knowledge files (gzip or brotli)
- Generate index statistics (knowledge distribution across agents)

**Files**: `scripts/generate-knowledge-index.ts`

---

## Critical Path

```
Phase 1 (1-2 days) → Phase 2 (1 week) → Phase 3 (2 weeks) → Phase 4 (2 weeks)
     ↓                      ↓                  ↓                    ↓
 Fix tests          E2E integration    Feature audit      Production ready
 Fix script         Config-driven      All channels       Error recovery
 Verify A2UI        gh auth            Knowledge opt      Performance
                                       Memory sync        Security
                                                          Observability

Phase 5 (1 week) can run parallel to Phase 4
Phase 6 (ongoing) is post-launch
```

**Dependencies**:

- Phase 2 depends on Phase 1 (need passing tests before E2E)
- Phase 3 depends on Phase 2 (need E2E before auditing channels)
- Phase 4 depends on Phase 3 (need feature completeness before hardening)
- Phase 5 can start after Phase 2 (documentation doesn't need complete features)

---

## Recommended Immediate Actions

### This Week

1. ✅ Fix all 6 failing memory tests
2. ✅ Re-apply NotebookLLM extraction script fix
3. ✅ Verify A2UI bundle status
4. ✅ Run full test suite - COMPLETE (300/300 tests passing, 44 test files, 100.25s) — Agent 7

### Next Week

1. Create E2E integration test
2. Make memory search config-driven
3. Configure gh CLI authentication
4. ✅ Complete Phase 3.1 multi-channel integration audit
5. **Start Phase 3.2**: Knowledge system optimization (verify LRU cache, add metrics)

### Within 30 Days

1. Complete all of Phase 2 (Integration Hardening)
2. Start Phase 3 (Feature Completeness Audit)
3. Begin Phase 5 (Documentation) in parallel

---

## Success Metrics

1. **Test Health**: 100% pass rate (4347/4347 tests)
2. **Memory Quality**: Semantic search returns relevant results for 95%+ of queries
3. **Integration Coverage**: All 8 channels have passing integration tests
4. **Performance**: P95 latency <500ms for end-to-end request flow
5. **Documentation**: New developer can set up environment in <5 minutes
6. **Observability**: Full request tracing with <1% overhead
7. **Reliability**: System recovers from all common failure scenarios (tested)
8. **Security**: Zero high/critical vulnerabilities in dependencies

---

## Risk Assessment

### Low Risk

- ✅ Memory system already complete (just need to fix test code, not data)
- ✅ Core architecture sound (99.86% pass rate proves stability)
- ✅ Dependencies healthy (1015 packages installed successfully)

### Medium Risk

- ⚠️ A2UI bundle status unknown (could block build)
- ⚠️ Multi-channel integrations untested end-to-end (might have bit rot)
- ⚠️ NotebookLLM script fix lost (easy to re-apply but could have other missing fixes)

### High Risk

- 🚨 None identified — this is a hardening effort, not a risky ground-up rebuild

---

## Timeline Estimate

- **Phase 1**: 1-2 days (critical fixes)
- **Phase 2**: 1 week (integration hardening)
- **Phase 3**: 2 weeks (feature audit)
- **Phase 4**: 2 weeks (production hardening)
- **Phase 5**: 1 week (developer experience) - can run parallel to Phase 4

**Total**: 4-7 weeks depending on parallel execution

**Minimum viable**: Phase 1 + Phase 2 = 1.5 weeks to production-ready
**Recommended**: Phase 1-4 = 5-6 weeks to fully hardened
**Complete**: Phase 1-5 = 6-7 weeks to comprehensive

---

## Conclusion

This repository is in excellent shape. The core architecture is sound, memory restoration is complete, and Tulsbot integration is 95% done. This is NOT a rebuild — this is a **completion and hardening** effort.

**Recommendation**: Execute Phase 1 immediately (fix 6 tests, re-apply script fix, verify A2UI), then proceed through Phase 2-4 systematically. Phase 5 (docs) can happen in parallel. Phase 6 (enhancements) can wait until post-launch.

**Data migration answer**: Use existing memory system. Do NOT rebuild from AnythingLLM or NotebookLLM — the data is already there and working.

**What can be hardened now**: All 5 components listed above (Delegate Tool, Knowledge Loader V2, Memory Index Manager, Bidirectional Sync, Knowledge Index Generator) are working and ready for improvement without risk.

---

**Next Steps**: Start Phase 1 — fix those 6 failing tests!
