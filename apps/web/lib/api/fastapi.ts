import type { Project, Run, Variant } from "~/lib/types";

const DEV_FALLBACK = 'http://127.0.0.1:8000';

export function getApiBaseUrl(): string {
  // Browser-side default: use the Next.js route handlers under /app/api/**.
  // This avoids cross-origin (CORS) issues by keeping requests same-origin.
  // IMPORTANT: Even if NEXT_PUBLIC_API_BASE_URL is set, we keep browser calls
  // same-origin so the app works when accessed via LAN IP (e.g. 192.168.x.x).
  // Otherwise, a browser on another device would try to call 127.0.0.1:8000
  // on *its own* device and fail with "Failed to fetch".
  if (typeof window !== 'undefined') return '';

  const explicit = (process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || '').trim();
  if (explicit) return explicit;

  // Server-side fallback: call FastAPI directly in development.
  // (Relative URLs are not supported by Node fetch.)
  if (process.env.NODE_ENV === 'development') return (process.env.API_BASE_URL || DEV_FALLBACK).trim();

  return '';
}

function apiUrl(path: string) {
  const base = getApiBaseUrl();
  if (!base) return path; // relative to Next.js (requires matching route handler)
  return base.replace(/\/$/, '') + path; // ensure no trailing slash duplication
}

type FetchInit = RequestInit & { timeoutMs?: number };

async function doFetch<T = any>(path: string, init?: FetchInit): Promise<T> {
  const timeoutMs = (init?.timeoutMs ?? 60_000) as number;
  const { timeoutMs: _timeout, ...fetchInit } = (init || {}) as FetchInit;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const url = apiUrl(path);
    const res = await fetch(url, { cache: 'no-store', signal: controller.signal, ...fetchInit });
    if (!res.ok) {
      // Common pitfall in local runs: missing NEXT_PUBLIC_API_BASE_URL causes the
      // browser to call Next.js instead of FastAPI (leading to 404).
      if (res.status === 404 && !getApiBaseUrl() && typeof window !== 'undefined') {
        throw new Error(
          `${init?.method || 'GET'} ${path} failed: 404. The Next.js API route handler is missing. ` +
          `Either add the matching route under apps/web/app/api/** or set NEXT_PUBLIC_API_BASE_URL (e.g. http://127.0.0.1:8000) to call FastAPI directly.`
        );
      }
      throw new Error(`${init?.method || 'GET'} ${path} failed: ${res.status}`);
    }
    return res.json();
  } catch (e: any) {
    if (e?.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeoutMs}ms: ${init?.method || 'GET'} ${path}`);
    }
    // Surface network (Failed to fetch / CORS) separately for easier debugging.
    if (e?.message?.includes('Failed to fetch')) {
      const base = getApiBaseUrl() || '(using Next.js proxy)';
      throw new Error(
        `Network error calling API (${apiUrl(path)}): ${e.message}. ` +
        `If calling FastAPI directly, check NEXT_PUBLIC_API_BASE_URL (current: ${base}) and ensure FastAPI is on port 8000. ` +
        `If using the Next.js proxy, ensure the web dev server is running and /app/api/** routes exist.`
      );
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

export async function apiGetRuns(): Promise<any[]> {
  return doFetch(`/api/v1/runs`);
}

export async function apiGetRun(runId: string): Promise<any> {
  return doFetch(`/api/v1/runs/${runId}`);
}

export async function apiGetVariants(runId: string): Promise<Variant[]> {
  return doFetch(`/api/v1/runs/${runId}/variants`);
}

export async function apiGenerateVariants(
  runId: string,
  body: { count?: number; width?: number; height?: number; seed?: number; guidance_scale?: number; steps?: number; include_image_b64?: boolean; enqueue?: boolean }
): Promise<any> {
  return doFetch(`/api/v1/runs/${runId}/generate-variants`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
    // Variant generation can take longer; allow a more generous timeout.
    timeoutMs: 5 * 60_000,
  });
}

export async function apiCreateRun(body: {
  project_id: string;
  input_mode?: string;
  description?: string;
  constraints?: Record<string, unknown>;
  options?: Record<string, unknown>;
}): Promise<Run> {
  const data = await doFetch(`/api/v1/runs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
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
  return doFetch(`/api/v1/projects`);
}

export async function apiGetProject(id: string): Promise<Project | null> {
  try {
    return await doFetch(`/api/v1/projects/${id}`);
  } catch (e: any) {
    if (e.message?.includes(' 404')) return null;
    throw e;
  }
}

export async function apiGetRunFull(runId: string): Promise<{ run: any; variants: any[]; prompts: any[]; }> {
  return doFetch(`/api/v1/runs/${runId}/full`);
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
  return doFetch(`/api/v1/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function apiDeleteProject(projectId: string): Promise<{ ok: boolean; project_id?: string }> {
  return doFetch(`/api/v1/projects/${projectId}`, {
    method: 'DELETE',
    timeoutMs: 60_000,
  });
}

export async function apiNormalizeBrief(text: string): Promise<{ ok: boolean; data?: any }>{
  try {
    return await doFetch(`/api/v1/llm/normalize-brief`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
  } catch (e: any) {
    // 503 or network errors when LLM not configured
    return { ok: false };
  }
}

// Generate an image and return either a blob URL (when the server returns image/*)
// or the parsed JSON response (when the server returns JSON with image_b64).
export async function apiGenerateImage(body: { prompt: string; width?: number; height?: number; steps?: number; guidance_scale?: number; sketch_id?: string; model?: string; }): Promise<{ blobUrl?: string; json?: any }>{
  const url = apiUrl('/api/v1/diffusion/generate');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000);
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', 'Accept': 'image/png, application/octet-stream, application/json' },
      body: JSON.stringify(body),
    });
  } catch (e: any) {
    if (e?.name === 'AbortError') {
      throw new Error('Preview request timed out after 60000ms');
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
  const contentType = res.headers.get('Content-Type') || '';
  if (contentType.startsWith('image/')) {
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    // Propagate persistence headers when present
    const persisted = res.headers.get('X-Persisted') === '1';
    const publicUrl = res.headers.get('X-Public-Url') || '';
    return { blobUrl, json: { persisted, public_url: publicUrl } };
  }
  // fallback to JSON
  const json = await res.json();
  return { json };
}
