import os, logging
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional

log = logging.getLogger("clip-service")
app = FastAPI(title="CLIP Similarity Service")

MODEL_ID = os.getenv('CLIP_MODEL','openai/clip-vit-base-patch32')
_device = 'cpu'
_tokenizer = None
_model = None

class TextPair(BaseModel):
    text_a: str
    text_b: str

class SimilarityResponse(BaseModel):
    ok: bool
    similarity: float
    model: str

class TextList(BaseModel):
    reference: str
    candidates: list[str]

class BatchSimilarityResponse(BaseModel):
    ok: bool
    scores: dict
    model: str


def _init():
    global _tokenizer, _model, _device
    if _model is not None:
        return
    try:
        import torch
        from transformers import CLIPModel, CLIPTokenizer
        _device = 'cuda' if torch.cuda.is_available() else 'cpu'
        _tokenizer = CLIPTokenizer.from_pretrained(MODEL_ID)
        _model = CLIPModel.from_pretrained(MODEL_ID).to(_device)
        log.info(f"clip_model_loaded model={MODEL_ID} device={_device}")
    except Exception as e:
        log.warning(f"clip_load_failed model={MODEL_ID} error={e}")

@app.get('/health')
def health():
    return {"status":"ok"}

@app.post('/v1/similarity', response_model=SimilarityResponse)
def similarity(body: TextPair):
    _init()
    if _model is None:
        raise HTTPException(status_code=503, detail='Model not available')
    import torch
    inputs = _tokenizer([body.text_a, body.text_b], padding=True, return_tensors='pt').to(_device)
    with torch.no_grad():
        emb = _model.get_text_features(**inputs)
    # cosine similarity
    v1, v2 = emb[0], emb[1]
    sim = torch.nn.functional.cosine_similarity(v1.unsqueeze(0), v2.unsqueeze(0)).item()
    return SimilarityResponse(ok=True, similarity=round(sim,4), model=MODEL_ID)

@app.post('/v1/batch', response_model=BatchSimilarityResponse)
def batch_similarity(body: TextList):
    _init()
    if _model is None:
        raise HTTPException(status_code=503, detail='Model not available')
    import torch
    texts = [body.reference] + body.candidates
    inputs = _tokenizer(texts, padding=True, return_tensors='pt').to(_device)
    with torch.no_grad():
        emb = _model.get_text_features(**inputs)
    ref = emb[0]
    scores = {}
    for i, candidate in enumerate(body.candidates, start=1):
        sim = torch.nn.functional.cosine_similarity(ref.unsqueeze(0), emb[i].unsqueeze(0)).item()
        scores[candidate] = round(sim,4)
    return BatchSimilarityResponse(ok=True, scores=scores, model=MODEL_ID)
