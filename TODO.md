# OpenClaw Project TODO

## Current Sprint

### 🔴 High Priority

- [x] **Tulsbot Delegate Tool**: Implement agent-specific logic for all 17 sub-agents in `src/agents/tulsbot/delegate-tool.ts` (line 172) - COMPLETE (lines 277-550+)
- [x] **Tulsbot Intent Analysis**: Add memory search integration to find similar queries in `analyzeIntent()` function (line 85) - COMPLETE (lines 109-159)

### 🟡 Medium Priority

- [ ] **Import Conversations**: Optional feature to import AnythingLLM conversations in `scripts/import-anythingllm-backup.ts` (line 211)
- [ ] **Tulsbot Tests**: Add test coverage for delegate-tool.ts (untracked file: `delegate-tool.test.ts`)

### 🟢 Low Priority

- [ ] **Documentation**: Review Mintlify skill documentation practices (mark uncertainties with TODO comments per `.agents/skills/mintlify/SKILL.md`)

## Backlog

### Features

- [ ] **Knowledge Extraction**: Expand NotebookLM integration for additional agent knowledge bases
- [ ] **Bidirectional Sync**: Implement AnythingLLM bidirectional sync watching mode
- [ ] **Agent Routing**: Enhance intent classification with ML-based routing beyond keyword matching

### Bug Fixes

- [ ] **Voice Call**: Verify recent fix for voice-call hang-up bug (commit a706e48dd)
- [ ] **Nostr Pipeline**: Test Nostr inbound dispatch pipeline stability (commit a706e48dd)

### Technical Debt

- [ ] **Tulsbot Submodule**: Clean up broken Tulsbot submodule references (noted in commit 9dc5811a1)
- [ ] **Workspace Artifacts**: Ensure vendor/ and workspace files remain untracked (commits 471a94bf5, 0d24edc27)
- [ ] **Type Safety**: Add @sinclair/typebox validation to all agent tool parameters

### Documentation

- [ ] **NotebookLM Workflow**: Document query-before-crawl workflow in agent integration guide
- [ ] **Knowledge Loader**: Add usage examples for `findAgentByName()` and `listAgentNames()` utilities
- [ ] **PR Workflow**: Sync PR_WORKFLOW.md with latest prepare-pr/review-pr/merge-pr skills

## Completed ✓

<!-- Move completed tasks here with date -->

- [x] Memory Reindex Script: Fixed undefined dbPath with nullish coalescing fallback - 2026-02-15
- [x] NotebookLM knowledge extraction script - 2026-02-15 (commit 531689997)
- [x] Tulsbot knowledge loader module implementation - 2026-02-15 (commit bcecddf79)
- [x] Tulsbot agent framework and NotebookLM skill setup - 2026-02-15 (commit 72d4d20e2)
- [x] NotebookLM integration scaffolding - 2026-02-15 (commit 4542f20b0)

---

_Last updated: 2026-02-15_
