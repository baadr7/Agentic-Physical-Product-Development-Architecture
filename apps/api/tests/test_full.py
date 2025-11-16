from fastapi.testclient import TestClient
import os

# Ensure TEST_MODE so worker runs fast
os.environ['TEST_MODE'] = '1'

from main import app

client = TestClient(app)

def test_get_run_full_shape():
    # Create a run first
    payload = {
        'project_id': 'proj-full-1',
        'input_mode': 'text',
        'description': 'support mural pour enceinte compacte, charge 5 kg',
        'constraints': {'weight_max_g': 500},
        'options': {'generate_3d': True, 'fem': False}
    }
    post = client.post('/api/v1/runs', json=payload)
    assert post.status_code == 200
    run = post.json()
    run_id = run['run_id']

    # Fetch the full payload
    res = client.get(f'/api/v1/runs/{run_id}/full')
    assert res.status_code == 200
    data = res.json()

    assert set(data.keys()) == {'run', 'variants', 'prompts'}
    assert isinstance(data['variants'], list)
    assert isinstance(data['prompts'], list)

    # run can be None in in-memory mode; if present, it must have keys
    if data['run'] is not None:
        for key in ['run_id', 'status', 'project_id', 'created_at']:
            assert key in data['run']
