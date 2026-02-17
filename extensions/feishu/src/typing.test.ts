import { beforeEach, describe, expect, it, vi } from "vitest";

// ── vi.hoisted mocks ────────────────────────────────────────

const resolveFeishuAccountMock = vi.hoisted(() => vi.fn());
const createFeishuClientMock = vi.hoisted(() => vi.fn());

const reactionCreateMock = vi.hoisted(() => vi.fn());
const reactionDeleteMock = vi.hoisted(() => vi.fn());

vi.mock("./accounts.js", () => ({
  resolveFeishuAccount: resolveFeishuAccountMock,
}));

vi.mock("./client.js", () => ({
  createFeishuClient: createFeishuClientMock,
}));

import { addTypingIndicator, removeTypingIndicator } from "./typing.js";

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
      messageReaction: {
        create: reactionCreateMock,
        delete: reactionDeleteMock,
      },
    },
  });
}

describe("typing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupAccount();
    setupClient();
  });

  // ── addTypingIndicator ───────────────────────────────────

  describe("addTypingIndicator", () => {
    it("returns null reactionId when account is not configured", async () => {
      setupAccount(false);
      const result = await addTypingIndicator({ cfg: fakeCfg, messageId: "om_1" });
      expect(result).toEqual({ messageId: "om_1", reactionId: null });
      expect(createFeishuClientMock).not.toHaveBeenCalled();
    });

    it("returns reactionId on successful reaction create", async () => {
      reactionCreateMock.mockResolvedValue({
        data: { reaction_id: "reaction_abc" },
      });

      const result = await addTypingIndicator({ cfg: fakeCfg, messageId: "om_1" });
      expect(result).toEqual({ messageId: "om_1", reactionId: "reaction_abc" });
      expect(reactionCreateMock).toHaveBeenCalledWith({
        path: { message_id: "om_1" },
        data: {
          reaction_type: { emoji_type: "Typing" },
        },
      });
    });

    it("returns null reactionId when response has no reaction_id", async () => {
      reactionCreateMock.mockResolvedValue({ data: {} });

      const result = await addTypingIndicator({ cfg: fakeCfg, messageId: "om_1" });
      expect(result).toEqual({ messageId: "om_1", reactionId: null });
    });

    it("silently fails on API error and returns null reactionId", async () => {
      reactionCreateMock.mockRejectedValue(new Error("rate limited"));

      const result = await addTypingIndicator({ cfg: fakeCfg, messageId: "om_1" });
      expect(result).toEqual({ messageId: "om_1", reactionId: null });
    });

    it("passes accountId to resolveFeishuAccount", async () => {
      reactionCreateMock.mockResolvedValue({
        data: { reaction_id: "reaction_x" },
      });

      await addTypingIndicator({
        cfg: fakeCfg,
        messageId: "om_1",
        accountId: "secondary",
      });
      expect(resolveFeishuAccountMock).toHaveBeenCalledWith({
        cfg: fakeCfg,
        accountId: "secondary",
      });
    });
  });

  // ── removeTypingIndicator ────────────────────────────────

  describe("removeTypingIndicator", () => {
    it("is a no-op when reactionId is null", async () => {
      await removeTypingIndicator({
        cfg: fakeCfg,
        state: { messageId: "om_1", reactionId: null },
      });
      expect(resolveFeishuAccountMock).not.toHaveBeenCalled();
      expect(createFeishuClientMock).not.toHaveBeenCalled();
      expect(reactionDeleteMock).not.toHaveBeenCalled();
    });

    it("returns early when account is not configured", async () => {
      setupAccount(false);
      await removeTypingIndicator({
        cfg: fakeCfg,
        state: { messageId: "om_1", reactionId: "reaction_abc" },
      });
      expect(createFeishuClientMock).not.toHaveBeenCalled();
      expect(reactionDeleteMock).not.toHaveBeenCalled();
    });

    it("calls delete with correct message and reaction IDs", async () => {
      reactionDeleteMock.mockResolvedValue({});

      await removeTypingIndicator({
        cfg: fakeCfg,
        state: { messageId: "om_1", reactionId: "reaction_abc" },
      });

      expect(reactionDeleteMock).toHaveBeenCalledWith({
        path: {
          message_id: "om_1",
          reaction_id: "reaction_abc",
        },
      });
    });

    it("silently fails on API error", async () => {
      reactionDeleteMock.mockRejectedValue(new Error("not found"));

      // Should not throw
      await removeTypingIndicator({
        cfg: fakeCfg,
        state: { messageId: "om_1", reactionId: "reaction_abc" },
      });
    });

    it("passes accountId to resolveFeishuAccount", async () => {
      reactionDeleteMock.mockResolvedValue({});

      await removeTypingIndicator({
        cfg: fakeCfg,
        state: { messageId: "om_1", reactionId: "reaction_abc" },
        accountId: "secondary",
      });
      expect(resolveFeishuAccountMock).toHaveBeenCalledWith({
        cfg: fakeCfg,
        accountId: "secondary",
      });
    });
  });
});
