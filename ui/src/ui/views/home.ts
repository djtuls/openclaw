import { html, nothing } from "lit";
import type { GatewayHelloOk } from "../gateway.ts";
import type { Tab } from "../navigation.ts";
import type { UiSettings } from "../storage.ts";
import { extractTextCached } from "../chat/message-extract.ts";
import { formatDurationHuman, formatRelativeTimestamp } from "../format.ts";

type Snapshot = {
  uptimeMs?: number;
  policy?: { tickIntervalMs?: number };
};

export type HomeProps = {
  connected: boolean;
  hello: GatewayHelloOk | null;
  settings: UiSettings;
  lastError: string | null;
  lastChannelsRefresh: number | null;
  presenceCount: number;
  sessionsCount: number | null;
  cronEnabled: boolean | null;
  cronNext: number | null;
  // Pinned Tulsbot chat
  tulsbotLoading: boolean;
  tulsbotSending: boolean;
  tulsbotDraft: string;
  tulsbotMessages: unknown[];
  tulsbotStream: string | null;
  tulsbotError: string | null;
  onConnect: () => void;
  onRefresh: () => void;
  onNavigate: (tab: Tab) => void;
  onOpenTulsbotChatTab: () => void;
  onTulsbotDraftChange: (next: string) => void;
  onSendTulsbot: (messageOverride?: string) => void;
};

function renderQuickLink(props: { label: string; detail: string; onClick: () => void }) {
  return html`
    <button class="card stat-card" @click=${props.onClick} style="text-align: left;">
      <div class="stat-label">${props.label}</div>
      <div class="muted">${props.detail}</div>
    </button>
  `;
}

export function renderHome(props: HomeProps) {
  const snapshot = props.hello?.snapshot as Snapshot | undefined;
  const uptime = snapshot?.uptimeMs ? formatDurationHuman(snapshot.uptimeMs) : "n/a";
  const tick = snapshot?.policy?.tickIntervalMs ? `${snapshot.policy.tickIntervalMs}ms` : "n/a";

  const quickLinks: Array<{ tab: Tab; detail: string }> = [
    { tab: "overview", detail: "Gateway access and a fast health read." },
    { tab: "channels", detail: "Link and manage messaging channels." },
    { tab: "sessions", detail: "Inspect active sessions and defaults." },
    { tab: "usage", detail: "Tokens and cost consumption." },
    { tab: "logs", detail: "Live tail of gateway logs." },
    { tab: "config", detail: "Edit ~/.openclaw/openclaw.json safely." },
    { tab: "chat", detail: "Operator chat (quick interventions)." },
  ];

  return html`
    <section class="grid grid-cols-2">
      <div class="card">
        <div class="card-title">Start</div>
        <div class="card-sub">Boot and sync shortcuts for day-to-day use.</div>
        <div class="row" style="margin-top: 14px;">
          <button class="btn" @click=${props.onConnect}>Connect</button>
          <button class="btn" @click=${props.onRefresh}>Refresh</button>
          <span class="muted">
            ${props.connected ? "Connected" : "Disconnected"} · ${props.settings.gatewayUrl}
          </span>
        </div>
        ${
          props.lastError
            ? html`<div class="callout danger" style="margin-top: 14px;">
              <div>${props.lastError}</div>
            </div>`
            : nothing
        }
      </div>

      <div class="card">
        <div class="card-title">Snapshot</div>
        <div class="card-sub">Latest gateway handshake information.</div>
        <div class="stat-grid" style="margin-top: 16px;">
          <div class="stat">
            <div class="stat-label">Status</div>
            <div class="stat-value ${props.connected ? "ok" : "warn"}">
              ${props.connected ? "Connected" : "Disconnected"}
            </div>
          </div>
          <div class="stat">
            <div class="stat-label">Uptime</div>
            <div class="stat-value">${uptime}</div>
          </div>
          <div class="stat">
            <div class="stat-label">Tick Interval</div>
            <div class="stat-value">${tick}</div>
          </div>
          <div class="stat">
            <div class="stat-label">Last Channels Refresh</div>
            <div class="stat-value">
              ${
                props.lastChannelsRefresh
                  ? formatRelativeTimestamp(props.lastChannelsRefresh)
                  : "n/a"
              }
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="card" style="margin-top: 18px;">
      <div class="row" style="justify-content: space-between; align-items: flex-end;">
        <div>
          <div class="card-title">Tulsbot</div>
          <div class="card-sub">Pinned chat panel (session: agent:tulsbot:main).</div>
        </div>
        <div class="row">
          <button class="btn btn--sm" @click=${props.onOpenTulsbotChatTab}>Open chat tab</button>
        </div>
      </div>

      ${
        props.tulsbotError
          ? html`<div class="callout danger" style="margin-top: 12px;">
            <div>${props.tulsbotError}</div>
          </div>`
          : nothing
      }

      <div style="margin-top: 12px; display: grid; gap: 8px;">
        ${(props.tulsbotMessages ?? []).slice(-6).map((msg) => {
          const m = msg as Record<string, unknown>;
          const role = typeof m.role === "string" ? m.role : "unknown";
          const text = extractTextCached(msg) ?? "";
          if (!text.trim()) {
            return nothing;
          }
          return html`
            <div class="callout">
              <div class="muted" style="margin-bottom: 4px;">${role}</div>
              <div style="white-space: pre-wrap;">${text}</div>
            </div>
          `;
        })}
        ${
          props.tulsbotStream
            ? html`<div class="callout">
              <div class="muted" style="margin-bottom: 4px;">assistant (streaming)</div>
              <div style="white-space: pre-wrap;">${props.tulsbotStream}</div>
            </div>`
            : nothing
        }
      </div>

      <div class="form-grid" style="margin-top: 12px;">
        <label class="field" style="grid-column: 1 / -1;">
          <span>Message</span>
          <textarea
            .value=${props.tulsbotDraft}
            ?disabled=${!props.connected || props.tulsbotSending}
            rows="3"
            placeholder="Ask Tulsbot to boot, sync, or run a check…"
            @input=${(e: Event) => props.onTulsbotDraftChange((e.target as HTMLTextAreaElement).value)}
          ></textarea>
        </label>
      </div>
      <div class="row" style="margin-top: 10px;">
        <button
          class="btn"
          ?disabled=${!props.connected || props.tulsbotSending || props.tulsbotLoading}
          @click=${() => props.onSendTulsbot()}
        >
          Send
        </button>
        <button
          class="btn"
          ?disabled=${!props.connected || props.tulsbotSending}
          @click=${() =>
            props.onSendTulsbot(
              "Boot check: confirm you are running and list critical startup issues (if any).",
            )}
        >
          Boot check
        </button>
        <button
          class="btn"
          ?disabled=${!props.connected || props.tulsbotSending}
          @click=${() =>
            props.onSendTulsbot(
              "Sync check: confirm knowledge loaded and refresh any cached knowledge if needed.",
            )}
        >
          Sync check
        </button>
        <span class="muted">Pinned panel does not change your main Chat tab session.</span>
      </div>
    </section>

    <section class="grid grid-cols-3" style="margin-top: 18px;">
      <div class="card stat-card">
        <div class="stat-label">Instances</div>
        <div class="stat-value">${props.presenceCount}</div>
        <div class="muted">Presence beacons in the last 5 minutes.</div>
      </div>
      <div class="card stat-card">
        <div class="stat-label">Sessions</div>
        <div class="stat-value">${props.sessionsCount ?? "n/a"}</div>
        <div class="muted">Recent session keys tracked by the gateway.</div>
      </div>
      <div class="card stat-card">
        <div class="stat-label">Cron</div>
        <div class="stat-value">
          ${props.cronEnabled == null ? "n/a" : props.cronEnabled ? "Enabled" : "Disabled"}
        </div>
        <div class="muted">
          Next wake ${props.cronNext ? formatRelativeTimestamp(props.cronNext) : "n/a"}
        </div>
      </div>
    </section>

    <section class="card" style="margin-top: 18px;">
      <div class="card-title">Quick Links</div>
      <div class="card-sub">Jump to the most used areas.</div>
      <div class="grid grid-cols-3" style="margin-top: 14px;">
        ${quickLinks.map((entry) =>
          renderQuickLink({
            label: entry.tab === "chat" ? "Chat" : entry.tab[0].toUpperCase() + entry.tab.slice(1),
            detail: entry.detail,
            onClick: () => props.onNavigate(entry.tab),
          }),
        )}
        ${renderQuickLink({
          label: "Pages",
          detail: "Create custom dashboards (on demand).",
          onClick: () => props.onNavigate("pages"),
        })}
      </div>
    </section>
  `;
}
