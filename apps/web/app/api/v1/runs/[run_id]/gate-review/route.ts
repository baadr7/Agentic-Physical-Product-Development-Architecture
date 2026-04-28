import { NextRequest } from 'next/server';

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

export async function GET(req: NextRequest, { params }: { params: { run_id: string } }) {
  const url = new URL(req.url);
  const variantId = url.searchParams.get('variant_id');
  const qs = variantId ? `?variant_id=${encodeURIComponent(variantId)}` : '';
  const proxied = await tryProxy(req, `/api/v1/runs/${params.run_id}/gate-review${qs}`, { method: 'GET' });
  if (proxied) return proxied;
  return Response.json({ detail: 'FastAPI unavailable' }, { status: 503 });
}
