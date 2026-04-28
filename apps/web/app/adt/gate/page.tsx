'use client';

import { useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';

import AdtHeader from '~/adt/_components/AdtHeader';
import { useAdtState } from '~/lib/adt/appState';
import {
  DN100_CONCEPTS, DN100_FBS, FEEDBACK_LOOP_DATA, SCENARIOS,
  computeCompositeScore, type DN100Concept,
} from '~/lib/adt/config';

const DFX_FIELDS = [
  { key: 'dfm' as const, label: 'DFM', color: '#6366f1' },
  { key: 'dfa' as const, label: 'DFA', color: '#06b6d4' },
  { key: 'dfr' as const, label: 'DFR', color: '#10b981' },
  { key: 'dfc' as const, label: 'DFC', color: '#f59e0b' },
  { key: 'dfs' as const, label: 'DFS', color: '#10b981' },
];

// ── Static risks (DeepSeek would generate these) ──────────
const RESIDUAL_RISKS = [
  { title: 'Fatigue joint d\'étanchéité', severity: 'high', category: 'Fiabilité',
    detail: 'Le joint entre corps et disque montre une usure accélérée au-delà de 30 000 cycles en conditions thermiques extrêmes.',
    mitigation: 'Validation par essai de fatigue accéléré sur 50 000 cycles. Spécifier joint FKM si T > 100°C.' },
  { title: 'Empreinte CO₂ procédé coulée', severity: 'medium', category: 'Durabilité',
    detail: 'Le procédé de coulée AlSi10Mg génère ~4,2 kg CO₂/pièce. Objectif framework : < 3 kg.',
    mitigation: 'Évaluer la coulée basse pression ou le recyclage de matière. DFS à surveiller.' },
  { title: 'Disponibilité fournisseur AlSi10Mg', severity: 'low', category: 'Supply chain',
    detail: 'Un seul fournisseur qualifié dans la base ERP. Risque de rupture d\'approvisionnement.',
    mitigation: 'Qualification d\'un second fournisseur via connecteur ERP.' },
];

const SEVERITY_META: Record<string, { color: string; label: string }> = {
  high:   { color: '#f43f5e', label: 'ÉLEVÉ' },
  medium: { color: '#f59e0b', label: 'MOYEN' },
  low:    { color: '#10b981', label: 'FAIBLE' },
};

export default function AdtGatePage() {
  const sp = useSearchParams();
  const { state } = useAdtState();
  const conceptId = sp?.get('conceptId') || state.selectedConceptId || 'A';
  
  const baseConcept = DN100_CONCEPTS.find(c => c.id === (conceptId === 'A-v2' ? 'A' : conceptId)) ?? DN100_CONCEPTS[0]!;
  const concept = conceptId === 'A-v2' ? {
    ...baseConcept,
    id: 'A-v2',
    name: 'Monolithique (Redesign)',
    dfm: 78,
    weakness: 'Paroi épaissie à 8mm'
  } : baseConcept;
  const composite = computeCompositeScore(concept, state.dfxPriorities);
  const scenario = SCENARIOS.find(s => s.id === state.scenarioId);
  const fb = FEEDBACK_LOOP_DATA;
  const [exportDone, setExportDone] = useState(false);

  // Gate decision
  const highRisks = RESIDUAL_RISKS.filter(r => r.severity === 'high').length;
  const dfsPass = concept.dfs >= 70;
  const decision = highRisks > 0 ? 'conditional' : 'approved';

  // Digital thread entries (≥10 per spec)
  const digitalThread = useMemo(() => {
    const ts = (offset: number) => {
      const d = new Date(); d.setMinutes(d.getMinutes() - offset);
      return d.toISOString().replace('T', ' ').slice(0, 19);
    };
    const entries = [
      { ts: ts(55), event: 'Scénario sélectionné', detail: `${scenario?.shortName ?? state.scenarioId}` },
      { ts: ts(50), event: 'Priorités DFx configurées', detail: `DFM=${state.dfxPriorities.dfm} DFA=${state.dfxPriorities.dfa} DFR=${state.dfxPriorities.dfr} DFC=${state.dfxPriorities.dfc} DFS=${state.dfxPriorities.dfs}` },
      { ts: ts(48), event: 'Niveaux HITL configurés', detail: `Orch=L${state.agentLevels.orchestrator} Ret=L${state.agentLevels.retrieval} Gen=L${state.agentLevels.generation} Sim=L${state.agentLevels.simulation}` },
      { ts: ts(45), event: 'Contraintes techniques définies', detail: 'DN100 PN16 — EN 593 / EN 12334' },
      { ts: ts(40), event: 'Retrieval Agent — contexte chargé', detail: 'PLM, normes, ERP, MES, base REX' },
      { ts: ts(35), event: 'Generation Agent — 4 concepts générés', detail: 'A (Monolithique), B (Boulonné), C (CNC), D (Hybride)' },
      { ts: ts(30), event: 'Simulation Agent — Bs calculé', detail: `Concept ${concept.id}: Bs = ${DN100_FBS.behaviourSimulated[concept.id as keyof typeof DN100_FBS.behaviourSimulated]?.stress_mpa} MPa` },
      { ts: ts(25), event: 'DFx Agents — scores calculés', detail: `DFM=${concept.dfm} DFA=${concept.dfa} DFR=${concept.dfr} DFC=${concept.dfc} DFS=${concept.dfs}` },
      { ts: ts(20), event: `Concept ${concept.id} sélectionné`, detail: `Score composite: ${composite.toFixed(1)}/100` },
      { ts: ts(15), event: 'Validation HITL complétée', detail: `Niveau L${state.agentLevels.orchestrator} — Rôle: ${scenario?.humanRole ?? 'Décideur'}` },
    ];
    if (state.feedbackLoopTriggered) {
      entries.push(
        { ts: ts(12), event: 'MES — Déviation détectée', detail: `+${fb.deviation_pct}% (${fb.bs_real_mpa} MPa vs ${fb.bs_predicted_mpa} MPa)` },
        { ts: ts(10), event: 'Redesign déclenché', detail: `Paroi ${fb.wall_before_mm}mm → ${fb.wall_after_mm}mm → Concept A-v2` },
        { ts: ts(5), event: 'Boucle feedback complétée', detail: '1 itération. A-v2 sélectionné.' },
      );
    }
    return entries;
  }, [state, concept, composite, scenario, fb]);

  // Export TXT
  function exportTxt() {
    const lines = [
      `Gate Review — ${scenario?.name ?? state.scenarioId}`,
      `Date: ${new Date().toISOString()}`,
      `Concept: ${concept.id} — ${concept.name}`,
      `Matériau: ${concept.material} · Procédé: ${concept.process}`,
      `Score composite: ${composite.toFixed(1)} / 100`,
      '',
      '--- Scores DFx ---',
      ...DFX_FIELDS.map(f => `${f.label}: ${concept[f.key]} / 100`),
      '',
      '--- Priorités ---',
      ...Object.entries(state.dfxPriorities).map(([k, v]) => `${k.toUpperCase()}: ${v}`),
      '',
      '--- Risques résiduels ---',
      ...RESIDUAL_RISKS.map(r => `[${r.severity.toUpperCase()}] ${r.title}: ${r.detail}`),
      '',
      '--- Digital Thread ---',
      ...digitalThread.map(e => `[${e.ts}] ${e.event} — ${e.detail}`),
      '',
      state.feedbackLoopTriggered ? 'Boucle feedback complétée — 1 itération de redesign. Concept A-v2 sélectionné.' : '',
      dfsPass ? 'Répond au seuil de conception circulaire (DFS ≥ 70).' : '',
      `Décision: ${decision === 'approved' ? 'APPROUVÉ' : 'CONDITIONNEL'}`,
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gate_review_DN100_${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    setExportDone(true);
    setTimeout(() => setExportDone(false), 3000);
  }

  return (
    <div className="adt-root space-y-6">
      <AdtHeader />

      {/* Header */}
      <div className="adt-glass p-5" style={{ borderColor: 'rgba(99,102,241,0.3)' }}>
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex-1">
            <div className="adt-metric-label mb-1">Étape 7 / 7</div>
            <h2 className="text-lg font-bold text-white mb-1">Gate Review</h2>
            <div className="text-sm" style={{ color: '#64748b' }}>
              Concept {concept.id} · {concept.name} · {scenario?.shortName ?? state.scenarioId}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            {/* Conformity badges */}
            {(scenario?.standards ?? ['EN 593', 'EN 12334']).map(std => (
              <span key={std} className="adt-gate-badge" style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)', fontSize: 10 }}>
                {std} [OK]
              </span>
            ))}
            <span className="adt-gate-badge" style={{ background: 'rgba(6,182,212,0.12)', color: '#06b6d4', border: '1px solid rgba(6,182,212,0.3)', fontSize: 10 }}>
              EU AI Act
            </span>
            {dfsPass && (
              <span className="adt-gate-badge" style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)', fontSize: 10 }}>
                Conception circulaire [OK]
              </span>
            )}
            <span className={`adt-status-pill ${decision === 'approved' ? 'pass' : 'warn'}`} style={{ fontSize: 11 }}>
              {decision === 'approved' ? 'GATE APPROVED' : 'CONDITIONNEL'}
            </span>
          </div>
        </div>
      </div>

      {/* KPI bar */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: 'Score composite', value: composite.toFixed(1), color: '#f59e0b' },
          { label: 'Risques élevés', value: String(highRisks), color: highRisks > 0 ? '#f43f5e' : '#10b981' },
          { label: 'Digital Thread', value: `${digitalThread.length} entrées`, color: '#6366f1' },
          { label: 'DFS Score', value: `${concept.dfs}/100`, color: concept.dfs >= 70 ? '#10b981' : '#f59e0b' },
        ].map(kpi => (
          <div key={kpi.label} className="adt-glass p-4 text-center">
            <div className="adt-score" style={{ fontSize: 28, color: kpi.color }}>{kpi.value}</div>
            <div className="adt-metric-label mt-1">{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* Concept card + DFx scores */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="adt-glass p-5">
          <div className="adt-metric-label mb-3">CONCEPT SÉLECTIONNÉ</div>
          <div className="font-bold text-white text-lg mb-1">Concept {concept.id} — {concept.name}</div>
          <div className="text-xs mb-3" style={{ color: '#475569' }}>{concept.material} · {concept.process} · €{concept.cost_eur}</div>
          <div className="space-y-2">
            {DFX_FIELDS.map(f => (
              <div key={f.key} className="flex items-center gap-2">
                <span className="adt-metric-label w-8" style={{ color: f.color }}>{f.label}</span>
                <div className="flex-1 adt-dfx-track" style={{ height: 6 }}>
                  <div className="adt-dfx-fill" style={{ width: `${concept[f.key]}%`, background: f.color, borderRadius: 3 }} />
                </div>
                <span className="text-xs font-mono w-8 text-right" style={{ color: f.color }}>{concept[f.key]}</span>
                <span className={`adt-status-pill ${concept[f.key] >= 70 ? 'pass' : 'warn'}`} style={{ fontSize: 8, padding: '1px 6px' }}>
                  {concept[f.key] >= 70 ? 'PASS' : 'WARN'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Risks */}
        <div className="adt-glass p-5">
          <div className="adt-metric-label mb-3">RISQUES RÉSIDUELS</div>
          <div className="space-y-3">
            {RESIDUAL_RISKS.map((r, i) => {
              const meta = SEVERITY_META[r.severity]!;
              return (
                <div key={i} className="rounded-xl p-4" style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(100,116,139,0.15)', borderLeft: `4px solid ${meta.color}` }}>
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="text-sm font-bold text-white">{r.title}</div>
                    <span className="adt-gate-badge" style={{ background: `${meta.color}15`, color: meta.color, border: `1px solid ${meta.color}35`, flexShrink: 0 }}>
                      {meta.label}
                    </span>
                  </div>
                  <div className="text-xs mb-1" style={{ color: '#475569' }}>{r.category}</div>
                  <div className="text-xs mb-2" style={{ color: '#94a3b8', lineHeight: 1.5 }}>{r.detail}</div>
                  <div className="text-xs rounded-lg p-2" style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)', color: '#10b981' }}>
                    <strong>Mitigation :</strong> {r.mitigation}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Feedback loop summary */}
      {state.feedbackLoopTriggered && (
        <div className="adt-glass p-5" style={{ borderColor: 'rgba(16,185,129,0.3)', background: 'rgba(16,185,129,0.04)' }}>
          <div className="adt-metric-label mb-2" style={{ color: '#10b981' }}>BOUCLE FEEDBACK — RÉSUMÉ</div>
          <div className="text-sm text-white">
            Boucle feedback complétée — 1 itération de redesign. Concept A-v2 sélectionné.
          </div>
          <div className="text-xs mt-1" style={{ color: '#64748b' }}>
            Paroi {fb.wall_before_mm}mm → {fb.wall_after_mm}mm · DFM {fb.dfm_before} → {fb.dfm_after} · DFS inchangé
          </div>
        </div>
      )}

      {/* Gate decision banner */}
      <div className="adt-glass p-6 text-center" style={{
        borderColor: decision === 'approved' ? 'rgba(16,185,129,0.5)' : 'rgba(245,158,11,0.5)',
        background: decision === 'approved' ? 'rgba(16,185,129,0.06)' : 'rgba(245,158,11,0.06)',
      }}>
        <div className="font-bold text-white text-lg mb-2">
          {decision === 'approved' ? 'Gate Approved' : 'Gate Conditionnel'}
        </div>
        <div className="text-sm mb-4" style={{ color: '#64748b' }}>
          {decision === 'approved'
            ? 'Toutes les normes sont satisfaites et aucun risque critique non mitigé. Le concept est prêt pour la phase de développement détaillé.'
            : 'Des risques élevés ont été identifiés. Une revue de qualité supplémentaire est requise avant de poursuivre.'
          }
        </div>
        {dfsPass && (
          <div className="text-xs" style={{ color: '#10b981' }}>Répond au seuil de conception circulaire (DFS ≥ 70).</div>
        )}
      </div>

      {/* Digital Thread */}
      <div className="adt-glass p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="adt-metric-label">DIGITAL THREAD (ADT) — {digitalThread.length} entrees</div>
          <span className="adt-gate-badge" style={{ background: 'rgba(99,102,241,0.12)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.25)', fontSize: 10 }}>
            HITL Enabled · Audit Trail [OK]
          </span>
        </div>
        <div className="adt-timeline">
          {digitalThread.map((e, i) => (
            <div key={i} className="adt-timeline-item">
              <div className="adt-timeline-dot" style={{ borderColor: '#6366f1', background: i === 0 ? '#6366f1' : '#0f172a' }} />
              <div className="flex flex-wrap items-baseline gap-3">
                <div className="text-xs text-white font-medium">{e.event}</div>
                <div className="font-mono text-xs" style={{ color: '#475569' }}>{e.ts}</div>
              </div>
              <div className="text-xs mt-0.5" style={{ color: '#475569' }}>{e.detail}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Export footer */}
      <div className="adt-glass p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs" style={{ color: '#475569' }}>
          Scenario: {scenario?.shortName ?? state.scenarioId} · Concept: {concept.id} · {new Date().toLocaleDateString()}
        </div>
        <div className="flex gap-2">
          <button className="adt-btn-secondary" onClick={exportTxt}>
            {exportDone ? '[OK] Exporte' : 'Export TXT'}
          </button>
        </div>
      </div>
    </div>
  );
}
