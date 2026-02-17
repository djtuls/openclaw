import { describe, expect, it } from "vitest";
import type { CoreConfig } from "./types.js";
import {
  resolveMatrixGroupRequireMention,
  resolveMatrixGroupToolPolicy,
} from "./group-mentions.js";

function makeParams(overrides: { groupId?: string; groupChannel?: string; cfg?: CoreConfig }) {
  return {
    groupId: overrides.groupId ?? "",
    groupChannel: overrides.groupChannel ?? "",
    cfg: overrides.cfg ?? ({} as CoreConfig),
    accountId: "default",
  };
}

describe("resolveMatrixGroupRequireMention", () => {
  it("returns true by default when no room config exists", () => {
    expect(resolveMatrixGroupRequireMention(makeParams({}))).toBe(true);
  });

  it("returns false when autoReply is true", () => {
    const cfg: CoreConfig = {
      channels: {
        matrix: {
          groups: {
            "!room:server": { autoReply: true },
          },
        },
      },
    };
    expect(resolveMatrixGroupRequireMention(makeParams({ groupId: "!room:server", cfg }))).toBe(
      false,
    );
  });

  it("returns true when autoReply is false", () => {
    const cfg: CoreConfig = {
      channels: {
        matrix: {
          groups: {
            "!room:server": { autoReply: false },
          },
        },
      },
    };
    expect(resolveMatrixGroupRequireMention(makeParams({ groupId: "!room:server", cfg }))).toBe(
      true,
    );
  });

  it("returns the explicit requireMention value", () => {
    const cfg: CoreConfig = {
      channels: {
        matrix: {
          groups: {
            "!room:server": { requireMention: false },
          },
        },
      },
    };
    expect(resolveMatrixGroupRequireMention(makeParams({ groupId: "!room:server", cfg }))).toBe(
      false,
    );
  });

  it("strips matrix: prefix from groupId", () => {
    const cfg: CoreConfig = {
      channels: {
        matrix: {
          groups: {
            "!room:server": { autoReply: true },
          },
        },
      },
    };
    expect(
      resolveMatrixGroupRequireMention(makeParams({ groupId: "matrix:!room:server", cfg })),
    ).toBe(false);
  });

  it("strips channel: prefix from groupId", () => {
    const cfg: CoreConfig = {
      channels: {
        matrix: {
          groups: {
            "!room:server": { autoReply: true },
          },
        },
      },
    };
    expect(
      resolveMatrixGroupRequireMention(makeParams({ groupId: "channel:!room:server", cfg })),
    ).toBe(false);
  });

  it("strips room: prefix from groupId", () => {
    const cfg: CoreConfig = {
      channels: {
        matrix: {
          groups: {
            "!room:server": { autoReply: true },
          },
        },
      },
    };
    expect(
      resolveMatrixGroupRequireMention(makeParams({ groupId: "room:!room:server", cfg })),
    ).toBe(false);
  });

  it("uses groupChannel as alias for lookup", () => {
    const cfg: CoreConfig = {
      channels: {
        matrix: {
          groups: {
            "#alias:server": { autoReply: true },
          },
        },
      },
    };
    expect(
      resolveMatrixGroupRequireMention(
        makeParams({ groupId: "!unknown:server", groupChannel: "#alias:server", cfg }),
      ),
    ).toBe(false);
  });

  it("falls back to rooms config when groups is absent", () => {
    const cfg: CoreConfig = {
      channels: {
        matrix: {
          rooms: {
            "!room:server": { requireMention: false },
          },
        },
      },
    };
    expect(resolveMatrixGroupRequireMention(makeParams({ groupId: "!room:server", cfg }))).toBe(
      false,
    );
  });
});

describe("resolveMatrixGroupToolPolicy", () => {
  it("returns undefined when no room config exists", () => {
    expect(resolveMatrixGroupToolPolicy(makeParams({}))).toBeUndefined();
  });

  it("returns the tools config from the matched room", () => {
    const cfg: CoreConfig = {
      channels: {
        matrix: {
          groups: {
            "!room:server": { tools: { allow: ["search"], deny: ["admin"] } },
          },
        },
      },
    };
    expect(resolveMatrixGroupToolPolicy(makeParams({ groupId: "!room:server", cfg }))).toEqual({
      allow: ["search"],
      deny: ["admin"],
    });
  });

  it("returns undefined when room config has no tools", () => {
    const cfg: CoreConfig = {
      channels: {
        matrix: {
          groups: {
            "!room:server": { enabled: true },
          },
        },
      },
    };
    expect(
      resolveMatrixGroupToolPolicy(makeParams({ groupId: "!room:server", cfg })),
    ).toBeUndefined();
  });

  it("strips prefixes from groupId before lookup", () => {
    const cfg: CoreConfig = {
      channels: {
        matrix: {
          groups: {
            "!room:server": { tools: { allow: ["test"] } },
          },
        },
      },
    };
    expect(
      resolveMatrixGroupToolPolicy(
        makeParams({ groupId: "matrix:channel:room:!room:server", cfg }),
      ),
    ).toEqual({ allow: ["test"] });
  });
});
