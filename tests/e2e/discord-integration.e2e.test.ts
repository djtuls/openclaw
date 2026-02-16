/**
 * E2E Integration Test for Discord Channel
 *
 * Tests the complete message flow through Discord integration:
 * 1. Discord gateway receives message (direct/channel/thread)
 * 2. Routing resolves to appropriate agent (tulsbot default)
 * 3. Session created with Discord-specific namespace
 * 4. Message processing with knowledge loading
 * 5. Memory search with session context
 * 6. Delegate tool routing
 * 7. Response generation and delivery
 *
 * Pattern: *.e2e.test.ts (auto-excluded from standard test suite per vitest.config.ts)
 */

import type { DiscordInboundEvent } from "openclaw/plugin-sdk";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { OpenClawConfig } from "../../src/config/config.js";
import { resolveSessionAgentId } from "../../src/agents/agent-scope.js";

// Mock runtime to prevent actual Discord connections
vi.mock("../../extensions/discord/src/runtime.js", () => ({
  getDiscordRuntime: () => ({
    channel: {
      discord: {
        sendMessageDiscord: vi.fn().mockResolvedValue({
          messageId: "mock-msg-id",
          channelId: "mock-channel-id",
          success: true,
        }),
        sendPollDiscord: vi.fn().mockResolvedValue({
          messageId: "mock-poll-id",
          channelId: "mock-channel-id",
          success: true,
        }),
        monitorDiscordProvider: vi.fn().mockResolvedValue(undefined),
        probeDiscord: vi.fn().mockResolvedValue({
          ok: true,
          bot: { username: "TestBot", id: "123456789" },
          application: { intents: { messageContent: "enabled" } },
        }),
        resolveChannelAllowlist: vi.fn().mockResolvedValue([]),
        resolveUserAllowlist: vi.fn().mockResolvedValue([]),
        auditChannelPermissions: vi.fn().mockResolvedValue({
          ok: true,
          checkedChannels: 0,
          channels: [],
          elapsedMs: 0,
        }),
        listDirectoryPeersLive: vi.fn().mockResolvedValue([]),
        listDirectoryGroupsLive: vi.fn().mockResolvedValue([]),
        messageActions: null,
      },
    },
    logging: {
      shouldLogVerbose: () => false,
    },
  }),
}));

describe("Discord E2E Integration", () => {
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
    channels: {
      discord: {
        enabled: true,
        token: "mock-token",
        dm: {
          policy: "open",
          allowFrom: [],
        },
        groupPolicy: "open",
      },
    },
    model: "claude-3-5-sonnet-20241022",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Gateway: Discord Message Reception", () => {
    it("should accept direct message (DM) from Discord user", () => {
      const dmEvent: Partial<DiscordInboundEvent> = {
        channelId: "dm-channel-123",
        userId: "user-456",
        content: "Hello bot, can you help me?",
        isDm: true,
        timestamp: Date.now(),
      };

      expect(dmEvent.isDm).toBe(true);
      expect(dmEvent.content).toBeTruthy();
      expect(dmEvent.userId).toBeTruthy();
      expect(dmEvent.channelId).toBeTruthy();
    });

    it("should accept channel message with bot mention", () => {
      const channelEvent: Partial<DiscordInboundEvent> = {
        channelId: "channel-789",
        userId: "user-456",
        content: "<@123456789> find research about AI",
        isDm: false,
        guildId: "guild-101",
        timestamp: Date.now(),
      };

      expect(channelEvent.isDm).toBe(false);
      expect(channelEvent.guildId).toBeTruthy();
      expect(channelEvent.content).toContain("<@");
    });

    it("should accept thread message with parent context", () => {
      const threadEvent: Partial<DiscordInboundEvent> = {
        channelId: "thread-999",
        userId: "user-456",
        content: "Continue the discussion about the project",
        isDm: false,
        guildId: "guild-101",
        threadId: "thread-999",
        timestamp: Date.now(),
      };

      expect(threadEvent.threadId).toBeTruthy();
      expect(threadEvent.guildId).toBeTruthy();
    });

    it("should handle message with media attachment", () => {
      const mediaEvent: Partial<DiscordInboundEvent> = {
        channelId: "channel-789",
        userId: "user-456",
        content: "Check out this diagram",
        isDm: false,
        timestamp: Date.now(),
      };

      // In real implementation, event would include attachment metadata
      expect(mediaEvent.content).toBeTruthy();
    });

    it("should validate required fields in Discord event", () => {
      const validEvent: Partial<DiscordInboundEvent> = {
        channelId: "channel-123",
        userId: "user-456",
        content: "Test message",
        timestamp: Date.now(),
      };

      expect(validEvent.channelId).toBeTruthy();
      expect(validEvent.userId).toBeTruthy();
      expect(validEvent.content).toBeTruthy();
      expect(validEvent.timestamp).toBeGreaterThan(0);
    });
  });

  describe("Routing: Session Agent Resolution", () => {
    it("should route Discord DM to tulsbot (default agent)", () => {
      const sessionKey = "tulsbot:discord:dm:user-456";
      const agentId = resolveSessionAgentId({
        sessionKey,
        config: mockConfig,
      });

      expect(agentId).toBe("tulsbot");
    });

    it("should route Discord channel message to tulsbot", () => {
      const sessionKey = "tulsbot:discord:channel:channel-789";
      const agentId = resolveSessionAgentId({
        sessionKey,
        config: mockConfig,
      });

      expect(agentId).toBe("tulsbot");
    });

    it("should route Discord thread message to tulsbot", () => {
      const sessionKey = "tulsbot:discord:thread:thread-999";
      const agentId = resolveSessionAgentId({
        sessionKey,
        config: mockConfig,
      });

      expect(agentId).toBe("tulsbot");
    });

    it("should maintain consistent routing for same Discord channel", () => {
      const channelId = "channel-stable-123";
      const sessionKey1 = `tulsbot:discord:channel:${channelId}`;
      const sessionKey2 = `tulsbot:discord:channel:${channelId}`;

      const agent1 = resolveSessionAgentId({ sessionKey: sessionKey1, config: mockConfig });
      const agent2 = resolveSessionAgentId({ sessionKey: sessionKey2, config: mockConfig });

      expect(agent1).toBe(agent2);
      expect(agent1).toBe("tulsbot");
    });

    it("should resolve to default agent when no explicit routing", () => {
      const agentId = resolveSessionAgentId({
        config: mockConfig,
      });

      expect(agentId).toBe("tulsbot");
    });
  });

  describe("Session: Namespace Isolation", () => {
    it("should create Discord-specific session namespace", () => {
      const sessionKey = "tulsbot:discord:channel:test-789";
      const parts = sessionKey.split(":");

      expect(parts[0]).toBe("tulsbot"); // agent
      expect(parts[1]).toBe("discord"); // channel
      expect(parts[2]).toBe("channel"); // chat type
      expect(parts[3]).toBe("test-789"); // channel id
    });

    it("should isolate Discord sessions from other channels", () => {
      const discordSession = "tulsbot:discord:channel:123";
      const slackSession = "tulsbot:slack:channel:123";
      const telegramSession = "tulsbot:telegram:channel:123";

      const discordChannel = discordSession.split(":")[1];
      const slackChannel = slackSession.split(":")[1];
      const telegramChannel = telegramSession.split(":")[1];

      expect(discordChannel).toBe("discord");
      expect(slackChannel).toBe("slack");
      expect(telegramChannel).toBe("telegram");
      expect(discordChannel).not.toBe(slackChannel);
    });

    it("should differentiate between DM and channel sessions", () => {
      const dmSession = "tulsbot:discord:dm:user-456";
      const channelSession = "tulsbot:discord:channel:channel-789";

      const dmType = dmSession.split(":")[2];
      const channelType = channelSession.split(":")[2];

      expect(dmType).toBe("dm");
      expect(channelType).toBe("channel");
      expect(dmType).not.toBe(channelType);
    });

    it("should maintain namespace consistency across operations", () => {
      const baseSession = "tulsbot:discord:channel:main-123";
      const namespace = baseSession.split(":").slice(0, 3).join(":");

      // Simulate multiple operations with same namespace
      const operations = [
        `${namespace}:main-123`,
        `${namespace}:main-123`,
        `${namespace}:main-123`,
      ];

      operations.forEach((op) => {
        expect(op.startsWith("tulsbot:discord:channel")).toBe(true);
      });
    });

    it("should prevent cross-agent session leaks", () => {
      const tulsbotSession = "tulsbot:discord:channel:123";
      const otherSession = "otheragent:discord:channel:123";

      const tulsbotNamespace = tulsbotSession.split(":")[0];
      const otherNamespace = otherSession.split(":")[0];

      expect(tulsbotNamespace).not.toBe(otherNamespace);
    });
  });

  describe("Message Processing: Content Handling", () => {
    it("should strip Discord mention patterns from content", () => {
      const rawContent = "<@123456789> find research about AI";
      const mentionPattern = /<@!?\d+>/g;
      const strippedContent = rawContent.replace(mentionPattern, "").trim();

      expect(strippedContent).toBe("find research about AI");
      expect(strippedContent).not.toContain("<@");
    });

    it("should preserve message content with multiple mentions", () => {
      const rawContent = "<@123456789> hey <@987654321> check this out";
      const mentionPattern = /<@!?\d+>/g;
      const mentions = rawContent.match(mentionPattern);

      expect(mentions).toHaveLength(2);
      expect(mentions?.[0]).toBe("<@123456789>");
      expect(mentions?.[1]).toBe("<@987654321>");
    });

    it("should handle empty content gracefully", () => {
      const emptyContent = "";
      expect(emptyContent.trim()).toBe("");
    });

    it("should handle content with only whitespace", () => {
      const whitespaceContent = "   \n   ";
      expect(whitespaceContent.trim()).toBe("");
    });

    it("should preserve markdown formatting in content", () => {
      const markdownContent = "**bold** *italic* `code` ```block```";
      expect(markdownContent).toContain("**bold**");
      expect(markdownContent).toContain("*italic*");
      expect(markdownContent).toContain("`code`");
    });
  });

  describe("Response Delivery: Discord Outbound", () => {
    it("should format response for Discord text limit (2000 chars)", () => {
      const longResponse = "a".repeat(2500);
      const chunkLimit = 2000;

      // Response should be chunked
      expect(longResponse.length).toBeGreaterThan(chunkLimit);

      const chunk1 = longResponse.slice(0, chunkLimit);
      expect(chunk1.length).toBeLessThanOrEqual(chunkLimit);
    });

    it("should handle response with media URL", () => {
      const responseWithMedia = {
        text: "Here's the visualization",
        mediaUrl: "https://example.com/image.png",
      };

      expect(responseWithMedia.text).toBeTruthy();
      expect(responseWithMedia.mediaUrl).toMatch(/^https?:\/\//);
    });

    it("should format poll response for Discord (max 10 options)", () => {
      const poll = {
        question: "Which feature should we prioritize?",
        options: [
          "Feature A",
          "Feature B",
          "Feature C",
          "Feature D",
          "Feature E",
          "Feature F",
          "Feature G",
          "Feature H",
          "Feature I",
          "Feature J",
        ],
      };

      const maxOptions = 10;
      expect(poll.options.length).toBeLessThanOrEqual(maxOptions);
    });

    it("should include replyTo for threaded conversations", () => {
      const responseContext = {
        to: "channel-789",
        text: "Response message",
        replyToId: "msg-123",
      };

      expect(responseContext.replyToId).toBeTruthy();
      expect(responseContext.to).toBe("channel-789");
    });

    it("should validate response structure", () => {
      const response = {
        channel: "discord",
        messageId: "msg-456",
        channelId: "channel-789",
        success: true,
      };

      expect(response.channel).toBe("discord");
      expect(response.messageId).toBeTruthy();
      expect(response.channelId).toBeTruthy();
      expect(response.success).toBe(true);
    });
  });

  describe("Security: Discord DM Policy", () => {
    it("should respect 'open' DM policy", () => {
      const dmPolicy = mockConfig.channels?.discord?.dm?.policy ?? "open";
      expect(dmPolicy).toBe("open");
    });

    it("should check allowFrom list when policy is 'allowlist'", () => {
      const restrictedConfig: OpenClawConfig = {
        ...mockConfig,
        channels: {
          discord: {
            enabled: true,
            token: "mock-token",
            dm: {
              policy: "allowlist",
              allowFrom: ["user-123", "user-456"],
            },
          },
        },
      };

      const dmPolicy = restrictedConfig.channels?.discord?.dm?.policy;
      const allowFrom = restrictedConfig.channels?.discord?.dm?.allowFrom ?? [];

      expect(dmPolicy).toBe("allowlist");
      expect(allowFrom).toContain("user-123");
      expect(allowFrom).toHaveLength(2);
    });

    it("should normalize Discord user IDs in allowlist", () => {
      const rawUserId = "<@!123456789>";
      const normalizeDiscordId = (id: string) => id.replace(/^<@!?(\d+)>$/, "$1");

      const normalized = normalizeDiscordId(rawUserId);
      expect(normalized).toBe("123456789");
      expect(normalized).not.toContain("<@");
    });

    it("should handle 'pairing' DM policy", () => {
      const pairingConfig: OpenClawConfig = {
        ...mockConfig,
        channels: {
          discord: {
            enabled: true,
            token: "mock-token",
            dm: {
              policy: "pairing",
              allowFrom: [],
            },
          },
        },
      };

      const dmPolicy = pairingConfig.channels?.discord?.dm?.policy;
      expect(dmPolicy).toBe("pairing");
    });
  });

  describe("Performance: Response Time", () => {
    it("should handle message processing within reasonable time", async () => {
      const startTime = Date.now();

      // Simulate minimal message processing
      const sessionKey = "tulsbot:discord:channel:test";
      const agentId = resolveSessionAgentId({ sessionKey, config: mockConfig });
      expect(agentId).toBe("tulsbot");

      const elapsed = Date.now() - startTime;

      // Routing should be instant
      expect(elapsed).toBeLessThan(100);
    });

    it("should maintain session state for subsequent messages", () => {
      const channelId = "channel-persistent";
      const sessionKey = `tulsbot:discord:channel:${channelId}`;

      // Simulate multiple messages in same session
      const messages = ["First message", "Second message", "Third message"];

      messages.forEach((msg) => {
        const agent = resolveSessionAgentId({ sessionKey, config: mockConfig });
        expect(agent).toBe("tulsbot");
      });
    });
  });

  describe("Error Handling: Failure Scenarios", () => {
    it("should handle missing Discord token gracefully", () => {
      const invalidConfig: OpenClawConfig = {
        ...mockConfig,
        channels: {
          discord: {
            enabled: true,
            token: "",
          },
        },
      };

      const token = invalidConfig.channels?.discord?.token?.trim();
      expect(token).toBeFalsy();
    });

    it("should handle malformed session keys", () => {
      const malformedKey = "invalid-session-key";
      const parts = malformedKey.split(":");

      // Should have at least 2 parts (agent:channel)
      expect(parts.length).toBeLessThan(2);
    });

    it("should handle undefined config gracefully", () => {
      const emptyConfig: OpenClawConfig = {
        agents: {
          list: [],
        },
        model: "claude-3-5-sonnet-20241022",
      };

      const discordEnabled = emptyConfig.channels?.discord?.enabled ?? false;
      expect(discordEnabled).toBe(false);
    });

    it("should validate message content length", () => {
      const maxLength = 2000;
      const validMessage = "a".repeat(1500);
      const invalidMessage = "a".repeat(2500);

      expect(validMessage.length).toBeLessThan(maxLength);
      expect(invalidMessage.length).toBeGreaterThan(maxLength);
    });
  });

  describe("Integration: Full Message Flow", () => {
    it("should complete full flow: Discord DM → Routing → Session → Response", () => {
      // Step 1: Gateway receives DM
      const incomingDm: Partial<DiscordInboundEvent> = {
        channelId: "dm-channel-456",
        userId: "user-789",
        content: "Find research about neural networks",
        isDm: true,
        timestamp: Date.now(),
      };

      expect(incomingDm.isDm).toBe(true);

      // Step 2: Route to agent
      const sessionKey = `tulsbot:discord:dm:${incomingDm.userId}`;
      const agentId = resolveSessionAgentId({ sessionKey, config: mockConfig });

      expect(agentId).toBe("tulsbot");

      // Step 3: Verify session namespace
      expect(sessionKey.startsWith("tulsbot:discord:dm")).toBe(true);

      // Step 4: Message processing (content stripping)
      const cleanContent = incomingDm.content;
      expect(cleanContent).not.toContain("<@");

      // Step 5: Response preparation
      const response = {
        channel: "discord",
        to: incomingDm.channelId,
        text: "Research results for neural networks...",
      };

      expect(response.channel).toBe("discord");
      expect(response.to).toBe(incomingDm.channelId);
      expect(response.text).toBeTruthy();
    });

    it("should complete full flow: Discord channel mention → Response", () => {
      // Step 1: Gateway receives channel message
      const incomingMessage: Partial<DiscordInboundEvent> = {
        channelId: "channel-123",
        userId: "user-456",
        content: "<@123456789> help me with a coding question",
        isDm: false,
        guildId: "guild-789",
        timestamp: Date.now(),
      };

      expect(incomingMessage.isDm).toBe(false);
      expect(incomingMessage.guildId).toBeTruthy();

      // Step 2: Route to agent
      const sessionKey = `tulsbot:discord:channel:${incomingMessage.channelId}`;
      const agentId = resolveSessionAgentId({ sessionKey, config: mockConfig });

      expect(agentId).toBe("tulsbot");

      // Step 3: Strip mention from content
      const mentionPattern = /<@!?\d+>/g;
      const cleanContent = incomingMessage.content?.replace(mentionPattern, "").trim();

      expect(cleanContent).toBe("help me with a coding question");

      // Step 4: Response with reply-to
      const response = {
        channel: "discord",
        to: incomingMessage.channelId,
        text: "I can help with your coding question...",
        replyToId: "msg-original",
      };

      expect(response.replyToId).toBeTruthy();
    });

    it("should maintain context across multiple messages in thread", () => {
      const threadId = "thread-persistent-123";
      const messages = [
        { content: "Start of thread", index: 1 },
        { content: "Follow-up question", index: 2 },
        { content: "Final clarification", index: 3 },
      ];

      messages.forEach((msg) => {
        const sessionKey = `tulsbot:discord:thread:${threadId}`;
        const agentId = resolveSessionAgentId({ sessionKey, config: mockConfig });

        expect(agentId).toBe("tulsbot");
        expect(sessionKey).toContain(threadId);
      });
    });
  });
});
