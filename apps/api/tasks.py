"""Celery task definitions for asynchronous run processing.

This module wires the existing synchronous `process_run` logic from `worker.py`
into a Celery task so we can execute heavier pipelines (LLM, diffusion, CAD, FEM)
outside the FastAPI request lifecycle.

Environment variables:
- CELERY_BROKER_URL (default: redis://localhost:6379/0)
- CELERY_BACKEND_URL (default: redis://localhost:6379/0)
- CELERY_QUEUE (default: runs)
- CELERY_ENABLED=1 to make the API enqueue tasks instead of BackgroundTasks.

To start a local Redis broker (PowerShell):
  docker run -p 6379:6379 redis:7-alpine

To start a Celery worker (PowerShell):
  $env:CELERY_BROKER_URL="redis://localhost:6379/0"; `
  $env:CELERY_BACKEND_URL="redis://localhost:6379/0"; `
  celery -A tasks.celery_app worker -l info -Q runs

To run the API (PowerShell):
  uvicorn main:app --reload --port 8000
"""
from __future__ import annotations

import os
from celery import Celery

BROKER_URL = os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/0")
BACKEND_URL = os.getenv("CELERY_BACKEND_URL", BROKER_URL)
QUEUE_NAME = os.getenv("CELERY_QUEUE", "runs")

celery_app = Celery("makerkit", broker=BROKER_URL, backend=BACKEND_URL)
celery_app.conf.task_default_queue = QUEUE_NAME
celery_app.conf.task_routes = {
    "process_run_task": {"queue": QUEUE_NAME},
}

@celery_app.task(name="process_run_task")
def process_run_task(run_id: str, project_id: str) -> dict:
    """Celery wrapper around the synchronous `process_run` function.

    Returns a small status dict so callers can introspect or chain tasks.
    """
    try:
        from .worker import process_run  # relative import when package
    except Exception:
        from worker import process_run   # fallback when executed directly

    process_run(run_id, project_id)
    return {"run_id": run_id, "project_id": project_id, "status": "completed"}
