import os
import jwt
import pytest
from fastapi.testclient import TestClient


@pytest.fixture()
def _auth_env(monkeypatch):
    # Configure env for each test to avoid polluting the whole suite.
    monkeypatch.setenv('SUPABASE_JWT_SECRET', 'testsecret')
    monkeypatch.setenv('JWT_REQUIRED', '1')
    yield


@pytest.fixture()
def client(_auth_env):
    import main
    return TestClient(main.app)

def make_token(role: str):
    payload = {'sub': 'user-123', 'role': role}
    return jwt.encode(payload, os.environ['SUPABASE_JWT_SECRET'], algorithm='HS256')

def test_create_project_requires_designer_role(client):
    token = make_token('designer')
    r = client.post('/api/v1/projects', json={'title': 'Proj', 'description': 'Test'}, headers={'Authorization': f'Bearer {token}'})
    assert r.status_code == 200, r.text

def test_create_project_unauthorized_without_token(client):
    r = client.post('/api/v1/projects', json={'title': 'NoToken', 'description': 'Test'})
    assert r.status_code == 401

def test_create_run_forbidden_for_reader_role(client):
    # First create project with designer
    designer_token = make_token('designer')
    pr = client.post('/api/v1/projects', json={'title': 'RunProj', 'description': 'Test'}, headers={'Authorization': f'Bearer {designer_token}'})
    assert pr.status_code == 200
    project_id = pr.json()['id'] if 'id' in pr.json() else pr.json().get('project_id') or pr.json().get('title')
    reader_token = make_token('reader')
    rr = client.post('/api/v1/runs', json={'project_id': project_id}, headers={'Authorization': f'Bearer {reader_token}'})
    assert rr.status_code == 403

def test_create_run_allowed_for_engineer_role(client):
    # Create project
    designer_token = make_token('designer')
    pr = client.post('/api/v1/projects', json={'title': 'RunProj2', 'description': 'Test'}, headers={'Authorization': f'Bearer {designer_token}'})
    assert pr.status_code == 200
    project_id = pr.json()['id'] if 'id' in pr.json() else pr.json().get('project_id') or pr.json().get('title')
    engineer_token = make_token('engineer')
    rr = client.post('/api/v1/runs', json={'project_id': project_id}, headers={'Authorization': f'Bearer {engineer_token}'})
    assert rr.status_code == 200, rr.text
