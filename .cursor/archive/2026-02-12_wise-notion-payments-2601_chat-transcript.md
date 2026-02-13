# Chat Transcript — Wise, Notion & Project 2601 Payments

**Date:** 2026-02-12  
**Topic:** Wise API connection, recipients export, Notion Contracts-Payments view, project 2601 payments extraction to CSV

---

## Summary

1. **Wise connection** — Connected to Wise API using token from api_keys ("Wise API"). Tested profiles (personal: Marcos Ferro; business: The Live Engine Inc.), balances, and recipients.

2. **Live Engine recipients** — Extracted 83 Wise recipients for The Live Engine Inc. (profile 9010020).

3. **Recipients to File Cabinet** — Saved recipients as CSV (`wise-recipients-live-engine-2026-02-12.csv`) to File Cabinet (local Drive sync path).

4. **Notion Contracts-Payments view** — Read page structure via API. Page has sections: Contracts, Recon, Payments (each with linked databases). APIs cannot retrieve linked-database schema.

5. **Project 2601 payments extraction** — Extracted total amount to pay in USD for project 2601 (2601_2: AFC U23 Asian Cup_AFC Content, most recent). 15 payment rows, total $1,447.05. Saved to File Cabinet: `payments-project-2601-2026-02-12.csv`.

---

## Key Scripts Created/Used

| Script | Purpose |
|--------|---------|
| `Tulsbot/services/context-manager/scripts/test-wise-connection.ts` | Test Wise API, list profiles/balances/recipients |
| `Tulsbot/services/context-manager/scripts/wise-recipients-to-file-cabinet.ts` | Export recipients to CSV in File Cabinet |
| `Tulsbot/services/context-manager/scripts/extract-payments-2601.ts` | Extract payments for project 2601 to CSV |
| `Tulsbot/services/context-manager/scripts/find-project-2601.ts` | Find most recent 2601 AFC project by created_time |

---

## Project 2601 IDs

- **2601_2: AFC U23 Asian Cup_AFC Content** (most recent, 2025-12): `2cd51bf9-731e-8008-a7d9-e5d97a96ecd2`
- **2601_AFC U23 Asian Cup** (older): `27d51bf9731e80f68bdbd670ad4d66b5`

---

## Data Sources

- **Payments DB** — `da4195cb-d5ea-4660-8791-62bb0da24c50` (Project relation, Total - USD)
- **Payments 2025** — `1a451bf9-731e-806c-a35d-cd96f29ec044` (Event 1 relation, Wise - total USD)
- **Contracts Recon** — `29651bf9-731e-805b-bbf4-ff3ce4624ed7` (Project Grid relation)
