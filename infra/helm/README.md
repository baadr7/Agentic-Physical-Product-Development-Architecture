# Makerkit Helm Charts

This directory contains individual charts for core platform components:

| Chart | Purpose |
|-------|---------|
| makerkit-api | FastAPI application backend |
| makerkit-diffusion | Diffusion GPU microservice (optional ControlNet) |
| makerkit-worker | Celery worker for async processing |
| makerkit-redis | Redis for rate limiting / Celery broker |

## Linting
Requires Helm CLI installed.

```powershell
# From repo root
helm lint ./infra/helm/api
helm lint ./infra/helm/diffusion
helm lint ./infra/helm/worker
helm lint ./infra/helm/redis
```

## Rendering Templates
```powershell
helm template dev ./infra/helm/api --values ./infra/helm/api/values.yaml
```

## Installation (example local cluster)
```powershell
helm install api ./infra/helm/api
helm install diffusion ./infra/helm/diffusion
helm install redis ./infra/helm/redis
helm install worker ./infra/helm/worker
```

## Enabling TopOpt Solver
Set environment variable in API chart values:
```yaml
env:
  TOPOPT_SOLVER: "1"
```
Or pass at install time:
```powershell
helm install api ./infra/helm/api --set env.TOPOPT_SOLVER=1
```

## GPU Notes
The diffusion chart assumes an NVIDIA device plugin when `gpu.enabled=true`.

## Prometheus Metrics
`/metrics` endpoint is exposed by the API chart (enable scraping via your Prometheus configuration).

## Future Enhancements
- Umbrella chart aggregating subcharts.
- Secret management via external Secrets / SOPS.
- Optional ingress TLS configuration examples.
