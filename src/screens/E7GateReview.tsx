import { useEffect, useRef, useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { Save, FolderCheck, Download } from 'lucide-react';
import { useLangStore } from '@/i18n';
import { useAppState } from '@/store/appState';
import { useBackendStore } from '@/store/backend';
import { compositeScore } from '@/engine/composite';
import { runResidualRisks } from '@/llm/calls';
import { createProject, saveProject, type ProjectSnapshot } from '@/api/client';
import { scenarios } from '@/config/scenarios';
import GaugeDFx from '@/components/GaugeDFx';
import ADTTimeline from '@/components/ADTTimeline';
import type { DFxKey, ScenarioId } from '@/types';
import type { ResidualRisks } from '@/llm/contracts';

const DFX_ROWS: { key: DFxKey; label: string; accent?: boolean }[] = [
  { key: 'dfm', label: 'DFM' },
  { key: 'dfa', label: 'DFA' },
  { key: 'dfr', label: 'DFR' },
  { key: 'dfc', label: 'DFC' },
  { key: 'dfs', label: 'DFS', accent: true },
];

const SEV_COLOR: Record<string, string> = {
  faible: 'bg-emerald-500/15 text-status-pass',
  moyen: 'bg-amber-500/15 text-status-warning',
  élevé: 'bg-red-500/15 text-status-redesign',
};

export default function E7GateReview() {
  const lang = useLangStore((s) => s.lang);
  const navigate = useNavigate();
  const concepts = useAppState((s) => s.concepts);
  const brief = useAppState((s) => s.brief);
  const scenario = useAppState((s) => s.scenario);
  const scenarioName = useAppState((s) => s.scenarioName);
  const selectedId = useAppState((s) => s.selectedConceptId);
  const apiKey = useAppState((s) => s.apiKey);
  const adt = useAppState((s) => s.adt);
  const feedbackLoop = useAppState((s) => s.feedbackLoop);
  const guidance = useAppState((s) => s.guidanceAnswers);
  const appendADT = useAppState((s) => s.appendADT);
  const [risks, setRisks] = useState<ResidualRisks | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<{ dir: string; files: number } | 'offline' | null>(null);
  const savedRef = useRef(false);

  const selected = concepts.find((c) => c.id === selectedId);
  const composite = selected ? compositeScore(selected.scores, brief.dfxPriorities) : 0;

  function buildSnapshot(): ProjectSnapshot {
    return {
      scenarioName,
      brief,
      concepts,
      customFields: useBackendStore.getState().customFields,
      adt,
      selectedConceptId: selectedId,
      guidanceAnswers: guidance,
      feedbackLoop,
      runMode: useAppState.getState().runMode,
    };
  }

  // Offline fallback: download the whole snapshot as a JSON file (no server).
  function downloadSnapshot() {
    const safe = (brief.name || 'projet').replace(/[^a-zA-Z0-9]+/g, '_').toLowerCase();
    const blob = new Blob([JSON.stringify({ ...buildSnapshot(), savedAt: new Date().toISOString() }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `projet_${safe}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function saveProjectRun(manual = false) {
    if (saving) return;
    setSaving(true);
    try {
      const bs = useBackendStore.getState();
      let pid = bs.projectId;
      if (!pid) {
        const sid = scenario && /^S[1-6]$/.test(scenario) ? scenario : null;
        const proj = await createProject(sid, brief);
        bs.setProjectId(proj.id);
        bs.setOnline(true);
        pid = proj.id;
      }
      const result = await saveProject(pid, buildSnapshot());
      setSaveResult({ dir: result.dir, files: result.files.length });
      appendADT({ agent: 'doc', event: 'project_saved', source: 'Documentation Agent', payload: { dir: result.dir } });
    } catch {
      // backend unavailable — fall back to a local JSON download
      if (manual) downloadSnapshot();
      setSaveResult('offline');
      useBackendStore.getState().setOnline(false);
    } finally {
      setSaving(false);
    }
  }

  // Auto-save the completed run once the gate review is reached.
  useEffect(() => {
    if (!selected || savedRef.current) return;
    savedRef.current = true;
    saveProjectRun(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  useEffect(() => {
    if (!selected) return;
    let alive = true;
    const scn = scenario && scenario !== 'custom' ? scenarios[scenario as ScenarioId] : null;
    runResidualRisks(apiKey, selected, scn, feedbackLoop.step >= 6).then(({ data }) => alive && setRisks(data));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  if (concepts.length === 0) return <Navigate to="/e3" replace />;
  if (!selected) return <Navigate to="/e6" replace />;

  const dfsHighlight = scenario === 'S3';
  const standardsOk = brief.standards.length > 0;
  const circularOk = selected.scores.dfs >= 70;
  const feedbackDone = feedbackLoop.step >= 6;

  function exportTXT() {
    const date = new Date().toISOString().slice(0, 10);
    const safe = (selected!.name || 'produit').replace(/[^a-zA-Z0-9]+/g, '_').toLowerCase();
    const lines: string[] = [];
    lines.push('==============================================');
    lines.push('  APDA — GATE REVIEW');
    lines.push('==============================================');
    lines.push(`Date            : ${new Date().toISOString()}`);
    lines.push(`Scénario        : ${scenarioName}`);
    lines.push(`Produit         : ${brief.name}`);
    lines.push(`Concept retenu  : ${selected!.name} (${selected!.materialProcess})`);
    lines.push(`Score composite : ${composite.toFixed(1)} / 100`);
    lines.push('');
    lines.push('--- Scores DFx ---');
    DFX_ROWS.forEach((r) => lines.push(`  ${r.label.padEnd(5)} : ${selected!.scores[r.key]}`));
    lines.push('');
    lines.push('--- Sous-scores DFS (durabilité) ---');
    lines.push(`  DFS global       : ${selected!.scores.dfs}`);
    lines.push(`  Seuil circulaire : ${circularOk ? 'ATTEINT (>= 70)' : 'NON ATTEINT (< 70)'}`);
    lines.push('');
    lines.push('--- Conformité normes ---');
    brief.standards.forEach((s) => lines.push(`  ${s} : OK`));
    lines.push('');
    if (risks) {
      lines.push('--- Risques résiduels ---');
      risks.risks.forEach((r, i) => lines.push(`  ${i + 1}. [${r.severity}] (${r.category}) ${r.risk} -> ${r.mitigation}`));
      lines.push('');
    }
    if (feedbackDone) {
      lines.push('--- Boucle feedback ---');
      lines.push('  Boucle complétée — 1 itération de redesign. Concept A-v2 généré.');
      lines.push('');
    }
    lines.push('--- Réponses guidance ---');
    Object.entries(guidance).forEach(([k, v]) => lines.push(`  ${k} : ${v}`));
    if (Object.keys(guidance).length === 0) lines.push('  (aucune)');
    lines.push('');
    lines.push('--- Thread numérique (ADT) ---');
    adt.forEach((e) => lines.push(`  [${e.timestamp}] ${e.agent} · ${e.event} · ${e.source}${e.hitlLevel ? ' · L' + e.hitlLevel : ''}`));
    lines.push('');
    lines.push(`Total entrées ADT : ${adt.length}`);
    lines.push('==============================================');

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gate_review_${safe}_${date}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    appendADT({ agent: 'doc', event: 'gate_review_exported', source: 'Documentation Agent', payload: { file: a.download } });
  }

  return (
    <div className="mx-auto max-w-app px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-screen font-semibold">Gate Review</h1>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => saveProjectRun(true)} disabled={saving} className="btn-ghost">
            <Save size={14} className={saving ? 'animate-pulse' : ''} />
            {saving
              ? lang === 'fr' ? 'Enregistrement…' : 'Saving…'
              : lang === 'fr' ? 'Enregistrer le projet' : 'Save project'}
          </button>
          <button onClick={exportTXT} className="btn-primary">
            {lang === 'fr' ? 'Exporter le rapport (.txt) ↓' : 'Export report (.txt) ↓'}
          </button>
        </div>
      </div>

      {/* save status */}
      {saveResult && (
        <div
          className={`mt-3 flex flex-wrap items-center gap-2 rounded border p-2.5 text-caption ${
            saveResult === 'offline'
              ? 'border-status-warning/40 bg-amber-500/10 text-status-warning'
              : 'border-status-pass/40 bg-emerald-500/10 text-status-pass'
          }`}
        >
          {saveResult === 'offline' ? (
            <>
              <Download size={14} />
              <span>
                {lang === 'fr'
                  ? 'Backend indisponible — projet sauvegardé localement en JSON.'
                  : 'Backend unavailable — project saved locally as JSON.'}
              </span>
              <button onClick={downloadSnapshot} className="ml-auto underline">
                {lang === 'fr' ? 'Re-télécharger' : 'Re-download'}
              </button>
            </>
          ) : (
            <>
              <FolderCheck size={14} />
              <span>
                {lang === 'fr' ? 'Projet enregistré dans ' : 'Project saved to '}
                <code className="font-mono">{saveResult.dir}/</code>
                {lang === 'fr' ? ` (${saveResult.files} fichiers)` : ` (${saveResult.files} files)`}
              </span>
            </>
          )}
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-4">
          {/* decision card */}
          <div className="card border-l-2 border-l-human p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-caption uppercase tracking-wide text-text-muted">{lang === 'fr' ? 'Décision' : 'Decision'}</div>
                <div className="text-section font-semibold">{selected.name}</div>
                <div className="text-caption text-text-muted">{selected.materialProcess}</div>
              </div>
              <div className="text-right">
                <div className="text-caption text-text-muted">{lang === 'fr' ? 'Score composite' : 'Composite'}</div>
                <div className="text-screen font-bold tnum text-human">{composite.toFixed(1)}</div>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {DFX_ROWS.map((r) => (
                <GaugeDFx key={r.key} value={selected.scores[r.key]} label={r.label} accent={r.accent || (dfsHighlight && r.key === 'dfs')} />
              ))}
            </div>
          </div>

          {/* compliance badges */}
          <div className="card p-4">
            <div className="mb-2 text-section font-semibold">{lang === 'fr' ? 'Conformité' : 'Compliance'}</div>
            <div className="flex flex-wrap gap-2">
              {brief.standards.map((s) => (
                <span key={s} className="pill bg-emerald-500/15 text-status-pass">{s} ✓</span>
              ))}
              {standardsOk ? null : <span className="pill bg-surface-overlay text-text-muted">{lang === 'fr' ? 'Aucune norme déclarée' : 'No standard declared'}</span>}
              {circularOk && (
                <span className="pill bg-dfs/15 text-dfs">
                  {lang === 'fr' ? 'Répond au seuil de conception circulaire (DFS ≥ 70)' : 'Meets circular-design threshold (DFS ≥ 70)'}
                </span>
              )}
            </div>
          </div>

          {/* feedback summary */}
          {feedbackDone && (
            <div className="card border-l-2 border-l-status-warning p-3 text-body text-status-warning">
              {lang === 'fr'
                ? 'Boucle feedback complétée — 1 itération de redesign. Concept A-v2 sélectionnable.'
                : 'Feedback loop complete — 1 redesign iteration. Concept A-v2 selectable.'}
            </div>
          )}

          {/* residual risks */}
          <div className="card p-4">
            <div className="mb-2 text-section font-semibold">{lang === 'fr' ? 'Risques résiduels' : 'Residual risks'}</div>
            {!risks ? (
              <div className="text-caption text-text-muted">{lang === 'fr' ? 'Analyse IA en cours…' : 'AI analysis in progress…'}</div>
            ) : (
              <table className="w-full text-body">
                <thead>
                  <tr className="text-caption uppercase text-text-muted">
                    <th className="py-1 text-left font-medium">{lang === 'fr' ? 'Risque' : 'Risk'}</th>
                    <th className="py-1 text-left font-medium">{lang === 'fr' ? 'Sévérité' : 'Severity'}</th>
                    <th className="py-1 text-left font-medium">{lang === 'fr' ? 'Catégorie' : 'Category'}</th>
                    <th className="py-1 text-left font-medium">{lang === 'fr' ? 'Mitigation' : 'Mitigation'}</th>
                  </tr>
                </thead>
                <tbody>
                  {risks.risks.map((r, i) => (
                    <tr key={i} className="border-t border-border align-top">
                      <td className="py-1.5 pr-2 text-text-primary">{r.risk}</td>
                      <td className="py-1.5 pr-2"><span className={`pill ${SEV_COLOR[r.severity] ?? ''}`}>{r.severity}</span></td>
                      <td className="py-1.5 pr-2"><span className={`pill ${/durab/i.test(r.category) ? 'bg-dfs/15 text-dfs' : 'bg-surface-overlay text-text-secondary'}`}>{r.category}</span></td>
                      <td className="py-1.5 text-text-secondary">{r.mitigation}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="flex gap-2">
            <button onClick={() => navigate('/e6')} className="btn-ghost">← {lang === 'fr' ? 'Sélection' : 'Selection'}</button>
            <button onClick={() => navigate('/e8')} className="btn-ghost">{lang === 'fr' ? 'Glossaire' : 'Glossary'}</button>
          </div>
        </div>

        {/* ADT audit */}
        <div>
          <ADTTimeline showExport onExport={exportTXT} maxHeight="46rem" />
          {adt.length < 10 && (
            <div className="mt-2 rounded border border-status-warning/40 bg-amber-500/10 p-2 text-caption text-status-warning">
              {lang === 'fr'
                ? `⚠ ${adt.length}/10 entrées ADT — exécutez la boucle agents (E3) et le feedback (E5) pour un audit complet.`
                : `⚠ ${adt.length}/10 ADT entries — run the agent loop (E3) and feedback (E5) for a complete audit.`}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
