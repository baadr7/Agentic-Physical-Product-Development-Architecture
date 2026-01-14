import os
import jwt
import pytest
from fastapi.testclient import TestClient

tracking_dir = os.path.abspath('mlruns_test')


@pytest.fixture()
def client(monkeypatch):
    # Use ephemeral local file store for mlflow
    monkeypatch.setenv('MLFLOW_TRACKING_URI', f'file:{tracking_dir}')
    monkeypatch.setenv('SUPABASE_JWT_SECRET', 'testsecret')
    monkeypatch.setenv('JWT_REQUIRED', '1')
    # Disable Supabase so run creation uses in-memory path (ensures MLflow logging executes)
    monkeypatch.delenv('SUPABASE_URL', raising=False)
    monkeypatch.delenv('SUPABASE_KEY', raising=False)
    import main
    return TestClient(main.app)

def make_token():
    return jwt.encode({'sub':'u-ml','role':'designer'}, os.environ['SUPABASE_JWT_SECRET'], algorithm='HS256')

def test_mlflow_run_created(client):
    token = make_token()
    r = client.post('/api/v1/projects', json={'title':'MLProj'}, headers={'Authorization': f'Bearer {token}'})
    assert r.status_code == 200
    proj_id = r.json().get('id') or r.json().get('project_id')
    r2 = client.post('/api/v1/runs', json={'project_id': proj_id, 'skip_processing': True}, headers={'Authorization': f'Bearer {token}'})
    assert r2.status_code == 200
    # Verify mlflow directory created with metadata
    assert os.path.isdir(tracking_dir), 'mlflow tracking directory missing'
    # Simple heuristic: ensure at least one run subdirectory now exists
    has_run = False
    for root, dirs, files in os.walk(tracking_dir):
        if 'meta.yaml' in files:
            has_run = True
            break
    assert has_run, 'mlflow meta.yaml not found for any run'
