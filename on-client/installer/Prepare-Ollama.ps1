# KESHEV optional AI setup. No cloud model or security-setting changes.
$ErrorActionPreference = 'Stop'
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
try {
  Write-Host '[KESHEV] Optional local AI setup: gemma3:1b, Ollama.'
  $exe = Find-Ollama
  if (-not $exe) {
    Write-Host '[INFO] Ollama is not installed.'
    $winget = Get-Command winget.exe -ErrorAction SilentlyContinue
    if (-not $winget) {
      Write-Warning 'Windows Package Manager (winget) unavailable. Install from https://ollama.com/download/windows then rerun this setup.'
      Start-Process 'https://ollama.com/download/windows'
      return
    }
    Write-Host '[INFO] winget will request approval as necessary. No forced/silent installation.'
    & $winget.Source install --id Ollama.Ollama --exact --source winget --accept-source-agreements
    if ($LASTEXITCODE -ne 0) { throw 'Ollama winget installation did not succeed.' }
    $exe = Find-Ollama
    if (-not $exe) { throw 'Ollama installed but executable cannot be located. Try signing out/in and rerun preparation.' }
  } else {
    Write-Host '[OK] Existing Ollama found. Keeping current installation.'
  }
  Write-Host ('[INFO] Ollama executable: ' + $exe)
  $models = & $exe list 2>&1
  if ($LASTEXITCODE -ne 0) { throw 'Ollama CLI could not list models. Start Ollama then rerun preparation.' }
  $found = [bool](@($models | Where-Object { $_ -match '^gemma3:1b\s' }).Count)
  if (-not $found) {
    Write-Host '[INFO] Downloading gemma3:1b (about 806 MB). Internet connection required.'
    & $exe pull gemma3:1b
    if ($LASTEXITCODE -ne 0) { throw 'Model download failed. KESHEV base monitoring remains available.' }
  } else { Write-Host '[OK] gemma3:1b already installed.' }
  $dir = Join-Path $env:LOCALAPPDATA 'KeshevEndpoint'
  New-Item -ItemType Directory -Path $dir -Force | Out-Null
  $configPath = Join-Path $dir 'ai-local.json'
  if (Test-Path -LiteralPath $configPath) {
    $backup = $configPath + '.bak-' + (Get-Date -Format 'yyyyMMdd-HHmmss')
    Copy-Item -LiteralPath $configPath -Destination $backup -ErrorAction Stop
    Write-Host '[INFO] Existing AI config backed up.'
  }
  $config = @{enabled=$true;model='gemma3:1b'} | ConvertTo-Json
  [IO.File]::WriteAllText($configPath,$config,(New-Object Text.UTF8Encoding($false)))
  Write-Host '[OK] KESHEV AI config is ready. Start KESHEV - CPU Local AI from Start menu.'
} catch {
  Write-Host ('[WARN] Local AI optional preparation incomplete: ' + $_.Exception.Message) -ForegroundColor Yellow
  Write-Host '[INFO] KESHEV itself remains installed. You may run this file again.'
} finally { Read-Host 'Press Enter to close' | Out-Null }
