import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CircuitBreaker, CircuitOpenError, RetryableGateway } from "./retryable.js";

describe("RetryableGateway – error recovery", () => {
  let gateway: RetryableGateway;

  beforeEach(() => {
    vi.useFakeTimers();
    gateway = new RetryableGateway({ baseDelayMs: 10, maxJitterMs: 0, maxRetries: 5 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("happy path: retry succeeds on attempt 2", async () => {
    const connectFn = vi
      .fn()
      .mockRejectedValueOnce(new Error("first failure"))
      .mockResolvedValueOnce(undefined);

    const promise = gateway.connectWithRetry(connectFn);
    await vi.runAllTimersAsync();
    await promise;

    expect(connectFn).toHaveBeenCalledTimes(2);
  });

  it("max retries exceeded → throws the last error", async () => {
    const error = new Error("persistent failure");
    const connectFn = vi.fn().mockRejectedValue(error);
    let caughtError: unknown;

    await Promise.all([
      gateway.connectWithRetry(connectFn).catch((err) => {
        caughtError = err;
      }),
      vi.runAllTimersAsync(),
    ]);

    expect(connectFn).toHaveBeenCalledTimes(6);
    expect(caughtError).toBe(error);
  });
});

describe("CircuitBreaker – state transitions", () => {
  let cb: CircuitBreaker;

  beforeEach(() => {
    vi.useFakeTimers();
    cb = new CircuitBreaker({ failureThreshold: 5, recoveryDelayMs: 30_000 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("circuit opens after 5 consecutive failures", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("fail"));
    for (let i = 0; i < 5; i++) {
      await expect(cb.call(fn)).rejects.toThrow("fail");
    }
    expect(cb.circuitState).toBe("OPEN");
  });

  it("circuit rejects calls immediately while OPEN (fn never called)", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("fail"));
    for (let i = 0; i < 5; i++) {
      await expect(cb.call(fn)).rejects.toThrow("fail");
    }
    const neverCalled = vi.fn().mockResolvedValue("should not run");
    await expect(cb.call(neverCalled)).rejects.toBeInstanceOf(CircuitOpenError);
    expect(neverCalled).not.toHaveBeenCalled();
  });

  it("circuit half-opens after 30s cooldown and closes on success", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("fail"));
    for (let i = 0; i < 5; i++) {
      await expect(cb.call(fn)).rejects.toThrow("fail");
    }
    vi.advanceTimersByTime(30_001);

    const successFn = vi.fn().mockResolvedValue("recovered");
    const result = await cb.call(successFn);

    expect(result).toBe("recovered");
    expect(cb.circuitState).toBe("CLOSED");
  });

  it("circuit re-opens if HALF_OPEN probe fails", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("fail"));
    for (let i = 0; i < 5; i++) {
      await expect(cb.call(fn)).rejects.toThrow("fail");
    }
    vi.advanceTimersByTime(30_001);

    const probeFn = vi.fn().mockRejectedValue(new Error("still failing"));
    await expect(cb.call(probeFn)).rejects.toThrow("still failing");
    expect(cb.circuitState).toBe("OPEN");
  });
});
