# Security, RBAC, and Compliance

This document summarizes the security model and operational controls for the Generative Design SaaS.

- Roles (RBAC): Admin, Designer, Reviewer, Reader.
- Tenancy: all records carry `user_id` / `tenant_id` and are protected by Supabase RLS.
- Secrets: never committed; loaded from environment or secret store.
- Networking: TLS everywhere in staging/prod; restrict egress for workers.
- Audit: API access and data mutations logged; optional object storage access logs.

## Supabase RLS (high level)
- Projects, runs, variants, prompts, exports, dfx_summaries: `tenant_id` or `user_id` required.
- Policies (typical):
  - `select`: allowed when row.tenant_id = auth.tenant_id.
  - `insert/update/delete`: allowed for roles `admin` or `editor` within tenant.

See `supabase/migrations/001_create_schema.sql` for concrete policies.

## Secrets & Configuration
- `SUPABASE_URL`, `SUPABASE_KEY` (service role for server-to-server only), `MISTRAL_API_KEY`, `MLFLOW_TRACKING_URI`.
- Worker-only tokens are scoped to the worker container; never exposed to browser.

## Data Handling
- PII minimized; anonymize datasets for training.
- Object storage: encrypt at rest; signed URLs limited to short TTL (≤ 15 minutes).
- Backups: daily snapshots; retention 14 days (90 for critical exports).

## Threats & Mitigations
- Multitenant data leak: strict RLS + unit tests; avoid service role exposure in client.
- Prompt injection: sanitize inputs; restrict tool access in LLM chains.
- Model misuse/content risk: add LLM output filtering step for unsafe content.

## Compliance
- GDPR: export/delete on request; log access; configure data residency via provider.
