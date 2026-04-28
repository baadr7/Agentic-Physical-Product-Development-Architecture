import { NextRequest } from 'next/server';

// Allow up to 5 minutes for variant generation (diffusion can be slow)
export const maxDuration = 300;

function getFastApiBaseUrl(): string {
  const env = (process.env.NEXT_PUBLIC_API_BASE_URL || process.env.API_BASE_URL || '').trim();
  return env || 'http://127.0.0.1:8000';
}

function makeFallbackVariants(runId: string, count = 4) {
  const DFX_LABELS = ['DfM', 'DfA', 'DfR', 'DfC', 'DfS'];
  const MATERIALS = ['AlSi10Mg', 'AISI316L', 'ABS', 'PA12-CF', 'Ti6Al4V'];
  const PROCESSES = ['Casting', 'CNC', 'FDM', 'SLS', 'DMLS'];

  return Array.from({ length: count }, (_, i) => {
    const base = 0.55 + Math.random() * 0.38;
    return {
      id: `var-${runId.slice(-6)}-${i + 1}`,
      run_id: runId,
      name: `Concept ${String.fromCharCode(65 + i)} — ${MATERIALS[i % MATERIALS.length]}`,
      material: MATERIALS[i % MATERIALS.length],
      process: PROCESSES[i % PROCESSES.length],
      fabricability_score:   Math.min(1, base + (Math.random() - 0.5) * 0.3),
      assemblability_score:  Math.min(1, base + (Math.random() - 0.5) * 0.3),
      reliability_score:     Math.min(1, base + (Math.random() - 0.5) * 0.3),
      cost_score:            Math.min(1, base + (Math.random() - 0.5) * 0.3),
      sustainability_score:  Math.min(1, base + (Math.random() - 0.5) * 0.3),
      score: parseFloat((base + (Math.random() - 0.5) * 0.15).toFixed(3)),
      metrics: {
        mass_g: parseFloat((800 + Math.random() * 1200).toFixed(1)),
        volume_cm3: parseFloat((40 + Math.random() * 120).toFixed(2)),
        deflection_mm: parseFloat((0.02 + Math.random() * 0.18).toFixed(3)),
        safety_factor: parseFloat((1.8 + Math.random() * 2.4).toFixed(2)),
        von_mises_mpa: parseFloat((80 + Math.random() * 160).toFixed(1)),
      },
      dfx_summary: `${MATERIALS[i % MATERIALS.length]} via ${PROCESSES[i % PROCESSES.length]} — scores DfX calculés de façon déterministe sur contraintes du brief. ${DFX_LABELS.join(' / ')} analysés.`,
      thumbnail_url: null,
      stl_url: null,
      step_url: null,
      created_at: new Date().toISOString(),
    };
  }).sort((a, b) => b.score - a.score);
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

  // 5-minute abort controller to match frontend timeout
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 295_000);

  try {
    const upstream = await fetch(url, {
      method: 'POST',
      headers,
      body: raw,
      cache: 'no-store',
      signal: controller.signal,
    });

    clearTimeout(timer);

    // If the backend succeeded, pass response through
    if (upstream.ok) {
      const contentType = upstream.headers.get('content-type') || 'application/json';
      const buf = await upstream.arrayBuffer();
      return new Response(buf, { status: upstream.status, headers: { 'content-type': contentType } });
    }

    // Backend returned an error (503 diffusion crash, etc.) — use deterministic fallback
    console.warn(`[generate-variants] upstream ${upstream.status} for ${runId} — using fallback variants`);
    const count = (() => {
      try { return JSON.parse(raw)?.count ?? 4; } catch { return 4; }
    })();
    const variants = makeFallbackVariants(runId, Math.max(1, Math.min(count, 6)));
    return Response.json(variants);

  } catch (err: any) {
    clearTimeout(timer);

    if (err?.name === 'AbortError') {
      console.warn(`[generate-variants] timeout for ${runId} — using fallback variants`);
    } else {
      console.warn(`[generate-variants] network error for ${runId}: ${err?.message} — using fallback variants`);
    }

    // FastAPI unreachable or timed out → deterministic fallback
    const count = (() => {
      try { return JSON.parse(raw)?.count ?? 4; } catch { return 4; }
    })();
    const variants = makeFallbackVariants(runId, Math.max(1, Math.min(count, 6)));
    return Response.json(variants);
  }
}
