// Lightweight Supabase REST helpers used client-side with anon key.

const supaUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
const supaKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

function authHeaders() {
  return { 'apikey': supaKey, 'Authorization': `Bearer ${supaKey}` };
}

export async function getTopoptArtifacts(runId: string): Promise<Array<any>> {
  if (!supaUrl || !supaKey) {
    console.warn('[supabase] getTopoptArtifacts skipped: missing URL or anon key');
    return [];
  }
  const url = `${supaUrl}/rest/v1/topopt_jobs?run_id=eq.${encodeURIComponent(runId)}&select=*`;
  const res = await fetch(url, { headers: authHeaders(), cache: 'no-store' });
  if (!res.ok) {
    console.warn(`[supabase] getTopoptArtifacts failed: ${res.status}`);
    return [];
  }
  return res.json();
}

export async function getVariantAssets(variantIds: string[]): Promise<Array<{ variant_id: string; url: string }>> {
  if (!supaUrl || !supaKey || !variantIds.length) {
    if (!variantIds.length) return [];
    console.warn('[supabase] getVariantAssets skipped: missing URL or anon key');
    return [];
  }
  const list = variantIds.map((x) => encodeURIComponent(x)).join(',');
  const url = `${supaUrl}/rest/v1/variant_assets?variant_id=in.(${list})&asset_type=eq.image/png&select=variant_id,url`;
  const res = await fetch(url, { headers: authHeaders(), cache: 'no-store' });
  if (!res.ok) {
    console.warn(`[supabase] getVariantAssets failed: ${res.status}`);
    return [];
  }
  return res.json();
}
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const demoMode = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
const disableAuth = process.env.NEXT_PUBLIC_DISABLE_AUTH === 'true' || demoMode;

// When auth is disabled or no Supabase credentials are provided, avoid initializing
// the real client (which triggers failed network refresh attempts) and provide
// lightweight no-op stubs so the rest of the app can render without errors.
export const supabase = !disableAuth && supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey)
  : ({
      auth: {
        getUser: async () => ({ data: { user: null } }),
      },
      from: () => ({
        select: () => ({ data: [], error: null }),
        eq: () => ({ select: () => ({ data: [], error: null }) }),
        insert: () => ({ select: () => ({ data: [], error: null }) }),
        update: () => ({ select: () => ({ data: [], error: null }) }),
        order: () => ({ data: [], error: null }),
        single: () => ({ data: null, error: null }),
      }),
    } as any);

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
  if (disableAuth || !supabaseUrl || !supabaseKey) return [];
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
  if (disableAuth || !supabaseUrl || !supabaseKey) return {
    id: 'stub-project',
    user_id: 'stub-user',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...project,
  } as any;
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
  if (disableAuth || !supabaseUrl || !supabaseKey) return [];
  const { data, error } = await supabase
    .from('runs')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function getRun(runId: string) {
  if (disableAuth || !supabaseUrl || !supabaseKey) return null;
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
  if (disableAuth || !supabaseUrl || !supabaseKey)
    return {
      ...run,
      status: 'completed',
      started_at: new Date().toISOString(),
      finished_at: new Date().toISOString(),
    } as any;
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
  if (disableAuth || !supabaseUrl || !supabaseKey) return { run_id: runId, ...updates } as any;
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
  if (disableAuth || !supabaseUrl || !supabaseKey) return [];
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
  if (disableAuth || !supabaseUrl || !supabaseKey) return { id: 'stub-variant', ...variant } as any;
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
  if (disableAuth || !supabaseUrl || !supabaseKey) return null;
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
  if (disableAuth || !supabaseUrl || !supabaseKey) return { id: 'stub-dfx', ...summary } as any;
  const { data, error } = await supabase
    .from('dfx_summaries')
    .insert([summary])
    .select();
  if (error) throw error;
  return data?.[0];
}
