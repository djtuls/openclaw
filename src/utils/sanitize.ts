/**
 * Input sanitization for user-supplied chat messages, user IDs, and file paths.
 *
 * sanitizeMessage: strips null bytes and dangerous control characters while
 * preserving legitimate whitespace (\n, \t, \r) and all Unicode/emoji content.
 *
 * sanitizeUserId: validates platform-prefixed IDs (e.g. "discord:123456",
 * "telegram|987654") and throws on completely invalid input.
 *
 * sanitizeFilePath: validates and normalizes file paths, rejecting path traversal
 * sequences and paths that escape the project root.
 */
import path from "node:path";

const MAX_MESSAGE_LENGTH = 4096;
const MAX_USER_ID_LENGTH = 256;
const MAX_FILE_PATH_LENGTH = 512;

/**
 * Thrown when input fails sanitization validation.
 * Distinguishes sanitization failures from system/runtime errors.
 */
export class SanitizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SanitizationError";
  }
}

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
  // eslint-disable-next-line no-control-regex
  const stripped = input
    // eslint-disable-next-line no-control-regex
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

/**
 * Validate and normalize a file path, rejecting path traversal and paths
 * that escape the project root.
 *
 * - Throws SanitizationError for empty/non-string input.
 * - Throws SanitizationError if path exceeds MAX_FILE_PATH_LENGTH (512).
 * - Throws SanitizationError if path contains "../" traversal sequences.
 * - Throws SanitizationError if absolute path is outside projectRoot.
 * - Throws SanitizationError if relative path resolves outside projectRoot.
 * - Returns the normalized absolute path on success.
 *
 * @param input - Raw file path string (absolute or relative).
 * @param projectRoot - Root directory to confine paths to. Defaults to process.cwd().
 */
export function sanitizeFilePath(input: string, projectRoot?: string): string {
  if (typeof input !== "string" || !input) {
    throw new SanitizationError("Invalid file path: empty or non-string value");
  }
  if (input.length > MAX_FILE_PATH_LENGTH) {
    throw new SanitizationError(
      `Invalid file path: exceeds maximum length of ${MAX_FILE_PATH_LENGTH} characters`,
    );
  }
  // Reject explicit traversal sequences before any normalization.
  if (input.includes("../") || input.includes("..\\")) {
    throw new SanitizationError(
      `Invalid file path: path traversal sequence detected in "${input.slice(0, 64)}"`,
    );
  }
  if (input === ".." || input.endsWith("/..") || input.endsWith("\\..")) {
    throw new SanitizationError(
      `Invalid file path: path traversal sequence detected in "${input.slice(0, 64)}"`,
    );
  }

  const root = projectRoot ?? process.cwd();
  const normalizedRoot = path.normalize(root);
  const rootWithSep = normalizedRoot.endsWith(path.sep)
    ? normalizedRoot
    : normalizedRoot + path.sep;

  if (path.isAbsolute(input)) {
    const normalized = path.normalize(input);
    if (normalized !== normalizedRoot && !normalized.startsWith(rootWithSep)) {
      throw new SanitizationError(
        `Invalid file path: absolute path "${input.slice(0, 64)}" is outside project root`,
      );
    }
    return normalized;
  }

  const resolved = path.resolve(root, input);
  if (resolved !== normalizedRoot && !resolved.startsWith(rootWithSep)) {
    throw new SanitizationError(
      `Invalid file path: relative path "${input.slice(0, 64)}" escapes the project root`,
    );
  }
  return resolved;
}
