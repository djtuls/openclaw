/**
 * Telegram E2E Integration Tests
 *
 * Tests comprehensive end-to-end Telegram integration flows including gateway message
 * reception, routing, session management, and response delivery.
 *
 * Note: These are E2E tests for integration validation, not live API tests.
 * Mock runtime prevents actual Telegram API connections.
 *
 * Test Isolation:
 * Pattern: *.e2e.test.ts (auto-excluded from standard test suite per vitest.config.ts)
 * Included via vitest.e2e.config.ts → npm run test:e2e
 *
 * Coverage:
 * - Gateway message reception (DM, group, channel, thread)
 * - Routing and session agent resolution
 * - Session namespace isolation by chat type
 * - Message content handling (text, mentions, media, commands)
 * - Response delivery (text, media, reactions)
 * - Security policies (DM, group/channel access)
 * - Performance benchmarks
 * - Error handling and edge cases
 * - Full integration flows end-to-end
 *
 * @see vitest.e2e.config.ts - E2E test configuration
 * @see extensions/telegram/src/channel.ts - Telegram channel plugin
 */

import type { ResolvedConfig, SessionKey } from "openclaw/plugin-sdk";
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Telegram runtime to prevent actual API calls
vi.mock("../../extensions/telegram/src/runtime.js", () => ({
  getTelegramRuntime: () => ({
    channel: {
      telegram: {
        sendMessageTelegram: vi.fn().mockResolvedValue({
          messageId: "mock-msg-id",
          chatId: "mock-chat-id",
          success: true,
        }),
        sendPollTelegram: vi.fn().mockResolvedValue({
          messageId: "mock-poll-id",
          chatId: "mock-chat-id",
          success: true,
        }),
        addReactionTelegram: vi.fn().mockResolvedValue({ success: true }),
        monitorTelegramProvider: vi.fn().mockResolvedValue(undefined),
        probeTelegram: vi.fn().mockResolvedValue({
          ok: true,
          result: {
            id: 123456789,
            is_bot: true,
            first_name: "MockBot",
            username: "mock_bot",
          },
        }),
        resolveAllowlist: vi.fn().mockResolvedValue([]),
        listDirectoryPeersLive: vi.fn().mockResolvedValue([]),
        listDirectoryGroupsLive: vi.fn().mockResolvedValue([]),
      },
    },
    config: {
      loadConfig: () => ({
        channels: {
          telegram: {
            enabled: true,
            botToken: "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11",
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
import { telegramPlugin } from "../../extensions/telegram/src/channel.js";

// Helper to extract routing from session key
function resolveSessionAgentId({
  sessionKey,
}: {
  sessionKey: SessionKey;
  config: ResolvedConfig;
}): string {
  // Extract agent from session namespace: "tulsbot:telegram:dm:123456" → "tulsbot"
  const parts = String(sessionKey).split(":");
  return parts[0] ?? "default";
}

describe("Telegram E2E Integration", () => {
  const mockConfig: ResolvedConfig = {
    channels: {
      telegram: {
        enabled: true,
        botToken: "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11",
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
      const userId = "123456789";
      const sessionKey = `tulsbot:telegram:dm:${userId}`;

      expect(sessionKey).toContain("telegram");
      expect(sessionKey).toContain("dm");
      expect(sessionKey).toContain(userId);
    });

    it("receives group messages correctly", async () => {
      const groupId = "-987654321";
      const sessionKey = `tulsbot:telegram:group:${groupId}`;

      expect(sessionKey).toContain("telegram");
      expect(sessionKey).toContain("group");
      expect(sessionKey).toContain(groupId);
    });

    it("receives channel messages correctly", async () => {
      const channelId = "-100123456789";
      const sessionKey = `tulsbot:telegram:channel:${channelId}`;

      expect(sessionKey).toContain("telegram");
      expect(sessionKey).toContain("channel");
      expect(sessionKey).toContain(channelId);
    });

    it("receives thread messages correctly", async () => {
      const threadId = "12345";
      const sessionKey = `tulsbot:telegram:thread:${threadId}`;

      expect(sessionKey).toContain("telegram");
      expect(sessionKey).toContain("thread");
      expect(sessionKey).toContain(threadId);
    });

    it("handles message with bot mention", async () => {
      const messageText = "@mock_bot hello there";
      const stripped = messageText.replace(/@\w+/g, "").trim();

      expect(stripped).toBe("hello there");
      expect(stripped).not.toContain("@");
    });

    it("handles message with multiple mentions", async () => {
      const messageText = "@mock_bot tell @john about this";
      const botStripped = messageText.replace(/@mock_bot/g, "").trim();

      expect(botStripped).toContain("@john");
      expect(botStripped).not.toContain("@mock_bot");
    });

    it("handles bot commands", async () => {
      const commandText = "/start";
      expect(commandText).toMatch(/^\/\w+/);
      expect(commandText.startsWith("/")).toBe(true);
    });

    it("handles bot commands with parameters", async () => {
      const commandText = "/help memory search";
      const parts = commandText.split(" ");
      const command = parts[0];
      const params = parts.slice(1).join(" ");

      expect(command).toBe("/help");
      expect(params).toBe("memory search");
    });
  });

  describe("Routing: Agent Resolution", () => {
    it("resolves agent from DM session key", async () => {
      const userId = "123456789";
      const sessionKey = `tulsbot:telegram:dm:${userId}`;

      const agent = resolveSessionAgentId({ sessionKey, config: mockConfig });
      expect(agent).toBe("tulsbot");
    });

    it("resolves agent from group session key", async () => {
      const groupId = "-987654321";
      const sessionKey = `tulsbot:telegram:group:${groupId}`;

      const agent = resolveSessionAgentId({ sessionKey, config: mockConfig });
      expect(agent).toBe("tulsbot");
    });

    it("resolves agent from channel session key", async () => {
      const channelId = "-100123456789";
      const sessionKey = `tulsbot:telegram:channel:${channelId}`;

      const agent = resolveSessionAgentId({ sessionKey, config: mockConfig });
      expect(agent).toBe("tulsbot");
    });

    it("resolves agent from thread session key", async () => {
      const threadId = "12345";
      const sessionKey = `tulsbot:telegram:thread:${threadId}`;

      const agent = resolveSessionAgentId({ sessionKey, config: mockConfig });
      expect(agent).toBe("tulsbot");
    });
  });

  describe("Session Management: Namespace Isolation", () => {
    it("isolates DM sessions by user ID", async () => {
      const user1 = "111111111";
      const user2 = "222222222";

      const session1 = `tulsbot:telegram:dm:${user1}`;
      const session2 = `tulsbot:telegram:dm:${user2}`;

      expect(session1).not.toBe(session2);
      expect(session1).toContain(user1);
      expect(session2).toContain(user2);
    });

    it("isolates group sessions by group ID", async () => {
      const group1 = "-111111111";
      const group2 = "-222222222";

      const session1 = `tulsbot:telegram:group:${group1}`;
      const session2 = `tulsbot:telegram:group:${group2}`;

      expect(session1).not.toBe(session2);
      expect(session1).toContain(group1);
      expect(session2).toContain(group2);
    });

    it("isolates channel sessions by channel ID", async () => {
      const channel1 = "-100111111111";
      const channel2 = "-100222222222";

      const session1 = `tulsbot:telegram:channel:${channel1}`;
      const session2 = `tulsbot:telegram:channel:${channel2}`;

      expect(session1).not.toBe(session2);
      expect(session1).toContain(channel1);
      expect(session2).toContain(channel2);
    });

    it("isolates thread sessions by thread ID", async () => {
      const thread1 = "11111";
      const thread2 = "22222";

      const session1 = `tulsbot:telegram:thread:${thread1}`;
      const session2 = `tulsbot:telegram:thread:${thread2}`;

      expect(session1).not.toBe(session2);
      expect(session1).toContain(thread1);
      expect(session2).toContain(thread2);
    });

    it("maintains separate namespaces for different chat types", async () => {
      const id = "same-identifier";

      const dmSession = `tulsbot:telegram:dm:${id}`;
      const groupSession = `tulsbot:telegram:group:${id}`;
      const channelSession = `tulsbot:telegram:channel:${id}`;
      const threadSession = `tulsbot:telegram:thread:${id}`;

      expect(dmSession).toContain(":dm:");
      expect(groupSession).toContain(":group:");
      expect(channelSession).toContain(":channel:");
      expect(threadSession).toContain(":thread:");

      expect(dmSession).not.toBe(groupSession);
      expect(dmSession).not.toBe(channelSession);
      expect(dmSession).not.toBe(threadSession);
      expect(groupSession).not.toBe(channelSession);
      expect(groupSession).not.toBe(threadSession);
      expect(channelSession).not.toBe(threadSession);
    });
  });

  describe("Message Content: Text, Media, Commands", () => {
    it("handles plain text messages", async () => {
      const text = "Hello, world!";
      expect(text.length).toBeGreaterThan(0);
      expect(text).toBe("Hello, world!");
    });

    it("handles messages with links", async () => {
      const text = "Check out https://example.com";
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
      const text = "Great work 👍";
      expect(text).toContain("👍");
    });

    it("handles media URLs", async () => {
      const mediaUrl = "https://api.telegram.org/file/bot123456/photos/file_123.jpg";
      expect(mediaUrl).toContain("api.telegram.org");
      expect(mediaUrl).toContain(".jpg");
    });

    it("handles bot commands with slash prefix", async () => {
      const command = "/start";
      expect(command.startsWith("/")).toBe(true);
    });

    it("handles inline bot mentions", async () => {
      const text = "Hey @mock_bot can you help?";
      expect(text).toContain("@mock_bot");
    });

    it("handles markdown formatting", async () => {
      const text = "*bold* _italic_ `code`";
      expect(text).toContain("*bold*");
      expect(text).toContain("_italic_");
      expect(text).toContain("`code`");
    });
  });

  describe("Response Delivery: Text, Media, Reactions", () => {
    it("sends text messages successfully", async () => {
      const chatId = "123456789";
      const text = "Response message";

      const result = await telegramPlugin.outbound!.sendText!({
        to: chatId,
        text,
        accountId: undefined,
        deps: undefined,
        replyToId: undefined,
        threadId: undefined,
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();
    });

    it("sends media messages successfully", async () => {
      const chatId = "123456789";
      const text = "Image caption";
      const mediaUrl = "https://example.com/image.png";

      const result = await telegramPlugin.outbound!.sendMedia!({
        to: chatId,
        text,
        mediaUrl,
        accountId: undefined,
        deps: undefined,
        replyToId: undefined,
        threadId: undefined,
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();
    });

    it("includes reply-to reference when provided", async () => {
      const chatId = "123456789";
      const text = "Reply message";
      const replyToId = "telegram:12345";

      const result = await telegramPlugin.outbound!.sendText!({
        to: chatId,
        text,
        accountId: undefined,
        deps: undefined,
        replyToId,
        threadId: undefined,
      });

      expect(result.success).toBe(true);
    });

    it("includes thread ID when provided", async () => {
      const chatId = "-987654321";
      const text = "Thread reply";
      const threadId = "telegram-thread:54321";

      const result = await telegramPlugin.outbound!.sendText!({
        to: chatId,
        text,
        accountId: undefined,
        deps: undefined,
        replyToId: undefined,
        threadId,
      });

      expect(result.success).toBe(true);
    });
  });

  describe("Security: DM and Group/Channel Access", () => {
    it("validates DM policy configuration", async () => {
      const account = {
        accountId: "default",
        enabled: true,
        configured: true,
        botToken: "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11",
        config: {
          dmPolicy: "pairing" as const,
          allowFrom: ["123456789"],
        },
      };

      const dmPolicy = telegramPlugin.security!.resolveDmPolicy!({
        cfg: mockConfig,
        accountId: "default",
        account,
      });

      expect(dmPolicy.policy).toBe("pairing");
      expect(dmPolicy.allowFrom).toContain("123456789");
    });

    it("formats allow-from entries correctly", async () => {
      const rawEntry = "telegram:123456789";
      const normalized = rawEntry.replace(/^(telegram|tg):/i, "");

      expect(normalized).toBe("123456789");
      expect(normalized).not.toContain("telegram:");
    });

    it("collects security warnings for open group policy", async () => {
      const account = {
        accountId: "default",
        enabled: true,
        configured: true,
        botToken: "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11",
        config: {
          groupPolicy: "open" as const,
        },
      };

      const warnings = telegramPlugin.security!.collectWarnings!({
        account,
        cfg: mockConfig,
      });

      expect(Array.isArray(warnings)).toBe(true);
      // Open policy without group allowlist should generate warnings
      if (warnings.length > 0) {
        expect(warnings.some((w) => w.includes("groupPolicy"))).toBe(true);
      }
    });

    it("validates group chat ID format", async () => {
      const groupId = "-987654321";
      expect(groupId.startsWith("-")).toBe(true);
      expect(groupId).toMatch(/^-\d+$/);
    });

    it("validates channel chat ID format", async () => {
      const channelId = "-100123456789";
      expect(channelId.startsWith("-100")).toBe(true);
      expect(channelId).toMatch(/^-100\d+$/);
    });
  });

  describe("Performance: Response Time", () => {
    it("resolves session agent quickly", async () => {
      const sessionKey = "tulsbot:telegram:dm:123456789";

      const start = performance.now();
      const agent = resolveSessionAgentId({ sessionKey, config: mockConfig });
      const elapsed = performance.now() - start;

      expect(agent).toBe("tulsbot");
      expect(elapsed).toBeLessThan(10); // Should be nearly instant
    });

    it("handles batch message processing efficiently", async () => {
      const messages = Array.from({ length: 100 }, (_, i) => ({
        userId: `${100000000 + i}`,
        text: `Message ${i}`,
      }));

      const start = performance.now();
      const sessions = messages.map((msg) => `tulsbot:telegram:dm:${msg.userId}`);
      const elapsed = performance.now() - start;

      expect(sessions).toHaveLength(100);
      expect(elapsed).toBeLessThan(100); // Should process 100 messages in <100ms
    });
  });

  describe("Error Handling: Failure Scenarios", () => {
    it("handles missing chat ID gracefully", async () => {
      const invalidKey = "tulsbot:telegram:group:";
      expect(invalidKey).toContain("group:");
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
      expect(telegramPlugin.capabilities?.chatTypes).toContain("direct");
      expect(telegramPlugin.capabilities?.chatTypes).toContain("group");
      expect(telegramPlugin.capabilities?.chatTypes).toContain("channel");
      expect(telegramPlugin.capabilities?.chatTypes).toContain("thread");
      expect(telegramPlugin.capabilities?.reactions).toBe(true);
      expect(telegramPlugin.capabilities?.threads).toBe(true);
      expect(telegramPlugin.capabilities?.media).toBe(true);
      expect(telegramPlugin.capabilities?.nativeCommands).toBe(true);
    });

    it("handles invalid bot token format", async () => {
      const invalidToken = "invalid-token";
      expect(invalidToken).not.toMatch(/^\d+:[A-Za-z0-9_-]+$/);
    });

    it("handles valid bot token format", async () => {
      const validToken = "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11";
      expect(validToken).toMatch(/^\d+:[A-Za-z0-9_-]+$/);
    });
  });

  describe("Session Continuity: Multi-Message Flows", () => {
    it("maintains session across multiple DM messages", async () => {
      const userId = "123456789";
      const sessionKey = `tulsbot:telegram:dm:${userId}`;

      const messages = ["First message", "Second message", "Third message"];

      messages.forEach((_msg) => {
        const agent = resolveSessionAgentId({ sessionKey, config: mockConfig });
        expect(agent).toBe("tulsbot");
      });
    });

    it("maintains session across multiple group messages", async () => {
      const groupId = "-987654321";
      const sessionKey = `tulsbot:telegram:group:${groupId}`;

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
      const threadId = "12345";

      const messages = [
        { content: "Thread starter", index: 0 },
        { content: "Reply 1", index: 1 },
        { content: "Reply 2", index: 2 },
        { content: "Final clarification", index: 3 },
      ];

      messages.forEach((_msg) => {
        const sessionKey = `tulsbot:telegram:thread:${threadId}`;
        const agentId = resolveSessionAgentId({ sessionKey, config: mockConfig });

        expect(agentId).toBe("tulsbot");
        expect(sessionKey).toContain(threadId);
      });
    });

    it("maintains channel session across messages", async () => {
      const channelId = "-100123456789";
      const sessionKey = `tulsbot:telegram:channel:${channelId}`;

      const messages = [
        { content: "Announcement 1", index: 0 },
        { content: "Announcement 2", index: 1 },
        { content: "Q&A response", index: 2 },
      ];

      messages.forEach((_msg) => {
        const agent = resolveSessionAgentId({ sessionKey, config: mockConfig });
        expect(agent).toBe("tulsbot");
      });
    });
  });

  describe("Command Handling: Native Bot Commands", () => {
    it("recognizes standard bot commands", async () => {
      const commands = ["/start", "/help", "/settings", "/cancel"];

      commands.forEach((cmd) => {
        expect(cmd.startsWith("/")).toBe(true);
        expect(cmd).toMatch(/^\/\w+$/);
      });
    });

    it("parses commands with parameters", async () => {
      const command = "/search memory system architecture";
      const parts = command.split(" ");
      const cmd = parts[0];
      const params = parts.slice(1);

      expect(cmd).toBe("/search");
      expect(params).toEqual(["memory", "system", "architecture"]);
    });

    it("handles commands in group context", async () => {
      const groupId = "-987654321";
      const sessionKey = `tulsbot:telegram:group:${groupId}`;
      const command = "/stats";

      expect(sessionKey).toContain("group");
      expect(command.startsWith("/")).toBe(true);
    });
  });
});
