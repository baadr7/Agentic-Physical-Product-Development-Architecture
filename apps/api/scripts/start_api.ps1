# Starts the FastAPI server (uvicorn) from the correct folder with the venv.
param(
    [int]$Port = 8000
)

Push-Location "$PSScriptRoot/.."

# Prefer a Python 3.12 venv for diffusers/torch compatibility on Windows.
if (Test-Path ".\.venv312\Scripts\Activate.ps1") {
    & .\.venv312\Scripts\Activate.ps1
} else {
    & .\.venv\Scripts\Activate.ps1
}

# Load key envs from .env.local if present
$envPath = "$PWD/.env.local"
if (Test-Path $envPath) {
    Get-Content $envPath | ForEach-Object {
        if ($_ -match '^(SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY|SUPABASE_KEY|SUPABASE_STORAGE_BUCKET|CELERY_ENABLED|REDIS_URL)=') {
            $parts = $_ -split '=', 2
            if ($parts.Length -eq 2) { Set-Item -Path ("env:" + $parts[0]) -Value $parts[1] }
        }
    }
}

python -m uvicorn main:app --host 0.0.0.0 --port $Port
