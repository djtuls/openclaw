#!/usr/bin/env node
/**
 * Fix circular dependency: pi-model-discovery imports __exportAll from gateway-cli,
 * but gateway-cli imports pi-model-discovery. Rewrite to import from rolldown-runtime instead.
 */
import fs from "node:fs";
import path from "node:path";

const distDir = path.join(process.cwd(), "dist");

const runtimeFiles = fs.readdirSync(distDir).filter((f) => f.startsWith("rolldown-runtime-"));
if (runtimeFiles.length === 0) {
  console.warn("fix-pi-model-discovery-import: no rolldown-runtime-*.js found, skipping");
  process.exit(0);
}
const runtimeName = runtimeFiles[0];

function fixFile(filePath: string, runtimeImport: string) {
  let content = fs.readFileSync(filePath, "utf8");
  const pattern = /import\s*\{\s*t\s+as\s+__exportAll\s*\}\s*from\s*"\.\/gateway-cli-[^"]+"/;
  if (!content.match(pattern)) {
    return false;
  }
  content = content.replace(pattern, `import { t as __exportAll } from "${runtimeImport}"`);
  fs.writeFileSync(filePath, content);
  return true;
}

let fixed = 0;
// Fix ALL dist/*.js files that import __exportAll from gateway-cli (not just pi-model-discovery)
const distFiles = fs.readdirSync(distDir).filter((f) => f.endsWith(".js"));
for (const f of distFiles) {
  const p = path.join(distDir, f);
  if (fixFile(p, `./${runtimeName}`)) {
    fixed++;
    console.log("Fixed:", f);
  }
}

const pluginSdkDir = path.join(distDir, "plugin-sdk");
if (fs.existsSync(pluginSdkDir)) {
  for (const f of fs.readdirSync(pluginSdkDir)) {
    if (f.endsWith(".js")) {
      const p = path.join(pluginSdkDir, f);
      if (fixFile(p, `../${runtimeName}`)) {
        fixed++;
        console.log("Fixed:", `plugin-sdk/${f}`);
      }
    }
  }
}

if (fixed > 0) {
  console.log(`fix-pi-model-discovery-import: fixed ${fixed} file(s)`);
}
