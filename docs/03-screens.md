# 03 — Screens E1–E8

A fixed "? Glossaire" button is visible on ALL screens (opens E8 as overlay or route).
A persistent header shows the PDP phase banner (Layer 0, simulated) and the active
scenario name.

---

## E1 — Scenario choice & parameterization (entry point)

### E1.1 Starting point

- **Option A — Predefined scenario**: grid 3×2 of 6 cards (S1–S5 + S6 Custom).
  Each card: sector icon, mini DFx priority chart, global HITL badge, description.
  **S2 Industriel (DN100) preselected by default.** Selecting a card loads its values,
  all remain editable.
- **Option B — Empty project**: button "Démarrer un projet vide". All fields empty,
  DFx sliders at 3, all agents at L3. No example product preloaded.

### E1.2 DFx priorities (1–5)

Five sliders: DFM, DFA, DFR, DFC, DFS. Two modes:
- **Mode industrie**: sector selector pre-fills sliders with typical values
  (table in docs/02). Values remain editable.
- **Mode manuel**: direct adjustment. **Radar chart updates in real time.**

### E1.3 HITL levels per agent

Six rows (Orchestrator, Retrieval, Generation, Simulation, DFx ×5, Documentation).
Each row: 5 buttons L1–L5. On selection, two zones display immediately:
- *Ce que fait l'agent à ce niveau* (grey text)
- *Ce que doit faire l'humain à ce niveau* (blue text, highlighted)

Defaults and allowed ranges:

| Agent | Default | Allowed range | Reason |
|---|---|---|---|
| Orchestrator | L3 | L2–L4 | Planning/routing — human plan validation needed |
| Retrieval | L4 | L3–L5 | Low-risk search task |
| Generation | L2 | L1–L4 | High creative value — human co-design critical |
| Simulation | L3 | L2–L4 | Technical analysis — human validates Be thresholds |
| DFx ×5 | L3 | L2–L4 | Deterministic score — justification needs review |
| Documentation | L4 | L3–L5 | Low-risk documentation — automation acceptable |

**Coherence rule**: if the combination is incoherent (e.g. Orchestrator L5 while
another agent is at L1), display an explicit warning before allowing launch.

### E1.4 Pre-launch summary

- Selected scenario (name + sector)
- DFx priorities as radar chart
- Synthetic human role (e.g. "Dans cette configuration, vous êtes Consultant")
- List of 6 agents with their HITL level
- CTA "Configurer les contraintes techniques →" (to E2), or "Lancer directement →"
  if a predefined scenario was not modified.

No API call on E1 — all scenarios load from config.

---

## E2 — Technical constraints configuration

| Element | Spec |
|---|---|
| Left column | Product parameters: name, function, technical constraints, applicable standards. "Réinitialiser aux valeurs du scénario" button. Real-time validation (red border if required field empty). |
| Constraint source | Each constraint displays its source: manual entry, PLM import, ERP import, or NL-converted. Source is traced in the ADT. |
| Natural-language input | Optional free-text field describing the product. The Orchestrator (LLM call) extracts structured constraints and pre-fills the fields. |
| Center column | DFx sliders 1–5 with real-time composite preview. Tooltip per criterion explains its impact. |
| Right column | Agent configuration: 6 rows, each with name, L1–L5 selector, human-role description at that level. |
| Human role summary | Under each agent: "votre rôle est : [nom]" — dynamically updated. |
| CTA | "Lancer les agents →" — saves appState, navigates to E3. |

**Import conflict handling** (resolves the CDC gap): imports are simulated button
actions ("Importer depuis PLM (simulé)"). If an imported value conflicts with a
manually entered one (e.g. PLM says 6 bar, engineer typed 16 bar), show a conflict
dialog: side-by-side values + sources, user picks one, the decision + both sources
are written to the ADT.

---

## E3 — Multi-agent dashboard

| Element | Spec |
|---|---|
| Agent cards | Grid 3×2. Each card: agent name, layer badge, HITL badge, status (idle/running/done), 3-line log zone, chronometer. |
| Agent sub-screens | Clicking a card opens its dedicated screen: queried sources, JSON payloads, outputs, and HITL actions available at its level. |
| Layer Connection Panel | Persistent horizontal strip. 8 system icons (PLM, STD, CAD, MES, ERP, Digital Twin, FBS, HITL). Animate on trigger. Label "Connexion simulée" on all non-real interactions. |
| Orchestrator API call | Real DeepSeek call. Returns JSON: `plan + hitl_comment + key_risk + sustainability_note`. |
| Gantt timeline | 6 agents displayed. DFx ×5 as parallel labeled bars (DFM/DFA/DFR/DFC/DFS). |
| CTA | "Voir les concepts générés →" — appears when all agents are done. |

### Agent sub-screens (E3/:agentId)

**Orchestrator** — Execution plan (task sequence: agent, action, estimated duration;
editable per HITL level). Sources: config scenario, E2 product brief, configured HITL
levels. Outputs: JSON plan dispatched to each agent; ADT entry created. Human action:
L1–L2 validate/modify plan; L3 monitor; L4 approve critical decisions; L5 observe.

**Retrieval** — Sources queried: PLM (similar projects), standards base (EN 593,
EN 12334), ERP (available materials), Digital Twin (operational data), internal REX
base, after-sales (field returns). Visible payloads: request JSON + simulated response
JSON per source. Outputs: structured context passed to Generation and Simulation.
Human action per level: L1 formulates query; L2 validates proposed queries; L3 filters
results; L4 approves context; L5 monitors.

**Generation** — Sources: Retrieval context (FBS, standards, available materials),
ERP (material availability). Parameters: concept count (1–10), variation axes
(material, process, geometry). Outputs: N concepts with structured FBS, preliminary
DFx, parametric SVG; writes to PLM (concept sheet) and CAD (geometry) — simulated.
Human action: L1 sets all parameters; L2 validates proposed config; L3 may request
variants; L4 approves recommendation; L5 confirms or reopens.

**Simulation** — Sources: CAD (geometry for meshing), Digital Twin (real boundary
conditions), MES/Sensors (measured Bs for feedback loop). Solver: deterministic
simulated computation. Outputs: computed Bs, Bs/Be comparison, PASS/REDESIGN status,
convergence report; written to PLM. Human action: L1 configures solver; L2 approves
config; L3 decides acceptable/redesign; L4 approves recommendation; L5 monitors
convergence.

**Documentation** — Sources: outputs of all agents (context, concepts, Bs, DFx, HITL
decisions). Outputs: complete digital thread (ADT), gate review report, BOM to ERP,
notification to external AMDEC tools. Human action: L1 enters everything manually;
L2 validates proposed entries; L3 annotates summaries; L4 approves and signs report;
L5 audits.

---

## E4 — Generated concepts

| Element | Spec |
|---|---|
| Concept grid | 2×2. Each card: concept name, material/process chip, parametric SVG (120×120px), 5 DFx gauges, cost badge, mass badge, weakness tag, rank badge (#1–#4). |
| Recommended concept | Blue border + "Recommandé" ribbon on the top-ranked concept. |
| Comparative radar | Chart.js radar overlaying the 5 DFx scores of all concepts. |
| Ranking label | Tag "Classé selon : [scénario actif]". Updates if scenario changes. |
| DFx scores | Computed by deterministic formulas (docs/05). Gauges animate 0→value (600ms). DFS in emerald accent. |
| API call | 1 DeepSeek call: 4 concepts → JSON array of DFx justifications (5 fields per concept). |
| Navigation | "Voir le détail →" per card → E5. "Procéder à la sélection →" → E6. |

---

## E5 — Concept detail + feedback loop

| Element | Spec |
|---|---|
| FBS 3-column | F (blue): functional requirements as pills. B (green): Be vs Bs table (3 metrics) + PASS/REDESIGN badge. S (violet): material, process, wall thickness, SVG (240×240px). |
| DFx Readiness Pack | 5-row table: criterion, score gauge, PASS/FAIL (threshold 70), AI justification. |
| Radar Bs vs Be | Chart.js radar, 3 axes: stress, deflection, proof. Be = dashed red. Bs = solid blue. |
| Feedback panel | Retractable side panel — see docs/07. |
| API call | 1 DeepSeek call: Simulation Agent analysis (FBS summary + Bs/Be status + engineering note + feedback_loop risk). |

---

## E6 — HITL selection

Behavior driven by `appState.brief.agentLevels.orchestrator`. Each level produces a
distinct banner, button set and interaction mode:

| Level | Role title | Banner message | Buttons | Auto-validation? |
|---|---|---|---|---|
| L1 — Opérateur | Pleine autorité | "Chaque concept requiert votre approbation explicite avant de procéder." | Approuver concept A / B / C / D (4 individual buttons) | Never |
| L2 — Collaborateur | Directeur créatif | "Revoyez les concepts classés par l'IA. Vous pouvez modifier les contraintes avant de sélectionner." | Sélectionner & procéder / Modifier contraintes / Rejeter tout | No |
| L3 — Consultant | Décideur | "L'IA a classé les concepts. Sélectionnez parmi les options recommandées en vous appuyant sur les preuves DFx." | Sélectionner #1 (recommandé) / Sélectionner #2 / Autre / Abstention | No |
| L4 — Approbateur | Approbateur | "L'Orchestrator a présélectionné le concept [X]. Revoyez le résumé et approuvez ou annulez." | Approuver la sélection / Annuler — choisir un autre concept | No (click required) |
| L5 — Observateur | Observateur | "L'Orchestrator a sélectionné le concept [X] de façon autonome. Vous êtes notifié." | Confirmer / Voir les détails (lecture seule) | **Yes — auto after 3s** |

**If DFS priority ≥ 4**: extra guidance question in E6 — "La recyclabilité en fin de
vie est-elle une exigence contractuelle pour cette famille de produits ?" → activates
a separate eco-ranking card.

---

## E7 — Gate Review

| Element | Spec |
|---|---|
| Decision card | Selected concept + composite score + 5 DFx scores (DFS highlighted if scenario S3). |
| Residual risks | 3 items from DeepSeek, ≥1 sustainability risk. Columns: risk, severity, category, mitigation. |
| Digital thread audit | ≥10 timestamped entries including feedback-loop events if triggered. |
| Compliance badges | EN 593 ✓ / EN 12334 ✓ + sustainability note if DFS ≥ 70: "Répond au seuil de conception circulaire". |
| Feedback loop summary | If triggered: "Boucle feedback complétée — 1 itération de redesign. Concept A-v2 sélectionné." |
| Export | `gate_review_[produit]_[date].txt` — includes scenario, 5 DFx scores, DFS sub-scores, digital thread, guidance answers. Client-side download. |
| API call | 1 DeepSeek call: residual risks JSON (3 items, ≥1 sustainability risk if DFS < 70). |

---

## E8 — Glossary

- Access: fixed "? Glossaire" button on all screens.
- 22 terms (docs/10). Each term: name, APDA layer badge, 2–3 sentence definition,
  DN100 example in italic.
- Real-time text filter. No API call.
