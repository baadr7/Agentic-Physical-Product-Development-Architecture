# Start the API (uvicorn), Next.js frontend (pnpm dev for web), then run the preview test
# Usage: run from repository root in PowerShell
# Requires: Python venv at ./apps/api/.venv or repo .venv, pnpm installed, node installed
# Set env vars before running (example):
#   $env:HUGGINGFACE_API_KEY='...' ; $env:SUPABASE_URL='https://...' ; $env:SUPABASE_KEY='...'

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
# If this script is inside scripts/ when executed by double-click, ensure correct root
if (-not (Test-Path "$repoRoot\apps\api\main.py")) {
    $repoRoot = Resolve-Path "..\"
}

# Paths
$apiPath = Join-Path $repoRoot "apps\api"
$webPath = Join-Path $repoRoot "apps\web"
$testScript = Join-Path $repoRoot "scripts\test_preview_and_persist.ps1"

Write-Host "Starting API in new window..."
# Start API in new PowerShell window; activate virtualenv if present
$apiCmd = "cd '$apiPath'; if (Test-Path '.venv') { . .\.venv\Scripts\Activate.ps1 } elseif (Test-Path '..\\.venv') { . ..\.venv\Scripts\Activate.ps1 }; uvicorn main:app --reload --host 127.0.0.1 --port 8000"
Start-Process -FilePath powershell -ArgumentList '-NoExit','-Command',$apiCmd -WindowStyle Normal

Write-Host "Starting Next.js web frontend in new window..."
# Start Next.js in new PowerShell window using pnpm (monorepo filter); adjust if you use npm/yarn
$webCmd = "cd '$repoRoot'; pnpm --filter web dev"
Start-Process -FilePath powershell -ArgumentList '-NoExit','-Command',$webCmd -WindowStyle Normal

Write-Host "Waiting 8 seconds for services to boot..."
Start-Sleep -Seconds 8

if (Test-Path $testScript) {
    Write-Host "Running preview + persist test script (will call API)"
    & $testScript
} else {
    Write-Host "Test script not found: $testScript"
}
