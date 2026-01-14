import { NextRequest } from 'next/server';

interface Run {
  run_id: string;
  project_id: string;
  status: string;
  created_at: string;
  finished_at?: string;
  duration_ms?: number;
  options?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

const runs: Run[] = [];

function getFastApiBaseUrl(): string {
  const env = (process.env.NEXT_PUBLIC_API_BASE_URL || process.env.API_BASE_URL || '').trim();
  return env || 'http://127.0.0.1:8000';
}

async function tryProxy(req: NextRequest | null, path: string, init?: RequestInit): Promise<Response | null> {
  const base = getFastApiBaseUrl().replace(/\/$/, '');
  const url = `${base}${path}`;
  try {
    const headers: HeadersInit = {
      ...(init?.headers || {}),
    };
    // Forward auth when present (so multi-tenant setups work).
    if (req) {
      const auth = req.headers.get('authorization');
      if (auth) (headers as any).authorization = auth;
    }
    const upstream = await fetch(url, { ...init, headers, cache: 'no-store' });
    const contentType = upstream.headers.get('content-type') || 'application/json';
    const buf = await upstream.arrayBuffer();
    return new Response(buf, { status: upstream.status, headers: { 'content-type': contentType } });
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const proxied = await tryProxy(req, '/api/v1/runs', { method: 'GET' });
  if (proxied) return proxied;
  // Fallback stub (dev)
  return Response.json(runs);
}

export async function POST(req: NextRequest) {
  // Prefer proxying to FastAPI (real persistence)
  const raw = await req.text();
  const proxied = await tryProxy(req, '/api/v1/runs', {
    method: 'POST',
    headers: { 'content-type': req.headers.get('content-type') || 'application/json' },
    body: raw,
  });
  if (proxied) return proxied;

  // Fallback stub (dev)
  let body: any = {};
  try {
    body = raw ? JSON.parse(raw) : {};
  } catch {
    body = {};
  }
  const run_id = `run-${Math.random().toString(16).slice(2, 10)}`;
  const run: Run = {
    run_id,
    project_id: body.project_id || 'proj-1',
    status: 'completed',
    created_at: new Date().toISOString(),
    finished_at: new Date().toISOString(),
    duration_ms: 1200,
    options: body.options || {},
    metadata: { dfx_summary: 'Synthèse DfX (stub)' },
  };
  runs.unshift(run);
  return Response.json({ run_id, status: run.status, project_id: run.project_id, created_at: run.created_at });
}

export { runs };