import { describe, expect, test } from "vitest";
import { sanitizeMessage, sanitizeUserId } from "./sanitize.js";

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
    expect(sanitizeUserId("user@domain.com")).toBe("userdomain");
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
