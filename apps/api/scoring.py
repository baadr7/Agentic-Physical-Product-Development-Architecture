"""DfX scoring engine (initial heuristic implementation).

This module provides functions to compute multi-objective DfX scores for a
variant given raw metrics and optional contextual constraints. The scores are
simple weighted heuristics designed for rapid iteration; they can be replaced
by data-driven models later.

Public API:
    compute_dfx_scores(metrics: dict, constraints: dict | None = None) -> dict
        Returns a dict with per-aspect scores in [0,100] and an overall score.

Heuristic aspects considered:
- fabricability (printability / manufacturability)
- assemblability (part count, fastener accessibility)
- sustainability (material + estimated mass)

Expected metric inputs (keys are optional, defaults applied if missing):
- volume_cm3 (float)
- mass_g (float)
- part_count (int)
- support_volume_ratio (0..1)
- material (str)

Constraints may include weight_max_g to penalize overweight variants.
"""
from __future__ import annotations

from typing import Dict, Any
import os
try:
    from .clip_module import text_similarity
except Exception:
    try:
        from clip_module import text_similarity
    except Exception:
        text_similarity = None  # type: ignore

# Global mutable weights (could be persisted later)
WEIGHTS = {
    'fabricability': 0.4,
    'assemblability': 0.3,
    'sustainability': 0.3,
}

# Material baseline sustainability scores (0..1, higher is better)
MATERIAL_SUSTAINABILITY = {
    "pla": 0.8,
    "abs": 0.4,
    "petg": 0.6,
    "aluminium": 0.5,
    "acier": 0.3,
    "bois": 0.9,
    "unknown": 0.5,
}


def _clamp(v: float, lo: float = 0.0, hi: float = 100.0) -> float:
    return max(lo, min(hi, v))


def get_weights() -> Dict[str, float]:
    return WEIGHTS.copy()

def set_weights(new_w: Dict[str, float]):
    # Basic validation & normalization (ensure positive; if all zero keep defaults)
    total = 0.0
    cleaned = {}
    for k in ('fabricability','assemblability','sustainability'):
        v = float(new_w.get(k, WEIGHTS[k]))
        if v < 0:
            v = 0.0
        cleaned[k] = v
        total += v
    if total <= 0:
        return  # ignore invalid update
    # Normalize to sum 1.0
    for k,v in cleaned.items():
        cleaned[k] = v / total
    WEIGHTS.update(cleaned)

def compute_dfx_scores(metrics: Dict[str, Any], constraints: Dict[str, Any] | None = None) -> Dict[str, Any]:
    constraints = constraints or {}
    part_count = int(metrics.get("part_count", 1))
    support_ratio = float(metrics.get("support_volume_ratio", 0.15))  # unknown ~ moderate
    material = str(metrics.get("material", "unknown")).lower()
    mass_g = float(metrics.get("mass_g", 50.0))  # fallback mass

    # Fabricability: fewer parts & lower support ratio => higher
    fabricability = 100.0 - (part_count - 1) * 8.0 - support_ratio * 30.0

    # Assemblability: fewer parts & moderate part size => higher
    assemblability = 100.0 - (part_count - 1) * 10.0

    # Sustainability: material baseline adjusted by mass penalty
    baseline = MATERIAL_SUSTAINABILITY.get(material, MATERIAL_SUSTAINABILITY["unknown"]) * 100.0
    # Penalize heavy designs logarithmically
    sustainability = baseline - (max(0.0, mass_g - 50.0) ** 0.5) * 4.0

    # Apply weight constraint penalty if present
    weight_max_g = constraints.get("weight_max_g") or constraints.get("max_weight_g")
    if isinstance(weight_max_g, (int, float)) and mass_g > float(weight_max_g):
        sustainability -= (mass_g - float(weight_max_g)) * 0.1

    fabricability = _clamp(fabricability)
    assemblability = _clamp(assemblability)
    sustainability = _clamp(sustainability)

    w = get_weights()
    overall = _clamp((fabricability * w['fabricability']) + (assemblability * w['assemblability']) + (sustainability * w['sustainability']))

    return {
        "fabricability_score": round(fabricability, 2),
        "assemblability_score": round(assemblability, 2),
        "sustainability_score": round(sustainability, 2),
        "overall_score": round(overall, 2),
    }

def compute_multiobjective_scores(metrics: Dict[str, Any], constraints: Dict[str, Any] | None = None) -> Dict[str, Any]:
    """Extended multi-objective scoring including physical, aesthetic (CLIP similarity) and user feedback.

    Inputs (optional):
        mass_g, safety_factor, max_von_mises_MPa, clip_similarity (0..1), user_feedback (0..5)

    Returns base DfX scores plus physical_score, aesthetic_score, user_score, overall_score.
    Overall combines: physical  (wp), dfx (wd), user (wu), aesthetic (wa) using dynamic env weights.
    """
    constraints = constraints or {}
    dfx = compute_dfx_scores(metrics, constraints)
    mass_g = float(metrics.get('mass_g', 50.0))
    safety_factor = float(metrics.get('safety_factor', 2.0))
    max_vm = float(metrics.get('max_von_mises_MPa', 60.0))
    clip_similarity = float(metrics.get('clip_similarity', 0.0))
    if clip_similarity == 0.0 and text_similarity and 'prompt' in constraints and 'description' in constraints:
        try:
            clip_similarity = text_similarity(constraints.get('description',''), constraints.get('prompt',''))
        except Exception:
            clip_similarity = float(os.getenv('CLIP_FALLBACK','0.6'))
    user_feedback = float(metrics.get('user_feedback', 4.0))  # 0..5 rating

    # Physical score: lower mass & lower stress & adequate safety factor
    # Normalize mass relative to reference 100g
    mass_component = max(0.0, 1.0 - (mass_g / 100.0))  # negative if >100g -> clamp later
    stress_component = 1.0 / (1.0 + max_vm / 50.0)  # asymptotically decreases with stress
    safety_component = min(1.0, safety_factor / 3.0)  # ideal safety ~3
    physical_score = (mass_component * 0.4 + stress_component * 0.3 + safety_component * 0.3) * 100.0
    physical_score = _clamp(physical_score)

    # Aesthetic from CLIP similarity
    aesthetic_score = _clamp(clip_similarity * 100.0)

    # User score (map 0..5 to 0..100)
    user_score = _clamp((user_feedback / 5.0) * 100.0)

    # Combine DfX aspects into dfx_composite (average of three existing scores)
    dfx_composite = (dfx['fabricability_score'] + dfx['assemblability_score'] + dfx['sustainability_score']) / 3.0

    # Retrieve weights (env override) for categories
    import os
    wp = float(os.getenv('WEIGHT_PHYSICAL', '0.35'))
    wd = float(os.getenv('WEIGHT_DFX', '0.35'))
    wa = float(os.getenv('WEIGHT_AESTHETIC', '0.15'))
    wu = float(os.getenv('WEIGHT_USER', '0.15'))
    total = wp + wd + wa + wu
    if total <= 0:
        wp, wd, wa, wu = 0.35, 0.35, 0.15, 0.15
        total = 1.0
    wp, wd, wa, wu = wp/total, wd/total, wa/total, wu/total
    overall = _clamp(physical_score * wp + dfx_composite * wd + aesthetic_score * wa + user_score * wu)

    return {
        **dfx,
        'physical_score': round(physical_score,2),
        'aesthetic_score': round(aesthetic_score,2),
        'user_score': round(user_score,2),
        'overall_score': round(overall,2),
        'weights': {'physical': wp, 'dfx': wd, 'aesthetic': wa, 'user': wu}
    }

__all__ = ["compute_dfx_scores","get_weights","set_weights","compute_multiobjective_scores"]
