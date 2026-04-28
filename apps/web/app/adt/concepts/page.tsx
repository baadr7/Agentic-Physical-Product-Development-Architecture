'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  RadarChart, PolarGrid, PolarAngleAxis,
  Radar, ResponsiveContainer, Tooltip, Legend,
} from 'recharts';

import AdtHeader from '~/adt/_components/AdtHeader';
import { useAdtState } from '~/lib/adt/appState';
import { DN100_CONCEPTS, rankConcepts, type DN100Concept, type DfxPriorities } from '~/lib/adt/config';

const DFX_FIELDS = [
  { key: 'dfm' as const, label: 'DFM', color: '#6366f1' },
  { key: 'dfa' as const, label: 'DFA', color: '#06b6d4' },
  { key: 'dfr' as const, label: 'DFR', color: '#10b981' },
  { key: 'dfc' as const, label: 'DFC', color: '#f59e0b' },
  { key: 'dfs' as const, label: 'DFS', color: '#10b981' }, // emerald per spec
];

const CONCEPT_COLORS: Record<string, string> = {
  A: '#6366f1', B: '#06b6d4', C: '#f59e0b', D: '#8b5cf6',
};

// ── Parametric SVG for each concept ───────────────────────
function ConceptSVG({ concept, size = 120 }: { concept: DN100Concept; size?: number }) {
  const c = size / 2;
  const r = size * 0.38;
  const color = CONCEPT_COLORS[concept.id] ?? '#6366f1';

  if (concept.svgPath === 'monolithic') {
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <rect x={c - r} y={c - r * 0.6} width={r * 2} height={r * 1.2} rx={4} fill={`${color}15`} stroke={color} strokeWidth={1.5} />
        <circle cx={c} cy={c} r={r * 0.35} fill="none" stroke={color} strokeWidth={1} strokeDasharray="3 2" />
        <line x1={c - r * 0.8} y1={c} x2={c - r * 0.4} y2={c} stroke={color} strokeWidth={1} />
        <line x1={c + r * 0.4} y1={c} x2={c + r * 0.8} y2={c} stroke={color} strokeWidth={1} />
        <text x={c} y={size - 6} textAnchor="middle" fill="#475569" fontSize={8} fontWeight={600}>DN100</text>
      </svg>
    );
  }
  if (concept.svgPath === 'bolted') {
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <rect x={c - r} y={c - r * 0.5} width={r} height={r} rx={3} fill={`${color}12`} stroke={color} strokeWidth={1.5} />
        <rect x={c} y={c - r * 0.5} width={r} height={r} rx={3} fill={`${color}08`} stroke={color} strokeWidth={1} strokeDasharray="4 2" />
        {[-1, 1].map(dy => (
          <circle key={dy} cx={c} cy={c + dy * r * 0.25} r={3} fill={color} opacity={0.6} />
        ))}
        <text x={c} y={size - 6} textAnchor="middle" fill="#475569" fontSize={8} fontWeight={600}>4×M12</text>
      </svg>
    );
  }
  if (concept.svgPath === 'machined') {
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <rect x={c - r} y={c - r * 0.6} width={r * 2} height={r * 1.2} rx={2} fill={`${color}10`} stroke={color} strokeWidth={1.5} />
        {[0.2, 0.4, 0.6, 0.8].map(f => (
          <line key={f} x1={c - r + r * 2 * f} y1={c - r * 0.6} x2={c - r + r * 2 * f} y2={c + r * 0.6}
            stroke={color} strokeWidth={0.5} opacity={0.3} />
        ))}
        <circle cx={c} cy={c} r={r * 0.3} fill="none" stroke={color} strokeWidth={1.5} />
        <text x={c} y={size - 6} textAnchor="middle" fill="#475569" fontSize={8} fontWeight={600}>CNC</text>
      </svg>
    );
  }
  // hybrid
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <rect x={c - r} y={c - r * 0.6} width={r * 1.3} height={r * 1.2} rx={3} fill={`${color}12`} stroke={color} strokeWidth={1.5} />
      <rect x={c + r * 0.3 - 2} y={c - r * 0.35} width={r * 0.7 + 2} height={r * 0.7} rx={2} fill="rgba(245,158,11,0.12)" stroke="#f59e0b" strokeWidth={1} />
      <text x={c + r * 0.65} y={c + 3} textAnchor="middle" fill="#f59e0b" fontSize={7} fontWeight={700}>SS</text>
      <text x={c} y={size - 6} textAnchor="middle" fill="#475569" fontSize={8} fontWeight={600}>Hybride</text>
    </svg>
  );
}

// ── Score bar with animation ──────────────────────────────
function ScoreGauge({ value, color, label }: { value: number; color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="adt-metric-label w-8" style={{ color }}>{label}</div>
      <div className="flex-1 adt-dfx-track" style={{ height: 6 }}>
        <div className="adt-dfx-fill" style={{
          width: `${Math.min(value, 100)}%`, background: color, borderRadius: 3,
          animation: 'adt-bar-fill 0.6s ease-out',
        }} />
      </div>
      <div className="text-xs font-mono w-8 text-right" style={{ color }}>{value}</div>
    </div>
  );
}

// ── Concept Card ──────────────────────────────────────────
function ConceptCard({
  concept, rank, isRecommended, selected, onSelect, scenarioName,
}: {
  concept: DN100Concept & { composite: number; rank: number };
  rank: number;
  isRecommended: boolean;
  selected: boolean;
  onSelect: () => void;
  scenarioName: string;
}) {
  const color = CONCEPT_COLORS[concept.id] ?? '#6366f1';

  return (
    <button type="button" onClick={onSelect}
      className={`adt-glass adt-glass-hover text-left w-full ${selected ? 'adt-scenario-card selected' : ''}`}
      style={{ padding: '18px 20px', position: 'relative', overflow: 'visible' }}>

      {/* Recommended ribbon */}
      {isRecommended && (
        <div style={{
          position: 'absolute', top: -1, left: -1, right: -1,
          height: 3, borderRadius: '16px 16px 0 0',
          background: 'linear-gradient(90deg, #6366f1, #06b6d4)',
        }} />
      )}

      {/* Rank + recommended badge */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <div style={{
            width: 28, height: 28, borderRadius: '50%',
            background: isRecommended ? 'rgba(99,102,241,0.2)' : 'rgba(100,116,139,0.15)',
            border: `1.5px solid ${isRecommended ? '#6366f1' : 'rgba(100,116,139,0.3)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 800, color: isRecommended ? '#818cf8' : '#64748b',
          }}>#{rank}</div>
          {isRecommended && (
            <span className="adt-gate-badge" style={{
              background: 'rgba(99,102,241,0.12)', color: '#818cf8',
              border: '1px solid rgba(99,102,241,0.3)', fontSize: 9,
            }}>Recommandé</span>
          )}
        </div>
        {/* Composite score */}
        <div className="text-right">
          <div className="adt-score" style={{ fontSize: 20, color: isRecommended ? '#818cf8' : '#94a3b8' }}>
            {concept.composite.toFixed(1)}
          </div>
          <div className="adt-metric-label" style={{ fontSize: 8 }}>/ 100</div>
        </div>
      </div>

      {/* SVG render */}
      <div className="flex justify-center mb-3">
        <ConceptSVG concept={concept} size={120} />
      </div>

      {/* Name + material/process chips */}
      <div className="font-bold text-white text-sm mb-1">Concept {concept.id} — {concept.name}</div>
      <div className="flex flex-wrap gap-1 mb-3">
        <span className="adt-gate-badge" style={{ background: `${color}12`, color, border: `1px solid ${color}30`, fontSize: 9 }}>
          {concept.material}
        </span>
        <span className="adt-gate-badge" style={{ background: 'rgba(100,116,139,0.1)', color: '#94a3b8', border: '1px solid rgba(100,116,139,0.2)', fontSize: 9 }}>
          {concept.process}
        </span>
        <span className="adt-gate-badge" style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.2)', fontSize: 9 }}>
          €{concept.cost_eur}
        </span>
      </div>

      {/* DFx gauges */}
      <div className="space-y-1.5 mb-3">
        {DFX_FIELDS.map(f => (
          <ScoreGauge key={f.key} value={concept[f.key]} color={f.color} label={f.label} />
        ))}
      </div>

      {/* Weakness tag */}
      <div className="text-xs rounded-lg px-2 py-1.5" style={{
        background: 'rgba(244,63,94,0.06)', border: '1px solid rgba(244,63,94,0.15)',
        color: '#fb7185', lineHeight: 1.4,
      }}>
        Faiblesse : {concept.weakness}
      </div>

      {selected && <span className="adt-status-pill running mt-3" style={{ fontSize: 9, display: 'inline-flex' }}>Sélectionné</span>}
    </button>
  );
}

export default function AdtConceptsPage() {
  const router = useRouter();
  const { state, setSelectedConcept } = useAdtState();
  const [selectedId, setSelectedId] = useState(state.selectedConceptId || 'A');

  // Rank concepts based on current DFx priorities
  const ranked = useMemo(() => {
    let conceptsToRank = [...DN100_CONCEPTS];
    if (state.feedbackLoopTriggered) {
      conceptsToRank = conceptsToRank.map(c => 
        c.id === 'A' ? { 
          ...c, 
          id: 'A-v2',
          name: 'Monolithique (Redesign)', 
          dfm: 78, // DFM dropped from 82 to 78 due to wall thickness
          weakness: 'Paroi épaissie à 8mm',
        } : c
      );
    }
    return rankConcepts(conceptsToRank, state.dfxPriorities);
  }, [state.dfxPriorities, state.feedbackLoopTriggered]);

  // Radar data for comparison
  const radarData = useMemo(() => {
    return DFX_FIELDS.map(f => {
      const entry: Record<string, string | number> = { subject: f.label };
      ranked.forEach(c => { entry[`Concept ${c.id}`] = c[f.key]; });
      return entry;
    });
  }, [ranked]);

  const scenario = state.scenarioId;

  function handleSelect(id: string) {
    setSelectedId(id);
    setSelectedConcept(id);
  }

  return (
    <div className="adt-root space-y-6">
      <AdtHeader />

      {/* Header */}
      <div className="adt-glass p-5" style={{ borderColor: 'rgba(245,158,11,0.2)' }}>
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex-1">
            <div className="adt-metric-label mb-1">Étape 4 / 7</div>
            <h2 className="text-lg font-bold text-white mb-1">Concepts générés — Vanne DN100</h2>
            <div className="text-sm" style={{ color: '#64748b' }}>
              4 concepts · Scores DFx déterministes · Classement selon <span style={{ color: '#818cf8', fontWeight: 600 }}>{scenario}</span>
            </div>
          </div>
          <div className="flex gap-2 items-center">
            <span className="adt-status-pill pass">{ranked.length} concepts</span>
            <span className="adt-gate-badge" style={{ background: 'rgba(99,102,241,0.1)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.25)' }}>
              Classé selon : {scenario}
            </span>
          </div>
        </div>
      </div>

      {/* Concept grid 2×2 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 adt-stagger">
        {ranked.map((c, i) => (
          <ConceptCard
            key={c.id}
            concept={c}
            rank={i + 1}
            isRecommended={i === 0}
            selected={selectedId === c.id}
            onSelect={() => handleSelect(c.id)}
            scenarioName={scenario}
          />
        ))}
      </div>

      {/* Comparative radar chart */}
      <div className="adt-glass p-5">
        <div className="adt-metric-label mb-3">Radar DFx comparatif — Tous concepts</div>
        <div style={{ height: 320 }}>
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={radarData} outerRadius={110}>
              <PolarGrid stroke="rgba(100,116,139,0.2)" strokeDasharray="3 3" />
              <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 600 }} />
              {ranked.map(c => (
                <Radar key={c.id} name={`Concept ${c.id}`} dataKey={`Concept ${c.id}`}
                  stroke={CONCEPT_COLORS[c.id]} fill={CONCEPT_COLORS[c.id]} fillOpacity={c.id === selectedId ? 0.2 : 0.05}
                  strokeWidth={c.id === selectedId ? 2.5 : 1} strokeDasharray={c.id === selectedId ? undefined : '4 3'}
                  dot={c.id === selectedId ? { fill: CONCEPT_COLORS[c.id], r: 3, strokeWidth: 0 } : false}
                  isAnimationActive animationDuration={800} />
              ))}
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: '#818cf8', fontWeight: 600 }} />
              <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Footer CTA */}
      <div className="adt-glass p-4 flex items-center justify-between gap-3">
        <div className="text-sm" style={{ color: '#64748b' }}>
          Concept sélectionné : <span className="font-bold" style={{ color: '#818cf8' }}>
            {selectedId} — {ranked.find(c => c.id === selectedId)?.name}
          </span>
          {' '}· Score : <span className="font-mono" style={{ color: '#f59e0b' }}>
            {ranked.find(c => c.id === selectedId)?.composite.toFixed(1)}
          </span>
        </div>
        <div className="flex gap-2">
          <button className="adt-btn-secondary"
            onClick={() => router.push(`/adt/detail?conceptId=${selectedId}`)}>
            Voir le détail →
          </button>
          <button className="adt-btn-primary"
            onClick={() => router.push(`/adt/select?conceptId=${selectedId}`)}>
            Procéder à la sélection →
          </button>
        </div>
      </div>
    </div>
  );
}
