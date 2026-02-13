# Chat Transcript: consolidated-todo-fetch-notion

**Date:** 2026-02-12  
**Topic:** Consolidated todo list from Notion, master todo, OpenClaw + fetch-notion-todos script

## Summary

1. **Consolidated todo list** — Gathered todos from Notion (Tasks DB, Projects & Features DB), Tulsbot master todo (todo.md), and OpenClaw codebase TODOs.
2. **Notion fetch script** — Created `Tulsbot/services/context-manager/scripts/fetch-notion-todos.ts` to fetch active tasks and projects via Notion API.
3. **Archive** — User requested archive; full handoff completed.

## Key Changes

### New Script
- **scripts/fetch-notion-todos.ts** — Fetches from Tasks DB (`30051bf9731e804c92b1c8ae7b76ee0f`) and Projects & Features DB (`dd20f12b1a9f459e9e7338f818b37a45`).
- Run: `cd Tulsbot/services/context-manager && npm run fetch-notion-todos`
- Requires `NOTION_API_KEY` (or .env). Databases must be shared with the integration.

### Consolidated Todo Sources
- **Notion:** Tasks DB, Projects & Features DB
- **Tulsbot:** todo.md (next steps: restart context-manager, verify Gemini in UI)
- **OpenClaw:** Code TODOs in todo-aggregator, agent-pages, autonomous-executor, etc.

## Outcome

Script in place. Notion API returned `object_not_found` — user must share Tasks and Projects databases with their Notion integration for live fetch.
