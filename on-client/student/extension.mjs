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
    renderEvents({ status, mode, data, error } = {}) {
      const root = document.createElement('section');
      const el = (tag, text, parent = root) => {
        const node = document.createElement(tag);
        node.textContent = String(text ?? '');
        parent.appendChild(node);
        return node;
      };

      const modes = {
        demo: '예제 자료',
        disconnected: '연결 없음',
        unknown: '확인 불가'
      };
      const kinds = { access: '접속 기록', xdr: 'XDR 경보' };
      const accessLabels = {
        allowed: '접근 허용',
        denied: '접근 거부',
        unknown: '확인 불가'
      };
      const sessionLabels = {
        active: '활성',
        expired: '만료',
        revoked: '철회됨',
        unknown: '확인 불가'
      };
      const deviceLabels = {
        compliant: '보안 기준 충족',
        noncompliant: '보안 기준 미충족',
        unknown: '확인 불가'
      };
      const described = (map, value) => {
        const code = Object.hasOwn(map, value) ? value : 'unknown';
        return map[code] + '(' + code + ')';
      };

      el('h3', '내 접속·XDR 기록');
      el('p', '조회 범위: 본인의 최근 최대 40건입니다. 전체 직원 기록이나 실시간 신규 탐지 결과가 아닙니다.');

      if (modes[mode]) el('p', '연결 모드: ' + modes[mode]);

      if (status === 'loading') {
        el('p', '기록을 불러오는 중');
        return root;
      }

      if (status === 'error') {
        if (error?.code === 'CONTRACT_MISMATCH') {
          el('p', '확인 불가: 기록 데이터 계약이 일치하지 않습니다.');
        }
        el('p', '기록을 불러오지 못했습니다: ' +
          (error?.message ?? '확인 불가'));
        return root;
      }

      if (status !== 'ok' || !Array.isArray(data)) {
        el('p', '기록을 확인할 수 없습니다.');
        return root;
      }

      const records = [...data].sort(
        (a, b) => Date.parse(b.at) - Date.parse(a.at)
      );

      if (records.length === 0) {
        el('p', '표시할 기록이 없습니다');
        return root;
      }

      const controls = el('div', '');
      const filters = {};

      const makeFilter = (labelText, key, values) => {
        const label = el('label', labelText, controls);
        const select = document.createElement('select');
        label.appendChild(select);

        const option = (value, text) => {
          const node = document.createElement('option');
          node.value = value;
          node.textContent = text;
          select.appendChild(node);
        };

        option('all', '전체');
        for (const value of values) {
          option(value, value === '' ? '앱 ID 없음' : value);
        }

        filters[key] = select;
      };

      const unique = (values) => [...new Set(values)];
      makeFilter('기록 종류', 'kind',
        unique(records.map(event => event.kind)));
      makeFilter('업무 앱', 'app',
        unique(records.map(event => event.appId ?? '')));
      makeFilter('접속 상태', 'access',
        unique(records.map(event => event.state?.access ?? 'unknown')));

      const count = el('p', '');
      const list = el('div', '');
      const detail = el('div', '');
      let selectedId = null;

      const clear = (node) => {
        node.replaceChildren();
      };

      const showDetail = (event) => {
        clear(detail);
        detail.setAttribute('data-student-event-detail', event.id);

        el('h4', '사건 상세', detail);
        el('p', '사건 ID: ' + event.id, detail);
        el('p', '앱 ID: ' + (event.appId ?? '확인 불가'), detail);
        el('p', '시각: ' + event.at, detail);

        const showItems = (title, items) => {
          el('h5', title, detail);
          if (!Array.isArray(items) || items.length === 0) {
            el('p', title + ' 없음', detail);
            return;
          }
          for (const item of items) {
            el('p', item.id + ': ' + item.text, detail);
          }
        };

        showItems('근거(evidence)', event.evidence);
        showItems('규칙(rules)', event.rules);

        el('h5', '사건 당시 상태', detail);
        el('p', '접속 상태(access): ' +
          described(accessLabels, event.state?.access), detail);
        el('p', '세션 상태(session): ' +
          described(sessionLabels, event.state?.session), detail);
        el('p', '기기 상태(device): ' +
          described(deviceLabels, event.state?.device), detail);

        if (Array.isArray(event.supportedActions) &&
            event.supportedActions.length > 0) {
          el('h5', '미지원 조치 안내', detail);
          el('p', '조치 실행 연결은 준비 중입니다.', detail);

          for (const action of event.supportedActions) {
            const button = el('button', action + ' 미지원', detail);
            button.type = 'button';
            button.disabled = true;
          }
        }
      };

      const draw = () => {
        clear(list);
        clear(detail);
        detail.removeAttribute('data-student-event-detail');

        const visible = records.filter(event =>
          (filters.kind.value === 'all' ||
            event.kind === filters.kind.value) &&
          (filters.app.value === 'all' ||
            (event.appId ?? '') === filters.app.value) &&
          (filters.access.value === 'all' ||
            (event.state?.access ?? 'unknown') === filters.access.value)
        );

        count.textContent = '표시 기록: ' +
          visible.length + ' / ' + records.length + '건';

        if (visible.length === 0) {
          el('p', '필터 조건에 맞는 기록이 없습니다.', list);
          return;
        }

        for (const event of visible) {
          const row = el('div', '', list);
          row.setAttribute('data-student-event-id', event.id);

          el('p', '사건 ID: ' + event.id, row);
          el('p', '시각: ' + event.at, row);
          el('p', '종류: ' +
            (kinds[event.kind] ?? '확인 불가') +
            ' (' + event.kind + ')', row);
          el('p', '앱: ' + (event.appId ?? '앱 ID 확인 불가'), row);
          el('p', '요약: ' + event.summary, row);

          const button = el('button', event.id + ' 상세', row);
          button.type = 'button';
          button.addEventListener('click', () => {
            selectedId = event.id;
            showDetail(event);
          });
        }
      };

      for (const select of Object.values(filters)) {
        select.addEventListener('change', () => {
          selectedId = null;
          draw();
        });
      }

      draw();
      return root;
    },
    renderStatus({ devices, sessions, notifications, diagnostics, mode } = {}) {
      const root = document.createElement('section');

      const add = (tag, value, parent = root) => {
        const node = document.createElement(tag);
        node.textContent = String(value ?? '');
        parent.appendChild(node);
        return node;
      };

      const deviceLabels = {
        compliant: '보안 기준 충족',
        noncompliant: '보안 기준 미충족',
        unknown: '확인 불가'
      };
      const sessionLabels = {
        active: '활성',
        expired: '만료',
        revoked: '철회됨',
        unknown: '확인 불가'
      };
      const modeLabels = {
        demo: '예제 자료',
        disconnected: '연결 없음',
        unknown: '확인 불가'
      };

      const describe = (labels, code) => {
        const known = Object.hasOwn(labels, code) ? code : 'unknown';
        return labels[known] + ' (' + known + ')';
      };

      const retryMessage =
        '다시 시도는 위쪽 다시 불러오기 버튼을 직접 누르세요. 자동 재시도는 하지 않습니다.';

      const showResource = (title, resource, type) => {
        const section = add('section', '');
        add('h3', title, section);

        if (modeLabels[resource?.mode]) {
          add('p', '연결 모드: ' + modeLabels[resource.mode], section);
        }

        if (resource?.status === 'loading') {
          add('p', title + ': 불러오는 중', section);
          return;
        }

        if (resource?.status === 'error') {
          const message = resource.error?.message ?? '확인 불가';
          const code = resource.error?.code ?? 'unknown';

          add('p', title + ' 불러오기 실패: ' + message, section);
          add('p', '오류 코드: ' + code, section);

          if (code === 'REQUEST_TIMEOUT' ||
              code === 'TIMEOUT' ||
              /시간\s*초과|timed?\s*out|timeout/i.test(message)) {
            add('p', '요청 시간 초과', section);
          }

          add('p', retryMessage, section);
          return;
        }

        if (resource?.status !== 'ok' || !Array.isArray(resource.data)) {
          add('p', title + ': 확인 불가', section);
          return;
        }

        if (resource.data.length === 0) {
          add('p',
            type === 'device'
              ? '등록된 기기가 없습니다.'
              : '현재 연결이 없습니다.',
            section
          );
          return;
        }

        add('p', '조회 항목: ' + resource.data.length + '건', section);

        for (const item of resource.data) {
          if (type === 'device') {
            add('p',
              '기기: ' + (item.label ?? '확인 불가') +
              ' / ID: ' + (item.id ?? '확인 불가') +
              ' / 상태: ' + describe(deviceLabels, item.status),
              section
            );
          } else {
            add('p',
              '세션 ID: ' + (item.id ?? '확인 불가') +
              ' / 상태: ' + describe(sessionLabels, item.status),
              section
            );
          }
        }
      };

      add('h2', '기기·세션·알림 및 연결 점검');

      if (modeLabels[mode]) {
        add('p', '현재 모드: ' + modeLabels[mode]);
      }

      showResource('등록 기기', devices, 'device');

      add('p',
        '기기 조회는 등록되고 회수되지 않은 본인 기기 최대 100개를 대상으로 합니다.');

      showResource('현재 세션', sessions, 'session');

      add('p',
        '세션은 지금 검증된 연결 한 개를 대상으로 합니다. 과거 세션 전체 목록이 아닙니다.');

      add('h3', '알림');

      if (!Array.isArray(notifications)) {
        add('p', '알림 상태를 확인할 수 없습니다.');
      } else if (notifications.length === 0) {
        add('p', '주의할 알림이 없습니다.');
      } else {
        for (const notice of notifications) {
          add('p',
            '자료: ' + (notice.resource ?? '확인 불가') +
            ' / 코드: ' + (notice.code ?? 'unknown') +
            ' / 내용: ' + (notice.message ?? '확인 불가')
          );
        }
      }

      add('h3', '연결 진단');

      const fields = [
        ['requestId', diagnostics?.data?.requestId],
        ['component', diagnostics?.data?.component],
        ['version', diagnostics?.data?.version],
        ['checkedAt', diagnostics?.data?.checkedAt],
        ['engine.mode', diagnostics?.data?.engine?.mode],
        ['engine.code', diagnostics?.data?.engine?.code]
      ];

      const safeFields = fields.map(([name, value]) => [
        name,
        typeof value === 'string' || typeof value === 'number'
          ? String(value)
          : '확인 불가'
      ]);

      if (diagnostics?.status === 'loading') {
        add('p', '진단 정보를 불러오는 중');
      } else if (diagnostics?.status === 'error') {
        add('p',
          '진단 정보를 불러오지 못했습니다: ' +
          (diagnostics.error?.message ?? '확인 불가')
        );
        add('p', retryMessage);
      } else if (diagnostics?.status === 'ok' && diagnostics.data) {
        for (const [name, value] of safeFields) {
          add('p', name + ': ' + value);
        }
      } else {
        add('p', '진단 정보 확인 불가');
      }

      add('p',
        '도움정보 복사는 사용자 요청 시 진단 항목 여섯 개만 복사합니다. 인증 정보와 API 키는 포함하지 않습니다.');

      const copyButton = add('button', '도움정보 복사');
      copyButton.type = 'button';

      const result = add('p', '');

      copyButton.addEventListener('click', async () => {
        if (diagnostics?.status !== 'ok' || !diagnostics.data) {
          result.textContent = '복사할 진단 정보가 없습니다.';
          return;
        }

        const safe = Object.fromEntries(safeFields);
        const text = JSON.stringify(safe, null, 2);

        try {
          await navigator.clipboard.writeText(text);
          result.textContent = '도움정보를 복사했습니다.';
        } catch {
          result.textContent =
            '복사하지 못했습니다. 브라우저의 클립보드 권한을 확인하세요.';
        }
      });

      return root;
    },
    renderVulnerabilities() { return '학생 구현 대기: 정확한 설치 버전·OSV 출처·조회 시각·부분 결과·조회 실패를 구분하세요.'; },
    renderAiConnection() { return '학생 구현 대기: 모델 응답 점검과 실제 사건 설명을 구분하고 AI 오류·취소·수동 복구를 안내하세요.'; },
    renderExplanation() { return '학생 구현 대기: 선택한 사건의 근거·규칙·현재 상태와 AI 설명을 연결하세요. 제안은 자동 실행하지 않습니다.'; },
    renderAction() { return '학생 구현 대기: 현재 사건·조치·실제 대상·사람 확인·ACK와 원천 효과·unknown을 구분하세요.'; },
  };
}
