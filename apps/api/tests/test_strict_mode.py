import os
from fastapi.testclient import TestClient


def _client(monkeypatch):
    # Force strict mode and fake Supabase config causing failure
    monkeypatch.setenv('SUPABASE_STRICT', '1')
    monkeypatch.setenv('SUPABASE_URL', 'http://invalid.local')
    monkeypatch.setenv('SUPABASE_KEY', 'bad')
    from main import app
    return TestClient(app)


def test_run_create_strict_failure(monkeypatch):
    client = _client(monkeypatch)
    r = client.post('/api/v1/runs', json={'project_id': 'proj-test'})
    assert r.status_code == 502, r.text
    body = r.json()
    assert 'Failed to persist run' in body.get('detail', '')


def test_variant_detail_missing_supabase(monkeypatch):
    client = _client(monkeypatch)
    # Expect 404 since Supabase configured (invalid) and variant doesn't exist
    r = client.get('/api/v1/variants/does-not-exist/detail')
    # Could be 503 if network error triggers; accept either but prefer 404 semantics
    assert r.status_code in (404, 503)
