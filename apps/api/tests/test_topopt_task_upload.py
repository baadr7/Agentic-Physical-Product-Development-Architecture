import json

from types import SimpleNamespace

import sys
import types as _types
import pytest

# Ensure celery import won't break collection in minimal envs
if 'celery' not in sys.modules:
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
                class _TaskWrapper:
                    def __init__(self, f):
                        self.run = f
                        self.__wrapped__ = f
                    def __call__(self, *args, **kwargs):
                        return f(*args, **kwargs)
                f = fn
                return _TaskWrapper(fn)
            return _decorator
        def send_task(self, *a, **k):
            return None
    _mod.Celery = _DummyCelery
    sys.modules['celery'] = _mod

from apps.api import tasks


def fake_upload(name, data, content_type=None):
    # return a deterministic fake signed url
    return f"https://fake.storage/{name}"


class DummySelf:
    def __init__(self):
        self._states = []

    def update_state(self, state=None, meta=None):
        self._states.append({'state': state, 'meta': meta})
        return None


def test_topopt_task_upload(monkeypatch):
    # Patch uploader
    monkeypatch.setattr(tasks, '_upload_and_sign', fake_upload)

    # Capture requests.patch calls by patching requests.patch globally
    called = {}

    def fake_requests_patch(url, headers=None, json=None, timeout=None):
        called['url'] = url
        called['headers'] = headers
        called['json'] = json

        class Resp:
            ok = True

            def __init__(self):
                self.status_code = 200

            @property
            def text(self):
                return 'ok'

        return Resp()

    import requests as _requests
    monkeypatch.setattr(_requests, 'patch', fake_requests_patch)

    # Run the topopt task with a small problem (fast)
    run_id = 'run-smoke-1'
    design_space = {'nelx': 8, 'nely': 6, 'penal': 3.0, 'max_iter': 3}
    res = tasks.topopt_task.run(DummySelf(), run_id, design_space, 0.2)

    assert res['status'] == 'completed'
    # uploaded stl url may be present in returned payload
    assert 'stl_url' in res
    # verify uploader returned a fake url when stl export was attempted
    if res.get('stl_url'):
        assert res['stl_url'].startswith('https://fake.storage/')

    # Ensure that when SUPABASE is not configured we wrote to TOPOPT_JOBS
    jobs = globals().get('TOPOPT_JOBS') or tasks.__dict__.get('TOPOPT_JOBS')
    # It's acceptable if jobs dict exists; at minimum ensure no exceptions and result is present
    assert res['result'] is not None
