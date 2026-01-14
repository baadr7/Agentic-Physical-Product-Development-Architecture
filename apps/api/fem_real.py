import logging, math
import os
from typing import Dict

log = logging.getLogger('fem_real')

# Attempt a minimal scikit-fem simulation (cantilever beam) if library available; fallback to heuristic.
try:
    import skfem as sk  # type: ignore
    import numpy as np  # type: ignore
    _SK_AVAILABLE = True
except Exception as e:
    # scikit-fem is an optional dependency; only warn loudly when FEM is enabled.
    fem_enabled = (os.getenv('FEM_ENABLED', '0') in ('1', 'true', 'True'))
    msg = f'scikit_fem_not_available fallback_stub error={e}'
    if fem_enabled:
        log.warning(msg)
    else:
        log.debug(msg)
    _SK_AVAILABLE = False


def run_real_fem(params: Dict) -> Dict:
    """Run a simple cantilever simulation returning max stress & deflection.

    Params expected: length_mm, height_mm, thickness_mm, force_N.
    Fallback heuristic if scikit-fem unavailable.
    """
    length = float(params.get('length_mm', 100.0)) / 1000.0  # convert to meters
    height = float(params.get('height_mm', 20.0)) / 1000.0
    thickness = float(params.get('thickness_mm', 5.0)) / 1000.0
    force = float(params.get('force_N', 50.0))
    young_modulus = float(params.get('E_GPa', 2.1)) * 1e9  # default: ~Aluminium-like

    if not _SK_AVAILABLE:
        # Heuristic beam formulas for cantilever with end load
        I = (thickness * height**3) / 12.0
        max_deflection = (force * length**3) / (3 * young_modulus * I)
        # Simplified max bending stress sigma = M*c/I with M=F*L, c=height/2
        sigma = (force * length * (height/2)) / I
        return {
            'backend': 'heuristic',
            'max_deflection_mm': max_deflection * 1000.0,
            'max_von_mises_MPa': sigma / 1e6,
            'safety_factor': max(0.1, (young_modulus/1e9) * 0.5 / (sigma/1e6)),
        }

    # scikit-fem path (2D rectangle cantilever) - coarse mesh
    try:
        m = sk.MeshTri.init_rectangle(x=(0.0, length), y=(0.0, height), n=8)
        e = sk.ElementTriP2()
        basis = sk.Basis(m, e)
        # Dirichlet BC at x=0 (fixed)
        fixed = m.facets_satisfying(lambda x: x[0] < 1e-9)
        # Linear elasticity (plane stress simplification)
        nu = 0.33
        lam = young_modulus * nu / ((1 + nu) * (1 - 2 * nu))
        mu = young_modulus / (2 * (1 + nu))

        @sk.asm
        def bilinf(u, v, w):
            from skfem.helpers import dot, grad
            return (lam * sk.helpers.div(u) * sk.helpers.div(v) + 2 * mu * dot(sk.helpers.sym_grad(u), sk.helpers.sym_grad(v)))

        K = sk.asm(bilinf, basis)
        # Force vector: downward force at free end nodes
        end_nodes = m.facets_satisfying(lambda x: x[0] > length - 1e-9)
        F = sk.asm(lambda v: 0.0, basis)  # zero initialize
        # Distribute force over end nodes (y-direction)
        for dof in basis.get_dofs(end_nodes).all():
            # apply downward force in y; splitting equally
            F[dof*2 + 1] += -force / len(basis.get_dofs(end_nodes).all())
        # Apply BC
        D = basis.get_dofs(fixed).all()
        # Expand for x,y displacement DOFs
        constrained = []
        for d in D:
            constrained.extend([2*d, 2*d+1])
        free = list(set(range(K.shape[0])) - set(constrained))
        # Solve reduced system
        import numpy as np
        Kff = K[np.ix_(free, free)]
        Ff = F[free]
        u = np.zeros(K.shape[0])
        u_f = np.linalg.solve(Kff.toarray(), Ff)
        u[free] = u_f
        # Extract deflection at end center node (approx)
        end_center = basis.get_dofs(end_nodes).all()[0]
        uy = u[end_center*2 + 1]
        max_deflection_mm = abs(uy) * 1000.0
        # Very simplified stress estimate via beam formula (since full stress extraction requires strain recovery)
        I = (thickness * height**3) / 12.0
        sigma = (force * length * (height/2)) / I
        return {
            'backend': 'scikit-fem',
            'max_deflection_mm': max_deflection_mm,
            'max_von_mises_MPa': sigma / 1e6,
            'safety_factor': max(0.1, (young_modulus/1e9) * 0.5 / (sigma/1e6)),
        }
    except Exception as e:
        log.warning(f'skikit_fem_run_failed fallback_heuristic error={e}')
        return run_real_fem({**params, 'force_N': force})

__all__ = ['run_real_fem']
