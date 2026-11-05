# KESHEV — Windows 설치 및 다른 PC 실행 안내

케셰브(KESHEV)는 Windows PC의 로컬 보안 정보를 수집해 웹 대시보드(`http://127.0.0.1:5190/`)에서 표시하는 프로젝트입니다. Windows Defender 이벤트에 대한 로컬 AI 분석은 선택 기능입니다.

> **EXE 파일이 GitHub에 올라와 있지 않다면** GitHub 소스코드를 내려받아 Windows에서 설치 파일을 직접 빌드해야 합니다. `KESHEV-Setup.exe`를 한 번 만들어 다른 Windows PC로 전달한 뒤에는 설치 대상 PC에서 별도의 빌드가 필요하지 않습니다.

## A. 이미 설치 EXE가 있는 PC에서 사용

1. 신뢰할 수 있는 출처에서 `KESHEV-Setup.exe`를 받습니다. 제공된 SHA-256 값이 있다면 해시를 대조합니다.
2. EXE를 실행해 설치 마법사를 완료합니다. 기본 설치 경로는 `%LOCALAPPDATA%\Programs\KESHEV`입니다.
3. 시작 메뉴에서 **KESHEV**를 실행합니다.
4. 브라우저에서 **http://127.0.0.1:5190/** 를 엽니다.
5. 종료 시 실행 창에서 `Ctrl+C` 또는 설치 폴더의 `Stop-Keshev.cmd`를 사용합니다.

**설치 대상 PC에는 Node.js와 Inno Setup을 별도로 설치할 필요가 없습니다.** 설치 패키지에 Node.js 런타임이 포함됩니다. Windows PowerShell과 Windows 이벤트 로그 기능은 필요합니다. Security 로그 수집은 별도 관리자 권한 승인이 필요할 수 있습니다.

## B. GitHub에 EXE가 없을 때: 설치 EXE 직접 만들기

**빌드 PC 준비물**

- Windows x64, PowerShell, Git
- Node.js **24.19 이상인 24.x 버전**
- [Inno Setup 6 또는 7](https://jrsoftware.org/isdl.php)
- 최초 소스 다운로드와 필요시 Node.js 라이선스 확인을 위한 인터넷 연결

PowerShell에서 GitHub 소스를 복제합니다. **GitHub Download ZIP 대신 `git clone`을 사용하세요.** 기존 빌드 도구는 Git 커밋 확인을 요구합니다.

```powershell
git clone --branch feature/keshev-deployment-profile-v1 https://github.com/stujh00/my-keshev-security-agent.git KESHEV-Source
cd KESHEV-Source
git rev-parse HEAD
```

**ALEPH 제출 당시의 정확한 소스(2026-11-05)** 로 만들려면 다음 명령으로 고정된 커밋을 선택할 수 있습니다. 이 경우 제출 이후 추가된 문서는 작업 트리에서 빠지는 것이 정상입니다.

```powershell
git checkout 43557fa34ea27345e80874c60e582e94491f4755
```

소스 파일을 편집하지 않은 깨끗한 Git 상태에서 기존 빌드 도구를 실행합니다.

```powershell
& '.\on-client\installer\Build-Setup.cmd'
```

빌드 성공 시 `KESHEV-Setup.exe`와 `SETUP-BUILD-REPORT.json`이 아래 형태의 **빌드 PC** 경로에 생성됩니다.

```text
%TEMP%\KESHEV-Setup-Build\<커밋앞8자리>-<빌드시각>\Output\
```

빌드 보고서의 `commit` 값이 의도한 Git SHA와 일치하는지 확인하고, 설치 파일의 SHA-256도 확인합니다.

```powershell
Get-FileHash 'C:\path\to\KESHEV-Setup.exe' -Algorithm SHA256
```

EXE를 설치할 PC로 안전하게 복사한 뒤 위 **A** 절차대로 설치합니다. **EXE 생성 성공과 다른 PC에서의 정상 작동은 별도의 검증 사항입니다.**

## C. 선택 기능: Ollama 로컬 AI

설치 EXE에 **Ollama와 AI 모델은 포함되지 않습니다.** AI 기능이 필요하면 해당 PC에 별도로 설정합니다.

1. [Ollama for Windows](https://ollama.com/download/windows)를 설치합니다.
2. PowerShell에서 `ollama pull gemma3:1b`를 실행하여 모델을 받습니다(약 806MB).
3. 설치 폴더의 `setup-tools\Prepare-Ollama.ps1`을 검토한 뒤 실행하면 Ollama·모델 확인과 `ai-local.json` 설정을 보조할 수 있습니다. 설치 과정에서 선택형 AI 준비 작업을 선택했다면 완료 여부를 먼저 확인하세요.
4. `%LOCALAPPDATA%\KeshevEndpoint\ai-local.json`이 아래 설정을 갖는지 확인합니다.

```json
{
  "enabled": true,
  "model": "gemma3:1b"
}
```

5. 시작 메뉴의 **KESHEV - CPU Local AI** 바로가기로 실행합니다. 바로가기가 없다면 설치 프로그램의 선택 항목에서 추가할 수 있습니다.

CPU 전용 실행기는 포트 `11434`에서 다른 Ollama 서버가 실행 중이면 안전하게 중단할 수 있습니다. 기존 Ollama 작업을 **정상 종료**한 후 다시 시도하세요. 케셰브 자체는 `5190` 포트를 사용합니다. 로컬 AI가 영어로 응답할 수도 있으며, 분석 의견은 검증된 보안 판단이나 자동 조치가 아닙니다.

## D. 실제 확인 상태 및 한계

- **최종 제출 소스 커밋:** `43557fa34ea27345e80874c60e582e94491f4755`
- 해당 커밋에서 Windows 설치 EXE **빌드**, Portable 무결성 확인, **기존 설치가 있던 개발 PC에서 재설치와 웹 UI 실행**을 확인했습니다.
- **완전히 새로운 다른 PC에서의 최초 설치·실행은 아직 검증되지 않았습니다.** 해당 PC의 Windows 버전, 권한 및 보안정책에 따라 별도 점검이 필요합니다.
- 기업용 ZTNA/SDP 중앙 서버는 기본 연결되지 않습니다. 화면의 'ZTNA 서버 미연결'은 연결 실패를 정직하게 표시하는 것입니다.
- Windows SmartScreen은 서명되지 않은 개인 제작 EXE에 경고할 수 있습니다. 조직의 보안정책을 우회하지 마세요.
- 인증정보(`native.json`, `.env`, 인증서·키), 개인 로그 및 측정값을 배포하지 않도록 설계되어 있으나, 공개·공유 전 파일을 다시 검토하세요.
- 프로그램 제거 후 `%LOCALAPPDATA%\KeshevEndpoint`의 로컬 수집 데이터나 설정은 남을 수 있습니다.

추가 설치기 정보: [`on-client/installer/README.md`](on-client/installer/README.md)

**참고:** 이 설치 안내는 최종 제출 이후 작성됐습니다. 문서 추가 커밋이 생기더라도 위 40자리 **기존 제출 커밋은 그대로 보존**됩니다.
