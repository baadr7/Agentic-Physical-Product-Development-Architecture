// E8 glossary — 22 terms (docs/10). FR authoritative; EN provided for the toggle.

export interface GlossaryTerm {
  n: number;
  term: string;
  layer: string;
  def: { fr: string; en: string };
  example?: { fr: string; en: string };
}

export const glossary: GlossaryTerm[] = [
  { n: 1, term: 'APDA', layer: 'Framework', def: {
    fr: 'Agentic Physical Product Development Architecture — framework 5 couches superposant des agents IA au PDP existant de l’entreprise.',
    en: 'Agentic Physical Product Development Architecture — 5-layer framework overlaying AI agents onto the company’s existing PDP.' } },
  { n: 2, term: 'ADT', layer: 'L2/L4', def: {
    fr: 'Agentic Digital Thread — système multi-agents maintenant la continuité sémantique des données produit du brief jusqu’au feedback terrain.',
    en: 'Agentic Digital Thread — multi-agent system maintaining semantic continuity of product data from brief to field feedback.' } },
  { n: 3, term: 'Digital Thread', layer: 'L4', def: {
    fr: 'Flux de données structuré continu reliant chaque phase : brief → concepts → simulation FBS → scoring DFx → gate → feedback → redesign.',
    en: 'Continuous structured data flow linking every phase: brief → concepts → FBS simulation → DFx scoring → gate → feedback → redesign.' } },
  { n: 4, term: 'FBS', layer: 'L4', def: {
    fr: 'Ontologie Function–Behaviour–Structure — décompose tout problème de conception en F (fonction), B (comportement : Be vs Bs), S (structure).',
    en: 'Function–Behaviour–Structure ontology — decomposes any design problem into F (function), B (behaviour: Be vs Bs), S (structure).' } },
  { n: 5, term: 'Function (F)', layer: 'L4', def: {
    fr: 'Les exigences fonctionnelles.', en: 'The functional requirements.' },
    example: { fr: 'Pour DN100 : résister à 16 bar, assurer l’étanchéité, masse ≤ 2,8 kg, MTBF ≥ 50 000 cycles.', en: 'For DN100: withstand 16 bar, ensure sealing, mass ≤ 2.8 kg, MTBF ≥ 50,000 cycles.' } },
  { n: 6, term: 'Behaviour (B)', layer: 'L4', def: {
    fr: 'Comment le produit se comporte.', en: 'How the product behaves.' },
    example: { fr: 'Be (attendu) = contrainte ≤ 120 MPa. Bs (simulé) = contrainte calculée depuis la géométrie.', en: 'Be (expected) = stress ≤ 120 MPa. Bs (simulated) = stress computed from geometry.' } },
  { n: 7, term: 'Structure (S)', layer: 'L4', def: {
    fr: 'La réalisation physique : matériau, procédé, géométrie.', en: 'The physical realization: material, process, geometry.' },
    example: { fr: 'Concept A : AlSi10Mg coulée, paroi 7 mm, brides 4×M12.', en: 'Concept A: AlSi10Mg casting, 7 mm wall, 4×M12 flanges.' } },
  { n: 8, term: 'HITL (par agent)', layer: 'L1', def: {
    fr: 'Human-In-The-Loop — chaque agent a son propre niveau d’autonomie (L1–L5), configurable indépendamment.',
    en: 'Human-In-The-Loop — each agent has its own autonomy level (L1–L5), independently configurable.' } },
  { n: 9, term: 'L1 — Opérateur', layer: 'L1', def: {
    fr: 'L’IA est un outil uniquement. L’humain prend toutes les décisions.', en: 'AI is a tool only. The human makes all decisions.' },
    example: { fr: 'Appliqué au Generation Agent en S1 (Aérospatial).', en: 'Applied to the Generation Agent in S1 (Aerospace).' } },
  { n: 10, term: 'L2 — Collaborateur', layer: 'L1', def: {
    fr: 'L’humain et l’IA co-conçoivent. L’IA suggère, l’humain valide tout.', en: 'Human and AI co-design. AI suggests, human validates everything.' },
    example: { fr: 'Défaut pour le Generation Agent.', en: 'Default for the Generation Agent.' } },
  { n: 11, term: 'L3 — Consultant', layer: 'L1', def: {
    fr: 'L’IA produit la majorité de l’analyse, l’humain choisit parmi les options classées.', en: 'AI produces most of the analysis, the human picks among ranked options.' },
    example: { fr: 'Défaut pour S2.', en: 'Default for S2.' } },
  { n: 12, term: 'L4 — Approbateur', layer: 'L1', def: {
    fr: 'L’IA pré-sélectionne, l’humain approuve ou annule.', en: 'AI pre-selects, the human approves or cancels.' },
    example: { fr: 'Défaut pour les agents Doc et Retrieval.', en: 'Default for the Doc and Retrieval agents.' } },
  { n: 13, term: 'L5 — Observateur', layer: 'L1', def: {
    fr: 'L’IA agit de façon autonome, l’humain surveille les KPIs. Autorisé uniquement pour les agents à faible risque.',
    en: 'AI acts autonomously, the human monitors KPIs. Allowed only for low-risk agents.' } },
  { n: 14, term: 'Retrieval Agent', layer: 'L2', def: {
    fr: 'Interroge toutes les sources pertinentes via le connecteur générique : PLM, normes, ERP, Digital Twin, base REX, SAV.',
    en: 'Queries all relevant sources via the generic connector: PLM, standards, ERP, Digital Twin, REX base, after-sales.' } },
  { n: 15, term: 'Generation Agent', layer: 'L2', def: {
    fr: 'Fait la correspondance F→S : génère des concepts candidats avec pack de disponibilité DFx pour chacun.',
    en: 'Performs the F→S mapping: generates candidate concepts with a DFx readiness pack for each.' } },
  { n: 16, term: 'Simulation Agent', layer: 'L2', def: {
    fr: 'Fait la correspondance S→Bs : calcule le comportement simulé, compare à Be, déclenche le redesign si Bs échoue Be.',
    en: 'Performs the S→Bs mapping: computes simulated behaviour, compares to Be, triggers redesign if Bs fails Be.' } },
  { n: 17, term: 'DFx Agents (×5)', layer: 'L2', def: {
    fr: 'DFM (fabricabilité), DFA (assemblage), DFR (fiabilité), DFC (coût), DFS (durabilité). Exécutés en parallèle.',
    en: 'DFM (manufacturability), DFA (assembly), DFR (reliability), DFC (cost), DFS (sustainability). Run in parallel.' } },
  { n: 18, term: 'DFS — Design for Sustainability', layer: 'L2', def: {
    fr: 'Évalue recyclabilité %, empreinte CO₂, index matériau circulaire, scénario fin de vie.',
    en: 'Evaluates recyclability %, CO₂ footprint, circular material index, end-of-life scenario.' },
    example: { fr: 'Concept B (GGG40) score le plus élevé à 84/100.', en: 'Concept B (GGG40) scores highest at 84/100.' } },
  { n: 19, term: 'Connecteur générique', layer: 'L3', def: {
    fr: 'Interface standardisée abstrayant tout système externe (PLM, ERP, CAD, AMDEC…). En démo : simulé avec payload JSON visible.',
    en: 'Standardised interface abstracting any external system (PLM, ERP, CAD, AMDEC…). In demo: simulated with visible JSON payload.' } },
  { n: 20, term: 'Boucle de feedback', layer: 'L2/L3', def: {
    fr: 'Données MES/IoT → réévaluation Simulation Agent → déclenchement redesign → nouvelle itération concept.',
    en: 'MES/IoT data → Simulation Agent re-evaluation → redesign trigger → new concept iteration.' },
    example: { fr: 'Visualisée en E5.', en: 'Visualised in E5.' } },
  { n: 21, term: 'Orchestrator', layer: 'L2', def: {
    fr: 'Planifie les séquences de tâches, route les sous-tâches, applique les niveaux HITL, déclenche la boucle redesign.',
    en: 'Plans task sequences, routes sub-tasks, enforces HITL levels, triggers the redesign loop.' } },
  { n: 22, term: 'Score DFx composite', layer: 'L2', def: {
    fr: 'Somme pondérée des scores DFM, DFA, DFR, DFC, DFS selon les priorités du brief. Pilote le classement en E4.',
    en: 'Weighted sum of DFM, DFA, DFR, DFC, DFS scores using the brief priorities. Drives the E4 ranking.' } },
];
