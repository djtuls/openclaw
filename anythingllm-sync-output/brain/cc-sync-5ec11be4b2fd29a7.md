# Agent Sub-document Pattern

**Type:** architecture
**Tier:** permanent
**Confidence:** 0.88
**Created:** Mon Feb 09 2026 15:47:26 GMT-0300 (Brasilia Standard Time)

---

Each agent has 3 child pages (Instructions, Memory, Health) with `<!-- AUTOMATED SECTION -->` comment markers, enabling targeted updates via `replace_content_range`.
