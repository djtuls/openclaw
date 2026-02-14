#!/usr/bin/env bash
# Create NotebookLM notebooks for the OpenClaw second brain.
#
# Usage:
#   scripts/nlm-create-notebooks.sh              # Create the 3 starter notebooks
#   scripts/nlm-create-notebooks.sh "Name"       # Create a single custom notebook
#
# After creation, notebook IDs are printed and appended to the registry at:
#   .agents/skills/notebooklm/references/notebook-registry.md
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REGISTRY="$REPO_ROOT/.agents/skills/notebooklm/references/notebook-registry.md"
TODAY="$(date +%Y-%m-%d)"

# ── Preflight ──────────────────────────────────────────────────────────────────
command -v nlm >/dev/null 2>&1 || {
  echo "Error: nlm not found. Install: uv tool install notebooklm-mcp-cli"
  exit 1
}

nlm login --check >/dev/null 2>&1 || {
  echo "Error: nlm auth expired. Run: nlm login"
  exit 1
}

# ── Helpers ────────────────────────────────────────────────────────────────────
create_notebook() {
  local name="$1"
  local purpose="$2"

  echo "Creating notebook: $name ..." >&2
  local output
  output=$(nlm notebook create "$name" 2>&1)

  # Extract notebook ID (UUID format) from output
  local id
  id=$(echo "$output" | grep -oE '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' | head -1)

  if [ -z "$id" ]; then
    # Fallback: try any long alphanumeric string
    id=$(echo "$output" | grep -oE '[a-zA-Z0-9_-]{20,}' | head -1)
  fi

  if [ -z "$id" ]; then
    echo "Warning: Could not extract notebook ID from output:" >&2
    echo "$output" >&2
    echo "Please copy the ID manually from the output above." >&2
    id="<MANUAL>"
  fi

  echo "  → ID: $id" >&2

  # Append to registry
  if [ -f "$REGISTRY" ]; then
    echo "| $name | \`$id\` | $purpose | $TODAY |" >> "$REGISTRY"
    echo "  → Registered in notebook-registry.md" >&2
  fi

  # Only the ID goes to stdout (for capture by callers)
  echo "$id"
}

# ── Main ───────────────────────────────────────────────────────────────────────
if [ $# -ge 1 ]; then
  # Custom mode: create a single notebook with the given name
  NAME="$1"
  PURPOSE="${2:-Custom notebook}"
  create_notebook "$NAME" "$PURPOSE"
  echo ""
  echo "Done. Update your .env if needed and check the registry:"
  echo "  $REGISTRY"
else
  # Default mode: create the 3 starter notebooks
  echo "=== Creating OpenClaw Second Brain Notebooks ==="
  echo ""

  MASTER_ID=$(create_notebook "OpenClaw Master" "Primary project knowledge, codebase snapshot, architecture decisions")
  echo ""

  DEBUG_ID=$(create_notebook "OpenClaw Debugging Handbook" "Error patterns, official docs, community fixes, stack trace analysis")
  echo ""

  SECURITY_ID=$(create_notebook "OpenClaw Security Handbook" "OWASP guides, CVE databases, Node.js security best practices")
  echo ""

  echo "=== Summary ==="
  echo "Master:    $MASTER_ID"
  echo "Debugging: $DEBUG_ID"
  echo "Security:  $SECURITY_ID"
  echo ""
  echo "Add these to your .env file:"
  echo "  NLM_MASTER_NOTEBOOK_ID=$MASTER_ID"
  echo "  NLM_DEBUG_NOTEBOOK_ID=$DEBUG_ID"
  echo "  NLM_SECURITY_NOTEBOOK_ID=$SECURITY_ID"
  echo ""
  echo "Registry updated: $REGISTRY"
fi
