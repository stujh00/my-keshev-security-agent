# 케셰브(KESHEV) 22단계 최종 재현 및 인수인계 기록

> 기록 기준: 2026-10-27 (Asia/Seoul). 이 문서는 학생이 직접 실행하여 전달한 로그·화면과 저장소 원문 확인을 구분한 재현 기록입니다. **22단계 공식 심사 통과, 운영 환경 인증, v1.0 릴리스를 의미하지 않습니다.**

## 1. 재현 대상 및 버전

| 구분 | 기록 |
|---|---|
| 프로젝트 | 케셰브 — ZTNA & XDR 보안 Agent |
| GitHub 저장소 | `https://github.com/stujh00/my-keshev-security-agent` |
| 재현 기준 브랜치 | `main` |
| **실제로 복제·재현한 코드 커밋** | `75fd1c90c3319d8f3581a45794f4aaec7beee4d1` |
| 22단계 문서 포함 제출 커밋 | **커밋 전: 최종 제출 직전에 새 40자리 SHA를 기록할 것** |
| 시작 틀 | `alekov-client-starter` 0.2.14 (`on-client/package.json`) |
| Node.js | 학생 PC 실행 로그 `v24.21.0`; 수업 기준 `v24.19.0`에서 직접 실행하지 않음 |
| npm / Git / PowerShell 정확한 버전 | 미기록·미확인 |
| OS·브라우저 | Windows PowerShell과 Chrome 화면에서 확인; 구체적인 OS 빌드·브라우저 버전 미기록 |
| 릴리스 상태 | **검증 중(운영 인증 전)** |

문서 커밋을 생성한 후에는 22단계 제출 SHA가 위의 '실제로 재현한 코드 커밋'과 달라집니다. **코드·기능에 변경이 없다면 재현한 코드 커밋과 문서 포함 제출 커밋을 분리하여 표시합니다.** 필요하면 제출 커밋 자체도 같은 새 폴더에서 다시 받아 문서 포함 여부와 실행을 확인하고 그 결과를 추가 기록합니다. 서로 다른 커밋의 판정 결과를 하나의 최종 커밋에 대해 수행한 검증으로 합산하지 않습니다.

## 2. 작업 폴더 보존과 별도 복제

- 원본 프로젝트: `C:\Users\User\AppData\Local\ALEPH\Workbench\projects\케셰브-방어전`
- 재현용 별도 폴더: `C:\Users\User\AppData\Local\ALEPH\Workbench\projects\케셰브-최종재현`
- 학생이 원본에서 `git status --short` 공백 출력을 확인한 뒤, `git rev-parse HEAD` 및 `git ls-remote origin refs/heads/main`이 모두 `75fd1c90c3319d8f3581a45794f4aaec7beee4d1`을 가리킴을 확인함.
- 복제 후 `git checkout --detach 75fd1c90c3319d8f3581a45794f4aaec7beee4d1`, `git rev-parse HEAD`로 일치 확인; 복제 폴더의 `git status --short`도 공백 출력됨.
- 원본 폴더 삭제·덮어쓰기·초기화는 수행하지 않음. 재현용 폴더에 원본 Native Host 인증 자료·토큰·키를 복사하지 않음.

### 같은 커밋을 새 폴더에 복제하는 절차

기존 폴더를 그대로 두고 **빈 폴더명**으로만 실행합니다. 예시 폴더가 이미 있다면 그대로 다시 clone하지 않고 기존 재현 기록을 보존합니다.

```powershell
cd "C:\Users\User\AppData\Local\ALEPH\Workbench\projects"
git clone https://github.com/stujh00/my-keshev-security-agent.git "케셰브-최종재현"
cd .\케셰브-최종재현
git checkout --detach 75fd1c90c3319d8f3581a45794f4aaec7beee4d1
git rev-parse HEAD
git status --short
```

다른 PC에서는 상위 폴더와 프로젝트 폴더명만 본인 환경에 맞게 지정합니다. 위 Windows 절대 경로는 **이번 학생 PC에서 관찰한 경로의 기록**일 뿐, 다른 PC에서 필수인 경로가 아닙니다.

## 3. 설치·실행·종료·재실행과 관찰 근거

제공된 `on-client/README.md`, `on-client/docs/STUDENT_LAUNCH_GUIDE.md`, 학생 `on-client/docs/STUDENT_RUNBOOK.md`의 명령과 대조하였습니다.

| 순서 | 명령 / 확인 | 2026-10-27 관찰 결과 | 검증 구분 |
|---|---|---|---|
| 1 | `git clone` 및 지정 SHA checkout | clone 성공·SHA 일치·복제본 Git 변경 없음 | 학생이 제공한 PowerShell 실제 로그 |
| 2 | 재현용 `on-client`에서 `npm run check` | `node --check student/extension.mjs` 오류 없음 | 실제 로컬 문법 검사 |
| 3 | `Test-Path .\tools\start-alekov.ps1` | `True` | 실제 파일 존재 확인 |
| 4 | `Test-Path .\docs\STUDENT_RUNBOOK.md` | `True` | 실제 파일 존재 확인 |
| 5 | `powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\start-alekov.ps1 -Port 5190 -NoNativeHost` | `케셰브 연결 확인: http://127.0.0.1:5190`, `케셰브가 켜졌습니다` | 실제 실행 로그 |
| 6 | Chrome에서 `http://127.0.0.1:5190/` | 주소창 5190, 보호 현황·`renderIdentity`·`renderStatus` 영역 표시 | 실제 브라우저 스크린샷 |
| 7 | 실행한 PowerShell 창에서 `Ctrl+C` | `PS ...\케셰브-최종재현\on-client>` 프롬프트로 복귀 | 실제 종료 로그 |
| 8 | 같은 시작 명령 재실행 | 5190 응답 및 케셰브 시작 메시지 재확인 | 실제 재실행 로그 |
| 9 | 외부 npm 의존성 설치 | 실행하지 않음; 제공 README는 외부 npm 의존성 없음을 명시 | 원문 확인·미실행 구분 |

**재현 범위:** 동일한 코드 커밋을 별도 경로에서 실행해 로컬 HTTP 서버, 브라우저 UI, 종료 및 재실행을 확인하였습니다. 기존 SDP/에이전트·AI 모델·운영 조치 엔진과의 연결까지 재현한 것은 아닙니다. `-NoNativeHost`는 로컬 확인 전용이며 사용자 인증 성공 증거가 아닙니다.

### 다른 환경에서 기본 실행 시도

```powershell
# 복제한 프로젝트의 on-client에서 실행
cd .\on-client
node --version
npm --version
npm run check
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\start-alekov.ps1
# 화면에서 안내한 http://127.0.0.1:5189/ 접속
# 서버 실행 창에서 Ctrl+C로 종료
```

실제 재현에서는 원본 프로젝트의 다른 실행과 포트가 충돌하지 않도록 `-Port 5190 -NoNativeHost`를 사용했습니다. **다른 PC에 `NativeHostConfig` 파일이 존재한다고 가정하지 마세요.** 실행 스크립트의 공식 자동 준비 및 제공 문서의 연결 안내를 사용하고 실패를 그대로 기록합니다. `package-lock.json`은 공개 저장소 원문에서 확인되지 않았습니다. 의존성 설치 성공이나 lock 버전 대조를 수행했다고 기록하지 않습니다.

## 4. 13~21단계 구현 및 검증 수준

아래의 결과는 **해당 시점의 학생 관찰·공식 판정 보고·모의 입력·원문 확인**을 구분합니다. 모든 기능을 22단계 재현 복제본에서 각각 다시 실행한 것은 아닙니다.

| 단계 | 학생 기능/산출물 | 확인한 근거 및 결과 | 현 재현 범위·미확인 사항 |
|---|---|---|---|
| 13 | `renderIdentity`: 사용자·기기·세션 표시 | 이전 단계 5/5 공식 판정 통과 보고, UI 오류/연결 없음 표현 확인; 22단계 복제본 브라우저에서 렌더 영역 표시 | 새 환경의 실제 SDP 로그인 미확인 |
| 14 | `renderDecision`: 업무 앱 접근 판정 | 이전 단계 5/5 통과 보고; 소스 유지 | 새 복제본에서 실접근 판정 미확인 |
| 15 | `renderEvents`: XDR·접속 기록 | 이전 단계 7/7 통과 보고; 소스 유지 | 실제 SDP 사건 목록·근거 조회 미확인 |
| 16 | `renderStatus`: 기기·세션·알림·진단 | 이전 단계 7/7 통과 보고; 22단계 복제본에서 연결 없음 화면 렌더 확인 | 실제 연동 결과 미확인 |
| 17 | `renderAiConnection`: AI 권한·모델 점검 | 계정 연결·포털 승인 화면 관찰, `ON_AI_PROVISIONING_PENDING`, `ALEKOV_CONNECT_OUTCOME_UNKNOWN` 오류 표시 확인 | 실제 모델 호출 성공·단계 공식 판정은 이 재현 기록으로 입증되지 않음 |
| 18 | `renderExplanation`: 근거·규칙·상태 연결 | 소스 구현 및 문법 검사, Git 커밋 기록 | 실제 AI 사건 설명·근거 검증 성공 미확인 |
| 19 | `renderAction`: 서버 접수/효과 분리 | 모의 DOM으로 prepared/executing/pending/succeeded/unknown, 새 사건 전환 검증 | 실서버 집행·효과 관측 미연결·미검증 |
| 20 | `renderVulnerabilities`: 설치 버전·OSV 상태 | 모의 DOM으로 complete/partial/not_checked/not_configured/unverifiable, 취약점 ID와 재조회 시 결과 교체 확인 | 실제 허용 패키지 OSV 조회·lock 검증·요청 취소 흐름 미확인 |
| 21 | `docs/STUDENT_RUNBOOK.md`: 실행·구성도·장애 설명 | 원본 로컬 서버 실행, 5189 화면, Ctrl+C 종료, 재실행을 학생이 확인함; 해당 문서가 복제본에도 포함됨 | 공식 원문 검토 판정은 이 문서만으로 증명되지 않음 |

위 표의 '이전 단계 통과 보고'는 각 단계 당시의 보고이지 **22단계 제출 SHA 전체를 대상으로 한 일괄 실행 시험의 결과가 아닙니다.** 21·22단계 공식 수료는 각 제출의 서버 AI 원문 검토 결과가 있어야만 확정됩니다.

## 5. 구성 및 이동 가능한 파일

| 제공 원문 | 용도 | 이동/보안 주의 |
|---|---|---|
| `on-client/package.json` | 실행 스크립트, 시작 틀 버전, Node 기준 | 새 환경에서 확인 |
| `on-client/student/extension.mjs` | 13~20단계 학생 화면 | 코드 그대로 복제 |
| `on-client/src/server.mjs` / `on-client/public/app.js` | 제공 서버와 브라우저 로직 | 수정 없이 사용 |
| `on-client/tools/start-alekov.ps1` / `prepare-native-host.ps1` | 실행·계정 연결 설정 준비 | 스크립트 계약 준수 |
| `on-client/.env.example` | 비밀 없는 설정 설명 | 실제 키·토큰은 커밋 금지 |
| `on-client/docs/STUDENT_RUNBOOK.md` | 실행·시스템 구성·오류 안내 | 새 환경 경로로 변경하여 사용 |
| `on-client/docs/STUDENT_LAUNCH_GUIDE.md` / `CONNECTION_TROUBLESHOOT.md` | 제공 실행 및 복구 기준 | 실제 화면·버전과 비교 |

### 텍스트 구성도

```text
Chrome (http://127.0.0.1:5190/; 재현 포트)
  -> 케셰브 로컬 HTTP 서버 (on-client/src/server.mjs)
      -> 제공 웹 UI (on-client/public/app.js)
          -> 학생 표시 로직 (on-client/student/extension.mjs)
      --(별도 승인 및 연결 어댑터 필요)--> SDP 접근 제어 / XDR 원천
      --(별도 계정·프로젝트·권한 필요)--> AI 게이트웨이 / CLCO
      --(승인된 공개 패키지와 환경 설정 필요)--> OSV 공개 취약점 조회
Git 커밋 SHA -> ALEPH 공식 과제 포털 (원문 읽기·검토; 실행 검증 아님)
```

점선으로 표시한 외부 시스템은 새 복제본에서 연결을 확인하지 않았습니다.

## 6. 데이터 보존·백업·복원 계획과 한계

1. **원본 보존:** 학생 원본 프로젝트 폴더를 삭제·초기화하지 않습니다. 코드와 공개 가능한 문서는 Git 커밋을 만들어 `origin/main`에 업로드한 뒤 로컬/원격 SHA 일치를 확인합니다. 복제 폴더는 재현 검증용으로 분리합니다.
2. **학생 파일 백업:** `on-client/student/extension.mjs`와 `on-client/docs/`의 학생 문서는 Git에서 관리합니다. 변경 전 `git status --short`와 `git diff`로 미커밋 파일을 확인하며 `git reset --hard`, 강제 푸시는 사용하지 않습니다.
3. **복원 시험(코드):** 별도 새 폴더에서 Git clone 후 지정 SHA checkout하여 `npm run check`와 로컬 서버 실행을 확인했습니다. 이는 **코드·문서 복원 검증**이지 로그인 세션·보안 이벤트 DB의 복구 검증은 아닙니다.
4. **인증·개인 설정:** Native Host/SDP 개인 설정·자격 보관소·키·토큰·비밀번호 등은 저장소와 제출 문서에 넣지 않습니다. 다른 PC로 무단 복사하지 않으며 운영자 승인과 제공 준비 도구를 통해 그 PC의 독립 설정을 준비합니다. 인증 데이터의 별도 백업·복원은 운영 정책·지원 경로를 확인하기 전까지 수행하지 않습니다.
5. **보안 사건·서버 데이터:** 케셰브 학생 UI는 제공 서버·기존 시스템에서 받은 정보를 표시합니다. 실제 SDP/XDR 서버 저장소의 보존 기간, 백업 위치, 복원 권한과 복구 목표(RPO/RTO)는 **미확인**입니다. 학생이 서버 DB 데이터를 가져오거나 복원 성공으로 보고하지 않습니다. 운영 담당자와 보존·복구 계약을 확인해야 합니다.
6. **실행 중 생성되는 파일:** Git의 추적/무시 정책을 존중합니다. `native.json`, `.env` 및 기타 민감한 런타임 자료를 Git에 강제 추가하거나 제출에 묶지 않습니다. 재현 화면·도움정보를 공유하기 전에도 비밀값 포함 여부를 확인합니다.
7. **복구 실패 시:** 파일을 덮어쓰기 전에 오류 메시지와 해당 커밋 SHA, 사용 환경을 남기고 제공 `CONNECTION_TROUBLESHOOT.md`를 확인합니다. 서비스 데이터 복구는 권한 있는 담당자의 절차를 따라야 합니다.

## 7. 장애 대응과 미해결 항목

| 증상/상태 | 해석 | 학생이 할 일 | 현재 검증 |
|---|---|---|---|
| 시작 로그는 성공, UI에 `연결 없음` | 로컬 HTTP 서버와 외부 접근 제어 엔진 연결은 별개 | `-NoNativeHost` 로컬 확인인지 구분하고 제공 연결 안내 확인 | 5190 복제본에서 화면 확인 |
| `ON_AI_PROVISIONING_PENDING` | 학생 앱 AI 권한 발급·연결 준비 중 | 운영자에게 현재 권한 확인; 키를 직접 추가하지 않음 | 원본 프로젝트에서 오류 화면 관찰 |
| `ALEKOV_CONNECT_OUTCOME_UNKNOWN` | 승인 결과 확인 불가 | 연결 도움정보의 비밀 없는 오류 코드 확인 후 담당자 문의 | 원본에서 관찰 |
| `not_configured` / `not_checked` | OSV 조회 미설정/미실시 | 운영자의 공개 조회 대상 준비를 기다림 | 상태 화면 모의 데이터로 확인 |
| `partial` / `unverifiable` | 일부 조회 실패/검증 불가 | 받은 취약점 ID 유지, 안전으로 단정하지 않음 | 모의 데이터 확인 |
| `pending` / `unknown` (조치) | ACK·결과 불명, 실제 효과 미확인 | 무작정 재집행하지 않고 연동 시스템의 결과 확인 | 모의 데이터 확인, 실제 집행 미실시 |
| `5189` 포트 사용 중 | 원본 앱과 충돌 가능 | 기존 서버를 강제 종료하지 않고 `-Port 5190` 사용 | 복제본 5190 실행 확인 |

미완료·미확인 항목: 실제 SDP 신원·접근 제어·XDR 엔진, AI 모델 호출 및 사건 설명, 실제 보안 집행과 효과 관측, 운영자 승인 OSV 조회/설치 버전 대조, 다른 물리 PC·수업 기준 Node.js `v24.19.0`에서의 재현, 실제 서버 데이터의 백업·복원, 최종 SHA에 대한 공식 AI 판정.

## 8. 제출 전 최종 확인

- [x] 원본과 GitHub의 `main` SHA가 재현 당시 일치함을 확인
- [x] 별도 복제본에서 지정 커밋을 받아 문법 검사·서버 시작·UI 접속·종료·재실행 수행
- [x] 원본 인증 자격을 재현 폴더로 복사하지 않음
- [ ] **새로 추가한 이 보고서를 포함하는 제출 커밋 생성 및 40자리 SHA 기록**
- [ ] 새 제출 커밋의 파일(학생 코드·README·설명서·보고서) 일관성 대조
- [ ] 필요시 **제출 커밋 자체**를 별도 폴더에서 받아 재현하고 기록 갱신
- [ ] 22단계 ALEPH 공식 AI 원문 검토 결과 확인

**최종 판정:** 현재 시점은 로컬 앱의 독립 실행 재현에 성공한 **검증 중 버전**입니다. 공식 원문 심사와 실제 운영 시스템 검증을 혼동하지 않습니다.
