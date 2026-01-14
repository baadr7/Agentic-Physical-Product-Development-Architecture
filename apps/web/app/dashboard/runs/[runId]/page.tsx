import { apiGetRunFull } from "~/lib/api/fastapi";

interface Props { params: { runId: string } }

export default async function RunDetailPage({ params }: Props) {
  const { runId } = params;
  let data: any = null;
  let error: string | null = null;
  try {
    data = await apiGetRunFull(runId);
  } catch (e: any) {
    error = e.message || 'Failed to load run';
  }
  if (error) {
    return <div className="p-6"><h1 className="text-xl font-semibold">Run {runId}</h1><p className="text-red-600">{error}</p></div>;
  }
  const { run, variants, prompts } = data || {};
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Run {runId}</h1>
        <p className="text-sm text-neutral-600">Status: {run?.status}</p>
        {run?.created_at && <p className="text-xs text-neutral-500">Created: {run.created_at}</p>}
      </div>
      <section>
        <h2 className="text-lg font-medium mb-2">Variants</h2>
        {(!variants || variants.length === 0) && <p className="text-sm text-neutral-500">No variants yet.</p>}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {variants?.map((v: any) => (
            <a key={v.id} href={`/dashboard/variants/${v.id}`} className="group border rounded-md p-2 hover:shadow-sm transition bg-white">
              {v.thumbnail_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={v.thumbnail_url} alt={v.id} className="w-full aspect-square object-cover rounded" />
              ) : (
                <div className="w-full aspect-square flex items-center justify-center text-xs text-neutral-400 bg-neutral-100 rounded">no image</div>
              )}
              <div className="mt-2 flex justify-between items-center">
                <span className="text-xs font-mono text-neutral-700 truncate">{v.id}</span>
                {typeof v.score === 'number' && <span className="text-xs px-1.5 py-0.5 rounded bg-neutral-800 text-white">{v.score.toFixed(1)}</span>}
              </div>
            </a>
          ))}
        </div>
      </section>
      <section>
        <h2 className="text-lg font-medium mb-2">Prompts</h2>
        {(!prompts || prompts.length === 0) && <p className="text-sm text-neutral-500">No prompts recorded.</p>}
        <ul className="space-y-2 text-sm">
          {prompts?.map((p: any) => (
            <li key={p.id} className="border rounded p-2 bg-white">
              <div className="font-mono text-xs text-neutral-500 mb-1">{p.id}</div>
              <div>{p.content || p.prompt_text || '[empty]'}</div>
              {p.role && <div className="text-xs text-neutral-400 mt-1">role: {p.role}</div>}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
