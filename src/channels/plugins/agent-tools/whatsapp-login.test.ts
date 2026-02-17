import { describe, expect, it, vi } from "vitest";

const startWebLoginWithQr = vi.fn();
const waitForWebLogin = vi.fn();

vi.mock("../../../web/login-qr.js", () => ({
  startWebLoginWithQr: (...args: unknown[]) => startWebLoginWithQr(...args),
  waitForWebLogin: (...args: unknown[]) => waitForWebLogin(...args),
}));

// Import after mocks.
const { createWhatsAppLoginTool } = await import("./whatsapp-login.js");

describe("createWhatsAppLoginTool", () => {
  it("returns a tool with correct name and label", () => {
    const tool = createWhatsAppLoginTool();
    expect(tool.name).toBe("whatsapp_login");
    expect(tool.label).toBe("WhatsApp Login");
  });

  it("has a valid parameter schema", () => {
    const tool = createWhatsAppLoginTool();
    expect(tool.parameters).toBeDefined();
  });

  describe("execute — start action", () => {
    it("calls startWebLoginWithQr and returns QR content when available", async () => {
      startWebLoginWithQr.mockResolvedValue({
        message: "Scan the QR code",
        qrDataUrl: "data:image/png;base64,abc123",
      });

      const tool = createWhatsAppLoginTool();
      const result = await tool.execute("call-1", { action: "start" });

      expect(startWebLoginWithQr).toHaveBeenCalledWith({
        timeoutMs: undefined,
        force: false,
      });
      expect(result.content).toHaveLength(1);
      expect(result.content[0].text).toContain("Scan the QR code");
      expect(result.content[0].text).toContain("![whatsapp-qr]");
      expect(result.details).toEqual({ qr: true });
    });

    it("returns no QR content when qrDataUrl is missing", async () => {
      startWebLoginWithQr.mockResolvedValue({
        message: "Already connected",
        qrDataUrl: null,
      });

      const tool = createWhatsAppLoginTool();
      const result = await tool.execute("call-2", { action: "start" });

      expect(result.content[0].text).toBe("Already connected");
      expect(result.details).toEqual({ qr: false });
    });

    it("passes timeoutMs and force options", async () => {
      startWebLoginWithQr.mockResolvedValue({
        message: "QR ready",
        qrDataUrl: "data:image/png;base64,xyz",
      });

      const tool = createWhatsAppLoginTool();
      await tool.execute("call-3", { action: "start", timeoutMs: 30000, force: true });

      expect(startWebLoginWithQr).toHaveBeenCalledWith({
        timeoutMs: 30000,
        force: true,
      });
    });

    it("defaults to start when action is missing", async () => {
      startWebLoginWithQr.mockResolvedValue({
        message: "Default action",
        qrDataUrl: "data:image/png;base64,def",
      });

      const tool = createWhatsAppLoginTool();
      await tool.execute("call-4", {});

      expect(startWebLoginWithQr).toHaveBeenCalled();
      expect(waitForWebLogin).not.toHaveBeenCalled();
    });
  });

  describe("execute — wait action", () => {
    it("calls waitForWebLogin and returns connection status", async () => {
      waitForWebLogin.mockResolvedValue({
        message: "Connected successfully",
        connected: true,
      });

      const tool = createWhatsAppLoginTool();
      const result = await tool.execute("call-5", { action: "wait" });

      expect(waitForWebLogin).toHaveBeenCalledWith({ timeoutMs: undefined });
      expect(result.content[0].text).toBe("Connected successfully");
      expect(result.details).toEqual({ connected: true });
    });

    it("passes timeoutMs to waitForWebLogin", async () => {
      waitForWebLogin.mockResolvedValue({
        message: "Timed out",
        connected: false,
      });

      const tool = createWhatsAppLoginTool();
      const result = await tool.execute("call-6", {
        action: "wait",
        timeoutMs: 60000,
      });

      expect(waitForWebLogin).toHaveBeenCalledWith({ timeoutMs: 60000 });
      expect(result.details).toEqual({ connected: false });
    });
  });
});
