# Accounts Payable Routes

**Type:** fact
**Tier:** permanent
**Confidence:** 0.95
**Created:** Mon Feb 09 2026 15:20:39 GMT-0300 (Brasilia Standard Time)

---

The `accounts-payable.ts` routes handle GET /reimbursements (linking to `apAgent.listReimbursements()`) and POST /documents/upload (inserting into `ap_documents` table).
