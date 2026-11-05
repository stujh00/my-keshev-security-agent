# KESHEV - Windows local PC measurements (PowerShell 5.1 compatible).
# Read-only system measurements. Never changes the KESHEV repository.
[CmdletBinding()]
param(
    [string]$OutputDirectory = (Join-Path $env:LOCALAPPDATA 'KeshevEndpoint\measurements'),
    [switch]$LatestOnly
)

$ErrorActionPreference = 'Stop'
$results = [ordered]@{
    schemaVersion = 1
    evidence = 'actual_windows_query'
    sampleData = $false
    collectedAt = (Get-Date).ToString('yyyy-MM-ddTHH:mm:sszzz')
    cpu = [ordered]@{ status = 'unavailable'; percent = $null; observedAt = $null; reason = $null }
    memory = [ordered]@{ status = 'unavailable'; percent = $null; observedAt = $null; reason = $null }
    diskC = [ordered]@{ status = 'unavailable'; freeGB = $null; freePercent = $null; observedAt = $null; reason = $null }
}

try {
    $processors = @(Get-CimInstance -ClassName Win32_Processor -ErrorAction Stop)
    $valid = @($processors | Where-Object { $null -ne $_.LoadPercentage })
    if ($valid.Count -gt 0) {
        $average = ($valid | Measure-Object -Property LoadPercentage -Average).Average
        $results.cpu.status = 'ok'
        $results.cpu.percent = [Math]::Round([double]$average, 1)
        $results.cpu.observedAt = (Get-Date).ToString('yyyy-MM-ddTHH:mm:sszzz')
    } else { $results.cpu.reason = 'CPU usage not returned by Windows' }
} catch { $results.cpu.reason = 'Windows CPU query failed' }

try {
    $os = Get-CimInstance -ClassName Win32_OperatingSystem -ErrorAction Stop
    if ($os -and [double]$os.TotalVisibleMemorySize -gt 0 -and $null -ne $os.FreePhysicalMemory) {
        $value = 100 * (1 - ([double]$os.FreePhysicalMemory / [double]$os.TotalVisibleMemorySize))
        $results.memory.status = 'ok'
        $results.memory.percent = [Math]::Round($value, 1)
        $results.memory.observedAt = (Get-Date).ToString('yyyy-MM-ddTHH:mm:sszzz')
    } else { $results.memory.reason = 'Memory size not returned by Windows' }
} catch { $results.memory.reason = 'Windows memory query failed' }

try {
    $disk = Get-CimInstance -ClassName Win32_LogicalDisk -Filter "DeviceID='C:'" -ErrorAction Stop
    if ($disk -and [double]$disk.Size -gt 0 -and $null -ne $disk.FreeSpace) {
        $results.diskC.status = 'ok'
        $results.diskC.freeGB = [Math]::Round(([double]$disk.FreeSpace / 1GB), 1)
        $results.diskC.freePercent = [Math]::Round((100 * [double]$disk.FreeSpace / [double]$disk.Size), 1)
        $results.diskC.observedAt = (Get-Date).ToString('yyyy-MM-ddTHH:mm:sszzz')
    } else { $results.diskC.reason = 'C: disk data not returned by Windows' }
} catch { $results.diskC.reason = 'Windows disk query failed' }

if (-not $LatestOnly) {
Write-Host '===== KESHEV PC actual measurements ====='
Write-Host ('Measured at: ' + $results.collectedAt)
Write-Host 'Source: actual Windows CIM query (not demo/sample)'
if ($results.cpu.status -eq 'ok') { Write-Host ('CPU usage: {0:N1} %' -f $results.cpu.percent) }
else { Write-Host ('CPU usage: unavailable ({0})' -f $results.cpu.reason) }
if ($results.memory.status -eq 'ok') { Write-Host ('Memory usage: {0:N1} %' -f $results.memory.percent) }
else { Write-Host ('Memory usage: unavailable ({0})' -f $results.memory.reason) }
if ($results.diskC.status -eq 'ok') {
    Write-Host ('C: disk free: {0:N1} GB ({1:N1} %)' -f $results.diskC.freeGB, $results.diskC.freePercent)
} else { Write-Host ('C: disk free: unavailable ({0})' -f $results.diskC.reason) }

}
# Write an evidence file outside the Git repository. Never overwrite an existing result.
if (-not (Test-Path -LiteralPath $OutputDirectory -PathType Container)) {
    throw ('Output directory not found: ' + $OutputDirectory)
}
$name = 'keshev-pc-actual-{0}-{1}.json' -f (Get-Date -Format 'yyyyMMdd-HHmmss'), [Guid]::NewGuid().ToString('N').Substring(0,8)
$path = Join-Path $OutputDirectory $name
$json = $results | ConvertTo-Json -Depth 6
# KESHEV_PHASE151_FAST_PC: frequent, atomic latest-only measurements; do not create 15-sec archive files.
if ($LatestOnly) {
    $latest = Join-Path $OutputDirectory 'latest-pc.json'
    $tmp = Join-Path $OutputDirectory ('.latest-pc.' + [Guid]::NewGuid().ToString('N') + '.tmp')
    try {
        [IO.File]::WriteAllText($tmp, $json, (New-Object System.Text.UTF8Encoding($false)))
        Move-Item -LiteralPath $tmp -Destination $latest -Force -ErrorAction Stop
    } finally {
        if (Test-Path -LiteralPath $tmp) { Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue }
    }
    return
}
$utf8 = New-Object System.Text.UTF8Encoding($false)
$bytes = $utf8.GetBytes($json)
$stream = [System.IO.File]::Open($path, [System.IO.FileMode]::CreateNew, [System.IO.FileAccess]::Write)
try { $stream.Write($bytes,0,$bytes.Length) } finally { $stream.Dispose() }
Write-Host ('Saved JSON: ' + $path)
Write-Output ('KESHEV_OUTPUT_PATH=' + $path)
Write-Host 'The KESHEV project files were not modified.'
