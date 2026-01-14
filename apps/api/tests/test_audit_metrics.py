import os, jwt
import pytest
from fastapi.testclient import TestClient


@pytest.fixture()
def client(monkeypatch):
    monkeypatch.setenv('SUPABASE_JWT_SECRET', 'testsecret')
    monkeypatch.setenv('JWT_REQUIRED', '1')
    # Disable Supabase for deterministic in-memory behavior
    monkeypatch.delenv('SUPABASE_URL', raising=False)
    monkeypatch.delenv('SUPABASE_KEY', raising=False)
    import main
    return TestClient(main.app)

def make_token(role='admin', tenant='tenantA'):
    return jwt.encode({'sub': f'user-{tenant}', 'role': role, 'tenant': tenant}, os.environ['SUPABASE_JWT_SECRET'], algorithm='HS256')

def test_audit_log_and_metrics_capture(client):
    token = make_token()
    # create a project
    r = client.post('/api/v1/projects', json={'title':'AuditProj'}, headers={'Authorization': f'Bearer {token}'})
    assert r.status_code == 200
    proj_id = r.json()['id']
    # fetch audit logs
    logs = client.get('/api/v1/audit/logs', headers={'Authorization': f'Bearer {token}'})
    assert logs.status_code == 200
    items = logs.json()['items']
    assert any(e['event'] == 'project.created' and e['extra']['project_id'] == proj_id for e in items)
    # metrics endpoint
    metrics = client.get('/admin/metrics', headers={'Authorization': f'Bearer {token}'})
    assert metrics.status_code == 200
    data = metrics.json()['endpoints']
    # ensure project creation path has count
    assert any('/api/v1/projects' in k for k in data.keys())
