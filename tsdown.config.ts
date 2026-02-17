import { defineConfig } from "tsdown";

const env = { NODE_ENV: "production" };
const base = { env, fixedExtension: false, inlineOnly: false, platform: "node" as const };

export default defineConfig([
  { ...base, entry: "src/index.ts" },
  { ...base, entry: "src/entry.ts" },
  { ...base, entry: "src/infra/warning-filter.ts" },
  { ...base, entry: "src/plugin-sdk/index.ts", outDir: "dist/plugin-sdk" },
  { ...base, entry: "src/extensionAPI.ts" },
  { ...base, entry: ["src/hooks/bundled/*/handler.ts", "src/hooks/llm-slug-generator.ts"] },
]);
