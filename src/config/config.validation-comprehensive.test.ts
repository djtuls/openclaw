import { describe, it, expect, beforeEach } from "vitest";
import type { OpenClawConfig } from "./types.js";
import {
  applyAgentDefaults,
  applyModelDefaults,
  applySessionDefaults,
  applyMessageDefaults,
  applyLoggingDefaults,
  applyTalkApiKey,
  applyCompactionDefaults,
  applyContextPruningDefaults,
} from "./defaults.js";
import { collectConfigEnvVars } from "./env-vars.js";
import { validateConfigObject, validateConfigObjectWithPlugins } from "./validation.js";

/**
 * Comprehensive configuration validation tests for Agent 2c mission.
 * Tests all config-driven settings, fallback chains, and edge cases.
 */

describe("Environment Variable Fallbacks", () => {
  it("should collect env vars from config.env.vars", () => {
    const config: OpenClawConfig = {
      env: {
        vars: {
          ANTHROPIC_API_KEY: "test-key-123",
          OPENAI_API_KEY: "openai-test",
        },
      },
    };

    const result = collectConfigEnvVars(config);
    expect(result).toEqual({
      ANTHROPIC_API_KEY: "test-key-123",
      OPENAI_API_KEY: "openai-test",
    });
  });

  it("should collect top-level env vars excluding reserved keys", () => {
    const config: OpenClawConfig = {
      env: {
        CUSTOM_VAR: "custom-value",
        shellEnv: "should-be-ignored",
        vars: { ANOTHER: "value" },
        THIRD_VAR: "included",
      },
    };

    const result = collectConfigEnvVars(config);
    expect(result.CUSTOM_VAR).toBe("custom-value");
    expect(result.THIRD_VAR).toBe("included");
    expect(result.shellEnv).toBeUndefined();
    expect(result.vars).toBeUndefined();
  });

  it("should return empty object when config.env is undefined", () => {
    const config: OpenClawConfig = {};
    const result = collectConfigEnvVars(config);
    expect(result).toEqual({});
  });

  it("should skip empty string values", () => {
    const config: OpenClawConfig = {
      env: {
        vars: {
          KEY1: "valid",
          KEY2: "",
          KEY3: "  ",
        },
        TOP_KEY: "",
      },
    };

    const result = collectConfigEnvVars(config);
    expect(result.KEY1).toBe("valid");
    expect(result.KEY2).toBeUndefined();
    expect(result.TOP_KEY).toBeUndefined();
  });
});

describe("Agent Defaults Fallback Chain", () => {
  it("should apply default maxConcurrent when not specified", () => {
    const config: OpenClawConfig = {
      agents: {
        defaults: {},
      },
    };

    const result = applyAgentDefaults(config);
    expect(result.agents?.defaults?.maxConcurrent).toBe(4);
  });

  it("should apply default subagents.maxConcurrent when not specified", () => {
    const config: OpenClawConfig = {
      agents: {
        defaults: {},
      },
    };

    const result = applyAgentDefaults(config);
    expect(result.agents?.defaults?.subagents?.maxConcurrent).toBe(8);
  });

  it("should preserve existing maxConcurrent values", () => {
    const config: OpenClawConfig = {
      agents: {
        defaults: {
          maxConcurrent: 10,
          subagents: {
            maxConcurrent: 3,
          },
        },
      },
    };

    const result = applyAgentDefaults(config);
    expect(result.agents?.defaults?.maxConcurrent).toBe(10);
    expect(result.agents?.defaults?.subagents?.maxConcurrent).toBe(3);
  });

  it("should create defaults when agents config is missing", () => {
    const config: OpenClawConfig = {};
    const result = applyAgentDefaults(config);
    expect(result.agents?.defaults?.maxConcurrent).toBe(4);
    expect(result.agents?.defaults?.subagents?.maxConcurrent).toBe(8);
  });
});

describe("Model Defaults Fallback Chain", () => {
  it("should apply default cost structure when not specified", () => {
    const config: OpenClawConfig = {
      models: {
        providers: {
          test: {
            models: [
              {
                id: "test-model",
                name: "Test Model",
              },
            ],
          },
        },
      },
    };

    const result = applyModelDefaults(config);
    const model = result.models?.providers?.test?.models?.[0];
    expect(model?.cost).toEqual({
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
    });
  });

  it("should apply default input types when not specified", () => {
    const config: OpenClawConfig = {
      models: {
        providers: {
          test: {
            models: [
              {
                id: "test-model",
                name: "Test Model",
              },
            ],
          },
        },
      },
    };

    const result = applyModelDefaults(config);
    const model = result.models?.providers?.test?.models?.[0];
    expect(model?.input).toEqual(["text"]);
  });

  it("should apply default contextWindow and maxTokens", () => {
    const config: OpenClawConfig = {
      models: {
        providers: {
          test: {
            models: [
              {
                id: "test-model",
                name: "Test Model",
              },
            ],
          },
        },
      },
    };

    const result = applyModelDefaults(config);
    const model = result.models?.providers?.test?.models?.[0];
    expect(model?.contextWindow).toBe(200000);
    expect(model?.maxTokens).toBe(8192);
  });

  it("should preserve existing model properties", () => {
    const config: OpenClawConfig = {
      models: {
        providers: {
          test: {
            models: [
              {
                id: "test-model",
                name: "Test Model",
                cost: { input: 10, output: 20, cacheRead: 5, cacheWrite: 15 },
                contextWindow: 100000,
                maxTokens: 4096,
                input: ["text", "image"],
              },
            ],
          },
        },
      },
    };

    const result = applyModelDefaults(config);
    const model = result.models?.providers?.test?.models?.[0];
    expect(model?.cost).toEqual({ input: 10, output: 20, cacheRead: 5, cacheWrite: 15 });
    expect(model?.contextWindow).toBe(100000);
    expect(model?.maxTokens).toBe(4096);
    expect(model?.input).toEqual(["text", "image"]);
  });
});

describe("Logging Defaults", () => {
  it("should apply default redactSensitive when not specified", () => {
    const config: OpenClawConfig = {
      logging: {},
    };

    const result = applyLoggingDefaults(config);
    expect(result.logging?.redactSensitive).toBe("tools");
  });

  it("should preserve existing redactSensitive value", () => {
    const config: OpenClawConfig = {
      logging: {
        redactSensitive: "all",
      },
    };

    const result = applyLoggingDefaults(config);
    expect(result.logging?.redactSensitive).toBe("all");
  });

  it("should handle missing logging config gracefully", () => {
    const config: OpenClawConfig = {};
    const result = applyLoggingDefaults(config);
    expect(result).toEqual({});
  });
});

describe("Session Defaults Validation", () => {
  it("should normalize mainKey to 'main'", () => {
    const config: OpenClawConfig = {
      session: {
        mainKey: "custom-main-key",
      },
    };

    const result = applySessionDefaults(config, { warn: () => {} });
    expect(result.session?.mainKey).toBe("main");
  });

  it("should handle missing session config gracefully", () => {
    const config: OpenClawConfig = {};
    const result = applySessionDefaults(config);
    expect(result).toEqual({});
  });
});

describe("Message Defaults Validation", () => {
  it("should apply default ackReactionScope when not specified", () => {
    const config: OpenClawConfig = {
      messages: {},
    };

    const result = applyMessageDefaults(config);
    expect(result.messages?.ackReactionScope).toBe("group-mentions");
  });

  it("should preserve existing ackReactionScope value", () => {
    const config: OpenClawConfig = {
      messages: {
        ackReactionScope: "all",
      },
    };

    const result = applyMessageDefaults(config);
    expect(result.messages?.ackReactionScope).toBe("all");
  });
});

describe("Talk API Key Fallback", () => {
  it("should not override existing apiKey", () => {
    const config: OpenClawConfig = {
      talk: {
        apiKey: "existing-key",
      },
    };

    const result = applyTalkApiKey(config);
    expect(result.talk?.apiKey).toBe("existing-key");
  });

  it("should handle missing talk config gracefully", () => {
    const config: OpenClawConfig = {};
    const result = applyTalkApiKey(config);
    expect(result.talk?.apiKey).toBeUndefined();
  });
});

describe("Compaction Defaults Validation", () => {
  it("should apply default compaction mode when not specified", () => {
    const config: OpenClawConfig = {
      agents: {
        defaults: {},
      },
    };

    const result = applyCompactionDefaults(config);
    expect(result.agents?.defaults?.compaction?.mode).toBe("safeguard");
  });

  it("should preserve existing compaction mode", () => {
    const config: OpenClawConfig = {
      agents: {
        defaults: {
          compaction: {
            mode: "aggressive",
          },
        },
      },
    };

    const result = applyCompactionDefaults(config);
    expect(result.agents?.defaults?.compaction?.mode).toBe("aggressive");
  });

  it("should handle missing agents config gracefully", () => {
    const config: OpenClawConfig = {};
    const result = applyCompactionDefaults(config);
    expect(result).toEqual({});
  });
});

describe("Context Pruning Defaults Validation", () => {
  it("should apply cache-ttl mode by default", () => {
    const config: OpenClawConfig = {
      agents: {
        defaults: {},
      },
      auth: {
        profiles: {
          default: {
            provider: "anthropic",
            mode: "api_key",
          },
        },
      },
    };

    const result = applyContextPruningDefaults(config);
    expect(result.agents?.defaults?.contextPruning?.mode).toBe("cache-ttl");
    expect(result.agents?.defaults?.contextPruning?.ttl).toBe("1h");
  });

  it("should apply different heartbeat intervals based on auth mode", () => {
    const apiKeyConfig: OpenClawConfig = {
      agents: { defaults: {} },
      auth: {
        profiles: {
          default: { provider: "anthropic", mode: "api_key" },
        },
      },
    };

    const oauthConfig: OpenClawConfig = {
      agents: { defaults: {} },
      auth: {
        profiles: {
          default: { provider: "anthropic", mode: "oauth" },
        },
      },
    };

    const apiResult = applyContextPruningDefaults(apiKeyConfig);
    const oauthResult = applyContextPruningDefaults(oauthConfig);

    expect(apiResult.agents?.defaults?.heartbeat?.every).toBe("30m");
    expect(oauthResult.agents?.defaults?.heartbeat?.every).toBe("1h");
  });

  it("should handle missing auth config gracefully", () => {
    const config: OpenClawConfig = {
      agents: {
        defaults: {},
      },
    };

    const result = applyContextPruningDefaults(config);
    expect(result).toEqual({ agents: { defaults: {} } });
  });
});

describe("Validation Edge Cases", () => {
  it("should validate minimal config successfully", () => {
    const config: OpenClawConfig = {};
    const result = validateConfigObject(config);
    expect(result.ok).toBe(true);
  });

  it("should handle config with all defaults applied", () => {
    const config: OpenClawConfig = {};
    let result = applySessionDefaults(config);
    result = applyAgentDefaults(result);
    result = applyModelDefaults(result);

    const validation = validateConfigObject(result);
    expect(validation.ok).toBe(true);
  });

  it("should validate config with plugins successfully", () => {
    const config: OpenClawConfig = {
      plugins: {
        allow: [],
        deny: [],
      },
    };

    const result = validateConfigObjectWithPlugins(config);
    expect(result.ok).toBe(true);
  });
});
