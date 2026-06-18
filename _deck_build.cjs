/* Builds the 12-slide French presentation (APDA) with pptxgenjs. Dark premium theme. */
const path = require('node:path');
const Pptx = require('pptxgenjs');
const ASSETS = path.resolve('_report_assets');

const C = {
  bg: '0E1726', bg2: '0A1020', card: '17223A', line: '24314D',
  ink: 'E8EDF4', sub: '9FB0C3', acc: '3B82F6', grn: '22C55E', amb: 'F59E0B', vio: '8B5CF6', cyan: '06B6D4',
};
const FH = 'Calibri'; // safe font
const NAT = { // native heights (all 2160 wide)
  '01_e1_scenarios.png': 1502, '02_e1_config.png': 2472, '03_e2_constraints.png': 1793,
  '04_e3_gate.png': 1689, '05_e3_done.png': 1502, '06_agent_subscreen.png': 1502,
  '07_workflow_rag.png': 1830, '08_e4_concepts.png': 1502, '09_e5_detail.png': 2496,
  '10_image_studio.png': 2598, '11_e6_selection.png': 1502, '12_e7_gate.png': 1502, '13_e8_glossary.png': 1502,
};
// fit image (native 2160 x h) into box (maxW,maxH) preserving ratio, centered in box
function fit(file, bx, by, maxW, maxH) {
  const r = NAT[file] / 2160;
  let w = maxW, h = w * r;
  if (h > maxH) { h = maxH; w = h / r; }
  return { path: path.join(ASSETS, file), x: bx + (maxW - w) / 2, y: by + (maxH - h) / 2, w, h };
}

const pptx = new Pptx();
pptx.defineLayout({ name: 'W', width: 13.333, height: 7.5 });
pptx.layout = 'W';
const W = 13.333, H = 7.5;

function base(dark) {
  const s = pptx.addSlide();
  s.background = { color: dark ? C.bg2 : C.bg };
  return s;
}
// kicker + title header used on content slides
function head(s, kicker, title) {
  s.addText(kicker.toUpperCase(), { x: 0.6, y: 0.42, w: 12, h: 0.3, fontFace: FH, fontSize: 12, bold: true, color: C.acc, charSpacing: 2 });
  s.addText(title, { x: 0.6, y: 0.72, w: 12.1, h: 0.7, fontFace: FH, fontSize: 28, bold: true, color: C.ink });
}
// framed screenshot (mat panel + image)
function shot(s, file, bx, by, maxW, maxH) {
  const f = fit(file, bx, by, maxW, maxH);
  s.addShape('roundRect', { x: f.x - 0.08, y: f.y - 0.08, w: f.w + 0.16, h: f.h + 0.16, rectRadius: 0.06, fill: { color: C.card }, line: { color: C.line, width: 1 } });
  s.addImage({ path: f.path, x: f.x, y: f.y, w: f.w, h: f.h });
}
function bullets(s, items, x, y, w, h, fs) {
  s.addText(items.map((t) => ({ text: t, options: { bullet: { code: '2022', indent: 14 }, color: C.ink, fontSize: fs || 15, paraSpaceAfter: 9 } })),
    { x, y, w, h, fontFace: FH, valign: 'top', lineSpacingMultiple: 1.05 });
}
function chip(s, x, y, w, h, label, col, sub) {
  s.addShape('roundRect', { x, y, w, h, rectRadius: 0.08, fill: { color: C.card }, line: { color: col, width: 1.25 } });
  s.addText([{ text: label, options: { fontSize: 13, bold: true, color: C.ink } }, ...(sub ? [{ text: '\n' + sub, options: { fontSize: 10, color: C.sub } }] : [])],
    { x: x + 0.1, y, w: w - 0.2, h, fontFace: FH, align: 'center', valign: 'middle' });
}
function pageFoot(s, n) {
  s.addText('APDA · ENSAM S8', { x: 0.6, y: 7.06, w: 6, h: 0.3, fontFace: FH, fontSize: 9, color: C.sub });
  s.addText(String(n) + ' / 12', { x: 11.0, y: 7.06, w: 1.7, h: 0.3, fontFace: FH, fontSize: 9, color: C.sub, align: 'right' });
}

// ---------------- Slide 1 — Title ----------------
(() => {
  const s = base(true);
  s.addShape('roundRect', { x: 0.6, y: 0.55, w: 2.0, h: 0.5, rectRadius: 0.1, fill: { color: C.acc } });
  s.addText('DÉMONSTRATEUR', { x: 0.6, y: 0.55, w: 2.0, h: 0.5, fontFace: FH, fontSize: 11, bold: true, color: 'FFFFFF', align: 'center', valign: 'middle', charSpacing: 1 });
  s.addText('APDA', { x: 0.6, y: 2.0, w: 12, h: 1.6, fontFace: FH, fontSize: 96, bold: true, color: C.ink });
  s.addText('Architecture Agentique de Développement Produit', { x: 0.62, y: 3.55, w: 12, h: 0.7, fontFace: FH, fontSize: 26, bold: true, color: C.acc });
  s.addText('Concevoir un produit physique avec une équipe d’agents IA — sous contrôle humain.', { x: 0.62, y: 4.25, w: 11.5, h: 0.5, fontFace: FH, fontSize: 16, italic: true, color: C.sub });
  // accent dots row
  ['Multi-agents', 'HITL', 'DFx', 'FBS', 'RAG', 'IA générative'].forEach((t, i) => {
    s.addShape('roundRect', { x: 0.62 + i * 1.95, y: 5.15, w: 1.8, h: 0.46, rectRadius: 0.1, fill: { color: C.card }, line: { color: C.line, width: 1 } });
    s.addText(t, { x: 0.62 + i * 1.95, y: 5.15, w: 1.8, h: 0.46, fontFace: FH, fontSize: 11, bold: true, color: C.ink, align: 'center', valign: 'middle' });
  });
  s.addShape('line', { x: 0.62, y: 6.35, w: 12.1, h: 0, line: { color: C.line, width: 1 } });
  s.addText('ENSAM — Génie Mécanique & Conception · Semestre 8', { x: 0.6, y: 6.5, w: 9, h: 0.4, fontFace: FH, fontSize: 14, bold: true, color: C.ink });
  s.addText('Juin 2026', { x: 9.6, y: 6.5, w: 3.1, h: 0.4, fontFace: FH, fontSize: 14, color: C.sub, align: 'right' });
})();

// ---------------- Slide 2 — Contexte / problème ----------------
(() => {
  const s = base(false);
  head(s, 'Contexte', 'Pourquoi des agents pour la conception produit ?');
  bullets(s, [
    'La conception mécanique combine normes, matériaux, simulation, coût et durabilité : un espace de décision vaste et multicritère.',
    'Les outils restent cloisonnés (PLM, ERP, CAO, MES) et la traçabilité des décisions est faible.',
    'L’IA peut accélérer — mais en ingénierie, l’humain doit garder l’autorité et tout doit être auditable.',
  ], 0.6, 1.85, 6.4, 3.2, 16);
  // right: three stat/idea cards
  const cards = [
    ['6', 'agents spécialisés', C.acc],
    ['5', 'niveaux de contrôle humain (HITL)', C.amb],
    ['100%', 'des actions tracées (thread numérique)', C.grn],
  ];
  cards.forEach((c, i) => {
    const y = 1.95 + i * 1.5;
    s.addShape('roundRect', { x: 7.4, y, w: 5.3, h: 1.3, rectRadius: 0.1, fill: { color: C.card }, line: { color: C.line, width: 1 } });
    s.addText(c[0], { x: 7.6, y: y + 0.12, w: 1.7, h: 1.05, fontFace: FH, fontSize: 44, bold: true, color: c[2], align: 'center', valign: 'middle' });
    s.addText(c[1], { x: 9.3, y: y + 0.12, w: 3.2, h: 1.05, fontFace: FH, fontSize: 15, color: C.ink, valign: 'middle' });
  });
  pageFoot(s, 2);
})();

// ---------------- Slide 3 — La chaîne des 6 agents ----------------
(() => {
  const s = base(false);
  head(s, 'Vue d’ensemble', 'Une chaîne de six agents, du brief au jalon');
  const ag = [
    ['1', 'Orchestrateur', 'plan', C.amb],
    ['2', 'Récupération', 'RAG', C.cyan],
    ['3', 'Génération', 'concepts', C.vio],
    ['4', 'Simulation', 'Bs vs Be', C.acc],
    ['5', 'DFx ×5', 'scores', C.grn],
    ['6', 'Documentation', 'ADT', '84CC16'],
  ];
  const n = ag.length, gap = 0.18, x0 = 0.6, bw = (12.13 - gap * (n - 1)) / n, y = 2.5, bh = 1.7;
  ag.forEach((a, i) => {
    const x = x0 + i * (bw + gap);
    s.addShape('roundRect', { x, y, w: bw, h: bh, rectRadius: 0.1, fill: { color: C.card }, line: { color: a[3], width: 1.25 } });
    s.addShape('ellipse', { x: x + bw / 2 - 0.28, y: y + 0.22, w: 0.56, h: 0.56, fill: { color: a[3] } });
    s.addText(a[0], { x: x + bw / 2 - 0.28, y: y + 0.22, w: 0.56, h: 0.56, fontFace: FH, fontSize: 18, bold: true, color: '0E1726', align: 'center', valign: 'middle' });
    s.addText(a[1], { x: x + 0.05, y: y + 0.92, w: bw - 0.1, h: 0.4, fontFace: FH, fontSize: 12.5, bold: true, color: C.ink, align: 'center' });
    s.addText(a[2], { x: x + 0.05, y: y + 1.28, w: bw - 0.1, h: 0.32, fontFace: FH, fontSize: 10.5, color: C.sub, align: 'center' });
    if (i < n - 1) s.addText('›', { x: x + bw - 0.02, y, w: gap + 0.04, h: bh, fontFace: FH, fontSize: 18, bold: true, color: C.sub, align: 'center', valign: 'middle' });
  });
  s.addText('Brief produit', { x: 0.6, y: 4.5, w: 2.4, h: 0.4, fontFace: FH, fontSize: 12, italic: true, color: C.sub });
  s.addText('Revue de jalon (Gate Review)', { x: 9.5, y: 4.5, w: 3.2, h: 0.4, fontFace: FH, fontSize: 12, italic: true, color: C.sub, align: 'right' });
  s.addText('À chaque étape, en mode supervisé, l’humain approuve ou ajuste avant de passer à l’agent suivant.', { x: 0.6, y: 5.35, w: 12.1, h: 0.5, fontFace: FH, fontSize: 15, color: C.ink });
  pageFoot(s, 3);
})();

// ---------------- Slide 4 — Concepts clés ----------------
(() => {
  const s = base(false);
  head(s, 'Fondamentaux', 'Cinq notions qui structurent APDA');
  const items = [
    ['HITL', 'Human-in-the-Loop : 5 niveaux d’autonomie, de l’Opérateur à l’Observateur.', C.amb],
    ['DFx', 'Évaluation multicritère : fabricabilité, assemblage, fiabilité, coût, durabilité.', C.grn],
    ['FBS', 'Fonction – Comportement – Structure : description complète d’un concept.', C.acc],
    ['ADT', 'Agentic Digital Thread : journal horodaté et auditable de toutes les actions.', C.vio],
    ['RAG', 'Récupération de connaissances pour enrichir le projet de champs vérifiés.', C.cyan],
  ];
  const n = items.length, gap = 0.2, x0 = 0.6, bw = (12.13 - gap * (n - 1)) / n, y = 2.1, bh = 3.6;
  items.forEach((it, i) => {
    const x = x0 + i * (bw + gap);
    s.addShape('roundRect', { x, y, w: bw, h: bh, rectRadius: 0.1, fill: { color: C.card }, line: { color: C.line, width: 1 } });
    s.addShape('ellipse', { x: x + bw / 2 - 0.45, y: y + 0.3, w: 0.9, h: 0.9, fill: { color: it[2] } });
    s.addText(it[0], { x: x + bw / 2 - 0.45, y: y + 0.3, w: 0.9, h: 0.9, fontFace: FH, fontSize: 15, bold: true, color: '0E1726', align: 'center', valign: 'middle' });
    s.addText(it[1], { x: x + 0.18, y: y + 1.45, w: bw - 0.36, h: 2.0, fontFace: FH, fontSize: 12.5, color: C.ink, align: 'center', valign: 'top', lineSpacingMultiple: 1.05 });
  });
  pageFoot(s, 4);
})();

// ---------------- Slide 5 — Architecture technique ----------------
(() => {
  const s = base(false);
  head(s, 'Architecture', 'Une application web full-stack, hors-ligne par défaut');
  const rows = [
    ['Frontend', 'React · TypeScript · Vite · Tailwind · Zustand', C.acc],
    ['Backend', 'Express · SQLite (node:sqlite) · API REST', C.grn],
    ['RAG', 'Embeddings + similarité cosinus sur base simulée', C.cyan],
    ['Image IA', 'Pollinations / Flux — sans clé, fidèle au prompt', C.vio],
    ['LLM texte', 'DeepSeek (compatible OpenAI) · mode démo simulé', C.amb],
  ];
  rows.forEach((r, i) => {
    const y = 1.95 + i * 0.92;
    s.addShape('roundRect', { x: 0.6, y, w: 6.5, h: 0.78, rectRadius: 0.08, fill: { color: C.card }, line: { color: C.line, width: 1 } });
    s.addShape('roundRect', { x: 0.78, y: y + 0.16, w: 1.7, h: 0.46, rectRadius: 0.08, fill: { color: r[2] } });
    s.addText(r[0], { x: 0.78, y: y + 0.16, w: 1.7, h: 0.46, fontFace: FH, fontSize: 12, bold: true, color: '0E1726', align: 'center', valign: 'middle' });
    s.addText(r[1], { x: 2.65, y, w: 4.35, h: 0.78, fontFace: FH, fontSize: 12.5, color: C.ink, valign: 'middle' });
  });
  // right: data flow vertical
  s.addText('FLUX DE DONNÉES', { x: 7.5, y: 1.9, w: 5.2, h: 0.3, fontFace: FH, fontSize: 12, bold: true, color: C.acc, charSpacing: 1 });
  const flow = ['Brief + contraintes', 'Agents (orchestration)', 'Concepts FBS + scores DFx', 'Revue + dossier de projet'];
  flow.forEach((t, i) => {
    const y = 2.35 + i * 1.0;
    s.addShape('roundRect', { x: 7.5, y, w: 5.2, h: 0.7, rectRadius: 0.08, fill: { color: C.card }, line: { color: C.acc, width: 1.1 } });
    s.addText(t, { x: 7.7, y, w: 4.8, h: 0.7, fontFace: FH, fontSize: 13.5, bold: true, color: C.ink, valign: 'middle' });
    if (i < flow.length - 1) s.addText('▼', { x: 9.9, y: y + 0.66, w: 0.4, h: 0.34, fontFace: FH, fontSize: 12, color: C.sub, align: 'center' });
  });
  pageFoot(s, 5);
})();

// ---------------- Slide 6 — Parcours utilisateur (timeline + shot) ----------------
(() => {
  const s = base(false);
  head(s, 'Parcours', 'Un flux guidé, du scénario au rapport');
  const steps = [['E1', 'Scénario'], ['E2', 'Contraintes'], ['E3', 'Agents'], ['E4', 'Concepts'], ['E5', 'Détail'], ['E6', 'Sélection'], ['E7', 'Gate Review']];
  const n = steps.length, gap = 0.12, x0 = 0.6, bw = (12.13 - gap * (n - 1)) / n, y = 1.95;
  steps.forEach((st, i) => {
    const x = x0 + i * (bw + gap);
    s.addShape('roundRect', { x, y, w: bw, h: 0.95, rectRadius: 0.08, fill: { color: C.card }, line: { color: C.acc, width: 1 } });
    s.addText(st[0], { x, y: y + 0.12, w: bw, h: 0.35, fontFace: FH, fontSize: 15, bold: true, color: C.acc, align: 'center' });
    s.addText(st[1], { x, y: y + 0.5, w: bw, h: 0.34, fontFace: FH, fontSize: 10.5, color: C.ink, align: 'center' });
  });
  bullets(s, [
    'Chaque écran est autonome et explicite ; l’ordre suit le cycle réel de conception.',
    'Le mode supervisé permet d’avancer pas à pas ; le mode autonome déroule tout.',
    'Bilingue (FR/EN) et thème clair/sombre.',
  ], 0.6, 3.25, 5.6, 3.0, 15);
  shot(s, '05_e3_done.png', 6.5, 3.2, 6.25, 3.55);
  pageFoot(s, 6);
})();

// ---------------- Slide 7 — E1 Scénario & paramétrage ----------------
(() => {
  const s = base(false);
  head(s, 'E1 — Démarrage', 'Choisir un scénario, régler priorités et HITL');
  bullets(s, [
    '6 scénarios prédéfinis : aérospatial, industriel (DN100), durable, MVP, automobile, custom.',
    'Priorités DFx réglables (curseurs 1–5) avec préréglages sectoriels.',
    'Niveau d’autonomie HITL configurable par agent.',
    'Possibilité de partir d’un projet entièrement vide.',
  ], 0.6, 1.95, 5.5, 4.4, 15);
  shot(s, '02_e1_config.png', 6.35, 1.85, 6.4, 5.0);
  pageFoot(s, 7);
})();

// ---------------- Slide 8 — E3 supervisé (flagship) ----------------
(() => {
  const s = base(false);
  head(s, 'E3 — Exécution', 'Supervision pas à pas : approuver ou ajuster');
  bullets(s, [
    'Chaque agent présente son travail puis attend votre revue.',
    'Approuver & continuer, ou transmettre un ajustement à l’agent.',
    '« Continuer sans interruption » bascule en mode autonome.',
    'Gantt d’avancement et thread numérique (ADT) en direct.',
  ], 0.6, 1.95, 5.4, 4.4, 15);
  shot(s, '04_e3_gate.png', 6.25, 1.85, 6.5, 5.0);
  pageFoot(s, 8);
})();

// ---------------- Slide 9 — E4/E5 concepts & FBS/DFx ----------------
(() => {
  const s = base(false);
  head(s, 'E4 / E5 — Concepts', 'Concepts évalués et décortiqués (FBS, DFx)');
  bullets(s, [
    '4 archétypes générés depuis le brief : moulé, boulonné, CNC, hybride.',
    'Scores DFx déterministes ; classement par score composite.',
    'Détail FBS : Fonction, Comportement (Bs vs Be), Structure.',
    'Pack de disponibilité DFx avec seuil PASS à 70.',
  ], 0.6, 1.95, 5.5, 4.4, 15);
  shot(s, '09_e5_detail.png', 6.45, 1.85, 6.3, 5.0);
  pageFoot(s, 9);
})();

// ---------------- Slide 10 — Studio d'image IA ----------------
(() => {
  const s = base(false);
  head(s, 'E5 — Studio d’image', 'Une image produit générée, fidèle au prompt');
  bullets(s, [
    'Prompt pré-rempli depuis toutes les caractéristiques du concept.',
    'Génération photoréaliste (modèle Flux), sans clé API.',
    'Historique d’itérations ; graine aléatoire à chaque rendu.',
    'Image archivée automatiquement dans le dossier du projet.',
  ], 0.6, 1.95, 5.4, 4.4, 15);
  shot(s, '10_image_studio.png', 6.55, 1.8, 6.2, 5.1);
  pageFoot(s, 10);
})();

// ---------------- Slide 11 — Persistance + RAG ----------------
(() => {
  const s = base(false);
  head(s, 'Données', 'Persistance par projet & récupération RAG');
  s.addText('UN DOSSIER PAR PROJET', { x: 0.6, y: 1.9, w: 6, h: 0.3, fontFace: FH, fontSize: 12, bold: true, color: C.acc, charSpacing: 1 });
  const files = ['brief.json — saisies utilisateur', 'concepts.json — concepts + scores DFx', 'custom-fields.json — contexte RAG', 'adt.json — thread numérique complet', 'images/ — images générées (.jpg)', 'summary.md — résumé lisible'];
  files.forEach((t, i) => {
    const y = 2.35 + i * 0.62;
    s.addShape('roundRect', { x: 0.6, y, w: 5.7, h: 0.5, rectRadius: 0.06, fill: { color: C.card }, line: { color: C.line, width: 1 } });
    s.addText(t, { x: 0.78, y, w: 5.4, h: 0.5, fontFace: FH, fontSize: 12.5, color: C.ink, valign: 'middle' });
  });
  s.addText('Créé au démarrage du projet, complété à la génération d’images, finalisé à la revue.', { x: 0.6, y: 6.2, w: 5.8, h: 0.6, fontFace: FH, fontSize: 12, italic: true, color: C.sub });
  shot(s, '07_workflow_rag.png', 6.6, 1.95, 6.15, 4.7);
  pageFoot(s, 11);
})();

// ---------------- Slide 12 — Conclusion ----------------
(() => {
  const s = base(true);
  s.addText('CONCLUSION', { x: 0.6, y: 0.7, w: 12, h: 0.35, fontFace: FH, fontSize: 13, bold: true, color: C.acc, charSpacing: 2 });
  s.addText('L’IA au service de l’ingénieur — pas à sa place', { x: 0.6, y: 1.1, w: 12.1, h: 1.0, fontFace: FH, fontSize: 32, bold: true, color: C.ink });
  bullets(s, [
    'APDA articule agents IA et expertise humaine : orchestration, supervision HITL, DFx déterministe, FBS, RAG et génération d’images.',
    'Tout est tracé dans un thread numérique et archivé projet par projet.',
    'Fonctionne pour le cas DN100 comme pour des produits entièrement personnalisés.',
  ], 0.6, 2.35, 12.1, 2.2, 17);
  s.addText('PERSPECTIVES', { x: 0.6, y: 4.7, w: 12, h: 0.3, fontFace: FH, fontSize: 13, bold: true, color: C.amb, charSpacing: 2 });
  const persp = [['Connecteurs réels', 'PLM / ERP / MES en production'], ['Simulation réelle', 'solveur intégré'], ['Image haute fidélité', 'fournisseur premium'], ['RAG étendu', 'nouvelles familles produit']];
  persp.forEach((p, i) => {
    const x = 0.6 + i * 3.05;
    s.addShape('roundRect', { x, y: 5.1, w: 2.85, h: 1.3, rectRadius: 0.1, fill: { color: C.card }, line: { color: C.line, width: 1 } });
    s.addText(p[0], { x: x + 0.15, y: 5.25, w: 2.55, h: 0.5, fontFace: FH, fontSize: 14, bold: true, color: C.acc });
    s.addText(p[1], { x: x + 0.15, y: 5.7, w: 2.55, h: 0.6, fontFace: FH, fontSize: 11.5, color: C.sub });
  });
  s.addText('APDA · Architecture Agentique de Développement Produit · ENSAM S8 · Juin 2026', { x: 0.6, y: 6.85, w: 12.1, h: 0.4, fontFace: FH, fontSize: 11, color: C.sub });
})();

pptx.writeFile({ fileName: 'Presentation_APDA.pptx' }).then((f) => console.log('WROTE', f));
