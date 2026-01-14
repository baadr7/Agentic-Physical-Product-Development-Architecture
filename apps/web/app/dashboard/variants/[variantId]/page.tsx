import { apiGetRun, apiGetVariants } from "~/lib/api/fastapi";

async function fetchVariantDetail(variantId: string) {
  // Direct detail endpoint fetch (using plain fetch for now to allow error differentiation)
  const base = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, '') || 'http://127.0.0.1:8000';
  const url = `${base}/api/v1/variants/${variantId}/detail`;
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`GET /variants/${variantId}/detail failed: ${res.status}`);
    return await res.json();
  } catch (e: any) {
    return { error: e.message || 'Failed to load variant detail' };
  }
}

interface Props { params: { variantId: string } }

export default async function VariantDetailPage({ params }: Props) {
  const { variantId } = params;
  const detail = await fetchVariantDetail(variantId);
  if ((detail as any).error) {
    return <div className="p-6"><h1 className="text-xl font-semibold">Variant {variantId}</h1><p className="text-red-600">{(detail as any).error}</p></div>;
  }
  const { variant, dfx, prompts } = detail as any;
  // attempt to get parent run id to show backlink
  const runId = variant?.run_id;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Variant {variantId}</h1>
        {runId && <a href={`/dashboard/runs/${runId}`} className="text-sm text-blue-600 hover:underline">Back to Run {runId}</a>}
      </div>
      <section className="space-y-4">
        <div className="flex gap-4 flex-wrap">
          {variant?.image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={variant.image_url} alt={variantId} className="w-64 aspect-square object-cover rounded" />
          )}
          {variant?.thumbnail_url && !variant?.image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={variant.thumbnail_url} alt={variantId} className="w-64 aspect-square object-cover rounded" />
          )}
          <div className="text-sm space-y-1 min-w-[12rem]">
            <div className="font-mono text-xs text-neutral-500">ID: {variant?.id}</div>
            {typeof variant?.score === 'number' && <div>Score: {variant.score.toFixed(2)}</div>}
            {typeof variant?.fabricability_score === 'number' && <div>Fabricability: {variant.fabricability_score.toFixed(2)}</div>}
            {typeof variant?.assemblability_score === 'number' && <div>Assemblability: {variant.assemblability_score.toFixed(2)}</div>}
            {typeof variant?.sustainability_score === 'number' && <div>Sustainability: {variant.sustainability_score.toFixed(2)}</div>}
            {variant?.created_at && <div>Created: {variant.created_at}</div>}
            {variant?.stl_url && <a className="text-blue-600 hover:underline" href={variant.stl_url} target="_blank" rel="noreferrer">STL</a>}
            {variant?.step_url && <a className="text-blue-600 hover:underline" href={variant.step_url} target="_blank" rel="noreferrer">STEP</a>}
          </div>
        </div>
      </section>
      <section>
        <h2 className="text-lg font-medium mb-2">DfX Summary</h2>
        {!dfx && <p className="text-sm text-neutral-500">No DfX summary available.</p>}
        {dfx && (
          <pre className="text-xs bg-neutral-900 text-neutral-100 p-3 rounded overflow-auto max-h-64 border border-neutral-800">{JSON.stringify(dfx, null, 2)}</pre>
        )}
      </section>
      <section>
        <h2 className="text-lg font-medium mb-2">Prompts</h2>
        {(!prompts || prompts.length === 0) && <p className="text-sm text-neutral-500">No prompts captured for this variant.</p>}
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
