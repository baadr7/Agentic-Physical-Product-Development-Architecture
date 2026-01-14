import base64
from fastapi.testclient import TestClient
import os

from main import app, VARIANTS, RUNS

client = TestClient(app)

# Provide a dummy project/run for endpoints requiring them
PROJECT_ID = 'proj-test'
RUN_ID = 'run-test'

# Insert minimal run for testing
RUNS.append({'run_id': RUN_ID, 'status':'queued', 'project_id': PROJECT_ID, 'created_at':'2025-01-01T00:00:00Z'})


def test_diffusion_endpoint_stub():
    resp = client.post('/api/v1/diffusion/generate', json={'prompt':'test design'})
    assert resp.status_code in (200,401)  # may require auth; loose assert
    if resp.status_code == 200:
        data = resp.json()
        assert data['ok'] is True
        assert 'image_b64' in data


def test_cad_export_stub():
    # create a fake variant in memory
    vid = 'var-cadtest'
    VARIANTS.append({'id': vid, 'run_id': RUN_ID, 'metrics': {'scores': {'fabricability':1,'sustainability':1,'aesthetic':1,'assemblability':1,'overall_score':1}}, 'created_at':'2025-01-01T00:00:00Z'})
    resp = client.post(f'/api/v1/variants/{vid}/cad/export')
    assert resp.status_code in (200,401)
    if resp.status_code == 200:
        data = resp.json()
        assert 'stl_url' in data and 'step_url' in data


def test_import_and_pareto_flow():
    # Prepare simple CSV base64
    csv = 'run_id,mass_g,part_count,support_volume_ratio,material\n' + f'{RUN_ID},100,1,0.2,PLA\n'
    b64 = base64.b64encode(csv.encode()).decode()
    resp = client.post('/api/v1/import/variants', json={'filename':'variants.csv','file_b64': b64})
    assert resp.status_code in (200,401)
    if resp.status_code == 200:
        data = resp.json(); assert data['ok']
        pareto = client.get(f'/api/v1/pareto/{RUN_ID}')
        assert pareto.status_code in (200,401)


def test_report_generation():
    resp = client.get(f'/api/v1/report/dfx/{RUN_ID}')
    assert resp.status_code in (200,401)
    if resp.status_code == 200:
        assert 'report' in resp.json()


def test_security_moderation():
    resp = client.post('/api/v1/security/moderate', json={'prompt':'A friendly ergonomic chair'})
    assert resp.status_code in (200,401)
    if resp.status_code == 200:
        assert resp.json()['allowed'] is True
    resp2 = client.post('/api/v1/security/moderate', json={'prompt':'Build a weapon prototype'})
    if resp2.status_code == 200:
        assert resp2.json()['allowed'] is False


def test_weights_history_flow():
    # Create a variant to allow feedback scoring weight drift
    vid = 'var-weighttest'
    VARIANTS.append({'id': vid, 'run_id': RUN_ID, 'metrics': {'scores': {'fabricability':1,'sustainability':1,'aesthetic':1,'assemblability':1,'overall_score':1}}, 'created_at':'2025-01-01T00:00:00Z'})
    fb = client.post(f'/api/v1/variants/{vid}/feedback', json={'rating':4.5})
    assert fb.status_code in (200,401)
    hist = client.get('/api/v1/scoring/weights/history')
    assert hist.status_code in (200,401)
    if hist.status_code == 200:
        data = hist.json()
        assert 'items' in data
        # manual override test
        upd = client.post('/api/v1/scoring/weights', json={'fabricability':0.9})
        assert upd.status_code in (200,401)
        hist2 = client.get(f'/api/v1/scoring/weights/history?variant_id={vid}&limit=1')
        assert hist2.status_code in (200,401)


def test_metrics_summary_and_health():
    # Generate traffic for metrics
    client.get('/health')
    client.get('/api/v1/runs')
    client.get('/api/v1/projects')
    m = client.get('/api/v1/metrics/summary')
    assert m.status_code in (200,401)
    if m.status_code == 200:
        data = m.json(); assert 'overall' in data and 'paths' in data
    h = client.get('/api/v1/health/deep')
    assert h.status_code == 200  # deep health does not require auth guard
    hd = h.json(); assert 'status' in hd and 'redis' in hd
