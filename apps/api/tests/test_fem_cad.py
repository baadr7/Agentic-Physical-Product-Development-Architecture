import os, jwt
import pytest
from fastapi.testclient import TestClient


@pytest.fixture()
def client(monkeypatch):
    monkeypatch.setenv('SUPABASE_JWT_SECRET', 'testsecret')
    monkeypatch.setenv('JWT_REQUIRED', '1')
    monkeypatch.delenv('SUPABASE_URL', raising=False)
    monkeypatch.delenv('SUPABASE_KEY', raising=False)
    import main
    return TestClient(main.app)

def make_token(role='designer', tenant='tenantA'):
    return jwt.encode({'sub': f'user-{tenant}', 'role': role, 'tenant': tenant}, os.environ['SUPABASE_JWT_SECRET'], algorithm='HS256')

def test_variant_includes_fem_and_cad_metrics(client):
    token = make_token()
    # create project and run
    pr = client.post('/api/v1/projects', json={'title':'FEMCAD'}, headers={'Authorization': f'Bearer {token}'})
    assert pr.status_code == 200
    project_id = pr.json()['id']
    run_resp = client.post('/api/v1/runs', json={'project_id': project_id, 'skip_processing': True}, headers={'Authorization': f'Bearer {token}'})
    assert run_resp.status_code == 200
    run_id = run_resp.json()['run_id']
    variants = client.get(f'/api/v1/runs/{run_id}/variants', headers={'Authorization': f'Bearer {token}'})
    assert variants.status_code == 200
    data = variants.json()
    assert data, 'expected at least one variant'
    v = data[0]
    metrics = v.get('metrics', {})
    assert 'fem' in metrics and isinstance(metrics['fem'], dict)
    assert 'stress_mpa' in metrics['fem']
    assert 'cad_id' in metrics
    assert 'surface_area_cm2' in metrics
