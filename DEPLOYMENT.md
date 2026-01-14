# Deployment Plan (Dev → Staging → Prod)

This repo is a monorepo with apps (`web`, `api`) and packages. Below is a practical plan aligned with the spec.

## Environments
- Local: `http://localhost:3000` (Next.js), `http://localhost:8000` (FastAPI). Optional Supabase local or cloud.
- Staging: `https://appstaging.<domain>`, `https://apistaging.<domain>`. Managed Postgres, bucket staging.
- Prod: `https://app.<domain>`, `https://api.<domain>`. HA Postgres, production bucket.

## Containers
- api: `fastapi + uvicorn`. Optional `celery` worker with `redis` broker.
- web: Next.js app.
- workers: specialized images (LLM, diffusion, Blender). Provision later when enabling pipelines.

## Quickstart (Local)
```powershell
# API (Windows PowerShell)
Push-Location "apps/api"; .\.venv\Scripts\python.exe -m pip install -r requirements.txt; \
.\.venv\Scripts\python.exe -m uvicorn main:app --reload --host 127.0.0.1 --port 8000; Pop-Location

# Web
Push-Location "apps/web"; pnpm install; pnpm dev; Pop-Location
```

## Configuration (.env)
- `SUPABASE_URL`, `SUPABASE_KEY`, `SUPABASE_STORAGE_BUCKET`
- `CELERY_ENABLED=0|1`, `REDIS_URL` (when Celery enabled)
- `MISTRAL_API_KEY` (optional; Ollama preferred if available)
- `MLFLOW_TRACKING_URI` (optional)

### Real image generation (recommended)
To ensure the UI always shows *real* generated images (no placeholders), configure Hugging Face image inference:
- `HF_IMAGE_MODEL` (example: `black-forest-labs/FLUX.1-schnell`)
- `HF_TOKEN` (or `HUGGINGFACE_HUB_TOKEN` / `HUGGINGFACE_API_KEY`)
- `HF_IMAGE_PROVIDER=hf-inference` (default)
- `HF_IMAGE_TIMEOUT=30`

And enable the production guard:
- `REQUIRE_REAL_IMAGES=1`

When `REQUIRE_REAL_IMAGES=1`, the API returns HTTP 503 if image generation isn’t configured, instead of returning stub images.

### Optional: MLflow quickstart (local)
```powershell
# Install MLflow in API venv (optional)
Push-Location "apps/api"; .\.venv\Scripts\python.exe -m pip install mlflow; Pop-Location

# Start MLflow tracking server on a local file backend
$env:MLFLOW_TRACKING_URI = "file:///$PWD/mlruns"
# Run the API as usual; worker logs metrics when MLFLOW_TRACKING_URI is set
Push-Location "apps/api"; $env:PYTHONPATH = "."; .\.venv\Scripts\python.exe -m uvicorn main:app --reload --port 8000
```

Notes:
- MLflow is optional; the worker checks `MLFLOW_TRACKING_URI` before attempting to log.
- If your IDE flags `import mlflow` unresolved, ignore or install as above.

## Storage & Presign
- Supabase Storage recommended. The endpoint `POST /api/v1/exports/presign` uses Storage signing if env is set; falls back to stub otherwise.

## Optional: DVC basics
Use DVC to version datasets or binary artifacts outside the DB.

```powershell
# Initialize DVC at repo root (requires `pip install dvc` or `choco install dvc`)
dvc init
# Example: track a local dataset folder
dvc add data/
git add data/.gitignore data.dvc
git commit -m "chore(dvc): track data folder"
```

For remote storage (e.g., S3, Azure), configure `dvc remote add` and push with `dvc push`.

## CI/CD Outline
- Lint + unit tests (API and web) on PR.
- Build Docker images (`api`, `web`) and push to registry.
- Staging deploy via GitHub Actions → K8s (or Docker Compose on a VM).
- Prod deploy with manual approval; blue/green or canary.

## Concrete Deploy (Recommended)

### 1) Deploy API on Render (Docker)

This repo includes a Dockerfile for the API at `apps/api/Dockerfile` and a starter `render.yaml`.

Steps:
- Create a new **Web Service** on Render from this Git repo.
- Render will detect `render.yaml` (or you can manually select the Dockerfile at `apps/api/Dockerfile`).
- Set **Environment Variables** in Render:
	- Required (real images, prod): `REQUIRE_REAL_IMAGES=1`, `HF_IMAGE_MODEL`, `HF_TOKEN`
	- Recommended (persistence): `SUPABASE_URL`, `SUPABASE_KEY`, `SUPABASE_STORAGE_BUCKET=artifacts`
	- Recommended safety: `LOAD_DOTENV=0`

Start command is already in the Dockerfile: `uvicorn main:app --host 0.0.0.0 --port $PORT`.

### 2) Deploy Web on Vercel

The web app is `apps/web` (Next.js).

Steps:
- Create a new Vercel project.
- Set **Root Directory** to `apps/web`.
- Set environment variables in Vercel:
	- `NEXT_PUBLIC_API_BASE_URL=https://<your-render-api-domain>`
	- `NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co`
	- `NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>`
	- Ensure `NEXT_PUBLIC_DISABLE_AUTH=false` for production.

### 3) Verify

- API health: `GET https://<api>/health` should return `{ "ok": true }`.
- Deep health: `GET https://<api>/api/v1/health/deep` should return JSON with `status`, `redis`, `supabase`, `mlflow`, `diffusion`.
- Web: run a generation; if HF is misconfigured and `REQUIRE_REAL_IMAGES=1`, generation should fail loudly with HTTP 503 (no silent stub images).

## Observability
- API metrics + logs (OpenTelemetry optional).
- Infra: Prometheus + Grafana recommended.

## GPU Nodes (Later)
- For diffusion/Blender/FEM, provision autoscaled GPU nodes; isolate workloads per queue.
