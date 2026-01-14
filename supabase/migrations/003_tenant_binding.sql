-- Add tenant_id to projects and runs for multitenancy
-- NOTE: API uses a string tenant id (e.g. 'public'), so keep tenant_id as text.
ALTER TABLE projects ADD COLUMN IF NOT EXISTS tenant_id text;
ALTER TABLE runs ADD COLUMN IF NOT EXISTS tenant_id text;

-- Optional: index for faster tenant filtering
CREATE INDEX IF NOT EXISTS projects_tenant_idx ON projects(tenant_id);
CREATE INDEX IF NOT EXISTS runs_tenant_idx ON runs(tenant_id);
