FastAPI skeleton for Makerkit

Quick start (virtualenv):

1. cd apps/api
2. python -m venv .venv; .\.venv\Scripts\Activate.ps1
3. pip install --upgrade pip
4. pip install -r requirements.txt
5. uvicorn main:app --reload --port 8000

Endpoints:
- GET /health
- GET /api/v1/projects
- POST /api/v1/runs
- POST /api/v1/llm/normalize-brief
 - POST /api/v1/diffusion/generate (prompt -> image; optional sketch/controlnet)
 - POST /api/v1/sketch/upload (PNG/JPEG/SVG base64, returns sketch_id + SVG embed)
 - POST /api/v1/variants/{variant_id}/cad/export (STEP/STL generation + presigned/data URLs)
 - POST /api/v1/fem/solve-general (plate elasticity synthetic/FEA backend)
 - POST /api/v1/topopt/advanced-compliance (iterative SIMP compliance stub)
 - POST /api/v1/import/variants (CSV/XLSX bulk variant import; auto scoring)
 - GET  /api/v1/pareto/{run_id} (multi-objective Pareto front)
 - POST /api/v1/variants/{variant_id}/feedback (adaptive weighting updates)
 - GET  /api/v1/report/dfx/{run_id} (narrative DfX text report)
 - POST /api/v1/security/moderate (prompt content moderation stub)
 - POST /api/v1/exports/presign (generic artifact presign: pdf|zip|image|stl|step|fem-stress|cad-step|cad-stl)

This is a minimal prototype to integrate with the frontend later.

Optional configuration:
- To persist runs/projects to Supabase (Postgres) via the REST API, set the environment variables:
	- SUPABASE_URL (e.g. https://<project-ref>.supabase.co)
	- SUPABASE_KEY (service_role key ONLY for admin/seed operations)
	- SUPABASE_ANON_KEY (anon public key for frontend use; not required here)

	When configured, the API will use the Supabase REST endpoints (/rest/v1/<table>) to read/write
	`projects` and `runs` tables. See `schema.sql` for a suggested schema.

- For background worker / MLflow integration, optionally set:
	- MLFLOW_TRACKING_URI to enable MLflow logging (the worker will attempt to import `mlflow`).
	- MISTRAL_API_KEY to enable Mistral LLM features (brief normalization, prompt generation)
	- MISTRAL_MODEL (default: mistral-small-latest)
	- MISTRAL_API_BASE (default: https://api.mistral.ai)

100% free local LLM via Ollama:
- Install Ollama and pull a free model (e.g., `mistral:7b-instruct`).
- Env vars (optional; defaults shown):
	- `OLLAMA_HOST=http://127.0.0.1:11434`
	- `OLLAMA_MODEL=mistral:7b-instruct`
- The API will prefer local Ollama first; if not available, it will use Mistral API only if `MISTRAL_API_KEY` is set.

Supabase Setup (Persistence):
1. Create a Supabase project, copy the project ref (dashboard shows URL pattern https://<ref>.supabase.co).
2. In Project Settings > API: copy the service_role key and place in `apps/api/.env` as `SUPABASE_KEY=...`.
3. Copy the anon key for the web app; place in `apps/web/.env.local` as `NEXT_PUBLIC_SUPABASE_ANON_KEY=...`.
4. Apply schema: open Supabase SQL Editor and paste `supabase/migrations/001_create_schema.sql`, run it.
5. Verify schema: `python apply_schema.py` should report tables exist.
6. Seed demo data: `python seed_supabase.py dev@example.com DevPass123!` -> prints JSON summary.
7. Run tests: `python -m pytest tests/test_runs.py -q` (includes Supabase-specific tests when env set).

Seeding Troubleshooting:
- 401 errors almost always mean you used the anon key; ensure the key decodes with role `service_role` (use `python env_check.py`).
- Inline comments in `.env` must not trail the key value; keep the key alone on its line.

Variants & Processing:
- Creating a run schedules background processing which inserts a synthetic variant + DfX summary.
- For tests needing an empty variant list, send `skip_processing: true` in the POST body.
- Endpoint `GET /api/v1/runs/{run_id}/variants` returns [] when Supabase run exists but no variants yet; returns synthetic variant in in-memory mode only.

LLM Enrichment:
- With `MISTRAL_API_KEY` or local Ollama configured, worker generates prompts and stores a brief DfX summary in `runs.metadata.dfx_summary` and `prompts` table.

Security / Production Notes:
- Never expose the service_role key to the browser or commit it to public repos.
- Prefer a direct Postgres connection (pg driver) for high-volume operations; REST is fine for early prototypes.
- Enable RLS policies (included in migration) and confirm they are active.
- Add rate limiting / auth middleware for endpoints creating runs/projects.

Deployment Checklist:
- [ ] Set real `SUPABASE_URL`, `SUPABASE_KEY` (service_role) in server environment.
- [ ] Apply schema & verify RLS policies.
- [ ] Configure `NEXT_PUBLIC_SUPABASE_URL` and anon key in web app.
- [ ] Set `MISTRAL_API_KEY` or install/launch Ollama if using LLM enrichment.
- [ ] Configure object storage bucket in Supabase (already uses `artifacts` by default) and confirm uploads.
- [ ] (Optional) Configure S3/MinIO creds for presign (EXPORTS_BUCKET, AWS_ACCESS_KEY_ID/SECRET, AWS_REGION).
- [ ] Consider enabling Celery for scalable run processing (set `CELERY_ENABLED=1`).

Notes:
- This is a development skeleton. In production, prefer direct DB connections, secure service keys,
	and a proper worker queue (Celery / RQ / Prefect) with object storage for artifacts.
- With `MISTRAL_API_KEY` set, the worker will attempt to enrich runs by generating prompts and a DfX
	summary using Mistral, saving prompts to the `prompts` table and the summary in `runs.metadata`.
- With Ollama running locally, the same enrichment works 100% free using `OLLAMA_MODEL`.

MLflow install notes (optional):
- MLflow is optional and not installed by default to avoid Windows build issues with NumPy on Python 3.14.
- If you need MLflow, prefer Python 3.12 and install extras:
	- pip install -r requirements-mlflow.txt
	- then set `MLFLOW_TRACKING_URI` and restart the API/worker
	- The worker will skip MLflow gracefully if import fails.

## New Features (2024 Q4 Update)

### Materials Database
CRUD endpoints for managing materials with physical properties for FEM/scoring realism:
- `POST /api/v1/materials` - Create material (admin only)
- `GET /api/v1/materials` - List materials for tenant (auto-seeds PLA, ABS, PETG, Nylon, Steel, Aluminum)
- `GET /api/v1/materials/{id}` - Get single material
- `PATCH /api/v1/materials/{id}` - Update material (admin only)
- `DELETE /api/v1/materials/{id}` - Delete material (admin only)

Material properties include:
- `density` (kg/m³)
- `youngs_modulus` (GPa)
- `poisson_ratio` (dimensionless)
- `cost_per_kg` (currency units)
- `carbon_factor` (kg CO2/kg material)

### PDF Report Generation
Generate comprehensive DfX analysis reports as PDFs:
- `POST /api/v1/reports/{run_id}/generate?variant_id={vid}&language={en|fr}`
- Includes: Executive Summary, DfX Analysis (fabricability, assemblability, sustainability, structural), Metrics Tables, Risk Flags, Recommendations, Feedback History, Weights Evolution
- Uses WeasyPrint for HTML → PDF conversion
- Uploads to Supabase Storage with signed URL response

Dependencies:
```bash
pip install WeasyPrint==60.2 Jinja2==3.1.3
```

### Prompt Extraction Engine
Enhanced LLM-powered constraint extraction from user briefs:
- Extracts dimensions, materials, load conditions, manufacturing methods, aesthetic preferences
- Supports regex fallback + optional LLM enhancement (Mistral/Llama)
- Structured output: `DesignConstraints` model with typed fields
- Prompt versioning and diffing capabilities (foundation for RAG)
- Embedding generation support for similarity search

Modules: `prompt_extraction.py`

### Scoring Normalization Framework
Rigorous 0-1 scaling for all metrics using product-type-specific baselines:
- Default baselines for brackets, enclosures, generic parts
- Metrics: support_volume_ratio, part_count, max_von_mises_mpa, max_deflection_mm, mass_kg, build_time_minutes, safety_factor, smoothness_score
- Per-tenant custom baselines stored in `tenant_settings` table
- Endpoints:
  - `GET /api/v1/scoring/baselines?product_type={type}` - List baselines
  - `POST /api/v1/scoring/baselines` - Create/update baseline (admin)
  - `DELETE /api/v1/scoring/baselines/{product_type}/{metric_name}` - Delete custom baseline
  - `POST /api/v1/variants/{variant_id}/normalize-scores` - Re-compute normalized scores

Baselines configuration:
- `min_value`, `max_value` for linear scaling
- `optimal_value` for distance-based normalization
- `invert` flag for "lower is better" metrics (stress, mass, etc.)

Modules: `scoring_normalization.py`

### Celery Task Queue Integration
Asynchronous background processing for heavy compute tasks:
- `process_run_task` - Full run processing (LLM, diffusion, CAD, FEM)
- `fem_solve_task` - FEM simulation with mesh + boundary conditions
- `topopt_task` - Topology optimization (SIMP solver)
- `diffusion_task` - Stable Diffusion image generation
- `pdf_report_task` - PDF report generation

Task queues:
- `default` - General tasks
- `compute` - CPU-intensive (FEM, TopOpt)
- `gpu` - GPU tasks (diffusion)
- `io` - I/O bound (PDF, uploads)

Job status polling:
- `GET /api/v1/jobs/{job_id}/status` - Poll Celery task state, progress, result

Setup:
1. Start Redis broker:
   ```powershell
   docker run -p 6379:6379 redis:7-alpine
   ```

2. Start Celery worker:
   ```powershell
   celery -A tasks.celery_app worker -l info -Q default,compute,gpu,io --concurrency=4
   ```

3. Enable in API:
   ```bash
   export CELERY_ENABLED=1
   export CELERY_BROKER_URL=redis://localhost:6379/0
   ```

Configuration:
- `CELERY_BROKER_URL` - Redis connection string
- `CELERY_BACKEND_URL` - Result backend (defaults to broker)
- `CELERY_QUEUE` - Default queue name
- `CELERY_ENABLED=1` - Enable task queuing in API

Task limits:
- Hard time limit: 1 hour (3600s)
- Soft time limit: 55 minutes (3300s)
- Worker restarts every 100 tasks (memory leak prevention)

Modules: `tasks.py`

### Architecture Enhancements
- **Supabase Python Client**: Initialized alongside REST API helpers for new modules
- **Audit Log Persistence**: Hash-chained append-only audit trail (migration 004)
- **Tenant Isolation**: Comprehensive RLS policies on all tables
- **Storage Helpers**: `_upload_and_sign` for Supabase Storage integration

### Migration 004: RBAC Tenant Extension
Comprehensive multi-tenant foundation:
- `tenant_id` propagated to all existing tables
- New tables: `materials`, `tenant_settings`, `variant_assets`, `fem_jobs`, `run_lineage`, `audit_log`
- RLS policies enforcing tenant isolation on reads/writes
- Audit log with SHA-256 hash chain for tamper evidence
- Indexes on tenant_id, created_at, foreign keys

Apply migration:
```sql
psql -U postgres -d your_db -f supabase/migrations/004_rbac_tenant_extension.sql
```

Or via Supabase Dashboard: SQL Editor → paste → Run

### Testing Endpoints

Materials:
```bash
# Create material (admin)
curl -X POST http://localhost:8000/api/v1/materials \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Carbon Fiber","density":1600,"youngs_modulus":150,"poisson_ratio":0.30,"cost_per_kg":80,"carbon_factor":10.5}'

# List materials
curl http://localhost:8000/api/v1/materials \
  -H "Authorization: Bearer <JWT>"
```

PDF Reports:
```bash
# Generate report
curl -X POST "http://localhost:8000/api/v1/reports/run_abc123/generate?language=en" \
  -H "Authorization: Bearer <JWT>"

# Returns:
{
  "status": "generated",
  "run_id": "run_abc123",
  "variant_id": "var_xyz789",
  "pdf_url": "https://<project>.supabase.co/storage/v1/object/sign/...",
  "filename": "report_run_abc123_var_xyz7.pdf",
  "language": "en"
}
```

Scoring Normalization:
```bash
# List baselines for brackets
curl "http://localhost:8000/api/v1/scoring/baselines?product_type=bracket" \
  -H "Authorization: Bearer <JWT>"

# Normalize variant scores
curl -X POST http://localhost:8000/api/v1/variants/var_xyz/normalize-scores \
  -H "Authorization: Bearer <JWT>"
```

Celery Job Status:
```bash
# Submit task (returns job_id)
curl -X POST http://localhost:8000/api/v1/runs \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{"project_id":"proj_123","brief":"Design a bracket"}'

# Poll status
curl http://localhost:8000/api/v1/jobs/{job_id}/status \
  -H "Authorization: Bearer <JWT>"
```

### Environment Variables (Updated)
```bash
# Core
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_KEY=<service_role_key>
SUPABASE_STORAGE_BUCKET=artifacts

# LLM
MISTRAL_API_KEY=<your_key>
MISTRAL_MODEL=mistral-small-latest
OLLAMA_HOST=http://127.0.0.1:11434
OLLAMA_MODEL=mistral:7b-instruct

# MLflow
MLFLOW_TRACKING_URI=http://localhost:5000

# Celery
CELERY_ENABLED=1
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_BACKEND_URL=redis://localhost:6379/0
REDIS_URL=redis://localhost:6379/0

# Auth
JWT_SECRET=<your_secret>
JWT_ALGORITHM=HS256
JWT_REQUIRED=1

# Rate Limiting
RATE_LIMIT_WINDOW=60
RATE_LIMIT_MAX_REQUESTS=100
```

### Future Roadmap
See comprehensive 80-item backlog in project management:
- ControlNet real integration (sketch-to-image)
- CAD parametric Blender headless generation
- FEM scikit-fem/PyAnsys/FEniCS integration
- Real SIMP TopOpt solver with convergence
- CLIP aesthetic scoring
- DVC pipeline definitions (dvc.yaml)
- Run replay with deterministic outputs
- WebSocket/SSE real-time progress streaming
- Excel multi-sheet export
- Comprehensive test suites (unit, integration, load, security)
- Docker multi-stage builds
- Kubernetes HPA + GPU node pools
- CI/CD pipelines
- Grafana dashboards + Prometheus metrics
- Threat modeling + RGPD compliance
- Architecture diagrams + API documentation

Dependency Strategy:
- `requirements.txt`: production/runtime dependencies only (FastAPI, Redis, Celery optional, MLflow, Supabase, tracing, JWT, Pillow).
- `requirements-dev.txt`: test and audit tooling (pytest, fakeredis, pip-audit). Installed in CI for test jobs.
- Separation reduces production image size and attack surface; keep dev tools out of final deployment build.
- Optional future split: `requirements-mlflow.txt` or extras section in a `pyproject.toml` for observability (`opentelemetry-*`) and MLOps.

Security & Auditing:
- CI runs `pip-audit` and `pnpm audit` (non-blocking) in `security-scan` job; promote to blocking once baseline is clean.
- Consider adding a weekly scheduled workflow:
	```yaml
	on:
		schedule:
			- cron: '0 3 * * 1' # Mondays 03:00 UTC
	```
- For known acceptable vulnerabilities, maintain an allowlist file (e.g. `pip-audit.toml`).

Python Versioning:
- Prefer LTS (3.12) for MLflow compatibility; 3.14 bleeding edge builds may slow dependency installs.
- Pin critical infra libs (Celery, Redis client) to avoid surprise breaking changes; review monthly.

Node/Front-end Dependencies:
- Workspace packages (`@kit/*`) resolve locally; ensure lockfile (`pnpm-lock.yaml`) is committed.
- Run `pnpm update --latest` in a feature branch and validate via CI before mass upgrades.

Recommended Next Steps:
- Add Docker multi-stage build copying only `requirements.txt` dependencies.
- Introduce `pip-tools` (`requirements.in` + compiled lock) for deterministic production builds.
- Implement SBOM generation (e.g., `syft packages dir:`) for compliance.
- Add real ControlNet conditioning (replace current stub path when models are available).
- Replace synthetic advanced TopOpt with per-iteration FEA solve.
- Persist adaptive feedback weighting state in DB (currently in-memory).
- Attach MLflow experiment/run IDs + git commit (dvc_commit) now present in `RunOut` to UI for traceability.
