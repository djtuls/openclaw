import { beforeEach, describe, expect, it, vi } from "vitest";

// ── vi.hoisted mocks ────────────────────────────────────────

const resolveFeishuAccountMock = vi.hoisted(() => vi.fn());
const createFeishuClientMock = vi.hoisted(() => vi.fn());
const normalizeFeishuTargetMock = vi.hoisted(() => vi.fn());
const resolveReceiveIdTypeMock = vi.hoisted(() => vi.fn());
const getFeishuRuntimeMock = vi.hoisted(() => vi.fn());

const messageGetMock = vi.hoisted(() => vi.fn());
const messageCreateMock = vi.hoisted(() => vi.fn());
const messageReplyMock = vi.hoisted(() => vi.fn());
const messagePatchMock = vi.hoisted(() => vi.fn());
const messageUpdateMock = vi.hoisted(() => vi.fn());

vi.mock("./accounts.js", () => ({
  resolveFeishuAccount: resolveFeishuAccountMock,
}));

vi.mock("./client.js", () => ({
  createFeishuClient: createFeishuClientMock,
}));

vi.mock("./targets.js", () => ({
  normalizeFeishuTarget: normalizeFeishuTargetMock,
  resolveReceiveIdType: resolveReceiveIdTypeMock,
}));

vi.mock("./runtime.js", () => ({
  getFeishuRuntime: getFeishuRuntimeMock,
}));

import {
  getMessageFeishu,
  sendMessageFeishu,
  sendCardFeishu,
  updateCardFeishu,
  buildMarkdownCard,
  sendMarkdownCardFeishu,
  editMessageFeishu,
} from "./send.js";

// ── Common setup ─────────────────────────────────────────────

const fakeCfg = { channels: { feishu: {} } } as any;

function setupAccount(configured = true) {
  resolveFeishuAccountMock.mockReturnValue({
    configured,
    accountId: "main",
    appId: "app_id",
    appSecret: "app_secret",
    domain: "feishu",
  });
}

function setupClient() {
  createFeishuClientMock.mockReturnValue({
    im: {
      message: {
        get: messageGetMock,
        create: messageCreateMock,
        reply: messageReplyMock,
        patch: messagePatchMock,
        update: messageUpdateMock,
      },
    },
  });
}

function setupTargets(target = "oc_chat_1", idType = "chat_id") {
  normalizeFeishuTargetMock.mockReturnValue(target);
  resolveReceiveIdTypeMock.mockReturnValue(idType);
}

function setupRuntime() {
  getFeishuRuntimeMock.mockReturnValue({
    channel: {
      text: {
        resolveMarkdownTableMode: vi.fn().mockReturnValue("default"),
        convertMarkdownTables: vi.fn().mockImplementation((t: string) => t),
      },
    },
  });
}

describe("send", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupAccount();
    setupClient();
    setupTargets();
    setupRuntime();
  });

  // ── buildMarkdownCard (pure function) ────────────────────

  describe("buildMarkdownCard", () => {
    it("returns schema 2.0 card with markdown content", () => {
      const card = buildMarkdownCard("Hello **world**");
      expect(card.schema).toBe("2.0");
      expect(card.config).toEqual({ wide_screen_mode: true });
      expect(card.body).toEqual({
        elements: [{ tag: "markdown", content: "Hello **world**" }],
      });
    });

    it("preserves code blocks in content", () => {
      const card = buildMarkdownCard("```js\nconst x = 1;\n```");
      const elements = (card.body as any).elements;
      expect(elements[0].content).toContain("```js");
    });
  });

  // ── getMessageFeishu ─────────────────────────────────────

  describe("getMessageFeishu", () => {
    it("throws when account is not configured", async () => {
      setupAccount(false);
      await expect(getMessageFeishu({ cfg: fakeCfg, messageId: "om_1" })).rejects.toThrow(
        "not configured",
      );
    });

    it("returns null when API response code is non-zero", async () => {
      messageGetMock.mockResolvedValue({ code: 1, msg: "not found" });
      const result = await getMessageFeishu({ cfg: fakeCfg, messageId: "om_1" });
      expect(result).toBeNull();
    });

    it("returns null when no items in response", async () => {
      messageGetMock.mockResolvedValue({ code: 0, data: { items: [] } });
      const result = await getMessageFeishu({ cfg: fakeCfg, messageId: "om_1" });
      expect(result).toBeNull();
    });

    it("returns parsed message info on success", async () => {
      messageGetMock.mockResolvedValue({
        code: 0,
        data: {
          items: [
            {
              message_id: "om_1",
              chat_id: "oc_chat",
              msg_type: "text",
              body: { content: '{"text":"Hello"}' },
              sender: { id: "ou_sender", id_type: "open_id" },
              create_time: "1700000000",
            },
          ],
        },
      });

      const result = await getMessageFeishu({ cfg: fakeCfg, messageId: "om_1" });
      expect(result).toEqual({
        messageId: "om_1",
        chatId: "oc_chat",
        senderId: "ou_sender",
        senderOpenId: "ou_sender",
        content: "Hello",
        contentType: "text",
        createTime: 1700000000,
      });
    });

    it("keeps raw content when JSON parse fails", async () => {
      messageGetMock.mockResolvedValue({
        code: 0,
        data: {
          items: [
            {
              message_id: "om_1",
              chat_id: "oc_chat",
              msg_type: "image",
              body: { content: "not-json" },
              sender: { id: "ou_sender", id_type: "user_id" },
            },
          ],
        },
      });

      const result = await getMessageFeishu({ cfg: fakeCfg, messageId: "om_1" });
      expect(result?.content).toBe("not-json");
      expect(result?.senderOpenId).toBeUndefined();
    });

    it("returns null on network/exception error", async () => {
      messageGetMock.mockRejectedValue(new Error("network"));
      const result = await getMessageFeishu({ cfg: fakeCfg, messageId: "om_1" });
      expect(result).toBeNull();
    });
  });

  // ── sendMessageFeishu ────────────────────────────────────

  describe("sendMessageFeishu", () => {
    it("throws when account is not configured", async () => {
      setupAccount(false);
      await expect(
        sendMessageFeishu({ cfg: fakeCfg, to: "oc_chat_1", text: "hi" }),
      ).rejects.toThrow("not configured");
    });

    it("throws when target is invalid (normalizeFeishuTarget returns null)", async () => {
      normalizeFeishuTargetMock.mockReturnValue(null);
      await expect(sendMessageFeishu({ cfg: fakeCfg, to: "invalid", text: "hi" })).rejects.toThrow(
        "Invalid Feishu target",
      );
    });

    it("sends message via create on success", async () => {
      messageCreateMock.mockResolvedValue({ code: 0, data: { message_id: "om_new" } });

      const result = await sendMessageFeishu({ cfg: fakeCfg, to: "oc_chat_1", text: "hello" });
      expect(result).toEqual({ messageId: "om_new", chatId: "oc_chat_1" });
      expect(messageCreateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          params: { receive_id_type: "chat_id" },
          data: expect.objectContaining({
            receive_id: "oc_chat_1",
            msg_type: "post",
          }),
        }),
      );
    });

    it("uses reply when replyToMessageId is provided", async () => {
      messageReplyMock.mockResolvedValue({ code: 0, data: { message_id: "om_reply" } });

      const result = await sendMessageFeishu({
        cfg: fakeCfg,
        to: "oc_chat_1",
        text: "reply text",
        replyToMessageId: "om_parent",
      });

      expect(result).toEqual({ messageId: "om_reply", chatId: "oc_chat_1" });
      expect(messageReplyMock).toHaveBeenCalledWith(
        expect.objectContaining({
          path: { message_id: "om_parent" },
        }),
      );
      expect(messageCreateMock).not.toHaveBeenCalled();
    });

    it("throws when create returns non-zero code", async () => {
      messageCreateMock.mockResolvedValue({ code: 99, msg: "rate limited" });
      await expect(
        sendMessageFeishu({ cfg: fakeCfg, to: "oc_chat_1", text: "hi" }),
      ).rejects.toThrow("Feishu send failed: rate limited");
    });

    it("throws when reply returns non-zero code", async () => {
      messageReplyMock.mockResolvedValue({ code: 99, msg: "forbidden" });
      await expect(
        sendMessageFeishu({
          cfg: fakeCfg,
          to: "oc_chat_1",
          text: "hi",
          replyToMessageId: "om_parent",
        }),
      ).rejects.toThrow("Feishu reply failed: forbidden");
    });

    it("includes mention targets in message", async () => {
      messageCreateMock.mockResolvedValue({ code: 0, data: { message_id: "om_m" } });

      await sendMessageFeishu({
        cfg: fakeCfg,
        to: "oc_chat_1",
        text: "hello",
        mentions: [{ openId: "ou_user", name: "Alice", key: "@_user_1" }],
      });

      // The message content should include the mention tag
      const callData = messageCreateMock.mock.calls[0][0].data;
      const parsed = JSON.parse(callData.content);
      const mdText = parsed.zh_cn.content[0][0].text;
      expect(mdText).toContain('<at user_id="ou_user">Alice</at>');
    });
  });

  // ── sendCardFeishu ───────────────────────────────────────

  describe("sendCardFeishu", () => {
    const card = { schema: "2.0", body: { elements: [] } };

    it("throws when account is not configured", async () => {
      setupAccount(false);
      await expect(sendCardFeishu({ cfg: fakeCfg, to: "oc_chat_1", card })).rejects.toThrow(
        "not configured",
      );
    });

    it("throws when target is invalid", async () => {
      normalizeFeishuTargetMock.mockReturnValue(null);
      await expect(sendCardFeishu({ cfg: fakeCfg, to: "invalid", card })).rejects.toThrow(
        "Invalid Feishu target",
      );
    });

    it("sends card via create on success", async () => {
      messageCreateMock.mockResolvedValue({ code: 0, data: { message_id: "om_card" } });

      const result = await sendCardFeishu({ cfg: fakeCfg, to: "oc_chat_1", card });
      expect(result).toEqual({ messageId: "om_card", chatId: "oc_chat_1" });
      expect(messageCreateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            msg_type: "interactive",
          }),
        }),
      );
    });

    it("uses reply when replyToMessageId is provided", async () => {
      messageReplyMock.mockResolvedValue({ code: 0, data: { message_id: "om_card_reply" } });

      const result = await sendCardFeishu({
        cfg: fakeCfg,
        to: "oc_chat_1",
        card,
        replyToMessageId: "om_parent",
      });

      expect(result.messageId).toBe("om_card_reply");
      expect(messageReplyMock).toHaveBeenCalled();
      expect(messageCreateMock).not.toHaveBeenCalled();
    });

    it("throws when create returns non-zero code", async () => {
      messageCreateMock.mockResolvedValue({ code: 403, msg: "no permission" });
      await expect(sendCardFeishu({ cfg: fakeCfg, to: "oc_chat_1", card })).rejects.toThrow(
        "Feishu card send failed",
      );
    });

    it("throws when reply returns non-zero code", async () => {
      messageReplyMock.mockResolvedValue({ code: 500 });
      await expect(
        sendCardFeishu({ cfg: fakeCfg, to: "oc_chat_1", card, replyToMessageId: "om_p" }),
      ).rejects.toThrow("Feishu card reply failed");
    });
  });

  // ── updateCardFeishu ─────────────────────────────────────

  describe("updateCardFeishu", () => {
    const card = { schema: "2.0", body: { elements: [] } };

    it("throws when account is not configured", async () => {
      setupAccount(false);
      await expect(updateCardFeishu({ cfg: fakeCfg, messageId: "om_1", card })).rejects.toThrow(
        "not configured",
      );
    });

    it("calls patch with message ID and card content", async () => {
      messagePatchMock.mockResolvedValue({ code: 0 });
      await updateCardFeishu({ cfg: fakeCfg, messageId: "om_1", card });

      expect(messagePatchMock).toHaveBeenCalledWith({
        path: { message_id: "om_1" },
        data: { content: JSON.stringify(card) },
      });
    });

    it("throws when patch returns non-zero code", async () => {
      messagePatchMock.mockResolvedValue({ code: 99, msg: "expired" });
      await expect(updateCardFeishu({ cfg: fakeCfg, messageId: "om_1", card })).rejects.toThrow(
        "Feishu card update failed: expired",
      );
    });
  });

  // ── sendMarkdownCardFeishu ───────────────────────────────

  describe("sendMarkdownCardFeishu", () => {
    it("sends a markdown card with buildMarkdownCard structure", async () => {
      messageCreateMock.mockResolvedValue({ code: 0, data: { message_id: "om_md" } });

      const result = await sendMarkdownCardFeishu({
        cfg: fakeCfg,
        to: "oc_chat_1",
        text: "# Title\nBody",
      });

      expect(result.messageId).toBe("om_md");
      const callData = messageCreateMock.mock.calls[0][0].data;
      const parsed = JSON.parse(callData.content);
      expect(parsed.schema).toBe("2.0");
      expect(parsed.body.elements[0].content).toBe("# Title\nBody");
    });

    it("includes card-format mentions when provided", async () => {
      messageCreateMock.mockResolvedValue({ code: 0, data: { message_id: "om_md" } });

      await sendMarkdownCardFeishu({
        cfg: fakeCfg,
        to: "oc_chat_1",
        text: "hello",
        mentions: [{ openId: "ou_user", name: "Alice", key: "@_user_1" }],
      });

      const callData = messageCreateMock.mock.calls[0][0].data;
      const parsed = JSON.parse(callData.content);
      expect(parsed.body.elements[0].content).toContain("<at id=ou_user></at>");
    });
  });

  // ── editMessageFeishu ────────────────────────────────────

  describe("editMessageFeishu", () => {
    it("throws when account is not configured", async () => {
      setupAccount(false);
      await expect(
        editMessageFeishu({ cfg: fakeCfg, messageId: "om_1", text: "updated" }),
      ).rejects.toThrow("not configured");
    });

    it("calls update with message ID and post content", async () => {
      messageUpdateMock.mockResolvedValue({ code: 0 });
      await editMessageFeishu({ cfg: fakeCfg, messageId: "om_1", text: "updated" });

      expect(messageUpdateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          path: { message_id: "om_1" },
          data: expect.objectContaining({
            msg_type: "post",
          }),
        }),
      );
    });

    it("throws when update returns non-zero code", async () => {
      messageUpdateMock.mockResolvedValue({ code: 99, msg: "24h expired" });
      await expect(
        editMessageFeishu({ cfg: fakeCfg, messageId: "om_1", text: "updated" }),
      ).rejects.toThrow("Feishu message edit failed: 24h expired");
    });
  });
});
