# Starts the Celery worker from the correct folder with Windows-safe settings.

Push-Location "$PSScriptRoot/.."

# Prefer a Python 3.12 venv for diffusers/torch compatibility on Windows.
if (Test-Path ".\.venv312\Scripts\Activate.ps1") {
    & .\.venv312\Scripts\Activate.ps1
} else {
    & .\.venv\Scripts\Activate.ps1
}

# Ensure broker and feature flags
if (-not $env:REDIS_URL) { $env:REDIS_URL = "redis://127.0.0.1:6379/0" }
$env:CELERY_ENABLED = "1"

# Load optional keys from .env.local
$envPath = "$PWD/.env.local"
if (Test-Path $envPath) {
    Get-Content $envPath | ForEach-Object {
        if ($_ -match '^(SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY|SUPABASE_KEY|SUPABASE_STORAGE_BUCKET|REDIS_URL|CELERY_ENABLED)=') {
            $parts = $_ -split '=', 2
            if ($parts.Length -eq 2) { Set-Item -Path ("env:" + $parts[0]) -Value $parts[1] }
        }
    }
}

python -m celery -A tasks.celery_app worker --loglevel=INFO --pool solo
