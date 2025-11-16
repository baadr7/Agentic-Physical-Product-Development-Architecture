from fastapi.testclient import TestClient
import os

# Ensure TEST_MODE so worker runs fast
os.environ['TEST_MODE'] = '1'

from main import app

client = TestClient(app)


def test_create_and_list_runs():
    # Ensure no runs initially (depends on in-memory store)
    resp = client.get('/api/v1/runs')
    assert resp.status_code == 200
    initial = resp.json()
    assert isinstance(initial, list)

    # Create a run
    payload = {
        'project_id': 'proj-test-1',
        'input_mode': 'text',
        'description': 'test brief',
        'options': {'guidance_scale': 5}
    }
    post = client.post('/api/v1/runs', json=payload)
    assert post.status_code == 200
    data = post.json()
    assert 'run_id' in data
    assert data['project_id'] == payload['project_id']

    # After creation, list should include the new run id
    resp2 = client.get('/api/v1/runs')
    assert resp2.status_code == 200
    runs = resp2.json()
    assert any(r.get('run_id') == data['run_id'] for r in runs)
