import os, logging
from functools import lru_cache

log = logging.getLogger('clip-module')
CLIP_SERVICE_URL = os.getenv('CLIP_SERVICE_URL')
LOCAL_CLIP = os.getenv('CLIP_LOCAL','1') == '1'
MODEL_ID = os.getenv('CLIP_MODEL','openai/clip-vit-base-patch32')

@lru_cache(maxsize=1)
def _load_local():
    if not LOCAL_CLIP:
        return None
    try:
        import torch
        from transformers import CLIPModel, CLIPTokenizer
        device = 'cuda' if torch.cuda.is_available() else 'cpu'
        tok = CLIPTokenizer.from_pretrained(MODEL_ID)
        model = CLIPModel.from_pretrained(MODEL_ID).to(device)
        return (tok, model, device)
    except Exception as e:
        log.warning(f'clip_local_load_failed error={e}')
        return None


def text_similarity(a: str, b: str) -> float:
    # If external service configured, use it
    if CLIP_SERVICE_URL:
        import requests
        try:
            resp = requests.post(CLIP_SERVICE_URL.rstrip('/') + '/v1/similarity', json={'text_a': a, 'text_b': b}, timeout=15)
            if resp.ok:
                js = resp.json()
                if 'similarity' in js:
                    return float(js['similarity'])
        except Exception as e:
            log.warning(f'clip_service_call_failed error={e}')
    # Local fallback
    bundle = _load_local()
    if not bundle:
        return 0.6  # heuristic default
    tok, model, device = bundle
    import torch
    inputs = tok([a, b], padding=True, return_tensors='pt').to(device)
    with torch.no_grad():
        feats = model.get_text_features(**inputs)
    sim = torch.nn.functional.cosine_similarity(feats[0].unsqueeze(0), feats[1].unsqueeze(0)).item()
    return float(sim)

__all__ = ['text_similarity']
