import path from "node:path";
import { describe, expect, test } from "vitest";
import {
  SanitizationError,
  sanitizeFilePath,
  sanitizeMessage,
  sanitizeUserId,
} from "./sanitize.js";

describe("sanitizeMessage", () => {
  test("returns message unchanged when already clean", () => {
    expect(sanitizeMessage("Hello, world!")).toBe("Hello, world!");
  });

  test("strips null bytes", () => {
    expect(sanitizeMessage("hel\x00lo")).toBe("hello");
    expect(sanitizeMessage("\x00\x00leading")).toBe("leading");
    expect(sanitizeMessage("trailing\x00")).toBe("trailing");
  });

  test("strips dangerous C0 control characters", () => {
    // SOH through BS (\x01-\x08)
    expect(sanitizeMessage("a\x01\x02\x03b")).toBe("ab");
    // VT (\x0B) and FF (\x0C)
    expect(sanitizeMessage("a\x0Bb\x0Cc")).toBe("abc");
    // SO through US (\x0E-\x1F)
    expect(sanitizeMessage("a\x0E\x1Fb")).toBe("ab");
    // DEL (\x7F)
    expect(sanitizeMessage("a\x7Fb")).toBe("ab");
  });

  test("preserves newline, tab, and carriage return", () => {
    expect(sanitizeMessage("line1\nline2")).toBe("line1\nline2");
    expect(sanitizeMessage("col1\tcol2")).toBe("col1\tcol2");
    expect(sanitizeMessage("windows\r\nline")).toBe("windows\r\nline");
  });

  test("preserves unicode and emoji", () => {
    expect(sanitizeMessage("こんにちは")).toBe("こんにちは");
    expect(sanitizeMessage("Hello 😀🎉")).toBe("Hello 😀🎉");
    expect(sanitizeMessage("Привет мир")).toBe("Привет мир");
    expect(sanitizeMessage("中文测试")).toBe("中文测试");
  });

  test("truncates to 4096 characters", () => {
    const long = "a".repeat(5000);
    const result = sanitizeMessage(long);
    expect(result.length).toBe(4096);
  });

  test("truncates after stripping — stripped content does not count toward limit", () => {
    // Build a string that is exactly 4096 visible chars padded with null bytes.
    // After stripping nulls the result should be exactly 4096 chars.
    const visible = "x".repeat(4096);
    const withNulls = visible
      .split("")
      .map((c, i) => (i % 10 === 0 ? "\x00" + c : c))
      .join("");
    const result = sanitizeMessage(withNulls);
    expect(result).toBe(visible);
    expect(result.length).toBe(4096);
  });

  test("returns empty string for empty input", () => {
    expect(sanitizeMessage("")).toBe("");
  });

  test("strips mixed control chars while preserving whitespace", () => {
    const input = "\x01Hello\x07 world\x0B!\nSecond line";
    expect(sanitizeMessage(input)).toBe("Hello world!\nSecond line");
  });
});

describe("sanitizeUserId", () => {
  test("returns valid IDs unchanged", () => {
    expect(sanitizeUserId("user123")).toBe("user123");
    expect(sanitizeUserId("discord:123456")).toBe("discord:123456");
    expect(sanitizeUserId("telegram|987654")).toBe("telegram|987654");
    expect(sanitizeUserId("slack:T0123|U456")).toBe("slack:T0123|U456");
    expect(sanitizeUserId("user-name_01")).toBe("user-name_01");
  });

  test("strips characters outside the allowed set", () => {
    expect(sanitizeUserId("user name")).toBe("username");
    // @ and . are stripped; alphanumeric chars remain
    expect(sanitizeUserId("user@domain.com")).toBe("userdomaincom");
    expect(sanitizeUserId("hello<world>")).toBe("helloworld");
  });

  test("truncates to 256 characters", () => {
    const long = "a".repeat(300);
    const result = sanitizeUserId(long);
    expect(result.length).toBe(256);
  });

  test("throws for empty string", () => {
    expect(() => sanitizeUserId("")).toThrow("Invalid user ID");
  });

  test("throws for completely invalid characters", () => {
    expect(() => sanitizeUserId("!!! ???")).toThrow("Invalid user ID");
    expect(() => sanitizeUserId("@#$%^&*()")).toThrow("Invalid user ID");
  });

  test("throws for non-string input", () => {
    // Cast to test runtime guard
    expect(() => sanitizeUserId(null as unknown as string)).toThrow("Invalid user ID");
    expect(() => sanitizeUserId(undefined as unknown as string)).toThrow("Invalid user ID");
  });

  test("preserves platform prefix colon separator", () => {
    expect(sanitizeUserId("discord:user:123")).toBe("discord:user:123");
  });

  test("preserves platform prefix pipe separator", () => {
    expect(sanitizeUserId("telegram|12345678")).toBe("telegram|12345678");
  });
});

describe("sanitizeFilePath", () => {
  const ROOT = "/tmp/project";

  test("returns normalized absolute path inside root", () => {
    const result = sanitizeFilePath("/tmp/project/src/file.ts", ROOT);
    expect(result).toBe("/tmp/project/src/file.ts");
  });

  test("resolves relative path against root", () => {
    const result = sanitizeFilePath("src/file.ts", ROOT);
    expect(result).toBe(path.resolve(ROOT, "src/file.ts"));
  });

  test("throws SanitizationError for empty string", () => {
    expect(() => sanitizeFilePath("", ROOT)).toThrow(SanitizationError);
    expect(() => sanitizeFilePath("", ROOT)).toThrow("empty or non-string");
  });

  test("throws SanitizationError for non-string input", () => {
    expect(() => sanitizeFilePath(null as unknown as string, ROOT)).toThrow(SanitizationError);
    expect(() => sanitizeFilePath(undefined as unknown as string, ROOT)).toThrow(SanitizationError);
  });

  test("throws SanitizationError for path exceeding max length", () => {
    const longPath = "a/".repeat(260);
    expect(() => sanitizeFilePath(longPath, ROOT)).toThrow(SanitizationError);
    expect(() => sanitizeFilePath(longPath, ROOT)).toThrow("exceeds maximum length");
  });

  test("throws SanitizationError for '../' traversal", () => {
    expect(() => sanitizeFilePath("../etc/passwd", ROOT)).toThrow(SanitizationError);
    expect(() => sanitizeFilePath("../etc/passwd", ROOT)).toThrow("path traversal");
  });

  test("throws SanitizationError for '..' alone", () => {
    expect(() => sanitizeFilePath("..", ROOT)).toThrow(SanitizationError);
  });

  test("throws SanitizationError for path ending in '/..'", () => {
    // implementation rejects paths ending in /.. at string level (conservative)
    expect(() => sanitizeFilePath("src/..", ROOT)).toThrow(SanitizationError);
    expect(() => sanitizeFilePath("src/../../outside", ROOT)).toThrow(SanitizationError);
  });

  test("throws SanitizationError for absolute path outside root", () => {
    expect(() => sanitizeFilePath("/etc/passwd", ROOT)).toThrow(SanitizationError);
    expect(() => sanitizeFilePath("/etc/passwd", ROOT)).toThrow("outside project root");
  });

  test("allows root directory itself as absolute path", () => {
    const result = sanitizeFilePath(ROOT, ROOT);
    expect(result).toBe(path.normalize(ROOT));
  });

  test("SanitizationError has correct name", () => {
    try {
      sanitizeFilePath("../escape", ROOT);
    } catch (e) {
      expect(e).toBeInstanceOf(SanitizationError);
      expect((e as SanitizationError).name).toBe("SanitizationError");
    }
  });
});
