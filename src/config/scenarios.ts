// 6 preconfigured scenarios + the 4 DN100 concepts (DATA path).
//
// IMPORTANT — see docs/SPEC_RECONCILIATION.md. The original docs/05 score table and
// its "verified rankings" table were mutually contradictory and the DFC column
// violated the mandatory cost inversion. This dataset is the corrected, cost-consistent
// version. Stored scores are authoritative for the DN100 demo; the engine formulas
// (src/engine/dfxScoring.ts) are used for S6/custom briefs.
//
// Verified winners of THIS dataset (asserted by tests):
//   S1 -> C   S2 -> A   S3 -> B   S4 -> A   S5 -> D

import type { Scenario, ScenarioId, Concept, AgentLevels, HITLLevel } from '@/types';

// ---------- shared DN100 FBS function requirements ----------
const DN100_FUNCTION = [
  'Réguler le débit à DN100 / PN16 (16 bar)',
  "Assurer l'étanchéité (siège élastomère)",
  'Résister aux cycles thermiques −10 °C / +120 °C',
  'MTBF ≥ 50 000 cycles',
  'Masse ≤ 2,8 kg',
];

const DN100_BE = { stress_max_MPa: 120, deflection_max_mm: 0.05, proof_ok: true };

// ============================================================
//  DN100 CONCEPTS A–D  (cost-correct DFC; see reconciliation doc)
// ============================================================
export const dn100Concepts: Concept[] = [
  {
    id: 'A',
    name: 'A — Monolithique',
    materialProcess: 'AlSi10Mg / Coulée',
    scores: { dfm: 85, dfa: 73, dfr: 80, dfc: 48, dfs: 71 },
    cost_eur: 62,
    mass_kg: 2.6,
    weakness: 'Outillage de coulée €3 200',
    fbs: {
      function: { requirements: DN100_FUNCTION },
      behaviour: {
        expected: DN100_BE,
        simulated: { stress_max_MPa: 108, deflection_max_mm: 0.04, proof_ok: true },
      },
      structure: {
        material: 'AlSi10Mg (coulée)',
        process: 'casting',
        wall_mm: 7,
        flanges: '4 × M12',
        bore_mm: 100,
        length_mm: 130,
      },
    },
  },
  {
    id: 'B',
    name: 'B — Boulonné',
    materialProcess: 'GGG40 / Coulée',
    scores: { dfm: 68, dfa: 82, dfr: 75, dfc: 51, dfs: 84 },
    cost_eur: 58,
    mass_kg: 3.4,
    weakness: 'Masse 3,4 kg > cible 2,8 kg',
    fbs: {
      function: { requirements: DN100_FUNCTION },
      behaviour: {
        expected: DN100_BE,
        simulated: { stress_max_MPa: 112, deflection_max_mm: 0.045, proof_ok: true },
      },
      structure: {
        material: 'Fonte GGG40',
        process: 'casting',
        wall_mm: 8,
        flanges: '4 × M12 (boulonné)',
        bore_mm: 100,
        length_mm: 132,
      },
    },
  },
  {
    id: 'C',
    name: 'C — Usiné CNC',
    materialProcess: 'Al6061 / CNC',
    scores: { dfm: 60, dfa: 78, dfr: 96, dfc: 0, dfs: 79 },
    cost_eur: 119,
    mass_kg: 2.4,
    weakness: 'Coût €119 ≫ cible',
    fbs: {
      function: { requirements: DN100_FUNCTION },
      behaviour: {
        expected: DN100_BE,
        simulated: { stress_max_MPa: 96, deflection_max_mm: 0.03, proof_ok: true },
      },
      structure: {
        material: 'Al6061-T6 (mono-matériau)',
        process: 'cnc',
        wall_mm: 6,
        flanges: '4 × M12',
        bore_mm: 100,
        length_mm: 130,
      },
    },
  },
  {
    id: 'D',
    name: 'D — Hybride',
    materialProcess: 'AlSi10Mg + insert inox',
    scores: { dfm: 94, dfa: 82, dfr: 79, dfc: 38, dfs: 53 },
    cost_eur: 74,
    mass_kg: 2.7,
    weakness: "L'insert inox gêne le recyclage",
    fbs: {
      function: { requirements: DN100_FUNCTION },
      behaviour: {
        expected: DN100_BE,
        simulated: { stress_max_MPa: 104, deflection_max_mm: 0.038, proof_ok: true },
      },
      structure: {
        material: 'AlSi10Mg + insert acier inox',
        process: 'hybrid',
        wall_mm: 6.5,
        flanges: '4 × M12',
        bore_mm: 100,
        length_mm: 130,
      },
    },
  },
];

// ============================================================
//  SCENARIOS
// ============================================================
// global agent defaults (overridable per scenario)
const DEFAULT_LEVELS: AgentLevels = {
  orchestrator: 3,
  retrieval: 4,
  generation: 2,
  simulation: 3,
  dfx: 3,
  doc: 4,
};

const lvl = (over: Partial<AgentLevels>): AgentLevels => ({ ...DEFAULT_LEVELS, ...over });

export const scenarios: Record<ScenarioId, Scenario> = {
  S1: {
    id: 'S1',
    name: 'Aérospatial / Sécurité critique',
    icon: 'aerospace',
    description: 'Pièce structurelle aérospatiale — pas de génération autonome autorisée',
    dfxPriorities: { dfm: 2, dfa: 2, dfr: 5, dfc: 1, dfs: 4 },
    agentLevels: lvl({ orchestrator: 2, retrieval: 3, generation: 1, simulation: 2, dfx: 2, doc: 3 }),
    globalHITL: 1,
    humanRole: 'Pleine autorité',
    productBrief: {
      name: 'Ferrure structurelle AE-100',
      function: 'Ferrure porteuse structure primaire, grade aérospatial',
      constraints: {
        temp_max_C: 180,
        temp_min_C: -55,
        mass_max_kg: 0.5,
        mtbf_cycles: 500000,
        cost_target_eur: 2000,
        wall_min_mm: 3,
        ra_um: 1.6,
      },
      standards: ['EN 9100', 'DO-160'],
      behaviourExpected: { stress_max_MPa: 200, deflection_max_mm: 0.02, proof_ok: true },
    },
  },

  S2: {
    id: 'S2',
    name: 'Industriel défaut (DN100)',
    icon: 'industrial',
    description: 'Corps de vanne papillon DN100 — DFx équilibrés. Sélection par défaut.',
    dfxPriorities: { dfm: 3, dfa: 2, dfr: 3, dfc: 3, dfs: 2 },
    agentLevels: lvl({ generation: 2, simulation: 3, dfx: 3, doc: 4 }),
    globalHITL: 3,
    humanRole: 'Consultant',
    productBrief: {
      name: 'Corps de vanne papillon DN100',
      function: "Réguler le débit DN100/PN16, assurer l'étanchéité, résister aux cycles thermiques",
      constraints: {
        temp_max_C: 120,
        temp_min_C: -10,
        mass_max_kg: 2.8,
        mtbf_cycles: 50000,
        cost_target_eur: 70,
        wall_min_mm: 6,
        ra_um: 3.2,
        pressure_bar: 16,
      },
      standards: ['EN 593', 'EN 12334'],
      behaviourExpected: { stress_max_MPa: 120, deflection_max_mm: 0.05, proof_ok: true },
    },
  },

  S3: {
    id: 'S3',
    name: 'Conception durable',
    icon: 'sustainable',
    description: 'Produit grand public — les KPI de durabilité priment',
    dfxPriorities: { dfm: 3, dfa: 2, dfr: 3, dfc: 2, dfs: 5 },
    agentLevels: lvl({ generation: 2, simulation: 3, dfx: 3, doc: 4 }),
    globalHITL: 3,
    humanRole: 'Consultant',
    productBrief: {
      name: 'Boîtier produit éco-conçu',
      function: "Protéger l'électronique, maximiser recyclabilité et réparabilité",
      constraints: {
        temp_max_C: 70,
        temp_min_C: -20,
        mass_max_kg: 1.2,
        mtbf_cycles: 80000,
        cost_target_eur: 45,
        wall_min_mm: 2.5,
        ra_um: 6.3,
      },
      standards: ['ISO 14021', 'EN 45555'],
      behaviourExpected: { stress_max_MPa: 90, deflection_max_mm: 0.08, proof_ok: true },
    },
  },

  S4: {
    id: 'S4',
    name: 'Fast MVP (startup)',
    icon: 'startup',
    description: 'Startup hardware — rapidité avant exhaustivité',
    dfxPriorities: { dfm: 4, dfa: 3, dfr: 2, dfc: 5, dfs: 1 },
    agentLevels: lvl({ generation: 4, simulation: 4, dfx: 4, doc: 5 }),
    globalHITL: 4,
    humanRole: 'Approbateur',
    productBrief: {
      name: 'Support capteur MVP-01',
      function: 'Maintenir un module capteur, itération rapide, coût minimal',
      constraints: {
        temp_max_C: 60,
        temp_min_C: 0,
        mass_max_kg: 0.8,
        mtbf_cycles: 20000,
        cost_target_eur: 25,
        wall_min_mm: 2,
        ra_um: 12.5,
      },
      standards: ['CE'],
      behaviourExpected: { stress_max_MPa: 80, deflection_max_mm: 0.1, proof_ok: true },
    },
  },

  S5: {
    id: 'S5',
    name: 'Haute cadence',
    icon: 'automotive',
    description: 'Pièce automobile — la ligne de montage domine',
    dfxPriorities: { dfm: 5, dfa: 5, dfr: 2, dfc: 4, dfs: 2 },
    agentLevels: lvl({ generation: 3, simulation: 3, dfx: 3, doc: 4 }),
    globalHITL: 3,
    humanRole: 'Consultant',
    productBrief: {
      name: 'Étrier automobile HC-200',
      function: 'Pièce de liaison haute cadence, optimisée assemblage automatisé',
      constraints: {
        temp_max_C: 110,
        temp_min_C: -30,
        mass_max_kg: 1.5,
        mtbf_cycles: 300000,
        cost_target_eur: 18,
        wall_min_mm: 4,
        ra_um: 6.3,
      },
      standards: ['IATF 16949'],
      behaviourExpected: { stress_max_MPa: 150, deflection_max_mm: 0.03, proof_ok: true },
    },
  },

  S6: {
    id: 'S6',
    name: 'Custom',
    icon: 'custom',
    description: 'Tout produit — liberté totale',
    dfxPriorities: { dfm: 3, dfa: 3, dfr: 3, dfc: 3, dfs: 3 },
    agentLevels: lvl({ generation: 3 }),
    globalHITL: 3,
    humanRole: 'Consultant',
    productBrief: {
      name: '',
      function: '',
      constraints: {
        temp_max_C: 0,
        temp_min_C: 0,
        mass_max_kg: 0,
        mtbf_cycles: 0,
        cost_target_eur: 0,
        wall_min_mm: 0,
        ra_um: 0,
      },
      standards: [],
      behaviourExpected: { stress_max_MPa: 0, deflection_max_mm: 0, proof_ok: true },
    },
  },
};

export const scenarioList: Scenario[] = [
  scenarios.S1,
  scenarios.S2,
  scenarios.S3,
  scenarios.S4,
  scenarios.S5,
  scenarios.S6,
];

// role title per global HITL level (E6 mapping)
export const ROLE_BY_LEVEL: Record<HITLLevel, string> = {
  1: 'Opérateur',
  2: 'Collaborateur',
  3: 'Consultant',
  4: 'Approbateur',
  5: 'Observateur',
};

// industry presets for DFx sliders (docs/02)
export const INDUSTRY_PRESETS: { key: string; label: string; dfx: Record<string, number> }[] = [
  { key: 'aero', label: 'Aérospatial (sécurité critique)', dfx: { dfm: 2, dfa: 2, dfr: 5, dfc: 1, dfs: 4 } },
  { key: 'auto', label: 'Automobile (haute cadence)', dfx: { dfm: 5, dfa: 5, dfr: 2, dfc: 4, dfs: 2 } },
  { key: 'consumer', label: 'Biens de consommation', dfx: { dfm: 3, dfa: 3, dfr: 2, dfc: 4, dfs: 4 } },
  { key: 'medical', label: 'Médical (dispositifs)', dfx: { dfm: 2, dfa: 2, dfr: 5, dfc: 2, dfs: 3 } },
  { key: 'energy', label: 'Énergie / Industrie', dfx: { dfm: 3, dfa: 2, dfr: 3, dfc: 3, dfs: 2 } },
  { key: 'custom', label: 'Autre / Custom', dfx: { dfm: 3, dfa: 3, dfr: 3, dfc: 3, dfs: 3 } },
];

/** Build a full ProductBrief (with priorities + agent levels) from a scenario. */
export function briefFromScenario(s: Scenario) {
  return {
    ...structuredClone(s.productBrief),
    dfxPriorities: { ...s.dfxPriorities },
    agentLevels: { ...s.agentLevels },
  };
}
