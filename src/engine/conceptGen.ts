// Brief-driven concept generation (E3 Generation agent).
//
// Produces a family of 4 manufacturing-archetype concepts derived from the ACTIVE
// product brief: material, process, geometry, cost, mass and the 5 DFx scores all
// follow the brief's constraints and priorities. This replaces the old behaviour
// where every scenario emitted the fixed DN100 valve set regardless of input.
//
// Scenario S2 still returns the curated DN100 dataset verbatim — it is the
// authoritative, RAG-backed valve demo whose rankings the tests assert and whose
// numbers drive the A→A-v2 feedback-loop narrative.

import type { Concept, ProductBrief, ScenarioKey } from '@/types';
import { scoreConcept, type ConceptParams } from './dfxScoring';
import { dn100Concepts } from '@/config/scenarios';

type Process = 'casting' | 'cnc' | 'hybrid';

const round1 = (x: number) => Math.round(x * 10) / 10;
const round3 = (x: number) => Math.round(x * 1000) / 1000;

// Fill missing/zero constraints with sane engineering defaults so an empty custom
// brief still yields meaningful, non-NaN scores. Negative temps are preserved.
function sane(brief: ProductBrief): ProductBrief {
  const c = brief.constraints;
  const pos = (v: number | undefined, d: number) => (v && v > 0 ? v : d);
  const be = brief.behaviourExpected;
  return {
    ...brief,
    constraints: {
      ...c,
      temp_max_C: c.temp_max_C || 80,
      temp_min_C: c.temp_min_C ?? 0,
      mass_max_kg: pos(c.mass_max_kg, 2),
      mtbf_cycles: pos(c.mtbf_cycles, 50_000),
      cost_target_eur: pos(c.cost_target_eur, 100),
      wall_min_mm: pos(c.wall_min_mm, 3),
      ra_um: pos(c.ra_um, 3.2),
      pressure_bar: c.pressure_bar,
    },
    behaviourExpected: {
      stress_max_MPa: pos(be?.stress_max_MPa, 120),
      deflection_max_mm: pos(be?.deflection_max_mm, 0.05),
      proof_ok: true,
    },
  };
}

// Material family per archetype, shifted by the brief's temperature envelope.
function materialFor(id: string, brief: ProductBrief): string {
  const t = brief.constraints.temp_max_C;
  const hot = t >= 150;
  const warm = t >= 100;
  switch (id) {
    case 'A':
      return hot ? 'Acier inox 316L' : warm ? 'Fonte GGG40' : 'AlSi10Mg';
    case 'B':
      return hot ? 'Acier moulé 1.4408' : warm ? 'Fonte GGG40' : 'AlSi10Mg';
    case 'C':
      return hot ? 'Ti-6Al-4V' : warm ? 'Acier 17-4PH' : 'Al6061-T6';
    default:
      return hot ? 'Acier inox + insert céramique' : warm ? 'Fonte + insert acier' : 'AlSi10Mg + insert inox';
  }
}

interface Arche {
  id: 'A' | 'B' | 'C' | 'D';
  name: string;
  process: Process;
  procFr: string;
  wallDelta: number;
  costFactor: number;
  massFactor: number;
  mtbfFactor: number;
  safety: number;
  stressFactor: number;
  deflFactor: number;
  recy: number;
  mono: boolean;
  co2Factor: number;
  circular: number;
  nFeatures: number;
  nParts: number;
  nFasteners: number;
  autoCompatible: boolean;
}

// Four strategies that apply to almost any mechanical part: a cheap cast
// monolith, a serviceable bolted assembly, a precise (costly) CNC part, and a
// high-DFM hybrid that sacrifices recyclability.
const ARCHES: Arche[] = [
  { id: 'A', name: 'A — Monolithique', process: 'casting', procFr: 'Coulée', wallDelta: 1, costFactor: 0.6, massFactor: 0.93, mtbfFactor: 0.7, safety: 1.1, stressFactor: 0.9, deflFactor: 0.85, recy: 75, mono: true, co2Factor: 1.5, circular: 50, nFeatures: 6, nParts: 3, nFasteners: 8, autoCompatible: false },
  { id: 'B', name: 'B — Assemblé boulonné', process: 'casting', procFr: 'Coulée (boulonné)', wallDelta: 2, costFactor: 0.58, massFactor: 1.12, mtbfFactor: 0.65, safety: 0.9, stressFactor: 0.93, deflFactor: 0.9, recy: 95, mono: true, co2Factor: 1.2, circular: 82, nFeatures: 8, nParts: 6, nFasteners: 12, autoCompatible: true },
  { id: 'C', name: 'C — Usiné CNC', process: 'cnc', procFr: 'CNC', wallDelta: 0, costFactor: 0.95, massFactor: 0.82, mtbfFactor: 1.35, safety: 1.5, stressFactor: 0.8, deflFactor: 0.7, recy: 82, mono: true, co2Factor: 2.0, circular: 65, nFeatures: 9, nParts: 3, nFasteners: 6, autoCompatible: false },
  { id: 'D', name: 'D — Hybride', process: 'hybrid', procFr: 'Hybride (insert)', wallDelta: 0.5, costFactor: 0.72, massFactor: 0.96, mtbfFactor: 1.05, safety: 1.25, stressFactor: 0.87, deflFactor: 0.8, recy: 55, mono: false, co2Factor: 1.6, circular: 45, nFeatures: 4, nParts: 4, nFasteners: 6, autoCompatible: true },
];

function weaknessFor(a: Arche, brief: ProductBrief, cost: number, mass: number): string {
  const c = brief.constraints;
  switch (a.id) {
    case 'A':
      return `Outillage de coulée initial élevé (amorti en série)`;
    case 'B':
      return mass > c.mass_max_kg
        ? `Masse ${mass} kg > cible ${c.mass_max_kg} kg`
        : `Plus de pièces et de fixations à assembler`;
    case 'C':
      return cost > c.cost_target_eur
        ? `Coût ${cost} € ≫ cible ${c.cost_target_eur} € (temps machine)`
        : `Temps machine élevé en grande série`;
    default:
      return `Insert hétérogène : recyclage en fin de vie compliqué`;
  }
}

function build(a: Arche, brief: ProductBrief): Concept {
  const c = brief.constraints;
  const be = brief.behaviourExpected;

  const wall_mm = round1(c.wall_min_mm + a.wallDelta);
  const cost_eur = Math.round(c.cost_target_eur * a.costFactor);
  const mass_kg = round1(c.mass_max_kg * a.massFactor);
  const mtbfCap = Math.round(c.mtbf_cycles * a.mtbfFactor);
  const material = materialFor(a.id, brief);
  const co2_kg = round1(mass_kg * a.co2Factor);
  const length_mm = Math.round(50 + c.mass_max_kg * 30); // characteristic size

  const params: ConceptParams = {
    dfm: { process: a.process, wall_mm, ra_um: c.ra_um, n_features: a.nFeatures },
    dfa: { n_parts: a.nParts, symmetry_deg: 360, n_fasteners: a.nFasteners, auto_compatible: a.autoCompatible },
    dfr: { mtbf_capable_cycles: mtbfCap, safety_factor: a.safety, standards_met: brief.standards.length > 0 },
    dfc: { cost_eur },
    dfs: { recyclability_pct: a.recy, co2_kg, mono_material: a.mono, circular_index: a.circular },
  };
  const scores = scoreConcept(brief, params);

  const requirements = [
    brief.function?.trim() || null,
    c.pressure_bar ? `Tenir une pression de ${c.pressure_bar} bar` : null,
    `Plage thermique ${c.temp_min_C}…${c.temp_max_C} °C`,
    `MTBF ≥ ${c.mtbf_cycles.toLocaleString('fr-FR')} cycles`,
    `Masse ≤ ${c.mass_max_kg} kg`,
    `Coût cible ≤ ${c.cost_target_eur} €`,
  ].filter((x): x is string => Boolean(x));

  return {
    id: a.id,
    name: a.name,
    materialProcess: `${material} / ${a.procFr}`,
    scores,
    cost_eur,
    mass_kg,
    weakness: weaknessFor(a, brief, cost_eur, mass_kg),
    fbs: {
      function: { requirements },
      behaviour: {
        expected: { ...be },
        simulated: {
          stress_max_MPa: Math.round(be.stress_max_MPa * a.stressFactor),
          deflection_max_mm: round3(be.deflection_max_mm * a.deflFactor),
          proof_ok: true,
        },
      },
      structure: { material, process: a.process, wall_mm, flanges: '', bore_mm: 0, length_mm },
    },
  };
}

/**
 * Generate the concept set for a run. S2 → the curated DN100 valve dataset;
 * every other scenario (including custom / empty) → archetypes synthesized from
 * the brief, scored deterministically by the DFx engine.
 */
export function generateConcepts(brief: ProductBrief, scenario: ScenarioKey | null): Concept[] {
  if (scenario === 'S2') return structuredClone(dn100Concepts);
  return ARCHES.map((a) => build(a, sane(brief)));
}
