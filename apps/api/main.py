from fastapi import FastAPI, BackgroundTasks, HTTPException, Response, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Any
from datetime import datetime, UTC
import uuid
import os
import logging, json, statistics
from collections import OrderedDict
import jwt
import redis
try:
    import fakeredis  # type: ignore
except Exception:
    fakeredis = None
try:
    from dotenv import load_dotenv
    # Load the local `.env` by default for developer convenience.
    # Tests/CI can disable by setting `LOAD_DOTENV=0`.
    dotenv_path = os.path.join(os.path.dirname(__file__), '.env')
    if os.path.exists(dotenv_path):
        load_flag = (os.getenv('LOAD_DOTENV') or '1').strip().lower()
        in_pytest = bool(os.getenv('PYTEST_CURRENT_TEST'))
        if load_flag not in ('0', 'false', 'no', 'off') and not in_pytest:
            load_dotenv(dotenv_path=dotenv_path, override=False)
except Exception:
    pass
import requests
import io
import base64
import tempfile, zipfile
from PIL import Image, ImageDraw, ImageFont
try:
    from prometheus_client import Counter, Histogram, generate_latest, CONTENT_TYPE_LATEST
except Exception:
    Counter = Histogram = None
try:
    import boto3  # type: ignore
except Exception:
    boto3 = None
try:
    from .worker import process_run, _upload_and_sign
except Exception:
    from worker import process_run, _upload_and_sign
try:
    from .scoring import compute_dfx_scores, get_weights, set_weights, compute_multiobjective_scores
except Exception:
    from scoring import compute_dfx_scores, get_weights, set_weights, compute_multiobjective_scores
try:
    from .fem_stub import run_fem_simulation
except Exception:
    from fem_stub import run_fem_simulation
try:
    from .fem_real import run_real_fem
except Exception:
    try:
        from fem_real import run_real_fem
    except Exception:
        pass
        def run_real_fem(*args, **kwargs):
            return None
try:
    from .cad_stub import generate_cad_variant
except Exception:
    from cad_stub import generate_cad_variant
try:
    from .parametric_3d import generate_parametric_model, export_ascii_stl_box, export_step_box
except Exception:
    from parametric_3d import generate_parametric_model, export_ascii_stl_box, export_step_box
try:
    from .cad_parametric import generate_cadquery_model
except Exception:
    from cad_parametric import generate_cadquery_model
try:
    from .run_replay import replay_run
except Exception:
    from run_replay import replay_run
try:
    from .topopt_stub import run_topopt
except Exception:
    from topopt_stub import run_topopt
try:
    from .topopt_solver import run_topopt_solver
except Exception:
    from topopt_solver import run_topopt_solver
try:
    from .topopt_compliance import run_topopt_compliance
except Exception:
    from topopt_compliance import run_topopt_compliance
try:
    from .fem_advanced import run_advanced_fem
except Exception:
    try:
        from fem_advanced import run_advanced_fem
    except Exception:
        def run_advanced_fem(*args, **kwargs):
            return None
try:
    from .diffusion_pipeline import diffusion_generator
except Exception:
    from diffusion_pipeline import diffusion_generator
try:
    from .sketch_vectorization import vectorize_png_to_svg
except Exception:
    from sketch_vectorization import vectorize_png_to_svg
try:
    from .cad_export import generate_cad_files, encode_data_url
except Exception:
    from cad_export import generate_cad_files, encode_data_url
try:
    from .fem_solver_general import solve_rect_plate
except Exception:
    try:
        from fem_solver_general import solve_rect_plate
    except Exception:
        def solve_rect_plate(*args, **kwargs):
            return None
try:
    from .topopt_compliance_advanced import run_topopt_compliance_advanced
except Exception:
    from topopt_compliance_advanced import run_topopt_compliance_advanced
try:
    from .import_handler import parse_dataset, build_variants
except Exception:
    from import_handler import parse_dataset, build_variants
try:
    from .pareto import pareto_front
except Exception:
    from pareto import pareto_front
try:
    from .weighting import update_feedback, derive_weights
except Exception:
    from weighting import update_feedback, derive_weights
try:
    from .report_generator import generate_dfx_report
except Exception:
    from report_generator import generate_dfx_report
try:
    from .security import content_moderate
except Exception:
    from security import content_moderate
try:
    from .materials import (
        MaterialCreate, MaterialUpdate, MaterialOut,
        create_material_supabase, list_materials_supabase,
        get_material_supabase, update_material_supabase,
        delete_material_supabase, seed_materials_if_empty
    )
except Exception:
    from materials import (
        MaterialCreate, MaterialUpdate, MaterialOut,
        create_material_supabase, list_materials_supabase,
        get_material_supabase, update_material_supabase,
        delete_material_supabase, seed_materials_if_empty
    )
try:
    from .prompt_extraction import (
        DesignConstraints, extract_constraints_with_llm,
        compute_prompt_diff, generate_prompt_embedding,
        store_prompt_version_supabase, get_prompt_versions_supabase
    )
except Exception:
    from prompt_extraction import (
        DesignConstraints, extract_constraints_with_llm,
        compute_prompt_diff, generate_prompt_embedding,
        store_prompt_version_supabase, get_prompt_versions_supabase
    )
try:
    from .pdf_report_generator import generate_pdf_report, generate_pdf_report_simple
except Exception:
    try:
        from pdf_report_generator import generate_pdf_report, generate_pdf_report_simple
    except Exception as _pdf_import_err:
        # PDF generation is optional. On Windows, WeasyPrint often requires native GTK/Pango
        # libraries; when missing, importing the module raises OSError. The API should still boot.
        def generate_pdf_report(*args, **kwargs):
            raise RuntimeError(
                "PDF generation is not available in this environment. "
                "Install WeasyPrint system dependencies or disable PDF endpoints. "
                f"Root error: {_pdf_import_err}"
            )

        def generate_pdf_report_simple(*args, **kwargs):
            raise RuntimeError(
                "PDF generation is not available in this environment. "
                "Install WeasyPrint system dependencies or disable PDF endpoints. "
                f"Root error: {_pdf_import_err}"
            )
try:
    from .scoring_normalization import (
        NormalizationBaseline, NormalizationConfig, ProductType,
        get_normalization_config, normalize_metrics_dict,
        store_baseline_supabase, load_baselines_supabase, delete_baseline_supabase
    )
except Exception:
    from scoring_normalization import (
        NormalizationBaseline, NormalizationConfig, ProductType,
        get_normalization_config, normalize_metrics_dict,
        store_baseline_supabase, load_baselines_supabase, delete_baseline_supabase
    )

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
try:
    from .prompt_engineering import extract_constraints, generate_prompt_variants, persist_prompts
except Exception:
    from prompt_engineering import extract_constraints, generate_prompt_variants, persist_prompts

app = FastAPI(title="Makerkit API (skeleton)")


def _pdf_escape_text(value: str) -> str:
    return (
        (value or '')
        .replace('\\', '\\\\')
        .replace('(', '\\(')
        .replace(')', '\\)')
        .replace('\r', ' ')
        .replace('\n', ' ')
    )


def _build_minimal_text_pdf(title: str, lines: list[str]) -> bytes:
    """Build a minimal one-page PDF with visible text, without external deps."""
    width, height = 595, 842
    x0, y0 = 50, 800
    leading = 14

    safe_lines = [title, ""] + [str(x) for x in (lines or [])]
    safe_lines = [s[:220] for s in safe_lines][:80]

    parts = ["BT", "/F1 12 Tf", f"{x0} {y0} Td"]
    for line in safe_lines:
        parts.append(f"({_pdf_escape_text(line)}) Tj")
        parts.append(f"0 -{leading} Td")
    parts.append("ET")
    stream = "\n".join(parts).encode('utf-8')

    buf = io.BytesIO()
    buf.write(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")

    offsets = [0]

    def write_obj(obj_num: int, data: bytes):
        offsets.append(buf.tell())
        buf.write(f"{obj_num} 0 obj\n".encode('ascii'))
        buf.write(data)
        if not data.endswith(b"\n"):
            buf.write(b"\n")
        buf.write(b"endobj\n")

    write_obj(1, b"<< /Type /Catalog /Pages 2 0 R >>")
    write_obj(2, b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>")
    page_obj = (
        f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {width} {height}] "
        f"/Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>"
    ).encode('ascii')
    write_obj(3, page_obj)
    write_obj(4, b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")
    content_obj = b"<< /Length " + str(len(stream)).encode('ascii') + b" >>\nstream\n" + stream + b"\nendstream"
    write_obj(5, content_obj)

    xref_pos = buf.tell()
    buf.write(b"xref\n")
    buf.write(f"0 {len(offsets)}\n".encode('ascii'))
    buf.write(b"0000000000 65535 f \n")
    for off in offsets[1:]:
        buf.write(f"{off:010d} 00000 n \n".encode('ascii'))
    buf.write(b"trailer\n")
    buf.write(f"<< /Size {len(offsets)} /Root 1 0 R >>\n".encode('ascii'))
    buf.write(b"startxref\n")
    buf.write(f"{xref_pos}\n".encode('ascii'))
    buf.write(b"%%EOF")
    return buf.getvalue()

# Local fallback for generated outputs when Supabase is unavailable.
try:
    from fastapi.staticfiles import StaticFiles
    LOCAL_API_BASE = os.getenv('LOCAL_API_BASE', 'http://127.0.0.1:8000')
    _static_dir = os.path.join(os.path.dirname(__file__), 'generated_outputs')
    os.makedirs(_static_dir, exist_ok=True)
    app.mount('/generated_outputs', StaticFiles(directory=_static_dir), name='generated_outputs')
except Exception:
    # If static files cannot be mounted for any reason, continue without failing.
    LOCAL_API_BASE = os.getenv('LOCAL_API_BASE', 'http://127.0.0.1:8000')

# Local state persistence (dev fallback).
# When Supabase is misconfigured (schema mismatch / RLS / missing FK rows), the API will
# fall back to in-memory lists. Under `uvicorn --reload`, those lists reset on reload.
# Persisting minimal state to disk keeps the GUI E2E even with Supabase enabled.
_LOCAL_STATE_PATH = os.path.join(os.path.dirname(__file__), 'generated_outputs', '_state.json')
_LOCAL_STATE_LOADED = False
_LOCAL_STATE_MTIME: float | None = None

def _load_local_state_if_needed() -> None:
    global _LOCAL_STATE_LOADED, _LOCAL_STATE_MTIME
    try:
        if not os.path.exists(_LOCAL_STATE_PATH):
            return

        # In dev, the API can run with reload or multiple workers. The state file may be
        # updated after the first request. Reload when mtime changes.
        try:
            mtime = os.path.getmtime(_LOCAL_STATE_PATH)
        except Exception:
            mtime = None
        if _LOCAL_STATE_LOADED and mtime is not None and _LOCAL_STATE_MTIME is not None and mtime <= _LOCAL_STATE_MTIME:
            return
        _LOCAL_STATE_LOADED = True
        if mtime is not None:
            _LOCAL_STATE_MTIME = mtime

        with open(_LOCAL_STATE_PATH, 'r', encoding='utf-8') as f:
            data = json.load(f)
        if not isinstance(data, dict):
            return
        # Merge without duplicating by primary keys.
        proj_by_id = {p.get('id'): p for p in PROJECTS if isinstance(p, dict) and p.get('id')}
        for p in (data.get('projects') or []):
            if isinstance(p, dict) and p.get('id') and p.get('id') not in proj_by_id:
                PROJECTS.append(p)
                proj_by_id[p.get('id')] = p
        run_by_id = {r.get('run_id'): r for r in RUNS if isinstance(r, dict) and r.get('run_id')}
        for r in (data.get('runs') or []):
            if isinstance(r, dict) and r.get('run_id') and r.get('run_id') not in run_by_id:
                RUNS.append(r)
                run_by_id[r.get('run_id')] = r
        var_by_id = {v.get('id'): v for v in VARIANTS if isinstance(v, dict) and v.get('id')}
        for v in (data.get('variants') or []):
            if isinstance(v, dict) and v.get('id') and v.get('id') not in var_by_id:
                VARIANTS.append(v)
                var_by_id[v.get('id')] = v
    except Exception:
        return

def _save_local_state() -> None:
    try:
        os.makedirs(os.path.dirname(_LOCAL_STATE_PATH), exist_ok=True)
        # Keep the file bounded.
        projects = [p for p in PROJECTS if isinstance(p, dict)][-200:]
        runs = [r for r in RUNS if isinstance(r, dict)][-200:]
        variants = [v for v in VARIANTS if isinstance(v, dict)][-1000:]
        payload = {'projects': projects, 'runs': runs, 'variants': variants, 'ts': datetime.now(UTC).isoformat()}
        with open(_LOCAL_STATE_PATH, 'w', encoding='utf-8') as f:
            json.dump(payload, f)
    except Exception:
        return

# CORS for local/dev: allow Next.js app on 3000
_CORS_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]
extra = os.getenv("CORS_EXTRA_ORIGIN")
if extra:
    _CORS_ORIGINS.append(extra)
app.add_middleware(
    CORSMiddleware,
    allow_origins=_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Health & readiness endpoints ---
@app.get("/api/v1/health")
def health():
    return {"status": "ok", "time": datetime.now(UTC).isoformat()}

@app.get("/api/v1/readiness")
def readiness():
    # Best-effort checks; do not fail hard in dev
    ok = True
    checks = {}
    try:
        checks["redis"] = bool(os.getenv("REDIS_URL"))
    except Exception:
        checks["redis"] = False
    try:
        checks["supabase"] = bool(os.getenv("SUPABASE_URL"))
    except Exception:
        checks["supabase"] = False
    try:
        checks["require_real_images"] = (os.getenv('REQUIRE_REAL_IMAGES') or '').strip().lower() in ('1','true','yes','on')
    except Exception:
        checks["require_real_images"] = False
    try:
        checks["hf_image_model"] = bool((os.getenv('HF_IMAGE_MODEL') or '').strip())
    except Exception:
        checks["hf_image_model"] = False
    try:
        checks["hf_token"] = bool((os.getenv('HF_TOKEN') or os.getenv('HUGGINGFACE_API_KEY') or os.getenv('HUGGINGFACE_HUB_TOKEN') or '').strip())
    except Exception:
        checks["hf_token"] = False
    try:
        checks["local_diffusers_enabled"] = (os.getenv('LOCAL_DIFFUSERS_ENABLED') == '1')
    except Exception:
        checks["local_diffusers_enabled"] = False
    return {"ready": ok, "checks": checks, "time": datetime.now(UTC).isoformat()}

def _require_real_images_enabled() -> bool:
    return (os.getenv('REQUIRE_REAL_IMAGES') or '').strip().lower() in ('1','true','yes','on')

# Structured logging (JSON) + optional OpenTelemetry tracing
class JsonFormatter(logging.Formatter):
    def format(self, record):
        base = {
            'level': record.levelname,
            'message': record.getMessage(),
            'logger': record.name,
        }
        if record.exc_info:
            base['exception'] = self.formatException(record.exc_info)
        return json.dumps(base)

handler = logging.StreamHandler()
handler.setFormatter(JsonFormatter())
logging.basicConfig(level=os.getenv('LOG_LEVEL','INFO'), handlers=[handler])
log = logging.getLogger('api')

if os.getenv('OTEL_EXPORTER_OTLP_ENDPOINT'):
    try:
        from opentelemetry import trace  # type: ignore
        from opentelemetry.sdk.resources import Resource  # type: ignore
        from opentelemetry.sdk.trace import TracerProvider  # type: ignore
        from opentelemetry.sdk.trace.export import BatchSpanProcessor  # type: ignore
        from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter  # type: ignore
        resource = Resource.create({'service.name': 'makerkit-api'})
        provider = TracerProvider(resource=resource)
        processor = BatchSpanProcessor(OTLPSpanExporter(endpoint=os.getenv('OTEL_EXPORTER_OTLP_ENDPOINT')))
        provider.add_span_processor(processor)
        trace.set_tracer_provider(provider)
        log.info('otel_initialized')
    except Exception as e:
        log.warning(f'otel_init_failed {e}')

# Lightweight in-memory LRU cache for variant detail responses (Supabase-backed).
# Sized to a small default to avoid excessive memory; configurable via env.
VARIANT_DETAIL_CACHE_MAX = int(os.getenv('VARIANT_DETAIL_CACHE_MAX', '64'))
VARIANT_DETAIL_CACHE: OrderedDict[str, dict] = OrderedDict()

def _variant_detail_cache_get(variant_id: str) -> dict | None:
    cached = VARIANT_DETAIL_CACHE.get(variant_id)
    if cached is not None:
        # Refresh LRU order
        try:
            VARIANT_DETAIL_CACHE.move_to_end(variant_id)
        except Exception:
            pass
        return cached
    return None

def _variant_detail_cache_set(variant_id: str, detail_obj) -> None:
    # detail_obj expected to be a pydantic VariantDetailOut
    try:
        VARIANT_DETAIL_CACHE[variant_id] = detail_obj.dict()
        VARIANT_DETAIL_CACHE.move_to_end(variant_id)
        if len(VARIANT_DETAIL_CACHE) > VARIANT_DETAIL_CACHE_MAX:
            # Pop oldest
            try:
                VARIANT_DETAIL_CACHE.popitem(last=False)
            except Exception:
                pass
    except Exception as e:
        log.debug(json.dumps({'event':'variant_cache_set_failed','variant_id':variant_id,'error':str(e)}))


class RunCreate(BaseModel):
    project_id: str
    input_mode: Optional[str] = 'text'
    description: Optional[str] = None
    # Additional fields from spec: constraints and options
    constraints: Optional[dict] = {}
    options: Optional[dict] = {}
    skip_processing: Optional[bool] = False  # test-only flag to avoid scheduling background worker


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
    mlflow_experiment_id: Optional[str] = None
    mlflow_run_id: Optional[str] = None
    dvc_commit: Optional[str] = None


class BriefPayload(BaseModel):
    text: str
    count: int | None = None

class PromptGenRequest(BaseModel):
    run_id: Optional[str] = None
    brief: str
    count: int | None = 4
    persist: bool | None = True
    extract: bool | None = True  # whether to return constraint extraction

class PromptGenResponse(BaseModel):
    ok: bool
    prompts: List[dict]
    constraints: Optional[dict] = None

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

class VariantDetailOut(BaseModel):
    variant: VariantOut
    dfx: Optional[dict] = None
    prompts: List[dict] = []

class ExportPresignRequest(BaseModel):
    run_id: str
    kind: str  # e.g. 'pdf' | 'zip' | 'stl'

class ExportPresignResponse(BaseModel):
    url: str
    expires_at: str


# In-memory stores for prototype
PROJECTS = []
RUNS = []
VARIANTS: list[dict] = []  # in-memory variant store when Supabase disabled
SKETCHES: dict[str, dict] = {}  # in-memory sketches store { sketch_id: { b64, svg } }
WEIGHTS_HISTORY: list[dict] = []  # in-memory weights change events when Supabase disabled
try:
    # When running as a top-level module (tests import `main`), absolute imports work.
    from lib.env_utils import get_redis_client, is_jwt_required, get_rate_config
except Exception:
    from .lib.env_utils import get_redis_client, is_jwt_required, get_rate_config

try:
    from lib.rate_limiter import rate_check as _rate_check
except Exception:
    from .lib.rate_limiter import rate_check as _rate_check

# initialize redis client via helper (keeps import-time side-effects centralized)
_redis_client = get_redis_client()
_RATE_WINDOW_S, _RATE_MAX = get_rate_config()
REDIS_URL = os.getenv('REDIS_URL')
API_KEY_REQUIRED = os.getenv('API_KEY_REQUIRED') == '1'
API_KEY_VALUE = os.getenv('API_KEY_VALUE')
JWT_REQUIRED = is_jwt_required()

AUDIT_LOG: list[dict] = []  # simple in-memory audit events (fallback when Supabase not set)
METRICS: dict[str, dict] = {}

# Prometheus instrumentation (lazy if library missing)
if Counter and Histogram:
    REQUEST_COUNT = Counter('api_requests_total', 'Total HTTP requests', ['method','path','status'])
    REQUEST_LATENCY = Histogram('api_request_duration_seconds', 'Request latency (seconds)', ['method','path'])
else:
    REQUEST_COUNT = REQUEST_LATENCY = None

def _audit(event: str, request: Request, extra: dict | None = None):
    # Be defensive: some callers build a synthetic `Request`-like object
    # without headers/scope (e.g. internal dummy requests). Try to
    # extract `path` and `user` safely and fall back to best-effort
    # values when unavailable.
    try:
        user = getattr(request.state, 'user', {}) or {}
    except Exception:
        user = {}
    try:
        path = request.url.path
    except Exception:
        try:
            path = getattr(request, 'path', None) or (getattr(request, 'scope', {}) or {}).get('path')
        except Exception:
            path = None
    record = {
        'ts': datetime.now(UTC).isoformat(),
        'event': event,
        'user_id': user.get('id') if isinstance(user, dict) else getattr(user, 'id', None),
        'role': user.get('role') if isinstance(user, dict) else getattr(user, 'role', None),
        'tenant': user.get('tenant') if isinstance(user, dict) else getattr(user, 'tenant', None),
        'path': path,
        'extra': extra or {},
    }
    AUDIT_LOG.append(record)
    if len(AUDIT_LOG) > 500:
        del AUDIT_LOG[:100]
    # Persist to Supabase audit_log if configured
    if _supabase_is_configured():
        try:
            url = os.getenv('SUPABASE_URL')
            ep = f"{url}/rest/v1/audit_log"
            headers = supabase_headers(); headers['Prefer'] = 'return=minimal'
            payload = {
                'tenant_id': user.get('tenant'),
                'user_id': user.get('id'),
                'role': user.get('role'),
                'event': event,
                'path': request.url.path,
                'extra': record['extra'],
                'prev_hash': None  # server trigger computes hash chain
            }
            requests.post(ep, headers=headers, json=payload, timeout=4)
        except Exception as e:
            log.debug(json.dumps({'event':'audit_persist_failed','error':str(e)}))

def _metrics_record(path: str, dur_ms: float):
    entry = METRICS.setdefault(path, {'count':0,'durations':[]})
    entry['count'] += 1
    entry['durations'].append(dur_ms)
    if len(entry['durations']) > 1000:
        entry['durations'] = entry['durations'][-500:]

@app.middleware('http')
async def auth_and_rate_limit(request: Request, call_next):
    # Limit only mutating endpoints (POST) for rate; enforce API key if configured
    if request.method == 'POST':
        # Prefer a stable identifier for rate-limiting when JWT auth present
        user = getattr(request.state, 'user', None) or {}
        if user and user.get('id'):
            client_id = f"user:{user.get('id')}"
        else:
            client_id = request.client.host if request.client else 'unknown'
        allowed, count = _rate_check(client_id)
        log.debug(json.dumps({'event':'rate_check','client_id':client_id,'allowed':allowed,'count':count}))
        if not allowed:
            return Response(
                content=json.dumps({'detail': _tr(request,'rate limit exceeded'),'window_seconds':_RATE_WINDOW_S,'max':_RATE_MAX}),
                status_code=429,
                media_type='application/json'
            )
        if API_KEY_REQUIRED:
            supplied = request.headers.get('X-API-Key') or ''
            if not API_KEY_VALUE or supplied != API_KEY_VALUE:
                return Response(content=json.dumps({'detail':'invalid or missing API key'}), status_code=401, media_type='application/json')
    start = datetime.now(UTC)
    resp = await call_next(request)
    dur_ms = (datetime.now(UTC) - start).total_seconds() * 1000.0
    _metrics_record(request.url.path, dur_ms)
    # Prometheus record
    if REQUEST_COUNT and REQUEST_LATENCY:
        try:
            REQUEST_COUNT.labels(request.method, request.url.path, resp.status_code).inc()
            REQUEST_LATENCY.labels(request.method, request.url.path).observe(dur_ms/1000.0)
        except Exception:
            pass
    return resp

I18N = {
    'fr': {
        'missing bearer token': 'jeton bearer manquant',
        'jwt secret not configured': 'secret JWT non configuré',
        'invalid token': 'jeton invalide',
        'authentication required': 'authentification requise',
        'insufficient role': 'rôle insuffisant',
        'forbidden cross-tenant project': 'projet interdit (locataire différent)',
        'forbidden cross-tenant run': 'exécution interdite (locataire différent)',
        'project not found': 'projet introuvable',
        'run not found': 'exécution introuvable',
        'rate limit exceeded': 'limite de débit dépassée',
        'anonymized': 'utilisateur anonymisé'
    }
}

def _lang(request: Request) -> str:
    al = request.headers.get('Accept-Language','').lower()
    if al.startswith('fr'):
        return 'fr'
    return 'en'

def _tr(request: Request, msg: str) -> str:
    lang = _lang(request)
    if lang != 'en':
        return I18N.get(lang, {}).get(msg, msg)
    return msg

def _heuristic_normalize(text: str) -> dict:
    """Best-effort extractor when LLM is unavailable.

    - Detect material keywords (French/English) → materials list
    - Extract a single dimension from patterns like "6cm" or "60 mm" → width_mm
    - Set dfx_aspects from words like "flexible"/"flexibility"
    """
    t = (text or '').lower()
    materials = []
    if 'pla' in t:
        materials.append('PLA')
    if 'tpu' in t:
        materials.append('TPU')
    if 'plastique' in t or 'plastic' in t:
        if not materials:
            materials.append('plastic')
    # dimension: match e.g. 6cm or 60 mm
    width_mm = None
    import re
    m = re.search(r"(\d+(?:[.,]\d+)?)\s*cm", t)
    if m:
        try:
            width_mm = int(round(float(m.group(1).replace(',', '.')) * 10))
        except Exception:
            width_mm = None
    else:
        m2 = re.search(r"(\d+(?:[.,]\d+)?)\s*mm", t)
        if m2:
            try:
                width_mm = int(round(float(m2.group(1).replace(',', '.'))))
            except Exception:
                width_mm = None
    aspects = []
    if 'flexible' in t or 'flexibility' in t:
        aspects.append('flexibility')
    return {
        'constraints': { 'materials': materials },
        'options': { 'width_mm': width_mm, 'height_mm': None, 'depth_mm': None },
        'weighting': { a: 1.0 for a in aspects },
        'raw': { 'material': materials[0] if materials else None, 'dimensions': { 'width_mm': width_mm }, 'dfx_aspects': aspects }
    }

@app.middleware('http')
async def jwt_auth(request: Request, call_next):
    """JWT auth middleware (optional when JWT_REQUIRED=1). Validates Supabase JWT using HS256.

    Sets request.state.user = { id, role } on success. Returns 401 on failure.
    Falls through when JWT_REQUIRED disabled.
    """
    # Evaluate JWT enforcement at request time so per-test env changes are
    # respected and import-time ordering won't leak auth settings across tests.
    jwt_required_now = (os.getenv('JWT_REQUIRED') == '1') and bool(os.getenv('SUPABASE_JWT_SECRET'))
    log.debug(json.dumps({'event':'jwt_auth_check','jwt_required_now':jwt_required_now,'secret_set': bool(os.getenv('SUPABASE_JWT_SECRET')),'path': request.url.path,'has_auth_header': bool(request.headers.get('Authorization'))}))

    # If an Authorization header is present, validate it and set request.state.user.
    # If absent we'll leave request.state.user unset (anonymous). Endpoints that
    # require roles must call `_require_role` and will enforce auth based on the
    # current request-time JWT settings.
    auth_header = request.headers.get('Authorization') or ''
    if auth_header.startswith('Bearer '):
        token = auth_header.split(' ', 1)[1].strip()
        secret = os.getenv('SUPABASE_JWT_SECRET')
        if not secret:
            return Response(content=json.dumps({'detail': _tr(request,'jwt secret not configured')}), status_code=503, media_type='application/json')
        try:
            payload = jwt.decode(token, secret, algorithms=['HS256'], options={'verify_aud': False})
            tenant = payload.get('tenant') or 'public'
            request.state.user = {'id': payload.get('sub'), 'role': payload.get('role'), 'tenant': tenant}
        except Exception as e:
            return Response(content=json.dumps({'detail': _tr(request,'invalid token'),'error':str(e)}), status_code=401, media_type='application/json')

    return await call_next(request)

def _require_role(request: Request, allowed: list[str]):
    """Guard helper to enforce role membership when JWT auth is active.

    Uses module-level `JWT_REQUIRED` and `SUPABASE_JWT_SECRET` so behavior is
    consistent with jwt_auth and not sensitive to os.environ mutations during
    test collection.
    """
    jwt_required_now = (os.getenv('JWT_REQUIRED') == '1') and bool(os.getenv('SUPABASE_JWT_SECRET'))
    log.debug(json.dumps({'event':'require_role_check','jwt_required_now':jwt_required_now,'supabase_jwt_secret': bool(os.getenv('SUPABASE_JWT_SECRET')),'has_auth_header': bool(request.headers.get('Authorization')),'user_present': bool(getattr(request.state,'user',None))}))
    if jwt_required_now:
        user = getattr(request.state, 'user', None)
        if not user:
            raise HTTPException(status_code=401, detail=_tr(request,'authentication required'))
        role = user.get('role')
        # reviewer treated as read-only elevated; allow if endpoint is read and reviewer present
        if role == 'reviewer' and request.method in ('GET','HEAD'):
            return
        if role not in allowed:
            raise HTTPException(status_code=403, detail=_tr(request,'insufficient role'))

# Optional Supabase / PostgREST backing (if SUPABASE_URL & SUPABASE_KEY are set)
SUPABASE_URL = None
SUPABASE_KEY = None
SUPABASE_STORAGE_BUCKET = None
MLFLOW_TRACKING_URI = os.getenv('MLFLOW_TRACKING_URI')
_mlflow_enabled = False
if MLFLOW_TRACKING_URI:
    try:
        import mlflow  # type: ignore
        mlflow.set_tracking_uri(MLFLOW_TRACKING_URI)
        _mlflow_enabled = True
        log.info('mlflow_initialized')
    except Exception:
        # Prefer in-repo stub when real mlflow not available
        try:
            from .mlflow_stub import mlflow as mlflow_stub  # type: ignore
        except Exception:
            try:
                from mlflow_stub import mlflow as mlflow_stub
            except Exception:
                mlflow_stub = None
        if mlflow_stub:
            try:
                mlflow_stub.set_tracking_uri(MLFLOW_TRACKING_URI)
                _mlflow_enabled = True
                log.info('mlflow_stub_initialized')
            except Exception as e:
                log.warning(f'mlflow_stub_init_failed {e}')
        else:
            log.warning('mlflow_init_failed')

# Supabase Python client initialization (for new modules using supabase-py)
_supabase_client = None
if REDIS_URL and REDIS_URL.startswith('fakeredis://'):
    # Running tests that use fakeredis; prefer in-memory fallbacks
    # When fakeredis is in use prefer in-memory fallbacks; do not treat
    # Supabase as enabled even if env vars exist.
    # Keep module-level SUPABASE_URL for compatibility but prefer a
    # runtime check via `_supabase_is_configured()` below.
    SUPABASE_URL = None
    SUPABASE_KEY = None
    SUPABASE_STORAGE_BUCKET = None


def _supabase_is_configured() -> bool:
    """Return True when Supabase REST endpoints should be used.

    This helper reads environment variables at call-time so tests that
    set env via monkeypatch before importing or at runtime are respected.
    It also treats fakeredis usage as opting into in-memory fallbacks.
    """
    disabled = (os.getenv('SUPABASE_DISABLE') or '').strip().lower() in ('1', 'true', 'yes', 'on')
    if disabled:
        return False
    url = os.getenv('SUPABASE_URL')
    key = os.getenv('SUPABASE_SERVICE_ROLE_KEY') or os.getenv('SUPABASE_KEY')
    redis_url = os.getenv('REDIS_URL')
    # If tests explicitly request strict Supabase behavior, respect that
    # even when fakeredis is present (used in some test suites).
    strict = os.getenv('SUPABASE_STRICT') == '1'
    if redis_url and redis_url.startswith('fakeredis://') and not strict:
        return False
    return bool(url and key)

if _supabase_is_configured():
    try:
        from supabase import create_client, Client  # type: ignore
        # Evaluate env at call-time to avoid import-time fixed values
        _supabase_client = create_client(
            os.getenv('SUPABASE_URL'),
            os.getenv('SUPABASE_SERVICE_ROLE_KEY') or os.getenv('SUPABASE_KEY'),
        )
        log.info('supabase_python_client_initialized')
    except Exception as e:
        log.warning(f'supabase_python_client_init_failed: {e}')

def supabase_client() -> Any:
    """Get Supabase Python client instance."""
    if not _supabase_client:
        raise HTTPException(status_code=503, detail="Supabase client not initialized")
    return _supabase_client

def supabase_headers():
    # Read the key at call-time so tests can set/clear env vars between runs
    key = (os.getenv('SUPABASE_SERVICE_ROLE_KEY') or os.getenv('SUPABASE_KEY') or '')
    return {
        'apikey': key,
        'Authorization': f'Bearer {key}',
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    }

def _upload_and_sign(supabase, data: bytes, filename: str, content_type: str = 'application/octet-stream', expires_in: int = 3600) -> Optional[str]:
    """
    Upload bytes to Supabase Storage and return signed URL.
    
    Args:
        supabase: Supabase client (unused - we use REST API directly)
        data: Bytes to upload
        filename: Object name/path in bucket
        content_type: MIME type
        expires_in: URL expiration in seconds
    
    Returns:
        Signed URL string or None if failed
    """
    # Use call-time evaluation of Supabase env vars to respect test-time monkeypatching
    if not (_supabase_is_configured() and os.getenv('SUPABASE_STORAGE_BUCKET')):
        return None
    try:
        # Upload file
        url = os.getenv('SUPABASE_URL')
        bucket = os.getenv('SUPABASE_STORAGE_BUCKET')
        upload_url = f"{url}/storage/v1/object/{bucket}/{filename}"
        key = (os.getenv('SUPABASE_SERVICE_ROLE_KEY') or os.getenv('SUPABASE_KEY') or '')
        up_headers = {
            'apikey': key,
            'Authorization': f"Bearer {key}" if key else '',
            'Content-Type': content_type,
        }
        up_res = requests.post(upload_url, headers=up_headers, data=data)
        if up_res.status_code not in (200, 201):
            log.warning(f'storage_upload_failed status={up_res.status_code}')
            return None
        
        # Create signed URL
        # Use call-time env values for signing to respect test-time overrides
        bucket = os.getenv('SUPABASE_STORAGE_BUCKET')
        key = (os.getenv('SUPABASE_SERVICE_ROLE_KEY') or os.getenv('SUPABASE_KEY') or '')
        sign_url = f"{url}/storage/v1/object/sign/{bucket}/{filename}"
        sig_headers = {
            'apikey': key,
            'Authorization': f'Bearer {key}' if key else '',
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        }
        sig_res = requests.post(sign_url, headers=sig_headers, json={"expiresIn": expires_in})
        if not sig_res.ok:
            log.warning(f'storage_sign_failed status={sig_res.status_code}')
            return None
        
        data_json = sig_res.json()
        signed_path = data_json.get('signedURL') or data_json.get('signedUrl')
        if not signed_path:
            return None
        
        return f"{url}{signed_path}" if signed_path.startswith('/') else signed_path
    except Exception as e:
        log.error(f'upload_and_sign_error: {e}')
        return None

def list_runs_supabase(tenant_id: str | None = None):
    if not _supabase_is_configured():
        return None
    url = os.getenv('SUPABASE_URL')
    ep = f"{url}/rest/v1/runs?select=*"
    if tenant_id:
        # Some schemas may not have tenant_id; best-effort filter.
        try:
            r = requests.get(ep + f"&tenant_id=eq.{tenant_id}", headers=supabase_headers())
            r.raise_for_status()
            return r.json()
        except Exception:
            # Retry without tenant filter
            r = requests.get(ep, headers=supabase_headers())
            r.raise_for_status()
            return r.json()
    r = requests.get(ep, headers=supabase_headers())
    r.raise_for_status()
    return r.json()

def fetch_run_supabase(run_id: str):
    if not _supabase_is_configured():
        return None
    url = os.getenv('SUPABASE_URL')
    ep = f"{url}/rest/v1/runs?run_id=eq.{run_id}&select=*"
    r = requests.get(ep, headers=supabase_headers())
    r.raise_for_status()
    items = r.json()
    if isinstance(items, list) and items:
        return items[0]
    return None

def list_variants_supabase(run_id: str):
    if not _supabase_is_configured():
        return []
    url = os.getenv('SUPABASE_URL')
    ep = f"{url}/rest/v1/variants?run_id=eq.{run_id}&select=*"
    r = requests.get(ep, headers=supabase_headers())
    r.raise_for_status()
    return r.json()

def fetch_dfx_summary_for_variant_supabase(variant_id: str):
    if not _supabase_is_configured():
        return None
    url = os.getenv('SUPABASE_URL')
    ep = f"{url}/rest/v1/dfx_summaries?variant_id=eq.{variant_id}&select=*"
    r = requests.get(ep, headers=supabase_headers())
    r.raise_for_status()
    items = r.json()
    if isinstance(items, list) and items:
        return items[0]
    return None

def fetch_variant_supabase(variant_id: str):
    if not _supabase_is_configured():
        return None
    url = os.getenv('SUPABASE_URL')
    ep = f"{url}/rest/v1/variants?id=eq.{variant_id}&select=*"
    r = requests.get(ep, headers=supabase_headers())
    r.raise_for_status()
    items = r.json()
    if isinstance(items, list) and items:
        return items[0]
    return None

def list_prompts_supabase(run_id: str):
    if not _supabase_is_configured():
        return []
    url = os.getenv('SUPABASE_URL')
    ep = f"{url}/rest/v1/prompts?run_id=eq.{run_id}&select=*"
    r = requests.get(ep, headers=supabase_headers())
    r.raise_for_status()
    return r.json()

def list_exports_supabase(run_id: str):
    if not _supabase_is_configured():
        return []
    url = os.getenv('SUPABASE_URL')
    ep = f"{url}/rest/v1/exports?run_id=eq.{run_id}&select=*"
    r = requests.get(ep, headers=supabase_headers())
    r.raise_for_status()
    return r.json()

def create_export_supabase(run_id: str, kind: str, url: str):
    if not _supabase_is_configured():
        return None
    ep = f"{os.getenv('SUPABASE_URL')}/rest/v1/exports"
    headers = supabase_headers(); headers['Prefer'] = 'return=representation'
    payload = {
        'run_id': run_id,
        'kind': kind,
        'url': url,
        'created_at': datetime.now(UTC).isoformat(),
        'expires_at': datetime.now(UTC).isoformat(),
    }
    resp = requests.post(ep, headers=headers, json=payload)
    if resp.ok:
        try:
            return resp.json()
        except Exception:
            return None
    return None

def create_run_supabase(payload: dict):
    if not _supabase_is_configured():
        return None
    url = f"{os.getenv('SUPABASE_URL')}/rest/v1/runs"
    # Supabase requires Prefer: return=representation to return the created row
    headers = supabase_headers()
    headers['Prefer'] = 'return=representation'
    payload2 = dict(payload or {})

    def _post(p: dict):
        return requests.post(url, headers=headers, json=p)

    r = _post(payload2)
    if not r.ok:
        # Supabase/PostgREST schema drift is common across environments.
        # Retry a few times by removing unknown columns and/or mapping status.
        for _ in range(6):
            try:
                body = r.text or ''
            except Exception:
                body = ''
            body_l = body.lower()

            # 1) Status check constraint in older schemas may reject 'queued'
            if (
                r.status_code in (400, 409)
                and 'status' in payload2
                and str(payload2.get('status')).lower() == 'queued'
                and ('check constraint' in body_l or 'runs_status_check' in body_l or 'violates' in body_l)
            ):
                payload2['status'] = 'pending'
                r = _post(payload2)
                if r.ok:
                    break
                continue

            # 2) Unknown column errors (PGRST schema cache)
            # Example: Could not find the 'tenant_id' column of 'runs' in the schema cache
            unknown_col = None
            try:
                import re
                m = re.search(r"could not find the '([^']+)' column", body, flags=re.IGNORECASE)
                if m:
                    unknown_col = m.group(1)
            except Exception:
                unknown_col = None

            # Fallback heuristic: if response body mentions a known optional key, drop it.
            if not unknown_col:
                for k in ('tenant_id', 'input_mode', 'description', 'constraints'):
                    if k in payload2 and k in body_l:
                        unknown_col = k
                        break

            if unknown_col and unknown_col in payload2:
                payload2.pop(unknown_col, None)
                r = _post(payload2)
                if r.ok:
                    break
                continue

            # 3) If we can't infer the mismatch, stop retrying.
            break

    r.raise_for_status()
    items = r.json()
    return items[0] if isinstance(items, list) and items else items

def list_projects_supabase(tenant_id: str | None = None):
    if not _supabase_is_configured():
        return None
    url = os.getenv('SUPABASE_URL')
    ep = f"{url}/rest/v1/projects?select=*"
    if tenant_id:
        # Some schemas may not have tenant_id; best-effort filter.
        try:
            r = requests.get(ep + f"&tenant_id=eq.{tenant_id}", headers=supabase_headers())
            r.raise_for_status()
            return r.json()
        except Exception:
            # Retry without tenant filter
            r = requests.get(ep, headers=supabase_headers())
            r.raise_for_status()
            return r.json()
    r = requests.get(ep, headers=supabase_headers())
    r.raise_for_status()
    return r.json()

def fetch_project_supabase(project_id: str):
    if not _supabase_is_configured():
        return None
    url = os.getenv('SUPABASE_URL')
    ep = f"{url}/rest/v1/projects?id=eq.{project_id}&select=*"
    r = requests.get(ep, headers=supabase_headers())
    r.raise_for_status()
    items = r.json()
    if isinstance(items, list) and items:
        return items[0]
    return None

def create_project_supabase(payload: dict):
    if not _supabase_is_configured():
        return None
    url = f"{os.getenv('SUPABASE_URL')}/rest/v1/projects"
    headers = supabase_headers()
    headers['Prefer'] = 'return=representation'
    r = requests.post(url, headers=headers, json=payload)
    if not r.ok:
        # Some schemas may not have tenant_id; retry without it.
        try:
            body = r.text or ''
        except Exception:
            body = ''
        if r.status_code == 400 and 'tenant_id' in body and isinstance(payload, dict) and 'tenant_id' in payload:
            payload2 = dict(payload)
            payload2.pop('tenant_id', None)
            r = requests.post(url, headers=headers, json=payload2)
    r.raise_for_status()
    items = r.json()
    return items[0] if isinstance(items, list) and items else items


@app.get('/health')
def health():
    return {"status": "ok", "time": datetime.now(UTC).isoformat()}


@app.get('/api/v1/projects')
def list_projects(request: Request):
    _load_local_state_if_needed()
    tenant_id = getattr(request.state, 'user', {}).get('tenant') or 'public'

    # Always include local fallback projects so the UI remains consistent even
    # when Supabase is partially configured or transiently failing.
    local_items = [p for p in PROJECTS if p.get('tenant_id') == tenant_id]

    if not _supabase_is_configured():
        return local_items

    # If Supabase is configured, fetch projects from the remote DB and merge.
    try:
        remote_items = list_projects_supabase(tenant_id)
        if not isinstance(remote_items, list):
            remote_items = []
    except Exception as e:
        print('Supabase list_projects error:', e)
        remote_items = []

    merged: list[dict] = []
    seen_ids: set[str] = set()
    for item in (remote_items + local_items):
        if not isinstance(item, dict):
            continue
        item_id = str(item.get('id') or '')
        if item_id and item_id in seen_ids:
            continue
        if item_id:
            seen_ids.add(item_id)
        merged.append(item)
    return merged


@app.get('/api/v1/projects/{project_id}')
def get_project(project_id: str, request: Request):
    try:
        if _supabase_is_configured():
            item = fetch_project_supabase(project_id)
            if item:
                tenant_id = getattr(request.state, 'user', {}).get('tenant') or 'public'
                if item.get('tenant_id') and item.get('tenant_id') != tenant_id:
                    raise HTTPException(status_code=403, detail=_tr(request,'forbidden cross-tenant project'))
                return item
    except Exception as e:
        print('Supabase get_project error:', e)
    # Fallback to in-memory
    tenant_id = getattr(request.state, 'user', {}).get('tenant') or 'public'
    for p in PROJECTS:
        if p.get('id') == project_id:
            if p.get('tenant_id') and p.get('tenant_id') != tenant_id:
                raise HTTPException(status_code=403, detail=_tr(request,'forbidden cross-tenant project'))
            return p
    raise HTTPException(status_code=404, detail=f"Project {project_id} not found")


@app.delete('/api/v1/projects/{project_id}')
def delete_project(project_id: str, request: Request):
    """Delete a project.

    When Supabase is configured, deletes the row via PostgREST.
    Always removes local cached project and any in-memory runs/variants
    associated to that project so the UI reflects the deletion immediately.
    """
    _require_role(request, ['admin', 'designer'])
    _load_local_state_if_needed()
    tenant_id = getattr(request.state, 'user', {}).get('tenant') or 'public'

    deleted_remote = False
    if _supabase_is_configured():
        try:
            url = os.getenv('SUPABASE_URL')
            ep = f"{url}/rest/v1/projects?id=eq.{project_id}"
            headers = supabase_headers()
            headers['Prefer'] = 'return=representation'
            r = requests.delete(ep, headers=headers)
            # If the row doesn't exist remotely, PostgREST can return 204.
            if r.status_code in (200, 204):
                deleted_remote = True
            elif r.status_code == 404:
                deleted_remote = False
            else:
                r.raise_for_status()
        except Exception as e:
            print('Supabase delete_project error:', e)

    # Local deletion (cache + pure in-memory mode)
    # Filter by tenant_id when present to avoid cross-tenant deletion.
    before_projects = len(PROJECTS)
    PROJECTS[:] = [p for p in PROJECTS if not (p.get('id') == project_id and (not p.get('tenant_id') or p.get('tenant_id') == tenant_id))]

    # Remove in-memory runs and variants that belong to the project.
    run_ids = {r.get('run_id') for r in RUNS if (r.get('project_id') == project_id and (not r.get('tenant_id') or r.get('tenant_id') == tenant_id))}
    if run_ids:
        RUNS[:] = [r for r in RUNS if r.get('run_id') not in run_ids]
        try:
            VARIANTS[:] = [v for v in VARIANTS if v.get('run_id') not in run_ids]
        except Exception:
            pass

    _save_local_state()

    deleted_local = before_projects != len(PROJECTS)
    if not deleted_local and not deleted_remote:
        raise HTTPException(status_code=404, detail=f"Project {project_id} not found")

    _audit('project.deleted', request, {'project_id': project_id})
    return {'ok': True, 'project_id': project_id}


class ProjectCreate(BaseModel):
    title: str
    description: Optional[str] = None
    product_type: Optional[str] = 'other'
    brief: Optional[str] = None
    materials: Optional[list[str]] = None
    constraints: Optional[dict] = None
    logo_url: Optional[str] = None


@app.post('/api/v1/projects')
def create_project(body: ProjectCreate, request: Request):
    _require_role(request, ['admin','designer'])
    _load_local_state_if_needed()
    tenant_id = getattr(request.state, 'user', {}).get('tenant') or 'public'
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
        'tenant_id': tenant_id,
    }
    # Try Supabase first
    try:
        if _supabase_is_configured():
            row = create_project_supabase(payload)
            # Cache locally for dev reload resilience
            try:
                if isinstance(row, dict):
                    proj = dict(row)
                    proj.setdefault('tenant_id', tenant_id)
                    if proj.get('id') and not any(p.get('id') == proj.get('id') for p in PROJECTS if isinstance(p, dict)):
                        PROJECTS.insert(0, proj)
                        _save_local_state()
            except Exception:
                pass
            return row
    except Exception as e:
        print('Supabase create_project error:', e)
    # Fallback in-memory
    proj = payload.copy()
    proj['id'] = str(uuid.uuid4())
    proj['tenant_id'] = tenant_id
    PROJECTS.insert(0, proj)
    _save_local_state()
    _audit('project.created', request, {'project_id': proj['id']})
    return proj


@app.post('/api/v1/runs', response_model=RunOut)
def create_run(payload: RunCreate, background_tasks: BackgroundTasks, request: Request):
    _require_role(request, ['admin','designer','engineer'])
    _load_local_state_if_needed()
    # minimal validation
    if not payload.project_id:
        raise HTTPException(status_code=400, detail="project_id required")
    # For prompt/text runs, an empty description leads to off-target or repetitive images.
    try:
        mode = (payload.input_mode or '').strip().lower()
    except Exception:
        mode = ''
    if mode in ('text', 'prompt'):
        desc = (payload.description or '').strip()
        if not desc:
            raise HTTPException(status_code=400, detail="description required for text/prompt runs")
    # Generate a public run_id (required by schema; run_id column is NOT NULL UNIQUE)
    run_id_val = f"run-{uuid.uuid4().hex[:8]}"
    # If Supabase is configured, persist run there and return representation
    tenant_id = getattr(request.state, 'user', {}).get('tenant') or 'public'
    # Discover current git commit (DVC linkage placeholder)
    dvc_commit = None
    try:
        import subprocess
        dvc_commit = subprocess.check_output(['git','rev-parse','HEAD'], timeout=5).decode().strip()
    except Exception:
        dvc_commit = None
    mlflow_experiment_id = None
    mlflow_run_id = None
    try:
        if _supabase_is_configured():
            # Schema uses 'parameters' instead of 'options'
            row = create_run_supabase({
                'run_id': run_id_val,
                'project_id': payload.project_id,
                'status': 'queued',
                'input_mode': payload.input_mode,
                'description': payload.description,
                'constraints': payload.constraints,
                'parameters': payload.options,  # store provided options
                'created_at': datetime.now(UTC).isoformat(),
                'tenant_id': tenant_id,
            })
            if row:
                # Cache locally for dev reload resilience and to avoid "run not found" on follow-up calls
                try:
                    cached = {
                        'run_id': run_id_val,
                        'status': row.get('status', 'queued') if isinstance(row, dict) else 'queued',
                        'project_id': row.get('project_id', payload.project_id) if isinstance(row, dict) else payload.project_id,
                        'created_at': row.get('created_at', datetime.now(UTC).isoformat()) if isinstance(row, dict) else datetime.now(UTC).isoformat(),
                        'tenant_id': tenant_id,
                        'input_mode': payload.input_mode,
                        'description': payload.description,
                        'constraints': payload.constraints or {},
                        'options': payload.options or {},
                        'metadata': {},
                    }
                    if not any(r.get('run_id') == run_id_val for r in RUNS if isinstance(r, dict)):
                        RUNS.insert(0, cached)
                        _save_local_state()
                except Exception:
                    pass
                # schedule async processing (Celery preferred if enabled)
                if not payload.skip_processing:
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
                # MLflow tracking for persisted run (log basic params) BEFORE returning
                if _mlflow_enabled:
                    try:
                        import mlflow  # type: ignore
                        exp = mlflow.get_experiment_by_name('makerkit')
                        if exp is None:
                            exp_id = mlflow.create_experiment('makerkit')
                        else:
                            exp_id = exp.experiment_id
                        mlflow.set_experiment('makerkit')
                        with mlflow.start_run(run_name=run_id_val) as active_run:
                            mlflow_experiment_id = exp_id
                            mlflow_run_id = active_run.info.run_id
                            mlflow.log_param('project_id', payload.project_id)
                            mlflow.log_param('input_mode', payload.input_mode)
                            mlflow.log_param('has_constraints', bool(payload.constraints))
                            mlflow.log_param('options_count', len(payload.options or {}))
                            if dvc_commit:
                                mlflow.log_param('dvc_commit', dvc_commit)
                    except Exception as e:
                        log.warning(json.dumps({'event':'mlflow_log_failed','run_id':run_id_val,'error':str(e)}))
                return RunOut(**{
                    'run_id': run_id_val,
                    'status': row.get('status', 'queued'),
                    'project_id': row.get('project_id', payload.project_id),
                    'created_at': row.get('created_at', datetime.now(UTC).isoformat()),
                    'mlflow_experiment_id': mlflow_experiment_id,
                    'mlflow_run_id': mlflow_run_id,
                    'dvc_commit': dvc_commit,
                })
    except Exception as e:
        strict = os.getenv('SUPABASE_STRICT') == '1'
        extra_err = None
        try:
            if isinstance(e, requests.HTTPError) and getattr(e, 'response', None) is not None:
                extra_err = {
                    'status': getattr(e.response, 'status_code', None),
                    'text': (getattr(e.response, 'text', '') or '')[:800],
                }
        except Exception:
            extra_err = None
        log.error(json.dumps({'event':'run_create_supabase_error','run_id':run_id_val,'error':str(e),'strict':strict,'response': extra_err}))
        if strict:
            raise HTTPException(status_code=502, detail='Failed to persist run to Supabase')

    # Fallback: create in-memory run (only when not strict or Supabase disabled)
    run = {
        'run_id': run_id_val,
        'status': 'queued',
        'project_id': payload.project_id,
        'created_at': datetime.now(UTC).isoformat(),
        'tenant_id': tenant_id,
        'input_mode': payload.input_mode,
        'description': payload.description,
        'constraints': payload.constraints or {},
        'options': payload.options or {},
        'mlflow_experiment_id': mlflow_experiment_id,
        'mlflow_run_id': mlflow_run_id,
        'dvc_commit': dvc_commit,
    }
    RUNS.insert(0, run)
    _save_local_state()
    _audit('run.created', request, {'run_id': run_id_val, 'project_id': payload.project_id})

    # Background work could be scheduled here (workers)
    if not payload.skip_processing:
        if CELERY_ENABLED:
            try:
                process_run_task.delay(run_id_val, payload.project_id)
            except Exception as e:
                print('Celery enqueue failed (fallback to BackgroundTasks):', e)
                try:
                    background_tasks.add_task(process_run, run_id_val, payload.project_id)
                except Exception:
                    print('Failed to schedule background task for in-memory run', run_id_val)
        else:
            try:
                background_tasks.add_task(process_run, run_id_val, payload.project_id)
            except Exception:
                print('Failed to schedule background task for in-memory run', run_id_val)

        # Additionally enqueue a topology optimization job to produce glTF artifacts
        try:
            from tasks import topopt_task, celery_app as _cel
            design_space = {
                'nelx': int((payload.options or {}).get('nelx', 60)),
                'nely': int((payload.options or {}).get('nely', 40)),
                'penal': float((payload.options or {}).get('penal', 3.0)),
                'rmin': float((payload.options or {}).get('rmin', 1.5)),
                'max_iter': int((payload.options or {}).get('max_iter', 100)),
            }
            volfrac = float((payload.options or {}).get('volfrac', 0.4))
            if CELERY_ENABLED and _cel:  # prefer Celery queue "compute"
                try:
                    topopt_task.apply_async(args=[run_id_val, design_space, volfrac], queue='compute')
                except Exception:
                    # Call the task object itself so Celery's bind=True `self` is handled correctly.
                    background_tasks.add_task(topopt_task, run_id_val, design_space, volfrac)  # type: ignore
            else:
                # Direct execution is synchronous; schedule via BackgroundTasks
                background_tasks.add_task(topopt_task, run_id_val, design_space, volfrac)  # type: ignore
        except Exception as e:
            print('topopt enqueue failed:', e)
    # MLflow for in-memory fallback run BEFORE returning
    if _mlflow_enabled:
        try:
            import mlflow  # type: ignore
            exp = mlflow.get_experiment_by_name('makerkit')
            if exp is None:
                exp_id = mlflow.create_experiment('makerkit')
            else:
                exp_id = exp.experiment_id
            mlflow.set_experiment('makerkit')
            with mlflow.start_run(run_name=run_id_val) as active_run:
                mlflow_experiment_id = exp_id
                mlflow_run_id = active_run.info.run_id
                mlflow.log_param('project_id', payload.project_id)
                mlflow.log_param('input_mode', payload.input_mode)
                mlflow.log_param('has_constraints', bool(payload.constraints))
                mlflow.log_param('options_count', len(payload.options or {}))
                # Artifact: brief text
                brief_txt = (payload.description or 'No description provided').encode('utf-8')
                with tempfile.NamedTemporaryFile(delete=False, suffix='_brief.txt') as tf:
                    tf.write(brief_txt)
                    temp_path = tf.name
                try:
                    mlflow.log_artifact(temp_path)
                except Exception:
                    pass
                if dvc_commit:
                    mlflow.log_param('dvc_commit', dvc_commit)
            run['mlflow_experiment_id'] = mlflow_experiment_id
            run['mlflow_run_id'] = mlflow_run_id
        except Exception as e:
            log.warning(json.dumps({'event':'mlflow_log_failed','run_id':run_id_val,'error':str(e)}))
    return RunOut(**run)


@app.get('/api/v1/runs')
def list_runs(request: Request):
    _load_local_state_if_needed()
    tenant_id = getattr(request.state, 'user', {}).get('tenant') or 'public'

    # Local/in-memory runs are always considered as a fallback because Supabase can be
    # partially configured (e.g., projects exist only locally) which would make run inserts
    # fail and the UI would look empty.
    local_items = [r for r in RUNS if (r.get('tenant_id') or 'public') == tenant_id]

    supabase_items: list[dict] = []
    try:
        if _supabase_is_configured():
            items = list_runs_supabase(tenant_id)
            if isinstance(items, list):
                supabase_items = [i for i in items if isinstance(i, dict)]
    except Exception as e:
        print('Supabase list_runs error:', e)

    if not supabase_items:
        return local_items

    # Merge: prefer Supabase rows, but include local ones not present upstream.
    seen = {r.get('run_id') for r in supabase_items if isinstance(r, dict)}
    merged: list[dict] = list(supabase_items)
    for r in local_items:
        rid = r.get('run_id')
        if rid and rid not in seen:
            merged.append(r)

    # Sort newest first when timestamps are present.
    try:
        merged.sort(key=lambda x: str(x.get('created_at') or ''), reverse=True)
    except Exception:
        pass
    return merged


@app.get('/api/v1/runs/{run_id}', response_model=RunOut)
def get_run(run_id: str, request: Request):
    """Fetch a single run by id, from Supabase if configured or from in-memory store."""
    # Try Supabase first
    try:
        if _supabase_is_configured():
            row = fetch_run_supabase(run_id)
            if row:
                tenant_id = getattr(request.state, 'user', {}).get('tenant') or 'public'
                if row.get('tenant_id') and row.get('tenant_id') != tenant_id:
                    raise HTTPException(status_code=403, detail=_tr(request,'forbidden cross-tenant run'))
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
    tenant_id = getattr(request.state, 'user', {}).get('tenant') or 'public'
    for r in RUNS:
        if r.get('run_id') == run_id:
            if r.get('tenant_id') and r.get('tenant_id') != tenant_id:
                raise HTTPException(status_code=403, detail=_tr(request,'forbidden cross-tenant run'))
            # Auto-complete in-memory runs after a brief delay so UI polling can proceed
            try:
                created_raw = r.get('created_at')
                created_dt = None
                if isinstance(created_raw, str):
                    try:
                        created_dt = datetime.fromisoformat(created_raw.replace('Z', '+00:00'))
                    except Exception:
                        created_dt = datetime.now(UTC)
                else:
                    created_dt = datetime.now(UTC)
                age_s = (datetime.now(UTC) - created_dt).total_seconds()
                if r.get('status') in (None, 'queued', 'pending') and age_s >= 1.0:
                    r['status'] = 'completed'
                    r['finished_at'] = datetime.now(UTC).isoformat()
                    r['duration_ms'] = max(1, int(age_s * 1000))
                    meta = r.get('metadata') or {}
                    if 'dfx_summary' not in meta:
                        meta['dfx_summary'] = 'Synthèse DfX (mock)'
                    r['metadata'] = meta
            except Exception:
                pass
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
    _load_local_state_if_needed()
    results: List[VariantOut] = []
    supabase_run_exists = False
    try:
        if _supabase_is_configured():
            raw_variants = list_variants_supabase(run_id)
            for v in raw_variants:
                # Normalize URLs for browser compatibility (Windows path separators can leak in)
                thumb = v.get('thumbnail_url')
                img = v.get('image_url')
                stl = v.get('stl_url')
                step = v.get('step_url')
                if isinstance(thumb, str):
                    thumb = thumb.replace('\\', '/')
                if isinstance(img, str):
                    img = img.replace('\\', '/')
                if isinstance(stl, str):
                    stl = stl.replace('\\', '/')
                if isinstance(step, str):
                    step = step.replace('\\', '/')
                dfx = None
                try:
                    dfx = fetch_dfx_summary_for_variant_supabase(v.get('id'))
                except Exception:
                    dfx = None
                results.append(VariantOut(
                    id=v.get('id'),
                    run_id=v.get('run_id'),
                    thumbnail_url=thumb,
                    image_url=img,
                    stl_url=stl,
                    step_url=step,
                    score=v.get('score'),
                    metrics=v.get('metrics') or {},
                    dfx_summary=(dfx or {}).get('summary'),
                    fabricability_score=(dfx or {}).get('fabricability_score'),
                    assemblability_score=(dfx or {}).get('assemblability_score'),
                    sustainability_score=(dfx or {}).get('sustainability_score'),
                    created_at=v.get('created_at'),
                ))
            # If Supabase returned variants we are done
            if results:
                return results
            # Supabase configured but no variants; ensure run exists before falling back
            try:
                existing = fetch_run_supabase(run_id)
                if not existing:
                    raise HTTPException(status_code=404, detail=f"Run {run_id} not found")
                # Mark that the run exists in Supabase so we can return an empty list (no 404)
                supabase_run_exists = True
                # In dev, when no worker is running, variants may never be persisted.
                # Fall through to the in-memory synthesis below so the GUI isn't empty.
            except HTTPException:
                raise
            except Exception:
                # network or other error; allow in-memory fallback below
                pass
    except Exception as e:
        print('Supabase get_variants error:', e)

    # In-memory variants (preferred fallback when Supabase is misconfigured/unhealthy)
    in_mem = [v for v in VARIANTS if v.get('run_id') == run_id]
    if in_mem:
        out: List[VariantOut] = []
        for v in in_mem:
            thumb = v.get('thumbnail_url')
            img = v.get('image_url')
            stl = v.get('stl_url')
            step = v.get('step_url')
            if isinstance(thumb, str):
                thumb = thumb.replace('\\', '/')
            if isinstance(img, str):
                img = img.replace('\\', '/')
            if isinstance(stl, str):
                stl = stl.replace('\\', '/')
            if isinstance(step, str):
                step = step.replace('\\', '/')
            out.append(VariantOut(
                id=v.get('id'),
                run_id=v.get('run_id'),
                thumbnail_url=thumb,
                image_url=img,
                stl_url=stl,
                step_url=step,
                score=v.get('score'),
                metrics=v.get('metrics') or {},
                dfx_summary=(v.get('dfx_summary') if isinstance(v.get('dfx_summary'), str) else None),
                fabricability_score=None,
                assemblability_score=None,
                sustainability_score=None,
                created_at=v.get('created_at'),
            ))
        return out

    # If strict real-images mode is enabled, never synthesize placeholder variants.
    # The web UI will poll until real variants are generated.
    require_real_images = (os.getenv('REQUIRE_REAL_IMAGES') or '').strip() == '1'
    if require_real_images:
        return []

    # In-memory fallback: synthesize a single variant so UI/tests have data
    run_ref = None
    for r in RUNS:
        if r.get('run_id') == run_id:
            run_ref = r
            break
    # If Supabase configured, no Supabase variants, and run not in memory => 404
    if _supabase_is_configured() and run_ref is None and not results and not supabase_run_exists:
        raise HTTPException(status_code=404, detail=f"Run {run_id} not found")
    dfx_summary = None
    if run_ref:
        meta = run_ref.get('metadata') or {}
        dfx_summary = meta.get('dfx_summary') or 'DfX synthétique'
    variant_id = f"var-{run_id.split('-')[-1]}"
    # CAD + FEM synthesis for variant metrics
    cad = generate_cad_variant({'width_mm': 60, 'height_mm': 40, 'depth_mm': 30})
    fem = run_fem_simulation({'mass_g': 120.0, 'volume_cm3': cad['volume_cm3']})
    base_metrics = {'mass_g': 123.4, 'volume_cm3': cad['volume_cm3'], 'part_count': 2, 'support_volume_ratio': 0.18, 'material': 'PLA'} | fem | {'surface_area_cm2': cad['surface_area_cm2']}
    dfx_scores = compute_dfx_scores(base_metrics, {})
    merged_metrics = base_metrics | dfx_scores | {'safety_factor': 2.1}
    synth_variant = VariantOut(
        id=variant_id,
        run_id=run_id,
        thumbnail_url='https://placehold.co/256x256/png?text=Variant',
        image_url=_maybe_generate_inline_image(run_ref, run_id),
        stl_url='https://example.com/mock/model.stl',
        step_url='https://example.com/mock/model.step',
        score=dfx_scores.get('overall_score'),
        metrics=merged_metrics | {'fem': fem, 'cad_id': cad['cad_id']},
        dfx_summary=dfx_summary,
        fabricability_score=dfx_scores.get('fabricability_score'),
        assemblability_score=dfx_scores.get('assemblability_score'),
        sustainability_score=dfx_scores.get('sustainability_score'),
        created_at=datetime.now(UTC).isoformat(),
    )
    return [synth_variant]

@app.get('/api/v1/variants/{variant_id}/detail', response_model=VariantDetailOut)
def get_variant_detail(variant_id: str):
    """Return a single variant with its DfX summary and related prompts (via run)."""
    # Cache check (only meaningful when Supabase is configured)
    if _supabase_is_configured():
        cached = _variant_detail_cache_get(variant_id)
        if cached:
            try:
                return VariantDetailOut(**cached)
            except Exception as e:
                log.debug(json.dumps({'event':'variant_cache_deserialize_failed','variant_id':variant_id,'error':str(e)}))
    # Supabase path (authoritative if configured)
    if _supabase_is_configured():
        try:
            v = fetch_variant_supabase(variant_id)
            if not v:
                # Explicit 404 when Supabase is active and variant missing
                raise HTTPException(status_code=404, detail=f"Variant {variant_id} not found")
            # Fetch DfX summary row
            dfx = None
            try:
                dfx = fetch_dfx_summary_for_variant_supabase(variant_id)
            except Exception as e:
                log.warning(json.dumps({'event':'dfx_fetch_failed','variant_id':variant_id,'error':str(e)}))
            run_id = v.get('run_id')
            prompts: list[dict] = []
            if run_id:
                try:
                    for p in list_prompts_supabase(run_id):
                        prompts.append({
                            'id': p.get('id'),
                            'prompt_text': p.get('prompt_text'),
                            'model': p.get('model'),
                            'created_at': p.get('created_at'),
                        })
                except Exception as e:
                    log.warning(json.dumps({'event':'prompts_fetch_failed','run_id':run_id,'error':str(e)}))
            result = VariantDetailOut(
                variant=VariantOut(
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
                ),
                dfx=dfx,
                prompts=prompts,
            )
            _variant_detail_cache_set(variant_id, result)
            return result
        except HTTPException:
            raise
        except Exception as e:
            # Treat unexpected Supabase/network failures distinctly (avoid synthetic confusion)
            log.error(json.dumps({'event':'variant_detail_supabase_error','variant_id':variant_id,'error':str(e)}))
            raise HTTPException(status_code=503, detail='Variant detail unavailable (backend error)')

    # In-memory fallback (Supabase not configured): return synthetic placeholder
    synthetic = VariantOut(
        id=variant_id,
        run_id='unknown',
        thumbnail_url='https://placehold.co/256x256/png?text=Variant',
        image_url='https://placehold.co/512x384/png?text=Variant',
        stl_url=None,
        step_url=None,
        score=0.0,
        metrics={},
        created_at=datetime.now(UTC).isoformat(),
    )
    return VariantDetailOut(variant=synthetic, dfx=None, prompts=[])


def _maybe_generate_inline_image(run_ref: dict | None, run_id: str) -> str:
    """Return a data URL PNG via diffusion stub if configured, else a local placeholder PNG.

    Important: do not return SVG bytes wrapped in an `image/png` data URI. Some placeholder
    services default to SVG which appears as a blank/broken image in many PNG renderers.
    """

    def _png_data_uri_from_bytes(img_bytes: bytes) -> str | None:
        try:
            if not img_bytes or len(img_bytes) < 24:
                return None
            if img_bytes[:8] != b"\x89PNG\r\n\x1a\n":
                return None
            import base64 as _base64
            b64 = _base64.b64encode(img_bytes).decode('ascii')
            return f'data:image/png;base64,{b64}'
        except Exception:
            return None

    def _local_placeholder_png(prompt_text: str, width: int = 512, height: int = 384) -> str:
        # Best-effort: generate a small PNG with Pillow.
        try:
            from PIL import Image as _Image, ImageDraw as _ImageDraw, ImageFont as _ImageFont
            import io as _io
            img = _Image.new('RGB', (width, height), color=(32, 41, 58))
            draw = _ImageDraw.Draw(img)
            draw.rectangle([0, 0, width, max(8, height // 28)], fill=(86, 156, 214))
            try:
                font = _ImageFont.load_default()
            except Exception:
                font = None
            title = 'Generated preview'
            body = (prompt_text or '').strip().replace('\n', ' ')
            if len(body) > 120:
                body = body[:117] + '...'
            draw.text((12, 14), title, fill=(255, 255, 255), font=font)
            draw.text((12, 36), body or '(no prompt)', fill=(220, 230, 245), font=font)
            buf = _io.BytesIO()
            img.save(buf, format='PNG')
            uri = _png_data_uri_from_bytes(buf.getvalue())
            if uri:
                return uri
        except Exception:
            pass

        # Last resort: 1x1 PNG (still valid, but tiny)
        return _png_data_uri_from_bytes(
            b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\x0cIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\x0d\n\x2d\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
        ) or 'data:image/png;base64,'
    diffusion_url = os.getenv('DIFFUSION_IMAGE_URL') or os.getenv('DIFFUSION_SERVICE_URL')
    prompt = ''
    if run_ref:
        prompt = (run_ref.get('description') or 'variant design')
    if diffusion_url:
        # If the configured diffusion URL is already a data URL, try to upload it to Supabase storage
        if isinstance(diffusion_url, str) and diffusion_url.startswith('data:'):
            try:
                # Validate the data URI payload first: some placeholders are SVG.
                parts = diffusion_url.split(',', 1)
                if len(parts) == 2:
                    import base64 as _base64
                    try:
                        candidate_bytes = _base64.b64decode(parts[1])
                    except Exception:
                        candidate_bytes = b''
                    uri = _png_data_uri_from_bytes(candidate_bytes)
                    if not uri:
                        return _local_placeholder_png(prompt, 512, 384)

                if os.getenv('SUPABASE_URL') and os.getenv('SUPABASE_STORAGE_BUCKET'):
                    # data URI: data:image/...;base64,<b64>
                    if len(parts) == 2:
                        import uuid as _uuid
                        img_bytes = candidate_bytes
                        object_name = f"variants/{run_id}/synth-{_uuid.uuid4().hex[:8]}.png"
                        try:
                            signed = _upload_and_sign(object_name, img_bytes, content_type='image/png')
                            if signed:
                                return signed
                        except Exception:
                            pass
            except Exception:
                pass
            # fallback: return validated PNG data URI
            return uri or _local_placeholder_png(prompt, 512, 384)
        try:
            # Ensure diffusion_url looks like an HTTP endpoint before calling
            if diffusion_url.startswith('http://') or diffusion_url.startswith('https://'):
                endpoint = diffusion_url.rstrip('/') + '/v1/text2image'
                resp = requests.post(endpoint, json={'prompt': prompt, 'width': 512, 'height': 384}, timeout=15)
                if resp.ok:
                    data = resp.json()
                    b64 = data.get('image_b64')
                    if b64:
                        # If Supabase storage is configured, upload the image and return signed URL
                        try:
                            if os.getenv('SUPABASE_URL') and os.getenv('SUPABASE_STORAGE_BUCKET'):
                                import base64 as _base64, uuid as _uuid
                                img_bytes = _base64.b64decode(b64)
                                object_name = f"variants/{run_id}/synth-{_uuid.uuid4().hex[:8]}.png"
                                signed = None
                                try:
                                    signed = _upload_and_sign(object_name, img_bytes, content_type='image/png')
                                except Exception:
                                    signed = None
                                if signed:
                                    return signed
                        except Exception:
                            # Fall back to returning data URI if upload/sign fails
                            pass
                        # Validate the payload is actually PNG bytes; some placeholder backends return SVG.
                        try:
                            import base64 as _base64
                            img_bytes = _base64.b64decode(b64)
                            uri = _png_data_uri_from_bytes(img_bytes)
                            if uri:
                                return uri
                        except Exception:
                            pass
                        return _local_placeholder_png(prompt, 512, 384)
            else:
                # Unknown scheme: avoid treating it as an HTTP URL
                log.warning(f'unrecognized DIFFUSION_SERVICE_URL scheme: {diffusion_url[:64]}')
        except Exception as e:
            print('diffusion inline generation failed:', e)
    return _local_placeholder_png(prompt, 512, 384)


@app.post('/api/v1/exports/presign', response_model=ExportPresignResponse)
def presign_export(body: ExportPresignRequest):
    """Return a stub pre-signed URL for an export artifact.

    In production this would call object storage (S3/MinIO) to create a temporary
    signed URL. For now we fabricate a deterministic placeholder.
    """
    if not body.run_id or not body.kind:
        raise HTTPException(status_code=400, detail='run_id and kind required')
    # If Supabase Storage is configured, try to sign a URL
    if _supabase_is_configured() and os.getenv('SUPABASE_STORAGE_BUCKET'):
        try:
            # Build a deterministic object path; object should exist in storage for signing to succeed
            object_name = f"exports/{body.run_id}/{body.kind}/{uuid.uuid4().hex[:8]}.{body.kind}"
            # Read bucket/key/url at call-time so test env changes are respected
            bucket = os.getenv('SUPABASE_STORAGE_BUCKET')
            key = os.getenv('SUPABASE_KEY') or ''
            supa_url = os.getenv('SUPABASE_URL')
            sign_url = f"{supa_url}/storage/v1/object/sign/{bucket}/{object_name}"
            headers = {
                'apikey': key,
                'Authorization': f'Bearer {key}',
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
                    absolute = f"{supa_url}{signed_path}" if signed_path.startswith('/') else signed_path
                    return ExportPresignResponse(url=absolute, expires_at=(datetime.now(UTC).isoformat()))
        except Exception as e:
            print('Supabase presign error (fallback to stub):', e)
    # S3/MinIO presign (GET) if AWS credentials present
    bucket = os.getenv('EXPORTS_BUCKET')
    if boto3 and bucket and os.getenv('AWS_ACCESS_KEY_ID') and os.getenv('AWS_SECRET_ACCESS_KEY'):
        try:
            s3 = boto3.client('s3', region_name=os.getenv('AWS_REGION') or 'us-east-1')
            object_name = f"exports/{body.run_id}/{body.kind}/{uuid.uuid4().hex[:8]}.{body.kind}"
            url = s3.generate_presigned_url('get_object', Params={'Bucket': bucket, 'Key': object_name}, ExpiresIn=900)
            return ExportPresignResponse(url=url, expires_at=datetime.now(UTC).isoformat())
        except Exception as e:
            log.warning(json.dumps({'event':'s3_presign_failed','error':str(e)}))

    # Fallback stub URL
    expires = datetime.now(UTC).isoformat()
    # Map special artifact kinds to synthetic file extensions
    ext_map = {
        'pdf': 'pdf',
        'zip': 'zip',
        'stl': 'stl',
        'step': 'step',
        'image': 'png',
        'fem-stress': 'png',
        'cad-step': 'step',
        'cad-stl': 'stl'
    }
    ext = ext_map.get(body.kind, body.kind)
    url = f"https://example.local/exports/{body.run_id}/{body.kind}-{uuid.uuid4().hex[:8]}.{ext}"
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
            # persist export metadata if Supabase configured
            if _supabase_is_configured():
                try:
                    create_export_supabase(run_id, k, presigned.url)
                except Exception as e:
                    out[k]['persist_error'] = str(e)
        except Exception as e:
            out[k] = {"error": str(e)}
    # audit
    dummy_request = Request(scope={'type':'http','path':f'/api/v1/runs/{run_id}/exports'})
    setattr(dummy_request.state, 'user', {'id':'system','role':'system','tenant':'public'})
    _audit('exports.created', dummy_request, {'run_id': run_id, 'kinds': kinds})
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
        if _supabase_is_configured():
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

    # Local fallback: in-memory run
    if run_payload is None:
        try:
            local_run = next((r for r in RUNS if (r.get('run_id') or r.get('id')) == run_id), None)
            if local_run:
                run_payload = {
                    'run_id': local_run.get('run_id') or local_run.get('id'),
                    'status': local_run.get('status'),
                    'project_id': local_run.get('project_id'),
                    'created_at': local_run.get('created_at'),
                    'started_at': local_run.get('started_at'),
                    'finished_at': local_run.get('finished_at'),
                    'duration_ms': local_run.get('duration_ms'),
                    'options': local_run.get('options') or local_run.get('parameters') or {},
                    'metadata': local_run.get('metadata') or {},
                    'description': local_run.get('description'),
                }
        except Exception:
            pass

    # Fetch variants + embed dfx
    try:
        if _supabase_is_configured():
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

    # Local fallback: in-memory variants
    if not variants_payload:
        try:
            raw_local = [v for v in VARIANTS if v.get('run_id') == run_id]
            for v in raw_local:
                variants_payload.append({
                    'id': v.get('id'),
                    'run_id': v.get('run_id') or run_id,
                    'thumbnail_url': v.get('thumbnail_url'),
                    'image_url': v.get('image_url'),
                    'stl_url': v.get('stl_url'),
                    'step_url': v.get('step_url'),
                    'score': v.get('score'),
                    'metrics': v.get('metrics') or {},
                    'dfx_summary': v.get('dfx_summary') or v.get('dfx') or v.get('dfx_analysis') or v.get('summary'),
                    'fabricability_score': v.get('fabricability_score') or (v.get('metrics') or {}).get('fabricability_score') if isinstance(v.get('metrics'), dict) else None,
                    'assemblability_score': v.get('assemblability_score') or (v.get('metrics') or {}).get('assemblability_score') if isinstance(v.get('metrics'), dict) else None,
                    'sustainability_score': v.get('sustainability_score') or (v.get('metrics') or {}).get('sustainability_score') if isinstance(v.get('metrics'), dict) else None,
                    'created_at': v.get('created_at'),
                    'prompt_text': v.get('prompt_text') or v.get('prompt') or v.get('input_prompt') or (v.get('metadata') or {}).get('prompt_text') if isinstance(v.get('metadata'), dict) else None,
                    'model': v.get('model') or (v.get('metadata') or {}).get('model') if isinstance(v.get('metadata'), dict) else None,
                    'metadata': v.get('metadata') if isinstance(v.get('metadata'), dict) else {},
                })
        except Exception:
            pass

    # Fetch prompts
    try:
        if _supabase_is_configured():
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

    # Local fallback: derive prompts from variants (and run description)
    if not prompts_payload:
        try:
            derived: list[dict] = []
            seen: set[str] = set()

            # Run-level prompt (description) if available
            run_desc = None
            if isinstance(run_payload, dict):
                run_desc = run_payload.get('description')
            if isinstance(run_desc, str) and run_desc.strip():
                text = run_desc.strip()
                seen.add(text)
                derived.append({
                    'id': f"derived-run-{run_id}",
                    'run_id': run_id,
                    'prompt_text': text,
                    'model': None,
                    'created_at': (run_payload or {}).get('created_at') if isinstance(run_payload, dict) else None,
                })

            for v in variants_payload:
                if not isinstance(v, dict):
                    continue
                for key in ('prompt_text', 'prompt', 'input_prompt', 'positive_prompt'):
                    val = v.get(key)
                    if isinstance(val, str) and val.strip():
                        text = val.strip()
                        if text in seen:
                            continue
                        seen.add(text)
                        derived.append({
                            'id': f"derived-variant-{v.get('id') or len(derived)+1}",
                            'run_id': run_id,
                            'prompt_text': text,
                            'model': v.get('model'),
                            'created_at': v.get('created_at'),
                        })
            prompts_payload = derived
        except Exception:
            pass

    return {
        'run': run_payload,
        'variants': variants_payload,
        'prompts': prompts_payload,
    }


@app.get('/api/v1/runs/{run_id}/exports')
def get_exports(run_id: str):
    try:
        if _supabase_is_configured():
            return list_exports_supabase(run_id)
    except Exception as e:
        print('Supabase get_exports error:', e)
    return []


@app.post('/api/v1/llm/normalize-brief')
async def api_normalize_brief(request: Request):
    """Normalize a free-text brief into structured constraints using Hugging Face.

    Robust body parsing to handle PowerShell UTF-16 and various shapes.
    Always returns ok by falling back to a heuristic when LLM fails.
    """
    try:
        raw = await request.body()
        text: str | None = None
        # Try UTF-8 JSON first
        try:
            obj = json.loads(raw.decode('utf-8'))
            if isinstance(obj, dict):
                text = obj.get('text') or obj.get('brief') or obj.get('description')
            elif isinstance(obj, str):
                text = obj
        except Exception:
            # Try UTF-16 (PowerShell default for strings)
            try:
                s = raw.decode('utf-16').strip()
                if (s.startswith('{') and s.endswith('}')) or (s.startswith('"') and s.endswith('"')):
                    try:
                        obj2 = json.loads(s)
                        if isinstance(obj2, dict):
                            text = obj2.get('text') or obj2.get('brief') or obj2.get('description')
                        elif isinstance(obj2, str):
                            text = obj2
                    except Exception:
                        text = s
                else:
                    text = s
            except Exception:
                try:
                    text = raw.decode('latin-1')
                except Exception:
                    text = None

        if not text or not isinstance(text, str):
            return {"ok": True, "data": _heuristic_normalize(text or ''), "backend": "heuristic", "error": "invalid_body"}

        # Try LLM; on failure return heuristic
        try:
            data = normalize_brief(text)
        except Exception as e:
            return {"ok": True, "data": _heuristic_normalize(text), "backend": "heuristic", "error": str(e)}

        # Parse fenced JSON in LLM `raw` into structured fields
        if isinstance(data, dict) and isinstance(data.get('raw'), str):
            s = data['raw'].strip()
            if s.startswith('```'):
                try:
                    s = s.split('```', 1)[1]
                    parts = s.split('\n', 1)
                    if len(parts) == 2:
                        s = parts[1]
                    if '```' in s:
                        s = s.rsplit('```', 1)[0]
                except Exception:
                    pass
            parsed = None
            try:
                parsed = json.loads(s)
            except Exception:
                parsed = None
            if isinstance(parsed, dict):
                material = parsed.get('material')
                dims = parsed.get('dimensions') or {}
                aspects = parsed.get('dfx_aspects') or []
                data = {
                    'constraints': {
                        'materials': [material] if isinstance(material, str) else (
                            material if isinstance(material, list) else []
                        )
                    },
                    'options': {
                        'width_mm': dims.get('width_mm'),
                        'height_mm': dims.get('height_mm'),
                        'depth_mm': dims.get('depth_mm'),
                    },
                    'weighting': { a: 1.0 for a in aspects if isinstance(a, str) },
                    'raw': parsed,
                }
        return {"ok": True, "data": data, "backend": "huggingface"}
    except Exception as e:
        return {"ok": True, "data": _heuristic_normalize(''), "backend": "heuristic", "error": str(e)}
    run_id: str | None = None
    variant_id: str | None = None

class DiffusionRequest(BaseModel):
    prompt: str
    width: int | None = 512
    height: int | None = 384
    sketch_id: str | None = None
    controlnet: bool | None = False
    steps: int | None = 28
    guidance_scale: float | None = 7.5
    seed: int | None = None
    negative_prompt: str | None = None
    model: str | None = None
    enqueue: bool | None = False  # when true and CELERY_ENABLED, schedule async task
    run_id: str | None = None
    variant_id: str | None = None

class VariantGenRequest(BaseModel):
    count: int | None = 3
    width: int | None = 512
    height: int | None = 384
    steps: int | None = None
    guidance_scale: float | None = None  # placeholder for future diffusion params
    seed: int | None = None
    negative_prompt: str | None = None
    include_image_b64: bool | None = False  # when true, include raw base64 PNG bytes in response
    enqueue: bool | None = False  # when true, run generation in background (dev-friendly)


def _generate_variants_for_run(run_id: str, body: VariantGenRequest) -> list[dict]:
    """Internal worker for generating variants; safe to call from BackgroundTasks."""
    _load_local_state_if_needed()

    def _snap_to_multiple_of_8(value: int, *, min_value: int = 64, max_value: int = 2048) -> int:
        """Diffusers requires width/height divisible by 8."""
        try:
            v = int(value)
        except Exception:
            v = min_value
        v = max(min_value, min(max_value, v))
        v = (v // 8) * 8
        if v < min_value:
            v = (min_value // 8) * 8
        return max(8, v)

    # Ensure run exists (Supabase or in-memory)
    existing = None
    if SUPABASE_URL:
        try:
            existing = fetch_run_supabase(run_id)
        except Exception:
            existing = None
    if not existing:
        existing = next((r for r in RUNS if r.get('run_id') == run_id), None)
    if not existing:
        raise HTTPException(status_code=404, detail=f'Run {run_id} not found')

    count = max(1, min(20, body.count or 3))
    width = _snap_to_multiple_of_8(body.width or 512)
    height = _snap_to_multiple_of_8(body.height or 384)
    # Default steps are intentionally lower than DiffusionGenerator's default (28)
    # because CPU diffusers can otherwise take a very long time and make the GUI feel stuck.
    try:
        run_steps = None
        try:
            opts = existing.get('options') or {}
            run_steps = opts.get('steps') if isinstance(opts, dict) else None
        except Exception:
            run_steps = None

        if body.steps is not None:
            steps = int(body.steps)
        elif run_steps is not None:
            steps = int(run_steps)
        else:
            steps = 12 if os.getenv('LOCAL_DIFFUSERS_CPU') == '1' else 20
        steps = max(1, min(80, steps))
    except Exception:
        steps = 12 if os.getenv('LOCAL_DIFFUSERS_CPU') == '1' else 20
    results: list[dict] = []
    prompt_base = (existing.get('description') or '').strip()
    if not prompt_base:
        raise HTTPException(status_code=400, detail='Run has empty description; cannot generate image variants')

    # Prefer honoring the user's brief exactly. Prompt rewriting can easily
    # produce unrelated images; only enable it when explicitly requested.
    use_llm_prompt_variants = (os.getenv('VARIANT_PROMPT_LLM') or '').strip() == '1'

    # Inherit diffusion params from the run options when the request didn't override.
    try:
        opts_any = existing.get('options') or existing.get('parameters') or {}
        opts = opts_any if isinstance(opts_any, dict) else {}
    except Exception:
        opts = {}
    guidance = float(body.guidance_scale) if body.guidance_scale is not None else float(opts.get('guidance_scale') or 7.5)
    seed = body.seed if body.seed is not None else (opts.get('seed') if isinstance(opts.get('seed'), int) else None)
    negative_prompt = None
    try:
        negative_prompt = body.negative_prompt if body.negative_prompt is not None else (opts.get('negative_prompt') if isinstance(opts.get('negative_prompt'), str) else None)
    except Exception:
        negative_prompt = body.negative_prompt

    # Default negative prompt: avoid common failure modes where SD v1.5 hallucinates a room/ceiling lamp
    # when the user asked for an isolated product photo.
    if not (negative_prompt or '').strip():
        negative_prompt = (
            'ceiling, plafond, hanging lamp, chandelier, lampe, luminaire, room interior, salle, mur, plafond visible, '
            'people, person, hands, text, watermark, logo, signature, blurry, lowres, jpeg artifacts'
        )

    prompts: list[str] | None = None
    if use_llm_prompt_variants:
        # Best-effort: generate prompt variants via LLM.
        try:
            try:
                from .mistral import generate_prompts  # type: ignore
            except Exception:
                from mistral import generate_prompts  # type: ignore

            llm_out = generate_prompts(prompt_base, variants=count)
            candidate = llm_out.get('prompts') if isinstance(llm_out, dict) else None
            if isinstance(candidate, list) and candidate:
                prompts = [str(p) for p in candidate]
        except Exception:
            prompts = None

    # Default: keep prompts faithful to the brief.
    # Add only minimal safe modifiers for image quality while preserving intent.
    if not prompts:
        def _augment_prompt_keywords(base_prompt: str) -> str:
            """Lightweight bilingual keyword augmentation to improve prompt adherence.

            Many diffusion models follow English nouns best; when a user writes in French,
            we append short English synonyms without rewriting the user's intent.
            """
            try:
                import re
                text = base_prompt.lower()
                additions: list[str] = []

                rules: list[tuple[str, list[str]]] = [
                    (r"\b(téléviseur|television|tv|télé)\b", ["television", "flat screen tv", "product photo"]),
                    (r"\b(chaise|fauteuil)\b", ["chair", "armchair", "product photo"]),
                    (r"\b(montre)\b", ["wristwatch", "watch", "product photo"]),
                    (r"\b(meuble|mobilier)\b", ["furniture", "product photo"]),
                    (r"\b(canapé)\b", ["sofa", "couch", "product photo"]),
                    (r"\b(table)\b", ["table", "product photo"]),
                ]

                for pattern, words in rules:
                    if re.search(pattern, text, flags=re.IGNORECASE):
                        for w in words:
                            if w.lower() not in text and w not in additions:
                                additions.append(w)

                if not additions:
                    return base_prompt
                return f"{base_prompt}. Keywords: {', '.join(additions)}"
            except Exception:
                return base_prompt

        base = _augment_prompt_keywords(str(prompt_base).strip())
        style_suffixes = [
            'photo produit ultra réaliste, studio lighting, fond neutre, sans texte, sans logo, haute qualité',
            'photo réaliste, détails nets, éclairage doux, sans texte, sans logo',
        ]
        prompts = [f"{base}. {style_suffixes[i % len(style_suffixes)]}" for i in range(count)]

    for i in range(count):
        # Supabase default schema uses UUID PK for variants.id
        if _supabase_is_configured():
            variant_id = str(uuid.uuid4())
        else:
            variant_id = f"var-{uuid.uuid4().hex[:8]}"
        prompt_i = prompts[i] if i < len(prompts) else f"{prompt_base} variant {i+1}"

        image_b64 = ''
        gen_backend = None
        try:
            # Ensure each variant has a distinct seed so we don't get the same image repeated.
            # If the user didn't specify a seed, randomize per-variant.
            seed_i = None
            if seed is None:
                seed_i = int.from_bytes(os.urandom(4), 'big')
            else:
                seed_i = int(seed) + int(i)

            gen = diffusion_generator.generate(
                prompt_i,
                width=int(width or 512),
                height=int(height or 384),
                steps=int(steps),
                guidance_scale=guidance,
                seed=seed_i,
                negative_prompt=negative_prompt,
            )
            if isinstance(gen, dict):
                gen_backend = gen.get('backend')
                image_b64 = str(gen.get('image_b64') or '')
        except Exception:
            image_b64 = ''

        if _require_real_images_enabled() and (not image_b64 or gen_backend in ('stub','none','unavailable', None)):
            raise HTTPException(
                status_code=503,
                detail=(
                    "Real image generation is not configured for variant generation. "
                    "Set HF_IMAGE_MODEL and HF_TOKEN (or enable local diffusers)."
                ),
            )

        if not image_b64 and not _require_real_images_enabled():
            try:
                uri = _maybe_generate_inline_image(existing, run_id)
                if isinstance(uri, str) and uri.startswith('data:'):
                    image_b64 = uri.split(',', 1)[1]
            except Exception:
                image_b64 = ''

        base_metrics = {
            'mass_g': round(80 + i*2 + (uuid.uuid4().int % 10), 2),
            'part_count': 1,
            'support_volume_ratio': round(0.15 + 0.01*i, 3),
            'material': 'PLA'
        }
        scores = _compute_variant_scores(base_metrics)

        image_public_url = None
        try:
            dest = f"images/{run_id}/{variant_id}.png"
            image_public_url = _upload_image_to_supabase(image_b64, dest)
        except Exception:
            image_public_url = None

        if isinstance(image_public_url, str) and image_public_url:
            image_public_url = image_public_url.replace('\\', '/')

        payload = {
            'id': variant_id,
            'run_id': run_id,
            'thumbnail_url': image_public_url or None,
            'image_url': image_public_url or None,
            'stl_url': None,
            'step_url': None,
            'metrics': base_metrics | {'scores': scores},
            'score': scores.get('overall_score'),
            'created_at': datetime.now(UTC).isoformat(),
        }

        persisted = None
        try:
            if _supabase_is_configured():
                persisted = _persist_variant_supabase(payload)
        except Exception:
            persisted = None

        if not persisted:
            try:
                if not any(v.get('id') == variant_id for v in VARIANTS):
                    VARIANTS.append(payload)
            except Exception:
                VARIANTS.append(payload)
            _save_local_state()

        out = {k: payload[k] for k in ['id','run_id','score','created_at','thumbnail_url','image_url']}
        if bool(body.include_image_b64):
            b64_out = image_b64.split(',', 1)[1] if image_b64.startswith('data:') else image_b64
            out['image_b64'] = b64_out
            out['thumbnail_b64'] = b64_out
        results.append(out)

    return results

class SketchUploadRequest(BaseModel):
    run_id: str
    kind: str  # 'png' | 'jpeg' | 'svg'
    data_b64: str  # raw base64 content (no data URL prefix)
    filename: str | None = None

class SketchUploadResponse(BaseModel):
    ok: bool
    sketch_id: str
    run_id: str
    kind: str
    stored_at: str
    svg: str | None = None

class CADExportResponse(BaseModel):
    variant_id: str
    stl_url: str
    step_url: str
    backend: str

class GeneralFEMRequest(BaseModel):
    width: float | None = 40.0
    height: float | None = 30.0
    load: float | None = 1.0
    young: float | None = 200e9
    poisson: float | None = 0.3

class GeneralFEMResponse(BaseModel):
    ok: bool
    displacement_norm: float
    stress_image_b64: str
    backend: str

class TopOptAdvancedRequest(BaseModel):
    width: int | None = 60
    height: int | None = 40
    vol_frac: float | None = 0.4
    iters: int | None = 25
    penal: float | None = 3.0

class TopOptAdvancedResponse(BaseModel):
    ok: bool
    iterations: int
    final_compliance: float
    avg_density: float
    backend: str
    history: list[dict]
    layout_mask: list[list[int]]

class ImportVariantsRequest(BaseModel):
    filename: str
    file_b64: str  # base64 of CSV or XLSX

class ImportVariantsResponse(BaseModel):
    ok: bool
    imported: int
    variant_ids: list[str]

class ParetoResponse(BaseModel):
    ok: bool
    run_id: str
    count: int
    front: list[dict]

class DfxReportResponse(BaseModel):
    ok: bool
    run_id: str
    report: str

class ModerationRequest(BaseModel):
    prompt: str

class ModerationResponse(BaseModel):
    ok: bool
    prompt: str
    flagged: list[str]
    allowed: bool
    reason: str | None = None

class FeedbackHistoryResponse(BaseModel):
    ok: bool
    variant_id: str
    count: int
    average_rating: float | None
    entries: list[dict]


@app.post('/api/v1/diffusion/generate')
def diffusion_generate(body: DiffusionRequest, request: Request):
    _require_role(request, ['admin','designer','engineer'])
    """Generate an image via diffusion pipeline; can enqueue to Celery if requested.

    - If `enqueue` is true and `CELERY_ENABLED`, the request will be queued and return a `task_id`.
    - Otherwise generation is run synchronously and returns a base64 PNG.
    """
    sketch_b64 = None
    if body.sketch_id:
        entry = SKETCHES.get(body.sketch_id)
        if entry:
            sketch_b64 = entry.get('b64')

    # Optionally queue the job
    if body.enqueue and CELERY_ENABLED:
        try:
            # import lazily to avoid hard dependency when Celery disabled
            try:
                from .tasks import diffusion_task
            except Exception:
                from tasks import diffusion_task
            task = diffusion_task.delay(
                body.prompt,
                body.run_id or '',
                body.variant_id or '',
                bool(body.controlnet),
                sketch_b64,
                int(body.steps or 28),
                float(body.guidance_scale or 7.5),
                int(body.seed) if body.seed is not None else None,
                body.model or None,
            )
            return {'ok': True, 'queued': True, 'task_id': getattr(task, 'id', None)}
        except Exception as e:
            log.warning(f"enqueue_diffusion_failed {e}")
            raise HTTPException(status_code=500, detail='failed to enqueue diffusion task')

    result = diffusion_generator.generate(
        body.prompt,
        sketch_b64=sketch_b64,
        controlnet=bool(body.controlnet),
        steps=int(body.steps or 28),
        guidance_scale=float(body.guidance_scale or 7.5),
        seed=body.seed,
        negative_prompt=body.negative_prompt,
        width=int(body.width or 512),
        height=int(body.height or 512),
        upscale=bool(getattr(body, 'upscale', False)),
        upscale_method=getattr(body, 'upscale_method', None),
        model=body.model or None,
    )
    # If the generator fell back to the stub (solid color) or returned no
    # image bytes, attempt a best-effort local generation with Diffusers
    # before failing. This allows the UI to work offline when the HF router
    # is unavailable and local models are installed.
    if not result or result.get('backend') == 'stub' or not result.get('image_b64'):
        log.warning(json.dumps({'event': 'diffusion_backend_primary_failed', 'backend': (result or {}).get('backend') if result else None}))
        # Try local pipeline model (env LOCAL_SD_MODEL or SD_MODEL)
        try:
            local_model = os.getenv('LOCAL_SD_MODEL') or os.getenv('SD_MODEL') or 'runwayml/stable-diffusion-v1-5'
            log.info(json.dumps({'event': 'attempt_local_generation', 'model': local_model}))
            local_res = diffusion_generator.generate(
                body.prompt,
                sketch_b64=sketch_b64,
                controlnet=bool(body.controlnet),
                steps=int(body.steps or 28),
                guidance_scale=float(body.guidance_scale or 7.5),
                seed=body.seed,
                negative_prompt=body.negative_prompt,
                width=int(body.width or 512),
                height=int(body.height or 512),
                upscale=bool(getattr(body, 'upscale', False)),
                upscale_method=getattr(body, 'upscale_method', None),
                model=local_model,
            )
            if local_res and local_res.get('image_b64') and local_res.get('backend') != 'stub':
                result = local_res
            else:
                log.warning(json.dumps({'event': 'local_generation_failed', 'local_backend': (local_res or {}).get('backend') if local_res else None}))
        except Exception as e:
            log.warning(json.dumps({'event': 'local_generation_exception', 'error': str(e)}))

    # If production requires real images, refuse to return stub/empty payloads.
    if _require_real_images_enabled():
        backend = (result or {}).get('backend') if isinstance(result, dict) else None
        if (not isinstance(result, dict)) or (not result.get('image_b64')) or (backend in ('stub','none','unavailable', None)):
            raise HTTPException(
                status_code=503,
                detail=(
                    "Real image generation is not configured. Set HF_IMAGE_MODEL and HF_TOKEN (or enable local diffusers). "
                    f"backend={backend}"
                )
            )

    # If HF explicitly reported a quota/credits error, surface it clearly even when
    # REQUIRE_REAL_IMAGES is off (otherwise users just see a fake-looking stub).
    if isinstance(result, dict) and result.get('error_kind') == 'quota':
        raise HTTPException(status_code=503, detail=str(result.get('error') or 'Image generation quota exceeded'))
    # Persist preview image when caller provided run/variant identifiers.
    # This is best-effort and should not break generation when storage isn't configured.
    # Best-effort persistence of preview image (non-blocking)
    persisted = False
    public_url = None
    try:
        img_b64 = result.get('image_b64')
        run_id = getattr(body, 'run_id', None)
        variant_id = getattr(body, 'variant_id', None)
        if img_b64 and run_id and variant_id:
            dest = f"variants/{variant_id}/{uuid.uuid4().hex[:12]}.png"
            try:
                if _supabase_is_configured():
                    # Try uploading to Supabase storage
                    public_url = _upload_image_to_supabase(img_b64, dest)
                    if public_url:
                        # Normalize URL separators to forward slashes for browser compatibility
                        public_url = public_url.replace('\\\\', '/').replace('\\', '/')
                        persisted = True
                        # Record variant asset (best-effort)
                        try:
                            ep = f"{SUPABASE_URL}/rest/v1/variant_assets"
                            headers = supabase_headers()
                            headers['Prefer'] = 'return=minimal'
                            b64_payload = img_b64.split(',', 1)[-1]
                            try:
                                size_bytes = len(base64.b64decode(b64_payload))
                            except Exception:
                                size_bytes = 0
                            payload = {
                                'variant_id': variant_id,
                                'asset_type': 'image/png',
                                'url': public_url,
                                'filename': dest,
                                'size_bytes': size_bytes,
                            }
                            try:
                                requests.post(ep, headers=headers, json=payload, timeout=6)
                            except Exception:
                                pass
                        except Exception:
                            pass

                        # Ensure a variants row exists and update image_url. If Supabase isn't available
                        # or upload fell back to local, also update the in-memory VARIANTS so the UI can display it.
                        try:
                            existing = None
                            if _supabase_is_configured():
                                try:
                                    existing = fetch_variant_supabase(variant_id)
                                except Exception:
                                    existing = None
                            if not existing:
                                var_payload = {
                                    'id': variant_id,
                                    'run_id': run_id,
                                    'thumbnail_url': public_url,
                                    'image_url': public_url,
                                    'stl_url': None,
                                    'step_url': None,
                                    'metrics': {},
                                    'score': None,
                                    'created_at': datetime.now(UTC).isoformat(),
                                }
                                if _supabase_is_configured():
                                    _persist_variant_supabase(var_payload)
                                else:
                                    # store in-memory for dev
                                    VARIANTS.append(var_payload)
                            else:
                                # Try patching Supabase; if it fails, also update in-memory
                                if _supabase_is_configured():
                                    ep2 = f"{SUPABASE_URL}/rest/v1/variants?id=eq.{variant_id}"
                                    patch = {'image_url': public_url, 'thumbnail_url': public_url}
                                    try:
                                        requests.patch(ep2, headers=supabase_headers(), json=patch, timeout=6)
                                    except Exception:
                                        # Fallback: update in-memory
                                        updated = False
                                        for v in VARIANTS:
                                            if v.get('id') == variant_id:
                                                v['image_url'] = public_url
                                                v['thumbnail_url'] = public_url
                                                updated = True
                                                break
                                        if not updated:
                                            VARIANTS.append({
                                                'id': variant_id,
                                                'run_id': run_id,
                                                'thumbnail_url': public_url,
                                                'image_url': public_url,
                                                'created_at': datetime.now(UTC).isoformat(),
                                            })
                                else:
                                    # Supabase not configured but existing was truthy (unlikely); ensure in-memory updated
                                    updated = False
                                    for v in VARIANTS:
                                        if v.get('id') == variant_id:
                                            v['image_url'] = public_url
                                            v['thumbnail_url'] = public_url
                                            updated = True
                                            break
                                    if not updated:
                                        VARIANTS.append({
                                            'id': variant_id,
                                            'run_id': run_id,
                                            'thumbnail_url': public_url,
                                            'image_url': public_url,
                                            'created_at': datetime.now(UTC).isoformat(),
                                        })
                        except Exception:
                            pass
                    else:
                        # Upload failed or returned no URL; fall back to in-memory variants when Supabase not configured
                        if not _supabase_is_configured():
                            for v in VARIANTS:
                                if v.get('id') == variant_id:
                                    try:
                                        v['image_url'] = f"data:image/png;base64,{img_b64}"
                                        v['thumbnail_url'] = v.get('thumbnail_url') or f"data:image/png;base64,{img_b64}"
                                    except Exception:
                                        pass
                                    break
                else:
                    # Supabase not configured: attach inline data URL to in-memory variant
                    for v in VARIANTS:
                        if v.get('id') == variant_id:
                            try:
                                v['image_url'] = f"data:image/png;base64,{img_b64}"
                                v['thumbnail_url'] = v.get('thumbnail_url') or f"data:image/png;base64,{img_b64}"
                            except Exception:
                                pass
                            break
            except Exception as e:
                log.debug(json.dumps({'event': 'preview_persist_failed', 'error': str(e), 'run_id': run_id, 'variant_id': variant_id}))
    except Exception:
        # defensive: do not fail generation on persistence errors
        pass
    # If client requested an image (Accept header prefers image), return binary PNG
    accept = request.headers.get('accept', '')
    img_b64 = result.get('image_b64')
    if img_b64 and ('image/' in accept or 'application/octet-stream' in accept):
        try:
            from fastapi.responses import Response
            img_bytes = base64.b64decode(img_b64)
            headers_out = {
                'X-Persisted': '1' if persisted else '0',
                'X-Public-Url': public_url or ''
            }
            return Response(content=img_bytes, media_type='image/png', headers=headers_out)
        except Exception:
            # fall back to JSON response
            pass

    return {
        'ok': True,
        'image_b64': img_b64,
        'backend': result.get('backend'),
        'controlnet': result.get('controlnet'),
        'width': body.width or 512,
        'height': body.height or 384,
        'persisted': persisted,
        'public_url': public_url,
    }

def _persist_variant_supabase(payload: dict):
    if not SUPABASE_URL:
        return None
    try:
        ep = f"{SUPABASE_URL}/rest/v1/variants"
        headers = supabase_headers(); headers['Prefer'] = 'return=representation'
        r = requests.post(ep, headers=headers, json=payload)
        if r.ok:
            data = r.json()
            if isinstance(data, list) and data:
                return data[0]
            return data
    except Exception as e:
        log.warning(json.dumps({'event':'variant_persist_failed','error':str(e)}))
    return None


def _upload_image_to_supabase(image_b64: str, dest_path: str) -> str | None:
    """Upload base64 PNG bytes to Supabase Storage and return public URL on success.

    Uses `SUPABASE_KEY` (service role) to authenticate. `dest_path` should be
    the storage object path like `images/<filename>.png`.
    """
    # If Supabase not configured, fall back to saving locally and returning a local URL
    if not SUPABASE_URL or not SUPABASE_KEY:
        try:
            # decode and write to local generated_outputs path
            b64 = image_b64
            if b64.startswith('data:'):
                b64 = b64.split(',', 1)[1]
            img_bytes = base64.b64decode(b64)
            safe_dest = os.path.normpath(dest_path).replace('..', '')
            local_root = os.path.join(os.path.dirname(__file__), 'generated_outputs')
            local_path = os.path.join(local_root, safe_dest)
            os.makedirs(os.path.dirname(local_path), exist_ok=True)
            with open(local_path, 'wb') as f:
                f.write(img_bytes)
            # Return a URL that the web UI can fetch from the running API
            safe_url = safe_dest.replace('\\', '/').replace('\\\\', '/')
            return f"{LOCAL_API_BASE}/generated_outputs/{safe_url}"
        except Exception as e:
            log.warning(json.dumps({'event':'local_storage_failed','error':str(e)}))
            return None
    try:
        bucket = os.getenv('SUPABASE_BUCKET') or os.getenv('SUPABASE_STORAGE_BUCKET') or 'prototype_gen'
        # Decode base64 (handles data URL prefix)
        b64 = image_b64
        if b64.startswith('data:'):
            b64 = b64.split(',', 1)[1]
        img_bytes = base64.b64decode(b64)
        ep = f"{SUPABASE_URL}/storage/v1/object/{bucket}/{dest_path}"
        headers = {
            'Authorization': f'Bearer {SUPABASE_KEY}',
            # Ensure browsers/CDNs treat it as an image.
            'Content-Type': 'image/png',
        }
        r = requests.post(ep, headers=headers, data=img_bytes)
        if r.ok:
            public_url = f"{SUPABASE_URL}/storage/v1/object/public/{bucket}/{dest_path}"
            return public_url
        else:
            log.warning(json.dumps({'event':'supabase_storage_upload_failed','status': r.status_code, 'text': r.text}))
            # Attempt a local fallback when Supabase upload fails (auth/network issue)
            try:
                safe_dest = os.path.normpath(dest_path).replace('..', '')
                local_root = os.path.join(os.path.dirname(__file__), 'generated_outputs')
                local_path = os.path.join(local_root, safe_dest)
                os.makedirs(os.path.dirname(local_path), exist_ok=True)
                with open(local_path, 'wb') as f:
                    f.write(img_bytes)
                safe_url = safe_dest.replace('\\', '/').replace('\\\\', '/')
                local_url = f"{LOCAL_API_BASE}/generated_outputs/{safe_url}"
                log.info(json.dumps({'event':'supabase_upload_fallback_local','local_path': local_path, 'url': local_url}))
                return local_url
            except Exception as e:
                log.warning(json.dumps({'event':'local_fallback_failed','error':str(e)}))
    except Exception as e:
        log.warning(json.dumps({'event':'supabase_storage_upload_error','error':str(e)}))
    return None

def _compute_variant_scores(base_metrics: dict) -> dict:
    dfx = compute_dfx_scores(base_metrics, {})
    multi = compute_multiobjective_scores(base_metrics, {})
    return {
        'dfx': dfx,
        'multi': multi,
        'overall_score': multi.get('overall_score') or dfx.get('overall_score')
    }

@app.post('/api/v1/runs/{run_id}/generate-variants')
def api_generate_variants(run_id: str, body: VariantGenRequest, request: Request, background_tasks: BackgroundTasks):
    _require_role(request, ['admin','designer','engineer'])
    # Fast UX mode: run generation in the background and let the Results page poll.
    if bool(body.enqueue):
        def _bg():
            try:
                _generate_variants_for_run(run_id, body)
            except Exception as e:
                log.warning(json.dumps({'event': 'variants_background_failed', 'run_id': run_id, 'error': str(e)}))

        background_tasks.add_task(_bg)
        _audit('variants.enqueued', request, {'run_id': run_id, 'count': int(body.count or 3)})
        return {'ok': True, 'queued': True, 'run_id': run_id}

    results = _generate_variants_for_run(run_id, body)
    _audit('variants.generated', request, {'run_id': run_id, 'count': len(results)})
    return {'ok': True, 'variants': results}


@app.post('/api/v1/sketch/upload', response_model=SketchUploadResponse)
def api_sketch_upload(body: SketchUploadRequest, request: Request):
    """Upload a sketch (PNG/JPEG/SVG). Stores minimal metadata; if Supabase configured, persist in prompts table as a special record.

    For simplicity we treat sketch as a prompt-like artifact (model='sketch').
    """
    _require_role(request, ['admin','designer','engineer'])
    if body.kind not in ('png','jpeg','svg'):
        raise HTTPException(status_code=400, detail='unsupported kind')
    # Validate base64
    try:
        _ = base64.b64decode(body.data_b64.encode('utf-8'), validate=True)
    except Exception:
        raise HTTPException(status_code=400, detail='invalid base64')
    sketch_id = f'sketch-{uuid.uuid4().hex[:8]}'
    svg_content = None
    if body.kind in ('png','jpeg'):
        svg_content = vectorize_png_to_svg(body.data_b64)
    SKETCHES[sketch_id] = {'b64': body.data_b64, 'svg': svg_content, 'kind': body.kind, 'run_id': body.run_id}
    stored_at = datetime.now(UTC).isoformat()
    if SUPABASE_URL:
        try:
            ep = f"{SUPABASE_URL}/rest/v1/prompts"
            headers = supabase_headers(); headers['Prefer'] = 'return=representation'
            payload = {
                'run_id': body.run_id,
                'prompt_text': f"sketch:{body.kind}:{sketch_id}",
                'model': 'sketch',
                'metadata': {'filename': body.filename, 'kind': body.kind, 'b64_prefix': body.data_b64[:48]},
                'created_at': stored_at,
            }
            r = requests.post(ep, headers=headers, json=payload)
            if not r.ok:
                log.warning(json.dumps({'event':'sketch_supabase_failed','status':r.status_code}))
        except Exception as e:
            log.warning(json.dumps({'event':'sketch_supabase_error','error':str(e)}))
    _audit('sketch.uploaded', request, {'run_id': body.run_id, 'sketch_id': sketch_id})
    return SketchUploadResponse(ok=True, sketch_id=sketch_id, run_id=body.run_id, kind=body.kind, stored_at=stored_at, svg=svg_content)


@app.post('/api/v1/variants/{variant_id}/cad/export', response_model=CADExportResponse)
def api_cad_export(variant_id: str, request: Request):
    _require_role(request, ['admin','designer','engineer'])
    try:
        log.debug(json.dumps({'event':'cad_export_called','variant_id':variant_id,'variants_len': len(VARIANTS)}))
    except Exception:
        pass
    # find variant
    variant = None
    for v in VARIANTS:
        if v.get('id') == variant_id:
            variant = v
            break
    if not variant and SUPABASE_URL:
        # attempt Supabase fetch
        try:
            ep = f"{SUPABASE_URL}/rest/v1/variants?id=eq.{variant_id}"
            r = requests.get(ep, headers=supabase_headers())
            if r.ok and r.json():
                variant = r.json()[0]
        except Exception as e:
            log.warning(json.dumps({'event':'cad_export_variant_fetch_error','error':str(e)}))
    if not variant:
        raise HTTPException(status_code=404, detail='variant not found')

    step_bytes, stl_bytes = generate_cad_files(variant)
    backend = 'cadquery' if step_bytes and stl_bytes and step_bytes.startswith(b'\x30') is False else 'stub'

    # If S3 configured, upload and return presigned URLs, else data URLs
    step_url = encode_data_url(step_bytes, 'model/step')
    stl_url = encode_data_url(stl_bytes, 'model/stl')
    if boto3 and os.getenv('S3_BUCKET') and os.getenv('AWS_ACCESS_KEY_ID'):
        try:
            s3 = boto3.client('s3',
                              aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
                              aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY'),
                              region_name=os.getenv('AWS_REGION','us-east-1'))
            bucket = os.getenv('S3_BUCKET')
            step_key = f"cad/{variant_id}.step"
            stl_key = f"cad/{variant_id}.stl"
            s3.put_object(Bucket=bucket, Key=step_key, Body=step_bytes, ContentType='model/step')
            s3.put_object(Bucket=bucket, Key=stl_key, Body=stl_bytes, ContentType='model/stl')
            step_url = s3.generate_presigned_url('get_object', Params={'Bucket':bucket,'Key':step_key}, ExpiresIn=3600)
            stl_url = s3.generate_presigned_url('get_object', Params={'Bucket':bucket,'Key':stl_key}, ExpiresIn=3600)
        except Exception as e:
            log.warning(json.dumps({'event':'cad_export_s3_error','error':str(e)}))

    # update variant references
    if variant in VARIANTS:
        variant['step_url'] = step_url
        variant['stl_url'] = stl_url
    elif SUPABASE_URL:
        try:
            ep = f"{SUPABASE_URL}/rest/v1/variants?id=eq.{variant_id}"
            headers = supabase_headers(); headers['Prefer'] = 'return=representation'
            patch = {'step_url': step_url, 'stl_url': stl_url}
            requests.patch(ep, headers=headers, json=patch)
        except Exception as e:
            log.warning(json.dumps({'event':'cad_export_variant_patch_error','error':str(e)}))

    _audit('cad.export', request, {'variant_id': variant_id})
    return CADExportResponse(variant_id=variant_id, stl_url=stl_url, step_url=step_url, backend=backend)


@app.post('/api/v1/fem/solve-general', response_model=GeneralFEMResponse)
def api_fem_solve_general(body: GeneralFEMRequest, request: Request):
    _require_role(request, ['admin','designer','engineer'])
    result = solve_rect_plate(width=body.width or 40.0,
                              height=body.height or 30.0,
                              load=body.load or 1.0,
                              young=body.young or 200e9,
                              poisson=body.poisson or 0.3)
    _audit('fem.solve_general', request, {'backend': result.get('backend')})
    return GeneralFEMResponse(ok=result['ok'],
                              displacement_norm=result['displacement_norm'],
                              stress_image_b64=result['stress_image_b64'],
                              backend=result['backend'])


@app.post('/api/v1/topopt/advanced-compliance', response_model=TopOptAdvancedResponse)
def api_topopt_advanced(body: TopOptAdvancedRequest, request: Request):
    _require_role(request, ['admin','designer','engineer'])
    res = run_topopt_compliance_advanced(width=body.width or 60,
                                         height=body.height or 40,
                                         vol_frac=body.vol_frac or 0.4,
                                         iters=body.iters or 25,
                                         penal=body.penal or 3.0)
    _audit('topopt.advanced_compliance', request, {'final_compliance': res.get('final_compliance')})
    return TopOptAdvancedResponse(ok=res['ok'],
                                  iterations=res['iterations'],
                                  final_compliance=res['final_compliance'],
                                  avg_density=res['avg_density'],
                                  backend=res['backend'],
                                  history=res['history'],
                                  layout_mask=res['layout_mask'])


@app.post('/api/v1/import/variants', response_model=ImportVariantsResponse)
def api_import_variants(body: ImportVariantsRequest, request: Request):
    _require_role(request, ['admin','designer','engineer'])
    try:
        records = parse_dataset(body.file_b64, body.filename)
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    variants = build_variants(records)
    ids = []
    for v in variants:
        # compute scores
        scores = _compute_variant_scores(v['metrics'])
        v['metrics']['scores'] = scores
        v['score'] = scores.get('overall_score')
        v['created_at'] = datetime.now(UTC).isoformat()
        persisted = _persist_variant_supabase(v) if SUPABASE_URL else None
        if not persisted and not SUPABASE_URL:
            VARIANTS.append(v)
        ids.append(v['id'])
    _audit('variants.imported', request, {'count': len(ids)})
    return ImportVariantsResponse(ok=True, imported=len(ids), variant_ids=ids)


@app.get('/api/v1/pareto/{run_id}', response_model=ParetoResponse)
def api_pareto(run_id: str, request: Request):
    _require_role(request, ['admin','designer','engineer','reviewer'])
    # collect variants for run
    collected = [v for v in VARIANTS if v.get('run_id') == run_id]
    if SUPABASE_URL:
        try:
            ep = f"{SUPABASE_URL}/rest/v1/variants?run_id=eq.{run_id}"
            r = requests.get(ep, headers=supabase_headers())
            if r.ok:
                supa = r.json()
                # merge with in-memory (avoid duplicates by id)
                existing_ids = {v['id'] for v in collected}
                for v in supa:
                    if v['id'] not in existing_ids:
                        collected.append(v)
        except Exception as e:
            log.warning(json.dumps({'event':'pareto_supabase_fetch_error','error':str(e)}))
    front = pareto_front(collected)
    _audit('pareto.computed', request, {'run_id': run_id, 'count': len(front)})
    return ParetoResponse(ok=True, run_id=run_id, count=len(front), front=front)


@app.get('/api/v1/report/dfx/{run_id}', response_model=DfxReportResponse)
def api_report_dfx(run_id: str, request: Request):
    _require_role(request, ['admin','designer','engineer','reviewer'])
    # Gather variants similar to pareto endpoint
    collected = [v for v in VARIANTS if v.get('run_id') == run_id]
    if SUPABASE_URL:
        try:
            ep = f"{SUPABASE_URL}/rest/v1/variants?run_id=eq.{run_id}"
            r = requests.get(ep, headers=supabase_headers())
            if r.ok:
                supa = r.json()
                existing_ids = {v['id'] for v in collected}
                for v in supa:
                    if v['id'] not in existing_ids:
                        collected.append(v)
        except Exception as e:
            log.warning(json.dumps({'event':'dfx_report_supabase_fetch_error','error':str(e)}))
    report = generate_dfx_report(run_id, collected)
    _audit('report.dfx_generated', request, {'run_id': run_id, 'variant_count': len(collected)})
    return DfxReportResponse(ok=True, run_id=run_id, report=report)


# Inline PDF report endpoint (minimal dependency version)
# Returns a simple PDF so tests can verify availability without external storage.
@app.get('/api/v1/runs/{run_id}/report.pdf')
def api_report_pdf_inline(run_id: str, request: Request):
    _require_role(request, ['admin','designer','engineer','reviewer'])
    try:
        # Build a real (readable) PDF from available run/variant data.
        collected = [v for v in VARIANTS if v.get('run_id') == run_id]
        if SUPABASE_URL:
            try:
                ep = f"{SUPABASE_URL}/rest/v1/variants?run_id=eq.{run_id}"
                r = requests.get(ep, headers=supabase_headers())
                if r.ok:
                    supa = r.json()
                    existing_ids = {v.get('id') for v in collected if v.get('id')}
                    for v in supa:
                        if v.get('id') not in existing_ids:
                            collected.append(v)
            except Exception as e:
                log.warning(json.dumps({'event':'pdf_report_supabase_fetch_error','run_id':run_id,'error':str(e)}))

        best = None
        if collected:
            best = sorted(collected, key=lambda x: (x.get('score') or 0), reverse=True)[0]

        overall_score = float((best or {}).get('score') or 0) if best else 0.0

        # Extract common metrics if present (support both nested and flat structures)
        raw_metrics = (best or {}).get('metrics') or {}
        scores = (raw_metrics.get('scores') or {}) if isinstance(raw_metrics, dict) else {}
        metrics = {
            'run_id': run_id,
            'variant_id': (best or {}).get('id') or run_id,
            'fabricability': scores.get('fabricability') or raw_metrics.get('fabricability_score') or raw_metrics.get('fabricability'),
            'assemblability': scores.get('assemblability') or raw_metrics.get('assemblability_score') or raw_metrics.get('assemblability'),
            'sustainability': scores.get('sustainability') or raw_metrics.get('sustainability_score') or raw_metrics.get('sustainability'),
            'mass_g': raw_metrics.get('mass_g'),
            'volume_cm3': raw_metrics.get('volume_cm3'),
            'safety_factor': raw_metrics.get('safety_factor'),
        }
        # Add narrative report text (used by fallback PDF writer when WeasyPrint fails)
        try:
            metrics['report'] = generate_dfx_report(run_id, collected)
        except Exception as e:
            metrics['report'] = f"DfX report text unavailable: {e}"

        # Derive prompts from variants when prompt storage isn't available.
        derived_prompts: list[str] = []
        try:
            for v in collected:
                for key in ('prompt_text', 'prompt', 'input_prompt', 'positive_prompt'):
                    val = v.get(key)
                    if isinstance(val, str) and val.strip():
                        derived_prompts.append(val.strip())
                meta = v.get('metadata')
                if isinstance(meta, dict):
                    val = meta.get('prompt') or meta.get('prompt_text')
                    if isinstance(val, str) and val.strip():
                        derived_prompts.append(val.strip())
        except Exception:
            pass
        # De-duplicate while preserving order
        derived_prompts = list(dict.fromkeys(derived_prompts))

        pdf_bytes = generate_pdf_report_simple(
            variant_id=metrics['variant_id'],
            overall_score=overall_score,
            metrics=metrics,
            variants=collected,
            prompts=derived_prompts,
        )
    except Exception as e:
        # If something truly unexpected happens, still return a readable PDF.
        log.warning(json.dumps({'event':'pdf_report_simple_failed','run_id':run_id,'error':str(e)}))
        pdf_bytes = _build_minimal_text_pdf(
            "DfX Report (fallback)",
            [
                f"run_id: {run_id}",
                f"error: {e}",
                "",
                "Tip: On Windows, WeasyPrint may be unavailable; fallback PDF mode should still work.",
            ],
        )
    _audit('report.pdf_generated_inline', request, {'run_id': run_id, 'size': len(pdf_bytes)})
    return Response(content=pdf_bytes, media_type='application/pdf')


@app.post('/api/v1/security/moderate', response_model=ModerationResponse)
def api_security_moderate(body: ModerationRequest, request: Request):
    _require_role(request, ['admin','designer','engineer','reviewer'])
    res = content_moderate(body.prompt)
    _audit('security.moderate', request, {'flagged': res.get('flagged')})
    return ModerationResponse(**res)


@app.get('/api/v1/scoring/weights')
def api_get_scoring_weights():
    return {'weights': get_weights()}

class WeightsUpdate(BaseModel):
    fabricability: float | None = None
    assemblability: float | None = None
    sustainability: float | None = None

class AdvancedScoreRequest(BaseModel):
    metrics: dict
    constraints: dict | None = None

class AdvancedScoreResponse(BaseModel):
    ok: bool
    scores: dict

class AnonymizeRequest(BaseModel):
    user_id: str

class AnonymizeResponse(BaseModel):
    ok: bool
    user_id: str
    status: str

class ParametricRequest(BaseModel):
    width_mm: float | None = None
    height_mm: float | None = None
    depth_mm: float | None = None
    wall_thickness_mm: float | None = None
    material: str | None = None
    fillet_mm: float | None = 2.0
    engine: str | None = 'stub'  # 'cadquery' forces CADQuery backend

class ParametricResponse(BaseModel):
    ok: bool
    model_id: str
    stl_url: str | None
    step_url: str | None
    metrics: dict
    params: dict
    created_at: str

class FEMRequest(BaseModel):
    length_mm: float | None = 100.0
    height_mm: float | None = 20.0
    thickness_mm: float | None = 5.0
    force_N: float | None = 50.0
    E_GPa: float | None = 2.1
class FEMJobRequest(BaseModel):
    variant_id: str | None = None
    mesh_config: dict | None = {}
    boundary_conditions: dict | None = {}
    material_properties: dict | None = {}

class FEMJobResponse(BaseModel):
    ok: bool
    job_id: str
    task_id: str | None = None
    status: str | None = 'queued'
class AdvancedFEMRequest(BaseModel):
    width_mm: float | None = 80.0
    height_mm: float | None = 20.0
    depth_mm: float | None = 5.0
    force_N: float | None = 75.0
    fixed_edges: List[str] | None = ['left']
    material: str | None = 'pla'
    export_csv: bool | None = True
class AdvancedFEMResponse(BaseModel):
    ok: bool
    backend: str
    max_deflection_mm: float
    max_von_mises_MPa: float
    safety_factor: float
    field_csv_b64: str | None = None

class FEMResponse(BaseModel):
    ok: bool
    backend: str
    max_deflection_mm: float
    max_von_mises_MPa: float
    safety_factor: float

class RunReplayResponse(BaseModel):
    ok: bool
    meta: dict

class TopOptRequest(BaseModel):
    mass_g: float | None = 120.0
    target_reduction_pct: float | None = 20.0
    solver: bool | None = None  # force use of real solver even if env flag off
    advanced: bool | None = None  # compliance-based advanced solver

class TopOptResponse(BaseModel):
    ok: bool
    topopt_id: str
    original_mass_g: float
    new_mass_g: float
    achieved_reduction_pct: float
class FeedbackRequest(BaseModel):
    rating: float
    comment: str | None = None
class FeedbackResponse(BaseModel):
    ok: bool
    variant_id: str
    rating: float
    new_overall_score: float

@app.post('/api/v1/parametric/generate', response_model=ParametricResponse)
def api_parametric_generate(body: ParametricRequest, request: Request):
    _require_role(request, ['admin','designer','engineer'])
    params = body.model_dump(exclude_none=True)
    use_cadquery = params.get('engine') == 'cadquery' or os.getenv('PARAMETRIC_ENGINE') == 'cadquery'
    if use_cadquery:
        model = generate_cadquery_model(params)
        # normalize to previous shape
        params_out = {k: v for k, v in params.items() if k not in ('engine',)}
        model_payload = {
            'model_id': model['model_id'],
            'stl_url': model['stl_url'],
            'step_url': model['step_url'],
            'metrics': model['metrics'],
            'params': params_out,
            'created_at': model['created_at'],
        }
    else:
        model = generate_parametric_model(params)
        model_payload = model

    # If Supabase storage is configured, attempt to generate an ASCII STL and STEP and upload them.
    try:
        if _supabase_is_configured() and os.getenv('SUPABASE_STORAGE_BUCKET'):
            try:
                stl_bytes = export_ascii_stl_box(model_payload.get('params', {}))
                filename = f"parametric/{model_payload['model_id']}.stl"
                signed_stl = _upload_and_sign(None, stl_bytes, filename, content_type='application/octet-stream')
                if signed_stl:
                    model_payload['stl_url'] = signed_stl
            except Exception as e:
                log.warning(f"parametric_stl_generate_or_upload_failed: {e}")

            # Try STEP export if cadquery is available
            try:
                step_bytes = export_step_box(model_payload.get('params', {}))
                if step_bytes:
                    step_filename = f"parametric/{model_payload['model_id']}.step"
                    signed_step = _upload_and_sign(None, step_bytes, step_filename, content_type='application/octet-stream')
                    if signed_step:
                        model_payload['step_url'] = signed_step
            except Exception as e:
                log.warning(f"parametric_step_generate_or_upload_failed: {e}")
    except Exception:
        # suppress any unexpected errors in optional upload path
        pass
    _audit('parametric.generated', request, {'model_id': model_payload['model_id'], 'backend': ('cadquery' if use_cadquery else 'stub')})
    return ParametricResponse(ok=True, model_id=model_payload['model_id'], stl_url=model_payload['stl_url'], step_url=model_payload['step_url'], metrics=model_payload['metrics'], params=model_payload['params'], created_at=model_payload['created_at'])

@app.post('/api/v1/fem/simulate', response_model=FEMResponse)
def api_fem_simulate(body: FEMRequest, request: Request):
    _require_role(request, ['admin','engineer'])
    result = run_real_fem(body.model_dump())
    _audit('fem.simulated', request, {'backend': result.get('backend')})
    return FEMResponse(ok=True, backend=result['backend'], max_deflection_mm=result['max_deflection_mm'], max_von_mises_MPa=result['max_von_mises_MPa'], safety_factor=result['safety_factor'])

@app.post('/api/v1/fem/advanced-simulate', response_model=AdvancedFEMResponse)
def api_fem_advanced(body: AdvancedFEMRequest, request: Request):
    _require_role(request, ['admin','engineer'])
    res = run_advanced_fem(body.model_dump())
    _audit('fem.advanced', request, {'backend': res.get('backend')})
    return AdvancedFEMResponse(ok=True, backend=res['backend'], max_deflection_mm=res['max_deflection_mm'], max_von_mises_MPa=res['max_von_mises_MPa'], safety_factor=res['safety_factor'], field_csv_b64=res.get('field_csv_b64'))


@app.post('/api/v1/fem/jobs', response_model=FEMJobResponse)
def api_fem_submit_job(body: FEMJobRequest, request: Request):
    _require_role(request, ['admin','engineer'])
    job_id = f'femjob-{uuid.uuid4().hex[:10]}'
    # Enqueue Celery task if enabled
    task_id = None
    try:
        if CELERY_ENABLED:
            try:
                from .tasks import fem_solve_task
            except Exception:
                from tasks import fem_solve_task
            task = fem_solve_task.delay(job_id, body.mesh_config or {}, body.boundary_conditions or {}, body.material_properties or {})
            task_id = getattr(task, 'id', None)
    except Exception as e:
        log.warning(f'failed_to_enqueue_fem_task {e}')

    # Persist fem_jobs record to Supabase if available
    stored = False
    created_at = datetime.now(UTC).isoformat()
    if _supabase_is_configured():
        try:
            headers = supabase_headers(); headers['Prefer'] = 'return=representation'
            payload = {
                'job_id': job_id,
                'variant_id': body.variant_id,
                'task_id': task_id,
                'status': 'queued',
                'mesh_config': body.mesh_config or {},
                'boundary_conditions': body.boundary_conditions or {},
                'material_properties': body.material_properties or {},
                'created_at': created_at,
            }
            r = requests.post(f"{os.getenv('SUPABASE_URL')}/rest/v1/fem_jobs", headers=headers, json=payload, timeout=10)
            if r.ok:
                stored = True
        except Exception as e:
            log.warning(f'fem_jobs_persist_failed {e}')

    if not stored:
        # Fallback in-memory store
        try:
            FEM_JOBS = globals().get('FEM_JOBS') or {}
            FEM_JOBS[job_id] = {'job_id': job_id, 'task_id': task_id, 'status': 'queued', 'created_at': created_at, 'payload': body.model_dump()}
            globals()['FEM_JOBS'] = FEM_JOBS
        except Exception:
            pass

    _audit('fem.job.submitted', request, {'job_id': job_id, 'task_id': task_id})
    return FEMJobResponse(ok=True, job_id=job_id, task_id=task_id, status='queued')


@app.get('/api/v1/fem/jobs')
def api_fem_list_jobs(request: Request, limit: int = 50, offset: int = 0, status: str | None = None):
    """List FEM jobs for the current tenant (or all if admin).

    Supports simple pagination via `limit` and `offset` and optional `status` filter.
    """
    _require_role(request, ['admin','engineer','designer'])
    tenant_id = getattr(request.state, 'tenant_id', None) or getattr(request.state, 'user', {}).get('tenant_id')
    try:
        if _supabase_is_configured():
            url = f"{os.getenv('SUPABASE_URL')}/rest/v1/fem_jobs?select=*&order=created_at.desc&limit={int(limit)}&offset={int(offset)}"
            if status:
                url += f"&status=eq.{status}"
            if tenant_id:
                url += f"&tenant_id=eq.{tenant_id}"
            headers = supabase_headers()
            r = requests.get(url, headers=headers, timeout=10)
            if r.ok:
                return {'ok': True, 'jobs': r.json()}
            else:
                log.warning(f'fem_jobs_list_supabase_failed {r.status_code} {r.text}')
        # Fallback in-memory
        FEM_JOBS = globals().get('FEM_JOBS') or {}
        items = list(FEM_JOBS.values())
        if tenant_id:
            items = [i for i in items if i.get('tenant_id') in (None, tenant_id)]
        if status:
            items = [i for i in items if i.get('status') == status]
        total = len(items)
        items = items[offset:offset+limit]
        return {'ok': True, 'jobs': items, 'total': total}
    except Exception as e:
        log.error(f'list_fem_jobs_failed: {e}')
        raise HTTPException(status_code=500, detail='failed to list fem jobs')


@app.get('/api/v1/diffusion/stream/{variant_id}')
def api_diffusion_stream(variant_id: str, request: Request):
    """SSE endpoint streaming progressive diffusion frames for a variant.

    Relies on `REDIS_URL` being set and the diffusion worker publishing to
    channel `diffusion:{variant_id}` as JSON messages with shape {type: 'preview'|'final', image_b64, ...}.
    """
    _require_role(request, ['admin','designer','engineer'])
    REDIS_URL = os.getenv('REDIS_URL')
    if not REDIS_URL:
        raise HTTPException(status_code=503, detail='Redis not configured for streaming')

    try:
        import redis, json, time
        r = redis.Redis.from_url(REDIS_URL)
        pub = r.pubsub(ignore_subscribe_messages=True)
        channel = f"diffusion:{variant_id}"
        pub.subscribe(channel)

        def event_stream():
            try:
                for message in pub.listen():
                    if message is None:
                        continue
                    if message.get('type') != 'message':
                        continue
                    data = message.get('data')
                    try:
                        if isinstance(data, bytes):
                            data = data.decode('utf-8')
                        obj = json.loads(data)
                    except Exception:
                        obj = {'raw': str(data)}
                    # SSE framing
                    ev_type = obj.get('type', 'message')
                    yield f"event: {ev_type}\n"
                    yield f"data: {json.dumps(obj)}\n\n"
                    # break if final
                    if obj.get('type') == 'final':
                        break
                    # stop if client disconnected
                    if await_client_disconnect(request):
                        break
            finally:
                try:
                    pub.close()
                except Exception:
                    pass

        from fastapi.responses import StreamingResponse
        return StreamingResponse(event_stream(), media_type='text/event-stream')
    except Exception as e:
        log.error(f'diffusion_stream_failed: {e}')
        raise HTTPException(status_code=500, detail='failed to open stream')


def await_client_disconnect(request: Request) -> bool:
    """Helper to check client disconnect in a cooperative way.
    Returns True if client disconnected.
    """
    try:
        # FastAPI/Starlette exposes `is_disconnected` coroutine on request
        is_disconn = getattr(request, 'is_disconnected', None)
        if is_disconn and callable(is_disconn):
            # NOTE: calling coroutine here would require async; return False and rely on pubsub loop
            return False
    except Exception:
        pass
    return False

@app.post('/api/v1/runs/{run_id}/replay', response_model=RunReplayResponse)
def api_run_replay(run_id: str, request: Request):
    _require_role(request, ['admin','designer','engineer'])
    meta = replay_run(run_id, {'user_id': getattr(request.state,'user',{}).get('id')})
    _audit('run.replayed', request, {'run_id': run_id})
    return RunReplayResponse(ok=True, meta=meta)

@app.post('/api/v1/topopt/optimize', response_model=TopOptResponse)
def api_topopt_optimize(body: TopOptRequest, request: Request):
    _require_role(request, ['admin','engineer','designer'])
    use_solver_env = os.getenv('TOPOPT_SOLVER') == '1'
    payload = body.model_dump()
    use_advanced = bool(body.advanced) or os.getenv('TOPOPT_SOLVER_ADV') == '1'
    if use_advanced:
        comp = run_topopt_compliance({'iterations': int(os.getenv('TOPOPT_ADV_ITER','40'))})
        original_mass = payload.get('mass_g') or 120.0
        new_mass = original_mass * comp['density_mean']
        result = {
            'topopt_id': comp['topopt_id'],
            'original_mass_g': round(original_mass,3),
            'new_mass_g': round(new_mass,3),
            'achieved_reduction_pct': round((1 - new_mass / original_mass)*100.0,2)
        }
    elif body.solver or use_solver_env:
        # Map request fields to solver params, include desired iterations & volume fraction
        solver_params = {
            'nelx': int(os.getenv('TOPOPT_NELX','40')),
            'nely': int(os.getenv('TOPOPT_NELY','25')),
            'target_vol_frac': max(0.2, 1.0 - (payload.get('target_reduction_pct') or 20.0)/100.0),
            'iterations': int(os.getenv('TOPOPT_ITERATIONS','35')),
            'penal': float(os.getenv('TOPOPT_PENAL','3.0')),
        }
        solver_res = run_topopt_solver(solver_params)
        original_mass = payload.get('mass_g') or 120.0
        # Approximate new mass by scaling with achieved_vol_frac
        new_mass = original_mass * solver_res['achieved_vol_frac']
        result = {
            'topopt_id': solver_res['topopt_id'],
            'original_mass_g': round(original_mass,3),
            'new_mass_g': round(new_mass,3),
            'achieved_reduction_pct': round((1 - new_mass / original_mass)*100.0,2)
        }
    else:
        result = run_topopt(payload)
    _audit('topopt.executed', request, {'topopt_id': result['topopt_id']})
    return TopOptResponse(ok=True, **result)

def _update_variant_supabase(variant_id: str, patch: dict):
    if not SUPABASE_URL:
        return False
    try:
        url = f"{SUPABASE_URL}/rest/v1/variants?id=eq.{variant_id}"
        headers = supabase_headers(); headers['Prefer'] = 'return=representation'
        r = requests.patch(url, headers=headers, json=patch)
        return r.ok
    except Exception as e:
        log.warning(json.dumps({'event':'variant_update_failed','variant_id':variant_id,'error':str(e)}))
    return False

@app.post('/api/v1/variants/{variant_id}/feedback', response_model=FeedbackResponse)
def api_variant_feedback(variant_id: str, body: FeedbackRequest, request: Request):
    _require_role(request, ['admin','designer','engineer','reviewer'])
    rating = max(0.0, min(5.0, body.rating))
    variant_ref = next((v for v in VARIANTS if v.get('id') == variant_id), None)
    if not variant_ref and SUPABASE_URL:
        try:
            variant_ref = fetch_variant_supabase(variant_id)
        except Exception:
            variant_ref = None
    if not variant_ref:
        raise HTTPException(status_code=404, detail='variant not found')
    run_id = variant_ref.get('run_id')
    fb_state = update_feedback(run_id, rating) if run_id else None
    metrics = variant_ref.get('metrics') or {}
    metrics['user_feedback'] = rating
    # derive adaptive weights
    current = get_weights()
    new_weights = derive_weights(current, fb_state or {})
    set_weights(new_weights)
    # recompute multi-objective score using updated weights
    multi = compute_multiobjective_scores({
        'fabricability': metrics.get('scores', {}).get('fabricability'),
        'assemblability': metrics.get('scores', {}).get('assemblability'),
        'sustainability': metrics.get('scores', {}).get('sustainability'),
        'aesthetic': metrics.get('scores', {}).get('aesthetic'),
        'user_feedback': rating,
    }, new_weights)
    new_overall = multi['overall_score']
    # merge scores
    existing_scores = metrics.get('scores', {})
    existing_scores['overall_score'] = new_overall
    existing_scores['user_feedback'] = rating
    existing_scores['adaptive_weights'] = new_weights
    metrics['scores'] = existing_scores
    variant_ref['score'] = new_overall
    variant_ref['metrics'] = metrics
    tenant_id = getattr(request.state, 'user', {}).get('tenant') if hasattr(request.state,'user') else None
    if SUPABASE_URL:
        try:
            ep = f"{SUPABASE_URL}/rest/v1/feedback_history"
            headers = supabase_headers(); headers['Prefer'] = 'return=representation'
            fb_payload = {'variant_id': variant_id, 'run_id': run_id, 'rating': rating, 'comment': body.comment, 'tenant_id': tenant_id}
            requests.post(ep, headers=headers, json=fb_payload, timeout=8)
        except Exception as e:
            log.warning(json.dumps({'event':'feedback_history_insert_failed','variant_id':variant_id,'error':str(e)}))
        # Persist weights drift event (best-effort)
        try:
            w_ep = f"{SUPABASE_URL}/rest/v1/weights_history"
            w_headers = supabase_headers(); w_headers['Prefer'] = 'return=representation'
            w_payload = {
                'run_id': run_id,
                'variant_id': variant_id,
                'previous_weights': current,
                'new_weights': new_weights,
                'rating': rating,
                'tenant_id': tenant_id,
            }
            requests.post(w_ep, headers=w_headers, json=w_payload, timeout=8)
        except Exception as e:
            log.warning(json.dumps({'event':'weights_history_insert_failed','variant_id':variant_id,'error':str(e)}))
        _update_variant_supabase(variant_id, {'metrics': metrics, 'score': new_overall})
    else:
        WEIGHTS_HISTORY.append({
            'run_id': run_id,
            'variant_id': variant_id,
            'previous_weights': current,
            'new_weights': new_weights,
            'rating': rating,
            'created_at': datetime.now(UTC).isoformat(),
        })
    _audit('variant.feedback', request, {'variant_id': variant_id, 'rating': rating, 'adaptive_avg_rating': fb_state.get('avg_rating') if fb_state else None})
    return FeedbackResponse(ok=True, variant_id=variant_id, rating=rating, new_overall_score=new_overall)

@app.get('/api/v1/variants/{variant_id}/feedback/history', response_model=FeedbackHistoryResponse)
def api_feedback_history(variant_id: str, request: Request):
    _require_role(request, ['admin','designer','engineer','reviewer'])
    entries = []
    if SUPABASE_URL:
        try:
            ep = f"{SUPABASE_URL}/rest/v1/feedback_history?variant_id=eq.{variant_id}&order=created_at.desc"
            r = requests.get(ep, headers=supabase_headers(), timeout=8)
            if r.ok:
                entries = r.json()
        except Exception as e:
            log.warning(json.dumps({'event':'feedback_history_fetch_failed','variant_id':variant_id,'error':str(e)}))
    else:
        # Fallback single snapshot from variant metrics if present
        ref = next((v for v in VARIANTS if v.get('id') == variant_id), None)
        if ref and ref.get('metrics', {}).get('scores', {}).get('user_feedback') is not None:
            entries = [{'rating': ref['metrics']['scores']['user_feedback'], 'created_at': ref.get('created_at')}]
    ratings = [e.get('rating') for e in entries if e.get('rating') is not None]
    avg = sum(ratings)/len(ratings) if ratings else None
    _audit('feedback.history', request, {'variant_id': variant_id, 'count': len(entries)})
    return FeedbackHistoryResponse(ok=True, variant_id=variant_id, count=len(entries), average_rating=avg, entries=entries)

@app.post('/api/v1/scoring/weights')
def api_update_scoring_weights(body: WeightsUpdate, request: Request):
    _require_role(request, ['admin'])
    proposed = {k: v for k,v in body.model_dump().items() if v is not None}
    if not proposed:
        raise HTTPException(status_code=400, detail='no weights provided')
    before = get_weights()
    set_weights(proposed)
    after = get_weights()
    # Record manual override event
    if SUPABASE_URL:
        try:
            w_ep = f"{SUPABASE_URL}/rest/v1/weights_history"
            w_headers = supabase_headers(); w_headers['Prefer'] = 'return=representation'
            w_payload = {
                'run_id': None,
                'variant_id': None,
                'previous_weights': before,
                'new_weights': after,
                'rating': None,
                'tenant_id': getattr(request.state,'user',{}).get('tenant'),
            }
            requests.post(w_ep, headers=w_headers, json=w_payload, timeout=8)
        except Exception as e:
            log.warning(json.dumps({'event':'weights_history_override_failed','error':str(e)}))
    else:
        WEIGHTS_HISTORY.append({
            'run_id': None,
            'variant_id': None,
            'previous_weights': before,
            'new_weights': after,
            'rating': None,
            'created_at': datetime.now(UTC).isoformat(),
        })
    _audit('weights.updated', request, {'before': before, 'after': after})
    return {'ok': True, 'before': before, 'after': after}

@app.get('/api/v1/scoring/weights/history')
def api_scoring_weights_history(request: Request, limit: int = 100, offset: int = 0, run_id: str | None = None, variant_id: str | None = None):
    _require_role(request, ['admin'])
    limit = max(1, min(limit, 500))
    offset = max(0, offset)
    items: list[dict] = []
    if SUPABASE_URL:
        try:
            filters = []
            if run_id:
                filters.append(f"run_id=eq.{run_id}")
            if variant_id:
                filters.append(f"variant_id=eq.{variant_id}")
            base = f"{SUPABASE_URL}/rest/v1/weights_history?order=created_at.desc&limit={limit}&offset={offset}"
            if filters:
                base += '&' + '&'.join(filters)
            r = requests.get(base, headers=supabase_headers(), timeout=8)
            if r.ok:
                items = r.json()
        except Exception as e:
            log.warning(json.dumps({'event':'weights_history_fetch_failed','error':str(e)}))
    else:
        filtered = WEIGHTS_HISTORY
        if run_id:
            filtered = [w for w in filtered if w.get('run_id') == run_id]
        if variant_id:
            filtered = [w for w in filtered if w.get('variant_id') == variant_id]
        filtered = list(reversed(filtered))  # newest first
        items = filtered[offset:offset+limit]
    _audit('weights.history', request, {'count': len(items), 'run_id': run_id, 'variant_id': variant_id})
    return {'items': items, 'generated_at': datetime.now(UTC).isoformat(), 'limit': limit, 'offset': offset}

@app.post('/api/v1/scoring/advanced', response_model=AdvancedScoreResponse)
def api_advanced_scoring(body: AdvancedScoreRequest, request: Request):
    _require_role(request, ['admin','designer','engineer'])
    scores = compute_multiobjective_scores(body.metrics, body.constraints or {})
    _audit('scoring.advanced', request, {'weights': scores.get('weights')})
    return AdvancedScoreResponse(ok=True, scores=scores)

@app.post('/api/v1/rgpd/anonymize', response_model=AnonymizeResponse)
def api_rgpd_anonymize(body: AnonymizeRequest, request: Request):
    _require_role(request, ['admin'])
    # Placeholder: in production this would scrub PII in DB & storage.
    _audit('user.anonymized', request, {'user_id': body.user_id})
    return AnonymizeResponse(ok=True, user_id=body.user_id, status=_tr(request,'anonymized'))

@app.get('/api/v1/runs/{run_id}/download.zip')
def download_run_zip(run_id: str):
    # Build in-memory ZIP with placeholder artifacts
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as z:
        # Basic manifest
        z.writestr('MANIFEST.txt', f'Run: {run_id}\nGenerated: {datetime.now(UTC).isoformat()}')
        # Scores (synthetic compute)
        metrics = {'part_count': 2, 'support_volume_ratio':0.2, 'material':'PLA', 'mass_g':60}
        scores = compute_dfx_scores(metrics, {})
        z.writestr('scores.json', json.dumps(scores))
        z.writestr('brief.txt', 'Placeholder brief content')
    buf.seek(0)
    return Response(content=buf.getvalue(), media_type='application/zip', headers={'Content-Disposition': f'attachment; filename="run-{run_id}.zip"'})

@app.get('/api/v1/audit/logs')
def api_audit_logs(request: Request, limit: int = 100):
    _require_role(request, ['admin'])
    items = []
    tenant = getattr(request.state,'user',{}).get('tenant') if hasattr(request.state,'user') else None
    if SUPABASE_URL:
        try:
            q = f"{SUPABASE_URL}/rest/v1/audit_log?select=*&order=ts.desc&limit={limit}"
            if tenant:
                q += f"&tenant_id=eq.{tenant}"
            r = requests.get(q, headers=supabase_headers(), timeout=8)
            if r.ok:
                items = r.json()
        except Exception as e:
            log.warning(json.dumps({'event':'audit_log_fetch_failed','error':str(e)}))
    if not items:
        items = AUDIT_LOG[-limit:]
    return {'items': items, 'source': 'supabase' if SUPABASE_URL else 'memory'}

@app.get('/admin/metrics')
def admin_metrics(request: Request):
    _require_role(request, ['admin'])
    summary = {}
    for path, data in METRICS.items():
        durs = data['durations']
        if durs:
            sorted_d = sorted(durs)
            idx = int(0.95 * (len(sorted_d)-1))
            p95 = sorted_d[idx]
            avg = sum(sorted_d)/len(sorted_d)
        else:
            p95 = 0.0
            avg = 0.0
        summary[path] = {'count': data['count'], 'p95_ms': round(p95,2), 'avg_ms': round(avg,2)}
    return {'endpoints': summary, 'generated_at': datetime.now(UTC).isoformat()}

@app.get('/api/v1/metrics/summary')
def api_metrics_summary(request: Request):
    """Aggregated latency + request counts (p50/p95) across all tracked paths."""
    _require_role(request, ['admin','reviewer'])
    all_durations = []
    per_path = {}
    for path, data in METRICS.items():
        durs = data.get('durations', [])
        if durs:
            all_durations.extend(durs)
            sorted_d = sorted(durs)
            p50 = sorted_d[int(0.50 * (len(sorted_d)-1))]
            p95 = sorted_d[int(0.95 * (len(sorted_d)-1))]
            per_path[path] = {
                'count': data.get('count',0),
                'p50_ms': round(p50,2),
                'p95_ms': round(p95,2)
            }
        else:
            per_path[path] = {'count': data.get('count',0), 'p50_ms': 0.0, 'p95_ms': 0.0}
    overall = {}
    if all_durations:
        all_sorted = sorted(all_durations)
        overall['p50_ms'] = round(all_sorted[int(0.50 * (len(all_sorted)-1))],2)
        overall['p95_ms'] = round(all_sorted[int(0.95 * (len(all_sorted)-1))],2)
        overall['count'] = len(all_durations)
    else:
        overall = {'p50_ms': 0.0, 'p95_ms': 0.0, 'count': 0}
    return {'overall': overall, 'paths': per_path, 'generated_at': datetime.now(UTC).isoformat()}

@app.get('/metrics')
def prometheus_metrics():
    if not (Counter and Histogram):
        raise HTTPException(status_code=503, detail='prometheus client not installed')
    data = generate_latest()  # bytes
    return Response(content=data, media_type=CONTENT_TYPE_LATEST)

@app.get('/api/v1/health/deep')
def api_health_deep():
    """Deep health diagnostics for external integrations."""
    # Redis
    redis_status = 'unconfigured'
    if REDIS_URL:
        if _redis_client:
            try:
                _redis_client.ping()
                redis_status = 'ok'
            except Exception as e:
                redis_status = f'error:{e}'
        else:
            redis_status = 'error:init'
    # Supabase (simple REST probe)
    supabase_status = 'unconfigured'
    if SUPABASE_URL:
        try:
            probe = f"{SUPABASE_URL}/rest/v1/runs?select=run_id&limit=1"
            r = requests.get(probe, headers=supabase_headers(), timeout=6)
            if r.status_code in (200, 404):
                supabase_status = 'ok'
            else:
                supabase_status = f'error:http_{r.status_code}'
        except Exception as e:
            supabase_status = f'error:{e}'
    # MLflow
    mlflow_status = 'unconfigured'
    if MLFLOW_TRACKING_URI:
        if _mlflow_enabled:
            mlflow_status = 'ok'
        else:
            mlflow_status = 'error:init'
    # Diffusion pipeline
    diffusion_status = 'unconfigured'
    try:
        if diffusion_generator:
            diffusion_status = 'ok'
    except Exception:
        diffusion_status = 'error:init'

    overall = 'ok'
    for s in (redis_status, supabase_status, mlflow_status, diffusion_status):
        if isinstance(s, str) and s.startswith('error'):
            overall = 'degraded'
            break

    return {
        'status': overall,
        'redis': redis_status,
        'supabase': supabase_status,
        'mlflow': mlflow_status,
        'diffusion': diffusion_status,
        'time': datetime.now(UTC).isoformat(),
    }


@app.get('/api/v1/materials', response_model=List[MaterialOut])
def list_materials(request: Request, limit: int = 100, offset: int = 0):
    """List materials for current tenant."""
    tenant_id = request.state.user.get('tenant', 'default')
    
    if SUPABASE_URL:
        supabase = supabase_client()
        # Auto-seed if empty
        seed_materials_if_empty(supabase, tenant_id)
        results = list_materials_supabase(supabase, tenant_id, limit, offset)
        return [MaterialOut(**r) for r in results]
    else:
        raise HTTPException(status_code=503, detail="Supabase not configured")


@app.get('/api/v1/materials/{material_id}', response_model=MaterialOut)
def get_material(material_id: str, request: Request):
    """Get single material by ID."""
    tenant_id = request.state.user.get('tenant', 'default')
    
    if SUPABASE_URL:
        supabase = supabase_client()
        result = get_material_supabase(supabase, material_id, tenant_id)
        if not result:
            raise HTTPException(status_code=404, detail="Material not found")
        return MaterialOut(**result)
    else:
        raise HTTPException(status_code=503, detail="Supabase not configured")


@app.patch('/api/v1/materials/{material_id}', response_model=MaterialOut)
def update_material(material_id: str, updates: MaterialUpdate, request: Request):
    """Update material fields (admin only)."""
    _require_role(request, ['admin'])
    tenant_id = request.state.user.get('tenant', 'default')
    
    if SUPABASE_URL:
        supabase = supabase_client()
        result = update_material_supabase(supabase, material_id, tenant_id, updates)
        if not result:
            raise HTTPException(status_code=404, detail="Material not found or update failed")
        _audit('material.updated', request, 'material', material_id, updates.dict(exclude_unset=True))
        return MaterialOut(**result)
    else:
        raise HTTPException(status_code=503, detail="Supabase not configured")


@app.delete('/api/v1/materials/{material_id}')
def delete_material(material_id: str, request: Request):
    """Delete material (admin only)."""
    _require_role(request, ['admin'])
    tenant_id = request.state.user.get('tenant', 'default')
    
    if SUPABASE_URL:
        supabase = supabase_client()
        success = delete_material_supabase(supabase, material_id, tenant_id)
        if not success:
            raise HTTPException(status_code=404, detail="Material not found")
        _audit('material.deleted', request, 'material', material_id, {})
        return {'status': 'deleted', 'id': material_id}
    else:
        raise HTTPException(status_code=503, detail="Supabase not configured")


# ========== Celery Job Status Endpoint ==========

@app.get('/api/v1/jobs/{job_id}/status')
def get_job_status(job_id: str, request: Request):
    """
    Poll Celery task status.
    Returns task state, progress metadata, and result if completed.
    """
    if not CELERY_ENABLED:
        raise HTTPException(status_code=503, detail="Celery not enabled")
    
    try:
        from celery.result import AsyncResult
        from tasks import celery_app
        
        result = AsyncResult(job_id, app=celery_app)
        
        response = {
            'job_id': job_id,
            'status': result.state,
            'ready': result.ready(),
            'successful': result.successful() if result.ready() else None
        }
        
        if result.state == 'PROCESSING':
            response['progress'] = result.info
        elif result.ready():
            if result.successful():
                response['result'] = result.result
            else:
                response['error'] = str(result.info)
        
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch job status: {e}")


@app.get('/api/v1/jobs/{job_id}/events')
def stream_job_events(job_id: str, request: Request):
    """Server-Sent Events endpoint that streams Celery task status and progress.

    This implementation polls the Celery backend for task metadata and yields
    SSE messages until the task completes.
    """
    if not CELERY_ENABLED:
        raise HTTPException(status_code=503, detail="Celery not enabled")

    try:
        from celery.result import AsyncResult
        from tasks import celery_app
        import asyncio
        from fastapi.responses import StreamingResponse

        async def event_generator():
            try:
                result = AsyncResult(job_id, app=celery_app)
                last_state = None
                while True:
                    if await asyncio.to_thread(lambda: result):
                        state = result.state
                        info = result.info
                    else:
                        state = 'PENDING'
                        info = None

                    if state != last_state:
                        payload = json.dumps({'state': state, 'info': info})
                        yield f"event: status\ndata: {payload}\n\n"
                        last_state = state

                    if state == 'PROCESSING' and info:
                        payload = json.dumps({'state': state, 'progress': info})
                        yield f"event: progress\ndata: {payload}\n\n"

                    if result.ready():
                        if result.successful():
                            payload = json.dumps({'state': 'SUCCESS', 'result': result.result})
                            yield f"event: result\ndata: {payload}\n\n"
                        else:
                            payload = json.dumps({'state': 'FAILURE', 'error': str(result.info)})
                            yield f"event: result\ndata: {payload}\n\n"
                        break

                    await asyncio.sleep(1.0)
            except asyncio.CancelledError:
                return

        return StreamingResponse(event_generator(), media_type='text/event-stream')
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to stream job events: {e}")


# Simple Model Registry endpoints
@app.get('/api/v1/models')
def list_models(request: Request):
    """Return a small list of supported diffusion and ControlNet models."""
    # This is a curated list; expand as needed.
    models = [
        {'id': 'runwayml/stable-diffusion-v1-5', 'name': 'Stable Diffusion v1.5'},
        {'id': 'stabilityai/stable-diffusion-2-1', 'name': 'Stable Diffusion 2.1'},
        {'id': 'stabilityai/stable-diffusion-2-1-base', 'name': 'Stable Diffusion 2.1 Base'},
    ]
    controlnets = [
        {'id': 'lllyasviel/sdxl-controlnet-canny', 'name': 'ControlNet Canny (example)'},
    ]
    return {'ok': True, 'models': models, 'controlnets': controlnets}


class ActivateModelRequest(BaseModel):
    model_id: str
    controlnet_id: str | None = None


@app.post('/api/v1/models/activate')
def activate_model(req: ActivateModelRequest, request: Request):
    """Activate a model for the current tenant by persisting into `tenant_settings`.

    Requires Supabase to be configured; otherwise stores in-memory per-process.
    """
    tenant_id = request.state.user.get('tenant', 'default') if getattr(request.state, 'user', None) else 'default'
    setting_sd = {'key': 'active_sd_model', 'value': req.model_id, 'tenant_id': tenant_id}
    setting_cn = None
    if req.controlnet_id:
        setting_cn = {'key': 'active_controlnet_model', 'value': req.controlnet_id, 'tenant_id': tenant_id}

    if SUPABASE_URL and SUPABASE_KEY:
        headers = supabase_headers(); headers['Prefer'] = 'return=representation'
        try:
            # Upsert sd model
            r = requests.post(f"{SUPABASE_URL}/rest/v1/tenant_settings", headers=headers, json=setting_sd)
            if not r.ok:
                return {'ok': False, 'error': 'failed to persist sd model', 'detail': r.text}
            if setting_cn:
                r2 = requests.post(f"{SUPABASE_URL}/rest/v1/tenant_settings", headers=headers, json=setting_cn)
                if not r2.ok:
                    return {'ok': False, 'error': 'failed to persist controlnet model', 'detail': r2.text}
            return {'ok': True, 'tenant': tenant_id, 'active_sd_model': req.model_id, 'active_controlnet_model': req.controlnet_id}
        except Exception as e:
            return {'ok': False, 'error': str(e)}
    else:
        # In-memory fallback
        try:
            _IN_MEMORY_MODEL_REGISTRY = globals().get('_IN_MEMORY_MODEL_REGISTRY') or {}
            _IN_MEMORY_MODEL_REGISTRY[tenant_id] = {'sd': req.model_id, 'controlnet': req.controlnet_id}
            globals()['_IN_MEMORY_MODEL_REGISTRY'] = _IN_MEMORY_MODEL_REGISTRY
            return {'ok': True, 'tenant': tenant_id, 'active_sd_model': req.model_id, 'active_controlnet_model': req.controlnet_id}
        except Exception as e:
            return {'ok': False, 'error': str(e)}


# ========== PDF Report Generation Endpoint ==========

@app.post('/api/v1/reports/{run_id}/generate')
def generate_pdf_report_endpoint(run_id: str, request: Request, variant_id: Optional[str] = None, language: str = 'en'):
    """
    Generate comprehensive PDF report for a run or specific variant.
    Includes DfX analysis, metrics tables, risk flags, recommendations, feedback history.
    """
    tenant_id = request.state.user.get('tenant', 'default')
    
    if SUPABASE_URL:
        supabase = supabase_client()
        
        # Fetch run
        run_row = fetch_run_supabase(supabase, run_id)
        if not run_row or run_row.get('tenant_id') != tenant_id:
            raise HTTPException(status_code=404, detail="Run not found")
        
        # Fetch variants
        variants = list_variants_supabase(supabase, run_id)
        if not variants:
            raise HTTPException(status_code=404, detail="No variants found for this run")
        
        # If variant_id specified, filter to that variant; otherwise use first (or best scoring)
        if variant_id:
            target_variant = next((v for v in variants if v['variant_id'] == variant_id), None)
            if not target_variant:
                raise HTTPException(status_code=404, detail="Variant not found")
        else:
            # Pick variant with highest overall_score
            target_variant = max(variants, key=lambda v: v.get('overall_score', 0))
        
        variant_id_final = target_variant['variant_id']
        
        # Fetch DfX summary
        dfx_summary = fetch_dfx_summary_for_variant_supabase(supabase, variant_id_final) or {}
        
        # Fetch feedback history
        feedback_resp = (
            supabase.table("feedback_history")
            .select("*")
            .eq("variant_id", variant_id_final)
            .order("created_at", desc=True)
            .limit(10)
            .execute()
        )
        feedback_history = feedback_resp.data or []
        
        # Fetch weights history
        weights_resp = (
            supabase.table("weights_history")
            .select("*")
            .eq("run_id", run_id)
            .order("created_at", desc=True)
            .limit(5)
            .execute()
        )
        weights_history = weights_resp.data or []
        
        # Prepare metrics dict
        metrics = {
            'fabricability_score': target_variant.get('fabricability_score', 0),
            'assemblability_score': target_variant.get('assemblability_score', 0),
            'sustainability_score': target_variant.get('sustainability_score', 0),
            'aesthetic_score': target_variant.get('aesthetic_score', 0),
            'overall_score': target_variant.get('overall_score', 0),
            'support_volume_ratio': dfx_summary.get('support_volume_ratio', 0),
            'build_time_minutes': dfx_summary.get('build_time_minutes', 0),
            'part_count': dfx_summary.get('part_count', 1),
            'mass_kg': dfx_summary.get('mass_kg', 0),
            'max_von_mises_mpa': dfx_summary.get('max_von_mises_mpa', 0),
            'max_deflection_mm': dfx_summary.get('max_deflection_mm', 0),
            'safety_factor': dfx_summary.get('safety_factor'),
            'smoothness_score': dfx_summary.get('smoothness_score', 5.0)
        }
        
        # Optional: include images
        images = []
        if target_variant.get('image_url'):
            images.append({
                'url': target_variant['image_url'],
                'caption': f"Generated Design - Variant {variant_id_final[:8]}"
            })
        if target_variant.get('thumbnail_url'):
            images.append({
                'url': target_variant['thumbnail_url'],
                'caption': "Thumbnail Preview"
            })
        
        # Generate PDF
        try:
            pdf_bytes = generate_pdf_report(
                run_id=run_id,
                variant_id=variant_id_final,
                variant_data=target_variant,
                dfx_summary=dfx_summary,
                metrics=metrics,
                feedback_history=feedback_history,
                weights_history=weights_history,
                images=images,
                language=language
            )
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"PDF generation failed: {e}")
        
        # Upload to storage
        filename = f"report_{run_id}_{variant_id_final[:8]}.pdf"
        signed_url = _upload_and_sign(supabase, pdf_bytes, filename, content_type='application/pdf')
        
        _audit('report.generated', request, 'run', run_id, {'variant_id': variant_id_final, 'format': 'pdf'})
        
        return {
            'status': 'generated',
            'run_id': run_id,
            'variant_id': variant_id_final,
            'pdf_url': signed_url,
            'filename': filename,
            'language': language
        }
    else:
        raise HTTPException(status_code=503, detail="Supabase not configured")


# ========== Scoring Normalization Baselines CRUD ==========

@app.get('/api/v1/scoring/baselines')
def list_baselines(request: Request, product_type: Optional[str] = None):
    """List normalization baselines (optionally filtered by product type)."""
    tenant_id = request.state.user.get('tenant', 'default')
    
    if SUPABASE_URL:
        supabase = supabase_client()
        config = load_baselines_supabase(supabase, tenant_id)
        baselines = config.list_baselines(product_type)
        return {'baselines': [b.dict() for b in baselines], 'count': len(baselines)}
    else:
        # Return global defaults
        config = get_normalization_config()
        baselines = config.list_baselines(product_type)
        return {'baselines': [b.dict() for b in baselines], 'count': len(baselines)}


@app.post('/api/v1/scoring/baselines')
def create_baseline(baseline: NormalizationBaseline, request: Request):
    """Create or update normalization baseline (admin only)."""
    _require_role(request, ['admin'])
    tenant_id = request.state.user.get('tenant', 'default')
    
    if SUPABASE_URL:
        supabase = supabase_client()
        result = store_baseline_supabase(supabase, baseline, tenant_id)
        _audit('baseline.created', request, 'baseline', f"{baseline.product_type}_{baseline.metric_name}", baseline.dict())
        return {'status': 'created', 'baseline': baseline.dict()}
    else:
        raise HTTPException(status_code=503, detail="Supabase not configured")


@app.delete('/api/v1/scoring/baselines/{product_type}/{metric_name}')
def delete_baseline(product_type: str, metric_name: str, request: Request):
    """Delete custom baseline (admin only). Falls back to defaults."""
    _require_role(request, ['admin'])
    tenant_id = request.state.user.get('tenant', 'default')
    
    if SUPABASE_URL:
        supabase = supabase_client()
        success = delete_baseline_supabase(supabase, product_type, metric_name, tenant_id)
        if not success:
            raise HTTPException(status_code=404, detail="Baseline not found")
        _audit('baseline.deleted', request, 'baseline', f"{product_type}_{metric_name}", {})
        return {'status': 'deleted', 'product_type': product_type, 'metric_name': metric_name}
    else:
        raise HTTPException(status_code=503, detail="Supabase not configured")


@app.post('/api/v1/variants/{variant_id}/normalize-scores')
def normalize_variant_scores(variant_id: str, request: Request):
    """
    Re-compute normalized scores for a variant using current baselines.
    Returns normalized metrics dict.
    """
    tenant_id = request.state.user.get('tenant', 'default')
    
    if SUPABASE_URL:
        supabase = supabase_client()
        
        # Fetch variant
        resp = (
            supabase.table("variants")
            .select("*")
            .eq("variant_id", variant_id)
            .execute()
        )
        if not resp.data:
            raise HTTPException(status_code=404, detail="Variant not found")
        
        variant = resp.data[0]
        product_type = variant.get('product_type', 'generic')
        
        # Fetch DfX summary for raw metrics
        dfx_summary = fetch_dfx_summary_for_variant_supabase(supabase, variant_id) or {}
        
        # Load normalization config
        config = load_baselines_supabase(supabase, tenant_id)
        
        # Prepare metrics dict
        metrics = {
            'support_volume_ratio': dfx_summary.get('support_volume_ratio', 0),
            'part_count': dfx_summary.get('part_count', 1),
            'max_von_mises_mpa': dfx_summary.get('max_von_mises_mpa', 0),
            'max_deflection_mm': dfx_summary.get('max_deflection_mm', 0),
            'mass_kg': dfx_summary.get('mass_kg', 0),
            'build_time_minutes': dfx_summary.get('build_time_minutes', 0),
            'safety_factor': dfx_summary.get('safety_factor', 1.0),
            'smoothness_score': dfx_summary.get('smoothness_score', 5.0)
        }
        
        # Normalize
        normalized = normalize_metrics_dict(metrics, product_type, config)
        
        return {
            'variant_id': variant_id,
            'product_type': product_type,
            'raw_metrics': metrics,
            'normalized_metrics': normalized
        }
    else:
        raise HTTPException(status_code=503, detail="Supabase not configured")


# Simple note: this is a prototype skeleton. In production:
# - Replace in-memory stores with DB (Supabase / Postgres)
# - Use Celery/RQ for background workers and ML pipelines
# - Track runs in MLflow and store artifacts in object storage (S3/MinIO)
