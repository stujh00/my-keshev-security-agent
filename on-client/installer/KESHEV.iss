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
#define AppVersion "1.0.1-preview"

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
UsePreviousAppDir=yes
CloseApplications=yes
RestartApplications=no

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "Create a desktop shortcut"; GroupDescription: "Shortcuts:"; Flags: unchecked
Name: "aiShortcut"; Description: "Create CPU-only local AI shortcut (requires Ollama)"; GroupDescription: "Shortcuts:"; Flags: unchecked
Name: "prepareAI"; Description: "Prepare Ollama + gemma3:1b after installing KESHEV (internet required; new installations only)"; GroupDescription: "Optional local AI:"; Flags: unchecked; Check: IsFreshInstall

[Files]
Source: "{#PortableDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

Source: "Prepare-Ollama.ps1"; DestDir: "{app}\setup-tools"; Flags: ignoreversion

[Icons]
Name: "{group}\KESHEV"; Filename: "{app}\Start-Keshev.cmd"; WorkingDir: "{app}"
Name: "{group}\KESHEV - CPU Local AI"; Filename: "{app}\on-client\tools\Start-Keshev-CPU-AI.cmd"; WorkingDir: "{app}"; Tasks: aiShortcut prepareAI
Name: "{group}\Uninstall KESHEV"; Filename: "{uninstallexe}"
Name: "{autodesktop}\KESHEV"; Filename: "{app}\Start-Keshev.cmd"; WorkingDir: "{app}"; Tasks: desktopicon

[Run]
Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\setup-tools\Prepare-Ollama.ps1"""; Description: "Set up optional Ollama and gemma3:1b model"; Tasks: prepareAI; Flags: postinstall nowait skipifsilent; Check: IsFreshInstall

[Code]
// Stable GUID is identical to the Phase 15.1 AppId; _is1 is Inno's uninstall key suffix.
function ExistingInstallKey(): String;
begin
  Result := 'Software\Microsoft\Windows\CurrentVersion\Uninstall\{A6DD9B70-D20E-40FD-BB55-1ADE8B3A1F92}_is1';
end;

function IsExistingInstall(): Boolean;
begin
  Result := RegKeyExists(HKCU, ExistingInstallKey());
end;

function IsFreshInstall(): Boolean;
begin
  Result := not IsExistingInstall();
end;

// Read the three numeric components, accepting a -preview suffix.
// Unknown or malformed version formats cause a safe abort.
function ReadVersionPart(var Remaining: String; var Part: Integer): Boolean;
var
  DotPos: Integer;
  Component: String;
begin
  DotPos := Pos('.', Remaining);
  if DotPos > 0 then
  begin
    Component := Copy(Remaining, 1, DotPos - 1);
    Delete(Remaining, 1, DotPos);
  end
  else
  begin
    Component := Remaining;
    Remaining := '';
  end;
  Part := StrToIntDef(Component, -1);
  Result := (Component <> '') and (Part >= 0);
end;

function CompareKeshevVersions(Installed, Incoming: String; var Comparison: Integer): Boolean;
var
  A, B: String;
  I, Pa, Pb, Dash: Integer;
begin
  Comparison := 0;
  Dash := Pos('-', Installed);
  if Dash > 0 then Installed := Copy(Installed, 1, Dash - 1);
  Dash := Pos('-', Incoming);
  if Dash > 0 then Incoming := Copy(Incoming, 1, Dash - 1);
  A := Installed;
  B := Incoming;
  Result := False;
  for I := 1 to 3 do
  begin
    if not ReadVersionPart(A, Pa) then Exit;
    if not ReadVersionPart(B, Pb) then Exit;
    if Comparison = 0 then
    begin
      if Pa > Pb then Comparison := 1;
      if Pa < Pb then Comparison := -1;
    end;
  end;
  Result := (A = '') and (B = '');
end;

function InitializeSetup(): Boolean;
var
  OldVersion, OldPath, NewVersion, Details: String;
  Comparison: Integer;
begin
  Result := False;
  // This installer runs per-user. Never overwrite a machine-wide installation.
  if RegKeyExists(HKLM, ExistingInstallKey()) and (not IsExistingInstall()) then
  begin
    MsgBox('A machine-wide KESHEV installation was found.' + #13#10 +
      'This per-user installer cannot update it safely. No files were changed.',
      mbCriticalError, MB_OK);
    Exit;
  end;

  if not IsExistingInstall() then
  begin
    Result := True;
    Exit;
  end;

  // Existing registry entry must identify a usable installation.
  if (not RegQueryStringValue(HKCU, ExistingInstallKey(), 'Inno Setup: App Path', OldPath)) or
     (OldPath = '') or (not DirExists(OldPath)) then
  begin
    MsgBox('KESHEV installation registration was found, but its install path is missing.' + #13#10 +
      'Setup will stop without modifying the existing installation.',
      mbCriticalError, MB_OK);
    Exit;
  end;

  if not RegQueryStringValue(HKCU, ExistingInstallKey(), 'DisplayVersion', OldVersion) then
  begin
    MsgBox('KESHEV is installed, but its version cannot be determined.' + #13#10 +
      'Setup will stop to protect existing files and data.', mbCriticalError, MB_OK);
    Exit;
  end;

  NewVersion := '{#AppVersion}';
  if not CompareKeshevVersions(OldVersion, NewVersion, Comparison) then
  begin
    MsgBox('Cannot safely compare installed KESHEV version ' + OldVersion +
      ' to package version ' + NewVersion + '.' + #13#10 +
      'Setup will stop without changing the installation.', mbCriticalError, MB_OK);
    Exit;
  end;

  if Comparison > 0 then
  begin
    MsgBox('A newer KESHEV version (' + OldVersion + ') is already installed.' + #13#10 +
      'Downgrade to ' + NewVersion + ' is blocked.', mbCriticalError, MB_OK);
    Exit;
  end;

  if WizardSilent then
  begin
    Log('KESHEV update requires interactive confirmation. Silent upgrade refused.');
    Exit;
  end;

  Details := 'Existing KESHEV installation detected.' + #13#10 +
    'Installed version: ' + OldVersion + #13#10 +
    'Installer version: ' + NewVersion + #13#10 +
    'Location: ' + OldPath + #13#10#13#10;

  if Comparison = 0 then
    Details := Details + 'Reinstall the same version?' + #13#10
  else
    Details := Details + 'Update the existing installation?' + #13#10;

  Details := Details +
    'Your settings and measurements under %LOCALAPPDATA%\KeshevEndpoint remain outside the install directory.' + #13#10 +
    'Ollama and downloaded models will not be removed or reinstalled.' + #13#10 +
    'Please close KESHEV before continuing.' + #13#10#13#10 +
    'Continue?';

  Result := MsgBox(Details, mbConfirmation, MB_YESNO or MB_DEFBUTTON2) = IDYES;
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
