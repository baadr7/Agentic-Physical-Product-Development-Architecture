'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import AdtHeader from '~/adt/_components/AdtHeader';
import { useAdtState } from '~/lib/adt/appState';
import { HITL_LEVELS, AGENT_HITL_DESCRIPTIONS, type AgentKey } from '~/lib/adt/config';

// ── Agent definitions matching spec ───────────────────────
const AGENTS: { key: AgentKey; label: string; desc: string; initial: string; color: string }[] = [
  { key: 'orchestrator',  label: 'Orchestrator',       desc: 'Séquence et coordonne tous les agents',           initial: 'OR',  color: '#6366f1' },
  { key: 'retrieval',     label: 'Retrieval Agent',     desc: 'Interroge PLM, normes, ERP, Digital Twin, REX',   initial: 'RT',  color: '#06b6d4' },
  { key: 'generation',    label: 'Generation Agent',    desc: 'Génère les concepts candidats (F→S)',              initial: 'GN',  color: '#f59e0b' },
  { key: 'simulation',    label: 'Simulation Agent',    desc: 'Calcule Bs, compare à Be, déclenche redesign',    initial: 'SIM', color: '#10b981' },
  { key: 'dfx',           label: 'DFx Agents (×5)',     desc: 'DFM · DFA · DFR · DFC · DFS en parallèle',        initial: 'DX',  color: '#8b5cf6' },
  { key: 'documentation', label: 'Documentation Agent', desc: 'Digital thread, rapport gate review, BOM',         initial: 'DOC', color: '#f43f5e' },
];

// ── Layer 3 connector icons ───────────────────────────────
const CONNECTORS = [
  { id: 'PLM', label: 'PLM', color: '#6366f1' },
  { id: 'STD', label: 'Normes', color: '#06b6d4' },
  { id: 'CAD', label: 'CAD', color: '#10b981' },
  { id: 'MES', label: 'MES', color: '#f59e0b' },
  { id: 'ERP', label: 'ERP', color: '#8b5cf6' },
  { id: 'DT',  label: 'Digital Twin', color: '#f43f5e' },
  { id: 'FBS', label: 'FBS', color: '#818cf8' },
  { id: 'HITL',label: 'HITL', color: '#10b981' },
];

// ── Sub-screen content per agent ──────────────────────────
const AGENT_SUBSCREEN: Record<AgentKey, { sources: string[]; outputs: string[]; payload: object }> = {
  orchestrator: {
    sources: ['Config.js (scénario)', 'Brief produit E2', 'Niveaux HITL configurés'],
    outputs: ['Plan d\'exécution JSON', 'Entrée ADT créée', 'Routage vers chaque agent'],
    payload: { task: 'orchestrate', agents: ['retrieval','generation','simulation','dfx','documentation'], parallel: true, hitl_comment: 'Plan recommandé selon S2 Industriel', key_risk: 'Cycle thermique -10/+120°C', sustainability_note: 'DFS monitoring enabled' },
  },
  retrieval: {
    sources: ['PLM (projets similaires, AMDEC)', 'Base normes (EN 593, EN 12334)', 'ERP (matériaux disponibles)', 'Digital Twin (données opérationnelles)', 'Base REX interne', 'SAV (retours terrain)'],
    outputs: ['Contexte structuré → Generation Agent', 'Contexte structuré → Simulation Agent', 'Entrée ADT'],
    payload: { connector_id: 'PLM', query_type: 'past_projects', filters: { product_family: 'butterfly_valve', dn: 100 }, max_results: 10, response: { source: 'Windchill 12.1', timestamp: '2026-04-15T10:00:00Z', data: [{ project: 'DN100-2024', material: 'AlSi10Mg', lessons_learned: 'joint_redesign' }], confidence: 0.87 } },
  },
  generation: {
    sources: ['Contexte Retrieval (FBS, normes, matériaux)', 'ERP (disponibilité matières)'],
    outputs: ['4 concepts avec FBS structuré', 'DFx préliminaire par concept', 'SVG paramétrique', 'Envoi → PLM (fiche concept) + CAD (géométrie)'],
    payload: { task: 'generate_concepts', count: 4, axes: ['matériau','procédé','géométrie'], fbs_mapping: 'F→S', constraints: { dn: 100, pn: 16, mass_max_kg: 2.8, cost_target_eur: 85 } },
  },
  simulation: {
    sources: ['CAD (géométrie pour maillage)', 'Digital Twin (conditions aux limites réelles)', 'MES/Sensors (Bs mesurés pour boucle feedback)'],
    outputs: ['Bs calculé par concept', 'Comparaison Bs/Be', 'Statut PASS/REDESIGN', 'Rapport convergence → PLM'],
    payload: { task: 'simulate', solver: 'FEM_deterministic', mesh: 'auto', boundary_conditions: { pressure_bar: 16, temp_c: 120 }, expected: { stress_max_mpa: 120, deflection_max_mm: 0.05 } },
  },
  dfx: {
    sources: ['Brief produit (contraintes)', 'Concepts générés (paramètres)', 'Norme DFx (formules déterministes)'],
    outputs: ['5 scores DFx par concept', 'Justification IA (≤25 mots/critère)', 'Score composite pondéré'],
    payload: { task: 'score_dfx', formulas: 'deterministic_spec_v1', agents: ['DFM','DFA','DFR','DFC','DFS'], parallel: true, note: 'DeepSeek appelé APRÈS scoring pour justification textuelle uniquement' },
  },
  documentation: {
    sources: ['Outputs de tous les agents', 'Décisions HITL horodatées'],
    outputs: ['Digital thread complet (ADT)', 'Rapport gate review', 'BOM → ERP', 'Notification → outils AMDEC externes'],
    payload: { task: 'document', adt_version: 'v1', eu_ai_act_compliance: true, export_formats: ['txt','pdf'], versioning: 'auto' },
  },
};

// ── Simulated execution states ────────────────────────────
type AgentState = 'idle' | 'running' | 'done';

export default function AdtAgentsPage() {
  const router = useRouter();
  const { state } = useAdtState();
  const [agentStates, setAgentStates] = useState<Record<AgentKey, AgentState>>({
    orchestrator: 'idle', retrieval: 'idle', generation: 'idle',
    simulation: 'idle', dfx: 'idle', documentation: 'idle',
  });
  const [activeSubscreen, setActiveSubscreen] = useState<AgentKey | null>(null);
  const [activeConnectors, setActiveConnectors] = useState<string[]>([]);
  const [simRunning, setSimRunning] = useState(false);
  const [simDone, setSimDone] = useState(false);
  const [orchestratorData, setOrchestratorData] = useState<any>(null);

  // Simulate execution and call API
  async function executeAgents() {
    if (simRunning) return;
    setSimRunning(true);
    setSimDone(false);

    // Call orchestrator API
    try {
      setAgentStates(prev => ({ ...prev, orchestrator: 'running' }));
      setActiveConnectors(['HITL', 'FBS']);
      
      const res = await fetch('/api/adt/orchestrator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(state.brief || {})
      });
      const data = await res.json();
      setOrchestratorData(data);
      
      // Update the subscreen payload for orchestrator dynamically
      AGENT_SUBSCREEN.orchestrator.payload = {
        task: 'orchestrate',
        plan: data.plan,
        hitl_comment: data.hitl_comment,
        key_risk: data.key_risk,
        sustainability_note: data.sustainability_note
      };
    } catch (e) {
      console.error('Failed to call orchestrator API', e);
    }
    
    setAgentStates(prev => ({ ...prev, orchestrator: 'done' }));

    const order: AgentKey[] = ['retrieval', 'generation', 'dfx', 'simulation', 'documentation'];
    const connectorMap: Record<AgentKey, string[]> = {
      orchestrator: [],
      retrieval: ['PLM', 'STD', 'ERP', 'DT'],
      generation: ['CAD', 'ERP'],
      simulation: ['CAD', 'DT', 'MES'],
      dfx: ['FBS'],
      documentation: ['PLM', 'ERP'],
    };

    order.forEach((ak, i) => {
      setTimeout(() => {
        setAgentStates(prev => ({ ...prev, [ak]: 'running' }));
        setActiveConnectors(connectorMap[ak] ?? []);
      }, (i + 1) * 1500);
      setTimeout(() => {
        setAgentStates(prev => ({ ...prev, [ak]: 'done' }));
        if (i === order.length - 1) {
          setActiveConnectors([]);
          setSimRunning(false);
          setSimDone(true);
        }
      }, (i + 2) * 1500);
    });
  }

  const allDone = Object.values(agentStates).every(s => s === 'done');
  const progress = Object.values(agentStates).filter(s => s === 'done').length / AGENTS.length * 100;

  return (
    <div className="adt-root space-y-6">
      <AdtHeader />

      {/* Header */}
      <div className="adt-glass p-5" style={{ borderColor: 'rgba(139,92,246,0.25)' }}>
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex-1">
            <div className="adt-metric-label mb-1">Étape 3 / 7</div>
            <h2 className="text-lg font-bold text-white mb-1">Dashboard multi-agents</h2>
            <div className="text-sm" style={{ color: '#64748b' }}>
              Orchestrator → Retrieval → Generation → DFx → Simulation → Documentation
            </div>
          </div>
          <div className="flex gap-2 items-center">
            {!simRunning && !simDone && (
              <button className="adt-btn-primary" onClick={executeAgents}>Lancer les agents →</button>
            )}
            {simRunning && <span className="adt-status-pill running"><span className="adt-spinner" /> RUNNING</span>}
            {allDone && <span className="adt-status-pill pass">COMPLETE</span>}
          </div>
        </div>
        {/* Progress bar */}
        <div className="mt-4">
          <div className="flex justify-between adt-metric-label mb-1">
            <span>Progression</span>
            <span style={{ color: '#818cf8' }}>{progress.toFixed(0)}%</span>
          </div>
          <div className="adt-dfx-track" style={{ height: 8, borderRadius: 4, background: 'rgba(100,116,139,0.2)' }}>
            <div className="adt-dfx-fill" style={{
              width: `${progress}%`, borderRadius: 4, transition: 'width .6s ease',
              background: allDone ? '#10b981' : 'linear-gradient(90deg, #6366f1, #8b5cf6)',
            }} />
          </div>
        </div>
      </div>

      {/* ═══ Layer 3 Connection Panel ═══ */}
      <div className="adt-glass p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="adt-metric-label">LAYER 3 — CONNECTEURS SYSTÈMES INDUSTRIELS</div>
          <span className="adt-gate-badge" style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.2)', fontSize: 9 }}>
            Connexion simulée
          </span>
        </div>
        <div className="flex flex-wrap gap-3 justify-center">
          {CONNECTORS.map(c => {
            const isActive = activeConnectors.includes(c.id);
            return (
              <div key={c.id} className="flex flex-col items-center gap-1" style={{ transition: 'all .3s' }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 12,
                  background: isActive ? `${c.color}20` : 'rgba(15,23,42,0.6)',
                  border: `1.5px solid ${isActive ? c.color : 'rgba(100,116,139,0.2)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 800, color: isActive ? c.color : '#334155',
                  transition: 'all .3s',
                  boxShadow: isActive ? `0 0 12px ${c.color}40` : 'none',
                  animation: isActive ? 'adt-pulse-ring 1.5s ease-out infinite' : 'none',
                }}>
                  {c.id}
                </div>
                <span className="text-xs" style={{ color: isActive ? c.color : '#334155', fontSize: 9, fontWeight: 600, transition: 'color .3s' }}>
                  {c.label}
                </span>
                {isActive && (
                  <span className="adt-gate-badge" style={{ background: `${c.color}15`, color: c.color, border: `1px solid ${c.color}30`, fontSize: 7 }}>
                    Simulé
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ═══ Agent Cards Grid ═══ */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 adt-stagger">
        {AGENTS.map(a => {
          const agentState = agentStates[a.key];
          const level = state.agentLevels[a.key];
          const hitl = HITL_LEVELS[level];
          return (
            <button key={a.key} type="button"
              className={`adt-glass adt-glass-hover text-left w-full ${agentState === 'running' ? 'adt-agent-card active' : ''}`}
              style={{ padding: '18px 20px', borderColor: agentState === 'running' ? `${a.color}60` : agentState === 'done' ? 'rgba(16,185,129,0.25)' : 'rgba(100,116,139,0.15)', transition: 'all .3s' }}
              onClick={() => setActiveSubscreen(activeSubscreen === a.key ? null : a.key)}>
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-3">
                  <div style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: `${a.color}18`, border: `1px solid ${a.color}40`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, fontWeight: 800, color: a.color, flexShrink: 0,
                  }}>
                    {agentState === 'running' ? <span className="adt-spinner" style={{ borderTopColor: a.color, borderColor: `${a.color}33` }} /> : a.initial}
                  </div>
                  <div>
                    <div className="font-bold text-sm text-white">{a.label}</div>
                    <div className="text-xs" style={{ color: '#64748b' }}>{a.desc}</div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={`adt-status-pill ${agentState === 'done' ? 'pass' : agentState === 'running' ? 'running' : 'pending'}`} style={{ fontSize: 9 }}>
                    {agentState === 'done' ? 'DONE' : agentState === 'running' ? 'RUNNING' : 'IDLE'}
                  </span>
                  <span style={{ fontSize: 9, fontWeight: 700, color: hitl?.color ?? '#64748b' }}>
                    L{level} · {hitl?.name ?? '?'}
                  </span>
                </div>
              </div>
              {agentState === 'running' && <div className="adt-progress-bar mt-2" />}
              {agentState === 'done' && <div style={{ height: 2, background: 'rgba(16,185,129,0.4)', borderRadius: 1 }} />}
            </button>
          );
        })}
      </div>

      {/* ═══ Agent Sub-screen ═══ */}
      {activeSubscreen && (
        <div className="adt-glass p-5" style={{ animation: 'adt-slide-in .2s ease', borderColor: `${AGENTS.find(a => a.key === activeSubscreen)?.color ?? '#6366f1'}30` }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: AGENTS.find(a => a.key === activeSubscreen)?.color }} />
              <span className="text-sm font-bold text-white">{AGENTS.find(a => a.key === activeSubscreen)?.label}</span>
              <span className="adt-gate-badge" style={{ background: 'rgba(99,102,241,0.1)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.2)', fontSize: 9 }}>
                L{state.agentLevels[activeSubscreen]} · {HITL_LEVELS[state.agentLevels[activeSubscreen]]?.name}
              </span>
            </div>
            <button className="text-xs underline" style={{ color: '#6366f1' }} onClick={() => setActiveSubscreen(null)}>Fermer</button>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {/* Sources */}
            <div>
              <div className="adt-metric-label mb-2">SOURCES INTERROGÉES</div>
              <div className="space-y-1">
                {AGENT_SUBSCREEN[activeSubscreen].sources.map((s, i) => (
                  <div key={i} className="text-xs px-3 py-2 rounded-lg" style={{ background: 'rgba(6,182,212,0.06)', border: '1px solid rgba(6,182,212,0.12)', color: '#94a3b8' }}>
                    {s}
                  </div>
                ))}
              </div>
            </div>
            {/* Outputs */}
            <div>
              <div className="adt-metric-label mb-2">OUTPUTS</div>
              <div className="space-y-1">
                {AGENT_SUBSCREEN[activeSubscreen].outputs.map((o, i) => (
                  <div key={i} className="text-xs px-3 py-2 rounded-lg" style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.12)', color: '#94a3b8' }}>
                    {o}
                  </div>
                ))}
              </div>
            </div>
            {/* Payload JSON */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="adt-metric-label">PAYLOAD JSON</div>
                <span className="adt-gate-badge" style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.2)', fontSize: 8 }}>Simulé</span>
              </div>
              <pre className="text-xs rounded-lg p-3 overflow-x-auto" style={{ background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.12)', color: '#94a3b8', maxHeight: 200 }}>
                {JSON.stringify(AGENT_SUBSCREEN[activeSubscreen].payload, null, 2)}
              </pre>
            </div>
          </div>

          {/* HITL action for this agent */}
          <div className="mt-4 rounded-lg p-3" style={{ background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.12)' }}>
            <div className="adt-metric-label mb-1" style={{ fontSize: 9 }}>ACTION HUMAINE (L{state.agentLevels[activeSubscreen]})</div>
            <div className="text-xs" style={{ color: '#818cf8', lineHeight: 1.5 }}>
              {AGENT_HITL_DESCRIPTIONS[activeSubscreen]?.[state.agentLevels[activeSubscreen]]?.human ?? '—'}
            </div>
          </div>
        </div>
      )}

      {/* Footer CTA */}
      <div className="adt-glass p-4 flex items-center justify-between gap-3">
        <div className="text-sm" style={{ color: '#64748b' }}>
          {allDone ? 'Tous les agents ont terminé.' : simRunning ? 'Exécution en cours…' : 'Lancez les agents pour commencer.'}
        </div>
        <button className="adt-btn-primary" disabled={!allDone}
          onClick={() => router.push('/adt/concepts')}>
          {allDone ? 'Voir les concepts generes ->' : 'En attente...'}
        </button>
      </div>
    </div>
  );
}
