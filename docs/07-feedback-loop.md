# 07 — Closed Feedback Loop (ADT)

## Principle

The feedback loop closes the design cycle by bringing field data back into design.

- **Quantitative feedback**: MES/Sensors/Digital Twin data — real Bs vs predicted Bs.
  Automatic trigger if deviation > threshold (default 5%, adjustable at Simulation L4).
- **Qualitative feedback**: customer complaints, after-sales returns, technician
  observations — from ERP/SAV. Processed by the Retrieval Agent. **Human validation
  required** before relaunching the cycle.

## DN100 feedback sequence (the demo's scripted loop, triggered from E5)

| Step | Node | Data / Event | In-app visual |
|---|---|---|---|
| 1 | MES / IoT sensors | Real operational data. Mock: "Unités : 47. Contrainte moy : 114 MPa. 2 défaillances joints." | MES icon at bottom of E5 feedback panel — shows mocked sensor values |
| 2 | Doc Agent — anomaly | Bs_real (114 MPa) vs Bs_predicted (108 MPa) → deviation +5.6%. Threshold = 5%. | Badge: "+5,6% déviation contrainte détectée" |
| 3 | Simulation Agent | Revised Be: stress_max 120 MPa → 111 MPa (reduced safety margin) | Simulation Agent card pulses amber. Updated Be threshold on radar. |
| 4 | Orchestrator — decision | Deviation > threshold → redesign loop triggered. Concept A flagged. | Red badge "↻ Redesign déclenché" on Concept A card. |
| 5 | Generation Agent — new S | Wall thickness 7 mm → 8 mm. New concept: "A-v2" | New concept card "A-v2" fades in on E4. Redrawn SVG. DFx re-scored. |
| 6 | Gate Review — validation | A-v2 passes Bs vs Be. DFM drops slightly (82→79). DFS unchanged. | "Boucle feedback complétée. 1 itération de redesign. A-v2 sélectionné." |

Each step appends an ADT entry. The whole sequence should play as an animated
step-by-step in the E5 feedback panel (user clicks "Simuler le retour terrain" or
steps advance automatically with ~1.5s delay, depending on Simulation HITL level:
L≤3 manual stepping, L≥4 auto).

## System interfaces involved

| System | Direction | Data exchanged | Agent |
|---|---|---|---|
| MES / Sensors | ← Read | Measured Bs, defect rates, cycle times | Simulation, Retrieval |
| Digital Twin | ↔ Read/Write | Real usage conditions in; simulated Bs out for future comparison | Simulation |
| ERP / SAV | ← Read | Complaints, failure codes, real MTBF — qualitative feedback | Retrieval |
| PLM | → Write | Simulation results, validated concept, convergence report | Doc / ADT |
| External AMDEC tools | → Notify | "New Bs data available" signal — the AMDEC tool decides its own update | Doc / ADT |
