# Migration Tracking with Checksums

**Type:** architecture
**Tier:** permanent
**Confidence:** 0.90
**Created:** Mon Feb 09 2026 15:57:18 GMT-0300 (Brasilia Standard Time)

---

The `db/client.ts` file includes an `_migrations` table that tracks database schema changes using MD5 checksums, skipping unchanged migrations and re-applying them on mismatch.
