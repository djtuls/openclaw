import { Type } from "@sinclair/typebox";
import type { OpenClawConfig } from "../../config/config.js";
import type { AnyAgentTool } from "../tools/common.js";
import { getMemorySearchManager } from "../../memory/index.js";
import { resolveSessionAgentId } from "../agent-scope.js";
import { readStringParam, jsonResult, ToolInputError } from "../tools/common.js";
import { getCachedKnowledge, type TulsbotSubAgent } from "./knowledge-loader.js";

/**
 * Input schema for tulsbot_delegate tool
 */
const TulsbotDelegateSchema = Type.Object({
  userMessage: Type.String({
    description: "The user message to analyze and route to appropriate sub-agent",
  }),
  context: Type.Optional(
    Type.Object({
      conversationHistory: Type.Optional(Type.String()),
      activeSubAgent: Type.Optional(Type.String()),
      metadata: Type.Optional(Type.Any()),
    }),
  ),
});

/**
 * Intent classification result from analysis
 */
interface IntentAnalysis {
  primaryIntent: string;
  keywords: string[];
  domains: string[];
  confidence: number;
  historicalAgents?: string[]; // Agents that handled similar queries in the past
}

/**
 * Result from executing a specialized sub-agent
 */
interface SubAgentResult {
  subAgent: string;
  response: string;
  reasoning?: string;
  /** Context to preserve for potential handoff to another agent */
  handoffContext?: Record<string, unknown>;
  /** Suggestion for routing to a different specialized agent */
  suggestedHandoff?: {
    targetAgent: string;
    reason: string;
    priority: number; // 1-10, higher = more urgent
  };
}

/**
 * Represents a handoff between sub-agents for complex multi-step queries
 */
interface AgentHandoff {
  sourceAgent: string;
  targetAgent: string;
  context: Record<string, unknown>;
  originalMessage: string;
  partialResult?: string;
  timestamp: number;
}

/**
 * Analyze user intent from message using keyword matching and memory search
 *
 * This function performs intent classification to determine which sub-agent
 * should handle the user's request. It uses:
 * 1. Keyword extraction from the message
 * 2. Memory search to find similar past queries
 * 3. Domain classification based on content
 */
async function analyzeIntent(
  message: string,
  options: {
    config?: OpenClawConfig;
    agentId?: string;
    sessionKey?: string;
  },
): Promise<IntentAnalysis> {
  const normalizedMessage = message.toLowerCase();

  // Extract keywords (split on whitespace and strip punctuation)
  const words = normalizedMessage
    .split(/\s+/)
    .map((w) => w.replace(/[^\w]/g, "")) // Remove punctuation
    .filter((w) => w.length > 0); // Remove empty strings
  const keywords = words.filter((w) => w.length > 3); // Filter short words

  // Domain classification keywords
  const domainKeywords = {
    research: ["research", "find", "search", "lookup", "investigate"],
    coding: ["code", "function", "implement", "debug", "test", "api", "bug"],
    notion: ["notion", "database", "page", "property", "sync"],
    memory: ["remember", "recall", "history", "past", "previous"],
    planning: ["plan", "organize", "schedule", "task", "project"],
    analysis: ["analyze", "examine", "review", "evaluate", "assess"],
  };

  // Classify domains
  const domains: string[] = [];
  for (const [domain, domainWords] of Object.entries(domainKeywords)) {
    if (domainWords.some((kw) => words.includes(kw))) {
      domains.push(domain);
    }
  }

  // Use memory search to find similar queries for improved routing
  let memoryBoost = 0;
  let historicalAgents: string[] = [];
  if (options.config && options.agentId) {
    try {
      const { manager } = await getMemorySearchManager({
        cfg: options.config,
        agentId: options.agentId,
      });

      if (manager) {
        const similarQueries = await manager.search(message, {
          maxResults: 5,
          minScore: 0.7,
          sessionKey: options.sessionKey,
        });

        // Extract agent names from historical context to learn from past routing decisions
        const agentPattern =
          /(research|coding|notion|memory|planning|analysis|cryptocurrency|social|email|calendar|document|translation|image|audio|task|security|integration)_agent/gi;

        for (const result of similarQueries) {
          const matches = result.text.matchAll(agentPattern);
          for (const match of matches) {
            const agentDomain = match[1].toLowerCase();
            if (!historicalAgents.includes(agentDomain)) {
              historicalAgents.push(agentDomain);
            }
          }
        }

        // Boost confidence based on both similarity score and historical patterns
        if (similarQueries.length > 0) {
          const avgScore =
            similarQueries.reduce((sum, r) => sum + r.score, 0) / similarQueries.length;
          memoryBoost = Math.min(0.2, avgScore * 0.2);

          // Additional boost if historical agents align with detected domains
          if (historicalAgents.length > 0) {
            const alignment = domains.some((d) => historicalAgents.includes(d));
            if (alignment) {
              memoryBoost += 0.1; // +10% for historical alignment
            }
          }
        }
      }
    } catch {
      // Memory search failures shouldn't block intent analysis
      // Falls back to keyword-only classification
    }
  }

  // Calculate confidence based on domain matches and memory context
  const baseConfidence = domains.length > 0 ? 0.4 + domains.length * 0.2 : 0.3;
  const confidence = Math.min(0.9, baseConfidence + memoryBoost);

  return {
    primaryIntent: domains[0] || "general",
    keywords,
    domains,
    confidence,
    historicalAgents: historicalAgents.length > 0 ? historicalAgents : undefined,
  };
}

/**
 * Match intent to the most appropriate sub-agent
 *
 * Uses the intent analysis to select from Tulsbot's 17 sub-agents.
 * Falls back to "Orchestrator" when intent is unclear.
 */
function matchToSubAgent(intent: IntentAnalysis, agents: TulsbotSubAgent[]): TulsbotSubAgent {
  // Prioritize agents from historical patterns if available
  if (intent.historicalAgents && intent.historicalAgents.length > 0) {
    for (const historicalDomain of intent.historicalAgents) {
      for (const agent of agents) {
        const agentName = agent.name.toLowerCase();

        // Match historical domain patterns to agent names
        if (historicalDomain === "research" && agentName.includes("tulscodex")) {
          return agent;
        }
        if (historicalDomain === "coding" && agentName.includes("tulscodex")) {
          return agent;
        }
        if (historicalDomain === "notion" && agentName.includes("knowledge manager")) {
          return agent;
        }
        if (historicalDomain === "memory" && agentName.includes("memory")) {
          return agent;
        }
        if (
          historicalDomain === "planning" &&
          (agentName.includes("pm") || agentName.includes("project"))
        ) {
          return agent;
        }
        if (historicalDomain === "analysis" && agentName.includes("analyst")) {
          return agent;
        }
      }
    }
  }

  // Try to match by agent capabilities or name
  for (const agent of agents) {
    const agentName = agent.name.toLowerCase();

    // Match domain to agent specialty
    if (intent.domains.length > 0) {
      const primaryDomain = intent.domains[0];

      // Research-related → TulsCodex (multi-step research via Assistants API)
      if (primaryDomain === "research" && agentName.includes("tulscodex")) {
        return agent;
      }

      // Coding-related → TulsCodex (code review capability)
      if (primaryDomain === "coding" && agentName.includes("tulscodex")) {
        return agent;
      }

      // Notion-related → Knowledge Manager (Notion AI queries)
      if (primaryDomain === "notion" && agentName.includes("knowledge manager")) {
        return agent;
      }

      // Memory-related → Memory Heartbeat
      if (primaryDomain === "memory" && agentName.includes("memory")) {
        return agent;
      }

      // Planning-related → PM Specialist
      if (
        primaryDomain === "planning" &&
        (agentName.includes("pm") || agentName.includes("project"))
      ) {
        return agent;
      }

      // Analysis-related → Intelligence Router
      if (primaryDomain === "analysis" && agentName.includes("intelligence")) {
        return agent;
      }
    }

    // Match by agent triggers if available (only when no domain classification exists)
    if (intent.domains.length === 0 && agent.triggers && intent.keywords.length > 0) {
      const triggerMatch = agent.triggers.some((trigger) =>
        intent.keywords.some((kw) => trigger.toLowerCase().includes(kw)),
      );
      if (triggerMatch) {
        return agent;
      }
    }
  }

  // Default to Orchestrator (should be first agent in knowledge base)
  const orchestrator = agents.find((a) => a.name.toLowerCase().includes("orchestrator"));
  return orchestrator || agents[0];
}

/**
 * Execute sub-agent logic with domain-specific behaviors
 *
 * Implements execution logic for Tulsbot's 17 sub-agents across 6 primary domains.
 * Each domain has specialized handling based on agent capabilities and system prompt.
 */
async function executeSubAgent(
  agent: TulsbotSubAgent,
  message: string,
  _context?: unknown,
): Promise<SubAgentResult> {
  const agentName = agent.name.toLowerCase();

  // Extract system prompt guidance
  const systemGuidance = agent.systemPrompt || "";
  const capabilities = agent.capabilities || [];
  const description = (agent.description || "").toLowerCase();

  // Domain-specific execution logic
  // Research Domain (TulsCodex)
  // Handle agents with research capability OR TulsCodex by name/description (fallback when capabilities are null)
  const isResearchAgent =
    capabilities.some((c) => c.toLowerCase().includes("research")) ||
    (agentName.includes("tulscodex") && description.includes("research"));

  if (agentName.includes("tulscodex") && isResearchAgent) {
    // Detect sequential workflow keywords that suggest handoff to coding
    const sequentialKeywords = ["then", "after", "next", "implement", "write", "code"];
    const hasSequentialPattern = sequentialKeywords.some((kw) =>
      message.toLowerCase().includes(kw),
    );
    const hasCodingIntent = ["implement", "write", "code", "develop", "create"].some((kw) =>
      message.toLowerCase().includes(kw),
    );

    const result: SubAgentResult = {
      subAgent: agent.name,
      response: `[Research Agent] I'll use multi-step research via the Assistants API to investigate: "${message.slice(0, 80)}${message.length > 80 ? "..." : ""}"\n\nCapabilities: ${capabilities.join(", ")}\n\nNext: Initiating web search and documentation lookup...`,
      reasoning: `TulsCodex selected for research domain. Using Assistants API for iterative information gathering.`,
    };

    // Suggest handoff to coding agent if sequential coding pattern detected
    if (hasSequentialPattern && hasCodingIntent) {
      result.suggestedHandoff = {
        targetAgent: "TulsCodex", // Same agent, different capability mode
        reason:
          "Sequential workflow detected: research phase complete, coding implementation required",
        priority: 8,
      };
      result.handoffContext = {
        researchComplete: true,
        originalQuery: message,
        nextPhase: "coding",
      };
    }

    return result;
  }

  // Coding Domain (TulsCodex)
  if (
    agentName.includes("tulscodex") &&
    capabilities.some((c) => c.toLowerCase().includes("code"))
  ) {
    return {
      subAgent: agent.name,
      response: `[Coding Agent] I'll analyze and assist with: "${message.slice(0, 80)}${message.length > 80 ? "..." : ""}"\n\nCode review capabilities: ${capabilities.filter((c) => c.toLowerCase().includes("code")).join(", ")}\n\nNext: Examining code structure and generating implementation...`,
      reasoning: `TulsCodex selected for coding domain. Using code review and generation capabilities.`,
    };
  }

  // Notion Domain (Knowledge Manager)
  if (
    agentName.includes("knowledge manager") ||
    capabilities.some((c) => c.toLowerCase().includes("notion"))
  ) {
    return {
      subAgent: agent.name,
      response: `[Notion Agent] I'll query your Notion workspace for: "${message.slice(0, 80)}${message.length > 80 ? "..." : ""}"\n\nWorkspace capabilities: ${capabilities.join(", ")}\n\nNext: Executing Notion AI query and database search...`,
      reasoning: `Knowledge Manager selected for Notion domain. Using Notion AI integration for workspace queries.`,
    };
  }

  // Memory Domain (Memory Heartbeat)
  if (
    agentName.includes("memory") &&
    capabilities.some(
      (c) => c.toLowerCase().includes("recall") || c.toLowerCase().includes("remember"),
    )
  ) {
    return {
      subAgent: agent.name,
      response: `[Memory Agent] I'll search memory for: "${message.slice(0, 80)}${message.length > 80 ? "..." : ""}"\n\nMemory capabilities: ${capabilities.join(", ")}\n\nNext: Retrieving relevant context from knowledge base...`,
      reasoning: `Memory Heartbeat selected for memory domain. Using context retrieval and knowledge search.`,
    };
  }

  // Planning Domain (PM Specialist)
  if (
    (agentName.includes("pm") || agentName.includes("project")) &&
    capabilities.some(
      (c) => c.toLowerCase().includes("plan") || c.toLowerCase().includes("organize"),
    )
  ) {
    return {
      subAgent: agent.name,
      response: `[Planning Agent] I'll create a plan for: "${message.slice(0, 80)}${message.length > 80 ? "..." : ""}"\n\nPlanning capabilities: ${capabilities.join(", ")}\n\nNext: Breaking down into actionable tasks and creating roadmap...`,
      reasoning: `PM Specialist selected for planning domain. Using task breakdown and roadmap creation.`,
    };
  }

  // Analysis Domain (Intelligence Router)
  if (
    agentName.includes("intelligence") &&
    capabilities.some((c) => c.toLowerCase().includes("analy"))
  ) {
    return {
      subAgent: agent.name,
      response: `[Analysis Agent] I'll analyze: "${message.slice(0, 80)}${message.length > 80 ? "..." : ""}"\n\nAnalysis capabilities: ${capabilities.join(", ")}\n\nNext: Processing data and identifying patterns...`,
      reasoning: `Intelligence Router selected for analysis domain. Using data processing and pattern recognition.`,
    };
  }

  // Cryptocurrency Domain
  if (
    (agentName.includes("crypto") || agentName.includes("currency")) &&
    capabilities.some(
      (c) =>
        c.toLowerCase().includes("crypto") ||
        c.toLowerCase().includes("blockchain") ||
        c.toLowerCase().includes("price"),
    )
  ) {
    return {
      subAgent: agent.name,
      response: `[Cryptocurrency Agent] I'll track and analyze: "${message.slice(0, 80)}${message.length > 80 ? "..." : ""}"\n\nCrypto capabilities: ${capabilities.join(", ")}\n\nNext: Querying price feeds and blockchain data...`,
      reasoning: `Cryptocurrency Agent selected. Using price tracking and portfolio analysis.`,
    };
  }

  // Social Media Domain
  if (
    (agentName.includes("social") || agentName.includes("media")) &&
    capabilities.some(
      (c) =>
        c.toLowerCase().includes("social") ||
        c.toLowerCase().includes("post") ||
        c.toLowerCase().includes("tweet"),
    )
  ) {
    return {
      subAgent: agent.name,
      response: `[Social Media Agent] I'll manage social presence for: "${message.slice(0, 80)}${message.length > 80 ? "..." : ""}"\n\nSocial capabilities: ${capabilities.join(", ")}\n\nNext: Preparing content scheduling and analytics...`,
      reasoning: `Social Media Agent selected. Using post scheduling and analytics capabilities.`,
    };
  }

  // Email Domain
  if (
    agentName.includes("email") &&
    capabilities.some(
      (c) =>
        c.toLowerCase().includes("email") ||
        c.toLowerCase().includes("draft") ||
        c.toLowerCase().includes("inbox"),
    )
  ) {
    return {
      subAgent: agent.name,
      response: `[Email Agent] I'll handle email for: "${message.slice(0, 80)}${message.length > 80 ? "..." : ""}"\n\nEmail capabilities: ${capabilities.join(", ")}\n\nNext: Drafting response and categorizing messages...`,
      reasoning: `Email Agent selected. Using drafting, categorization, and auto-response capabilities.`,
    };
  }

  // Calendar Domain
  if (
    agentName.includes("calendar") &&
    capabilities.some(
      (c) =>
        c.toLowerCase().includes("calendar") ||
        c.toLowerCase().includes("schedule") ||
        c.toLowerCase().includes("meeting"),
    )
  ) {
    return {
      subAgent: agent.name,
      response: `[Calendar Agent] I'll schedule: "${message.slice(0, 80)}${message.length > 80 ? "..." : ""}"\n\nCalendar capabilities: ${capabilities.join(", ")}\n\nNext: Checking availability and resolving conflicts...`,
      reasoning: `Calendar Agent selected. Using meeting scheduling and conflict resolution.`,
    };
  }

  // Document Domain
  if (
    agentName.includes("document") &&
    capabilities.some(
      (c) =>
        c.toLowerCase().includes("document") ||
        c.toLowerCase().includes("pdf") ||
        c.toLowerCase().includes("word"),
    )
  ) {
    return {
      subAgent: agent.name,
      response: `[Document Agent] I'll process document: "${message.slice(0, 80)}${message.length > 80 ? "..." : ""}"\n\nDocument capabilities: ${capabilities.join(", ")}\n\nNext: Extracting content and generating summary...`,
      reasoning: `Document Agent selected. Using PDF/Word processing and summarization.`,
    };
  }

  // Translation Domain
  if (
    agentName.includes("translation") ||
    (agentName.includes("translate") &&
      capabilities.some(
        (c) => c.toLowerCase().includes("translat") || c.toLowerCase().includes("language"),
      ))
  ) {
    return {
      subAgent: agent.name,
      response: `[Translation Agent] I'll translate: "${message.slice(0, 80)}${message.length > 80 ? "..." : ""}"\n\nTranslation capabilities: ${capabilities.join(", ")}\n\nNext: Detecting source language and translating...`,
      reasoning: `Translation Agent selected. Using multi-language translation capabilities.`,
    };
  }

  // Image Domain
  if (
    agentName.includes("image") &&
    capabilities.some(
      (c) =>
        c.toLowerCase().includes("image") ||
        c.toLowerCase().includes("ocr") ||
        c.toLowerCase().includes("visual"),
    )
  ) {
    return {
      subAgent: agent.name,
      response: `[Image Agent] I'll analyze image for: "${message.slice(0, 80)}${message.length > 80 ? "..." : ""}"\n\nImage capabilities: ${capabilities.join(", ")}\n\nNext: Running OCR and visual analysis...`,
      reasoning: `Image Agent selected. Using OCR and visual analysis capabilities.`,
    };
  }

  // Audio Domain
  if (
    agentName.includes("audio") &&
    capabilities.some(
      (c) =>
        c.toLowerCase().includes("audio") ||
        c.toLowerCase().includes("transcri") ||
        c.toLowerCase().includes("voice"),
    )
  ) {
    return {
      subAgent: agent.name,
      response: `[Audio Agent] I'll process audio for: "${message.slice(0, 80)}${message.length > 80 ? "..." : ""}"\n\nAudio capabilities: ${capabilities.join(", ")}\n\nNext: Transcribing and analyzing audio content...`,
      reasoning: `Audio Agent selected. Using transcription and voice command capabilities.`,
    };
  }

  // Task Management Domain
  if (
    (agentName.includes("task") || agentName.includes("todo")) &&
    capabilities.some(
      (c) =>
        c.toLowerCase().includes("task") ||
        c.toLowerCase().includes("todo") ||
        c.toLowerCase().includes("reminder"),
    )
  ) {
    return {
      subAgent: agent.name,
      response: `[Task Management Agent] I'll manage tasks for: "${message.slice(0, 80)}${message.length > 80 ? "..." : ""}"\n\nTask capabilities: ${capabilities.join(", ")}\n\nNext: Creating tasks and setting reminders...`,
      reasoning: `Task Management Agent selected. Using todo tracking and reminder capabilities.`,
    };
  }

  // Security Domain
  if (
    agentName.includes("security") &&
    capabilities.some(
      (c) =>
        c.toLowerCase().includes("security") ||
        c.toLowerCase().includes("vulnerab") ||
        c.toLowerCase().includes("audit"),
    )
  ) {
    return {
      subAgent: agent.name,
      response: `[Security Agent] I'll audit security for: "${message.slice(0, 80)}${message.length > 80 ? "..." : ""}"\n\nSecurity capabilities: ${capabilities.join(", ")}\n\nNext: Scanning for vulnerabilities and reviewing audit logs...`,
      reasoning: `Security Agent selected. Using vulnerability scanning and audit capabilities.`,
    };
  }

  // Integration Domain
  if (
    agentName.includes("integration") &&
    capabilities.some(
      (c) =>
        c.toLowerCase().includes("integration") ||
        c.toLowerCase().includes("api") ||
        c.toLowerCase().includes("webhook"),
    )
  ) {
    return {
      subAgent: agent.name,
      response: `[Integration Agent] I'll orchestrate integration for: "${message.slice(0, 80)}${message.length > 80 ? "..." : ""}"\n\nIntegration capabilities: ${capabilities.join(", ")}\n\nNext: Connecting third-party APIs and configuring webhooks...`,
      reasoning: `Integration Agent selected. Using third-party API orchestration capabilities.`,
    };
  }

  // Fallback for Orchestrator or unmatched agents
  return {
    subAgent: agent.name,
    response: `[${agent.name}] Delegated to handle: "${message.slice(0, 100)}${message.length > 100 ? "..." : ""}"\n\nAgent capabilities: ${capabilities.join(", ") || "general orchestration"}\n\nSystem guidance: ${systemGuidance.slice(0, 200)}${systemGuidance.length > 200 ? "..." : ""}`,
    reasoning: `Selected ${agent.name} as orchestrator or specialized handler. Capabilities: ${capabilities.join(", ") || "general"}`,
  };
}

/**
 * Process agent handoff when suggested by sub-agent execution
 *
 * @param handoff - Handoff configuration from suggestedHandoff
 * @param originalMessage - Original user message
 * @param context - Preserved context from source agent
 * @param agents - Available sub-agents
 * @returns Result from target agent execution
 */
async function processHandoff(
  handoff: { targetAgent: string; reason: string; priority: number },
  originalMessage: string,
  context: Record<string, unknown> | undefined,
  agents: TulsbotSubAgent[],
): Promise<SubAgentResult> {
  const targetAgent = agents.find((a) =>
    a.name.toLowerCase().includes(handoff.targetAgent.toLowerCase()),
  );

  if (!targetAgent) {
    return {
      subAgent: "handoff-failed",
      response: `Handoff failed: Target agent '${handoff.targetAgent}' not found. Available agents: ${agents.map((a) => a.name).join(", ")}`,
      reasoning: `Handoff to ${handoff.targetAgent} failed - agent not found`,
    };
  }

  // Execute target agent with preserved context
  const handoffContext = {
    ...context,
    handoffReason: handoff.reason,
    handoffPriority: handoff.priority,
    handoffTimestamp: Date.now(),
  };

  return executeSubAgent(targetAgent, originalMessage, handoffContext);
}

/**
 * Create the tulsbot_delegate tool for routing to sub-agents
 *
 * This tool analyzes user intent and routes to the appropriate sub-agent
 * from Tulsbot's 17-agent roster.
 */
export function createTulsbotDelegateTool(options: {
  config?: OpenClawConfig;
  agentSessionKey?: string;
}): AnyAgentTool | null {
  const cfg = options.config;
  if (!cfg) {
    return null;
  }

  const agentId = resolveSessionAgentId({
    sessionKey: options.agentSessionKey,
    config: cfg,
  });

  // Only provide this tool for Tulsbot sessions
  if (!options.agentSessionKey?.includes("tulsbot")) {
    return null;
  }

  return {
    label: "Tulsbot Delegate",
    name: "tulsbot_delegate",
    description:
      "Routes user request to the appropriate Tulsbot sub-agent (1 of 17 specialists) based on intent analysis. Use this when handling Tulsbot queries that require specialized knowledge or capabilities.",
    parameters: TulsbotDelegateSchema,
    execute: async (_toolCallId, params) => {
      try {
        const userMessage = readStringParam(params, "userMessage", { required: true });
        const context = params.context as Record<string, unknown> | undefined;

        // Load knowledge base (cached after first load)
        const knowledge = await getCachedKnowledge();

        // 1. Analyze intent
        const intent = await analyzeIntent(userMessage, {
          config: cfg,
          agentId,
          sessionKey: options.agentSessionKey,
        });

        // 2. Match to sub-agent
        const selectedAgent = matchToSubAgent(intent, knowledge.agents);

        // 3. Execute sub-agent logic
        let result = await executeSubAgent(selectedAgent, userMessage, context);

        // 4. Process handoff if suggested (max 2 handoffs to prevent loops)
        let handoffCount = 0;
        const maxHandoffs = 2;
        const handoffHistory: AgentHandoff[] = [];

        while (result.suggestedHandoff && handoffCount < maxHandoffs) {
          // Record handoff
          const handoff: AgentHandoff = {
            sourceAgent: result.subAgent,
            targetAgent: result.suggestedHandoff.targetAgent,
            context: {
              ...result.handoffContext,
              handoffReason: result.suggestedHandoff.reason,
              handoffPriority: result.suggestedHandoff.priority,
              handoffTimestamp: Date.now(),
            },
            originalMessage: userMessage,
            partialResult: result.response,
            timestamp: Date.now(),
          };
          handoffHistory.push(handoff);

          // Execute handoff
          result = await processHandoff(
            result.suggestedHandoff,
            userMessage,
            result.handoffContext || context,
            knowledge.agents,
          );

          handoffCount++;
        }

        return jsonResult({
          success: true,
          subAgent: result.subAgent,
          response: result.response,
          reasoning: result.reasoning,
          intent: {
            primaryIntent: intent.primaryIntent,
            domains: intent.domains,
            confidence: intent.confidence,
            historicalAgents: intent.historicalAgents,
          },
          handoffs: handoffHistory.length > 0 ? handoffHistory : undefined,
          handoffCount,
        });
      } catch (err) {
        if (err instanceof ToolInputError) {
          return jsonResult({ error: err.message });
        }
        const message = err instanceof Error ? err.message : String(err);
        return jsonResult({
          error: `Delegation failed: ${message}`,
          success: false,
        });
      }
    },
  };
}
