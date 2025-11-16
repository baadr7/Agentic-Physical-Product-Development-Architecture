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
Push-Location "apps/api"; $env:PYTHONPATH = "."; .\.venv\Scripts\python.exe -m pip install -r requirements.txt; \
.\.venv\Scripts\python.exe -m uvicorn apps.api.main:app --reload --port 8000; Pop-Location

# Web
Push-Location "apps/web"; pnpm install; pnpm dev; Pop-Location
```

## Configuration (.env)
- `SUPABASE_URL`, `SUPABASE_KEY`, `SUPABASE_STORAGE_BUCKET`
- `CELERY_ENABLED=0|1`, `REDIS_URL` (when Celery enabled)
- `MISTRAL_API_KEY` (optional; Ollama preferred if available)
- `MLFLOW_TRACKING_URI` (optional)

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

## Observability
- API metrics + logs (OpenTelemetry optional).
- Infra: Prometheus + Grafana recommended.

## GPU Nodes (Later)
- For diffusion/Blender/FEM, provision autoscaled GPU nodes; isolate workloads per queue.
