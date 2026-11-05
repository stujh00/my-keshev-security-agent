# KESHEV optional local AI preparation (PowerShell 5.1 compatible).
# Does not uninstall, upgrade, or overwrite existing Ollama installation/models.
$ErrorActionPreference = 'Stop'
$ownedServer = $null

function Find-Ollama {
  $known = @(
    (Join-Path $env:LOCALAPPDATA 'Programs\Ollama\ollama.exe'),
    (Join-Path $env:ProgramFiles 'Ollama\ollama.exe')
  )
  foreach ($p in $known) { if (Test-Path -LiteralPath $p -PathType Leaf) { return $p } }
  $cmd = Get-Command ollama.exe -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  return $null
}

function Get-Tags {
  return Invoke-RestMethod -Uri 'http://127.0.0.1:11434/api/tags' -Method Get -TimeoutSec 8 -ErrorAction Stop
}

function Wait-BoundedProcess([string]$FilePath, [string[]]$Arguments, [int]$Seconds) {
  $p = Start-Process -FilePath $FilePath -ArgumentList $Arguments -PassThru -NoNewWindow -ErrorAction Stop
  try {
    if (-not $p.WaitForExit($Seconds * 1000)) {
      try { $p.Kill() } catch { }
      throw ('TIMEOUT: ' + $FilePath + ' ' + ($Arguments -join ' '))
    }
    if ($p.ExitCode -ne 0) { throw ('Command failed with exit code ' + $p.ExitCode) }
  } finally { $p.Dispose() }
}

try {
  Write-Host '[KESHEV] Optional local AI setup: gemma3:1b, Ollama.'
  $exe = Find-Ollama
  if (-not $exe) {
    Write-Host '[INFO] Ollama is not installed.'
    $winget = Get-Command winget.exe -ErrorAction SilentlyContinue
    if (-not $winget) {
      Write-Warning 'winget unavailable. Install Ollama from https://ollama.com/download/windows, then rerun this script.'
      return
    }
    Write-Host '[INFO] Installing Ollama with winget. Any necessary approval remains visible.'
    Wait-BoundedProcess -FilePath $winget.Source -Arguments @('install','--id','Ollama.Ollama','--exact','--source','winget','--accept-source-agreements') -Seconds 900
    $exe = Find-Ollama
    if (-not $exe) { throw 'Ollama installed but executable could not be located.' }
  } else {
    Write-Host '[OK] Existing Ollama found. Keeping current installation.'
  }
  Write-Host ('[INFO] Ollama executable: ' + $exe)

  $tags = $null
  try { $tags = Get-Tags } catch {
    $listener = @(Get-NetTCPConnection -LocalPort 11434 -State Listen -ErrorAction SilentlyContinue)
    if ($listener.Count -gt 0) {
      throw 'Port 11434 is in use but Ollama API did not respond in 8 seconds. No external processes were stopped.'
    }
    Write-Host '[INFO] Ollama API not running. Starting temporary CPU-only local Ollama server.'
    $priorCuda = [Environment]::GetEnvironmentVariable('CUDA_VISIBLE_DEVICES','Process')
    $priorVk = [Environment]::GetEnvironmentVariable('GGML_VK_VISIBLE_DEVICES','Process')
    $priorCloud = [Environment]::GetEnvironmentVariable('OLLAMA_NO_CLOUD','Process')
    $priorVulkan = [Environment]::GetEnvironmentVariable('OLLAMA_VULKAN','Process')
    try {
      $env:CUDA_VISIBLE_DEVICES = '-1'
      $env:GGML_VK_VISIBLE_DEVICES = '-1'
      $env:OLLAMA_NO_CLOUD = '1'
      $env:OLLAMA_VULKAN = 'false'
      $ownedServer = Start-Process -FilePath $exe -ArgumentList 'serve' -PassThru -WindowStyle Hidden -ErrorAction Stop
    } finally {
      [Environment]::SetEnvironmentVariable('CUDA_VISIBLE_DEVICES',$priorCuda,'Process')
      [Environment]::SetEnvironmentVariable('GGML_VK_VISIBLE_DEVICES',$priorVk,'Process')
      [Environment]::SetEnvironmentVariable('OLLAMA_NO_CLOUD',$priorCloud,'Process')
      [Environment]::SetEnvironmentVariable('OLLAMA_VULKAN',$priorVulkan,'Process')
    }
    for ($i=0; $i -lt 15; $i++) {
      Start-Sleep -Seconds 1
      try { $tags = Get-Tags; break } catch { }
      if ($ownedServer.HasExited) { break }
    }
    if ($null -eq $tags) { throw 'Ollama server did not become ready in the allotted time.' }
  }

  $found = @($tags.models | Where-Object { $_.name -eq 'gemma3:1b' -or $_.model -eq 'gemma3:1b' }).Count -gt 0
  if ($found) {
    Write-Host '[OK] gemma3:1b already installed. No download needed.'
  } else {
    Write-Host '[INFO] Downloading gemma3:1b (approximately 806 MB). May require Internet access.'
    Wait-BoundedProcess -FilePath $exe -Arguments @('pull','gemma3:1b') -Seconds 900
    $tags = Get-Tags
    if (@($tags.models | Where-Object { $_.name -eq 'gemma3:1b' -or $_.model -eq 'gemma3:1b' }).Count -eq 0) {
      throw 'Model download reported success but gemma3:1b is not listed by local Ollama API.'
    }
  }

  $dir = Join-Path $env:LOCALAPPDATA 'KeshevEndpoint'
  New-Item -ItemType Directory -Path $dir -Force | Out-Null
  $configPath = Join-Path $dir 'ai-local.json'
  $desired = @{ enabled = $true; model = 'gemma3:1b' }
  $same = $false
  if (Test-Path -LiteralPath $configPath -PathType Leaf) {
    try { $old = Get-Content -LiteralPath $configPath -Raw -Encoding UTF8 | ConvertFrom-Json; $same = ($old.enabled -eq $true -and $old.model -eq 'gemma3:1b') } catch { }
    if (-not $same) {
      $backup = $configPath + '.bak-' + (Get-Date -Format 'yyyyMMdd-HHmmss')
      Copy-Item -LiteralPath $configPath -Destination $backup -ErrorAction Stop
      Write-Host '[INFO] Previous AI config backed up.'
    }
  }
  if (-not $same) {
    $json = $desired | ConvertTo-Json
    [IO.File]::WriteAllText($configPath,$json,(New-Object Text.UTF8Encoding($false)))
  }
  Write-Host '[OK] KESHEV AI is ready. Start CPU Local AI from the KESHEV shortcut.'
} catch {
  Write-Host ('[WARN] Optional AI setup incomplete: ' + $_.Exception.Message) -ForegroundColor Yellow
  Write-Host '[INFO] KESHEV remains installed. Existing Ollama/models were not uninstalled.'
  exit 1
} finally {
  if ($null -ne $ownedServer) {
    try { if (-not $ownedServer.HasExited) { $ownedServer.Kill(); $ownedServer.WaitForExit(5000) | Out-Null } } catch { }
    $ownedServer.Dispose()
  }
}
