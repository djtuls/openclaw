# Environment Variable Documentation

**Type:** documentation
**Tier:** permanent
**Confidence:** 0.50
**Created:** Wed Feb 11 2026 09:06:54 GMT-0300 (Brasilia Standard Time)

---

# .env Document Availability

This page records how the `.env` configuration document is kept accessible both locally and via the Supabase-powered Env Vault when the system runs in online mode. Keep this file and the `.env` sources synchronized so agents and services can load secrets regardless of deployment context.

## Local access (default)

1. Start with `./.env.example` as the canonical reference for all required and optional variables. This ensures every environment variable has a documented name, default, and short description directly in the repository.
2. Copy the template into `./.env` and fill in the secrets for your workstation or staging environment:
   ```bash
   cp .env.example .env
   # Edit .env with secure values (ANON/API keys, port overrides, database URLs, etc.)
   ```
   - Keep `.env` git-ignored; the repository only stores the template and documentation.
   - Support overrides by optionally creating `.env.local` for machine-specific tweaks.
3. Services load the local file during startup via `dotenv` utilities (e.g., `services/context-manager/src/env-loader.ts`), so the boots rely on the local copy whenever `TULSBOT_ONLINE_MODE` is unset or `false`.

## Supabase vault (online mode)

When `TULSBOT_ONLINE_MODE=true`, the stack switches to the Env Vault System. That service mirrors the `.env` content into Supabase Storage so online hosts can pull configuration without bundling the secrets in the repo.

### Prep work

- Ensure the following environment variables are set locally before any vault operation:
  - `SUPABASE_URL` – your Supabase project endpoint
  - `SUPABASE_SERVICE_KEY` (preferred) or `SUPABASE_ANON_KEY`
  - `ENCRYPTION_KEY` – 64 hex characters generated with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- Confirm a storage bucket named `tulsbot-vault` exists in Supabase Storage with access rules that allow uploads using the service role key.

### Syncing the document

1. Use the Env Vault API to upload the local `.env` or `.env.local` contents:
   ```bash
   curl -X POST http://localhost:3001/api/env-vault/sync-to-vault \
     -H "Content-Type: application/json" \
     -d '{"envFile": ".env"}'
   ```
2. Vault uploads encrypt the file with AES-256-CBC and record the hash in `env_vault_sync`. Repeat for `.env.local` if needed by changing the `envFile` value.
3. The API responds with the sync status for each file; include the `vault_hash` in the response for auditability.

### Loading from Supabase

1. Set `TULSBOT_ONLINE_MODE=true` in whichever environment launches the services.
2. On startup, the Env Loader checks vault readiness. If no local `.env` exists or online mode is enabled, it fetches the encrypted file, decrypts it, merges values into `process.env`, and leaves local files untouched.
3. To force a download and overwrite the local copy (useful for bootstrapping a new machine), call:
   ```bash
   curl -X POST http://localhost:3001/api/env-vault/sync-from-vault \
     -H "Content-Type: application/json" \
     -d '{"writeToLocal": true}'
   ```

## Verifying availability

- Check vault status at any time:
  ```bash
  curl http://localhost:3001/api/env-vault/status
  ```
- Confirm Supabase Storage contains the encrypted blob(s) by browsing the `tulsbot-vault` bucket in the Supabase dashboard or using the Supabase CLI/SDK.
- Review the `env_vault_sync` table via `psql` for upload/download history.

## Security notes

- Never log the decrypted `.env` contents; treat the Supabase blob just like secrets in `.env`.
- The service role key stored in `SUPABASE_SERVICE_KEY` must stay secret. Rotate it if suspected of compromise.
- Local `.env` overrides always take precedence when both local and vault values exist, so physical access to the VM still controls the runtime configuration.

## Quick summary

| Mode | Source | Accessibility |
|------|--------|---------------|
| Local | `./.env`, `./.env.local` | Immediate from repo + machine<br>--- Documented in `.env.example` and this markdown file<br>--- Loaded automatically by Node.js services unless online mode is forced |
| Online | Supabase vault (`tulsbot-vault`) | Remote, encrypted copies kept in Supabase Storage<br>--- Synced via `/api/env-vault/sync-to-vault`<br>--- Loaded via `/api/env-vault/sync-from-vault` or on boot when `TULSBOT_ONLINE_MODE=true` |

Keeping this document in the repository ensures the `.env` configuration is discoverable locally while the Env Vault System mirrors the same content into Supabase Storage for online deployments.

