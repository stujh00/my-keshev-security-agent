# KESHEV stage 3: read-only local Windows connection / firewall / event summary
# Does not modify firewall, network settings, existing KESHEV files or credentials.
[CmdletBinding()]
param([string]$OutputDirectory = (Join-Path $env:LOCALAPPDATA 'KeshevEndpoint\measurements'))
$ErrorActionPreference = 'Stop'
$now = Get-Date
$stamp = $now.ToString('yyyy-MM-ddTHH:mm:sszzz')
$sample = [ordered]@{
    schemaVersion = 1
    evidence = 'actual_windows_query'
    sampleData = $false
    collectedAt = $stamp
    windowHours = 24
    network = [ordered]@{status='unavailable'; adapters=@(); reason=$null; observedAt=$null}
    firewall = [ordered]@{status='unavailable'; profiles=@(); reason=$null; observedAt=$null}
    windowsEvents = [ordered]@{status='unavailable'; system=[ordered]@{status='unavailable'; warningCount=$null; errorCount=$null; reason=$null}; application=[ordered]@{status='unavailable'; warningCount=$null; errorCount=$null; reason=$null}; observedAt=$null}
}
try {
    $adapters = @(Get-NetAdapter -ErrorAction Stop | Select-Object Name, Status, LinkSpeed)
    $sample.network.adapters = @($adapters | ForEach-Object {
        [ordered]@{name=[string]$_.Name; status=[string]$_.Status; linkSpeed=[string]$_.LinkSpeed}
    })
    $sample.network.status = 'ok'
    $sample.network.observedAt = (Get-Date).ToString('yyyy-MM-ddTHH:mm:sszzz')
} catch {
    $sample.network.reason = 'Adapter query failed or was denied; inspect local permissions and network cmdlet availability.'
}
try {
    $profiles = @(Get-NetFirewallProfile -ErrorAction Stop | Select-Object Name, Enabled)
    $sample.firewall.profiles = @($profiles | ForEach-Object {
        [ordered]@{name=[string]$_.Name; enabled=if ($null -eq $_.Enabled) {$null} else {[bool]$_.Enabled}}
    })
    $sample.firewall.status = 'ok'
    $sample.firewall.observedAt = (Get-Date).ToString('yyyy-MM-ddTHH:mm:sszzz')
} catch {
    $sample.firewall.reason = 'Firewall profile query failed or was denied.'
}
$since = $now.AddHours(-24)
foreach ($entry in @(@('System','system'),@('Application','application'))) {
    $logName = $entry[0]
    $key = $entry[1]
    try {
        $events = @(Get-WinEvent -FilterHashtable @{LogName=$logName; Level=2,3; StartTime=$since} -ErrorAction Stop)
        $sample.windowsEvents[$key].warningCount = @($events | Where-Object Level -eq 3).Count
        $sample.windowsEvents[$key].errorCount = @($events | Where-Object Level -eq 2).Count
        $sample.windowsEvents[$key].status = 'ok'
    } catch {
        $err = $_.FullyQualifiedErrorId
        # "No matching events" is a successful zero-count observation, not a permission failure.
        if ($err -match 'NoMatchingEventsFound') {
            $sample.windowsEvents[$key].warningCount = 0
            $sample.windowsEvents[$key].errorCount = 0
            $sample.windowsEvents[$key].status = 'ok'
        } else {
            $sample.windowsEvents[$key].reason = 'Event query failed or was denied (error identifier: ' + [string]$err + ').'
        }
    }
}
$sample.windowsEvents.observedAt = (Get-Date).ToString('yyyy-MM-ddTHH:mm:sszzz')
if ($sample.windowsEvents.system.status -eq 'ok' -and $sample.windowsEvents.application.status -eq 'ok') {
    $sample.windowsEvents.status = 'ok'
} elseif ($sample.windowsEvents.system.status -eq 'ok' -or $sample.windowsEvents.application.status -eq 'ok') {
    $sample.windowsEvents.status = 'partial'
}
$destination = Join-Path $OutputDirectory ('keshev-connection-actual-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + ([guid]::NewGuid().ToString('N').Substring(0,8)) + '.json')
$json = $sample | ConvertTo-Json -Depth 8
[System.IO.File]::WriteAllText($destination, $json, [System.Text.UTF8Encoding]::new($false))
Write-Host '===== KESHEV connection actual measurements ====='
Write-Host ('Collected: ' + $sample.collectedAt)
Write-Host ('Network status: ' + $sample.network.status)
if ($sample.network.status -eq 'ok') { $sample.network.adapters | ForEach-Object { Write-Host ('  ' + $_.name + ': ' + $_.status + ' / ' + $_.linkSpeed) } }
Write-Host ('Firewall status: ' + $sample.firewall.status)
if ($sample.firewall.status -eq 'ok') { $sample.firewall.profiles | ForEach-Object { Write-Host ('  ' + $_.name + ': ' + $_.enabled) } }
foreach ($key in @('system','application')) {
    $item = $sample.windowsEvents[$key]
    if ($item.status -eq 'ok') { Write-Host ($key + ' (last 24h): warning=' + $item.warningCount + ', error=' + $item.errorCount) }
    else { Write-Host ($key + ' (last 24h): unavailable (' + $item.reason + ')') }
}
Write-Host ('Saved JSON: ' + $destination)
Write-Output ('KESHEV_OUTPUT_PATH=' + $destination)
Write-Host 'No KESHEV project files or system settings were modified.'
