<#
Script: run_generate_and_save.ps1
Purpose: Start the FastAPI app, request a 1080x1080 image via the diffusion endpoint
         (uses HF forwarder when `HUGGINGFACE_API_KEY` and `HF_IMAGE_MODEL` are set),
         save the returned base64 PNG to `out.png`, then stop the server.

Usage (PowerShell):
  1) From repository root `nextjs-saas-starter-kit-lite` run:
     .\scripts\run_generate_and_save.ps1 -HfApiKey "hf_xxx" -HfImageModel "stabilityai/stable-diffusion-xl-base-1.0"

  2) The script will start the API server using the `.venv` inside `apps/api`.

Notes:
  - You must have created the venv and installed deps in `apps/api/.venv` (the project already provides commands).
  - The script uses the local python executable at `apps/api/.venv\Scripts\python.exe`.
  - The resulting image is saved as `out.png` in the repo root.
#>
param(
  [string]$HfApiKey = $env:HUGGINGFACE_API_KEY,
  [string]$HfImageModel = $env:HF_IMAGE_MODEL,
  [int]$Width = 1080,
  [int]$Height = 1080,
  [string]$Prompt = "A realistic, high-resolution product photo of a small aluminum bracket on white background, studio lighting",
  [int]$Steps = 20,
  [double]$Guidance = 7.5,
  [int]$TimeoutSeconds = 180
)

# Ensure we run from the script folder -> compute repo root
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$repoRoot = Resolve-Path (Join-Path $scriptDir "..")
Set-Location $repoRoot
Write-Output "Repository root: $repoRoot"

# Validate .venv python
$apiDir = Join-Path $repoRoot "apps\api"
$pythonExe = Join-Path $apiDir ".venv\Scripts\python.exe"
if (-not (Test-Path $pythonExe)) {
  Write-Error "Python executable not found at $pythonExe. Ensure you created the venv and installed dependencies (see apps/api/README)."
  exit 1
}

# Ensure HF variables are set or prompt
if (-not $HfApiKey) {
  $HfApiKey = Read-Host -Prompt "Enter HUGGINGFACE_API_KEY (or press Enter to continue without it -> fallback heuristic)"
}
if (-not $HfImageModel) {
  $HfImageModel = Read-Host -Prompt "Enter HF_IMAGE_MODEL (e.g. stabilityai/stable-diffusion-xl-base-1.0) or press Enter to skip"
}

# Export env vars for the spawned server process
$env:HUGGINGFACE_API_KEY = $HfApiKey
$env:HF_IMAGE_MODEL = $HfImageModel

# Start the FastAPI server with uvicorn in background
Write-Output "Starting FastAPI (uvicorn) using: $pythonExe"
$uvArgs = "-m uvicorn main:app --host 127.0.0.1 --port 8000"
$startInfo = Start-Process -FilePath $pythonExe -ArgumentList $uvArgs -WorkingDirectory $apiDir -NoNewWindow -PassThru
Write-Output "Started uvicorn (PID=$($startInfo.Id)). Waiting for readiness..."

# Wait for health endpoint
$healthUrl = 'http://127.0.0.1:8000/api/v1/health'
$ready = $false
$deadline = (Get-Date).AddSeconds(60)
while (-not $ready -and (Get-Date) -lt $deadline) {
  try {
    $r = Invoke-RestMethod -Uri $healthUrl -Method Get -TimeoutSec 5
    if ($r -and $r.status -eq 'ok') { $ready = $true; break }
  } catch {
    Start-Sleep -Seconds 1
  }
}
if (-not $ready) {
  Write-Warning "API did not become ready within 60s. Check server logs in the API window."
}
else {
  Write-Output "API ready. Calling diffusion generate..."
}

# Build payload and call diffusion generate
$genUrl = 'http://127.0.0.1:8000/api/v1/diffusion/generate'
$payload = @{
  prompt = $Prompt
  width = $Width
  height = $Height
  steps = $Steps
  guidance_scale = $Guidance
} | ConvertTo-Json

try {
  # Prefer image/png response by setting Accept header; handle both binary and JSON responses
  $headers = @{ Accept = 'image/png, application/octet-stream, application/json' }
  $resp = Invoke-WebRequest -Uri $genUrl -Method Post -Body $payload -ContentType 'application/json' -Headers $headers -TimeoutSec $TimeoutSeconds -UseBasicParsing
} catch {
  Write-Error "Generation request failed: $_"
  # Stop server
  try { Stop-Process -Id $startInfo.Id -ErrorAction SilentlyContinue } catch {}
  exit 1
}

if (-not $resp) { Write-Error "No response from generation endpoint"; Stop-Process -Id $startInfo.Id -ErrorAction SilentlyContinue; exit 1 }

# If we got a binary image (Content-Type image/*), save it directly
$contentType = $resp.Headers['Content-Type'] -as [string]
if ($contentType -and $contentType.StartsWith('image/')) {
  $outPath = Join-Path $repoRoot 'out.png'
  try {
    $resp.ContentStream.Position = 0
  } catch {}
  try {
    $fs = [IO.File]::OpenWrite($outPath)
    try { $resp.ContentStream.CopyTo($fs) } finally { $fs.Close() }
    Write-Output "Saved binary image to: $outPath (Content-Type=$contentType)"
  } catch {
    Write-Error "Failed to write binary image: $_"
  }
} else {
  # Otherwise assume JSON with image_b64
  try {
    $json = $resp.Content | ConvertFrom-Json -ErrorAction Stop
    if ($json.image_b64) {
      $outPath = Join-Path $repoRoot 'out.png'
      $bytes = [Convert]::FromBase64String($json.image_b64)
      [IO.File]::WriteAllBytes($outPath, $bytes)
      Write-Output "Saved generated image to: $outPath  (backend=$($json.backend))"
    } else {
      Write-Warning "No image_b64 field in JSON response. Full response:`n$($resp.Content)"
    }
  } catch {
    Write-Error "Failed to parse response as JSON or save image: $_"
  }
}

# Stop server (best-effort)
try {
  Stop-Process -Id $startInfo.Id -ErrorAction SilentlyContinue
  Write-Output "Stopped uvicorn (PID=$($startInfo.Id))."
} catch {
  Write-Warning "Failed to stop uvicorn process. You may need to stop it manually."
}

Write-Output "Done."
