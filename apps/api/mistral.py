import os
import requests
import json
from typing import Dict, Any, Optional
from urllib.parse import quote

# New Hugging Face based LLM bridge
def _hf_api_key() -> str | None:
    # Support common naming conventions.
    return (
        (os.getenv("HUGGINGFACE_API_KEY") or "").strip()
        or (os.getenv("HUGGINGFACE_HUB_TOKEN") or "").strip()
        or (os.getenv("HF_TOKEN") or "").strip()
        or None
    )


HUGGINGFACE_API_KEY = _hf_api_key()
HUGGINGFACE_API_BASE = os.getenv("HUGGINGFACE_API_BASE", "https://api-inference.huggingface.co")
HUGGINGFACE_MODEL = os.getenv("HUGGINGFACE_MODEL", "gpt2")

_LOCAL_PIPELINE = None
_LOCAL_PIPELINE_MODEL = None
_LOCAL_PIPELINE_TASK = None


def _hf_local_enabled() -> bool:
    return (os.getenv("HF_LOCAL_FALLBACK") or "").strip() == "1"


def _hf_local_task() -> str:
    # flan-t5* works best with text2text-generation
    return (os.getenv("HF_LOCAL_TASK") or "text2text-generation").strip()


def _hf_local_model() -> str:
    # Reasonably strong + commonly available, but still manageable on CPU.
    return (os.getenv("HF_LOCAL_MODEL") or "google/flan-t5-base").strip()


def _hf_local_generate(prompt: str, *, max_new_tokens: int, temperature: float) -> str:
    """Best-effort local generation using transformers pipeline.

    This downloads a public model from Hugging Face Hub and runs locally.
    It avoids dependency on remote Inference Providers which may return 404/410.
    """
    global _LOCAL_PIPELINE, _LOCAL_PIPELINE_MODEL, _LOCAL_PIPELINE_TASK
    task = _hf_local_task()
    model = _hf_local_model()
    if _LOCAL_PIPELINE is None or _LOCAL_PIPELINE_MODEL != model or _LOCAL_PIPELINE_TASK != task:
        from transformers import pipeline  # type: ignore
        _LOCAL_PIPELINE = pipeline(task, model=model)
        _LOCAL_PIPELINE_MODEL = model
        _LOCAL_PIPELINE_TASK = task

    # NOTE: pipeline kwargs differ slightly by task; these work for both
    # text2text-generation and text-generation.
    out = _LOCAL_PIPELINE(
        prompt,
        max_new_tokens=max_new_tokens,
        do_sample=temperature > 0,
        temperature=temperature,
        num_return_sequences=1,
    )
    if isinstance(out, list) and out:
        first = out[0]
        if isinstance(first, dict):
            return str(first.get("generated_text") or first.get("text") or "")
        return str(first)
    return str(out)


def _hf_model_candidates() -> list[str]:
    """Return a list of model IDs to try, in priority order.

    Why: HF endpoints and router providers vary over time; a configured model
    may be unavailable (404/410) depending on the provider. This lets the API
    keep using Hugging Face when possible instead of always falling back.
    """
    raw = (os.getenv("HUGGINGFACE_MODEL_FALLBACKS") or "").strip()
    fallbacks = [m.strip() for m in raw.split(',') if m.strip()] if raw else []

    defaults = [
        # Generally-available instruction / text2text models (smaller first)
        "google/flan-t5-base",
        "bigscience/bloomz-560m",
        "tiiuae/falcon-7b-instruct",
        # As a last resort, a classic baseline model
        "gpt2",
    ]

    # Preserve order while de-duplicating
    out: list[str] = []
    for m in [HUGGINGFACE_MODEL, *fallbacks, *defaults]:
        if m and m not in out:
            out.append(m)
    return out


class MistralNotConfigured(Exception):
    """Backward-compatible exception name retained for callers expecting it when no LLM is configured."""
    pass


def _try_parse_json_object(text: str) -> Dict[str, Any] | None:
    s = (text or "").strip()
    if not s:
        return None

    # Fast path: exact JSON
    try:
        obj = json.loads(s)
        return obj if isinstance(obj, dict) else None
    except Exception:
        pass

    # Heuristic: extract the first balanced {...} block.
    start = s.find("{")
    if start < 0:
        return None
    depth = 0
    end = -1
    for i in range(start, len(s)):
        c = s[i]
        if c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0:
                end = i + 1
                break
    if end <= start:
        return None
    candidate = s[start:end]
    try:
        obj = json.loads(candidate)
        return obj if isinstance(obj, dict) else None
    except Exception:
        return None


def _hf_unified_response_from_text(text: str) -> Dict[str, Any]:
    return {"choices": [{"message": {"role": "assistant", "content": text}}]}


def _hf_inference(prompt: str, model: Optional[str] = None, parameters: Optional[dict] = None, timeout: int = 60) -> Dict[str, Any]:
    """Call Hugging Face Inference API and return a unified response shape.

    Expects HUGGINGFACE_API_KEY to be set. Returns a dict similar to the previous llm_chat output
    so existing callers (normalize_brief) can keep parsing logic.
    """
    model = model or HUGGINGFACE_MODEL
    if not HUGGINGFACE_API_KEY:
        raise MistralNotConfigured("HUGGINGFACE_API_KEY is not set")
    # Hugging Face router endpoints commonly require the model id to be a single
    # path segment, so encode '/' as '%2F' (org/model).
    model_segment = quote(model, safe='')
    url = f"{HUGGINGFACE_API_BASE}/models/{model_segment}"
    headers = {"Authorization": f"Bearer {HUGGINGFACE_API_KEY}"}
    payload = {"inputs": prompt, "options": {"wait_for_model": True}}
    if parameters:
        payload["parameters"] = parameters
    resp = requests.post(url, json=payload, headers=headers, timeout=timeout)
    resp.raise_for_status()
    data = resp.json()

    # Try to extract a text string from common HF inference responses
    content = ""
    try:
        if isinstance(data, dict) and "generated_text" in data:
            content = data.get("generated_text", "")
        elif isinstance(data, list) and len(data) > 0:
            # many text models return [{"generated_text": "..."}]
            first = data[0]
            if isinstance(first, dict):
                content = first.get("generated_text") or first.get("text") or ""
            else:
                content = str(first)
        elif isinstance(data, dict) and "error" in data:
            content = str(data.get("error"))
        else:
            # Fallback to stringifying the response
            content = json.dumps(data)
    except Exception:
        content = str(data)

    return _hf_unified_response_from_text(content)


def normalize_brief(brief: str) -> Dict[str, Any]:
    """Normalize a free-text brief using the Hugging Face Inference API.

    Returns a dict with parsed JSON when possible or {'raw': ...} on free text.
    """
    system_text = (
        "You are a helpful assistant for a design-for-X platform. "
        "Extract a concise JSON object with normalized constraints and options from the user's brief. "
        "Include keys: material (string), max_weight_kg (number|null), dimensions (object with width_mm,height_mm,depth_mm or null), "
        "mounting_points (int|null), dfx_aspects (array of strings)."
    )

    prompt = (
        f"SYSTEM:\n{system_text}\n\nUSER:\n{brief}\n\n"
        "Return exactly a JSON object (no additional commentary). "
        "If you cannot parse, include a single key 'raw' containing the assistant text."
    )

    last_error: Exception | None = None
    data: Dict[str, Any] | None = None
    for model_id in _hf_model_candidates():
        try:
            data = _hf_inference(
                prompt,
                model=model_id,
                parameters={
                    "max_new_tokens": 256,
                    "temperature": 0.2,
                    "return_full_text": False,
                },
            )
            break
        except MistralNotConfigured:
            raise
        except Exception as e:
            last_error = e
            continue

    # If remote inference failed, optionally fall back to local transformers.
    if data is None and _hf_local_enabled():
        try:
            text = _hf_local_generate(prompt, max_new_tokens=256, temperature=0.2)
            data = _hf_unified_response_from_text(text)
        except Exception as e:
            last_error = e

    if data is None:
        # Bubble up so caller can fallback to heuristics
        raise last_error or RuntimeError("Hugging Face inference failed")

    content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
    # Try to extract fenced JSON if present
    s = content.strip()
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

    parsed_obj = _try_parse_json_object(s)
    parsed = parsed_obj if parsed_obj is not None else {"raw": s}

    return parsed



def generate_prompts(brief: str, *, variants: int = 3) -> Dict[str, Any]:
    """Generate N prompts suitable for diffusion/3D, plus a short DfX-oriented summary."""
    system_text = (
        "You create high-quality prompts for generative design. "
        "Return a compact JSON with keys: prompts (array of strings of length N) and dfx_summary (string). "
        "Prompts must integrate constraints (materials, weight, dimensions) if present, and be suitable for text-to-image or sketch-to-image."
    )

    prompt = (
        f"SYSTEM:\n{system_text}\n\nUSER:\nBrief: {brief}\n\n"
        f"Return exactly JSON with keys: prompts (N items) and dfx_summary. N = {variants}."
    )

    last_error: Exception | None = None
    data: Dict[str, Any] | None = None
    for model_id in _hf_model_candidates():
        try:
            data = _hf_inference(
                prompt,
                model=model_id,
                parameters={
                    "max_new_tokens": 512,
                    "temperature": 0.7,
                    "return_full_text": False,
                },
            )
            break
        except MistralNotConfigured:
            raise
        except Exception as e:
            last_error = e
            continue

    if data is None and _hf_local_enabled():
        try:
            text = _hf_local_generate(prompt, max_new_tokens=512, temperature=0.7)
            data = _hf_unified_response_from_text(text)
        except Exception as e:
            last_error = e

    if data is None:
        raise last_error or RuntimeError("Hugging Face inference failed")
    content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
    parsed_obj = _try_parse_json_object(content)
    parsed = parsed_obj if parsed_obj is not None else {"raw": content}
    return parsed
