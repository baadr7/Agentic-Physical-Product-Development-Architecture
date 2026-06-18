/* Builds the detailed French project report (APDA) as a .docx with screenshots. */
const fs = require('node:fs');
const path = require('node:path');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, ImageRun,
  Header, Footer, AlignmentType, LevelFormat, TabStopType, TabStopPosition,
  TableOfContents, HeadingLevel, BorderStyle, WidthType, ShadingType, VerticalAlign,
  PageNumber, PageBreak,
} = require('docx');

const ASSETS = path.resolve('_report_assets');
const OUT = path.resolve('Rapport_APDA.docx');
const CONTENT_W = 9360; // US Letter, 1" margins

// ---------- helpers ----------
let figN = 0;
const NAVY = '1F3A5F', BLUE = '2E75B6', GREY = '5A5A5A', LIGHT = 'EAF1F8';

function h1(t) { return new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(t)] }); }
function h2(t) { return new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(t)] }); }
function h3(t) { return new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun(t)] }); }
function p(t) { return new Paragraph({ spacing: { after: 140, line: 276 }, alignment: AlignmentType.JUSTIFIED, children: [new TextRun(t)] }); }
function runsP(children) { return new Paragraph({ spacing: { after: 140, line: 276 }, alignment: AlignmentType.JUSTIFIED, children }); }
function lead(label, rest) {
  return new Paragraph({ spacing: { after: 120, line: 276 }, alignment: AlignmentType.JUSTIFIED,
    children: [new TextRun({ text: label + ' : ', bold: true }), new TextRun(rest)] });
}
function bullet(t) { return new Paragraph({ numbering: { reference: 'b', level: 0 }, spacing: { after: 60 }, children: typeof t === 'string' ? [new TextRun(t)] : t }); }
function bulletKV(k, v) { return new Paragraph({ numbering: { reference: 'b', level: 0 }, spacing: { after: 60 }, children: [new TextRun({ text: k + ' — ', bold: true }), new TextRun(v)] }); }
function num(t) { return new Paragraph({ numbering: { reference: 'n', level: 0 }, spacing: { after: 60 }, children: typeof t === 'string' ? [new TextRun(t)] : t }); }
function code(t) { return new Paragraph({ spacing: { after: 120 }, shading: { fill: 'F2F4F7', type: ShadingType.CLEAR }, border: { left: { style: BorderStyle.SINGLE, size: 18, color: BLUE, space: 6 } }, children: [new TextRun({ text: t, font: 'Consolas', size: 19 })] }); }

function fig(file, caption) {
  const buf = fs.readFileSync(path.join(ASSETS, file));
  const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
  const dispW = 600, dispH = Math.round(dispW * h / w);
  figN += 1;
  return [
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 120, after: 40 },
      border: { top: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' }, bottom: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' }, left: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' }, right: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' } },
      children: [new ImageRun({ type: 'png', data: buf, transformation: { width: dispW, height: dispH }, altText: { title: caption, description: caption, name: 'fig' + figN } })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: 'Figure ' + figN + ' — ' + caption, italics: true, size: 18, color: GREY })] }),
  ];
}

const bd = { style: BorderStyle.SINGLE, size: 1, color: 'BBBBBB' };
const borders = { top: bd, bottom: bd, left: bd, right: bd, insideHorizontal: bd, insideVertical: bd };
function table(headers, rows, widths) {
  const total = widths.reduce((a, b) => a + b, 0);
  const mk = (text, opts = {}) => new TableCell({ borders, width: { size: opts.w, type: WidthType.DXA }, shading: opts.head ? { fill: NAVY, type: ShadingType.CLEAR } : (opts.zebra ? { fill: LIGHT, type: ShadingType.CLEAR } : undefined), margins: { top: 60, bottom: 60, left: 110, right: 110 }, verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({ children: [new TextRun({ text: String(text), bold: !!opts.head, color: opts.head ? 'FFFFFF' : undefined, size: 19 })] })] });
  const headRow = new TableRow({ tableHeader: true, children: headers.map((hh, i) => mk(hh, { head: true, w: widths[i] })) });
  const bodyRows = rows.map((r, ri) => new TableRow({ children: r.map((c, i) => mk(c, { w: widths[i], zebra: ri % 2 === 1 })) }));
  return new Table({ width: { size: total, type: WidthType.DXA }, columnWidths: widths, rows: [headRow, ...bodyRows] });
}
function spacer() { return new Paragraph({ spacing: { after: 120 }, children: [] }); }

// ---------- title page ----------
const title = [
  new Paragraph({ spacing: { before: 1400, after: 0 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'APDA', bold: true, size: 96, color: NAVY })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 }, children: [new TextRun({ text: 'Architecture Agentique de Développement Produit', bold: true, size: 36, color: BLUE })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: [new TextRun({ text: 'Agentic Physical Product Development Architecture', italics: true, size: 24, color: GREY })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 200, after: 60 }, children: [new TextRun({ text: 'Rapport détaillé de projet', size: 28 })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 700 }, children: [new TextRun({ text: 'Démonstrateur — corps de vanne papillon DN100 & produits personnalisés', size: 22, color: GREY })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, border: { top: { style: BorderStyle.SINGLE, size: 6, color: BLUE, space: 8 }, bottom: { style: BorderStyle.SINGLE, size: 6, color: BLUE, space: 8 } }, spacing: { before: 200, after: 200 }, children: [new TextRun({ text: 'ENSAM — Génie Mécanique & Conception · Semestre 8', size: 22, bold: true })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 600 }, children: [new TextRun({ text: 'Application web React/TypeScript · Backend Express/SQLite · RAG · IA générative', size: 20, color: GREY })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 40 }, children: [new TextRun({ text: 'Juin 2026', size: 20, color: GREY })] }),
  new Paragraph({ children: [new PageBreak()] }),
];

// ---------- TOC ----------
const toc = [
  new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun('Table des matières')] }),
  new TableOfContents('Sommaire', { hyperlink: true, headingStyleRange: '1-3' }),
  new Paragraph({ children: [new PageBreak()] }),
];

// ---------- body ----------
const body = [];
const A = (...x) => body.push(...x);

// 1. Introduction
A(h1('1. Introduction et contexte'));
A(p("APDA (Architecture Agentique de Développement Produit) est une application web qui illustre, de bout en bout, comment une équipe d'agents d'intelligence artificielle peut assister la conception d'un produit physique tout en gardant l'ingénieur humain au centre de la décision. Le démonstrateur prend pour fil conducteur la conception d'un corps de vanne papillon DN100, mais il fonctionne également pour des produits entièrement personnalisés (aérospatial, automobile, biens de consommation, etc.)."));
A(p("L'objectif pédagogique est de rendre tangibles plusieurs notions de l'ingénierie assistée par IA : l'orchestration multi-agents, le contrôle humain dans la boucle (HITL), la traçabilité réglementaire (thread numérique), l'évaluation multicritère DFx, la modélisation Fonction–Comportement–Structure (FBS), la récupération de connaissances (RAG) et la génération d'images de produit."));
A(lead('Public visé', "étudiants et enseignants en génie mécanique/conception, ainsi que toute personne souhaitant comprendre concrètement un flux de conception piloté par agents."));
A(lead('Périmètre', "le projet est un démonstrateur : les connecteurs d'entreprise (PLM, ERP, MES…) sont simulés, mais l'architecture est conçue pour être branchée sur de vrais systèmes sans changer l'interface."));

A(h1('2. Vue d\'ensemble du concept'));
A(p("APDA repose sur six agents spécialisés qui se relaient pour transformer un besoin produit en concepts évalués et documentés. Chaque étape est tracée et peut être supervisée par l'humain."));
A(h2('2.1 Les six agents'));
A(table(['Agent', 'Rôle'],
  [['Orchestrateur', "Analyse le brief, établit le plan d'exécution séquencé, répartit le travail."],
   ['Récupération (RAG)', "Interroge les sources de connaissances et structure le contexte (champs custom)."],
   ['Génération', "Mappe les fonctions vers des structures et produit les concepts FBS."],
   ['Simulation', "Compare le comportement simulé (Bs) au comportement attendu (Be)."],
   ['DFx ×5', "Calcule les scores déterministes DFM/DFA/DFR/DFC/DFS."],
   ['Documentation', "Agrège le thread numérique (ADT) et prépare la revue de jalon."]],
  [2600, 6760]));
A(spacer());
A(h2('2.2 Notions clés'));
A(bulletKV('HITL (Human-in-the-Loop)', "cinq niveaux d'autonomie par agent, de « Opérateur » (validation systématique) à « Observateur » (autonomie totale)."));
A(bulletKV('ADT (Agentic Digital Thread)', "journal horodaté de toutes les actions agents/humain, dans l'esprit de la traçabilité exigée par l'AI Act européen."));
A(bulletKV('DFx', "évaluation multicritère : fabricabilité, assemblage, fiabilité, coût (inversé) et durabilité."));
A(bulletKV('FBS', "Fonction–Comportement–Structure ; le concept est décrit par ses exigences, son comportement attendu/simulé et sa structure matérielle."));
A(bulletKV('Boucle de feedback', "des données terrain (jumeau numérique) peuvent déclencher une itération de re-conception (ex. A → A-v2)."));
A(bulletKV('RAG', "Retrieval-Augmented Generation : récupération de connaissances pour enrichir le projet de champs vérifiés."));

// 3. Architecture
A(h1('3. Architecture technique'));
A(h2('3.1 Pile logicielle'));
A(table(['Couche', 'Technologies'],
  [['Frontend', 'React 18, TypeScript, Vite, TailwindCSS, Zustand (état + persistance), React Router, Chart.js, lucide-react, zod'],
   ['Backend', 'Node.js, Express, base SQLite native (node:sqlite), CORS, exécution via tsx'],
   ['RAG', "Embeddings parcimonieux (fréquence de termes) + similarité cosinus sur une base de connaissances simulée"],
   ['IA générative (image)', 'Pollinations.ai (modèle Flux) — sans clé API, l\'image est générée à partir du prompt'],
   ['LLM (texte)', 'DeepSeek (API compatible OpenAI) pour les commentaires ; mode démo simulé sans clé']],
  [2400, 6960]));
A(spacer());
A(h2('3.2 Modèle de données (SQLite)'));
A(p('Le backend persiste le projet et son déroulé complet dans les tables suivantes :'));
A(table(['Table', 'Contenu'],
  [['scenarios', '6 scénarios de référence (priorités, niveaux HITL, brief)'],
   ['projects', "instance de projet (brief de travail, scénario, statut)"],
   ['hitl_config', "niveau HITL par agent pour un projet"],
   ['concepts / dfx_scores', "concepts FBS générés et leurs scores DFx déterministes"],
   ['adt_entries', "thread numérique horodaté (audit)"],
   ['custom_fields', "champs custom renseignés par le RAG"],
   ['concept_images', "sessions d'images par concept (prompt, paramètres, URL)"],
   ['knowledge_documents / chunks', "base de connaissances RAG + vecteurs"]],
  [2800, 6560]));
A(spacer());
A(h2('3.3 Schéma de flux'));
A(p("Brief produit → Orchestrateur → Récupération (RAG) → Génération (concepts) → Simulation (Bs vs Be) → DFx ×5 → Documentation (ADT) → Revue de jalon. À chaque étape, en mode supervisé, l'humain valide ou ajuste avant de continuer."));

// 4. Installation
A(h1('4. Installation et démarrage'));
A(h2('4.1 Prérequis'));
A(bullet('Node.js récent (version 20+ recommandée, pour la base SQLite native).'));
A(bullet('npm pour installer les dépendances.'));
A(h2('4.2 Étapes'));
A(num('Installer les dépendances :'));
A(code('npm install'));
A(num('Créer et peupler la base de données :'));
A(code('npm run db:migrate\nnpm run db:seed'));
A(num('Lancer le frontend ET le backend ensemble :'));
A(code('npm run dev:all'));
A(p("Le frontend est servi sur http://localhost:5174 et l'API sur http://localhost:8787 (le frontend relaie automatiquement les appels /api vers le backend)."));
A(runsP([new TextRun({ text: 'Important : ', bold: true, color: 'B00020' }), new TextRun("l'archivage des projets et des images sur disque nécessite que le backend soit démarré. Si vous ne lancez que « npm run dev » (frontend seul), l'application bascule en mode hors-ligne (mémoire) et rien n'est écrit dans le dossier du projet.")]));
A(h2('4.3 Clé API (optionnelle)'));
A(p("Sans clé, l'application fonctionne en mode démo : les commentaires des agents (plan, justifications, analyses, risques) proviennent de réponses simulées réalistes. En saisissant une clé DeepSeek dans les Paramètres, ces commentaires sont générés par un vrai LLM (validés par zod, repli sur le mock en cas d'échec). La génération d'images, elle, ne nécessite aucune clé."));

// 5. Guide d'utilisation
A(h1('5. Guide d\'utilisation pas à pas'));
A(p("Cette section décrit chaque écran de l'application, avec une capture et l'explication de tous les éléments."));

A(h2('5.1 E1 — Choix du scénario et paramétrage'));
A(p("L'écran d'accueil propose six scénarios prédéfinis. Chaque carte résume le secteur, le niveau HITL global et l'histogramme des priorités DFx du scénario."));
A(...fig('01_e1_scenarios.png', "Écran E1 : choix du scénario (six secteurs prédéfinis + projet vide)"));
A(table(['Scénario', 'Profil'],
  [['S1 Aérospatial / Sécurité critique', 'Fiabilité maximale, aucune génération autonome (HITL strict).'],
   ['S2 Industriel défaut (DN100)', "Corps de vanne papillon, DFx équilibrés — scénario de référence."],
   ['S3 Conception durable', 'Les KPI de durabilité (DFS) priment.'],
   ['S4 Fast MVP (startup)', 'Rapidité et coût avant exhaustivité, agents très autonomes.'],
   ['S5 Haute cadence', 'Pièce automobile, fabricabilité et assemblage dominants.'],
   ['S6 Custom', 'Tout produit, liberté totale de paramétrage.']],
  [3200, 6160]));
A(spacer());
A(p("Après sélection, deux blocs de paramétrage apparaissent : les priorités DFx (curseurs 1–5, avec un mode « industrie » qui applique un préréglage sectoriel) et les niveaux HITL par agent. Le panneau de synthèse rappelle votre rôle effectif."));
A(...fig('02_e1_config.png', "E1 : priorités DFx (curseurs + radar) et niveaux HITL par agent"));
A(lead('Priorités DFx', "déplacez chaque curseur de 1 (faible) à 5 (prioritaire). Le radar reflète immédiatement le profil ; ces poids servent au calcul du score composite des concepts."));
A(lead('Niveaux HITL', "réglez l'autonomie de chaque agent. Des incohérences éventuelles (ex. orchestrateur très autonome mais génération bridée) sont signalées."));
A(lead('Boutons', "« Configurer les contraintes techniques » mène à E2 ; pour un scénario prédéfini non modifié, « Lancer directement » saute à l'exécution."));

A(h2('5.2 E2 — Contraintes techniques'));
A(p("Cet écran définit le produit et ses contraintes chiffrées. Tout est éditable, ce qui rend le reste de la chaîne réellement piloté par vos saisies."));
A(...fig('03_e2_constraints.png', "E2 : paramètres produit, contraintes, imports simulés et aperçu composite"));
A(lead('Paramètres produit', "nom et fonction du produit (texte libre)."));
A(lead('Contraintes', "pression, températures min/max, masse maximale, MTBF cible, coût cible, paroi minimale, rugosité Ra. Ces valeurs alimentent la génération des concepts et le RAG."));
A(lead('Imports simulés', "« Importer depuis PLM/ERP » injecte des valeurs ; un conflit (ex. pression 16 bar vs 6 bar) ouvre une boîte de résolution, et votre choix est tracé dans l'ADT."));
A(lead('Langage naturel', "une description libre peut être convertie en contraintes (extraction)."));
A(lead('Aperçu composite', "le classement provisoire des concepts se met à jour selon vos priorités DFx."));
A(lead('Lancer les agents', "démarre l'exécution (E3). Le nom du produit est obligatoire."));

A(h2('5.3 E3 — Tableau de bord multi-agents'));
A(p("C'est le cœur de l'exécution. Les six agents s'enchaînent ; un bandeau de connecteurs s'anime, un diagramme de Gantt montre l'avancement et le thread numérique (ADT) se remplit en direct."));
A(h3('Modes d\'exécution : supervisé vs autonome'));
A(p("En haut à droite, un commutateur choisit le mode. En mode supervisé (pas à pas, par défaut), chaque agent s'arrête une fois sa tâche terminée et présente ce qu'il a fait : vous pouvez l'approuver, ou lui transmettre un ajustement, avant que l'agent suivant ne démarre. En mode autonome, toute la chaîne se déroule sans interruption."));
A(...fig('04_e3_gate.png', "E3 en mode supervisé : l'orchestrateur attend votre revue (approuver / ajuster / continuer sans interruption)"));
A(lead('Panneau de revue', "il résume le travail de l'agent (ex. « Plan d'exécution séquencé en 5 étapes. Risque clé : … »)."));
A(lead('Approuver & continuer', "valide l'étape (tracée dans l'ADT) et lance l'agent suivant."));
A(lead('Demander un ajustement', "vous saisissez une consigne ; elle est journalisée, l'agent la prend en compte, puis la chaîne avance."));
A(lead('Continuer sans interruption', "bascule en autonome et laisse les agents finir sans nouvelle pause."));
A(lead('Cartes agents', "chaque carte affiche le niveau HITL, le statut, le chrono et les derniers journaux ; l'agent en attente porte un badge « à valider »."));
A(p("Une fois la chaîne terminée, le bouton « Voir les concepts générés » apparaît."));
A(...fig('05_e3_done.png', "E3 : exécution terminée — plan, risque clé et note de durabilité, prêt pour les concepts"));

A(h3('5.3.1 Sous-écran d\'un agent'));
A(p("Un clic sur une carte (ou sur un nœud du graphe) ouvre le détail de l'agent : les sources interrogées avec leurs charges utiles (requête/réponse simulées), les sorties produites, et la matrice HITL expliquant ce que fait l'agent et ce que doit faire l'humain au niveau choisi."));
A(...fig('06_agent_subscreen.png', "Sous-écran d'un agent : sources interrogées, sorties (concepts FBS) et actions HITL"));

A(h3('5.3.2 Chaîne d\'orchestration et champs RAG'));
A(p("L'écran « Chaîne d'orchestration » présente un graphe de flux de type n8n : chaque nœud est un agent ou un connecteur Layer 3 (simulé), et les arêtes s'animent pendant l'exécution. En dessous, le bouton « Interroger le RAG » remplit les champs custom à partir de la base de connaissances."));
A(...fig('07_workflow_rag.png', "Chaîne d'orchestration (graphe n8n) et champs custom renseignés par le RAG"));
A(lead('Champs custom (RAG)', "pour le scénario DN100, ils proviennent de la base de connaissances (normes, matériau recommandé, contrainte réelle, MTBF terrain, mode de défaillance…). Pour un produit personnalisé, l'agent Récupération structure le brief en champs spécifiques au produit (normes déclarées, coût cible, budget masse, plage thermique, priorité DFx dominante…)."));
A(lead('Badge de source', "« Backend connecté » (vert) ou « Hors-ligne (simulé) » (orange) selon que l'API répond."));

A(h2('5.4 E4 — Concepts générés'));
A(p("Les concepts générés à partir de votre brief sont affichés en cartes et comparés sur un radar DFx. Le classement suit vos priorités."));
A(...fig('08_e4_concepts.png', "E4 : concepts générés, scores DFx, coût/masse et comparaison radar"));
A(lead('Carte concept', "rang, nom, matériau/procédé, coût, masse, faiblesse documentée et les cinq jauges DFx."));
A(lead('Recommandation', "selon le niveau de l'agent de génération, le concept de rang 1 peut être marqué « Recommandé »."));
A(lead('Radar DFx', "superpose les profils des concepts pour une comparaison visuelle immédiate."));
A(p("Les quatre archétypes générés couvrent des stratégies de fabrication distinctes : A monolithique (moulé), B assemblé/boulonné, C usiné CNC, D hybride (avec insert). Leurs matériaux et scores sont dérivés des contraintes du brief, et calculés de façon déterministe (mêmes entrées → mêmes scores)."));

A(h2('5.5 E5 — Détail du concept et Studio d\'image'));
A(p("Le détail d'un concept présente sa décomposition FBS, son pack de disponibilité DFx, la comparaison Bs vs Be et l'analyse de l'agent de simulation."));
A(...fig('09_e5_detail.png', "E5 : décomposition FBS (Fonction/Comportement/Structure), pack DFx et Bs vs Be"));
A(lead('F — Fonction', "les exigences fonctionnelles (débit, étanchéité, cycles thermiques, MTBF, masse…)."));
A(lead('B — Comportement', "comportement attendu (Be) et simulé (Bs) : contrainte max, flèche, tenue à la pression. Statut PASS si Bs respecte Be."));
A(lead('S — Structure', "matériau, procédé, paroi, et géométrie ; un schéma paramétrique illustre l'épaisseur de paroi."));
A(lead('Pack DFx', "chaque axe est noté avec un seuil PASS à 70, accompagné d'une justification (réelle via LLM, sinon simulée)."));
A(lead('Boucle de feedback', "pour le concept A, un scénario de données terrain peut déclencher une re-conception A → A-v2 (paroi +1 mm)."));
A(h3('Studio d\'image (IA)'));
A(p("Le Studio génère une image photoréaliste du produit à partir d'un prompt. Au chargement, un prompt par défaut est pré-rempli à partir de toutes les caractéristiques du concept (produit, matériau, procédé, géométrie, masse). Vous pouvez le modifier librement : l'image générée correspond exactement au texte."));
A(...fig('10_image_studio.png', "Studio d'image : rendu photoréaliste généré, prompt dérivé du concept, badge « Archivée dans le projet »"));
A(lead('Générer l\'image', "envoie le prompt au modèle (Pollinations / Flux) ; chaque génération utilise une graine aléatoire (regénérer donne une variante)."));
A(lead('Historique de session', "les itérations successives sont conservées sous forme de vignettes."));
A(lead('Archivage automatique', "si le backend est démarré, le pill vert « Archivée dans le projet » confirme que le fichier image est écrit dans le dossier du projet. Sinon, un avertissement orange « Hors-ligne — non archivée » invite à lancer le backend."));

A(h2('5.6 E6 — Sélection HITL'));
A(p("La sélection finale dépend du niveau HITL de l'orchestrateur, ce qui illustre concrètement les cinq régimes de collaboration."));
A(...fig('11_e6_selection.png', "E6 : sélection assistée selon le niveau HITL (ici recommandation + actions)"));
A(table(['Niveau', 'Comportement de la sélection'],
  [['L1 Opérateur', "chaque concept doit être approuvé explicitement."],
   ['L2 Collaborateur', "vous sélectionnez après revue ; possibilité de modifier les contraintes."],
   ['L3 Consultant', "l'IA classe, vous arbitrez entre les options recommandées."],
   ['L4 Approbateur', "l'orchestrateur présélectionne ; vous approuvez ou annulez."],
   ['L5 Observateur', "sélection autonome avec confirmation automatique (compte à rebours)."]],
  [2400, 6960]));
A(spacer());
A(lead('Carte éco-classement', "si la priorité DFS est élevée, une question contractuelle apparaît et peut prioriser le concept au meilleur score de durabilité."));

A(h2('5.7 E7 — Revue de jalon (Gate Review)'));
A(p("La revue de jalon synthétise la décision : concept retenu, score composite, conformité aux normes, risques résiduels et thread numérique complet. C'est aussi le point d'enregistrement du projet."));
A(...fig('12_e7_gate.png', "E7 : décision, conformité, risques résiduels et audit ADT ; enregistrement du projet"));
A(lead('Décision', "concept retenu, matériau/procédé et score composite."));
A(lead('Conformité', "badges des normes déclarées et seuil de conception circulaire (DFS ≥ 70)."));
A(lead('Risques résiduels', "exactement trois risques spécifiques (fiabilité, faiblesse du concept, durabilité) avec sévérité et mitigation."));
A(lead('Enregistrer le projet', "à l'arrivée sur cet écran, le projet est sauvegardé automatiquement ; un bandeau confirme le dossier créé. Le bouton « Enregistrer le projet » permet de re-sauvegarder, et « Exporter le rapport (.txt) » télécharge un résumé."));
A(lead('Audit ADT', "le thread numérique complet est consultable et exportable."));

A(h2('5.8 E8 — Glossaire'));
A(p("Le glossaire rassemble les définitions des termes du domaine (DFx, FBS, HITL, ADT, RAG, MTBF, etc.) pour une prise en main autonome."));
A(...fig('13_e8_glossary.png', "E8 : glossaire des notions clés"));

// 6. Persistence
A(h1('6. Persistance et dossiers de projet'));
A(p("Chaque projet possède son propre dossier sur disque, créé dès le démarrage et complété tout au long du cycle de vie."));
A(table(['Moment', 'Ce qui est écrit dans server/data/projects/<id>/'],
  [['Création du projet', 'brief.json (saisies utilisateur) + project.json (statut « draft »)'],
   ['Génération d\'une image', "images/<concept>_<itération>.jpg téléchargé automatiquement + images.json mis à jour"],
   ['Fin du projet (revue)', 'project.json, concepts.json, custom-fields.json, adt.json, images.json, summary.md, et le dossier images/']],
  [2600, 6760]));
A(spacer());
A(lead('summary.md', "un résumé lisible reprenant les entrées, les priorités DFx, le contexte RAG, les concepts, le concept retenu, les prompts d'images et tout le thread numérique."));
A(lead('Synchronisation base', "à l'enregistrement, le déroulé complet (concepts, scores, ADT, sélection) est aussi synchronisé dans SQLite ; l'endpoint de liste « GET /api/projects » permet de retrouver tous les projets stockés."));

// 7. RAG
A(h1('7. Le moteur RAG'));
A(p("Le RAG repose sur des embeddings parcimonieux (fréquence de termes, après suppression des mots vides et des accents) et une similarité cosinus sur la base de connaissances. Pour chaque champ à renseigner, une requête est exécutée, le meilleur document est sélectionné, puis une fonction d'extraction en tire la valeur structurée."));
A(p("Pour le scénario DN100, la base contient des sources simulées (normes EN 593/EN 12334, matériaux qualifiés et coûts, contrainte réelle du jumeau numérique, MTBF terrain, mode de défaillance…). Pour un produit personnalisé, l'absence d'enregistrements pertinents conduit l'agent Récupération à structurer directement le brief en champs clairs et spécifiques au produit, garantissant un résultat fonctionnel dans tous les cas."));

// 8. Concepts détaillés
A(h1('8. Notions détaillées'));
A(h2('8.1 Les cinq axes DFx'));
A(table(['Axe', 'Signification', 'Particularité'],
  [['DFM', 'Design for Manufacturing — fabricabilité', 'favorise les procédés matures, parois suffisantes'],
   ['DFA', 'Design for Assembly — assemblage', 'pénalise le nombre de pièces et de fixations'],
   ['DFR', 'Design for Reliability — fiabilité', 'fonction du MTBF capable et du coefficient de sécurité'],
   ['DFC', 'Design for Cost — coût', 'INVERSÉ : un coût élevé donne un score faible'],
   ['DFS', 'Design for Sustainability — durabilité', 'recyclabilité, CO₂, mono-matériau, indice de circularité']],
  [1100, 4660, 3600]));
A(spacer());
A(p("Le score composite d'un concept est la somme pondérée de ses cinq scores DFx par les priorités définies en E1/E2 ; il détermine le classement."));
A(h2('8.2 FBS et boucle Bs/Be'));
A(p("Un concept est décrit par sa Fonction (exigences), son Comportement (attendu Be, simulé Bs) et sa Structure (matériau, procédé, géométrie). Le statut est PASS si la contrainte et la flèche simulées respectent les attentes, sinon REDESIGN. Une dérive observée en service au-delà d'un seuil (5 %) peut déclencher la boucle de feedback et une re-conception."));
A(h2('8.3 Thread numérique (ADT)'));
A(p("Chaque action — sélection de scénario, plan, récupération, génération, approbations/ajustements humains, sélection, enregistrement — produit une entrée horodatée (agent, événement, source, niveau HITL, charge utile). Ce journal constitue la preuve d'auditabilité du processus."));

// 9. Référence API
A(h1('9. Référence des principaux points d\'API'));
A(table(['Méthode & route', 'Fonction'],
  [['GET /api/health', "état du service et compteurs"],
   ['GET /api/scenarios', "liste des scénarios de référence"],
   ['POST /api/projects', "créer un projet (crée aussi son dossier)"],
   ['GET /api/projects', "lister tous les projets stockés"],
   ['POST /api/projects/:id/retrieve-fields', "renseigner les champs custom via RAG"],
   ['GET/POST /api/projects/:id/concepts/:code/images', "session d'images d'un concept (archivage auto)"],
   ['POST /api/projects/:id/save', "enregistrer le run complet + écrire le dossier"],
   ['POST /api/retrieve', "recherche RAG générique (débogage/sources)"]],
  [4200, 5160]));

// 10. Conclusion
A(h1('10. Conclusion et perspectives'));
A(p("APDA démontre, sur un cas concret, comment articuler agents IA et expertise humaine dans la conception produit : orchestration multi-agents, supervision HITL configurable, évaluation DFx déterministe, modélisation FBS, RAG et génération d'images, le tout tracé dans un thread numérique et archivé projet par projet."));
A(p("Les perspectives naturelles sont : le branchement de vrais connecteurs d'entreprise (PLM/ERP/MES) à la place des simulations, l'intégration d'un solveur de simulation réel, l'usage d'un fournisseur d'images haute fidélité (par ex. gpt-image) et l'extension de la base de connaissances RAG à d'autres familles de produits."));

// ---------- assemble ----------
const doc = new Document({
  creator: 'APDA', title: 'Rapport APDA', description: 'Rapport détaillé du projet APDA',
  styles: {
    default: { document: { run: { font: 'Arial', size: 22, color: '222222' } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 30, bold: true, color: NAVY, font: 'Arial' },
        paragraph: { spacing: { before: 320, after: 160 }, outlineLevel: 0, border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: BLUE, space: 4 } } } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 25, bold: true, color: BLUE, font: 'Arial' },
        paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 1 } },
      { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 22, bold: true, color: '333333', font: 'Arial' },
        paragraph: { spacing: { before: 180, after: 100 }, outlineLevel: 2 } },
    ],
  },
  numbering: {
    config: [
      { reference: 'b', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 280 } } } }] },
      { reference: 'n', levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 280 } } } }] },
    ],
  },
  sections: [
    { properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } }, children: title },
    { properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } }, children: toc },
    { properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
      headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC', space: 2 } }, children: [new TextRun({ text: 'APDA — Rapport de projet', size: 16, color: GREY })] })] }) },
      footers: { default: new Footer({ children: [new Paragraph({ tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }], children: [new TextRun({ text: 'ENSAM · APDA', size: 16, color: GREY }), new TextRun({ text: '\tPage ', size: 16, color: GREY }), new TextRun({ children: [PageNumber.CURRENT], size: 16, color: GREY }), new TextRun({ text: ' / ', size: 16, color: GREY }), new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, color: GREY })] })] }) },
      children: body },
  ],
});

Packer.toBuffer(doc).then((buf) => { fs.writeFileSync(OUT, buf); console.log('WROTE', OUT, (buf.length / 1024 | 0) + 'KB'); });
