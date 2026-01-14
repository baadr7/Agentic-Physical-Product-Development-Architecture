"""Environment helpers for apps/api.

Centralizes creation of Redis client and simple config helpers so import-time
side-effects are minimized and tests can monkeypatch env vars safely.
"""
from __future__ import annotations

import os
import logging
from typing import Optional, Tuple

log = logging.getLogger('env_utils')

try:
    import fakeredis  # type: ignore
except Exception:
    fakeredis = None
try:
    import redis  # type: ignore
except Exception:
    redis = None

# cached redis client used across imports/tests
_REDIS_CLIENT = None


def _supabase_disabled() -> bool:
    v = (os.getenv('SUPABASE_DISABLE') or '').strip().lower()
    return v in ('1', 'true', 'yes', 'on')


def get_redis_client():
    """Return a Redis client instance or None.

    Respects `REDIS_URL` environment variable. If `REDIS_URL` starts with
    `fakeredis://` and `fakeredis` is available we return an in-memory
    FakeRedis instance which is convenient for tests.
    """
    global _REDIS_CLIENT
    if _REDIS_CLIENT is not None:
        return _REDIS_CLIENT

    url = os.getenv('REDIS_URL')
    if not url:
        return None

    try:
        if url.startswith('fakeredis://') and fakeredis is not None:
            _REDIS_CLIENT = fakeredis.FakeRedis()
        elif redis is not None:
            _REDIS_CLIENT = redis.from_url(url)
    except Exception as e:
        log.debug(f'get_redis_client_failed: {e}')
        _REDIS_CLIENT = None

    return _REDIS_CLIENT


def _supabase_url() -> Optional[str]:
    if _supabase_disabled():
        return None
    return os.getenv('SUPABASE_URL')


def _supabase_key() -> Optional[str]:
    if _supabase_disabled():
        return None
    # Prefer a service role key for server-side operations when available
    return os.getenv('SUPABASE_SERVICE_ROLE_KEY') or os.getenv('SUPABASE_KEY')


def _supabase_storage_bucket() -> Optional[str]:
    if _supabase_disabled():
        return None
    return os.getenv('SUPABASE_STORAGE_BUCKET')


def is_jwt_required() -> bool:
    return os.getenv('JWT_REQUIRED') == '1' and bool(os.getenv('SUPABASE_JWT_SECRET'))


def get_rate_config() -> Tuple[int, int]:
    try:
        w = int(os.getenv('RATE_LIMIT_WINDOW_SECONDS', '2'))
    except Exception:
        w = 2
    try:
        m = int(os.getenv('RATE_LIMIT_MAX_REQUESTS', '30'))
    except Exception:
        m = 30
    return w, m


__all__ = [
    'get_redis_client', '_supabase_url', '_supabase_key', '_supabase_storage_bucket',
    'is_jwt_required', 'get_rate_config', '_REDIS_CLIENT', '_supabase_disabled'
]
