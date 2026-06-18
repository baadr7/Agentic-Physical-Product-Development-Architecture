// HITL autonomy matrix (docs/04). For each agent and level: what the agent does,
// what the human does, the available UI action, and the human role title.
// FR is authoritative; EN provided for the toggle.

import type { AgentId, HITLLevel, Lang } from '@/types';

export interface HITLCell {
  agent: { fr: string; en: string };
  human: { fr: string; en: string };
  action: { fr: string; en: string };
}

export const ROLE_TITLE: Record<HITLLevel, { fr: string; en: string }> = {
  1: { fr: 'Opérateur', en: 'Operator' },
  2: { fr: 'Collaborateur', en: 'Collaborator' },
  3: { fr: 'Consultant', en: 'Consultant' },
  4: { fr: 'Approbateur', en: 'Approver' },
  5: { fr: 'Observateur', en: 'Observer' },
};

export const LEVEL_PRINCIPLE: Record<HITLLevel, { fr: string; en: string }> = {
  1: { fr: "L'IA est un outil. L'humain décide de tout.", en: 'AI is a tool only. Human decides everything.' },
  2: { fr: "Co-conception : l'IA suggère, l'humain valide tout.", en: 'Co-design: AI suggests, human validates all.' },
  3: { fr: "L'IA analyse, l'humain choisit parmi les options classées.", en: 'AI analyses, human picks among ranked options.' },
  4: { fr: "L'IA pré-sélectionne, l'humain approuve ou annule.", en: 'AI pre-selects, human approves or cancels.' },
  5: { fr: "L'IA agit en autonomie, l'humain surveille les KPI.", en: 'AI acts autonomously, human monitors KPIs.' },
};

// Allowed range + default per agent (docs/04 / E1.3)
export const AGENT_CONFIG: Record<
  AgentId,
  { label: { fr: string; en: string }; default: HITLLevel; min: HITLLevel; max: HITLLevel; reason: { fr: string; en: string } }
> = {
  orchestrator: {
    label: { fr: 'Orchestrateur', en: 'Orchestrator' },
    default: 3, min: 2, max: 4,
    reason: { fr: 'Planification/routage — validation humaine du plan requise', en: 'Planning/routing — human plan validation needed' },
  },
  retrieval: {
    label: { fr: 'Récupération', en: 'Retrieval' },
    default: 4, min: 3, max: 5,
    reason: { fr: 'Tâche de recherche à faible risque', en: 'Low-risk search task' },
  },
  generation: {
    label: { fr: 'Génération', en: 'Generation' },
    default: 2, min: 1, max: 4,
    reason: { fr: 'Forte valeur créative — co-conception humaine critique', en: 'High creative value — human co-design critical' },
  },
  simulation: {
    label: { fr: 'Simulation', en: 'Simulation' },
    default: 3, min: 2, max: 4,
    reason: { fr: 'Analyse technique — l’humain valide les seuils Be', en: 'Technical analysis — human validates Be thresholds' },
  },
  dfx: {
    label: { fr: 'DFx ×5', en: 'DFx ×5' },
    default: 3, min: 2, max: 4,
    reason: { fr: 'Score déterministe — justification à revoir', en: 'Deterministic score — justification needs review' },
  },
  doc: {
    label: { fr: 'Documentation', en: 'Documentation' },
    default: 4, min: 3, max: 5,
    reason: { fr: 'Documentation à faible risque — automatisation acceptable', en: 'Low-risk documentation — automation acceptable' },
  },
};

// Per-agent, per-level behaviour text (condensed from docs/04).
export const HITL_MATRIX: Record<AgentId, Record<HITLLevel, HITLCell>> = {
  orchestrator: {
    1: { agent: { fr: 'Analyse le brief, propose un plan séquencé avec durées estimées.', en: 'Analyses brief, proposes a sequenced plan with estimated durations.' }, human: { fr: 'Lit le plan, réordonne, retire un agent, modifie avant validation.', en: 'Reads plan, reorders, removes an agent, edits before validating.' }, action: { fr: 'Valider / Modifier le plan', en: 'Validate / Edit plan' } },
    2: { agent: { fr: 'Génère 2–3 variantes de plan (ordre, parallélisme, agents actifs).', en: 'Generates 2–3 plan variants (order, parallelism, active agents).' }, human: { fr: 'Choisit une variante, peut l’ajuster avant lancement.', en: 'Picks a variant, may adjust before launch.' }, action: { fr: 'Sélectionner une variante', en: 'Select a variant' } },
    3: { agent: { fr: 'Produit un plan recommandé justifié et lance les agents.', en: 'Produces a recommended justified plan and launches agents.' }, human: { fr: 'Surveille l’exécution, peut suspendre ou reconfigurer un agent.', en: 'Watches execution, can suspend or reconfigure an agent.' }, action: { fr: 'Suspendre / Reconfigurer', en: 'Suspend / Reconfigure' } },
    4: { agent: { fr: 'Exécute en autonomie, re-route si un agent échoue.', en: 'Executes autonomously, reroutes if an agent fails.' }, human: { fr: 'Surveille les KPI, notifié sur décision critique.', en: 'Monitors KPIs, notified on critical decision.' }, action: { fr: 'Approuver la décision critique', en: 'Approve critical decision' } },
    5: { agent: { fr: 'Gestion complète du workflow, re-essai auto, journalise tout.', en: 'Full workflow management, auto-retry, logs everything.' }, human: { fr: 'Lit le résumé final, peut auditer le journal.', en: 'Reads final summary, can audit the log.' }, action: { fr: 'Consulter le log', en: 'View log' } },
  },
  retrieval: {
    1: { agent: { fr: 'Attend une requête structurée, exécute la recherche sur les sources désignées.', en: 'Waits for a structured query, searches designated sources.' }, human: { fr: 'Formule la requête (termes, sources, filtres), lance manuellement.', en: 'Formulates the query (terms, sources, filters), launches manually.' }, action: { fr: 'Lancer la recherche', en: 'Run search' } },
    2: { agent: { fr: 'Propose 3–5 requêtes candidates avec sources et justification.', en: 'Proposes 3–5 candidate queries with sources + rationale.' }, human: { fr: 'Sélectionne ou édite une requête, valide avant exécution.', en: 'Selects/edits a query, validates before execution.' }, action: { fr: 'Valider la requête', en: 'Validate query' } },
    3: { agent: { fr: 'Exécute les recherches, renvoie les résultats classés par pertinence.', en: 'Runs searches, returns results ranked by relevance.' }, human: { fr: 'Filtre les résultats, exclut les sources non pertinentes.', en: 'Filters results, excludes irrelevant sources.' }, action: { fr: 'Confirmer le contexte', en: 'Confirm context' } },
    4: { agent: { fr: 'Recherche, sélectionne, synthétise un contexte prêt à l’emploi.', en: 'Searches, selects, synthesises ready-to-use context.' }, human: { fr: 'Peut exclure une source ou approfondir, approuve le contexte.', en: 'May exclude a source or deepen, approves the context.' }, action: { fr: 'Approuver / Exclure', en: 'Approve / Exclude' } },
    5: { agent: { fr: 'Recherche continue, alerte sur données contradictoires.', en: 'Continuous search, alerts on contradictory data.' }, human: { fr: 'Voit un résumé, alerté sur conflit.', en: 'Sees a summary, alerted on conflict.' }, action: { fr: 'Traiter le conflit', en: 'Handle conflict' } },
  },
  generation: {
    1: { agent: { fr: 'Attend tous les paramètres (F, S, nombre de concepts, contraintes DFx).', en: 'Waits for all parameters (F, S, concept count, DFx constraints).' }, human: { fr: 'Définit tous les paramètres, lance manuellement.', en: 'Defines all parameters, launches manually.' }, action: { fr: 'Lancer', en: 'Launch' } },
    2: { agent: { fr: 'Propose une configuration de génération (nombre, axes de variation).', en: 'Proposes a generation config (count, variation axes).' }, human: { fr: 'Ajuste la config proposée, valide avant génération.', en: 'Adjusts the proposed config, validates before generation.' }, action: { fr: 'Valider la config', en: 'Validate config' } },
    3: { agent: { fr: 'Génère N concepts avec FBS + DFx préliminaire, sans recommandation.', en: 'Generates N concepts with FBS + preliminary DFx, no recommendation.' }, human: { fr: 'Étudie les concepts, peut demander des variantes.', en: 'Studies concepts, may request variants.' }, action: { fr: 'Demander variante / Continuer', en: 'Request variant / Continue' } },
    4: { agent: { fr: 'Génère, classe par score composite DFx, recommande le meilleur.', en: 'Generates, ranks by composite DFx, recommends the best.' }, human: { fr: 'Revoit la recommandation, peut la surcharger.', en: 'Reviews the recommendation, may override.' }, action: { fr: 'Accepter / Overrider', en: 'Accept / Override' } },
    5: { agent: { fr: 'Génère, classe et auto-sélectionne, notifie l’humain.', en: 'Generates, ranks and auto-selects, notifies the human.' }, human: { fr: 'Voit le concept choisi + justification, peut rouvrir.', en: 'Sees the chosen concept + rationale, may reopen.' }, action: { fr: 'Confirmer / Rouvrir', en: 'Confirm / Reopen' } },
  },
  simulation: {
    1: { agent: { fr: 'Attend les paramètres de simulation (solveur, maillage, conditions limites).', en: 'Waits for simulation parameters (solver, mesh, boundary conditions).' }, human: { fr: 'Configure manuellement, lance le calcul.', en: 'Configures manually, launches the computation.' }, action: { fr: 'Lancer', en: 'Launch' } },
    2: { agent: { fr: 'Propose une configuration de simulation justifiée.', en: 'Proposes a justified simulation config.' }, human: { fr: 'Revoit, modifie si besoin, approuve le lancement.', en: 'Reviews, edits if needed, approves the launch.' }, action: { fr: 'Approuver la config', en: 'Approve config' } },
    3: { agent: { fr: 'Lance la simulation, produit Bs, compare Bs vs Be, présente l’écart.', en: 'Runs simulation, produces Bs, compares Bs vs Be, presents the gap.' }, human: { fr: 'Interprète, décide acceptable ou redesign.', en: 'Interprets, decides acceptable or redesign.' }, action: { fr: 'Acceptable / Redesign', en: 'Acceptable / Redesign' } },
    4: { agent: { fr: 'Compare Bs/Be, recommande un redesign si écart > seuil.', en: 'Compares Bs/Be, recommends redesign if gap > threshold.' }, human: { fr: 'Approuve/rejette le redesign, peut modifier le seuil.', en: 'Approves/rejects redesign, may modify threshold.' }, action: { fr: 'Approuver / Rejeter redesign', en: 'Approve / Reject redesign' } },
    5: { agent: { fr: 'Boucle complète : simulation → comparaison → redesign → re-simulation.', en: 'Full loop: simulation → comparison → redesign → resimulation.' }, human: { fr: 'Surveille la convergence, reçoit le résultat validé.', en: 'Monitors convergence, receives the validated result.' }, action: { fr: 'Consulter le résultat', en: 'View result' } },
  },
  dfx: {
    1: { agent: { fr: 'Calcule les scores (déterministes), demande confirmation des entrées.', en: 'Computes (deterministic) scores, asks to confirm inputs.' }, human: { fr: 'Saisit les preuves et confirme chaque entrée de score.', en: 'Enters evidence and confirms each score input.' }, action: { fr: 'Confirmer les entrées', en: 'Confirm inputs' } },
    2: { agent: { fr: 'Calcule et propose les entrées de chaque agent DFx.', en: 'Computes and proposes each DFx agent’s inputs.' }, human: { fr: 'Valide les entrées de chaque agent.', en: 'Validates each agent’s inputs.' }, action: { fr: 'Valider les entrées', en: 'Validate inputs' } },
    3: { agent: { fr: 'Calcule les 5 scores en parallèle, produit les justifications.', en: 'Computes the 5 scores in parallel, produces justifications.' }, human: { fr: 'Revoit les justifications parmi les critères classés.', en: 'Reviews justifications among ranked criteria.' }, action: { fr: 'Revoir les justifications', en: 'Review justifications' } },
    4: { agent: { fr: 'Produit le pack de scores complet et le recommande.', en: 'Produces the full score pack and recommends it.' }, human: { fr: 'Approuve le pack de scores.', en: 'Approves the score pack.' }, action: { fr: 'Approuver le pack', en: 'Approve pack' } },
    5: { agent: { fr: 'Score en continu, surveille les seuils.', en: 'Scores continuously, monitors thresholds.' }, human: { fr: 'Surveille uniquement.', en: 'Monitors only.' }, action: { fr: 'Surveiller', en: 'Monitor' } },
  },
  doc: {
    1: { agent: { fr: 'Attend les données fournies par l’humain à documenter.', en: 'Waits for human-provided data to document.' }, human: { fr: 'Saisit tout manuellement, valide chaque entrée du thread.', en: 'Enters everything manually, validates each thread entry.' }, action: { fr: 'Ajouter une entrée', en: 'Add entry' } },
    2: { agent: { fr: 'Capture les sorties des agents, propose des entrées de thread.', en: 'Captures agent outputs, proposes thread entries.' }, human: { fr: 'Valide ou corrige chaque entrée avant archivage ADT.', en: 'Validates or corrects each entry before ADT archiving.' }, action: { fr: 'Valider les entrées', en: 'Validate entries' } },
    3: { agent: { fr: 'Construit le digital thread en continu, propose des résumés de phase.', en: 'Builds the digital thread continuously, proposes phase summaries.' }, human: { fr: 'Revoit les résumés, ajoute des annotations manuelles.', en: 'Reviews summaries, adds manual annotations.' }, action: { fr: 'Annoter / Compléter', en: 'Annotate / Complete' } },
    4: { agent: { fr: 'Gère l’ADT en autonomie, produit le rapport de gate review.', en: 'Manages the ADT autonomously, produces the gate review report.' }, human: { fr: 'Approuve le rapport avant export, peut signer.', en: 'Approves the report before export, may sign.' }, action: { fr: 'Approuver et signer', en: 'Approve and sign' } },
    5: { agent: { fr: 'ADT entièrement automatisé : versioning, archivage, conformité EU AI Act.', en: 'Fully automated ADT: versioning, archiving, EU AI Act compliance.' }, human: { fr: 'Consulte l’ADT à la demande, audite si nécessaire.', en: 'Consults the ADT on demand, audits if necessary.' }, action: { fr: 'Auditer', en: 'Audit' } },
  },
};

export function pick(v: { fr: string; en: string }, lang: Lang): string {
  return v[lang] ?? v.fr;
}
