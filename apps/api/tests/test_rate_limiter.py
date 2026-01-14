import importlib
import os


def test_memory_rate_limit(monkeypatch):
    # Force in-process memory fallback by setting fakeredis URL
    monkeypatch.setenv('REDIS_URL', 'fakeredis://localhost')
    monkeypatch.setenv('RATE_LIMIT_WINDOW_SECONDS', '2')
    monkeypatch.setenv('RATE_LIMIT_MAX_REQUESTS', '3')

    # Reload module so it picks up the test env
    rl = importlib.reload(importlib.import_module('apps.api.lib.rate_limiter'))

    # Clear any previous in-memory state
    if hasattr(rl, '_MEMORY_STORE'):
        rl._MEMORY_STORE.clear()

    # Calls should increment and eventually be rejected on the 4th call
    allowed, count = rl.rate_check('unit-test-client')
    assert allowed and count == 1
    allowed, count = rl.rate_check('unit-test-client')
    assert allowed and count == 2
    allowed, count = rl.rate_check('unit-test-client')
    assert allowed and count == 3
    allowed, count = rl.rate_check('unit-test-client')
    assert not allowed and count == 4
