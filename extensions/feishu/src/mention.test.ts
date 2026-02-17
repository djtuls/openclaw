import { describe, expect, it } from "vitest";
import type { MentionTarget } from "./mention.js";
import {
  extractMentionTargets,
  isMentionForwardRequest,
  extractMessageBody,
  formatMentionForText,
  formatMentionAllForText,
  formatMentionForCard,
  formatMentionAllForCard,
  buildMentionedMessage,
  buildMentionedCardContent,
} from "./mention.js";

// ── Helpers ──────────────────────────────────────────────────

const BOT_OPEN_ID = "ou_bot_000";
const USER_A_OPEN_ID = "ou_user_aaa";
const USER_B_OPEN_ID = "ou_user_bbb";

function makeMention(openId: string, name: string, key: string) {
  return { id: { open_id: openId }, name, key };
}

function makeEvent(overrides: {
  chatType?: "p2p" | "group";
  mentions?: Array<{ id: { open_id?: string }; name: string; key: string }>;
}) {
  return {
    message: {
      chat_type: overrides.chatType ?? "group",
      mentions: overrides.mentions,
    },
  } as any;
}

function makeTarget(openId: string, name: string, key: string): MentionTarget {
  return { openId, name, key };
}

// ── extractMentionTargets ────────────────────────────────────

describe("extractMentionTargets", () => {
  it("returns empty array when no mentions", () => {
    const event = makeEvent({ mentions: undefined });
    expect(extractMentionTargets(event)).toEqual([]);
  });

  it("returns empty array when mentions is empty", () => {
    const event = makeEvent({ mentions: [] });
    expect(extractMentionTargets(event)).toEqual([]);
  });

  it("excludes the bot itself when botOpenId is provided", () => {
    const event = makeEvent({
      mentions: [
        makeMention(BOT_OPEN_ID, "Bot", "@_bot"),
        makeMention(USER_A_OPEN_ID, "Alice", "@_user_1"),
      ],
    });
    const result = extractMentionTargets(event, BOT_OPEN_ID);
    expect(result).toEqual([makeTarget(USER_A_OPEN_ID, "Alice", "@_user_1")]);
  });

  it("keeps all mentions when botOpenId is not provided", () => {
    const event = makeEvent({
      mentions: [
        makeMention(BOT_OPEN_ID, "Bot", "@_bot"),
        makeMention(USER_A_OPEN_ID, "Alice", "@_user_1"),
      ],
    });
    const result = extractMentionTargets(event);
    expect(result).toHaveLength(2);
  });

  it("filters out mentions without open_id", () => {
    const event = makeEvent({
      mentions: [
        { id: { open_id: undefined as any }, name: "Ghost", key: "@_ghost" },
        makeMention(USER_A_OPEN_ID, "Alice", "@_user_1"),
      ],
    });
    const result = extractMentionTargets(event);
    expect(result).toEqual([makeTarget(USER_A_OPEN_ID, "Alice", "@_user_1")]);
  });

  it("maps mention fields correctly", () => {
    const event = makeEvent({
      mentions: [makeMention(USER_B_OPEN_ID, "Bob", "@_user_2")],
    });
    const [target] = extractMentionTargets(event);
    expect(target).toEqual({ openId: USER_B_OPEN_ID, name: "Bob", key: "@_user_2" });
  });
});

// ── isMentionForwardRequest ──────────────────────────────────

describe("isMentionForwardRequest", () => {
  it("returns false when no mentions", () => {
    const event = makeEvent({ chatType: "group", mentions: [] });
    expect(isMentionForwardRequest(event, BOT_OPEN_ID)).toBe(false);
  });

  it("returns false when mentions is undefined", () => {
    const event = makeEvent({ chatType: "group", mentions: undefined });
    expect(isMentionForwardRequest(event, BOT_OPEN_ID)).toBe(false);
  });

  // DM rules
  it("DM: returns true when any non-bot user is mentioned", () => {
    const event = makeEvent({
      chatType: "p2p",
      mentions: [makeMention(USER_A_OPEN_ID, "Alice", "@_user_1")],
    });
    expect(isMentionForwardRequest(event, BOT_OPEN_ID)).toBe(true);
  });

  it("DM: returns false when only the bot is mentioned", () => {
    const event = makeEvent({
      chatType: "p2p",
      mentions: [makeMention(BOT_OPEN_ID, "Bot", "@_bot")],
    });
    expect(isMentionForwardRequest(event, BOT_OPEN_ID)).toBe(false);
  });

  // Group rules
  it("group: returns true when both bot and another user are mentioned", () => {
    const event = makeEvent({
      chatType: "group",
      mentions: [
        makeMention(BOT_OPEN_ID, "Bot", "@_bot"),
        makeMention(USER_A_OPEN_ID, "Alice", "@_user_1"),
      ],
    });
    expect(isMentionForwardRequest(event, BOT_OPEN_ID)).toBe(true);
  });

  it("group: returns false when only the bot is mentioned", () => {
    const event = makeEvent({
      chatType: "group",
      mentions: [makeMention(BOT_OPEN_ID, "Bot", "@_bot")],
    });
    expect(isMentionForwardRequest(event, BOT_OPEN_ID)).toBe(false);
  });

  it("group: returns false when only other users are mentioned (no bot)", () => {
    const event = makeEvent({
      chatType: "group",
      mentions: [makeMention(USER_A_OPEN_ID, "Alice", "@_user_1")],
    });
    expect(isMentionForwardRequest(event, BOT_OPEN_ID)).toBe(false);
  });

  it("group: returns true with multiple other users and bot", () => {
    const event = makeEvent({
      chatType: "group",
      mentions: [
        makeMention(BOT_OPEN_ID, "Bot", "@_bot"),
        makeMention(USER_A_OPEN_ID, "Alice", "@_user_1"),
        makeMention(USER_B_OPEN_ID, "Bob", "@_user_2"),
      ],
    });
    expect(isMentionForwardRequest(event, BOT_OPEN_ID)).toBe(true);
  });
});

// ── extractMessageBody ───────────────────────────────────────

describe("extractMessageBody", () => {
  it("removes mention placeholders from text", () => {
    expect(extractMessageBody("@_user_1 hello world", ["@_user_1"])).toBe("hello world");
  });

  it("removes multiple placeholders", () => {
    expect(extractMessageBody("@_bot @_user_1 hi", ["@_bot", "@_user_1"])).toBe("hi");
  });

  it("collapses multiple spaces after removal", () => {
    expect(extractMessageBody("@_bot   hello   world", ["@_bot"])).toBe("hello world");
  });

  it("trims leading and trailing whitespace", () => {
    expect(extractMessageBody("  @_bot hello  ", ["@_bot"])).toBe("hello");
  });

  it("handles empty mention keys array", () => {
    expect(extractMessageBody("hello world", [])).toBe("hello world");
  });

  it("handles regex special characters in keys", () => {
    expect(extractMessageBody("@_user.1 test", ["@_user.1"])).toBe("test");
  });
});

// ── formatMentionForText ─────────────────────────────────────

describe("formatMentionForText", () => {
  it("formats text mention with user_id and name", () => {
    const target = makeTarget(USER_A_OPEN_ID, "Alice", "@_user_1");
    expect(formatMentionForText(target)).toBe(`<at user_id="${USER_A_OPEN_ID}">Alice</at>`);
  });
});

// ── formatMentionAllForText ──────────────────────────────────

describe("formatMentionAllForText", () => {
  it("formats @everyone for text", () => {
    expect(formatMentionAllForText()).toBe('<at user_id="all">Everyone</at>');
  });
});

// ── formatMentionForCard ─────────────────────────────────────

describe("formatMentionForCard", () => {
  it("formats card mention with id attribute", () => {
    const target = makeTarget(USER_A_OPEN_ID, "Alice", "@_user_1");
    expect(formatMentionForCard(target)).toBe(`<at id=${USER_A_OPEN_ID}></at>`);
  });
});

// ── formatMentionAllForCard ──────────────────────────────────

describe("formatMentionAllForCard", () => {
  it("formats @everyone for card", () => {
    expect(formatMentionAllForCard()).toBe("<at id=all></at>");
  });
});

// ── buildMentionedMessage ────────────────────────────────────

describe("buildMentionedMessage", () => {
  it("returns message as-is when targets is empty", () => {
    expect(buildMentionedMessage([], "hello")).toBe("hello");
  });

  it("prepends text-format mentions to message", () => {
    const targets = [makeTarget(USER_A_OPEN_ID, "Alice", "@_user_1")];
    const result = buildMentionedMessage(targets, "hello");
    expect(result).toBe(`<at user_id="${USER_A_OPEN_ID}">Alice</at> hello`);
  });

  it("joins multiple mentions with spaces", () => {
    const targets = [
      makeTarget(USER_A_OPEN_ID, "Alice", "@_user_1"),
      makeTarget(USER_B_OPEN_ID, "Bob", "@_user_2"),
    ];
    const result = buildMentionedMessage(targets, "hi");
    expect(result).toContain(`<at user_id="${USER_A_OPEN_ID}">Alice</at>`);
    expect(result).toContain(`<at user_id="${USER_B_OPEN_ID}">Bob</at>`);
    expect(result).toEndWith(" hi");
  });
});

// ── buildMentionedCardContent ────────────────────────────────

describe("buildMentionedCardContent", () => {
  it("returns message as-is when targets is empty", () => {
    expect(buildMentionedCardContent([], "hello")).toBe("hello");
  });

  it("prepends card-format mentions to message", () => {
    const targets = [makeTarget(USER_A_OPEN_ID, "Alice", "@_user_1")];
    const result = buildMentionedCardContent(targets, "hello");
    expect(result).toBe(`<at id=${USER_A_OPEN_ID}></at> hello`);
  });

  it("joins multiple card mentions with spaces", () => {
    const targets = [
      makeTarget(USER_A_OPEN_ID, "Alice", "@_user_1"),
      makeTarget(USER_B_OPEN_ID, "Bob", "@_user_2"),
    ];
    const result = buildMentionedCardContent(targets, "hi");
    expect(result).toContain(`<at id=${USER_A_OPEN_ID}></at>`);
    expect(result).toContain(`<at id=${USER_B_OPEN_ID}></at>`);
    expect(result).toEndWith(" hi");
  });
});
