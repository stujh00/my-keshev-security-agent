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
    renderDecision({ status, mode, data, error, appId } = {}) {
      const root = document.createElement('section');

      const add = (label, value) => {
        const p = document.createElement('p');
        p.textContent = label + value;
        root.appendChild(p);
      };

      const modeLabels = {
        demo: '예제 자료',
        disconnected: '연결 없음',
        unknown: '확인 불가'
      };

      const decisions = {
        allow: '접근 허용',
        deny: '접근 거부',
        challenge: '추가 인증 또는 확인 필요',
        unknown: '판정 확인 불가'
      };

      const title = document.createElement('h3');
      title.textContent = '업무 앱 접근 판정';
      root.appendChild(title);

      if (modeLabels[mode]) {
        add('연결 모드: ', modeLabels[mode]);
      }

      if (status === 'idle') {
        add('안내: ', '앱을 골라 접속을 요청하세요.');
        return root;
      }

      if (status === 'loading') {
        add('진행 상태: ', '판정 확인 중');
        return root;
      }

      if (status === 'error') {
        add('요청 실패: ', error?.message ?? '확인 불가');
        add('안내: ', '요청 실패는 접근 거부 판정이 아닙니다.');
        return root;
      }

      if (status !== 'ok' || !data) {
        add('판정: ', '판정 확인 불가 (unknown)');
        add('안내: ', '접근 허용 여부를 확인할 수 없습니다.');
        return root;
      }

      const rawDecision = data.decision;
      const known = Object.hasOwn(decisions, rawDecision);
      const code = known ? rawDecision : 'unknown';

      add('앱 ID: ', data.appId ?? appId ?? '확인 불가');
      add('판정: ', decisions[code] + ' (' + code + ')');
      add('판정 이유: ', data.reason ?? '확인 불가');
      add('판정 시각: ', data.checkedAt ?? '확인 불가');

      if (code === 'challenge') {
        add('안내: ', '추가 인증 또는 확인이 필요합니다. 이 앱은 인증 절차를 대신 수행하지 않습니다.');
      }

      if (code === 'unknown') {
        add('안내: ', '접근 허용 여부를 확인할 수 없습니다.');
      }

      if (code === 'allow') {
        add('안내: ', '정책상 접근 허용이며 실제 업무 앱 접속 성공을 보장하지 않습니다.');
      }

      return root;
    },
    renderEvents() { return '학생 구현 대기: 본인 접속·XDR 기록을 연결하세요.'; },
    renderStatus() { return '학생 구현 대기: 기기·세션·알림과 연결 점검 상태를 구분하세요.'; },
    renderVulnerabilities() { return '학생 구현 대기: 정확한 설치 버전·OSV 출처·조회 시각·부분 결과·조회 실패를 구분하세요.'; },
    renderAiConnection() { return '학생 구현 대기: 모델 응답 점검과 실제 사건 설명을 구분하고 AI 오류·취소·수동 복구를 안내하세요.'; },
    renderExplanation() { return '학생 구현 대기: 선택한 사건의 근거·규칙·현재 상태와 AI 설명을 연결하세요. 제안은 자동 실행하지 않습니다.'; },
    renderAction() { return '학생 구현 대기: 현재 사건·조치·실제 대상·사람 확인·ACK와 원천 효과·unknown을 구분하세요.'; },
  };
}
