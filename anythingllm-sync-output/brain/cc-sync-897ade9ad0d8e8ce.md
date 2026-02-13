# Model Router Issue - Tool Requirement

**Type:** fact
**Tier:** permanent
**Confidence:** 0.90
**Created:** Mon Feb 09 2026 12:01:11 GMT-0300 (Brasilia Standard Time)

---

The Model Router incorrectly set `requiresTools` to `undefined`, causing agent skill queries to be directed to Groq instead of Claude, leading to errors.
