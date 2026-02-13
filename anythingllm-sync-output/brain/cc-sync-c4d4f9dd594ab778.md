# Port Configuration Inconsistency - Web UI

**Type:** fact
**Tier:** permanent
**Confidence:** 0.90
**Created:** Mon Feb 09 2026 12:30:43 GMT-0300 (Brasilia Standard Time)

---

The default backend URL in multiple web-ui files is set to `localhost:3000`, which is the Docker Caddy port. This creates a potential configuration mismatch, requiring verification and updates across all web-ui fallback URLs.
