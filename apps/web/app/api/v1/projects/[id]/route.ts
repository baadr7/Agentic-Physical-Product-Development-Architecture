import { NextRequest } from 'next/server';

import { projects } from '../route';

function getFastApiBaseUrl(): string {
  const env = (process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || '').trim();
  return env || 'http://127.0.0.1:8000';
}

async function tryProxy(req: NextRequest, path: string, init?: RequestInit): Promise<Response | null> {
  const base = getFastApiBaseUrl().replace(/\/$/, '');
  const url = `${base}${path}`;
  try {
    const headers: HeadersInit = {
      ...(init?.headers || {}),
    };
    const auth = req.headers.get('authorization');
    if (auth) (headers as any).authorization = auth;

    const upstream = await fetch(url, { ...init, headers, cache: 'no-store' });
    const contentType = upstream.headers.get('content-type') || 'application/json';
    const buf = await upstream.arrayBuffer();
    return new Response(buf, { status: upstream.status, headers: { 'content-type': contentType } });
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const proxied = await tryProxy(req, `/api/v1/projects/${encodeURIComponent(id)}`, { method: 'GET' });
  if (proxied) return proxied;

  const found = projects.find((p) => p.id === id);
  if (!found) return Response.json({ detail: 'Not Found' }, { status: 404 });
  return Response.json(found);
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const proxied = await tryProxy(req, `/api/v1/projects/${encodeURIComponent(id)}`, { method: 'DELETE' });
  if (proxied) return proxied;

  const idx = projects.findIndex((p) => p.id === id);
  if (idx >= 0) projects.splice(idx, 1);
  return Response.json({ ok: true, project_id: id });
}
