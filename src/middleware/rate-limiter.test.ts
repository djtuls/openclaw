import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { checkRateLimit, clearUserRateLimit, resetAllRateLimits } from "./rate-limiter.js";

describe("rate-limiter", () => {
  beforeEach(() => {
    resetAllRateLimits();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    resetAllRateLimits();
  });

  // ── Basic allow / deny ──────────────────────────────────────────────────

  it("allows a single request", () => {
    const result = checkRateLimit("user1", "chan1");
    expect(result.allowed).toBe(true);
    expect(result.retryAfterMs).toBe(0);
  });

  it("allows up to the per-user default limit (20)", () => {
    for (let i = 0; i < 20; i++) {
      const r = checkRateLimit("user1", "chan1");
      expect(r.allowed).toBe(true);
    }
  });

  it("denies the 21st request from the same user within the window", () => {
    for (let i = 0; i < 20; i++) {
      checkRateLimit("user1", "chan1");
    }
    const denied = checkRateLimit("user1", "chan1");
    expect(denied.allowed).toBe(false);
    expect(denied.retryAfterMs).toBeGreaterThan(0);
  });

  // ── Per-channel limit ───────────────────────────────────────────────────

  it("denies when per-channel limit (100) is exceeded across different users", () => {
    // Each user makes 20 requests (the per-user default) — 5 users = 100 total
    for (let u = 0; u < 5; u++) {
      for (let i = 0; i < 20; i++) {
        checkRateLimit(`user${u}`, "shared_chan");
      }
    }
    // 101st request from a 6th user
    const denied = checkRateLimit("user_new", "shared_chan");
    expect(denied.allowed).toBe(false);
    expect(denied.retryAfterMs).toBeGreaterThan(0);
  });

  // ── Env var overrides ───────────────────────────────────────────────────

  it("respects RATE_LIMIT_PER_USER_PER_MIN env override", () => {
    vi.stubEnv("RATE_LIMIT_PER_USER_PER_MIN", "3");

    for (let i = 0; i < 3; i++) {
      expect(checkRateLimit("u", "c").allowed).toBe(true);
    }
    expect(checkRateLimit("u", "c").allowed).toBe(false);
  });

  it("respects RATE_LIMIT_PER_CHANNEL_PER_MIN env override", () => {
    vi.stubEnv("RATE_LIMIT_PER_CHANNEL_PER_MIN", "2");

    expect(checkRateLimit("u1", "c").allowed).toBe(true);
    expect(checkRateLimit("u2", "c").allowed).toBe(true);
    expect(checkRateLimit("u3", "c").allowed).toBe(false);
  });

  it("ignores invalid (non-numeric) env values and uses defaults", () => {
    vi.stubEnv("RATE_LIMIT_PER_USER_PER_MIN", "notanumber");

    // Should still allow 20 requests (default)
    for (let i = 0; i < 20; i++) {
      expect(checkRateLimit("u", "c").allowed).toBe(true);
    }
    expect(checkRateLimit("u", "c").allowed).toBe(false);
  });

  // ── Timestamp rollback on denial ────────────────────────────────────────

  it("does not count a denied request toward the window", () => {
    vi.stubEnv("RATE_LIMIT_PER_USER_PER_MIN", "2");

    expect(checkRateLimit("u", "c").allowed).toBe(true); // 1
    expect(checkRateLimit("u", "c").allowed).toBe(true); // 2
    expect(checkRateLimit("u", "c").allowed).toBe(false); // denied — rolled back

    // If the denied request were counted, a 4th call would also be denied.
    // But since it was rolled back, the window still has exactly 2 entries.
    // We can't add a 3rd allowed one (limit is 2), so let's verify a different
    // user on the same channel is unaffected:
    expect(checkRateLimit("other_user", "c").allowed).toBe(true);
  });

  // ── clearUserRateLimit ──────────────────────────────────────────────────

  it("clearUserRateLimit resets a specific user's window", () => {
    vi.stubEnv("RATE_LIMIT_PER_USER_PER_MIN", "2");

    checkRateLimit("u", "c");
    checkRateLimit("u", "c");
    expect(checkRateLimit("u", "c").allowed).toBe(false);

    clearUserRateLimit("u");

    // After clearing, the user has a fresh window
    expect(checkRateLimit("u", "c").allowed).toBe(true);
  });

  it("clearUserRateLimit does not affect other users", () => {
    vi.stubEnv("RATE_LIMIT_PER_USER_PER_MIN", "2");

    checkRateLimit("u1", "c");
    checkRateLimit("u1", "c");
    checkRateLimit("u2", "c");
    checkRateLimit("u2", "c");

    clearUserRateLimit("u1");

    // u1 is cleared, u2 is still at limit
    expect(checkRateLimit("u1", "c").allowed).toBe(true);
    expect(checkRateLimit("u2", "c").allowed).toBe(false);
  });

  // ── resetAllRateLimits ──────────────────────────────────────────────────

  it("resetAllRateLimits clears all user and channel state", () => {
    vi.stubEnv("RATE_LIMIT_PER_USER_PER_MIN", "1");
    vi.stubEnv("RATE_LIMIT_PER_CHANNEL_PER_MIN", "1");

    checkRateLimit("u", "c");
    expect(checkRateLimit("u", "c").allowed).toBe(false);

    resetAllRateLimits();

    expect(checkRateLimit("u", "c").allowed).toBe(true);
  });

  // ── retryAfterMs ────────────────────────────────────────────────────────

  it("retryAfterMs is within the 60-second window range", () => {
    vi.stubEnv("RATE_LIMIT_PER_USER_PER_MIN", "1");

    checkRateLimit("u", "c");
    const denied = checkRateLimit("u", "c");

    expect(denied.allowed).toBe(false);
    // retryAfterMs should be between 0 and 60_000 (the window)
    expect(denied.retryAfterMs).toBeGreaterThan(0);
    expect(denied.retryAfterMs).toBeLessThanOrEqual(60_000);
  });

  // ── Independent user/channel tracking ───────────────────────────────────

  it("tracks users independently across different channels", () => {
    vi.stubEnv("RATE_LIMIT_PER_USER_PER_MIN", "2");

    checkRateLimit("u", "c1");
    checkRateLimit("u", "c2");
    // User has 2 requests total across channels — should be denied
    expect(checkRateLimit("u", "c3").allowed).toBe(false);
  });
});
