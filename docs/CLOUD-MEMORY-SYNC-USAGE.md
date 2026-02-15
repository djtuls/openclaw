# Cloud Memory Sync - Usage Guide

This guide covers how to use the OpenClaw cloud memory sync feature to make your local memory accessible online via NotebookLLM.

---

## Overview

The cloud memory sync extends OpenClaw's local memory system to include online accessibility:

- **Local Memory**: `~/.openclaw/workspace/memory/*.md`
- **AnythingLLM**: `./anythingllm-sync-output/brain/*.md` (local RAG)
- **NotebookLLM**: Tulsbot notebook (cloud RAG, queryable from anywhere)

---

## Prerequisites

### 1. Install NotebookLLM CLI

The `nlm` CLI tool is required to sync with NotebookLLM:

```bash
# Install nlm CLI globally
npm install -g @notebooklm/cli

# Verify installation
nlm --version
```

### 2. Authenticate with NotebookLLM

```bash
# Login to your Google account
nlm login

# This will open a browser window for Google OAuth authentication
```

---

## Setup

### Step 1: Get Your NotebookLLM Notebook ID

You need to create or identify a NotebookLLM notebook for Tulsbot memory:

**Option A: Create a new notebook**

```bash
# Create a new notebook named "Tulsbot Memory"
nlm notebook create "Tulsbot Memory"

# This will return a notebook ID like: nb_abc123xyz456
```

**Option B: Use an existing notebook**

```bash
# List your existing notebooks
nlm notebook list

# Find the ID of the notebook you want to use
```

### Step 2: Configure Environment Variable

Set the `TULSBOT_NOTEBOOK_ID` environment variable with your notebook ID:

**For current session**:

```bash
export TULSBOT_NOTEBOOK_ID=nb_abc123xyz456
```

**For permanent configuration** (add to `~/.bashrc`, `~/.zshrc`, or `~/.profile`):

```bash
echo 'export TULSBOT_NOTEBOOK_ID=nb_abc123xyz456' >> ~/.zshrc
source ~/.zshrc
```

**For project-specific** (create `.env` file in project root):

```bash
# .env file
TULSBOT_NOTEBOOK_ID=nb_abc123xyz456
```

---

## Usage

### One-Shot Sync

Sync all current memory files once and exit:

```bash
npm run sync-memory-cloud
```

**What happens:**

1. Reads all `.md` files from `~/.openclaw/workspace/memory/`
2. Syncs to AnythingLLM brain directory (local RAG)
3. Uploads to NotebookLLM notebook (cloud RAG)
4. Shows summary of synced, skipped, and error files

**Example output:**

```
🔄 Starting cloud memory sync...

📚 Found 42 memory files
📁 Local: /Users/you/.openclaw/workspace/memory
📁 AnythingLLM: /path/to/anythingllm-sync-output/brain
☁️  NotebookLLM: nb_abc123xyz456

  ✓ AnythingLLM: qmd-architecture.md → cc-sync-a1b2c3d4e5f6g7h8.md
  ✓ NotebookLLM: qmd-architecture.md uploaded
  ✓ AnythingLLM: backend-patterns.md → cc-sync-f9e8d7c6b5a4h3g2.md
  ✓ NotebookLLM: backend-patterns.md uploaded

✅ Sync complete:
   - AnythingLLM: 42 files
   - NotebookLLM: 42 files
   - Skipped: 0 files
   - Errors: 0 files

🌐 Your memory is now queryable online via:
   nlm query notebook nb_abc123xyz456 "your question"
```

### Watch Mode (Continuous Sync)

Continuously watch for file changes and sync in real-time:

```bash
npm run sync-memory-cloud:watch
```

**What happens:**

1. Performs initial one-shot sync
2. Monitors `~/.openclaw/workspace/memory/` for changes
3. Automatically syncs when files are added, modified, or deleted
4. Runs until you stop it with `Ctrl+C`

**Example output:**

```
👀 Starting cloud memory sync in watch mode...

📁 Watching: /Users/you/.openclaw/workspace/memory
📁 AnythingLLM: /path/to/anythingllm-sync-output/brain
☁️  NotebookLLM: nb_abc123xyz456

[... initial sync output ...]

✅ Watch mode active. Press Ctrl+C to stop.

📝 New file: new-learning.md
  ✓ AnythingLLM: new-learning.md → cc-sync-1234567890abcdef.md
  ✓ NotebookLLM: new-learning.md uploaded

📝 Changed: qmd-architecture.md
  ✓ AnythingLLM: qmd-architecture.md → cc-sync-a1b2c3d4e5f6g7h8.md
  ✓ NotebookLLM: qmd-architecture.md uploaded
```

---

## Querying Your Online Memory

Once synced, you can query your memory from anywhere with internet access:

```bash
# Ask questions about your memory
nlm query notebook $TULSBOT_NOTEBOOK_ID "How does QMD backend work?"

# Get specific information
nlm query notebook $TULSBOT_NOTEBOOK_ID "What are the authentication patterns?"

# Explore learnings
nlm query notebook $TULSBOT_NOTEBOOK_ID "Summarize recent learnings about TypeScript"
```

**You can also query via:**

- NotebookLLM web interface: https://notebooklm.google.com
- NotebookLLM mobile apps
- API integrations (if available)

---

## What Gets Synced

### Source Files

- **Location**: `~/.openclaw/workspace/memory/`
- **Format**: Markdown files (`.md`)
- **Structure**: OpenClaw memory format with metadata headers

### Example Memory File

```markdown
# QMD Backend Architecture

**Type:** architecture
**Tier:** core
**Confidence:** 0.9
**Created:** 2024-01-15

---

The QMD backend uses a microservices architecture with...
```

### Destinations

**1. AnythingLLM (Local RAG)**

- **Location**: `./anythingllm-sync-output/brain/`
- **Filename**: `cc-sync-{hash}.md` (hash-stable naming)
- **Purpose**: Local RAG queries via AnythingLLM

**2. NotebookLLM (Cloud RAG)**

- **Location**: Your Tulsbot NotebookLLM notebook
- **Filename**: Preserved from source
- **Purpose**: Online queries from anywhere

---

## Troubleshooting

### Authentication Errors

**Error**: `NotebookLLM auth error. Run: nlm login`

**Solution**:

```bash
# Re-authenticate with NotebookLLM
nlm login

# Then run sync again
npm run sync-memory-cloud
```

---

### Notebook Not Found

**Error**: `Notebook not found: nb_xxx`

**Solution**:

1. Verify your notebook ID is correct:

   ```bash
   nlm notebook list
   ```

2. Check environment variable is set:

   ```bash
   echo $TULSBOT_NOTEBOOK_ID
   ```

3. Update the environment variable if needed:
   ```bash
   export TULSBOT_NOTEBOOK_ID=correct_notebook_id
   ```

---

### NotebookLLM Disabled

**Warning**: `⚠️  TULSBOT_NOTEBOOK_ID not set. NotebookLLM sync disabled.`

**Solution**:
Set the environment variable (see Setup section above).

**Note**: If you only want local AnythingLLM sync, this is expected behavior.

---

### File Already Exists

**Message**: `ℹ️  NotebookLLM: file.md already exists (skipped)`

**Explanation**: This is normal. NotebookLLM prevents duplicate uploads. The file won't be re-uploaded unless you delete it from the notebook first.

---

### Sync Failures

**Problem**: Some files sync to AnythingLLM but not NotebookLLM (or vice versa)

**Explanation**: The sync destinations are independent. A failure in one doesn't block the other.

**Check**:

1. Look at the sync output to see which destination failed
2. Address the specific error (usually auth or network issues)
3. Run sync again - it will only sync what's missing

---

## Advanced Configuration

### Disable NotebookLLM Sync

If you only want local AnythingLLM sync:

```bash
# Don't set TULSBOT_NOTEBOOK_ID, or unset it:
unset TULSBOT_NOTEBOOK_ID

# Run sync - will only sync to AnythingLLM
npm run sync-memory-cloud
```

---

### Custom Sync Intervals

For watch mode with custom intervals, modify the script or create a custom npm script.

---

### Selective Sync

Currently all `.md` files in `~/.openclaw/workspace/memory/` are synced. Files with `source: anythingllm-backup` in their metadata are automatically skipped to avoid circular syncs.

---

## Architecture Details

For technical implementation details, see:

- **Architecture Document**: `docs/TULSBOT-CLOUD-MEMORY.md`
- **Implementation**: `scripts/sync-memory-cloud.ts`
- **AnythingLLM Sync**: `scripts/sync-anythingllm-bidirectional.ts`

---

## Security Notes

### Command Injection Prevention

The sync script uses `execFileNoThrow()` for safe command execution, preventing command injection attacks. File paths are passed as array arguments, not string interpolation.

### Authentication

NotebookLLM uses Google OAuth for authentication. Your credentials are managed by the `nlm` CLI and never stored by OpenClaw.

### Data Privacy

- **Local**: Memory files stay on your machine
- **Cloud**: Files uploaded to NotebookLLM are stored in your Google account
- **Access**: Only you can access your NotebookLLM notebooks (unless you explicitly share them)

---

## Support

For issues or questions:

1. Check this troubleshooting guide
2. Review the architecture document: `docs/TULSBOT-CLOUD-MEMORY.md`
3. Check NotebookLLM CLI docs: https://github.com/notebooklm/cli
4. File an issue in the OpenClaw repository
