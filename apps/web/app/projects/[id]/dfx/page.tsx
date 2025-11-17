'use client';

import { useEffect, useMemo, useState } from 'react';
import { MOCK_DFX_SUMMARY, MOCK_VARIANTS } from '~/lib/mock-data';
import { DfxSummary, Variant } from '~/lib/types';
import { apiGetRunFull, apiGetRuns, apiReportPdfUrl } from '~/lib/api/fastapi';

export default async function DfxPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params;
  const [dfxSummary, setDfxSummary] = useState<DfxSummary>(MOCK_DFX_SUMMARY);
  const [selectedVariant, setSelectedVariant] = useState<Variant | null>(MOCK_VARIANTS[0] ?? null);
  const [runId, setRunId] = useState<string | null>(null);
  const [prompts, setPrompts] = useState<Array<{ id: string; prompt_text: string; model?: string; created_at?: string }>>([]);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        setLoading(true);
        const runs = await apiGetRuns();
        const filtered = (runs || []).filter((r: any) => (r.project_id || r.projectId) === projectId);
        filtered.sort((a: any, b: any) => (b.created_at || '').localeCompare(a.created_at || ''));
        const chosen = filtered.find((r: any) => r.status === 'completed') || filtered[0];
        if (!chosen) return;
        const rid = chosen.run_id || chosen.id;
        if (mounted) setRunId(rid);
        const full = await apiGetRunFull(rid);
        if (!full) return;
        // Pick best or first variant for DfX
        const pick = [...(full.variants || [])].sort((a, b) => (b.score || 0) - (a.score || 0))[0];
        if (pick && mounted) {
          setSelectedVariant({
            id: pick.id,
            run_id: pick.run_id,
            thumbnail_url: pick.thumbnail_url,
            image_url: pick.image_url,
            stl_url: pick.stl_url,
            step_url: pick.step_url,
            metrics: pick.metrics || {},
            score: pick.score || 0,
            dfx_analysis: pick.dfx_summary || undefined,
            created_at: pick.created_at || new Date().toISOString(),
          } as Variant);
          setDfxSummary({
            variant_id: pick.id,
            summary: pick.dfx_summary || MOCK_DFX_SUMMARY.summary,
            fabricability_score: pick.fabricability_score ?? 0.7,
            assemblability_score: pick.assemblability_score ?? 0.7,
            sustainability_score: pick.sustainability_score ?? 0.7,
            recommendations: MOCK_DFX_SUMMARY.recommendations,
            created_at: new Date().toISOString(),
          });
        }
        if (mounted) setPrompts(full.prompts || []);
      } catch (e) {
        console.error('Failed to load DfX data', e);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [projectId]);

  const indicators = [
    {
      name: 'Fabricabilité',
      score: dfxSummary.fabricability_score,
      icon: '🏭',
      color: 'blue',
    },
    {
      name: 'Assemblabilité',
      score: dfxSummary.assemblability_score,
      icon: '🔧',
      color: 'green',
    },
    {
      name: 'Durabilité',
      score: dfxSummary.sustainability_score,
      icon: '♻️',
      color: 'emerald',
    },
  ];

  const reportUrl = useMemo(() => (runId ? apiReportPdfUrl(runId) : null), [runId]);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <h1 className="text-3xl font-bold text-slate-900" data-testid="dfx-heading">Analyse DfX</h1>
          <p className="text-slate-600 mt-1">
            Design for X - Manufacturabilité, Assemblabilité, Durabilité
          </p>
          {loading && <p className="text-slate-500 mt-1">Chargement…</p>}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {indicators.map((indicator) => (
            <div
              key={indicator.name}
              className={`bg-${indicator.color}-50 rounded-lg shadow-md p-6 border border-${indicator.color}-200`}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-900">
                  {indicator.icon} {indicator.name}
                </h3>
              </div>

              {/* Progress Bar */}
              <div className="mb-2">
                <div className="w-full bg-slate-200 rounded-full h-4 overflow-hidden">
                  <div
                    className={`bg-${indicator.color}-600 h-full transition-all`}
                    style={{ width: `${indicator.score * 100}%` }}
                  ></div>
                </div>
              </div>

              {/* Score */}
              <p className={`text-3xl font-bold text-${indicator.color}-900`}>
                {(indicator.score * 100).toFixed(0)}%
              </p>
            </div>
          ))}
        </div>

        {/* Summary Section */}
        <div className="bg-white rounded-lg shadow-md p-8 border border-slate-200 mb-8" data-testid="dfx-summary-section">
          <h2 className="text-2xl font-bold text-slate-900 mb-6" data-testid="dfx-summary-heading">Résumé DfX</h2>

          <div className="prose prose-sm max-w-none">
            {dfxSummary.summary.split('\n\n').map((paragraph, idx) => (
              <p key={idx} className="text-slate-700 mb-4 whitespace-pre-wrap" data-testid={idx === 0 ? 'dfx-summary' : undefined}>
                {paragraph}
              </p>
            ))}
          </div>
        </div>

        {/* Prompts */}
        <div className="bg-white rounded-lg shadow-md p-8 border border-slate-200 mb-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-6">Prompts</h2>
          <div className="space-y-4">
            {(prompts || []).map((p) => (
              <div key={p.id} className="p-4 bg-slate-50 rounded-md border border-slate-200">
                <div className="text-xs text-slate-500 mb-1">{p.model || 'model'} · {p.created_at ? new Date(p.created_at).toLocaleString() : ''}</div>
                <div className="text-sm text-slate-800 whitespace-pre-wrap">{p.prompt_text}</div>
              </div>
            ))}
            {!prompts?.length && <p className="text-sm text-slate-500">Aucun prompt pour ce run.</p>}
          </div>
        </div>

        {/* Recommendations */}
        <div className="bg-white rounded-lg shadow-md p-8 border border-slate-200">
          <h2 className="text-2xl font-bold text-slate-900 mb-6">
            Recommandations
          </h2>

          <div className="space-y-3">
            {dfxSummary.recommendations.map((rec, idx) => (
              <div
                key={idx}
                className="flex items-start gap-3 p-4 bg-blue-50 rounded-lg border border-blue-200"
              >
                <span className="text-lg mt-1">💡</span>
                <p className="text-slate-700">{rec}</p>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex gap-3 mt-8 pt-6 border-t border-slate-200">
            {reportUrl ? (
              <a
                href={reportUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 text-center bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition"
                data-testid="export-report-btn"
              >
                📥 Exporter Rapport PDF
              </a>
            ) : (
              <button disabled className="flex-1 bg-slate-300 text-white font-bold py-3 rounded-lg">📥 Rapport indisponible</button>
            )}
            <button className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-lg transition">
              🔄 Générer Variante Améliorée
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
