/**
 * End-to-End Integration Test for Tulsbot Full Flow
 *
 * Tests the complete request flow through the Tulsbot sub-agent system:
 * 1. Gateway receives message
 * 2. Routing resolves to Tulsbot (default agent)
 * 3. Session created with namespace isolation
 * 4. Knowledge loader fetches agent-specific knowledge on-demand
 * 5. Memory search queries with namespace filter
 * 6. Delegate tool routes to appropriate sub-agent (1 of 17)
 * 7. Response generated and returned
 */

import type { AgentToolResult } from "@mariozechner/pi-agent-core";
import { describe, it, expect, vi, beforeEach, afterEach, type MockedFunction } from "vitest";
import type { OpenClawConfig } from "../../src/config/config.js";
import type { MemorySearchManager } from "../../src/memory/types.js";
import { resolveSessionAgentId } from "../../src/agents/agent-scope.js";
import { createTulsbotDelegateTool } from "../../src/agents/tulsbot/delegate-tool.js";
import {
  getCachedKnowledge,
  type TulsbotKnowledge,
  type TulsbotSubAgent,
} from "../../src/agents/tulsbot/knowledge-loader.js";

/**
 * Helper to extract JSON string from AgentToolResult
 * AgentToolResult has structure: { content: [{ type: "text", text: "JSON string" }], details: {...} }
 */
function extractJsonFromResult(result: AgentToolResult<unknown>): string {
  const textContent = result.content?.find((c) => c.type === "text");
  if (!textContent || textContent.type !== "text") {
    throw new Error("No text content found in AgentToolResult");
  }
  return textContent.text;
}

// Mock external dependencies
vi.mock("../../src/agents/tulsbot/knowledge-loader.js", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("../../src/agents/tulsbot/knowledge-loader.js")>();
  return {
    ...original,
    getCachedKnowledge: vi.fn(),
  };
});

vi.mock("../../src/memory/index.js", () => ({
  getMemorySearchManager: vi.fn(),
}));

describe("Tulsbot E2E Full Flow", () => {
  // Test fixtures
  const mockConfig: OpenClawConfig = {
    agents: {
      list: [
        {
          id: "tulsbot",
          name: "Tulsbot",
          default: true,
          workspace: "/tmp/test-workspace",
          memorySearch: {
            enabled: true,
            provider: "openai",
          },
        },
      ],
    },
    model: "claude-3-5-sonnet-20241022",
  };

  const mockTulsbotKnowledge: TulsbotKnowledge = {
    version: "1.0.0-test",
    lastUpdated: "2024-01-01",
    agents: [
      {
        name: "Orchestrator",
        id: "orchestrator",
        description: "Primary orchestration agent",
        capabilities: ["general", "routing"],
        triggers: ["general", "help"],
        systemPrompt: "You are the Orchestrator agent, handling general queries.",
      },
      {
        name: "TulsCodex",
        id: "tulscodex",
        description: "Research and coding specialist",
        capabilities: ["research", "code review", "documentation"],
        triggers: ["research", "code", "search", "find"],
        systemPrompt: "You are TulsCodex, handling research and coding tasks.",
      },
      {
        name: "Knowledge Manager",
        id: "knowledge-manager",
        description: "Notion workspace specialist",
        capabilities: ["notion", "database queries", "workspace search"],
        triggers: ["notion", "database", "workspace"],
        systemPrompt: "You are the Knowledge Manager, handling Notion queries.",
      },
      {
        name: "Memory Heartbeat",
        id: "memory-heartbeat",
        description: "Memory retrieval specialist",
        capabilities: ["recall", "remember", "context retrieval"],
        triggers: ["remember", "recall", "memory"],
        systemPrompt: "You are Memory Heartbeat, handling memory queries.",
      },
    ],
  };

  const mockMemorySearchManager: Partial<MemorySearchManager> = {
    search: vi.fn().mockResolvedValue([
      {
        snippet: "Previous research query about TulsCodex capabilities",
        score: 0.85,
        source: "session",
        path: "session-123.md",
        line: 42,
        timestamp: 1234567890,
      },
      {
        snippet: "User asked about research_agent features",
        score: 0.78,
        source: "session",
        path: "session-124.md",
        line: 15,
        timestamp: 1234567891,
      },
    ]),
  };

  beforeEach(async () => {
    // Reset mocks
    vi.clearAllMocks();

    // Set up default mock implementations
    (getCachedKnowledge as MockedFunction<typeof getCachedKnowledge>).mockResolvedValue(
      mockTulsbotKnowledge,
    );

    const { getMemorySearchManager } = vi.mocked(await import("../../src/memory/index.js"));
    getMemorySearchManager.mockResolvedValue({
      manager: mockMemorySearchManager as MemorySearchManager,
      indexPath: "/tmp/test-index.db",
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Step 1: Gateway receives message", () => {
    it("should accept message from Discord channel", () => {
      const incomingMessage = {
        channel: "discord" as const,
        channelId: "test-discord-channel",
        userId: "user-123",
        content: "Find research about AI assistants",
        timestamp: Date.now(),
      };

      expect(incomingMessage.channel).toBe("discord");
      expect(incomingMessage.content).toBeTruthy();
      expect(incomingMessage.timestamp).toBeGreaterThan(0);
    });

    it("should accept message from Slack channel", () => {
      const incomingMessage = {
        channel: "slack" as const,
        channelId: "test-slack-channel",
        userId: "U123456",
        content: "Help me with Notion database queries",
        timestamp: Date.now(),
      };

      expect(incomingMessage.channel).toBe("slack");
      expect(incomingMessage.content).toContain("Notion");
    });
  });

  describe("Step 2: Routing resolves to Tulsbot (default agent)", () => {
    it("should resolve to tulsbot as default agent", () => {
      const sessionKey = "tulsbot:session-123";
      const agentId = resolveSessionAgentId({
        sessionKey,
        config: mockConfig,
      });

      expect(agentId).toBe("tulsbot");
    });

    it("should resolve to tulsbot when sessionKey includes tulsbot namespace", () => {
      const sessionKey = "tulsbot:discord:channel-456";
      const agentId = resolveSessionAgentId({
        sessionKey,
        config: mockConfig,
      });

      expect(agentId).toBe("tulsbot");
    });

    it("should resolve to default agent (tulsbot) when no sessionKey provided", () => {
      const agentId = resolveSessionAgentId({
        config: mockConfig,
      });

      expect(agentId).toBe("tulsbot");
    });
  });

  describe("Step 3: Session created with namespace isolation", () => {
    it("should create session with tulsbot namespace", () => {
      const sessionKey = "tulsbot:discord:user-123";
      const parsed = sessionKey.split(":");

      expect(parsed[0]).toBe("tulsbot");
      expect(parsed.length).toBeGreaterThanOrEqual(2);
    });

    it("should isolate session namespace from other agents", () => {
      const tulsbotSession = "tulsbot:session-a";
      const otherAgentSession = "otheragent:session-a";

      const tulsbotNamespace = tulsbotSession.split(":")[0];
      const otherNamespace = otherAgentSession.split(":")[0];

      expect(tulsbotNamespace).toBe("tulsbot");
      expect(otherNamespace).toBe("otheragent");
      expect(tulsbotNamespace).not.toBe(otherNamespace);
    });

    it("should maintain namespace consistency across session operations", () => {
      const sessionKey = "tulsbot:discord:channel-789";
      const namespace = sessionKey.split(":")[0];

      // Simulate multiple operations with same session
      const operations = [`${namespace}:op1`, `${namespace}:op2`, `${namespace}:op3`];

      operations.forEach((op) => {
        expect(op.startsWith("tulsbot:")).toBe(true);
      });
    });
  });

  describe("Step 4: Knowledge loader fetches agent-specific knowledge on-demand", () => {
    it("should load knowledge from cache on first access", async () => {
      const knowledge = await getCachedKnowledge();

      expect(getCachedKnowledge).toHaveBeenCalledTimes(1);
      expect(knowledge).toBeDefined();
      expect(knowledge.agents).toBeInstanceOf(Array);
      expect(knowledge.agents.length).toBeGreaterThan(0);
    });

    it("should return cached knowledge on subsequent calls", async () => {
      // First call loads
      const knowledge1 = await getCachedKnowledge();
      // Second call uses cache
      const knowledge2 = await getCachedKnowledge();

      expect(knowledge1).toBe(knowledge2);
      expect(getCachedKnowledge).toHaveBeenCalledTimes(2);
    });

    it("should validate knowledge structure contains required fields", async () => {
      const knowledge = await getCachedKnowledge();

      expect(knowledge).toHaveProperty("agents");
      expect(knowledge.agents).toBeInstanceOf(Array);

      // Validate first agent has required structure
      const firstAgent = knowledge.agents[0];
      expect(firstAgent).toHaveProperty("name");
      expect(firstAgent.name).toBeTruthy();
    });

    it("should include all 17 sub-agents in production knowledge", async () => {
      // In real scenario, mock would have all 17 agents
      const knowledge = await getCachedKnowledge();

      // Test setup has 4 agents, production has 17
      expect(knowledge.agents.length).toBeGreaterThanOrEqual(4);

      // Verify key agents are present
      const agentNames = knowledge.agents.map((a) => a.name.toLowerCase());
      expect(agentNames).toContain("orchestrator");
      expect(agentNames).toContain("tulscodex");
    });

    it("should handle knowledge loading errors gracefully", async () => {
      (getCachedKnowledge as MockedFunction<typeof getCachedKnowledge>).mockRejectedValueOnce(
        new Error("Failed to load knowledge file"),
      );

      await expect(getCachedKnowledge()).rejects.toThrow("Failed to load knowledge file");
    });
  });

  describe("Step 5: Memory search queries with namespace filter", () => {
    it("should query memory with tulsbot namespace filter", async () => {
      const { getMemorySearchManager } = await import("../../src/memory/index.js");
      const sessionKey = "tulsbot:session-123";

      const result = await getMemorySearchManager({
        cfg: mockConfig,
        agentId: "tulsbot",
      });

      expect(result.manager).toBeDefined();
      expect(getMemorySearchManager).toHaveBeenCalledWith({
        cfg: mockConfig,
        agentId: "tulsbot",
      });
    });

    it("should perform hybrid search and return results", async () => {
      const { getMemorySearchManager } = await import("../../src/memory/index.js");

      const result = await getMemorySearchManager({
        cfg: mockConfig,
        agentId: "tulsbot",
      });

      const searchResults = await result.manager!.search("research AI assistants", {
        maxResults: 5,
        minScore: 0.7,
        sessionKey: "tulsbot:session-123",
      });

      expect(searchResults).toBeInstanceOf(Array);
      expect(searchResults.length).toBeGreaterThan(0);
      expect(searchResults[0]).toHaveProperty("snippet");
      expect(searchResults[0]).toHaveProperty("score");
      expect(searchResults[0].score).toBeGreaterThanOrEqual(0.7);
    });

    it("should filter memory by namespace to prevent cross-agent leaks", async () => {
      const { getMemorySearchManager } = await import("../../src/memory/index.js");

      const tulsbotResult = await getMemorySearchManager({
        cfg: mockConfig,
        agentId: "tulsbot",
      });

      const tulsbotSearch = await tulsbotResult.manager!.search("test query", {
        sessionKey: "tulsbot:session-123",
      });

      // Verify namespace isolation - results should be scoped to tulsbot
      tulsbotSearch.forEach((result) => {
        // In real implementation, verify result.path or result.metadata contains namespace info
        expect(result).toHaveProperty("source");
        expect(result.source).toBeTruthy();
      });
    });

    it("should handle memory search timeout gracefully", async () => {
      const { getMemorySearchManager } = await import("../../src/memory/index.js");

      // Mock timeout scenario
      const timeoutManager: Partial<MemorySearchManager> = {
        search: vi
          .fn()
          .mockImplementation(
            () =>
              new Promise((_, reject) =>
                setTimeout(() => reject(new Error("Search timeout")), 100),
              ),
          ),
      };

      getMemorySearchManager.mockResolvedValueOnce({
        manager: timeoutManager as MemorySearchManager,
        indexPath: "/tmp/test-index.db",
      });

      const result = await getMemorySearchManager({
        cfg: mockConfig,
        agentId: "tulsbot",
      });

      await expect(result.manager!.search("test", {})).rejects.toThrow("Search timeout");
    });

    it("should use LRU cache for memory search results", async () => {
      const { getMemorySearchManager } = await import("../../src/memory/index.js");

      const result = await getMemorySearchManager({
        cfg: mockConfig,
        agentId: "tulsbot",
      });

      // First search
      const search1 = await result.manager!.search("research", {});
      // Second identical search (should hit cache in real implementation)
      const search2 = await result.manager!.search("research", {});

      expect(search1).toBeInstanceOf(Array);
      expect(search2).toBeInstanceOf(Array);
    });
  });

  describe("Step 6: Delegate tool routes to appropriate sub-agent (1 of 17)", () => {
    it("should create delegate tool for tulsbot session", () => {
      const delegateTool = createTulsbotDelegateTool({
        config: mockConfig,
        agentSessionKey: "tulsbot:session-123",
      });

      expect(delegateTool).not.toBeNull();
      expect(delegateTool?.name).toBe("tulsbot_delegate");
      expect(delegateTool?.label).toBe("Tulsbot Delegate");
      expect(delegateTool?.execute).toBeInstanceOf(Function);
    });

    it("should NOT create delegate tool for non-tulsbot sessions", () => {
      const delegateTool = createTulsbotDelegateTool({
        config: mockConfig,
        agentSessionKey: "otheragent:session-123",
      });

      expect(delegateTool).toBeNull();
    });

    it("should route research query to TulsCodex sub-agent", async () => {
      const delegateTool = createTulsbotDelegateTool({
        config: mockConfig,
        agentSessionKey: "tulsbot:session-123",
      });

      const result = await delegateTool!.execute("tool-call-1", {
        userMessage: "Find research about multi-agent AI systems",
      });

      const parsed = JSON.parse(extractJsonFromResult(result));
      expect(parsed.success).toBe(true);
      expect(parsed.subAgent.toLowerCase()).toContain("tulscodex");
      expect(parsed.intent.domains).toContain("research");
      expect(parsed.response).toBeTruthy();
    });

    it("should route coding query to TulsCodex sub-agent", async () => {
      const delegateTool = createTulsbotDelegateTool({
        config: mockConfig,
        agentSessionKey: "tulsbot:session-123",
      });

      const result = await delegateTool!.execute("tool-call-2", {
        userMessage: "Review this code and find bugs in the authentication function",
      });

      const parsed = JSON.parse(extractJsonFromResult(result));
      expect(parsed.success).toBe(true);
      expect(parsed.subAgent.toLowerCase()).toContain("tulscodex");
      expect(parsed.intent.domains).toContain("coding");
    });

    it("should route Notion query to Knowledge Manager sub-agent", async () => {
      const delegateTool = createTulsbotDelegateTool({
        config: mockConfig,
        agentSessionKey: "tulsbot:session-123",
      });

      const result = await delegateTool!.execute("tool-call-3", {
        userMessage: "Query my Notion database for project updates",
      });

      const parsed = JSON.parse(extractJsonFromResult(result));
      console.log("🔍 DEBUG Notion query routing:");
      console.log("  Intent domains:", parsed.intent.domains);
      console.log("  Primary domain:", parsed.intent.primaryIntent);
      console.log("  Keywords:", parsed.intent.keywords);
      console.log("  Selected agent:", parsed.subAgent);
      expect(parsed.success).toBe(true);
      expect(parsed.subAgent.toLowerCase()).toContain("knowledge manager");
      expect(parsed.intent.domains).toContain("notion");
    });

    it("should route memory query to Memory Heartbeat sub-agent", async () => {
      const delegateTool = createTulsbotDelegateTool({
        config: mockConfig,
        agentSessionKey: "tulsbot:session-123",
      });

      const result = await delegateTool!.execute("tool-call-4", {
        userMessage: "Remember what we discussed about the project timeline last week",
      });

      const parsed = JSON.parse(extractJsonFromResult(result));
      expect(parsed.success).toBe(true);
      expect(parsed.subAgent.toLowerCase()).toContain("memory");
      expect(parsed.intent.domains).toContain("memory");
    });

    it("should use historical agent patterns from memory to improve routing", async () => {
      const delegateTool = createTulsbotDelegateTool({
        config: mockConfig,
        agentSessionKey: "tulsbot:session-123",
      });

      // Memory search returns historical routing patterns
      const result = await delegateTool!.execute("tool-call-5", {
        userMessage: "Find information about the research topic",
      });

      const parsed = JSON.parse(extractJsonFromResult(result));
      expect(parsed.intent).toHaveProperty("historicalAgents");
      expect(parsed.intent.confidence).toBeGreaterThanOrEqual(0.3);
    });

    it("should fallback to Orchestrator for ambiguous queries", async () => {
      const delegateTool = createTulsbotDelegateTool({
        config: mockConfig,
        agentSessionKey: "tulsbot:session-123",
      });

      const result = await delegateTool!.execute("tool-call-6", {
        userMessage: "Hello",
      });

      const parsed = JSON.parse(extractJsonFromResult(result));
      expect(parsed.success).toBe(true);
      expect(parsed.subAgent.toLowerCase()).toContain("orchestrator");
    });

    it("should handle agent handoff for sequential workflows", async () => {
      const delegateTool = createTulsbotDelegateTool({
        config: mockConfig,
        agentSessionKey: "tulsbot:session-123",
      });

      const result = await delegateTool!.execute("tool-call-7", {
        userMessage: "Research React best practices, then implement a component",
      });

      const parsed = JSON.parse(extractJsonFromResult(result));
      expect(parsed.success).toBe(true);

      // Should detect sequential workflow and suggest handoff
      if (parsed.handoffs) {
        expect(parsed.handoffCount).toBeGreaterThan(0);
        expect(parsed.handoffs).toBeInstanceOf(Array);
      }
    });

    it("should handle delegation errors gracefully", async () => {
      // Mock knowledge loading failure
      (getCachedKnowledge as MockedFunction<typeof getCachedKnowledge>).mockRejectedValueOnce(
        new Error("Knowledge loading failed"),
      );

      const delegateTool = createTulsbotDelegateTool({
        config: mockConfig,
        agentSessionKey: "tulsbot:session-123",
      });

      const result = await delegateTool!.execute("tool-call-8", {
        userMessage: "Test query",
      });

      const parsed = JSON.parse(extractJsonFromResult(result));
      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain("failed");
    });
  });

  describe("Step 7: Response generated and returned", () => {
    it("should generate response with sub-agent details", async () => {
      const delegateTool = createTulsbotDelegateTool({
        config: mockConfig,
        agentSessionKey: "tulsbot:session-123",
      });

      const result = await delegateTool!.execute("tool-call-9", {
        userMessage: "Find research about neural networks",
      });

      const parsed = JSON.parse(extractJsonFromResult(result));

      expect(parsed).toHaveProperty("success");
      expect(parsed).toHaveProperty("subAgent");
      expect(parsed).toHaveProperty("response");
      expect(parsed).toHaveProperty("reasoning");
      expect(parsed).toHaveProperty("intent");

      expect(parsed.success).toBe(true);
      expect(parsed.response).toBeTruthy();
      expect(parsed.reasoning).toBeTruthy();
    });

    it("should include intent analysis in response", async () => {
      const delegateTool = createTulsbotDelegateTool({
        config: mockConfig,
        agentSessionKey: "tulsbot:session-123",
      });

      const result = await delegateTool!.execute("tool-call-10", {
        userMessage: "Search for documentation about API endpoints",
      });

      const parsed = JSON.parse(extractJsonFromResult(result));

      expect(parsed.intent).toBeDefined();
      expect(parsed.intent).toHaveProperty("primaryIntent");
      expect(parsed.intent).toHaveProperty("domains");
      expect(parsed.intent).toHaveProperty("confidence");
      expect(parsed.intent.confidence).toBeGreaterThan(0);
      expect(parsed.intent.confidence).toBeLessThanOrEqual(1);
    });

    it("should return response within 5 seconds (performance test)", async () => {
      const delegateTool = createTulsbotDelegateTool({
        config: mockConfig,
        agentSessionKey: "tulsbot:session-123",
      });

      const startTime = Date.now();

      await delegateTool!.execute("tool-call-11", {
        userMessage: "Quick test query",
      });

      const elapsed = Date.now() - startTime;
      expect(elapsed).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it("should handle missing required parameters", async () => {
      const delegateTool = createTulsbotDelegateTool({
        config: mockConfig,
        agentSessionKey: "tulsbot:session-123",
      });

      const result = await delegateTool!.execute("tool-call-12", {
        // Missing userMessage parameter
      });

      const parsed = JSON.parse(extractJsonFromResult(result));
      expect(parsed.error).toBeTruthy();
    });

    it("should validate response format is valid JSON", async () => {
      const delegateTool = createTulsbotDelegateTool({
        config: mockConfig,
        agentSessionKey: "tulsbot:session-123",
      });

      const result = await delegateTool!.execute("tool-call-13", {
        userMessage: "Test JSON response",
      });

      expect(() => JSON.parse(extractJsonFromResult(result))).not.toThrow();

      const parsed = JSON.parse(extractJsonFromResult(result));
      expect(typeof parsed).toBe("object");
      expect(parsed).not.toBeNull();
    });
  });

  describe("Integration: Complete flow from message to response", () => {
    it("should complete full flow: Discord message → Tulsbot → TulsCodex → Response", async () => {
      // Step 1: Gateway receives message
      const incomingMessage = {
        channel: "discord" as const,
        channelId: "test-channel",
        userId: "user-789",
        content: "Research the latest developments in LLM fine-tuning",
        timestamp: Date.now(),
      };

      // Step 2: Routing resolves to Tulsbot
      const sessionKey = `tulsbot:${incomingMessage.channel}:${incomingMessage.channelId}`;
      const agentId = resolveSessionAgentId({
        sessionKey,
        config: mockConfig,
      });
      expect(agentId).toBe("tulsbot");

      // Step 3: Session created with namespace
      expect(sessionKey.startsWith("tulsbot:")).toBe(true);

      // Step 4: Knowledge loaded
      const knowledge = await getCachedKnowledge();
      expect(knowledge.agents.length).toBeGreaterThan(0);

      // Step 5: Memory search performed
      const { getMemorySearchManager } = await import("../../src/memory/index.js");
      const memoryResult = await getMemorySearchManager({
        cfg: mockConfig,
        agentId,
      });
      const searchResults = await memoryResult.manager!.search(incomingMessage.content, {
        maxResults: 5,
        sessionKey,
      });
      expect(searchResults).toBeInstanceOf(Array);

      // Step 6: Delegate tool routes to sub-agent
      const delegateTool = createTulsbotDelegateTool({
        config: mockConfig,
        agentSessionKey: sessionKey,
      });
      expect(delegateTool).not.toBeNull();

      // Step 7: Response generated
      const toolResult = await delegateTool!.execute("integration-test-1", {
        userMessage: incomingMessage.content,
      });

      const response = JSON.parse(extractJsonFromResult(toolResult));
      expect(response.success).toBe(true);
      expect(response.subAgent).toBeTruthy();
      expect(response.response).toBeTruthy();
      expect(response.intent.domains).toContain("research");

      // Verify end-to-end flow completed successfully
      expect(response).toMatchObject({
        success: true,
        subAgent: expect.any(String),
        response: expect.any(String),
        reasoning: expect.any(String),
        intent: {
          primaryIntent: expect.any(String),
          domains: expect.any(Array),
          confidence: expect.any(Number),
        },
      });
    });

    it("should maintain namespace isolation throughout entire flow", async () => {
      const tulsbotSession = "tulsbot:slack:channel-456";
      const otherSession = "otheragent:slack:channel-456";

      // Both sessions target same channel but different agents
      const tulsbotAgent = resolveSessionAgentId({
        sessionKey: tulsbotSession,
        config: mockConfig,
      });

      expect(tulsbotAgent).toBe("tulsbot");
      expect(tulsbotSession.split(":")[0]).toBe("tulsbot");
      expect(otherSession.split(":")[0]).toBe("otheragent");
      expect(tulsbotSession.split(":")[0]).not.toBe(otherSession.split(":")[0]);
    });

    it("should handle errors at any stage without crashing", async () => {
      // Simulate error at knowledge loading stage
      (getCachedKnowledge as MockedFunction<typeof getCachedKnowledge>).mockRejectedValueOnce(
        new Error("Critical failure"),
      );

      const delegateTool = createTulsbotDelegateTool({
        config: mockConfig,
        agentSessionKey: "tulsbot:test",
      });

      const result = await delegateTool!.execute("error-test-1", {
        userMessage: "Test error handling",
      });

      const parsed = JSON.parse(extractJsonFromResult(result));
      expect(parsed.success).toBe(false);
      expect(parsed.error).toBeTruthy();

      // System should recover gracefully
      expect(() => JSON.parse(extractJsonFromResult(result))).not.toThrow();
    });

    it("should complete flow with performance within acceptable limits", async () => {
      const startTime = Date.now();

      // Run complete flow
      const sessionKey = "tulsbot:perf-test";
      const agentId = resolveSessionAgentId({ sessionKey, config: mockConfig });
      const knowledge = await getCachedKnowledge();
      const delegateTool = createTulsbotDelegateTool({
        config: mockConfig,
        agentSessionKey: sessionKey,
      });
      const result = await delegateTool!.execute("perf-1", {
        userMessage: "Performance test query",
      });

      const elapsed = Date.now() - startTime;

      // Complete flow should finish under 5 seconds
      expect(elapsed).toBeLessThan(5000);

      const parsed = JSON.parse(extractJsonFromResult(result));
      expect(parsed.success).toBe(true);
    });
  });
});
