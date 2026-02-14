#!/usr/bin/env bash
# Seed the NotebookLM debugging and security handbooks with initial sources.
#
# Usage:
#   scripts/nlm-seed-handbooks.sh
#
# Requires:
#   - nlm (uv tool install notebooklm-mcp-cli)
#   - NLM_DEBUG_NOTEBOOK_ID and NLM_SECURITY_NOTEBOOK_ID set in .env or environment
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# ── Load .env if present ──────────────────────────────────────────────────────
if [ -f "$REPO_ROOT/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  source "$REPO_ROOT/.env"
  set +a
fi

DEBUG_NOTEBOOK="${NLM_DEBUG_NOTEBOOK_ID:?Set NLM_DEBUG_NOTEBOOK_ID in .env or environment}"
SECURITY_NOTEBOOK="${NLM_SECURITY_NOTEBOOK_ID:?Set NLM_SECURITY_NOTEBOOK_ID in .env or environment}"

# ── Preflight ──────────────────────────────────────────────────────────────────
command -v nlm >/dev/null 2>&1 || {
  echo "Error: nlm not found. Install: uv tool install notebooklm-mcp-cli"
  exit 1
}

nlm login --check >/dev/null 2>&1 || {
  echo "Error: nlm auth expired. Run: nlm login"
  exit 1
}

# ── Helper ─────────────────────────────────────────────────────────────────────
add_source() {
  local notebook="$1"
  local type="$2"  # --url or --file
  local source="$3"
  local label="$4"

  echo "  + $label"
  nlm source add "$notebook" "$type" "$source" 2>&1 || echo "    Warning: failed to add $label"
}

# ── Seed Debugging Handbook ────────────────────────────────────────────────────
echo "=== Seeding Debugging Handbook ==="
echo "Notebook: $DEBUG_NOTEBOOK"
echo ""

# OpenClaw docs
add_source "$DEBUG_NOTEBOOK" --url "https://docs.openclaw.ai" "OpenClaw Documentation"

# Node.js
add_source "$DEBUG_NOTEBOOK" --url "https://nodejs.org/api/errors.html" "Node.js Errors API"
add_source "$DEBUG_NOTEBOOK" --url "https://nodejs.org/api/diagnostics_channel.html" "Node.js Diagnostics Channel"

# TypeScript
add_source "$DEBUG_NOTEBOOK" --url "https://www.typescriptlang.org/docs/handbook/2/narrowing.html" "TypeScript Narrowing"

# Local project files
add_source "$DEBUG_NOTEBOOK" --file "$REPO_ROOT/AGENTS.md" "AGENTS.md (project guidelines)"
add_source "$DEBUG_NOTEBOOK" --file "$REPO_ROOT/CONTRIBUTING.md" "CONTRIBUTING.md"

echo ""

# ── Seed Security Handbook ─────────────────────────────────────────────────────
echo "=== Seeding Security Handbook ==="
echo "Notebook: $SECURITY_NOTEBOOK"
echo ""

# Node.js security-related docs
add_source "$SECURITY_NOTEBOOK" --url "https://nodejs.org/api/permissions.html" "Node.js Permissions API"
add_source "$SECURITY_NOTEBOOK" --url "https://nodejs.org/api/crypto.html" "Node.js Crypto API"

# OpenClaw docs (security context)
add_source "$SECURITY_NOTEBOOK" --url "https://docs.openclaw.ai" "OpenClaw Documentation"

# OpenClaw security
add_source "$SECURITY_NOTEBOOK" --file "$REPO_ROOT/SECURITY.md" "SECURITY.md (project security policy)"

echo ""
echo "=== Seeding complete ==="
echo ""
echo "You can add more sources with:"
echo "  nlm source add <notebook-id> --url <url>"
echo "  nlm source add <notebook-id> --file <path>"
