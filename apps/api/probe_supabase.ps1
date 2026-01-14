param(
  [string]$EnvPath = "$PSScriptRoot\.env"
)

function Read-DotEnv([string]$path) {
  if (-not (Test-Path -LiteralPath $path)) {
    throw "Missing .env at: $path"
  }

  $map = @{}
  Get-Content -LiteralPath $path -Encoding UTF8 | ForEach-Object {
    $line = $_.Trim()
    if (-not $line) { return }
    if ($line.StartsWith('#')) { return }
    if ($line -notmatch '=') { return }

    $parts = $line.Split('=', 2)
    $k = $parts[0].Trim()
    $v = $parts[1].Trim()

    # Strip surrounding quotes
    if (($v.StartsWith('"') -and $v.EndsWith('"')) -or ($v.StartsWith("'") -and $v.EndsWith("'"))) {
      $v = $v.Substring(1, $v.Length - 2)
    }

    $map[$k] = $v
  }
  return $map
}

function Invoke-SupabaseProbe([string]$name, [string]$url, [string]$key) {
  if (-not $url) {
    Write-Host "${name}: missing SUPABASE_URL" -ForegroundColor Yellow
    return
  }
  if (-not $key) {
    Write-Host "${name}: missing key" -ForegroundColor Yellow
    return
  }

  $headers = @{ apikey = $key; Authorization = "Bearer $key" }
  try {
    $resp = Invoke-WebRequest -UseBasicParsing -Uri "$url/rest/v1/" -Headers $headers -Method GET -TimeoutSec 10
    $len = 0
    if ($resp.Content) { $len = [int]$resp.Content.Length }
    Write-Host ("{0}: {1} contentLength={2}" -f $name, $resp.StatusCode, $len)
  } catch {
    $status = $null
    $body = $null
    if ($_.Exception.Response) {
      try { $status = $_.Exception.Response.StatusCode.value__ } catch { }
      try {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $body = $reader.ReadToEnd()
      } catch { }
    }
    if ($status) {
      $len = 0
      if ($body) { $len = [int]$body.Length }
      Write-Host ("{0}: {1} contentLength={2}" -f $name, $status, $len) -ForegroundColor Red
    } else {
      Write-Host ("{0}: error {1}" -f $name, $_.Exception.Message) -ForegroundColor Red
    }
  }
}

$envMap = Read-DotEnv $EnvPath
$url = $envMap['SUPABASE_URL']
$anon = $envMap['SUPABASE_KEY']
$svc = $envMap['SUPABASE_SERVICE_ROLE_KEY']

Write-Host "url: $url"
Invoke-SupabaseProbe -name 'anon' -url $url -key $anon
Invoke-SupabaseProbe -name 'service_role' -url $url -key $svc
