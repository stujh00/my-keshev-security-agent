# KESHEV Phase 15 — Windows installer preview

This builds a **per-user Windows x64 installer** from the **same committed Git source** used for course submission. Keep all source and packaging files together in the same repository.

## Requirements
- Windows x64 with PowerShell, Node.js 24.19+ 24.x on the build PC only.
- [Inno Setup](https://jrsoftware.org/isdl.php) 7 or 6 installed on the build PC.
- Commit source, installer and documentation before building. The script stops on uncommitted changes (except the three known personal backup files).

## Build
1. Copy the `on-client/installer` folder into your original KESHEV repository (not a downloaded portable copy).
2. Review files, commit them with other final documentation in the same feature branch. Do not commit or upload `native.json`, `.env`, endpoint logs, certificates, keys, or personal backup files.
3. Run `on-client/installer/Build-Setup.cmd`.
4. The generated EXE, portable build and `SETUP-BUILD-REPORT.json` will be in a newly timestamped folder under `%TEMP%\KESHEV-Setup-Build\...\Output`.
5. Confirm the JSON report Git SHA is the **same SHA** submitted to ALEPH; verify the file SHA256.
6. On the build PC, with other KESHEV instances stopped, install and verify start/stop, data collection, and uninstall. Another-PC testing is pending.

## How the installer works
- Default path: `%LOCALAPPDATA%\Programs\KESHEV` (per-user, no admin needed for core installation).
- Installs built-in `runtime\node.exe` and original app files, plus Start Menu shortcuts and an uninstaller.
- CPU Ollama shortcut is an **opt-in shortcut**, not an Ollama installer. You must install Ollama and model `gemma3:1b` independently and configure `%LOCALAPPDATA%\KeshevEndpoint\ai-local.json` per PC.
- Windows Security collection requires independent administrator approval; no privilege escalation is attempted by installer.
- Enterprise ZTNA/SDP engine is not connected; do not present a non-connection as a functioning ZTNA security control.
- Uninstall removes program installation files; locally collected measurements in `%LOCALAPPDATA%\KeshevEndpoint` remain unless user chooses to remove them manually.
- Stop running app before installing/uninstalling. The launcher uses TCP port 5190; Ollama uses 11434.

## Important limitations
- A working Windows installer EXE cannot be established without running ISCC on Windows and installing/testing it. This is a **candidate**, not a certified product.
- Windows SmartScreen may warn on unsigned personal installers. Do not bypass organizational security policy.
- Compiler's default user language may be English; Korean installer localization can be added later.
- Reproducible **source identity** is enforced by commit checks, but binary reproducibility is not established.
- The bundler is designed to reject known secret file types but does not guarantee no secrets embedded in source. Review before public distribution.
