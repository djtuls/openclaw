# Chat Transcript — Tulsbot Chrome Extension Build

**Date:** 2026-02-12  
**Topic:** Build Tulsbot Chrome extension and make it functional quickly

---

## Summary

1. **Prototype extension** (`Tulsbot/tulsbot-prototype/chrome-extension/`) — Made functional by copying icons from services extension. Simple popup with agent selector and message input; sends to OpenClaw gateway at `localhost:18789`.
2. **Services extension** (`Tulsbot/services/chrome-extension/`) — Built successfully (`npm install && npm run build`). Output in `dist/`. Full features: chat, side panel, permissions panel, Supabase integration, browser control hooks. CDP requires native host (`com.tulsbot.cdp-relay`).

---

## Load in Chrome

- **Prototype:** Load unpacked → `Tulsbot/tulsbot-prototype/chrome-extension/`
- **Services:** Load unpacked → `Tulsbot/services/chrome-extension/dist/`

Requires OpenClaw gateway on port 18789 for prototype.
