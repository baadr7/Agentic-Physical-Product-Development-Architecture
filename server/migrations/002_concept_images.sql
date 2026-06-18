-- Product-image generation sessions. Each row is one iteration in a concept's
-- image session: a prompt + the resolved render params (and, for a real
-- text-to-image provider, an image_url). The frontend renders the parametric
-- image from `params`; `kind` distinguishes the offline render from a real AI image.

CREATE TABLE IF NOT EXISTS concept_images (
  id           TEXT PRIMARY KEY,
  project_id   TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  concept_code TEXT NOT NULL,                 -- 'A','B','C','D','A-v2'
  iteration    INTEGER NOT NULL,              -- 1-based, per (project, concept)
  prompt       TEXT NOT NULL,
  kind         TEXT NOT NULL DEFAULT 'procedural'
                 CHECK (kind IN ('procedural', 'ai')),
  params       TEXT,                          -- JSON render params
  image_url    TEXT,                          -- set when kind='ai'
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_concept_images_session
  ON concept_images(project_id, concept_code, iteration);
