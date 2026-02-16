# Internal Container: File Storage Architecture

## Canonical Location

**Tulsbot File Cabinet** — Google Drive

- **URL**: https://drive.google.com/drive/folders/1sET8R2rJBlHmv2Lfy49f7ktci62_gPhN

- **Folder ID**: 1sET8R2rJBlHmv2Lfy49f7ktci62_gPhN

## Principle

**The Internal Container** is a Google Drive–backed folder that serves as the **storage container** (SOT) for actual files. Notion stores **only links** to these files, never the file content itself.

## Flow

| What | Where |

|------|-------|

| **Actual files** (audio, PDF, Microsoft docs, etc.) | Internal Container (Google Drive) |

| **Links / references** | Notion |

| **Sync** | Local folder + Google Drive cloud |

## Internal Container Capabilities

- **Create folders** via API

- **Edit** files and structure

- **Churn data** as needed or when commanded

- Acts as the **internal file cabinet** for Tulsbot

## File Types

- Audio files

- PDFs

- Microsoft documents (Word, Excel, PowerPoint, etc.)

- Other binary/document types

All such files are uploaded to the Internal Container; Notion holds only the link/URL.

## Configuration

| Env Var | Purpose | Default |

|---------|---------|---------|

| FILE_CABINET_DRIVE_FOLDER_ID | Drive folder ID (Internal Container) | 1sET8R2rJBlHmv2Lfy49f7ktci62_gPhN |

| FILE_CABINET_LOCAL_PATH | Local path where Drive syncs the folder | (empty) |

| FILE_CABINET_ACCESS_MODE | local or online | local if FILE_CABINET_LOCAL_PATH set, else online |

**Local path discovery**: Google Drive for Desktop does not expose a programmatic path. Set FILE_CABINET_LOCAL_PATH to the folder on disk.

## Always Embed Drive Link Rule

**Whenever a file is stored or referenced** (chat attachments, Notion, capture pipeline):

1. Store the **Drive link** in metadata / Notion URL property

1. File: https://drive.google.com/file/d/{fileId}/view

1. Folder: https://drive.google.com/drive/folders/{folderId}

1. Format for references: { driveLink, localPath?, fileId, folderId }

1. Notion stores only the Drive link; never the file content

---

---

# Tulsbot Learned (Brain Nodes)

_Auto-generated from brain_nodes; regenerated every 30 min by heartbeat_

**Topics**: Full Stack Cleanup Build, Telegram Bot Upgrade, External Integrations, Security Architecture, Intelligence Layer, Qdrant, Context Manager

**Concepts**: Important Development Patterns, User Identity Mapping, Memory System, Multi-Channel Communication

**Facts**: How to Start Development, Port Configuration

**Category**: System Architecture

---

---

# Key File References

## Services

- services/context-manager/src/services/license-service.ts

- services/context-manager/src/services/template-service.ts

- services/context-manager/src/services/master-boot.ts

- services/context-manager/src/services/backup-service.ts

- services/context-manager/src/services/sop-manager.ts

- services/context-manager/src/services/agent-workspace-scanner.ts

- services/context-manager/src/services/memory-heartbeat.ts

- services/context-manager/src/services/config-files-sync.ts

## Sync Endpoints

- /api/memory-tiers/heartbeat

- /api/notion-sync/sync-all-markdown

- /api/config-files-sync/status

- /api/config-files-sync/sync-all

---

---

# Internal Container: File Storage Architecture

## Canonical Location

**Tulsbot File Cabinet** — Google Drive

- **URL**: https://drive.google.com/drive/folders/1sET8R2rJBlHmv2Lfy49f7ktci62_gPhN

- **Folder ID**: 1sET8R2rJBlHmv2Lfy49f7ktci62_gPhN

## Principle

**The Internal Container** is a Google Drive–backed folder that serves as the **storage container** (SOT) for actual files. Notion stores **only links** to these files, never the file content itself.

## Flow

| What | Where |

|------|-------|

| **Actual files** (audio, PDF, Microsoft docs, etc.) | Internal Container (Google Drive) |

| **Links / references** | Notion |

| **Sync** | Local folder + Google Drive cloud |

## Internal Container Capabilities

- **Create folders** via API

- **Edit** files and structure

- **Churn data** as needed or when commanded

- Acts as the **internal file cabinet** for Tulsbot

## File Types

- Audio files

- PDFs

- Microsoft documents (Word, Excel, PowerPoint, etc.)

- Other binary/document types

All such files are uploaded to the Internal Container; Notion holds only the link/URL.

## Configuration

| Env Var | Purpose | Default |

|---------|---------|---------|

| FILE_CABINET_DRIVE_FOLDER_ID | Drive folder ID (Internal Container) | 1sET8R2rJBlHmv2Lfy49f7ktci62_gPhN |

| FILE_CABINET_LOCAL_PATH | Local path where Drive syncs the folder | (empty) |

| FILE_CABINET_ACCESS_MODE | local or online | local if FILE_CABINET_LOCAL_PATH set, else online |

**Local path discovery**: Google Drive for Desktop does not expose a programmatic path. Set FILE_CABINET_LOCAL_PATH to the folder on disk.

## Always Embed Drive Link Rule

**Whenever a file is stored or referenced** (chat attachments, Notion, capture pipeline):

1. Store the **Drive link** in metadata / Notion URL property

1. File: https://drive.google.com/file/d/{fileId}/view

1. Folder: https://drive.google.com/drive/folders/{folderId}

1. Format for references: { driveLink, localPath?, fileId, folderId }

1. Notion stores only the Drive link; never the file content

---

---

# Tulsbot Learned (Brain Nodes)

_Auto-generated from brain_nodes; regenerated every 30 min by heartbeat_

**Topics**: Full Stack Cleanup Build, Telegram Bot Upgrade, External Integrations, Security Architecture, Intelligence Layer, Qdrant, Context Manager

**Concepts**: Important Development Patterns, User Identity Mapping, Memory System, Multi-Channel Communication

**Facts**: How to Start Development, Port Configuration

**Category**: System Architecture

---

---

# Key File References

## Services

- services/context-manager/src/services/license-service.ts

- services/context-manager/src/services/template-service.ts

- services/context-manager/src/services/master-boot.ts

- services/context-manager/src/services/backup-service.ts

- services/context-manager/src/services/sop-manager.ts

- services/context-manager/src/services/agent-workspace-scanner.ts

- services/context-manager/src/services/memory-heartbeat.ts

- services/context-manager/src/services/config-files-sync.ts

## Sync Endpoints

- /api/memory-tiers/heartbeat

- /api/notion-sync/sync-all-markdown

- /api/config-files-sync/status

- /api/config-files-sync/sync-all

---
