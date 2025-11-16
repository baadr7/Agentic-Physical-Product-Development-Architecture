import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Get current user
 */
export async function getCurrentUser() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/**
 * Projects API
 */
export async function getProjects() {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

export async function getProject(id: string) {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

export async function createProject(project: {
  title: string;
  description: string;
  product_type: string;
  brief: string;
  materials?: string[];
}) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('projects')
    .insert([
      {
        ...project,
        user_id: user.id,
      },
    ])
    .select();

  if (error) throw error;
  return data?.[0];
}

/**
 * Runs API
 */
export async function getRuns(projectId: string) {
  const { data, error } = await supabase
    .from('runs')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

export async function getRun(runId: string) {
  const { data, error } = await supabase
    .from('runs')
    .select('*')
    .eq('run_id', runId)
    .single();

  if (error) throw error;
  return data;
}

export async function createRun(run: {
  run_id: string;
  project_id: string;
  parameters: Record<string, unknown>;
}) {
  const { data, error } = await supabase
    .from('runs')
    .insert([
      {
        ...run,
        status: 'pending',
      },
    ])
    .select();

  if (error) throw error;
  return data?.[0];
}

export async function updateRun(
  runId: string,
  updates: Record<string, unknown>
) {
  const { data, error } = await supabase
    .from('runs')
    .update(updates)
    .eq('run_id', runId)
    .select();

  if (error) throw error;
  return data?.[0];
}

/**
 * Variants API
 */
export async function getVariants(runId: string) {
  const { data, error } = await supabase
    .from('variants')
    .select('*')
    .eq('run_id', runId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

export async function createVariant(variant: {
  run_id: string;
  thumbnail_url: string;
  image_url?: string;
  stl_url?: string;
  metrics: Record<string, unknown>;
  score: number;
}) {
  const { data, error } = await supabase
    .from('variants')
    .insert([variant])
    .select();

  if (error) throw error;
  return data?.[0];
}

/**
 * DfX Summary API
 */
export async function getDfxSummary(variantId: string) {
  const { data, error } = await supabase
    .from('dfx_summaries')
    .select('*')
    .eq('variant_id', variantId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function createDfxSummary(summary: {
  variant_id: string;
  summary: string;
  fabricability_score: number;
  assemblability_score: number;
  sustainability_score: number;
  recommendations: string[];
}) {
  const { data, error } = await supabase
    .from('dfx_summaries')
    .insert([summary])
    .select();

  if (error) throw error;
  return data?.[0];
}
