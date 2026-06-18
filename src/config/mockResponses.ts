// Realistic French mocked LLM responses (docs/09). Used in demo mode (no API key)
// and as the final fallback after a failed real call. Every call site has a mock so
// the demo is fully usable offline.
//
// These are DERIVED from the actual run inputs (scenario, DFx priorities, HITL
// levels, concept numbers and weaknesses) so the commentary is specific and useful
// for the chosen configuration — not generic boilerplate.

import type {
  OrchestratorPlan,
  DFxJustifications,
  SimulationAnalysis,
  ResidualRisks,
} from '@/llm/contracts';
import type { Concept, DFxKey, DFxScores, ProductBrief, Scenario } from '@/types';

const ROLE_BY_LEVEL: Record<number, string> = {
  1: 'opérateur — chaque étape validée par un humain',
  2: 'collaborateur — décisions co-construites agent/humain',
  3: 'consultant — les agents proposent, vous arbitrez',
  4: 'approbateur — exécution autonome, validation finale',
  5: 'observateur — exécution autonome, supervision a posteriori',
};

function topPriority(p: DFxScores): DFxKey {
  return (Object.keys(p) as DFxKey[]).reduce((a, b) => (p[b] > p[a] ? b : a));
}

export function mockOrchestratorPlan(_scenarioName: string, brief: ProductBrief): OrchestratorPlan {
  const o = brief.agentLevels.orchestrator;
  const g = brief.agentLevels.generation;
  const c = brief.constraints;
  const stressBe = brief.behaviourExpected.stress_max_MPa;
  const top = topPriority(brief.dfxPriorities);
  const dfs = brief.dfxPriorities.dfs;

  const genAction =
    g <= 1
      ? 'Génération assistée : variantes proposées, conception validée par un humain (pas de génération autonome)'
      : g >= 4
        ? 'Générer 4 concepts FBS en autonomie + DFx préliminaire'
        : 'Mapper F→S, générer 4 concepts FBS + DFx préliminaire';

  const plan = [
    { step: 1, agent: 'retrieval', action: `Interroger PLM, normes ${brief.standards.join('/') || 'applicables'}, ERP matériaux`, duration_s: 12 },
    { step: 2, agent: 'generation', action: genAction, duration_s: g <= 1 ? 22 : 18 },
    { step: 3, agent: 'simulation', action: `Calculer Bs, comparer à Be (≤ ${stressBe} MPa)`, duration_s: 15 },
    { step: 4, agent: 'dfx', action: 'Scorer DFM/DFA/DFR/DFC/DFS en parallèle', duration_s: 9 },
    { step: 5, agent: 'doc', action: 'Construire le thread numérique (ADT), préparer la gate review', duration_s: 6 },
  ];

  const keyRiskByPriority: Record<DFxKey, string> = {
    dfr: `Fiabilité prioritaire (MTBF cible ${c.mtbf_cycles.toLocaleString('fr-FR')} cycles) : une marge de contrainte trop faible sous Be ${stressBe} MPa est le risque dominant.`,
    dfc: `Coût prioritaire (cible ${c.cost_target_eur} €/pièce) : le dépassement du coût pièce ou de l'outillage en série est le risque dominant.`,
    dfm: `Fabricabilité prioritaire : un procédé inadapté à la cadence (reprises d'usinage, outillage) est le risque dominant.`,
    dfa: `Assemblage prioritaire : un nombre de pièces ou des tolérances incompatibles avec la ligne est le risque dominant.`,
    dfs: `Durabilité prioritaire (DFS ${dfs}/5) : une recyclabilité insuffisante (matériaux hétérogènes) est le risque dominant.`,
  };

  const sustainability =
    dfs >= 4
      ? `DFS fortement pondéré (${dfs}/5) : privilégier un mono-matériau recyclable et la démontabilité ; déclencher la question éco-contractuelle.`
      : dfs <= 2
        ? `DFS faible (${dfs}/5) sur ce scénario : durabilité délibérément secondaire — tracer ce choix à la gate review (dette environnementale assumée).`
        : `DFS équilibré (${dfs}/5) : éviter les inserts métalliques hétérogènes, conserver un démontage simple.`;

  return {
    plan,
    hitl_comment:
      `Orchestrateur L${o} (${ROLE_BY_LEVEL[o] ?? 'consultant'}). Génération en L${g}` +
      `${g <= 1 ? ' — aucune génération autonome autorisée' : ''}. ` +
      `Vous pouvez suspendre ou reconfigurer un agent à tout moment.`,
    key_risk: keyRiskByPriority[top],
    sustainability_note: sustainability,
  };
}

export function mockJustifications(concepts: Concept[]): DFxJustifications {
  // Derived from each concept's own structure/scores so the commentary is correct
  // for any generated concept set, not just the curated DN100 valves.
  const procFr: Record<string, string> = { casting: 'coulée', cnc: 'usinage CNC', hybrid: 'procédé hybride' };
  const lvl = (s: number) => (s >= 85 ? 'excellent' : s >= 70 ? 'bon' : s >= 50 ? 'moyen' : 'faible');
  return {
    justifications: concepts.map((c) => {
      const s = c.fbs.structure;
      const sc = c.scores;
      const be = c.fbs.behaviour.expected.stress_max_MPa;
      const bs = c.fbs.behaviour.simulated.stress_max_MPa;
      const margin = be > 0 ? Math.round((1 - bs / be) * 100) : 0;
      const hetero = /insert|hybrid/i.test(s.material) || s.process === 'hybrid';
      const assembly = hetero
        ? 'Insert pré-positionné'
        : /boulonn|assembl/i.test(c.name)
          ? 'Assemblage boulonné démontable'
          : 'Corps monolithique, peu de pièces';
      return {
        concept_id: c.id,
        dfm: `${procFr[s.process] ?? s.process} de ${s.material}, paroi ${s.wall_mm} mm : fabricabilité ${lvl(sc.dfm)} (${sc.dfm}).`,
        dfa: `${assembly} : DFA ${sc.dfa} (${lvl(sc.dfa)}).`,
        dfr: `Marge ${margin} % sous Be ${be} MPa : fiabilité ${lvl(sc.dfr)} (${sc.dfr}).`,
        dfc: `Coût pièce estimé ${c.cost_eur} € : DFC ${sc.dfc} (inversion coût appliquée).`,
        dfs: `${hetero ? 'Matériaux hétérogènes : recyclage de fin de vie complexe' : `${s.material} mono-matériau recyclable`} : DFS ${sc.dfs}.`,
      };
    }),
  };
}

export function mockSimulationAnalysis(concept: Concept): SimulationAnalysis {
  const be = concept.fbs.behaviour.expected;
  const bs = concept.fbs.behaviour.simulated;
  const pass = bs.stress_max_MPa <= be.stress_max_MPa && bs.deflection_max_mm <= be.deflection_max_mm;
  const margin = be.stress_max_MPa > 0 ? Math.round((1 - bs.stress_max_MPa / be.stress_max_MPa) * 100) : 0;
  return {
    fbs_summary: `${concept.materialProcess}, paroi ${concept.fbs.structure.wall_mm} mm. Bs = ${bs.stress_max_MPa} MPa pour Be ≤ ${be.stress_max_MPa} MPa.`,
    bs_be_status: pass ? 'PASS' : 'REDESIGN',
    engineering_note: pass
      ? `Contrainte simulée ${bs.stress_max_MPa} MPa sous le seuil Be, marge ${margin} %. Flèche ${bs.deflection_max_mm} mm conforme.`
      : `Contrainte simulée ${bs.stress_max_MPa} MPa au-delà de Be : redesign requis (déficit ${-margin} %).`,
    feedback_loop_risk:
      `Surveiller la contrainte réelle de ${concept.fbs.structure.material} via MES/IoT : ` +
      `une dérive consommant la marge de ${margin} % (> 5 %) déclenche la boucle de redesign.`,
  };
}

export function mockResidualRisks(
  concept: Concept,
  scenario: Scenario | null,
  feedbackTriggered: boolean,
): ResidualRisks {
  const be = concept.fbs.behaviour.expected.stress_max_MPa;
  const bs = concept.fbs.behaviour.simulated.stress_max_MPa;
  const margin = be > 0 ? Math.round((1 - bs / be) * 100) : 0;
  const pr = scenario?.dfxPriorities;

  const relSeverity: 'faible' | 'moyen' | 'élevé' = margin < 12 ? 'élevé' : margin < 20 ? 'moyen' : 'faible';
  const reliability = {
    risk: feedbackTriggered
      ? `Contrainte réelle en service supérieure à la prédiction — déjà détectée par la boucle feedback (marge initiale ${margin} % sous Be ${be} MPa).`
      : `Dérive de la contrainte opérationnelle au-delà de la marge simulée (${margin} % sous Be ${be} MPa).`,
    severity: pr && pr.dfr >= 4 && margin < 20 ? ('élevé' as const) : relSeverity,
    category: 'fiabilité',
    mitigation: feedbackTriggered
      ? 'Boucle MES/IoT active ; A-v2 renforcé. Maintenir le seuil de redesign à 5 % de dérive.'
      : 'Activer la surveillance MES/IoT ; seuil de redesign à 5 % de dérive.',
  };

  // A concrete risk built from the retained concept's documented weakness.
  const w = concept.weakness || '';
  let wCategory = 'coût';
  let wSeverity: 'faible' | 'moyen' | 'élevé' = 'faible';
  let wMitigation = 'Confirmer le volume série avec l’ERP avant lancement industriel.';
  if (/recycl|insert|inox|fin de vie|hétérog/i.test(w)) {
    wCategory = 'durabilité';
    wSeverity = 'moyen';
    wMitigation = 'Documenter la filière de démontage/recyclage ; évaluer une variante mono-matériau.';
  } else if (/masse|poids|kg/i.test(w)) {
    wCategory = 'masse';
    wSeverity = pr && pr.dfm >= 4 ? 'moyen' : 'faible';
    wMitigation = 'Optimiser nervuration/épaisseur ; arbitrer masse vs coût selon les priorités.';
  } else if (/usinage|cnc|temps machine/i.test(w)) {
    wCategory = 'coût';
    wSeverity = 'élevé';
    wMitigation = 'Réserver l’usinage aux faibles volumes ; basculer en fonderie au-delà.';
  } else if (/co[ûu]t|€|outillage/i.test(w)) {
    wCategory = 'coût';
    wSeverity = pr && pr.dfc >= 4 ? 'élevé' : 'moyen';
    wMitigation = 'Amortir l’outillage sur le volume confirmé ; négocier le coût matière.';
  }
  const weakness = {
    risk: w ? `Faiblesse du concept retenu : ${w}.` : 'Faiblesse spécifique du concept retenu.',
    severity: wSeverity,
    category: wCategory,
    mitigation: wMitigation,
  };

  const dfs = concept.scores.dfs;
  const sustainability =
    dfs < 70
      ? {
          risk: `Recyclabilité en fin de vie sous le seuil de conception circulaire (DFS ${dfs}).`,
          severity: 'moyen' as const,
          category: 'durabilité',
          mitigation: 'Privilégier un matériau mono-bloc ; documenter la filière de démantèlement.',
        }
      : {
          risk: 'Variabilité de la filière de recyclage selon le marché cible.',
          severity: 'faible' as const,
          category: 'durabilité',
          mitigation: 'Vérifier la disponibilité d’une filière agréée par marché.',
        };

  return { risks: [reliability, weakness, sustainability] };
}
