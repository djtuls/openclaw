# Migration SQL Fixes - PostgreSQL Issues

**Type:** fact
**Tier:** permanent
**Confidence:** 0.85
**Created:** Mon Feb 09 2026 15:31:24 GMT-0300 (Brasilia Standard Time)

---

Seven migration SQL files required iterative fixes due to PostgreSQL-specific issues. Common fixes included converting INTEGER to UUID, adding DROP TRIGGER IF EXISTS, optimizing JSONB queries, and correcting index positions.
