'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import AdtHeader from '~/adt/_components/AdtHeader';
import { useAdtState } from '~/lib/adt/appState';
import {
  SCENARIOS, HITL_LEVELS, AGENT_HITL_DESCRIPTIONS, AGENT_LEVEL_RANGES,
  type AgentKey, type AgentLevels, type DfxPriorities,
} from '~/lib/adt/config';
import { apiCreateProject, apiCreateRun } from '~/lib/api/fastapi';

const DFX_META: { key: keyof DfxPriorities; label: string; color: string }[] = [
  { key: 'dfm', label: 'DFM', color: '#6366f1' },
  { key: 'dfa', label: 'DFA', color: '#06b6d4' },
  { key: 'dfr', label: 'DFR', color: '#10b981' },
  { key: 'dfc', label: 'DFC', color: '#f59e0b' },
  { key: 'dfs', label: 'DFS', color: '#10b981' },
];

const AGENT_LABELS: Record<AgentKey, string> = {
  orchestrator: 'Orchestrator',
  retrieval: 'Retrieval Agent',
  generation: 'Generation Agent',
  simulation: 'Simulation Agent',
  dfx: 'DFx Agents (×5)',
  documentation: 'Documentation Agent',
};

const SECTOR_COLORS: Record<string, { bg: string; text: string }> = {
  'Aéronautique': { bg: 'rgba(99,102,241,0.12)', text: '#818cf8' },
  'Industrie':    { bg: 'rgba(6,182,212,0.12)',   text: '#06b6d4' },
  'Consommation': { bg: 'rgba(16,185,129,0.12)',  text: '#10b981' },
  'Startup':      { bg: 'rgba(139,92,246,0.12)',  text: '#a78bfa' },
  'Automobile':   { bg: 'rgba(245,158,11,0.12)',  text: '#f59e0b' },
  'Custom':       { bg: 'rgba(244,63,94,0.12)',   text: '#fb7185' },
};

// ── Mini radar for DFx priorities ─────────────────────────
function DfxRadarMini({ p }: { p: DfxPriorities }) {
  const cx = 44, cy = 44, r = 36;
  const keys: (keyof DfxPriorities)[] = ['dfm','dfa','dfr','dfc','dfs'];
  const angles = keys.map((_, i) => (Math.PI * 2 * i) / keys.length - Math.PI / 2);
  const pts = keys.map((k, i) => {
    const v = p[k] / 5;
    return `${cx + Math.cos(angles[i]!) * r * v},${cy + Math.sin(angles[i]!) * r * v}`;
  });
  return (
    <svg width={88} height={88} viewBox="0 0 88 88">
      {[1, 2, 3, 4, 5].map(lv => (
        <polygon key={lv} points={angles.map((a) => `${cx + Math.cos(a) * r * (lv / 5)},${cy + Math.sin(a) * r * (lv / 5)}`).join(' ')}
          fill="none" stroke="rgba(100,116,139,0.15)" strokeWidth={0.5} />
      ))}
      <polygon points={pts.join(' ')} fill="rgba(99,102,241,0.2)" stroke="#6366f1" strokeWidth={1.5} />
      {keys.map((k, i) => (
        <text key={k} x={cx + Math.cos(angles[i]!) * (r + 10)} y={cy + Math.sin(angles[i]!) * (r + 10)}
          textAnchor="middle" dominantBaseline="middle" fill="#64748b" fontSize={8} fontWeight={700}>
          {k.toUpperCase()}
        </text>
      ))}
    </svg>
  );
}

export default function AdtScenarioPage() {
  const router = useRouter();
  const { state, setScenario, setDfxPriorities, setAgentLevels, setProjectRun } = useAdtState();
  const [step, setStep] = useState<'select' | 'config' | 'recap'>('select');
  const [creating, setCreating] = useState(false);

  const scenario = useMemo(() => SCENARIOS.find(s => s.id === state.scenarioId), [state.scenarioId]);

  // Local editable copies
  const [localDfx, setLocalDfx] = useState<DfxPriorities>(state.dfxPriorities);
  const [localLevels, setLocalLevels] = useState<AgentLevels>(state.agentLevels);
  const [expandedAgent, setExpandedAgent] = useState<AgentKey | null>(null);

  function handleSelectScenario(id: string) {
    setScenario(id);
    const sc = SCENARIOS.find(s => s.id === id)!;
    setLocalDfx({ ...sc.dfxPriorities });
    setLocalLevels({ ...sc.agentLevels });
  }

  async function handleContinue() {
    setDfxPriorities(localDfx);
    setAgentLevels(localLevels);
    if (step === 'select') { setStep('config'); return; }
    if (step === 'config') { setStep('recap'); return; }
    
    // Launch: Create project & run, then navigate to E2 config
    setCreating(true);
    try {
      const p = await apiCreateProject({
        title: `Projet ${scenario?.name || 'Custom'}`,
        description: scenario?.description || 'Scénario sur mesure',
        product_type: scenario?.industry || 'Unknown'
      });
      const r = await apiCreateRun({
        project_id: p.id,
        description: `Run ADT pour ${scenario?.name || 'Custom'}`
      });
      setProjectRun(p.id, r.id);
      router.push(`/adt/config?projectId=${p.id}&runId=${r.id}`);
    } catch (e) {
      console.error('Erreur lors de la création du projet', e);
      setCreating(false);
    }
  }

  const orchLevel = localLevels.orchestrator;
  const roleMap: Record<number, string> = { 1: 'Opérateur', 2: 'Collaborateur', 3: 'Décideur', 4: 'Approbateur', 5: 'Observateur' };

  return (
    <div className="adt-root space-y-6">
      <AdtHeader />

      {/* Hero */}
      <div className="adt-glass p-6" style={{ borderColor: 'rgba(99,102,241,0.2)' }}>
        <div className="flex flex-col md:flex-row md:items-center gap-5">
          <div className="flex-1">
            <p className="adt-metric-label mb-1">Étape 1 / 7 — {step === 'select' ? 'Sélection' : step === 'config' ? 'Configuration' : 'Récapitulatif'}</p>
            <h2 className="text-lg font-bold text-white mb-2">Choix du scénario &amp; paramétrage</h2>
            <p className="text-sm" style={{ color: '#94a3b8', lineHeight: 1.6 }}>
              {step === 'select' && 'Sélectionnez un scénario industriel. Chaque carte pré-configure les priorités DFx, les niveaux HITL et les normes.'}
              {step === 'config' && 'Ajustez les priorités DFx (1–5) et les niveaux d\'autonomie de chaque agent (L1–L5).'}
              {step === 'recap' && 'Vérifiez la configuration avant de lancer le workflow.'}
            </p>
          </div>
          {/* Step indicator */}
          <div className="flex gap-2">
            {['select', 'config', 'recap'].map((s, i) => (
              <button key={s} onClick={() => setStep(s as any)}
                className={`adt-step-pill ${step === s ? 'active' : i < ['select','config','recap'].indexOf(step) ? 'done' : 'pending'}`}
                style={{ fontSize: 10 }}>
                {s === 'select' ? 'Scénario' : s === 'config' ? 'Paramétrage' : 'Recap'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ════════ STEP 1: Scenario cards ════════ */}
      {step === 'select' && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 adt-stagger">
          {SCENARIOS.map(s => {
            const active = state.scenarioId === s.id;
            const sc = SECTOR_COLORS[s.industry] ?? { bg: 'rgba(100,116,139,0.12)', text: '#94a3b8' };
            return (
              <button key={s.id} type="button"
                className={`adt-glass adt-glass-hover adt-scenario-card ${active ? 'selected' : ''} text-left w-full p-5`}
                onClick={() => handleSelectScenario(s.id)}>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <span className="adt-sector-badge" style={{ background: sc.bg, color: sc.text }}>
                    <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: sc.text }} />
                    {s.industry}
                  </span>
                  <span className="adt-gate-badge" style={{ background: 'rgba(99,102,241,0.1)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.25)' }}>
                    {s.id}
                  </span>
                </div>
                <div className="text-base font-bold text-white mb-1">{s.name}</div>
                <div className="text-xs mb-3" style={{ color: '#64748b', lineHeight: 1.5 }}>{s.description}</div>
                {/* Standards */}
                {s.standards.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {s.standards.slice(0, 3).map(std => (
                      <span key={std} className="adt-gate-badge" style={{ background: 'rgba(6,182,212,0.1)', color: '#06b6d4', border: '1px solid rgba(6,182,212,0.2)' }}>
                        {std}
                      </span>
                    ))}
                  </div>
                )}
                {/* Mini radar */}
                <div className="flex items-center gap-3 mt-2">
                  <DfxRadarMini p={s.dfxPriorities} />
                  <div className="text-xs" style={{ color: '#475569' }}>
                    <div>Rôle: <span style={{ color: sc.text }}>{s.humanRole}</span></div>
                    <div>HITL: <span style={{ color: '#818cf8' }}>L{s.globalHITL}</span></div>
                  </div>
                </div>
                {active && <span className="adt-status-pill running mt-3" style={{ fontSize: 9 }}>SÉLECTIONNÉ</span>}
              </button>
            );
          })}
        </div>
      )}

      {/* ════════ STEP 2: DFx + HITL config ════════ */}
      {step === 'config' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* DFx Priorities 1–5 */}
          <div className="adt-glass p-5">
            <div className="adt-metric-label mb-1" style={{ color: '#f59e0b' }}>PRIORITÉS DFx</div>
            <div className="text-sm font-bold text-white mb-4">Pondérations 1–5</div>
            <div className="space-y-4">
              {DFX_META.map(f => (
                <div key={f.key}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold" style={{ color: f.color }}>{f.label}</span>
                    <span className="text-xs font-mono font-bold" style={{ color: f.color }}>{localDfx[f.key]}</span>
                  </div>
                  <input type="range" min={1} max={5} step={1} value={localDfx[f.key]}
                    onChange={e => setLocalDfx(prev => ({ ...prev, [f.key]: Number(e.target.value) }))}
                    className="w-full" style={{ accentColor: f.color, cursor: 'pointer' }} />
                  <div className="flex justify-between text-xs" style={{ color: '#334155', fontSize: 9 }}>
                    <span>1</span><span>2</span><span>3</span><span>4</span><span>5</span>
                  </div>
                </div>
              ))}
            </div>
            {/* Mini radar */}
            <div className="flex justify-center mt-4">
              <DfxRadarMini p={localDfx} />
            </div>
          </div>

          {/* HITL per-agent */}
          <div className="adt-glass p-5">
            <div className="adt-metric-label mb-1" style={{ color: '#6366f1' }}>NIVEAUX HITL PAR AGENT</div>
            <div className="text-sm font-bold text-white mb-4">Autonomie L1–L5</div>
            <div className="space-y-3">
              {(Object.keys(AGENT_LABELS) as AgentKey[]).map(ak => {
                const range = AGENT_LEVEL_RANGES[ak];
                const currentLevel = localLevels[ak];
                const expanded = expandedAgent === ak;
                const desc = AGENT_HITL_DESCRIPTIONS[ak]?.[currentLevel];
                return (
                  <div key={ak} className="rounded-xl p-3" style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(100,116,139,0.12)' }}>
                    <div className="flex items-center justify-between mb-2 cursor-pointer" onClick={() => setExpandedAgent(expanded ? null : ak)}>
                      <div className="text-xs font-bold text-white">{AGENT_LABELS[ak]}</div>
                      <div className="flex gap-1">
                        {[1,2,3,4,5].map(lv => {
                          const hl = HITL_LEVELS[lv]!;
                          const inRange = lv >= range.min && lv <= range.max;
                          const active = currentLevel === lv;
                          return (
                            <button key={lv} type="button"
                              disabled={!inRange}
                              onClick={e => { e.stopPropagation(); setLocalLevels(prev => ({ ...prev, [ak]: lv })); }}
                              style={{
                                width: 28, height: 24, borderRadius: 6, fontSize: 10, fontWeight: 700,
                                background: active ? `${hl.color}25` : 'transparent',
                                border: `1.5px solid ${active ? hl.color : inRange ? 'rgba(100,116,139,0.3)' : 'rgba(100,116,139,0.1)'}`,
                                color: active ? hl.color : inRange ? '#64748b' : '#1e293b',
                                cursor: inRange ? 'pointer' : 'not-allowed',
                                transition: 'all .15s',
                              }}>
                              L{lv}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    {/* Role preview always visible */}
                    <div className="text-xs" style={{ color: '#475569' }}>
                      Votre rôle : <span style={{ color: HITL_LEVELS[currentLevel]?.color ?? '#818cf8', fontWeight: 600 }}>
                        {HITL_LEVELS[currentLevel]?.name ?? '?'}
                      </span>
                    </div>
                    {/* Expanded details */}
                    {expanded && desc && (
                      <div className="mt-2 space-y-1.5" style={{ animation: 'adt-slide-in .2s ease' }}>
                        <div className="text-xs rounded-lg p-2" style={{ background: 'rgba(100,116,139,0.08)', color: '#64748b', lineHeight: 1.5 }}>
                          <span style={{ color: '#475569', fontWeight: 600 }}>Agent IA :</span> {desc.ai}
                        </div>
                        <div className="text-xs rounded-lg p-2" style={{ background: 'rgba(99,102,241,0.06)', color: '#818cf8', lineHeight: 1.5 }}>
                          <span style={{ fontWeight: 600 }}>Humain :</span> {desc.human}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ════════ STEP 3: Recap ════════ */}
      {step === 'recap' && scenario && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {/* Scenario summary */}
            <div className="adt-glass p-5">
              <div className="adt-metric-label mb-3">SCÉNARIO</div>
              <div className="text-sm font-bold text-white mb-1">{scenario.name}</div>
              <div className="text-xs mb-2" style={{ color: '#64748b' }}>{scenario.description}</div>
              <div className="text-xs" style={{ color: '#475569' }}>
                Secteur: <span style={{ color: '#818cf8' }}>{scenario.industry}</span>
              </div>
            </div>
            {/* DFx radar */}
            <div className="adt-glass p-5 flex flex-col items-center">
              <div className="adt-metric-label mb-3">PRIORITÉS DFx</div>
              <DfxRadarMini p={localDfx} />
              <div className="flex gap-2 mt-2">
                {DFX_META.map(f => (
                  <span key={f.key} className="adt-gate-badge" style={{ background: `${f.color}15`, color: f.color, border: `1px solid ${f.color}30` }}>
                    {f.label}={localDfx[f.key]}
                  </span>
                ))}
              </div>
            </div>
            {/* Human role */}
            <div className="adt-glass p-5 flex flex-col items-center justify-center">
              <div className="adt-metric-label mb-2">RÔLE HUMAIN</div>
              <div className="adt-score" style={{ fontSize: 28, color: HITL_LEVELS[orchLevel]?.color ?? '#6366f1' }}>
                {roleMap[orchLevel] ?? 'Décideur'}
              </div>
              <div className="text-xs mt-1" style={{ color: '#475569' }}>
                Orchestrator à L{orchLevel}
              </div>
            </div>
          </div>
          {/* Agent levels recap */}
          <div className="adt-glass p-5">
            <div className="adt-metric-label mb-3">NIVEAUX HITL PAR AGENT</div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-6">
              {(Object.keys(AGENT_LABELS) as AgentKey[]).map(ak => {
                const lv = localLevels[ak];
                const hl = HITL_LEVELS[lv]!;
                return (
                  <div key={ak} className="text-center p-3 rounded-xl" style={{ background: `${hl.color}10`, border: `1px solid ${hl.color}25` }}>
                    <div className="text-xs font-bold" style={{ color: hl.color }}>L{lv}</div>
                    <div className="text-xs mt-1" style={{ color: '#94a3b8' }}>{AGENT_LABELS[ak].split(' ')[0]}</div>
                    <div className="text-xs" style={{ color: '#475569', fontSize: 9 }}>{hl.name}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Footer CTA */}
      <div className="adt-glass p-4 flex items-center justify-between gap-4">
        <div className="text-sm" style={{ color: '#64748b' }}>
          {scenario ? (
            <>Scénario: <span style={{ color: '#818cf8', fontWeight: 600 }}>{scenario.shortName}</span></>
          ) : 'Sélectionnez un scénario.'}
        </div>
        <div className="flex gap-2">
          {step !== 'select' && (
            <button className="adt-btn-secondary"
              onClick={() => setStep(step === 'recap' ? 'config' : 'select')}>
              ← Retour
            </button>
          )}
          <button className="adt-btn-primary" disabled={!scenario || creating} onClick={handleContinue}>
            {creating ? <><span className="adt-spinner"/> Création...</> : (step === 'recap' ? 'Configurer les contraintes ->' : 'Continuer ->')}
          </button>
        </div>
      </div>
    </div>
  );
}
