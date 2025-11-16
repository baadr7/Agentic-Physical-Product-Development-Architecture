"""Simple worker skeleton for processing runs.

This module provides a function `process_run` which can be scheduled via FastAPI's
BackgroundTasks to simulate processing a run. It supports optional Supabase updates
(if SUPABASE_URL) and an optional MLflow integration if `mlflow` is installed and
MLFLOW_TRACKING_URI is set.
"""
import os
import time
import requests
from typing import Any, Dict, Optional
from random import randint, random
import uuid

try:
    from .scoring import compute_dfx_scores
except Exception:
    from scoring import compute_dfx_scores

try:
    from .mistral import MistralNotConfigured, normalize_brief, generate_prompts
except Exception:
    from mistral import MistralNotConfigured, normalize_brief, generate_prompts

SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_KEY')
MLFLOW_TRACKING_URI = os.getenv('MLFLOW_TRACKING_URI')
SUPABASE_STORAGE_BUCKET = os.getenv('SUPABASE_STORAGE_BUCKET')
DIFFUSION_IMAGE_URL = os.getenv('DIFFUSION_IMAGE_URL')  # Optional HTTP endpoint returning base64 image
CAD_ENABLED = os.getenv('CAD_ENABLED') == '1'
FEM_ENABLED = os.getenv('FEM_ENABLED') == '1'


def supabase_headers():
    return {
        'apikey': SUPABASE_KEY,
        'Authorization': f'Bearer {SUPABASE_KEY}',
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    }


def update_run_status_supabase(run_id: str, status: str, extra: dict | None = None):
    if not SUPABASE_URL:
        return None
    url = f"{SUPABASE_URL}/rest/v1/runs?run_id=eq.{run_id}"
    payload = {'status': status}
    if extra:
        payload.update(extra)
    headers = supabase_headers()
    headers['Prefer'] = 'return=representation'
    r = requests.patch(url, headers=headers, json=payload)
    r.raise_for_status()
    return r.json()


def upsert_prompt_supabase(run_id: str, prompt_text: str, model: str | None = None):
    if not SUPABASE_URL:
        return None
    url = f"{SUPABASE_URL}/rest/v1/prompts"
    headers = supabase_headers()
    headers['Prefer'] = 'return=representation'
    payload = {
        'run_id': run_id,
        'prompt_text': prompt_text,
        'model': model,
    }
    r = requests.post(url, headers=headers, json=payload)
    r.raise_for_status()
    return r.json()


def fetch_run_supabase(run_id: str) -> Optional[Dict[str, Any]]:
    if not SUPABASE_URL:
        return None
    url = f"{SUPABASE_URL}/rest/v1/runs?run_id=eq.{run_id}&select=*"
    r = requests.get(url, headers=supabase_headers())
    r.raise_for_status()
    items = r.json()
    if isinstance(items, list) and items:
        return items[0]
    return None


def patch_run_metadata_supabase(run_id: str, metadata: Dict[str, Any]):
    if not SUPABASE_URL:
        return None
    url = f"{SUPABASE_URL}/rest/v1/runs?run_id=eq.{run_id}"
    headers = supabase_headers()
    headers['Prefer'] = 'return=representation'
    payload = {'metadata': metadata}
    r = requests.patch(url, headers=headers, json=payload)
    r.raise_for_status()
    return r.json()


def process_run(run_id: str, project_id: str):
    """Simulate processing a run and update status in Supabase/DB if configured.

    This is a simple placeholder: it sleeps, toggles status to 'processing', then
    to 'completed' and writes a fake duration. In a real system this would call
    ML/Graphics pipelines, store artifacts, and log metadata to MLflow/DB.
    """
    try:
        print(f"[worker] start processing run {run_id} for project {project_id}")
        # mark as processing
        try:
            update_run_status_supabase(run_id, 'processing')
        except Exception as e:
            print('[worker] supabase update processing failed:', e)

        # If running in test mode, skip the simulated long-running work
        TEST_MODE = os.getenv('TEST_MODE')
        if TEST_MODE:
            duration_ms = 1
        else:
            # Simulate work
            time.sleep(2)
            duration_ms = 2000

        # If possible, generate prompts and a brief DfX summary using Mistral
        run_row = None
        options = {}
        description = None
        try:
            run_row = fetch_run_supabase(run_id)
        except Exception as e:
            print('[worker] supabase fetch run failed:', e)

        if run_row:
            # description could be in metadata/parameters or a direct field depending on schema
            description = (run_row.get('description')
                    or (run_row.get('parameters') or {}).get('description')
                    or '')
            # unify options/parameters so downstream pipelines can read them
            options = (run_row.get('options') or run_row.get('parameters') or {})
            if description:
                try:
                    prompts_out = generate_prompts(description, variants=3)
                    prompts = prompts_out.get('prompts') or []
                    for p in prompts:
                        try:
                            upsert_prompt_supabase(run_id, str(p))
                        except Exception as e:
                            print('[worker] supabase insert prompt failed:', e)
                    dfx_summary = prompts_out.get('dfx_summary')
                    meta = run_row.get('metadata') or {}
                    if dfx_summary:
                        meta['dfx_summary'] = dfx_summary
                    meta['llm_model'] = os.getenv('MISTRAL_MODEL', 'mistral-small-latest')
                    try:
                        patch_run_metadata_supabase(run_id, meta)
                    except Exception as e:
                        print('[worker] supabase patch metadata failed:', e)
                except MistralNotConfigured:
                    print('[worker] Mistral not configured, skipping LLM step')
                except Exception as e:
                    print('[worker] LLM prompting failed:', e)

        # If Supabase available, create a synthetic variant + DfX summary rows
        if SUPABASE_URL:
            try:
                # Generate synthetic metrics (placeholder for real pipeline outputs)
                # Base metrics
                metrics = {
                    'part_count': randint(1, 4),
                    'support_volume_ratio': round(random() * 0.3, 3),
                    'material': 'PLA',
                }

                # Run CAD pipeline (placeholder) to get model bytes and derived metrics
                stl_bytes = None
                step_bytes = None
                if CAD_ENABLED:
                    stl_bytes, step_bytes, cad_metrics = _run_cad_pipeline(description or '', options)
                    metrics.update({k: v for k, v in cad_metrics.items() if v is not None})
                else:
                    # Fallback random volume; mass derived from density
                    metrics['volume_cm3'] = round(50 + random() * 20, 2)

                # Derive mass from volume
                if 'volume_cm3' in metrics:
                    density_g_per_cm3 = 1.04
                    metrics['mass_g'] = round(float(metrics['volume_cm3']) * density_g_per_cm3, 2)
                scores = compute_dfx_scores(metrics, (run_row or {}).get('constraints') or {})

                # Insert variant
                variant_payload = {
                    'run_id': run_id,
                    'thumbnail_url': 'https://placehold.co/256x256?text=Variant',
                    'stl_url': None,
                    'step_url': None,
                    'image_url': None,
                    'metrics': metrics,
                    'score': scores['overall_score'],
                    'dfx_analysis': scores and f"Fabricability={scores['fabricability_score']} Assemblability={scores['assemblability_score']} Sustainability={scores['sustainability_score']}"
                }
                v_headers = supabase_headers(); v_headers['Prefer'] = 'return=representation'
                v_url = f"{SUPABASE_URL}/rest/v1/variants"
                v_res = requests.post(v_url, headers=v_headers, json=variant_payload)
                v_res.raise_for_status()
                variant_rows = v_res.json()
                variant_id = variant_rows[0]['id'] if isinstance(variant_rows, list) and variant_rows else None

                # If storage is configured, upload a tiny ASCII STL and sign a URL
                if variant_id and SUPABASE_STORAGE_BUCKET:
                    try:
                        object_name = f"variants/{run_id}/{variant_id}/model-{uuid.uuid4().hex[:8]}.stl"
                        if stl_bytes is None:
                            stl_bytes = _generate_ascii_stl_cube_bytes(name=f"var_{variant_id}")
                        stl_signed = _upload_and_sign(object_name, stl_bytes, content_type='model/stl')
                        if stl_signed:
                            try:
                                patch_url = f"{SUPABASE_URL}/rest/v1/variants?id=eq.{variant_id}"
                                p_headers = supabase_headers(); p_headers['Prefer'] = 'return=representation'
                                p_res = requests.patch(patch_url, headers=p_headers, json={'stl_url': stl_signed})
                                p_res.raise_for_status()
                            except Exception as e:
                                print('[worker] patch variant stl_url failed:', e)

                        # Upload a minimal STEP placeholder for early integrations
                        try:
                            step_object = f"variants/{run_id}/{variant_id}/model-{uuid.uuid4().hex[:8]}.step"
                            if step_bytes is None:
                                step_bytes = _generate_minimal_step_placeholder(name=f"var_{variant_id}")
                            step_signed = _upload_and_sign(step_object, step_bytes, content_type='application/step')
                            if step_signed:
                                try:
                                    patch_url = f"{SUPABASE_URL}/rest/v1/variants?id=eq.{variant_id}"
                                    p_headers = supabase_headers(); p_headers['Prefer'] = 'return=representation'
                                    p_res = requests.patch(patch_url, headers=p_headers, json={'step_url': step_signed})
                                    p_res.raise_for_status()
                                except Exception as e:
                                    print('[worker] patch variant step_url failed:', e)
                        except Exception as e:
                            print('[worker] step upload/sign failed:', e)

                        # Generate an image (diffusion or placeholder), upload original and thumbnail
                        try:
                            img_bytes = _generate_image_bytes(prompt=description or 'product concept', options=options)
                            img_object = f"variants/{run_id}/{variant_id}/image-{uuid.uuid4().hex[:8]}.png"
                            img_signed = _upload_and_sign(img_object, img_bytes, content_type='image/png')
                            # thumbnail: if we can't resize, reuse same bytes but different key
                            thumb_object = f"variants/{run_id}/{variant_id}/thumb-{uuid.uuid4().hex[:8]}.png"
                            thumb_signed = _upload_and_sign(thumb_object, img_bytes, content_type='image/png')
                            patch = {}
                            if img_signed:
                                patch['image_url'] = img_signed
                            if thumb_signed:
                                patch['thumbnail_url'] = thumb_signed
                            if patch:
                                try:
                                    patch_url = f"{SUPABASE_URL}/rest/v1/variants?id=eq.{variant_id}"
                                    p_headers = supabase_headers(); p_headers['Prefer'] = 'return=representation'
                                    p_res = requests.patch(patch_url, headers=p_headers, json=patch)
                                    p_res.raise_for_status()
                                except Exception as e:
                                    print('[worker] patch variant image/thumbnail failed:', e)
                        except Exception as e:
                            print('[worker] image generation/upload failed:', e)
                    except Exception as e:
                        print('[worker] storage upload/sign failed:', e)

                # Optional FEM pass to enrich metrics
                if FEM_ENABLED:
                    try:
                        fem_out = _run_fem_pipeline(stl_bytes, options)
                        metrics.update({k: v for k, v in fem_out.items() if v is not None})
                    except Exception as e:
                        print('[worker] fem pipeline failed:', e)

                # Insert dfx_summaries row
                if variant_id:
                    dfx_payload = {
                        'variant_id': variant_id,
                        'summary': (run_row or {}).get('metadata', {}).get('dfx_summary') or 'Heuristic scores computed.',
                        'fabricability_score': scores['fabricability_score'],
                        'assemblability_score': scores['assemblability_score'],
                        'sustainability_score': scores['sustainability_score'],
                        'recommendations': ['Reduce support structures', 'Optimize part count'],
                    }
                    d_headers = supabase_headers(); d_headers['Prefer'] = 'return=representation'
                    d_url = f"{SUPABASE_URL}/rest/v1/dfx_summaries"
                    d_res = requests.post(d_url, headers=d_headers, json=dfx_payload)
                    d_res.raise_for_status()
            except Exception as e:
                print('[worker] variant/dfx insertion failed:', e)

        # Mark completed
        try:
            update_run_status_supabase(run_id, 'completed', {'duration_ms': duration_ms})
        except Exception as e:
            print('[worker] supabase update completed failed:', e)

        # Optional MLflow logging
        if MLFLOW_TRACKING_URI and not TEST_MODE:
            try:
                import mlflow
                mlflow.set_tracking_uri(MLFLOW_TRACKING_URI)
                with mlflow.start_run(run_name=run_id):
                    mlflow.log_param('project_id', project_id)
                    mlflow.log_metric('duration_ms', duration_ms)
                    # If we created metrics earlier, log them (best-effort)
                    try:
                        if 'metrics' in locals():
                            for k,v in (metrics or {}).items():
                                if isinstance(v,(int,float)):
                                    mlflow.log_metric(k, float(v))
                        if 'scores' in locals():
                            for k,v in (scores or {}).items():
                                if isinstance(v,(int,float)):
                                    mlflow.log_metric(k, float(v))
                    except Exception as e:
                        print('[worker] mlflow metric logging partial failure:', e)
                    mlflow.set_tag('source', 'api-worker')
                print('[worker] logged run to MLflow')
            except Exception as e:
                print('[worker] mlflow logging failed or mlflow not installed:', e)

        print(f"[worker] finished run {run_id}")
    except Exception as e:
        print('[worker] unexpected error:', e)


def _generate_ascii_stl_cube_bytes(name: str = 'cube', size: float = 10.0) -> bytes:
    """Generate a tiny ASCII STL cube for demo purposes.

    This is sufficient for viewer sanity checks and artifact upload.
    """
    s = size
    # minimal cube faces using triangles (simplified placeholder)
    stl = [f"solid {name}"]
    def facet(nx, ny, nz, verts):
        stl.append(f"  facet normal {nx} {ny} {nz}")
        stl.append("    outer loop")
        for (x,y,z) in verts:
            stl.append(f"      vertex {x} {y} {z}")
        stl.append("    endloop")
        stl.append("  endfacet")
    # Two triangles per face; define 12 triangles
    # Front (z=0)
    facet(0,0,-1, [(0,0,0),(s,0,0),(s,s,0)])
    facet(0,0,-1, [(0,0,0),(s,s,0),(0,s,0)])
    # Back (z=s)
    facet(0,0,1, [(0,0,s),(s,s,s),(s,0,s)])
    facet(0,0,1, [(0,0,s),(0,s,s),(s,s,s)])
    # Left (x=0)
    facet(-1,0,0, [(0,0,0),(0,s,0),(0,s,s)])
    facet(-1,0,0, [(0,0,0),(0,s,s),(0,0,s)])
    # Right (x=s)
    facet(1,0,0, [(s,0,0),(s,0,s),(s,s,s)])
    facet(1,0,0, [(s,0,0),(s,s,s),(s,s,0)])
    # Bottom (y=0)
    facet(0,-1,0, [(0,0,0),(0,0,s),(s,0,s)])
    facet(0,-1,0, [(0,0,0),(s,0,s),(s,0,0)])
    # Top (y=s)
    facet(0,1,0, [(0,s,0),(s,s,s),(0,s,s)])
    facet(0,1,0, [(0,s,0),(s,s,0),(s,s,s)])
    stl.append(f"endsolid {name}")
    return ("\n".join(stl)).encode('utf-8')


def _generate_image_bytes(prompt: str, options: Optional[Dict[str, Any]] = None) -> bytes:
    """Generate or fetch an image for the given prompt.

    Priority:
    - If DIFFUSION_IMAGE_URL is set, POST {prompt} and expect JSON {image_b64}.
    - Else fetch a placeholder image from placehold.co and return the bytes.
    """
    # Try external diffusion HTTP endpoint
    if DIFFUSION_IMAGE_URL:
        try:
            payload = {'prompt': prompt}
            if options:
                for k in ('guidance_scale', 'steps', 'seed', 'width', 'height', 'scheduler'):
                    if k in options:
                        payload[k] = options[k]
            resp = requests.post(DIFFUSION_IMAGE_URL, json=payload, timeout=30)
            if resp.ok:
                data = resp.json()
                b64 = data.get('image_b64')
                if b64:
                    import base64
                    return base64.b64decode(b64)
        except Exception as e:
            print('[worker] external diffusion endpoint failed:', e)
    # Fallback: placeholder
    try:
        placeholder = f"https://placehold.co/1024x768/png?text={requests.utils.quote(prompt[:32] or 'Generated')}"
        r = requests.get(placeholder, timeout=15)
        if r.ok:
            return r.content
    except Exception:
        pass
    # Last resort: 1x1 transparent PNG
    return (
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\x0cIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\x0d\n\x2d\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
    )


def _upload_and_sign(object_name: str, data: bytes, content_type: str = 'application/octet-stream', expires_in: int = 3600) -> Optional[str]:
    if not (SUPABASE_URL and SUPABASE_KEY and SUPABASE_STORAGE_BUCKET):
        return None
    try:
        upload_url = f"{SUPABASE_URL}/storage/v1/object/{SUPABASE_STORAGE_BUCKET}/{object_name}"
        up_headers = {
            'apikey': SUPABASE_KEY,
            'Authorization': f'Bearer {SUPABASE_KEY}',
            'Content-Type': content_type,
        }
        up_res = requests.post(upload_url, headers=up_headers, data=data)
        if up_res.status_code not in (200, 201):
            print('[worker] upload failed:', up_res.status_code, up_res.text)
            return None
        sign_url = f"{SUPABASE_URL}/storage/v1/object/sign/{SUPABASE_STORAGE_BUCKET}/{object_name}"
        sig_headers = {
            'apikey': SUPABASE_KEY,
            'Authorization': f'Bearer {SUPABASE_KEY}',
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        }
        sig_res = requests.post(sign_url, headers=sig_headers, json={"expiresIn": expires_in})
        if not sig_res.ok:
            print('[worker] sign failed:', sig_res.status_code, sig_res.text)
            return None
        data = sig_res.json()
        signed_path = data.get('signedURL') or data.get('signedUrl')
        if not signed_path:
            return None
        return f"{SUPABASE_URL}{signed_path}" if signed_path.startswith('/') else signed_path
    except Exception as e:
        print('[worker] upload_and_sign error:', e)
        return None


def _generate_minimal_step_placeholder(name: str = 'part') -> bytes:
    """Return a minimal STEP-like file content placeholder.

    Not a valid CAD model, but sufficient to exercise storage/links.
    """
    content = (
        "ISO-10303-21;\n"
        f"/* Placeholder STEP for {name} */\n"
        "END-ISO-10303-21;\n"
    )
    return content.encode('utf-8')


def _run_cad_pipeline(description: str, options: Dict[str, Any]) -> tuple[bytes | None, bytes | None, Dict[str, Any]]:
    """Placeholder CAD pipeline.

    Returns STL bytes, STEP bytes, and derived metrics (e.g., volume_cm3).
    Uses a simple cube sized from options.size_cm (default 5 cm).
    """
    try:
        size_cm = float(options.get('size_cm', 5))
    except Exception:
        size_cm = 5.0
    stl = _generate_ascii_stl_cube_bytes(name='cad_cube', size=size_cm)
    step = _generate_minimal_step_placeholder(name='cad_cube')
    volume_cm3 = round(size_cm ** 3, 2)
    return stl, step, {
        'volume_cm3': volume_cm3,
        'bbox_cm': [size_cm, size_cm, size_cm],
    }


def _run_fem_pipeline(stl_bytes: bytes | None, options: Dict[str, Any]) -> Dict[str, Any]:
    """Placeholder FEM pipeline.

    Computes a pseudo safety_factor and deflection_mm using simple heuristics.
    """
    # Use deterministic-ish values bounded by typical ranges
    base_sf = 2.0 + (random() - 0.5) * 0.6  # ~1.7 .. 2.3
    deflection = 0.5 + random() * 1.0      # ~0.5 .. 1.5 mm
    # Optionally adjust by "steps" (more steps -> slightly better sf)
    try:
        if 'steps' in options:
            base_sf += min(0.5, float(options['steps']) / 200.0)
    except Exception:
        pass
    return {
        'safety_factor': round(base_sf, 2),
        'deflection_mm': round(deflection, 2),
    }
