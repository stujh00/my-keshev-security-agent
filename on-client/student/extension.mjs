// 이 파일은 학생이 같은 프로젝트에서 이어서 구현합니다.
// 제공 UI를 받은 것만으로 단계 완료를 인정하지 않습니다.
export function createStudentView() {
  return {
    renderIdentity({ me, devices, sessions } = {}) {
      const root = document.createElement('section');

      const add = (text) => {
        const p = document.createElement('p');
        p.textContent = text;
        root.appendChild(p);
      };

      const deviceStatus = {
        compliant: '보안 기준 충족',
        noncompliant: '보안 기준 미충족',
        unknown: '확인 불가'
      };

      const sessionStatus = {
        active: '활성',
        expired: '만료',
        revoked: '철회됨',
        unknown: '확인 불가'
      };

      const modeLabel = {
        demo: '예제 자료',
        disconnected: '연결 없음',
        unknown: '확인 불가'
      };

      const sections = [
        ['사용자 및 현재 기기·세션', me],
        ['등록 기기 목록', devices],
        ['세션 목록', sessions]
      ];

      for (const [name, state] of sections) {
        const heading = document.createElement('h3');
        heading.textContent = name;
        root.appendChild(heading);

        if (modeLabel[state?.mode]) {
          add(modeLabel[state.mode]);
        }

        if (state?.status === 'loading') {
          add('불러오는 중');
          continue;
        }

        if (state?.status === 'error') {
          add('연결 실패: ' + (state.error?.message ?? '확인 불가'));
          continue;
        }

        if (state?.status !== 'ok') {
          add('확인 불가');
          continue;
        }

        if (name === '사용자 및 현재 기기·세션') {
          const data = state.data;
          add('사용자: ' + (data?.user?.label ?? '확인 불가'));
          add('사용자 ID: ' + (data?.user?.id ?? '확인 불가'));
          add('현재 기기: ' + (data?.device?.label ?? '확인 불가'));
          add('기기 ID: ' + (data?.device?.id ?? '확인 불가'));
          add('기기 상태: ' + (deviceStatus[data?.device?.status] ?? '확인 불가') + ' (' + (data?.device?.status ?? 'unknown') + ')');
          add('세션 ID: ' + (data?.session?.id ?? '확인 불가'));
          add('세션 상태: ' + (sessionStatus[data?.session?.status] ?? '확인 불가') + ' (' + (data?.session?.status ?? 'unknown') + ')');
        } else if (name === '등록 기기 목록') {
          if (!Array.isArray(state.data) || state.data.length === 0) {
            add('등록 기기 없음');
          } else {
            for (const device of state.data) {
              add((device.label ?? '이름 없음') + ' (' +
                (device.id ?? 'ID 없음') + '): ' +
                (deviceStatus[device.status] ?? '확인 불가') + ' (' + (device.status ?? 'unknown') + ')');
            }
          }
        } else {
          if (!Array.isArray(state.data) || state.data.length === 0) {
            add('세션 없음');
          } else {
            for (const session of state.data) {
              add((session.id ?? 'ID 없음') + ': ' +
                (sessionStatus[session.status] ?? '확인 불가') + ' (' + (session.status ?? 'unknown') + ')');
            }
          }
        }
      }

      return root;
    },
    renderDecision() { return '학생 구현 대기: 서버의 판정과 이유를 연결하세요.'; },
    renderEvents() { return '학생 구현 대기: 본인 접속·XDR 기록을 연결하세요.'; },
    renderStatus() { return '학생 구현 대기: 기기·세션·알림과 연결 점검 상태를 구분하세요.'; },
    renderVulnerabilities() { return '학생 구현 대기: 정확한 설치 버전·OSV 출처·조회 시각·부분 결과·조회 실패를 구분하세요.'; },
    renderAiConnection() { return '학생 구현 대기: 모델 응답 점검과 실제 사건 설명을 구분하고 AI 오류·취소·수동 복구를 안내하세요.'; },
    renderExplanation() { return '학생 구현 대기: 선택한 사건의 근거·규칙·현재 상태와 AI 설명을 연결하세요. 제안은 자동 실행하지 않습니다.'; },
    renderAction() { return '학생 구현 대기: 현재 사건·조치·실제 대상·사람 확인·ACK와 원천 효과·unknown을 구분하세요.'; },
  };
}
