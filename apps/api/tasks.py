"""Celery task definitions for asynchronous run processing.

This module wires the existing synchronous `process_run` logic from `worker.py`
into a Celery task so we can execute heavier pipelines (LLM, diffusion, CAD, FEM)
outside the FastAPI request lifecycle.

Environment variables:
- CELERY_BROKER_URL (default: redis://localhost:6379/0)
- CELERY_BACKEND_URL (default: redis://localhost:6379/0)
- CELERY_QUEUE (default: runs)
- CELERY_ENABLED=1 to make the API enqueue tasks instead of BackgroundTasks.

To start a local Redis broker (PowerShell):
  docker run -p 6379:6379 redis:7-alpine

To start a Celery worker (PowerShell):
  $env:CELERY_BROKER_URL="redis://localhost:6379/0"; `
  $env:CELERY_BACKEND_URL="redis://localhost:6379/0"; `
  celery -A tasks.celery_app worker -l info -Q runs

To run the API (PowerShell):
  uvicorn main:app --reload --port 8000
"""
from __future__ import annotations

import os
from celery import Celery


# Resolve _upload_and_sign from worker module in a way that works both when
# running as a package and when executing modules directly (tests/smoke runners).
def _resolve_uploader():
    try:
        from .worker import _upload_and_sign  # type: ignore
        return _upload_and_sign
    except Exception:
        try:
            from worker import _upload_and_sign  # type: ignore
            return _upload_and_sign
        except Exception:
            # fallback noop uploader
            def _noop_upload(name, data, content_type='application/octet-stream', expires_in: int = 3600):
                return None
            return _noop_upload

# module-level uploader used by tasks
_upload_and_sign = _resolve_uploader()

BROKER_URL = os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/0")
BACKEND_URL = os.getenv("CELERY_BACKEND_URL", BROKER_URL)
QUEUE_NAME = os.getenv("CELERY_QUEUE", "runs")

celery_app = Celery("makerkit", broker=BROKER_URL, backend=BACKEND_URL)
celery_app.conf.task_default_queue = QUEUE_NAME
celery_app.conf.task_routes = {
    "process_run_task": {"queue": QUEUE_NAME},
    "fem_solve_task": {"queue": "compute"},
    "topopt_task": {"queue": "compute"},
    "diffusion_task": {"queue": "gpu"},
    "pdf_report_task": {"queue": "io"},
}

# Additional configuration for production
celery_app.conf.update(
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone='UTC',
    enable_utc=True,
    task_track_started=True,
    task_time_limit=3600,  # 1 hour hard limit
    task_soft_time_limit=3300,  # 55 minutes soft limit
    worker_prefetch_multiplier=1,
    worker_max_tasks_per_child=100,
)

@celery_app.task(name="process_run_task")
def process_run_task(run_id: str, project_id: str) -> dict:
    """Celery wrapper around the synchronous `process_run` function.

    Returns a small status dict so callers can introspect or chain tasks.
    """
    try:
        from .worker import process_run  # relative import when package
    except Exception:
        from worker import process_run   # fallback when executed directly

    process_run(run_id, project_id)
    return {"run_id": run_id, "project_id": project_id, "status": "completed"}


@celery_app.task(name="fem_solve_task", bind=True)
def fem_solve_task(self, job_id: str, mesh_config: dict, boundary_conditions: dict, material_properties: dict) -> dict:
    """Run FEM simulation asynchronously and persist results/artifacts.

    Args:
        job_id: fem_jobs.job_id created by API when submitting
        mesh_config, boundary_conditions, material_properties: dicts with solver params
    """
    try:
        try:
            from .fem_solver_general import solve_rect_plate
        except Exception:
            from fem_solver_general import solve_rect_plate

        self.update_state(state='PROCESSING', meta={'job_id': job_id, 'stage': 'meshing'})

        # Run solver (map to expected params)
        result = solve_rect_plate(
            length=mesh_config.get('length', 100),
            width=mesh_config.get('width', 100),
            thickness=mesh_config.get('thickness', 5),
            load=boundary_conditions.get('load', 1000),
            youngs_modulus=material_properties.get('youngs_modulus', 200),
            poisson_ratio=material_properties.get('poisson_ratio', 0.3)
        )

        # Prepare artifact (simple JSON summary) and upload
        try:
            import json, tempfile, os, uuid, requests

            summary = {
                'job_id': job_id,
                'result': result,
            }
            summary_bytes = json.dumps(summary).encode('utf-8')
            filename = f"fem/{job_id}/{uuid.uuid4().hex[:10]}-summary.json"
            signed = _upload_and_sign(filename, summary_bytes, content_type='application/json')

            # Generate a stress visualization (use solver-provided raster if available), colorize and upload PNG + WebP variants
            try:
                import base64, io, numpy as _np
                from PIL import Image
                # Prefer a numeric stress array if provided by the solver
                stress_array = result.get('stress_array')
                stress_shape = result.get('stress_shape')
                arr = None
                if stress_array is not None:
                    try:
                        arr = _np.array(stress_array)
                        # If shape metadata provided, reshape accordingly
                        if stress_shape and len(stress_shape) == 2:
                            arr = arr.reshape((int(stress_shape[0]), int(stress_shape[1])))
                        # normalize to 0-255 uint8
                        arr = ((arr - arr.min()) / (_np.ptp(arr) + 1e-9) * 255).astype('uint8')
                    except Exception:
                        arr = None

                # If no numeric array, try b64 raster from solver
                if arr is None:
                    stress_b64 = result.get('stress_image_b64')
                    if stress_b64:
                        try:
                            raw = base64.b64decode(stress_b64)
                            buf_in = io.BytesIO(raw)
                            img_in = Image.open(buf_in).convert('L')
                            arr = _np.array(img_in)
                        except Exception:
                            arr = None

                # If still no solver-provided raster, synthesize a field similar to before
                if arr is None:
                    x = _np.linspace(0, 1, 256)
                    y = _np.linspace(0, 1, 128)
                    xv, yv = _np.meshgrid(x, y)
                    arr = (_np.sin(xv * _np.pi) * _np.cos(yv * _np.pi))
                    arr = ((arr - arr.min()) / (_np.ptp(arr) + 1e-9) * 255).astype('uint8')

                # Try to colorize via matplotlib if available and attach a small colorbar
                try:
                    import matplotlib
                    matplotlib.use('Agg')
                    import matplotlib.pyplot as plt
                    cmap = plt.get_cmap('viridis')
                    normed = (arr - arr.min()) / (_np.ptp(arr) + 1e-9)
                    rgba = cmap(normed)
                    rgba_img = (_np.clip(rgba * 255, 0, 255)).astype('uint8')
                    pil_img = Image.fromarray(rgba_img)

                    # Render a vertical colorbar using matplotlib and append it to the right
                    try:
                        fig = plt.figure(figsize=(1.2, 4), dpi=100)
                        ax = fig.add_axes([0.05, 0.05, 0.3, 0.9])
                        mappable = ax.imshow(normed, cmap=cmap)
                        ax.set_axis_off()
                        cax = fig.add_axes([0.45, 0.05, 0.12, 0.9])
                        plt.colorbar(mappable, cax=cax)
                        buf_cb = io.BytesIO()
                        fig.savefig(buf_cb, format='PNG', bbox_inches='tight', pad_inches=0.02)
                        plt.close(fig)
                        buf_cb.seek(0)
                        cb_img = Image.open(buf_cb).convert('RGBA')

                        # Resize colorbar to match height of image
                        cb_resized = cb_img.resize((int(cb_img.width * pil_img.height / cb_img.height), pil_img.height))
                        # Create combined image
                        combined = Image.new('RGBA', (pil_img.width + cb_resized.width, max(pil_img.height, cb_resized.height)), (255, 255, 255, 255))
                        combined.paste(pil_img.convert('RGBA'), (0, 0))
                        combined.paste(cb_resized, (pil_img.width, 0), mask=cb_resized)
                        pil_img = combined.convert('RGBA')
                    except Exception:
                        # If colorbar generation fails, keep the colored image
                        pil_img = pil_img.convert('RGBA')
                except Exception:
                    # fallback grayscale->RGB
                    pil_img = Image.fromarray(_np.stack([arr, arr, arr], axis=-1).astype('uint8')).convert('RGBA')

                # Save main PNG
                buf = io.BytesIO()
                pil_img.save(buf, format='PNG')
                png_bytes = buf.getvalue()
                png_name = f"fem/{job_id}/{uuid.uuid4().hex[:10]}-stress.png"
                signed_png = _upload_and_sign(png_name, png_bytes, content_type='image/png')

                # Save WebP (smaller) and thumbnail
                webp_buf = io.BytesIO()
                try:
                    pil_img.save(webp_buf, format='WEBP', quality=80)
                    webp_bytes = webp_buf.getvalue()
                    webp_name = f"fem/{job_id}/{uuid.uuid4().hex[:10]}-stress.webp"
                    signed_webp = _upload_and_sign(webp_name, webp_bytes, content_type='image/webp')
                except Exception:
                    signed_webp = None

                try:
                    thumb = pil_img.copy()
                    thumb.thumbnail((256, 256))
                    tbuf = io.BytesIO()
                    thumb.save(tbuf, format='PNG')
                    thumb_bytes = tbuf.getvalue()
                    thumb_name = f"fem/{job_id}/{uuid.uuid4().hex[:10]}-stress-thumb.png"
                    signed_thumb = _upload_and_sign(thumb_name, thumb_bytes, content_type='image/png')
                except Exception:
                    signed_thumb = None

                # Also produce a larger 512px thumbnail for richer previews
                try:
                    thumb512 = pil_img.copy()
                    thumb512.thumbnail((512, 512))
                    tbuf2 = io.BytesIO()
                    thumb512.save(tbuf2, format='PNG')
                    thumb512_bytes = tbuf2.getvalue()
                    thumb512_name = f"fem/{job_id}/{uuid.uuid4().hex[:10]}-stress-thumb-512.png"
                    signed_thumb_512 = _upload_and_sign(thumb512_name, thumb512_bytes, content_type='image/png')
                except Exception:
                    signed_thumb_512 = None

                png_url = signed_png
            except Exception as e:
                print(f"[celery] stress_map_generate_failed: {e}")
                png_url = None

            # Update fem_jobs record in Supabase if configured
            SUPABASE_URL = os.getenv('SUPABASE_URL')
            SUPABASE_KEY = os.getenv('SUPABASE_KEY')
            if SUPABASE_URL and SUPABASE_KEY:
                headers = {
                    'apikey': SUPABASE_KEY,
                    'Authorization': f'Bearer {SUPABASE_KEY}',
                    'Content-Type': 'application/json',
                    'Prefer': 'return=representation'
                }
                payload = {
                    'status': 'completed',
                    'result': result,
                    'output_url': signed,
                    'stress_map_url': png_url,
                }
                try:
                    r = requests.patch(f"{SUPABASE_URL}/rest/v1/fem_jobs?job_id=eq.{job_id}", headers=headers, json=payload, timeout=10)
                    if not r.ok:
                        print(f"[celery] fem_jobs_update_failed: {r.status_code} {r.text}")
                except Exception as e:
                    print(f"[celery] fem_jobs_update_error: {e}")
            else:
                # In-memory fallback
                try:
                    FEM_JOBS = globals().get('FEM_JOBS') or {}
                    FEM_JOBS[job_id] = FEM_JOBS.get(job_id, {})
                    FEM_JOBS[job_id].update({'status': 'completed', 'result': result, 'output_url': signed, 'stress_map_url': png_url})
                    globals()['FEM_JOBS'] = FEM_JOBS
                except Exception:
                    pass
        except Exception as e:
            print(f"[celery] fem_artifact_upload_failed: {e}")

        return {'status': 'completed', 'job_id': job_id, 'result': result, 'output_url': signed if 'signed' in locals() else None}
    except Exception as e:
        print(f"[celery] fem_solve_task failed: {e}")
        # Attempt to mark job failed
        try:
            import requests, os
            SUPABASE_URL = os.getenv('SUPABASE_URL')
            SUPABASE_KEY = os.getenv('SUPABASE_KEY')
            if SUPABASE_URL and SUPABASE_KEY:
                headers = {
                    'apikey': SUPABASE_KEY,
                    'Authorization': f'Bearer {SUPABASE_KEY}',
                    'Content-Type': 'application/json',
                    'Prefer': 'return=representation'
                }
                payload = {'status': 'failed', 'error': str(e)}
                try:
                    requests.patch(f"{SUPABASE_URL}/rest/v1/fem_jobs?job_id=eq.{job_id}", headers=headers, json=payload, timeout=5)
                except Exception:
                    pass
        except Exception:
            pass
        raise


@celery_app.task(name="topopt_task", bind=True, time_limit=7200)
def topopt_task(self, run_id: str, design_space: dict, volume_fraction: float, convergence_tol: float = 0.01) -> dict:
    """Run topology optimization asynchronously."""
    try:
        try:
            from .topopt_compliance_advanced import run_topopt_compliance_advanced
        except Exception:
            from topopt_compliance_advanced import run_topopt_compliance_advanced
        
        self.update_state(state='PROCESSING', meta={'run_id': run_id, 'iteration': 0})
        
        # Call the topopt solver with flexible parameter mapping to support different implementations
        try:
            import inspect
            sig = inspect.signature(run_topopt_compliance_advanced)
            params = sig.parameters
            kwargs = {}
            # mesh dimensions
            if 'nelx' in params:
                kwargs['nelx'] = design_space.get('nelx', 60)
            elif 'width' in params:
                kwargs['width'] = design_space.get('width', design_space.get('nelx', 60))
            if 'nely' in params:
                kwargs['nely'] = design_space.get('nely', 40)
            elif 'height' in params:
                kwargs['height'] = design_space.get('height', design_space.get('nely', 40))

            # volume fraction
            if 'volfrac' in params:
                kwargs['volfrac'] = volume_fraction
            elif 'vol_frac' in params:
                kwargs['vol_frac'] = volume_fraction

            # iterations / penal
            if 'penal' in params:
                kwargs['penal'] = design_space.get('penal', 3.0)
            if 'rmin' in params and 'rmin' in design_space:
                kwargs['rmin'] = design_space.get('rmin', 1.5)
            if 'max_iter' in params:
                kwargs['max_iter'] = design_space.get('max_iter', 100)
            if 'iters' in params:
                kwargs['iters'] = design_space.get('max_iter', 100)

            result = run_topopt_compliance_advanced(**kwargs)
        except Exception:
            # Fallback to a simple call with defaults if introspection fails
            result = run_topopt_compliance_advanced()

        # Attempt to export CAD/STL artifacts for the TopOpt result and upload them
        signed_stl = None
        signed_step = None
        try:
            try:
                from .cad_export import generate_cad_files
            except Exception:
                try:
                    from cad_export import generate_cad_files
                except Exception:
                    generate_cad_files = None

            if generate_cad_files:
                # generate bytes for step and stl
                try:
                    step_bytes, stl_bytes = generate_cad_files(result)
                except Exception:
                    step_bytes = f"TOPOPT-STEP-{result.get('topopt_id','')}".encode()
                    stl_bytes = f"TOPOPT-STL-{result.get('topopt_id','')}".encode()
            else:
                # Fallback to a simple stub STL text if cad exporter missing
                try:
                    from .cad_stub import generate_cad_variant
                except Exception:
                    from cad_stub import generate_cad_variant
                cad_info = generate_cad_variant({'width_mm': 60, 'height_mm': 40, 'depth_mm': 10})
                stl_bytes = cad_info.get('stl_text','').encode()
                step_bytes = f"STEP-STUB-{result.get('topopt_id','')}".encode()

            # Upload artifacts
            import uuid
            if stl_bytes:
                stl_name = f"topopt/{result.get('topopt_id','unknown')}/{uuid.uuid4().hex[:10]}-result.stl"
                try:
                    signed_stl = _upload_and_sign(stl_name, stl_bytes, content_type='application/sla')
                except Exception:
                    signed_stl = None
            if step_bytes:
                step_name = f"topopt/{result.get('topopt_id','unknown')}/{uuid.uuid4().hex[:10]}-result.step"
                try:
                    signed_step = _upload_and_sign(step_name, step_bytes, content_type='application/step')
                except Exception:
                    signed_step = None
        except Exception as e:
            print(f"[celery] topopt_artifact_upload_failed: {e}")

        # Persist topopt job status to Supabase if configured, otherwise keep in-memory
        try:
            import requests, os
            SUPABASE_URL = os.getenv('SUPABASE_URL')
            SUPABASE_KEY = os.getenv('SUPABASE_KEY')
            if SUPABASE_URL and SUPABASE_KEY:
                headers = {
                    'apikey': SUPABASE_KEY,
                    'Authorization': f'Bearer {SUPABASE_KEY}',
                    'Content-Type': 'application/json',
                    'Prefer': 'return=representation'
                }
                payload = {
                    'status': 'completed',
                    'result': result,
                    'stl_url': signed_stl,
                    'step_url': signed_step,
                }
                try:
                    r = requests.patch(f"{SUPABASE_URL}/rest/v1/topopt_jobs?run_id=eq.{run_id}", headers=headers, json=payload, timeout=10)
                    if not r.ok:
                        print(f"[celery] topopt_update_failed: {r.status_code} {r.text}")
                except Exception as e:
                    print(f"[celery] topopt_update_error: {e}")
            else:
                TOPOPT_JOBS = globals().get('TOPOPT_JOBS') or {}
                TOPOPT_JOBS[result.get('topopt_id','unknown')] = {'status': 'completed', 'result': result, 'stl_url': signed_stl, 'step_url': signed_step}
                globals()['TOPOPT_JOBS'] = TOPOPT_JOBS
        except Exception:
            pass

        return {'status': 'completed', 'run_id': run_id, 'result': result, 'stl_url': signed_stl, 'step_url': signed_step}
    except Exception as e:
        print(f"[celery] topopt_task failed: {e}")
        raise


@celery_app.task(name="diffusion_task", bind=True)
def diffusion_task(self, prompt: str, run_id: str, variant_id: str, controlnet: bool = False, sketch_b64: str | None = None, steps: int = 50, guidance_scale: float = 7.5, seed: int | None = None, model: str | None = None) -> dict:
    """Generate image via diffusion model asynchronously.

    Accepts optional `controlnet` and `sketch_b64` for conditioning. Returns the base64 PNG in the result for immediate storage by caller.
    """
    try:
        try:
            from .diffusion_pipeline import diffusion_generator
        except Exception:
            from diffusion_pipeline import diffusion_generator

        self.update_state(state='PROCESSING', meta={'variant_id': variant_id, 'step': 0, 'total_steps': steps})

        # Publish a quick low-res preview early (best-effort) to support progressive streaming
        try:
            try:
                from .diffusion_pipeline import diffusion_generator
            except Exception:
                from diffusion_pipeline import diffusion_generator
            preview_steps = max(4, min(8, int(steps)//4))
            preview = diffusion_generator.generate(prompt=prompt, sketch_b64=sketch_b64, controlnet=bool(controlnet), steps=preview_steps, guidance_scale=guidance_scale, seed=seed, width=128, height=128, model=model)
            # publish preview to redis channel
            try:
                import redis, json, os
                REDIS_URL = os.getenv('REDIS_URL')
                if REDIS_URL:
                    r = redis.Redis.from_url(REDIS_URL)
                    channel = f"diffusion:{variant_id}"
                    payload = {'type': 'preview', 'image_b64': preview.get('image_b64'), 'backend': preview.get('backend')}
                    r.publish(channel, json.dumps(payload))
            except Exception:
                pass
        except Exception:
            preview = None

        result = diffusion_generator.generate(
            prompt=prompt,
            sketch_b64=sketch_b64,
            controlnet=bool(controlnet),
            steps=int(steps or 50),
            guidance_scale=float(guidance_scale or 7.5),
            seed=seed,
            model=model,
        )

        image_b64 = result.get('image_b64')
        uploaded_url = None
        filename = None
        size_bytes = None
        mlflow_run_id = None

        if image_b64:
            try:
                import base64, uuid, os, requests, tempfile

                img_bytes = base64.b64decode(image_b64)
                size_bytes = len(img_bytes)
                filename = f"variants/{variant_id}/{uuid.uuid4().hex[:12]}.png"
                signed = _upload_and_sign(filename, img_bytes, content_type='image/png')
                if signed:
                    uploaded_url = signed

                    # Record variant_asset in Supabase if configured
                    SUPABASE_URL = os.getenv('SUPABASE_URL')
                    SUPABASE_KEY = os.getenv('SUPABASE_KEY')
                    if SUPABASE_URL and SUPABASE_KEY:
                        headers = {
                            'apikey': SUPABASE_KEY,
                            'Authorization': f'Bearer {SUPABASE_KEY}',
                            'Content-Type': 'application/json',
                            'Prefer': 'return=representation'
                        }
                        payload = {
                            'variant_id': variant_id,
                            'asset_type': 'image/png',
                            'url': uploaded_url,
                            'filename': filename,
                            'size_bytes': size_bytes,
                        }
                        try:
                            r = requests.post(f"{SUPABASE_URL}/rest/v1/variant_assets", headers=headers, json=payload, timeout=10)
                            if not r.ok:
                                print(f"[celery] variant_assets insert failed: {r.status_code} {r.text}")
                        except Exception as e:
                            print(f"[celery] variant_assets_insert_error: {e}")
                        # Publish final image event to redis channel
                        try:
                            import redis, json, os
                            REDIS_URL = os.getenv('REDIS_URL')
                            if REDIS_URL:
                                r = redis.Redis.from_url(REDIS_URL)
                                channel = f"diffusion:{variant_id}"
                                payload = {'type': 'final', 'image_b64': image_b64, 'backend': result.get('backend'), 'signed_url': uploaded_url}
                                r.publish(channel, json.dumps(payload))
                        except Exception:
                            pass
                        # If CLIP scoring present, update the variant row with aesthetic score
                        clip_score = result.get('clip_score')
                        if clip_score is not None:
                            try:
                                var_payload = {'aesthetic_score': float(clip_score)}
                                try:
                                    r2 = requests.patch(f"{SUPABASE_URL}/rest/v1/variants?variant_id=eq.{variant_id}", headers=headers, json=var_payload, timeout=10)
                                    if not r2.ok:
                                        print(f"[celery] variant_update_failed: {r2.status_code} {r2.text}")
                                except Exception as e:
                                    print(f"[celery] variant_update_error: {e}")
                            except Exception:
                                pass

                # MLflow logging (best-effort)
                try:
                    import mlflow
                    mlflow_tracking = os.getenv('MLFLOW_TRACKING_URI')
                    if mlflow_tracking:
                        mlflow.set_tracking_uri(mlflow_tracking)
                    experiment = os.getenv('MLFLOW_EXPERIMENT', 'makerkit-diffusion')
                    mlflow.set_experiment(experiment)
                    with tempfile.TemporaryDirectory() as td:
                        img_path = os.path.join(td, 'image.png')
                        with open(img_path, 'wb') as f:
                            f.write(img_bytes)
                        with mlflow.start_run() as run:
                            mlflow.log_param('prompt', prompt)
                            mlflow.log_param('variant_id', variant_id)
                            mlflow.log_param('run_id', run_id)
                            mlflow.log_param('controlnet', bool(controlnet))
                            mlflow.log_param('steps', int(steps))
                            if seed is not None:
                                mlflow.log_param('seed', int(seed))
                            if model:
                                mlflow.log_param('model', model)
                            mlflow.log_artifact(img_path, artifact_path='images')
                            mlflow_run_id = run.info.run_id
                except Exception as e:
                    print(f"[celery] mlflow_log_failed: {e}")
            except Exception as e:
                print(f"[celery] diffusion_persist_failed: {e}")

        return {
            'status': 'completed',
            'variant_id': variant_id,
            'prompt': prompt,
            'steps': steps,
            'seed': seed,
            'image_b64': image_b64,
            'backend': result.get('backend'),
            'signed_url': uploaded_url,
            'filename': filename,
            'size_bytes': size_bytes,
            'mlflow_run_id': mlflow_run_id,
            'clip_score': result.get('clip_score')
        }
    except Exception as e:
        print(f"[celery] diffusion_task failed: {e}")
        raise


@celery_app.task(name="pdf_report_task", bind=True)
def pdf_report_task(self, run_id: str, variant_id: str, language: str = 'en') -> dict:
    """Generate PDF report asynchronously."""
    try:
        try:
            from .pdf_report_generator import generate_pdf_report
        except Exception:
            from pdf_report_generator import generate_pdf_report
        
        import requests
        
        self.update_state(state='PROCESSING', meta={'variant_id': variant_id, 'stage': 'fetching_data'})
        
        SUPABASE_URL = os.getenv('SUPABASE_URL')
        SUPABASE_KEY = os.getenv('SUPABASE_KEY')
        
        if not SUPABASE_URL:
            raise Exception("SUPABASE_URL not configured")
        
        headers = {
            'apikey': SUPABASE_KEY,
            'Authorization': f'Bearer {SUPABASE_KEY}',
            'Content-Type': 'application/json',
        }
        
        # Fetch variant
        variant_resp = requests.get(f"{SUPABASE_URL}/rest/v1/variants?variant_id=eq.{variant_id}&select=*", headers=headers)
        variant_resp.raise_for_status()
        variants = variant_resp.json()
        if not variants:
            raise Exception(f"Variant {variant_id} not found")
        variant = variants[0]
        
        # Fetch DfX summary
        dfx_resp = requests.get(f"{SUPABASE_URL}/rest/v1/dfx_summaries?variant_id=eq.{variant_id}&select=*", headers=headers)
        dfx_summary = dfx_resp.json()[0] if dfx_resp.ok and dfx_resp.json() else {}
        
        feedback_history = []
        weights_history = []
        
        self.update_state(state='PROCESSING', meta={'variant_id': variant_id, 'stage': 'generating_pdf'})
        
        metrics = {
            'fabricability_score': variant.get('fabricability_score', 0),
            'assemblability_score': variant.get('assemblability_score', 0),
            'sustainability_score': variant.get('sustainability_score', 0),
            'aesthetic_score': variant.get('aesthetic_score', 0),
            'overall_score': variant.get('overall_score', 0),
            'support_volume_ratio': dfx_summary.get('support_volume_ratio', 0),
            'build_time_minutes': dfx_summary.get('build_time_minutes', 0),
            'part_count': dfx_summary.get('part_count', 1),
            'mass_kg': dfx_summary.get('mass_kg', 0),
            'max_von_mises_mpa': dfx_summary.get('max_von_mises_mpa', 0),
            'max_deflection_mm': dfx_summary.get('max_deflection_mm', 0),
            'safety_factor': dfx_summary.get('safety_factor'),
            'smoothness_score': dfx_summary.get('smoothness_score', 5.0)
        }
        
        pdf_bytes = generate_pdf_report(
            run_id=run_id,
            variant_id=variant_id,
            variant_data=variant,
            dfx_summary=dfx_summary,
            metrics=metrics,
            feedback_history=feedback_history,
            weights_history=weights_history,
            images=[],
            language=language
        )
        
        return {'status': 'completed', 'run_id': run_id, 'variant_id': variant_id, 'pdf_size_bytes': len(pdf_bytes), 'language': language}
    except Exception as e:
        print(f"[celery] pdf_report_task failed: {e}")
        raise

