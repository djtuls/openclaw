# Chat Transcript — Tulsbot Memory Declutter & Purge

**Date:** 2026-02-11  
**Topic:** Tulsbot memory declutter, consolidation, and adaptive purge strategy

---

## Summary

1. **Memory declutter Phase 0** — Consolidated memory sources into `.tulsbot-consolidated/`, dedup by content hash. Script: `consolidate-memory.ts`. Docs: `docs/MEMORY_CANONICAL_LAYOUT.md`.

2. **Memory purge implementation** — Adaptive pruning for T1 brain nodes: relevance scoring (recency + confidence + type + size), keep top 50, summarize mid-tier, archive+delete low-relevance. Human approval required.
   - Migration: `047-memory-audit.sql`
   - Service: `memory-purge-service.ts`
   - Script: `scripts/purge-memory.ts`
   - API: `POST /api/memory-tiers/purge-plan`, `POST /api/memory-tiers/purge`
   - Web UI: Brain → Purge tab

3. **Repo indexing** — `CODEBASE_INDEX.md` added for navigation.

---

## Key Files Changed

| Path | Change |
|------|--------|
| `Tulsbot/services/context-manager/src/db/migrations/047-memory-audit.sql` | New: memory_audit table |
| `Tulsbot/services/context-manager/src/services/memory-purge-service.ts` | New: purge logic |
| `Tulsbot/services/context-manager/scripts/purge-memory.ts` | New: CLI script |
| `Tulsbot/services/context-manager/src/routes/memory-tiers.ts` | Added purge-plan, purge routes |
| `Tulsbot/services/web-ui/src/components/BrainView.tsx` | Added Purge tab |
| `Tulsbot/services/web-ui/src/lib/api.ts` | Added getPurgePlan, executePurge |
| `Tulsbot/tulsbot.md` | Changelog entries |
| `Tulsbot/.gitignore` | .tulsbot-consolidated/ |

---

## Commands

- `npm run consolidate:memory` — consolidate + dedupe
- `npm run purge:memory` — generate purge plan
- `npx tsx scripts/purge-memory.ts --execute <auditId>` — execute approved purge
