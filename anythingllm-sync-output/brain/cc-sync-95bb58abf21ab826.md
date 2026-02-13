# UserIdentity Middleware - Architectural Change

**Type:** fact
**Tier:** permanent
**Confidence:** 0.96
**Created:** Mon Feb 09 2026 15:01:26 GMT-0300 (Brasilia Standard Time)

---

The UserIdentity middleware addresses 40+ copy-pastes of identity resolution across routes, consolidating the logic into a single middleware that resolves the user from headers/session/token.
