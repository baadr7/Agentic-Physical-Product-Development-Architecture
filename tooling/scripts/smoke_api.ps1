param(
  [string]$BaseUrl = 'http://127.0.0.1:8001',
  [switch]$SkipRun
)
Write-Host "[smoke] base URL: $BaseUrl" -ForegroundColor Cyan

function Show-Step($name) { Write-Host "`n=== $name ===" -ForegroundColor Yellow }

Show-Step 'Health'
Invoke-RestMethod "$BaseUrl/health" | Format-List

Show-Step 'Projects (list)'
$projects = Invoke-RestMethod "$BaseUrl/api/v1/projects"
$projects | ConvertTo-Json -Depth 4

Show-Step 'Create Project'
$proj = Invoke-RestMethod -Method Post -ContentType 'application/json' -Body '{"title":"Smoke Project"}' "$BaseUrl/api/v1/projects"
$proj | Format-List

if(-not $SkipRun) {
  Show-Step 'Create Run'
  $runBody = @{ project_id = $proj.id } | ConvertTo-Json
  $run = Invoke-RestMethod -Method Post -ContentType 'application/json' -Body $runBody "$BaseUrl/api/v1/runs"
  $run | Format-List

  Show-Step 'List Variants (initial)'
  Start-Sleep -Seconds 2
  $variants = Invoke-RestMethod "$BaseUrl/api/v1/runs/$($run.run_id)/variants"
  $variants | ConvertTo-Json -Depth 5

  if($variants.value.Count -gt 0) {
    $variantId = $variants.value[0].id
    Show-Step "Variant Detail ($variantId)"
    try {
      $detail = Invoke-RestMethod "$BaseUrl/api/v1/variants/$variantId/detail"
      $detail | ConvertTo-Json -Depth 6
    } catch { Write-Host "Variant detail error: $_" -ForegroundColor Red }
  }
}

Show-Step 'Export Presign (stub)'
try {
  if($run.run_id) {
    $exportBody = @{ run_id = $run.run_id; kind = 'pdf' } | ConvertTo-Json
    $presign = Invoke-RestMethod -Method Post -ContentType 'application/json' -Body $exportBody "$BaseUrl/api/v1/exports/presign"
    $presign | Format-List
  }
} catch { Write-Host "Presign error: $_" -ForegroundColor Red }

Write-Host "`n[smoke] Completed." -ForegroundColor Green
