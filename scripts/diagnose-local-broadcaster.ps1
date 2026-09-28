<#
.SYNOPSIS
    Diagnoses why Broadcaster Administrator does not detect the local Broadcaster.

.DESCRIPTION
    Replays the 'broadcaster:detectLocal' handler in src/main/ipc.ts step by step and
    reports the first step where the app gives up. Read-only: nothing is changed on the
    machine, and API keys are masked in the output.

    Run it as the same user, and with the same elevation, as Broadcaster Administrator,
    and keep Broadcaster Administrator open while it runs.

.PARAMETER AppDir
    Skip process detection and start the appsettings search in this directory.

.PARAMETER SkipHttp
    Do not send the test request to the Broadcaster.

.PARAMETER UserDataDir
    Directory where Broadcaster Administrator keeps connections.json, when it runs as
    another user. Defaults to the current user's %APPDATA%\Broadcaster Administrator.

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File .\diagnose-local-broadcaster.ps1

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File .\diagnose-local-broadcaster.ps1 *> report.txt
#>
[CmdletBinding()]
param(
    [string]$AppDir,
    [switch]$SkipHttp,
    [string]$UserDataDir
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

# Kept identical to src/main/ipc.ts
$wmicCommand = 'wmic process where "name like ''Broadcaster%''" get ExecutablePath /value'
$wmicTimeoutMs = 5000
$settingsNames = @('appsettings.json', 'appsettings.Development.json')
$maxWalkLevels = 5

$adminExeName = 'Broadcaster Administrator.exe'
$localConnectionId = 'local-broadcaster'
$pollSeconds = 5
$isWindowsHost = [System.Environment]::OSVersion.Platform -eq [System.PlatformID]::Win32NT

$findings = New-Object System.Collections.Generic.List[object]
$blocker = $null

function Write-Section([string]$Title) {
    Write-Host
    Write-Host "== $Title" -ForegroundColor Cyan
}

# -Blocks marks a step where the app returns null, i.e. "no local Broadcaster"
function Write-Result {
    param(
        [ValidateSet('OK', 'FAIL', 'WARN', 'INFO')][string]$Level,
        [string]$Message,
        [switch]$Blocks
    )

    $color = 'Gray'
    if ($Level -eq 'OK') { $color = 'Green' }
    if ($Level -eq 'FAIL') { $color = 'Red' }
    if ($Level -eq 'WARN') { $color = 'Yellow' }
    Write-Host ("  [{0}] {1}" -f $Level.PadRight(4), $Message) -ForegroundColor $color

    if ($Level -eq 'FAIL' -or $Level -eq 'WARN') {
        $script:findings.Add([pscustomobject]@{ Level = $Level; Message = $Message })
    }
    if ($Blocks -and -not $script:blocker) { $script:blocker = $Message }
}

function Format-Secret([string]$Value) {
    if ($Value.Length -le 4) { return "**** (length $($Value.Length))" }
    return "$($Value.Substring(0, 2))**** (length $($Value.Length))"
}

# JavaScript property lookup is case-sensitive, PowerShell's is not
function Get-JsonProperty($Object, [string]$Name, [switch]$IgnoreCase) {
    if ($null -eq $Object -or $Object -isnot [System.Management.Automation.PSCustomObject]) { return $null }
    foreach ($property in $Object.PSObject.Properties) {
        if ($property.Name -ceq $Name) { return $property }
        if ($IgnoreCase -and $property.Name -ieq $Name) { return $property }
    }
    return $null
}

function Get-JsonValue($Object, [string]$Name) {
    $property = Get-JsonProperty $Object $Name
    if ($property) { return , $property.Value }
    return $null
}

# Runs the app's query the way Node's child_process.exec does: through cmd.exe, output decoded as UTF-8
function Invoke-AppProcessQuery {
    $result = [pscustomobject]@{
        TimedOut  = $false
        ExitCode  = $null
        StdOut    = ''
        StdErr    = ''
        ElapsedMs = 0
        Error     = $null
    }

    $startInfo = New-Object System.Diagnostics.ProcessStartInfo
    $startInfo.FileName = $env:ComSpec
    $startInfo.Arguments = '/d /s /c "' + $wmicCommand + '"'
    $startInfo.UseShellExecute = $false
    $startInfo.CreateNoWindow = $true
    $startInfo.RedirectStandardInput = $true
    $startInfo.RedirectStandardOutput = $true
    $startInfo.RedirectStandardError = $true
    $startInfo.StandardOutputEncoding = [System.Text.Encoding]::UTF8
    $startInfo.StandardErrorEncoding = [System.Text.Encoding]::UTF8

    $watch = [System.Diagnostics.Stopwatch]::StartNew()
    try {
        $process = [System.Diagnostics.Process]::Start($startInfo)
        $outTask = $process.StandardOutput.ReadToEndAsync()
        $errTask = $process.StandardError.ReadToEndAsync()
        if ($process.WaitForExit($wmicTimeoutMs)) {
            $process.WaitForExit()
            $result.ExitCode = $process.ExitCode
            $result.StdOut = $outTask.Result
            $result.StdErr = $errTask.Result
        } else {
            $result.TimedOut = $true
            try { $process.Kill() } catch { }
        }
    } catch {
        $result.Error = $_.Exception.Message
    }
    $watch.Stop()
    $result.ElapsedMs = $watch.ElapsedMilliseconds
    return $result
}

# Same walk as the app: the start directory plus its parents, five directories in total
function Find-SettingsDir([string]$StartDir) {
    $dir = $StartDir
    for ($i = 0; $i -lt $maxWalkLevels; $i++) {
        foreach ($name in $settingsNames) {
            $candidate = Join-Path $dir $name
            if (Test-Path -LiteralPath $candidate) {
                Write-Result OK "Found $candidate"
                return $dir
            }
        }
        Write-Result INFO "No appsettings file in $dir"
        $parent = [System.IO.Path]::GetDirectoryName($dir)
        if (-not $parent -or $parent -eq $dir) { break }
        $dir = $parent
    }
    return $null
}

# Things .NET configuration accepts but JSON.parse in the app rejects
function Get-StrictJsonProblems([byte[]]$Bytes, [string]$Text) {
    $problems = @()
    if ($Bytes.Length -ge 3 -and $Bytes[0] -eq 0xEF -and $Bytes[1] -eq 0xBB -and $Bytes[2] -eq 0xBF) {
        $problems += 'it starts with a UTF-8 byte order mark'
    } elseif ($Bytes.Length -ge 2 -and (($Bytes[0] -eq 0xFF -and $Bytes[1] -eq 0xFE) -or ($Bytes[0] -eq 0xFE -and $Bytes[1] -eq 0xFF))) {
        $problems += 'it is UTF-16 encoded'
    }

    $withoutStrings = [regex]::Replace($Text, '"(?:[^"\\]|\\.)*"', '""')
    if ($withoutStrings -match '//|/\*') { $problems += 'it contains comments' }
    if ($withoutStrings -match ',\s*[}\]]') { $problems += 'it contains a trailing comma' }
    return , $problems
}

function Read-SettingsText([byte[]]$Bytes) {
    if ($Bytes.Length -ge 2 -and $Bytes[0] -eq 0xFF -and $Bytes[1] -eq 0xFE) {
        $text = [System.Text.Encoding]::Unicode.GetString($Bytes)
    } elseif ($Bytes.Length -ge 2 -and $Bytes[0] -eq 0xFE -and $Bytes[1] -eq 0xFF) {
        $text = [System.Text.Encoding]::BigEndianUnicode.GetString($Bytes)
    } else {
        $text = [System.Text.Encoding]::UTF8.GetString($Bytes)
    }
    return $text.TrimStart([char]0xFEFF)
}

# Same scoring as the app: resource count times method weight, wildcard methods count as 10
function Select-BestApiKey($ApiKeys) {
    $best = $null
    $bestScore = -1
    $index = -1
    foreach ($entry in $ApiKeys) {
        $index++
        $key = Get-JsonValue $entry 'ApiKey'
        if (-not $key) {
            $wrongCase = Get-JsonProperty $entry 'ApiKey' -IgnoreCase
            if ($wrongCase) {
                Write-Result WARN "ApiKeys[$index] spells the key property '$($wrongCase.Name)'; the app only reads 'ApiKey'"
            } else {
                Write-Result INFO "ApiKeys[$index] has no ApiKey value, skipped"
            }
            continue
        }

        $score = 0
        $allowAccess = Get-JsonValue $entry 'AllowAccess'
        foreach ($rule in @($allowAccess)) {
            if ($null -eq $rule) { continue }
            $methods = Get-JsonValue $rule 'Methods'
            $resources = Get-JsonValue $rule 'Resources'
            $methods = @($methods | Where-Object { $null -ne $_ })
            $resources = @($resources | Where-Object { $null -ne $_ })
            $methodWeight = $methods.Count
            if ($methods -contains '*') { $methodWeight = 10 }
            $score += $resources.Count * $methodWeight
        }
        Write-Result INFO "ApiKeys[$index] $(Format-Secret ([string]$key)) scores $score"

        if ($score -gt $bestScore) {
            $bestScore = $score
            $best = [string]$key
        }
    }
    return $best
}

# Replays the app's loop over the settings files; returns the url and key it would use
function Test-SettingsDir([string]$SettingsDir) {
    foreach ($name in $settingsNames) {
        $path = Join-Path $SettingsDir $name
        if (-not (Test-Path -LiteralPath $path)) {
            Write-Result INFO "$name does not exist"
            continue
        }

        try {
            $bytes = [System.IO.File]::ReadAllBytes($path)
        } catch {
            Write-Result FAIL "Cannot read ${name}: $($_.Exception.Message)"
            continue
        }

        $text = Read-SettingsText $bytes
        $problems = Get-StrictJsonProblems $bytes $text
        if ($problems.Count -gt 0) {
            Write-Result FAIL "$name is rejected by the app's JSON parser: $($problems -join ', ')"
        }

        try {
            $settings = $text | ConvertFrom-Json
        } catch {
            Write-Result FAIL "$name is not valid JSON: $($_.Exception.Message)"
            continue
        }
        if ($problems.Count -gt 0) {
            Write-Result INFO "Reading $name anyway to check the remaining steps"
        } else {
            Write-Result OK "$name is valid JSON"
        }

        $urls = Get-JsonValue $settings 'Urls'
        if (-not $urls) {
            $wrongCase = Get-JsonProperty $settings 'Urls' -IgnoreCase
            if ($wrongCase) {
                Write-Result FAIL "$name spells the property '$($wrongCase.Name)'; the app only reads 'Urls'"
            } else {
                Write-Result FAIL "$name has no 'Urls' property"
                if (Get-JsonProperty $settings 'Kestrel' -IgnoreCase) {
                    Write-Result INFO "$name has a 'Kestrel' section; endpoints defined there are not read by the app"
                }
                if ($env:ASPNETCORE_URLS) {
                    Write-Result INFO "ASPNETCORE_URLS is set to '$env:ASPNETCORE_URLS'; the app does not read it"
                }
            }
            continue
        }
        if ($urls -isnot [string]) {
            Write-Result FAIL "'Urls' in $name is not a string"
            continue
        }
        Write-Result OK "Urls = $urls"

        $authentication = Get-JsonValue $settings 'Authentication'
        $apiKeys = Get-JsonValue $authentication 'ApiKeys'
        if ($null -eq $apiKeys) {
            $apiKeys = @()
            $wrongCase = Get-JsonProperty $settings 'Authentication' -IgnoreCase
            if ($wrongCase) { $wrongCase = Get-JsonProperty $wrongCase.Value 'ApiKeys' -IgnoreCase }
            if ($wrongCase) {
                Write-Result WARN "$name has API keys, but not at exactly 'Authentication.ApiKeys' (case matters)"
            }
        } elseif ($apiKeys -isnot [array]) {
            Write-Result FAIL "'Authentication.ApiKeys' in $name is not an array"
            continue
        }

        $bestKey = Select-BestApiKey $apiKeys
        if (-not $bestKey) {
            Write-Result FAIL "$name has no usable entry in 'Authentication.ApiKeys'"
            continue
        }
        Write-Result OK "The app would use API key $(Format-Secret $bestKey)"

        if ($problems.Count -gt 0) { continue }
        return [pscustomobject]@{ Urls = $urls; ApiKey = $bestKey; File = $path; Usable = $true }
    }
    return $null
}

function Resolve-AppUrl([string]$Urls) {
    $bindings = @($Urls.Split(';') | ForEach-Object { $_.Trim() } | Where-Object { $_.Length -gt 0 })
    $first = $Urls
    if ($bindings.Count -gt 0) { $first = $bindings[0] }
    if ($bindings.Count -gt 1) {
        Write-Result INFO "Urls has $($bindings.Count) bindings; the app only uses the first one"
    }

    $star = $first.IndexOf('*')
    if ($star -ge 0) { $first = $first.Remove($star, 1).Insert($star, 'localhost') }
    return ($first -replace '/$', '') + '/api'
}

function Test-Endpoint([string]$Url, [string]$ApiKey, [int[]]$BroadcasterPids) {
    $uri = $null
    if (-not [System.Uri]::TryCreate($Url, [System.UriKind]::Absolute, [ref]$uri)) {
        Write-Result FAIL "'$Url' is not a valid URL; the app only substitutes '*' in the binding"
        return
    }
    if ($uri.Host -eq '0.0.0.0' -or $uri.Host -eq '[::]' -or $uri.Host -eq '+') {
        Write-Result WARN "The binding host '$($uri.Host)' is used as-is by the app and is not connectable on Windows"
    }
    if ($uri.Scheme -eq 'https') {
        Write-Result WARN "The first binding is https; the certificate must be valid for '$($uri.Host)'"
    }

    $client = New-Object System.Net.Sockets.TcpClient
    try {
        $connect = $client.ConnectAsync($uri.Host, $uri.Port)
        if ($connect.Wait(3000) -and $client.Connected) {
            Write-Result OK "TCP port $($uri.Port) on $($uri.Host) accepts connections"
        } else {
            Write-Result FAIL "TCP port $($uri.Port) on $($uri.Host) did not answer within 3 seconds"
        }
    } catch {
        Write-Result FAIL "TCP port $($uri.Port) on $($uri.Host) refused the connection: $($_.Exception.GetBaseException().Message)"
    } finally {
        $client.Close()
    }

    if ($isWindowsHost -and (Get-Command Get-NetTCPConnection -ErrorAction SilentlyContinue)) {
        try {
            $owners = @(Get-NetTCPConnection -State Listen -LocalPort $uri.Port -ErrorAction Stop |
                    Select-Object -ExpandProperty OwningProcess -Unique)
            foreach ($owner in $owners) {
                $ownerName = (Get-Process -Id $owner -ErrorAction SilentlyContinue).ProcessName
                $level = 'INFO'
                if ($BroadcasterPids.Count -gt 0 -and $BroadcasterPids -notcontains $owner) { $level = 'WARN' }
                Write-Result $level "Port $($uri.Port) is listened on by PID $owner ($ownerName)"
            }
        } catch {
            Write-Result INFO "No listener found on port $($uri.Port)"
        }
    }

    if ($SkipHttp) { return }

    if ($PSVersionTable.PSVersion.Major -lt 6) {
        [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor [System.Net.SecurityProtocolType]::Tls12
    }
    $credentials = [System.Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes("any:$ApiKey"))
    $request = @{
        Uri             = "$Url/AvailableResource"
        Headers         = @{ Authorization = "Basic $credentials"; Accept = 'application/json;raw=true' }
        UseBasicParsing = $true
        TimeoutSec      = 10
    }
    if ($PSVersionTable.PSVersion.Major -ge 6) { $request.SkipHeaderValidation = $true }

    $status = $null
    try {
        $status = [int](Invoke-WebRequest @request).StatusCode
    } catch {
        if ($_.Exception.Response) {
            $status = [int]$_.Exception.Response.StatusCode
        } else {
            Write-Result FAIL "GET $($request.Uri) failed: $($_.Exception.GetBaseException().Message)"
            return
        }
    }

    if ($status -eq 401 -or $status -eq 403) {
        Write-Result FAIL "GET $($request.Uri) returned $status; the API key is rejected"
    } elseif ($status -ge 200 -and $status -lt 300) {
        Write-Result OK "GET $($request.Uri) returned $status"
    } else {
        Write-Result FAIL "GET $($request.Uri) returned $status"
    }
}

# Reads what the app itself has saved. While the connection screen is open, every successful
# poll rewrites credentials.enc and every failed poll removes the local connection
function Test-AppState([string]$Dir, [string]$ExpectedUrl, [bool]$AdminRunning) {
    $connectionsFile = Join-Path $Dir 'connections.json'
    $credentialsFile = Join-Path $Dir 'credentials.enc'

    if (-not (Test-Path -LiteralPath $connectionsFile)) {
        if ($AdminRunning) {
            Write-Result FAIL "Broadcaster Administrator is running, but $connectionsFile does not exist; detection fails inside the app"
        } else {
            Write-Result INFO "$connectionsFile does not exist; Broadcaster Administrator has not saved anything as this user"
        }
        return
    }

    $entry = $null
    try {
        $connections = Get-Content -LiteralPath $connectionsFile -Raw | ConvertFrom-Json
        foreach ($connection in $connections) {
            if ((Get-JsonValue $connection 'id') -ceq $localConnectionId) { $entry = $connection }
        }
    } catch {
        Write-Result FAIL "Cannot read ${connectionsFile}: $($_.Exception.Message)"
        return
    }

    if (-not $entry) {
        if ($AdminRunning) {
            Write-Result FAIL 'Broadcaster Administrator is running, but has no local Broadcaster saved; detection fails inside the app'
        } else {
            Write-Result WARN 'No local Broadcaster is saved; the last poll the app made found nothing'
        }
        return
    }
    Write-Result OK "The app has saved the local Broadcaster as '$($entry.name)' with URL $($entry.url)"
    if ($ExpectedUrl -and $entry.url -ne $ExpectedUrl) {
        Write-Result WARN "The saved URL differs from the one detected now ($ExpectedUrl)"
    }

    $hasCredential = $false
    if (Test-Path -LiteralPath $credentialsFile) {
        try {
            $store = Get-Content -LiteralPath $credentialsFile -Raw | ConvertFrom-Json
            $hasCredential = [bool](Get-JsonValue $store $localConnectionId)
        } catch { }
    }
    if (-not $hasCredential) {
        Write-Result FAIL "The local Broadcaster has no API key in $credentialsFile; connecting fails with 'no API key'"
        return
    }

    $age = [int]((Get-Date) - (Get-Item -LiteralPath $credentialsFile).LastWriteTime).TotalSeconds
    if ($AdminRunning -and $age -le ($pollSeconds * 3)) {
        Write-Result OK "The app stored the API key $age seconds ago; its detection is succeeding right now"
    } elseif ($AdminRunning) {
        Write-Result INFO "The app stored the API key $age seconds ago; it only polls while the connection screen is open"
    } else {
        Write-Result INFO "The app stored the API key $age seconds ago"
    }
}

# ---------------------------------------------------------------------------

Write-Host "Local Broadcaster detection diagnostics"

Write-Section 'Environment'
Write-Result INFO "PowerShell $($PSVersionTable.PSVersion) as $([System.Environment]::UserDomainName)\$([System.Environment]::UserName) on $([System.Environment]::MachineName)"
if ($isWindowsHost) {
    try {
        $os = Get-CimInstance Win32_OperatingSystem
        Write-Result INFO "$($os.Caption) build $($os.BuildNumber)"
    } catch {
        Write-Result INFO "Windows $([System.Environment]::OSVersion.Version)"
    }

    $principal = New-Object System.Security.Principal.WindowsPrincipal([System.Security.Principal.WindowsIdentity]::GetCurrent())
    if ($principal.IsInRole([System.Security.Principal.WindowsBuiltInRole]::Administrator)) {
        Write-Result INFO 'This shell is elevated. If Broadcaster Administrator runs non-elevated, rerun from a normal shell to see what it sees'
    } else {
        Write-Result INFO 'This shell is not elevated'
    }
} elseif (-not $AppDir) {
    Write-Result FAIL 'Process detection can only be checked on Windows. Pass -AppDir to check a settings directory'
    exit 1
}

$appPick = $null
$realDirs = @()
$realPids = @()
$adminRunning = $false

if ($AppDir) {
    Write-Result INFO "Process detection skipped, starting in $AppDir"
    $appPick = $AppDir
} else {
    Write-Section 'Step 1: the process query the app runs'
    Write-Result INFO $wmicCommand

    if (-not (Get-Command wmic.exe -ErrorAction SilentlyContinue)) {
        Write-Result FAIL 'wmic.exe is not installed or not on PATH' -Blocks
    }

    $query = Invoke-AppProcessQuery
    $wmicPaths = @()
    $queryFailed = $true
    if ($query.Error) {
        Write-Result FAIL "The query could not be started: $($query.Error)" -Blocks
    } elseif ($query.TimedOut) {
        Write-Result FAIL "The query did not finish within $wmicTimeoutMs ms, the app gives up at that point" -Blocks
    } elseif ($query.ExitCode -ne 0) {
        Write-Result FAIL "The query exited with code $($query.ExitCode): $($query.StdErr.Trim())" -Blocks
    } else {
        $queryFailed = $false
        Write-Result OK "The query finished in $($query.ElapsedMs) ms"
        if ($query.ElapsedMs -gt ($wmicTimeoutMs / 2)) {
            Write-Result WARN "The query took $($query.ElapsedMs) ms, close to the app's $wmicTimeoutMs ms timeout"
        }
        if ($query.StdErr.Trim()) { Write-Result INFO "stderr: $($query.StdErr.Trim())" }

        # JavaScript's '.' stops at line terminators, so empty ExecutablePath lines never match
        $wmicPaths = @([regex]::Matches($query.StdOut, 'ExecutablePath=([^\r\n\u2028\u2029]+)') |
                ForEach-Object { $_.Groups[1].Value.Trim() })
        $position = 0
        foreach ($path in $wmicPaths) {
            $position++
            Write-Result INFO "Match ${position}: $path"
        }

        if ($wmicPaths.Count -eq 0) {
            Write-Result INFO 'The query returned no executable path'
        } else {
            $picked = $wmicPaths[0]
            $appPick = [System.IO.Path]::GetDirectoryName($picked)
            if ([System.IO.Path]::GetFileName($picked) -ieq $adminExeName) {
                Write-Result FAIL "The app picks the first match, which is Broadcaster Administrator itself: $picked" -Blocks
            } else {
                Write-Result OK "The app picks the first match: $picked"
            }
            if ($picked -match '[^\x20-\x7E]') {
                Write-Result WARN 'The path has non-ASCII characters; wmic writes its console code page and the app decodes UTF-8, so the path may be garbled'
            }
        }
    }

    Write-Section 'Step 2: what is actually running'
    $processes = @()
    $cimFailed = $false
    try {
        $processes = @(Get-CimInstance Win32_Process -Filter "Name LIKE 'Broadcaster%'")
    } catch {
        $cimFailed = $true
        Write-Result WARN "Could not list processes through CIM, step 2 is incomplete: $($_.Exception.Message)"
    }
    $adminProcesses = @($processes | Where-Object { $_.Name -ieq $adminExeName })
    $realProcesses = @($processes | Where-Object { $_.Name -ine $adminExeName })

    foreach ($process in $realProcesses) {
        $owner = 'unknown owner'
        try {
            $ownerInfo = Invoke-CimMethod -InputObject $process -MethodName GetOwner
            if ($ownerInfo.User) { $owner = "$($ownerInfo.Domain)\$($ownerInfo.User)" }
        } catch { }

        if ($process.ExecutablePath) {
            Write-Result OK "PID $($process.ProcessId) $($process.Name) ($owner): $($process.ExecutablePath)"
            $realDirs += [System.IO.Path]::GetDirectoryName($process.ExecutablePath)
            $realPids += [int]$process.ProcessId
        } else {
            Write-Result FAIL "PID $($process.ProcessId) $($process.Name) ($owner) hides its executable path from this user"
            $realPids += [int]$process.ProcessId
        }
    }
    if ($adminProcesses.Count -gt 0) {
        $adminRunning = $true
        Write-Result INFO "Broadcaster Administrator is running with $($adminProcesses.Count) processes that also match 'Broadcaster%'"
        try {
            $ownerInfo = Invoke-CimMethod -InputObject $adminProcesses[0] -MethodName GetOwner
            if ($ownerInfo.User -and $ownerInfo.User -ine [System.Environment]::UserName) {
                Write-Result WARN "Broadcaster Administrator runs as $($ownerInfo.Domain)\$($ownerInfo.User), not as the user running this script; rerun as that user"
            }
        } catch { }
    } else {
        Write-Result INFO 'Broadcaster Administrator is not running, so matching itself cannot be observed. Start it and rerun'
    }

    $dotnetHosted = @()
    try {
        $dotnetHosted = @(Get-CimInstance Win32_Process -Filter "Name = 'dotnet.exe'" |
                Where-Object { $_.CommandLine -match 'Broadcaster' })
    } catch { }
    foreach ($process in $dotnetHosted) {
        Write-Result WARN "PID $($process.ProcessId) dotnet.exe hosts a Broadcaster; the app only matches process names starting with 'Broadcaster': $($process.CommandLine)"
    }

    $services = @()
    try {
        $services = @(Get-CimInstance Win32_Service | Where-Object { $_.PathName -match 'Broadcaster' })
    } catch { }
    foreach ($service in $services) {
        Write-Result INFO "Service '$($service.Name)' is $($service.State), runs as $($service.StartName): $($service.PathName)"
    }

    if ($cimFailed) {
        if (-not $queryFailed -and $wmicPaths.Count -eq 0) {
            Write-Result FAIL 'The query returned no executable path' -Blocks
        }
    } elseif ($realProcesses.Count -eq 0 -and $dotnetHosted.Count -eq 0) {
        Write-Result FAIL 'No Broadcaster process is running on this machine' -Blocks
    } elseif ($realProcesses.Count -eq 0) {
        Write-Result FAIL 'The Broadcaster runs inside dotnet.exe, which the app cannot find' -Blocks
    } elseif ($realDirs.Count -eq 0) {
        Write-Result FAIL 'A Broadcaster is running, but its executable path is not visible to this user' -Blocks
    } elseif (-not $queryFailed -and $wmicPaths.Count -eq 0) {
        Write-Result FAIL 'A Broadcaster is running and visible through CIM, but the wmic query did not return it' -Blocks
    }
}

$detected = $null
$settingsDir = $null
$url = $null

if ($appPick) {
    Write-Section 'Step 3: searching for appsettings from the directory the app picked'
    $settingsDir = Find-SettingsDir $appPick
    if (-not $settingsDir) {
        Write-Result FAIL "No appsettings file within $maxWalkLevels directories of $appPick" -Blocks
    }
}

# The app stopped early; carry on from the real Broadcaster to check the remaining steps
if (-not $settingsDir) {
    $fallback = $realDirs | Where-Object { $_ -ne $appPick } | Select-Object -First 1
    if ($fallback) {
        Write-Section 'Step 3 again, from the real Broadcaster directory'
        $settingsDir = Find-SettingsDir $fallback
        if (-not $settingsDir) {
            Write-Result FAIL "No appsettings file within $maxWalkLevels directories of $fallback" -Blocks
        }
    }
}

if ($settingsDir) {
    Write-Section "Step 4: reading settings in $settingsDir"
    $stepStart = $findings.Count
    $detected = Test-SettingsDir $settingsDir
    if (-not $detected) {
        $reasons = @($findings | Select-Object -Skip $stepStart | Where-Object { $_.Level -eq 'FAIL' })
        if ($reasons.Count -eq 1) {
            if (-not $blocker) { $blocker = $reasons[0].Message }
        } else {
            Write-Result FAIL 'No settings file gives the app both a URL and an API key' -Blocks
        }
    }
}

if ($detected) {
    Write-Section 'Step 5: connecting the way the app does'
    $url = Resolve-AppUrl $detected.Urls
    Write-Result INFO "Resolved URL: $url"
    Test-Endpoint $url $detected.ApiKey $realPids
}
$failsBeforeAppState = @($findings | Where-Object { $_.Level -eq 'FAIL' }).Count

if (-not $UserDataDir -and $env:APPDATA) {
    # Electron names the directory after productName, or the package name when that is missing
    $UserDataDir = Join-Path $env:APPDATA 'Broadcaster Administrator'
    $legacyDir = Join-Path $env:APPDATA 'bcadmin'
    if (-not (Test-Path -LiteralPath (Join-Path $UserDataDir 'connections.json')) -and
        (Test-Path -LiteralPath (Join-Path $legacyDir 'connections.json'))) {
        $UserDataDir = $legacyDir
    }
}
if ($UserDataDir) {
    Write-Section "Step 6: what the app has saved in $UserDataDir"
    Test-AppState $UserDataDir $url $adminRunning
}

Write-Section 'Summary'
if ($blocker) {
    Write-Host "  Detection fails. The app gives up at:" -ForegroundColor Red
    Write-Host "    $blocker" -ForegroundColor Red
} elseif ($failsBeforeAppState -gt 0) {
    Write-Host '  Detection succeeds, but connecting to the detected Broadcaster fails.' -ForegroundColor Red
} elseif (@($findings | Where-Object { $_.Level -eq 'FAIL' }).Count -gt 0) {
    Write-Host '  Detection succeeds in this script, but not in the app.' -ForegroundColor Red
} elseif (-not $adminRunning -and -not $AppDir) {
    Write-Host '  Detection succeeds for this user, but Broadcaster Administrator was not running.' -ForegroundColor Yellow
    Write-Host '  Open it, stay on the connection screen, and run this script again.' -ForegroundColor Yellow
} else {
    Write-Host '  Detection succeeds for this user; the app should list the local Broadcaster.' -ForegroundColor Green
}

$others = @($findings | Where-Object { $_.Message -ne $blocker })
if ($others.Count -gt 0) {
    Write-Host
    Write-Host '  Other findings:'
    foreach ($finding in $others) {
        Write-Host ("    [{0}] {1}" -f $finding.Level.PadRight(4), $finding.Message)
    }
}
Write-Host

if ($blocker -or @($findings | Where-Object { $_.Level -eq 'FAIL' }).Count -gt 0) { exit 1 }
exit 0
