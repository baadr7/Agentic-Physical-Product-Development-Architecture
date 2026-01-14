from fastapi.testclient import TestClient
import os
import time
import uuid
import requests

# Ensure TEST_MODE so worker runs fast
os.environ['TEST_MODE'] = '1'
os.environ['DIFFUSION_IMAGE_URL'] = 'http://testserver/api/v1/diffusion/generate'

SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_KEY') or os.getenv('SUPABASE_SERVICE_ROLE_KEY')

def _supabase_headers():
    return {
        'apikey': SUPABASE_KEY,
        'Authorization': f'Bearer {SUPABASE_KEY}',
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    }

def ensure_supabase_user_and_project() -> str:
    """Create a temporary auth user + project and return project UUID.
    Falls back to in-memory project id if Supabase not configured or errors occur."""
    if not (SUPABASE_URL and SUPABASE_KEY):
        return 'proj-test-inmemory'
    try:
        email = f"test+{int(time.time())}@example.com"
        # Create user
        ur = requests.post(f"{SUPABASE_URL}/auth/v1/admin/users", json={'email': email, 'password': 'TestPass123!', 'email_confirm': True}, headers=_supabase_headers(), timeout=15)
        if not ur.ok:
            print('[supabase-test] user create failed:', ur.status_code, ur.text)
            return 'proj-test-inmemory'
        user = ur.json().get('user') or ur.json()
        user_id = user.get('id')
        # Insert project
        proj_payload = {
            'user_id': user_id,
            'title': f'Test Project {uuid.uuid4().hex[:6]}',
            'description': 'Test project for run creation',
            'product_type': 'mechanical',
            'brief': 'Brief automatique pour tests',
            'materials': ['PLA'],
            'constraints': {}
        }
        pr = requests.post(f"{SUPABASE_URL}/rest/v1/projects", json=proj_payload, headers={**_supabase_headers(), 'Prefer': 'return=representation'}, timeout=15)
        if not pr.ok:
            print('[supabase-test] project insert failed:', pr.status_code, pr.text)
            return 'proj-test-inmemory'
        project_row = pr.json()[0] if isinstance(pr.json(), list) else pr.json()
        return project_row.get('id') or 'proj-test-inmemory'
    except Exception as e:
        print('[supabase-test] exception during setup:', e)
        return 'proj-test-inmemory'

from main import app  # import after potential env setup
client = TestClient(app)


def test_create_and_list_runs():
    # Acquire valid project id (Supabase UUID or in-memory fallback)
    project_id = ensure_supabase_user_and_project()

    resp = client.get('/api/v1/runs')
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)

    payload = {
        'project_id': project_id,
        'input_mode': 'text',
        'description': 'test brief',
        'options': {'guidance_scale': 5}
    }
    post = client.post('/api/v1/runs', json=payload)
    assert post.status_code == 200, f"Run creation status {post.status_code}: {post.text}"
    data = post.json()
    assert 'run_id' in data
    assert data['project_id'] == project_id

    resp2 = client.get('/api/v1/runs')
    assert resp2.status_code == 200
    runs = resp2.json()
    if SUPABASE_URL and project_id != 'proj-test-inmemory':
        # Expect run to show up when Supabase persistence succeeded
        assert any(r.get('run_id') == data['run_id'] for r in runs), 'Run not listed in Supabase response'

    vresp = client.get(f"/api/v1/runs/{data['run_id']}/variants")
    assert vresp.status_code == 200
    variants = vresp.json()
    assert isinstance(variants, list)
    # In Supabase mode with no variants yet, list may be empty; only assert image if present
    if variants:
        img_url = variants[0].get('image_url')
        assert img_url and (img_url.startswith('data:image/png;base64,') or 'placehold.co' in img_url)


def test_unknown_run_variants_404_or_fallback():
    """If Supabase is configured, requesting variants of a non-existent run should 404.
    In pure in-memory mode (no Supabase URL) it should return a synthetic variant."""
    from main import SUPABASE_URL as _SUPA
    bogus_run = 'run-nonexistent-zzz'
    vresp = client.get(f"/api/v1/runs/{bogus_run}/variants")
    if _SUPA:
        assert vresp.status_code == 404, f"Expected 404 for unknown run, got {vresp.status_code} {vresp.text}"
    else:
        # Fallback synthetic variant
        assert vresp.status_code == 200
        data = vresp.json()
        assert isinstance(data, list) and len(data) == 1
        assert data[0]['run_id'] == bogus_run
        assert data[0]['thumbnail_url']


def test_supabase_run_empty_variants():
    """When Supabase is configured, creating a run with skip_processing should yield an empty variants list (no synthetic)."""
    if not (SUPABASE_URL and SUPABASE_KEY):
        # Skip in pure in-memory mode
        return
    project_id = ensure_supabase_user_and_project()
    assert project_id and project_id != 'proj-test-inmemory'
    payload = {
        'project_id': project_id,
        'input_mode': 'text',
        'description': 'brief for empty variants test',
        'options': {},
        'skip_processing': True,
    }
    post = client.post('/api/v1/runs', json=payload)
    assert post.status_code == 200, post.text
    run_id = post.json()['run_id']
    vresp = client.get(f'/api/v1/runs/{run_id}/variants')
    assert vresp.status_code == 200
    variants = vresp.json()
    assert variants == [], f"Expected empty list, got {variants}"


def test_supabase_variant_after_processing():
    """Supabase: after normal run creation (no skip), a variant should appear once worker finishes."""
    if not (SUPABASE_URL and SUPABASE_KEY):
        return
    project_id = ensure_supabase_user_and_project()
    assert project_id and project_id != 'proj-test-inmemory'
    payload = {
        'project_id': project_id,
        'input_mode': 'text',
        'description': 'variant processing test',
        'options': {'size_cm': 5},
        # omit skip_processing -> worker runs
    }
    post = client.post('/api/v1/runs', json=payload)
    assert post.status_code == 200, post.text
    run_id = post.json()['run_id']
    # Poll variants until one appears (worker is fast under TEST_MODE)
    deadline = time.time() + 5
    seen = []
    while time.time() < deadline:
        vresp = client.get(f'/api/v1/runs/{run_id}/variants')
        assert vresp.status_code == 200
        data = vresp.json()
        if data:
            seen = data
            break
        time.sleep(0.2)
    assert seen, 'No variant created within timeout'
    v0 = seen[0]
    assert v0.get('run_id') == run_id
    assert 'metrics' in v0


def test_export_generation():
    """Test export presign and batch export endpoint produce URLs or structured errors."""
    # Create run first (in-memory acceptable if Supabase not set)
    project_id = ensure_supabase_user_and_project()
    payload = {
        'project_id': project_id,
        'description': 'export test',
        'options': {},
        'skip_processing': True,
    }
    post = client.post('/api/v1/runs', json=payload)
    assert post.status_code == 200
    run_id = post.json()['run_id']
    presign = client.post('/api/v1/exports/presign', json={'run_id': run_id, 'kind': 'pdf'})
    assert presign.status_code == 200
    data = presign.json()
    assert 'url' in data and 'expires_at' in data
    batch = client.post(f'/api/v1/runs/{run_id}/exports', json={'kinds': ['pdf','zip']})
    assert batch.status_code == 200
    batch_data = batch.json()
    assert batch_data.get('ok') is True
    assert 'pdf' in batch_data and 'zip' in batch_data
