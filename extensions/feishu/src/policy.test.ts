import { describe, expect, it } from "vitest";
import {
  resolveFeishuAllowlistMatch,
  resolveFeishuGroupConfig,
  resolveFeishuGroupToolPolicy,
  isFeishuGroupAllowed,
  resolveFeishuReplyPolicy,
} from "./policy.js";

// ── resolveFeishuAllowlistMatch ──────────────────────────────

describe("resolveFeishuAllowlistMatch", () => {
  it("returns not allowed when allowFrom is empty", () => {
    const result = resolveFeishuAllowlistMatch({
      allowFrom: [],
      senderId: "ou_user_1",
    });
    expect(result.allowed).toBe(false);
  });

  it("matches wildcard *", () => {
    const result = resolveFeishuAllowlistMatch({
      allowFrom: ["*"],
      senderId: "ou_user_1",
    });
    expect(result).toEqual({ allowed: true, matchKey: "*", matchSource: "wildcard" });
  });

  it("matches by sender ID (case-insensitive)", () => {
    const result = resolveFeishuAllowlistMatch({
      allowFrom: ["OU_USER_1"],
      senderId: "ou_user_1",
    });
    expect(result).toEqual({ allowed: true, matchKey: "ou_user_1", matchSource: "id" });
  });

  it("matches by sender name (case-insensitive)", () => {
    const result = resolveFeishuAllowlistMatch({
      allowFrom: ["alice"],
      senderId: "ou_user_1",
      senderName: "Alice",
    });
    expect(result).toEqual({ allowed: true, matchKey: "alice", matchSource: "name" });
  });

  it("returns not allowed when sender does not match", () => {
    const result = resolveFeishuAllowlistMatch({
      allowFrom: ["ou_other"],
      senderId: "ou_user_1",
      senderName: "Alice",
    });
    expect(result.allowed).toBe(false);
  });

  it("prefers wildcard over id match", () => {
    const result = resolveFeishuAllowlistMatch({
      allowFrom: ["*", "ou_user_1"],
      senderId: "ou_user_1",
    });
    expect(result.matchSource).toBe("wildcard");
  });

  it("prefers id match over name match", () => {
    const result = resolveFeishuAllowlistMatch({
      allowFrom: ["ou_user_1", "alice"],
      senderId: "ou_user_1",
      senderName: "Alice",
    });
    expect(result.matchSource).toBe("id");
  });

  it("trims and lowercases allowFrom entries", () => {
    const result = resolveFeishuAllowlistMatch({
      allowFrom: ["  OU_USER_1  "],
      senderId: "ou_user_1",
    });
    expect(result.allowed).toBe(true);
  });

  it("filters out empty entries after trimming", () => {
    const result = resolveFeishuAllowlistMatch({
      allowFrom: ["", "  ", "ou_user_1"],
      senderId: "ou_user_1",
    });
    expect(result.allowed).toBe(true);
  });

  it("handles numeric entries via String() conversion", () => {
    const result = resolveFeishuAllowlistMatch({
      allowFrom: [12345],
      senderId: "12345",
    });
    expect(result.allowed).toBe(true);
  });

  it("returns not allowed when senderName is null", () => {
    const result = resolveFeishuAllowlistMatch({
      allowFrom: ["alice"],
      senderId: "ou_user_1",
      senderName: null,
    });
    expect(result.allowed).toBe(false);
  });
});

// ── resolveFeishuGroupConfig ─────────────────────────────────

describe("resolveFeishuGroupConfig", () => {
  const groups = {
    oc_group_A: { enabled: true },
    OC_GROUP_B: { enabled: false },
  } as any;

  it("returns undefined when cfg is undefined", () => {
    expect(resolveFeishuGroupConfig({ cfg: undefined })).toBeUndefined();
  });

  it("returns undefined when groupId is empty", () => {
    expect(resolveFeishuGroupConfig({ cfg: { groups }, groupId: "" })).toBeUndefined();
  });

  it("returns undefined when groupId is null", () => {
    expect(resolveFeishuGroupConfig({ cfg: { groups }, groupId: null })).toBeUndefined();
  });

  it("finds group by exact key", () => {
    const result = resolveFeishuGroupConfig({ cfg: { groups }, groupId: "oc_group_A" });
    expect(result).toEqual({ enabled: true });
  });

  it("finds group by case-insensitive key", () => {
    const result = resolveFeishuGroupConfig({ cfg: { groups }, groupId: "oc_group_b" });
    expect(result).toEqual({ enabled: false });
  });

  it("returns undefined when group is not found", () => {
    const result = resolveFeishuGroupConfig({ cfg: { groups }, groupId: "oc_unknown" });
    expect(result).toBeUndefined();
  });

  it("returns undefined when groups is empty", () => {
    const result = resolveFeishuGroupConfig({ cfg: { groups: {} }, groupId: "oc_group_A" });
    expect(result).toBeUndefined();
  });

  it("trims groupId whitespace", () => {
    const result = resolveFeishuGroupConfig({ cfg: { groups }, groupId: "  oc_group_A  " });
    expect(result).toEqual({ enabled: true });
  });
});

// ── resolveFeishuGroupToolPolicy ─────────────────────────────

describe("resolveFeishuGroupToolPolicy", () => {
  it("returns undefined when no feishu config", () => {
    const result = resolveFeishuGroupToolPolicy({
      cfg: { channels: {} } as any,
      groupId: "oc_group",
    });
    expect(result).toBeUndefined();
  });

  it("returns undefined when no group config found", () => {
    const result = resolveFeishuGroupToolPolicy({
      cfg: { channels: { feishu: { groups: {} } } } as any,
      groupId: "oc_unknown",
    });
    expect(result).toBeUndefined();
  });

  it("returns tools config from group", () => {
    const tools = { web: true, code: false };
    const result = resolveFeishuGroupToolPolicy({
      cfg: {
        channels: {
          feishu: {
            groups: { oc_group: { tools } },
          },
        },
      } as any,
      groupId: "oc_group",
    });
    expect(result).toEqual(tools);
  });

  it("returns undefined when group has no tools config", () => {
    const result = resolveFeishuGroupToolPolicy({
      cfg: {
        channels: {
          feishu: {
            groups: { oc_group: { enabled: true } },
          },
        },
      } as any,
      groupId: "oc_group",
    });
    expect(result).toBeUndefined();
  });
});

// ── isFeishuGroupAllowed ─────────────────────────────────────

describe("isFeishuGroupAllowed", () => {
  it("returns false when policy is disabled", () => {
    expect(
      isFeishuGroupAllowed({
        groupPolicy: "disabled",
        allowFrom: ["*"],
        senderId: "ou_user_1",
      }),
    ).toBe(false);
  });

  it("returns true when policy is open", () => {
    expect(
      isFeishuGroupAllowed({
        groupPolicy: "open",
        allowFrom: [],
        senderId: "ou_user_1",
      }),
    ).toBe(true);
  });

  it("returns true when policy is allowlist and sender matches", () => {
    expect(
      isFeishuGroupAllowed({
        groupPolicy: "allowlist",
        allowFrom: ["ou_user_1"],
        senderId: "ou_user_1",
      }),
    ).toBe(true);
  });

  it("returns false when policy is allowlist and sender does not match", () => {
    expect(
      isFeishuGroupAllowed({
        groupPolicy: "allowlist",
        allowFrom: ["ou_other"],
        senderId: "ou_user_1",
      }),
    ).toBe(false);
  });

  it("returns true when policy is allowlist with wildcard", () => {
    expect(
      isFeishuGroupAllowed({
        groupPolicy: "allowlist",
        allowFrom: ["*"],
        senderId: "ou_user_1",
      }),
    ).toBe(true);
  });

  it("allowlist matches by name", () => {
    expect(
      isFeishuGroupAllowed({
        groupPolicy: "allowlist",
        allowFrom: ["alice"],
        senderId: "ou_user_1",
        senderName: "Alice",
      }),
    ).toBe(true);
  });
});

// ── resolveFeishuReplyPolicy ─────────────────────────────────

describe("resolveFeishuReplyPolicy", () => {
  it("DM: requireMention is always false", () => {
    const result = resolveFeishuReplyPolicy({ isDirectMessage: true });
    expect(result.requireMention).toBe(false);
  });

  it("DM: ignores groupConfig.requireMention", () => {
    const result = resolveFeishuReplyPolicy({
      isDirectMessage: true,
      groupConfig: { requireMention: true } as any,
    });
    expect(result.requireMention).toBe(false);
  });

  it("group: defaults to requireMention=true when no config", () => {
    const result = resolveFeishuReplyPolicy({ isDirectMessage: false });
    expect(result.requireMention).toBe(true);
  });

  it("group: uses groupConfig.requireMention when set", () => {
    const result = resolveFeishuReplyPolicy({
      isDirectMessage: false,
      groupConfig: { requireMention: false } as any,
    });
    expect(result.requireMention).toBe(false);
  });

  it("group: uses globalConfig.requireMention when groupConfig not set", () => {
    const result = resolveFeishuReplyPolicy({
      isDirectMessage: false,
      globalConfig: { requireMention: false } as any,
    });
    expect(result.requireMention).toBe(false);
  });

  it("group: groupConfig overrides globalConfig", () => {
    const result = resolveFeishuReplyPolicy({
      isDirectMessage: false,
      globalConfig: { requireMention: true } as any,
      groupConfig: { requireMention: false } as any,
    });
    expect(result.requireMention).toBe(false);
  });
});
