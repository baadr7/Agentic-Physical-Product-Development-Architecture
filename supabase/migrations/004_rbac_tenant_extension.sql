-- Migration 004: RBAC & Tenant Extension
-- Adds tenant_id columns, audit_log persistence, settings/materials, variant_assets, fem_jobs, run_lineage tables.
-- Strengthens RLS with tenant scoping policies.

-- 1. Add tenant_id to core tables if missing
ALTER TABLE projects ADD COLUMN IF NOT EXISTS tenant_id text;
ALTER TABLE runs ADD COLUMN IF NOT EXISTS tenant_id text;
ALTER TABLE variants ADD COLUMN IF NOT EXISTS tenant_id text;
ALTER TABLE prompts ADD COLUMN IF NOT EXISTS tenant_id text;
ALTER TABLE exports ADD COLUMN IF NOT EXISTS tenant_id text;
ALTER TABLE dfx_summaries ADD COLUMN IF NOT EXISTS tenant_id text;
ALTER TABLE feedback_history ADD COLUMN IF NOT EXISTS tenant_id text;
ALTER TABLE weights_history ADD COLUMN IF NOT EXISTS tenant_id text;

-- 2. Materials table
CREATE TABLE IF NOT EXISTS materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NULL, -- null indicates global material
  name text NOT NULL,
  density_kg_m3 numeric,
  youngs_modulus_gpa numeric,
  poisson_ratio numeric,
  emission_factor_kg_co2e numeric, -- sustainability
  properties jsonb,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE materials ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY materials_select ON materials FOR SELECT USING (tenant_id IS NULL OR tenant_id = current_setting('request.jwt.claim.tenant', true));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY materials_insert ON materials FOR INSERT WITH CHECK (tenant_id = current_setting('request.jwt.claim.tenant', true));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. Settings table (per-tenant thresholds / normalization baselines)
CREATE TABLE IF NOT EXISTS tenant_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  key text NOT NULL,
  value jsonb NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (tenant_id, key)
);
ALTER TABLE tenant_settings ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY tenant_settings_select ON tenant_settings FOR SELECT USING (tenant_id = current_setting('request.jwt.claim.tenant', true));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY tenant_settings_upsert ON tenant_settings FOR ALL USING (tenant_id = current_setting('request.jwt.claim.tenant', true)) WITH CHECK (tenant_id = current_setting('request.jwt.claim.tenant', true));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 4. Variant assets table (hash provenance)
CREATE TABLE IF NOT EXISTS variant_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id uuid NOT NULL REFERENCES variants(id) ON DELETE CASCADE,
  tenant_id text,
  asset_type text NOT NULL CHECK (asset_type IN ('stl','step','fem-mesh','fem-stress','image','pdf','zip')),
  url text,
  sha256 text,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE variant_assets ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY variant_assets_select ON variant_assets FOR SELECT USING (tenant_id = current_setting('request.jwt.claim.tenant', true));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY variant_assets_insert ON variant_assets FOR INSERT WITH CHECK (tenant_id = current_setting('request.jwt.claim.tenant', true));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 5. FEM jobs table
CREATE TABLE IF NOT EXISTS fem_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id varchar(255) NOT NULL REFERENCES runs(run_id) ON DELETE CASCADE,
  variant_id uuid REFERENCES variants(id) ON DELETE SET NULL,
  tenant_id text,
  status text NOT NULL CHECK (status IN ('queued','running','completed','failed')),
  parameters jsonb,
  results jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE fem_jobs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY fem_jobs_select ON fem_jobs FOR SELECT USING (tenant_id = current_setting('request.jwt.claim.tenant', true));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY fem_jobs_insert ON fem_jobs FOR INSERT WITH CHECK (tenant_id = current_setting('request.jwt.claim.tenant', true));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 6. Run lineage table
CREATE TABLE IF NOT EXISTS run_lineage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text,
  source_type text NOT NULL,
  source_id text NOT NULL,
  target_type text NOT NULL,
  target_id text NOT NULL,
  relation text NOT NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE run_lineage ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY run_lineage_select ON run_lineage FOR SELECT USING (tenant_id = current_setting('request.jwt.claim.tenant', true));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY run_lineage_insert ON run_lineage FOR INSERT WITH CHECK (tenant_id = current_setting('request.jwt.claim.tenant', true));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 7. Audit log table with hash chain
CREATE TABLE IF NOT EXISTS audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text,
  user_id text,
  role text,
  event text NOT NULL,
  path text,
  extra jsonb,
  ts timestamptz DEFAULT now(),
  prev_hash text,
  hash text
);
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY audit_log_select ON audit_log FOR SELECT USING (tenant_id = current_setting('request.jwt.claim.tenant', true));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY audit_log_insert ON audit_log FOR INSERT WITH CHECK (tenant_id = current_setting('request.jwt.claim.tenant', true));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 8. Helper function to compute hash (simple sha256 over concatenated fields)
CREATE OR REPLACE FUNCTION audit_log_compute_hash() RETURNS trigger AS $$
DECLARE
  data text;
BEGIN
  data := COALESCE(NEW.tenant_id,'') || '|' || COALESCE(NEW.user_id,'') || '|' || COALESCE(NEW.role,'') || '|' || NEW.event || '|' || COALESCE(NEW.path,'') || '|' || COALESCE(NEW.prev_hash,'') || '|' || to_char(NEW.ts,'YYYY-MM-DD"T"HH24:MI:SS.USZ');
  NEW.hash := encode(digest(data,'sha256'),'hex');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_log_hash_trigger BEFORE INSERT ON audit_log FOR EACH ROW EXECUTE FUNCTION audit_log_compute_hash();

-- 9. Update triggers for fem_jobs
CREATE OR REPLACE FUNCTION fem_jobs_touch_updated() RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER fem_jobs_touch BEFORE UPDATE ON fem_jobs FOR EACH ROW EXECUTE FUNCTION fem_jobs_touch_updated();

-- NOTE: In Supabase PostgREST environments, expose tenant claim into request.jwt.claim.tenant via JWT configuration.
-- Further tightening: replace permissive feedback/weights policies with tenant match.

-- 10. Tighten feedback_history & weights_history policies if they were permissive
DROP POLICY IF EXISTS feedback_history_select ON feedback_history;
DROP POLICY IF EXISTS feedback_history_insert ON feedback_history;
CREATE POLICY feedback_history_select ON feedback_history FOR SELECT USING (tenant_id = current_setting('request.jwt.claim.tenant', true));
CREATE POLICY feedback_history_insert ON feedback_history FOR INSERT WITH CHECK (tenant_id = current_setting('request.jwt.claim.tenant', true));

DROP POLICY IF EXISTS weights_history_select_all ON weights_history;
DROP POLICY IF EXISTS weights_history_insert_all ON weights_history;
CREATE POLICY weights_history_select ON weights_history FOR SELECT USING (tenant_id = current_setting('request.jwt.claim.tenant', true));
CREATE POLICY weights_history_insert ON weights_history FOR INSERT WITH CHECK (tenant_id = current_setting('request.jwt.claim.tenant', true));
