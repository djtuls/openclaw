/**
 * src/middleware/rate-limiter.ts
 *
 * Sliding-window rate limiter (Map-based, no Redis).
 *
 * Tracks per-user and per-channel request timestamps within a rolling
 * 60-second window. Old timestamps are pruned on each check so memory
 * usage stays proportional to active users, not total requests.
 *
 * Configuration (environment variables):
 *   RATE_LIMIT_PER_USER_PER_MIN    default: 20
 *   RATE_LIMIT_PER_CHANNEL_PER_MIN default: 100
 *
 * Usage:
 *   import { checkRateLimit } from "./rate-limiter.js";
 *   const result = checkRateLimit(userId, channelId);
 *   if (!result.allowed) {
 *     reply(`Rate limit exceeded. Try again in ${result.retryAfterMs}ms.`);
 *   }
 */

const WINDOW_MS = 60_000; // 1 minute sliding window

function readLimit(envVar: string, defaultValue: number): number {
  const raw = process.env[envVar];
  if (!raw) {
    return defaultValue;
  }
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultValue;
}

function getUserLimit(): number {
  return readLimit("RATE_LIMIT_PER_USER_PER_MIN", 20);
}

function getChannelLimit(): number {
  return readLimit("RATE_LIMIT_PER_CHANNEL_PER_MIN", 100);
}

export interface RateLimitResult {
  /** True when the request should be allowed. */
  allowed: boolean;
  /**
   * When `allowed` is false, the number of milliseconds the caller must
   * wait before the oldest in-window request expires and a slot opens.
   * Zero when `allowed` is true.
   */
  retryAfterMs: number;
}

/** Sliding-window timestamp buckets keyed by user/channel ID. */
const userWindows = new Map<string, number[]>();
const channelWindows = new Map<string, number[]>();

/**
 * Prune timestamps older than the window, then append now.
 * Returns the updated list length (= request count within the window).
 */
function recordAndCount(store: Map<string, number[]>, key: string, now: number): number {
  const cutoff = now - WINDOW_MS;
  let bucket = store.get(key);
  if (!bucket) {
    bucket = [];
    store.set(key, bucket);
  }
  // Remove expired timestamps
  let first = 0;
  while (first < bucket.length && bucket[first] <= cutoff) {
    first++;
  }
  if (first > 0) {
    bucket.splice(0, first);
  }
  bucket.push(now);
  return bucket.length;
}

/**
 * Compute the milliseconds until the oldest timestamp in the window expires,
 * giving the caller the minimum wait before they can retry.
 */
function retryAfter(store: Map<string, number[]>, key: string, now: number): number {
  const bucket = store.get(key);
  if (!bucket || bucket.length === 0) {
    return 0;
  }
  const oldest = bucket[0];
  return Math.max(0, oldest + WINDOW_MS - now);
}

/**
 * Check whether a request from `userId` on `channelId` is within rate limits.
 *
 * Both the per-user limit and per-channel limit are evaluated.
 * If either is exceeded the request is rejected with the longer retryAfterMs.
 */
export function checkRateLimit(userId: string, channelId: string): RateLimitResult {
  const now = Date.now();
  const userCount = recordAndCount(userWindows, userId, now);
  const channelCount = recordAndCount(channelWindows, channelId, now);

  const userLimit = getUserLimit();
  const channelLimit = getChannelLimit();

  const userViolation = userCount > userLimit;
  const channelViolation = channelCount > channelLimit;

  if (!userViolation && !channelViolation) {
    return { allowed: true, retryAfterMs: 0 };
  }

  // Roll back the timestamps we just added since the request is rejected
  const userBucket = userWindows.get(userId);
  if (userBucket && userBucket.length > 0) {
    userBucket.pop();
  }
  const channelBucket = channelWindows.get(channelId);
  if (channelBucket && channelBucket.length > 0) {
    channelBucket.pop();
  }

  const userWait = userViolation ? retryAfter(userWindows, userId, now) : 0;
  const channelWait = channelViolation ? retryAfter(channelWindows, channelId, now) : 0;

  return {
    allowed: false,
    retryAfterMs: Math.max(userWait, channelWait),
  };
}

/**
 * Remove all stored state for a given user (e.g., on logout).
 * Channel state is not cleared — other users may share the channel.
 */
export function clearUserRateLimit(userId: string): void {
  userWindows.delete(userId);
}

/** Flush all rate-limit state (useful in tests). */
export function resetAllRateLimits(): void {
  userWindows.clear();
  channelWindows.clear();
}
