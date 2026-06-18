// Simulated Layer 3 connector payloads (docs/06). Coherent, fictional data with
// plausible source names + ISO timestamps. Every datum displays a "Simulé" badge.

import type { ConnectorResponse } from '@/types';

export type ConnectorId = 'PLM' | 'STD' | 'CAD' | 'MES' | 'ERP' | 'DT' | 'SAV' | 'AMDEC';

const ISO = (daysAgo: number) =>
  new Date(Date.now() - daysAgo * 86400000).toISOString();

export const connectorFixtures: Record<string, ConnectorResponse> = {
  plm_past_projects: {
    source: 'Windchill 12.1 (simulé)',
    timestamp: ISO(42),
    confidence: 0.88,
    data: [
      { ref: 'VP-DN80-2019', desc: 'Vanne papillon DN80 PN16', material: 'AlSi10Mg', mtbf_real: 61000 },
      { ref: 'VP-DN100-2021', desc: 'Corps DN100, révision joints', material: 'GGG40', amdec_archived: true },
    ],
  },
  std_norms: {
    source: 'Base normes interne (simulé)',
    timestamp: ISO(7),
    confidence: 0.99,
    data: [
      { code: 'EN 593', titre: 'Vannes papillon métalliques', version: '2017+A1:2018', statut: 'en vigueur' },
      { code: 'EN 12334', titre: 'Robinetterie — clapets en fonte', version: '2001+A1:2004', statut: 'en vigueur' },
    ],
  },
  erp_materials: {
    source: 'SAP S/4HANA (simulé)',
    timestamp: ISO(3),
    confidence: 0.82,
    data: [
      { material: 'AlSi10Mg', supplier: 'AluCast SA', lead_time_d: 18, cost_kg_eur: 4.2, qualified: true },
      { material: 'GGG40', supplier: 'FonderiePro', lead_time_d: 25, cost_kg_eur: 1.9, qualified: true },
      { material: 'Al6061-T6', supplier: 'MetalStock', lead_time_d: 9, cost_kg_eur: 6.8, qualified: true },
    ],
  },
  dt_operational: {
    source: 'Digital Twin DN100 (simulé)',
    timestamp: ISO(1),
    confidence: 0.74,
    data: [
      { unit_count: 47, mean_stress_MPa: 114, cycles_mean: 38000, ambient_C: 46 },
      { note: 'Contrainte moyenne mesurée supérieure à la prédiction (108 MPa)' },
    ],
  },
  mes_sensors: {
    source: 'MES ligne 4 / capteurs IoT (simulé)',
    timestamp: ISO(0),
    confidence: 0.8,
    data: [
      { units: 47, mean_stress_MPa: 114, seal_failures: 2, cycle_time_s: 41 },
    ],
  },
  rex_base: {
    source: 'Base REX ingénierie (simulé)',
    timestamp: ISO(15),
    confidence: 0.7,
    data: [
      { note: 'Retour d’expérience : privilégier paroi ≥ 8 mm si contrainte réelle > 110 MPa.' },
    ],
  },
  sav_returns: {
    source: 'ERP/SAV (simulé)',
    timestamp: ISO(5),
    confidence: 0.77,
    data: [
      { failure_code: 'JNT-07', desc: 'Fuite siège élastomère', occurrences: 2, mtbf_field: 47000 },
    ],
  },
  cad_geometry: {
    source: 'CAD / PDM (simulé)',
    timestamp: ISO(2),
    confidence: 0.9,
    data: [{ model: 'DN100_body_rev_C', bore_mm: 100, length_mm: 130, flanges: '4×M12' }],
  },
  amdec_archived: {
    source: 'APIS IQ (simulé)',
    timestamp: ISO(60),
    confidence: 0.85,
    data: [{ ref: 'AMDEC-DN100-2021', rpn_max: 96, note: 'Archivé — calcul RPN hors périmètre APDA' }],
  },
};

// Which fixtures each agent surfaces.
export const AGENT_SOURCES: Record<string, { key: keyof typeof connectorFixtures; connector: ConnectorId }[]> = {
  retrieval: [
    { key: 'plm_past_projects', connector: 'PLM' },
    { key: 'std_norms', connector: 'STD' },
    { key: 'erp_materials', connector: 'ERP' },
    { key: 'dt_operational', connector: 'DT' },
    { key: 'rex_base', connector: 'PLM' },
    { key: 'sav_returns', connector: 'SAV' },
  ],
  generation: [
    { key: 'erp_materials', connector: 'ERP' },
    { key: 'cad_geometry', connector: 'CAD' },
  ],
  simulation: [
    { key: 'cad_geometry', connector: 'CAD' },
    { key: 'dt_operational', connector: 'DT' },
    { key: 'mes_sensors', connector: 'MES' },
  ],
  doc: [
    { key: 'amdec_archived', connector: 'AMDEC' },
    { key: 'plm_past_projects', connector: 'PLM' },
  ],
};
