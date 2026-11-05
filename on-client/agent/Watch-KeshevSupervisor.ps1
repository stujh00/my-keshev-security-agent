# KESHEV Phase 7 process observer. Read only. No elevation, no service install, no agent control.
[CmdletBinding()]
param([ValidateRange(30,3600)][int]$IntervalSeconds=60,[switch]$Once)
$ErrorActionPreference='Stop'
$root=Join-Path $env:LOCALAPPDATA 'KeshevEndpoint\measurements'
if (-not (Test-Path -LiteralPath $root -PathType Container)) { New-Item -ItemType Directory -Force -Path $root | Out-Null }
# A privileged collector may hide its command line from the ordinary supervisor.
# Validate its own reported PID against Windows process identity AND creation time.
# Do not equate a heartbeat or a JSON file alone with a running process.
function Test-SecurityWatchIdentity($processes) {
  $marker=Join-Path $root 'security-watch-process.json'
  try {
    $file=Get-Item -LiteralPath $marker -ErrorAction Stop
    if ($file.Length -lt 1 -or $file.Length -gt 4096) { return $false }
    $raw=Get-Content -LiteralPath $marker -Raw -Encoding UTF8 -ErrorAction Stop | ConvertFrom-Json -ErrorAction Stop
    if ($raw.schemaVersion -ne 1 -or $raw.source -ne 'keshev_security_watch_process') { return $false }
    $candidatePid=0
    if (-not [int]::TryParse([string]$raw.pid,[ref]$candidatePid) -or $candidatePid -le 0) { return $false }
    $started=[datetimeoffset]::MinValue
    if (-not [datetimeoffset]::TryParse([string]$raw.startedAtUtc,[ref]$started) -or $started.Offset -ne [timespan]::Zero) { return $false }
    $found=@($processes | Where-Object { [int]$_.ProcessId -eq $candidatePid })
    if ($found.Count -ne 1) { return $false }
    $processStarted=([datetime]$found[0].CreationDate).ToUniversalTime()
    $difference=[math]::Abs(($processStarted - $started.UtcDateTime).TotalSeconds)
    return ($difference -le 2)
  } catch { return $false }
}
function Observe-Once {
  $stamp=(Get-Date).ToString('o')
  $items=@{pc=@{state='unknown';count=0};security=@{state='unknown';count=0}}
  $reason=$null
  try {
    $procs=@(Get-CimInstance Win32_Process -Filter "Name = 'powershell.exe' OR Name = 'pwsh.exe'" -ErrorAction Stop)
    $readable=@($procs | Where-Object { -not [string]::IsNullOrWhiteSpace($_.CommandLine) })
    $hidden=@($procs | Where-Object { [string]::IsNullOrWhiteSpace($_.CommandLine) })
    # Recognize both the collector worker and its foreground wrapper.
    $patterns=@{pc='(?i)(?:[\\/]|^|\s)(?:Run-KeshevEndpoint|Start-KeshevAutoCollect)\.ps1(?:\s|"|\x27|$)';security='(?i)(?:[\\/]|^|\s)Collect-KeshevSecurity\.ps1(?:\s|"|\x27|$)'}
    $securityIdentityObserved=Test-SecurityWatchIdentity $procs
    foreach($key in @('pc','security')) {
      $match=@($readable | Where-Object {$_.CommandLine -match $patterns[$key]})
      if($match.Count -gt 0 -or ($key -eq 'security' -and $securityIdentityObserved)){$items[$key]=@{state='observed';count=[math]::Max(1,$match.Count)}}
      elseif($hidden.Count -gt 0){$items[$key]=@{state='unknown';count=0}}
      else{$items[$key]=@{state='not_observed';count=0}}
    }
  } catch {
    $reason='PROCESS_QUERY_FAILED'
  }
  $record=@{schemaVersion=1;source='windows_process_observation';collectedAt=$stamp;collectors=$items}
  if($reason){$record.reason=$reason}
  $json=ConvertTo-Json -InputObject $record -Depth 6 -Compress
  $tmp=Join-Path $root ('.latest-supervisor.'+[guid]::NewGuid().ToString('N')+'.tmp')
  $dest=Join-Path $root 'latest-supervisor.json'
  try {
    [System.IO.File]::WriteAllText($tmp,$json,(New-Object System.Text.UTF8Encoding($false)))
    Move-Item -LiteralPath $tmp -Destination $dest -Force -ErrorAction Stop
  } finally {if(Test-Path -LiteralPath $tmp){Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue}}
  Write-Host ('KESHEV supervisor observed at '+$stamp+'; PC='+$items.pc.state+'; Security='+$items.security.state+'; evidence='+$dest)
  if($reason){Write-Warning 'Process query unavailable. No claim of collector liveness.'}
}
Write-Host 'KESHEV supervisor: read-only process observation; Ctrl+C to stop. No auto-start of collectors.'
do {Observe-Once;if(-not $Once){Start-Sleep -Seconds $IntervalSeconds}} while(-not $Once)
