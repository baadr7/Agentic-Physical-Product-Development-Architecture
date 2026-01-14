-- Migration 005: Align schema with apps/api payloads
-- This repo's FastAPI layer uses tenant_id (text) and statuses like 'queued'.
-- It also stores exports as (kind, url) and allows projects without brief/user_id.

-- 1) Projects: allow API inserts without auth.users FK
ALTER TABLE projects ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE projects ALTER COLUMN brief DROP NOT NULL;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS tenant_id text;

-- Prefer uniqueness by tenant + title (drop old unique if present)
DO $$ BEGIN
  ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_user_id_title_key;
EXCEPTION WHEN undefined_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE projects ADD CONSTRAINT projects_tenant_title_key UNIQUE (tenant_id, title);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) Runs: add fields used by API and accept 'queued'
ALTER TABLE runs ADD COLUMN IF NOT EXISTS tenant_id text;
ALTER TABLE runs ADD COLUMN IF NOT EXISTS input_mode text;
ALTER TABLE runs ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE runs ADD COLUMN IF NOT EXISTS constraints jsonb;

-- Replace status check constraint to include 'queued'
DO $$ BEGIN
  ALTER TABLE runs DROP CONSTRAINT IF EXISTS runs_status_check;
EXCEPTION WHEN undefined_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE runs ADD CONSTRAINT runs_status_check
    CHECK (status IN ('queued','pending','processing','completed','failed'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3) Variants / prompts / exports / dfx_summaries: add tenant_id (used by API)
ALTER TABLE variants ADD COLUMN IF NOT EXISTS tenant_id text;
ALTER TABLE prompts ADD COLUMN IF NOT EXISTS tenant_id text;
ALTER TABLE exports ADD COLUMN IF NOT EXISTS tenant_id text;
ALTER TABLE dfx_summaries ADD COLUMN IF NOT EXISTS tenant_id text;

-- 4) Exports: API writes (kind, url)
ALTER TABLE exports ADD COLUMN IF NOT EXISTS kind text;
ALTER TABLE exports ADD COLUMN IF NOT EXISTS url text;

-- 5) Helpful indexes
CREATE INDEX IF NOT EXISTS projects_tenant_idx ON projects(tenant_id);
CREATE INDEX IF NOT EXISTS runs_tenant_idx ON runs(tenant_id);
CREATE INDEX IF NOT EXISTS variants_tenant_idx ON variants(tenant_id);
CREATE INDEX IF NOT EXISTS prompts_tenant_idx ON prompts(tenant_id);
CREATE INDEX IF NOT EXISTS exports_tenant_idx ON exports(tenant_id);
CREATE INDEX IF NOT EXISTS dfx_summaries_tenant_idx ON dfx_summaries(tenant_id);
