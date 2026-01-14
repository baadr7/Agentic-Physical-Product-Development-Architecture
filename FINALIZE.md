Finalization Checklist — Makerkit (local dev)

This document collects the final steps to verify the Makerkit end-to-end generation flow (Hugging Face LLM + image inference + Next.js UI + optional Supabase storage).

Prerequisites
- Windows PowerShell (you have it).
- `py` Python 3.10+ available on PATH.
- `pnpm` installed for the Next.js monorepo (or use `npm`/`yarn` after adapting commands).
- A Hugging Face API key with access to the image model you intend to use (set `HUGGINGFACE_API_KEY`).
- Optional: Supabase project + service role key + storage bucket if you want persisted variant assets.

Required environment variables (examples)
- `HUGGINGFACE_API_KEY` – required for LLM and HF image forwarder.
- `HF_IMAGE_MODEL` – optional, e.g. `stabilityai/stable-diffusion-xl-base-1.0`.
- `SUPABASE_URL`, `SUPABASE_KEY`, `SUPABASE_STORAGE_BUCKET` – optional for persistence.
- `CORS_EXTRA_ORIGIN` – optional if UI runs from a different host.

Quick start (PowerShell)
1) Prepare the API venv and install dependencies (only needed once):
```powershell
Push-Location "C:\Users\MSI\Documents\Makerkit\nextjs-saas-starter-kit-lite\apps\api"
py -3 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -U pip setuptools wheel
.\.venv\Scripts\pip.exe install -r requirements.txt
.\.venv\Scripts\pip.exe install uvicorn
Pop-Location
```

2) Start the API (example with HF key):
```powershell
$env:HUGGINGFACE_API_KEY="hf_..."
$env:HF_IMAGE_MODEL="stabilityai/stable-diffusion-xl-base-1.0"
# Optional supabase envs
#$env:SUPABASE_URL="https://xxxx.supabase.co"
#$env:SUPABASE_KEY="service_role_key"
#$env:SUPABASE_STORAGE_BUCKET="prototype_gen"

Push-Location "C:\Users\MSI\Documents\Makerkit\nextjs-saas-starter-kit-lite\apps\api"
.\.venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000
Pop-Location
```
Watch logs. If you use remote HF image model, local heavy ML deps are not required. If you want local `diffusers` GPU generation, install the appropriate packages and hardware drivers.

3) Start the Next.js UI
```powershell
Push-Location "C:\Users\MSI\Documents\Makerkit\nextjs-saas-starter-kit-lite"
pnpm install
pnpm --filter apps/web dev
Pop-Location
```
Open http://localhost:3000 and navigate to a project → Generate. Use the Preview button to quickly generate a 1080×1080 preview image. The client will auto-create a lightweight run to persist previews.

4) Automated test: create run + preview + save image
```powershell
Push-Location "C:\Users\MSI\Documents\Makerkit\nextjs-saas-starter-kit-lite"
# ensure API is running
.\scripts\test_preview_and_persist.ps1 -HfApiKey "hf_..." -HfImageModel "stabilityai/stable-diffusion-xl-base-1.0" -ProjectId "proj-demo"
Pop-Location
```
This script will create a run, request a preview, save `out_preview_test.png` in the repo root, and print whether persistence succeeded and the public URL when available.

Troubleshooting
- If the API logs show import errors for `torch`, `diffusers`, `transformers`, `cv2` — those are only required for local diffusion; HF remote forwarder will still work if `HUGGINGFACE_API_KEY` + `HF_IMAGE_MODEL` are set.
- If HF inference returns 403/401, confirm your `HUGGINGFACE_API_KEY` is valid and the `HF_IMAGE_MODEL` is accessible by your account.
- If persistence fails, check Supabase service key and bucket settings; server logs contain `preview_persist_failed` debug entries.

What I changed in the repo
- Replaced Ollama/Mistral bridge with a Hugging Face wrapper.
- Added HF image forwarder support in the diffusion pipeline.
- Changed default resolution to 1080×1080 in worker and UI.
- Diffusion API returns binary PNG when requested plus persistence headers.
- UI Preview auto-creates a lightweight run and displays persistence feedback.
- Added `scripts/test_preview_and_persist.ps1` for automated verification.

If you want me to finish any of these optional follow-ups, tell me which one:
- Add CI tests that mock HF + Supabase (useful for automatic validation).
- Implement retry logic and health metrics for persistence uploads.
- Persist preview variants server-side as full variant rows (already implemented for Supabase on preview upload).

If everything looks good I can proceed with adding CI/test scaffolding next, or help you run the above steps and debug logs you paste here.
