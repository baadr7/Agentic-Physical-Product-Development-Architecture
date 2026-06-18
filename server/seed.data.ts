// Seed payloads — self-contained copies of the frontend reference data
// (src/config/scenarios.ts, src/config/connectorFixtures.ts) so the backend can be
// seeded without importing browser code. Keep roughly in sync with those files.

export interface SeedScenario {
  id: string;
  name: string;
  icon: string;
  description: string;
  dfx_priorities: Record<string, number>;
  agent_levels: Record<string, number>;
  global_hitl: number;
  human_role: string;
  product_brief: unknown;
}

// Scenario templates are no longer hardcoded here — they live as files in
// server/data/scenarios/*.json and are read by server/scenarioFiles.ts
// (loadScenarios), then seeded into the scenarios table and the RAG knowledge base.

// DN100 concepts (the S2 reference set). scores are deterministic / authoritative.
const DN100_FUNCTION = [
  'Réguler le débit à DN100 / PN16 (16 bar)',
  "Assurer l'étanchéité (siège élastomère)",
  'Résister aux cycles thermiques −10 °C / +120 °C',
  'MTBF ≥ 50 000 cycles',
  'Masse ≤ 2,8 kg',
];
const DN100_BE = { stress_max_MPa: 120, deflection_max_mm: 0.05, proof_ok: true };

export interface SeedConcept {
  code: string;
  name: string;
  material_process: string;
  scores: Record<string, number>;
  cost_eur: number;
  mass_kg: number;
  weakness: string;
  fbs: unknown;
}

export const dn100Concepts: SeedConcept[] = [
  {
    code: 'A', name: 'A — Monolithique', material_process: 'AlSi10Mg / Coulée',
    scores: { dfm: 85, dfa: 73, dfr: 80, dfc: 48, dfs: 71 }, cost_eur: 62, mass_kg: 2.6,
    weakness: 'Outillage de coulée €3 200',
    fbs: { function: { requirements: DN100_FUNCTION }, behaviour: { expected: DN100_BE, simulated: { stress_max_MPa: 108, deflection_max_mm: 0.04, proof_ok: true } }, structure: { material: 'AlSi10Mg (coulée)', process: 'casting', wall_mm: 7, flanges: '4 × M12', bore_mm: 100, length_mm: 130 } },
  },
  {
    code: 'B', name: 'B — Boulonné', material_process: 'GGG40 / Coulée',
    scores: { dfm: 68, dfa: 82, dfr: 75, dfc: 51, dfs: 84 }, cost_eur: 58, mass_kg: 3.4,
    weakness: 'Masse 3,4 kg > cible 2,8 kg',
    fbs: { function: { requirements: DN100_FUNCTION }, behaviour: { expected: DN100_BE, simulated: { stress_max_MPa: 112, deflection_max_mm: 0.045, proof_ok: true } }, structure: { material: 'Fonte GGG40', process: 'casting', wall_mm: 8, flanges: '4 × M12 (boulonné)', bore_mm: 100, length_mm: 132 } },
  },
  {
    code: 'C', name: 'C — Usiné CNC', material_process: 'Al6061 / CNC',
    scores: { dfm: 60, dfa: 78, dfr: 96, dfc: 0, dfs: 79 }, cost_eur: 119, mass_kg: 2.4,
    weakness: 'Coût €119 ≫ cible',
    fbs: { function: { requirements: DN100_FUNCTION }, behaviour: { expected: DN100_BE, simulated: { stress_max_MPa: 96, deflection_max_mm: 0.03, proof_ok: true } }, structure: { material: 'Al6061-T6 (mono-matériau)', process: 'cnc', wall_mm: 6, flanges: '4 × M12', bore_mm: 100, length_mm: 130 } },
  },
  {
    code: 'D', name: 'D — Hybride', material_process: 'AlSi10Mg + insert inox',
    scores: { dfm: 94, dfa: 82, dfr: 79, dfc: 38, dfs: 53 }, cost_eur: 74, mass_kg: 2.7,
    weakness: "L'insert inox gêne le recyclage",
    fbs: { function: { requirements: DN100_FUNCTION }, behaviour: { expected: DN100_BE, simulated: { stress_max_MPa: 104, deflection_max_mm: 0.038, proof_ok: true } }, structure: { material: 'AlSi10Mg + insert acier inox', process: 'hybrid', wall_mm: 6.5, flanges: '4 × M12', bore_mm: 100, length_mm: 130 } },
  },
];

// RAG knowledge corpus — derived from the simulated Layer 3 connectors. `body` is
// the natural-language text used for retrieval; `metadata.data` keeps the
// structured records used to extract custom-field values.
export interface SeedDoc {
  connector: string;
  source: string;
  title: string;
  body: string;
  metadata: unknown;
  confidence: number;
  daysAgo: number;
}

export const knowledgeCorpus: SeedDoc[] = [
  {
    connector: 'STD', source: 'Base normes interne (simulé)', title: 'Normes applicables — vannes papillon & robinetterie',
    body: 'Normes en vigueur pour les vannes papillon métalliques et la robinetterie : EN 593 (vannes papillon métalliques, 2017+A1:2018) et EN 12334 (robinetterie, clapets en fonte, 2001+A1:2004). Statut en vigueur.',
    metadata: { data: [
      { code: 'EN 593', titre: 'Vannes papillon métalliques', version: '2017+A1:2018', statut: 'en vigueur' },
      { code: 'EN 12334', titre: 'Robinetterie — clapets en fonte', version: '2001+A1:2004', statut: 'en vigueur' },
    ] }, confidence: 0.99, daysAgo: 7,
  },
  {
    connector: 'ERP', source: 'SAP S/4HANA (simulé)', title: 'Matériaux qualifiés — coûts, fournisseurs, délais',
    body: 'Matériaux qualifiés et disponibles : AlSi10Mg (AluCast SA, 4,2 €/kg, délai 18 j), GGG40 fonte (FonderiePro, 1,9 €/kg, délai 25 j), Al6061-T6 (MetalStock, 6,8 €/kg, délai 9 j). Coût matière, fournisseur et délai d’approvisionnement (lead time).',
    metadata: { data: [
      { material: 'AlSi10Mg', supplier: 'AluCast SA', lead_time_d: 18, cost_kg_eur: 4.2, qualified: true },
      { material: 'GGG40', supplier: 'FonderiePro', lead_time_d: 25, cost_kg_eur: 1.9, qualified: true },
      { material: 'Al6061-T6', supplier: 'MetalStock', lead_time_d: 9, cost_kg_eur: 6.8, qualified: true },
    ] }, confidence: 0.82, daysAgo: 3,
  },
  {
    connector: 'DT', source: 'Digital Twin DN100 (simulé)', title: 'Données opérationnelles — parc en service',
    body: 'Parc en service de 47 unités. Contrainte moyenne mesurée 114 MPa, supérieure à la prédiction de simulation (108 MPa). Cycles moyens 38 000, température ambiante 46 °C.',
    metadata: { data: [
      { unit_count: 47, mean_stress_MPa: 114, cycles_mean: 38000, ambient_C: 46 },
      { note: 'Contrainte moyenne mesurée supérieure à la prédiction (108 MPa)' },
    ] }, confidence: 0.74, daysAgo: 1,
  },
  {
    connector: 'MES', source: 'MES ligne 4 / capteurs IoT (simulé)', title: 'Capteurs ligne — contrainte et étanchéité',
    body: 'Capteurs IoT ligne 4 : 47 unités, contrainte moyenne 114 MPa, 2 défaillances d’étanchéité (siège), temps de cycle 41 s.',
    metadata: { data: [{ units: 47, mean_stress_MPa: 114, seal_failures: 2, cycle_time_s: 41 }] },
    confidence: 0.8, daysAgo: 0,
  },
  {
    connector: 'PLM', source: 'Windchill 12.1 (simulé)', title: 'Projets antérieurs — vannes DN80/DN100',
    body: 'Projets antérieurs : VP-DN80-2019 (vanne papillon DN80 PN16, AlSi10Mg, MTBF réel 61 000), VP-DN100-2021 (corps DN100, révision joints, GGG40, AMDEC archivée).',
    metadata: { data: [
      { ref: 'VP-DN80-2019', desc: 'Vanne papillon DN80 PN16', material: 'AlSi10Mg', mtbf_real: 61000 },
      { ref: 'VP-DN100-2021', desc: 'Corps DN100, révision joints', material: 'GGG40', amdec_archived: true },
    ] }, confidence: 0.88, daysAgo: 42,
  },
  {
    connector: 'PLM', source: 'Base REX ingénierie (simulé)', title: 'Retour d’expérience — épaisseur de paroi',
    body: 'Retour d’expérience ingénierie : privilégier une paroi ≥ 8 mm si la contrainte réelle en service dépasse 110 MPa, afin de préserver la marge de tenue mécanique.',
    metadata: { rule: 'wall_min_mm>=8 if real_stress>110', data: [{ note: 'paroi ≥ 8 mm si contrainte réelle > 110 MPa' }] },
    confidence: 0.7, daysAgo: 15,
  },
  {
    connector: 'SAV', source: 'ERP/SAV (simulé)', title: 'Retours SAV — défaillances terrain',
    body: 'Retours SAV : code défaut JNT-07, fuite du siège élastomère, 2 occurrences, MTBF terrain 47 000 cycles (sous la cible 50 000).',
    metadata: { data: [{ failure_code: 'JNT-07', desc: 'Fuite siège élastomère', occurrences: 2, mtbf_field: 47000 }] },
    confidence: 0.77, daysAgo: 5,
  },
  {
    connector: 'CAD', source: 'CAD / PDM (simulé)', title: 'Géométrie de référence DN100',
    body: 'Modèle CAD DN100_body_rev_C : alésage (bore) 100 mm, longueur 130 mm, brides 4×M12.',
    metadata: { data: [{ model: 'DN100_body_rev_C', bore_mm: 100, length_mm: 130, flanges: '4×M12' }] },
    confidence: 0.9, daysAgo: 2,
  },
  {
    connector: 'AMDEC', source: 'APIS IQ (simulé)', title: 'AMDEC archivée DN100',
    body: 'AMDEC-DN100-2021 archivée : RPN max 96. Le calcul RPN est hors périmètre APDA (référence documentaire).',
    metadata: { data: [{ ref: 'AMDEC-DN100-2021', rpn_max: 96, note: 'Archivé — calcul RPN hors périmètre APDA' }] },
    confidence: 0.85, daysAgo: 60,
  },
];
