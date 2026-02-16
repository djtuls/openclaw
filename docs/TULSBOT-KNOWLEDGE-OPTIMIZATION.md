# Tulsbot Knowledge Base Optimization Strategy

## Current State

- **File Size:** 484KB
- **Format:** Single JSON file with all agents
- **Loading:** Full file loaded into memory on first access
- **Problem:** Every query requires loading/searching entire knowledge base

## Optimization Strategies (Ranked by Impact)

### 🎯 Strategy 1: Lazy Loading with Index (RECOMMENDED)

**Impact:** 90% reduction in initial load time, 95% reduction in per-query overhead

Create a lightweight index file that maps agent capabilities to file paths:

```json
{
  "version": "1.0",
  "agents": {
    "engineering-assistant": {
      "path": "./agents/engineering-assistant.json",
      "capabilities": ["code", "debugging", "architecture"],
      "triggers": ["code", "bug", "implement"],
      "size": 12000
    },
    "marketing-assistant": {
      "path": "./agents/marketing-assistant.json",
      "capabilities": ["marketing", "content", "strategy"],
      "triggers": ["campaign", "marketing", "content"],
      "size": 8500
    }
  }
}
```

**Implementation:**

1. Split `core-app-knowledge.json` into individual agent files
2. Create `knowledge-index.json` (< 10KB)
3. Load only the index initially
4. Fetch specific agent files only when needed

**Benefits:**

- Index loads in < 5ms vs 50-100ms for full file
- Only load 1-2 agents per query (10-20KB) vs entire 484KB
- Parallel loading possible for multi-agent scenarios
- Easy to update individual agents without regenerating entire KB

---

### 🎯 Strategy 2: Semantic Compression

**Impact:** 60-70% size reduction while maintaining accuracy

Compress verbose descriptions while preserving semantic meaning:

**Before (verbose):**

```json
{
  "systemPrompt": "You are an engineering assistant who specializes in helping developers with code implementation, debugging complex issues, architectural decisions, and technical problem-solving. You have deep knowledge of software engineering best practices..."
}
```

**After (compressed):**

```json
{
  "systemPrompt": "Engineering assistant: code implementation, debugging, architecture, best practices",
  "fullPromptPath": "./prompts/engineering-assistant.md"
}
```

**Benefits:**

- Reduce index size by 60-70%
- Load full prompts only when agent is selected
- Faster parsing and matching

---

### 🎯 Strategy 3: Embeddings-Based Routing

**Impact:** 95% faster routing, more accurate matching

Replace keyword matching with vector embeddings:

**Current Flow:**

```
User Query → Load All Agents → Keyword Match → Select Agent → Load Prompt
```

**Optimized Flow:**

```
User Query → Embed Query → Vector Search Index → Select Agent → Load Only That Agent
```

**Implementation:**

```typescript
interface AgentEmbedding {
  agentId: string;
  embedding: number[]; // Pre-computed 384-dim vector
  lastUpdated: string;
}

// Pre-compute embeddings for all agent capabilities
const embeddingsIndex = await buildEmbeddingsIndex(agents);

// Fast cosine similarity search (< 1ms for 100 agents)
const bestMatch = findBestMatch(queryEmbedding, embeddingsIndex);
```

**Benefits:**

- Sub-millisecond routing vs 50-100ms keyword matching
- Handles synonyms and context better
- No need to load full knowledge base for routing

---

### 🎯 Strategy 4: Tiered Loading

**Impact:** 80% reduction in typical query latency

Load knowledge in tiers based on usage frequency:

**Tier 1 (Hot Cache - Always Loaded):**

- 5-10 most frequently used agents
- Total size: < 50KB
- Load on startup

**Tier 2 (Warm Cache - Load on Demand):**

- Next 20-30 agents
- Load when first accessed
- Keep in LRU cache

**Tier 3 (Cold Storage):**

- Rarely used specialized agents
- Load only when specifically requested
- Evict after use

**Implementation:**

```typescript
interface TieredCache {
  hot: Map<string, TulsbotSubAgent>; // Always loaded
  warm: Map<string, TulsbotSubAgent>; // LRU cache (max 50)
  cold: Set<string>; // Just agent IDs
}
```

---

### 🎯 Strategy 5: Incremental Updates

**Impact:** Eliminate full-file regeneration overhead

Instead of regenerating entire 484KB file:

```typescript
interface KnowledgeUpdate {
  type: "add" | "update" | "remove";
  agentId: string;
  data?: Partial<TulsbotSubAgent>;
  timestamp: number;
}

// Apply incremental updates
await applyKnowledgeUpdate({
  type: "update",
  agentId: "engineering-assistant",
  data: { systemPrompt: "Updated prompt..." },
});
```

**Benefits:**

- Update single agent without touching others
- Version control friendly (smaller diffs)
- Faster refresh cycles

---

## Recommended Implementation Plan

### Phase 1: Quick Wins (1-2 hours)

1. **Add lazy loading with index**
   - Create knowledge index extractor
   - Modify `knowledge-loader.ts` to use index
   - Load agents on demand

### Phase 2: Deep Optimization (3-4 hours)

2. **Semantic compression**
   - Extract verbose prompts to separate files
   - Compress index entries
   - Reduce redundant metadata

### Phase 3: Advanced (1-2 days)

3. **Embeddings-based routing**
   - Pre-compute agent embeddings
   - Implement vector search
   - Cache embeddings for fast lookup

### Phase 4: Infrastructure (Optional)

4. **Database backend**
   - Migrate from JSON to SQLite/LevelDB
   - Enable SQL queries for complex filtering
   - Support concurrent access

---

## Expected Results

| Metric               | Current   | After Phase 1 | After Phase 2 | After Phase 3     |
| -------------------- | --------- | ------------- | ------------- | ----------------- |
| Initial Load         | 100ms     | 5ms           | 3ms           | 2ms               |
| Query Routing        | 50ms      | 10ms          | 5ms           | < 1ms             |
| Memory Usage         | 484KB     | 50KB          | 30KB          | 50KB + embeddings |
| Agent Selection      | 100ms     | 15ms          | 10ms          | < 1ms             |
| **Total Query Time** | **250ms** | **30ms**      | **18ms**      | **< 5ms**         |

---

## Code Examples

### Phase 1: Knowledge Index Generator

```typescript
// scripts/generate-knowledge-index.ts
export async function generateKnowledgeIndex(
  knowledgePath: string,
  outputDir: string,
): Promise<void> {
  const knowledge = await loadTulsbotKnowledge(knowledgePath);

  const index: KnowledgeIndex = {
    version: knowledge.version,
    agentCount: knowledge.agents.length,
    agents: {},
  };

  // Split agents into individual files
  for (const agent of knowledge.agents) {
    const agentFile = `${agent.name.toLowerCase().replace(/\s+/g, "-")}.json`;
    const agentPath = path.join(outputDir, "agents", agentFile);

    // Write individual agent file
    await fs.writeFile(agentPath, JSON.stringify(agent, null, 2));

    // Add to index
    index.agents[agent.name] = {
      path: `./agents/${agentFile}`,
      capabilities: agent.capabilities || [],
      triggers: agent.triggers || [],
      size: JSON.stringify(agent).length,
    };
  }

  // Write index
  const indexPath = path.join(outputDir, "knowledge-index.json");
  await fs.writeFile(indexPath, JSON.stringify(index, null, 2));

  console.log(`✓ Generated index with ${knowledge.agents.length} agents`);
  console.log(`✓ Index size: ${JSON.stringify(index).length} bytes`);
}
```

### Phase 1: Lazy Loading Implementation

```typescript
// src/agents/tulsbot/knowledge-loader-v2.ts
interface KnowledgeIndex {
  version: string;
  agentCount: number;
  agents: Record<
    string,
    {
      path: string;
      capabilities: string[];
      triggers: string[];
      size: number;
    }
  >;
}

let cachedIndex: KnowledgeIndex | null = null;
const agentCache = new Map<string, TulsbotSubAgent>();

export async function getCachedKnowledge(): Promise<TulsbotKnowledge> {
  // Load index if not cached
  if (!cachedIndex) {
    const indexPath = path.join(getKnowledgeDir(), "knowledge-index.json");
    const content = await fs.readFile(indexPath, "utf-8");
    cachedIndex = JSON.parse(content);
  }

  // Return virtual knowledge object that loads agents on demand
  return {
    version: cachedIndex.version,
    agents: createLazyAgentProxy(cachedIndex),
    get agentCount() {
      return cachedIndex!.agentCount;
    },
  };
}

function createLazyAgentProxy(index: KnowledgeIndex): TulsbotSubAgent[] {
  return new Proxy([], {
    get(target, prop) {
      if (prop === "length") return index.agentCount;
      if (prop === "find") return createLazyFindMethod(index);
      // ... other array methods
    },
  });
}

async function loadAgent(agentName: string): Promise<TulsbotSubAgent> {
  // Check cache first
  if (agentCache.has(agentName)) {
    return agentCache.get(agentName)!;
  }

  // Load from file
  const agentInfo = cachedIndex!.agents[agentName];
  const agentPath = path.join(getKnowledgeDir(), agentInfo.path);
  const content = await fs.readFile(agentPath, "utf-8");
  const agent = JSON.parse(content);

  // Cache it
  agentCache.set(agentName, agent);

  return agent;
}
```

---

## Migration Path

### Step 1: Backward Compatible

- Keep existing `core-app-knowledge.json` as fallback
- Add `TULSBOT_USE_INDEXED_KNOWLEDGE` feature flag
- Test with both systems in parallel

### Step 2: Gradual Rollout

- Enable indexed knowledge for development
- Monitor performance and error rates
- Fix edge cases

### Step 3: Full Migration

- Make indexed knowledge default
- Remove old single-file loader
- Archive `core-app-knowledge.json`

---

## Performance Testing

```typescript
// scripts/benchmark-knowledge-loading.ts
async function benchmarkKnowledgeLoading() {
  const iterations = 100;

  // Test 1: Current full-file loading
  console.log("Testing current implementation...");
  const start1 = performance.now();
  for (let i = 0; i < iterations; i++) {
    clearCache();
    await getCachedKnowledge();
  }
  const avg1 = (performance.now() - start1) / iterations;

  // Test 2: Indexed loading
  console.log("Testing indexed implementation...");
  const start2 = performance.now();
  for (let i = 0; i < iterations; i++) {
    clearCache();
    await getCachedKnowledgeV2();
  }
  const avg2 = (performance.now() - start2) / iterations;

  console.log(`\nResults:`);
  console.log(`Current: ${avg1.toFixed(2)}ms avg`);
  console.log(`Indexed: ${avg2.toFixed(2)}ms avg`);
  console.log(`Speedup: ${(avg1 / avg2).toFixed(1)}x faster`);
}
```

---

## Additional Optimizations

### Agent Metadata Compression

- Store frequently-accessed fields separately
- Use binary format for embeddings
- Compress historical data with zlib

### Query Result Caching

- Cache intent analysis results
- Store agent selection decisions
- TTL-based invalidation

### Preloading Strategy

- Predict likely next agents based on conversation flow
- Preload during agent execution
- Background refresh of warm cache
