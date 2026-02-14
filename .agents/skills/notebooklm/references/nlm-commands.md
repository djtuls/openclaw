# nlm CLI Command Reference

Quick reference for the `notebooklm-mcp-cli` tool. Install: `uv tool install notebooklm-mcp-cli`.

## Authentication

```sh
nlm login                    # Open browser for Google OAuth
nlm login --check            # Verify current auth status
nlm doctor                   # Full health check (auth + connectivity)
nlm setup add claude-code    # Add MCP server integration to Claude Code
```

## Notebooks

```sh
nlm notebook list                          # List all notebooks
nlm notebook create "Name"                 # Create a new notebook
nlm notebook delete <notebook-id>          # Delete a notebook
nlm notebook get <notebook-id>             # Get notebook details
```

## Sources

```sh
nlm source list <notebook-id>                         # List sources in a notebook
nlm source add <notebook-id> --file <path>            # Upload a local file
nlm source add <notebook-id> --url <url>              # Add a URL as a source
nlm source delete <notebook-id> <source-id>           # Remove a source
```

## Querying

```sh
nlm query notebook <notebook-id> "your question here"            # Query with grounded citations
nlm query notebook <notebook-id> "follow-up" -c <conversation-id>  # Follow-up in same conversation
nlm query notebook <notebook-id> "question" -s <source-id>       # Query specific sources only
```

## Project Scripts

These scripts wrap common nlm + repomix workflows:

```sh
scripts/nlm-create-notebooks.sh              # Create the 3 starter notebooks
scripts/nlm-create-notebooks.sh "Name"       # Create a custom notebook
scripts/nlm-sync-codebase.sh                 # Repomix snapshot + upload to master
scripts/nlm-seed-handbooks.sh                # Seed debugging + security sources
```
