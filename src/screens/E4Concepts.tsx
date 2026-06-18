import { useEffect, useMemo, useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useLangStore } from '@/i18n';
import { useAppState } from '@/store/appState';
import { rankConcepts } from '@/engine/composite';
import { runJustifications } from '@/llm/calls';
import GaugeDFx from '@/components/GaugeDFx';
import ConceptSVG from '@/components/ConceptSVG';
import RadarDFx, { type RadarSeries } from '@/components/charts/RadarDFx';
import type { DFxKey, HITLLevel, RankedConcept } from '@/types';

const CONCEPT_COLOR: Record<string, string> = {
  A: '#3B82F6',
  B: '#22C55E',
  C: '#F59E0B',
  D: '#8B5CF6',
  'A-v2': '#F97316',
};

const DFX_ROWS: { key: DFxKey; label: string; accent?: boolean }[] = [
  { key: 'dfm', label: 'DFM' },
  { key: 'dfa', label: 'DFA' },
  { key: 'dfr', label: 'DFR' },
  { key: 'dfc', label: 'DFC' },
  { key: 'dfs', label: 'DFS', accent: true },
];

export default function E4Concepts() {
  const lang = useLangStore((s) => s.lang);
  const navigate = useNavigate();
  const scenario = useAppState((s) => s.scenario);
  const scenarioName = useAppState((s) => s.scenarioName);
  const concepts = useAppState((s) => s.concepts);
  const brief = useAppState((s) => s.brief);
  const apiKey = useAppState((s) => s.apiKey);
  const updateConcept = useAppState((s) => s.updateConcept);
  const appendADT = useAppState((s) => s.appendADT);
  const [loadingJust, setLoadingJust] = useState(false);

  const ranked = useMemo(() => rankConcepts(concepts, brief.dfxPriorities), [concepts, brief.dfxPriorities]);

  // DFx justifications — one LLM call for all concepts (docs/09 call site #2)
  useEffect(() => {
    const need = concepts.length > 0 && concepts.some((c) => !c.justifications);
    if (!need) return;
    let alive = true;
    setLoadingJust(true);
    runJustifications(apiKey, concepts, brief).then(({ data, meta }) => {
      if (!alive) return;
      data.justifications.forEach((j) => {
        const { concept_id, ...rest } = j;
        updateConcept(concept_id, { justifications: rest as Record<DFxKey, string> });
      });
      appendADT({
        agent: 'dfx',
        event: 'justifications_generated',
        source: meta.mode === 'live' ? 'DeepSeek' : 'DeepSeek (mock)',
        payload: { concepts: data.justifications.length },
      });
      setLoadingJust(false);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [concepts.length]);

  if (!scenario) return <Navigate to="/e1" replace />;
  if (concepts.length === 0) return <Navigate to="/e3" replace />;

  const genLevel = brief.agentLevels.generation as HITLLevel;
  const showRecommendation = ![1, 3].includes(genLevel);

  const series: RadarSeries[] = ranked.map((c) => ({
    label: c.id,
    scores: c.scores,
    color: CONCEPT_COLOR[c.id] ?? '#9AA7B5',
  }));

  return (
    <div className="mx-auto max-w-app px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-screen font-semibold">{lang === 'fr' ? 'Concepts générés' : 'Generated concepts'}</h1>
          <div className="mt-1 flex items-center gap-2">
            <span className="pill bg-surface-overlay text-text-secondary">
              {lang === 'fr' ? 'Classé selon' : 'Ranked by'} : {scenarioName}
            </span>
            {loadingJust && (
              <span className="pill bg-human/15 text-human">
                {lang === 'fr' ? 'Justifications IA…' : 'AI justifications…'}
              </span>
            )}
            {!showRecommendation && (
              <span className="pill bg-surface-overlay text-text-muted">
                {lang === 'fr' ? 'Génération L' + genLevel + ' : sans recommandation' : 'Generation L' + genLevel + ': no recommendation'}
              </span>
            )}
          </div>
        </div>
        <button onClick={() => navigate('/e6')} className="btn-primary">
          {lang === 'fr' ? 'Procéder à la sélection →' : 'Proceed to selection →'}
        </button>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-[2fr_1fr]">
        {/* concept grid */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {ranked.map((c) => (
            <ConceptCard
              key={c.id}
              concept={c}
              recommended={showRecommendation && c.rank === 1}
              onDetail={() => navigate(`/e5/${c.id}`)}
              lang={lang}
            />
          ))}
        </div>

        {/* comparative radar */}
        <div className="card p-4">
          <div className="mb-2 text-section font-semibold">
            {lang === 'fr' ? 'Comparaison DFx' : 'DFx comparison'}
          </div>
          <div className="grid place-items-center">
            <RadarDFx series={series} size={280} showLegend />
          </div>
          <div className="mt-3 space-y-1">
            {ranked.map((c) => (
              <div key={c.id} className="flex items-center justify-between text-body">
                <span className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CONCEPT_COLOR[c.id] }} />
                  <span className="text-text-secondary">{c.name}</span>
                </span>
                <span className="mono tnum text-text-primary">{c.composite.toFixed(1)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ConceptCard({
  concept,
  recommended,
  onDetail,
  lang,
}: {
  concept: RankedConcept;
  recommended: boolean;
  onDetail: () => void;
  lang: 'fr' | 'en';
}) {
  const isV2 = concept.id.includes('v2');
  return (
    <div
      className={`card relative overflow-hidden p-3 ${recommended ? 'border-human ring-1 ring-human/40' : ''} ${
        isV2 ? 'animate-fadein' : ''
      }`}
    >
      {recommended && (
        <div className="absolute right-0 top-0 rounded-bl bg-human px-2 py-0.5 text-caption font-semibold text-white">
          {lang === 'fr' ? 'Recommandé' : 'Recommended'}
        </div>
      )}
      <div className="flex gap-3">
        <div className="shrink-0">
          <ConceptSVG concept={concept} size={104} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="pill bg-surface-overlay text-text-primary">#{concept.rank}</span>
            <span className="truncate text-body font-semibold">{concept.name}</span>
          </div>
          <div className="mt-0.5 text-caption text-text-muted">{concept.materialProcess}</div>
          <div className="mt-1.5 flex flex-wrap gap-1">
            <span className="pill bg-surface-overlay text-text-secondary tnum">€{concept.cost_eur}</span>
            <span className="pill bg-surface-overlay text-text-secondary tnum">{concept.mass_kg} kg</span>
          </div>
          <div className="mt-1 text-caption text-status-warning">⚠ {concept.weakness}</div>
        </div>
      </div>

      <div className="mt-3 space-y-1.5">
        {DFX_ROWS.map((r) => (
          <GaugeDFx key={r.key} value={concept.scores[r.key]} label={r.label} accent={r.accent} compact />
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between">
        <span className="text-caption text-text-muted">
          {lang === 'fr' ? 'Score composite' : 'Composite'} :{' '}
          <span className="mono tnum text-text-primary">{concept.composite.toFixed(1)}</span>
        </span>
        <button onClick={onDetail} className="btn-ghost px-2.5 py-1.5 text-caption">
          {lang === 'fr' ? 'Voir le détail →' : 'View detail →'}
        </button>
      </div>
    </div>
  );
}
