# Keshev endpoint stage 1: local-only read-only collector. No service, no network upload.
[CmdletBinding()]
param(
  [ValidateRange(60,86400)][int]$IntervalSeconds = 300,
  [switch]$Watch
)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'Write-KeshevHeartbeat.ps1')
$measureDir = Join-Path $env:LOCALAPPDATA 'KeshevEndpoint\measurements'
if (-not (Test-Path -LiteralPath $measureDir -PathType Container)) {
  New-Item -Path $measureDir -ItemType Directory -Force | Out-Null
}
function Collect-Once {
  $started = Get-Date
  Write-Host ('KESHEV: read-only Windows collection started: ' + $started.ToString('s'))
  foreach ($item in @(
      @{file='Measure-PC.ps1'; latest='latest-pc.json'},
      @{file='Measure-Connection.ps1'; latest='latest-connection.json'}
  )) {
    $scriptFile = Join-Path $PSScriptRoot $item.file
    if (-not (Test-Path -LiteralPath $scriptFile -PathType Leaf)) { throw ('Missing collector: ' + $item.file) }
    $lines = @(& $scriptFile -OutputDirectory $measureDir)
    if (-not $?) { throw ('Windows collector failed: ' + $item.file) }
    $markers = @($lines | Where-Object { $_ -is [string] -and $_.StartsWith('KESHEV_OUTPUT_PATH=') })
    if ($markers.Count -ne 1) { throw ('Expected one evidence file marker: ' + $item.file) }
    $source = $markers[0].Substring('KESHEV_OUTPUT_PATH='.Length)
    if (-not (Test-Path -LiteralPath $source -PathType Leaf)) { throw 'Evidence file missing' }
    # Latest files are local convenience references. Archived measurement snapshots remain immutable.
    $latest = Join-Path $measureDir $item.latest
    $temp = Join-Path $measureDir ('.' + $item.latest + '.' + [guid]::NewGuid().ToString('N') + '.tmp')
    Copy-Item -LiteralPath $source -Destination $temp -ErrorAction Stop
    Move-Item -LiteralPath $temp -Destination $latest -Force -ErrorAction Stop
    Write-Host ('Evidence: ' + $latest)
  }
  # Phase 9: Defender collection runs with the ordinary PC collector, no new console.
  try {
    $defenderScript = Join-Path $PSScriptRoot 'Collect-KeshevDefender.ps1'
    if (Test-Path -LiteralPath $defenderScript -PathType Leaf) {
      & $defenderScript -OutputDirectory $measureDir
    } else { Write-Warning 'KESHEV Defender collector missing' }
  } catch { Write-Warning 'KESHEV Defender collection failed; ordinary PC collection remains available.' }
  Write-Host 'KESHEV: local collection finished. No HTTP upload, no firewall or security settings modified.'
}
do {
  try {
    Collect-Once
    Write-KeshevHeartbeat -Kind pc -Status ok -IntervalSeconds $IntervalSeconds
  } catch {
    try {Write-KeshevHeartbeat -Kind pc -Status failed -IntervalSeconds $IntervalSeconds -Reason 'COLLECTION_FAILED'} catch {}
    throw
  }
  if ($Watch) {
    Write-Host ('Next collection in ' + $IntervalSeconds + ' seconds. Ctrl+C stops the foreground collector.')
    Start-Sleep -Seconds $IntervalSeconds
  }
} while ($Watch)
