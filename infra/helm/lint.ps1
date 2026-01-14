Param(
  [string]$Root = "./infra/helm"
)

Write-Host "Linting Helm charts in $Root" -ForegroundColor Cyan
$charts = Get-ChildItem -Path $Root -Directory
foreach ($c in $charts) {
  $chartPath = Join-Path $Root $c.Name
  if (Test-Path (Join-Path $chartPath 'Chart.yaml')) {
    Write-Host "-> helm lint $chartPath" -ForegroundColor Yellow
    helm lint $chartPath
  } else {
    Write-Host "(skip) $chartPath (no Chart.yaml)" -ForegroundColor DarkGray
  }
}
