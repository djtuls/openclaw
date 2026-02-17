---
name: notebooklm-tulsbot
description: Query Tulsbot-domain NotebookLM notebooks for workspace management,
  automation patterns, sub-agent coordination, and Notion API knowledge. Use before
  crawling Tulsbot source files or performing general web searches.
compatibility: Requires Python 3.10+ for nlm CLI.
metadata:
  author: tulsbot
  version: "1.0"
  domain: tulsbot
---

# Tulsbot NotebookLM Second Brain

**Tulsbot has 3 dedicated NotebookLM notebooks** for workspace management, automation patterns, and Notion API knowledge. These are separate from OpenClaw's 3 notebooks.

**Always query the relevant Tulsbot notebook before crawling source files or searching the web.**

For codebase, build, CI, infra, or channel questions — use OpenClaw notebooks instead. See `.agents/skills/notebooklm/SKILL.md`.

## Notebooks

| Notebook               | Purpose                                              | Query for...                                                 |
| ---------------------- | ---------------------------------------------------- | ------------------------------------------------------------ |
| **Tulsbot Master**     | Workspace architecture, agent roster, core knowledge | Agent capabilities, workspace structure, automation patterns |
| **Tulsbot Operations** | Workflow debugging, automation troubleshooting       | Error diagnosis, automation failures, sub-agent coordination |
| **Tulsbot Notion**     | Notion API patterns, database schemas, templates     | Database schemas, API usage, page templates, sync workflows  |

Notebook IDs are stored in `.env` as `NLM_TULSBOT_*` vars and registered in `.agents/skills/notebooklm/references/notebook-registry.md`.

## When to Use Which Notebook

| Need                                          | Use                    | Why                                                     |
| --------------------------------------------- | ---------------------- | ------------------------------------------------------- |
| Agent capabilities / roster / coordination    | Tulsbot Master         | 17 agent definitions with roles and capabilities        |
| Workspace structure / settings / integrations | Tulsbot Master         | Core workspace knowledge from Notion                    |
| Automation failures / workflow errors         | Tulsbot Operations     | Debugging patterns for triggers and workflows           |
| Sub-agent coordination issues                 | Tulsbot Operations     | Inter-agent routing and orchestration patterns          |
| Notion API / database schemas                 | Tulsbot Notion         | 344 API endpoints, schema definitions                   |
| Page templates / sync workflows               | Tulsbot Notion         | Template patterns and sync configurations               |
| Code errors / build failures                  | **OpenClaw Debugging** | Wrong domain — use `.agents/skills/notebooklm/SKILL.md` |
| Security / OWASP / CVE                        | **OpenClaw Security**  | Wrong domain — use `.agents/skills/notebooklm/SKILL.md` |
| Codebase architecture                         | **OpenClaw Master**    | Wrong domain — use `.agents/skills/notebooklm/SKILL.md` |

## Query Workflow

1. Check the notebook registry: `.agents/skills/notebooklm/references/notebook-registry.md`
2. Pick the right Tulsbot notebook from the table above.
3. Run: `nlm query notebook <notebook-id> "your question"`
4. Use grounded citations in your response.
5. If no relevant answer: fall back to `Tulsbot/.tulsbot/core-app-knowledge.json`.

## Decision Tree

```
Question about...
├── Agent capabilities / roster / coordination
│   └── → Tulsbot Master
├── Automation failures / workflow errors / debugging
│   └── → Tulsbot Operations
├── Notion API / database schemas / page templates
│   └── → Tulsbot Notion
├── Workspace structure / settings / integrations
│   └── → Tulsbot Master
├── Code / builds / CI / infra / channels
│   └── → OpenClaw notebooks (see .agents/skills/notebooklm/SKILL.md)
└── Unsure
    └── → Tulsbot Master first, then OpenClaw Master
```

## Cross-Domain Routing

- **Code errors** (TypeScript, build failures, test failures) → OpenClaw Debugging Handbook
- **Workflow errors** (automation failures, trigger misfires) → Tulsbot Operations
- **Security questions** (OWASP, CVE, hardening) → OpenClaw Security Handbook
- **Notion API errors** (rate limits, schema issues) → Tulsbot Notion

## Knowledge Sync

Tulsbot's canonical knowledge lives in `Tulsbot/.tulsbot/core-app-knowledge.json` (synced from Notion). To refresh NotebookLM:

```bash
# Extract and chunk knowledge from core-app-knowledge.json
scripts/nlm-extract-tulsbot-knowledge.sh

# Re-upload to Tulsbot Master notebook
scripts/nlm-sync-tulsbot.sh
```

Run after:

- Major Notion workspace restructuring
- New automation rules or agent additions
- Tulsbot configuration changes
- When notebook answers feel stale

## CLI Commands

See `.agents/skills/notebooklm/references/nlm-commands.md` for the full nlm CLI reference. Key commands:

```sh
nlm query notebook <notebook-id> "your question"    # Query with grounded citations
nlm source list <notebook-id>                        # List sources in a notebook
nlm login --check                                    # Verify auth status
```

## Safety

- NotebookLM operations are **read-only queries + external API calls**. No git state changes.
- No risk of cross-agent interference (each query is stateless).
- Auth tokens are stored locally by the nlm CLI; never commit them.
- Notebook IDs are safe to commit (they require auth to access).

## Troubleshooting

| Problem                    | Fix                                                                         |
| -------------------------- | --------------------------------------------------------------------------- |
| `nlm: command not found`   | Install: `uv tool install notebooklm-mcp-cli`                               |
| Query returns auth error   | Run `nlm login` to re-authenticate                                          |
| Stale workspace answers    | Run `scripts/nlm-sync-tulsbot.sh`                                           |
| Notebook not found         | Check registry: `.agents/skills/notebooklm/references/notebook-registry.md` |
| Knowledge extraction fails | Ensure `Tulsbot/.tulsbot/core-app-knowledge.json` exists                    |
