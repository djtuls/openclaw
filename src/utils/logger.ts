/**
 * src/utils/logger.ts
 *
 * Structured logger utility for critical code paths.
 *
 * Wraps the existing `createSubsystemLogger` infrastructure so that all output
 * flows through the project-wide file transport, console-level filtering, and
 * rolling-log pruning already in place.
 *
 * API:
 *   createLogger(name)           → StructuredLogger bound to a subsystem name
 *   logger                       → default instance ("app")
 *   logger.info/warn/error/debug(msg, context?)
 *   logger.child({ correlationId?, ...bindings }) → child StructuredLogger
 *
 * Level filtering:
 *   Reads the LOG_LEVEL environment variable (trace|debug|info|warn|error|fatal|silent).
 *   Falls back to the project-wide `openclaw.json` / .env LOG_LEVEL when set.
 *   If LOG_LEVEL is not set, the underlying system default ("info") applies.
 *
 * Output format (file transport):
 *   JSON lines written by tslog: { time, level, subsystem, message, correlationId?, ...context }
 */

import type { LogLevel } from "../logging/levels.js";
import type { SubsystemLogger } from "../logging/subsystem.js";
import { normalizeLogLevel } from "../logging/levels.js";
import { createSubsystemLogger } from "../logging/subsystem.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface StructuredLogger {
  info(msg: string, context?: Record<string, unknown>): void;
  warn(msg: string, context?: Record<string, unknown>): void;
  error(msg: string, context?: Record<string, unknown>): void;
  debug(msg: string, context?: Record<string, unknown>): void;
  child(bindings: { correlationId?: string; [key: string]: unknown }): StructuredLogger;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Resolve the effective log level from the LOG_LEVEL env var.
 * Returns null when the env var is absent so the underlying system default wins.
 */
function resolveEnvLogLevel(): LogLevel | null {
  const raw = process.env.LOG_LEVEL;
  if (!raw) {
    return null;
  }
  return normalizeLogLevel(raw, null as unknown as LogLevel);
}

/**
 * Determine whether a given level should be emitted given the effective minimum
 * level derived from the LOG_LEVEL env var.
 *
 * Level ordering (ascending severity): trace < debug < info < warn < error < fatal
 */
const LEVEL_ORDER: LogLevel[] = ["trace", "debug", "info", "warn", "error", "fatal"];

function isLevelEnabled(level: LogLevel): boolean {
  const envLevel = resolveEnvLogLevel();
  if (!envLevel || envLevel === "silent") {
    // No override — defer to the underlying subsystem logger's own filtering.
    return envLevel !== "silent";
  }
  const minIdx = LEVEL_ORDER.indexOf(envLevel);
  const curIdx = LEVEL_ORDER.indexOf(level);
  if (minIdx === -1 || curIdx === -1) {
    return true;
  }
  return curIdx >= minIdx;
}

// ---------------------------------------------------------------------------
// StructuredLogger factory
// ---------------------------------------------------------------------------

/**
 * Build a StructuredLogger from a SubsystemLogger.
 * Bindings (e.g. correlationId) are merged into every log record's context.
 */
function wrapSubsystem(
  subsystem: SubsystemLogger,
  inheritedBindings: Record<string, unknown> = {},
): StructuredLogger {
  function emit(
    level: Exclude<LogLevel, "silent">,
    msg: string,
    context?: Record<string, unknown>,
  ): void {
    if (!isLevelEnabled(level)) {
      return;
    }
    const meta: Record<string, unknown> = {
      ...inheritedBindings,
      ...context,
    };
    subsystem[level](msg, Object.keys(meta).length > 0 ? meta : undefined);
  }

  return {
    info: (msg, ctx) => emit("info", msg, ctx),
    warn: (msg, ctx) => emit("warn", msg, ctx),
    error: (msg, ctx) => emit("error", msg, ctx),
    debug: (msg, ctx) => emit("debug", msg, ctx),
    child(bindings) {
      const merged: Record<string, unknown> = { ...inheritedBindings, ...bindings };
      // Build a child subsystem name when a correlationId is provided so that
      // the file transport can group related records.
      const childSubsystem = bindings.correlationId
        ? subsystem.child(String(bindings.correlationId))
        : subsystem.child("child");
      return wrapSubsystem(childSubsystem, merged);
    },
  };
}

/**
 * Create a named structured logger.
 *
 * @param name  Subsystem name used as the log prefix (e.g. "memory/search").
 */
export function createLogger(name: string): StructuredLogger {
  const subsystem = createSubsystemLogger(name);
  return wrapSubsystem(subsystem);
}

// ---------------------------------------------------------------------------
// Default logger instance
// ---------------------------------------------------------------------------

/** Default application logger. Use `createLogger(name)` for module-specific loggers. */
export const logger: StructuredLogger = createLogger("app");
