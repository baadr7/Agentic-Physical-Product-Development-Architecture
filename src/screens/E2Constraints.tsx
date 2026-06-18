import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLangStore } from '@/i18n';
import { useAppState } from '@/store/appState';
import { scenarios, briefFromScenario } from '@/config/scenarios';
import { AGENT_CONFIG, ROLE_TITLE, pick } from '@/config/hitlMatrix';
import { compositeScore } from '@/engine/composite';
import { generateConcepts } from '@/engine/conceptGen';
import HITLSelector from '@/components/HITLSelector';
import DFxSliders from '@/components/DFxSliders';
import SimBadge from '@/components/SimBadge';
import type { AgentId, ConstraintSourceKind, DFxScores, HITLLevel, ScenarioId } from '@/types';

const AGENT_ORDER: AgentId[] = ['orchestrator', 'retrieval', 'generation', 'simulation', 'dfx', 'doc'];

const SRC_LABEL: Record<ConstraintSourceKind, { fr: string; en: string }> = {
  manual: { fr: 'saisie manuelle', en: 'manual entry' },
  plm_import: { fr: 'Windchill 12.1 (simulé)', en: 'Windchill 12.1 (simulated)' },
  erp_import: { fr: 'SAP S/4HANA (simulé)', en: 'SAP S/4HANA (simulated)' },
  nl_extracted: { fr: 'langage naturel converti', en: 'natural language converted' },
};

interface ConflictState {
  field: string;
  label: string;
  manualValue: number;
  importValue: number;
  importKind: ConstraintSourceKind;
}

export default function E2Constraints() {
  const lang = useLangStore((s) => s.lang);
  const navigate = useNavigate();

  const scenario = useAppState((s) => s.scenario);
  const brief = useAppState((s) => s.brief);
  const patchBrief = useAppState((s) => s.patchBrief);
  const setBrief = useAppState((s) => s.setBrief);
  const sources = useAppState((s) => s.constraintSources);
  const setSource = useAppState((s) => s.setConstraintSource);
  const appendADT = useAppState((s) => s.appendADT);

  const [conflict, setConflict] = useState<ConflictState | null>(null);
  const [nlText, setNlText] = useState('');

  const tr = (v: { fr: string; en: string }) => pick(v, lang);

  function setConstraint(field: keyof typeof brief.constraints, value: number, kind: ConstraintSourceKind = 'manual') {
    patchBrief({ constraints: { ...brief.constraints, [field]: value } });
    setSource(field, { kind, source: tr(SRC_LABEL[kind]), timestamp: new Date().toISOString() });
  }

  function simulateImport(kind: 'plm_import' | 'erp_import') {
    // simulated payloads with plausible values
    const incoming: Record<string, number> =
      kind === 'plm_import'
        ? { pressure_bar: 6, wall_min_mm: 7 } // PLM says 6 bar (conflicts with 16)
        : { cost_target_eur: 64 }; // ERP material cost
    appendADT({
      agent: 'retrieval',
      event: kind === 'plm_import' ? 'plm_import' : 'erp_import',
      source: tr(SRC_LABEL[kind]),
      payload: incoming,
    });
    // conflict detection on pressure_bar
    if (kind === 'plm_import' && brief.constraints.pressure_bar && brief.constraints.pressure_bar !== incoming.pressure_bar) {
      setConflict({
        field: 'pressure_bar',
        label: lang === 'fr' ? 'Pression (bar)' : 'Pressure (bar)',
        manualValue: brief.constraints.pressure_bar,
        importValue: incoming.pressure_bar,
        importKind: kind,
      });
      return;
    }
    Object.entries(incoming).forEach(([k, v]) => setConstraint(k as any, v as number, kind));
  }

  function resolveConflict(choice: 'manual' | 'import') {
    if (!conflict) return;
    const chosen = choice === 'manual' ? conflict.manualValue : conflict.importValue;
    const kind: ConstraintSourceKind = choice === 'manual' ? 'manual' : conflict.importKind;
    setConstraint(conflict.field as any, chosen, kind);
    appendADT({
      agent: 'human',
      event: 'constraint_conflict_resolved',
      source: 'saisie manuelle',
      payload: {
        field: conflict.field,
        manual: { value: conflict.manualValue, source: tr(SRC_LABEL.manual) },
        import: { value: conflict.importValue, source: tr(SRC_LABEL[conflict.importKind]) },
        chosen,
      },
    });
    setConflict(null);
  }

  function extractNL() {
    // Phase 3 wires the real LLM. Here: deterministic stub extraction.
    if (/16\s*bar/i.test(nlText)) setConstraint('pressure_bar', 16, 'nl_extracted');
    if (/120\s*°?c/i.test(nlText)) setConstraint('temp_max_C', 120, 'nl_extracted');
    appendADT({ agent: 'orchestrator', event: 'nl_extraction', source: tr(SRC_LABEL.nl_extracted), payload: { text: nlText } });
  }

  function resetToScenario() {
    if (scenario && scenario !== 'custom') setBrief(briefFromScenario(scenarios[scenario as ScenarioId]));
  }

  function setDfx(key: keyof DFxScores, value: number) {
    patchBrief({ dfxPriorities: { ...brief.dfxPriorities, [key]: value } });
  }

  function setLevel(agent: AgentId, level: HITLLevel) {
    patchBrief({ agentLevels: { ...brief.agentLevels, [agent]: level } });
  }

  function launch() {
    appendADT({ agent: 'human', event: 'agents_launched', source: 'saisie manuelle', hitlLevel: brief.agentLevels.orchestrator, payload: { brief: brief.name } });
    navigate('/e3');
  }

  // live composite preview of the concepts this brief will generate, under the
  // current priorities — updates as constraints and DFx weights change.
  const ranked = useMemo(
    () =>
      generateConcepts(brief, scenario)
        .map((c) => ({ id: c.id, name: c.name, v: compositeScore(c.scores, brief.dfxPriorities) }))
        .sort((a, b) => b.v - a.v),
    [brief, scenario],
  );

  const role = ROLE_TITLE[brief.agentLevels.orchestrator as HITLLevel];
  const nameInvalid = !brief.name.trim();

  const numFields: { key: keyof typeof brief.constraints; label: { fr: string; en: string }; unit: string }[] = [
    { key: 'pressure_bar', label: { fr: 'Pression', en: 'Pressure' }, unit: 'bar' },
    { key: 'temp_max_C', label: { fr: 'Temp. max', en: 'Max temp' }, unit: '°C' },
    { key: 'temp_min_C', label: { fr: 'Temp. min', en: 'Min temp' }, unit: '°C' },
    { key: 'mass_max_kg', label: { fr: 'Masse max', en: 'Max mass' }, unit: 'kg' },
    { key: 'mtbf_cycles', label: { fr: 'MTBF', en: 'MTBF' }, unit: 'cycles' },
    { key: 'cost_target_eur', label: { fr: 'Coût cible', en: 'Target cost' }, unit: '€' },
    { key: 'wall_min_mm', label: { fr: 'Paroi min', en: 'Min wall' }, unit: 'mm' },
    { key: 'ra_um', label: { fr: 'Rugosité Ra', en: 'Roughness Ra' }, unit: 'µm' },
  ];

  return (
    <div className="mx-auto max-w-app px-4 py-6">
      <div className="flex items-center justify-between">
        <h1 className="text-screen font-semibold">
          {lang === 'fr' ? 'Configuration des contraintes techniques' : 'Technical constraints configuration'}
        </h1>
        <button onClick={resetToScenario} className="btn-ghost text-caption">
          {lang === 'fr' ? 'Réinitialiser aux valeurs du scénario' : 'Reset to scenario values'}
        </button>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* LEFT — product parameters */}
        <section className="card p-4">
          <h2 className="text-section font-semibold">{lang === 'fr' ? 'Paramètres produit' : 'Product parameters'}</h2>

          <label className="mt-3 block">
            <span className="text-caption text-text-secondary">{lang === 'fr' ? 'Nom' : 'Name'}</span>
            <input
              className={`input ${nameInvalid ? 'border-status-redesign' : ''}`}
              value={brief.name}
              onChange={(e) => patchBrief({ name: e.target.value })}
            />
          </label>
          <label className="mt-2 block">
            <span className="text-caption text-text-secondary">{lang === 'fr' ? 'Fonction' : 'Function'}</span>
            <textarea
              className="input min-h-[60px]"
              value={brief.function}
              onChange={(e) => patchBrief({ function: e.target.value })}
            />
          </label>

          <div className="mt-3 flex items-center gap-2">
            <button onClick={() => simulateImport('plm_import')} className="btn-ghost text-caption">
              {lang === 'fr' ? 'Importer depuis PLM (simulé)' : 'Import from PLM (simulated)'}
            </button>
            <button onClick={() => simulateImport('erp_import')} className="btn-ghost text-caption">
              {lang === 'fr' ? 'Importer depuis ERP (simulé)' : 'Import from ERP (simulated)'}
            </button>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            {numFields.map((f) => {
              const src = sources[f.key as string];
              return (
                <div key={String(f.key)} className="rounded border border-border bg-surface p-2">
                  <div className="flex items-center justify-between">
                    <span className="text-caption text-text-secondary">{tr(f.label)}</span>
                    <span className="text-caption text-text-muted">{f.unit}</span>
                  </div>
                  <input
                    type="number"
                    className="input mt-1 px-2 py-1"
                    value={brief.constraints[f.key] ?? 0}
                    onChange={(e) => setConstraint(f.key, Number(e.target.value))}
                  />
                  <div className="mt-1 text-[10px] text-text-muted">
                    {src ? src.source : tr(SRC_LABEL.manual)}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-3">
            <span className="text-caption text-text-secondary">{lang === 'fr' ? 'Normes applicables' : 'Applicable standards'}</span>
            <div className="mt-1 flex flex-wrap gap-1">
              {brief.standards.map((s) => (
                <span key={s} className="pill bg-surface-overlay text-text-primary">
                  {s}
                </span>
              ))}
              {brief.standards.length === 0 && <span className="text-caption text-text-muted">—</span>}
            </div>
          </div>

          {/* NL extraction */}
          <div className="mt-4 rounded border border-border bg-surface p-2.5">
            <div className="flex items-center justify-between">
              <span className="text-caption font-semibold text-text-secondary">
                {lang === 'fr' ? 'Description en langage naturel (optionnel)' : 'Natural-language description (optional)'}
              </span>
              <SimBadge />
            </div>
            <textarea
              className="input mt-1.5 min-h-[52px]"
              placeholder={lang === 'fr' ? 'Ex : vanne 16 bar, 120 °C max…' : 'e.g. 16 bar valve, 120 °C max…'}
              value={nlText}
              onChange={(e) => setNlText(e.target.value)}
            />
            <button onClick={extractNL} className="btn-ghost mt-1.5 text-caption" disabled={!nlText.trim()}>
              {lang === 'fr' ? 'Extraire les contraintes →' : 'Extract constraints →'}
            </button>
          </div>
        </section>

        {/* CENTER — DFx + composite preview */}
        <section className="card p-4">
          <h2 className="text-section font-semibold">{lang === 'fr' ? 'Priorités DFx & aperçu' : 'DFx priorities & preview'}</h2>
          <div className="mt-3">
            <DFxSliders values={brief.dfxPriorities} onChange={setDfx} />
          </div>
          <div className="mt-4">
            <div className="mb-1 text-caption uppercase tracking-wide text-text-muted">
              {lang === 'fr' ? 'Aperçu composite (concepts générés)' : 'Composite preview (generated concepts)'}
            </div>
            <div className="space-y-1.5">
              {ranked.map((c, i) => (
                <div key={c.id} className="flex items-center gap-2">
                  <span className={`pill ${i === 0 ? 'bg-human/20 text-human' : 'bg-surface-overlay text-text-muted'}`}>
                    #{i + 1}
                  </span>
                  <span className="w-28 shrink-0 text-caption text-text-secondary">{c.name}</span>
                  <div className="h-2 flex-1 rounded bg-surface">
                    <div
                      className={`h-full rounded ${i === 0 ? 'bg-human' : 'bg-text-muted/60'}`}
                      style={{ width: `${c.v}%` }}
                    />
                  </div>
                  <span className="mono tnum w-9 text-right text-text-primary">{c.v.toFixed(1)}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* RIGHT — agent config */}
        <section>
          <div className="card mb-3 border-l-2 border-l-human p-3">
            <div className="text-caption text-text-secondary">
              {lang === 'fr' ? 'Votre rôle est :' : 'Your role is:'}
            </div>
            <div className="text-section font-semibold text-human">{pick(role, lang)}</div>
          </div>
          <h2 className="mb-2 text-section font-semibold">{lang === 'fr' ? 'Configuration des agents' : 'Agent configuration'}</h2>
          <div className="space-y-2">
            {AGENT_ORDER.map((a) => (
              <div key={a} className="card p-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-body font-semibold">{pick(AGENT_CONFIG[a].label, lang)}</span>
                  <span className="pill bg-human/15 text-human">{pick(ROLE_TITLE[brief.agentLevels[a] as HITLLevel], lang)}</span>
                </div>
                <div className="mt-1.5">
                  <HITLSelectorCompact agent={a} value={brief.agentLevels[a] as HITLLevel} onChange={(l) => setLevel(a, l)} />
                </div>
              </div>
            ))}
          </div>
          <button onClick={launch} disabled={nameInvalid} className="btn-primary mt-4 w-full">
            {lang === 'fr' ? 'Lancer les agents →' : 'Launch the agents →'}
          </button>
        </section>
      </div>

      {/* conflict dialog */}
      {conflict && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
          <div className="card-overlay w-full max-w-lg p-5">
            <h3 className="text-section font-semibold text-status-warning">
              ⚠ {lang === 'fr' ? "Conflit d'import détecté" : 'Import conflict detected'}
            </h3>
            <p className="mt-1 text-body text-text-secondary">
              {lang === 'fr'
                ? `Le champ « ${conflict.label} » diffère entre la saisie manuelle et l'import.`
                : `Field “${conflict.label}” differs between manual entry and the import.`}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <button onClick={() => resolveConflict('manual')} className="card p-3 text-left hover:border-human">
                <div className="text-caption text-text-muted">{tr(SRC_LABEL.manual)}</div>
                <div className="text-screen font-semibold tnum">{conflict.manualValue}</div>
              </button>
              <button onClick={() => resolveConflict('import')} className="card p-3 text-left hover:border-human">
                <div className="text-caption text-text-muted">{tr(SRC_LABEL[conflict.importKind])}</div>
                <div className="text-screen font-semibold tnum">{conflict.importValue}</div>
              </button>
            </div>
            <p className="mt-3 text-caption text-text-muted">
              {lang === 'fr'
                ? 'Les deux sources et votre décision seront tracées dans le thread numérique (ADT).'
                : 'Both sources and your decision will be traced in the digital thread (ADT).'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// compact selector (segmented buttons only)
function HITLSelectorCompact({ agent, value, onChange }: { agent: AgentId; value: HITLLevel; onChange: (l: HITLLevel) => void }) {
  return <HITLSelector agent={agent} value={value} onChange={onChange} compact />;
}
