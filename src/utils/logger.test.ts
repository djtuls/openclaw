/**
 * src/utils/logger.test.ts
 *
 * Tests for the structured logger utility (src/utils/logger.ts).
 * Verifies: JSON-keyed output via transport, level filtering via LOG_LEVEL,
 * child-logger correlationId support, and no-throw safety for all levels.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { LogTransportRecord } from "../logging/logger.js";
import { setLoggerOverride, resetLogger, registerLogTransport } from "../logging/logger.js";
import { createLogger, logger as defaultLogger } from "./logger.js";

// ---------------------------------------------------------------------------
// Test setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  // Route file transport to /dev/null so tests never write real log files.
  setLoggerOverride({ level: "trace", file: "/dev/null" });
  delete process.env.LOG_LEVEL;
});

afterEach(() => {
  resetLogger();
  delete process.env.LOG_LEVEL;
});

// ---------------------------------------------------------------------------
// Suite 1: Basic API existence
// ---------------------------------------------------------------------------

describe("createLogger", () => {
  it("returns an object with info/warn/error/debug/child methods", () => {
    const log = createLogger("test/basic");
    expect(typeof log.info).toBe("function");
    expect(typeof log.warn).toBe("function");
    expect(typeof log.error).toBe("function");
    expect(typeof log.debug).toBe("function");
    expect(typeof log.child).toBe("function");
  });

  it("default logger export is a StructuredLogger", () => {
    expect(typeof defaultLogger.info).toBe("function");
    expect(typeof defaultLogger.child).toBe("function");
  });
});

// ---------------------------------------------------------------------------
// Suite 2: JSON format — records arrive at the file transport
// ---------------------------------------------------------------------------

describe("JSON format via transport", () => {
  it("info() record reaches the log transport and contains the message", () => {
    const records: LogTransportRecord[] = [];
    const stop = registerLogTransport((rec) => records.push(rec));

    process.env.LOG_LEVEL = "info";
    const log = createLogger("test/transport");
    log.info("hello transport", { key: "value" });

    stop();

    // At least one record should contain our message text.
    const found = records.some(
      (r) => typeof r === "object" && r !== null && JSON.stringify(r).includes("hello transport"),
    );
    expect(found).toBe(true);
  });

  it("error() record reaches the log transport", () => {
    const records: LogTransportRecord[] = [];
    const stop = registerLogTransport((rec) => records.push(rec));

    process.env.LOG_LEVEL = "error";
    const log = createLogger("test/transport-error");
    log.error("something broke", { code: 500 });

    stop();

    const found = records.some((r) => JSON.stringify(r).includes("something broke"));
    expect(found).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Suite 3: child logger with correlationId
// ---------------------------------------------------------------------------

describe("child logger", () => {
  it("child() returns a StructuredLogger with the same methods", () => {
    const log = createLogger("test/child");
    const child = log.child({ correlationId: "req-123" });
    expect(typeof child.info).toBe("function");
    expect(typeof child.warn).toBe("function");
    expect(typeof child.error).toBe("function");
    expect(typeof child.debug).toBe("function");
    expect(typeof child.child).toBe("function");
  });

  it("nested child() does not throw", () => {
    const log = createLogger("test/nested");
    const child = log.child({ correlationId: "a" });
    const grandchild = child.child({ correlationId: "b" });
    expect(() => grandchild.info("nested child works")).not.toThrow();
  });

  it("child logger records reach the transport", () => {
    const records: LogTransportRecord[] = [];
    const stop = registerLogTransport((rec) => records.push(rec));

    process.env.LOG_LEVEL = "info";
    const log = createLogger("test/child-transport");
    const child = log.child({ correlationId: "corr-xyz" });
    child.info("child message");

    stop();

    const found = records.some((r) => JSON.stringify(r).includes("child message"));
    expect(found).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Suite 4: Level filtering via LOG_LEVEL env var
// ---------------------------------------------------------------------------

describe("LOG_LEVEL filtering", () => {
  it("does not throw when LOG_LEVEL=silent", () => {
    process.env.LOG_LEVEL = "silent";
    const log = createLogger("test/silent");
    expect(() => log.info("should be suppressed")).not.toThrow();
    expect(() => log.error("also suppressed")).not.toThrow();
  });

  it("does not throw when LOG_LEVEL=error and debug/info/warn are called", () => {
    process.env.LOG_LEVEL = "error";
    const log = createLogger("test/level-filter");
    expect(() => log.debug("suppressed debug")).not.toThrow();
    expect(() => log.info("suppressed info")).not.toThrow();
    expect(() => log.warn("suppressed warn")).not.toThrow();
  });

  it("debug records are NOT emitted when LOG_LEVEL=error", () => {
    const records: LogTransportRecord[] = [];
    const stop = registerLogTransport((rec) => records.push(rec));

    process.env.LOG_LEVEL = "error";
    const log = createLogger("test/no-debug");
    log.debug("should not appear");

    stop();

    const found = records.some((r) => JSON.stringify(r).includes("should not appear"));
    expect(found).toBe(false);
  });

  it("debug records ARE emitted when LOG_LEVEL=debug", () => {
    const records: LogTransportRecord[] = [];
    const stop = registerLogTransport((rec) => records.push(rec));

    process.env.LOG_LEVEL = "debug";
    const log = createLogger("test/debug-enabled");
    log.debug("debug visible");

    stop();

    const found = records.some((r) => JSON.stringify(r).includes("debug visible"));
    expect(found).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Suite 5: No-throw safety for all levels
// ---------------------------------------------------------------------------

describe("no-throw safety", () => {
  it("all log methods accept optional context without throwing", () => {
    const log = createLogger("test/context");
    expect(() => log.info("msg")).not.toThrow();
    expect(() => log.info("msg", { foo: "bar" })).not.toThrow();
    expect(() => log.warn("msg", { count: 42 })).not.toThrow();
    expect(() => log.error("msg", { code: 500 })).not.toThrow();
    expect(() => log.debug("msg", {})).not.toThrow();
  });

  it("child with empty bindings does not throw", () => {
    const log = createLogger("test/empty-child");
    expect(() => log.child({}).info("works")).not.toThrow();
  });
});
