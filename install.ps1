$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$repo = "ByHeads/bcadmin"
$appName = "Broadcaster Administrator"
$apiUrl = "https://api.github.com/repos/$repo/releases/latest"
$platform = "windows"
$arch = if ([Environment]::Is64BitOperatingSystem) { "x64" } else { "x86" }
$tmpFile = $null

function Write-Banner {
    param(
        [string]$VersionTag
    )

    Write-Host
    $line5 = "|| || || ||   ___     __      _      _     __           __   "
    $line5 += $VersionTag.PadLeft(7)
    $line5 += "   /"
    Write-Host "____________________________________________________________________________"
    Write-Host "                 ___                   __             __               /"
    Write-Host "                / _ )_______  ___ ____/ /______ ____ / /____ ____      \"
    Write-Host "   |\ |\       / _  / __/ _ \/ _ ``/ _  / __/ _ ``(_-</ __/ -_) __/      /"
    Write-Host "|\ || || |\   /____/_/  \___/\_,_/\_,_/\__/\_,_/___/\__/\__/_/         \"
    Write-Host $line5
    Write-Host "\| || || \|  / _ |___/ /_ _  (_)__  (_)__ / /________ _/ /____  ____   \"
    Write-Host "   \| \|    / __ / _  /  ' \/ / _ \/ (_-</ __/ __/ _ ``/ __/ _ \/ __/   /"
    Write-Host "           /_/ |_\_,_/_/_/_/_/_//_/_/___/\__/_/  \_,_/\__/\___/_/     \"
    Write-Host "          <>------------------------------------------------------<>   /"
    Write-Host "_______________________________________________________________________\"
    Write-Host
}

function Write-Step([string]$Message) {
    Write-Host -NoNewline "> $Message... "
}

function Write-Done {
    Write-Host "Done!"
}

try {
    if ($PSVersionTable.PSVersion -lt [Version]'5.1') {
        throw "PowerShell 5.1 or newer is required. Detected $($PSVersionTable.PSVersion)."
    }

    Write-Step "Fetching the latest $appName release from GitHub"

    $release = Invoke-RestMethod -Uri $apiUrl -Headers @{ 'User-Agent' = 'bcadmin-installer' }
    $version = $release.tag_name
    Write-Done
    Write-Banner -VersionTag $version
    Write-Host "> Detected platform: $platform ($arch)"
    Write-Host "> Latest version: $version"

    $asset = $release.assets | Where-Object { $_.name -match 'setup\.exe$' } | Select-Object -First 1

    if (-not $asset) {
        throw "Could not find the Windows installer in release $version."
    }

    $downloadUrl = $asset.browser_download_url
    $tmpFile = Join-Path $env:TEMP "bcadmin-setup.exe"

    Write-Step "Pulling the $appName installer from GitHub"
    Invoke-WebRequest -Uri $downloadUrl -OutFile $tmpFile -UseBasicParsing
    Write-Done

    Write-Step "Running the installer"
    $installer = Start-Process -FilePath $tmpFile -Wait -PassThru
    Write-Done

    if ($installer.ExitCode -ne 0) {
        throw "The installer exited with code $($installer.ExitCode)."
    }

    if ($tmpFile) {
        Remove-Item $tmpFile -Force -ErrorAction SilentlyContinue
    }
    Write-Host "> All done! $appName was successfully installed!" -ForegroundColor Green
}
catch {
    if ($tmpFile) {
        Remove-Item $tmpFile -Force -ErrorAction SilentlyContinue
    }
    Write-Host "> Installation failed: $($_.Exception.Message)" -ForegroundColor Red
    return
}
