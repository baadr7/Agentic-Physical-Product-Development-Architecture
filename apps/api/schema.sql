-- Unified Supabase / Postgres schema for Design AI Platform (API-side reference)
-- This mirrors the authoritative migration in supabase/migrations/001_create_schema.sql
-- and is used by the API layer for documentation / local dev introspection.

-- PROJECTS ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,                 -- In production: NOT NULL REFERENCES auth.users(id)
  title TEXT NOT NULL,
  description TEXT,
  product_type TEXT,            -- CHECK in migration version
  brief TEXT,                   -- free-form initial brief
  materials TEXT[],             -- list of material strings
  constraints JSONB,            -- normalized constraints (dimensions, weight, etc.)
  logo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RUNS ----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id VARCHAR(255) NOT NULL UNIQUE,  -- External/public identifier
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  started_at TIMESTAMPTZ DEFAULT now(),
  finished_at TIMESTAMPTZ,
  duration_ms INTEGER,
  parameters JSONB,                     -- user-specified generation parameters
  metadata JSONB,                       -- system-enriched data (DfX summary, model info, etc.)
  created_at TIMESTAMPTZ DEFAULT now()
);

-- VARIANTS ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id VARCHAR(255) REFERENCES runs(run_id) ON DELETE CASCADE,
  stl_url TEXT,
  step_url TEXT,
  thumbnail_url TEXT,
  image_url TEXT,
  metrics JSONB,            -- raw metrics (volume, mass, extents, etc.)
  score DECIMAL(10,2),      -- aggregated multi-objective score
  dfx_analysis TEXT,        -- optional textual analysis per variant
  created_at TIMESTAMPTZ DEFAULT now()
);

-- PROMPTS -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id VARCHAR(255) REFERENCES runs(run_id) ON DELETE CASCADE,
  prompt_text TEXT NOT NULL,
  model VARCHAR(100),
  version INTEGER DEFAULT 1,
  embedding_id VARCHAR(255),           -- placeholder for vector store ref
  created_at TIMESTAMPTZ DEFAULT now()
);

-- EXPORTS -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id VARCHAR(255) REFERENCES runs(run_id) ON DELETE CASCADE,
  pdf_url TEXT,
  zip_url TEXT,
  stl_url TEXT,                         -- consolidated STL bundle
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- DFX SUMMARIES -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dfx_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id UUID REFERENCES variants(id) ON DELETE CASCADE,
  summary TEXT,
  fabricability_score DECIMAL(10,2),
  assemblability_score DECIMAL(10,2),
  sustainability_score DECIMAL(10,2),
  recommendations TEXT[],
  created_at TIMESTAMPTZ DEFAULT now()
);

-- INDEXES (subset — full set in migration file) -----------------------------
CREATE INDEX IF NOT EXISTS idx_runs_project_id ON runs(project_id);
CREATE INDEX IF NOT EXISTS idx_runs_status ON runs(status);
CREATE INDEX IF NOT EXISTS idx_variants_run_id ON variants(run_id);
CREATE INDEX IF NOT EXISTS idx_prompts_run_id ON prompts(run_id);
CREATE INDEX IF NOT EXISTS idx_exports_run_id ON exports(run_id);
CREATE INDEX IF NOT EXISTS idx_dfx_summaries_variant_id ON dfx_summaries(variant_id);

-- NOTE: RLS policies, auth.users foreign keys, and stricter CHECK constraints
-- are applied in the production migration under supabase/migrations/.
-- This file is intentionally permissive for local dev / fast prototyping.
