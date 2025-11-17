import type { Project, Run, Variant } from "~/lib/types";

// If NEXT_PUBLIC_API_BASE_URL is empty or undefined, use relative Next.js route handlers.
const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || '').trim();

function apiUrl(path: string) {
  if (!API_BASE) return path; // relative
  // ensure single slash
  return API_BASE.replace(/\/$/, '') + path;
}

export async function apiGetRuns(): Promise<any[]> {
  const r = await fetch(apiUrl(`/api/v1/runs`), { cache: "no-store" });
  if (!r.ok) throw new Error(`GET /runs failed: ${r.status}`);
  return r.json();
}

export async function apiGetRun(runId: string): Promise<any> {
  const r = await fetch(apiUrl(`/api/v1/runs/${runId}`), { cache: "no-store" });
  if (!r.ok) throw new Error(`GET /runs/${runId} failed: ${r.status}`);
  return r.json();
}

export async function apiGetVariants(runId: string): Promise<Variant[]> {
  const r = await fetch(apiUrl(`/api/v1/runs/${runId}/variants`), { cache: "no-store" });
  if (!r.ok) throw new Error(`GET /runs/${runId}/variants failed: ${r.status}`);
  return r.json();
}

export async function apiCreateRun(body: {
  project_id: string;
  input_mode?: string;
  description?: string;
  constraints?: Record<string, unknown>;
  options?: Record<string, unknown>;
}): Promise<Run> {
  const r = await fetch(apiUrl(`/api/v1/runs`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`POST /runs failed: ${r.status}`);
  const data = await r.json();
  // Map to Run shape
  return {
    id: data.run_id,
    run_id: data.run_id,
    project_id: data.project_id,
    status: data.status,
    started_at: data.created_at,
    finished_at: data.finished_at,
    duration_ms: data.duration_ms,
    parameters: data.options || {},
    metadata: data.metadata || {},
    created_at: data.created_at,
  } as Run;
}

export function apiReportPdfUrl(runId: string) {
  return apiUrl(`/api/v1/runs/${runId}/report.pdf`);
}

export function apiPresignExportUrl() {
  return apiUrl(`/api/v1/exports/presign`);
}

export async function apiGetProjects(): Promise<Project[]> {
  const r = await fetch(apiUrl(`/api/v1/projects`), { cache: "no-store" });
  if (!r.ok) throw new Error(`GET /projects failed: ${r.status}`);
  return r.json();
}

export async function apiGetProject(id: string): Promise<Project | null> {
  const r = await fetch(apiUrl(`/api/v1/projects/${id}`), { cache: "no-store" });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`GET /projects/${id} failed: ${r.status}`);
  return r.json();
}

export async function apiGetRunFull(runId: string): Promise<{
  run: any;
  variants: any[];
  prompts: any[];
}> {
  const r = await fetch(apiUrl(`/api/v1/runs/${runId}/full`), { cache: "no-store" });
  if (!r.ok) throw new Error(`GET /runs/${runId}/full failed: ${r.status}`);
  return r.json();
}

export async function apiCreateProject(body: {
  title: string;
  description?: string;
  product_type?: string;
  brief?: string;
  materials?: string[];
  constraints?: Record<string, unknown>;
  logo_url?: string;
}): Promise<Project> {
  const r = await fetch(apiUrl(`/api/v1/projects`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`POST /projects failed: ${r.status}`);
  return r.json();
}

export async function apiNormalizeBrief(text: string): Promise<{ ok: boolean; data?: any }>{
  const r = await fetch(apiUrl(`/api/v1/llm/normalize-brief`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!r.ok) {
    // 503 when Mistral not configured
    return { ok: false };
  }
  return r.json();
}
