import logging
import uuid
from typing import Dict, List

log = logging.getLogger('topopt-solver')

# Basic 2D SIMP style topological optimization (compliance minimization) placeholder.
# Not production-grade; demonstrates density iteration and mass reduction.

def run_topopt_solver(params: Dict) -> Dict:
    nelx = int(params.get('nelx', 30))  # elements in x
    nely = int(params.get('nely', 20))  # elements in y
    vol_frac = float(params.get('target_vol_frac', 0.7))  # target volume fraction
    iters = int(params.get('iterations', 30))
    penal = float(params.get('penal', 3.0))
    # Initialize density field
    x: List[List[float]] = [[vol_frac for _ in range(nelx)] for _ in range(nely)]

    def _percentile(values: List[float], p: float) -> float:
        if not values:
            return 0.0
        # Clamp p to [0, 100]
        if p <= 0:
            return min(values)
        if p >= 100:
            return max(values)
        ordered = sorted(values)
        idx = int((p / 100.0) * (len(ordered) - 1))
        return ordered[idx]

    def _mean_grid(grid: List[List[float]]) -> float:
        total = 0.0
        count = 0
        for row in grid:
            for v in row:
                total += v
                count += 1
        return total / float(count) if count else 0.0

    # Fake load/stiffness evaluation (not full FEA): compliance ~ sum(density^penal)
    for it in range(iters):
        compliance = 0.0
        grads: List[float] = []
        for row in x:
            for v in row:
                compliance += v ** penal
                grads.append(penal * (v ** (penal - 1.0)))

        # Update rule: reduce highest gradient areas slightly
        thresh = _percentile(grads, 70.0)
        g_idx = 0
        for i in range(nely):
            for j in range(nelx):
                if grads[g_idx] > thresh:
                    x[i][j] *= 0.98
                g_idx += 1

        # Enforce volume fraction constraint
        current_vol = _mean_grid(x)
        if current_vol > vol_frac and current_vol > 0:
            scale = vol_frac / current_vol
            for i in range(nely):
                for j in range(nelx):
                    x[i][j] *= scale

        if it % 10 == 0:
            log.info(f'topopt_iter={it} compliance={compliance:.2f} vol={current_vol:.3f}')

    achieved_vol_frac = float(_mean_grid(x))
    reduction_pct = (1.0 - achieved_vol_frac) * 100.0
    return {
        'topopt_id': f'solver-{uuid.uuid4().hex[:8]}',
        'grid': {'nelx': nelx, 'nely': nely},
        'target_vol_frac': vol_frac,
        'achieved_vol_frac': round(achieved_vol_frac,4),
        'achieved_reduction_pct': round(reduction_pct,2),
        'iterations': iters,
    }

__all__ = ['run_topopt_solver']
