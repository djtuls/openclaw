import { defineConfig } from "vitest/config";
import baseConfig from "./vitest.config.ts";

const baseTest = (baseConfig as { test?: { exclude?: string[] } }).test ?? {};
const exclude = (baseTest.exclude ?? []).filter((pattern) => pattern !== "**/*.e2e.test.ts");

export default defineConfig({
  ...baseConfig,
  test: {
    ...baseTest,
    include: ["src/gateway/**/*.test.ts", "src/gateway/**/*.e2e.test.ts"],
    exclude,
  },
});
