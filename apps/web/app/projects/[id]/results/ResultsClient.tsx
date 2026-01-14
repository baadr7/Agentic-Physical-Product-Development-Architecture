'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import StlPreview from '~/components/StlViewer';
import dynamic from 'next/dynamic';
import { MOCK_VARIANTS, MOCK_RUNS } from '~/lib/mock-data';
import { Variant, Run } from '~/lib/types';
import { apiGetRuns, apiGetVariants, apiReportPdfUrl } from '~/lib/api/fastapi';
import { IconSparkles, IconChart, IconCube, IconBeaker, IconClipboard } from '~/components/icons';
import { getTopoptArtifacts, getVariantAssets } from '~/lib/api/supabase';

export default function ResultsClient({ projectId }: { projectId: string }) {
  const demoMode = useMemo(() => process.env.NEXT_PUBLIC_DEMO_MODE === '1' || process.env.NODE_ENV === 'test', []);

  const [runs, setRuns] = useState<Run[]>(demoMode ? MOCK_RUNS : []);
  const [variants, setVariants] = useState<Variant[]>(demoMode ? MOCK_VARIANTS : []);
  // In demo/test mode, select a mock variant so artifact buttons render instantly for tests.
  const [selectedVariant, setSelectedVariant] = useState<Variant | null>(demoMode ? (MOCK_VARIANTS[0] || null) : null);
  const [topoptArtifacts, setTopoptArtifacts] = useState<Record<string, any>>({});
  const [viewMode, setViewMode] = useState<'gallery' | 'table'>('gallery');
  const [loading, setLoading] = useState<boolean>(true);
  const [usingMock, setUsingMock] = useState<boolean>(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const API_BASE = useMemo(() => process.env.NEXT_PUBLIC_API_BASE_URL || '', []);

  // Lazy load glTF viewer client-side only when needed
  const GltfViewer = useMemo(() => dynamic(() => import('~/components/GltfViewer'), { ssr: false }), []);

  useEffect(() => {
    let cancelled = false;

    async function fetchRunsAndVariants() {
      try {
        setLoading(true);
        // Fetch all runs via shared client (handles base URL and errors)
        const allRuns = await apiGetRuns();

        // Coerce to our Run type and filter by project
        const projectRuns: Run[] = (Array.isArray(allRuns) ? allRuns : [])
          .filter((it) => it.project_id === projectId)
          .map((it) => ({
            id: it.id || it.run_id || crypto.randomUUID(),
            run_id: it.run_id || it.id,
            project_id: it.project_id,
            status: it.status || 'pending',
            started_at: it.started_at || it.created_at,
            finished_at: it.finished_at,
            duration_ms: it.duration_ms,
            parameters: it.options || it.parameters || {},
            metadata: it.metadata || {},
            created_at: it.created_at || new Date().toISOString(),
          }));

        if (cancelled) return;
        setRuns(projectRuns);

        // Choose the most recent run (by created_at)
        const latest = projectRuns
          .slice()
          .sort((a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          )[0];

        if (!latest) {
          setVariants([]);
          setSelectedVariant(null);
          setLoading(false);
          return;
        }

        const mapVariants = (raw: any[]): Variant[] =>
          (Array.isArray(raw) ? raw : []).map((v: any) => {
            const out: any = {
              id: v.id,
              run_id: v.run_id,
              stl_url: v.stl_url || undefined,
              step_url: v.step_url || undefined,
              thumbnail_url:
                v.thumbnail_url ||
                v.image_url ||
                undefined,
              image_url: v.image_url || undefined,
              metrics: v.metrics || {},
              score: typeof v.score === 'number' ? v.score : 0,
              dfx_analysis: v.dfx_summary || v.dfx_analysis || '',
              created_at: v.created_at || new Date().toISOString(),
            };

            // Optional inline image payloads from the API (raw base64, no data: prefix)
            if (typeof v.image_b64 === 'string' && v.image_b64.length) out.image_b64 = v.image_b64;
            if (typeof v.thumbnail_b64 === 'string' && v.thumbnail_b64.length) out.thumbnail_b64 = v.thumbnail_b64;

            return out as Variant;
          });

        const isReady = (list: Variant[]) =>
          list.length > 0 &&
          list.some((v: any) =>
            Boolean(v.image_url) ||
            Boolean(v.thumbnail_url) ||
            Boolean(v.stl_url) ||
            Boolean((v as any).gltf_url)
          );

        // Poll variants for a short window so the GUI is truly end-to-end:
        // create run -> wait -> variants appear -> images appear.
        let mapped: Variant[] = [];
        const maxAttempts = 30; // ~60s at 2s interval
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          if (cancelled) return;
          const rawVariants = await apiGetVariants(latest.run_id);
          mapped = mapVariants(Array.isArray(rawVariants) ? rawVariants : []);
          if (isReady(mapped)) break;
          // If we at least have variants, show them while we continue polling.
          if (mapped.length && !cancelled) {
            setVariants(mapped);
            setSelectedVariant((prev) => prev || mapped[0] || null);
          }
          await new Promise((r) => setTimeout(r, 2000));
        }

        if (cancelled) return;
        // Optionally fetch topology optimization artifacts directly from Supabase (anon key)
        try {
          const jobs = await getTopoptArtifacts(latest.run_id);
          if (jobs && jobs.length) {
            const artifacts: Record<string, any> = {};
            for (const job of jobs) {
              artifacts[latest.run_id] = {
                stl_url: job.stl_url,
                step_url: job.step_url,
                gltf_url: job.gltf_url,
              };
            }
            if (!cancelled) setTopoptArtifacts(artifacts);
            for (const v of mapped) {
              if (v.run_id === latest.run_id) {
                const art = artifacts[latest.run_id];
                if (art) {
                  (v as any).gltf_url = art.gltf_url;
                  if (!v.stl_url && art.stl_url) v.stl_url = art.stl_url;
                  if (!v.step_url && art.step_url) v.step_url = art.step_url;
                }
              }
            }
          }
        } catch (e) {
          // Supabase artifacts optional; ignore failures
        }

        // Optionally fetch variant image assets from Supabase and merge into variants
        try {
          if (mapped.length) {
            const ids = Array.from(new Set(mapped.map((v) => v.id))).filter(Boolean);
            const assets = await getVariantAssets(ids);
            const byVariant: Record<string, string> = {};
            for (const a of assets) {
              if (a?.variant_id && a?.url && !byVariant[a.variant_id]) {
                byVariant[a.variant_id] = a.url;
              }
            }
            for (const v of mapped) {
              if (!v.image_url && byVariant[v.id]) {
                (v as any).image_url = byVariant[v.id];
                if (!v.thumbnail_url) (v as any).thumbnail_url = byVariant[v.id];
              }
            }
          }
        } catch (e) {
          // optional; ignore
        }

        setVariants(mapped);
        setSelectedVariant(mapped[0] || null);
        // Attach weighting badges from latest run metadata if present
        (latest as any)._weighting = latest?.metadata?.weighting || latest?.metadata?.dfx_aspects || null;
        setUsingMock(false);
        setLastError(null);
        setLoading(false);
      } catch (err) {
        // On error, keep mock data to avoid a blank page
        console.warn('ResultsClient: falling back to mocks:', err);
        if (cancelled) return;
        setLastError((err as any)?.message || 'API fetch failed');
        if (demoMode) {
          setRuns(MOCK_RUNS.filter((r) => r.project_id === projectId));
          setVariants(MOCK_VARIANTS);
          setSelectedVariant(MOCK_VARIANTS[0] || null);
          setUsingMock(true);
        } else {
          setRuns([]);
          setVariants([]);
          setSelectedVariant(null);
          setUsingMock(false);
        }
        setLoading(false);
      }
    }

    fetchRunsAndVariants();
    return () => {
      cancelled = true;
    };
  }, [API_BASE, projectId]);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 inline-flex items-center gap-3" data-testid="results-heading"><IconSparkles /> Résultats</h1>
              <p className="text-slate-600">Projet ID: {projectId}</p>
              {/* DfX weighting badges from latest run */}
              {runs.length > 0 && (runs
                .slice()
                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0] as any)?._weighting && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {Object.entries(((runs
                    .slice()
                    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0] as any)._weighting) as Record<string, number>)
                    .sort((a: any, b: any) => (b[1] ?? 0) - (a[1] ?? 0))
                    .slice(0, 5)
                    .map(([k, v]) => (
                      <span key={k} className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                        {k}: {Math.round((v ?? 0) * 100)}%
                      </span>
                    ))}
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setViewMode('gallery')}
                className={`px-4 py-2 rounded-lg font-semibold transition inline-flex items-center gap-2 ${
                  viewMode === 'gallery'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <IconSparkles /> Galerie
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`px-4 py-2 rounded-lg font-semibold transition inline-flex items-center gap-2 ${
                  viewMode === 'table'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <IconChart /> Tableau
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {!loading && runs.length === 0 && variants.length === 0 && (
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
            <h2 className="text-lg font-bold text-slate-900">Aucun résultat pour ce projet</h2>
            <p className="mt-1 text-slate-600">
              Aucun run n’a été trouvé. Lance une génération, puis reviens ici.
            </p>
            {lastError && (
              <p className="mt-3 text-sm text-rose-700">
                Erreur: {lastError}
              </p>
            )}
            {usingMock && (
              <p className="mt-2 text-sm text-amber-700">
                Mode démo actif (API indisponible ou mal configurée).
              </p>
            )}
          </div>
        )}

        {viewMode === 'gallery' ? (
          <div>
            {/* Gallery Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-8" data-testid="variants-grid">
              {loading
                ? Array.from({ length: 8 }).map((_, idx) => (
                    <div key={idx} className="rounded-lg overflow-hidden border-4 border-transparent bg-slate-100 animate-pulse h-48" />
                  ))
                : variants.map((variant) => {
                const anyVariant = variant as any;
                const thumbB64 = (anyVariant.thumbnail_b64 || anyVariant.image_b64) as string | undefined;
                const thumbSrc = thumbB64 ? `data:image/png;base64,${thumbB64}` : variant.thumbnail_url;
                const isData = typeof thumbSrc === 'string' && thumbSrc.startsWith('data:');
                const hasThumb = typeof thumbSrc === 'string' && thumbSrc.length > 0;

                return (
                  <div
                    key={variant.id}
                    onClick={() => setSelectedVariant(variant)}
                    className={`cursor-pointer rounded-lg overflow-hidden border-4 transition transform ${
                      selectedVariant?.id === variant.id
                        ? 'border-blue-600 shadow-lg'
                        : 'border-slate-200 hover:border-slate-400 hover:shadow-md hover:-translate-y-0.5'
                    }`}
                  >
                    {isData ? (
                      <img
                        src={thumbSrc}
                        alt="Design variant"
                        className="w-full h-32 object-cover"
                      />
                    ) : hasThumb ? (
                      <Image
                        src={thumbSrc}
                        alt="Design variant"
                        width={400}
                        height={300}
                        unoptimized
                        className="w-full h-32 object-cover"
                      />
                    ) : (
                      <div className="w-full h-32 bg-slate-100 flex items-center justify-center text-xs text-slate-500">
                        Image en cours…
                      </div>
                    )}
                    <div className="p-2 bg-white">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-bold text-blue-700">Score {variant.score}</span>
                        <span className="text-[10px] text-slate-500">{variant.metrics?.mass_g !== undefined
                          ? `${variant.metrics.mass_g}g`
                          : variant.metrics?.mass !== undefined
                          ? `${variant.metrics.mass}kg`
                          : '-'}</span>
                      </div>
                      <div className="mt-1 flex items-center gap-1 text-[10px] text-slate-600">
                        <span className="px-1.5 py-0.5 bg-slate-100 rounded">Vol {variant.metrics?.volume_cm3 ?? '-'}</span>
                        <span className="px-1.5 py-0.5 bg-slate-100 rounded">Déf {variant.metrics?.deflection_mm ?? '-'}</span>
                        <span className="px-1.5 py-0.5 bg-slate-100 rounded">SF {variant.metrics?.safety_factor ?? '-'}</span>
                        {/* Mini DfX badges for quick scan */}
                        {typeof variant.metrics?.fabricability_score === 'number' && (
                          <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded border border-emerald-200">{
                            (() => {
                              const v = variant.metrics.fabricability_score as number;
                              const pct = v <= 1 ? v * 100 : v;
                              return `Fab ${Math.round(pct)}%`;
                            })()
                          }</span>
                        )}
                        {typeof variant.metrics?.safety_factor === 'number' && (
                          <span className="px-1.5 py-0.5 bg-purple-100 text-purple-800 rounded border border-purple-200">Sécur {variant.metrics.safety_factor}</span>
                        )}
                        {typeof variant.metrics?.volume_cm3 === 'number' && (
                          <span className="px-1.5 py-0.5 bg-cyan-100 text-cyan-800 rounded border border-cyan-200">Vol {variant.metrics.volume_cm3}</span>
                        )}
                        {(variant as any)?.gltf_url && (
                          <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-800 rounded border border-indigo-200">glTF</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Selected Variant Details */}
            {selectedVariant && (
              <div className="bg-white rounded-lg shadow-md p-6 border border-slate-200" data-testid="selected-variant-panel">
                <div className="mb-4 flex items-center gap-3">
                  <h2 className="text-2xl font-bold text-slate-900">
                    Détails Variante
                  </h2>
                  {(selectedVariant as any)?.gltf_url && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200" title="TopOpt glTF prêt">
                      ✅ TopOpt prêt
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  {/* Image or STL Preview */}
                  <div className="md:col-span-2">
                    { (selectedVariant as any)?.gltf_url ? (
                      <GltfViewer url={(selectedVariant as any).gltf_url} width={800} height={400} />
                    ) : selectedVariant.stl_url ? (
                      <StlPreview url={selectedVariant.stl_url} width={800} height={400} />
                    ) : (() => {
                      const anySel = selectedVariant as any;
                      const selB64 = (anySel.image_b64 || anySel.thumbnail_b64) as string | undefined;
                      const selSrc = selectedVariant.image_url || (selB64 ? `data:image/png;base64,${selB64}` : '') || selectedVariant.thumbnail_url;
                      const selIsData = typeof selSrc === 'string' && selSrc.startsWith('data:');
                      const selHasSrc = typeof selSrc === 'string' && selSrc.length > 0;
                      return selIsData ? (
                        <img
                          src={selSrc}
                          alt="Selected variant"
                          className="w-full rounded-lg border border-slate-200"
                        />
                      ) : selHasSrc ? (
                        <Image
                          src={selSrc}
                          alt="Selected variant"
                          width={800}
                          height={600}
                          unoptimized
                          className="w-full rounded-lg border border-slate-200"
                        />
                      ) : (
                        <div className="w-full h-[400px] rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center text-sm text-slate-600">
                          Image en cours de génération…
                        </div>
                      );
                    })()}
                  </div>

                  {/* Metrics */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-blue-50 p-3 rounded-lg">
                      <p className="text-xs text-blue-600 font-semibold inline-flex items-center gap-1"><IconChart /> Score</p>
                      <p className="text-2xl font-bold text-blue-900">{selectedVariant.score}</p>
                    </div>
                    <div className="bg-green-50 p-3 rounded-lg">
                      <p className="text-xs text-green-600 font-semibold inline-flex items-center gap-1"><IconCube /> Masse</p>
                      <p className="text-2xl font-bold text-green-900">
                        {selectedVariant.metrics?.mass_g !== undefined
                          ? `${selectedVariant.metrics.mass_g}g`
                          : selectedVariant.metrics?.mass !== undefined
                          ? `${selectedVariant.metrics.mass}kg`
                          : '-'}
                      </p>
                    </div>
                    <div className="bg-cyan-50 p-3 rounded-lg">
                      <p className="text-xs text-cyan-600 font-semibold inline-flex items-center gap-1"><IconCube /> Volume</p>
                      <p className="text-2xl font-bold text-cyan-900">
                        {selectedVariant.metrics?.volume_cm3 !== undefined
                          ? `${selectedVariant.metrics.volume_cm3} cm³`
                          : '-'}
                      </p>
                    </div>
                    <div className="bg-rose-50 p-3 rounded-lg">
                      <p className="text-xs text-rose-600 font-semibold inline-flex items-center gap-1"><IconChart /> Flèche</p>
                      <p className="text-2xl font-bold text-rose-900">
                        {selectedVariant.metrics?.deflection_mm !== undefined
                          ? `${selectedVariant.metrics.deflection_mm} mm`
                          : '-'}
                      </p>
                    </div>
                    <div className="bg-purple-50 p-3 rounded-lg">
                      <p className="text-xs text-purple-600 font-semibold inline-flex items-center gap-1"><IconClipboard /> Sécurité</p>
                      <p className="text-2xl font-bold text-purple-900">{selectedVariant.metrics.safety_factor}</p>
                    </div>
                    <div className="bg-orange-50 p-3 rounded-lg">
                      <p className="text-xs text-orange-600 font-semibold inline-flex items-center gap-1"><IconBeaker /> Fabricabilité</p>
                      <p className="text-2xl font-bold text-orange-900">{
                        (() => {
                          const val = selectedVariant.metrics?.fabricability_score as number | undefined;
                          if (val === undefined || val === null) return '-';
                          const pct = val <= 1 ? val * 100 : val;
                          return `${Math.round(pct)}%`;
                        })()
                      }</p>
                    </div>
                  </div>
                </div>

                {/* DfX Analysis */}
                <div className="bg-slate-50 p-4 rounded-lg mb-6 border border-slate-200">
                  <h3 className="font-bold text-slate-900 mb-2">Analyse DfX</h3>
                  <p className="text-slate-700 text-sm">
                    {selectedVariant.dfx_analysis}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  {selectedVariant.stl_url ? (
                    <a
                      href={selectedVariant.stl_url}
                      download
                      className="flex-1 inline-flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white text-center font-semibold px-4 py-2 rounded-lg transition"
                      data-testid="download-stl-btn"
                    >
                      📥 Télécharger STL
                    </a>
                  ) : (
                    <button
                      disabled
                      className="flex-1 inline-flex items-center justify-center bg-slate-300 text-white font-semibold px-4 py-2 rounded-lg"
                    >
                      📥 STL indisponible
                    </button>
                  )}
                  {selectedVariant.step_url ? (
                    <a
                      href={selectedVariant.step_url}
                      download
                      className="flex-1 inline-flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white text-center font-semibold px-4 py-2 rounded-lg transition"
                      data-testid="download-step-btn"
                    >
                      🧩 Télécharger STEP
                    </a>
                  ) : (
                    <button
                      disabled
                      className="flex-1 inline-flex items-center justify-center bg-slate-300 text-white font-semibold px-4 py-2 rounded-lg"
                    >
                      🧩 STEP indisponible
                    </button>
                  )}
                  <a
                    href={apiReportPdfUrl(selectedVariant.run_id)}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 inline-flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white text-center font-semibold px-4 py-2 rounded-lg transition"
                    data-testid="view-report-btn"
                  >
                    📄 Voir Rapport DfX
                  </a>
                  <button className="flex-1 inline-flex items-center justify-center bg-slate-600 hover:bg-slate-700 text-white font-semibold px-4 py-2 rounded-lg transition">
                    🔄 Reparamétrer
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Table View */
          <div className="bg-white rounded-lg shadow-md border border-slate-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-100 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">
                    Run ID
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Status</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">
                    Durée
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">
                    Score
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {runs.map((run) => {
                  const variant = variants.find((v) => v.run_id === run.run_id);
                  const statusColor =
                    run.status === 'completed'
                      ? 'bg-green-100 text-green-800'
                      : run.status === 'processing'
                      ? 'bg-yellow-100 text-yellow-800'
                      : run.status === 'failed'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-slate-100 text-slate-800';

                  return (
                    <tr key={run.run_id} className="hover:bg-slate-50 transition">
                      <td className="px-6 py-4 text-sm font-mono text-slate-900">
                        {run.run_id}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-semibold ${statusColor}`}>
                          <span className={`h-2 w-2 rounded-full ${
                            run.status === 'completed' ? 'bg-green-500' :
                            run.status === 'processing' ? 'bg-yellow-500 animate-pulse' :
                            run.status === 'failed' ? 'bg-red-500' : 'bg-slate-400'
                          }`} />
                          {run.status === 'completed' ? 'Terminé' : run.status === 'processing' ? 'En cours' : run.status === 'failed' ? 'Erreur' : 'En attente'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {run.duration_ms
                          ? `${(run.duration_ms / 1000).toFixed(1)}s`
                          : '-'}
                      </td>
                      <td className="px-6 py-4 text-sm font-bold text-blue-600">
                        {variant?.score || '-'}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <button className="text-blue-600 hover:text-blue-800 font-semibold">
                          Détails →
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
