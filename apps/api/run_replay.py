import logging, os, tempfile
from datetime import datetime, UTC
from typing import Optional

log = logging.getLogger('run_replay')

try:
    import mlflow  # type: ignore
except Exception:
    mlflow = None  # type: ignore

# Basic replay: start new MLflow run referencing original run_id and copy key params.

def replay_run(original_run_id: str, params: dict | None = None) -> dict:
    params = params or {}
    meta = {
        'original_run_id': original_run_id,
        'replayed_at': datetime.now(UTC).isoformat(),
    }
    if mlflow:
        try:
            mlflow.set_experiment('replays')
            with mlflow.start_run(run_name=f"replay-{original_run_id}"):
                mlflow.log_param('original_run_id', original_run_id)
                for k,v in params.items():
                    mlflow.log_param(f'replay_{k}', v)
                # small artifact marker
                with tempfile.NamedTemporaryFile(delete=False, suffix='_replay.txt') as tf:
                    tf.write(f"Replay of {original_run_id}\n".encode('utf-8'))
                    path = tf.name
                try:
                    mlflow.log_artifact(path)
                except Exception:
                    pass
                meta['mlflow_run_id'] = mlflow.active_run().info.run_id
        except Exception as e:
            log.warning(f'mlflow_replay_failed error={e}')
    else:
        log.info('mlflow_not_configured_replay_stub')
    return meta

__all__ = ['replay_run']
