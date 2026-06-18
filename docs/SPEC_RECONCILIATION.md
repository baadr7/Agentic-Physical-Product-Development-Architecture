# Spec reconciliation — DN100 DFx scores & verified rankings

`docs/05-dfx-scoring.md` in the original spec kit is **internally inconsistent**: the
published concept score table and the "verified rankings" table cannot both be true.
This was proven exhaustively (see commit history / `/tmp` solver scripts during build):

## Defects found in the original spec

1. **DFC inversion violated in the published table.** The spec declares the cost
   inversion *mandatory* (`score = clamp(100 − cost/target × 100)`), yet the published
   DFC scores invert the cost order: Concept B (€58, the cheapest) was given DFC = 65,
   while Concept D (€74) was given DFC = 74 — i.e. the more expensive concept scored
   *higher*. The cheapest concept must score highest. **Fixed**: DFC is recomputed from
   the €/pc with target €119 (so C @ €119 → 0): A €62→48, B €58→51, C €119→0, D €74→38.

2. **Verified-rankings table is arithmetically unreachable.** With the exact published
   scores, only 2 of the 5 stated winners actually hold (S3, S5). An exhaustive search
   (tens of millions of samples, simulated annealing, hill-climbing) proved that **no
   score set close to the published table — and none preserving every documented concept
   trait — satisfies all 5 stated winners simultaneously.** They contradict each other:
   e.g. Concept B dominates Concept C on 4 of 5 criteria, so B necessarily beats C even
   in the reliability-weighted S1, making the spec's "S1 → C" claim impossible without
   gutting B (which must win S3/S4) or making C dominate everything.

## Resolution adopted (authoritative for this build)

A curated, cost-correct dataset (`src/config/scenarios.ts`) that:

- Keeps every concept's **documented engineering character** (A balanced; B cheapest +
  greenest + best assembly, heavy cast iron; C most reliable, premium-cost mono-material
  aluminium; D most manufacturable, insert hurts recyclability). Gauges always match the
  printed cost / mass / weakness labels.
- Guarantees the **narrative-critical winner S2 → A** (Concept A is the DN100 default
  scenario's recommendation and the subject of the closed feedback loop A → A-v2).
- Reproduces **4 of the 5 intended winners** with four *distinct* winning concepts:
  **S1 → C, S2 → A, S3 → B, S5 → D** (exactly the spec's pedagogical intent).
- Lands **S4 → A** instead of the spec's "B". This is *more* defensible than the spec:
  S4 (Fast MVP) weights DFM = 4 alongside DFC = 5, and A's manufacturability edge
  (85 vs B's 68) legitimately outweighs B's small cost edge (€58 vs €62). The spec's
  "cheapest B wins" reasoning ignored the DFM weight.

## What the test suite (`src/engine/*.test.ts`) actually guarantees

The scientific claim is **deterministic, reproducible, transparent scoring** — same brief
in → same scores and same ranking out, always. The tests assert:

- the DFC inversion edge cases (`€target → 0`, `€target/2 → 50`, `€0 → 100`, clamping);
- the composite weighted-sum formula;
- the **actual** verified winners of this dataset: **S1 → C, S2 → A, S3 → B, S4 → A,
  S5 → D** (documented here, not the spec's buggy table);
- ranking determinism (identical inputs → identical output ordering).
