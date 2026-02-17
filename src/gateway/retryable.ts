/**
 * RetryableGateway and CircuitBreaker utilities for gateway error recovery.
 *
 * RetryableGateway: provides connectWithRetry() with exponential backoff (max 5 retries).
 * CircuitBreaker: tracks consecutive failures and opens/half-opens/closes accordingly.
 */

// ---------------------------------------------------------------------------
// Retry configuration
// ---------------------------------------------------------------------------

export type RetryOptions = {
  /** Maximum number of retry attempts (default: 5). */
  maxRetries?: number;
  /** Base delay in milliseconds for the first retry (default: 2000). */
  baseDelayMs?: number;
  /** Maximum jitter added to each delay in milliseconds (default: 500). */
  maxJitterMs?: number;
};

const RETRY_DEFAULTS: Required<RetryOptions> = {
  maxRetries: 5,
  baseDelayMs: 2000,
  maxJitterMs: 500,
};

/**
 * Compute exponential backoff delay with jitter.
 *
 * Sequence (base 2000 ms, no jitter for illustration):
 *   attempt 0 →  2 s
 *   attempt 1 →  4 s
 *   attempt 2 →  8 s
 *   attempt 3 → 16 s
 *   attempt 4 → 32 s
 */
export function computeBackoffMs(
  attempt: number,
  baseDelayMs: number,
  maxJitterMs: number,
): number {
  const exponential = baseDelayMs * 2 ** attempt;
  const jitter = Math.random() * maxJitterMs;
  return exponential + jitter;
}

// ---------------------------------------------------------------------------
// RetryableGateway mixin
// ---------------------------------------------------------------------------

/**
 * Mixin that adds exponential-backoff retry logic to any gateway class or
 * standalone usage.
 *
 * Usage as a standalone utility:
 *
 *   const gateway = new RetryableGateway();
 *   await gateway.connectWithRetry(() => connectToServer());
 *
 * Usage as a mixin with an existing class:
 *
 *   class MyGateway extends RetryableGateway { ... }
 */
export class RetryableGateway {
  protected retryOptions: Required<RetryOptions>;

  constructor(opts?: RetryOptions) {
    this.retryOptions = { ...RETRY_DEFAULTS, ...opts };
  }

  /**
   * Attempt to connect by calling connectFn.  On failure, retries with
   * exponential backoff up to maxRetries times.  Throws the last error if all
   * attempts are exhausted.
   */
  async connectWithRetry(connectFn: () => Promise<void>): Promise<void> {
    const { maxRetries, baseDelayMs, maxJitterMs } = this.retryOptions;
    let lastError: unknown;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        await connectFn();
        return; // success
      } catch (err) {
        lastError = err;
        if (attempt < maxRetries) {
          const delayMs = computeBackoffMs(attempt, baseDelayMs, maxJitterMs);
          await sleep(delayMs);
        }
      }
    }

    throw lastError;
  }
}

// ---------------------------------------------------------------------------
// Circuit Breaker
// ---------------------------------------------------------------------------

export type CircuitBreakerOptions = {
  /** Number of consecutive failures before the circuit opens (default: 5). */
  failureThreshold?: number;
  /** Time in ms to wait in OPEN state before transitioning to HALF_OPEN (default: 30_000). */
  recoveryDelayMs?: number;
};

export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

const CIRCUIT_DEFAULTS: Required<CircuitBreakerOptions> = {
  failureThreshold: 5,
  recoveryDelayMs: 30_000,
};

/**
 * Circuit Breaker implementation.
 *
 * States:
 *   CLOSED   — normal operation; failures are counted.
 *   OPEN     — calls are rejected immediately after failureThreshold failures.
 *   HALF_OPEN — one test call is allowed after recoveryDelayMs; success closes
 *               the circuit, failure re-opens it.
 *
 * Usage:
 *   const cb = new CircuitBreaker();
 *   const result = await cb.call(() => fetchData());
 */
export class CircuitBreaker {
  private state: CircuitState = "CLOSED";
  private consecutiveFailures = 0;
  private openedAt: number | null = null;
  private readonly opts: Required<CircuitBreakerOptions>;

  constructor(opts?: CircuitBreakerOptions) {
    this.opts = { ...CIRCUIT_DEFAULTS, ...opts };
  }

  /** Current circuit state. */
  get circuitState(): CircuitState {
    return this.state;
  }

  /**
   * Execute fn through the circuit breaker.
   *
   * - CLOSED:    runs fn normally; on failure increments counter.
   * - OPEN:      rejects immediately with CircuitOpenError unless recovery
   *              delay has elapsed, in which case transitions to HALF_OPEN.
   * - HALF_OPEN: runs fn once; success closes the circuit, failure reopens it.
   */
  async call<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === "OPEN") {
      const elapsed = Date.now() - (this.openedAt ?? 0);
      if (elapsed >= this.opts.recoveryDelayMs) {
        this.state = "HALF_OPEN";
      } else {
        throw new CircuitOpenError(
          `Circuit is OPEN. Retry after ${this.opts.recoveryDelayMs - elapsed} ms.`,
        );
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }

  private onSuccess(): void {
    this.consecutiveFailures = 0;
    this.state = "CLOSED";
    this.openedAt = null;
  }

  private onFailure(): void {
    this.consecutiveFailures++;
    if (this.state === "HALF_OPEN" || this.consecutiveFailures >= this.opts.failureThreshold) {
      this.state = "OPEN";
      this.openedAt = Date.now();
    }
  }

  /** Reset to initial CLOSED state (useful for testing). */
  reset(): void {
    this.state = "CLOSED";
    this.consecutiveFailures = 0;
    this.openedAt = null;
  }
}

/**
 * Error thrown when a call is rejected because the circuit is OPEN.
 */
export class CircuitOpenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CircuitOpenError";
  }
}

// ---------------------------------------------------------------------------
// Internal helper
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
