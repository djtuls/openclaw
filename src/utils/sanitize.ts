/**
 * Input sanitization for user-supplied chat messages and user IDs.
 *
 * sanitizeMessage: strips null bytes and dangerous control characters while
 * preserving legitimate whitespace (\n, \t, \r) and all Unicode/emoji content.
 *
 * sanitizeUserId: validates platform-prefixed IDs (e.g. "discord:123456",
 * "telegram|987654") and throws on completely invalid input.
 */

const MAX_MESSAGE_LENGTH = 4096;
const MAX_USER_ID_LENGTH = 256;

/**
 * Characters considered "safe" in user IDs.
 * Allows alphanumeric, hyphen, underscore, pipe, and colon so that
 * platform-prefixed IDs like "discord:123456" or "telegram|user" are valid.
 */
const VALID_USER_ID_RE = /^[a-zA-Z0-9\-_|:]+$/;

/**
 * Strip null bytes and ASCII control characters from a chat message.
 *
 * Preserved:  \t (0x09), \n (0x0A), \r (0x0D), and all non-ASCII (Unicode/emoji).
 * Stripped:   \x00 (null), \x01-\x08, \x0B (VT), \x0C (FF), \x0E-\x1F (other C0),
 *             \x7F (DEL).
 * Truncated to MAX_MESSAGE_LENGTH (4096) *after* stripping.
 */
export function sanitizeMessage(input: string): string {
  // Strip null bytes explicitly first (belt-and-suspenders).
  // Then strip other dangerous C0 control chars while keeping \t, \n, \r.
  const stripped = input
    .replace(/\x00/g, "")
    // eslint-disable-next-line no-control-regex
    .replace(/[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
  return stripped.slice(0, MAX_MESSAGE_LENGTH);
}

/**
 * Validate and sanitize a user/session ID.
 *
 * - Truncates to MAX_USER_ID_LENGTH (256) first.
 * - Strips characters outside [a-zA-Z0-9\-_|:].
 * - Throws if the result is empty (completely invalid input).
 *
 * Platform-prefixed formats are explicitly supported:
 *   "discord:123456", "telegram|987654", "slack:T0123|U456"
 */
export function sanitizeUserId(id: string): string {
  if (!id || typeof id !== "string") {
    throw new Error("Invalid user ID: empty or non-string value");
  }
  const truncated = id.slice(0, MAX_USER_ID_LENGTH);
  if (VALID_USER_ID_RE.test(truncated)) {
    return truncated;
  }
  // Strip characters not in the allowed set.
  const cleaned = truncated.replace(/[^a-zA-Z0-9\-_|:]/g, "");
  if (!cleaned) {
    throw new Error(`Invalid user ID: no valid characters found in "${id.slice(0, 64)}"`);
  }
  return cleaned;
}
