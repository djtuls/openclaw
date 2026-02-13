# Chat Transcript: inbox-capture-starred-flagged

**Date:** 2026-02-12  
**Topic:** Inbox capture, starred/flagged emails → Super Inbox

## Summary

1. Ran inbox capture pipeline — executed successfully but all 4 Gmail accounts returned `Unauthorized` (expired/refresh tokens).
2. Implemented starred/flagged capture — user requested to add flagged, starred, and action-item emails to Tulio's Super Inbox database.
3. Built new pipeline: `fetchMessagesByQuery`, `runStarredFlaggedCapture`, script `run-starred-flagged-capture.ts`.

## Key Changes

### gmail-orchestrator.ts

- **fetchMessagesByQuery(account, query, maxResults)** — New export. Fetches messages by Gmail search query (e.g. `is:starred OR is:important`).

### inbox-capture-pipeline.ts

- **runStarredFlaggedCapture()** — New export. One-off capture of starred/important emails into Super Inbox.
- **processMessage(..., opts?: { forceInbox?: boolean })** — When `forceInbox: true`, skips Capture Inbox and classification; always routes to Super Inbox. Tags with `starred-flagged`.
- Dedup: skips messages already in Super Inbox (checks `source='gmail' AND source_id=message.id`).

### Script

- **scripts/run-starred-flagged-capture.ts** — Run: `npx tsx scripts/run-starred-flagged-capture.ts`

## Outcome

Implementation complete. Run returned 0 enabled Gmail accounts (accounts may be disabled due to prior auth errors). User must re-enable accounts and re-auth Gmail OAuth, then re-run the script.
