import type { GatewayBrowserClient } from "../gateway.ts";
import type { ChatEventPayload } from "./chat.ts";
import { extractText } from "../chat/message-extract.ts";
import { generateUUID } from "../uuid.ts";

export const TULSBOT_MAIN_SESSION_KEY = "agent:tulsbot:main";

export type PinnedTulsbotState = {
  client: GatewayBrowserClient | null;
  connected: boolean;
  tulsbotChatLoading: boolean;
  tulsbotChatSending: boolean;
  tulsbotChatDraft: string;
  tulsbotChatMessages: unknown[];
  tulsbotChatRunId: string | null;
  tulsbotChatStream: string | null;
  tulsbotChatStreamStartedAt: number | null;
  tulsbotChatError: string | null;
};

export async function loadPinnedTulsbotChat(state: PinnedTulsbotState, opts?: { limit?: number }) {
  if (!state.client || !state.connected) {
    return;
  }
  state.tulsbotChatLoading = true;
  state.tulsbotChatError = null;
  try {
    const res = await state.client.request<{ messages?: Array<unknown> }>("chat.history", {
      sessionKey: TULSBOT_MAIN_SESSION_KEY,
      limit: opts?.limit ?? 40,
    });
    state.tulsbotChatMessages = Array.isArray(res.messages) ? res.messages : [];
  } catch (err) {
    state.tulsbotChatError = String(err);
  } finally {
    state.tulsbotChatLoading = false;
  }
}

export async function sendPinnedTulsbotMessage(
  state: PinnedTulsbotState,
  messageOverride?: string,
) {
  if (!state.client || !state.connected) {
    return;
  }
  const draft = (messageOverride ?? state.tulsbotChatDraft).trim();
  if (!draft) {
    return;
  }
  if (messageOverride == null) {
    state.tulsbotChatDraft = "";
  }

  const now = Date.now();
  const runId = generateUUID();

  state.tulsbotChatMessages = [
    ...state.tulsbotChatMessages,
    { role: "user", content: [{ type: "text", text: draft }], timestamp: now },
  ];
  state.tulsbotChatSending = true;
  state.tulsbotChatError = null;
  state.tulsbotChatRunId = runId;
  state.tulsbotChatStream = "";
  state.tulsbotChatStreamStartedAt = now;

  try {
    await state.client.request("chat.send", {
      sessionKey: TULSBOT_MAIN_SESSION_KEY,
      message: draft,
      deliver: false,
      idempotencyKey: runId,
    });
  } catch (err) {
    const msg = String(err);
    state.tulsbotChatError = msg;
    state.tulsbotChatRunId = null;
    state.tulsbotChatStream = null;
    state.tulsbotChatStreamStartedAt = null;
    state.tulsbotChatMessages = [
      ...state.tulsbotChatMessages,
      {
        role: "assistant",
        content: [{ type: "text", text: `Error: ${msg}` }],
        timestamp: Date.now(),
      },
    ];
  } finally {
    state.tulsbotChatSending = false;
  }
}

export async function handlePinnedTulsbotChatEvent(
  state: PinnedTulsbotState,
  payload?: ChatEventPayload,
) {
  if (!payload) {
    return;
  }
  if (payload.sessionKey !== TULSBOT_MAIN_SESSION_KEY) {
    return;
  }

  if (payload.state === "delta") {
    const next = extractText(payload.message);
    if (typeof next === "string") {
      const current = state.tulsbotChatStream ?? "";
      if (!current || next.length >= current.length) {
        state.tulsbotChatStream = next;
      }
    }
    return;
  }

  if (payload.state === "final") {
    state.tulsbotChatStream = null;
    state.tulsbotChatRunId = null;
    state.tulsbotChatStreamStartedAt = null;
    await loadPinnedTulsbotChat(state, { limit: 60 });
    return;
  }

  if (payload.state === "aborted") {
    state.tulsbotChatStream = null;
    state.tulsbotChatRunId = null;
    state.tulsbotChatStreamStartedAt = null;
    return;
  }

  if (payload.state === "error") {
    state.tulsbotChatStream = null;
    state.tulsbotChatRunId = null;
    state.tulsbotChatStreamStartedAt = null;
    state.tulsbotChatError = payload.errorMessage ?? "chat error";
  }
}
