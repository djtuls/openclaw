import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Structure representing a Tulsbot sub-agent from core-app-knowledge.json
 */
export interface TulsbotSubAgent {
  name: string;
  id?: string;
  description?: string;
  capabilities?: string[];
  triggers?: string[];
  systemPrompt?: string;
  // Additional fields from the knowledge file
  [key: string]: unknown;
}

/**
 * Structure of the Tulsbot knowledge base
 */
export interface TulsbotKnowledge {
  agents: TulsbotSubAgent[];
  version?: string;
  lastUpdated?: string;
  // Additional top-level fields
  [key: string]: unknown;
}

/**
 * In-memory cache to avoid reloading the 824KB knowledge file on every access
 */
let cachedKnowledge: TulsbotKnowledge | null = null;
let cacheVersion: string | null = null;
let cacheLoadTime: number | null = null;

/**
 * Default path to the Tulsbot knowledge file
 * Resolves to ~/Backend_local Macbook/Tulsbot/.tulsbot/core-app-knowledge.json
 * Can be overridden with TULSBOT_KNOWLEDGE_PATH environment variable for testing
 */
function getDefaultKnowledgePath(): string {
  // Allow override via environment variable for testing
  if (process.env.TULSBOT_KNOWLEDGE_PATH) {
    return process.env.TULSBOT_KNOWLEDGE_PATH;
  }

  const homeDir = process.env.HOME || process.env.USERPROFILE || "";
  return path.join(homeDir, "Backend_local Macbook/Tulsbot/.tulsbot/core-app-knowledge.json");
}

/**
 * Load and parse the Tulsbot knowledge file
 *
 * @param filePath - Path to the knowledge JSON file (defaults to standard location)
 * @returns Parsed knowledge structure
 * @throws Error if file cannot be read or parsed, or if structure is invalid
 */
export async function loadTulsbotKnowledge(
  filePath: string = getDefaultKnowledgePath(),
): Promise<TulsbotKnowledge> {
  try {
    // Read the file (824KB, so we read it all at once)
    const content = await fs.readFile(filePath, "utf-8");

    // Parse JSON
    const knowledge = JSON.parse(content) as TulsbotKnowledge;

    // Validate structure
    if (!knowledge.agents || !Array.isArray(knowledge.agents)) {
      throw new Error("Invalid knowledge structure: missing or invalid 'agents' array");
    }

    if (knowledge.agents.length === 0) {
      throw new Error("Invalid knowledge structure: 'agents' array is empty");
    }

    // Validate each agent has at minimum a name
    for (let i = 0; i < knowledge.agents.length; i++) {
      const agent = knowledge.agents[i];
      if (!agent || typeof agent !== "object") {
        throw new Error(`Invalid agent at index ${i}: not an object`);
      }
      if (!agent.name || typeof agent.name !== "string") {
        throw new Error(`Invalid agent at index ${i}: missing or invalid 'name' field`);
      }
    }

    return knowledge;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to load Tulsbot knowledge from ${filePath}: ${error.message}`, {
        cause: error,
      });
    }
    throw new Error(`Failed to load Tulsbot knowledge from ${filePath}: Unknown error`, {
      cause: error,
    });
  }
}

/**
 * Get cached knowledge, loading it if necessary
 *
 * This is the primary entry point for accessing Tulsbot knowledge.
 * The knowledge is loaded once and cached in memory for subsequent calls.
 *
 * FEATURE FLAG: Set TULSBOT_USE_INDEXED_KNOWLEDGE=true to use optimized V2 loader
 * V2 benefits: 95% faster initial load, 80% less memory, lazy agent loading
 *
 * @param forceReload - Force reload even if cached (useful for development/testing)
 * @returns Cached knowledge structure
 */
export async function getCachedKnowledge(forceReload = false): Promise<TulsbotKnowledge> {
  // Feature flag: use optimized V2 loader if enabled
  if (process.env.TULSBOT_USE_INDEXED_KNOWLEDGE === "true") {
    const { getCachedKnowledge: getCachedKnowledgeV2 } = await import("./knowledge-loader-v2.js");
    return getCachedKnowledgeV2();
  }

  // Original V1 implementation (backward compatible)
  if (!cachedKnowledge || forceReload) {
    const knowledge = await loadTulsbotKnowledge();

    // Cache the loaded knowledge
    cachedKnowledge = knowledge;
    cacheVersion = knowledge.version || "unknown";
    cacheLoadTime = Date.now();

    console.log(
      `[TulsbotKnowledge] Loaded knowledge v${cacheVersion} with ${knowledge.agents.length} agents`,
    );
  }

  return cachedKnowledge;
}

/**
 * Get metadata about the cached knowledge
 *
 * @returns Cache metadata or null if not loaded
 */
export function getCacheMetadata(): {
  version: string;
  loadTime: number;
  agentCount: number;
} | null {
  if (!cachedKnowledge) {
    return null;
  }

  return {
    version: cacheVersion || "unknown",
    loadTime: cacheLoadTime || 0,
    agentCount: cachedKnowledge.agents.length,
  };
}

/**
 * Clear the cached knowledge (useful for testing or forced reloads)
 */
export function clearCache(): void {
  cachedKnowledge = null;
  cacheVersion = null;
  cacheLoadTime = null;
}

/**
 * Find a sub-agent by name (case-insensitive partial match)
 *
 * @param name - Agent name to search for
 * @param knowledge - Knowledge base to search (defaults to cached knowledge)
 * @returns Matching agent or null if not found
 */
export async function findAgentByName(
  name: string,
  knowledge?: TulsbotKnowledge,
): Promise<TulsbotSubAgent | null> {
  // Use optimized V2 if enabled
  if (process.env.TULSBOT_USE_INDEXED_KNOWLEDGE === "true") {
    const { findAgentByName: findAgentByNameV2 } = await import("./knowledge-loader-v2.js");
    return findAgentByNameV2(name);
  }

  // Original V1 implementation
  const kb = knowledge || (await getCachedKnowledge());
  const normalizedSearch = name.toLowerCase().trim();

  // First try exact match
  const exactMatch = kb.agents.find((agent) => agent.name.toLowerCase() === normalizedSearch);
  if (exactMatch) {
    return exactMatch;
  }

  // Then try partial match
  const partialMatch = kb.agents.find((agent) =>
    agent.name.toLowerCase().includes(normalizedSearch),
  );

  return partialMatch || null;
}

/**
 * Get list of all agent names
 *
 * @param knowledge - Knowledge base to query (defaults to cached knowledge)
 * @returns Array of agent names
 */
export async function listAgentNames(knowledge?: TulsbotKnowledge): Promise<string[]> {
  // Use optimized V2 if enabled (much faster - no file reads)
  if (process.env.TULSBOT_USE_INDEXED_KNOWLEDGE === "true") {
    const { listAgentNames: listAgentNamesV2 } = await import("./knowledge-loader-v2.js");
    return listAgentNamesV2();
  }

  // Original V1 implementation
  const kb = knowledge || (await getCachedKnowledge());
  return kb.agents.map((agent) => agent.name);
}
