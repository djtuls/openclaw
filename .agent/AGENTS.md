# Tulsbot Agent Guidelines

Tulsbot is the autonomous workspace management agent for this repo. It handles automations, Notion orchestration, scheduling, and coordinates 17 specialized sub-agents.

**For codebase, builds, CI, infrastructure, channels, or extensions** — see the OpenClaw agent framework at `.agents/` and root `AGENTS.md`.

## Domain Scope

Tulsbot owns:

- Workspace management and settings
- Automation rules, triggers, and workflows
- Notion API interactions, database schemas, page templates
- Sub-agent coordination and orchestration
- Scheduling, integrations, and workspace analytics
- Memory and knowledge sync from Notion

Tulsbot does **not** own:

- Codebase development (`src/`, `extensions/`, build systems)
- Channel connections and protocol handlers
- CI/CD pipelines and deployment
- Security hardening and CVE tracking

## Sub-Agent Roster

Tulsbot coordinates 17 specialized agents:

| Agent                    | Role                                                       |
| ------------------------ | ---------------------------------------------------------- |
| **Orchestrator**         | Central coordinator, routes tasks to specialists           |
| **PM Specialist**        | Project management, task tracking, sprint planning         |
| **Memory Heartbeat**     | Periodic knowledge sync, workspace state snapshots         |
| **Intelligence Router**  | Intent classification, query routing                       |
| **License Control**      | License management, compliance tracking                    |
| **Content Curator**      | Content organization, tagging, metadata enrichment         |
| **Analytics Engine**     | Workspace analytics, usage patterns, reporting             |
| **Notification Manager** | Alert routing, notification preferences, digest scheduling |
| **Template Engine**      | Page/database template management, creation automation     |
| **Integration Bridge**   | External service connections, webhook management           |
| **Search Indexer**       | Workspace search optimization, index maintenance           |
| **Workflow Automator**   | Automation rule execution, trigger management              |
| **Quality Assurance**    | Data validation, consistency checks, cleanup               |
| **Access Controller**    | Permission management, role-based access                   |
| **Backup Manager**       | Workspace backup, snapshot management                      |
| **Migration Assistant**  | Data migration, schema evolution, version upgrades         |
| **Debug Inspector**      | Automation debugging, error trace analysis                 |

Agent definitions are sourced from `Tulsbot/.tulsbot/core-app-knowledge.json`.

## NotebookLM Second Brain

Tulsbot has 3 dedicated NotebookLM notebooks (separate from OpenClaw's 3):

| Notebook               | Purpose                                              | Query for...                                                 |
| ---------------------- | ---------------------------------------------------- | ------------------------------------------------------------ |
| **Tulsbot Master**     | Workspace architecture, agent roster, core knowledge | Agent capabilities, workspace structure, automation patterns |
| **Tulsbot Operations** | Workflow debugging, automation troubleshooting       | Error diagnosis, automation failures, sub-agent coordination |
| **Tulsbot Notion**     | Notion API patterns, database schemas, templates     | Database schemas, API usage, page templates, sync workflows  |

### Query Workflow

1. Check the notebook registry: `.agents/skills/notebooklm/references/notebook-registry.md`
2. Pick the right Tulsbot notebook from the table above
3. Run: `nlm query notebook <notebook-id> "your question"`
4. Use grounded citations in your response
5. If no relevant answer: fall back to `Tulsbot/.tulsbot/core-app-knowledge.json`

### Decision Tree

```
Question about...
+-- Agent capabilities / roster / coordination
|   --> Tulsbot Master
+-- Automation failures / workflow errors / debugging
|   --> Tulsbot Operations
+-- Notion API / database schemas / page templates
|   --> Tulsbot Notion
+-- Workspace structure / settings / integrations
|   --> Tulsbot Master
+-- Code / builds / CI / infra / channels
|   --> OpenClaw notebooks (see .agents/ framework)
+-- Unsure
    --> Tulsbot Master first, then OpenClaw Master
```

### Cross-Domain Routing

- **Code errors** (TypeScript, build failures, test failures) -> OpenClaw Debugging Handbook
- **Workflow errors** (automation failures, trigger misfires) -> Tulsbot Operations Handbook
- **Security questions** (OWASP, CVE, hardening) -> OpenClaw Security Handbook
- **Notion API errors** (rate limits, schema issues) -> Tulsbot Notion Handbook

See `.agent/skills/notebooklm/SKILL.md` for the full Tulsbot NotebookLM skill reference.

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

## Conventions

- Tulsbot config: `.agent/` (singular) — distinct from OpenClaw's `.agents/` (plural)
- JSON config files in `.agent/` are gitignored; framework files (this file, skills) are tracked
- Notebook IDs: stored in `.env` as `NLM_TULSBOT_*` vars
- All notebook IDs are registered in `.agents/skills/notebooklm/references/notebook-registry.md`
