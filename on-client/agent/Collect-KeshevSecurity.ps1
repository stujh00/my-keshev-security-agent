# KESHEV Phase 4 - Windows Security log metadata only. No configuration changes.
[CmdletBinding()]
param([ValidateRange(60,86400)][int]$IntervalSeconds=300,[switch]$Watch)
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'Write-KeshevHeartbeat.ps1')
$dest=Join-Path $env:LOCALAPPDATA 'KeshevEndpoint\measurements'
if(-not(Test-Path -LiteralPath $dest -PathType Container)){New-Item -ItemType Directory -Path $dest -Force | Out-Null}
# Watch-mode process identity is evidence of process existence only, not collection success.
# Do not publish identity from a one-off or non-elevated collection run.
function Write-SecurityProcessIdentity {
  if (-not $Watch) { return }
  try {
    $identity=[Security.Principal.WindowsIdentity]::GetCurrent()
    $principal=New-Object Security.Principal.WindowsPrincipal($identity)
    if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { return }
    $current=Get-Process -Id $PID -ErrorAction Stop
    $record=[ordered]@{
      schemaVersion=1
      source='keshev_security_watch_process'
      pid=[int]$PID
      startedAtUtc=$current.StartTime.ToUniversalTime().ToString('o')
      writtenAtUtc=(Get-Date).ToUniversalTime().ToString('o')
    }
    $text=ConvertTo-Json -InputObject $record -Compress
    $tmp=Join-Path $dest ('.security-process.'+[guid]::NewGuid().ToString('N')+'.tmp')
    try {
      [System.IO.File]::WriteAllText($tmp,$text,(New-Object System.Text.UTF8Encoding($false)))
      Move-Item -LiteralPath $tmp -Destination (Join-Path $dest 'security-watch-process.json') -Force -ErrorAction Stop
    } finally {
      if (Test-Path -LiteralPath $tmp) { Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue }
    }
  } catch {
    Write-Warning 'KESHEV Security process identity could not be recorded. Collection will continue.'
  }
}
function Collect-Once {
  $now=Get-Date
  $out=[ordered]@{schemaVersion=1;evidence='actual_windows_security_query';sampleData=$false;collectedAt=$now.ToString('yyyy-MM-ddTHH:mm:sszzz');status='unavailable';reason=$null;windowHours=24;limited=$false;events=@()}
  try {
    $log=Get-WinEvent -ListLog Security -ErrorAction Stop
    if(-not $log.IsEnabled){$out.status='disabled';$out.reason='SECURITY_LOG_DISABLED'}
    else {
      # An empty result set is not an error. Access denied and other failures are preserved.
      $list=@()
      try {
        $list=@(Get-WinEvent -FilterHashtable @{LogName='Security';Id=4625,4740,1102,4720,4732;StartTime=$now.AddHours(-24)} -MaxEvents 300 -ErrorAction Stop)
      } catch {
        if($_.FullyQualifiedErrorId -like '*NoMatchingEventsFound*' -or $_.Exception.Message -match 'No events were found'){ $list=@() }
        else {throw}
      }
      $items=New-Object System.Collections.ArrayList
      foreach($e in $list){
        $props=@{}
        try {
          [xml]$xml=$e.ToXml()
          foreach($datum in @($xml.Event.EventData.Data)){
            if($null -ne $datum -and $datum.Name){$props[[string]$datum.Name]=[string]$datum.'#text'}
          }
        }catch{}
        $user=[string]$(if($props.ContainsKey('TargetUserName')){$props['TargetUserName']}else{''})
        $ip=[string]$(if($props.ContainsKey('IpAddress')){$props['IpAddress']}else{''})
        # Do not persist event messages, SIDs, host identifiers or raw XML.
        [void]$items.Add([ordered]@{eventId=[int]$e.Id;recordId=[long]$e.RecordId;at=$e.TimeCreated.ToString('yyyy-MM-ddTHH:mm:sszzz');user=$user.Substring(0,[Math]::Min(72,$user.Length));ip=$ip.Substring(0,[Math]::Min(72,$ip.Length))})
      }
      $out.events=@($items.ToArray());$out.limited=($list.Count -ge 300);$out.status='ok'
    }
  }catch{
    $out.status='unavailable'
    $out.reason=if($_.Exception -is [System.UnauthorizedAccessException] -or $_.Exception -is [System.Security.SecurityException] -or $_.FullyQualifiedErrorId -match 'UnauthorizedAccess|AccessDenied|SecurityException' -or $_.Exception.Message -match 'Access is denied|Access denied'){'ACCESS_DENIED'}else{'QUERY_FAILED'}
  }
  $json=ConvertTo-Json -InputObject $out -Depth 6 -Compress
  $tmp=Join-Path $dest ('.latest-security.'+[guid]::NewGuid().ToString('N')+'.tmp')
  $target=Join-Path $dest 'latest-security.json'
  try{
    [System.IO.File]::WriteAllText($tmp,$json,(New-Object System.Text.UTF8Encoding($false)))
    Move-Item -LiteralPath $tmp -Destination $target -Force -ErrorAction Stop
  }finally{if(Test-Path -LiteralPath $tmp){Remove-Item -LiteralPath $tmp -Force}}
  Write-Host ('KESHEV Security collection '+$out.status+'; '+$out.events.Count+' matching events; '+$out.collectedAt+'; '+$target)
  if($out.status -ne 'ok'){Write-Host ('Reason: '+$out.reason)}
  Write-KeshevHeartbeat -Kind security -Status $(if($out.status -eq 'ok'){'ok'}else{'unavailable'}) -IntervalSeconds $IntervalSeconds -Reason ([string]$out.reason)
}
do{
 Write-SecurityProcessIdentity
 Collect-Once
 if($Watch){Write-Host ('Next Security collection in '+$IntervalSeconds+' seconds. Ctrl+C stops.');Start-Sleep -Seconds $IntervalSeconds}
}while($Watch)
