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

export async function GET(req: NextRequest) {
  const proxied = await tryProxy(req, '/api/v1/scenarios', { method: 'GET' });
  if (proxied) return proxied;

  // Fallback stub (dev)
  return Response.json([
    {
      id: 'hydraulic_manifold',
      name: 'Collecteur hydraulique (manifold)',
      description: 'Pièce sous pression, exigences fortes en sécurité, fatigue et assemblage.',
      industry: 'Hydraulique',
      authority_level: 'Engineering + QA',
      default_dfx_weights: { dfm: 0.28, dfa: 0.18, dfr: 0.24, dfc: 0.1, dfs: 0.2 },
      default_autonomy: {
        orchestrator: 'Assist',
        requirements: 'Assist',
        concept_generation: 'Copilot',
        dfx: 'Copilot',
        simulation: 'Assist',
        documentation: 'Assist',
      },
      default_constraints: {
        max_pressure_bar: 210,
        proof_pressure_bar: 315,
        max_temp_c: 110,
        mass_target_g: 950,
        cost_target_eur: 45,
        min_wall_mm: 7,
        surface_ra_um: 1.6,
        applicable_standards: ['ISO 4413', 'ISO 12100'],
      },
      default_simulation_targets: { max_deflection_mm: 0.25, min_safety_factor: 2.0 },
      default_standards: ['ISO 4413', 'ISO 12100'],
    },
  ]);
}
