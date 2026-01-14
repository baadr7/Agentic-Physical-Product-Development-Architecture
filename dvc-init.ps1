Write-Host 'Initializing DVC (stub)...' -ForegroundColor Cyan
if (-not (Test-Path .dvc)) {
  dvc init --no-scm | Out-Null
  Write-Host 'DVC initialized.' -ForegroundColor Green
} else {
  Write-Host 'DVC already initialized.' -ForegroundColor Yellow
}
if (-not (Test-Path data/raw)) { New-Item -ItemType Directory -Path data/raw | Out-Null }
Write-Host 'You can now run: dvc repro' -ForegroundColor Cyan
