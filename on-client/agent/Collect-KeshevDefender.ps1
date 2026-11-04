# KESHEV Phase 9: read-only Microsoft Defender Operational event collection.
# No settings, scan, remediation, service control, remote upload, or elevation.
[CmdletBinding()]
param([string]$OutputDirectory=(Join-Path $env:LOCALAPPDATA 'KeshevEndpoint\measurements'))
$ErrorActionPreference='Stop'
if(-not(Test-Path -LiteralPath $OutputDirectory -PathType Container)){
  New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
}
$now=Get-Date
$result=[ordered]@{schemaVersion=1;source='windows_defender_operational';sampleData=$false;collectedAt=$now.ToString('o');status='unavailable';reason=$null;windowHours=24;events=@();limited=$false}
$ids=@(1116,1117,1118,1119,5007)
try {
  $log=Get-WinEvent -ListLog 'Microsoft-Windows-Windows Defender/Operational' -ErrorAction Stop
  if(-not $log.IsEnabled){$result.status='disabled';$result.reason='LOG_DISABLED'}
  else {
    $items=@()
    try {
      $items=@(Get-WinEvent -FilterHashtable @{LogName='Microsoft-Windows-Windows Defender/Operational';Id=$ids;StartTime=$now.AddHours(-24)} -MaxEvents 201 -ErrorAction Stop)
      $result.status='ok'
    } catch {
      $err=$_.Exception
      $fqid=[string]$_.FullyQualifiedErrorId
      if($fqid -match 'NoMatchingEventsFound' -or $err.GetType().Name -eq 'NoMatchingEventsFoundException'){
        $result.status='ok'
        $result.reason='NO_MATCHING_EVENTS'
      } elseif($err -is [System.UnauthorizedAccessException] -or $fqid -match 'Unauthorized|AccessDenied|SecurityException'){
        $result.status='unavailable';$result.reason='ACCESS_DENIED'
      } else {$result.status='unavailable';$result.reason='QUERY_FAILED'}
    }
    if($result.status -eq 'ok'){
      if($items.Count -gt 200){$result.limited=$true}
      $records=@()
      foreach($e in @($items | Select-Object -First 200)){
        if($null -eq $e -or $null -eq $e.TimeCreated){continue}
        # Phase 11: read bounded old/new values only. Do not persist complete event messages.
        $change=[ordered]@{eventId=[int]$e.Id;recordId=[long]$e.RecordId;at=$e.TimeCreated.ToString('o')}
        if([int]$e.Id -eq 5007){
          try {
            $message=[string]$e.Message
            $old=[regex]::Match($message,'(?im)^\s*(?:이전\s*값|Old\s*Value)\s*:\s*(.+?)\s*$')
            $new=[regex]::Match($message,'(?im)^\s*(?:새\s*값|New\s*Value)\s*:\s*(.+?)\s*$')
            if($old.Success -and $new.Success){
              $prior=($old.Groups[1].Value -replace '[\x00-\x1f\x7f]',' ').Trim()
              $after=($new.Groups[1].Value -replace '[\x00-\x1f\x7f]',' ').Trim()
              if($prior.Length -gt 400){$prior=$prior.Substring(0,400)}
              if($after.Length -gt 400){$after=$after.Substring(0,400)}
              if($prior.Length -gt 0 -and $after.Length -gt 0){
                $change['oldValue']=$prior
                $change['newValue']=$after
              }
            }
          }catch{
            # Event details are optional. Failure to parse must never change collection status.
          }
        }
        $records+= $change
      }
      $result.events=@($records)
    }
  }
} catch {
  $fqid=[string]$_.FullyQualifiedErrorId
  if($_.Exception -is [System.UnauthorizedAccessException] -or $fqid -match 'Unauthorized|AccessDenied|SecurityException'){$result.reason='ACCESS_DENIED'}
  elseif($fqid -match 'LogNotFound|NoMatchingLogsFound'){$result.reason='LOG_NOT_FOUND'}
  else {$result.reason='QUERY_FAILED'}
}
$dest=Join-Path $OutputDirectory 'latest-defender.json'
$tmp=Join-Path $OutputDirectory ('.defender-'+[guid]::NewGuid().ToString('N')+'.tmp')
try{
  $json=ConvertTo-Json -InputObject $result -Depth 7 -Compress
  [System.IO.File]::WriteAllText($tmp,$json,(New-Object System.Text.UTF8Encoding($false)))
  Move-Item -LiteralPath $tmp -Destination $dest -Force -ErrorAction Stop
}finally{if(Test-Path -LiteralPath $tmp){Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue}}
Write-Host ('KESHEV Defender: '+$result.status+'; matching events='+@($result.events).Count+'; reason='+$result.reason+'; '+$dest)
