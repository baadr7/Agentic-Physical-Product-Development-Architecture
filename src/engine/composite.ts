// Composite score + concept ranking (docs/05-dfx-scoring.md).
// DFC is ALREADY inverted in the scores — never re-invert in the composite.

import type { Concept, DFxScores, RankedConcept } from '@/types';

const KEYS: (keyof DFxScores)[] = ['dfm', 'dfa', 'dfr', 'dfc', 'dfs'];

/** weight_i = priority_i / sum(priorities); composite = Σ score_i × weight_i */
export function compositeScore(scores: DFxScores, priorities: DFxScores): number {
  const sum = KEYS.reduce((acc, k) => acc + priorities[k], 0);
  if (sum === 0) return 0;
  return KEYS.reduce((acc, k) => acc + scores[k] * (priorities[k] / sum), 0);
}

/** Rank concepts by composite score (desc). Stable on ties by id. */
export function rankConcepts(concepts: Concept[], priorities: DFxScores): RankedConcept[] {
  return concepts
    .map((c) => ({ ...c, composite: compositeScore(c.scores, priorities), rank: 0 }))
    .sort((a, b) => b.composite - a.composite || a.id.localeCompare(b.id))
    .map((c, i) => ({ ...c, rank: i + 1 }));
}
