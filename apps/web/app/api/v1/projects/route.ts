import { NextRequest } from 'next/server';

interface Project {
  id: string;
  title: string;
  description?: string;
  product_type?: string;
  brief?: string;
  materials?: string[];
  constraints?: Record<string, unknown>;
  logo_url?: string;
  created_at: string;
}

const projects: Project[] = [];

function getFastApiBaseUrl(): string {
  const env = (process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || '').trim();
  return env || 'http://127.0.0.1:8000';
}

async function tryProxy(req: NextRequest | null, path: string, init?: RequestInit): Promise<Response | null> {
  const base = getFastApiBaseUrl().replace(/\/$/, '');
  const url = `${base}${path}`;
  try {
    const headers: HeadersInit = {
      ...(init?.headers || {}),
    };
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
  const proxied = await tryProxy(req, '/api/v1/projects', { method: 'GET' });
  if (proxied) return proxied;
  return Response.json(projects);
}

export async function POST(req: NextRequest) {
  const raw = await req.text();
  const proxied = await tryProxy(req, '/api/v1/projects', {
    method: 'POST',
    headers: { 'content-type': req.headers.get('content-type') || 'application/json' },
    body: raw,
  });
  if (proxied) return proxied;

  let body: any = {};
  try {
    body = raw ? JSON.parse(raw) : {};
  } catch {
    body = {};
  }

  const id = (globalThis.crypto as any)?.randomUUID?.() || `00000000-0000-4000-8000-${Math.random().toString(16).slice(2).padEnd(12, '0').slice(0, 12)}`;
  const project: Project = {
    id,
    title: body.title || 'Sans titre',
    description: body.description,
    product_type: body.product_type || 'other',
    brief: body.brief,
    materials: body.materials || [],
    constraints: body.constraints || {},
    logo_url: body.logo_url,
    created_at: new Date().toISOString(),
  };
  projects.unshift(project);
  return Response.json(project, { status: 201 });
}

export { projects };
