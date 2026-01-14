-- Migration: add weights_history table for tracking adaptive / manual scoring weight changes
-- Creates table with JSONB columns for previous and new weights and optional rating context.

CREATE TABLE IF NOT EXISTS public.weights_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id text NULL,
  variant_id text NULL,
  previous_weights jsonb NOT NULL,
  new_weights jsonb NOT NULL,
  rating numeric NULL,
  tenant_id text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_weights_history_run_id ON public.weights_history(run_id);
CREATE INDEX IF NOT EXISTS idx_weights_history_variant_id ON public.weights_history(variant_id);
CREATE INDEX IF NOT EXISTS idx_weights_history_created_at ON public.weights_history(created_at DESC);

-- Basic RLS (assuming RLS enabled elsewhere)
ALTER TABLE public.weights_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "weights_history_select_all" ON public.weights_history FOR SELECT USING (true);
CREATE POLICY "weights_history_insert_all" ON public.weights_history FOR INSERT WITH CHECK (true);

-- Note: tighten policies by tenant_id in production.
