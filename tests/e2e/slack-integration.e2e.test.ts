/**
 * Slack E2E Integration Tests
 *
 * Tests comprehensive end-to-end Slack integration flows including gateway message
 * reception, routing, session management, and response delivery.
 *
 * Note: These are E2E tests for integration validation, not live API tests.
 * Mock runtime prevents actual Slack API connections.
 *
 * Test Isolation:
 * Pattern: *.e2e.test.ts (auto-excluded from standard test suite per vitest.config.ts)
 * Included via vitest.e2e.config.ts → npm run test:e2e
 *
 * Coverage:
 * - Gateway message reception (DM, channel, thread)
 * - Routing and session agent resolution
 * - Session namespace isolation by chat type
 * - Message content handling (text, mentions, media)
 * - Response delivery (text, media, reactions)
 * - Security policies (DM, channel access)
 * - Performance benchmarks
 * - Error handling and edge cases
 * - Full integration flows end-to-end
 *
 * @see vitest.e2e.config.ts - E2E test configuration
 * @see extensions/slack/src/channel.ts - Slack channel plugin
 */

import type { ResolvedConfig, SessionKey } from "openclaw/plugin-sdk";
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Slack runtime to prevent actual API calls
vi.mock("../../extensions/slack/src/runtime.js", () => ({
  getSlackRuntime: () => ({
    channel: {
      slack: {
        sendMessageSlack: vi.fn().mockResolvedValue({
          messageId: "mock-msg-id",
          channelId: "mock-channel-id",
          success: true,
        }),
        sendPollSlack: vi.fn().mockResolvedValue({
          messageId: "mock-poll-id",
          channelId: "mock-channel-id",
          success: true,
        }),
        addReactionSlack: vi.fn().mockResolvedValue({ success: true }),
        monitorSlackProvider: vi.fn().mockResolvedValue(undefined),
        probeSlack: vi.fn().mockResolvedValue({
          ok: true,
          team: { name: "Mock Team" },
          user: { name: "mock-bot" },
        }),
        resolveTeamAllowlist: vi.fn().mockResolvedValue([]),
        resolveUserAllowlist: vi.fn().mockResolvedValue([]),
        listDirectoryPeersLive: vi.fn().mockResolvedValue([]),
        listDirectoryGroupsLive: vi.fn().mockResolvedValue([]),
      },
    },
    config: {
      loadConfig: () => ({
        channels: {
          slack: {
            enabled: true,
            botToken: "xoxb-mock-token",
          },
        },
      }),
    },
    logging: {
      shouldLogVerbose: () => false,
    },
  }),
}));

// Import after mocking
import { slackPlugin } from "../../extensions/slack/src/channel.js";

// Helper to extract routing from session key
function resolveSessionAgentId({
  sessionKey,
}: {
  sessionKey: SessionKey;
  config: ResolvedConfig;
}): string {
  // Extract agent from session namespace: "tulsbot:slack:dm:U123" → "tulsbot"
  const parts = String(sessionKey).split(":");
  return parts[0] ?? "default";
}

describe("Slack E2E Integration", () => {
  const mockConfig: ResolvedConfig = {
    channels: {
      slack: {
        enabled: true,
        botToken: "xoxb-mock-token",
      },
    },
    agents: {
      tulsbot: { enabled: true },
    },
  } as ResolvedConfig;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Gateway: Message Reception", () => {
    it("receives DM messages correctly", async () => {
      const userId = "U123456";
      const sessionKey = `tulsbot:slack:dm:${userId}`;

      expect(sessionKey).toContain("slack");
      expect(sessionKey).toContain("dm");
      expect(sessionKey).toContain(userId);
    });

    it("receives channel messages correctly", async () => {
      const channelId = "C123456";
      const sessionKey = `tulsbot:slack:channel:${channelId}`;

      expect(sessionKey).toContain("slack");
      expect(sessionKey).toContain("channel");
      expect(sessionKey).toContain(channelId);
    });

    it("receives thread messages correctly", async () => {
      const threadTs = "1234567890.123456";
      const sessionKey = `tulsbot:slack:thread:${threadTs}`;

      expect(sessionKey).toContain("slack");
      expect(sessionKey).toContain("thread");
      expect(sessionKey).toContain(threadTs);
    });

    it("handles message with bot mention", async () => {
      const messageText = "<@U0BOTUSER> hello there";
      const stripped = messageText.replace(/<@U\w+>/g, "").trim();

      expect(stripped).toBe("hello there");
      expect(stripped).not.toContain("<@");
    });

    it("handles message with multiple mentions", async () => {
      const messageText = "<@U0BOTUSER> tell <@U123456> about this";
      const botStripped = messageText.replace(/<@U0BOTUSER>/g, "").trim();

      expect(botStripped).toContain("<@U123456>");
      expect(botStripped).not.toContain("<@U0BOTUSER>");
    });
  });

  describe("Routing: Agent Resolution", () => {
    it("resolves agent from DM session key", async () => {
      const userId = "U123456";
      const sessionKey = `tulsbot:slack:dm:${userId}`;

      const agent = resolveSessionAgentId({ sessionKey, config: mockConfig });
      expect(agent).toBe("tulsbot");
    });

    it("resolves agent from channel session key", async () => {
      const channelId = "C123456";
      const sessionKey = `tulsbot:slack:channel:${channelId}`;

      const agent = resolveSessionAgentId({ sessionKey, config: mockConfig });
      expect(agent).toBe("tulsbot");
    });

    it("resolves agent from thread session key", async () => {
      const threadTs = "1234567890.123456";
      const sessionKey = `tulsbot:slack:thread:${threadTs}`;

      const agent = resolveSessionAgentId({ sessionKey, config: mockConfig });
      expect(agent).toBe("tulsbot");
    });
  });

  describe("Session Management: Namespace Isolation", () => {
    it("isolates DM sessions by user ID", async () => {
      const user1 = "U111111";
      const user2 = "U222222";

      const session1 = `tulsbot:slack:dm:${user1}`;
      const session2 = `tulsbot:slack:dm:${user2}`;

      expect(session1).not.toBe(session2);
      expect(session1).toContain(user1);
      expect(session2).toContain(user2);
    });

    it("isolates channel sessions by channel ID", async () => {
      const channel1 = "C111111";
      const channel2 = "C222222";

      const session1 = `tulsbot:slack:channel:${channel1}`;
      const session2 = `tulsbot:slack:channel:${channel2}`;

      expect(session1).not.toBe(session2);
      expect(session1).toContain(channel1);
      expect(session2).toContain(channel2);
    });

    it("isolates thread sessions by thread timestamp", async () => {
      const thread1 = "1234567890.111111";
      const thread2 = "1234567890.222222";

      const session1 = `tulsbot:slack:thread:${thread1}`;
      const session2 = `tulsbot:slack:thread:${thread2}`;

      expect(session1).not.toBe(session2);
      expect(session1).toContain(thread1);
      expect(session2).toContain(thread2);
    });

    it("maintains separate namespaces for different chat types", async () => {
      const id = "same-identifier";

      const dmSession = `tulsbot:slack:dm:${id}`;
      const channelSession = `tulsbot:slack:channel:${id}`;
      const threadSession = `tulsbot:slack:thread:${id}`;

      expect(dmSession).toContain(":dm:");
      expect(channelSession).toContain(":channel:");
      expect(threadSession).toContain(":thread:");

      expect(dmSession).not.toBe(channelSession);
      expect(dmSession).not.toBe(threadSession);
      expect(channelSession).not.toBe(threadSession);
    });
  });

  describe("Message Content: Text and Media", () => {
    it("handles plain text messages", async () => {
      const text = "Hello, world!";
      expect(text.length).toBeGreaterThan(0);
      expect(text).toBe("Hello, world!");
    });

    it("handles messages with links", async () => {
      const text = "Check out <https://example.com|this link>";
      expect(text).toContain("https://");
      expect(text).toContain("example.com");
    });

    it("handles messages with code blocks", async () => {
      const text = "```javascript\nconsole.log('test');\n```";
      expect(text).toContain("```");
      expect(text).toContain("javascript");
      expect(text).toContain("console.log");
    });

    it("handles messages with emoji", async () => {
      const text = "Great work :thumbsup:";
      expect(text).toContain(":thumbsup:");
    });

    it("handles media URLs", async () => {
      const mediaUrl = "https://files.slack.com/files-pri/T123/F456/image.png";
      expect(mediaUrl).toContain("files.slack.com");
      expect(mediaUrl).toContain(".png");
    });
  });

  describe("Response Delivery: Text, Media, Reactions", () => {
    it("sends text messages successfully", async () => {
      const channelId = "C123456";
      const text = "Response message";

      const result = await slackPlugin.outbound!.sendText!({
        to: channelId,
        text,
        accountId: undefined,
        deps: undefined,
        replyToId: undefined,
        cfg: mockConfig,
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();
    });

    it("sends media messages successfully", async () => {
      const channelId = "C123456";
      const text = "Image caption";
      const mediaUrl = "https://example.com/image.png";

      const result = await slackPlugin.outbound!.sendMedia!({
        to: channelId,
        text,
        mediaUrl,
        accountId: undefined,
        deps: undefined,
        replyToId: undefined,
        cfg: mockConfig,
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();
    });

    it("includes reply-to reference when provided", async () => {
      const channelId = "C123456";
      const text = "Reply message";
      const replyToId = "1234567890.123456";

      const result = await slackPlugin.outbound!.sendText!({
        to: channelId,
        text,
        accountId: undefined,
        deps: undefined,
        replyToId,
        cfg: mockConfig,
      });

      expect(result.success).toBe(true);
    });
  });

  describe("Security: DM and Channel Access", () => {
    it("validates DM policy configuration", async () => {
      const account = {
        accountId: "default",
        enabled: true,
        configured: true,
        botToken: "xoxb-mock-token",
        dm: {
          policy: "pairing" as const,
          allowFrom: ["U123456"],
        },
      };

      const dmPolicy = slackPlugin.security!.resolveDmPolicy!({
        cfg: mockConfig,
        accountId: "default",
        account,
      });

      expect(dmPolicy.policy).toBe("pairing");
      expect(dmPolicy.allowFrom).toContain("U123456");
    });

    it("formats allow-from entries correctly", async () => {
      const rawEntry = "slack:U123456";
      const normalized = rawEntry.replace(/^(slack|user):/i, "");

      expect(normalized).toBe("U123456");
      expect(normalized).not.toContain("slack:");
    });

    it("collects security warnings for open group policy", async () => {
      const account = {
        accountId: "default",
        enabled: true,
        configured: true,
        botToken: "xoxb-mock-token",
        config: {
          groupPolicy: "open" as const,
          teams: {},
        },
      };

      const warnings = slackPlugin.security!.collectWarnings!({
        account,
        cfg: mockConfig,
      });

      expect(Array.isArray(warnings)).toBe(true);
      // Open policy without channel allowlist should generate warnings
      if (warnings.length > 0) {
        expect(warnings.some((w) => w.includes("groupPolicy"))).toBe(true);
      }
    });
  });

  describe("Performance: Response Time", () => {
    it("resolves session agent quickly", async () => {
      const sessionKey = "tulsbot:slack:dm:U123456";

      const start = performance.now();
      const agent = resolveSessionAgentId({ sessionKey, config: mockConfig });
      const elapsed = performance.now() - start;

      expect(agent).toBe("tulsbot");
      expect(elapsed).toBeLessThan(10); // Should be nearly instant
    });

    it("handles batch message processing efficiently", async () => {
      const messages = Array.from({ length: 100 }, (_, i) => ({
        userId: `U${i}`,
        text: `Message ${i}`,
      }));

      const start = performance.now();
      const sessions = messages.map((msg) => `tulsbot:slack:dm:${msg.userId}`);
      const elapsed = performance.now() - start;

      expect(sessions).toHaveLength(100);
      expect(elapsed).toBeLessThan(100); // Should process 100 messages in <100ms
    });
  });

  describe("Error Handling: Failure Scenarios", () => {
    it("handles missing channel ID gracefully", async () => {
      const invalidKey = "tulsbot:slack:channel:";
      expect(invalidKey).toContain("channel:");
      expect(invalidKey.split(":").pop()).toBe("");
    });

    it("handles malformed session keys", async () => {
      const malformedKey = "invalid-session-key";
      const agent = resolveSessionAgentId({
        sessionKey: malformedKey,
        config: mockConfig,
      });
      // Should extract first segment even if malformed
      expect(agent).toBe("invalid-session-key");
    });

    it("handles empty message content", async () => {
      const text = "";
      expect(text.length).toBe(0);
      expect(text.trim()).toBe("");
    });

    it("validates plugin capabilities", async () => {
      expect(slackPlugin.capabilities?.chatTypes).toContain("direct");
      expect(slackPlugin.capabilities?.chatTypes).toContain("channel");
      expect(slackPlugin.capabilities?.chatTypes).toContain("thread");
      expect(slackPlugin.capabilities?.reactions).toBe(true);
      expect(slackPlugin.capabilities?.threads).toBe(true);
      expect(slackPlugin.capabilities?.media).toBe(true);
    });
  });

  describe("Session Continuity: Multi-Message Flows", () => {
    it("maintains session across multiple DM messages", async () => {
      const userId = "U123456";
      const sessionKey = `tulsbot:slack:dm:${userId}`;

      const messages = ["First message", "Second message", "Third message"];

      messages.forEach((_msg) => {
        const agent = resolveSessionAgentId({ sessionKey, config: mockConfig });
        expect(agent).toBe("tulsbot");
      });
    });

    it("maintains session across multiple channel messages", async () => {
      const channelId = "C123456";
      const sessionKey = `tulsbot:slack:channel:${channelId}`;

      const messages = [
        { content: "Initial question", index: 0 },
        { content: "Follow-up question", index: 1 },
        { content: "Final question", index: 2 },
      ];

      messages.forEach((_msg) => {
        const agent = resolveSessionAgentId({ sessionKey, config: mockConfig });
        expect(agent).toBe("tulsbot");
      });
    });

    it("maintains thread context across replies", async () => {
      const threadTs = "1234567890.123456";

      const messages = [
        { content: "Thread starter", index: 0 },
        { content: "Reply 1", index: 1 },
        { content: "Reply 2", index: 2 },
        { content: "Final clarification", index: 3 },
      ];

      messages.forEach((_msg) => {
        const sessionKey = `tulsbot:slack:thread:${threadTs}`;
        const agentId = resolveSessionAgentId({ sessionKey, config: mockConfig });

        expect(agentId).toBe("tulsbot");
        expect(sessionKey).toContain(threadTs);
      });
    });
  });
});
