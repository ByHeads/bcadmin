#Requires -Version 5.1
$ErrorActionPreference = 'Stop'

$repo = "ByHeads/bcadmin"
$apiUrl = "https://api.github.com/repos/$repo/releases/latest"

Write-Host "[INFO] Fetching latest release..." -ForegroundColor Green

$release = Invoke-RestMethod -Uri $apiUrl -Headers @{ 'User-Agent' = 'bcadmin-installer' }
$version = $release.tag_name
Write-Host "[INFO] Latest version: $version" -ForegroundColor Green

$asset = $release.assets | Where-Object { $_.name -match 'setup\.exe$' } | Select-Object -First 1

if (-not $asset) {
    Write-Host "[ERROR] Could not find Windows installer in release $version" -ForegroundColor Red
    exit 1
}

$downloadUrl = $asset.browser_download_url
$tmpFile = Join-Path $env:TEMP "bcadmin-setup.exe"

Write-Host "[INFO] Downloading $downloadUrl..." -ForegroundColor Green
Invoke-WebRequest -Uri $downloadUrl -OutFile $tmpFile -UseBasicParsing

Write-Host "[INFO] Running installer..." -ForegroundColor Green
Start-Process -FilePath $tmpFile -Wait

Remove-Item $tmpFile -Force -ErrorAction SilentlyContinue
Write-Host "[INFO] bcadmin $version installed!" -ForegroundColor Green
