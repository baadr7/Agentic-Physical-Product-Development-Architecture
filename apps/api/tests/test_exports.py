from fastapi.testclient import TestClient
import os

# Ensure TEST_MODE to keep worker fast
os.environ['TEST_MODE'] = '1'

from main import app

client = TestClient(app)

def test_create_exports_stub():
    # Create a run first to get an id
    payload = {
        'project_id': 'proj-export-1',
        'input_mode': 'text',
        'description': 'export test',
        'options': {}
    }
    post = client.post('/api/v1/runs', json=payload)
    assert post.status_code == 200
    run = post.json()
    run_id = run['run_id']

    # Request exports for pdf and zip; without Supabase env this should return stub URLs
    res = client.post(f'/api/v1/runs/{run_id}/exports', json={'kinds': ['pdf', 'zip']})
    assert res.status_code == 200
    data = res.json()
    assert data.get('ok') is True
    assert 'pdf' in data and 'zip' in data
    assert 'url' in data['pdf'] and 'expires_at' in data['pdf']
    assert 'url' in data['zip'] and 'expires_at' in data['zip']
