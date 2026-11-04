# KESHEV Phase 7.2: local heartbeat evidence, no service, elevation or network calls.
function Write-KeshevHeartbeat {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory=$true)][ValidateSet('pc','security')][string]$Kind,
    [Parameter(Mandatory=$true)][ValidateSet('ok','unavailable','failed')][string]$Status,
    [ValidateRange(60,86400)][int]$IntervalSeconds=300,
    [string]$Reason=''
  )
  $directory=Join-Path $env:LOCALAPPDATA 'KeshevEndpoint\measurements'
  if(-not(Test-Path -LiteralPath $directory -PathType Container)){New-Item -Path $directory -ItemType Directory -Force | Out-Null}
  $record=[ordered]@{
    schemaVersion=1
    source='keshev_collector_heartbeat'
    kind=$Kind
    collectedAt=(Get-Date).ToString('o')
    status=$Status
    expectedIntervalSeconds=$IntervalSeconds
    processId=[int]$PID
    reason=if($Reason){$Reason.Substring(0,[Math]::Min(64,$Reason.Length))}else{$null}
  }
  $json=ConvertTo-Json -InputObject $record -Depth 4 -Compress
  $temp=Join-Path $directory ('.heartbeat-'+$Kind+'-'+[guid]::NewGuid().ToString('N')+'.tmp')
  $final=Join-Path $directory ('latest-heartbeat-'+$Kind+'.json')
  try {
    [System.IO.File]::WriteAllText($temp,$json,(New-Object System.Text.UTF8Encoding($false)))
    Move-Item -LiteralPath $temp -Destination $final -Force -ErrorAction Stop
  } finally {if(Test-Path -LiteralPath $temp){Remove-Item -LiteralPath $temp -Force -ErrorAction SilentlyContinue}}
}
