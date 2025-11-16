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

This is a minimal prototype to integrate with the frontend later.

Optional configuration:
- To persist runs/projects to Supabase (Postgres) via the REST API, set the environment variables:
	- SUPABASE_URL (e.g. https://xyzcompany.supabase.co)
	- SUPABASE_KEY (service_role or anon key depending on your CORS/auth setup)

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
