import os
import jwt
import pytest
from fastapi.testclient import TestClient

@pytest.fixture()
def client(monkeypatch):
    monkeypatch.setenv('SUPABASE_JWT_SECRET', 'testsecret')
    monkeypatch.setenv('JWT_REQUIRED', '1')
    import main
    return TestClient(main.app)


def make_token(role: str):
    payload = {'sub': 'user-123', 'role': role, 'tenant': 'public'}
    return jwt.encode(payload, os.environ['SUPABASE_JWT_SECRET'], algorithm='HS256')


def test_delete_project_then_not_found(client):
    token = make_token('designer')
    # Create
    r = client.post('/api/v1/projects', json={'title': 'DelMe', 'description': 'Test'}, headers={'Authorization': f'Bearer {token}'})
    assert r.status_code == 200, r.text
    proj_id = r.json().get('id')
    assert proj_id

    # Delete
    d = client.delete(f'/api/v1/projects/{proj_id}', headers={'Authorization': f'Bearer {token}'})
    assert d.status_code == 200, d.text
    assert d.json().get('ok') is True

    # Get should 404
    g = client.get(f'/api/v1/projects/{proj_id}', headers={'Authorization': f'Bearer {token}'})
    assert g.status_code == 404

    # List should not include
    lst = client.get('/api/v1/projects', headers={'Authorization': f'Bearer {token}'})
    assert lst.status_code == 200
    assert all(p.get('id') != proj_id for p in lst.json())
