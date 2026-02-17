---
name: notebooklm
description: Query and manage NotebookLM "second brain" notebooks for project
  knowledge, debugging, security research, and codebase onboarding. Use when agents
  need architecture decisions, debugging help, security guidance, or codebase
  understanding before crawling files directly.
compatibility: Requires Python 3.10+ for nlm CLI. Requires Node.js for repomix.
metadata:
  author: openclaw
  version: "1.0"
---

# NotebookLM Second Brain

**NotebookLM is the cloud-based knowledge layer for all agents in this repo (OpenClaw + Tulsbot).** It complements AnythingLLM (local RAG for conversations/memories) by providing structured, Gemini-powered research notebooks with grounded citations.

**Always query the relevant notebook before crawling source files or performing general web searches.**

## Quick Reference

### CLI commands

- `nlm login` - Authenticate (opens browser for Google OAuth)
- `nlm login --check` - Verify auth is valid
- `nlm doctor` - Full health check
- `nlm notebook list` - List all notebooks
- `nlm notebook create "Name"` - Create a new notebook
- `nlm query notebook <notebook-id> "question"` - Query a notebook with grounded citations
- `nlm source add <notebook-id> --file <path>` - Upload a file as a source
- `nlm source add <notebook-id> --url <url>` - Add a URL as a source
- `nlm source list <notebook-id>` - List sources in a notebook
- `nlm notebook delete <notebook-id>` - Delete a notebook

See `.agents/skills/notebooklm/references/nlm-commands.md` for the full command reference.

### Notebook registry

All notebook IDs are tracked in `.agents/skills/notebooklm/references/notebook-registry.md`. Always check this registry to find the right notebook for your query.

## When to Use Which System

| Need                          | Use                        | Why                                                        |
| ----------------------------- | -------------------------- | ---------------------------------------------------------- |
| Architecture understanding    | NotebookLM (Master)        | Grounded codebase snapshot, avoids token-heavy file crawls |
| Debugging unfamiliar errors   | NotebookLM (Debugging)     | Curated official docs + community patterns                 |
| Security questions            | NotebookLM (Security)      | OWASP guides, CVE data, hardening best practices           |
| Research on new topics        | NotebookLM (temp notebook) | Isolated research context, doesn't pollute main context    |
| Conversation history/memories | AnythingLLM                | Local RAG over private data                                |
| Quick file lookup             | Direct file read           | When you know exactly which file you need                  |

## Query Workflow

1. Identify the right notebook from the registry.
2. Run: `nlm query notebook <notebook-id> "your question"`.
3. Use the grounded citations in your response.
4. If no relevant answer is found, fall back to direct code inspection.
5. If querying fails, check auth: `nlm login --check`.

## Creating Notebooks

Any agent or user can create notebooks at any time:

```sh
# Option 1: Use the creation script (auto-registers in the registry)
scripts/nlm-create-notebooks.sh "My Custom Notebook"

# Option 2: Use nlm directly (manually update the registry afterward)
nlm notebook create "My Custom Notebook"
```

**Always register new notebooks** in `.agents/skills/notebooklm/references/notebook-registry.md` with the notebook ID, name, purpose, and creation date.

## Codebase Sync Workflow

The master notebook contains a repomix snapshot of the codebase. To update it:

```sh
scripts/nlm-sync-codebase.sh
```

Run this after:

- Major refactors or new modules
- Significant structural changes
- Before a release
- When the master notebook answers feel stale

The script uses CLI flags for include/exclude rules (the Python repomix version has config file incompatibilities).

## Research Workflow

For investigating new topics without polluting your current context:

1. Create a temporary notebook:

   ```sh
   scripts/nlm-create-notebooks.sh "Research: <topic>"
   ```

2. Add sources:

   ```sh
   nlm source add <notebook-id> --url "https://..."
   nlm source add <notebook-id> --file path/to/doc.pdf
   ```

3. Query findings:

   ```sh
   nlm query <notebook-id> "summarize the key findings"
   ```

4. Document findings in your PR/issue/commit message.

5. Keep the notebook if the research is ongoing, or delete when done:
   ```sh
   nlm notebook delete <notebook-id>
   ```

## Visualization Workflow

Architecture diagrams and mind maps live in `visualizations/`. Check there before generating new ones.

To generate new visualizations:

1. Query the master notebook for diagrams:

   ```sh
   nlm query notebook "$NLM_MASTER_NOTEBOOK_ID" "Generate a Mermaid diagram of the channel routing system"
   ```

2. Save the output to `visualizations/` as Markdown with embedded Mermaid blocks.

3. Commit the visualization so other agents can reference it.

## Safety

- NotebookLM operations are **read-only queries + external API calls**. No git state changes.
- No risk of cross-agent interference (each query is stateless).
- Auth tokens are stored locally by the nlm CLI; never commit them.
- Notebook IDs are safe to commit (they require auth to access).

## Troubleshooting

| Problem                      | Fix                                                                                        |
| ---------------------------- | ------------------------------------------------------------------------------------------ |
| `nlm: command not found`     | Install: `uv tool install notebooklm-mcp-cli`                                              |
| `repomix: command not found` | Install: `uv tool install repomix`                                                         |
| Query returns auth error     | Run `nlm login` to re-authenticate                                                         |
| Stale codebase answers       | Run `scripts/nlm-sync-codebase.sh`                                                         |
| Notebook not found           | Check registry for correct ID: `.agents/skills/notebooklm/references/notebook-registry.md` |
