import { describe, it, expect } from 'vitest';
import { scenarios, dn100Concepts } from '@/config/scenarios';
import { compositeScore, rankConcepts } from './composite';
import { scoreDFC, clamp } from './dfxScoring';
import { checkFeedbackDeviation, runRedesign } from './feedbackLoop';
import type { ProductBrief } from '@/types';

// Verified winners for THIS (reconciled, cost-correct) dataset.
// See docs/SPEC_RECONCILIATION.md for why these differ from the original spec table.
const VERIFIED: Record<string, string> = {
  S1: 'C', // aerospace: reliability-led -> Usiné CNC
  S2: 'A', // industrial DN100 (default): balanced -> Monolithique  [narrative-critical]
  S3: 'B', // sustainable: greenest -> Boulonné GGG40
  S4: 'A', // fast MVP: DFM weight makes the manufacturable A beat the slightly cheaper B
  S5: 'D', // high cadence: manufacturability -> Hybride
};

describe('DFx composite ranking — verified winners', () => {
  for (const id of ['S1', 'S2', 'S3', 'S4', 'S5'] as const) {
    it(`${id} winner is ${VERIFIED[id]}`, () => {
      const ranked = rankConcepts(dn100Concepts, scenarios[id].dfxPriorities);
      expect(ranked[0].id).toBe(VERIFIED[id]);
    });
  }

  it('S2 (default scenario) recommends Concept A — feedback-loop spine', () => {
    const ranked = rankConcepts(dn100Concepts, scenarios.S2.dfxPriorities);
    expect(ranked[0].id).toBe('A');
  });

  it('ranking is deterministic (identical inputs → identical order)', () => {
    const a = rankConcepts(dn100Concepts, scenarios.S2.dfxPriorities).map((c) => c.id);
    const b = rankConcepts(dn100Concepts, scenarios.S2.dfxPriorities).map((c) => c.id);
    expect(a).toEqual(b);
  });

  it('every scenario produces a full, unique 1..4 ranking', () => {
    for (const id of ['S1', 'S2', 'S3', 'S4', 'S5'] as const) {
      const ranks = rankConcepts(dn100Concepts, scenarios[id].dfxPriorities).map((c) => c.rank);
      expect(ranks.sort()).toEqual([1, 2, 3, 4]);
    }
  });
});

describe('DFC mandatory inversion', () => {
  const brief = { constraints: { cost_target_eur: 85 } } as ProductBrief;

  it('cost at target → 0', () => {
    expect(scoreDFC(brief, { cost_eur: 85 })).toBe(0);
  });
  it('half target → 50', () => {
    expect(scoreDFC(brief, { cost_eur: 42.5 })).toBe(50);
  });
  it('zero cost → 100', () => {
    expect(scoreDFC(brief, { cost_eur: 0 })).toBe(100);
  });
  it('above target clamps to 0 (never negative)', () => {
    expect(scoreDFC(brief, { cost_eur: 170 })).toBe(0);
  });

  it('the cheapest concept has the highest DFC (inversion holds in dataset)', () => {
    const cheapest = [...dn100Concepts].sort((a, b) => a.cost_eur - b.cost_eur)[0];
    const maxDfc = Math.max(...dn100Concepts.map((c) => c.scores.dfc));
    expect(cheapest.scores.dfc).toBe(maxDfc);
  });
});

describe('clamp', () => {
  it('clamps to [0,100]', () => {
    expect(clamp(-20)).toBe(0);
    expect(clamp(140)).toBe(100);
    expect(clamp(57)).toBe(57);
  });
});

describe('composite score', () => {
  it('is a normalized weighted sum', () => {
    const scores = { dfm: 80, dfa: 80, dfr: 80, dfc: 80, dfs: 80 };
    const prio = { dfm: 1, dfa: 1, dfr: 1, dfc: 1, dfs: 1 };
    expect(compositeScore(scores, prio)).toBeCloseTo(80, 5);
  });
  it('respects priority weighting', () => {
    const scores = { dfm: 100, dfa: 0, dfr: 0, dfc: 0, dfs: 0 };
    const prio = { dfm: 5, dfa: 1, dfr: 1, dfc: 1, dfs: 1 };
    expect(compositeScore(scores, prio)).toBeCloseTo((100 * 5) / 9, 5);
  });
});

describe('feedback loop', () => {
  it('detects +5.6% deviation above 5% threshold (DN100 case)', () => {
    const d = checkFeedbackDeviation(114, 108, 5);
    expect(d).not.toBeNull();
    expect(d!.deviationPct).toBeCloseTo(5.6, 1);
    expect(d!.exceeded).toBe(true);
  });
  it('ignores deviation under threshold', () => {
    expect(checkFeedbackDeviation(110, 108, 5)).toBeNull();
  });
  it('redesign A → A-v2: wall +1mm, DFM −3, re-rankable', () => {
    const a = dn100Concepts.find((c) => c.id === 'A')!;
    const v2 = runRedesign(a);
    expect(v2.id).toBe('A-v2');
    expect(v2.fbs.structure.wall_mm).toBe(a.fbs.structure.wall_mm + 1);
    expect(v2.scores.dfm).toBe(a.scores.dfm - 3);
    expect(v2.scores.dfs).toBe(a.scores.dfs); // DFS unchanged
    const ranked = rankConcepts([...dn100Concepts, v2], scenarios.S2.dfxPriorities);
    expect(ranked.find((c) => c.id === 'A-v2')).toBeTruthy();
  });
});
