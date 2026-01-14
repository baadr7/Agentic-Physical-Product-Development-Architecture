# API + Worker Local Run Guide (Windows)

## Prerequisites
- Python venv in `apps/api/.venv` with project requirements installed.
- Redis running (Memurai) at `127.0.0.1:6379`.
- Supabase keys configured in `.env.local`.

## Supabase Schema
- Apply `apps/api/scripts/supabase_schema.sql` in the Supabase SQL editor.
- This creates `runs`, `variants`, and `variant_assets` tables and basic RLS (anon read; service role can write).
 - If you already had tables and get errors like `PGRST204` or missing columns (e.g., `prompt`), run `apps/api/scripts/supabase_schema_patch.sql` to add expected columns.

## REST Insert Test
- Use `apps/api/scripts/rest_insert_test.py` to insert a `runs` row directly via Supabase REST.

### Steps
1. Ensure `.env.local` in `apps/api` contains:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
2. Activate venv:
   ```powershell
   Set-Location "c:\Users\MSI\Documents\Makerkit\nextjs-saas-starter-kit-lite\apps\api";
   . .\.venv\Scripts\Activate.ps1
   ```
3. Install dependencies for the test script:
   ```powershell
   python -m pip install python-dotenv requests
   ```
4. Run the insert test:
   ```powershell
   python .\scripts\rest_insert_test.py
   ```
5. Expected: HTTP 201 with the inserted row JSON (including `id`).
 - If you see `Could not find the 'prompt' column of 'runs'`, apply the schema or the patch SQL above and retry.

## Quick Start
1. Start API:
   - `apps/api/scripts/start_api.ps1` (loads `.env.local`, activates venv, runs uvicorn)
2. Start Worker:
   - `apps/api/scripts/start_worker.ps1` (loads `.env.local`, activates venv, runs Celery with solo pool)

## Create Run + Poll Variants
Use PowerShell:
```
$headers = @{ 'Content-Type'='application/json' }
$body = '{ "project_id": "47c833cc-fd92-4ee3-9d0b-e90942edafde", "parameters": { "size_cm": 5 } }'
$run = Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/v1/runs" -Headers $headers -Method Post -Body ([Text.Encoding]::UTF8.GetBytes($body))
Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/v1/runs/$($run.run_id)/variants" -Method Get
```

## Troubleshooting
- Start Celery only from `apps/api` (module `tasks.celery_app` resolves here).
- On Windows, always use `--pool solo` for Celery.
- If Supabase REST returns 401, reload keys from `.env.local` and verify the JWT payload includes `"role": "service_role"` and the correct `ref`.
