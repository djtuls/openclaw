# CloudSync Service Architecture

**Type:** architecture
**Tier:** permanent
**Confidence:** 0.95
**Created:** Mon Feb 09 2026 15:30:38 GMT-0300 (Brasilia Standard Time)

---

A standalone service (port 3004) built to sync data from Tulsbot's memory and intelligence components to Supabase and export JSONL for LLM training.  It utilizes a periodic cron scheduler for incremental syncs and full syncs every 6 hours.  Data is prioritized based on four groups: soul/identity, knowledge, intelligence, and dialogue history.
