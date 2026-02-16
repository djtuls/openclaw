import { randomUUID } from "node:crypto";
import type { OpenClawConfig } from "../config/config.js";
import type { AcpSession } from "./types.js";
import { resolveSessionAgentId } from "../agents/agent-scope.js";
import { getCachedKnowledge } from "../agents/tulsbot/knowledge-loader.js";
import { getMemorySearchManager } from "../memory/index.js";

export type AcpSessionStore = {
  createSession: (params: {
    sessionKey: string;
    cwd: string;
    sessionId?: string;
    config?: OpenClawConfig;
  }) => Promise<AcpSession>;
  getSession: (sessionId: string) => AcpSession | undefined;
  getSessionByRunId: (runId: string) => AcpSession | undefined;
  setActiveRun: (sessionId: string, runId: string, abortController: AbortController) => void;
  clearActiveRun: (sessionId: string) => void;
  cancelActiveRun: (sessionId: string) => boolean;
  clearAllSessionsForTest: () => void;
};

export function createInMemorySessionStore(): AcpSessionStore {
  const sessions = new Map<string, AcpSession>();
  const runIdToSessionId = new Map<string, string>();

  const createSession: AcpSessionStore["createSession"] = async (params) => {
    const sessionId = params.sessionId ?? randomUUID();
    const session: AcpSession = {
      sessionId,
      sessionKey: params.sessionKey,
      cwd: params.cwd,
      createdAt: Date.now(),
      abortController: null,
      activeRunId: null,
    };

    // Special initialization for Tulsbot sessions
    if (params.sessionKey.startsWith("agent:tulsbot:") && params.config) {
      try {
        // Load Tulsbot knowledge base (17 sub-agents)
        const knowledge = await getCachedKnowledge();

        // Query memory for Tulsbot capabilities and context
        const agentId = resolveSessionAgentId({
          sessionKey: params.sessionKey,
          config: params.config,
        });

        // Resolve namespace from agent config (config-driven approach)
        const agentConfig = params.config.agents?.list?.find((a) => a.id === agentId);
        const namespace = agentConfig?.memorySearch?.namespace ?? "tulsbot";

        const { manager } = await getMemorySearchManager({
          cfg: params.config,
          agentId,
        });

        let memoryContext: any = null;
        if (manager) {
          try {
            const results = await manager.search("tulsbot capabilities and sub-agent roster", {
              maxResults: 10,
              namespace,
            });
            memoryContext = results;
          } catch (err) {
            // Memory query failed - continue without memory context
            console.warn("Failed to query Tulsbot memory context:", err);
          }
        }

        // Populate session with Tulsbot context
        session.systemContext = {
          knowledgeBase: knowledge,
          memoryContext,
          subAgentRoster: knowledge.agents,
        };

        session.metadata = {
          activeSubAgent: "Orchestrator", // Default to Orchestrator
          knowledgeVersion: knowledge.version,
          workingMemory: [],
        };
      } catch (err) {
        // Knowledge loading failed - continue with basic session
        console.error("Failed to initialize Tulsbot session context:", err);
      }
    }

    sessions.set(sessionId, session);
    return session;
  };

  const getSession: AcpSessionStore["getSession"] = (sessionId) => sessions.get(sessionId);

  const getSessionByRunId: AcpSessionStore["getSessionByRunId"] = (runId) => {
    const sessionId = runIdToSessionId.get(runId);
    return sessionId ? sessions.get(sessionId) : undefined;
  };

  const setActiveRun: AcpSessionStore["setActiveRun"] = (sessionId, runId, abortController) => {
    const session = sessions.get(sessionId);
    if (!session) {
      return;
    }
    session.activeRunId = runId;
    session.abortController = abortController;
    runIdToSessionId.set(runId, sessionId);
  };

  const clearActiveRun: AcpSessionStore["clearActiveRun"] = (sessionId) => {
    const session = sessions.get(sessionId);
    if (!session) {
      return;
    }
    if (session.activeRunId) {
      runIdToSessionId.delete(session.activeRunId);
    }
    session.activeRunId = null;
    session.abortController = null;
  };

  const cancelActiveRun: AcpSessionStore["cancelActiveRun"] = (sessionId) => {
    const session = sessions.get(sessionId);
    if (!session?.abortController) {
      return false;
    }
    session.abortController.abort();
    if (session.activeRunId) {
      runIdToSessionId.delete(session.activeRunId);
    }
    session.abortController = null;
    session.activeRunId = null;
    return true;
  };

  const clearAllSessionsForTest: AcpSessionStore["clearAllSessionsForTest"] = () => {
    for (const session of sessions.values()) {
      session.abortController?.abort();
    }
    sessions.clear();
    runIdToSessionId.clear();
  };

  return {
    createSession,
    getSession,
    getSessionByRunId,
    setActiveRun,
    clearActiveRun,
    cancelActiveRun,
    clearAllSessionsForTest,
  };
}

export const defaultAcpSessionStore = createInMemorySessionStore();
