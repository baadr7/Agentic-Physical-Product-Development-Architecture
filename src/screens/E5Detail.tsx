import { useEffect, useState } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { useLangStore } from '@/i18n';
import { useAppState } from '@/store/appState';
import { runSimulationAnalysis } from '@/llm/calls';
import { FEEDBACK_STEPS, advanceFeedback, feedbackStepText } from '@/engine/feedbackSequence';
import GaugeDFx from '@/components/GaugeDFx';
import ConceptSVG from '@/components/ConceptSVG';
import ImageStudio from '@/components/ImageStudio';
import BsBeRadar from '@/components/charts/BsBeRadar';
import type { DFxKey, HITLLevel } from '@/types';
import type { SimulationAnalysis } from '@/llm/contracts';

const DFX_ROWS: { key: DFxKey; label: string; full: { fr: string; en: string }; accent?: boolean }[] = [
  { key: 'dfm', label: 'DFM', full: { fr: 'Fabricabilité', en: 'Manufacturability' } },
  { key: 'dfa', label: 'DFA', full: { fr: 'Assemblage', en: 'Assembly' } },
  { key: 'dfr', label: 'DFR', full: { fr: 'Fiabilité', en: 'Reliability' } },
  { key: 'dfc', label: 'DFC', full: { fr: 'Coût', en: 'Cost' } },
  { key: 'dfs', label: 'DFS', full: { fr: 'Durabilité', en: 'Sustainability' }, accent: true },
];

export default function E5Detail() {
  const { conceptId } = useParams<{ conceptId: string }>();
  const lang = useLangStore((s) => s.lang);
  const navigate = useNavigate();
  const concepts = useAppState((s) => s.concepts);
  const brief = useAppState((s) => s.brief);
  const apiKey = useAppState((s) => s.apiKey);
  const feedbackLoop = useAppState((s) => s.feedbackLoop);
  const [analysis, setAnalysis] = useState<SimulationAnalysis | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);

  const concept = concepts.find((c) => c.id === conceptId);

  useEffect(() => {
    if (!concept) return;
    let alive = true;
    setAnalysis(null);
    runSimulationAnalysis(apiKey, concept).then(({ data }) => alive && setAnalysis(data));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conceptId]);

  if (concepts.length === 0) return <Navigate to="/e3" replace />;
  if (!concept) return <Navigate to="/e4" replace />;

  const be = concept.fbs.behaviour.expected;
  const bs = concept.fbs.behaviour.simulated;
  const pass = bs.stress_max_MPa <= be.stress_max_MPa && bs.deflection_max_mm <= be.deflection_max_mm;
  const simLevel = brief.agentLevels.simulation as HITLLevel;
  const canFeedback = concept.id === 'A' || concept.id === 'A-v2';
  // The curated DN100 set carries valve geometry (bore/flanges); generated
  // concepts don't — show generic structure fields for those.
  const isValve = concept.fbs.structure.bore_mm > 0;

  return (
    <div className="mx-auto max-w-app px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <button onClick={() => navigate('/e4')} className="btn-ghost mb-2 text-caption">
            ← {lang === 'fr' ? 'Retour aux concepts' : 'Back to concepts'}
          </button>
          <h1 className="text-screen font-semibold">{concept.name}</h1>
          <div className="text-caption text-text-muted">{concept.materialProcess}</div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`pill ${pass ? 'bg-emerald-500/15 text-status-pass' : 'bg-red-500/15 text-status-redesign'}`}>
            {pass ? 'PASS' : 'REDESIGN'}
          </span>
          {canFeedback && (
            <button onClick={() => setPanelOpen((o) => !o)} className="btn-ghost">
              {lang === 'fr' ? 'Boucle feedback' : 'Feedback loop'} {panelOpen ? '✕' : '↻'}
            </button>
          )}
        </div>
      </div>

      <div className={`mt-5 grid grid-cols-1 gap-4 ${panelOpen ? 'lg:grid-cols-[1fr_320px]' : ''}`}>
        <div>
          {/* FBS 3-column */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {/* F */}
            <div className="card border-t-2 border-t-fbs-function p-3">
              <div className="text-section font-semibold text-fbs-function">F — {lang === 'fr' ? 'Fonction' : 'Function'}</div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {concept.fbs.function.requirements.map((r, i) => (
                  <span key={i} className="pill bg-fbs-function/10 text-fbs-function">{r}</span>
                ))}
              </div>
            </div>
            {/* B */}
            <div className="card border-t-2 border-t-fbs-behaviour p-3">
              <div className="flex items-center justify-between">
                <div className="text-section font-semibold text-fbs-behaviour">B — {lang === 'fr' ? 'Comportement' : 'Behaviour'}</div>
                <span className={`pill ${pass ? 'bg-emerald-500/15 text-status-pass' : 'bg-red-500/15 text-status-redesign'}`}>
                  {pass ? 'PASS' : 'REDESIGN'}
                </span>
              </div>
              <table className="mt-2 w-full text-caption">
                <thead>
                  <tr className="text-text-muted">
                    <th className="text-left font-medium"></th>
                    <th className="text-right font-medium">Be</th>
                    <th className="text-right font-medium">Bs</th>
                  </tr>
                </thead>
                <tbody className="tnum">
                  <Row label={lang === 'fr' ? 'Contrainte (MPa)' : 'Stress (MPa)'} be={be.stress_max_MPa} bs={bs.stress_max_MPa} ok={bs.stress_max_MPa <= be.stress_max_MPa} />
                  <Row label={lang === 'fr' ? 'Flèche (mm)' : 'Deflection (mm)'} be={be.deflection_max_mm} bs={bs.deflection_max_mm} ok={bs.deflection_max_mm <= be.deflection_max_mm} />
                  <tr>
                    <td className="text-text-secondary">{isValve ? 'Proof 24 bar' : lang === 'fr' ? 'Essai de validation' : 'Proof test'}</td>
                    <td className="text-right">{be.proof_ok ? '✓' : '✗'}</td>
                    <td className="text-right text-status-pass">{bs.proof_ok ? '✓' : '✗'}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            {/* S */}
            <div className="card border-t-2 border-t-fbs-structure p-3">
              <div className="text-section font-semibold text-fbs-structure">S — {lang === 'fr' ? 'Structure' : 'Structure'}</div>
              <div className="mt-2 flex items-center gap-3">
                <ConceptSVG concept={concept} size={120} />
                <div className="space-y-0.5 text-caption">
                  <KV k={lang === 'fr' ? 'Matériau' : 'Material'} v={concept.fbs.structure.material} />
                  <KV k={lang === 'fr' ? 'Procédé' : 'Process'} v={concept.fbs.structure.process} />
                  <KV k={lang === 'fr' ? 'Paroi' : 'Wall'} v={`${concept.fbs.structure.wall_mm} mm`} />
                  {isValve ? (
                    <>
                      <KV k={lang === 'fr' ? 'Brides' : 'Flanges'} v={concept.fbs.structure.flanges} />
                      <KV k="Bore" v={`${concept.fbs.structure.bore_mm} mm`} />
                    </>
                  ) : (
                    <KV k={lang === 'fr' ? 'Taille caract.' : 'Char. size'} v={`${concept.fbs.structure.length_mm} mm`} />
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* DFx Readiness Pack + radar */}
          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">
            <div className="card p-3">
              <div className="mb-2 text-section font-semibold">
                {lang === 'fr' ? 'Pack de disponibilité DFx' : 'DFx Readiness Pack'}
                <span className="ml-2 text-caption text-text-muted">{lang === 'fr' ? '(seuil PASS = 70)' : '(PASS threshold = 70)'}</span>
              </div>
              <div className="space-y-2.5">
                {DFX_ROWS.map((r) => {
                  const v = concept.scores[r.key];
                  const ok = v >= 70;
                  return (
                    <div key={r.key} className="grid grid-cols-[120px_1fr_auto] items-center gap-2">
                      <div>
                        <span className={`text-body font-semibold ${r.accent ? 'text-dfs' : ''}`}>{r.label}</span>
                        <span className="ml-1 text-caption text-text-muted">{r.full[lang]}</span>
                      </div>
                      <GaugeDFx value={v} accent={r.accent} />
                      <span className={`pill ${ok ? 'bg-emerald-500/15 text-status-pass' : 'bg-red-500/15 text-status-redesign'}`}>
                        {ok ? 'PASS' : 'FAIL'}
                      </span>
                    </div>
                  );
                })}
              </div>
              {/* justifications */}
              <div className="mt-3 space-y-1.5 border-t border-border pt-3">
                {DFX_ROWS.map((r) => (
                  <div key={r.key} className="text-caption">
                    <span className={`font-semibold ${r.accent ? 'text-dfs' : 'text-text-secondary'}`}>{r.label}</span>
                    <span className="text-text-muted"> — {concept.justifications?.[r.key] ?? (lang === 'fr' ? 'justification IA en attente…' : 'AI justification pending…')}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="card p-3">
              <div className="mb-2 text-section font-semibold">Bs vs Be</div>
              <div className="grid place-items-center">
                <BsBeRadar concept={concept} size={240} />
              </div>
              {analysis && (
                <p className="mt-2 text-caption text-text-secondary">{analysis.engineering_note}</p>
              )}
            </div>
          </div>

          {/* simulation analysis */}
          <div className="card mt-4 p-3">
            <div className="text-caption font-semibold uppercase tracking-wide text-agent-simulation">
              {lang === 'fr' ? 'Analyse Simulation Agent' : 'Simulation Agent analysis'}
            </div>
            {analysis ? (
              <div className="mt-1 space-y-1 text-body text-text-secondary">
                <p>{analysis.fbs_summary}</p>
                <p className="text-text-muted">{lang === 'fr' ? 'Risque boucle feedback : ' : 'Feedback-loop risk: '}{analysis.feedback_loop_risk}</p>
              </div>
            ) : (
              <p className="mt-1 text-caption text-text-muted">{lang === 'fr' ? 'Analyse en cours…' : 'Analysing…'}</p>
            )}
          </div>

          {/* product image studio — render from specs + iterate with prompts */}
          <ImageStudio concept={concept} />
        </div>

        {/* feedback panel */}
        {panelOpen && canFeedback && <FeedbackPanel simLevel={simLevel} lang={lang} loopStep={feedbackLoop.step} deviationPct={feedbackLoop.deviationPct} onGoE4={() => navigate('/e4')} />}
      </div>
    </div>
  );
}

function FeedbackPanel({
  simLevel,
  lang,
  loopStep,
  deviationPct,
  onGoE4,
}: {
  simLevel: HITLLevel;
  lang: 'fr' | 'en';
  loopStep: number;
  deviationPct: number | null;
  onGoE4: () => void;
}) {
  const auto = simLevel >= 4;
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running || !auto) return;
    if (loopStep >= 6) {
      setRunning(false);
      return;
    }
    const id = setTimeout(() => advanceFeedback(), 1500);
    return () => clearTimeout(id);
  }, [running, auto, loopStep]);

  function start() {
    setRunning(true);
    advanceFeedback();
  }

  return (
    <aside className="card sticky top-16 h-fit border-l-2 border-l-status-warning p-3">
      <div className="text-section font-semibold text-status-warning">
        {lang === 'fr' ? 'Boucle feedback ADT' : 'ADT feedback loop'}
      </div>
      <p className="mt-1 text-caption text-text-muted">
        {auto
          ? lang === 'fr' ? `Simulation L${simLevel} : avance automatique.` : `Simulation L${simLevel}: auto-advance.`
          : lang === 'fr' ? `Simulation L${simLevel} : avance manuelle.` : `Simulation L${simLevel}: manual stepping.`}
      </p>
      {deviationPct != null && (
        <div className="mt-2 rounded border border-status-warning/40 bg-amber-500/10 px-2 py-1 text-caption font-semibold text-status-warning animate-pulse-amber">
          +{deviationPct}% {lang === 'fr' ? 'déviation contrainte détectée' : 'stress deviation detected'}
        </div>
      )}

      <ol className="relative mt-3 ml-2 border-l border-border">
        {FEEDBACK_STEPS.map((s) => {
          const t = feedbackStepText(s, lang);
          const reached = loopStep >= s.step;
          return (
            <li key={s.step} className={`mb-3 pl-3 ${reached ? '' : 'opacity-40'}`}>
              <span className={`absolute -left-[5px] h-2 w-2 rounded-full ${reached ? 'bg-status-warning' : 'bg-border'}`} />
              <div className="text-body font-medium text-text-primary">{s.node} — {t.title}</div>
              <div className="text-caption text-text-muted">{t.detail}</div>
            </li>
          );
        })}
      </ol>

      {loopStep === 0 && (
        <button onClick={start} className="btn-primary w-full">
          {lang === 'fr' ? 'Simuler le retour terrain' : 'Simulate field feedback'}
        </button>
      )}
      {loopStep > 0 && loopStep < 6 && !auto && (
        <button onClick={() => advanceFeedback()} className="btn-primary w-full">
          {lang === 'fr' ? 'Étape suivante →' : 'Next step →'}
        </button>
      )}
      {loopStep >= 6 && (
        <div className="space-y-2">
          <div className="rounded border border-status-pass/40 bg-emerald-500/10 p-2 text-caption text-status-pass">
            {lang === 'fr'
              ? 'Boucle complétée — 1 itération de redesign. Concept A-v2 généré.'
              : 'Loop complete — 1 redesign iteration. Concept A-v2 generated.'}
          </div>
          <button onClick={onGoE4} className="btn-ghost w-full">
            {lang === 'fr' ? 'Voir A-v2 sur E4 →' : 'View A-v2 on E4 →'}
          </button>
        </div>
      )}
    </aside>
  );
}

function Row({ label, be, bs, ok }: { label: string; be: number; bs: number; ok: boolean }) {
  return (
    <tr>
      <td className="text-text-secondary">{label}</td>
      <td className="text-right text-text-muted">{be}</td>
      <td className={`text-right ${ok ? 'text-status-pass' : 'text-status-redesign'}`}>{bs}</td>
    </tr>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-text-muted">{k}</span>
      <span className="text-text-primary">{v}</span>
    </div>
  );
}
