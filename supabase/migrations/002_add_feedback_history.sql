-- Migration: Add feedback_history table for adaptive weighting
CREATE TABLE IF NOT EXISTS feedback_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id UUID REFERENCES variants(id) ON DELETE CASCADE,
  run_id VARCHAR(255) REFERENCES runs(run_id) ON DELETE CASCADE,
  rating DECIMAL(4,2) NOT NULL,
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  tenant_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_feedback_history_run_id ON feedback_history(run_id);
CREATE INDEX IF NOT EXISTS idx_feedback_history_variant_id ON feedback_history(variant_id);

-- RLS policies (adjust tenant scoping if tenant_id utilized)
ALTER TABLE feedback_history ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "feedback_history_select" ON feedback_history FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "feedback_history_insert" ON feedback_history FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "feedback_history_update" ON feedback_history FOR UPDATE USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
