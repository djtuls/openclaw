# Repository Reorganization - February 16, 2026

This document records the structural changes made to the OpenClaw repository to prepare for a rebuild.

## Backup

A git tag `pre-reorganization-backup-20260216` was created before any changes. To rollback:

```bash
git reset --hard pre-reorganization-backup-20260216
```

## Changes Made

### 1. Removed Empty Duplicate Repository Folder

**What**: Deleted `/Users/tulioferro/Backend_local Macbook/openclaw-repo/` (hyphenated)
**Why**: This folder contained only an empty `docs/` subdirectory and was NOT a git repository. It was a duplicate of the active `openclaw_repo/` folder (underscored) and served no purpose.
**Impact**: No functional impact - removed organizational clutter

### 2. Extracted Swabble Swift Project

**What**: Moved `openclaw_repo/Swabble/` to `/Users/tulioferro/Backend_local Macbook/swabble/` and initialized as separate git repository
**Why**: Swabble is a complete standalone Swift wake-word daemon project with:

- Its own build system (Swift Package Manager)
- Its own testing framework (swift-testing)
- Zero dependencies on OpenClaw TypeScript code
- Separate lifecycle and release cadence
- Different target platform (macOS native vs. Node.js)

**New Location**: `/Users/tulioferro/Backend_local Macbook/swabble/`
**Impact**: Cleaner separation of concerns - Swift project no longer mixed with TypeScript/Node.js gateway

### 3. Relocated Tulsbot Configuration

**What**: Moved `openclaw_repo/Tulsbot/.tulsbot/core-app-knowledge.json` to `~/.config/tulsbot/`
**Why**: The Tulsbot folder contained ONLY configuration data (no code). User configuration data belongs in `~/.config/` following XDG Base Directory conventions.
**New Location**: `~/.config/tulsbot/core-app-knowledge.json`
**Impact**: Proper separation of user config from application code

### 4. Compatibility Packages Retained

**What**: Kept `packages/clawdbot/` and `packages/moltbot/`
**Why**: These are compatibility shims that forward to openclaw. Retained during reorganization for backward compatibility - will be evaluated during rebuild.

## Repository Structure After Reorganization

```
openclaw_repo/
├── src/                    # Main TypeScript source
├── apps/
│   ├── ios/               # iOS app
│   ├── android/           # Android app
│   ├── macos/             # macOS app
│   └── shared/            # Shared app code
├── packages/
│   ├── clawdbot/          # Compatibility shim
│   └── moltbot/           # Compatibility shim
├── ui/                     # Frontend UI
├── docs/                   # Documentation
├── scripts/               # Build/utility scripts
├── extensions/            # Extensions/plugins
├── skills/                # AI skills
├── tests/                 # Test files
├── REORGANIZATION.md      # This file
└── [config files]         # package.json, tsconfig.json, etc.
```

## Extracted Projects

### Swabble

- **Location**: `/Users/tulioferro/Backend_local Macbook/swabble/`
- **Description**: Swift 6.2 wake-word hook daemon for macOS 26
- **Technologies**: Speech.framework (SpeechAnalyzer + SpeechTranscriber)
- **Status**: Initialized as separate git repository

## Removed/Cleaned Up

- ❌ `openclaw-repo/` - Empty duplicate folder
- ❌ `Swabble/` - Extracted to separate repository
- ❌ `Tulsbot/` - Config moved to ~/.config/tulsbot/

## Rationale for Rebuild Preparation

These changes provide several benefits for the upcoming rebuild:

1. **Cleaner scope**: Only OpenClaw TypeScript/Node.js code in repository
2. **Faster navigation**: No unrelated Swift projects to wade through
3. **Better dependency management**: No confusion about Swift vs. Node dependencies
4. **Clearer purpose**: Repository serves one purpose - the OpenClaw gateway
5. **Easier CI/CD**: Build pipelines don't need to handle mixed language projects
6. **Proper separation**: Each project can evolve independently

## Next Steps

1. Proceed with OpenClaw rebuild planning
2. Evaluate whether to keep clawdbot/moltbot compatibility shims
3. Consider whether Swabble integration needs separate documentation

## Git History

All changes are captured in commit:

```bash
git log --oneline | head -1
```

To see detailed changes:

```bash
git show HEAD
```
