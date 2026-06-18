# 02 — Data Model

## FBS ontology (Function–Behaviour–Structure)

Every concept is structured as FBS. This is the semantic backbone of the ADT.

| FBS layer | Definition | Role | DN100 example |
|---|---|---|---|
| **F — Function** | What the product must do (functional requirements) | Generation Agent does F→S | Regulate flow at DN100/PN16 (16 bar). Ensure sealing. Withstand thermal cycles −10°C/+120°C. MTBF ≥ 50 000 cycles. Mass ≤ 2.8 kg. |
| **Be — Behaviour expected** | Quantitative thresholds | Simulation boundary: Bs ≤ Be ⇒ PASS | stress_max ≤ 120 MPa under PN16; deflection_max ≤ 0.05 mm; proof: no permanent deformation at 24 bar |
| **Bs — Behaviour simulated** | Actual behavior computed from structure | Computed by Simulation Agent; Bs > Be triggers redesign | Concept A (AlSi10Mg, 7 mm wall): Bs = 108 MPa — within Be, 10% margin |
| **S — Structure** | Physical realization: material, process, geometry | Output of Generation, input of Simulation | Material (AlSi10Mg/GGG40/Al6061/Hybrid), process (casting/CNC), wall thickness, flange 4×M12, bore 100 mm, length 130 mm |

## Scenario JSON schema

```ts
interface Scenario {
  id: 'S1'|'S2'|'S3'|'S4'|'S5'|'S6';
  name: string;
  icon: 'aerospace'|'industrial'|'sustainable'|'startup'|'automotive'|'custom';
  description: string;
  dfxPriorities: { dfm: number; dfa: number; dfr: number; dfc: number; dfs: number }; // 1–5
  agentLevels: { orchestrator: number; retrieval: number; generation: number;
                 simulation: number; dfx: number; doc: number };                       // 1–5
  globalHITL: 1|2|3|4|5;
  humanRole: string;            // e.g. 'Pleine autorité', 'Consultant'
  productBrief: ProductBrief;
}

interface ProductBrief {
  name: string;
  function: string;
  constraints: {
    temp_max_C: number; temp_min_C: number; mass_max_kg: number;
    mtbf_cycles: number; cost_target_eur: number; wall_min_mm: number; ra_um: number;
    pressure_bar?: number;
  };
  standards: string[];                       // e.g. ['EN 593', 'EN 12334']
  behaviourExpected: { stress_max_MPa: number; deflection_max_mm: number; proof_ok: boolean };
}
```

### S1 reference example (full)

```json
{
  "id": "S1", "name": "Aérospatial / Sécurité critique", "icon": "aerospace",
  "description": "Pièce structurelle aérospatiale — pas de génération autonome autorisée",
  "dfxPriorities": { "dfm": 2, "dfa": 2, "dfr": 5, "dfc": 1, "dfs": 4 },
  "agentLevels": { "orchestrator": 2, "retrieval": 3, "generation": 1, "simulation": 2, "dfx": 2, "doc": 3 },
  "globalHITL": 1, "humanRole": "Pleine autorité",
  "productBrief": {
    "name": "Ferrure structurelle AE-100",
    "function": "Ferrure porteuse structure primaire, grade aérospatial",
    "constraints": { "temp_max_C": 180, "temp_min_C": -55, "mass_max_kg": 0.5,
      "mtbf_cycles": 500000, "cost_target_eur": 2000, "wall_min_mm": 3, "ra_um": 1.6 },
    "standards": ["EN 9100", "DO-160"],
    "behaviourExpected": { "stress_max_MPa": 200, "deflection_max_mm": 0.02, "proof_ok": true }
  }
}
```

S2–S5 follow the same structure with parameters from the scenario table below.
S6 (Custom): all priorities 3, all agents L3, empty productBrief (user-filled).

## The 6 preconfigured scenarios

| Scenario | DFx priorities | Agent levels | Use case |
|---|---|---|---|
| S1 — Aérospatial (sécurité critique) | DFR=5, DFS=4, DFM=2, DFA=2, DFC=1 | Gen=L1, Sim=L2, DFx=L2, Doc=L3 | Aerospace structural part — no autonomous generation |
| S2 — Industriel défaut (DN100) | DFM=3, DFA=2, DFR=3, DFC=3, DFS=2 | Gen=L2, Sim=L3, DFx=L3, Doc=L4 | Butterfly valve body — balanced DFx. **Default selection.** |
| S3 — Conception durable | DFS=5, DFR=3, DFM=3, DFC=2, DFA=2 | Gen=L2, Sim=L3, DFx=L3, Doc=L4 | Consumer product — sustainability KPIs lead |
| S4 — Fast MVP (startup) | DFC=5, DFM=4, DFA=3, DFR=2, DFS=1 | Gen=L4, Sim=L4, DFx=L4, Doc=L5 | Hardware startup — speed over completeness |
| S5 — Haute cadence | DFM=5, DFA=5, DFC=4, DFR=2, DFS=2 | Gen=L3, Sim=L3, DFx=L3, Doc=L4 | Automotive part — assembly-line dominant |
| S6 — Custom | All sliders 3 | All agents L3 | Any product — full freedom |

Unlisted agent levels per scenario: orchestrator and retrieval use the global
defaults (Orchestrator L3, Retrieval L4) unless the scenario overrides them (S1 does).

## Industry presets for DFx sliders (E1.2 / E2)

| Sector | DFM | DFA | DFR | DFC | DFS |
|---|---|---|---|---|---|
| Aérospatial (sécurité critique) | 2 | 2 | 5 | 1 | 4 |
| Automobile (haute cadence) | 5 | 5 | 2 | 4 | 2 |
| Biens de consommation | 3 | 3 | 2 | 4 | 4 |
| Médical (dispositifs) | 2 | 2 | 5 | 2 | 3 |
| Énergie / Industrie | 3 | 2 | 3 | 3 | 2 |
| Autre / Custom | 3 | 3 | 3 | 3 | 3 |

## ADT entry

```ts
interface ADTEntry {
  id: string;
  timestamp: string;          // ISO 8601 — mandatory (traceability)
  agent: AgentId | 'human' | 'system';
  event: string;              // 'plan_validated', 'concept_generated', 'redesign_triggered', …
  source: string;             // 'Windchill 12.1 (simulé)', 'saisie manuelle', 'DeepSeek', …
  hitlLevel?: number;
  payload: unknown;
}
```

Gate review at E7 requires ≥10 ADT entries including feedback-loop events if triggered.
