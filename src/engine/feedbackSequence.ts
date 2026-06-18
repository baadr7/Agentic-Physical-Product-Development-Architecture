// Scripted 6-step DN100 closed feedback loop (docs/07). Triggered from E5.
// Each step appends an ADT entry. On completion, Concept A-v2 is generated,
// re-scored, and appears on E4 (fade-in).

import { useAppState } from '@/store/appState';
import { checkFeedbackDeviation, runRedesign } from './feedbackLoop';
import type { Lang } from '@/types';

export interface FeedbackStep {
  step: number;
  node: string;
  title: { fr: string; en: string };
  detail: { fr: string; en: string };
}

export const FEEDBACK_STEPS: FeedbackStep[] = [
  {
    step: 1,
    node: 'MES / IoT',
    title: { fr: 'Données terrain (capteurs)', en: 'Field data (sensors)' },
    detail: {
      fr: 'Unités : 47. Contrainte moyenne : 114 MPa. 2 défaillances de joints.',
      en: 'Units: 47. Mean stress: 114 MPa. 2 seal failures.',
    },
  },
  {
    step: 2,
    node: 'Documentation',
    title: { fr: 'Anomalie détectée', en: 'Anomaly detected' },
    detail: {
      fr: 'Bs_réel (114 MPa) vs Bs_prédit (108 MPa) → déviation +5,6 % (> seuil 5 %).',
      en: 'Bs_real (114 MPa) vs Bs_predicted (108 MPa) → deviation +5.6% (> 5% threshold).',
    },
  },
  {
    step: 3,
    node: 'Simulation',
    title: { fr: 'Be révisé', en: 'Be revised' },
    detail: {
      fr: 'Seuil de contrainte Be : 120 MPa → 111 MPa (marge de sécurité réduite).',
      en: 'Stress threshold Be: 120 MPa → 111 MPa (reduced safety margin).',
    },
  },
  {
    step: 4,
    node: 'Orchestrateur',
    title: { fr: 'Redesign déclenché', en: 'Redesign triggered' },
    detail: {
      fr: 'Déviation > seuil → boucle de redesign déclenchée. Concept A signalé.',
      en: 'Deviation > threshold → redesign loop triggered. Concept A flagged.',
    },
  },
  {
    step: 5,
    node: 'Génération',
    title: { fr: 'Nouvelle structure', en: 'New structure' },
    detail: {
      fr: 'Épaisseur de paroi 7 mm → 8 mm. Nouveau concept « A-v2 ». DFx re-scoré.',
      en: 'Wall thickness 7 mm → 8 mm. New concept “A-v2”. DFx re-scored.',
    },
  },
  {
    step: 6,
    node: 'Gate Review',
    title: { fr: 'Validation', en: 'Validation' },
    detail: {
      fr: 'A-v2 passe Bs vs Be. DFM 85 → 82. DFS inchangé. Boucle complétée.',
      en: 'A-v2 passes Bs vs Be. DFM 85 → 82. DFS unchanged. Loop complete.',
    },
  },
];

const PHASES = [
  'idle',
  'sensor_read',
  'deviation_detected',
  'be_revised',
  'redesign_triggered',
  'redesign_running',
  'completed',
] as const;

/** Advance the feedback loop by one step, applying side effects + ADT entries. */
export function advanceFeedback(): boolean {
  const st = useAppState.getState();
  const cur = st.feedbackLoop.step;
  if (cur >= 6) return false;
  const next = cur + 1;
  const step = FEEDBACK_STEPS[next - 1];

  st.setFeedbackLoop({ phase: PHASES[next], step: next });

  if (next === 2) {
    const dev = checkFeedbackDeviation(114, 108, 5);
    st.setFeedbackLoop({ deviationPct: dev?.deviationPct ?? 5.6 });
  }

  if (next === 3) {
    // revise Concept A expected Be threshold
    const a = useAppState.getState().concepts.find((c) => c.id === 'A');
    if (a) {
      st.updateConcept('A', {
        fbs: {
          ...a.fbs,
          behaviour: {
            ...a.fbs.behaviour,
            expected: { ...a.fbs.behaviour.expected, stress_max_MPa: 111 },
          },
        },
      });
    }
  }

  if (next === 5) {
    // generate A-v2 from A and append (re-scored)
    const a = useAppState.getState().concepts.find((c) => c.id === 'A');
    const exists = useAppState.getState().concepts.some((c) => c.id === 'A-v2');
    if (a && !exists) st.addConcept(runRedesign(a));
  }

  st.appendADT({
    agent:
      next === 1 ? 'simulation' : next === 2 ? 'doc' : next === 3 ? 'simulation' : next === 4 ? 'orchestrator' : next === 5 ? 'generation' : 'doc',
    event: `feedback_step_${next}_${step.node.toLowerCase().replace(/[^a-z]/g, '')}`,
    source: step.node + ' (simulé)',
    payload: { step: next, detail: step.detail.fr },
  });

  return next < 6;
}

export function feedbackStepText(s: FeedbackStep, lang: Lang) {
  return { title: s.title[lang], detail: s.detail[lang] };
}
