# Qdrant Vector Seed Script - Voyage AI Integration

**Type:** fact
**Tier:** permanent
**Confidence:** 0.92
**Created:** Mon Feb 09 2026 15:31:24 GMT-0300 (Brasilia Standard Time)

---

A `seed-qdrant.ts` script was created to seed Qdrant vectors using Voyage AI (`voyage-3.5-lite`). It gracefully skips if `VOYAGE_API_KEY` is placeholder and uses deterministic UUID generation for Qdrant point IDs with a 3-error circuit breaker.
