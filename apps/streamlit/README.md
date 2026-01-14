# Streamlit PoC App

Minimal proof-of-concept UI for the Makerkit API.

Pages:
- Projects: list tenant-scoped projects.
- New Run: create a run for an existing project.
- Variants: view synthetic variants for a run.

## Setup
```bash
pip install -r requirements.txt
streamlit run app.py
```
Environment variables:
- API_BASE (default http://127.0.0.1:8001)
- JWT (Bearer token value without 'Bearer ' prefix)

## Notes
This is a lightweight prototype; no persistence beyond API calls.
