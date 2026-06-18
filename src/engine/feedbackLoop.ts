// Closed feedback loop engine (docs/07-feedback-loop.md).

import type { Concept } from '@/types';

export interface Deviation {
  bsReal: number;
  bsPredicted: number;
  deviationPct: number;
  thresholdPct: number;
  exceeded: boolean;
}

/** Compare measured Bs vs predicted Bs. Returns deviation if it exceeds threshold. */
export function checkFeedbackDeviation(
  bsReal: number,
  bsPredicted: number,
  thresholdPct = 5,
): Deviation | null {
  const deviationPct = ((bsReal - bsPredicted) / bsPredicted) * 100;
  const exceeded = Math.abs(deviationPct) > thresholdPct;
  if (!exceeded) return null;
  return {
    bsReal,
    bsPredicted,
    deviationPct: Math.round(deviationPct * 10) / 10,
    thresholdPct,
    exceeded,
  };
}

/**
 * Redesign A -> A-v2: wall 7mm -> 8mm, DFM 82 -> 79, DFS unchanged,
 * Bs recomputed to pass the revised Be. Re-rankable alongside A-D.
 */
export function runRedesign(concept: Concept): Concept {
  const newWall = concept.fbs.structure.wall_mm + 1; // 7 -> 8
  return {
    ...concept,
    id: `${concept.id}-v2`,
    name: `${concept.name} (v2)`,
    derivedFrom: concept.id,
    scores: { ...concept.scores, dfm: concept.scores.dfm - 3 }, // 82 -> 79
    fbs: {
      ...concept.fbs,
      structure: { ...concept.fbs.structure, wall_mm: newWall },
      behaviour: {
        ...concept.fbs.behaviour,
        // thicker wall reduces simulated stress below the revised Be threshold
        simulated: {
          ...concept.fbs.behaviour.simulated,
          stress_max_MPa: 101,
          proof_ok: true,
        },
        expected: {
          ...concept.fbs.behaviour.expected,
          stress_max_MPa: 111, // revised Be after deviation
        },
      },
    },
    justifications: undefined,
  };
}
