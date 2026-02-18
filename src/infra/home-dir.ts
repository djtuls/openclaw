import os from "node:os";
import path from "node:path";

function normalize(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function resolveTmpHomeFallback(): string {
  const uid = typeof process.getuid === "function" ? process.getuid() : undefined;
  const suffix = uid != null ? `openclaw-home-${uid}` : "openclaw-home";
  return path.join(os.tmpdir(), suffix);
}

function isUnsafeCwdAsHome(candidate: string): boolean {
  const resolved = path.resolve(candidate);
  const root = path.parse(resolved).root;
  if (resolved === root) {
    return true;
  }
  // macOS: `/Users` is not a usable per-user home and is typically non-writable.
  if (process.platform === "darwin" && resolved === "/Users") {
    return true;
  }
  return false;
}

export function resolveEffectiveHomeDir(
  env: NodeJS.ProcessEnv = process.env,
  homedir: () => string = os.homedir,
): string | undefined {
  const raw = resolveRawHomeDir(env, homedir);
  return raw ? path.resolve(raw) : undefined;
}

function resolveRawHomeDir(env: NodeJS.ProcessEnv, homedir: () => string): string | undefined {
  const explicitHome = normalize(env.OPENCLAW_HOME);
  if (explicitHome) {
    if (explicitHome === "~" || explicitHome.startsWith("~/") || explicitHome.startsWith("~\\")) {
      const fallbackHome =
        normalize(env.HOME) ?? normalize(env.USERPROFILE) ?? normalizeSafe(homedir);
      if (fallbackHome) {
        return explicitHome.replace(/^~(?=$|[\\/])/, fallbackHome);
      }
      return undefined;
    }
    return explicitHome;
  }

  const envHome = normalize(env.HOME);
  if (envHome) {
    return envHome;
  }

  const userProfile = normalize(env.USERPROFILE);
  if (userProfile) {
    return userProfile;
  }

  return normalizeSafe(homedir);
}

function normalizeSafe(homedir: () => string): string | undefined {
  try {
    return normalize(homedir());
  } catch {
    return undefined;
  }
}

export function resolveRequiredHomeDir(
  env: NodeJS.ProcessEnv = process.env,
  homedir: () => string = os.homedir,
): string {
  const effective = resolveEffectiveHomeDir(env, homedir);
  if (effective) {
    // #region agent log (home-dir) H2
    fetch("http://127.0.0.1:7246/ingest/4b82aa16-f9e6-4cd8-a11e-0a253db7e3e9", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "src/infra/home-dir.ts:resolveRequiredHomeDir",
        message: "resolved effective home dir",
        hypothesisId: "H2",
        runId: "pre-fix",
        data: {
          effective,
          hasOPENCLAW_HOME: Boolean(env.OPENCLAW_HOME?.trim()),
          hasHOME: Boolean(env.HOME?.trim()),
          hasUSERPROFILE: Boolean(env.USERPROFILE?.trim()),
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion agent log (home-dir) H2
    return effective;
  }

  // When homedir detection fails (e.g. sandboxed processes, stripped env),
  // falling back to cwd can point at system roots like `/` or `/Users` which
  // are not writable and break session storage. Use a stable tmp fallback then.
  const cwd = path.resolve(process.cwd());
  if (isUnsafeCwdAsHome(cwd)) {
    const tmp = resolveTmpHomeFallback();
    // #region agent log (home-dir) H2
    fetch("http://127.0.0.1:7246/ingest/4b82aa16-f9e6-4cd8-a11e-0a253db7e3e9", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "src/infra/home-dir.ts:resolveRequiredHomeDir",
        message: "effective home missing; cwd unsafe; using tmp fallback",
        hypothesisId: "H2",
        runId: "pre-fix",
        data: {
          cwd,
          tmp,
          platform: process.platform,
          hasOPENCLAW_HOME: Boolean(env.OPENCLAW_HOME?.trim()),
          hasHOME: Boolean(env.HOME?.trim()),
          hasUSERPROFILE: Boolean(env.USERPROFILE?.trim()),
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion agent log (home-dir) H2
    return tmp;
  }
  // #region agent log (home-dir) H2
  fetch("http://127.0.0.1:7246/ingest/4b82aa16-f9e6-4cd8-a11e-0a253db7e3e9", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      location: "src/infra/home-dir.ts:resolveRequiredHomeDir",
      message: "effective home missing; using cwd as home",
      hypothesisId: "H2",
      runId: "pre-fix",
      data: { cwd, platform: process.platform },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion agent log (home-dir) H2
  return cwd;
}

export function expandHomePrefix(
  input: string,
  opts?: {
    home?: string;
    env?: NodeJS.ProcessEnv;
    homedir?: () => string;
  },
): string {
  if (!input.startsWith("~")) {
    return input;
  }
  const home =
    normalize(opts?.home) ??
    resolveEffectiveHomeDir(opts?.env ?? process.env, opts?.homedir ?? os.homedir);
  if (!home) {
    return input;
  }
  return input.replace(/^~(?=$|[\\/])/, home);
}
