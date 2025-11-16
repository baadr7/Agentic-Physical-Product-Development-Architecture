import os
import requests
from tenacity import retry, wait_exponential, stop_after_attempt
from typing import List, Dict, Any, Optional, Tuple

# Paid API (optional)
MISTRAL_API_KEY = os.getenv("MISTRAL_API_KEY")
MISTRAL_API_BASE = os.getenv("MISTRAL_API_BASE", "https://api.mistral.ai")
MISTRAL_MODEL = os.getenv("MISTRAL_MODEL", "mistral-small-latest")

# 100% free local inference via Ollama (preferred if MISTRAL_API_KEY not set)
OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://127.0.0.1:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "mistral:7b-instruct")


class MistralNotConfigured(Exception):
    pass


def _unified_response_from_text(text: str) -> Dict[str, Any]:
    """Wrap a plain string into an OpenAI-like chat completion response shape."""
    return {
        "choices": [
            {
                "message": {
                    "role": "assistant",
                    "content": text,
                }
            }
        ]
    }


@retry(wait=wait_exponential(multiplier=1, min=1, max=8), stop=stop_after_attempt(3))
def _mistral_chat(messages: List[Dict[str, str]], *, model: Optional[str] = None, temperature: float = 0.2, max_tokens: int = 1024) -> Dict[str, Any]:
    if not MISTRAL_API_KEY:
        raise MistralNotConfigured("MISTRAL_API_KEY is not set")
    payload = {
        "model": model or MISTRAL_MODEL,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    headers = {
        "Authorization": f"Bearer {MISTRAL_API_KEY}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    url = f"{MISTRAL_API_BASE}/v1/chat/completions"
    resp = requests.post(url, json=payload, headers=headers, timeout=60)
    resp.raise_for_status()
    return resp.json()


@retry(wait=wait_exponential(multiplier=1, min=1, max=8), stop=stop_after_attempt(3))
def _ollama_chat(messages: List[Dict[str, str]], *, model: Optional[str] = None, temperature: float = 0.2, max_tokens: int = 1024) -> Dict[str, Any]:
    # Ollama /api/chat format
    payload = {
        "model": model or OLLAMA_MODEL,
        "messages": messages,
        "options": {
            "temperature": temperature,
            "num_predict": max_tokens,
        },
        "stream": False,
    }
    url = f"{OLLAMA_HOST}/api/chat"
    resp = requests.post(url, json=payload, timeout=120)
    resp.raise_for_status()
    data = resp.json()
    # Response shape: { message: { role, content }, ... }
    content = data.get("message", {}).get("content", "")
    return _unified_response_from_text(content)


def llm_chat(messages: List[Dict[str, str]], *, model: Optional[str] = None, temperature: float = 0.2, max_tokens: int = 1024) -> Tuple[Dict[str, Any], str]:
    """Route LLM calls: prefer free local Ollama if available; else paid Mistral if configured.

    Returns (response, provider), where provider is 'ollama' or 'mistral'.
    """
    # Try Ollama first (free)
    try:
        # Quick health check by attempting a call; if server is missing, it will raise
        res = _ollama_chat(messages, model=model, temperature=temperature, max_tokens=max_tokens)
        return res, "ollama"
    except Exception:
        pass

    # Fallback to Mistral API if key is set
    if MISTRAL_API_KEY:
        res = _mistral_chat(messages, model=model, temperature=temperature, max_tokens=max_tokens)
        return res, "mistral"

    # Neither available
    raise MistralNotConfigured("No local Ollama or Mistral API configured. Start Ollama or set MISTRAL_API_KEY.")


def normalize_brief(brief: str) -> Dict[str, Any]:
    """Use the LLM to extract structured constraints from a free-text brief.

    Returns a JSON-serializable dict with keys like: material, weight_max_kg, dimensions, mounting_points, etc.
    """
    system = {
        "role": "system",
        "content": (
            "You are a helpful assistant for a design-for-X platform. "
            "Extract a concise JSON object with normalized constraints and options from the user's brief. "
            "Include keys: material (string), max_weight_kg (number|null), dimensions (object with width_mm,height_mm,depth_mm or null), "
            "mounting_points (int|null), dfx_aspects (array of strings)."
        ),
    }
    user = {"role": "user", "content": brief}
    data, _ = llm_chat([system, user])

    # Try to parse assistant message content as JSON snippet; if not JSON, wrap in text
    content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
    # Best-effort JSON extraction
    import json
    parsed: Dict[str, Any]
    try:
        parsed = json.loads(content)
    except Exception:
        parsed = {"raw": content}
    return parsed


def generate_prompts(brief: str, *, variants: int = 3) -> Dict[str, Any]:
    """Generate N prompts suitable for diffusion/3D, plus a short DfX-oriented summary."""
    system = {
        "role": "system",
        "content": (
            "You create high-quality prompts for generative design. "
            "Return a compact JSON with keys: prompts (array of strings of length N) and dfx_summary (string). "
            "Prompts must integrate constraints (materials, weight, dimensions) if present, and be suitable for text-to-image or sketch-to-image."
        ),
    }
    user = {
        "role": "user",
        "content": (
            f"Brief: {brief}\n\n"
            f"Return exactly JSON with keys: prompts (N items) and dfx_summary. N = {variants}."
        ),
    }
    data, _ = llm_chat([system, user])
    import json
    content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
    try:
        parsed = json.loads(content)
    except Exception:
        parsed = {"raw": content}
    return parsed
