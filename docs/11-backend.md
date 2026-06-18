# 11 — Backend (API + database + RAG)

The demo ships an optional backend that the workflow connects to. The frontend
**degrades gracefully**: if the API is down, the workflow falls back to local
fixtures, so the offline demo keeps working.

## Stack

- **Node + TypeScript**, run with `tsx` (no build step). Code in `server/`.
- **SQLite** via the built-in `node:sqlite` (no native module to compile —
  important on Windows). DB file: `server/apda.db` (gitignored).
- **Express** REST API on **port 8787** (`PORT` to override).
- **RAG**: sparse term-frequency embeddings + cosine retrieval over a seeded
  knowledge base (`server/rag.ts`). Offline and deterministic — no API key. The
  embed/retrieve functions are isolated so a dense provider (OpenAI / DeepSeek /
  sentence-transformers + pgvector) can replace them later.

## Run

```bash
npm install
npm run db:reset      # migrate (fresh) + seed scenarios & knowledge base
npm run server        # API on http://localhost:8787  (tsx watch)
npm run dev           # frontend on http://localhost:5174 (proxies /api -> 8787)
# or both at once:
npm run dev:all
```

Scripts: `db:migrate`, `db:seed`, `db:reset` (`--reset` drops the DB), `server`,
`server:once`, `dev:all`. The Vite dev server proxies `/api` → `http://localhost:8787`
(`VITE_API_TARGET` to override); the client base path is `/api` (`VITE_API_URL`).

## Database template (`server/migrations/001_init.sql`)

Executable migrations + seed, modeled on the apda-demo domain (docs/02). Tables:

| Table | Role |
|---|---|
| `scenarios` | The 6 preconfigured scenarios (reference data). |
| `projects` | A workflow run instance (title, scenario, working brief, status). |
| `hitl_config` | Per-agent HITL level (L1–L5) for a project. |
| `concepts` + `dfx_scores` | FBS concepts and their **deterministic** DFx scores (LLM never scores). |
| `adt_entries` | Agentic Digital Thread — timestamped audit trail. |
| `feedback_events` | Closed feedback-loop events (field data → redesign). |
| `knowledge_documents` + `knowledge_chunks` | RAG corpus; `embedding` is a JSON sparse vector (→ pgvector in prod). |
| `custom_fields` | Workflow custom fields populated by the retrieval agent from the RAG. |

Migrations are tracked in `schema_migrations`. The SQL is portable to
Postgres/Supabase with minimal edits (TEXT JSON → JSONB, `datetime('now')` →
`now()`, add a `vector` column for embeddings).

## Scenario templates (file-sourced + RAGed)

The 6 scenario templates are **not hardcoded** — each lives in its own file under
`server/data/scenarios/` (`S1.json` … `S6.json`): structured fields (id, name, icon,
HITL level, DFx priorities, agent levels, product brief) plus a free-text
`knowledge` block. `server/scenarioFiles.ts` (`loadScenarios`) reads them and the
seed:

1. inserts them into the `scenarios` table, and
2. embeds each as a RAG `knowledge_documents` row (`connector = 'SCENARIO'`), so a
   scenario is retrievable — e.g. `POST /api/retrieve {"query":"aérospatial sécurité
   critique"}` returns the S1 template.

**Add or edit a scenario by dropping/editing a JSON file, then `npm run db:seed`** —
no code change. The frontend (`E1`) loads templates from `GET /api/scenarios` and
falls back to the bundled copy in `src/config/scenarios.ts` when the API is down
(the card list shows a "modèles : fichiers (RAG)" / "intégrés" badge accordingly).

## API

| Method & path | Purpose |
|---|---|
| `GET /api/health` | Liveness + row counts. |
| `GET /api/scenarios` · `/api/scenarios/:id` | Reference scenarios. |
| `POST /api/projects` | Create a run from `{scenarioId, brief?}`; S2 attaches the DN100 concept set + HITL config. |
| `GET /api/projects/:id` | Full project (brief, hitl, concepts+scores, custom fields, ADT count). |
| `GET /api/projects/:id/concepts` | FBS concepts + DFx scores. |
| **`POST /api/projects/:id/retrieve-fields`** | **The workflow↔backend+RAG link**: derive custom fields from the KB, persist, append an ADT entry. |
| `GET /api/projects/:id/custom-fields` | Persisted custom fields. |
| `POST`/`GET /api/projects/:id/adt` | Append / read ADT entries. |
| `POST /api/retrieve` | Generic RAG search `{query, k}` → ranked hits. |
| `GET /api/knowledge` | List knowledge documents (sources view). |
| `GET /api/projects/:id/concepts/:code/images` | A concept's image session (ordered iterations). |
| `POST /api/projects/:id/concepts/:code/images` | Append an image iteration `{prompt, params, kind?}`; writes an ADT entry. |

## Product image studio

After generation, each concept has an **image studio** (`/e5/:conceptId`): it renders
a parametric product image from the concept's specs, then iterates with prompts —
each generation is one iteration in a persisted **session** (`concept_images`).
The prompt deterministically drives the render via `src/lib/productImage.ts`
(`interpretPrompt`): view (`iso`/`cross`/`exploded`/`wireframe`), material/colorway,
finish (`matte`/`brushed`/`glossy`), background (`neutral`/`dark`/`light`/`workshop`/
`blueprint`) and dimension annotations. It works offline (in-memory session) and is
provider-agnostic — a real text-to-image model would set `kind='ai'` + `imageUrl`
and the same session/UI/DB still apply.

## Custom fields fed by the RAG

`POST /api/projects/:id/retrieve-fields` runs the retrieval agent: for each field
spec (`server/rag.ts`) it embeds a query, retrieves the best-matching document
from the knowledge base, and extracts a value — citing the **source** and
**confidence**. For the DN100 case it produces: applicable standards (EN 593 /
EN 12334), recommended material, material lead time, real mean stress, REX wall
minimum, field MTBF, and dominant failure mode. These render in the
**Champs custom (RAG)** panel on `/workflow` with a Backend-connected / Offline badge.
