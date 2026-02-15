# Cloud Memory Sync - Phase 3: Bidirectional Sync

## Overview

Phase 3 extends the cloud memory sync system with **full bidirectional synchronization** and **offline resilience**. Your OpenClaw memory now syncs seamlessly in both directions:

- **Local → Cloud**: Push local memory to AnythingLLM and NotebookLLM
- **Cloud → Local**: Pull new memory from NotebookLLM back to local storage
- **Offline Queue**: Automatically queue sync operations when offline, sync when reconnected
- **Unified Search**: Search across both local and cloud memory in one command

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Local Memory                          │
│         ~/.openclaw/workspace/memory/*.md               │
└────────────┬───────────────────────┬────────────────────┘
             │                       │
             ↓                       ↓
    ┌────────────────┐      ┌───────────────────┐
    │  AnythingLLM   │      │   NotebookLLM     │
    │  (Local RAG)   │      │   (Cloud RAG)     │
    │                │      │                   │
    │  File-based    │      │  Queryable via    │
    │  sync to brain │      │  nlm CLI          │
    └────────────────┘      └───────────────────┘
             ↑                       ↑
             │                       │
             └───────────┬───────────┘
                         │
                  ┌──────┴──────┐
                  │  Sync Queue  │
                  │   (SQLite)   │
                  │              │
                  │  Offline     │
                  │  Resilience  │
                  └──────────────┘
```

## Key Features

### 1. Bidirectional Sync

**Local → Cloud** (as before):

- Syncs memory files to AnythingLLM brain
- Uploads to NotebookLLM for online queries
- Hash-based change detection (no duplicate uploads)

**Cloud → Local** (NEW):

- Lists sources from NotebookLLM
- Downloads missing sources to local memory
- Timestamp-based conflict resolution
- Preserves local changes (newest-wins strategy)

### 2. Offline Queue System

When NotebookLLM is unavailable (offline, network issues):

- **Automatic queueing**: Failed syncs are stored in SQLite database
- **Status tracking**: Each queued item has status (pending/synced/failed)
- **Retry mechanism**: Queued items are retried on next sync
- **Error handling**: Failed items are tracked with error messages

SQLite Schema:

```sql
CREATE TABLE sync_queue (
  id INTEGER PRIMARY KEY,
  file_hash TEXT NOT NULL,           -- Content hash for deduplication
  file_name TEXT NOT NULL,           -- Original filename
  operation TEXT NOT NULL,           -- 'add', 'update', 'delete'
  destination TEXT NOT NULL,         -- 'notebooklm', 'local', 'anythingllm'
  status TEXT NOT NULL DEFAULT 'pending',  -- 'pending', 'synced', 'failed'
  retries INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  synced_at TEXT,
  error_message TEXT
);
```

### 3. Reconnection Logic

When coming back online:

1. **Process queue first**: Sync all pending operations from offline queue
2. **Bidirectional sync**: Run full sync in both directions
3. **Conflict resolution**: Newest-wins strategy based on timestamps
4. **Status reporting**: Shows processed/failed counts

### 4. Unified Search

Search across **both** local and cloud memory:

```bash
npm run sync-memory-search "authentication patterns"
```

Results show:

- **Local matches**: Files in `~/.openclaw/workspace/memory/`
- **Cloud results**: NotebookLLM Gemini-powered search results

## Installation

### 1. Install Dependencies

```bash
pnpm install
```

This adds `better-sqlite3` for the offline queue database.

### 2. Configure NotebookLLM

Set your NotebookLLM notebook ID:

```bash
export TULSBOT_NOTEBOOK_ID="your-notebook-id-here"
```

Add to your shell profile (`~/.zshrc` or `~/.bashrc`):

```bash
echo 'export TULSBOT_NOTEBOOK_ID="your-notebook-id"' >> ~/.zshrc
source ~/.zshrc
```

### 3. Authenticate with NotebookLLM

```bash
nlm login
```

## Usage

### One-Shot Bidirectional Sync

Run a complete bidirectional sync once:

```bash
npm run sync-memory-bidirectional
```

Output:

```
🔄 Starting bidirectional sync...

🔄 Processing 3 queued operations...
   ✅ Synced queued item: feature-ideas.md
   ✅ Synced queued item: bug-fixes.md
   ✗ Failed queued item: archived-note.md
   Processed 2 queued items, 1 failed

⬆️  Local → Cloud:
   Synced 15 files

⬇️  Cloud → Local:
   Pulled 3 new files, skipped 12 existing

✅ Sync complete
```

### Watch Mode (Continuous Sync)

Keep sync running continuously:

```bash
npm run sync-memory-bidirectional:watch
```

Features:

- **Local changes**: Synced immediately when files change
- **Cloud polling**: Checks for cloud updates every 5 minutes
- **Queue processing**: Retries pending operations on each check
- **Press Ctrl+C to stop**

### Unified Search

Search across local + cloud:

```bash
npm run sync-memory-search "API design patterns"
```

Output:

```
🔍 Searching for: "API design patterns"

📁 Local results:
  • api-conventions.md
  • rest-best-practices.md

☁️  Cloud results:
API design patterns are documented in three sources:

1. REST API Design Guide (source: api-conventions.md)
   - Use nouns for resources, not verbs
   - Consistent naming: plural for collections
   - HTTP methods: GET, POST, PUT, DELETE

2. GraphQL Patterns (source: graphql-learnings.md)
   - Schema-first design
   - Resolver composition
   ...
```

## Sync Behavior

### Change Detection

**Hash-based (AnythingLLM)**:

- MD5 hash of content determines if file changed
- Only syncs if content differs
- Avoids duplicate writes

**Timestamp-based (NotebookLLM)**:

- Compares local file `mtime` vs cloud source `createTime`
- Newest version wins
- Prevents overwriting newer changes

### Conflict Resolution Strategy

**Newest-wins**:

- If local file is newer → sync to cloud
- If cloud source is newer → pull to local
- If timestamps equal → skip (no change)

**No merge conflicts**:

- Memory files are independent documents
- No line-by-line merging needed
- Each file syncs as atomic unit

### Offline Behavior

**When NotebookLLM is unreachable**:

1. Local → AnythingLLM continues (file-based, always works)
2. Local → NotebookLLM operations are queued
3. User sees: `📴 Offline: queued feature-ideas.md for sync`
4. Next sync processes queue automatically

**Queue persistence**:

- SQLite database at `.sync-state.db`
- Survives process restarts
- Manual cleanup: `rm .sync-state.db` (resets queue)

## File Organization

### Local Memory

```
~/.openclaw/workspace/memory/
├── authentication-patterns.md
├── api-conventions.md
├── bug-fix-2024-01-15.md
└── feature-ideas.md
```

### AnythingLLM Brain

```
anythingllm-sync-output/brain/
├── cc-sync-a1b2c3d4e5f67890.md
├── cc-sync-f0e9d8c7b6a59483.md
└── ...
```

Hash-stable filenames prevent duplicates.

### NotebookLLM Sources

Sources uploaded with original filenames:

- `authentication-patterns.md`
- `api-conventions.md`
- etc.

Queryable via:

```bash
nlm query notebook <notebook-id> "your question"
```

## Comparison: Phase 1 vs Phase 3

| Feature                 | Phase 1 (Original) | Phase 3 (Bidirectional) |
| ----------------------- | ------------------ | ----------------------- |
| **Local → Cloud**       | ✅ Yes             | ✅ Yes                  |
| **Cloud → Local**       | ❌ No              | ✅ Yes                  |
| **Offline queue**       | ❌ No              | ✅ SQLite queue         |
| **Reconnection**        | ❌ Manual retry    | ✅ Automatic            |
| **Search**              | Separate tools     | ✅ Unified search       |
| **Conflict resolution** | N/A                | ✅ Timestamp-based      |
| **Change detection**    | Hash only          | ✅ Hash + timestamps    |

## Advanced Usage

### Manual Queue Inspection

SQLite database location: `.sync-state.db`

```bash
sqlite3 .sync-state.db
```

```sql
-- View pending operations
SELECT * FROM sync_queue WHERE status = 'pending';

-- View failed operations
SELECT * FROM sync_queue WHERE status = 'failed';

-- Count by status
SELECT status, COUNT(*) FROM sync_queue GROUP BY status;

-- Clear all failed items
DELETE FROM sync_queue WHERE status = 'failed';
```

### Custom Sync Intervals (Watch Mode)

Modify polling interval in `sync-memory-cloud-bidirectional.ts`:

```typescript
// Check for cloud updates every 5 minutes (default)
setInterval(
  async () => {
    // ...
  },
  5 * 60 * 1000,
); // Change this: 5 minutes = 5 * 60 * 1000 ms
```

Options:

- `1 * 60 * 1000` = 1 minute (high frequency, more API calls)
- `10 * 60 * 1000` = 10 minutes (low frequency, fewer API calls)
- `30 * 60 * 1000` = 30 minutes (very low frequency)

### Debugging

Enable verbose output:

```bash
DEBUG=* npm run sync-memory-bidirectional
```

Check sync state:

```bash
sqlite3 .sync-state.db "SELECT * FROM sync_queue ORDER BY created_at DESC LIMIT 10"
```

## Troubleshooting

### Issue: "not authenticated" error

**Solution**: Re-authenticate with NotebookLLM

```bash
nlm login
```

### Issue: Queue items stuck in "pending"

**Cause**: Persistent network issues or invalid files

**Solution**: Check failed items and clear queue

```bash
sqlite3 .sync-state.db
sqlite> SELECT * FROM sync_queue WHERE status = 'failed';
sqlite> DELETE FROM sync_queue WHERE status = 'failed';
```

### Issue: Duplicate files in cloud

**Cause**: Content hash changed (file was edited)

**Solution**: This is expected behavior. Hash changes trigger new uploads. Old versions remain in NotebookLLM but are functionally replaced.

### Issue: Local file deleted but still in cloud

**Behavior**: Deletions don't propagate to cloud (preservation strategy)

**Rationale**: Cloud acts as backup. Manual deletion from NotebookLLM if needed:

```bash
nlm source list <notebook-id>
nlm source delete <notebook-id> <source-id>
```

### Issue: Cloud source not pulling to local

**Possible causes**:

1. Source name already exists locally (skipped)
2. Network error during download

**Debug**:

```bash
# Manually download a source
nlm source get <notebook-id> <source-id> > /tmp/test-download.md
cat /tmp/test-download.md
```

## Performance Considerations

### API Rate Limits

**NotebookLLM (Google)**:

- Exact limits not documented
- Recommended: Don't sync more than 100 files/minute
- Watch mode default: 5-minute polling (safe)

**Best practices**:

- Use one-shot sync for bulk operations
- Use watch mode for continuous updates
- Avoid rapid file changes (batch edits if possible)

### Database Size

**SQLite queue database**:

- Typical size: < 1MB (thousands of entries)
- Growth: ~500 bytes per queue entry
- Cleanup: Old synced items never auto-deleted (manual cleanup if needed)

```bash
# Vacuum database (reclaim space)
sqlite3 .sync-state.db "VACUUM;"
```

### Disk Space

**AnythingLLM brain**:

- Mirrors local memory (1:1 ratio)
- If local memory = 50MB, brain ≈ 50MB

**NotebookLLM**:

- Cloud storage (no local disk impact)
- Google account quota applies

## Security

### Credentials

**NotebookLLM authentication**:

- Stored by `nlm` CLI (not in this repo)
- Location: `~/.notebooklm-mcp-cli/` (or similar)
- Protected by OS file permissions

**AnythingLLM**:

- Local files only, no authentication needed
- Protected by standard file system permissions

### Data Privacy

**Local memory**:

- Stored on your machine only
- No external access without sync

**Cloud sync**:

- NotebookLLM = Google servers
- Subject to Google Cloud Privacy Policy
- Data encrypted in transit (HTTPS)

**Recommendations**:

- Don't sync sensitive secrets (API keys, passwords)
- Review memory files before syncing
- Use `.gitignore` for sensitive local notes

## Migration from Phase 1

If you're using the original `sync-memory-cloud.ts`:

### Option 1: Run Both (Recommended)

Keep using Phase 1 for unidirectional sync:

```bash
npm run sync-memory-cloud
```

Test Phase 3 bidirectional:

```bash
npm run sync-memory-bidirectional
```

### Option 2: Switch to Phase 3 Only

Replace Phase 1 with Phase 3:

1. Run final Phase 1 sync:

   ```bash
   npm run sync-memory-cloud
   ```

2. Switch to Phase 3:

   ```bash
   npm run sync-memory-bidirectional:watch
   ```

3. Phase 3 includes all Phase 1 functionality + bidirectional sync

**No data loss**: Both scripts are compatible (same hash-based change detection).

## Roadmap

### Implemented (Phase 3) ✅

- Bidirectional sync (local ↔ cloud)
- Offline queue with SQLite
- Automatic reconnection logic
- Unified search interface
- Timestamp-based conflict resolution

### Future Enhancements 🚀

**Phase 4 (Real-time Sync)**:

- WebSocket-based instant sync
- No polling delay (immediate updates)
- Collaborative editing support

**Phase 5 (Advanced Conflict Resolution)**:

- Manual merge UI for conflicts
- Multi-version history
- Rollback capability

**Phase 6 (Multi-Cloud)**:

- Sync to multiple cloud RAG providers
- Dropbox/Google Drive backup
- Redundant cloud storage

## Support

Issues or questions:

1. Check troubleshooting section above
2. Review sync queue: `sqlite3 .sync-state.db`
3. Enable debug mode: `DEBUG=* npm run ...`
4. Check NotebookLLM authentication: `nlm whoami`

## Related Documentation

- **Phase 1 (Original)**: `docs/CLOUD-MEMORY-SYNC-USAGE.md`
- **Architecture**: `docs/TULSBOT-CLOUD-MEMORY.md`
- **Original memory sync**: `scripts/sync-claude-tulsbot-memory.ts`
