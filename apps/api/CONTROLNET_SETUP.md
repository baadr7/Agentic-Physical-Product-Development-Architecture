ControlNet Setup (Makerkit API)

This project supports conditioning Stable Diffusion runs with ControlNet. There are two modes:

1) Mock mode (for local development / CI)

- Set the environment variable `CONTROLNET_MOCK=1` to enable a lightweight CPU-only mock pipeline. This is useful for CI and unit tests that need to exercise conditioned generation without downloading large model weights.
- Example (PowerShell):

```powershell
$env:CONTROLNET_MOCK = '1'
python -m pytest apps/api/tests/test_diffusion_controlnet_tuning.py
```

2) Real ControlNet (recommended for production / experimentation)

- Required env vars:
  - `SD_MODEL` — the base Stable Diffusion model repo (example: `runwayml/stable-diffusion-v1-5`).
  - `CONTROLNET_MODEL` — the ControlNet model repo id (example: `lllyasviel/sd-controlnet-canny`).
  - `HUGGINGFACE_HUB_TOKEN` (or set via `huggingface-cli login`) if model repos require authentication.

- Installation requirements (see `apps/api/requirements.txt`): `diffusers`, `transformers`, `torch`, `controlnet-aux`.

- Example environment (PowerShell):

```powershell
$env:SD_MODEL = 'runwayml/stable-diffusion-v1-5'
$env:CONTROLNET_MODEL = 'lllyasviel/sd-controlnet-canny'
$env:HUGGINGFACE_HUB_TOKEN = '<your_token>'
# Optionally enable CLIP scoring
$env:CLIP_SCORING_ENABLED = '1'
```

- The API will attempt to load the ControlNet pipeline at startup. If weights are missing or device (GPU) is not available, the pipeline may fall back to CPU, which can be slow.

Notes
- Use `CONTROLNET_MOCK=1` in CI to run fast unit tests without heavy model downloads.
- If you have multiple ControlNet variants, set `CONTROLNET_MODEL` to the desired repo id before starting the service.
- For advanced setups, consider placing model files in a local cache (`~/.cache/huggingface`) and setting `HF_HOME` / `TRANSFORMERS_CACHE` accordingly.
