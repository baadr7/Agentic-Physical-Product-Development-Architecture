import { apiGetRuns } from "~/lib/api/fastapi";

export const dynamic = 'force-dynamic';

export default async function RunsIndexPage() {
  let runs: any[] = [];
  let error: string | null = null;
  try {
    runs = await apiGetRuns();
  } catch (e: any) {
    error = e.message || 'Failed to load runs';
  }
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Runs</h1>
        <p className="text-sm text-neutral-600">Latest execution records.</p>
      </div>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      {!error && runs.length === 0 && <p className="text-sm text-neutral-500">No runs yet.</p>}
      <div className="divide-y border rounded bg-white">
        {runs.map(r => (
          <a key={r.run_id || r.id} href={`/dashboard/runs/${r.run_id || r.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-neutral-50 transition">
            <div className="space-y-0.5">
              <div className="font-mono text-xs text-neutral-700">{r.run_id || r.id}</div>
              <div className="text-xs text-neutral-500">{r.status}</div>
            </div>
            <div className="text-xs text-neutral-400">{r.created_at}</div>
          </a>
        ))}
      </div>
    </div>
  );
}
