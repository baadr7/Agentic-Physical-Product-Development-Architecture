'use client';

import { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  RadarChart, PolarGrid, PolarAngleAxis,
  Radar, ResponsiveContainer, Tooltip,
} from 'recharts';

import AdtHeader from '~/adt/_components/AdtHeader';
import { useAdtState } from '~/lib/adt/appState';
import {
  DN100_CONCEPTS, DN100_FBS, FEEDBACK_LOOP_DATA,
  computeCompositeScore, type DN100Concept,
} from '~/lib/adt/config';

const DFX_FIELDS = [
  { key: 'dfm' as const, label: 'DFM', full: 'Fabricability', color: '#6366f1' },
  { key: 'dfa' as const, label: 'DFA', full: 'Assemblability', color: '#06b6d4' },
  { key: 'dfr' as const, label: 'DFR', full: 'Reliability', color: '#10b981' },
  { key: 'dfc' as const, label: 'DFC', full: 'Cost', color: '#f59e0b' },
  { key: 'dfs' as const, label: 'DFS', full: 'Sustainability', color: '#10b981' },
];

function PassFail({ pass }: { pass: boolean | null }) {
  if (pass === null) return <span className="adt-status-pill pending" style={{ fontSize: 9 }}>—</span>;
  return pass
    ? <span className="adt-status-pill pass" style={{ fontSize: 9 }}>PASS</span>
    : <span className="adt-status-pill fail" style={{ fontSize: 9 }}>FAIL</span>;
}

export default function AdtDetailPage() {
  const sp = useSearchParams();
  const router = useRouter();
  const { state, setFeedbackLoop } = useAdtState();
  const conceptId = sp?.get('conceptId') || state.selectedConceptId || 'A';
  
  const baseConcept = DN100_CONCEPTS.find(c => c.id === (conceptId === 'A-v2' ? 'A' : conceptId)) ?? DN100_CONCEPTS[0]!;
  const concept = conceptId === 'A-v2' ? {
    ...baseConcept,
    id: 'A-v2',
    name: 'Monolithique (Redesign)',
    dfm: 78,
    weakness: 'Paroi épaissie à 8mm'
  } : baseConcept;

  const bs = DN100_FBS.behaviourSimulated[concept.id as keyof typeof DN100_FBS.behaviourSimulated] || DN100_FBS.behaviourSimulated['A'];
  const be = DN100_FBS.behaviourExpected;
  const composite = computeCompositeScore(concept, state.dfxPriorities);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const fb = FEEDBACK_LOOP_DATA;

  // Bs vs Be radar data
  const bsBeData = useMemo(() => [
    { axis: 'Contrainte (MPa)', Be: be.stress_max_mpa, Bs: bs?.stress_mpa ?? 0 },
    { axis: 'Déflexion (mm)', Be: be.deflection_max_mm * 1000, Bs: (bs?.deflection_mm ?? 0) * 1000 },
    { axis: 'Épreuve (bar)', Be: 24, Bs: bs?.proof_ok ? 24 : 16 },
  ], [be, bs]);

  // PASS/FAIL evaluation
  const stressPass = bs ? bs.stress_mpa <= be.stress_max_mpa : null;
  const deflPass = bs ? bs.deflection_mm <= be.deflection_max_mm : null;
  const proofPass = bs?.proof_ok ?? null;
  const allPass = stressPass && deflPass && proofPass;

  return (
    <div className="adt-root space-y-6">
      <AdtHeader />

      {/* Header */}
      <div className="adt-glass p-5" style={{ borderColor: 'rgba(16,185,129,0.2)' }}>
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex-1">
            <div className="adt-metric-label mb-1">Étape 5 / 7</div>
            <h2 className="text-lg font-bold text-white mb-1">
              Concept {concept.id} — {concept.name}
              {state.feedbackLoopTriggered && concept.id === 'A' && (
                <span className="adt-status-pill fail ml-2" style={{ fontSize: 9 }}>[Redesign] Declenche</span>
              )}
            </h2>
            <div className="text-sm" style={{ color: '#64748b' }}>
              FBS · DFx Readiness · Bs vs Be · Boucle feedback
            </div>
          </div>
          <div className="flex gap-2">
            <button className="adt-btn-secondary" onClick={() => router.push('/adt/concepts')}>← Concepts</button>
            <button className="adt-btn-primary" onClick={() => router.push(`/adt/select?conceptId=${conceptId}`)}>Sélectionner →</button>
          </div>
        </div>
      </div>

      {/* ═══ FBS 3-Column Panel (Spec §9) ═══ */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* F — Function (blue) */}
        <div className="adt-glass p-5" style={{ borderColor: 'rgba(99,102,241,0.3)' }}>
          <div className="flex items-center gap-2 mb-3">
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#6366f1', boxShadow: '0 0 6px #6366f1' }} />
            <span className="text-sm font-bold" style={{ color: '#818cf8' }}>F — Function</span>
          </div>
          <div className="space-y-2">
            {DN100_FBS.functions.map((f, i) => (
              <div key={i} className="flex items-start gap-2 px-3 py-2 rounded-lg"
                style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.12)' }}>
                <span style={{ color: '#6366f1', fontWeight: 700, fontSize: 10, marginTop: 2 }}>F{i + 1}</span>
                <span className="text-xs" style={{ color: '#94a3b8', lineHeight: 1.5 }}>{f}</span>
              </div>
            ))}
          </div>
        </div>

        {/* B — Behaviour (green) */}
        <div className="adt-glass p-5" style={{ borderColor: 'rgba(16,185,129,0.3)' }}>
          <div className="flex items-center gap-2 mb-3">
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 6px #10b981' }} />
            <span className="text-sm font-bold" style={{ color: '#10b981' }}>B — Behaviour</span>
            <PassFail pass={allPass ?? null} />
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b" style={{ borderColor: 'rgba(100,116,139,0.15)' }}>
                {['Métrique', 'Be', 'Bs', ''].map(h => (
                  <th key={h} className="pb-2 pr-2 text-left adt-metric-label" style={{ fontSize: 9 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="py-2 pr-2 text-xs" style={{ color: '#94a3b8' }}>Contrainte max</td>
                <td className="py-2 pr-2 text-xs font-mono" style={{ color: '#f43f5e' }}>≤ {be.stress_max_mpa} MPa</td>
                <td className="py-2 pr-2 text-xs font-mono" style={{ color: '#06b6d4' }}>{bs?.stress_mpa} MPa</td>
                <td className="py-2"><PassFail pass={stressPass} /></td>
              </tr>
              <tr>
                <td className="py-2 pr-2 text-xs" style={{ color: '#94a3b8' }}>Déflexion max</td>
                <td className="py-2 pr-2 text-xs font-mono" style={{ color: '#f43f5e' }}>≤ {be.deflection_max_mm} mm</td>
                <td className="py-2 pr-2 text-xs font-mono" style={{ color: '#06b6d4' }}>{bs?.deflection_mm} mm</td>
                <td className="py-2"><PassFail pass={deflPass} /></td>
              </tr>
              <tr>
                <td className="py-2 pr-2 text-xs" style={{ color: '#94a3b8' }}>Épreuve {be.proof_bar} bar</td>
                <td className="py-2 pr-2 text-xs font-mono" style={{ color: '#f43f5e' }}>No deformation</td>
                <td className="py-2 pr-2 text-xs font-mono" style={{ color: '#06b6d4' }}>{bs?.proof_ok ? 'OK' : 'FAIL'}</td>
                <td className="py-2"><PassFail pass={proofPass} /></td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* S — Structure (violet) */}
        <div className="adt-glass p-5" style={{ borderColor: 'rgba(139,92,246,0.3)' }}>
          <div className="flex items-center gap-2 mb-3">
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#a78bfa', boxShadow: '0 0 6px #a78bfa' }} />
            <span className="text-sm font-bold" style={{ color: '#a78bfa' }}>S — Structure</span>
          </div>
          <div className="space-y-2">
            {[
              { label: 'Matériau', value: concept.material },
              { label: 'Procédé', value: concept.process },
              { label: 'Épaisseur paroi', value: `${state.feedbackLoopTriggered && concept.id === 'A' ? 8 : 7} mm` },
              { label: 'Bride', value: '4×M12' },
              { label: 'Alésage', value: '100 mm' },
              { label: 'Longueur', value: '130 mm' },
            ].map(item => (
              <div key={item.label} className="flex justify-between px-3 py-2 rounded-lg"
                style={{ background: 'rgba(139,92,246,0.05)', border: '1px solid rgba(139,92,246,0.1)' }}>
                <span className="adt-metric-label" style={{ color: '#7c3aed', fontSize: 9 }}>{item.label}</span>
                <span className="text-xs font-mono" style={{ color: '#c4b5fd' }}>{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ═══ DFx Readiness Pack + Bs vs Be Radar ═══ */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* DFx Readiness */}
        <div className="adt-glass p-5">
          <div className="adt-metric-label mb-3">DFx READINESS PACK</div>
          <table className="w-full">
            <thead>
              <tr className="border-b" style={{ borderColor: 'rgba(100,116,139,0.15)' }}>
                {['Critère', 'Score', 'Statut', 'Justification'].map(h => (
                  <th key={h} className="pb-2 pr-2 text-left adt-metric-label" style={{ fontSize: 9 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DFX_FIELDS.map(f => {
                const score = concept[f.key];
                const pass = score >= 70;
                return (
                  <tr key={f.key}>
                    <td className="py-2 pr-2">
                      <span className="text-xs font-bold" style={{ color: f.color }}>{f.label}</span>
                    </td>
                    <td className="py-2 pr-2">
                      <div className="flex items-center gap-2">
                        <div className="adt-dfx-track" style={{ width: 60, height: 5 }}>
                          <div className="adt-dfx-fill" style={{ width: `${score}%`, background: f.color, borderRadius: 3 }} />
                        </div>
                        <span className="text-xs font-mono" style={{ color: f.color }}>{score}</span>
                      </div>
                    </td>
                    <td className="py-2 pr-2"><PassFail pass={pass} /></td>
                    <td className="py-2 text-xs" style={{ color: '#475569', maxWidth: 160 }}>
                      {score >= 80 ? 'Excellent' : score >= 70 ? 'Satisfaisant' : score >= 50 ? 'À surveiller' : 'Critique'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="mt-3 flex items-center gap-2">
            <div className="adt-metric-label">Composite</div>
            <div className="adt-score" style={{ fontSize: 24, color: '#f59e0b' }}>{composite.toFixed(1)}</div>
            <div className="adt-metric-label">/ 100</div>
          </div>
        </div>

        {/* Bs vs Be Radar */}
        <div className="adt-glass p-5">
          <div className="adt-metric-label mb-3">RADAR Bs vs Be</div>
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={bsBeData} outerRadius={90}>
                <PolarGrid stroke="rgba(100,116,139,0.2)" strokeDasharray="3 3" />
                <PolarAngleAxis dataKey="axis" tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 600 }} />
                <Radar name="Be (attendu)" dataKey="Be" stroke="#f43f5e" fill="#f43f5e" fillOpacity={0.08}
                  strokeWidth={2} strokeDasharray="6 3" dot={{ fill: '#f43f5e', r: 3 }} />
                <Radar name="Bs (simulé)" dataKey="Bs" stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.2}
                  strokeWidth={2.5} dot={{ fill: '#06b6d4', r: 4, strokeWidth: 0 }} isAnimationActive animationDuration={800} />
                <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 8, fontSize: 12 }} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-4 mt-2">
            <div className="flex items-center gap-1">
              <span style={{ width: 16, height: 2, background: '#f43f5e', display: 'inline-block', borderRadius: 1 }} />
              <span className="text-xs" style={{ color: '#f43f5e' }}>Be (attendu)</span>
            </div>
            <div className="flex items-center gap-1">
              <span style={{ width: 16, height: 2, background: '#06b6d4', display: 'inline-block', borderRadius: 1 }} />
              <span className="text-xs" style={{ color: '#06b6d4' }}>Bs (simulé)</span>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ Feedback Loop Panel (Spec §7) ═══ */}
      <div className="adt-glass p-5" style={{ borderColor: state.feedbackLoopTriggered ? 'rgba(245,158,11,0.4)' : 'rgba(100,116,139,0.15)' }}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: fb.triggered ? '#f59e0b' : '#475569' }} />
            <span className="adt-metric-label" style={{ color: fb.triggered ? '#f59e0b' : '#64748b' }}>BOUCLE FEEDBACK — DONNÉES TERRAIN</span>
          </div>
          <button className="adt-btn-secondary" style={{ fontSize: 11, padding: '6px 12px' }}
            onClick={() => setFeedbackOpen(!feedbackOpen)}>
            {feedbackOpen ? 'Masquer' : 'Détails'}
          </button>
        </div>

        {/* Summary strip */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-3">
          {[
            { label: 'Unités produites', value: String(fb.mes_units), icon: 'MES' },
            { label: 'Contrainte moy.', value: `${fb.mes_stress_avg_mpa} MPa`, icon: 'IoT' },
            { label: 'Défaillances', value: String(fb.mes_failures), icon: 'SAV' },
            { label: 'Déviation', value: `+${fb.deviation_pct}%`, icon: fb.triggered ? 'ALERT' : 'OK' },
          ].map(item => (
            <div key={item.label} className="rounded-lg p-3 text-center"
              style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(100,116,139,0.12)' }}>
              <div className="adt-metric-label mb-1" style={{ color: item.icon === 'ALERT' ? '#f59e0b' : '#475569', fontSize: 9 }}>{item.icon}</div>
              <div className="text-sm font-mono font-bold" style={{ color: item.icon === 'ALERT' ? '#f59e0b' : '#cbd5e1' }}>{item.value}</div>
              <div className="text-xs mt-0.5" style={{ color: '#475569' }}>{item.label}</div>
            </div>
          ))}
        </div>

        {/* Deviation badge */}
        {fb.triggered && (
          <div className="rounded-lg px-4 py-3 mb-3" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)' }}>
            <div className="text-xs font-bold mb-1" style={{ color: '#f59e0b' }}>
              +{fb.deviation_pct}% déviation contrainte détectée
            </div>
            <div className="text-xs" style={{ color: '#94a3b8' }}>
              Bs réel ({fb.bs_real_mpa} MPa) vs Bs prédit ({fb.bs_predicted_mpa} MPa) — seuil = {fb.threshold_pct}%
            </div>
          </div>
        )}

        {/* Trigger feedback loop */}
        {!state.feedbackLoopTriggered && (
          <button className="adt-btn-secondary w-full" onClick={() => setFeedbackLoop(true)}>
            Simuler la boucle feedback (MES → Redesign)
          </button>
        )}
        {state.feedbackLoopTriggered && (
          <div className="rounded-lg px-4 py-3" style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)' }}>
            <div className="text-xs font-bold" style={{ color: '#10b981' }}>
              Boucle feedback complétée — 1 itération de redesign
            </div>
            <div className="text-xs" style={{ color: '#64748b' }}>
              Concept A → A-v2 · Paroi {fb.wall_before_mm}mm → {fb.wall_after_mm}mm · DFM {fb.dfm_before} → {fb.dfm_after}
            </div>
          </div>
        )}

        {/* Expanded JSON payloads */}
        {feedbackOpen && (
          <div className="mt-3 space-y-2" style={{ animation: 'adt-slide-in .2s ease' }}>
            <div className="adt-metric-label" style={{ fontSize: 9 }}>CONNECTEUR MES — PAYLOAD ENTRANT</div>
            <pre className="text-xs rounded-lg p-3 overflow-x-auto" style={{ background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.12)', color: '#94a3b8' }}>
{JSON.stringify({
  connector_id: 'MES',
  query_type: 'production_data',
  filters: { product: 'DN100_valve', period: '2026-Q1' },
  response: { source: 'MES Siemens OpCenter', timestamp: '2026-04-15T08:30:00Z', data: { units: 47, avg_stress_mpa: 114, failures: 2, failure_mode: 'joint_seal' }, confidence: 0.92 }
}, null, 2)}
            </pre>
            <div className="flex items-center gap-2">
              <span className="adt-gate-badge" style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.2)', fontSize: 9 }}>Simulé</span>
              <span className="text-xs" style={{ color: '#475569' }}>Toutes les données MES sont simulées dans cette démonstration</span>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="adt-glass p-4 flex items-center justify-between gap-3">
        <div className="text-sm" style={{ color: '#64748b' }}>
          Concept {concept.id} · {concept.material} · Composite {composite.toFixed(1)}/100
        </div>
        <div className="flex gap-2">
          <button className="adt-btn-secondary" onClick={() => router.push('/adt/concepts')}>← Concepts</button>
          <button className="adt-btn-primary" onClick={() => router.push(`/adt/select?conceptId=${conceptId}`)}>Sélectionner →</button>
        </div>
      </div>
    </div>
  );
}
