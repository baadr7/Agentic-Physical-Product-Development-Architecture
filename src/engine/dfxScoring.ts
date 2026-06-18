// Deterministic DFx scoring engine (docs/05-dfx-scoring.md).
//
// Two paths:
//  1. DATA path  — for the embedded DN100 dataset, the 5 scores per concept are
//     stored directly in scenarios.ts (authoritative; the formulas reproduce them
//     within ±2 from the concept parameter sets).
//  2. FORMULA path — for S6/custom briefs, these pure functions compute scores
//     from concept parameters + the product brief constraints.
//
// The LLM NEVER produces scores. Same brief in -> same scores out, always.

import type { ProductBrief, DFxKey } from '@/types';

export const clamp = (x: number): number => Math.max(0, Math.min(100, x));

// --- DFM — Manufacturability ---
export interface DFMParams {
  process: 'casting' | 'cnc' | 'hybrid';
  wall_mm: number;
  ra_um: number;
  n_features: number;
}
export function scoreDFM(brief: ProductBrief, p: DFMParams): number {
  const processBase = { casting: 90, hybrid: 85, cnc: 70 }[p.process];
  const raOk = p.ra_um >= brief.constraints.ra_um; // achievable roughness
  const wallOk = p.wall_mm >= brief.constraints.wall_min_mm;
  return clamp(processBase - p.n_features * 2 + (raOk ? 5 : 0) + (wallOk ? 0 : -10));
}

// --- DFA — Assembly ---
export interface DFAParams {
  n_parts: number;
  symmetry_deg: number;
  n_fasteners: number;
  auto_compatible: boolean;
}
export function scoreDFA(_brief: ProductBrief, p: DFAParams): number {
  const symmetryOk = p.symmetry_deg >= 180;
  return clamp(
    100 - p.n_parts * 3 - p.n_fasteners * 2 + (symmetryOk ? 10 : 0) + (p.auto_compatible ? 5 : 0),
  );
}

// --- DFR — Reliability ---
export interface DFRParams {
  mtbf_capable_cycles: number;
  safety_factor: number;
  standards_met: boolean;
}
export function scoreDFR(brief: ProductBrief, p: DFRParams): number {
  const mtbfScore = clamp((p.mtbf_capable_cycles / brief.constraints.mtbf_cycles) * 100) / 100; // 0-1
  const sfTerm = Math.min(p.safety_factor / 1.5, 1.25); // cap bonus
  return clamp(sfTerm * 40 + mtbfScore * 40 + (p.standards_met ? 20 : 0));
}

// --- DFC — Cost  ⚠️ MANDATORY INVERSION (already inverted here) ---
export interface DFCParams {
  cost_eur: number;
}
export function scoreDFC(brief: ProductBrief, p: DFCParams): number {
  return clamp(100 - (p.cost_eur / brief.constraints.cost_target_eur) * 100);
}

// --- DFS — Sustainability ---
export interface DFSParams {
  recyclability_pct: number;
  co2_kg: number;
  mono_material: boolean;
  circular_index: number; // 0-100
}
export function scoreDFS(_brief: ProductBrief, p: DFSParams): number {
  const co2Score = clamp(100 - (p.co2_kg / 20) * 100);
  return clamp(p.recyclability_pct * 0.4 + co2Score * 0.3 + p.circular_index * 0.3);
}

export interface ConceptParams {
  dfm: DFMParams;
  dfa: DFAParams;
  dfr: DFRParams;
  dfc: DFCParams;
  dfs: DFSParams;
}

/** FORMULA path: compute all five scores from concept parameters + brief. */
export function scoreConcept(brief: ProductBrief, params: ConceptParams): Record<DFxKey, number> {
  return {
    dfm: Math.round(scoreDFM(brief, params.dfm)),
    dfa: Math.round(scoreDFA(brief, params.dfa)),
    dfr: Math.round(scoreDFR(brief, params.dfr)),
    dfc: Math.round(scoreDFC(brief, params.dfc)),
    dfs: Math.round(scoreDFS(brief, params.dfs)),
  };
}
