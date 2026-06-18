import type { Concept, ProductBrief, Scenario } from '@/types';

// Shared system prefix (docs/09). The model never produces DFx scores.
export const SYSTEM_PROMPT =
  "Tu es un agent d'ingénierie du framework APDA. Tu assistes la conception d'un " +
  "produit industriel. Tu ne calcules JAMAIS de scores DFx — ils te sont fournis. " +
  'Tu réponds en français technique concis. Réponds uniquement en JSON valide.';

const JSON_SUFFIX =
  '\n\nRéponds UNIQUEMENT avec un objet JSON valide, sans markdown, sans préambule.';

export function orchestratorPlanPrompt(scenario: string, brief: ProductBrief): string {
  return (
    `Scénario : ${scenario}. Produit : ${brief.name} — ${brief.function}. ` +
    `Normes : ${brief.standards.join(', ') || 'n/a'}. Be stress max : ${brief.behaviourExpected.stress_max_MPa} MPa. ` +
    `Contraintes : ${JSON.stringify(brief.constraints)}. ` +
    `Niveaux HITL : ${JSON.stringify(brief.agentLevels)}. ` +
    `Priorités DFx (1–5) : ${JSON.stringify(brief.dfxPriorities)}. ` +
    `Produis un plan d'exécution séquencé pour les agents (retrieval, generation, simulation, dfx, doc) ` +
    `avec pour chaque étape: step, agent, action (concrète, citant normes/seuils du brief), duration_s. ` +
    `hitl_comment : cite le niveau HITL RÉEL de l'orchestrateur et son rôle, et précise si la génération ` +
    `(niveau ${brief.agentLevels.generation}) est autonome ou validée par un humain. ` +
    `key_risk : LE risque le plus matériel compte tenu de la priorité DFx la plus élevée, en citant un chiffre du brief. ` +
    `sustainability_note : reflète le poids réel de DFS (${brief.dfxPriorities.dfs}/5) — s'il est faible, dis-le franchement.` +
    JSON_SUFFIX
  );
}

export function justificationsPrompt(concepts: Concept[], brief: ProductBrief): string {
  const rows = concepts
    .map((c) => `${c.id}: scores=${JSON.stringify(c.scores)} (${c.materialProcess}, faiblesse: ${c.weakness})`)
    .join('; ');
  return (
    `Produit : ${brief.name}. Concepts avec leurs scores DFx DÉJÀ CALCULÉS (ne les change pas) : ${rows}. ` +
    `Pour chaque concept, justifie chaque score (dfm, dfa, dfr, dfc, dfs) en ≤25 mots. ` +
    `Format: { "justifications": [ { "concept_id", "dfm", "dfa", "dfr", "dfc", "dfs" } ] }.` +
    JSON_SUFFIX
  );
}

export function simulationPrompt(concept: Concept, status: 'PASS' | 'REDESIGN'): string {
  const { expected, simulated } = concept.fbs.behaviour;
  return (
    `Concept ${concept.id} (${concept.materialProcess}). FBS-S: ${JSON.stringify(concept.fbs.structure)}. ` +
    `Be=${JSON.stringify(expected)}, Bs=${JSON.stringify(simulated)}. Statut déterministe: ${status}. ` +
    `Renvoie fbs_summary, bs_be_status (DOIT être "${status}"), engineering_note, feedback_loop_risk.` +
    JSON_SUFFIX
  );
}

export function residualRisksPrompt(
  concept: Concept,
  scenario: Scenario | null,
  feedbackTriggered: boolean,
): string {
  const { expected, simulated } = concept.fbs.behaviour;
  return (
    `Concept retenu ${concept.id} (${concept.materialProcess}), scores ${JSON.stringify(concept.scores)}. ` +
    `Faiblesse documentée : "${concept.weakness}". ` +
    `Be=${expected.stress_max_MPa} MPa, Bs=${simulated.stress_max_MPa} MPa (marge réelle à calculer). ` +
    `Scénario: ${scenario?.name ?? 'custom'}, priorités ${JSON.stringify(scenario?.dfxPriorities ?? {})}. ` +
    `Boucle feedback déclenchée: ${feedbackTriggered}. ` +
    `Donne EXACTEMENT 3 risques résiduels SPÉCIFIQUES (pas génériques) : ancre-les dans la faiblesse du concept, ` +
    `la marge Bs/Be, et les priorités du scénario ; au moins un de catégorie "durabilité". ` +
    `Adapte la sévérité aux priorités (ex. DFR élevé ⇒ risque fiabilité plus sévère). ` +
    `Chaque risque: risk, severity (faible|moyen|élevé), category, mitigation actionnable.` +
    JSON_SUFFIX
  );
}

export function nlConstraintsPrompt(text: string): string {
  return (
    `Texte produit : "${text}". Extrais les contraintes numériques connues (pressure_bar, temp_max_C, ` +
    `temp_min_C, mass_max_kg, cost_target_eur, wall_min_mm, ra_um) et les normes. ` +
    `Format: { "constraints": { ... }, "standards": [ ... ] }.` +
    JSON_SUFFIX
  );
}
