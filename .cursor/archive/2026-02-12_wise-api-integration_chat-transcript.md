# Chat Transcript: wise-api-integration

**Date:** 2026-02-12  
**Topic:** Wise API integration — wiring, UI, save flow, debugging

## Summary

Wired end-to-end Wise API connection for Tulsbot: env vars, agent-spawner, PUT endpoint, Settings UI (Integrations + API Keys). Fixed API Keys "Custom" service error (encryption key handling), added Wise service option. Diagnosed network error as context manager not running; started backend locally. Added debug instrumentation; user confirmed save works. Removed instrumentation.

## Key Changes

### Backend

- **env-schema.ts**: Added `WISE_API_TOKEN`, `WISE_PROFILE_ID`, `WISE_SANDBOX` under Accounts Payable category
- **agent-spawner.ts**: Read `WISE_API_TOKEN` / `WISE_PROFILE_ID` from env when spawning AP agent
- **accounts-payable.ts**: `loadAPConfig()` merges DB + env; `PUT /api/ap/integrations/wise` to save config; `getAPAgent()` uses merged config
- **settings.ts**: `getKeyBuffer()` derives 32-byte key from any string (handles non-hex ENCRYPTION_KEY)
- **routes/settings.ts**: Improved error message in setApiKey catch

### Frontend

- **ApiKeysTab.tsx**: Added Wise to Service dropdown; improved error handling (network vs backend error)
- **IntegrationsTab.tsx**: Wise (Accounts Payable) section — API token, profile ID, sandbox, test, save
- **api.ts**: `getAPIntegrationStatus`, `testWiseConnection`, `saveWiseConfig`

### Flow

1. **API Keys**: Settings → API Keys → Add → Name `WISE_API_TOKEN`, Service `Wise`, token → Save
2. **Integrations**: Settings → Integrations → Wise section → token → Test → Save & connect
3. Requires context manager running on port 3001

## Outcome

User confirmed: "it worked." Wise API key saves successfully via Settings → API Keys.
