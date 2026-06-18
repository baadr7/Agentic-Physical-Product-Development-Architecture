import { useEffect, useMemo, useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useLangStore } from '@/i18n';
import { useAppState } from '@/store/appState';
import { rankConcepts } from '@/engine/composite';
import HumanRoleBanner from '@/components/HumanRoleBanner';
import GaugeDFx from '@/components/GaugeDFx';
import type { HITLLevel, RankedConcept } from '@/types';

const BANNER: Record<HITLLevel, { fr: string; en: string }> = {
  1: { fr: 'Chaque concept requiert votre approbation explicite avant de procéder.', en: 'Each concept requires your explicit approval before proceeding.' },
  2: { fr: 'Revoyez les concepts classés par l’IA. Vous pouvez modifier les contraintes avant de sélectionner.', en: 'Review the AI-ranked concepts. You may modify constraints before selecting.' },
  3: { fr: 'L’IA a classé les concepts. Sélectionnez parmi les options recommandées en vous appuyant sur les preuves DFx.', en: 'The AI ranked the concepts. Select among the recommended options based on the DFx evidence.' },
  4: { fr: 'L’Orchestrateur a présélectionné le concept {X}. Revoyez le résumé et approuvez ou annulez.', en: 'The Orchestrator pre-selected concept {X}. Review the summary and approve or cancel.' },
  5: { fr: 'L’Orchestrateur a sélectionné le concept {X} de façon autonome. Vous êtes notifié.', en: 'The Orchestrator autonomously selected concept {X}. You are notified.' },
};

export default function E6Selection() {
  const lang = useLangStore((s) => s.lang);
  const navigate = useNavigate();
  const concepts = useAppState((s) => s.concepts);
  const brief = useAppState((s) => s.brief);
  const selectConcept = useAppState((s) => s.selectConcept);
  const appendADT = useAppState((s) => s.appendADT);
  const setGuidance = useAppState((s) => s.setGuidance);
  const guidance = useAppState((s) => s.guidanceAnswers);

  const ranked = useMemo(() => rankConcepts(concepts, brief.dfxPriorities), [concepts, brief.dfxPriorities]);
  const level = brief.agentLevels.orchestrator as HITLLevel;
  const top = ranked[0];
  const [autoCountdown, setAutoCountdown] = useState(level === 5 ? 3 : 0);

  // L5 — auto-confirm after 3s
  useEffect(() => {
    if (level !== 5 || !top) return;
    if (autoCountdown <= 0) {
      confirm(top, true);
      return;
    }
    const id = setTimeout(() => setAutoCountdown((c) => c - 1), 1000);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoCountdown, level]);

  if (concepts.length === 0) return <Navigate to="/e3" replace />;

  function confirm(c: RankedConcept, auto = false) {
    selectConcept(c.id);
    appendADT({
      agent: auto ? 'orchestrator' : 'human',
      event: auto ? 'concept_auto_selected' : 'concept_selected',
      source: auto ? 'Orchestrator (autonome)' : 'saisie manuelle',
      hitlLevel: level,
      payload: { concept: c.id, composite: c.composite },
    });
    navigate('/e7');
  }

  const dfsPriority = brief.dfxPriorities.dfs;
  const showEco = dfsPriority >= 4;
  const bannerText = (BANNER[level][lang] || '').replace('{X}', top?.id ?? '');

  return (
    <div className="mx-auto max-w-app px-4 py-6">
      <h1 className="text-screen font-semibold">{lang === 'fr' ? 'Sélection HITL' : 'HITL selection'}</h1>

      <div className="mt-3">
        <HumanRoleBanner level={level} message={bannerText} />
      </div>

      {showEco && (
        <div className="card-overlay mt-3 border-l-2 border-l-dfs p-3">
          <div className="text-body font-semibold text-dfs">
            {lang === 'fr'
              ? 'La recyclabilité en fin de vie est-elle une exigence contractuelle pour cette famille de produits ?'
              : 'Is end-of-life recyclability a contractual requirement for this product family?'}
          </div>
          <div className="mt-2 flex gap-2">
            {['oui', 'non'].map((v) => (
              <button
                key={v}
                onClick={() => setGuidance('eco_contractual', v)}
                className={`btn ${guidance.eco_contractual === v ? 'bg-dfs text-white' : 'btn-ghost'}`}
              >
                {v === 'oui' ? (lang === 'fr' ? 'Oui' : 'Yes') : lang === 'fr' ? 'Non' : 'No'}
              </button>
            ))}
          </div>
          {guidance.eco_contractual === 'oui' && (
            <div className="mt-2 rounded border border-dfs/40 bg-dfs/10 p-2 text-caption text-dfs">
              {lang === 'fr'
                ? 'Carte éco-classement activée : priorité au concept au meilleur DFS — '
                : 'Eco-ranking card active: prioritising the highest-DFS concept — '}
              <strong>{[...ranked].sort((a, b) => b.scores.dfs - a.scores.dfs)[0].name}</strong>.
            </div>
          )}
        </div>
      )}

      {/* concept summary grid */}
      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {ranked.map((c) => {
          const isTop = c.rank === 1;
          const preselected = (level === 4 || level === 5) && isTop;
          return (
            <div
              key={c.id}
              className={`card p-3 ${preselected ? 'border-human ring-1 ring-human/40' : ''}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-body font-semibold">#{c.rank} {c.name}</span>
                {isTop && <span className="pill bg-human/15 text-human">{lang === 'fr' ? 'Recommandé' : 'Recommended'}</span>}
              </div>
              <div className="mt-1 text-caption text-text-muted">{c.materialProcess}</div>
              <div className="mt-2 space-y-1">
                <GaugeDFx value={c.scores.dfs} label="DFS" accent compact />
                <div className="flex items-center justify-between text-caption">
                  <span className="text-text-muted">{lang === 'fr' ? 'Composite' : 'Composite'}</span>
                  <span className="mono tnum text-text-primary">{c.composite.toFixed(1)}</span>
                </div>
              </div>
              {level === 1 && (
                <button onClick={() => confirm(c)} className="btn-primary mt-2 w-full text-caption">
                  {lang === 'fr' ? `Approuver concept ${c.id}` : `Approve concept ${c.id}`}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* level-specific action bar */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {level === 2 && (
          <>
            <button onClick={() => confirm(top)} className="btn-primary">{lang === 'fr' ? 'Sélectionner & procéder' : 'Select & proceed'}</button>
            <button onClick={() => navigate('/e2')} className="btn-ghost">{lang === 'fr' ? 'Modifier contraintes' : 'Modify constraints'}</button>
            <button onClick={() => navigate('/e4')} className="btn-ghost">{lang === 'fr' ? 'Rejeter tout' : 'Reject all'}</button>
          </>
        )}
        {level === 3 && (
          <>
            <button onClick={() => confirm(ranked[0])} className="btn-primary">{lang === 'fr' ? 'Sélectionner #1 (recommandé)' : 'Select #1 (recommended)'}</button>
            {ranked[1] && <button onClick={() => confirm(ranked[1])} className="btn-ghost">{lang === 'fr' ? 'Sélectionner #2' : 'Select #2'}</button>}
            <button onClick={() => navigate('/e4')} className="btn-ghost">{lang === 'fr' ? 'Autre' : 'Other'}</button>
            <button onClick={() => navigate('/e4')} className="btn-ghost">{lang === 'fr' ? 'Abstention' : 'Abstain'}</button>
          </>
        )}
        {level === 4 && (
          <>
            <button onClick={() => confirm(top)} className="btn-primary">{lang === 'fr' ? 'Approuver la sélection' : 'Approve selection'}</button>
            <button onClick={() => navigate('/e4')} className="btn-ghost">{lang === 'fr' ? 'Annuler — choisir un autre concept' : 'Cancel — choose another concept'}</button>
          </>
        )}
        {level === 5 && (
          <>
            <button onClick={() => confirm(top, false)} className="btn-primary">
              {lang === 'fr' ? `Confirmer (auto dans ${autoCountdown}s)` : `Confirm (auto in ${autoCountdown}s)`}
            </button>
            <button onClick={() => navigate(`/e5/${top.id}`)} className="btn-ghost">{lang === 'fr' ? 'Voir les détails (lecture seule)' : 'View details (read-only)'}</button>
          </>
        )}
        {level === 1 && (
          <span className="text-caption text-text-muted">{lang === 'fr' ? 'Approuvez un concept ci-dessus pour procéder.' : 'Approve a concept above to proceed.'}</span>
        )}
      </div>
    </div>
  );
}
