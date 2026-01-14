import uuid, logging, math
from typing import Dict

log = logging.getLogger('topopt')

# Simple topological optimization stub: reduce mass proportionally to target reduction percentage.

def run_topopt(params: Dict) -> Dict:
    original_mass_g = float(params.get('mass_g', 120.0))
    target_reduction_pct = float(params.get('target_reduction_pct', 20.0))  # desired percentage
    achieved_reduction_pct = min(target_reduction_pct, 35.0)  # cap reduction for stability
    new_mass_g = original_mass_g * (1.0 - achieved_reduction_pct/100.0)
    return {
        'topopt_id': f'topopt-{uuid.uuid4().hex[:8]}',
        'original_mass_g': original_mass_g,
        'new_mass_g': round(new_mass_g,2),
        'achieved_reduction_pct': round(achieved_reduction_pct,2),
    }

__all__ = ['run_topopt']
