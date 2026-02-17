import { describe, expect, it, vi } from "vitest";
import type { OpenClawConfig } from "../../../config/config.js";
import { signalOutbound } from "./signal.js";

const sendMessageSignal = vi.fn(async () => ({ ok: true }));

vi.mock("../../../signal/send.js", () => ({
  sendMessageSignal: (...args: unknown[]) => sendMessageSignal(...args),
}));

function cfg(overrides?: Partial<OpenClawConfig>): OpenClawConfig {
  return { ...overrides } as OpenClawConfig;
}

describe("signalOutbound", () => {
  it("has direct delivery mode", () => {
    expect(signalOutbound.deliveryMode).toBe("direct");
  });

  it("has a text chunk limit of 4000", () => {
    expect(signalOutbound.textChunkLimit).toBe(4000);
  });

  describe("sendText", () => {
    it("sends a text message via signal", async () => {
      sendMessageSignal.mockClear();
      sendMessageSignal.mockResolvedValue({ ok: true });

      const result = await signalOutbound.sendText({
        cfg: cfg(),
        to: "+15550001111",
        text: "hello",
        accountId: undefined,
        deps: { sendSignal: sendMessageSignal },
      });

      expect(sendMessageSignal).toHaveBeenCalledWith("+15550001111", "hello", {
        maxBytes: undefined,
        accountId: undefined,
      });
      expect(result).toEqual({ channel: "signal", ok: true });
    });

    it("passes accountId when provided", async () => {
      sendMessageSignal.mockClear();
      sendMessageSignal.mockResolvedValue({ ok: true });

      await signalOutbound.sendText({
        cfg: cfg(),
        to: "+15550001111",
        text: "test",
        accountId: "work",
        deps: { sendSignal: sendMessageSignal },
      });

      expect(sendMessageSignal).toHaveBeenCalledWith("+15550001111", "test", {
        maxBytes: undefined,
        accountId: "work",
      });
    });

    it("resolves mediaMaxMb from account-level config", async () => {
      sendMessageSignal.mockClear();
      sendMessageSignal.mockResolvedValue({ ok: true });

      const config = cfg({
        channels: {
          signal: {
            accounts: {
              work: { mediaMaxMb: 25 },
            },
          },
        },
      } as Partial<OpenClawConfig>);

      await signalOutbound.sendText({
        cfg: config,
        to: "+15550001111",
        text: "test",
        accountId: "work",
        deps: { sendSignal: sendMessageSignal },
      });

      const callArgs = sendMessageSignal.mock.calls[0];
      expect(callArgs[2].maxBytes).toBe(25 * 1024 * 1024);
    });

    it("resolves mediaMaxMb from channel-level config", async () => {
      sendMessageSignal.mockClear();
      sendMessageSignal.mockResolvedValue({ ok: true });

      const config = cfg({
        channels: {
          signal: { mediaMaxMb: 10 },
        },
      } as Partial<OpenClawConfig>);

      await signalOutbound.sendText({
        cfg: config,
        to: "+15550001111",
        text: "test",
        accountId: undefined,
        deps: { sendSignal: sendMessageSignal },
      });

      const callArgs = sendMessageSignal.mock.calls[0];
      expect(callArgs[2].maxBytes).toBe(10 * 1024 * 1024);
    });

    it("propagates send errors", async () => {
      sendMessageSignal.mockClear();
      sendMessageSignal.mockRejectedValue(new Error("network error"));

      await expect(
        signalOutbound.sendText({
          cfg: cfg(),
          to: "+15550001111",
          text: "test",
          accountId: undefined,
          deps: { sendSignal: sendMessageSignal },
        }),
      ).rejects.toThrow("network error");
    });
  });

  describe("sendMedia", () => {
    it("sends a media message with URL", async () => {
      sendMessageSignal.mockClear();
      sendMessageSignal.mockResolvedValue({ ok: true });

      const result = await signalOutbound.sendMedia({
        cfg: cfg(),
        to: "+15550001111",
        text: "check this out",
        mediaUrl: "https://example.com/image.png",
        accountId: undefined,
        deps: { sendSignal: sendMessageSignal },
      });

      expect(sendMessageSignal).toHaveBeenCalledWith("+15550001111", "check this out", {
        mediaUrl: "https://example.com/image.png",
        maxBytes: undefined,
        accountId: undefined,
      });
      expect(result).toEqual({ channel: "signal", ok: true });
    });

    it("passes accountId for media messages", async () => {
      sendMessageSignal.mockClear();
      sendMessageSignal.mockResolvedValue({ ok: true });

      await signalOutbound.sendMedia({
        cfg: cfg(),
        to: "+15550001111",
        text: "media",
        mediaUrl: "https://example.com/file.pdf",
        accountId: "personal",
        deps: { sendSignal: sendMessageSignal },
      });

      const callArgs = sendMessageSignal.mock.calls[0];
      expect(callArgs[2].accountId).toBe("personal");
      expect(callArgs[2].mediaUrl).toBe("https://example.com/file.pdf");
    });

    it("propagates media send errors", async () => {
      sendMessageSignal.mockClear();
      sendMessageSignal.mockRejectedValue(new Error("file too large"));

      await expect(
        signalOutbound.sendMedia({
          cfg: cfg(),
          to: "+15550001111",
          text: "test",
          mediaUrl: "https://example.com/big.zip",
          accountId: undefined,
          deps: { sendSignal: sendMessageSignal },
        }),
      ).rejects.toThrow("file too large");
    });
  });
});
