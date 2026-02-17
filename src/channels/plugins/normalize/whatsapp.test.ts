import { describe, expect, it } from "vitest";
import { looksLikeWhatsAppTargetId, normalizeWhatsAppMessagingTarget } from "./whatsapp.js";

describe("WhatsApp target normalization", () => {
  describe("normalizeWhatsAppMessagingTarget", () => {
    it("returns undefined for empty string", () => {
      expect(normalizeWhatsAppMessagingTarget("")).toBeUndefined();
    });

    it("returns undefined for whitespace-only string", () => {
      expect(normalizeWhatsAppMessagingTarget("   ")).toBeUndefined();
    });

    it("normalizes an E.164 phone number", () => {
      expect(normalizeWhatsAppMessagingTarget("+15555550123")).toBe("+15555550123");
    });

    it("normalizes a phone number without leading +", () => {
      expect(normalizeWhatsAppMessagingTarget("15555550123")).toBe("+15555550123");
    });

    it("strips leading/trailing whitespace before normalizing", () => {
      expect(normalizeWhatsAppMessagingTarget("  +15555550123  ")).toBe("+15555550123");
    });

    it("normalizes whatsapp: prefixed phone numbers", () => {
      expect(normalizeWhatsAppMessagingTarget("whatsapp:+15555550123")).toBe("+15555550123");
    });

    it("normalizes group JID targets", () => {
      expect(normalizeWhatsAppMessagingTarget("120363401234567890@g.us")).toBe(
        "120363401234567890@g.us",
      );
    });

    it("normalizes whatsapp: prefixed group JIDs", () => {
      expect(normalizeWhatsAppMessagingTarget("whatsapp:120363401234567890@g.us")).toBe(
        "120363401234567890@g.us",
      );
    });

    it("normalizes user JID targets to E.164", () => {
      expect(normalizeWhatsAppMessagingTarget("41796666864:0@s.whatsapp.net")).toBe("+41796666864");
    });

    it("returns undefined for invalid targets", () => {
      expect(normalizeWhatsAppMessagingTarget("not-a-number")).toBeUndefined();
    });

    it("returns undefined for unknown @ JID formats", () => {
      expect(normalizeWhatsAppMessagingTarget("something@unknown.net")).toBeUndefined();
    });
  });

  describe("looksLikeWhatsAppTargetId", () => {
    it("returns false for empty string", () => {
      expect(looksLikeWhatsAppTargetId("")).toBe(false);
    });

    it("returns false for whitespace-only string", () => {
      expect(looksLikeWhatsAppTargetId("   ")).toBe(false);
    });

    it("accepts whatsapp: prefixed strings", () => {
      expect(looksLikeWhatsAppTargetId("whatsapp:+15555550123")).toBe(true);
    });

    it("accepts WHATSAPP: (case insensitive prefix)", () => {
      expect(looksLikeWhatsAppTargetId("WHATSAPP:+15555550123")).toBe(true);
    });

    it("accepts strings containing @", () => {
      expect(looksLikeWhatsAppTargetId("120363401234567890@g.us")).toBe(true);
      expect(looksLikeWhatsAppTargetId("41796666864:0@s.whatsapp.net")).toBe(true);
    });

    it("accepts phone-number-like strings (3+ digits)", () => {
      expect(looksLikeWhatsAppTargetId("+15555550123")).toBe(true);
      expect(looksLikeWhatsAppTargetId("15555550123")).toBe(true);
      expect(looksLikeWhatsAppTargetId("123")).toBe(true);
    });

    it("rejects short numeric strings (fewer than 3 digits)", () => {
      expect(looksLikeWhatsAppTargetId("12")).toBe(false);
    });

    it("rejects non-numeric, non-prefixed strings", () => {
      expect(looksLikeWhatsAppTargetId("hello")).toBe(false);
      expect(looksLikeWhatsAppTargetId("abc")).toBe(false);
    });
  });
});
