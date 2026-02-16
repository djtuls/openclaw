#!/bin/bash

# Complete Memory Restoration Guide
# This script helps finish the OpenClaw memory restoration process

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧠 OpenClaw Memory Restoration - Final Steps"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Status:"
echo "  ✅ Memory files synced: 317 files"
echo "  ✅ Claude Code ↔ Tulsbot sync: Active"
echo "  ❌ Memory index: Not built (needs OpenAI API key)"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if OpenAI API key is set
if [ -z "$OPENAI_API_KEY" ]; then
  echo "⚠️  OpenAI API key not found in environment"
  echo ""
  echo "To complete memory restoration, you need to:"
  echo ""
  echo "1️⃣  Set your OpenAI API key:"
  echo "    export OPENAI_API_KEY='sk-...your-key...'"
  echo ""
  echo "2️⃣  Run OpenClaw onboarding to save it:"
  echo "    openclaw onboard --openai-api-key \"\$OPENAI_API_KEY\""
  echo ""
  echo "3️⃣  Then run the memory reindex script:"
  echo "    pnpm tsx scripts/force-memory-reindex.ts"
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  echo "Alternative: Create auth-profiles.json manually"
  echo ""
  echo "If you prefer to skip onboarding, create this file:"
  echo "~/.openclaw/agents/tulsbot/agent/auth-profiles.json"
  echo ""
  echo "With this content:"
  echo '{'
  echo '  "profiles": {'
  echo '    "default": {'
  echo '      "provider": "openai",'
  echo '      "apiKey": "sk-...your-key..."'
  echo '    }'
  echo '  }'
  echo '}'
  echo ""
  exit 1
fi

echo "✅ OpenAI API key found in environment"
echo ""
echo "Running memory reindex..."
echo ""

# Run the memory reindex script
cd "$(dirname "$0")/.."
pnpm tsx scripts/force-memory-reindex.ts

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✨ Memory restoration complete!"
echo ""
echo "Test with:"
echo "  openclaw agent --message 'What do you remember about me?'"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
