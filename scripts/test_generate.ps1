param(
  [string]$Title,
  [string]$Prompt,
  [string]$OutFile
)

$ErrorActionPreference = 'Stop'

if (-not $Title -or $Title -eq '') { $Title = 'CHAIR' }
if (-not $Prompt -or $Prompt -eq '') { $Prompt = 'Generate an ergonomic chair' }
if (-not $OutFile -or $OutFile -eq '') { $OutFile = "$PSScriptRoot\output.png" }

# 1) Activate API venv and ensure Mistral key
Push-Location "$PSScriptRoot\..\apps\api"
& .\.venv\Scripts\Activate.ps1
if (-not $env:MISTRAL_API_KEY -or $env:MISTRAL_API_KEY -eq '') {
  $env:MISTRAL_API_KEY = '92409x0S49cz6SXq9wqxUBxWGyzHwrBz'
}

# 2) Start API in background job
Write-Host "Starting API server (uvicorn)..."
$apiJob = Start-Job -ScriptBlock { 
  Push-Location "$using:PSScriptRoot\..\apps\api"; 
  & python -m uvicorn main:app --host 0.0.0.0 --port 8000 
}

# 3) Wait for health
Write-Host "Waiting for health..."
$ok = $false
for ($i=0; $i -lt 20; $i++) {
  try {
    $resp = Invoke-RestMethod -Uri 'http://localhost:8000/api/v1/health' -Method GET -TimeoutSec 3
    if ($resp.status -eq 'ok') { $ok = $true; break }
  } catch { Start-Sleep -Milliseconds 500 }
}
if (-not $ok) { throw 'API health check failed' }

# 4) Create project
Write-Host "Creating project..."
$proj = @{ title = $Title; description = 'Created via script'; constraints = @{}; logo_url = '' } | ConvertTo-Json
$projResp = Invoke-RestMethod -Uri 'http://localhost:8000/api/v1/projects' -Method POST -ContentType 'application/json' -Body $proj
$projectId = $projResp.id
if (-not $projectId) { throw 'Project creation failed' }

# 5) Create run
Write-Host "Creating run..."
$runBody = @{ project_id = $projectId; prompt = $Prompt; params = @{ target = "mass"; max_weight = 1.5 } } | ConvertTo-Json
$runResp = Invoke-RestMethod -Uri 'http://localhost:8000/api/v1/runs' -Method POST -ContentType 'application/json' -Body $runBody
$runId = $runResp.run_id
if (-not $runId) { throw 'Run creation failed' }

# 6) Poll variants
Write-Host "Polling variants..."
$variant = $null
for ($i=0; $i -lt 20; $i++) {
  $vars = Invoke-RestMethod -Uri "http://localhost:8000/api/v1/runs/$runId/variants" -Method GET -TimeoutSec 5
  if ($vars -and $vars.Count -gt 0) { $variant = $vars[0]; break }
  Start-Sleep -Milliseconds 500
}
if (-not $variant) { throw 'No variants produced' }

# 7) Save image (placeholder or real)
Write-Host "Saving image..."
$imgUrl = $variant.image_url
if ($imgUrl -and $imgUrl.StartsWith('http')) {
  Invoke-RestMethod -Uri $imgUrl -OutFile $OutFile -TimeoutSec 10
} else {
  # If data URL, extract base64
  if ($imgUrl -and $imgUrl.StartsWith('data:image/png;base64,')) {
    $b64 = $imgUrl.Substring('data:image/png;base64,'.Length)
    [IO.File]::WriteAllBytes($OutFile, [Convert]::FromBase64String($b64))
  }
}

Write-Host "Done. Image saved to: $OutFile"

# Keep API running briefly, then stop job
Start-Sleep -Seconds 2
Try { Stop-Job $apiJob -Force | Out-Null } Catch {}
Pop-Location
