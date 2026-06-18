// APDA backend — Express API over SQLite. Serves scenarios, workflow "projects",
// the RAG retrieval that populates workflow custom fields, FBS concepts, and the
// ADT audit trail. Run: npm run server (after npm run db:migrate && npm run db:seed).
import express from 'express';
import cors from 'cors';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDb, parseJson } from './db.ts';
import { migrate } from './migrate.ts';
import { deriveCustomFields, retrieve } from './rag.ts';
import { dn100Concepts } from './seed.data.ts';

const PORT = Number(process.env.PORT ?? 8787);
const uuid = () => globalThis.crypto.randomUUID();
const nowIso = () => new Date().toISOString();

// Per-project archive folders live here: server/data/projects/<id>/
const PROJECTS_DIR = resolve(dirname(fileURLToPath(import.meta.url)), 'data', 'projects');

const db = getDb();
migrate(); // ensure schema exists even if db:migrate wasn't run separately

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// ---- helpers ----

function appendAdt(
  projectId: string,
  e: { agent: string; event: string; source: string; hitlLevel?: number | null; payload?: unknown },
) {
  const id = uuid();
  db.prepare(
    `INSERT INTO adt_entries (id, project_id, ts, agent, event, source, hitl_level, payload)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, projectId, nowIso(), e.agent, e.event, e.source, e.hitlLevel ?? null, JSON.stringify(e.payload ?? null));
  return id;
}

function serializeConcept(row: any) {
  return {
    id: row.code,
    name: row.name,
    materialProcess: row.material_process,
    scores: { dfm: row.dfm, dfa: row.dfa, dfr: row.dfr, dfc: row.dfc, dfs: row.dfs },
    cost_eur: row.cost_eur,
    mass_kg: row.mass_kg,
    weakness: row.weakness,
    fbs: parseJson(row.fbs, {}),
    justifications: parseJson(row.justifications, null),
    derivedFrom: row.derived_from ?? undefined,
  };
}

function serializeCustomField(row: any) {
  return {
    key: row.key,
    label: row.label,
    value: parseJson(row.value, null),
    unit: row.unit ?? undefined,
    source: row.source ?? undefined,
    sourceDocumentId: row.source_document_id ?? null,
    confidence: row.confidence ?? null,
    agent: row.agent,
    ts: row.ts,
  };
}

function serializeImage(row: any) {
  return {
    id: row.id,
    conceptCode: row.concept_code,
    iteration: row.iteration,
    prompt: row.prompt,
    kind: row.kind,
    params: parseJson(row.params, null),
    imageUrl: row.image_url ?? null,
    createdAt: row.created_at,
  };
}

function loadProject(id: string) {
  const p = db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as any;
  if (!p) return null;
  const hitl = db.prepare('SELECT agent_id, level FROM hitl_config WHERE project_id = ?').all(id) as any[];
  const concepts = db
    .prepare(
      `SELECT c.*, s.dfm, s.dfa, s.dfr, s.dfc, s.dfs
         FROM concepts c LEFT JOIN dfx_scores s ON s.concept_id = c.id
        WHERE c.project_id = ? ORDER BY c.code`,
    )
    .all(id) as any[];
  const customFields = db.prepare('SELECT * FROM custom_fields WHERE project_id = ? ORDER BY ts').all(id) as any[];
  const adtCount = (db.prepare('SELECT COUNT(*) AS n FROM adt_entries WHERE project_id = ?').get(id) as any).n;
  return {
    id: p.id,
    title: p.title,
    scenarioId: p.scenario_id,
    status: p.status,
    brief: parseJson(p.brief, {}),
    hitl: Object.fromEntries(hitl.map((h) => [h.agent_id, h.level])),
    concepts: concepts.map(serializeConcept),
    customFields: customFields.map(serializeCustomField),
    adtCount,
    createdAt: p.created_at,
  };
}

// Derive + persist RAG custom fields if the project has none yet (so a saved
// project always carries the retrieved context). Mirrors /retrieve-fields.
function ensureCustomFields(projectId: string, scenarioId: string | null, brief: unknown) {
  const count = (db.prepare('SELECT COUNT(*) AS n FROM custom_fields WHERE project_id = ?').get(projectId) as any).n;
  if (count > 0) return;
  const fields = deriveCustomFields(db, { scenarioId, brief });
  const upsert = db.prepare(
    `INSERT INTO custom_fields (id, project_id, agent, key, label, value, unit, source_document_id, source, confidence, ts)
     VALUES (?, ?, 'retrieval', ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(project_id, key) DO UPDATE SET
       label = excluded.label, value = excluded.value, unit = excluded.unit,
       source_document_id = excluded.source_document_id, source = excluded.source,
       confidence = excluded.confidence, ts = excluded.ts`,
  );
  for (const f of fields) {
    upsert.run(uuid(), projectId, f.key, f.label, JSON.stringify(f.value), f.unit ?? null, f.sourceDocumentId, f.source, f.confidence, nowIso());
  }
}

// Human-readable Markdown summary of a saved project snapshot.
function buildSummaryMd(s: any): string {
  const L: string[] = [];
  const c = s.brief?.constraints ?? {};
  const selected = (s.concepts ?? []).find((x: any) => x.id === s.selectedConceptId) ?? null;
  L.push(`# ${s.brief?.name || s.title || 'Projet APDA'}`, '');
  L.push(`- **Projet** : ${s.id}`);
  L.push(`- **Scénario** : ${s.scenarioName ?? s.scenarioId ?? '—'}`);
  L.push(`- **Enregistré le** : ${s.savedAt}`);
  if (s.brief?.function) L.push(`- **Fonction** : ${s.brief.function}`);
  L.push('');
  L.push('## Contraintes (entrées)');
  for (const [k, v] of Object.entries(c)) L.push(`- ${k} : ${v}`);
  if (s.brief?.standards?.length) L.push(`- normes : ${s.brief.standards.join(', ')}`);
  L.push('', '## Priorités DFx');
  for (const [k, v] of Object.entries(s.brief?.dfxPriorities ?? {})) L.push(`- ${String(k).toUpperCase()} : ${v}/5`);
  L.push('', '## Contexte récupéré (RAG)');
  for (const f of s.customFields ?? []) L.push(`- ${f.label} : ${Array.isArray(f.value) ? f.value.join(' · ') : f.value}${f.unit ? ' ' + f.unit : ''} (${f.source ?? '—'})`);
  L.push('', '## Concepts générés');
  for (const x of s.concepts ?? []) {
    const sc = x.scores ?? {};
    L.push(`- **${x.name}** (${x.materialProcess ?? '—'}) — coût ${x.cost_eur}€, masse ${x.mass_kg}kg · DFM ${sc.dfm} DFA ${sc.dfa} DFR ${sc.dfr} DFC ${sc.dfc} DFS ${sc.dfs}`);
  }
  if (selected) L.push('', `## Concept retenu`, `- ${selected.name} (${selected.materialProcess ?? '—'})`);
  if ((s.images ?? []).length) {
    L.push('', '## Images générées (prompts)');
    for (const im of s.images) L.push(`- [${im.conceptCode} #${im.iteration}] ${im.prompt}${im.file ? ` → ${im.file}` : im.imageUrl ? ` → ${im.imageUrl}` : ''}`);
  }
  L.push('', `## Thread numérique (ADT) — ${(s.adt ?? []).length} entrées`);
  for (const e of s.adt ?? []) L.push(`- [${e.timestamp}] ${e.agent} · ${e.event} · ${e.source}${e.hitlLevel ? ' · L' + e.hitlLevel : ''}`);
  L.push('');
  return L.join('\n');
}

// ---- per-project folder helpers ----
const IMG_EXTS = ['jpg', 'png', 'webp'];
const projectDir = (id: string) => resolve(PROJECTS_DIR, id);
const safeCode = (code: string) => String(code).replace(/[^a-zA-Z0-9_-]/g, '_');

function writeJson(dir: string, name: string, content: unknown) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(resolve(dir, name), JSON.stringify(content, null, 2), 'utf8');
}

/** Relative path of an already-downloaded image file, or null if none on disk. */
function localImageFile(imgDir: string, code: string, iteration: number): string | null {
  for (const ext of IMG_EXTS) {
    const f = `${safeCode(code)}_${iteration}.${ext}`;
    if (existsSync(resolve(imgDir, f))) return `images/${f}`;
  }
  return null;
}

/** Fetch one image into <imgDir>/<code>_<iteration>.<ext>. Tolerant of failures. */
async function downloadImage(imgDir: string, im: { conceptCode: string; iteration: number; imageUrl?: string | null }): Promise<boolean> {
  if (!im.imageUrl) return false;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 25000);
    const r = await fetch(im.imageUrl, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!r.ok) return false;
    const ct = r.headers.get('content-type') ?? '';
    const ext = ct.includes('png') ? 'png' : ct.includes('webp') ? 'webp' : 'jpg';
    const buf = Buffer.from(await r.arrayBuffer());
    mkdirSync(imgDir, { recursive: true });
    writeFileSync(resolve(imgDir, `${safeCode(im.conceptCode)}_${im.iteration}.${ext}`), buf);
    return true;
  } catch {
    return false;
  }
}

/** Serialize image rows, tagging each with its local file path if downloaded. */
function imagesWithFiles(rows: any[], imgDir: string) {
  return rows.map((row) => {
    const im = serializeImage(row);
    return { ...im, file: localImageFile(imgDir, im.conceptCode, im.iteration) };
  });
}

/** Rewrite a project's images.json from the DB (used after each generation). */
function writeImagesJson(id: string) {
  const dir = projectDir(id);
  const rows = db.prepare('SELECT * FROM concept_images WHERE project_id = ? ORDER BY concept_code, iteration').all(id) as any[];
  writeJson(dir, 'images.json', imagesWithFiles(rows, resolve(dir, 'images')));
}

// ---- routes ----

app.get('/api/health', (_req, res) => {
  const counts = {
    scenarios: (db.prepare('SELECT COUNT(*) AS n FROM scenarios').get() as any).n,
    documents: (db.prepare('SELECT COUNT(*) AS n FROM knowledge_documents').get() as any).n,
    projects: (db.prepare('SELECT COUNT(*) AS n FROM projects').get() as any).n,
  };
  res.json({ ok: true, service: 'apda-api', time: nowIso(), counts });
});

app.get('/api/scenarios', (_req, res) => {
  const rows = db.prepare('SELECT * FROM scenarios ORDER BY id').all() as any[];
  res.json(
    rows.map((r) => ({
      id: r.id,
      name: r.name,
      icon: r.icon,
      description: r.description,
      dfxPriorities: parseJson(r.dfx_priorities, {}),
      agentLevels: parseJson(r.agent_levels, {}),
      globalHITL: r.global_hitl,
      humanRole: r.human_role,
      productBrief: parseJson(r.product_brief, {}),
    })),
  );
});

app.get('/api/scenarios/:id', (req, res) => {
  const r = db.prepare('SELECT * FROM scenarios WHERE id = ?').get(req.params.id) as any;
  if (!r) return res.status(404).json({ error: 'scenario_not_found' });
  res.json({
    id: r.id, name: r.name, icon: r.icon, description: r.description,
    dfxPriorities: parseJson(r.dfx_priorities, {}), agentLevels: parseJson(r.agent_levels, {}),
    globalHITL: r.global_hitl, humanRole: r.human_role, productBrief: parseJson(r.product_brief, {}),
  });
});

// Create a workflow project. For the DN100 valve scenario (S2) the FBS concept
// set is attached so the rest of the pipeline has concepts to work with.
app.post('/api/projects', (req, res) => {
  const { scenarioId, title, brief } = req.body ?? {};
  const scenario = scenarioId
    ? (db.prepare('SELECT * FROM scenarios WHERE id = ?').get(scenarioId) as any)
    : null;
  if (scenarioId && !scenario) return res.status(400).json({ error: 'unknown_scenario' });

  const workingBrief =
    brief ??
    (scenario
      ? { ...parseJson<any>(scenario.product_brief, {}), dfxPriorities: parseJson(scenario.dfx_priorities, {}), agentLevels: parseJson(scenario.agent_levels, {}) }
      : {});
  const projectTitle = title ?? (scenario ? scenario.name : 'Projet sans scénario');
  const id = uuid();

  db.prepare('INSERT INTO projects (id, title, scenario_id, brief, status) VALUES (?, ?, ?, ?, ?)')
    .run(id, projectTitle, scenarioId ?? null, JSON.stringify(workingBrief), 'draft');

  const levels = (workingBrief.agentLevels ?? {}) as Record<string, number>;
  const insHitl = db.prepare('INSERT INTO hitl_config (project_id, agent_id, level) VALUES (?, ?, ?)');
  for (const [agentId, level] of Object.entries(levels)) {
    if (typeof level === 'number') insHitl.run(id, agentId, level);
  }

  // attach the DN100 concept set for the valve scenario
  if (scenarioId === 'S2') {
    const insConcept = db.prepare(
      `INSERT INTO concepts (id, project_id, code, name, material_process, cost_eur, mass_kg, weakness, fbs)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const insScore = db.prepare(
      'INSERT INTO dfx_scores (concept_id, dfm, dfa, dfr, dfc, dfs) VALUES (?, ?, ?, ?, ?, ?)',
    );
    for (const c of dn100Concepts) {
      const cid = uuid();
      insConcept.run(cid, id, c.code, c.name, c.material_process, c.cost_eur, c.mass_kg, c.weakness, JSON.stringify(c.fbs));
      insScore.run(cid, c.scores.dfm, c.scores.dfa, c.scores.dfr, c.scores.dfc, c.scores.dfs);
    }
  }

  appendAdt(id, { agent: 'system', event: 'project_created', source: 'apda-api', payload: { scenarioId: scenarioId ?? null } });

  // Create the project's archive folder up front so the run is tracked from the start.
  try {
    const dir = projectDir(id);
    writeJson(dir, 'brief.json', workingBrief);
    writeJson(dir, 'project.json', {
      id, title: projectTitle, scenarioId: scenarioId ?? null, status: 'draft', createdAt: nowIso(), brief: workingBrief,
    });
  } catch {
    /* folder is best-effort; the run still works without it */
  }

  res.status(201).json(loadProject(id));
});

// List all stored projects (with counts + whether an archive folder exists).
app.get('/api/projects', (_req, res) => {
  const rows = db.prepare('SELECT id, title, scenario_id, status, created_at, updated_at FROM projects ORDER BY datetime(created_at) DESC').all() as any[];
  res.json(
    rows.map((r) => ({
      id: r.id,
      title: r.title,
      scenarioId: r.scenario_id,
      status: r.status,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      concepts: (db.prepare('SELECT COUNT(*) AS n FROM concepts WHERE project_id = ?').get(r.id) as any).n,
      adt: (db.prepare('SELECT COUNT(*) AS n FROM adt_entries WHERE project_id = ?').get(r.id) as any).n,
      images: (db.prepare('SELECT COUNT(*) AS n FROM concept_images WHERE project_id = ?').get(r.id) as any).n,
      saved: existsSync(resolve(PROJECTS_DIR, r.id)),
    })),
  );
});

app.get('/api/projects/:id', (req, res) => {
  const p = loadProject(req.params.id);
  if (!p) return res.status(404).json({ error: 'project_not_found' });
  res.json(p);
});

app.get('/api/projects/:id/concepts', (req, res) => {
  const p = loadProject(req.params.id);
  if (!p) return res.status(404).json({ error: 'project_not_found' });
  res.json(p.concepts);
});

// THE workflow ↔ backend + RAG link: the retrieval agent pulls custom fields from
// the knowledge base, persists them, and records the action on the ADT.
app.post('/api/projects/:id/retrieve-fields', (req, res) => {
  const proj = db.prepare('SELECT scenario_id, brief FROM projects WHERE id = ?').get(req.params.id) as any;
  if (!proj) return res.status(404).json({ error: 'project_not_found' });

  const fields = deriveCustomFields(db, { scenarioId: proj.scenario_id, brief: parseJson(proj.brief, {}) });
  const upsert = db.prepare(
    `INSERT INTO custom_fields (id, project_id, agent, key, label, value, unit, source_document_id, source, confidence, ts)
     VALUES (?, ?, 'retrieval', ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(project_id, key) DO UPDATE SET
       label = excluded.label, value = excluded.value, unit = excluded.unit,
       source_document_id = excluded.source_document_id, source = excluded.source,
       confidence = excluded.confidence, ts = excluded.ts`,
  );
  for (const f of fields) {
    upsert.run(
      uuid(), req.params.id, f.key, f.label, JSON.stringify(f.value), f.unit ?? null,
      f.sourceDocumentId, f.source, f.confidence, nowIso(),
    );
  }
  const hitl = db.prepare("SELECT level FROM hitl_config WHERE project_id = ? AND agent_id = 'retrieval'").get(req.params.id) as any;
  appendAdt(req.params.id, {
    agent: 'retrieval',
    event: 'custom_fields_populated',
    source: proj.scenario_id === 'S2' ? 'RAG (base de connaissances)' : 'Brief produit structuré',
    hitlLevel: hitl?.level ?? null,
    payload: { count: fields.length, keys: fields.map((f) => f.key) },
  });

  const rows = db.prepare('SELECT * FROM custom_fields WHERE project_id = ? ORDER BY ts').all(req.params.id) as any[];
  res.json({ customFields: rows.map(serializeCustomField) });
});

app.get('/api/projects/:id/custom-fields', (req, res) => {
  const rows = db.prepare('SELECT * FROM custom_fields WHERE project_id = ? ORDER BY ts').all(req.params.id) as any[];
  res.json(rows.map(serializeCustomField));
});

app.post('/api/projects/:id/adt', (req, res) => {
  const exists = db.prepare('SELECT id FROM projects WHERE id = ?').get(req.params.id);
  if (!exists) return res.status(404).json({ error: 'project_not_found' });
  const { agent, event, source, hitlLevel, payload } = req.body ?? {};
  if (!agent || !event || !source) return res.status(400).json({ error: 'missing_fields' });
  const id = appendAdt(req.params.id, { agent, event, source, hitlLevel, payload });
  res.status(201).json({ id });
});

app.get('/api/projects/:id/adt', (req, res) => {
  const rows = db.prepare('SELECT * FROM adt_entries WHERE project_id = ? ORDER BY ts').all(req.params.id) as any[];
  res.json(
    rows.map((r) => ({
      id: r.id, timestamp: r.ts, agent: r.agent, event: r.event,
      source: r.source, hitlLevel: r.hitl_level ?? undefined, payload: parseJson(r.payload, null),
    })),
  );
});

// ---- product image sessions ----
// A concept's image session is an ordered list of prompt iterations. Images are
// generated client-side by a text-to-image provider (Pollinations AI); this just
// persists the session — kind='ai' with the generated imageUrl and its seed.
app.get('/api/projects/:id/concepts/:code/images', (req, res) => {
  const rows = db
    .prepare('SELECT * FROM concept_images WHERE project_id = ? AND concept_code = ? ORDER BY iteration')
    .all(req.params.id, req.params.code) as any[];
  res.json(rows.map(serializeImage));
});

app.post('/api/projects/:id/concepts/:code/images', (req, res) => {
  const exists = db.prepare('SELECT id FROM projects WHERE id = ?').get(req.params.id);
  if (!exists) return res.status(404).json({ error: 'project_not_found' });
  const { prompt, params, kind, imageUrl } = req.body ?? {};
  if (typeof prompt !== 'string' || prompt.trim().length === 0) return res.status(400).json({ error: 'missing_prompt' });

  const last = db
    .prepare('SELECT MAX(iteration) AS m FROM concept_images WHERE project_id = ? AND concept_code = ?')
    .get(req.params.id, req.params.code) as any;
  const iteration = (last?.m ?? 0) + 1;
  db.prepare(
    `INSERT INTO concept_images (id, project_id, concept_code, iteration, prompt, kind, params, image_url, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    uuid(), req.params.id, req.params.code, iteration, prompt,
    kind === 'ai' ? 'ai' : 'procedural', JSON.stringify(params ?? null), imageUrl ?? null, nowIso(),
  );
  appendAdt(req.params.id, {
    agent: 'generation',
    event: 'image_generated',
    source: 'Studio image (Pollinations AI · Flux)',
    payload: { concept: req.params.code, iteration, prompt },
  });

  const rows = db
    .prepare('SELECT * FROM concept_images WHERE project_id = ? AND concept_code = ? ORDER BY iteration')
    .all(req.params.id, req.params.code) as any[];
  res.status(201).json({ iteration, session: rows.map(serializeImage) });

  // Archive the generated image into the project folder automatically (detached so
  // the response stays fast; the file lands a moment later, then images.json syncs).
  if (kind === 'ai' && typeof imageUrl === 'string' && imageUrl) {
    const dir = projectDir(req.params.id);
    void (async () => {
      try {
        await downloadImage(resolve(dir, 'images'), { conceptCode: req.params.code, iteration, imageUrl });
        writeImagesJson(req.params.id);
      } catch {
        /* best-effort archiving */
      }
    })();
  }
});

// ---- save a complete project run + write its archive folder ----
// Syncs the full client-side run (generated concepts, DFx scores, ADT, selection)
// into the DB, then writes server/data/projects/<id>/ with everything: the brief
// the user entered, the retrieved RAG context, the generated concepts/outputs, the
// image prompts, the digital thread, plus a human-readable summary.md.
app.post('/api/projects/:id/save', async (req, res) => {
  const id = req.params.id;
  const proj = db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as any;
  if (!proj) return res.status(404).json({ error: 'project_not_found' });

  const body = req.body ?? {};
  const brief = body.brief ?? parseJson(proj.brief, {});
  const concepts: any[] = Array.isArray(body.concepts) ? body.concepts : [];
  const adt: any[] = Array.isArray(body.adt) ? body.adt : [];
  const selectedConceptId = body.selectedConceptId ?? null;
  const guidanceAnswers = body.guidanceAnswers ?? {};
  const feedbackLoop = body.feedbackLoop ?? null;
  const scenarioName = body.scenarioName ?? proj.title;
  const runMode = body.runMode ?? null;

  // 1) sync the run into the DB so the stored project is complete (not just the seed).
  db.exec('BEGIN');
  try {
    db.prepare('UPDATE projects SET brief = ?, status = ?, updated_at = ? WHERE id = ?')
      .run(JSON.stringify(brief), 'completed', nowIso(), id);

    db.prepare('DELETE FROM concepts WHERE project_id = ?').run(id);
    const insC = db.prepare(
      `INSERT INTO concepts (id, project_id, code, name, material_process, cost_eur, mass_kg, weakness, fbs, justifications, derived_from)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const insS = db.prepare('INSERT INTO dfx_scores (concept_id, dfm, dfa, dfr, dfc, dfs, composite) VALUES (?, ?, ?, ?, ?, ?, ?)');
    for (const c of concepts) {
      const cid = uuid();
      insC.run(
        cid, id, c.id, c.name, c.materialProcess ?? null, c.cost_eur ?? null, c.mass_kg ?? null,
        c.weakness ?? null, JSON.stringify(c.fbs ?? {}), c.justifications ? JSON.stringify(c.justifications) : null, c.derivedFrom ?? null,
      );
      const sc = c.scores;
      if (sc) insS.run(cid, sc.dfm, sc.dfa, sc.dfr, sc.dfc, sc.dfs, c.composite ?? null);
    }

    if (adt.length > 0) {
      db.prepare('DELETE FROM adt_entries WHERE project_id = ?').run(id);
      const insA = db.prepare('INSERT INTO adt_entries (id, project_id, ts, agent, event, source, hitl_level, payload) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
      for (const e of adt) {
        insA.run(e.id ?? uuid(), id, e.timestamp ?? nowIso(), e.agent ?? 'system', e.event ?? 'event', e.source ?? '', e.hitlLevel ?? null, JSON.stringify(e.payload ?? null));
      }
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    return res.status(500).json({ error: 'save_failed', detail: String(err) });
  }

  // 2) make sure retrieved context exists, then assemble from the DB (source of truth).
  ensureCustomFields(id, proj.scenario_id, brief);
  const customFields = (db.prepare('SELECT * FROM custom_fields WHERE project_id = ? ORDER BY ts').all(id) as any[]).map(serializeCustomField);
  const imageRows = db.prepare('SELECT * FROM concept_images WHERE project_id = ? ORDER BY concept_code, iteration').all(id) as any[];

  const savedAt = nowIso();

  // 3) write the per-project folder, downloading any not-yet-archived images.
  const dir = projectDir(id);
  let files: string[];
  try {
    mkdirSync(dir, { recursive: true });
    const imgDir = resolve(dir, 'images');
    for (const row of imageRows) {
      const im = serializeImage(row);
      if (im.kind === 'ai' && im.imageUrl && !localImageFile(imgDir, im.conceptCode, im.iteration)) {
        await downloadImage(imgDir, im);
      }
    }
    const savedImages = imagesWithFiles(imageRows, imgDir);
    const snapshot = {
      id, title: proj.title, scenarioId: proj.scenario_id, scenarioName, savedAt, runMode,
      brief, customFields, concepts, selectedConceptId, guidanceAnswers, feedbackLoop, images: savedImages, adt,
    };
    const payloads: Record<string, unknown> = {
      'project.json': snapshot,
      'brief.json': brief,
      'concepts.json': concepts,
      'custom-fields.json': customFields,
      'adt.json': adt,
      'images.json': savedImages,
    };
    for (const [name, content] of Object.entries(payloads)) {
      writeFileSync(resolve(dir, name), JSON.stringify(content, null, 2), 'utf8');
    }
    writeFileSync(resolve(dir, 'summary.md'), buildSummaryMd(snapshot), 'utf8');
    files = [...Object.keys(payloads), 'summary.md'];
    const nImg = savedImages.filter((i: any) => i.file).length;
    if (nImg > 0) files.push(`images/ (${nImg})`);
  } catch (err) {
    return res.status(500).json({ error: 'write_failed', detail: String(err) });
  }

  appendAdt(id, { agent: 'doc', event: 'project_saved', source: 'Documentation Agent', payload: { dir: `server/data/projects/${id}`, files } });
  res.json({ id, dir: `server/data/projects/${id}`, files, savedAt });
});

// Generic RAG search (debugging / "sources" view).
app.post('/api/retrieve', (req, res) => {
  const { query, k } = req.body ?? {};
  if (typeof query !== 'string' || query.length === 0) return res.status(400).json({ error: 'missing_query' });
  const hits = retrieve(db, query, typeof k === 'number' ? k : 5);
  res.json({ query, hits });
});

app.get('/api/knowledge', (_req, res) => {
  const rows = db.prepare('SELECT id, connector, source, title, body, confidence, ts FROM knowledge_documents ORDER BY connector').all() as any[];
  res.json(rows);
});

app.listen(PORT, () => {
  console.log(`[apda-api] listening on http://localhost:${PORT}`);
});
