// ============================================================
// APDA Static Configuration — Spec V1
// All 6 scenarios (S1–S6), DN100 concepts, HITL definitions
// ============================================================

export type AgentKey = 'orchestrator' | 'retrieval' | 'generation' | 'simulation' | 'dfx' | 'documentation';

export interface AgentLevels {
  orchestrator: number;
  retrieval: number;
  generation: number;
  simulation: number;
  dfx: number;
  documentation: number;
}

export interface DfxPriorities {
  dfm: number; // 1–5
  dfa: number;
  dfr: number;
  dfc: number;
  dfs: number;
}

export interface Scenario {
  id: string;
  name: string;
  shortName: string;
  description: string;
  industry: string;
  dfxPriorities: DfxPriorities;
  agentLevels: AgentLevels;
  globalHITL: number;
  humanRole: string;
  standards: string[];
  constraints: Record<string, unknown>;
}

// ── HITL Level Definitions ────────────────────────────────
export const HITL_LEVELS: Record<number, { name: string; role: string; color: string; desc: string }> = {
  1: { name: 'Opérateur',    role: 'Pleine autorité',   color: '#f43f5e', desc: "L'IA est un outil. Vous prenez toutes les décisions." },
  2: { name: 'Collaborateur',role: 'Directeur créatif',  color: '#f59e0b', desc: "L'IA suggère, vous validez tout." },
  3: { name: 'Consultant',   role: 'Décideur',           color: '#6366f1', desc: "L'IA produit l'analyse, vous choisissez parmi les options." },
  4: { name: 'Approbateur',  role: 'Approbateur',        color: '#06b6d4', desc: "L'IA pré-sélectionne, vous approuvez ou annulez." },
  5: { name: 'Observateur',  role: 'Observateur',        color: '#10b981', desc: "L'IA agit de façon autonome, vous surveillez les KPIs." },
};

// Agent human-role descriptions per level
export const AGENT_HITL_DESCRIPTIONS: Record<AgentKey, Record<number, { ai: string; human: string }>> = {
  orchestrator: {
    1: { ai: 'Analyse le brief, propose un plan séquencé.', human: 'Lit le plan, réordonne les étapes, valide.' },
    2: { ai: 'Génère 2–3 variantes de plan.', human: 'Choisit parmi les variantes, peut ajuster avant lancement.' },
    3: { ai: 'Produit un plan recommandé avec justification, lance les agents.', human: 'Consulte le plan, peut suspendre ou reconfigurer un agent.' },
    4: { ai: "S'exécute de façon autonome, reroute si un agent échoue.", human: 'Surveille les KPIs, approuve les décisions critiques.' },
    5: { ai: 'Gestion complète du workflow. Auto-retry. Log de toutes les décisions.', human: 'Consulte le résumé final, audite le log.' },
  },
  retrieval: {
    1: { ai: 'Attend une requête structurée, exécute la recherche.', human: 'Formule la requête, sélectionne les sources, lance manuellement.' },
    2: { ai: 'Propose 3–5 requêtes candidates avec sources et rationale.', human: 'Sélectionne ou modifie une requête, valide avant exécution.' },
    3: { ai: 'Exécute les recherches, retourne les résultats classés par pertinence.', human: 'Filtre les résultats, exclut les sources non pertinentes.' },
    4: { ai: 'Recherche, sélectionne et synthétise. Produit un contexte structuré.', human: 'Peut exclure une source ou demander un approfondissement.' },
    5: { ai: 'Recherche et mise à jour du contexte en continu. Alerte si données contradictoires.', human: 'Voit un résumé, reçoit une alerte si contradiction détectée.' },
  },
  generation: {
    1: { ai: 'Attend les paramètres complets (F, S, nombre de concepts, contraintes DFx).', human: 'Définit tous les paramètres, lance la génération manuellement.' },
    2: { ai: 'Propose une configuration de génération (nb concepts, axes de variation).', human: 'Ajuste la configuration proposée, valide avant génération.' },
    3: { ai: 'Génère N concepts avec FBS et DFx préliminaire. Présente sans recommandation.', human: 'Étudie les concepts, peut demander des variantes supplémentaires.' },
    4: { ai: 'Génère et classe les concepts par score DFx composite. Recommande le meilleur.', human: 'Examine la recommandation, peut overrider le choix.' },
    5: { ai: 'Génère, classe et sélectionne automatiquement. Notifie le résultat.', human: 'Voit le concept sélectionné et son justificatif, peut rouvrir.' },
  },
  simulation: {
    1: { ai: 'Attend les paramètres de simulation (solveur, maillage, conditions aux limites).', human: 'Configure manuellement tous les paramètres, lance le calcul.' },
    2: { ai: 'Propose une configuration de simulation avec justification.', human: 'Révise la configuration proposée, approuve le lancement.' },
    3: { ai: 'Exécute la simulation, produit Bs, compare Bs vs Be, présente l\'écart.', human: 'Interprète les résultats, décide si l\'écart est acceptable.' },
    4: { ai: 'Exécute, compare Bs/Be, recommande redesign si écart > seuil.', human: 'Approuve ou rejette la recommandation de redesign, peut modifier le seuil.' },
    5: { ai: 'Boucle complète : simulation → comparaison → redesign → resimulation si besoin.', human: 'Surveille la convergence, reçoit le résultat final validé.' },
  },
  dfx: {
    1: { ai: 'Attend les données produit pour calculer les scores DFx.', human: 'Fournit les données, lance le scoring manuellement.' },
    2: { ai: 'Propose les formules DFx applicables selon le type de produit.', human: 'Valide les formules et les paramètres avant calcul.' },
    3: { ai: 'Calcule les 5 scores DFx, présente les justifications.', human: 'Revoit les scores, peut ajuster les pondérations.' },
    4: { ai: 'Calcule, justifie et recommande le meilleur concept.', human: 'Approuve la recommandation ou overrides.' },
    5: { ai: 'Scoring continu, alerte si un score passe sous le seuil critique.', human: 'Surveille les KPIs DFx, audite les justifications.' },
  },
  documentation: {
    1: { ai: 'Attend que l\'humain fournisse les données à documenter.', human: 'Saisit toutes les informations manuellement, valide chaque entrée.' },
    2: { ai: 'Capture automatiquement les sorties des agents, propose des entrées de thread.', human: 'Valide ou corrige chaque entrée avant archivage dans l\'ADT.' },
    3: { ai: 'Construit le digital thread en continu. Propose des résumés de phase.', human: 'Revoit les résumés, peut ajouter des annotations manuelles.' },
    4: { ai: 'Gère l\'ADT de façon autonome, produit le rapport de gate review.', human: 'Approuve le rapport avant export/archivage, peut ajouter une signature.' },
    5: { ai: 'ADT entièrement automatisé. Versioning, archivage, conformité EU AI Act.', human: 'Consulte l\'ADT à la demande, audite si nécessaire.' },
  },
};

// Agent default ranges from spec
export const AGENT_LEVEL_RANGES: Record<AgentKey, { min: number; max: number; default: number }> = {
  orchestrator:  { min: 2, max: 4, default: 3 },
  retrieval:     { min: 3, max: 5, default: 4 },
  generation:    { min: 1, max: 4, default: 2 },
  simulation:    { min: 2, max: 4, default: 3 },
  dfx:           { min: 2, max: 4, default: 3 },
  documentation: { min: 3, max: 5, default: 4 },
};

// ── 6 Scenarios (S1–S6) ───────────────────────────────────
export const SCENARIOS: Scenario[] = [
  {
    id: 'S1',
    name: 'Aérospatial — Sécurité critique',
    shortName: 'S1 Aérospatial',
    description: 'Pièce structurelle aérospatiale — pas de génération autonome autorisée',
    industry: 'Aéronautique',
    dfxPriorities: { dfm: 2, dfa: 2, dfr: 5, dfc: 1, dfs: 4 },
    agentLevels: { orchestrator: 2, retrieval: 3, generation: 1, simulation: 2, dfx: 2, documentation: 3 },
    globalHITL: 1,
    humanRole: 'Pleine autorité',
    standards: ['EN 9100', 'DO-160'],
    constraints: { max_temp_c: 180, mass_max_kg: 0.5, mtbf_cycles: 500000, cost_target_eur: 2000, wall_min_mm: 3, ra_um: 1.6 },
  },
  {
    id: 'S2',
    name: 'Industriel — Vanne DN100',
    shortName: 'S2 Industriel',
    description: 'Vanne papillon corps — DFx équilibré · Cas de référence',
    industry: 'Industrie',
    dfxPriorities: { dfm: 3, dfa: 2, dfr: 3, dfc: 3, dfs: 2 },
    agentLevels: { orchestrator: 3, retrieval: 4, generation: 2, simulation: 3, dfx: 3, documentation: 4 },
    globalHITL: 3,
    humanRole: 'Décideur',
    standards: ['EN 593', 'EN 12334'],
    constraints: { dn: 100, pn: 16, max_temp_c: 120, min_temp_c: -10, mass_max_kg: 2.8, mtbf_cycles: 50000, cost_target_eur: 85, wall_mm: 7 },
  },
  {
    id: 'S3',
    name: 'Conception durable',
    shortName: 'S3 Durable',
    description: 'Produit consommateur — KPI durabilité pilotes',
    industry: 'Consommation',
    dfxPriorities: { dfm: 3, dfa: 2, dfr: 3, dfc: 2, dfs: 5 },
    agentLevels: { orchestrator: 3, retrieval: 4, generation: 2, simulation: 3, dfx: 3, documentation: 4 },
    globalHITL: 3,
    humanRole: 'Décideur',
    standards: ['ISO 14001', 'ISO 14044'],
    constraints: { recyclability_pct: 80, co2_target_kg: 5, cost_target_eur: 50 },
  },
  {
    id: 'S4',
    name: 'Fast MVP — Startup',
    shortName: 'S4 Fast MVP',
    description: 'Startup hardware — vitesse prime sur exhaustivité',
    industry: 'Startup',
    dfxPriorities: { dfm: 4, dfa: 3, dfr: 2, dfc: 5, dfs: 1 },
    agentLevels: { orchestrator: 4, retrieval: 4, generation: 4, simulation: 4, dfx: 4, documentation: 5 },
    globalHITL: 4,
    humanRole: 'Approbateur',
    standards: ['CE'],
    constraints: { cost_target_eur: 30, time_to_market_weeks: 12 },
  },
  {
    id: 'S5',
    name: 'Haute cadence — Automobile',
    shortName: 'S5 Automobile',
    description: 'Pièce automobile — dominante ligne d\'assemblage',
    industry: 'Automobile',
    dfxPriorities: { dfm: 5, dfa: 5, dfr: 2, dfc: 4, dfs: 2 },
    agentLevels: { orchestrator: 3, retrieval: 3, generation: 3, simulation: 3, dfx: 3, documentation: 4 },
    globalHITL: 3,
    humanRole: 'Décideur',
    standards: ['IATF 16949', 'ISO 9001'],
    constraints: { annual_volume: 50000, cycle_time_s: 45, cost_target_eur: 8 },
  },
  {
    id: 'S6',
    name: 'Custom — Projet libre',
    shortName: 'S6 Custom',
    description: 'Tout produit — liberté totale de configuration',
    industry: 'Custom',
    dfxPriorities: { dfm: 3, dfa: 3, dfr: 3, dfc: 3, dfs: 3 },
    agentLevels: { orchestrator: 3, retrieval: 3, generation: 3, simulation: 3, dfx: 3, documentation: 3 },
    globalHITL: 3,
    humanRole: 'Décideur',
    standards: [],
    constraints: {},
  },
];

// ── DN100 Vanne Papillon — Concepts (Spec §6.4) ───────────
export interface DN100Concept {
  id: string;
  name: string;
  material: string;
  process: string;
  dfm: number; dfa: number; dfr: number;
  dfc: number; // raw score (inverted cost)
  dfs: number;
  cost_eur: number;
  mass_kg?: number;
  weakness: string;
  svgPath: string; // parametric SVG description key
}

export const DN100_CONCEPTS: DN100Concept[] = [
  {
    id: 'A', name: 'Monolithique',
    material: 'AlSi10Mg', process: 'Coulée',
    dfm: 82, dfa: 76, dfr: 78, dfc: 27, dfs: 74,
    cost_eur: 62, weakness: 'Outillage €3 200',
    svgPath: 'monolithic',
  },
  {
    id: 'B', name: 'Boulonné',
    material: 'GGG40', process: 'Coulée',
    dfm: 71, dfa: 85, dfr: 85, dfc: 32, dfs: 79,
    cost_eur: 58, mass_kg: 3.4, weakness: 'Masse 3,4 kg > cible',
    svgPath: 'bolted',
  },
  {
    id: 'C', name: 'Usiné CNC',
    material: 'Al6061', process: 'CNC',
    dfm: 58, dfa: 72, dfr: 91, dfc: 0, dfs: 68,
    cost_eur: 119, weakness: 'Coût €119 >> cible',
    svgPath: 'machined',
  },
  {
    id: 'D', name: 'Hybride',
    material: 'AlSi10Mg + SS', process: 'Hybride',
    dfm: 88, dfa: 68, dfr: 88, dfc: 13, dfs: 62,
    cost_eur: 74, weakness: 'Insert gêne recyclage',
    svgPath: 'hybrid',
  },
];

// ── Composite Score Calculation (Spec §6.3) ───────────────
export function computeCompositeScore(
  concept: Pick<DN100Concept, 'dfm' | 'dfa' | 'dfr' | 'dfc' | 'dfs'>,
  priorities: DfxPriorities
): number {
  const total = priorities.dfm + priorities.dfa + priorities.dfr + priorities.dfc + priorities.dfs;
  if (total === 0) return 0;
  return (
    concept.dfm * (priorities.dfm / total) +
    concept.dfa * (priorities.dfa / total) +
    concept.dfr * (priorities.dfr / total) +
    concept.dfc * (priorities.dfc / total) + // already inverted in spec data
    concept.dfs * (priorities.dfs / total)
  );
}

export function rankConcepts(concepts: DN100Concept[], priorities: DfxPriorities): (DN100Concept & { composite: number; rank: number })[] {
  const scored = concepts.map(c => ({ ...c, composite: computeCompositeScore(c, priorities) }));
  scored.sort((a, b) => b.composite - a.composite);
  return scored.map((c, i) => ({ ...c, rank: i + 1 }));
}

// ── FBS Ontology — DN100 (Spec §9) ───────────────────────
export const DN100_FBS = {
  functions: [
    'Réguler le débit à DN100 / PN16 (16 bar)',
    'Assurer l\'étanchéité siège/tige',
    'Résister aux cycles thermiques −10°C / +120°C',
    'MTBF ≥ 50 000 cycles',
    'Masse ≤ 2,8 kg',
  ],
  behaviourExpected: {
    stress_max_mpa: 120,
    deflection_max_mm: 0.05,
    proof_bar: 24,
  },
  behaviourSimulated: {
    A: { stress_mpa: 108, deflection_mm: 0.043, proof_ok: true },
    B: { stress_mpa: 112, deflection_mm: 0.049, proof_ok: true },
    C: { stress_mpa: 95,  deflection_mm: 0.038, proof_ok: true },
    D: { stress_mpa: 104, deflection_mm: 0.041, proof_ok: true },
  },
};

// ── Feedback Loop Mock Data (Spec §7) ──────────────────────
export const FEEDBACK_LOOP_DATA = {
  mes_units: 47,
  mes_stress_avg_mpa: 114,
  mes_failures: 2,
  bs_predicted_mpa: 108,
  bs_real_mpa: 114,
  deviation_pct: 5.6,
  threshold_pct: 5.0,
  triggered: true,
  redesign_concept: 'A-v2',
  wall_before_mm: 7,
  wall_after_mm: 8,
  dfm_before: 82,
  dfm_after: 79,
};

// ── Glossaire — 22 terms (Spec Annex B) ──────────────────
export interface GlossaryTerm {
  term: string;
  layer: string;
  definition: string;
  example: string;
}

export const GLOSSARY: GlossaryTerm[] = [
  { term: 'APDA', layer: 'Framework', definition: 'Agentic Physical Product Development Architecture — framework 5 couches superposant des agents IA au PDP existant de l\'entreprise.', example: 'DN100 : l\'APDA orchestre les 5 agents DFx en parallèle sur la vanne papillon.' },
  { term: 'ADT', layer: 'Layer 4', definition: 'Agentic Digital Thread — système multi-agents maintenant la continuité sémantique des données produit du brief jusqu\'au feedback terrain.', example: 'DN100 : l\'ADT trace chaque décision HITL depuis la sélection du scénario S2 jusqu\'à la gate review.' },
  { term: 'Digital Thread', layer: 'Layer 4', definition: 'Flux de données structuré continu reliant chaque phase du cycle de vie : brief → concepts → FBS simulation → scoring DFx → approbation gate → boucle feedback → redesign.', example: 'DN100 : le thread contient ≥10 entrées horodatées incluant la boucle feedback de A → A-v2.' },
  { term: 'FBS', layer: 'Layer 4', definition: 'Ontologie Function–Behaviour–Structure — décompose tout problème de conception en F (ce qu\'il doit faire), B (comment il se comporte : Be attendu vs Bs simulé), S (comment il est fabriqué).', example: 'DN100 : F = réguler à PN16, Be = contrainte ≤ 120 MPa, S = AlSi10Mg coulée paroi 7mm.' },
  { term: 'Function (F)', layer: 'Layer 4', definition: 'Les exigences fonctionnelles. Point de départ de la génération. Le Generation Agent fait F→S.', example: 'DN100 : résister à 16 bar, assurer l\'étanchéité, masse ≤ 2,8 kg, MTBF ≥ 50 000 cycles.' },
  { term: 'Behaviour (B)', layer: 'Layer 4', definition: 'Comment le produit se comporte. Be (attendu) vs Bs (simulé). Bs > Be déclenche un redesign.', example: 'DN100 : Be = contrainte ≤ 120 MPa. Bs concept A = 108 MPa — PASS avec marge 10%.' },
  { term: 'Structure (S)', layer: 'Layer 4', definition: 'La réalisation physique : matériau, procédé, géométrie. Output du Generation Agent, input du Simulation Agent.', example: 'DN100 Concept A : AlSi10Mg coulée, paroi 7mm, bride 4×M12, alésage 100mm, longueur 130mm.' },
  { term: 'HITL (par agent)', layer: 'Layer 1', definition: 'Human-In-The-Loop — chaque agent a son propre niveau d\'autonomie (L1–L5), configurable indépendamment.', example: 'S2 : Generation Agent à L2 (humain valide la config), Documentation Agent à L4 (autonome).' },
  { term: 'L1 — Opérateur', layer: 'Layer 1', definition: 'L\'IA est un outil uniquement. L\'humain prend toutes les décisions.', example: 'Appliqué au Generation Agent en S1 (Aérospatial) — pas de génération autonome.' },
  { term: 'L2 — Collaborateur', layer: 'Layer 1', definition: 'L\'humain et l\'IA co-conçoivent. L\'IA suggère, l\'humain valide tout.', example: 'Défaut pour le Generation Agent en S2 — l\'humain valide la config avant génération.' },
  { term: 'L3 — Consultant', layer: 'Layer 1', definition: 'L\'IA produit la majorité de l\'analyse, l\'humain choisit parmi les options classées.', example: 'Défaut pour la plupart des agents en S2 Industriel.' },
  { term: 'L4 — Approbateur', layer: 'Layer 1', definition: 'L\'IA pré-sélectionne, l\'humain approuve ou annule.', example: 'Défaut pour les agents Doc et Retrieval — tâches à faible risque.' },
  { term: 'L5 — Observateur', layer: 'Layer 1', definition: 'L\'IA agit de façon autonome, l\'humain surveille les KPIs.', example: 'Autorisé uniquement pour Doc et Retrieval en S4 Fast MVP.' },
  { term: 'Retrieval Agent', layer: 'Layer 2', definition: 'Interroge toutes les sources d\'information pertinentes via le connecteur générique : PLM, normes, ERP, Digital Twin, base REX, SAV.', example: 'DN100 : récupère EN 593, EN 12334, données MES, AMDEC archivée depuis PLM.' },
  { term: 'Generation Agent', layer: 'Layer 2', definition: 'Fait la correspondance F→S : génère des concepts candidats avec pack de disponibilité DFx pour chacun.', example: 'DN100 : génère les 4 concepts A/B/C/D avec SVG paramétrique et DFx préliminaire.' },
  { term: 'Simulation Agent', layer: 'Layer 2', definition: 'Fait la correspondance S→Bs : calcule le comportement simulé, compare à Be, déclenche la boucle redesign si Bs > Be.', example: 'DN100 Concept A : Bs = 108 MPa < Be = 120 MPa → PASS. Boucle feedback si Bs_réel dévie > 5%.' },
  { term: 'DFx Agents (×5)', layer: 'Layer 2', definition: 'DFM (fabricabilité), DFA (assemblage), DFR (fiabilité), DFC (coût), DFS (durabilité). Exécutés en parallèle.', example: 'DN100 Concept D : DFM=88 (meilleur), DFS=62 (insert gêne recyclage).' },
  { term: 'DFS — Design for Sustainability', layer: 'Layer 2', definition: 'Évalue recyclabilité %, empreinte CO₂, index matériau circulaire, scénario fin de vie.', example: 'DN100 Concept B (GGG40) score le plus élevé à DFS=79/100.' },
  { term: 'Connecteur générique', layer: 'Layer 3', definition: 'Interface standardisée abstrayant tout système externe (PLM, ERP, CAD, AMDEC…). Dans la démo : simulé avec payload JSON visible.', example: 'DN100 : connecteur PLM lit les AMDEC archivées, connecteur MES remonte Bs_réel = 114 MPa.' },
  { term: 'Boucle de feedback', layer: 'Layer 2', definition: 'Données MES/IoT → réévaluation Simulation Agent → déclenchement redesign → nouvelle itération concept.', example: 'DN100 : Bs_réel = 114 MPa vs Bs_prédit = 108 MPa → +5,6% → Concept A-v2 (paroi 8mm).' },
  { term: 'Orchestrator', layer: 'Layer 2', definition: 'Planifie les séquences de tâches, route les sous-tâches aux agents, applique les niveaux HITL par agent.', example: 'DN100 S2 à L3 : lance les 5 agents DFx en parallèle, surveille la convergence Bs/Be.' },
  { term: 'Score DFx composite', layer: 'Layer 2', definition: 'Somme pondérée des scores DFM, DFA, DFR, DFC, DFS en utilisant les priorités du brief produit.', example: 'S2 équilibré : Concept A gagne avec composite ≈ 74 sur 100 (tous critères équilibrés).' },
];
