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
Name: "aiShortcut"; Description: "Add an optional CPU Ollama shortcut (Ollama and gemma3:1b must already be installed)"; GroupDescription: "Shortcuts:"; Flags: unchecked

[Files]
Source: "{#PortableDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\KESHEV"; Filename: "{app}\Start-Keshev.cmd"; WorkingDir: "{app}"
Name: "{group}\KESHEV - CPU Local AI"; Filename: "{app}\on-client\tools\Start-Keshev-CPU-AI.cmd"; WorkingDir: "{app}"; Tasks: aiShortcut
Name: "{group}\Uninstall KESHEV"; Filename: "{uninstallexe}"
Name: "{autodesktop}\KESHEV"; Filename: "{app}\Start-Keshev.cmd"; WorkingDir: "{app}"; Tasks: desktopicon

[Code]
function InitializeSetup(): Boolean;
begin
  Result := True;
end;
