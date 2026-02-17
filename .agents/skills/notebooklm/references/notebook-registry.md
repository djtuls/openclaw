# Notebook Registry

All NotebookLM notebooks used by agents in this repo. **Always update this file when creating or deleting notebooks.**

| Notebook                    | ID                                     | Purpose                                                              | Created    |
| --------------------------- | -------------------------------------- | -------------------------------------------------------------------- | ---------- |
| OpenClaw Master             | `bdc9ce06-cc71-4ea0-8181-d84a2a2e9a31` | Primary project knowledge, codebase snapshot, architecture decisions | 2026-02-14 |
| OpenClaw Debugging Handbook | `2f6cf3da-f70b-41d3-b6e5-0073d0922fa7` | Error patterns, official docs, community fixes, stack trace analysis | 2026-02-14 |
| OpenClaw Security Handbook  | `ed48b6e5-4424-4a2f-b594-e68fa9ed2ab8` | OWASP guides, CVE databases, Node.js security best practices         | 2026-02-14 |

## Environment Variables

Set these in your `.env` file after creating the notebooks:

```sh
NLM_MASTER_NOTEBOOK_ID=bdc9ce06-cc71-4ea0-8181-d84a2a2e9a31
NLM_DEBUG_NOTEBOOK_ID=2f6cf3da-f70b-41d3-b6e5-0073d0922fa7
NLM_SECURITY_NOTEBOOK_ID=ed48b6e5-4424-4a2f-b594-e68fa9ed2ab8
```

## Adding New Notebooks

When creating a new notebook (via `scripts/nlm-create-notebooks.sh "Name"` or `nlm notebook create "Name"`), add a row to the table above with:

- **Notebook**: Human-readable name
- **ID**: The notebook ID returned by the CLI
- **Purpose**: What this notebook is for (1 sentence)
- **Created**: Date of creation (YYYY-MM-DD)
