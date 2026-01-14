import os, io, base64, uuid, logging
from dotenv import load_dotenv
load_dotenv()

# Force logging to show warnings and errors in console
logging.basicConfig(level=logging.INFO)
log = logging.getLogger('diffusion')
log.setLevel(logging.INFO)
from typing import Optional
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi import Request
from pydantic import BaseModel
from PIL import Image, ImageDraw, ImageFont

logging.basicConfig(level=logging.INFO)
log = logging.getLogger('diffusion')
log.setLevel(logging.INFO)

app = FastAPI(title="Diffusion Microservice (stub)")

class Text2ImageRequest(BaseModel):
    prompt: str
    width: Optional[int] = 512
    height: Optional[int] = 384
    seed: Optional[int] = None
    save_to_supabase: Optional[bool] = False

class Sketch2ImageRequest(BaseModel):
    prompt: Optional[str] = None
    sketch_b64: str
    width: Optional[int] = 512
    height: Optional[int] = 384
    guidance_scale: Optional[float] = 7.5
    steps: Optional[int] = 25

_DEF_COLOR = (235, 240, 250)

@app.get('/health')
def health():
    return {"status":"ok"}

_txt_pipeline = None
_controlnet_pipeline = None
_backend_init_attempted = False

def _init_pipelines():
    global _txt_pipeline, _controlnet_pipeline, _backend_init_attempted
    if _backend_init_attempted:
        return
    _backend_init_attempted = True
    backend = os.getenv('DIFFUSION_BACKEND') or 'stub'
    if backend != 'diffusers':
        log.info('diffusion_backend=stub')
        log.warning(f"DIFFUSION_BACKEND is not 'diffusers' (value: {backend}), falling back to stub.")
        return
    model_id = os.getenv('DIFFUSION_MODEL', 'stabilityai/stable-diffusion-2-1')
    # if a huggingface token exists in environment, pass it to the hub via env
    hf_token = os.getenv('HUGGINGFACE_HUB_TOKEN')
    if hf_token:
        os.environ['HUGGINGFACE_HUB_TOKEN'] = hf_token
    controlnet_id = os.getenv('CONTROLNET_MODEL')  # e.g. lllyasviel/sd-controlnet-canny
    try:
        import diffusers  # Correction: assure que le module est défini
        from diffusers import StableDiffusionPipeline  # type: ignore
        import torch  # type: ignore
        _txt_pipeline = StableDiffusionPipeline.from_pretrained(model_id, torch_dtype=torch.float16 if torch.cuda.is_available() else torch.float32)
        if torch.cuda.is_available():
            _txt_pipeline = _txt_pipeline.to('cuda')
        log.info(f'sd_pipeline_loaded model={model_id}')
        if controlnet_id:
            try:
                from diffusers import ControlNetModel, StableDiffusionControlNetPipeline  # type: ignore
                cn = ControlNetModel.from_pretrained(controlnet_id, torch_dtype=torch.float16 if torch.cuda.is_available() else torch.float32)
                _controlnet_pipeline = StableDiffusionControlNetPipeline.from_pretrained(model_id, controlnet=cn, torch_dtype=torch.float16 if torch.cuda.is_available() else torch.float32)
                if torch.cuda.is_available():
                    _controlnet_pipeline = _controlnet_pipeline.to('cuda')
                log.info(f'controlnet_pipeline_loaded model={controlnet_id}')
            except Exception as e:
                log.warning(f'controlnet_load_failed error={e}')
    except Exception as e:
        log.error(f'diffusers_init_failed backend_fallback=stub error={e}')

def _png_b64(img: Image.Image) -> str:
    buf = io.BytesIO(); img.save(buf, format='PNG'); return base64.b64encode(buf.getvalue()).decode('utf-8')


def _upload_to_supabase(img_bytes: bytes, filename: str) -> Optional[str]:
    """Upload bytes to Supabase storage if configured. Returns public URL or None."""
    try:
        supa_url = os.getenv('SUPABASE_URL')
        supa_key = os.getenv('SUPABASE_KEY')
        bucket = os.getenv('SUPABASE_STORAGE_BUCKET', 'public')
        if not supa_url or not supa_key:
            log.info('supabase_not_configured')
            return None
        try:
            from supabase import create_client
        except Exception as e:
            log.warning(f'supabase_client_missing error={e}')
            return None
        client = create_client(supa_url, supa_key)
        path = filename
        # supabase-py accepts file-like objects or bytes for upload; use BytesIO
        from io import BytesIO
        file_obj = BytesIO(img_bytes)
        try:
            res = client.storage.from_(bucket).upload(path, file_obj)
            # some versions return {'error': None} on success
            log.info(f'supabase_upload_result={res}')
            if isinstance(res, dict) and res.get('error'):
                log.warning(f'supabase_upload_error {res.get("error")}')
                return None
        except Exception as e:
            # Some clients expect bytes directly
            try:
                res = client.storage.from_(bucket).upload(path, img_bytes)
            except Exception as e2:
                log.warning(f'supabase_upload_failed error={e} inner={e2}')
                return None
        # Try to get public URL
        try:
            pub = client.storage.from_(bucket).get_public_url(path)
            # get_public_url may return {'publicURL': '...'} or an object
            log.info(f'supabase_get_public_url={pub}')
            if isinstance(pub, dict):
                return pub.get('publicURL') or pub.get('public_url')
            # fallback: string
            return str(pub)
        except Exception:
            # Construct URL manually (common supabase pattern)
            url = supa_url.rstrip('/') + '/storage/v1/object/public/' + bucket + '/' + path
            log.info(f'supabase_public_url_fallback={url}')
            return url
    except Exception as e:
        log.warning(f'supabase_upload_exception error={e}')
        return None


def _upload_to_supabase_debug(img_bytes: bytes, filename: str) -> dict:
    """Debug variant: returns a dict with 'url', 'upload_res', 'get_public' (if available) and 'error'."""
    debug = {"url": None, "upload_res": None, "get_public": None, "error": None}
    try:
        supa_url = os.getenv('SUPABASE_URL')
        supa_key = os.getenv('SUPABASE_KEY')
        bucket = os.getenv('SUPABASE_STORAGE_BUCKET', 'public')
        if not supa_url or not supa_key:
            debug['error'] = 'supabase_not_configured'
            return debug
        from supabase import create_client
        client = create_client(supa_url, supa_key)
        from io import BytesIO
        file_obj = BytesIO(img_bytes)
        try:
            res = client.storage.from_(bucket).upload(filename, file_obj)
            debug['upload_res'] = res
        except Exception as e:
            try:
                res = client.storage.from_(bucket).upload(filename, img_bytes)
                debug['upload_res'] = res
            except Exception as e2:
                debug['error'] = f'upload_failed: {e} / {e2}'
                return debug
        try:
            pub = client.storage.from_(bucket).get_public_url(filename)
            debug['get_public'] = pub
            if isinstance(pub, dict):
                debug['url'] = pub.get('publicURL') or pub.get('public_url')
            else:
                debug['url'] = str(pub)
        except Exception as e:
            debug['error'] = f'get_public_failed: {e}'
            debug['url'] = supa_url.rstrip('/') + '/storage/v1/object/public/' + bucket + '/' + filename
        return debug
    except Exception as e:
        debug['error'] = f'exception: {e}'
        return debug

@app.post('/v1/text2image')
async def text2image(body: Text2ImageRequest, request: Request):
    _init_pipelines()
    try:
        raw = await request.json()
    except Exception:
        raw = {}
    try:
        print(f'TEXT2IMAGE_REQUEST_RAW: {raw}')
        log.info(f'text2image_request_raw={raw}')
    except Exception:
        pass
    text = (body.prompt or 'design').strip()[:200]
    w = max(64, min(2048, body.width or 512))
    h = max(64, min(2048, body.height or 384))
    if _txt_pipeline:
        try:
            img = _txt_pipeline(text, width=w, height=h).images[0]
            img_bytes = io.BytesIO()
            img.save(img_bytes, format='PNG')
            img_raw = img_bytes.getvalue()
            result = {"ok": True, "image_b64": base64.b64encode(img_raw).decode('utf-8'), "width": w, "height": h, "prompt": text, "backend": "diffusers"}
            # Optionally upload to Supabase if requested (check raw payload first)
            save_flag = raw.get('save_to_supabase') if isinstance(raw, dict) else getattr(body, 'save_to_supabase', False)
            if save_flag:
                filename = f"generated/{uuid.uuid4().hex[:12]}-gen.png"
                supa_url = _upload_to_supabase(img_raw, filename)
                if supa_url:
                    result['supabase_url'] = supa_url
            return result
        except Exception as e:
            log.warning(f'text2image_pipeline_failed error={e}')
    # Stub fallback
    img = Image.new('RGB', (w, h), color=_DEF_COLOR)
    d = ImageDraw.Draw(img)
    try:
        font = ImageFont.load_default()
    except Exception:
        font = None
    d.text((16,16), text[:48], fill=(20,40,80), font=font)
    return {"ok": True, "image_b64": _png_b64(img), "width": w, "height": h, "prompt": text, "backend": "stub"}


class AdminTokenRequest(BaseModel):
    token: str
    admin_key: str


@app.post('/v1/admin/set_hf_token')
def set_hf_token(body: AdminTokenRequest):
    """Admin endpoint to set the Hugging Face token used by the service.
    Requires ADMIN_SECRET env var to match `admin_key`.
    This will write the token to the local Hugging Face token file and attempt to re-init the pipelines."""
    admin_secret = os.getenv('ADMIN_SECRET')
    if not admin_secret:
        raise HTTPException(status_code=403, detail='Admin secret not configured on server')
    if body.admin_key != admin_secret:
        raise HTTPException(status_code=403, detail='Invalid admin key')
    token = body.token.strip()
    if not token:
        raise HTTPException(status_code=400, detail='Empty token')
    # store in env for current process
    os.environ['HUGGINGFACE_HUB_TOKEN'] = token
    # try to write to user's HF token file
    try:
        hf_dir = os.path.expanduser('~/.huggingface')
        os.makedirs(hf_dir, exist_ok=True)
        token_path = os.path.join(hf_dir, 'token')
        with open(token_path, 'w', encoding='utf-8') as fh:
            fh.write(token)
    except Exception as e:
        log.warning(f'write_hf_token_failed error={e}')
    # Reset pipelines so they can be re-initialized with new token
    global _backend_init_attempted, _txt_pipeline, _controlnet_pipeline
    _backend_init_attempted = False
    _txt_pipeline = None
    _controlnet_pipeline = None
    # attempt re-init (may be slow)
    try:
        _init_pipelines()
    except Exception as e:
        log.warning(f'pipeline_reinit_failed error={e}')
    return {"ok": True, "message": "token_set"}

@app.post('/v1/sketch2image')
def sketch2image(body: Sketch2ImageRequest):
    _init_pipelines()
    txt = (body.prompt or 'sketch design')[:160]
    w = max(64, min(2048, body.width or 512))
    h = max(64, min(2048, body.height or 384))
    # Decode sketch if provided
    sketch_img = None
    if body.sketch_b64:
        try:
            sketch_bytes = base64.b64decode(body.sketch_b64)
            sketch_img = Image.open(io.BytesIO(sketch_bytes)).convert('RGB')
        except Exception as e:
            raise HTTPException(status_code=400, detail=f'Invalid sketch image: {e}')
    if _controlnet_pipeline and sketch_img is not None:
        try:
            # Resize control image to requested size
            control = sketch_img.resize((w, h))
            img = _controlnet_pipeline(prompt=txt, image=control, guidance_scale=body.guidance_scale or 7.5, num_inference_steps=body.steps or 25).images[0]
            return {"ok": True, "image_b64": _png_b64(img), "width": w, "height": h, "prompt": txt, "backend": "controlnet"}
        except Exception as e:
            log.warning(f'controlnet_inference_failed error={e}')
    # Fallback blend stub
    if sketch_img is not None:
        base_img = Image.new('RGBA', sketch_img.size, (250,250,255,255))
        draw = ImageDraw.Draw(base_img)
        try:
            font = ImageFont.load_default()
        except Exception:
            font = None
        draw.text((10,10), txt[:48], fill=(10,40,120,255), font=font)
        combined = Image.alpha_composite(base_img, sketch_img.convert('RGBA').resize(base_img.size))
        return {"ok": True, "image_b64": _png_b64(combined.convert('RGB')), "width": combined.width, "height": combined.height, "prompt": txt, "backend": "stub-blend"}
    # Plain stub
    img = Image.new('RGB', (w, h), color=_DEF_COLOR)
    d = ImageDraw.Draw(img)
    try:
        font = ImageFont.load_default()
    except Exception:
        font = None
    d.text((16,16), txt[:48], fill=(30,50,90), font=font)
    return {"ok": True, "image_b64": _png_b64(img), "width": w, "height": h, "prompt": txt, "backend": "stub"}



@app.post('/v1/debug/echo')
async def debug_echo(request: Request):
    """Echo raw JSON body for debugging client payloads."""
    try:
        data = await request.json()
    except Exception as e:
        return {"ok": False, "error": str(e)}
    return {"ok": True, "received": data}

# Notes:
# Backend can be switched by setting DIFFUSION_BACKEND=diffusers and providing DIFFUSION_MODEL.
# Optional CONTROLNET_MODEL enables sketch guidance; falls back gracefully to stub rendering.
