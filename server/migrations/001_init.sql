-- APDA backend — initial schema (SQLite / node:sqlite).
-- Mirrors the apda-demo domain model (docs/02-data-model.md): scenarios,
-- projects (a workflow run), per-agent HITL config, FBS concepts + deterministic
-- DFx scores, the Agentic Digital Thread audit trail, feedback-loop events, and a
-- RAG knowledge base (documents + embedded chunks) that feeds workflow custom fields.
--
-- Written in portable SQL; ports to Postgres/Supabase with minimal edits
-- (TEXT JSON columns -> JSONB, datetime('now') -> now(), add pgvector for embeddings).

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version    TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- The 6 preconfigured scenarios (reference data).
CREATE TABLE IF NOT EXISTS scenarios (
  id             TEXT PRIMARY KEY,              -- 'S1'..'S6'
  name           TEXT NOT NULL,
  icon           TEXT NOT NULL,
  description    TEXT,
  dfx_priorities TEXT NOT NULL,                 -- JSON {dfm,dfa,dfr,dfc,dfs}
  agent_levels   TEXT NOT NULL,                 -- JSON {orchestrator,...}
  global_hitl    INTEGER NOT NULL,
  human_role     TEXT,
  product_brief  TEXT NOT NULL                  -- JSON (without priorities/levels)
);

-- A workflow run instance.
CREATE TABLE IF NOT EXISTS projects (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  scenario_id TEXT REFERENCES scenarios(id),
  brief       TEXT NOT NULL,                    -- JSON ProductBrief (working copy)
  status      TEXT NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft','running','completed','failed')),
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_projects_scenario ON projects(scenario_id);

-- Per-agent HITL level for a project.
CREATE TABLE IF NOT EXISTS hitl_config (
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  agent_id   TEXT NOT NULL,
  level      INTEGER NOT NULL CHECK (level BETWEEN 1 AND 5),
  PRIMARY KEY (project_id, agent_id)
);

-- Generated FBS concepts.
CREATE TABLE IF NOT EXISTS concepts (
  id               TEXT PRIMARY KEY,
  project_id       TEXT REFERENCES projects(id) ON DELETE CASCADE,
  code             TEXT NOT NULL,               -- 'A','B','C','D','A-v2'
  name             TEXT NOT NULL,
  material_process TEXT,
  cost_eur         REAL,
  mass_kg          REAL,
  weakness         TEXT,
  fbs              TEXT NOT NULL,               -- JSON {function,behaviour,structure}
  justifications   TEXT,                        -- JSON Record<DFxKey,string> | NULL
  derived_from     TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_concepts_project ON concepts(project_id);

-- Deterministic DFx scores (1-1 with a concept). The LLM never computes these.
CREATE TABLE IF NOT EXISTS dfx_scores (
  concept_id TEXT PRIMARY KEY REFERENCES concepts(id) ON DELETE CASCADE,
  dfm        REAL NOT NULL,
  dfa        REAL NOT NULL,
  dfr        REAL NOT NULL,
  dfc        REAL NOT NULL,
  dfs        REAL NOT NULL,
  composite  REAL
);

-- Agentic Digital Thread — timestamped audit trail (EU AI Act framing).
CREATE TABLE IF NOT EXISTS adt_entries (
  id         TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  ts         TEXT NOT NULL,                     -- ISO 8601
  agent      TEXT NOT NULL,                     -- AgentId | 'human' | 'system'
  event      TEXT NOT NULL,
  source     TEXT NOT NULL,
  hitl_level INTEGER,
  payload    TEXT                               -- JSON
);
CREATE INDEX IF NOT EXISTS idx_adt_project ON adt_entries(project_id, ts);

-- Closed feedback-loop events (field data -> redesign).
CREATE TABLE IF NOT EXISTS feedback_events (
  id            TEXT PRIMARY KEY,
  project_id    TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  step          INTEGER NOT NULL,
  phase         TEXT NOT NULL,
  deviation_pct REAL,
  ts            TEXT NOT NULL DEFAULT (datetime('now')),
  payload       TEXT
);

-- ===================== RAG knowledge base =====================

-- One row per retrievable source record (Layer 3 connectors: PLM/STD/ERP/DT/MES/...).
CREATE TABLE IF NOT EXISTS knowledge_documents (
  id         TEXT PRIMARY KEY,
  connector  TEXT NOT NULL,                     -- 'PLM','STD','ERP','DT','MES','SAV','CAD','AMDEC'
  source     TEXT NOT NULL,                     -- e.g. 'Windchill 12.1 (simulé)'
  title      TEXT NOT NULL,
  body       TEXT NOT NULL,                     -- natural-language text used for retrieval
  metadata   TEXT,                              -- JSON structured fields used for extraction
  confidence REAL,
  ts         TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_kdoc_connector ON knowledge_documents(connector);

-- Embedded chunks. embedding = JSON sparse term-frequency vector (swap for a
-- pgvector column + dense embeddings in production).
CREATE TABLE IF NOT EXISTS knowledge_chunks (
  id          TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES knowledge_documents(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  text        TEXT NOT NULL,
  embedding   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_kchunk_doc ON knowledge_chunks(document_id);

-- Workflow custom fields populated by the RAG retrieval agent.
CREATE TABLE IF NOT EXISTS custom_fields (
  id                 TEXT PRIMARY KEY,
  project_id         TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  agent              TEXT NOT NULL DEFAULT 'retrieval',
  key                TEXT NOT NULL,             -- machine key, e.g. 'recommended_material'
  label              TEXT NOT NULL,             -- human label
  value              TEXT,                      -- JSON-encoded value
  unit               TEXT,
  source_document_id TEXT REFERENCES knowledge_documents(id),
  source             TEXT,                      -- denormalized source name for display
  confidence         REAL,
  ts                 TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(project_id, key)
);
CREATE INDEX IF NOT EXISTS idx_cf_project ON custom_fields(project_id);
