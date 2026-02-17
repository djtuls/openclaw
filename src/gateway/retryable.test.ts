import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CircuitBreaker,
  CircuitOpenError,
  RetryableGateway,
  computeBackoffMs,
} from "./retryable.js";

// ---------------------------------------------------------------------------
// computeBackoffMs
// ---------------------------------------------------------------------------

describe("computeBackoffMs", () => {
  it("returns base delay on attempt 0", () => {
    // No jitter: maxJitterMs = 0
    expect(computeBackoffMs(0, 2000, 0)).toBe(2000);
  });

  it("doubles each attempt with no jitter", () => {
    expect(computeBackoffMs(1, 2000, 0)).toBe(4000);
    expect(computeBackoffMs(2, 2000, 0)).toBe(8000);
    expect(computeBackoffMs(3, 2000, 0)).toBe(16000);
    expect(computeBackoffMs(4, 2000, 0)).toBe(32000);
  });

  it("adds jitter within the expected range", () => {
    const delay = computeBackoffMs(0, 2000, 500);
    expect(delay).toBeGreaterThanOrEqual(2000);
    expect(delay).toBeLessThan(2500);
  });
});

// ---------------------------------------------------------------------------
// RetryableGateway
// ---------------------------------------------------------------------------

describe("RetryableGateway", () => {
  let gateway: RetryableGateway;

  beforeEach(() => {
    vi.useFakeTimers();
    // Use very short delays so fake timer advancement is quick.
    gateway = new RetryableGateway({ baseDelayMs: 10, maxJitterMs: 0, maxRetries: 5 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("happy path: connects on the first attempt without retrying", async () => {
    const connectFn = vi.fn().mockResolvedValue(undefined);

    const promise = gateway.connectWithRetry(connectFn);
    // Advance timers just in case (should not be needed on success)
    await vi.runAllTimersAsync();
    await promise;

    expect(connectFn).toHaveBeenCalledTimes(1);
  });

  it("succeeds on the second attempt", async () => {
    const connectFn = vi
      .fn()
      .mockRejectedValueOnce(new Error("first failure"))
      .mockResolvedValueOnce(undefined);

    const promise = gateway.connectWithRetry(connectFn);
    await vi.runAllTimersAsync();
    await promise;

    expect(connectFn).toHaveBeenCalledTimes(2);
  });

  it("retries up to maxRetries then throws the last error", async () => {
    const error = new Error("persistent failure");
    const connectFn = vi.fn().mockRejectedValue(error);

    // Kick off the retry loop and advance timers concurrently to avoid
    // unhandled rejection warnings from unsettled intermediate promises.
    let caughtError: unknown;
    await Promise.all([
      gateway.connectWithRetry(connectFn).catch((err) => {
        caughtError = err;
      }),
      vi.runAllTimersAsync(),
    ]);

    expect(caughtError).toBe(error);
    // 1 initial attempt + 5 retries = 6 total calls
    expect(connectFn).toHaveBeenCalledTimes(6);
  });

  it("does not retry if maxRetries is 0", async () => {
    const gw = new RetryableGateway({ baseDelayMs: 10, maxJitterMs: 0, maxRetries: 0 });
    const connectFn = vi.fn().mockRejectedValue(new Error("no retry"));

    let caughtError: unknown;
    await Promise.all([
      gw.connectWithRetry(connectFn).catch((err) => {
        caughtError = err;
      }),
      vi.runAllTimersAsync(),
    ]);

    expect((caughtError as Error).message).toBe("no retry");
    expect(connectFn).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// CircuitBreaker
// ---------------------------------------------------------------------------

describe("CircuitBreaker", () => {
  let cb: CircuitBreaker;

  beforeEach(() => {
    vi.useFakeTimers();
    cb = new CircuitBreaker({ failureThreshold: 5, recoveryDelayMs: 30_000 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts in CLOSED state", () => {
    expect(cb.circuitState).toBe("CLOSED");
  });

  it("passes calls through in CLOSED state", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const result = await cb.call(fn);
    expect(result).toBe("ok");
    expect(cb.circuitState).toBe("CLOSED");
  });

  it("stays CLOSED after fewer failures than threshold", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("fail"));
    for (let i = 0; i < 4; i++) {
      await expect(cb.call(fn)).rejects.toThrow("fail");
    }
    expect(cb.circuitState).toBe("CLOSED");
  });

  it("opens the circuit after 5 consecutive failures", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("fail"));

    for (let i = 0; i < 5; i++) {
      await expect(cb.call(fn)).rejects.toThrow("fail");
    }

    expect(cb.circuitState).toBe("OPEN");
  });

  it("rejects calls immediately when OPEN without invoking fn", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("fail"));

    // Open the circuit
    for (let i = 0; i < 5; i++) {
      await expect(cb.call(fn)).rejects.toThrow("fail");
    }
    expect(cb.circuitState).toBe("OPEN");

    const rejected = vi.fn().mockResolvedValue("should not be called");
    await expect(cb.call(rejected)).rejects.toBeInstanceOf(CircuitOpenError);
    expect(rejected).not.toHaveBeenCalled();
  });

  it("transitions to HALF_OPEN after 30s recovery delay", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("fail"));

    // Open the circuit
    for (let i = 0; i < 5; i++) {
      await expect(cb.call(fn)).rejects.toThrow("fail");
    }
    expect(cb.circuitState).toBe("OPEN");

    // Advance time past recovery delay
    vi.advanceTimersByTime(30_001);

    // The next call should attempt execution (transitioning to HALF_OPEN first)
    const probeFn = vi.fn().mockResolvedValue("recovered");
    const result = await cb.call(probeFn);
    expect(result).toBe("recovered");
    expect(cb.circuitState).toBe("CLOSED");
  });

  it("stays OPEN if called before recovery delay elapses", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("fail"));

    for (let i = 0; i < 5; i++) {
      await expect(cb.call(fn)).rejects.toThrow("fail");
    }
    expect(cb.circuitState).toBe("OPEN");

    // Advance time but NOT past the recovery delay
    vi.advanceTimersByTime(10_000);

    const probeFn = vi.fn().mockResolvedValue("should not run");
    await expect(cb.call(probeFn)).rejects.toBeInstanceOf(CircuitOpenError);
    expect(probeFn).not.toHaveBeenCalled();
    expect(cb.circuitState).toBe("OPEN");
  });

  it("closes the circuit after 1 success in HALF_OPEN state", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("fail"));

    // Open the circuit
    for (let i = 0; i < 5; i++) {
      await expect(cb.call(fn)).rejects.toThrow("fail");
    }

    // Wait for recovery
    vi.advanceTimersByTime(30_001);

    // One success in HALF_OPEN closes the circuit
    const successFn = vi.fn().mockResolvedValue("ok");
    await cb.call(successFn);
    expect(cb.circuitState).toBe("CLOSED");
  });

  it("reopens the circuit if HALF_OPEN probe fails", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("fail"));

    // Open the circuit
    for (let i = 0; i < 5; i++) {
      await expect(cb.call(fn)).rejects.toThrow("fail");
    }

    // Wait for recovery
    vi.advanceTimersByTime(30_001);

    // Probe fails → goes back to OPEN
    const probeFn = vi.fn().mockRejectedValue(new Error("still failing"));
    await expect(cb.call(probeFn)).rejects.toThrow("still failing");
    expect(cb.circuitState).toBe("OPEN");
  });

  it("resets to CLOSED state via reset()", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("fail"));
    for (let i = 0; i < 5; i++) {
      await expect(cb.call(fn)).rejects.toThrow("fail");
    }
    expect(cb.circuitState).toBe("OPEN");

    cb.reset();
    expect(cb.circuitState).toBe("CLOSED");
  });
});
