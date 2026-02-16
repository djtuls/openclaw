# Tulsbot Cloud Memory - Architecture & Implementation

## 🎯 Goal

Create an online-accessible memory system that:

1. **Syncs bidirectionally** with local OpenClaw memory
2. **Queryable from anywhere** via REST API
3. **Reconciles automatically** when back online
4. **Maintains consistency** across devices

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    LOCAL ENVIRONMENT                        │
│                                                              │
│  ┌──────────────────┐       ┌──────────────────┐           │
│  │  OpenClaw Local  │◄─────►│  Sync Daemon     │           │
│  │  SQLite Memory   │       │  (Background)    │           │
│  └──────────────────┘       └────────┬─────────┘           │
│                                       │                      │
└───────────────────────────────────────┼──────────────────────┘
                                        │
                                        │ HTTPS + WebSocket
                                        ↓
┌─────────────────────────────────────────────────────────────┐
│                    CLOUD LAYER                              │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │           Tulsbot Cloud Memory API                    │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │  │
│  │  │   REST API  │  │  WebSocket  │  │    Auth     │  │  │
│  │  │  /search    │  │   /sync     │  │  JWT/API    │  │  │
│  │  │  /add       │  │   /watch    │  │    Keys     │  │  │
│  │  │  /update    │  │             │  │             │  │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  │  │
│  └────────────────────────┬─────────────────────────────┘  │
│                            │                                │
│  ┌────────────────────────┴─────────────────────────────┐  │
│  │              Supabase PostgreSQL                      │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌───────────┐  │  │
│  │  │   memories   │  │    chunks    │  │ sync_log  │  │  │
│  │  │  (metadata)  │  │  (pgvector)  │  │ (changes) │  │  │
│  │  └──────────────┘  └──────────────┘  └───────────┘  │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 🗄️ Database Schema (Supabase PostgreSQL)

### Table: `memories`

```sql
CREATE TABLE memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT NOT NULL,
  file_path TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  content_hash TEXT NOT NULL,  -- MD5 for change detection
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,  -- Soft delete

  UNIQUE(agent_id, file_path)
);

CREATE INDEX idx_memories_agent ON memories(agent_id);
CREATE INDEX idx_memories_updated ON memories(updated_at);
CREATE INDEX idx_memories_hash ON memories(content_hash);
```

### Table: `chunks` (Vector embeddings)

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  memory_id UUID REFERENCES memories(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  embedding VECTOR(1536),  -- OpenAI text-embedding-3-small
  chunk_index INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(memory_id, chunk_index)
);

CREATE INDEX idx_chunks_embedding ON chunks
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
```

### Table: `sync_log` (Change tracking)

```sql
CREATE TABLE sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT NOT NULL,
  memory_id UUID REFERENCES memories(id) ON DELETE CASCADE,
  operation TEXT NOT NULL,  -- 'create', 'update', 'delete'
  local_timestamp TIMESTAMPTZ,
  cloud_timestamp TIMESTAMPTZ DEFAULT NOW(),
  sync_direction TEXT NOT NULL,  -- 'local_to_cloud', 'cloud_to_local'
  conflict_resolved BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sync_log_agent ON sync_log(agent_id, created_at DESC);
```

---

## 🔄 Sync Strategy

### 1. **Change Detection**

- Local: Monitor file system with `chokidar`
- Cloud: Track changes via `updated_at` timestamps
- Use MD5 content hashes for conflict detection

### 2. **Conflict Resolution**

```typescript
type ConflictStrategy =
  | "local_wins" // Local changes always override cloud
  | "cloud_wins" // Cloud changes always override local
  | "newest_wins" // Most recent timestamp wins
  | "merge" // Merge both (for MEMORY.md)
  | "manual"; // Prompt user
```

### 3. **Sync Modes**

- **Online**: Real-time WebSocket sync (instant propagation)
- **Offline**: Queue changes locally, batch sync on reconnect
- **Periodic**: Poll every N minutes as fallback

---

## 🚀 API Endpoints

### **POST /api/memory/search**

```json
{
  "agent_id": "tulsbot",
  "query": "How does QMD backend work?",
  "limit": 5
}

// Response
{
  "results": [
    {
      "memory_id": "uuid",
      "title": "QMD Backend Architecture",
      "content": "...",
      "similarity": 0.89,
      "file_path": "qmd-architecture.md"
    }
  ]
}
```

### **POST /api/memory/add**

```json
{
  "agent_id": "tulsbot",
  "file_path": "new-learning.md",
  "title": "New Learning",
  "content": "# New Learning\n\nContent here...",
  "metadata": { "tier": "core", "confidence": 0.9 }
}
```

### **PUT /api/memory/update**

```json
{
  "memory_id": "uuid",
  "content": "Updated content...",
  "content_hash": "new-hash"
}
```

### **WebSocket: /ws/sync**

```json
// Client subscribes
{ "action": "subscribe", "agent_id": "tulsbot" }

// Server pushes changes
{
  "action": "memory_updated",
  "memory_id": "uuid",
  "file_path": "learning.md",
  "content_hash": "abc123"
}

// Client acknowledges
{ "action": "ack", "memory_id": "uuid" }
```

---

## 🔐 Authentication

### Option 1: API Keys (Simplest)

```typescript
// Store in ~/.openclaw/config.json
{
  "cloudMemory": {
    "enabled": true,
    "apiUrl": "https://tulsbot-memory.fly.dev",
    "apiKey": "sk_live_xxx"
  }
}
```

### Option 2: OAuth + JWT (More secure)

```typescript
// Login flow
const token = await authClient.login();
// Store token in secure keychain
await keytar.setPassword("openclaw", "cloud-token", token);
```

---

## 📁 Implementation Files

### 1. **Cloud API Service** (`services/tulsbot-memory-api/`)

```
src/
├── index.ts              # Express server entry
├── routes/
│   ├── memory.ts         # CRUD endpoints
│   ├── search.ts         # Vector search
│   └── sync.ts           # WebSocket handler
├── db/
│   ├── supabase.ts       # Supabase client
│   └── migrations/       # SQL migrations
├── sync/
│   ├── conflict-resolver.ts
│   └── change-tracker.ts
└── auth/
    └── jwt-middleware.ts
```

### 2. **Local Sync Daemon** (`src/memory/cloud-sync.ts`)

```typescript
export class CloudMemorySyncDaemon {
  constructor(
    private localMemoryDir: string,
    private cloudApiUrl: string,
    private apiKey: string,
  ) {}

  async start() {
    // 1. Connect WebSocket
    // 2. Watch local file changes
    // 3. Poll cloud for changes
    // 4. Handle conflicts
  }

  async syncOnce() {
    // Batch sync all changes
  }

  async handleConflict(localMemory: Memory, cloudMemory: Memory): Promise<Memory> {
    // Implement conflict resolution
  }
}
```

### 3. **CLI Commands** (`src/cli/cloud-memory.ts`)

```bash
# Enable cloud sync
openclaw memory cloud enable --api-key sk_live_xxx

# One-shot sync
openclaw memory cloud sync

# Start sync daemon
openclaw memory cloud watch

# Check sync status
openclaw memory cloud status
```

---

## 🎯 Implementation Phases

### **Phase 1: Core Infrastructure** (Week 1)

- [ ] Set up Supabase project with pgvector
- [ ] Create database schema and migrations
- [ ] Build REST API with basic CRUD
- [ ] Deploy to Fly.io/Railway

### **Phase 2: Local Sync** (Week 2)

- [ ] Build local sync daemon
- [ ] Implement file watcher
- [ ] Add conflict resolution
- [ ] CLI commands

### **Phase 3: Real-time Sync** (Week 3)

- [ ] WebSocket implementation
- [ ] Offline queue system
- [ ] Reconnection logic
- [ ] Testing with flaky connections

### **Phase 4: Security & Polish** (Week 4)

- [ ] JWT authentication
- [ ] Rate limiting
- [ ] Encryption at rest
- [ ] Monitoring & logging
- [ ] Documentation

---

## 🔬 Testing Strategy

### Local Sync Tests

```typescript
test("syncs new memory from local to cloud", async () => {
  // 1. Create memory locally
  // 2. Wait for sync
  // 3. Verify exists in cloud
});

test("resolves conflicts with newest_wins", async () => {
  // 1. Modify same memory locally and in cloud
  // 2. Trigger sync
  // 3. Verify newest version wins
});
```

### Network Resilience Tests

```typescript
test("queues changes when offline", async () => {
  // 1. Disconnect network
  // 2. Make local changes
  // 3. Reconnect
  // 4. Verify all changes synced
});
```

---

## 📊 Cost Estimate

### Supabase (Free Tier)

- 500MB database
- 2GB bandwidth/month
- 50MB file storage
- **Cost: $0/month**

### Fly.io / Railway

- 1 shared CPU
- 256MB RAM
- **Cost: ~$5/month**

### Total: **~$5/month** (scales to $25/month for heavy use)

---

## 🚦 Alternative: Extend NotebookLLM (Faster)

If you want to ship faster, **extend your existing NotebookLLM** setup:

### Pros

✅ Already online and queryable
✅ Already has auth (Google OAuth)
✅ Gemini-powered search
✅ Zero infrastructure setup

### Cons

❌ Limited to NotebookLLM's capabilities
❌ No custom vector search
❌ Rate limits from Google

### Implementation

```typescript
// Add to sync-anythingllm-bidirectional.ts
async function syncMemoryToNotebookLLM(memory: Memory) {
  // Use execFileNoThrow for safety (prevents command injection)
  const { stdout } = await execFileNoThrow("nlm", [
    "source",
    "add",
    TULSBOT_NOTEBOOK_ID,
    "--file",
    memory.path,
  ]);
}

// Query from anywhere
async function queryTulsbotBrain(question: string) {
  const { stdout } = await execFileNoThrow("nlm", [
    "query",
    "notebook",
    TULSBOT_NOTEBOOK_ID,
    question,
  ]);
  return parseNotebookLLMResponse(stdout);
}
```

---

## 🎯 Recommendation

**Start with NotebookLLM extension** (1-2 days) for immediate online access, then **migrate to custom Tulsbot Cloud Memory** (2-4 weeks) for full control and advanced features.

This gives you:

1. ✅ **Immediate** online access via NotebookLLM
2. ✅ **Full control** with custom API later
3. ✅ **Smooth migration** path (both can coexist)

Would you like me to start with the NotebookLLM extension first, or jump straight into building the custom cloud memory API?
