import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useT, useLangStore } from '@/i18n';
import { useAppState } from '@/store/appState';
import {
  scenarioList,
  scenarios,
  briefFromScenario,
  INDUSTRY_PRESETS,
} from '@/config/scenarios';
import { getScenarios } from '@/api/client';
import { AGENT_CONFIG, ROLE_TITLE, pick } from '@/config/hitlMatrix';
import { checkCoherence } from '@/engine/coherence';
import { abortOrchestration } from '@/engine/orchestration';
import ScenarioIcon from '@/components/ScenarioIcon';
import DFxSliders from '@/components/DFxSliders';
import RadarDFx from '@/components/charts/RadarDFx';
import HITLSelector from '@/components/HITLSelector';
import type { AgentId, DFxScores, HITLLevel, Scenario, ScenarioId } from '@/types';

const AGENT_ORDER: AgentId[] = ['orchestrator', 'retrieval', 'generation', 'simulation', 'dfx', 'doc'];

export default function E1Scenario() {
  const t = useT();
  const lang = useLangStore((s) => s.lang);
  const navigate = useNavigate();

  const scenario = useAppState((s) => s.scenario);
  const brief = useAppState((s) => s.brief);
  const setScenario = useAppState((s) => s.setScenario);
  const setBrief = useAppState((s) => s.setBrief);
  const patchBrief = useAppState((s) => s.patchBrief);
  const appendADT = useAppState((s) => s.appendADT);
  const resetAll = useAppState((s) => s.resetAll);
  const resetRun = useAppState((s) => s.resetRun);

  const [mode, setMode] = useState<'industry' | 'manual'>('manual');
  const [touched, setTouched] = useState(false);

  // Scenario templates: prefer the file-backed API list, fall back to the bundled
  // copy when the backend is down (keeps the offline demo working).
  const [list, setList] = useState<Scenario[]>(scenarioList);
  const [tplSource, setTplSource] = useState<'files' | 'bundled'>('bundled');
  useEffect(() => {
    let alive = true;
    getScenarios()
      .then((s) => {
        if (alive && Array.isArray(s) && s.length > 0) {
          setList(s);
          setTplSource('files');
        }
      })
      .catch(() => {
        /* keep bundled fallback */
      });
    return () => {
      alive = false;
    };
  }, []);

  function selectScenario(id: ScenarioId) {
    const s = list.find((x) => x.id === id) ?? scenarios[id];
    abortOrchestration(); // clear any run paused at a review gate
    resetRun(); // fresh run when (re)choosing a scenario
    setScenario(id, s.name);
    setBrief(briefFromScenario(s));
    setTouched(false);
    appendADT({
      agent: 'human',
      event: 'scenario_selected',
      source: 'saisie manuelle',
      payload: { scenario: id, name: s.name },
    });
  }

  function emptyProject() {
    abortOrchestration(); // clear any run paused at a review gate
    resetAll();
    setScenario('custom', lang === 'fr' ? 'Projet vide' : 'Empty project');
    appendADT({ agent: 'human', event: 'empty_project_started', source: 'saisie manuelle', payload: {} });
  }

  function setDfx(key: keyof DFxScores, value: number) {
    setTouched(true);
    patchBrief({ dfxPriorities: { ...brief.dfxPriorities, [key]: value } });
  }

  function applyPreset(presetKey: string) {
    const p = INDUSTRY_PRESETS.find((x) => x.key === presetKey);
    if (!p) return;
    setTouched(true);
    patchBrief({ dfxPriorities: p.dfx as unknown as DFxScores });
  }

  function setLevel(agent: AgentId, level: HITLLevel) {
    setTouched(true);
    patchBrief({ agentLevels: { ...brief.agentLevels, [agent]: level } });
  }

  const warnings = useMemo(() => checkCoherence(brief.agentLevels), [brief.agentLevels]);
  const role = ROLE_TITLE[brief.agentLevels.orchestrator as HITLLevel];
  const isPredefined = scenario && scenario !== 'custom';

  return (
    <div className="mx-auto max-w-app px-4 py-6">
      <h1 className="text-screen font-semibold">{t('e1.title')}</h1>

      {/* E1.1 — starting point */}
      <section className="mt-5">
        <div className="flex flex-wrap items-center gap-2">
          <SectionTitle n="1" label={lang === 'fr' ? 'Point de départ' : 'Starting point'} />
          <span className="pill bg-surface-overlay text-text-muted" title={lang === 'fr' ? 'Source des modèles de scénario' : 'Scenario template source'}>
            {tplSource === 'files'
              ? lang === 'fr' ? 'modèles : fichiers (RAG)' : 'templates: files (RAG)'
              : lang === 'fr' ? 'modèles : intégrés' : 'templates: bundled'}
          </span>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((s) => {
            const active = scenario === s.id;
            return (
              <button
                key={s.id}
                onClick={() => selectScenario(s.id)}
                className={`card p-3 text-left transition-colors hover:border-border-strong ${
                  active ? 'border-human ring-1 ring-human/40' : ''
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <span className="grid h-8 w-8 place-items-center rounded bg-surface-overlay text-text-secondary">
                      <ScenarioIcon icon={s.icon} />
                    </span>
                    <div>
                      <div className="text-caption text-text-muted">{s.id}</div>
                      <div className="text-body font-semibold leading-tight">{s.name}</div>
                    </div>
                  </div>
                  <span className="pill bg-human/15 text-human">HITL L{s.globalHITL}</span>
                </div>
                <p className="mt-2 line-clamp-2 text-caption text-text-secondary">{s.description}</p>
                <div className="mt-2 flex gap-0.5">
                  {(['dfm', 'dfa', 'dfr', 'dfc', 'dfs'] as const).map((k) => (
                    <div key={k} className="flex-1">
                      <div className="h-8 w-full rounded-sm bg-surface-overlay">
                        <div
                          className={`w-full rounded-sm ${k === 'dfs' ? 'bg-dfs' : 'bg-human/70'}`}
                          style={{ height: `${(s.dfxPriorities[k] / 5) * 100}%`, marginTop: `${100 - (s.dfxPriorities[k] / 5) * 100}%` }}
                        />
                      </div>
                      <div className={`mt-0.5 text-center text-[9px] ${k === 'dfs' ? 'text-dfs' : 'text-text-muted'}`}>
                        {k.toUpperCase()}
                      </div>
                    </div>
                  ))}
                </div>
              </button>
            );
          })}
        </div>
        <button onClick={emptyProject} className="btn-ghost mt-3">
          + {lang === 'fr' ? 'Démarrer un projet vide' : 'Start an empty project'}
        </button>
      </section>

      {scenario && (
        <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-3">
          {/* E1.2 — DFx priorities */}
          <section className="lg:col-span-2">
            <SectionTitle n="2" label={lang === 'fr' ? 'Priorités DFx (1–5)' : 'DFx priorities (1–5)'} />
            <div className="card mt-3 p-4">
              <div className="mb-3 flex items-center gap-2">
                <ModeTab active={mode === 'industry'} onClick={() => setMode('industry')}>
                  {lang === 'fr' ? 'Mode industrie' : 'Industry mode'}
                </ModeTab>
                <ModeTab active={mode === 'manual'} onClick={() => setMode('manual')}>
                  {lang === 'fr' ? 'Mode manuel' : 'Manual mode'}
                </ModeTab>
              </div>
              {mode === 'industry' && (
                <select
                  className="input mb-4"
                  onChange={(e) => applyPreset(e.target.value)}
                  defaultValue=""
                >
                  <option value="" disabled>
                    {lang === 'fr' ? 'Choisir un secteur…' : 'Choose a sector…'}
                  </option>
                  {INDUSTRY_PRESETS.map((p) => (
                    <option key={p.key} value={p.key}>
                      {p.label}
                    </option>
                  ))}
                </select>
              )}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_auto]">
                <DFxSliders values={brief.dfxPriorities} onChange={setDfx} />
                <div className="grid place-items-center">
                  <RadarDFx
                    series={[{ label: 'DFx', scores: brief.dfxPriorities, color: '#3B82F6' }]}
                    size={200}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* E1.4 — summary */}
          <section>
            <SectionTitle n="4" label={lang === 'fr' ? 'Synthèse pré-lancement' : 'Pre-launch summary'} />
            <div className="card mt-3 space-y-3 p-4">
              <div>
                <div className="text-caption uppercase tracking-wide text-text-muted">
                  {t('shell.scenario')}
                </div>
                <div className="text-body font-semibold">{useAppState.getState().scenarioName}</div>
              </div>
              <div className="rounded border border-human/40 bg-human/10 p-2.5">
                <div className="text-caption text-text-secondary">
                  {lang === 'fr' ? 'Dans cette configuration, vous êtes' : 'In this configuration, you are'}
                </div>
                <div className="text-section font-semibold text-human">{pick(role, lang)}</div>
              </div>
              <div>
                <div className="mb-1 text-caption uppercase tracking-wide text-text-muted">
                  {lang === 'fr' ? 'Agents & niveaux HITL' : 'Agents & HITL levels'}
                </div>
                <div className="space-y-1">
                  {AGENT_ORDER.map((a) => (
                    <div key={a} className="flex items-center justify-between text-body">
                      <span className="text-text-secondary">{pick(AGENT_CONFIG[a].label, lang)}</span>
                      <span className="pill bg-surface-overlay text-text-primary">
                        L{brief.agentLevels[a === 'doc' ? 'doc' : a]}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <button onClick={() => navigate('/e2')} className="btn-primary w-full">
                {lang === 'fr' ? 'Configurer les contraintes techniques →' : 'Configure technical constraints →'}
              </button>
              {isPredefined && !touched && (
                <button onClick={() => navigate('/e3')} className="btn-ghost w-full">
                  {lang === 'fr' ? 'Lancer directement →' : 'Launch directly →'}
                </button>
              )}
            </div>
          </section>

          {/* E1.3 — HITL per agent */}
          <section className="lg:col-span-3">
            <SectionTitle n="3" label={lang === 'fr' ? 'Niveaux HITL par agent' : 'HITL levels per agent'} />
            {warnings.length > 0 && (
              <div className="mt-3 space-y-2">
                {warnings.map((w, i) => (
                  <div
                    key={i}
                    className={`flex items-start gap-2 rounded border p-2.5 text-body ${
                      w.level === 'warn'
                        ? 'border-status-warning/40 bg-amber-500/10 text-status-warning'
                        : 'border-border bg-surface-overlay text-text-secondary'
                    }`}
                  >
                    <span>{w.level === 'warn' ? '⚠' : 'ℹ'}</span>
                    <span>{pick(w.message, lang)}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {AGENT_ORDER.map((a) => (
                <HITLSelector
                  key={a}
                  agent={a}
                  value={brief.agentLevels[a] as HITLLevel}
                  onChange={(l) => setLevel(a, l)}
                />
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function SectionTitle({ n, label }: { n: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="grid h-5 w-5 place-items-center rounded bg-human/20 text-caption font-bold text-human">
        {n}
      </span>
      <h2 className="text-section font-semibold">{label}</h2>
    </div>
  );
}

function ModeTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded px-3 py-1.5 text-body font-medium transition-colors ${
        active ? 'bg-human text-white' : 'bg-surface-overlay text-text-secondary hover:text-text-primary'
      }`}
    >
      {children}
    </button>
  );
}
