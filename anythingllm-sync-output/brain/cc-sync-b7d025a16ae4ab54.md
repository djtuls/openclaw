# Context Manager Restart Requirement

**Type:** fact
**Tier:** permanent
**Confidence:** 0.92
**Created:** Mon Feb 09 2026 12:01:11 GMT-0300 (Brasilia Standard Time)

---

Restarting the context-manager process (after updating `.env`) is necessary due to the `tsx watch` not reloading the environment variables.
