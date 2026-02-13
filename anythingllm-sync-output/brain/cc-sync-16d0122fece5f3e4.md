# Command Extraction Logic

**Type:** concept
**Tier:** permanent
**Confidence:** 0.85
**Created:** Tue Feb 10 2026 22:01:02 GMT-0300 (Brasilia Standard Time)

---

The `extractSOPFromText` function employs pattern matching (schedule, event, always, never, conditional) to identify procedural commands from chat conversations, assigning a confidence score (0-100) to each extracted command.
