import { html, nothing } from "lit";
import type { Tab } from "../navigation.ts";
import type { CustomDashboardPage, CustomDashboardWidget, UiSettings } from "../storage.ts";

type TemplateId = "health" | "ports" | "usage" | "tulsbot";

export type PagesProps = {
  settings: UiSettings;
  connected: boolean;
  onSettingsChange: (next: UiSettings) => void;
  onNavigate: (tab: Tab) => void;
};

function nowId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function normalizeTitle(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 80 ? trimmed.slice(0, 80) : trimmed;
}

function defaultWidgetsForTemplate(template: TemplateId): CustomDashboardWidget[] {
  switch (template) {
    case "health":
      return [
        { kind: "link", tab: "overview", detail: "Gateway snapshot + access." },
        { kind: "link", tab: "channels", detail: "Link and probe channels." },
        { kind: "link", tab: "sessions", detail: "Active sessions and defaults." },
        { kind: "link", tab: "logs", detail: "Tail gateway logs." },
      ];
    case "ports":
      return [
        {
          kind: "note",
          title: "Ports",
          body: "Gateway: 18789 (default). Check Control UI base path and auth in Config.",
        },
        { kind: "link", tab: "config", detail: "gateway.bind / gateway.port / gateway.controlUi" },
        { kind: "link", tab: "debug", detail: "Inspect live snapshots and methods." },
      ];
    case "usage":
      return [
        { kind: "link", tab: "usage", detail: "Tokens, costs, and per-session breakdowns." },
        { kind: "link", tab: "sessions", detail: "Find the session key you care about." },
        { kind: "link", tab: "chat", detail: "Ask the operator session to summarize consumption." },
      ];
    case "tulsbot":
      return [
        {
          kind: "note",
          title: "Tulsbot ops",
          body: "Use Home for pinned chat. This page is a quick jump surface for sessions/config/logs.",
        },
        {
          kind: "link",
          tab: "chat",
          label: "Chat (Tulsbot)",
          detail: "Switch session to agent:tulsbot:main.",
        },
        {
          kind: "link",
          tab: "sessions",
          detail: "Confirm agent:tulsbot:main exists and is active.",
        },
        { kind: "link", tab: "logs", detail: "Watch gateway + agent runs." },
      ];
    default:
      return [];
  }
}

function promptTemplate(): TemplateId | null {
  const raw = window
    .prompt('Template: "health", "ports", "usage", or "tulsbot"', "health")
    ?.trim()
    .toLowerCase();
  if (raw === "health" || raw === "ports" || raw === "usage" || raw === "tulsbot") {
    return raw;
  }
  return null;
}

function createPage(opts: { title: string; template: TemplateId }): CustomDashboardPage {
  return {
    id: nowId("page"),
    title: normalizeTitle(opts.title) || "Untitled",
    createdAtMs: Date.now(),
    widgets: defaultWidgetsForTemplate(opts.template),
  };
}

function renderWidget(widget: CustomDashboardWidget, onNavigate: (tab: Tab) => void) {
  if (widget.kind === "link") {
    const label = widget.label ?? widget.tab[0].toUpperCase() + widget.tab.slice(1);
    const detail = widget.detail ?? "Open";
    return html`
      <button class="card stat-card" @click=${() => onNavigate(widget.tab)} style="text-align: left;">
        <div class="stat-label">${label}</div>
        <div class="muted">${detail}</div>
      </button>
    `;
  }
  if (widget.kind === "note") {
    return html`
      <div class="card">
        <div class="card-title">${widget.title}</div>
        <div class="muted" style="margin-top: 8px; white-space: pre-wrap;">${widget.body}</div>
      </div>
    `;
  }
  return nothing;
}

export function renderPages(props: PagesProps) {
  const pages = props.settings.customPages ?? [];
  const selectedId = props.settings.customPagesSelectedId ?? "";
  const selected = pages.find((p) => p.id === selectedId) ?? pages[0] ?? null;

  const setSelected = (id: string) => {
    props.onSettingsChange({ ...props.settings, customPagesSelectedId: id });
  };

  const onCreate = () => {
    const title = window.prompt("New page title", "New dashboard") ?? "";
    const normalizedTitle = normalizeTitle(title);
    if (!normalizedTitle) {
      return;
    }
    const template = promptTemplate();
    if (!template) {
      return;
    }
    const page = createPage({ title: normalizedTitle, template });
    props.onSettingsChange({
      ...props.settings,
      customPages: [page, ...pages],
      customPagesSelectedId: page.id,
    });
  };

  const onDelete = (id: string) => {
    const page = pages.find((p) => p.id === id);
    if (!page) {
      return;
    }
    const ok = window.confirm(`Delete page "${page.title}"?`);
    if (!ok) {
      return;
    }
    const nextPages = pages.filter((p) => p.id !== id);
    const nextSelected = selectedId === id ? (nextPages[0]?.id ?? "") : selectedId;
    props.onSettingsChange({
      ...props.settings,
      customPages: nextPages,
      customPagesSelectedId: nextSelected,
    });
  };

  return html`
    <section class="grid grid-cols-2">
      <div class="card">
        <div class="card-title">Custom Pages</div>
        <div class="card-sub">Create lightweight dashboards on demand (stored locally).</div>
        <div class="row" style="margin-top: 14px;">
          <button class="btn" @click=${onCreate}>Create page</button>
          <button class="btn" ?disabled=${!selected} @click=${() => selected && onDelete(selected.id)}>
            Delete
          </button>
          <span class="muted">${props.connected ? "Connected" : "Disconnected"}</span>
        </div>

        <div style="margin-top: 14px; display: grid; gap: 8px;">
          ${
            pages.length
              ? pages.map(
                  (page) => html`
                  <button
                    class="btn btn--sm ${page.id === (selected?.id ?? "") ? "active" : ""}"
                    @click=${() => setSelected(page.id)}
                    style="justify-content: flex-start;"
                  >
                    ${page.title}
                  </button>
                `,
                )
              : html`
                  <div class="callout">No custom pages yet. Click “Create page”.</div>
                `
          }
        </div>
      </div>

      <div class="card">
        <div class="card-title">${selected ? selected.title : "Page"}</div>
        <div class="card-sub">
          ${selected ? "Widgets are just shortcuts and notes for now." : "Create a page to begin."}
        </div>
        ${
          selected
            ? html`
              <div class="grid grid-cols-2" style="margin-top: 14px;">
                ${selected.widgets.map((w) => renderWidget(w, props.onNavigate))}
              </div>
              <div class="callout" style="margin-top: 14px;">
                Tip: Use Home for pinned Tulsbot chat and boot/sync shortcuts.
              </div>
            `
            : nothing
        }
      </div>
    </section>
  `;
}
