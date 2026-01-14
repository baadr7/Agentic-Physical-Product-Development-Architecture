param(
  [string]$HfApiKey = $env:HUGGINGFACE_API_KEY,
  [string]$HfImageModel = $env:HF_IMAGE_MODEL,
  [string]$ProjectId = 'proj-demo'
)

if (-not $HfApiKey) {
  Write-Host "Warning: HUGGINGFACE_API_KEY not set. HF image forwarder may fail." -ForegroundColor Yellow
}

# 1) Create a lightweight run with skip_processing
$runPayload = @{
  project_id = $ProjectId
  input_mode = 'text'
  description = 'preview-test-run'
  constraints = @{}
  options = @{}
  skip_processing = $true
} | ConvertTo-Json

$runResp = Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:8000/api/v1/runs" -Body $runPayload -ContentType 'application/json'
Write-Host "Created run:" $runResp.run_id

# 2) Call diffusion generate with run_id + variant_id and request image/png
$variantId = 'var-test-' + ([System.Guid]::NewGuid().ToString('n').Substring(0,8))
$genPayload = @{
  prompt = 'Product photo of a small flexible phone stand in PLA, studio lighting'
  width = 1080
  height = 1080
  steps = 28
  guidance_scale = 7.5
  run_id = $runResp.run_id
  variant_id = $variantId
} | ConvertTo-Json

$uri = "http://127.0.0.1:8000/api/v1/diffusion/generate"
$req = Invoke-WebRequest -Uri $uri -Method Post -Body $genPayload -ContentType 'application/json' -Headers @{ Accept = 'image/png, application/octet-stream, application/json' } -TimeoutSec 120 -ErrorAction Stop

# If content-type is image, save as out.png and print X-Public-Url
if ($req.ContentType -like 'image/*') {
  $out = 'out_preview_test.png'
  # Read raw content stream into byte array safely
  $ms = $req.RawContentStream
  $bytes = New-Object byte[] $ms.Length
  $null = $ms.Read($bytes, 0, $ms.Length)
  [System.IO.File]::WriteAllBytes($out, $bytes)
  Write-Host "Saved binary image to $out"
  # Headers can be lowercase depending on PowerShell; check both
  $persisted = $req.Headers['X-Persisted'] -or $req.Headers['x-persisted']
  $publicUrl = $req.Headers['X-Public-Url'] -or $req.Headers['x-public-url']
  if ($publicUrl) { $publicUrl = $publicUrl -replace '\\', '/' }
  Write-Host "X-Persisted: $persisted"
  if ($publicUrl) { Write-Host "Public URL: $publicUrl" }
} else {
  $json = $req.Content | ConvertFrom-Json
  $b64 = $json.image_b64
  if ($b64) {
    $bytes = [System.Convert]::FromBase64String($b64)
    [System.IO.File]::WriteAllBytes('out_preview_test.png', $bytes)
    Write-Host "Saved JSON->base64 image to out_preview_test.png"
  }
  Write-Host "persisted:" $json.persisted
  if ($json.public_url) { Write-Host "public_url: $($json.public_url)" }
}
