// Seeds reference data: the scenario templates (from files) and the RAG knowledge
// base (connector documents + one embedded chunk each + one document per scenario).
// Idempotent — clears and re-inserts reference tables only; never touches user data
// (projects, custom_fields, adt_entries, concept_images).
import { getDb } from './db.ts';
import { migrate } from './migrate.ts';
import { embed } from './rag.ts';
import { knowledgeCorpus } from './seed.data.ts';
import { loadScenarios, scenarioKnowledgeText } from './scenarioFiles.ts';

const ISO = (daysAgo: number) => new Date(Date.now() - daysAgo * 86400000).toISOString();
const uuid = () => globalThis.crypto.randomUUID();

export function seed(): { scenarios: number; documents: number; chunks: number } {
  migrate();
  const db = getDb();
  const scenarios = loadScenarios();

  const tx = () => {
    // --- scenarios (from server/data/scenarios/*.json) ---
    db.exec('DELETE FROM scenarios;');
    const insScenario = db.prepare(
      `INSERT INTO scenarios (id, name, icon, description, dfx_priorities, agent_levels, global_hitl, human_role, product_brief)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const s of scenarios) {
      insScenario.run(
        s.id, s.name, s.icon, s.description,
        JSON.stringify(s.dfx_priorities), JSON.stringify(s.agent_levels),
        s.global_hitl, s.human_role, JSON.stringify(s.product_brief),
      );
    }

    // --- knowledge base (documents + one embedded chunk per document) ---
    db.exec('DELETE FROM knowledge_chunks;');
    db.exec('DELETE FROM knowledge_documents;');
    const insDoc = db.prepare(
      `INSERT INTO knowledge_documents (id, connector, source, title, body, metadata, confidence, ts)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const insChunk = db.prepare(
      `INSERT INTO knowledge_chunks (id, document_id, chunk_index, text, embedding) VALUES (?, ?, ?, ?, ?)`,
    );
    const addDoc = (connector: string, source: string, title: string, body: string, metadata: unknown, confidence: number, ts: string) => {
      const docId = uuid();
      insDoc.run(docId, connector, source, title, body, JSON.stringify(metadata), confidence, ts);
      const text = `${title}. ${body}`;
      insChunk.run(uuid(), docId, 0, text, JSON.stringify(embed(text)));
    };

    let chunks = 0;
    // connector fixtures
    for (const d of knowledgeCorpus) {
      addDoc(d.connector, d.source, d.title, d.body, d.metadata, d.confidence, ISO(d.daysAgo));
      chunks += 1;
    }
    // scenario templates — each file becomes a retrievable RAG document
    for (const s of scenarios) {
      addDoc('SCENARIO', `Modèle de scénario (${s.id})`, `${s.id} — ${s.name}`, scenarioKnowledgeText(s), s, 1.0, ISO(0));
      chunks += 1;
    }
    return chunks;
  };

  // Reseeding reference data wipes scenarios + knowledge docs; user data (projects,
  // custom_fields) may FK-reference them, so relax enforcement for this reset.
  // Scenario ids are stable (S1..S6) so project references stay valid; db:reset
  // gives a fully clean DB.
  let chunks = 0;
  db.exec('PRAGMA foreign_keys = OFF');
  db.exec('BEGIN');
  try {
    chunks = tx();
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  } finally {
    db.exec('PRAGMA foreign_keys = ON');
  }

  const result = { scenarios: scenarios.length, documents: knowledgeCorpus.length + scenarios.length, chunks };
  console.log('[seed] done', result);
  return result;
}

if (process.argv[1] && process.argv[1].includes('seed')) {
  seed();
}
