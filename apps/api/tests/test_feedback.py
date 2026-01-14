from fastapi.testclient import TestClient
from apps.api.main import app, VARIANTS

client = TestClient(app)

def test_feedback_on_variant():
    # Ensure at least one variant exists by generating
    # Create synthetic run first
    run_resp = client.post('/api/v1/runs', json={'project_id':'proj-123','description':'test','skip_processing':True})
    assert run_resp.status_code == 200
    run_id = run_resp.json()['run_id']
    gen_resp = client.post(f'/api/v1/runs/{run_id}/generate-variants', json={'count':2})
    assert gen_resp.status_code == 200
    variants = gen_resp.json()['variants']
    assert variants
    var_id = variants[0]['id']
    fb_resp = client.post(f'/api/v1/variants/{var_id}/feedback', json={'rating':4.5})
    assert fb_resp.status_code == 200
    data = fb_resp.json()
    assert data['variant_id'] == var_id
    assert 0 <= data['new_overall_score'] <= 100
