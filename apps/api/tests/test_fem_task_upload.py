import os
import sys
import json

# Ensure local imports work when pytest runs from project root
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Inject fake celery if the environment running tests doesn't have it installed
try:
    import celery  # type: ignore
except Exception:
    import types
    class FakeCelery:
        def __init__(self, *a, **k):
            class _Conf:
                def __init__(self):
                    self._d = {}
                def update(self, d=None, **kwargs):
                    if isinstance(d, dict):
                        self._d.update(d)
                    if kwargs:
                        self._d.update(kwargs)
                def __setattr__(self, k, v):
                    if k == '_d':
                        super().__setattr__(k, v)
                    else:
                        self._d[k] = v
                def __getattr__(self, k):
                    return self._d.get(k)
            self.conf = _Conf()
        def task(self, *args, **kwargs):
            bind = bool(kwargs.get('bind'))
            def decorator(func):
                class TaskObj:
                    def __init__(self, f):
                        self.run = f
                    def __call__(self, *a, **k):
                        # In real Celery, bind=True passes the task instance as the first
                        # argument to the underlying function.
                        if bind:
                            return self.run(self, *a, **k)
                        return self.run(*a, **k)
                return TaskObj(func)
            return decorator
    fake_mod = types.ModuleType('celery')
    fake_mod.Celery = FakeCelery
    sys.modules['celery'] = fake_mod

try:
    from tasks import fem_solve_task
except Exception:
    from apps.api.tasks import fem_solve_task


class DummySelf:
    def update_state(self, state=None, meta=None):
        # no-op for tests
        self._state = state
        self._meta = meta


def test_fem_solve_task_uploads_and_patches(monkeypatch, tmp_path):
    uploads = []

    def fake_upload(name, data, content_type='application/octet-stream'):
        uploads.append({'name': name, 'len': len(data), 'content_type': content_type})
        return f"https://signed.test/{name}"

    patched_requests = {'called': False, 'args': None, 'kwargs': None}

    def fake_requests_patch(url, headers=None, json=None, timeout=None):
        patched_requests['called'] = True
        patched_requests['args'] = (url,)
        patched_requests['kwargs'] = {'headers': headers, 'json': json, 'timeout': timeout}
        class Resp:
            ok = True
            status_code = 200
            text = 'ok'
        return Resp()

    # Patch the module-level uploader in tasks so tests don't rely on worker import paths
    import tasks as tasks_mod
    monkeypatch.setattr(tasks_mod, '_upload_and_sign', fake_upload)

    # Patch requests.patch used in the task
    import requests
    monkeypatch.setattr(requests, 'patch', fake_requests_patch)

    # Ensure Supabase env vars are present so the patch branch runs
    monkeypatch.setenv('SUPABASE_URL', 'https://supabase.test')
    monkeypatch.setenv('SUPABASE_KEY', 'testkey')

    mesh_config = {'length': 100, 'width': 50, 'thickness': 5}
    boundary_conditions = {'load': 1000}
    material_properties = {'youngs_modulus': 200, 'poisson_ratio': 0.3}

    dummy = DummySelf()
    res = fem_solve_task.run(dummy, 'job-test-123', mesh_config, boundary_conditions, material_properties)

    assert isinstance(res, dict)
    assert res.get('status') == 'completed'
    # upload should have been called at least once
    assert len(uploads) >= 1
    # requests.patch should have been called to update fem_jobs
    assert patched_requests['called'] is True
    # payload JSON should include status completed
    payload = patched_requests['kwargs']['json']
    assert payload.get('status') == 'completed'
