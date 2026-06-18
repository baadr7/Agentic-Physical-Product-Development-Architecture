# 05 — DFx Scoring: Deterministic, Evidence-Based

## Architecture decision (scientific claim)

DFx scores are computed deterministically from product-brief parameters using
engineering formulas. The LLM is called AFTER scoring to generate a textual
justification (≤25 words per criterion). **The LLM never produces scores.**
Same brief → same scores, always. This is reproducibility by design.

## Formulas (normalized version — implement these)

The original CDC formulas were flagged "need revision". Below is the normalized
implementation: every score is clamped to [0, 100].

```ts
const clamp = (x: number) => Math.max(0, Math.min(100, x));
```

### DFM — Manufacturability
Inputs: `process` ('casting'|'cnc'|'hybrid'), `wall_mm`, `ra_um`, `n_features`.

```ts
// Boothroyd–Dewhurst-inspired index adapted casting vs machining
const processBase = { casting: 90, hybrid: 85, cnc: 70 }[process];
const raOk = ra_um >= brief.constraints.ra_um;       // achievable roughness
const wallOk = wall_mm >= brief.constraints.wall_min_mm;
score = clamp(processBase - n_features * 2 + (raOk ? 5 : 0) + (wallOk ? 0 : -10));
```

### DFA — Assembly
Inputs: `n_parts`, `symmetry_deg`, `n_fasteners`, `auto_compatible`.

```ts
const symmetryOk = symmetry_deg >= 180;
score = clamp(100 - n_parts * 3 - n_fasteners * 2
              + (symmetryOk ? 10 : 0) + (auto_compatible ? 5 : 0));
```

### DFR — Reliability
Inputs: `mtbf_capable_cycles`, `safety_factor`, `standards_met` (bool).

```ts
const mtbfScore = clamp((mtbf_capable_cycles / brief.constraints.mtbf_cycles) * 100) / 100; // 0–1
const sfTerm = Math.min(safety_factor / 1.5, 1.25);   // cap bonus
score = clamp(sfTerm * 40 + mtbfScore * 40 + (standards_met ? 20 : 0));
```

### DFC — Cost ⚠️ MANDATORY INVERSION
Inputs: `cost_eur`, `cost_target_eur`.

```ts
score = clamp(100 - (cost_eur / brief.constraints.cost_target_eur) * 100);
```

A concept at €85 (= target €85) scores **0**. At €42.50 → 50. At €0 → 100.
Forgetting this inversion produces wrong rankings in every DFC-weighted scenario.
DFC is already inverted here — **never re-invert in the composite**.

### DFS — Sustainability
Inputs: `recyclability_pct`, `co2_kg`, `mono_material` (bool), `circular_index` (0–100).

```ts
const co2Score = clamp(100 - (co2_kg / 20) * 100);
score = clamp(recyclability_pct * 0.4 + co2Score * 0.3 + circular_index * 0.3);
```

## Composite score

```ts
weight_i = priority_i / sum(all priorities);
composite = Σ (score_i × weight_i);
```

## DN100 pre-computed example scores (S2 dataset — these are FIXED data)

For the embedded DN100 example, concept scores are stored as data (the formulas
must reproduce them within ±2 from the concept parameter sets):

| Concept | Material / Process | DFM | DFA | DFR | DFC (€/pc) | DFS | Main weakness |
|---|---|---|---|---|---|---|---|
| A — Monolithique | AlSi10Mg / Casting | 82 | 76 | 78 | 62 (€62) | 74 | Tooling €3 200 |
| B — Boulonné | GGG40 / Casting | 71 | 85 | 85 | 65 (€58) | 79 | Mass 3.4 kg > target |
| C — Usiné CNC | Al6061 / CNC | 58 | 72 | 91 | 0 (€119) | 68 | Cost €119 ≫ target |
| D — Hybride | AlSi10Mg + SS insert | 88 | 68 | 88 | 74 (€74) | 62 | Insert hinders recycling |

(Cost target for DN100: derive from the DFC scores: €62→62 means target ≈ €163?
**No** — the CDC fixes the scores, so for the demo dataset store the five scores
per concept directly in `scenarios.ts` and use the formulas for S6/custom briefs.
Document this dual path in code comments.)

## Verified rankings — MUST be covered by unit tests

| Scenario | Winner | Why |
|---|---|---|
| S1 — Aérospatial (DFR=5, DFS=4) | **C — Usiné CNC** | DFR weight 5/14 ≈ 36%; DFR=91 outweighs DFC=0 penalty at this weighting |
| S2 — Industriel défaut | **A — Monolithique** | All criteria balanced; A's balance (82/76/78/62/74) beats D's DFM edge |
| S3 — Durable (DFS=5) | **B — Boulonné GGG40** | DFS weight 5/15 = 33%; B's DFS=79 beats A's 74 despite A's DFM edge |
| S4 — Fast MVP (DFC=5, DFM=4) | **B — Boulonné** | DFC weight 5/15 = 33%; B's DFC=65 is highest (cheapest at €58) |
| S5 — Haute cadence (DFM=5, DFA=5) | **D — Hybride** | DFM+DFA combined weight 10/18 ≈ 56%; D's DFM=88 is highest |
| S6 — Custom | user-defined | Ranking depends entirely on slider configuration |

Vitest: for each of S1–S5, `rankConcepts(dn100Concepts, scenario.dfxPriorities)[0].id`
must equal the verified winner. This test gate is non-negotiable.

## Feedback-loop rescoring

After redesign A → A-v2 (wall 7 mm → 8 mm): DFM drops 82 → 79, DFS unchanged,
Bs recomputed (passes the revised Be). A-v2 is re-ranked alongside A–D.
