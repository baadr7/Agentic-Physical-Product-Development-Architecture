import os
import time
import pytest
from fastapi.testclient import TestClient

import jwt


@pytest.fixture()
def client(monkeypatch):
    # Use fakeredis for deterministic test
    monkeypatch.setenv('REDIS_URL', 'fakeredis://localhost')
    monkeypatch.setenv('RATE_LIMIT_WINDOW_SECONDS', '2')
    monkeypatch.setenv('RATE_LIMIT_MAX_REQUESTS', '3')
    monkeypatch.setenv('SUPABASE_JWT_SECRET', 'testsecret')
    monkeypatch.setenv('JWT_REQUIRED', '1')
    import main
    return TestClient(main.app)

def make_token(role: str = 'designer'):
    payload = {'sub': 'user-rl', 'role': role}
    return jwt.encode(payload, os.environ['SUPABASE_JWT_SECRET'], algorithm='HS256')


def test_rate_limit_exceeded(client):
    headers = {'Authorization': f'Bearer {make_token()}'}
    # Perform 3 allowed POSTs then 4th should fail (projects endpoint)
    for i in range(3):
        r = client.post('/api/v1/projects', json={'title': f'P{i}'}, headers=headers)
        assert r.status_code == 200, r.text
    r4 = client.post('/api/v1/projects', json={'title': 'P3'}, headers=headers)
    assert r4.status_code == 429, r4.text

    # Wait for window expiry and confirm allowed again
    time.sleep(2.2)
    r5 = client.post('/api/v1/projects', json={'title': 'P5'}, headers=headers)
    assert r5.status_code == 200, r5.text
