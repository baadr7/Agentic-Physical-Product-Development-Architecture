"""FEM simulation stub.
Provides simple mock stress and deflection metrics derived from mass and volume heuristics.
"""
from __future__ import annotations
import math
from typing import Dict, Any

def run_fem_simulation(base_metrics: Dict[str, Any]) -> Dict[str, float]:
    mass = float(base_metrics.get('mass_g', 50.0))
    volume = float(base_metrics.get('volume_cm3', 40.0))
    # pseudo cross-sectional area estimate
    area = max(1.0, volume ** (2/3))
    applied_load_n = 100.0  # constant mock load
    stress_mpa = (applied_load_n / area) * 0.6  # arbitrary scale
    # deflection inverse proportional to area and proportional to load
    deflection_mm = (applied_load_n / (area * 50.0)) * 2.0
    safety_factor = max(1.0, (mass / 10.0) / (stress_mpa + 0.01))
    return {
        'stress_mpa': round(stress_mpa, 3),
        'deflection_mm': round(deflection_mm, 3),
        'safety_factor': round(safety_factor, 2),
    }

__all__ = ['run_fem_simulation']
