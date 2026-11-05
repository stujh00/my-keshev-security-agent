#ifndef PortableDir
  #error PortableDir must be supplied by Build-Setup.ps1
#endif
#ifndef OutputFolder
  #error OutputFolder must be supplied by Build-Setup.ps1
#endif
#ifndef BuildSha
  #error BuildSha must be supplied by Build-Setup.ps1
#endif

#define AppName "KESHEV Endpoint Security"
#define AppVersion "1.0.0-preview"

[Setup]
AppId={{A6DD9B70-D20E-40FD-BB55-1ADE8B3A1F92}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher=KESHEV Project
DefaultDirName={localappdata}\Programs\KESHEV
DefaultGroupName=KESHEV
OutputDir={#OutputFolder}
OutputBaseFilename=KESHEV-Setup
Compression=lzma2
SolidCompression=yes
PrivilegesRequired=lowest
WizardStyle=modern
UninstallDisplayName=KESHEV Endpoint Security
VersionInfoDescription=KESHEV local endpoint collector and investigation UI
VersionInfoProductName=KESHEV Endpoint Security
DisableProgramGroupPage=yes

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "Create a desktop shortcut"; GroupDescription: "Shortcuts:"; Flags: unchecked
Name: "aiShortcut"; Description: "Create CPU-only local AI shortcut (requires Ollama)"; GroupDescription: "Shortcuts:"; Flags: unchecked
Name: "prepareAI"; Description: "Prepare Ollama + gemma3:1b after installing KESHEV (internet required)"; GroupDescription: "Optional local AI:"; Flags: unchecked

[Files]
Source: "{#PortableDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

Source: "Prepare-Ollama.ps1"; DestDir: "{app}\setup-tools"; Flags: ignoreversion

[Icons]
Name: "{group}\KESHEV"; Filename: "{app}\Start-Keshev.cmd"; WorkingDir: "{app}"
Name: "{group}\KESHEV - CPU Local AI"; Filename: "{app}\on-client\tools\Start-Keshev-CPU-AI.cmd"; WorkingDir: "{app}"; Tasks: aiShortcut prepareAI
Name: "{group}\Uninstall KESHEV"; Filename: "{uninstallexe}"
Name: "{autodesktop}\KESHEV"; Filename: "{app}\Start-Keshev.cmd"; WorkingDir: "{app}"; Tasks: desktopicon

[Run]
Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\setup-tools\Prepare-Ollama.ps1"""; Description: "Set up optional Ollama and gemma3:1b model"; Tasks: prepareAI; Flags: postinstall nowait skipifsilent

[Code]
function InitializeSetup(): Boolean;
begin
  Result := True;
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
var
  ErrorCode: Integer;
begin
  if (CurUninstallStep = usPostUninstall) and (not UninstallSilent) then
  begin
    if MsgBox('KESHEV has been removed. Ollama and its downloaded models are independent and remain installed.' + #13#10 +
      'Would you like to open Windows Installed Apps to review/remove Ollama separately?',
      mbConfirmation, MB_YESNO) = IDYES then
      ShellExec('open', 'ms-settings:appsfeatures', '', '', SW_SHOWNORMAL, ewNoWait, ErrorCode);
  end;
end;
