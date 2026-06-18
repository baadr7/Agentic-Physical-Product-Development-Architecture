// Bilingual dictionary. French is the authoritative UI language (per spec);
// English is provided via the header toggle. Keys are dotted by screen/area.

export type Lang = 'fr' | 'en';

export const dictionary: Record<string, { fr: string; en: string }> = {
  // --- app shell ---
  'app.name': { fr: 'APDA', en: 'APDA' },
  'app.tagline': {
    fr: "Architecture agentique de développement produit",
    en: 'Agentic Physical Product Development Architecture',
  },
  'shell.pdpPhase': { fr: 'Phase PDP', en: 'PDP phase' },
  'shell.pdp.conception': { fr: 'Conception préliminaire', en: 'Preliminary design' },
  'shell.scenario': { fr: 'Scénario', en: 'Scenario' },
  'shell.noScenario': { fr: 'Aucun scénario', en: 'No scenario' },
  'shell.glossary': { fr: 'Glossaire', en: 'Glossary' },
  'shell.settings': { fr: 'Paramètres', en: 'Settings' },
  'shell.demoMode': { fr: 'Mode démo', en: 'Demo mode' },
  'shell.connected': { fr: 'DeepSeek connecté', en: 'DeepSeek connected' },
  'shell.lang': { fr: 'EN', en: 'FR' },
  'shell.theme': { fr: 'Thème clair / sombre', en: 'Light / dark theme' },

  // --- nav / screen titles ---
  'nav.e1': { fr: 'Scénario', en: 'Scenario' },
  'nav.e2': { fr: 'Contraintes', en: 'Constraints' },
  'nav.e3': { fr: 'Agents', en: 'Agents' },
  'nav.e4': { fr: 'Concepts', en: 'Concepts' },
  'nav.e5': { fr: 'Détail', en: 'Detail' },
  'nav.e6': { fr: 'Sélection', en: 'Selection' },
  'nav.e7': { fr: 'Gate Review', en: 'Gate Review' },
  'nav.workflow': { fr: 'Chaîne agents', en: 'Agent chain' },

  'e1.title': { fr: 'Choix du scénario & paramétrage', en: 'Scenario choice & parameterization' },
  'e2.title': { fr: 'Configuration des contraintes techniques', en: 'Technical constraints configuration' },
  'e3.title': { fr: 'Tableau de bord multi-agents', en: 'Multi-agent dashboard' },
  'e4.title': { fr: 'Concepts générés', en: 'Generated concepts' },
  'e5.title': { fr: 'Détail du concept', en: 'Concept detail' },
  'e6.title': { fr: 'Sélection HITL', en: 'HITL selection' },
  'e7.title': { fr: 'Gate Review', en: 'Gate Review' },
  'e8.title': { fr: 'Glossaire', en: 'Glossary' },
  'workflow.title': { fr: 'Chaîne d\'orchestration des agents', en: 'Agent orchestration chain' },

  // --- agents ---
  'agent.orchestrator': { fr: 'Orchestrateur', en: 'Orchestrator' },
  'agent.retrieval': { fr: 'Récupération', en: 'Retrieval' },
  'agent.generation': { fr: 'Génération', en: 'Generation' },
  'agent.simulation': { fr: 'Simulation', en: 'Simulation' },
  'agent.dfx': { fr: 'DFx ×5', en: 'DFx ×5' },
  'agent.documentation': { fr: 'Documentation', en: 'Documentation' },

  // --- DFx ---
  'dfx.dfm': { fr: 'DFM', en: 'DFM' },
  'dfx.dfa': { fr: 'DFA', en: 'DFA' },
  'dfx.dfr': { fr: 'DFR', en: 'DFR' },
  'dfx.dfc': { fr: 'DFC', en: 'DFC' },
  'dfx.dfs': { fr: 'DFS', en: 'DFS' },
  'dfx.dfm.full': { fr: 'Fabricabilité', en: 'Manufacturability' },
  'dfx.dfa.full': { fr: 'Assemblage', en: 'Assembly' },
  'dfx.dfr.full': { fr: 'Fiabilité', en: 'Reliability' },
  'dfx.dfc.full': { fr: 'Coût', en: 'Cost' },
  'dfx.dfs.full': { fr: 'Durabilité', en: 'Sustainability' },

  // --- common ---
  'common.simulated': { fr: 'Simulé', en: 'Simulated' },
  'common.connected': { fr: 'Connecté', en: 'Connected' },
  'common.source': { fr: 'Source', en: 'Source' },
  'common.timestamp': { fr: 'Horodatage', en: 'Timestamp' },
  'common.copy': { fr: 'Copier', en: 'Copy' },
  'common.copied': { fr: 'Copié', en: 'Copied' },
  'common.cancel': { fr: 'Annuler', en: 'Cancel' },
  'common.close': { fr: 'Fermer', en: 'Close' },
  'common.placeholderScreen': {
    fr: 'Écran en cours de construction — phases suivantes.',
    en: 'Screen under construction — upcoming phases.',
  },
};
