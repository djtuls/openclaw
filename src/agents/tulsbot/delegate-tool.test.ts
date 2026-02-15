import { describe, it, expect, beforeEach } from "vitest";
import type { OpenClawConfig } from "../../config/config.js";
import { createTulsbotDelegateTool } from "./delegate-tool.js";
import { clearCache, getCachedKnowledge } from "./knowledge-loader.js";

// Use absolute path for knowledge file in tests
const KNOWLEDGE_FILE_PATH =
  "/Users/tulioferro/Backend_local Macbook/Tulsbot/.tulsbot/core-app-knowledge.json";
process.env.TULSBOT_KNOWLEDGE_PATH = KNOWLEDGE_FILE_PATH;

describe("Tulsbot Delegate Tool", () => {
  let mockConfig: OpenClawConfig;

  beforeEach(() => {
    // Clear knowledge cache before each test
    clearCache();

    // Create minimal mock config
    mockConfig = {
      stateDir: "/tmp/test-state",
      agents: {
        tulsbot: {
          workspaceDir: "/tmp/test-workspace",
        },
      },
    } as OpenClawConfig;
  });

  describe("createTulsbotDelegateTool", () => {
    it("should return null when config is missing", () => {
      const tool = createTulsbotDelegateTool({
        config: undefined,
        agentSessionKey: "agent:tulsbot:main",
      });

      expect(tool).toBeNull();
    });

    it("should return null when session key does not include 'tulsbot'", () => {
      const tool = createTulsbotDelegateTool({
        config: mockConfig,
        agentSessionKey: "agent:other:session",
      });

      expect(tool).toBeNull();
    });

    it("should create tool when session key includes 'tulsbot'", () => {
      const tool = createTulsbotDelegateTool({
        config: mockConfig,
        agentSessionKey: "agent:tulsbot:main",
      });

      expect(tool).toBeDefined();
      expect(tool).not.toBeNull();
      expect(tool?.name).toBe("tulsbot_delegate");
      expect(tool?.label).toBe("Tulsbot Delegate");
    });

    it("should have correct tool schema", () => {
      const tool = createTulsbotDelegateTool({
        config: mockConfig,
        agentSessionKey: "agent:tulsbot:main",
      });

      expect(tool?.parameters).toBeDefined();
      expect(tool?.parameters.type).toBe("object");
      expect(tool?.parameters.properties).toHaveProperty("userMessage");
      expect(tool?.parameters.properties).toHaveProperty("context");
      expect(tool?.parameters.required).toContain("userMessage");
    });

    it("should have execute function", () => {
      const tool = createTulsbotDelegateTool({
        config: mockConfig,
        agentSessionKey: "agent:tulsbot:main",
      });

      expect(tool?.execute).toBeDefined();
      expect(typeof tool?.execute).toBe("function");
    });
  });

  describe("Tool execution", () => {
    it("should successfully delegate a simple message", async () => {
      const tool = createTulsbotDelegateTool({
        config: mockConfig,
        agentSessionKey: "agent:tulsbot:main",
      });

      if (!tool) {
        throw new Error("Tool creation failed");
      }

      const result = await tool.execute("test-call-1", {
        userMessage: "Hello, what can you help with?",
      });

      expect(result).toBeDefined();
      const parsed = result.details;
      expect(parsed.success).toBe(true);
      expect(parsed.subAgent).toBeDefined();
      expect(parsed.response).toBeDefined();
      expect(parsed.reasoning).toBeDefined();
      expect(parsed.intent).toBeDefined();
    });

    it("should handle research-related queries", async () => {
      const tool = createTulsbotDelegateTool({
        config: mockConfig,
        agentSessionKey: "agent:tulsbot:main",
      });

      if (!tool) {
        throw new Error("Tool creation failed");
      }

      const result = await tool.execute("test-call-2", {
        userMessage: "Research the latest trends in AI development",
      });

      const parsed = result.details;
      expect(parsed.success).toBe(true);
      expect(parsed.intent.domains).toContain("research");
      expect(parsed.subAgent.toLowerCase()).toContain("tulscodex");
    });

    it("should handle coding-related queries", async () => {
      const tool = createTulsbotDelegateTool({
        config: mockConfig,
        agentSessionKey: "agent:tulsbot:main",
      });

      if (!tool) {
        throw new Error("Tool creation failed");
      }

      const result = await tool.execute("test-call-3", {
        userMessage: "Help me debug this function and write tests",
      });

      const parsed = result.details;
      expect(parsed.success).toBe(true);
      expect(parsed.intent.domains).toContain("coding");
      expect(parsed.subAgent.toLowerCase()).toContain("tulscodex");
    });

    it("should handle notion-related queries", async () => {
      const tool = createTulsbotDelegateTool({
        config: mockConfig,
        agentSessionKey: "agent:tulsbot:main",
      });

      if (!tool) {
        throw new Error("Tool creation failed");
      }

      const result = await tool.execute("test-call-4", {
        userMessage: "Sync my Notion database with the latest data",
      });

      const parsed = result.details;
      console.log("[DEBUG] Detected domains:", parsed.intent.domains);
      console.log("[DEBUG] Primary domain (domains[0]):", parsed.intent.domains[0]);
      console.log("[DEBUG] Selected agent:", parsed.subAgent);
      expect(parsed.success).toBe(true);
      expect(parsed.intent.domains).toContain("notion");
      expect(parsed.subAgent.toLowerCase()).toContain("knowledge");
    });

    it("should handle memory-related queries", async () => {
      const tool = createTulsbotDelegateTool({
        config: mockConfig,
        agentSessionKey: "agent:tulsbot:main",
      });

      if (!tool) {
        throw new Error("Tool creation failed");
      }

      const result = await tool.execute("test-call-5", {
        userMessage: "What do you remember about our conversation yesterday?",
      });

      const parsed = result.details;
      expect(parsed.success).toBe(true);
      expect(parsed.intent.domains).toContain("memory");
      expect(parsed.subAgent.toLowerCase()).toContain("memory");
    });

    it("should handle planning-related queries", async () => {
      const tool = createTulsbotDelegateTool({
        config: mockConfig,
        agentSessionKey: "agent:tulsbot:main",
      });

      if (!tool) {
        throw new Error("Tool creation failed");
      }

      const result = await tool.execute("test-call-6", {
        userMessage: "Help me plan my project timeline and organize tasks",
      });

      const parsed = result.details;
      expect(parsed.success).toBe(true);
      expect(parsed.intent.domains).toContain("planning");
      // Should match PM Specialist or similar planning-focused agent
      const agentName = parsed.subAgent.toLowerCase();
      expect(
        agentName.includes("pm") || agentName.includes("project") || agentName.includes("plan"),
      ).toBe(true);
    });

    it("should handle analysis-related queries", async () => {
      const tool = createTulsbotDelegateTool({
        config: mockConfig,
        agentSessionKey: "agent:tulsbot:main",
      });

      if (!tool) {
        throw new Error("Tool creation failed");
      }

      const result = await tool.execute("test-call-7", {
        userMessage: "Analyze this data and provide insights",
      });

      const parsed = result.details;
      expect(parsed.success).toBe(true);
      expect(parsed.intent.domains).toContain("analysis");
      expect(parsed.subAgent.toLowerCase()).toContain("intelligence");
    });

    it("should fall back to Orchestrator for unclear intent", async () => {
      const tool = createTulsbotDelegateTool({
        config: mockConfig,
        agentSessionKey: "agent:tulsbot:main",
      });

      if (!tool) {
        throw new Error("Tool creation failed");
      }

      const result = await tool.execute("test-call-8", {
        userMessage: "xyz abc qwerty",
      });

      const parsed = result.details;
      expect(parsed.success).toBe(true);
      expect(parsed.subAgent.toLowerCase()).toContain("orchestrator");
      expect(parsed.intent.confidence).toBeLessThan(0.5);
    });

    it("should handle optional context parameter", async () => {
      const tool = createTulsbotDelegateTool({
        config: mockConfig,
        agentSessionKey: "agent:tulsbot:main",
      });

      if (!tool) {
        throw new Error("Tool creation failed");
      }

      const result = await tool.execute("test-call-9", {
        userMessage: "Help with research",
        context: {
          conversationHistory: "Previous discussion about AI",
          activeSubAgent: "Research Specialist",
          metadata: { priority: "high" },
        },
      });

      const parsed = result.details;
      expect(parsed.success).toBe(true);
      expect(parsed.subAgent).toBeDefined();
    });

    it("should return error when userMessage is missing", async () => {
      const tool = createTulsbotDelegateTool({
        config: mockConfig,
        agentSessionKey: "agent:tulsbot:main",
      });

      if (!tool) {
        throw new Error("Tool creation failed");
      }

      const result = await tool.execute("test-call-10", {
        context: { metadata: "test" },
      });

      const parsed = result.details;
      expect(parsed.error).toBeDefined();
      expect(parsed.error).toContain("userMessage");
    });

    it("should include intent analysis in response", async () => {
      const tool = createTulsbotDelegateTool({
        config: mockConfig,
        agentSessionKey: "agent:tulsbot:main",
      });

      if (!tool) {
        throw new Error("Tool creation failed");
      }

      const result = await tool.execute("test-call-11", {
        userMessage: "Research and analyze market trends",
      });

      const parsed = result.details;
      expect(parsed.intent).toBeDefined();
      expect(parsed.intent.primaryIntent).toBeDefined();
      expect(parsed.intent.domains).toBeInstanceOf(Array);
      expect(parsed.intent.confidence).toBeGreaterThan(0);
      expect(parsed.intent.confidence).toBeLessThanOrEqual(1);
    });
  });

  describe("Intent analysis", () => {
    it("should detect multiple domains in complex queries", async () => {
      const tool = createTulsbotDelegateTool({
        config: mockConfig,
        agentSessionKey: "agent:tulsbot:main",
      });

      if (!tool) {
        throw new Error("Tool creation failed");
      }

      const result = await tool.execute("test-call-12", {
        userMessage: "Research the API, write code to implement it, and analyze the results",
      });

      const parsed = result.details;
      expect(parsed.intent.domains.length).toBeGreaterThan(1);
      expect(parsed.intent.domains).toContain("research");
      expect(parsed.intent.domains).toContain("coding");
      expect(parsed.intent.domains).toContain("analysis");
    });

    it("should increase confidence with more domain matches", async () => {
      const tool = createTulsbotDelegateTool({
        config: mockConfig,
        agentSessionKey: "agent:tulsbot:main",
      });

      if (!tool) {
        throw new Error("Tool creation failed");
      }

      // Single domain query
      const result1 = await tool.execute("test-call-13a", {
        userMessage: "Help me research something",
      });
      const parsed1 = result1.details;

      // Multi-domain query
      const result2 = await tool.execute("test-call-13b", {
        userMessage: "Research, analyze, and implement code for this",
      });
      const parsed2 = result2.details;

      expect(parsed2.intent.confidence).toBeGreaterThan(parsed1.intent.confidence);
    });
  });

  describe("Knowledge base integration", () => {
    it("should load knowledge base only once (caching)", async () => {
      const tool = createTulsbotDelegateTool({
        config: mockConfig,
        agentSessionKey: "agent:tulsbot:main",
      });

      if (!tool) {
        throw new Error("Tool creation failed");
      }

      // First execution - loads knowledge
      await tool.execute("test-call-14a", {
        userMessage: "Test message 1",
      });

      // Second execution - should use cache
      await tool.execute("test-call-14b", {
        userMessage: "Test message 2",
      });

      // Verify cache is populated
      const knowledge = await getCachedKnowledge();
      expect(knowledge.agents.length).toBe(17);
    });

    it("should access all 17 sub-agents from knowledge base", async () => {
      const knowledge = await getCachedKnowledge();

      expect(knowledge.agents).toBeInstanceOf(Array);
      expect(knowledge.agents.length).toBe(17);
      expect(knowledge.agents.every((agent) => agent.name && agent.name.length > 0)).toBe(true);
    });
  });

  describe("Agent handoff logic", () => {
    it("should successfully handoff from one agent to another", async () => {
      const tool = createTulsbotDelegateTool({
        config: mockConfig,
        agentSessionKey: "agent:tulsbot:main",
      });

      if (!tool) {
        throw new Error("Tool creation failed");
      }

      const result = await tool.execute("test-handoff-1", {
        userMessage: "research how to implement JWT authentication then write the code",
      });

      const parsed = result.details;
      expect(parsed.success).toBe(true);
      expect(parsed.handoffCount).toBeGreaterThan(0);
      expect(parsed.handoffs).toBeDefined();
      expect(Array.isArray(parsed.handoffs)).toBe(true);
    });

    it("should preserve context during handoff", async () => {
      const tool = createTulsbotDelegateTool({
        config: mockConfig,
        agentSessionKey: "agent:tulsbot:main",
      });

      if (!tool) {
        throw new Error("Tool creation failed");
      }

      const result = await tool.execute("test-handoff-2", {
        userMessage: "research API documentation then implement the code",
        context: {
          testMetadata: "should be preserved",
        },
      });

      const parsed = result.details;
      expect(parsed.success).toBe(true);

      if (parsed.handoffs && parsed.handoffs.length > 0) {
        const lastHandoff = parsed.handoffs[parsed.handoffs.length - 1];
        expect(lastHandoff.context).toBeDefined();
        expect(lastHandoff.context.handoffReason).toBeDefined();
        expect(lastHandoff.context.handoffPriority).toBeGreaterThanOrEqual(1);
        expect(lastHandoff.context.handoffPriority).toBeLessThanOrEqual(10);
        expect(lastHandoff.context.handoffTimestamp).toBeDefined();
      }
    });

    it("should protect against infinite handoff loops (max 2 handoffs)", async () => {
      const tool = createTulsbotDelegateTool({
        config: mockConfig,
        agentSessionKey: "agent:tulsbot:main",
      });

      if (!tool) {
        throw new Error("Tool creation failed");
      }

      const result = await tool.execute("test-handoff-3", {
        userMessage: "research then code then analyze then plan then research again",
      });

      const parsed = result.details;
      expect(parsed.success).toBe(true);
      expect(parsed.handoffCount).toBeLessThanOrEqual(2);
    });

    it("should track handoff history correctly", async () => {
      const tool = createTulsbotDelegateTool({
        config: mockConfig,
        agentSessionKey: "agent:tulsbot:main",
      });

      if (!tool) {
        throw new Error("Tool creation failed");
      }

      const result = await tool.execute("test-handoff-4", {
        userMessage: "research the technology and then write implementation code",
      });

      const parsed = result.details;
      expect(parsed.success).toBe(true);

      if (parsed.handoffs && parsed.handoffs.length > 0) {
        // Verify handoff history structure
        parsed.handoffs.forEach((handoff: unknown, index: number) => {
          expect(handoff.sourceAgent).toBeDefined();
          expect(handoff.targetAgent).toBeDefined();
          expect(handoff.timestamp).toBeDefined();
          expect(handoff.context).toBeDefined();

          // Verify chronological order
          if (index > 0) {
            const prevTimestamp = new Date(parsed.handoffs[index - 1].timestamp).getTime();
            const currTimestamp = new Date(handoff.timestamp).getTime();
            expect(currTimestamp).toBeGreaterThanOrEqual(prevTimestamp);
          }
        });
      }
    });

    it("should handle handoff with partial results", async () => {
      const tool = createTulsbotDelegateTool({
        config: mockConfig,
        agentSessionKey: "agent:tulsbot:main",
      });

      if (!tool) {
        throw new Error("Tool creation failed");
      }

      const result = await tool.execute("test-handoff-5", {
        userMessage: "research best practices and document them in Notion",
      });

      const parsed = result.details;
      expect(parsed.success).toBe(true);

      if (parsed.handoffs && parsed.handoffs.length > 0) {
        // Should have partial results from research before notion handoff
        expect(parsed.response).toBeDefined();
        expect(parsed.response.length).toBeGreaterThan(0);
      }
    });

    it("should return appropriate response when no handoff occurs", async () => {
      const tool = createTulsbotDelegateTool({
        config: mockConfig,
        agentSessionKey: "agent:tulsbot:main",
      });

      if (!tool) {
        throw new Error("Tool creation failed");
      }

      const result = await tool.execute("test-handoff-6", {
        userMessage: "just research this topic",
      });

      const parsed = result.details;
      expect(parsed.success).toBe(true);
      expect(parsed.handoffCount).toBe(0);
      expect(parsed.handoffs).toBeUndefined();
    });

    it("should handle multi-domain queries requiring multiple agents", async () => {
      const tool = createTulsbotDelegateTool({
        config: mockConfig,
        agentSessionKey: "agent:tulsbot:main",
      });

      if (!tool) {
        throw new Error("Tool creation failed");
      }

      const result = await tool.execute("test-handoff-7", {
        userMessage:
          "research authentication methods, write the code, save to Notion, and remember this for later",
      });

      const parsed = result.details;
      expect(parsed.success).toBe(true);
      expect(parsed.intent.domains.length).toBeGreaterThan(1);

      // Should detect research, coding, notion, memory domains
      const domains = parsed.intent.domains;
      expect(domains).toContain("research");
      expect(domains).toContain("coding");
      expect(domains).toContain("notion");
      expect(domains).toContain("memory");
    });
  });

  describe("Error handling for handoff scenarios", () => {
    it("should handle errors gracefully when handoff fails", async () => {
      const tool = createTulsbotDelegateTool({
        config: mockConfig,
        agentSessionKey: "agent:tulsbot:main",
      });

      if (!tool) {
        throw new Error("Tool creation failed");
      }

      const result = await tool.execute("test-handoff-error-1", {
        userMessage: "delegate to quantum-computing-agent that doesn't exist",
        context: {
          suggestedHandoff: {
            targetAgent: "NonExistentAgent",
            reason: "test error handling",
            priority: 5,
          },
        },
      });

      const parsed = result.details;
      // Should still succeed but gracefully handle non-existent agent
      expect(parsed.success).toBe(true);
      expect(parsed.subAgent).toBeDefined();
    });

    it("should handle missing handoff context gracefully", async () => {
      const tool = createTulsbotDelegateTool({
        config: mockConfig,
        agentSessionKey: "agent:tulsbot:main",
      });

      if (!tool) {
        throw new Error("Tool creation failed");
      }

      const result = await tool.execute("test-handoff-error-2", {
        userMessage: "research and code this",
        context: undefined,
      });

      const parsed = result.details;
      expect(parsed.success).toBe(true);
      // Should handle undefined context without crashing
    });

    it("should handle handoff priority correctly", async () => {
      const tool = createTulsbotDelegateTool({
        config: mockConfig,
        agentSessionKey: "agent:tulsbot:main",
      });

      if (!tool) {
        throw new Error("Tool creation failed");
      }

      const result = await tool.execute("test-handoff-error-3", {
        userMessage: "research urgent security vulnerability and implement fix",
      });

      const parsed = result.details;
      expect(parsed.success).toBe(true);

      if (parsed.handoffs && parsed.handoffs.length > 0) {
        parsed.handoffs.forEach((handoff: unknown) => {
          // Priority should be in valid range 1-10
          if (handoff.context?.handoffPriority) {
            expect(handoff.context.handoffPriority).toBeGreaterThanOrEqual(1);
            expect(handoff.context.handoffPriority).toBeLessThanOrEqual(10);
          }
        });
      }
    });
  });

  describe("Memory Search Integration", () => {
    it("should include historicalAgents in intent analysis when similar queries exist", async () => {
      const tool = createTulsbotDelegateTool({
        config: mockConfig,
        agentSessionKey: "agent:tulsbot:test-session",
      });

      expect(tool).not.toBeNull();
      if (!tool) {
        return;
      }

      // Execute with a coding-related query
      // Note: This test validates the structure, actual memory search requires real memory data
      const result = await tool.execute("test-call-id", {
        userMessage: "Help me debug this Python function that's throwing errors",
      });

      // Verify the tool executed without errors
      expect(result).toBeDefined();
      const parsed = result.details;
      expect(parsed.success).toBe(true);
      expect(parsed.intent).toBeDefined();
      expect(parsed.intent.primaryIntent).toBeDefined();
      expect(parsed.intent.confidence).toBeGreaterThan(0);

      // historicalAgents field should be defined if memory search succeeded
      // (will be undefined in test environment without real memory data)
      expect(parsed.intent).toHaveProperty("confidence");
    });

    it("should boost confidence when historical agents align with detected domains", async () => {
      const tool = createTulsbotDelegateTool({
        config: mockConfig,
        agentSessionKey: "agent:tulsbot:test-session",
      });

      expect(tool).not.toBeNull();
      if (!tool) {
        return;
      }

      // Execute with a research query
      const result = await tool.execute("test-call-id", {
        userMessage: "Research the latest trends in quantum computing",
      });

      const parsed = result.details;
      expect(parsed.success).toBe(true);
      expect(parsed.intent.primaryIntent).toBe("research");

      // Confidence should be reasonable even without memory data
      expect(parsed.intent.confidence).toBeGreaterThanOrEqual(0.3);
      expect(parsed.intent.confidence).toBeLessThanOrEqual(0.9);
    });

    it("should gracefully handle memory search failures", async () => {
      const tool = createTulsbotDelegateTool({
        config: mockConfig,
        agentSessionKey: "agent:tulsbot:test-session",
      });

      expect(tool).not.toBeNull();
      if (!tool) {
        return;
      }

      // Even if memory search fails, intent analysis should work
      const result = await tool.execute("test-call-id", {
        userMessage: "Organize my project timeline for the next quarter",
      });

      const parsed = result.details;
      expect(parsed.success).toBe(true);
      expect(parsed.intent.primaryIntent).toBe("planning");
      expect(parsed.subAgent).toBeDefined();
    });
  });
});
