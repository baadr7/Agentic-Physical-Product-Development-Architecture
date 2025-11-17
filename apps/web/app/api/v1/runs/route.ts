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

export async function GET() {
  return Response.json(runs);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const run_id = `run-${Math.random().toString(16).slice(2,10)}`;
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