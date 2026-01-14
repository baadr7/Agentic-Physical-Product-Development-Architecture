"use client";

import { use, useEffect, useMemo, useState } from 'react';
import { MOCK_DFX_SUMMARY, MOCK_VARIANTS } from '~/lib/mock-data';
import { DfxSummary, Variant } from '~/lib/types';
import { apiGenerateVariants, apiGetRunFull, apiGetRuns, apiGetVariants, apiReportPdfUrl } from '~/lib/api/fastapi';
import Breadcrumbs from '~/components/Breadcrumbs';
import { IconBeaker, IconCube, IconClipboard } from '~/components/icons';

export default function DfxPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = use(params);
  const [dfxSummary, setDfxSummary] = useState<DfxSummary>(MOCK_DFX_SUMMARY);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [selectedVariant, setSelectedVariant] = useState<Variant | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [prompts, setPrompts] = useState<Array<{ id: string; prompt_text: string; model?: string; created_at?: string }>>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [generating, setGenerating] = useState<boolean>(false);

  function derivePromptsFromVariants(vs: any[], run?: any) {
    const derived: Array<{ id: string; prompt_text: string; model?: string; created_at?: string }> = [];
    const seen = new Set<string>();

    const runDesc = run?.description;
    if (typeof runDesc === 'string' && runDesc.trim()) {
      const t = runDesc.trim();
      seen.add(t);
      derived.push({ id: 'derived-run', prompt_text: t, created_at: run?.created_at });
    }

    for (const v of vs || []) {
      const candidates = [
        v?.prompt_text,
        v?.prompt,
        v?.input_prompt,
        v?.positive_prompt,
        v?.metadata?.prompt_text,
        v?.metadata?.prompt,
      ];
      for (const c of candidates) {
        if (typeof c !== 'string') continue;
        const t = c.trim();
        if (!t || seen.has(t)) continue;
        seen.add(t);
        derived.push({
          id: `derived-${derived.length + 1}`,
          prompt_text: t,
          model: v?.model,
          created_at: v?.created_at,
        });
      }
    }

    return derived;
  }

  function mapApiVariantToUi(v: any): Variant {
    return {
      id: v?.id,
      run_id: v?.run_id,
      thumbnail_url: v?.thumbnail_url || v?.thumbnailUrl || v?.image_url || v?.imageUrl || '',
      image_url: v?.image_url || v?.imageUrl,
      stl_url: v?.stl_url || v?.stlUrl,
      step_url: v?.step_url || v?.stepUrl,
      metrics: (v?.metrics && typeof v.metrics === 'object') ? v.metrics : {},
      score: v?.score || 0,
      dfx_analysis: v?.dfx_summary || v?.dfx_analysis || v?.dfx || undefined,
      created_at: v?.created_at || new Date().toISOString(),
    } as Variant;
  }

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

        // Prefer /full (prompts + enriched) but always fall back to /variants.
        let full: any = null;
        try {
          full = await apiGetRunFull(rid);
        } catch {
          full = null;
        }

        let apiVariants: any[] = [];
        try {
          const vs = await apiGetVariants(rid);
          apiVariants = Array.isArray(vs) ? (vs as any[]) : [];
        } catch {
          apiVariants = [];
        }

        const fullVariants: any[] = Array.isArray(full?.variants) ? full.variants : [];
        const combinedVariants = (fullVariants.length ? fullVariants : apiVariants);
        const uiVariants = combinedVariants.map(mapApiVariantToUi).filter((v) => !!v.id);

        if (mounted) {
          setVariants(uiVariants);

          // Pick best or first variant for DfX
          const pick = [...uiVariants].sort((a, b) => (b.score || 0) - (a.score || 0))[0];
          if (pick) {
            setSelectedVariant(pick);
            setDfxSummary({
              variant_id: pick.id,
              summary: pick.dfx_analysis || MOCK_DFX_SUMMARY.summary,
              fabricability_score: (pick.metrics?.fabricability_score as any) ?? 0.7,
              assemblability_score: (pick.metrics as any)?.assemblability_score ?? 0.7,
              sustainability_score: (pick.metrics?.sustainability_score as any) ?? 0.7,
              recommendations: MOCK_DFX_SUMMARY.recommendations,
              created_at: new Date().toISOString(),
            });
          } else {
            // Keep a reasonable UI state when no variants exist.
            setSelectedVariant(MOCK_VARIANTS[0] ?? null);
          }
        }

        const fullPrompts = Array.isArray(full?.prompts) ? full.prompts : [];
        const derivedPrompts = (!fullPrompts.length && combinedVariants.length)
          ? derivePromptsFromVariants(combinedVariants, chosen)
          : [];
        if (mounted) setPrompts(fullPrompts.length ? fullPrompts : derivedPrompts);
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

  async function refreshVariantsForRun(rid: string) {
    let full: any = null;
    try {
      full = await apiGetRunFull(rid);
    } catch {
      full = null;
    }

    let apiVariants: any[] = [];
    try {
      const vs = await apiGetVariants(rid);
      apiVariants = Array.isArray(vs) ? (vs as any[]) : [];
    } catch {
      apiVariants = [];
    }

    const fullVariants: any[] = Array.isArray(full?.variants) ? full.variants : [];
    const combinedVariants = (fullVariants.length ? fullVariants : apiVariants);
    const uiVariants = combinedVariants.map(mapApiVariantToUi).filter((v) => !!v.id);
    setVariants(uiVariants);

    const pick = [...uiVariants].sort((a, b) => (b.score || 0) - (a.score || 0))[0];
    if (pick) {
      setSelectedVariant(pick);
      setDfxSummary({
        variant_id: pick.id,
        summary: pick.dfx_analysis || MOCK_DFX_SUMMARY.summary,
        fabricability_score: (pick.metrics?.fabricability_score as any) ?? 0.7,
        assemblability_score: (pick.metrics as any)?.assemblability_score ?? 0.7,
        sustainability_score: (pick.metrics?.sustainability_score as any) ?? 0.7,
        recommendations: MOCK_DFX_SUMMARY.recommendations,
        created_at: new Date().toISOString(),
      });
    }

    const fullPrompts = Array.isArray(full?.prompts) ? full.prompts : [];
    const derivedPrompts = (!fullPrompts.length && combinedVariants.length)
      ? derivePromptsFromVariants(combinedVariants, full?.run)
      : [];
    setPrompts(fullPrompts.length ? fullPrompts : derivedPrompts);
  }

  async function onGenerateImprovedVariant() {
    if (!runId) return;
    try {
      setGenerating(true);
      // Generate 1 new variant for this run, then refresh the list.
      await apiGenerateVariants(runId, { count: 1, enqueue: false });
      await refreshVariantsForRun(runId);
    } catch (e) {
      console.error('Failed to generate improved variant', e);
    } finally {
      setGenerating(false);
    }
  }

  const indicators = [
    {
      name: 'Fabricabilité',
      score: dfxSummary.fabricability_score,
      icon: IconCube,
      color: 'blue' as const,
    },
    {
      name: 'Assemblabilité',
      score: dfxSummary.assemblability_score,
      icon: IconClipboard,
      color: 'green' as const,
    },
    {
      name: 'Durabilité',
      score: dfxSummary.sustainability_score,
      icon: IconBeaker,
      color: 'emerald' as const,
    },
  ];

  const colorClasses: Record<'blue' | 'green' | 'emerald', { card: string; border: string; bar: string; text: string }> = {
    blue:    { card: 'bg-blue-50',    border: 'border-blue-200',    bar: 'bg-blue-600',    text: 'text-blue-900' },
    green:   { card: 'bg-green-50',   border: 'border-green-200',   bar: 'bg-green-600',   text: 'text-green-900' },
    emerald: { card: 'bg-emerald-50', border: 'border-emerald-200', bar: 'bg-emerald-600', text: 'text-emerald-900' },
  };

  const reportUrl = useMemo(() => (runId ? apiReportPdfUrl(runId) : null), [runId]);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 pt-6">
          <Breadcrumbs />
        </div>
        <div className="max-w-7xl mx-auto px-6 pb-8">
          <h1 className="text-3xl font-bold text-slate-900 inline-flex items-center gap-3" data-testid="dfx-heading"><IconBeaker /> Analyse DfX</h1>
          <p className="text-slate-600 mt-1">
            Design for X - Manufacturabilité, Assemblabilité, Durabilité
          </p>
          {loading && <p className="text-slate-500 mt-1">Chargement…</p>}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {indicators.map((indicator) => {
            const Icon = indicator.icon;
            const c = colorClasses[indicator.color];
            return (
              <div
                key={indicator.name}
                className={`${c.card} rounded-lg shadow-md p-6 border ${c.border}`}
              >
                <div className="flex items-center gap-2 mb-4">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-white/70">
                    <Icon />
                  </span>
                  <h3 className="text-lg font-bold text-slate-900">{indicator.name}</h3>
                </div>

                {/* Progress Bar */}
                <div className="mb-2">
                  <div className="w-full bg-slate-200 rounded-full h-4 overflow-hidden">
                    <div
                      className={`${c.bar} h-full transition-all`}
                      style={{ width: `${indicator.score * 100}%` }}
                    />
                  </div>
                </div>

                {/* Score */}
                <p className={`text-3xl font-bold ${c.text}`}>
                  {(indicator.score * 100).toFixed(0)}%
                </p>
              </div>
            );
          })}
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

        {/* Variants */}
        <div className="bg-white rounded-lg shadow-md p-8 border border-slate-200 mb-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-6">Variantes</h2>
          <p className="text-sm text-slate-600 mb-4">{variants.length} variante(s) pour ce run.</p>
          {variants.length ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {variants.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setSelectedVariant(v)}
                  className={`text-left overflow-hidden rounded-md border transition ${selectedVariant?.id === v.id ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
                >
                  <div className="w-full aspect-[4/3] bg-slate-100">
                    {v.thumbnail_url || v.image_url ? (
                      <img
                        src={v.thumbnail_url || v.image_url}
                        alt={`Variant ${v.id}`}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs text-slate-500">
                        (Aucune image)
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <div className="text-sm font-semibold text-slate-900 break-all">{v.id}</div>
                    <div className="text-xs text-slate-500">Score: {Number(v.score || 0).toFixed(2)}</div>
                    <div className="text-xs text-slate-500">Mass (g): {String(v.metrics?.mass_g ?? '')}</div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">Aucune variante générée pour ce run.</p>
          )}
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
            <button
              className={`flex-1 text-white font-bold py-3 rounded-lg transition ${generating ? 'bg-green-400' : 'bg-green-600 hover:bg-green-700'}`}
              onClick={onGenerateImprovedVariant}
              disabled={!runId || generating}
            >
              {generating ? '⏳ Génération…' : '🔄 Générer Variante Améliorée'}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
