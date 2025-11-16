from fastapi import FastAPI, BackgroundTasks, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, UTC
import uuid
import os
import requests
import io
try:
    # when running as a package, relative import works
    from .worker import process_run
except Exception:
    # when running tests from the same directory, fall back to absolute import
    from worker import process_run

# Optional Celery task import (only used if CELERY_ENABLED = 1)
CELERY_ENABLED = os.getenv('CELERY_ENABLED') == '1'
if CELERY_ENABLED:
    try:
        from .tasks import process_run_task  # type: ignore
    except Exception:
        try:
            from tasks import process_run_task  # type: ignore
        except Exception:
            CELERY_ENABLED = False
try:
    from .mistral import MistralNotConfigured, normalize_brief
except Exception:
    from mistral import MistralNotConfigured, normalize_brief

app = FastAPI(title="Makerkit API (skeleton)")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class RunCreate(BaseModel):
    project_id: str
    input_mode: Optional[str] = 'text'
    description: Optional[str] = None
    # Additional fields from spec: constraints and options
    constraints: Optional[dict] = {}
    options: Optional[dict] = {}


class RunOut(BaseModel):
    run_id: str
    status: str
    project_id: str
    created_at: str
    started_at: Optional[str] = None
    finished_at: Optional[str] = None
    duration_ms: Optional[int] = None
    options: Optional[dict] = None
    metadata: Optional[dict] = None


class BriefPayload(BaseModel):
    text: str

class VariantOut(BaseModel):
    id: str
    run_id: str
    thumbnail_url: Optional[str] = None
    image_url: Optional[str] = None
    stl_url: Optional[str] = None
    step_url: Optional[str] = None
    score: Optional[float] = None
    metrics: Optional[dict] = None
    dfx_summary: Optional[str] = None
    fabricability_score: Optional[float] = None
    assemblability_score: Optional[float] = None
    sustainability_score: Optional[float] = None
    created_at: Optional[str] = None

class ExportPresignRequest(BaseModel):
    run_id: str
    kind: str  # e.g. 'pdf' | 'zip' | 'stl'

class ExportPresignResponse(BaseModel):
    url: str
    expires_at: str


# In-memory stores for prototype
PROJECTS = []
RUNS = []

# Optional Supabase / PostgREST backing (if SUPABASE_URL & SUPABASE_KEY are set)
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_KEY')
SUPABASE_STORAGE_BUCKET = os.getenv('SUPABASE_STORAGE_BUCKET')

def supabase_headers():
    return {
        'apikey': SUPABASE_KEY,
        'Authorization': f'Bearer {SUPABASE_KEY}',
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    }

def list_runs_supabase():
    if not SUPABASE_URL:
        return None
    url = f"{SUPABASE_URL}/rest/v1/runs?select=*"
    r = requests.get(url, headers=supabase_headers())
    r.raise_for_status()
    return r.json()

def fetch_run_supabase(run_id: str):
    if not SUPABASE_URL:
        return None
    url = f"{SUPABASE_URL}/rest/v1/runs?run_id=eq.{run_id}&select=*"
    r = requests.get(url, headers=supabase_headers())
    r.raise_for_status()
    items = r.json()
    if isinstance(items, list) and items:
        return items[0]
    return None

def list_variants_supabase(run_id: str):
    if not SUPABASE_URL:
        return []
    url = f"{SUPABASE_URL}/rest/v1/variants?run_id=eq.{run_id}&select=*"
    r = requests.get(url, headers=supabase_headers())
    r.raise_for_status()
    return r.json()

def fetch_dfx_summary_for_variant_supabase(variant_id: str):
    if not SUPABASE_URL:
        return None
    url = f"{SUPABASE_URL}/rest/v1/dfx_summaries?variant_id=eq.{variant_id}&select=*"
    r = requests.get(url, headers=supabase_headers())
    r.raise_for_status()
    items = r.json()
    if isinstance(items, list) and items:
        return items[0]
    return None

def list_prompts_supabase(run_id: str):
    if not SUPABASE_URL:
        return []
    url = f"{SUPABASE_URL}/rest/v1/prompts?run_id=eq.{run_id}&select=*"
    r = requests.get(url, headers=supabase_headers())
    r.raise_for_status()
    return r.json()

def list_exports_supabase(run_id: str):
    if not SUPABASE_URL:
        return []
    url = f"{SUPABASE_URL}/rest/v1/exports?run_id=eq.{run_id}&select=*"
    r = requests.get(url, headers=supabase_headers())
    r.raise_for_status()
    return r.json()

def create_run_supabase(payload: dict):
    if not SUPABASE_URL:
        return None
    url = f"{SUPABASE_URL}/rest/v1/runs"
    # Supabase requires Prefer: return=representation to return the created row
    headers = supabase_headers()
    headers['Prefer'] = 'return=representation'
    r = requests.post(url, headers=headers, json=payload)
    r.raise_for_status()
    items = r.json()
    return items[0] if isinstance(items, list) and items else items

def list_projects_supabase():
    if not SUPABASE_URL:
        return None
    url = f"{SUPABASE_URL}/rest/v1/projects?select=*"
    r = requests.get(url, headers=supabase_headers())
    r.raise_for_status()
    return r.json()

def fetch_project_supabase(project_id: str):
    if not SUPABASE_URL:
        return None
    url = f"{SUPABASE_URL}/rest/v1/projects?id=eq.{project_id}&select=*"
    r = requests.get(url, headers=supabase_headers())
    r.raise_for_status()
    items = r.json()
    if isinstance(items, list) and items:
        return items[0]
    return None

def create_project_supabase(payload: dict):
    if not SUPABASE_URL:
        return None
    url = f"{SUPABASE_URL}/rest/v1/projects"
    headers = supabase_headers()
    headers['Prefer'] = 'return=representation'
    r = requests.post(url, headers=headers, json=payload)
    r.raise_for_status()
    items = r.json()
    return items[0] if isinstance(items, list) and items else items


@app.get('/health')
def health():
    return {"status": "ok", "time": datetime.now(UTC).isoformat()}


@app.get('/api/v1/projects')
def list_projects():
    # If Supabase is configured, fetch projects from the remote DB
    try:
        if SUPABASE_URL:
            items = list_projects_supabase()
            return items
    except Exception as e:
        # Log and fall back to in-memory
        print('Supabase list_projects error:', e)
    return PROJECTS


@app.get('/api/v1/projects/{project_id}')
def get_project(project_id: str):
    try:
        if SUPABASE_URL:
            item = fetch_project_supabase(project_id)
            if item:
                return item
    except Exception as e:
        print('Supabase get_project error:', e)
    # Fallback to in-memory
    for p in PROJECTS:
        if p.get('id') == project_id:
            return p
    raise HTTPException(status_code=404, detail=f"Project {project_id} not found")


class ProjectCreate(BaseModel):
    title: str
    description: Optional[str] = None
    product_type: Optional[str] = 'other'
    brief: Optional[str] = None
    materials: Optional[list[str]] = None
    constraints: Optional[dict] = None
    logo_url: Optional[str] = None


@app.post('/api/v1/projects')
def create_project(body: ProjectCreate):
    payload = {
        'title': body.title,
        'description': body.description,
        'product_type': body.product_type,
        'brief': body.brief,
        'materials': body.materials,
        'constraints': body.constraints,
        'logo_url': body.logo_url,
        'created_at': datetime.now(UTC).isoformat(),
        'updated_at': datetime.now(UTC).isoformat(),
    }
    # Try Supabase first
    try:
        if SUPABASE_URL:
            row = create_project_supabase(payload)
            return row
    except Exception as e:
        print('Supabase create_project error:', e)
    # Fallback in-memory
    proj = payload.copy()
    proj['id'] = str(uuid.uuid4())
    PROJECTS.insert(0, proj)
    return proj


@app.post('/api/v1/runs', response_model=RunOut)
def create_run(payload: RunCreate, background_tasks: BackgroundTasks):
    # minimal validation
    if not payload.project_id:
        raise HTTPException(status_code=400, detail="project_id required")
    # If Supabase is configured, persist run there and return representation
    try:
        if SUPABASE_URL:
            row = create_run_supabase({
                'project_id': payload.project_id,
                'status': 'queued',
                'input_mode': payload.input_mode,
                'description': payload.description,
                'constraints': payload.constraints,
                'options': payload.options,
                'created_at': datetime.now(UTC).isoformat(),
            })
            if row:
                run_id_val = row.get('run_id') or row.get('id') or f"run-{uuid.uuid4().hex[:8]}"
                # schedule async processing (Celery preferred if enabled)
                if CELERY_ENABLED:
                    try:
                        process_run_task.delay(run_id_val, payload.project_id)
                    except Exception as e:
                        print('Failed to enqueue Celery task, fallback to BackgroundTasks:', e)
                        background_tasks.add_task(process_run, run_id_val, payload.project_id)
                else:
                    try:
                        background_tasks.add_task(process_run, run_id_val, payload.project_id)
                    except Exception:
                        print('Failed to schedule background task for run', run_id_val)
                return RunOut(**{
                    'run_id': run_id_val,
                    'status': row.get('status', 'queued'),
                    'project_id': row.get('project_id', payload.project_id),
                    'created_at': row.get('created_at', datetime.now(UTC).isoformat()),
                })
    except Exception as e:
        print('Supabase create_run error:', e)

    # Fallback: create in-memory run
    run_id = f"run-{uuid.uuid4().hex[:8]}"
    run = {
        'run_id': run_id,
        'status': 'queued',
        'project_id': payload.project_id,
        'created_at': datetime.now(UTC).isoformat(),
    }
    RUNS.insert(0, run)

    # Background work could be scheduled here (workers)
    if CELERY_ENABLED:
        try:
            process_run_task.delay(run_id, payload.project_id)
        except Exception as e:
            print('Celery enqueue failed (fallback to BackgroundTasks):', e)
            try:
                background_tasks.add_task(process_run, run_id, payload.project_id)
            except Exception:
                print('Failed to schedule background task for in-memory run', run_id)
    else:
        try:
            background_tasks.add_task(process_run, run_id, payload.project_id)
        except Exception:
            print('Failed to schedule background task for in-memory run', run_id)
    return RunOut(**run)


@app.get('/api/v1/runs')
def list_runs():
    try:
        if SUPABASE_URL:
            items = list_runs_supabase()
            return items
    except Exception as e:
        print('Supabase list_runs error:', e)
    return RUNS


@app.get('/api/v1/runs/{run_id}', response_model=RunOut)
def get_run(run_id: str):
    """Fetch a single run by id, from Supabase if configured or from in-memory store."""
    # Try Supabase first
    try:
        if SUPABASE_URL:
            row = fetch_run_supabase(run_id)
            if row:
                # Coerce to RunOut shape with sensible defaults
                return RunOut(
                    run_id=row.get('run_id') or row.get('id') or run_id,
                    status=row.get('status', 'queued'),
                    project_id=row.get('project_id', ''),
                    created_at=row.get('created_at', datetime.now(UTC).isoformat()),
                    started_at=row.get('started_at'),
                    finished_at=row.get('finished_at'),
                    duration_ms=row.get('duration_ms'),
                    options=row.get('options') or row.get('parameters') or {},
                    metadata=row.get('metadata') or {},
                )
    except Exception as e:
        print('Supabase get_run error:', e)

    # Fallback in-memory lookup
    for r in RUNS:
        if r.get('run_id') == run_id:
            return RunOut(**{
                'run_id': r.get('run_id'),
                'status': r.get('status', 'queued'),
                'project_id': r.get('project_id', ''),
                'created_at': r.get('created_at', datetime.now(UTC).isoformat()),
                'started_at': r.get('started_at'),
                'finished_at': r.get('finished_at'),
                'duration_ms': r.get('duration_ms'),
                'options': r.get('options') or r.get('parameters') or {},
                'metadata': r.get('metadata') or {},
            })

    raise HTTPException(status_code=404, detail=f"Run {run_id} not found")


@app.get('/api/v1/runs/{run_id}/variants', response_model=List[VariantOut])
def get_variants(run_id: str):
    """List variants for a run, embedding basic DfX scores if available."""
    results: List[VariantOut] = []
    try:
        if SUPABASE_URL:
            raw_variants = list_variants_supabase(run_id)
            for v in raw_variants:
                dfx = None
                try:
                    dfx = fetch_dfx_summary_for_variant_supabase(v.get('id'))
                except Exception:
                    dfx = None
                results.append(VariantOut(
                    id=v.get('id'),
                    run_id=v.get('run_id'),
                    thumbnail_url=v.get('thumbnail_url'),
                    image_url=v.get('image_url'),
                    stl_url=v.get('stl_url'),
                    step_url=v.get('step_url'),
                    score=v.get('score'),
                    metrics=v.get('metrics') or {},
                    dfx_summary=(dfx or {}).get('summary'),
                    fabricability_score=(dfx or {}).get('fabricability_score'),
                    assemblability_score=(dfx or {}).get('assemblability_score'),
                    sustainability_score=(dfx or {}).get('sustainability_score'),
                    created_at=v.get('created_at'),
                ))
            return results
    except Exception as e:
        print('Supabase get_variants error:', e)

    # In-memory fallback: synthesize a single variant so UI/tests have data
    run_ref = None
    for r in RUNS:
        if r.get('run_id') == run_id:
            run_ref = r
            break
    dfx_summary = None
    if run_ref:
        meta = run_ref.get('metadata') or {}
        dfx_summary = meta.get('dfx_summary') or 'DfX synthétique'
    variant_id = f"var-{run_id.split('-')[-1]}"
    synth_variant = VariantOut(
        id=variant_id,
        run_id=run_id,
        thumbnail_url='https://placehold.co/256x256?text=Variant',
        image_url='https://placehold.co/512x384?text=Design',
        stl_url='https://example.com/mock/model.stl',
        step_url='https://example.com/mock/model.step',
        score=8.7,
        metrics={'mass_g': 123.4, 'volume_cm3': 56.7, 'fabricability_score': 0.92, 'assemblability_score': 0.88, 'sustainability_score': 0.75, 'safety_factor': 2.1},
        dfx_summary=dfx_summary,
        created_at=datetime.now(UTC).isoformat(),
    )
    return [synth_variant]


@app.post('/api/v1/exports/presign', response_model=ExportPresignResponse)
def presign_export(body: ExportPresignRequest):
    """Return a stub pre-signed URL for an export artifact.

    In production this would call object storage (S3/MinIO) to create a temporary
    signed URL. For now we fabricate a deterministic placeholder.
    """
    if not body.run_id or not body.kind:
        raise HTTPException(status_code=400, detail='run_id and kind required')
    # If Supabase Storage is configured, try to sign a URL
    if SUPABASE_URL and SUPABASE_KEY and SUPABASE_STORAGE_BUCKET:
        try:
            # Build a deterministic object path; object should exist in storage for signing to succeed
            object_name = f"exports/{body.run_id}/{body.kind}/{uuid.uuid4().hex[:8]}.{body.kind}"
            sign_url = f"{SUPABASE_URL}/storage/v1/object/sign/{SUPABASE_STORAGE_BUCKET}/{object_name}"
            headers = {
                'apikey': SUPABASE_KEY,
                'Authorization': f'Bearer {SUPABASE_KEY}',
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            }
            # expiresIn is seconds
            resp = requests.post(sign_url, headers=headers, json={"expiresIn": 900})
            # If object not found, Supabase returns 404; fall back below
            if resp.ok:
                data = resp.json()
                # Supabase returns { signedURL: "/object/sign/..." }
                signed_path = data.get('signedURL') or data.get('signedUrl')
                if signed_path:
                    # Compose absolute URL
                    absolute = f"{SUPABASE_URL}{signed_path}" if signed_path.startswith('/') else signed_path
                    return ExportPresignResponse(url=absolute, expires_at=(datetime.now(UTC).isoformat()))
        except Exception as e:
            print('Supabase presign error (fallback to stub):', e)

    # Fallback stub URL
    expires = datetime.now(UTC).isoformat()
    url = f"https://example.local/exports/{body.run_id}/{body.kind}-{uuid.uuid4().hex[:8]}.tmp"
    return ExportPresignResponse(url=url, expires_at=expires)


class ExportCreate(BaseModel):
    kinds: Optional[List[str]] = ["pdf", "zip"]


@app.post('/api/v1/runs/{run_id}/exports')
def create_exports(run_id: str, body: ExportCreate):
    """Create export artifacts (PDF/ZIP) and return signed URLs.

    When Supabase storage is not configured, returns stub signed URLs.
    """
    kinds = body.kinds or ["pdf", "zip"]
    out: dict = {"ok": True}
    for k in kinds:
        try:
            presigned = presign_export(ExportPresignRequest(run_id=run_id, kind=k))
            out[k] = presigned.model_dump()
        except Exception as e:
            out[k] = {"error": str(e)}
    return out


@app.get('/api/v1/runs/{run_id}/full')
def get_run_full(run_id: str):
    """Unified payload: run + variants (+ dfx) + prompts.

    Shape:
    {
      run: RunOut | null,
      variants: [VariantOut...],
      prompts: [{id, prompt_text, model, created_at}],
    }
    """
    run_payload = None
    variants_payload: list[dict] = []
    prompts_payload: list[dict] = []

    # Fetch run
    try:
        if SUPABASE_URL:
            r = fetch_run_supabase(run_id)
            if r:
                run_payload = {
                    'run_id': r.get('run_id') or r.get('id'),
                    'status': r.get('status'),
                    'project_id': r.get('project_id'),
                    'created_at': r.get('created_at'),
                    'started_at': r.get('started_at'),
                    'finished_at': r.get('finished_at'),
                    'duration_ms': r.get('duration_ms'),
                    'options': r.get('options') or r.get('parameters') or {},
                    'metadata': r.get('metadata') or {},
                }
    except Exception as e:
        print('full run fetch error:', e)

    # Fetch variants + embed dfx
    try:
        if SUPABASE_URL:
            raw_variants = list_variants_supabase(run_id)
            for v in raw_variants:
                dfx = None
                try:
                    dfx = fetch_dfx_summary_for_variant_supabase(v.get('id'))
                except Exception:
                    dfx = None
                variants_payload.append({
                    'id': v.get('id'),
                    'run_id': v.get('run_id'),
                    'thumbnail_url': v.get('thumbnail_url'),
                    'image_url': v.get('image_url'),
                    'stl_url': v.get('stl_url'),
                    'step_url': v.get('step_url'),
                    'score': v.get('score'),
                    'metrics': v.get('metrics') or {},
                    'dfx_summary': (dfx or {}).get('summary'),
                    'fabricability_score': (dfx or {}).get('fabricability_score'),
                    'assemblability_score': (dfx or {}).get('assemblability_score'),
                    'sustainability_score': (dfx or {}).get('sustainability_score'),
                    'created_at': v.get('created_at'),
                })
    except Exception as e:
        print('full variants fetch error:', e)

    # Fetch prompts
    try:
        if SUPABASE_URL:
            raw_prompts = list_prompts_supabase(run_id)
            for p in raw_prompts:
                prompts_payload.append({
                    'id': p.get('id'),
                    'run_id': p.get('run_id'),
                    'prompt_text': p.get('prompt_text'),
                    'model': p.get('model'),
                    'created_at': p.get('created_at'),
                })
    except Exception as e:
        print('full prompts fetch error:', e)

    return {
        'run': run_payload,
        'variants': variants_payload,
        'prompts': prompts_payload,
    }


@app.get('/api/v1/runs/{run_id}/exports')
def get_exports(run_id: str):
    try:
        if SUPABASE_URL:
            return list_exports_supabase(run_id)
    except Exception as e:
        print('Supabase get_exports error:', e)
    return []


@app.post('/api/v1/llm/normalize-brief')
def api_normalize_brief(body: BriefPayload):
    """Normalize a free-text brief into structured constraints using Mistral.

    Requires env MISTRAL_API_KEY to be set. Returns a JSON object with extracted fields.
    """
    try:
        data = normalize_brief(body.text)
        return {"ok": True, "data": data}
    except MistralNotConfigured:
        raise HTTPException(status_code=503, detail="Mistral not configured: set MISTRAL_API_KEY")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Normalization failed: {e}")


@app.get('/api/v1/runs/{run_id}/report.pdf')
def get_run_pdf_report(run_id: str):
    """Return a minimal PDF report for the run (inline), no storage required.

    Tries to build a simple PDF; if reportlab is unavailable, uses a tiny embedded
    PDF fallback so clients can still download something valid.
    """
    pdf_bytes = _generate_pdf_report_bytes(run_id)
    return Response(content=pdf_bytes, media_type='application/pdf')


def _generate_pdf_report_bytes(run_id: str) -> bytes:
    # Try reportlab for a nicer PDF (optional dependency)
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.pdfgen import canvas
        buf = io.BytesIO()
        c = canvas.Canvas(buf, pagesize=A4)
        width, height = A4
        c.setFont("Helvetica-Bold", 16)
        c.drawString(50, height-80, "Generative Design Report")
        c.setFont("Helvetica", 10)
        c.drawString(50, height-100, f"Run ID: {run_id}")
        c.drawString(50, height-115, "This is a minimal auto-generated report.")
        c.showPage(); c.save()
        buf.seek(0)
        return buf.read()
    except Exception:
        # Valid minimal PDF (one blank page) fallback
        return (b"%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF")


# Simple note: this is a prototype skeleton. In production:
# - Replace in-memory stores with DB (Supabase / Postgres)
# - Use Celery/RQ for background workers and ML pipelines
# - Track runs in MLflow and store artifacts in object storage (S3/MinIO)
