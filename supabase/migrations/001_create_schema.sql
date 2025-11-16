-- Supabase SQL Schema for Design AI Platform
-- Run this in Supabase SQL Editor

-- Users table (usually auto-created by Supabase Auth, but we'll reference it)
-- CREATE TABLE auth.users ... (handled by Supabase)

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  product_type VARCHAR(50) NOT NULL CHECK (product_type IN ('furniture', 'electronics', 'mechanical', 'other')),
  brief TEXT NOT NULL,
  materials TEXT[],
  constraints JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, title)
);

CREATE INDEX idx_projects_user_id ON projects(user_id);
CREATE INDEX idx_projects_created_at ON projects(created_at DESC);

-- Runs table
CREATE TABLE IF NOT EXISTS runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id VARCHAR(255) NOT NULL UNIQUE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  finished_at TIMESTAMP WITH TIME ZONE,
  duration_ms INTEGER,
  parameters JSONB,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_runs_project_id ON runs(project_id);
CREATE INDEX idx_runs_status ON runs(status);
CREATE INDEX idx_runs_created_at ON runs(created_at DESC);

-- Variants table (results of runs)
CREATE TABLE IF NOT EXISTS variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id VARCHAR(255) NOT NULL REFERENCES runs(run_id) ON DELETE CASCADE,
  stl_url TEXT,
  step_url TEXT,
  thumbnail_url TEXT NOT NULL,
  image_url TEXT,
  metrics JSONB,
  score DECIMAL(10, 2),
  dfx_analysis TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_variants_run_id ON variants(run_id);

-- Prompts table
CREATE TABLE IF NOT EXISTS prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id VARCHAR(255) NOT NULL REFERENCES runs(run_id) ON DELETE CASCADE,
  prompt_text TEXT NOT NULL,
  model VARCHAR(100),
  version INTEGER DEFAULT 1,
  embedding_id VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_prompts_run_id ON prompts(run_id);

-- Exports table
CREATE TABLE IF NOT EXISTS exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id VARCHAR(255) NOT NULL REFERENCES runs(run_id) ON DELETE CASCADE,
  pdf_url TEXT,
  zip_url TEXT,
  stl_url TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_exports_run_id ON exports(run_id);

-- DfX Summary table
CREATE TABLE IF NOT EXISTS dfx_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id UUID NOT NULL REFERENCES variants(id) ON DELETE CASCADE,
  summary TEXT,
  fabricability_score DECIMAL(10, 2),
  assemblability_score DECIMAL(10, 2),
  sustainability_score DECIMAL(10, 2),
  recommendations TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_dfx_summaries_variant_id ON dfx_summaries(variant_id);

-- Enable Row Level Security (RLS)
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE exports ENABLE ROW LEVEL SECURITY;
ALTER TABLE dfx_summaries ENABLE ROW LEVEL SECURITY;

-- RLS Policies (users can only see their own projects and related data)
CREATE POLICY "Users can view their own projects" ON projects
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own projects" ON projects
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own projects" ON projects
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own projects" ON projects
  FOR DELETE USING (auth.uid() = user_id);

-- Similar policies for runs (via project relationship)
CREATE POLICY "Users can view their own runs" ON runs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM projects WHERE projects.id = runs.project_id AND projects.user_id = auth.uid())
  );

CREATE POLICY "Users can view their own variants" ON variants
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM runs 
      JOIN projects ON projects.id = runs.project_id
      WHERE runs.run_id = variants.run_id AND projects.user_id = auth.uid()
    )
  );

-- Prompts policies
CREATE POLICY "Users can view their own prompts" ON prompts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM runs
      JOIN projects ON projects.id = runs.project_id
      WHERE runs.run_id = prompts.run_id AND projects.user_id = auth.uid()
    )
  );
CREATE POLICY "Users can insert their own prompts" ON prompts
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM runs
      JOIN projects ON projects.id = runs.project_id
      WHERE runs.run_id = prompts.run_id AND projects.user_id = auth.uid()
    )
  );

-- Exports policies
CREATE POLICY "Users can view their own exports" ON exports
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM runs
      JOIN projects ON projects.id = runs.project_id
      WHERE runs.run_id = exports.run_id AND projects.user_id = auth.uid()
    )
  );
CREATE POLICY "Users can insert their own exports" ON exports
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM runs
      JOIN projects ON projects.id = runs.project_id
      WHERE runs.run_id = exports.run_id AND projects.user_id = auth.uid()
    )
  );

-- DfX summaries policies
CREATE POLICY "Users can view their own dfx summaries" ON dfx_summaries
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM variants
      JOIN runs ON runs.run_id = variants.run_id
      JOIN projects ON projects.id = runs.project_id
      WHERE variants.id = dfx_summaries.variant_id AND projects.user_id = auth.uid()
    )
  );
CREATE POLICY "Users can insert their own dfx summaries" ON dfx_summaries
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM variants
      JOIN runs ON runs.run_id = variants.run_id
      JOIN projects ON projects.id = runs.project_id
      WHERE variants.id = dfx_summaries.variant_id AND projects.user_id = auth.uid()
    )
  );

-- Trigger to update projects.updated_at
CREATE OR REPLACE FUNCTION update_project_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER projects_update_timestamp
BEFORE UPDATE ON projects
FOR EACH ROW
EXECUTE FUNCTION update_project_timestamp();
