import os
import sys
import base64

# Ensure the current directory (apps/api) is on sys.path so local imports work when
# running this script directly from the apps/api folder.
sys.path.insert(0, os.getcwd())
# If the environment doesn't have celery installed, inject a lightweight fake
# so importing `tasks` doesn't fail when run in minimal environments.
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
            def decorator(func):
                class TaskObj:
                    def __init__(self, f):
                        self.run = f
                    def __call__(self, *a, **k):
                        return self.run(*a, **k)
                return TaskObj(func)
            return decorator
    fake_mod = types.ModuleType('celery')
    fake_mod.Celery = FakeCelery
    import sys as _sys
    _sys.modules['celery'] = fake_mod

try:
    from tasks import fem_solve_task
except Exception as e:
    # Last resort: try importing via module path
    try:
        from apps.api.tasks import fem_solve_task
    except Exception:
        raise


class DummySelf:
    def update_state(self, state=None, meta=None):
        print(f"update_state: {state} {meta}")


def fake_upload(name, data, content_type='application/octet-stream'):
    print(f"fake_upload called: {name} len={len(data)} type={content_type}")
    return f"https://signed.test/{name}"


def fake_requests_patch(url, headers=None, json=None, timeout=None):
    print(f"fake_requests_patch to {url} payload_keys={list(json.keys()) if json else None}")
    class R:
        ok = True
        status_code = 200
        text = 'ok'
    return R()


def main():
    # ensure SUPABASE env set to hit patch branch
    os.environ['SUPABASE_URL'] = 'https://supabase.test'
    os.environ['SUPABASE_KEY'] = 'testkey'

    # patch worker upload
    try:
        import apps.api.worker as worker_mod
    except Exception:
        try:
            import worker as worker_mod
        except Exception:
            worker_mod = None

    if worker_mod:
        worker_mod._upload_and_sign = fake_upload

    # patch requests
    import requests
    requests.patch = fake_requests_patch

    mesh_config = {'length': 100, 'width': 50, 'thickness': 5}
    bc = {'load': 1000}
    mat = {'youngs_modulus': 200, 'poisson_ratio': 0.3}
    dummy = DummySelf()
    res = fem_solve_task.run(dummy, 'job-smoke-1', mesh_config, bc, mat)
    print('result:', res)


if __name__ == '__main__':
    main()
