# GitHub CLI Authentication Setup

The repository uses `gh` CLI for automated PR workflows. This section should be inserted into README.md at line 106 (before "## Security defaults").

---

## Developer Prerequisites

### GitHub CLI Authentication

The repository uses `gh` CLI for automated PR workflows. Verify authentication status:

```bash
gh auth status
```

Expected output should show:

- **Account**: Your GitHub username
- **Scopes**: `gist`, `read:org`, `repo`, `workflow`

If not authenticated, run:

```bash
gh auth login
```

Follow the interactive prompts to authenticate with your GitHub account.

---

**Insertion Point**: Insert the content between the "Developer Prerequisites" and "Security defaults" markers into README.md at line 106.
