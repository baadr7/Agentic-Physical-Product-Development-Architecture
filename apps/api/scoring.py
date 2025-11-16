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

    # Overall score: weighted average (weights can be tuned later)
    overall = _clamp((fabricability * 0.4) + (assemblability * 0.3) + (sustainability * 0.3))

    return {
        "fabricability_score": round(fabricability, 2),
        "assemblability_score": round(assemblability, 2),
        "sustainability_score": round(sustainability, 2),
        "overall_score": round(overall, 2),
    }

__all__ = ["compute_dfx_scores"]
