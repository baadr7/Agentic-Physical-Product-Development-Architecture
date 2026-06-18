# APDA — Demo « IA pour la conception »

Application démontrant le framework **APDA** (Agentic Physical
Product Development Architecture) sur le cas de référence **vanne papillon DN100**.
Qualité visée : outil industriel commercial (Siemens Xcelerator / PTC Windchill /
Autodesk Fusion).

## Démarrage

```bash
npm install
npm run dev      # serveur Vite (http://localhost:5174)
npm run build    # build de production (tsc + vite)
npm run test     # vitest — moteur de scoring + classements vérifiés (19 tests)
npm run lint     # eslint

# Backend optionnel (API + base de données + RAG) — voir docs/11-backend.md
npm run db:reset # migrations + seed (scénarios + base de connaissances)
npm run server   # API Express sur http://localhost:8787
npm run dev:all  # frontend + backend en parallèle
```

Le **frontend reste utilisable hors-ligne** en *mode démo* (réponses LLM simulées) :
si l'API n'est pas lancée, la chaîne workflow bascule sur des fixtures locales. Une
clé API DeepSeek (compatible OpenAI) peut être saisie via l'icône ⚙ — conservée
**en mémoire uniquement**.

Un **backend optionnel** (Node + TypeScript + Express + SQLite via `node:sqlite`, sans
module natif) ajoute une **base de données** (migrations + seed exécutables) et un
**RAG** qui alimente les *champs custom* de la chaîne workflow depuis une base de
connaissances. Détails, schéma et endpoints : **[docs/11-backend.md](docs/11-backend.md)**.

## Les 6 revendications scientifiques démontrées

1. Orchestration multi-agents d'un problème de conception industrielle (E3 + chaîne).
2. Continuité sémantique via l'ontologie **FBS** (E5).
3. Niveaux d'autonomie **HITL L1–L5** par agent qui changent le rôle du concepteur.
4. Évaluation **DFx** parallélisée et déterministe, incluant la durabilité (DFS).
5. **Digital thread agentique (ADT)** — piste d'audit horodatée (cadre EU AI Act).
6. **Boucle de feedback** fermée des données terrain vers la conception (E5 → A-v2).

## Écrans

| Route | Écran |
|---|---|
| `/e1` | Choix du scénario & paramétrage (6 scénarios, priorités DFx, HITL par agent) |
| `/e2` | Contraintes techniques (import PLM/ERP simulé + dialogue de conflit, extraction NL) |
| `/e3` | Tableau de bord multi-agents (cartes agents, connecteurs, Gantt, plan Orchestrateur) |
| `/e3/:agentId` | Sous-écran d'agent (sources, payloads JSON, actions selon le niveau HITL) |
| `/workflow` | **Chaîne d'orchestration type n8n** — graphe de nœuds animé pendant l'exécution |
| `/e4` | Concepts générés (gauges, ruban « Recommandé », radar comparatif, justifications IA) |
| `/e5/:conceptId` | Détail FBS + pack DFx + radar Bs/Be + **boucle feedback 6 étapes** |
| `/e6` | Sélection HITL (5 configurations bannière/boutons, auto-confirm L5, question éco DFS≥4) |
| `/e7` | Gate Review (carte décision, risques résiduels, audit ADT, export `.txt`) |
| `/e8` | Glossaire (22 termes, filtre en direct) |

Bascule **FR / EN** dans l'en-tête (i18n complet ; le français reste la langue de référence).
Bascule **thème sombre / clair** (icône ☀/🌙) — deux thèmes industriels, préférence
conservée en `localStorage`, appliquée avant le premier rendu (pas de flash).

## Architecture

- **Vite + React 18 + TypeScript**, Tailwind, Zustand (store persisté en `sessionStorage`,
  hors clé API), React Router, Chart.js, zod, lucide-react.
- `src/engine/` — fonctions pures testées : scoring DFx, composite, classement, boucle
  feedback, cohérence HITL. **Le LLM ne calcule jamais de score.**
- `src/llm/` — client DeepSeek (compatible OpenAI), contrats zod, politique
  *retry-once-then-mock*. 4(+1) sites d'appel.
- `src/engine/simulatedConnector.ts` + `src/config/connectorFixtures.ts` — Layer 3
  simulé (payloads JSON visibles, badges « Simulé »).

## Scoring DFx & réconciliation du CDC

Le scoring est **déterministe** : mêmes entrées → mêmes scores et même classement.
La spécification d'origine (`docs/05`) était **incohérente** (la table de scores et la
table des « classements vérifiés » se contredisaient, et la colonne DFC violait
l'inversion de coût obligatoire). Voir **[docs/SPEC_RECONCILIATION.md](docs/SPEC_RECONCILIATION.md)**
pour l'analyse complète et le jeu de données corrigé, cohérent en coût, qui :

- garantit le gagnant narratif **S2 → A** (concept hôte de la boucle feedback) ;
- reproduit **4 des 5 gagnants visés** avec 4 concepts distincts (**S1→C, S2→A, S3→B, S5→D**),
  S4→A étant plus défendable que le « B » de la spec (poids DFM=4) ;
- conserve le caractère documenté de chaque concept (coût/masse/faiblesse).

Les 19 tests Vitest verrouillent l'inversion DFC, le composite, le déterminisme et ces
gagnants.
