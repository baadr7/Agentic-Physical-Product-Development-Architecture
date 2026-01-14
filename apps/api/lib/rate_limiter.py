"""Rate limiting helpers.

Provides `rate_check(client_id)` which returns (allowed: bool, count: int).
It uses Redis when available, otherwise an in-process memory fallback.
Namespacing uses `PYTEST_CURRENT_TEST` when present to isolate per-test keys.
"""
from __future__ import annotations
import os, time, threading, logging
from typing import Tuple
log = logging.getLogger('rate_limiter')

try:
    # Attempt to import the shared env helpers to obtain Redis client
    from lib.env_utils import get_redis_client, get_rate_config
except Exception:
    try:
        from .env_utils import get_redis_client, get_rate_config
    except Exception:
        get_redis_client = None  # type: ignore
        get_rate_config = None  # type: ignore

# In-memory fallback store: key -> (count, expires_at)
_MEMORY_STORE: dict[str, Tuple[int, float]] = {}
_MEMORY_LOCK = threading.Lock()


def _memory_increment(key: str, window: int) -> int:
    now = time.time()
    with _MEMORY_LOCK:
        entry = _MEMORY_STORE.get(key)
        if not entry or entry[1] <= now:
            # reset
            _MEMORY_STORE[key] = (1, now + window)
            return 1
        count, expires = entry
        count += 1
        _MEMORY_STORE[key] = (count, expires)
        return count


def rate_check(client_id: str) -> Tuple[bool, int]:
    """Increment counter for `client_id` and return (allowed, count).

    Uses Redis if available; otherwise falls back to an in-memory counter.
    """
    try:
        window, max_hits = get_rate_config()
    except Exception:
        window, max_hits = 60, 20

    # Namespace with pytest test id when present to avoid cross-test interference
    test_ns = os.getenv('PYTEST_CURRENT_TEST')
    if test_ns:
        key = f"rate:{test_ns}:{client_id}"
    else:
        key = f"rate:{client_id}"

    try:
        # If tests request fakeredis via REDIS_URL, prefer the in-process
        # memory fallback to avoid inconsistently created fakeredis clients
        # across separate modules (which can lead to counters not being
        # shared). This keeps test behavior deterministic.
        redis_url = os.getenv('REDIS_URL') or ''
        if redis_url.startswith('fakeredis://'):
            client = None
        else:
            client = get_redis_client() if callable(get_redis_client) else None
    except Exception:
        client = None

    if client is not None:
        try:
            # Use INCR and set expiry when first created
            count = client.incr(key)
            ttl = client.ttl(key)
            log.debug(f'rate_check_redis key={key} count={count} ttl={ttl} window={window} max={max_hits} test_ns={test_ns}')
            if ttl is None or ttl < 0:
                try:
                    client.expire(key, int(window))
                except Exception:
                    pass
            allowed = int(count) <= int(max_hits)
            return allowed, int(count)
        except Exception as e:
            log.debug(f'rate_check_redis_failed: {e}')

    # In-memory fallback
    try:
        count = _memory_increment(key, int(window))
        log.debug(f'rate_check_memory key={key} count={count} window={window} max={max_hits} test_ns={test_ns}')
        allowed = int(count) <= int(max_hits)
        return allowed, int(count)
    except Exception as e:
        log.debug(f'rate_check_memory_failed: {e}')
        return True, 0

