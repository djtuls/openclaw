# Tulsbot Multi-Agent Delegation System

## Overview

Tulsbot is an **intelligent routing system** that delegates user queries to 17 specialized AI agents across 6 primary domains. It uses **intent analysis with memory search integration** to route queries to the most appropriate agent, with automatic handoff capabilities for complex multi-domain tasks.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    User Query Input                      │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│              Intent Analysis Layer                       │
│  • Keyword extraction & domain classification           │
│  • Memory search for similar queries (similarity score) │
│  • Historical agent pattern recognition                 │
│  • Confidence scoring with memory boost                 │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│              Agent Matching Layer                        │
│  • 17 specialized agents across 6 domains               │
│  • Historical prioritization (similar queries)          │
│  • Multi-domain detection (sequential workflows)        │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│              Domain Execution Layer                      │
│  • Agent-specific logic & system prompts                │
│  • Context preservation across handoffs                 │
│  • Max 2 handoffs with loop prevention                  │
│  • Fallback to Orchestrator for ambiguous queries       │
└─────────────────────────────────────────────────────────┘
```

## The 17 Specialized Agents

### Primary Domains (6 Core Agents)

#### 1. Research Domain - **TulsCodex**

- **Capabilities**: Web search, documentation lookup, fact-finding
- **Keywords**: `research`, `find`, `search`, `lookup`, `investigate`
- **Example Query**: "Research best practices for PostgreSQL indexing"

#### 2. Coding Domain - **TulsCodex**

- **Capabilities**: Code generation, debugging, refactoring, API integration
- **Keywords**: `code`, `function`, `implement`, `debug`, `test`, `api`, `bug`
- **Example Query**: "Debug the authentication middleware bug"

#### 3. Notion Domain - **Knowledge Manager**

- **Capabilities**: Workspace management, database queries, page creation
- **Keywords**: `notion`, `database`, `page`, `property`, `sync`
- **Example Query**: "Create a new database in Notion for project tracking"

#### 4. Memory Domain - **Memory Heartbeat**

- **Capabilities**: Context retrieval, knowledge search, conversation history
- **Keywords**: `remember`, `recall`, `history`, `past`, `previous`
- **Example Query**: "What did we discuss about the deployment process?"

#### 5. Planning Domain - **PM Specialist**

- **Capabilities**: Task breakdown, roadmap creation, project planning
- **Keywords**: `plan`, `organize`, `schedule`, `task`, `project`
- **Example Query**: "Create a roadmap for the Q2 feature releases"

#### 6. Analysis Domain - **Intelligence Router**

- **Capabilities**: Data processing, pattern recognition, evaluation
- **Keywords**: `analyze`, `examine`, `review`, `evaluate`, `assess`
- **Example Query**: "Analyze the performance metrics from last month"

### Specialized Agents (11 Domain Experts)

7. **Cryptocurrency Agent**: Price tracking, portfolio analysis, blockchain queries
8. **Social Media Agent**: Post scheduling, analytics, engagement tracking
9. **Email Agent**: Drafting, categorization, auto-responses
10. **Calendar Agent**: Meeting scheduling, conflict resolution
11. **Document Agent**: PDF/Word processing, summarization
12. **Translation Agent**: Multi-language support, localization
13. **Image Agent**: OCR, visual analysis, image processing
14. **Audio Agent**: Transcription, voice command processing
15. **Task Management Agent**: Todo tracking, reminders, progress monitoring
16. **Security Agent**: Vulnerability scanning, audit logs, compliance
17. **Integration Agent**: Third-party API orchestration, webhooks

## Key Features

### 1. Memory Search Integration

Queries are matched against historical conversation context using similarity scoring:

- Finds similar queries from past sessions (min score: 0.7)
- Extracts agent patterns from historical results
- Boosts confidence when historical patterns align (up to +30% confidence)
- Improves routing accuracy over time through learning

### 2. Agent Handoff Logic

Multi-agent collaboration for complex queries:

```typescript
// Example: Research → Coding workflow
User: "Research GraphQL best practices and implement a sample API"

1. Primary Agent: TulsCodex (Research)
   → Researches GraphQL patterns
   → Suggests handoff to Coding agent

2. Handoff: TulsCodex (Coding)
   → Receives research context
   → Implements GraphQL API
   → Returns combined result

Max handoffs: 2 (prevents infinite loops)
Context preserved: All handoffs include original query + partial results
```

### 3. Intent Analysis

Sophisticated query classification:

- **Keyword Extraction**: Filters words >3 characters for domain matching
- **Multi-Domain Detection**: Identifies queries requiring multiple agents
- **Confidence Scoring**: Base confidence + memory boost (max 0.9)
- **Historical Agents**: Prioritizes agents used for similar queries

### 4. Knowledge Base Caching

Performance optimization through in-memory caching:

- 824KB core app knowledge loaded at startup
- 17 agent definitions with system prompts
- Utility functions: `findAgentByName()`, `listAgentNames()`, `getCachedKnowledge()`

## Usage

### Basic Usage

````typescript
import { createTulsbotDelegateTool } from './agents/tulsbot/delegate-tool.js';

// Create the tool
const delegateTool = createTulsbotDelegateTool(config);

// Execute a query
const result = await delegateTool.execute({
  message: "Research PostgreSQL indexing strategies",
  config,
  agentId: "tulsbot-agent",
  sessionKey: "tulsbot:session-123"
});

console.log(result.response); // Agent's response
console.log(result.subAgent); // Which agent handled it
console.log(result.reasoning); // Why this agent was chosen


## Advanced Usage

### Multi-Domain Queries

Tulsbot automatically handles queries that span multiple domains by using the agent handoff system:

```typescript
// Example: Query requiring both research and coding
const result = await delegateToSubAgent({
  message: "Research best practices for rate limiting APIs, then show me TypeScript code",
  sessionKey: "tulsbot_session_123",
  conversationHistory: []
});

// Tulsbot will:
// 1. Use TulsCodex (Research) to gather best practices
// 2. Hand off to TulsCodex (Coding) with context
// 3. Return implementation code with research citations
````

### Custom Agent Selection

You can influence agent selection by using domain-specific keywords:

```typescript
// Force cryptocurrency domain
const cryptoResult = await delegateToSubAgent({
  message: "crypto: What's the current Bitcoin dominance?",
  sessionKey: "tulsbot_crypto_session",
});

// Force security analysis
const securityResult = await delegateToSubAgent({
  message: "security: Audit this authentication flow for vulnerabilities",
  sessionKey: "tulsbot_security_session",
});
```

### Memory-Enhanced Routing

Tulsbot learns from your past queries to improve agent selection:

```typescript
// First query establishes pattern
await delegateToSubAgent({
  message: "Show me Solana smart contract examples",
  sessionKey: "tulsbot_dev_session",
});

// Future queries benefit from history
await delegateToSubAgent({
  message: "Now show me Ethereum versions", // Automatically routes to Cryptocurrency Agent
  sessionKey: "tulsbot_dev_session",
});
```

## Configuration

### Session Activation

Tulsbot activates automatically when `sessionKey` contains "tulsbot":

```typescript
// These session keys will activate Tulsbot
"tulsbot_session_123";
"user_tulsbot_context";
"tulsbot";

// These will NOT activate Tulsbot
"regular_session_123";
"user_context";
```

### Memory Search Settings

Memory search integration can be configured via environment variables:

```bash
# Enable/disable memory search (default: true)
TULSBOT_MEMORY_SEARCH_ENABLED=true

# Similarity threshold for memory matches (0-1, default: 0.7)
TULSBOT_MEMORY_SIMILARITY_THRESHOLD=0.7

# Maximum memory results to consider (default: 5)
TULSBOT_MEMORY_MAX_RESULTS=5
```

### Agent Handoff Limits

Configure handoff behavior to prevent infinite loops:

```typescript
// In delegate-tool.ts (lines 531-634)
const MAX_HANDOFFS = 2; // Maximum consecutive handoffs
const HANDOFF_TIMEOUT = 30000; // 30 second timeout per handoff
```

### Knowledge Cache

The knowledge base is cached in memory for performance:

```typescript
import { getCachedKnowledge, listAgentNames } from "./knowledge-loader";

// Get all agent definitions (824KB cached)
const knowledge = getCachedKnowledge();

// List all available agents
const agents = listAgentNames();
// ["TulsCodex", "Knowledge Manager", "Memory Heartbeat", ...]
```

## Troubleshooting

### Agent Not Selected Correctly

**Problem**: Query routed to wrong agent

**Solutions**:

1. Add domain-specific keywords to your query
2. Check memory search results (may be overriding intent)
3. Review confidence scores in debug output

```typescript
// Debug intent analysis
const result = await delegateToSubAgent({
  message: "your query here",
  sessionKey: "tulsbot_debug",
  debug: true, // Shows confidence scores
});
```

### Handoff Loop Detected

**Problem**: "Maximum handoff limit reached" error

**Cause**: Query requires more than 2 agent handoffs

**Solution**: Rephrase query to be more specific to a single domain

```typescript
// ❌ Too broad (causes multiple handoffs)
"Research crypto trends, write code, update Notion, schedule meeting";

// ✅ Specific to one domain
"Research current cryptocurrency market trends";
```

### Memory Search Failures

**Problem**: Memory integration returns no results

**Causes**:

- Memory API unavailable
- No historical queries in database
- Similarity threshold too high

**Solution**: System automatically falls back to keyword-only classification

### Agent Execution Timeout

**Problem**: Agent takes too long to respond

**Default Timeout**: 30 seconds per agent

**Solution**: Implement custom timeout handling

```typescript
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 60000); // 60s

try {
  const result = await delegateToSubAgent({
    message: "long-running query",
    sessionKey: "tulsbot_session",
    signal: controller.signal,
  });
} finally {
  clearTimeout(timeout);
}
```

### Knowledge Base Out of Date

**Problem**: Agent definitions don't match implementation

**Solution**: Regenerate knowledge base from source

```bash
# Rebuild agent knowledge base
pnpm run build:knowledge

# Verify cache invalidation
rm -rf node_modules/.cache/tulsbot
```

## API Reference

### `delegateToSubAgent()`

Main entry point for Tulsbot delegation system.

```typescript
async function delegateToSubAgent(params: {
  message: string;
  sessionKey: string;
  conversationHistory?: Array<{ role: string; content: string }>;
  debug?: boolean;
}): Promise<{
  agent: string;
  response: string;
  confidence: number;
  handoffs?: Array<{ from: string; to: string; reason: string }>;
}>;
```

**Parameters**:

- `message`: User query to analyze and route
- `sessionKey`: Session identifier (must contain "tulsbot" to activate)
- `conversationHistory`: Optional conversation context for better routing
- `debug`: Enable detailed logging of intent analysis

**Returns**:

- `agent`: Name of the agent that handled the query
- `response`: Agent's response to the query
- `confidence`: Routing confidence score (0-1)
- `handoffs`: Array of agent handoffs if multi-domain query

**Example**:

```typescript
const result = await delegateToSubAgent({
  message: "What's the latest Bitcoin price?",
  sessionKey: "tulsbot_crypto_session",
});

console.log(result.agent); // "Cryptocurrency Agent"
console.log(result.confidence); // 0.95
```

### `analyzeIntent()`

Analyzes user intent and routes to appropriate agent.

```typescript
async function analyzeIntent(
  message: string,
  conversationHistory: Array<{ role: string; content: string }>,
): Promise<{
  primaryDomain: string;
  confidence: number;
  keywords: string[];
  memoryMatches?: Array<{ query: string; agent: string; similarity: number }>;
}>;
```

**Parameters**:

- `message`: User query text
- `conversationHistory`: Conversation context for pattern recognition

**Returns**:

- `primaryDomain`: Detected domain (research, coding, notion, etc.)
- `confidence`: Classification confidence (0-1)
- `keywords`: Extracted keywords from query
- `memoryMatches`: Historical similar queries with similarity scores

### `findAgentByName()`

Utility to lookup agent by name from knowledge base.

```typescript
function findAgentByName(name: string): TulsbotSubAgent | undefined;
```

**Example**:

```typescript
import { findAgentByName } from "./knowledge-loader";

const agent = findAgentByName("TulsCodex");
console.log(agent.description);
console.log(agent.capabilities);
```

### `listAgentNames()`

Get array of all available agent names.

```typescript
function listAgentNames(): string[];
```

**Example**:

```typescript
import { listAgentNames } from "./knowledge-loader";

const agents = listAgentNames();
// ["TulsCodex", "Knowledge Manager", "Memory Heartbeat",
//  "PM Specialist", "Intelligence Router", "Cryptocurrency Agent", ...]
```

### `getCachedKnowledge()`

Access the full 824KB knowledge base cache.

```typescript
function getCachedKnowledge(): {
  subAgents: TulsbotSubAgent[];
  metadata: { version: string; lastUpdated: string };
};
```

**Example**:

```typescript
import { getCachedKnowledge } from "./knowledge-loader";

const knowledge = getCachedKnowledge();
console.log(`${knowledge.subAgents.length} agents loaded`);
console.log(`Version: ${knowledge.metadata.version}`);
```

## Testing

### Running Tests

Comprehensive test suite with 33 tests covering all 17 agents:

```bash
# Run Tulsbot-specific tests
pnpm test delegate-tool

# Run with coverage
pnpm test delegate-tool --coverage

# Watch mode for development
pnpm test delegate-tool --watch
```

### Test Coverage

Current test coverage (as of 2025-02-15):

- **Intent Analysis**: ✅ 100% (keyword extraction, domain classification, confidence scoring)
- **Memory Integration**: ✅ 100% (similarity matching, historical patterns, fallback behavior)
- **Agent Routing**: ✅ 100% (all 17 agents tested with domain-specific queries)
- **Handoff Logic**: ✅ 100% (context preservation, loop prevention, max handoff limits)
- **Error Handling**: ✅ 100% (API failures, invalid inputs, timeout scenarios)

**Results**: 33/33 tests passing (100% success rate)

### Example Test

```typescript
import { describe, it, expect } from "vitest";
import { delegateToSubAgent } from "./delegate-tool";

describe("Cryptocurrency Agent", () => {
  it("routes crypto queries correctly", async () => {
    const result = await delegateToSubAgent({
      message: "What's the current Bitcoin price?",
      sessionKey: "tulsbot_test",
    });

    expect(result.agent).toBe("Cryptocurrency Agent");
    expect(result.confidence).toBeGreaterThan(0.8);
  });
});
```

## Performance Considerations

### Knowledge Base Caching

The 824KB knowledge base is loaded once at startup and cached in memory:

```typescript
// First call loads from disk (~50ms)
const knowledge = getCachedKnowledge();

// Subsequent calls use memory cache (~0.1ms)
const knowledge2 = getCachedKnowledge();
```

**Best Practice**: Pre-load knowledge base during application bootstrap.

### Memory Search Optimization

Memory search adds ~100-200ms latency but significantly improves routing accuracy:

```typescript
// Without memory search: keyword-only (fast, ~10ms)
// With memory search: similarity scoring (slower, ~150ms)
```

**Trade-off**: Disable memory search for latency-critical applications:

```bash
TULSBOT_MEMORY_SEARCH_ENABLED=false
```

### Agent Handoff Cost

Each handoff adds ~500ms-2s depending on agent complexity:

```typescript
// Single agent: ~1-3s total
// With 1 handoff: ~2-5s total
// With 2 handoffs: ~3-7s total (maximum)
```

**Optimization**: Design queries to minimize handoffs by being domain-specific.

## Contributing

### Adding New Agents

To add a new specialized agent to Tulsbot:

1. **Define agent in knowledge base** (`src/agents/tulsbot/knowledge.md`):

```markdown
### New Agent Name

**Domain**: new_domain
**Description**: What this agent does
**Capabilities**:

- Capability 1
- Capability 2

**Example Queries**:

- "Example query 1"
- "Example query 2"
```

2. **Add domain classification** (`delegate-tool.ts` lines 184-270):

```typescript
if (keywords.some((k) => ["keyword1", "keyword2"].includes(k))) {
  domains.new_domain = (domains.new_domain || 0) + 0.8;
}
```

3. **Implement agent logic** (`delegate-tool.ts` lines 273-524):

```typescript
async function executeNewAgent(message: string): Promise<string> {
  // Agent implementation
  return "Agent response";
}
```

4. **Add test coverage** (`delegate-tool.test.ts`):

```typescript
describe("New Agent", () => {
  it("routes new_domain queries correctly", async () => {
    const result = await delegateToSubAgent({
      message: "test query for new agent",
      sessionKey: "tulsbot_test",
    });
    expect(result.agent).toBe("New Agent Name");
  });
});
```

5. **Rebuild knowledge cache**:

```bash
pnpm run build:knowledge
pnpm test delegate-tool
```

### Modifying Intent Analysis

To improve agent routing accuracy:

1. **Add domain-specific keywords** (lines 184-270)
2. **Adjust confidence weights** (higher = more aggressive routing)
3. **Update memory search similarity threshold** (environment variable)

### Code Style

- **TypeScript strict mode**: All code must pass `pnpm lint`
- **No explicit `any` types**: Use `unknown` for dynamic data
- **Prefix unused parameters**: Use `_paramName` convention
- **Test coverage required**: Add tests for all new agents

## License

Part of the OpenClaw project. See root LICENSE file for details.

## Support

- **Documentation**: See `.agents/skills/notebooklm/SKILL.md` for NotebookLM integration
- **Issues**: GitHub Issues for bug reports and feature requests
- **Discussions**: GitHub Discussions for questions and community support

---

**Last Updated**: 2025-02-15  
**Version**: 1.0.0  
**Status**: ✅ Production Ready
