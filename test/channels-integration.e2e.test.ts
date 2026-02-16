import fs from "node:fs/promises";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { listChannelPlugins } from "../src/agents/openclaw-tools.ts";
import { readConfigFileSnapshot } from "../src/config/config-file-snapshot.ts";
import { resolveConfigPath } from "../src/config/resolve-config-file.ts";
import { withTempHome } from "./helpers/temp-home.ts";

describe("Channel Integration E2E", () => {
  describe("Channel Configuration Validation", () => {
    it("should validate all channel plugins are loadable", async () => {
      await withTempHome(async (home) => {
        const plugins = listChannelPlugins();

        expect(plugins.length).toBeGreaterThan(0);

        // Verify all 8 expected channels are present
        const expectedChannels = [
          "telegram",
          "whatsapp",
          "discord",
          "irc",
          "googlechat",
          "slack",
          "signal",
          "imessage",
        ];

        const loadedChannelIds = plugins.map((p) => p.id);
        for (const channelId of expectedChannels) {
          expect(loadedChannelIds).toContain(channelId);
        }
      });
    });

    it("should create valid config structure for each channel", async () => {
      await withTempHome(async (home) => {
        const plugins = listChannelPlugins();
        const configPath = resolveConfigPath();
        const configDir = path.dirname(configPath);

        await fs.mkdir(configDir, { recursive: true });

        // Create minimal config with all channels
        const config: Record<string, unknown> = {
          channels: {},
        };

        for (const plugin of plugins) {
          config.channels![plugin.id] = {
            accounts: {
              default: {
                enabled: false,
                tokenSource: "none",
              },
            },
          };
        }

        await fs.writeFile(configPath, JSON.stringify(config, null, 2), "utf8");

        // Verify config is readable
        const snapshot = await readConfigFileSnapshot();
        expect(snapshot.path).toBe(configPath);
        expect(snapshot.config).toBeDefined();
        expect(snapshot.config.channels).toBeDefined();

        // Verify all channels present in config
        for (const plugin of plugins) {
          expect(snapshot.config.channels).toHaveProperty(plugin.id);
        }
      });
    });
  });

  describe("Channel Account Enumeration", () => {
    it("should enumerate accounts for each channel plugin", async () => {
      await withTempHome(async (home) => {
        const plugins = listChannelPlugins();
        const configPath = resolveConfigPath();
        const configDir = path.dirname(configPath);

        await fs.mkdir(configDir, { recursive: true });

        // Create config with multiple accounts per channel
        const config: Record<string, unknown> = {
          channels: {},
        };

        for (const plugin of plugins) {
          config.channels![plugin.id] = {
            accounts: {
              account1: { enabled: true, tokenSource: "env:TOKEN1" },
              account2: { enabled: false, tokenSource: "env:TOKEN2" },
            },
          };
        }

        await fs.writeFile(configPath, JSON.stringify(config, null, 2), "utf8");

        const snapshot = await readConfigFileSnapshot();

        // Verify account enumeration works for each plugin
        for (const plugin of plugins) {
          const accountIds = plugin.config.listAccountIds(snapshot.config);
          expect(accountIds.length).toBeGreaterThanOrEqual(1);
          expect(accountIds).toContain("account1");
          expect(accountIds).toContain("account2");
        }
      });
    });

    it("should handle single account (legacy) config format", async () => {
      await withTempHome(async (home) => {
        const plugins = listChannelPlugins();
        const configPath = resolveConfigPath();
        const configDir = path.dirname(configPath);

        await fs.mkdir(configDir, { recursive: true });

        // Create legacy single-account config
        const config: Record<string, unknown> = {
          channels: {},
        };

        for (const plugin of plugins) {
          config.channels![plugin.id] = {
            enabled: true,
            tokenSource: "env:TOKEN",
          };
        }

        await fs.writeFile(configPath, JSON.stringify(config, null, 2), "utf8");

        const snapshot = await readConfigFileSnapshot();

        // Verify legacy format produces "default" account
        for (const plugin of plugins) {
          const accountIds = plugin.config.listAccountIds(snapshot.config);
          expect(accountIds.length).toBeGreaterThanOrEqual(1);
          expect(accountIds).toContain("default");
        }
      });
    });
  });

  describe("Credential Field Validation", () => {
    const CREDENTIAL_FIELDS = [
      "tokenSource",
      "botTokenSource",
      "appTokenSource",
      "credentialSource",
    ] as const;

    it("should validate credential fields for each channel", async () => {
      await withTempHome(async (home) => {
        const plugins = listChannelPlugins();
        const configPath = resolveConfigPath();
        const configDir = path.dirname(configPath);

        await fs.mkdir(configDir, { recursive: true });

        // Create config with various credential states
        const config: Record<string, unknown> = {
          channels: {},
        };

        for (const plugin of plugins) {
          config.channels![plugin.id] = {
            accounts: {
              valid: {
                enabled: true,
                tokenSource: "env:VALID_TOKEN",
              },
              missing: {
                enabled: true,
                // tokenSource intentionally missing
              },
              invalid: {
                enabled: true,
                tokenSource: 123, // wrong type
              },
              unconfigured: {
                enabled: true,
                tokenSource: "none",
              },
            },
          };
        }

        await fs.writeFile(configPath, JSON.stringify(config, null, 2), "utf8");

        const snapshot = await readConfigFileSnapshot();

        // Verify we can detect different credential states
        for (const plugin of plugins) {
          const accountIds = plugin.config.listAccountIds(snapshot.config);

          expect(accountIds).toContain("valid");
          expect(accountIds).toContain("missing");
          expect(accountIds).toContain("invalid");
          expect(accountIds).toContain("unconfigured");

          const channelConfig = snapshot.config.channels[plugin.id];

          // Valid credential
          expect(channelConfig.accounts.valid.tokenSource).toBe("env:VALID_TOKEN");

          // Missing credential
          expect(channelConfig.accounts.missing.tokenSource).toBeUndefined();

          // Invalid credential type
          expect(typeof channelConfig.accounts.invalid.tokenSource).toBe("number");

          // Unconfigured credential
          expect(channelConfig.accounts.unconfigured.tokenSource).toBe("none");
        }
      });
    });
  });

  describe("Config File Persistence", () => {
    it("should persist config changes across reads", async () => {
      await withTempHome(async (home) => {
        const configPath = resolveConfigPath();
        const configDir = path.dirname(configPath);

        await fs.mkdir(configDir, { recursive: true });

        // Write initial config
        const initialConfig = {
          channels: {
            telegram: {
              accounts: {
                default: {
                  enabled: true,
                  tokenSource: "env:TELEGRAM_TOKEN",
                },
              },
            },
          },
        };

        await fs.writeFile(configPath, JSON.stringify(initialConfig, null, 2), "utf8");

        // Read and verify
        const snapshot1 = await readConfigFileSnapshot();
        expect(snapshot1.config.channels.telegram.accounts.default.tokenSource).toBe(
          "env:TELEGRAM_TOKEN",
        );

        // Modify config
        const modifiedConfig = {
          ...initialConfig,
          channels: {
            ...initialConfig.channels,
            telegram: {
              accounts: {
                default: {
                  enabled: true,
                  tokenSource: "env:NEW_TOKEN",
                },
              },
            },
          },
        };

        await fs.writeFile(configPath, JSON.stringify(modifiedConfig, null, 2), "utf8");

        // Read again and verify change persisted
        const snapshot2 = await readConfigFileSnapshot();
        expect(snapshot2.config.channels.telegram.accounts.default.tokenSource).toBe(
          "env:NEW_TOKEN",
        );
      });
    });
  });
});
