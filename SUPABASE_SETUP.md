# Supabase Setup Guide

This guide explains how to set up Supabase persistence for the Makerkit Design-AI API.

## Prerequisites

- Supabase account (https://supabase.com)
- A Supabase project created
- Service Role key (from Settings → API)

## Step 1: Get Your Supabase Credentials

1. Go to https://supabase.com and sign in to your project
2. Navigate to **Settings** → **API** (left sidebar)
3. Copy:
   - **Project URL** (e.g., `https://xyzabc.supabase.co`)
   - **Service Role Key** (the full JWT token starting with `eyJ...`)

## Step 2: Apply the Database Schema

1. Go to your Supabase project's **SQL Editor** (left sidebar)
2. Click **"New Query"**
3. Copy and paste the SQL schema below, then click **"Run"**

```sql
CREATE TABLE IF NOT EXISTS public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  title text,
  product_type text,
  description text,
  logo_url text,
  brief text,
  materials jsonb,
  constraints jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.runs (
  run_id text PRIMARY KEY,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  status text DEFAULT 'queued',
  input_mode text,
  description text,
  options jsonb,
  metadata jsonb,
  params jsonb,
  started_at timestamp with time zone,
  finished_at timestamp with time zone,
  duration_ms integer,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id text REFERENCES public.runs(run_id) ON DELETE CASCADE,
  stl_url text,
  thumbnail_url text,
  metrics jsonb,
  score numeric,
  created_at timestamp with time zone DEFAULT now()
);

-- Disable Row Level Security for development (enable in production with proper policies)
ALTER TABLE public.projects DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.runs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.variants DISABLE ROW LEVEL SECURITY;
```

Expected output: **"Success"** ✓

## Step 3: Configure the API

### Option A: Environment Variables (Recommended for Dev)

Create or edit `apps/api/.env.local`:

```
SUPABASE_URL=https://your-project-url.supabase.co
SUPABASE_KEY=your_service_role_key_here
```

### Option B: System Environment Variables (Windows PowerShell)

```powershell
$env:SUPABASE_URL = "https://your-project-url.supabase.co"
$env:SUPABASE_KEY = "your_service_role_key_here"
```

## Step 4: Start the API Server

From `apps/api` directory:

### With environment variables set:

```bash
# Windows PowerShell
$env:SUPABASE_URL = "https://your-project-url.supabase.co"
$env:SUPABASE_KEY = "your_service_role_key_here"
.\.venv\Scripts\python -m uvicorn main:app --port 8000

# macOS/Linux
export SUPABASE_URL="https://your-project-url.supabase.co"
export SUPABASE_KEY="your_service_role_key_here"
python -m uvicorn main:app --port 8000
```

### Or with .env.local file:

```bash
.\.venv\Scripts\python -m uvicorn main:app --port 8000
```

## Step 5: Verify Persistence

Run the test script:

```bash
.\.venv\Scripts\python test_supabase.py
```

Expected output:
```
==================================================
Testing Supabase Persistence
==================================================

1. Creating a run via POST /api/v1/runs...
   Status: 200
   ✓ Created run: run-xxxxx
   Status: queued
   Project: proj-xxxxx

2. Fetching all runs via GET /api/v1/runs...
   Status: 200
   ✓ Total runs: 1
   ...
```

## How It Works

1. **Frontend** (Next.js Dashboard) POSTs to `http://localhost:8000/api/v1/runs`
2. **Backend** (FastAPI) receives request and:
   - Attempts to create run in Supabase REST API if `SUPABASE_URL` is set
   - Falls back to in-memory storage if Supabase is unavailable
   - Schedules background worker task
3. **Worker** processes the run asynchronously and updates status
4. **Frontend** polls or subscribes to updates and displays real-time status

## Fallback Behavior

If Supabase credentials are not set or tables don't exist:
- ✓ API continues to work using in-memory storage
- ✓ Runs are created and accessible during the session
- ✓ Data is lost when the API server restarts
- ⚠️ Not suitable for production (no persistence)

## Production Deployment

For production:

1. **Enable Row Level Security (RLS)** on all tables
   ```sql
   ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
   ALTER TABLE public.runs ENABLE ROW LEVEL SECURITY;
   ALTER TABLE public.variants ENABLE ROW LEVEL SECURITY;
   ```

2. **Add RLS Policies** for your users (examples):
   ```sql
   CREATE POLICY "Users can see their own projects"
   ON public.projects FOR SELECT
   USING (auth.uid() = user_id);
   ```

3. **Store secrets securely**:
   - Use environment variables in production (never hardcode)
   - Use a secrets manager (AWS Secrets Manager, HashiCorp Vault, etc.)
   - Rotate keys regularly

4. **Consider using Supabase client libraries** instead of REST API:
   ```python
   from supabase import create_client, Client
   
   supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
   ```

## Troubleshooting

### "404 Not Found" errors from Supabase

- The schema SQL may not have been applied
- Check: Settings → SQL Editor → verify tables exist
- Re-run the schema SQL if needed

### "Connection refused" errors

- Ensure the API server is running on port 8000
- Check: `netstat -a -n -o | findstr ":8000"` (Windows)
- Or: `lsof -i :8000` (macOS/Linux)

### Runs created but not persisted after restart

- Supabase tables may not exist
- Or SUPABASE_URL/SUPABASE_KEY not set
- Check API logs for "Supabase ... error" messages

## Next Steps

- Integrate MLflow for experiment tracking
- Add DVC for data versioning
- Set up worker queue (Celery/RQ) for long-running jobs
- Connect to object storage (S3/MinIO) for artifact storage

