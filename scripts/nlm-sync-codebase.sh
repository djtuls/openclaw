#!/usr/bin/env bash
# Generate a repomix codebase snapshot and upload it to the NotebookLM master notebook.
#
# Usage:
#   scripts/nlm-sync-codebase.sh
#
# Requires:
#   - repomix (npm install -g repomix)
#   - nlm (uv tool install notebooklm-mcp-cli)
#   - NLM_MASTER_NOTEBOOK_ID set in .env or environment
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
NLM_OUTPUT_DIR="$REPO_ROOT/.local/nlm"
REPOMIX_OUTPUT="$NLM_OUTPUT_DIR/codebase-snapshot.md"

# ── Load .env if present ──────────────────────────────────────────────────────
if [ -f "$REPO_ROOT/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  source "$REPO_ROOT/.env"
  set +a
fi

NOTEBOOK_ID="${NLM_MASTER_NOTEBOOK_ID:-}"

# ── Preflight ──────────────────────────────────────────────────────────────────
if [ -z "$NOTEBOOK_ID" ]; then
  echo "Error: NLM_MASTER_NOTEBOOK_ID not set."
  echo "Check .agents/skills/notebooklm/references/notebook-registry.md for the ID,"
  echo "then set it in your .env or environment."
  exit 1
fi

command -v repomix >/dev/null 2>&1 || {
  echo "Error: repomix not found. Install: npm install -g repomix"
  exit 1
}

command -v nlm >/dev/null 2>&1 || {
  echo "Error: nlm not found. Install: uv tool install notebooklm-mcp-cli"
  exit 1
}

nlm login --check >/dev/null 2>&1 || {
  echo "Error: nlm auth expired. Run: nlm login"
  exit 1
}

# ── Generate snapshot ──────────────────────────────────────────────────────────
mkdir -p "$NLM_OUTPUT_DIR"

echo "Generating codebase snapshot with repomix..."

repomix \
  --style markdown \
  --include "src/**/*.ts,extensions/**/*.ts,scripts/**,docs/**/*.md,AGENTS.md,CONTRIBUTING.md,SECURITY.md,package.json,tsconfig.json" \
  --ignore "node_modules,dist,coverage,*.test.ts,*.e2e.test.ts,.local,anythingllm-sync-output,Tulsbot,Swabble" \
  --header-text "OpenClaw Codebase Snapshot for NotebookLM" \
  --output "$REPOMIX_OUTPUT" \
  "$REPO_ROOT"

if [ ! -f "$REPOMIX_OUTPUT" ]; then
  echo "Error: repomix did not produce output at $REPOMIX_OUTPUT"
  exit 1
fi

FILE_SIZE=$(wc -c < "$REPOMIX_OUTPUT" | tr -d ' ')
echo "  Snapshot: $REPOMIX_OUTPUT ($(numfmt --to=iec "$FILE_SIZE" 2>/dev/null || echo "${FILE_SIZE} bytes"))"

# ── Upload to NotebookLM ──────────────────────────────────────────────────────
echo ""
echo "Uploading to NotebookLM notebook: $NOTEBOOK_ID ..."
nlm source add "$NOTEBOOK_ID" --file "$REPOMIX_OUTPUT"

echo ""
echo "Codebase sync complete."
