import base64
from typing import Optional, Dict
import os
import requests
import io
import json
import hashlib

try:
    import torch
    from diffusers import (
        StableDiffusionPipeline,
        StableDiffusionControlNetPipeline,
        ControlNetModel,
    )
    from diffusers import DPMSolverMultistepScheduler
    _DIFFUSERS_AVAILABLE = True
except Exception:
    _DIFFUSERS_AVAILABLE = False

try:
    import cv2
    _CV2_AVAILABLE = True
except Exception:
    _CV2_AVAILABLE = False

try:
    from controlnet_aux import OpenposeDetector, HEDdetector
    _CONTROLNET_AUX = True
except Exception:
    _CONTROLNET_AUX = False

class DiffusionGenerator:
    """Flexible diffusion generator with optional ControlNet.

    Behavior:
    - Reads model names from env vars: `SD_MODEL` (default runwayml/stable-diffusion-v1-5)
    - If `CONTROLNET_MODEL` is set and controlnet input provided, attempts ControlNet pipeline
    - Falls back to a safe CPU stub if libraries/models are unavailable
    """

    # Class-level cache for loaded pipelines to avoid repeated from_pretrained calls
    _PIPELINE_CACHE: dict[str, object] = {}

    def __init__(self):
        self.sd_model = os.getenv('SD_MODEL', 'runwayml/stable-diffusion-v1-5')
        self.controlnet_model = os.getenv('CONTROLNET_MODEL')
        # Remote image model (Hugging Face) support: model name via env HF_IMAGE_MODEL
        self.hf_image_model = os.getenv('HF_IMAGE_MODEL')
        self._hf_image_disabled = False
        # Kept for backwards compatibility with the older REST forwarder.
        self.hf_api_base = os.getenv('HUGGINGFACE_API_BASE', 'https://api-inference.huggingface.co')
        # prefer torch.device when available
        if _DIFFUSERS_AVAILABLE:
            self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        else:
            self.device = 'cpu'

        self.pipe = None
        self.controlnet_pipe = None

        if _DIFFUSERS_AVAILABLE:
            try:
                # Load (or reuse cached) base pipeline with DPM solver scheduler for better performance
                if self.sd_model in self.__class__._PIPELINE_CACHE:
                    self.pipe = self.__class__._PIPELINE_CACHE[self.sd_model]
                else:
                    base_pipe = StableDiffusionPipeline.from_pretrained(self.sd_model)
                    base_pipe.scheduler = DPMSolverMultistepScheduler.from_config(base_pipe.scheduler.config)
                    base_pipe = base_pipe.to(self.device)
                    self.pipe = base_pipe
                    try:
                        self.__class__._PIPELINE_CACHE[self.sd_model] = base_pipe
                    except Exception:
                        pass
            except Exception:
                self.pipe = None

        # Attempt to load ControlNet pipeline if requested
        if self.controlnet_model and _DIFFUSERS_AVAILABLE:
            try:
                # Load ControlNet weights and compose pipeline
                cn = None
                try:
                    cn = ControlNetModel.from_pretrained(self.controlnet_model)
                except Exception:
                    cn = None
                if cn is not None:
                    try:
                        ctrl_pipe = StableDiffusionControlNetPipeline.from_pretrained(self.sd_model, controlnet=cn)
                        ctrl_pipe.scheduler = DPMSolverMultistepScheduler.from_config(ctrl_pipe.scheduler.config)
                        ctrl_pipe = ctrl_pipe.to(self.device)
                        self.controlnet_pipe = ctrl_pipe
                    except Exception:
                        self.controlnet_pipe = None
                else:
                    self.controlnet_pipe = None
            except Exception:
                self.controlnet_pipe = None
        else:
            # Support a lightweight mock ControlNet pipeline for CPU-only testing.
            # Enable by setting env `CONTROLNET_MOCK=1`.
            if os.getenv('CONTROLNET_MOCK') == '1':
                class _MockControlNetPipe:
                    def __call__(self, prompt=None, num_inference_steps=20, guidance_scale=7.5, control_image=None, height=512, width=512, generator=None):
                        # produce a simple RGB image merging prompt hash + control_image if present
                        try:
                            from PIL import Image, ImageDraw, ImageFont
                            import io
                            img = Image.new('RGB', (width, height), color=(50, 80, 140))
                            draw = ImageDraw.Draw(img)
                            # draw a faint grid or the control_image's presence
                            if control_image is not None:
                                try:
                                    ci = control_image.convert('RGB').resize((width, height))
                                    img.paste(ci, (0, 0), None)
                                except Exception:
                                    pass
                            # simple overlay text
                            try:
                                draw.text((8, 8), (prompt or '')[:64], fill=(255, 255, 255))
                            except Exception:
                                pass
                            class Out:
                                def __init__(self, images):
                                    self.images = images
                            return Out([img])
                        except Exception:
                            class Out:
                                def __init__(self, images):
                                    self.images = images
                            return Out([None])

                self.controlnet_pipe = _MockControlNetPipe()

    def _ensure_diffusers_loaded(self):
        """Attempt to import diffusers/torch at runtime and load pipelines lazily.

        This allows the running API process to pick up newly-installed packages
        without requiring a full restart. It's best-effort and will not raise
        if imports/models aren't available.
        """
        global _DIFFUSERS_AVAILABLE
        # If already marked available and pipe exists, nothing to do
        if _DIFFUSERS_AVAILABLE and (self.pipe is not None or self.controlnet_pipe is not None):
            return
        try:
            # Try importing required libraries
            import importlib
            torch_spec = importlib.import_module('torch')
            diffusers_mod = importlib.import_module('diffusers')
            from diffusers import StableDiffusionPipeline, StableDiffusionControlNetPipeline, ControlNetModel, DPMSolverMultistepScheduler
            _DIFFUSERS_AVAILABLE = True
            # update device
            try:
                self.device = torch_spec.device('cuda' if torch_spec.cuda.is_available() else 'cpu')
            except Exception:
                self.device = 'cpu'
            # Attempt to load base pipeline if not already present
            if self.pipe is None:
                try:
                    base_pipe = StableDiffusionPipeline.from_pretrained(self.sd_model)
                    base_pipe.scheduler = DPMSolverMultistepScheduler.from_config(base_pipe.scheduler.config)
                    base_pipe = base_pipe.to(self.device)
                    self.pipe = base_pipe
                    try:
                        self.__class__._PIPELINE_CACHE[self.sd_model] = base_pipe
                    except Exception:
                        pass
                except Exception:
                    self.pipe = None

            # Attempt to (re)load ControlNet if configured
            if self.controlnet_model and self.controlnet_pipe is None:
                try:
                    cn = None
                    try:
                        cn = ControlNetModel.from_pretrained(self.controlnet_model)
                    except Exception:
                        cn = None
                    if cn is not None:
                        try:
                            ctrl_pipe = StableDiffusionControlNetPipeline.from_pretrained(self.sd_model, controlnet=cn)
                            ctrl_pipe.scheduler = DPMSolverMultistepScheduler.from_config(ctrl_pipe.scheduler.config)
                            ctrl_pipe = ctrl_pipe.to(self.device)
                            self.controlnet_pipe = ctrl_pipe
                        except Exception:
                            self.controlnet_pipe = None
                except Exception:
                    self.controlnet_pipe = None
        except Exception:
            # leave _DIFFUSERS_AVAILABLE as-is (likely False)
            return



    def _preprocess_sketch(self, sketch_b64: str, target_size: int = 512) -> Optional[object]:
        """Decode a base64 PNG/JPEG sketch and return an edge map (Canny) compatible with ControlNet."""
        if not _CV2_AVAILABLE:
            return None
        import numpy as np
        from PIL import Image
        data = base64.b64decode(sketch_b64)
        arr = np.frombuffer(data, dtype=np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if img is None:
            return None
        # Resize to target square
        img = cv2.resize(img, (target_size, target_size))
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        edges = cv2.Canny(gray, 100, 200)
        # Convert to RGB PIL Image for ControlNet compatibility
        edges_rgb = cv2.cvtColor(edges, cv2.COLOR_GRAY2RGB)
        pil = Image.fromarray(edges_rgb)
        return pil

    def _upscale_image(self, pil_img, width: int, height: int, method: Optional[str] = None):
        """Upscale a PIL image to target size using Real-ESRGAN if available and enabled,
        otherwise fall back to PIL LANCZOS resize.

        Controlled by env `REAL_ESRGAN_ENABLED=1` or by passing method='realesrgan'.
        """
        try:
            use_realesrgan = (os.getenv('REAL_ESRGAN_ENABLED') == '1') or (method == 'realesrgan')
            if use_realesrgan:
                try:
                    from realesrgan import RealESRGAN
                    # select device
                    device = 'cuda' if _DIFFUSERS_AVAILABLE and torch.cuda.is_available() else 'cpu'
                    rr = RealESRGAN(device, scale=2)
                    # attempt to load common weight name; if not provided, library may auto-download
                    try:
                        rr.load_weights('RealESRGAN_x2plus.pth')
                    except Exception:
                        pass
                    src = pil_img.convert('RGB') if hasattr(pil_img, 'convert') else pil_img
                    up = rr.predict(src)
                    # ensure PIL Image
                    from PIL import Image as _PILImage
                    if not hasattr(up, 'save'):
                        import numpy as _np
                        up = _PILImage.fromarray(_np.asarray(up))
                    if up.size != (width, height):
                        return up.resize((width, height), resample=_PILImage.LANCZOS)
                    return up
                except Exception as e:
                    print(f"[diffusion] realesrgan_upscale_failed: {e}")
        except Exception:
            pass

        # Fallback to PIL high-quality resize
        try:
            from PIL import Image as _PILImage
            return pil_img.resize((width, height), resample=_PILImage.LANCZOS)
        except Exception:
            return pil_img

    def _generate_at_safe_size_and_upscale(self, pipeline, prompt, safe_size_w: int, safe_size_h: int, target_w: int, target_h: int, steps: int, guidance_scale: float, generator):
        """Generate at a safe smaller resolution and upscale to the target size.

        This is a best-effort fallback when the pipeline errors on large
        dimensions (tensor size mismatches). The safe generation uses the
        provided pipeline to produce an image at `safe_size_w`x`safe_size_h`,
        then upscales it to `target_w`x`target_h` using the existing
        `_upscale_image` helper.
        """
        try:
            out = pipeline(prompt, num_inference_steps=steps, guidance_scale=guidance_scale, height=safe_size_h, width=safe_size_w, generator=(generator if generator is not None else None))
            img = out.images[0]
            up_img = self._upscale_image(img, target_w, target_h)
            import io
            buf = io.BytesIO()
            up_img.save(buf, format='PNG')
            b64 = base64.b64encode(buf.getvalue()).decode()
            return {"image_b64": b64, "backend": "stable-diffusion-upscaled-fallback", "controlnet": False}
        except Exception as e:
            print(f"[diffusion] fallback_resize_generation_failed: {e}")
            return None

    def _hf_image_inference(self, prompt: str, model: Optional[str] = None, width: int = 512, height: int = 512, steps: int = 28, guidance_scale: float = 7.5, seed: Optional[int] = None, timeout: int = 120) -> Optional[Dict]:
        """Call Hugging Face Inference API for image generation and return base64 PNG result.

        This is a best-effort forwarder: many HF image models return raw image bytes
        when requested with Accept: application/octet-stream. We attempt to handle
        both binary and JSON (with base64) responses.
        """
        model = model or self.hf_image_model
        if not model:
            return None
        if getattr(self, '_hf_image_disabled', False):
            return None
        api_key = (os.getenv('HUGGINGFACE_API_KEY') or '').strip() or (os.getenv('HUGGINGFACE_HUB_TOKEN') or '').strip() or (os.getenv('HF_TOKEN') or '').strip()
        if not api_key:
            return None

        # Prefer the official HF client. We force `hf-inference` by default because:
        # - the legacy api-inference endpoint now returns 410
        # - provider auto-selection can fail depending on account/billing
        try:
            from huggingface_hub import InferenceClient  # type: ignore

            provider = (os.getenv('HF_IMAGE_PROVIDER') or 'hf-inference').strip() or 'hf-inference'
            client = InferenceClient(provider=provider, token=api_key, timeout=timeout)
            try:
                img = client.text_to_image(
                    prompt=prompt,
                    model=model,
                    width=width,
                    height=height,
                    num_inference_steps=steps,
                    guidance_scale=guidance_scale,
                    seed=seed,
                )
            except TypeError:
                # Some client versions/models don’t accept all params.
                img = client.text_to_image(prompt=prompt, model=model)

            buf = io.BytesIO()
            try:
                img.save(buf, format='PNG')
            except Exception:
                # Some clients return bytes already.
                raw = img if isinstance(img, (bytes, bytearray)) else None
                if not raw:
                    return None
                buf = io.BytesIO(raw)
            b64 = base64.b64encode(buf.getvalue()).decode()
            return {'image_b64': b64, 'backend': f'huggingface-{provider}', 'controlnet': False}
        except Exception as e:
            # Common causes:
            # - token missing inference permissions (401)
            # - model gated/private (401/403)
            # - provider not available for model
            msg = str(e) or 'hf inference failed'
            print(f"[diffusion] hf_router_failed: {msg}")
            # IMPORTANT: hf-inference can return 402 when you hit free-tier limits.
            # In that case, returning a stub image hides the real root cause.
            if '402' in msg or 'Payment Required' in msg or 'free monthly usage limit' in msg:
                return {
                    'image_b64': None,
                    'backend': f'huggingface-{(os.getenv("HF_IMAGE_PROVIDER") or "hf-inference").strip() or "hf-inference"}',
                    'controlnet': False,
                    'error': (
                        'Hugging Face hf-inference quota/credits limit reached (HTTP 402). '
                        'Add credits/upgrade on Hugging Face, or configure another real backend (e.g., a dedicated inference endpoint).'
                    ),
                    'error_kind': 'quota',
                }

        # Legacy REST forwarder (kept as a fallback only)
        primary_url = f"{self.hf_api_base}/models/{model}"
        fallback_url = f"https://api-inference.huggingface.co/models/{model}"
        headers = {
            'Authorization': f'Bearer {api_key}',
            'Accept': 'application/octet-stream',
        }
        payload = {
            'inputs': prompt,
            'options': {'wait_for_model': True},
            'parameters': {
                'width': width,
                'height': height,
                'num_inference_steps': steps,
                'guidance_scale': guidance_scale,
            },
        }
        try:

            def _to_png_b64(raw_bytes: bytes) -> Optional[str]:
                if not raw_bytes:
                    return None
                # Fast path: already PNG
                if raw_bytes[:8] == b"\x89PNG\r\n\x1a\n":
                    return base64.b64encode(raw_bytes).decode()
                # Reject SVG payloads (common from placeholder services)
                if raw_bytes.lstrip().startswith(b'<svg'):
                    return None
                # Best-effort convert raster image bytes to PNG
                try:
                    from PIL import Image as _PILImage

                    im = _PILImage.open(io.BytesIO(raw_bytes))
                    out = io.BytesIO()
                    im.convert('RGBA').save(out, format='PNG')
                    return base64.b64encode(out.getvalue()).decode()
                except Exception:
                    return None

            def _post(u: str):
                return requests.post(u, json=payload, headers=headers, timeout=timeout)

            resp = _post(primary_url)
            # HF Router base (https://router.huggingface.co) often does not support /models/* directly.
            # If it 404s, fall back to the standard Inference API endpoint.
            if resp.status_code == 404 and (self.hf_api_base or '').strip() and primary_url != fallback_url:
                resp = _post(fallback_url)
            # 410 indicates the model/endpoint is not available on this API. Disable further HF calls.
            if resp.status_code == 410:
                try:
                    self._hf_image_disabled = True
                except Exception:
                    pass
                return None
            resp.raise_for_status()
            content_type = resp.headers.get('Content-Type', '')
            # If binary image returned, encode to base64
            if content_type.startswith('image/') or content_type == 'application/octet-stream':
                # Reject SVG explicitly by header
                if content_type.lower().startswith('image/svg'):
                    return None
                img_bytes = resp.content
                b64 = _to_png_b64(img_bytes)
                if not b64:
                    return None
                return {'image_b64': b64, 'backend': 'huggingface-image', 'controlnet': False}
            # If JSON, try to extract base64 field or generated_image
            try:
                data = resp.json()
            except Exception:
                data = None
            if data is not None:
                # Common patterns: [{'generated_image': '<base64>'}] or {'generated_image': '...'}
                if isinstance(data, list) and len(data) > 0:
                    first = data[0]
                    if isinstance(first, dict):
                        for k in ('generated_image', 'image', 'b64_json', 'image_base64'):
                            if k in first and isinstance(first[k], str):
                                try:
                                    raw = first[k]
                                    if raw.startswith('data:'):
                                        raw = raw.split(',', 1)[1]
                                    img_bytes = base64.b64decode(raw)
                                    b64 = _to_png_b64(img_bytes)
                                    if not b64:
                                        return None
                                    return {'image_b64': b64, 'backend': 'huggingface-image', 'controlnet': False}
                                except Exception:
                                    return None
                if isinstance(data, dict):
                    for k in ('generated_image', 'image', 'b64_json', 'image_base64'):
                        if k in data and isinstance(data[k], str):
                            try:
                                raw = data[k]
                                if raw.startswith('data:'):
                                    raw = raw.split(',', 1)[1]
                                img_bytes = base64.b64decode(raw)
                                b64 = _to_png_b64(img_bytes)
                                if not b64:
                                    return None
                                return {'image_b64': b64, 'backend': 'huggingface-image', 'controlnet': False}
                            except Exception:
                                return None
                # Don't propagate JSON errors as fake images.
                return None
            # If we couldn't parse JSON, fall back to returning the raw bytes encoded
            img_bytes = resp.content
            try:
                b64 = _to_png_b64(img_bytes)
                if not b64:
                    return None
                return {'image_b64': b64, 'backend': 'huggingface-image-raw', 'controlnet': False}
            except Exception:
                return None
        except Exception as e:
            print(f"[diffusion] hf_image_inference_failed: {e}")
            return None

    def generate(self, prompt: str, sketch_b64: Optional[str] = None, controlnet: bool = False, steps: int = 28, guidance_scale: float = 7.5, seed: Optional[int] = None, width: int = 512, height: int = 512, upscale: bool = False, upscale_method: str | None = None, model: str | None = None, negative_prompt: Optional[str] = None) -> Dict:
        """Generate an image and return base64 PNG + metadata.

        If ControlNet is requested but not available, falls back gracefully.
        """
        # Ensure diffusers/torch are loaded at runtime if they became available
        try:
            self._ensure_diffusers_loaded()
        except Exception:
            pass
        # If ControlNet desired and available
        if controlnet and sketch_b64 and self.controlnet_pipe:
            try:
                # Preprocess sketch to edge map
                control_image = self._preprocess_sketch(sketch_b64)
                generator = torch.Generator(device=self.device)
                if seed is not None:
                    generator = generator.manual_seed(int(seed))

                out = self.controlnet_pipe(
                    prompt=prompt,
                    num_inference_steps=steps,
                    guidance_scale=guidance_scale,
                    control_image=control_image,
                    height=height,
                    width=width,
                    generator=(generator if seed is not None else None),
                    **({'negative_prompt': negative_prompt} if negative_prompt else {}),
                )
                image = out.images[0]
                # Optional CLIP aesthetic scoring
                clip_score = None
                try:
                    if os.getenv('CLIP_SCORING_ENABLED') == '1':
                        try:
                            from transformers import CLIPProcessor, CLIPModel
                            from PIL import Image as _PILImage
                            proc = CLIPProcessor.from_pretrained('openai/clip-vit-base-patch32')
                            cm = CLIPModel.from_pretrained('openai/clip-vit-base-patch32')
                            cm = cm.to(self.device) if hasattr(cm, 'to') else cm
                            pil_img = image.convert('RGB') if hasattr(image, 'convert') else image
                            inputs = proc(text=[prompt], images=pil_img, return_tensors='pt', padding=True)
                            # move tensors to device
                            for k, v in inputs.items():
                                try:
                                    inputs[k] = v.to(self.device)
                                except Exception:
                                    pass
                            with torch.no_grad():
                                img_emb = cm.get_image_features(**{k: inputs[k] for k in ['pixel_values'] if k in inputs})
                                txt_emb = cm.get_text_features(**{k: inputs[k] for k in ['input_ids','attention_mask'] if k in inputs})
                            # normalize and cosine
                            img_emb = img_emb / img_emb.norm(p=2, dim=-1, keepdim=True)
                            txt_emb = txt_emb / txt_emb.norm(p=2, dim=-1, keepdim=True)
                            sim = (img_emb @ txt_emb.T).squeeze().item()
                            clip_score = float((sim + 1.0) / 2.0)  # map [-1,1] -> [0,1]
                        except Exception as e:
                            print(f"[diffusion] clip_scoring_failed: {e}")
                except Exception:
                    clip_score = None
                buf = io.BytesIO()
                image.save(buf, format='PNG')
                b64 = base64.b64encode(buf.getvalue()).decode()
                return {"image_b64": b64, "backend": "stable-diffusion-controlnet", "controlnet": True, 'clip_score': clip_score}
            except Exception as e:
                # Fall through to other options
                print(f"[diffusion] controlnet generation failed: {e}")

        # Standard SD path, with optional two-pass upscaling.
        # IMPORTANT: local diffusers on CPU is extremely slow and makes the GUI look "empty".
        # We therefore gate local diffusers usage behind env flags and GPU availability.
        pipeline_for_request = self.pipe
        allow_local = os.getenv('LOCAL_DIFFUSERS_ENABLED') == '1'
        allow_cpu = os.getenv('LOCAL_DIFFUSERS_CPU') == '1'
        try:
            has_cuda = bool(_DIFFUSERS_AVAILABLE and hasattr(torch, 'cuda') and torch.cuda.is_available())
        except Exception:
            has_cuda = False
        if not allow_local or (not has_cuda and not allow_cpu):
            pipeline_for_request = None

        # If an HF image model is configured, prefer it for real-image generation (returns bytes)
        if self.hf_image_model and not controlnet:
            try:
                try:
                    hf_timeout = int(os.getenv('HF_IMAGE_TIMEOUT', '30'))
                except Exception:
                    hf_timeout = 30
                # Try primary model, then optional fallbacks.
                models_to_try: list[str] = []
                if model:
                    models_to_try.append(model)
                elif self.hf_image_model:
                    models_to_try.append(self.hf_image_model)
                fallbacks = (os.getenv('HF_IMAGE_MODEL_FALLBACKS') or '').strip()
                if fallbacks:
                    for m in fallbacks.split(','):
                        m = (m or '').strip()
                        if m and m not in models_to_try:
                            models_to_try.append(m)

                for m in models_to_try:
                    hf_res = self._hf_image_inference(
                        prompt,
                        model=m,
                        width=width,
                        height=height,
                        steps=steps,
                        guidance_scale=guidance_scale,
                        seed=seed,
                        timeout=hf_timeout,
                    )
                    if hf_res and hf_res.get('image_b64'):
                        return hf_res
            except Exception as e:
                print(f"[diffusion] hf_forwarder_failed: {e}")
        # Only attempt local model override when local diffusers are allowed.
        if model and _DIFFUSERS_AVAILABLE and pipeline_for_request is not None:
            try:
                # Attempt to load the requested model for this call (best-effort); do not replace cached pipeline
                pipeline_for_request = StableDiffusionPipeline.from_pretrained(model)
                pipeline_for_request.scheduler = DPMSolverMultistepScheduler.from_config(pipeline_for_request.scheduler.config)
                if self.device == 'cuda':
                    pipeline_for_request = pipeline_for_request.to('cuda')
                else:
                    pipeline_for_request = pipeline_for_request.to('cpu')
            except Exception:
                pipeline_for_request = self.pipe

        if pipeline_for_request:
            try:
                generator = torch.Generator(device=self.device)
                if seed is not None:
                    generator = generator.manual_seed(int(seed))

                # If upscale requested, generate a low-res image then upscale
                if upscale and (width > 128 and height > 128):
                    low_w = max(64, width // 2)
                    low_h = max(64, height // 2)
                    out_low = pipeline_for_request(
                        prompt,
                        num_inference_steps=max(8, steps//2),
                        guidance_scale=guidance_scale,
                        height=low_h,
                        width=low_w,
                        generator=(generator if seed is not None else None),
                        **({'negative_prompt': negative_prompt} if negative_prompt else {}),
                    )
                    low_img = out_low.images[0]

                    # Use the centralized upscaler helper (Real-ESRGAN if enabled otherwise PIL)
                    try:
                        up_img = self._upscale_image(low_img, width, height, method=upscale_method)
                    except Exception as e:
                        print(f"[diffusion] upscale_helper_failed: {e}")
                        try:
                            from PIL import Image as _PILImage
                            up_img = low_img.resize((width, height), resample=_PILImage.LANCZOS)
                        except Exception:
                            up_img = low_img

                    buf = io.BytesIO()
                    up_img.save(buf, format='PNG')
                    b64 = base64.b64encode(buf.getvalue()).decode()
                    return {"image_b64": b64, "backend": "stable-diffusion-upscaled", "controlnet": False}

                try:
                    out = pipeline_for_request(
                        prompt,
                        num_inference_steps=steps,
                        guidance_scale=guidance_scale,
                        height=height,
                        width=width,
                        generator=(generator if seed is not None else None),
                        **({'negative_prompt': negative_prompt} if negative_prompt else {}),
                    )
                    image = out.images[0]
                except Exception as e:
                    # Handle common tensor size mismatches when requested sizes differ
                    # from model training sizes. Retry by generating at a safe size
                    # (512) then upscaling to target resolution as a fallback.
                    msg = str(e) or ''
                    print(f"[diffusion] stable-diffusion generation failed: {e}")
                    if 'size of tensor' in msg or 'must match the size of tensor' in msg or 'The size of tensor' in msg:
                        try:
                            safe_w = 512 if max(width, height) > 512 else max(width, height)
                            safe_h = safe_w
                            print(f"[diffusion] attempting safe-size fallback: {safe_w}x{safe_h} -> {width}x{height}")
                            fallback = self._generate_at_safe_size_and_upscale(pipeline_for_request, prompt, safe_w, safe_h, width, height, steps, guidance_scale, (generator if seed is not None else None))
                            if fallback:
                                return fallback
                        except Exception as e2:
                            print(f"[diffusion] safe-size-fallback-exception: {e2}")
                    # re-raise to outer handler (will fall through to stub)
                    raise
                # Optional CLIP scoring for standard SD path
                clip_score = None
                try:
                    if os.getenv('CLIP_SCORING_ENABLED') == '1':
                        try:
                            from transformers import CLIPProcessor, CLIPModel
                            from PIL import Image as _PILImage
                            proc = CLIPProcessor.from_pretrained('openai/clip-vit-base-patch32')
                            cm = CLIPModel.from_pretrained('openai/clip-vit-base-patch32')
                            cm = cm.to(self.device) if hasattr(cm, 'to') else cm
                            pil_img = image.convert('RGB') if hasattr(image, 'convert') else image
                            inputs = proc(text=[prompt], images=pil_img, return_tensors='pt', padding=True)
                            for k, v in inputs.items():
                                try:
                                    inputs[k] = v.to(self.device)
                                except Exception:
                                    pass
                            with torch.no_grad():
                                img_emb = cm.get_image_features(**{k: inputs[k] for k in ['pixel_values'] if k in inputs})
                                txt_emb = cm.get_text_features(**{k: inputs[k] for k in ['input_ids','attention_mask'] if k in inputs})
                            img_emb = img_emb / img_emb.norm(p=2, dim=-1, keepdim=True)
                            txt_emb = txt_emb / txt_emb.norm(p=2, dim=-1, keepdim=True)
                            sim = (img_emb @ txt_emb.T).squeeze().item()
                            clip_score = float((sim + 1.0) / 2.0)
                        except Exception as e:
                            print(f"[diffusion] clip_scoring_failed: {e}")
                except Exception:
                    clip_score = None
                buf = io.BytesIO()
                image.save(buf, format='PNG')
                b64 = base64.b64encode(buf.getvalue()).decode()
                return {"image_b64": b64, "backend": "stable-diffusion", "controlnet": False, 'clip_score': clip_score}
            except Exception as e:
                print(f"[diffusion] stable-diffusion generation failed: {e}")

        # If no real backend succeeded, optionally refuse to return a stub image.
        require_real = (os.getenv('REQUIRE_REAL_IMAGES') or '').strip() in ('1', 'true', 'yes', 'on')
        if require_real:
            return {
                "image_b64": None,
                "backend": "unavailable",
                "controlnet": bool(controlnet),
                "error": (
                    "No real image backend available. Configure Hugging Face (HF_TOKEN + HF_IMAGE_MODEL) "
                    "or enable local diffusers (LOCAL_DIFFUSERS_ENABLED=1 and CUDA or LOCAL_DIFFUSERS_CPU=1)."
                ),
            }

        # If libraries not available or failure, return a deterministic stub (for testing/offline).
        # Avoid a single solid color (it makes the UI look broken).
        try:
            from PIL import Image, ImageDraw

            w = int(width or 512)
            h = int(height or 512)
            w = max(64, min(2048, w))
            h = max(64, min(2048, h))

            digest = hashlib.sha256((prompt or '').encode('utf-8')).digest()
            bg = (digest[0], digest[1], digest[2])
            accent = (digest[3], digest[4], digest[5])

            img = Image.new('RGB', (w, h), color=bg)
            draw = ImageDraw.Draw(img)

            bands = 6
            for i in range(bands):
                x0 = int((i / bands) * w)
                x1 = int(((i + 1) / bands) * w)
                c = (
                    (bg[0] * (bands - i) + accent[0] * i) // bands,
                    (bg[1] * (bands - i) + accent[1] * i) // bands,
                    (bg[2] * (bands - i) + accent[2] * i) // bands,
                )
                draw.rectangle([x0, 0, x1, h], fill=c)

            label = (prompt or '').strip().replace('\n', ' ')
            if len(label) > 80:
                label = label[:77] + '...'
            draw.rectangle([8, 8, min(w - 8, 760), 40], fill=(0, 0, 0))
            draw.text((14, 14), label or 'stub', fill=(255, 255, 255))

            buf = io.BytesIO()
            img.save(buf, format='PNG')
            b64 = base64.b64encode(buf.getvalue()).decode()
            return {"image_b64": b64, "backend": "stub", "controlnet": controlnet}
        except Exception:
            return {"image_b64": None, "backend": "none", "controlnet": controlnet}


diffusion_generator = DiffusionGenerator()

def controlnet_available() -> bool:
    """Return whether ControlNet is available for conditioning.

    This returns True when a real ControlNet pipeline was loaded or when
    the test mock is enabled via `CONTROLNET_MOCK=1`.
    """
    try:
        if os.getenv('CONTROLNET_MOCK') == '1':
            return True
        # check the singleton generator
        return getattr(diffusion_generator, 'controlnet_pipe', None) is not None
    except Exception:
        return False
