# Contributing

Thank you for contributing to Makerkit — Next.js Supabase SaaS Starter Kit (Lite).

This document explains how to set up a local dev environment, run tests, and open a
pull request.

Repository layout (short):
- `apps/web/` — Next.js frontend
- `apps/api/` — FastAPI backend and worker code
- `packages/` — shared packages (ui, features, etc.)

Branch strategy
- Work on feature branches off `topopt-work` (or `main` for smaller fixes).
- Open PRs to `topopt-work` while doing feature work; include tests and description.

Coding conventions
- TypeScript: follow ESLint/Prettier configs in the repo.
- Python: use `black` for formatting and `ruff` for linting when available.

Running the API locally
1. Activate the venv:
```powershell
& '.\apps\api\.venv\Scripts\Activate.ps1'
```
2. Install dependencies (if not already done):
```powershell
python -m pip install --upgrade pip
pip install -r apps/api/requirements.txt
pip install -r apps/api/requirements-dev.txt
```
3. Run tests:
```powershell
Set-Location -Path 'c:\Users\MSI\Documents\Makerkit\nextjs-saas-starter-kit-lite'
$env:PYTHONPATH = "${PWD};${PWD}\apps\api"
& '.\apps\api\.venv\Scripts\python.exe' -m pytest -q
```

Pull request checklist
- [ ] Add or update tests for new features/bugs
- [ ] Lint and format your changes
- [ ] Update `README.md` or relevant docs if behavior changed

If you need help, open an issue describing the problem and environment.
