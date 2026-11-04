# KESHEV Windows x64 setup builder. Read-only to original sources; writes preview and EXE outside the repository.
# Run from a COMMITTED repository state. Do not package credentials or endpoint logs.
$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$source = Join-Path $repo 'on-client'
$installer = Join-Path $PSScriptRoot 'KESHEV.iss'
function Require-Success([string]$label) { if ($LASTEXITCODE -ne 0) { throw "$label failed (exit $LASTEXITCODE)" } }

if (-not (Test-Path $installer)) { throw 'Inno Setup script missing' }
$head = (& git -C $repo rev-parse HEAD).Trim(); Require-Success 'git rev-parse'
$branch = (& git -C $repo branch --show-current).Trim(); Require-Success 'git branch'
$changes = @(& git -C $repo status --porcelain --untracked-files=all); Require-Success 'git status'
$unexpected = @($changes | Where-Object { $_ -and $_ -notmatch 'on-client[\\/]student[\\/]extension\.mjs\.before-' -and $_ -notmatch 'on-client[\\/]tools[\\/]Launch-Keshev\.mjs\.before-' })
if ($unexpected.Count) { Write-Host '[STOP] Commit reviewed changes first:'; $unexpected; throw 'Git is not clean. Installer must match an exact commit.' }
$node = (Get-Command node.exe -ErrorAction Stop).Source
$version = & $node --version; Require-Success 'node --version'
if ($version -notmatch '^v24\.') { throw "Node 24.x required for existing portable builder; got $version" }

$isccCandidates = @(
  (Join-Path ${env:ProgramFiles} 'Inno Setup 7\ISCC.exe'),
  (Join-Path ${env:ProgramFiles(x86)} 'Inno Setup 7\ISCC.exe'),
  (Join-Path ${env:ProgramFiles(x86)} 'Inno Setup 6\ISCC.exe'),
  (Join-Path ${env:ProgramFiles} 'Inno Setup 6\ISCC.exe')
)
$iscc = $isccCandidates | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
if (-not $iscc) { $cmd = Get-Command ISCC.exe -ErrorAction SilentlyContinue; if ($cmd) { $iscc = $cmd.Source } }
if (-not $iscc) { throw 'Inno Setup compiler ISCC.exe not found. Install official Inno Setup 7 or 6.' }

$root = Join-Path $env:TEMP 'KESHEV-Setup-Build'
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$work = Join-Path $root "$($head.Substring(0,8))-$stamp"
$portable = Join-Path $work 'Portable'
$output = Join-Path $work 'Output'
New-Item -ItemType Directory -Path $work,$output -Force | Out-Null
$env:KESHEV_REPO = $repo
$env:KESHEV_RELEASE_DIR = $portable
Write-Host "[INFO] Building exact commit: $head ($branch)"
Write-Host "[INFO] Windows Node runtime: $version"
& $node (Join-Path $source 'tools\Build-KeshevRelease.mjs'); Require-Success 'Portable build'
& (Join-Path $portable 'runtime\node.exe') (Join-Path $portable 'Verify-Portable.mjs'); Require-Success 'Portable verification'
$report = Get-Content (Join-Path $portable 'BUILD-REPORT.json') -Raw | ConvertFrom-Json
if ($report.sourceGitCommit -ne $head -or $report.sourceTrackedFilesDirty -ne $false) { throw 'Build provenance mismatch or dirty tracked files' }
if (-not (Test-Path (Join-Path $portable 'on-client\tools\Start-Keshev-CPU-AI.cmd'))) { throw 'CPU AI launcher missing from portable output' }
Write-Host "[INFO] Compiling Inno Setup (no automatic upload)"
& $iscc "/DPortableDir=$portable" "/DOutputFolder=$output" "/DBuildSha=$head" $installer
Require-Success 'ISCC compilation'
$setup = Join-Path $output 'KESHEV-Setup.exe'
if (-not (Test-Path $setup)) { throw 'Setup EXE not generated' }
$sha256 = (Get-FileHash $setup -Algorithm SHA256).Hash
$summary = [ordered]@{ commit=$head; branch=$branch; version='1.0.0-preview'; setupFile=$setup; sha256=$sha256; nodeVersion=$version; aiInstallerIncluded=$false; aiShortcutOptional=$true; otherPcTested=$false; builtAt=(Get-Date).ToString('o') }
$summary | ConvertTo-Json | Set-Content -Path (Join-Path $output 'SETUP-BUILD-REPORT.json') -Encoding UTF8
Write-Host "[OK] Installer produced: $setup"
Write-Host "[OK] SHA256: $sha256"
Write-Host "[INFO] Build commit: $head"
Write-Host '[NOTICE] This only establishes EXE creation, not installation/other-PC compatibility.'
Write-Host '[NOTICE] Ollama/model are not bundled. AI is optional and must be set up separately.'
