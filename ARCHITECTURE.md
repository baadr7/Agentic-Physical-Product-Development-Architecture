# Makerkit Architecture Overview

## Components
- FastAPI API (apps/api): Authentication (JWT), RBAC, multi-tenancy, project/run lifecycle, scoring, exports.
- Diffusion Service (apps/diffusion): Stub endpoints for text2image & sketch2image, future ControlNet integration.
- Streamlit PoC (apps/streamlit): Lightweight UI for projects, runs, variants.
- Scoring & DfX: Heuristic module `scoring.py` + CAD (`cad_stub.py`) + FEM (`fem_stub.py`) synthesis.
- MLOps: MLflow param & artifact logging, ZIP packaging endpoint, audit & metrics.

## Data Flow
1. User creates Project -> audit event logged.
2. User creates Run -> MLflow params logged; background processing (future tasks).
3. Variant synthesis combines CAD stub + FEM stub metrics -> DfX scores -> presented to UI.
4. Diffusion endpoints generate placeholder images (future stable diffusion model replacement).
5. Exports produce presigned URLs or stub ZIP/PDF with DfX report.
6. Audit/metrics endpoints provide governance and performance insight.

## Multi-Tenancy
- JWT contains `tenant` claim.
- Endpoints filter by `tenant_id` and forbid cross-tenant access.

## Extensibility Targets
- Replace stubs with real CAD generator, FEM solver, diffusion model.
- Add persistence for weights, metrics, artifacts.
- Integrate version tracking via DVC (stub present) and object storage.

## CI Pipeline
- Backend tests, lint, diffusion image build, Streamlit type-check, e2e smoke tests.

## Future Enhancements
- ControlNet sketch guidance
- Advanced i18n resources
- Production-ready rate limiting & caching strategies
- Observability (traces, metrics, structured logs already partially present)
