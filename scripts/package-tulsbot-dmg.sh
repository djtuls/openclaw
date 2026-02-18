#!/usr/bin/env bash
set -euo pipefail

# Create a "Tulsbot" DMG from an existing OpenClaw.app bundle.
#
# This does NOT build the app. It only packages a DMG.
# Building the macOS app from source requires Xcode.
#
# Usage:
#   scripts/package-tulsbot-dmg.sh /path/to/OpenClaw.app [output.dmg]
#
# Example:
#   scripts/package-tulsbot-dmg.sh "/Applications/OpenClaw.app"
#

APP_PATH="${1:-}"
OUT_PATH="${2:-}"

if [[ -z "$APP_PATH" ]]; then
  echo "Usage: $(basename "$0") /path/to/OpenClaw.app [output.dmg]" >&2
  exit 1
fi
if [[ ! -d "$APP_PATH" ]]; then
  echo "Error: App not found: $APP_PATH" >&2
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

VERSION=$(/usr/libexec/PlistBuddy -c "Print CFBundleShortVersionString" "$APP_PATH/Contents/Info.plist" 2>/dev/null || echo "0.0.0")
if [[ -z "$OUT_PATH" ]]; then
  OUT_PATH="$ROOT_DIR/dist/Tulsbot-$VERSION.dmg"
fi

# DMG naming/styling knobs are handled by create-dmg.sh via env vars.
export DMG_VOLUME_NAME="${DMG_VOLUME_NAME:-Tulsbot}"

"$ROOT_DIR/scripts/create-dmg.sh" "$APP_PATH" "$OUT_PATH"

echo "✅ Tulsbot DMG ready: $OUT_PATH"

