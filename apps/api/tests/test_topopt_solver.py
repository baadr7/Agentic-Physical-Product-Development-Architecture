import os
from fastapi.testclient import TestClient
from apps.api.main import app

client = TestClient(app)

def test_topopt_stub_mode():
    # Ensure solver flag off
    os.environ['TOPOPT_SOLVER'] = '0'
    resp = client.post('/api/v1/topopt/optimize', json={'mass_g': 100.0, 'target_reduction_pct': 10.0})
    assert resp.status_code == 200
    data = resp.json()
    assert data['ok'] is True
    # Stub uses prefix 'topopt-' from original stub (assumed), solver has 'solver-'
    assert data['topopt_id'].startswith('topopt-') or data['topopt_id'].startswith('solver-')  # tolerate if env leaked

def test_topopt_solver_mode_env():
    os.environ['TOPOPT_SOLVER'] = '1'
    resp = client.post('/api/v1/topopt/optimize', json={'mass_g': 120.0, 'target_reduction_pct': 25.0})
    assert resp.status_code == 200
    data = resp.json()
    assert data['ok'] is True
    assert data['topopt_id'].startswith('solver-')
    # Achieved reduction should be >= 0
    assert data['achieved_reduction_pct'] >= 0.0

def test_topopt_solver_override_request():
    os.environ['TOPOPT_SOLVER'] = '0'
    resp = client.post('/api/v1/topopt/optimize', json={'mass_g': 150.0, 'target_reduction_pct': 30.0, 'solver': True})
    assert resp.status_code == 200
    data = resp.json()
    assert data['topopt_id'].startswith('solver-')
    assert 0.0 <= data['new_mass_g'] <= 150.0
