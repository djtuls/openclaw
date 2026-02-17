import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect, beforeEach } from "vitest";
import {
  loadTulsbotKnowledge,
  getCachedKnowledge,
  clearCache,
  getCacheMetadata,
  findAgentByName,
  listAgentNames,
} from "./knowledge-loader.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Fixture path — always available, runs in CI and fresh clones
const FIXTURE_PATH = path.join(__dirname, "__fixtures__", "core-app-knowledge.json");

// Use actual knowledge file for integration tests (optional, machine-specific)
const KNOWLEDGE_FILE_PATH =
  "/Users/tulioferro/Backend_local Macbook/Tulsbot/.tulsbot/core-app-knowledge.json";
const knowledgeFileExists = existsSync(KNOWLEDGE_FILE_PATH);

describe("Tulsbot Knowledge Loader (fixture)", () => {
  beforeEach(() => {
    process.env.TULSBOT_KNOWLEDGE_PATH = FIXTURE_PATH;
    delete process.env.TULSBOT_USE_INDEXED_KNOWLEDGE;
    clearCache();
  });

  describe("loadTulsbotKnowledge", () => {
    it("should load and parse the knowledge file successfully", async () => {
      const knowledge = await loadTulsbotKnowledge(FIXTURE_PATH);

      expect(knowledge).toBeDefined();
      expect(knowledge.agents).toBeInstanceOf(Array);
      expect(knowledge.agents.length).toBeGreaterThan(0);
    });

    it("should validate that all agents have required fields", async () => {
      const knowledge = await loadTulsbotKnowledge(FIXTURE_PATH);

      for (const agent of knowledge.agents) {
        expect(agent).toBeDefined();
        expect(typeof agent).toBe("object");
        expect(agent.name).toBeDefined();
        expect(typeof agent.name).toBe("string");
        expect(agent.name.length).toBeGreaterThan(0);
      }
    });

    it("should load all 17 expected sub-agents", async () => {
      const knowledge = await loadTulsbotKnowledge(FIXTURE_PATH);

      expect(knowledge.agents.length).toBe(17);
    });
  });

  describe("getCachedKnowledge", () => {
    it("should cache knowledge after first load", async () => {
      const knowledge1 = await getCachedKnowledge();
      const knowledge2 = await getCachedKnowledge();

      expect(knowledge1).toBe(knowledge2);
    });

    it("should populate cache metadata", async () => {
      await getCachedKnowledge();

      const metadata = getCacheMetadata();
      expect(metadata).toBeDefined();
      expect(metadata?.agentCount).toBeGreaterThan(0);
      expect(metadata?.loadTime).toBeGreaterThan(0);
    });

    it("should force reload when requested", async () => {
      const knowledge1 = await getCachedKnowledge();
      const knowledge2 = await getCachedKnowledge(true);

      expect(knowledge1).not.toBe(knowledge2);
      expect(knowledge1.agents.length).toBe(knowledge2.agents.length);
    });
  });

  describe("clearCache", () => {
    it("should clear cached knowledge", async () => {
      await getCachedKnowledge();
      expect(getCacheMetadata()).toBeDefined();

      clearCache();
      expect(getCacheMetadata()).toBeNull();
    });
  });

  describe("findAgentByName", () => {
    it("should find agent by exact name match", async () => {
      const knowledge = await getCachedKnowledge();
      const firstAgentName = knowledge.agents[0]?.name;

      if (!firstAgentName) {
        throw new Error("No agents in knowledge base");
      }

      const found = await findAgentByName(firstAgentName);
      expect(found).toBeDefined();
      expect(found?.name).toBe(firstAgentName);
    });

    it("should find agent by partial name match (case-insensitive)", async () => {
      const orchestrator = await findAgentByName("orchestrator");
      expect(orchestrator).toBeDefined();
      expect(orchestrator?.name.toLowerCase()).toContain("orchestrator");
    });

    it("should return null for non-existent agent", async () => {
      const found = await findAgentByName("NonExistentAgent12345");
      expect(found).toBeNull();
    });
  });

  describe("listAgentNames", () => {
    it("should return list of all agent names", async () => {
      const names = await listAgentNames();

      expect(names).toBeInstanceOf(Array);
      expect(names.length).toBeGreaterThan(0);
      expect(names.every((name) => typeof name === "string")).toBe(true);
      expect(names.every((name) => name.length > 0)).toBe(true);
    });

    it("should include expected agent types", async () => {
      const names = await listAgentNames();
      const joinedNames = names.join(" ").toLowerCase();

      expect(joinedNames).toContain("orchestrator");
    });
  });
});

describe.skipIf(!knowledgeFileExists)("Tulsbot Knowledge Loader (integration)", () => {
  beforeEach(() => {
    process.env.TULSBOT_KNOWLEDGE_PATH = KNOWLEDGE_FILE_PATH;
    delete process.env.TULSBOT_USE_INDEXED_KNOWLEDGE;
    clearCache();
  });

  describe("loadTulsbotKnowledge", () => {
    it("should load and parse the knowledge file successfully", async () => {
      const knowledge = await loadTulsbotKnowledge(KNOWLEDGE_FILE_PATH);

      expect(knowledge).toBeDefined();
      expect(knowledge.agents).toBeInstanceOf(Array);
      expect(knowledge.agents.length).toBeGreaterThan(0);
    });

    it("should validate that all agents have required fields", async () => {
      const knowledge = await loadTulsbotKnowledge(KNOWLEDGE_FILE_PATH);

      for (const agent of knowledge.agents) {
        expect(agent).toBeDefined();
        expect(typeof agent).toBe("object");
        expect(agent.name).toBeDefined();
        expect(typeof agent.name).toBe("string");
        expect(agent.name.length).toBeGreaterThan(0);
      }
    });

    it("should load all 17 expected sub-agents", async () => {
      const knowledge = await loadTulsbotKnowledge(KNOWLEDGE_FILE_PATH);

      // According to plan, Tulsbot has 17 specialized sub-agents
      expect(knowledge.agents.length).toBe(17);
    });
  });

  describe("getCachedKnowledge", () => {
    it("should cache knowledge after first load", async () => {
      const knowledge1 = await getCachedKnowledge();
      const knowledge2 = await getCachedKnowledge();

      // Should return the same cached instance
      expect(knowledge1).toBe(knowledge2);
    });

    it("should populate cache metadata", async () => {
      await getCachedKnowledge();

      const metadata = getCacheMetadata();
      expect(metadata).toBeDefined();
      expect(metadata?.agentCount).toBeGreaterThan(0);
      expect(metadata?.loadTime).toBeGreaterThan(0);
    });

    it("should force reload when requested", async () => {
      const knowledge1 = await getCachedKnowledge();
      const knowledge2 = await getCachedKnowledge(true);

      // Should be different instances after forced reload
      expect(knowledge1).not.toBe(knowledge2);
      // But should have same content
      expect(knowledge1.agents.length).toBe(knowledge2.agents.length);
    });
  });

  describe("clearCache", () => {
    it("should clear cached knowledge", async () => {
      await getCachedKnowledge();
      expect(getCacheMetadata()).toBeDefined();

      clearCache();
      expect(getCacheMetadata()).toBeNull();
    });
  });

  describe("findAgentByName", () => {
    it("should find agent by exact name match", async () => {
      const knowledge = await getCachedKnowledge();
      const firstAgentName = knowledge.agents[0]?.name;

      if (!firstAgentName) {
        throw new Error("No agents in knowledge base");
      }

      const found = await findAgentByName(firstAgentName);
      expect(found).toBeDefined();
      expect(found?.name).toBe(firstAgentName);
    });

    it("should find agent by partial name match (case-insensitive)", async () => {
      const _knowledge = await getCachedKnowledge();

      // Find Orchestrator agent (should be first based on plan)
      const orchestrator = await findAgentByName("orchestrator");
      expect(orchestrator).toBeDefined();
      expect(orchestrator?.name.toLowerCase()).toContain("orchestrator");
    });

    it("should return null for non-existent agent", async () => {
      const found = await findAgentByName("NonExistentAgent12345");
      expect(found).toBeNull();
    });
  });

  describe("listAgentNames", () => {
    it("should return list of all agent names", async () => {
      const names = await listAgentNames();

      expect(names).toBeInstanceOf(Array);
      expect(names.length).toBeGreaterThan(0);
      expect(names.every((name) => typeof name === "string")).toBe(true);
      expect(names.every((name) => name.length > 0)).toBe(true);
    });

    it("should include expected agent types", async () => {
      const names = await listAgentNames();
      const joinedNames = names.join(" ").toLowerCase();

      // Based on plan, should include Orchestrator and other specialists
      expect(joinedNames).toContain("orchestrator");
    });
  });
});
