import { NextRequest } from 'next/server';

import { runs } from '../../route';

type AnyRecord = Record<string, any>;

function getFastApiBaseUrl(): string {
  const env = (process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || '').trim();
  return env || 'http://127.0.0.1:8000';
}

async function tryProxy(req: NextRequest, runId: string): Promise<Response | null> {
  const base = getFastApiBaseUrl().replace(/\/$/, '');
  const url = `${base}/api/v1/runs/${encodeURIComponent(runId)}/full`;
  try {
    const headers: HeadersInit = {};
    const auth = req.headers.get('authorization');
    if (auth) (headers as any).authorization = auth;

    const upstream = await fetch(url, { method: 'GET', headers, cache: 'no-store' });
    const contentType = upstream.headers.get('content-type') || 'application/json';

    // If it's JSON and OK, we can enrich missing prompts from variants.
    if (upstream.ok && contentType.includes('application/json')) {
      const json = (await upstream.json()) as AnyRecord;
      const variants = Array.isArray(json?.variants) ? json.variants : [];
      let prompts = Array.isArray(json?.prompts) ? json.prompts : [];
      if ((!prompts || prompts.length === 0) && variants.length > 0) {
        const derived: Array<{ id: string; prompt_text: string; model?: string; created_at?: string }> = [];
        const seen = new Set<string>();
        for (const v of variants) {
          if (!v || typeof v !== 'object') continue;
          const candidates: Array<any> = [
            (v as any).prompt_text,
            (v as any).prompt,
            (v as any).input_prompt,
            (v as any).positive_prompt,
            (v as any)?.metadata?.prompt_text,
            (v as any)?.metadata?.prompt,
          ];
          for (const c of candidates) {
            if (typeof c !== 'string') continue;
            const text = c.trim();
            if (!text) continue;
            if (seen.has(text)) continue;
            seen.add(text);
            derived.push({
              id: `derived-${seen.size}`,
              prompt_text: text,
              model: (v as any).model,
              created_at: (v as any).created_at,
            });
          }
        }
        prompts = derived;
      }
      return Response.json({ ...json, prompts });
    }

    const buf = await upstream.arrayBuffer();
    return new Response(buf, { status: upstream.status, headers: { 'content-type': contentType } });
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest, { params }: { params: { run_id: string } }) {
  const runId = params.run_id;

  const proxied = await tryProxy(req, runId);
  if (proxied) return proxied;

  const run = runs.find((r) => r.run_id === runId);
  if (!run) {
    return Response.json({ detail: 'Not Found' }, { status: 404 });
  }

  // Minimal fallback shape expected by the UI: { run, variants, prompts }
  const out: AnyRecord = {
    run,
    variants: [],
    prompts: [],
  };

  return Response.json(out);
}
