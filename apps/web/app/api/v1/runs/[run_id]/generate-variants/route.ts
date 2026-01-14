import { NextRequest } from 'next/server';

function getFastApiBaseUrl(): string {
  const env = (process.env.NEXT_PUBLIC_API_BASE_URL || process.env.API_BASE_URL || '').trim();
  return env || 'http://127.0.0.1:8000';
}

export async function POST(req: NextRequest, { params }: { params: { run_id: string } }) {
  const runId = params.run_id;
  const base = getFastApiBaseUrl().replace(/\/$/, '');
  const url = `${base}/api/v1/runs/${encodeURIComponent(runId)}/generate-variants`;

  const raw = await req.text();

  const headers: HeadersInit = {
    'content-type': req.headers.get('content-type') || 'application/json',
  };
  const auth = req.headers.get('authorization');
  if (auth) (headers as any).authorization = auth;

  const upstream = await fetch(url, {
    method: 'POST',
    headers,
    body: raw,
    cache: 'no-store',
  });

  const contentType = upstream.headers.get('content-type') || 'application/json';
  const buf = await upstream.arrayBuffer();
  return new Response(buf, { status: upstream.status, headers: { 'content-type': contentType } });
}
