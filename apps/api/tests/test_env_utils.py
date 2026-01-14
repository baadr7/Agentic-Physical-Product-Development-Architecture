import os
import importlib


def test_rate_config_defaults(monkeypatch):
    monkeypatch.delenv('RATE_LIMIT_WINDOW_SECONDS', raising=False)
    monkeypatch.delenv('RATE_LIMIT_MAX_REQUESTS', raising=False)
    mod = importlib.import_module('apps.api.lib.env_utils')
    w, m = mod.get_rate_config()
    assert isinstance(w, int) and w > 0
    assert isinstance(m, int) and m > 0


def test_supabase_env_helpers(monkeypatch):
    mod = importlib.import_module('apps.api.lib.env_utils')
    monkeypatch.delenv('SUPABASE_URL', raising=False)
    monkeypatch.delenv('SUPABASE_KEY', raising=False)
    assert mod._supabase_url() is None
    assert mod._supabase_key() is None


def test_get_redis_client_without_url(monkeypatch):
    mod = importlib.import_module('apps.api.lib.env_utils')
    monkeypatch.delenv('REDIS_URL', raising=False)
    client = mod.get_redis_client()
    assert client is None
