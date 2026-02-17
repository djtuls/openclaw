import type { PluginRuntime } from "openclaw/plugin-sdk";
import { beforeEach, describe, expect, it } from "vitest";
import type { CoreConfig } from "./types.js";
import { matrixPlugin } from "./channel.js";
import { setMatrixRuntime } from "./runtime.js";

describe("matrix messaging.normalizeTarget", () => {
  const normalize = matrixPlugin.messaging!.normalizeTarget!;

  it("returns undefined for empty string", () => {
    expect(normalize("")).toBeUndefined();
  });

  it("returns undefined for whitespace only", () => {
    expect(normalize("   ")).toBeUndefined();
  });

  it("strips matrix: prefix", () => {
    expect(normalize("matrix:!room:server")).toBe("!room:server");
  });

  it("strips room: prefix", () => {
    expect(normalize("room:!room:server")).toBe("!room:server");
  });

  it("strips channel: prefix", () => {
    expect(normalize("channel:#alias:server")).toBe("#alias:server");
  });

  it("strips user: prefix", () => {
    expect(normalize("user:@alice:server")).toBe("@alice:server");
  });

  it("strips matrix: + room: combined prefix", () => {
    expect(normalize("matrix:room:!room:server")).toBe("!room:server");
  });

  it("passes through plain room IDs", () => {
    expect(normalize("!room:server")).toBe("!room:server");
  });

  it("passes through plain aliases", () => {
    expect(normalize("#alias:server")).toBe("#alias:server");
  });

  it("passes through plain user IDs", () => {
    expect(normalize("@alice:server")).toBe("@alice:server");
  });

  it("trims whitespace", () => {
    expect(normalize("  !room:server  ")).toBe("!room:server");
  });

  it("returns undefined if only prefix remains after stripping", () => {
    expect(normalize("matrix:")).toBeUndefined();
  });
});

describe("matrix messaging.targetResolver.looksLikeId", () => {
  const looksLikeId = matrixPlugin.messaging!.targetResolver!.looksLikeId!;

  it("returns false for empty string", () => {
    expect(looksLikeId("")).toBe(false);
  });

  it("returns true for room IDs starting with !", () => {
    expect(looksLikeId("!room:server")).toBe(true);
  });

  it("returns true for aliases starting with #", () => {
    expect(looksLikeId("#alias:server")).toBe(true);
  });

  it("returns true for user IDs starting with @", () => {
    expect(looksLikeId("@user:server")).toBe(true);
  });

  it("returns true for matrix: prefixed room IDs", () => {
    expect(looksLikeId("matrix:!room:server")).toBe(true);
  });

  it("returns true for strings containing colon", () => {
    expect(looksLikeId("localpart:server")).toBe(true);
  });

  it("returns false for plain text without colon", () => {
    expect(looksLikeId("just-a-name")).toBe(false);
  });
});

describe("matrix setup.validateInput", () => {
  const validateInput = matrixPlugin.setup!.validateInput!;

  it("returns null when useEnv is true", () => {
    expect(validateInput({ input: { useEnv: true } })).toBeNull();
  });

  it("requires homeserver", () => {
    expect(validateInput({ input: {} })).toBe("Matrix requires --homeserver");
  });

  it("requires homeserver (rejects whitespace)", () => {
    expect(validateInput({ input: { homeserver: "  " } })).toBe("Matrix requires --homeserver");
  });

  it("requires access-token or password", () => {
    expect(validateInput({ input: { homeserver: "https://matrix.org" } })).toBe(
      "Matrix requires --access-token or --password",
    );
  });

  it("accepts access token without userId", () => {
    expect(
      validateInput({
        input: {
          homeserver: "https://matrix.org",
          accessToken: "syt_token",
        },
      }),
    ).toBeNull();
  });

  it("requires userId when using password", () => {
    expect(
      validateInput({
        input: {
          homeserver: "https://matrix.org",
          password: "secret",
        },
      }),
    ).toBe("Matrix requires --user-id when using --password");
  });

  it("requires access-token or password even when userId is given", () => {
    // The !accessToken && !password guard fires before the !password check,
    // so userId alone still triggers the "requires --access-token or --password" error.
    expect(
      validateInput({
        input: {
          homeserver: "https://matrix.org",
          userId: "@bot:matrix.org",
        },
      }),
    ).toBe("Matrix requires --access-token or --password");
  });

  it("accepts userId + password combination", () => {
    expect(
      validateInput({
        input: {
          homeserver: "https://matrix.org",
          userId: "@bot:matrix.org",
          password: "secret",
        },
      }),
    ).toBeNull();
  });
});

describe("matrix security.collectWarnings", () => {
  beforeEach(() => {
    setMatrixRuntime({
      state: {
        resolveStateDir: (_env: unknown, homeDir: () => string) => homeDir(),
      },
    } as PluginRuntime);
  });

  it("returns empty array when groupPolicy is not open", () => {
    const account = {
      accountId: "default",
      enabled: true,
      configured: true,
      config: { groupPolicy: "allowlist" as const },
    };
    const cfg = { channels: {} } as CoreConfig;
    const warnings = matrixPlugin.security!.collectWarnings!({
      account,
      cfg,
    } as any);
    expect(warnings).toEqual([]);
  });

  it("returns warning when groupPolicy is open", () => {
    const account = {
      accountId: "default",
      enabled: true,
      configured: true,
      config: { groupPolicy: "open" as const },
    };
    const cfg = { channels: {} } as CoreConfig;
    const warnings = matrixPlugin.security!.collectWarnings!({
      account,
      cfg,
    } as any);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('groupPolicy="open"');
  });

  it("inherits groupPolicy from defaults when not set on account", () => {
    const account = {
      accountId: "default",
      enabled: true,
      configured: true,
      config: {},
    };
    const cfg = {
      channels: { defaults: { groupPolicy: "open" } },
    } as CoreConfig;
    const warnings = matrixPlugin.security!.collectWarnings!({
      account,
      cfg,
    } as any);
    expect(warnings).toHaveLength(1);
  });

  it("defaults to allowlist when neither account nor defaults set policy", () => {
    const account = {
      accountId: "default",
      enabled: true,
      configured: true,
      config: {},
    };
    const cfg = { channels: {} } as CoreConfig;
    const warnings = matrixPlugin.security!.collectWarnings!({
      account,
      cfg,
    } as any);
    expect(warnings).toEqual([]);
  });
});

describe("matrix threading.resolveReplyToMode", () => {
  it("returns configured replyToMode", () => {
    const cfg = { channels: { matrix: { replyToMode: "all" } } } as CoreConfig;
    expect(matrixPlugin.threading!.resolveReplyToMode!({ cfg } as any)).toBe("all");
  });

  it("defaults to off when not set", () => {
    const cfg = { channels: {} } as CoreConfig;
    expect(matrixPlugin.threading!.resolveReplyToMode!({ cfg } as any)).toBe("off");
  });
});
