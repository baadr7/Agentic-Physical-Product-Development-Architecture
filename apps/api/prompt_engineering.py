import os, uuid, re, json, logging
from datetime import datetime, UTC
from typing import List, Dict

log = logging.getLogger('prompt_engineering')

# Lightweight heuristic extraction when LLM not configured.
# Attempts to parse material, dimensions (mm), weight (kg), and manufacturing hints.
EXTRACTION_PATTERNS = {
    'material': re.compile(r"\b(material|matériau)[:\s]+([A-Za-z0-9_-]+)", re.IGNORECASE),
    'weight_kg': re.compile(r"\b(poids|weight)[:\s]+([0-9]+(?:\.[0-9]+)?)\s*kg", re.IGNORECASE),
    'width_mm': re.compile(r"\b(largeur|width)[:\s]+([0-9]+(?:\.[0-9]+)?)\s*mm", re.IGNORECASE),
    'height_mm': re.compile(r"\b(hauteur|height)[:\s]+([0-9]+(?:\.[0-9]+)?)\s*mm", re.IGNORECASE),
    'depth_mm': re.compile(r"\b(profondeur|depth)[:\s]+([0-9]+(?:\.[0-9]+)?)\s*mm", re.IGNORECASE),
}

LLM_MODEL = os.getenv('LLM_MODEL')  # e.g. mistral, llama3, hf:model_id
LLM_PROVIDER = os.getenv('LLM_PROVIDER')  # 'hf' | 'none'

_transformer_pipeline = None

def _init_hf_model():
    global _transformer_pipeline
    if _transformer_pipeline or LLM_PROVIDER != 'hf' or not LLM_MODEL:
        return
    try:
        from transformers import pipeline  # type: ignore
        _transformer_pipeline = pipeline('text-generation', model=LLM_MODEL)
        log.info(f'hf_pipeline_initialized model={LLM_MODEL}')
    except Exception as e:
        log.warning(f'hf_pipeline_failed model={LLM_MODEL} error={e}')

class PromptVariant(Dict):
    pass

def extract_constraints(brief: str) -> Dict:
    data: Dict[str, str | float] = {}
    for key, pattern in EXTRACTION_PATTERNS.items():
        m = pattern.search(brief)
        if m:
            try:
                val = m.group(2)
                if key.endswith('_mm') or key.endswith('_kg'):
                    data[key] = float(val)
                else:
                    data[key] = val
            except Exception:
                pass
    # simple manufacturing hints
    manuf_hints = []
    for kw in ['injection', 'fraisage', 'impression', 'mould', 'print', 'cnc', 'additive']:
        if kw in brief.lower():
            manuf_hints.append(kw)
    if manuf_hints:
        data['manufacturing_hints'] = manuf_hints
    return data

PROMPT_STYLE_GUIDES = [
    'high detail, product render, studio lighting',
    'minimalist, clean lines, sustainable materials',
    'exploded view, assembly clarity, technical drawing style',
    'ergonomic emphasis, human factors, soft edges',
]


def generate_prompt_variants(brief: str, count: int = 4) -> List[PromptVariant]:
    """Generate prompt variants. Uses HF model if configured else heuristic templates."""
    _init_hf_model()
    variants: List[PromptVariant] = []
    # Prefer Mistral when explicitly requested via env and API key present
    try:
        if (os.getenv('LLM_PROVIDER') or '').lower() == 'mistral' and os.getenv('MISTRAL_API_KEY'):
            try:
                from .mistral import generate_prompts as _mistral_generate
            except Exception:
                from mistral import generate_prompts as _mistral_generate  # type: ignore
            try:
                res = _mistral_generate(brief, variants=count)
                prompts = res.get('prompts') or []
                for p in prompts[:count]:
                    variants.append({'id': f'p-{uuid.uuid4().hex[:8]}', 'prompt_text': p, 'model': 'mistral'})
            except Exception as e:
                log.warning(f'mistral_generate_failed fallback heuristics error={e}')
    except Exception:
        pass
    if not variants and _transformer_pipeline:
        try:
            # Single batched generation; each separated by newline heuristically
            base_input = f"Generate {count} diverse product design diffusion prompts focusing on DfX aspects from this brief: {brief}\nFormats: one line each."
            out = _transformer_pipeline(base_input, max_length=512, num_return_sequences=1, do_sample=True)
            text = out[0]['generated_text']
            lines = [l.strip('- ').strip() for l in text.split('\n') if len(l.strip()) > 12][:count]
            for idx, line in enumerate(lines):
                variants.append({'id': f'p-{uuid.uuid4().hex[:8]}', 'prompt_text': line, 'model': LLM_MODEL or 'unknown'})
        except Exception as e:
            log.warning(f'hf_generation_failed fallback heuristics error={e}')
    if not variants:
        # Heuristic fallback
        for guide in PROMPT_STYLE_GUIDES[:count]:
            variants.append({
                'id': f'p-{uuid.uuid4().hex[:8]}',
                'prompt_text': f"{brief} | {guide}",
                'model': 'heuristic'
            })
    return variants

# Supabase persistence helpers (call-time env reads)
try:
    from lib.env_utils import _supabase_url, _supabase_key
except Exception:
    from .lib.env_utils import _supabase_url, _supabase_key

def _supabase_headers():
    key = _supabase_key() or ''
    return {
        'apikey': key,
        'Authorization': f'Bearer {key}',
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    }

def persist_prompts(run_id: str, variants: List[PromptVariant]):
    if not _supabase_url() or not _supabase_key():
        return False
    try:
        import requests
        url = f"{_supabase_url()}/rest/v1/prompts"
        headers = _supabase_headers()
        headers['Prefer'] = 'return=representation'
        rows = []
        now = datetime.now(UTC).isoformat()
        for v in variants:
            rows.append({'run_id': run_id, 'prompt_text': v['prompt_text'], 'model': v.get('model','heuristic'), 'created_at': now})
        r = requests.post(url, headers=headers, json=rows)
        r.raise_for_status()
        return True
    except Exception as e:
        log.warning(f'supabase_persist_prompts_failed run_id={run_id} error={e}')
        return False

__all__ = ['extract_constraints','generate_prompt_variants','persist_prompts']
