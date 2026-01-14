import os, sys, pathlib, jwt
import pytest
from fastapi.testclient import TestClient

# Ensure app module import path (apps/api) is on sys.path when running from repo root
BASE_DIR = pathlib.Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.append(str(BASE_DIR))

@pytest.fixture()
def client(monkeypatch):
    monkeypatch.setenv('SUPABASE_JWT_SECRET', 'testsecret')
    monkeypatch.setenv('JWT_REQUIRED', '1')
    # Disable Supabase for deterministic in-memory behavior
    monkeypatch.delenv('SUPABASE_URL', raising=False)
    monkeypatch.delenv('SUPABASE_KEY', raising=False)
    import main
    return TestClient(main.app)

def make_token(role='designer', tenant='tenantA'):
    return jwt.encode({'sub': f'user-{tenant}', 'role': role, 'tenant': tenant}, os.environ['SUPABASE_JWT_SECRET'], algorithm='HS256')

def test_project_isolated_between_tenants(client):
    token_a = make_token(tenant='tenantA')
    token_b = make_token(tenant='tenantB')
    # Create project under tenantA
    r = client.post('/api/v1/projects', json={'title':'ProjA'}, headers={'Authorization': f'Bearer {token_a}'})
    assert r.status_code == 200
    proj_id = r.json()['id']
    # List projects as tenantB -> should be empty
    r_list_b = client.get('/api/v1/projects', headers={'Authorization': f'Bearer {token_b}'})
    assert r_list_b.status_code == 200
    assert all(p.get('tenant_id') == 'tenantB' for p in r_list_b.json()) or len(r_list_b.json()) == 0
    # Access project directly as tenantB -> forbidden
    r_get_b = client.get(f'/api/v1/projects/{proj_id}', headers={'Authorization': f'Bearer {token_b}'})
    assert r_get_b.status_code in (403,404)

def test_run_isolated_between_tenants(client):
    token_a = make_token(tenant='tenantA')
    token_b = make_token(tenant='tenantB')
    # Create project A
    r = client.post('/api/v1/projects', json={'title':'ProjA2'}, headers={'Authorization': f'Bearer {token_a}'})
    assert r.status_code == 200
    proj_id = r.json()['id']
    # Create run under tenantA
    run_resp = client.post('/api/v1/runs', json={'project_id': proj_id, 'skip_processing': True}, headers={'Authorization': f'Bearer {token_a}'})
    assert run_resp.status_code == 200
    run_id = run_resp.json()['run_id']
    # TenantB lists runs -> should not see tenantA run
    runs_b = client.get('/api/v1/runs', headers={'Authorization': f'Bearer {token_b}'})
    assert runs_b.status_code == 200
    assert all(r.get('tenant_id') == 'tenantB' for r in runs_b.json()) or len(runs_b.json()) == 0
    # TenantB access specific run -> forbidden
    run_b = client.get(f'/api/v1/runs/{run_id}', headers={'Authorization': f'Bearer {token_b}'})
    assert run_b.status_code in (403,404)
