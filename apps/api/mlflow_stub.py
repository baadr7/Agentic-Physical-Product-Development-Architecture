"""Lightweight mlflow stub used when real `mlflow` isn't available.

This provides a minimal subset of the mlflow API used by the tests and
code paths: `set_tracking_uri`, `set_experiment`, `start_run` (context
manager), `log_param`, `log_artifact`, `log_metric`. It's intentionally
simple and keeps artifacts in a temporary directory when `log_artifact`
is called.
"""
from __future__ import annotations

import tempfile
import uuid
import os
from contextlib import contextmanager
from types import SimpleNamespace


_TRACKING_DIR = None


def set_tracking_uri(uri: str):
    # If `file:` scheme provided, create a tracking dir for runs
    global _TRACKING_DIR
    try:
        if uri and uri.startswith('file:'):
            path = uri.split(':', 1)[1]
            os.makedirs(path, exist_ok=True)
            _TRACKING_DIR = path
            return _TRACKING_DIR
    except Exception:
        pass
    return None


def set_experiment(name: str | None = None):
    # record nothing; return a fake experiment id
    return None


def get_experiment_by_name(name: str):
    # Minimal stub: experiments are not persisted; return None to signal missing
    return None


def create_experiment(name: str):
    # Return a synthetic numeric experiment id
    eid = str(uuid.uuid4().hex)
    return eid


@contextmanager
def start_run(*args, **kwargs):
    # Accept any args/kwargs to match mlflow API (e.g. run_name=...)
    run_id = uuid.uuid4().hex
    info = SimpleNamespace(run_id=run_id)
    run = SimpleNamespace(info=info)
    # If tracking dir configured, create a minimal run folder with meta.yaml
    try:
        if _TRACKING_DIR:
            run_dir = os.path.join(_TRACKING_DIR, run_id)
            os.makedirs(run_dir, exist_ok=True)
            meta_path = os.path.join(run_dir, 'meta.yaml')
            with open(meta_path, 'w', encoding='utf-8') as mf:
                mf.write(f"run_id: {run_id}\n")
    except Exception:
        pass
    try:
        yield run
    finally:
        return


def log_param(key: str, value):
    # no-op
    return None


def log_artifact(path: str, artifact_path: str | None = None):
    # copy to a temp dir so callers expecting an artifact can find files
    try:
        td = tempfile.gettempdir()
        base = os.path.basename(path)
        target = os.path.join(td, f"mlflow-stub-{uuid.uuid4().hex[:8]}-{base}")
        with open(path, 'rb') as src, open(target, 'wb') as dst:
            dst.write(src.read())
        return target
    except Exception:
        return None


def log_metric(key: str, value):
    return None


# expose a module-like object to allow `import mlflow` fallbacks
mlflow = SimpleNamespace(
    set_tracking_uri=set_tracking_uri,
    set_experiment=set_experiment,
    start_run=start_run,
    log_param=log_param,
    log_artifact=log_artifact,
    log_metric=log_metric,
)
