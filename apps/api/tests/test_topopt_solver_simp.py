import pytest

from apps.api.topopt_solver_simp import run_topopt_simp


def test_run_topopt_simp_basic():
    nelx, nely = 16, 8
    res = run_topopt_simp(nelx=nelx, nely=nely, volfrac=0.25, max_iter=10)

    # Basic keys
    assert 'topopt_id' in res
    assert 'layout_mask' in res
    assert 'densities' in res
    assert 'compliance' in res

    # Shapes
    mask = res['layout_mask']
    assert isinstance(mask, list)
    assert len(mask) == nely
    assert all(len(row) == nelx for row in mask)

    # Densities in range
    dens = res['densities']
    assert isinstance(dens, list)
    assert len(dens) == nely
    assert all(len(row) == nelx for row in dens)
    flat = [v for row in dens for v in row]
    assert all(0.0 <= float(v) <= 1.0 for v in flat)

    # Compliance positive
    assert float(res['compliance']) > 0.0
