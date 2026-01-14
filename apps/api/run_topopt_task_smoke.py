"""Smoke runner for TopOpt task — runs locally with fake uploader and patched requests.

Usage (PowerShell):
  python run_topopt_task_smoke.py

This script mirrors the test harness but is runnable as a script to observe prints.
"""
import sys
import time
import uuid
import os

# Ensure repository root on sys.path so `apps.api` imports work when running script
root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if root not in sys.path:
    sys.path.insert(0, root)
# Ensure Celery import won't fail in minimal envs (inject before importing tasks)
if 'celery' not in sys.modules:
    import types as _types
    _mod = _types.ModuleType('celery')
    class _DummyCelery:
        def __init__(self, *a, **k):
            class _Conf(dict):
                def __getattr__(self, name):
                    return self.get(name)
                def __setattr__(self, name, value):
                    self[name] = value
            self.conf = _Conf()
            self.conf['task_default_queue'] = None
        def task(self, *a, **k):
            def _decorator(fn):
                def f(*args, **kwargs):
                    return fn(*args, **kwargs)
                class _TaskWrapper:
                    def __init__(self, f):
                        self.run = f
                        self.__wrapped__ = f
                    def __call__(self, *args, **kwargs):
                        return f(*args, **kwargs)
                return _TaskWrapper(fn)
            return _decorator
    _mod.Celery = _DummyCelery
    sys.modules['celery'] = _mod

try:
    from apps.api import tasks
except Exception:
    # fallback to direct module import if package layout differs
    from api import tasks


def fake_upload(name, data, content_type=None):
    print(f"[fake_upload] name={name} size={len(data) if data else 0} content_type={content_type}")
    return f"https://fake.storage/{name}"


def fake_requests_patch(url, headers=None, json=None, timeout=None):
    print(f"[fake_requests_patch] url={url} json_keys={list(json.keys()) if isinstance(json, dict) else None}")
    class Resp:
        ok = True
        def __init__(self):
            self.status_code = 200
        @property
        def text(self):
            return 'ok'
    return Resp()


class DummySelf:
    def __init__(self):
        self._states = []
    def update_state(self, state=None, meta=None):
        print(f"[update_state] state={state} meta={meta}")
        self._states.append({'state': state, 'meta': meta})


def run_smoke():
    # Patch uploader
    tasks._upload_and_sign = fake_upload

    # Patch requests.patch globally
    import requests
    requests.patch = fake_requests_patch

    run_id = f"run-smoke-{uuid.uuid4().hex[:8]}"
    design_space = {'nelx': 12, 'nely': 8, 'penal': 3.0, 'max_iter': 4}
    print(f"Starting TopOpt smoke run: {run_id}")
    res = tasks.topopt_task.run(DummySelf(), run_id, design_space, 0.25)
    print("Result:", res)


if __name__ == '__main__':
    run_smoke()
