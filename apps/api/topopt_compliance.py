import numpy as np, uuid, logging
log = logging.getLogger('topopt-compliance')

# Very simplified compliance-based solver stub.
# Produces pseudo density field convergence metrics.

def run_topopt_compliance(params: dict) -> dict:
    nelx = int(params.get('nelx', 50))
    nely = int(params.get('nely', 30))
    iters = int(params.get('iterations', 40))
    # Initialize density ~ 1.0
    dens = np.ones((nely, nelx))
    for it in range(iters):
        # Fake compliance gradient: higher in center
        cx, cy = nelx/2, nely/2
        for j in range(nely):
            for i in range(nelx):
                r2 = ((i-cx)**2 + (j-cy)**2)/(nelx*nelx + nely*nely)
                dens[j,i] -= 0.02 * np.exp(-4*r2)
        dens = np.clip(dens, 0.2, 1.0)
        if it % 10 == 0:
            log.info(f'adv_topopt_iter={it} dens_mean={dens.mean():.3f}')
    return {
        'topopt_id': f'advsolver-{uuid.uuid4().hex[:8]}',
        'density_mean': float(dens.mean()),
        'iterations': iters,
    }

__all__ = ['run_topopt_compliance']
