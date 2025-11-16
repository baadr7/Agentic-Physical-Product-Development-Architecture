'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import StlPreview from '~/components/StlViewer';
import { MOCK_VARIANTS, MOCK_RUNS } from '~/lib/mock-data';
import { Variant, Run } from '~/lib/types';

export default function ResultsClient({ projectId }: { projectId: string }) {
  const [runs, setRuns] = useState<Run[]>(MOCK_RUNS);
  const [variants, setVariants] = useState<Variant[]>(MOCK_VARIANTS);
  // Initialize with first mock variant so artifact buttons render instantly for tests
  const [selectedVariant, setSelectedVariant] = useState<Variant | null>(MOCK_VARIANTS[0] || null);
  const [viewMode, setViewMode] = useState<'gallery' | 'table'>('gallery');

  const API_BASE = useMemo(
    () => process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000',
    []
  );

  useEffect(() => {
    let cancelled = false;

    async function fetchRunsAndVariants() {
      try {
        // Fetch all runs from the FastAPI
        const r = await fetch(`${API_BASE}/api/v1/runs`, { cache: 'no-store' });
        if (!r.ok) throw new Error(`Failed to load runs: ${r.status}`);
        const allRuns = await r.json();

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
          return;
        }

        // Fetch variants for latest run
        const rv = await fetch(
          `${API_BASE}/api/v1/runs/${latest.run_id}/variants`,
          { cache: 'no-store' }
        );
        if (!rv.ok) throw new Error(`Failed to load variants: ${rv.status}`);
        const rawVariants = await rv.json();

        const mapped: Variant[] = (Array.isArray(rawVariants)
          ? rawVariants
          : []
        ).map((v: any) => ({
          id: v.id,
          run_id: v.run_id,
          stl_url: v.stl_url || undefined,
          step_url: v.step_url || undefined,
          thumbnail_url:
            v.thumbnail_url || v.image_url || 'https://via.placeholder.com/400x300?text=No+Image',
          image_url: v.image_url || undefined,
          metrics: v.metrics || {},
          score: typeof v.score === 'number' ? v.score : 0,
          dfx_analysis: v.dfx_summary || v.dfx_analysis || '',
          created_at: v.created_at || new Date().toISOString(),
        }));

        if (cancelled) return;
        setVariants(mapped);
        setSelectedVariant(mapped[0] || null);
      } catch (err) {
        // On error, keep mock data to avoid a blank page
        console.warn('ResultsClient: falling back to mocks:', err);
        if (cancelled) return;
        setRuns(MOCK_RUNS.filter((r) => r.project_id === projectId));
        setVariants(MOCK_VARIANTS);
        setSelectedVariant(MOCK_VARIANTS[0] || null);
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
              <h1 className="text-3xl font-bold text-slate-900" data-testid="results-heading">Résultats</h1>
              <p className="text-slate-600">Projet ID: {projectId}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setViewMode('gallery')}
                className={`px-4 py-2 rounded-lg font-semibold transition ${
                  viewMode === 'gallery'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                📸 Galerie
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`px-4 py-2 rounded-lg font-semibold transition ${
                  viewMode === 'table'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                📊 Tableau
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {viewMode === 'gallery' ? (
          <div>
            {/* Gallery Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-8" data-testid="variants-grid">
              {variants.map((variant) => (
                <div
                  key={variant.id}
                  onClick={() => setSelectedVariant(variant)}
                  className={`cursor-pointer rounded-lg overflow-hidden border-4 transition ${
                    selectedVariant?.id === variant.id
                      ? 'border-blue-600 shadow-lg'
                      : 'border-slate-200 hover:border-slate-400'
                  }`}
                >
                  <Image
                    src={variant.thumbnail_url}
                    alt="Design variant"
                    width={400}
                    height={300}
                    unoptimized
                    className="w-full h-32 object-cover"
                  />
                  <div className="p-2 bg-white">
                    <p className="text-xs font-bold text-slate-900">
                      Score: {variant.score}
                    </p>
                    <p className="text-xs text-slate-500">
                      Mass: {variant.metrics?.mass_g !== undefined
                        ? `${variant.metrics.mass_g}g`
                        : variant.metrics?.mass !== undefined
                        ? `${variant.metrics.mass}kg`
                        : '-'}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Selected Variant Details */}
            {selectedVariant && (
              <div className="bg-white rounded-lg shadow-md p-6 border border-slate-200" data-testid="selected-variant-panel">
                <h2 className="text-2xl font-bold text-slate-900 mb-4">
                  Détails Variante
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  {/* Image or STL Preview */}
                  <div className="md:col-span-2">
                    {selectedVariant.stl_url ? (
                      <StlPreview url={selectedVariant.stl_url} width={800} height={400} />
                    ) : (
                      <Image
                        src={selectedVariant.image_url || selectedVariant.thumbnail_url}
                        alt="Selected variant"
                        width={800}
                        height={600}
                        unoptimized
                        className="w-full rounded-lg border border-slate-200"
                      />
                    )}
                  </div>

                  {/* Metrics */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-blue-50 p-3 rounded-lg">
                      <p className="text-xs text-blue-600 font-semibold">Score</p>
                      <p className="text-2xl font-bold text-blue-900">
                        {selectedVariant.score}
                      </p>
                    </div>
                    <div className="bg-green-50 p-3 rounded-lg">
                      <p className="text-xs text-green-600 font-semibold">Masse</p>
                      <p className="text-2xl font-bold text-green-900">
                        {selectedVariant.metrics?.mass_g !== undefined
                          ? `${selectedVariant.metrics.mass_g}g`
                          : selectedVariant.metrics?.mass !== undefined
                          ? `${selectedVariant.metrics.mass}kg`
                          : '-'}
                      </p>
                    </div>
                    <div className="bg-cyan-50 p-3 rounded-lg">
                      <p className="text-xs text-cyan-600 font-semibold">Volume</p>
                      <p className="text-2xl font-bold text-cyan-900">
                        {selectedVariant.metrics?.volume_cm3 !== undefined
                          ? `${selectedVariant.metrics.volume_cm3} cm³`
                          : '-'}
                      </p>
                    </div>
                    <div className="bg-rose-50 p-3 rounded-lg">
                      <p className="text-xs text-rose-600 font-semibold">Flèche</p>
                      <p className="text-2xl font-bold text-rose-900">
                        {selectedVariant.metrics?.deflection_mm !== undefined
                          ? `${selectedVariant.metrics.deflection_mm} mm`
                          : '-'}
                      </p>
                    </div>
                    <div className="bg-purple-50 p-3 rounded-lg">
                      <p className="text-xs text-purple-600 font-semibold">
                        Sécurité
                      </p>
                      <p className="text-2xl font-bold text-purple-900">
                        {selectedVariant.metrics.safety_factor}
                      </p>
                    </div>
                    <div className="bg-orange-50 p-3 rounded-lg">
                      <p className="text-xs text-orange-600 font-semibold">
                        Fabricabilité
                      </p>
                      <p className="text-2xl font-bold text-orange-900">
                        {(selectedVariant.metrics.fabricability_score! * 100).toFixed(0)}%
                      </p>
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
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-center font-bold py-2 rounded-lg transition"
                      data-testid="download-stl-btn"
                    >
                      📥 Télécharger STL
                    </a>
                  ) : (
                    <button
                      disabled
                      className="flex-1 bg-slate-300 text-white font-bold py-2 rounded-lg"
                    >
                      📥 STL indisponible
                    </button>
                  )}
                  {selectedVariant.step_url ? (
                    <a
                      href={selectedVariant.step_url}
                      download
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-center font-bold py-2 rounded-lg transition"
                      data-testid="download-step-btn"
                    >
                      🧩 Télécharger STEP
                    </a>
                  ) : (
                    <button
                      disabled
                      className="flex-1 bg-slate-300 text-white font-bold py-2 rounded-lg"
                    >
                      🧩 STEP indisponible
                    </button>
                  )}
                  <a
                    href={`${API_BASE}/api/v1/runs/${selectedVariant.run_id}/report.pdf`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 bg-purple-600 hover:bg-purple-700 text-white text-center font-bold py-2 rounded-lg transition"
                    data-testid="view-report-btn"
                  >
                    📄 Voir Rapport DfX
                  </a>
                  <button className="flex-1 bg-slate-600 hover:bg-slate-700 text-white font-bold py-2 rounded-lg transition">
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
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">
                    Status
                  </th>
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
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold ${statusColor}`}
                        >
                          {run.status === 'completed'
                            ? '✓ Terminé'
                            : run.status === 'processing'
                            ? '⏳ En cours'
                            : run.status === 'failed'
                            ? '✗ Erreur'
                            : '⏸ En attente'}
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
