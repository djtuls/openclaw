# Notion Sync Frequency & Data Synchronization

**Type:** fact
**Tier:** permanent
**Confidence:** 0.96
**Created:** Mon Feb 09 2026 10:30:57 GMT-0300 (Brasilia Standard Time)

---

The Notion sync process, orchestrated by a pg_cron job, runs every 30 minutes, ensuring that the online mirror remains up-to-date with the latest changes in the Notion workspace. This includes syncing pages, tasks, and configuration data.
