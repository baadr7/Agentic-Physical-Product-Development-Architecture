'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import AdtHeader from '~/adt/_components/AdtHeader';
import { useAdtState } from '~/lib/adt/appState';
import { DN100_CONCEPTS, HITL_LEVELS, computeCompositeScore } from '~/lib/adt/config';

const DFX_FIELDS = [
  { key: 'dfm' as const, label: 'DFM', color: '#6366f1' },
  { key: 'dfa' as const, label: 'DFA', color: '#06b6d4' },
  { key: 'dfr' as const, label: 'DFR', color: '#10b981' },
  { key: 'dfc' as const, label: 'DFC', color: '#f59e0b' },
  { key: 'dfs' as const, label: 'DFS', color: '#10b981' },
];

function ScoreRing({ value, color, label }: { value: number; color: string; label: string }) {
  const size = 64, r = 26, circ = 2 * Math.PI * r;
  const pct = Math.min(value / 100, 1);
  const dash = pct * circ;
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(100,116,139,0.2)" strokeWidth={6} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={6}
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" style={{ transition: 'stroke-dasharray .6s ease' }} />
        <text x={size / 2} y={size / 2 + 5} textAnchor="middle" fontSize={11} fontWeight={700} fill={color}
          style={{ transform: 'rotate(90deg)', transformOrigin: `${size / 2}px ${size / 2}px` }}>
          {value}
        </text>
      </svg>
      <div className="adt-metric-label" style={{ color, fontSize: 9 }}>{label}</div>
    </div>
  );
}

// ── HITL level-specific messages (Spec §5.6) ──────────────
const HITL_CONFIGS: Record<number, {
  title: string; message: string;
  buttons: { label: string; action: 'approve' | 'select' | 'override' | 'reject' | 'confirm' | 'details' }[];
  autoValidate: boolean;
}> = {
  1: {
    title: 'Pleine autorité',
    message: 'Chaque concept requiert votre approbation explicite avant de procéder.',
    buttons: [
      { label: 'Approuver Concept A', action: 'approve' },
      { label: 'Approuver Concept B', action: 'approve' },
      { label: 'Approuver Concept C', action: 'approve' },
      { label: 'Approuver Concept D', action: 'approve' },
    ],
    autoValidate: false,
  },
  2: {
    title: 'Directeur créatif',
    message: 'Revoyez les concepts classés par l\'IA. Vous pouvez modifier les contraintes avant de sélectionner.',
    buttons: [
      { label: 'Sélectionner & procéder', action: 'select' },
      { label: 'Modifier contraintes', action: 'override' },
      { label: 'Rejeter tout', action: 'reject' },
    ],
    autoValidate: false,
  },
  3: {
    title: 'Décideur',
    message: 'L\'IA a classé les concepts. Sélectionnez parmi les options recommandées en vous appuyant sur les preuves DFx.',
    buttons: [
      { label: 'Sélectionner #1 (recommandé)', action: 'select' },
      { label: 'Sélectionner #2', action: 'select' },
      { label: 'Autre', action: 'override' },
      { label: 'Abstention', action: 'reject' },
    ],
    autoValidate: false,
  },
  4: {
    title: 'Approbateur',
    message: 'L\'Orchestrator a présélectionné le concept recommandé. Revoyez le résumé et approuvez ou annulez.',
    buttons: [
      { label: 'Approuver la sélection', action: 'approve' },
      { label: 'Annuler — choisir un autre concept', action: 'reject' },
    ],
    autoValidate: false,
  },
  5: {
    title: 'Observateur',
    message: 'L\'Orchestrator a sélectionné le concept de façon autonome. Vous êtes notifié.',
    buttons: [
      { label: 'Confirmer', action: 'confirm' },
      { label: 'Voir les détails (lecture seule)', action: 'details' },
    ],
    autoValidate: true,
  },
};

export default function AdtSelectPage() {
  const sp = useSearchParams();
  const router = useRouter();
  const { state, setSelectedConcept } = useAdtState();
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

  const orchLevel = state.agentLevels.orchestrator;
  const hitlConfig = HITL_CONFIGS[orchLevel] ?? HITL_CONFIGS[3]!;
  const hitlMeta = HITL_LEVELS[orchLevel]!;

  const [confirmed, setConfirmed] = useState(false);
  const [justification, setJustification] = useState('');

  // DFS sustainability question (Spec §5.6 — if DFS priority ≥ 4)
  const showDfsQuestion = state.dfxPriorities.dfs >= 4;
  const [dfsAnswer, setDfsAnswer] = useState<boolean | null>(null);

  // L5 auto-validate after 3s
  useEffect(() => {
    if (orchLevel === 5 && !confirmed) {
      const t = setTimeout(() => setConfirmed(true), 3000);
      return () => clearTimeout(t);
    }
  }, [orchLevel, confirmed]);

  function handleAction(action: string) {
    if (action === 'reject') { router.push('/adt/concepts'); return; }
    if (action === 'override') { router.push('/adt/config'); return; }
    if (action === 'details') { router.push(`/adt/detail?conceptId=${conceptId}`); return; }
    setConfirmed(true);
    setSelectedConcept(conceptId);
  }

  return (
    <div className="adt-root space-y-6">
      <AdtHeader />

      {/* Header with HITL role title */}
      <div className="adt-glass p-5" style={{ borderColor: `${hitlMeta.color}40` }}>
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex-1">
            <div className="adt-metric-label mb-1">Étape 6 / 7</div>
            <h2 className="text-lg font-bold text-white mb-1">
              Sélection HITL — <span style={{ color: hitlMeta.color }}>{hitlConfig.title}</span>
            </h2>
            <div className="text-sm" style={{ color: '#64748b' }}>
              Rôle : <span style={{ color: hitlMeta.color, fontWeight: 600 }}>{hitlMeta.name}</span> · Orchestrator L{orchLevel}
            </div>
          </div>
          <div className="flex gap-2">
            <button className="adt-btn-secondary" onClick={() => router.push('/adt/concepts')}>← Concepts</button>
            <button className="adt-btn-primary" disabled={!confirmed}
              onClick={() => router.push(`/adt/gate?conceptId=${conceptId}`)}>
              Gate Review →
            </button>
          </div>
        </div>
      </div>

      {/* HITL Banner */}
      <div className="adt-glass p-5" style={{ borderColor: `${hitlMeta.color}30`, background: `${hitlMeta.color}06` }}>
        <div className="flex items-start gap-3">
          <div style={{
            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
            background: `${hitlMeta.color}15`, border: `1.5px solid ${hitlMeta.color}40`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 800, color: hitlMeta.color,
          }}>L{orchLevel}</div>
          <div>
            <div className="text-sm font-bold text-white mb-1">{hitlConfig.message}</div>
            <div className="text-xs" style={{ color: '#475569' }}>
              {HITL_LEVELS[orchLevel]?.desc}
            </div>
          </div>
        </div>
      </div>

      {/* Concept summary + DFx rings */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="adt-glass p-5">
          <div className="adt-metric-label mb-3">CONCEPT SÉLECTIONNÉ</div>
          <div className="flex items-center gap-4 mb-4">
            <div>
              <div className="font-bold text-white text-lg">Concept {concept.id} — {concept.name}</div>
              <div className="text-xs mt-1" style={{ color: '#475569' }}>
                {concept.material} · {concept.process} · €{concept.cost_eur}
              </div>
            </div>
            <div className="text-right ml-auto">
              <div className="adt-score" style={{ fontSize: 32, color: '#f59e0b' }}>{composite.toFixed(1)}</div>
              <div className="adt-metric-label">/ 100</div>
            </div>
          </div>
          <div className="flex flex-wrap gap-3 justify-center">
            {DFX_FIELDS.map(f => (
              <ScoreRing key={f.key} value={concept[f.key]} color={f.color} label={f.label} />
            ))}
          </div>
        </div>

        {/* Action panel */}
        <div className="adt-glass p-5">
          <div className="adt-metric-label mb-3">ACTIONS DISPONIBLES</div>
          {!confirmed ? (
            <div className="space-y-2">
              {hitlConfig.buttons.map((btn, i) => (
                <button key={i} onClick={() => handleAction(btn.action)}
                  className={btn.action === 'reject' ? 'adt-btn-secondary w-full' : 'adt-btn-primary w-full'}
                  style={btn.action === 'approve' || btn.action === 'select' || btn.action === 'confirm'
                    ? {} : { background: 'rgba(100,116,139,0.15)', boxShadow: 'none', color: '#94a3b8', border: '1px solid rgba(100,116,139,0.3)' }
                  }>
                  {btn.label}
                </button>
              ))}
              {orchLevel === 5 && (
                <div className="text-xs text-center mt-2" style={{ color: '#f59e0b' }}>
                  Auto-validation dans 3 secondes…
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-6">
              <div className="text-sm font-bold mb-2" style={{ color: '#10b981' }}>Sélection confirmée</div>
              <div className="text-xs" style={{ color: '#475569' }}>
                Concept {concept.id} validé avec niveau HITL L{orchLevel}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* DFS sustainability question (if DFS priority ≥ 4) */}
      {showDfsQuestion && (
        <div className="adt-glass p-5" style={{ borderColor: 'rgba(16,185,129,0.3)', background: 'rgba(16,185,129,0.04)' }}>
          <div className="adt-metric-label mb-2" style={{ color: '#10b981' }}>QUESTION DURABILITÉ — DFS ≥ 4</div>
          <div className="text-sm text-white mb-3">
            La recyclabilité en fin de vie est-elle une exigence contractuelle pour cette famille de produits ?
          </div>
          <div className="flex gap-2">
            <button className={`adt-btn-${dfsAnswer === true ? 'primary' : 'secondary'}`}
              onClick={() => setDfsAnswer(true)}>Oui — Exigence contractuelle</button>
            <button className={`adt-btn-${dfsAnswer === false ? 'primary' : 'secondary'}`}
              onClick={() => setDfsAnswer(false)}>Non — Objectif interne uniquement</button>
          </div>
          {dfsAnswer !== null && (
            <div className="mt-2 text-xs" style={{ color: '#475569' }}>
              Réponse enregistrée dans le Digital Thread.
            </div>
          )}
        </div>
      )}

      {/* Justification */}
      <div className="adt-glass p-5">
        <div className="adt-metric-label mb-3">JUSTIFICATION D&apos;INGÉNIEUR</div>
        <textarea className="adt-input" style={{ minHeight: 80, resize: 'vertical', lineHeight: 1.6 }}
          placeholder="Motivez le choix de ce concept (critères techniques, compromis DFx, conformité normes…)"
          value={justification} onChange={e => setJustification(e.target.value)} />
        <div className="flex items-center justify-between mt-2">
          <div className="text-xs" style={{ color: '#475569' }}>{justification.trim().length} / 20 car. min.</div>
          {!confirmed && (
            <button className="adt-btn-primary" disabled={justification.trim().length < 20}
              onClick={() => { setConfirmed(true); setSelectedConcept(conceptId); }}>
              Confirmer la sélection
            </button>
          )}
        </div>
      </div>

      {/* Confirmed banner */}
      {confirmed && (
        <div className="adt-glass p-5 text-center" style={{ borderColor: 'rgba(16,185,129,0.5)', background: 'rgba(16,185,129,0.06)' }}>
          <div className="font-bold mb-2" style={{ color: '#10b981' }}>Sélection confirmée</div>
          <div className="text-sm mb-4" style={{ color: '#64748b' }}>
            Concept {concept.id} validé avec niveau HITL <strong style={{ color: '#10b981' }}>L{orchLevel}</strong>.
            Poursuivez vers la Gate Review.
          </div>
          <button className="adt-btn-primary" onClick={() => router.push(`/adt/gate?conceptId=${conceptId}`)}>
            Gate Review →
          </button>
        </div>
      )}
    </div>
  );
}
