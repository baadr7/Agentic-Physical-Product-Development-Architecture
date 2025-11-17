import { NextRequest } from 'next/server';
import { runs } from '../../../runs/route';

interface Variant {
  id: string;
  run_id: string;
  stl_url?: string;
  step_url?: string;
  thumbnail_url?: string;
  image_url?: string;
  metrics: Record<string, unknown>;
  score: number;
  dfx_summary?: string;
  created_at: string;
}

const variantsStore: Variant[] = [];

function synthesizeVariant(run_id: string): Variant {
  return {
    id: `var-${Math.random().toString(16).slice(2,8)}`,
    run_id,
    stl_url: 'https://example.com/mock/model.stl',
    step_url: 'https://example.com/mock/model.step',
    thumbnail_url: 'https://placehold.co/256x256?text=Variant',
    image_url: 'https://placehold.co/512x384?text=Design',
    metrics: { mass_g: 123.4, volume_cm3: 56.7, fabricability_score: 0.92, assemblability_score: 0.88, sustainability_score: 0.75, safety_factor: 2.1 },
    score: 8.7,
    dfx_summary: 'Synthèse DfX (stub)',
    created_at: new Date().toISOString(),
  };
}

export async function GET(_: NextRequest, { params }: { params: { run_id: string } }) {
  const runId = params.run_id;
  const exists = runs.find(r => r.run_id === runId);
  if (!exists) return Response.json([], { status: 200 });
  let list = variantsStore.filter(v => v.run_id === runId);
  if (!list.length) {
    const v = synthesizeVariant(runId);
    variantsStore.push(v);
    list = [v];
  }
  return Response.json(list);
}
