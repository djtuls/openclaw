/**
 * Frontmatter Parser for Memory Backend
 *
 * Parses YAML frontmatter from markdown files written by Tulsbot's
 * NotebookLM knowledge import process.
 *
 * Format:
 * ---
 * key: "value"
 * number: 123
 * ---
 *
 * Content after frontmatter...
 */

export interface ParsedContent {
  metadata: Record<string, any>;
  content: string;
}

/**
 * Parse YAML frontmatter from markdown content
 *
 * @param rawContent - Full file content potentially containing frontmatter
 * @returns Parsed metadata and content with frontmatter removed
 */
export function parseFrontmatter(rawContent: string): ParsedContent {
  const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
  const match = rawContent.match(frontmatterRegex);

  if (!match) {
    // No frontmatter found - return content as-is
    return {
      metadata: {},
      content: rawContent,
    };
  }

  const [, frontmatterBlock, content] = match;
  const metadata: Record<string, any> = {};

  // Parse simple YAML frontmatter (key: value format)
  const lines = frontmatterBlock.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue; // Skip empty lines and comments
    }

    const colonIndex = trimmed.indexOf(":");
    if (colonIndex === -1) {
      continue; // Invalid line format
    }

    const key = trimmed.slice(0, colonIndex).trim();
    const valueStr = trimmed.slice(colonIndex + 1).trim();

    // Parse JSON value (handles strings, numbers, booleans, objects, arrays)
    try {
      metadata[key] = JSON.parse(valueStr);
    } catch {
      // If JSON parsing fails, store as string
      metadata[key] = valueStr;
    }
  }

  return {
    metadata,
    content,
  };
}
