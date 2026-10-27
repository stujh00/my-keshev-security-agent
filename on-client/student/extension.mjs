// 이 파일은 학생이 같은 프로젝트에서 이어서 구현합니다.
// 제공 UI를 받은 것만으로 단계 완료를 인정하지 않습니다.
export function createStudentView() {
  return {
    renderIdentity({ me, devices, sessions } = {}) {
      const root = document.createElement('section');
      root.setAttribute('aria-label', '사용자와 기기 및 세션 보안 상태');

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
        demo: '예제 자료 · 실제 조회 아님',
        disconnected: '연결 없음',
        unknown: '연결 상태 확인 불가'
      };
      const safe = value => value === null || value === undefined || value === '' ? '확인 불가' : String(value);
      const appendText = (parent, tag, text) => {
        const el = document.createElement(tag);
        el.textContent = String(text);
        parent.appendChild(el);
        return el;
      };
      const card = (parent, label, value, note) => {
        const item = document.createElement('article');
        item.style.cssText = 'border:1px solid #a0aab580;border-radius:12px;padding:14px;min-width:0;background:rgba(125,145,165,.08)';
        const name = appendText(item, 'div', label);
        name.style.cssText = 'font-size:.85em;opacity:.8;margin-bottom:6px';
        const main = appendText(item, 'strong', value);
        main.style.cssText = 'display:block;font-size:1.12em;overflow-wrap:anywhere';
        if (note) {
          const detail = appendText(item, 'div', note);
          detail.style.cssText = 'font-size:.8em;opacity:.8;margin-top:6px;overflow-wrap:anywhere';
        }
        parent.appendChild(item);
      };
      const grid = document.createElement('div');
      grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr));gap:10px;margin:12px 0 18px';
      appendText(root, 'h3', '보안 상태 요약');
      appendText(root, 'p', '실제 API 응답, 예제 자료, 연결 실패 및 확인 불가를 구분해 표시합니다.');
      root.appendChild(grid);

      const meOk = me?.status === 'ok';
      const devicesOk = devices?.status === 'ok' && Array.isArray(devices.data);
      const sessionsOk = sessions?.status === 'ok' && Array.isArray(sessions.data);
      const currentDevice = meOk ? me.data?.device : undefined;
      const currentSession = meOk ? me.data?.session : undefined;
      const modeNote = state => modeLabel[state?.mode] ?? '';
      const stateNote = state => state?.status === 'loading' ? '불러오는 중'
        : state?.status === 'error' ? '연결 실패'
        : state?.status !== 'ok' ? '확인 불가' : '';
      const valueOrStatus = (state, value) => state?.status === 'ok' ? safe(value) : stateNote(state);
      const combinedNote = (state, more) => [modeNote(state), more].filter(Boolean).join(' · ');

      card(grid, '사용자', valueOrStatus(me, me?.data?.user?.label), combinedNote(me, meOk ? '사용자 ID: ' + safe(me.data?.user?.id) : ''));
      card(grid, '현재 기기', valueOrStatus(me, currentDevice ? (deviceStatus[currentDevice.status] ?? '확인 불가') : undefined),
        combinedNote(me, meOk ? '기기: ' + safe(currentDevice?.label) : ''));
      card(grid, '현재 세션', valueOrStatus(me, currentSession ? (sessionStatus[currentSession.status] ?? '확인 불가') : undefined),
        combinedNote(me, meOk ? '세션 ID: ' + safe(currentSession?.id) : ''));
      card(grid, '등록 기기', devicesOk ? devices.data.length + '대' : stateNote(devices) || '확인 불가',
        combinedNote(devices, devicesOk && devices.data.length === 0 ? '조회 결과: 등록 기기 없음' : ''));

      // 오류 원문은 별도 영역에서 한 번만 보여주며 카드에 중복 출력하지 않습니다.
      const failures = [
        ['사용자 및 현재 기기·세션', me],
        ['등록 기기 목록', devices],
        ['세션 목록', sessions]
      ].filter(([, state]) => state?.status === 'error');
      if (failures.length) {
        const details = document.createElement('details');
        details.style.cssText = 'margin:10px 0 18px;overflow-wrap:anywhere';
        appendText(details, 'summary', '조회 오류 상세 (' + failures.length + '개 영역)');
        const unique = new Map();
        for (const [name, state] of failures) {
          const message = safe(state.error?.message);
          const names = unique.get(message) ?? [];
          names.push(name);
          unique.set(message, names);
        }
        for (const [message, names] of unique) {
          appendText(details, 'p', names.join(' · ') + ': ' + message);
        }
        root.appendChild(details);
      }
      const sections = [
        ['사용자 및 현재 기기·세션', me],
        ['등록 기기 목록', devices],
        ['세션 목록', sessions]
      ];
      for (const [name, state] of sections) {
        appendText(root, 'h3', name);
        if (modeNote(state)) appendText(root, 'p', modeNote(state));
        if (state?.status === 'loading') { appendText(root, 'p', '불러오는 중'); continue; }
        if (state?.status === 'error') { appendText(root, 'p', '연결 실패 · 위의 조회 오류 상세를 확인하세요.'); continue; }
        if (state?.status !== 'ok') { appendText(root, 'p', '확인 불가'); continue; }
        if (name === '사용자 및 현재 기기·세션') {
          const data = state.data;
          appendText(root, 'p', '사용자: ' + safe(data?.user?.label));
          appendText(root, 'p', '사용자 ID: ' + safe(data?.user?.id));
          appendText(root, 'p', '현재 기기: ' + safe(data?.device?.label));
          appendText(root, 'p', '기기 ID: ' + safe(data?.device?.id));
          appendText(root, 'p', '기기 상태: ' + (deviceStatus[data?.device?.status] ?? '확인 불가') + ' (' + safe(data?.device?.status) + ')');
          appendText(root, 'p', '세션 ID: ' + safe(data?.session?.id));
          appendText(root, 'p', '세션 상태: ' + (sessionStatus[data?.session?.status] ?? '확인 불가') + ' (' + safe(data?.session?.status) + ')');
        } else if (name === '등록 기기 목록') {
          if (!Array.isArray(state.data)) { appendText(root, 'p', '목록 형식 확인 불가'); }
          else if (state.data.length === 0) { appendText(root, 'p', '등록 기기 없음'); }
          else for (const device of state.data) {
            appendText(root, 'p', safe(device?.label) + ' (' + safe(device?.id) + '): ' +
              (deviceStatus[device?.status] ?? '확인 불가') + ' (' + safe(device?.status) + ')');
          }
        } else {
          if (!Array.isArray(state.data)) { appendText(root, 'p', '목록 형식 확인 불가'); }
          else if (state.data.length === 0) { appendText(root, 'p', '세션 없음'); }
          else for (const session of state.data) {
            appendText(root, 'p', safe(session?.id) + ': ' +
              (sessionStatus[session?.status] ?? '확인 불가') + ' (' + safe(session?.status) + ')');
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
    renderVulnerabilities({ status = 'idle', mode, data, error } = {}) {
      const root = document.createElement('section');

      const add = (parent, tag, value) => {
        const node = document.createElement(tag);
        node.textContent = String(value ?? '');
        parent.appendChild(node);
        return node;
      };

      const field = (parent, label, value) => {
        if (value !== null && value !== undefined && value !== '') {
          add(parent, 'p', label + ': ' + String(value));
        }
      };

      add(root, 'h3', '설치 패키지 및 OSV 취약점 조회');

      const modes = {
        demo: '예제 자료',
        disconnected: '연결 없음',
        unknown: '연결 상태 확인 불가'
      };

      if (modes[mode]) {
        add(root, 'p', '자료 모드: ' + modes[mode]);
      }

      // 요청별로 새 DOM을 생성합니다.
      // idle/loading/error 상태에서는 이전 조회 표를 재사용하지 않습니다.
      if (status === 'idle') {
        add(root, 'p', '설치 패키지 취약점 조회 전(idle)');
        return root;
      }

      if (status === 'loading') {
        add(root, 'p', '설치 패키지 및 OSV 취약점 조회 중(loading)');
        add(root, 'p', '현재 요청의 조회 결과는 아직 확인되지 않았습니다.');
        return root;
      }

      if (status === 'error') {
        add(root, 'p', '설치 패키지 취약점 조회 실패(error)');
        const code = error?.code;
        if (typeof code === 'string' &&
            /^[A-Z][A-Z0-9_]{0,79}$/.test(code)) {
          field(root, '오류 코드', code);
        }

        const message = error?.message;
        const safeMessage =
          typeof message === 'string' &&
          message.length <= 500 &&
          !/bearer\s+\S+|sk-[A-Za-z0-9_-]{8,}|api[_-]?key\s*[:=]/i.test(message)
            ? message : '조회 오류 세부 내용을 확인할 수 없습니다.';

        field(root, '오류 메시지', safeMessage);
        add(root, 'p', '조회 실패는 취약점이 없다는 의미가 아닙니다.');
        return root;
      }

      if (status !== 'ok' || !data) {
        add(root, 'p', '조회 상태 확인 불가');
        return root;
      }

      const overall = {
        complete: '모든 대상 조회 완료',
        partial: '일부 조회 실패',
        not_checked: '아직 조회 안 함',
        not_configured: '조회 대상 프로젝트 설정 없음',
        unverifiable: 'lock 파일 또는 설치 정보 확인 불가'
      };

      const overallStatus = data.status;
      add(root, 'p',
        '전체 조회 상태: ' +
        (overall[overallStatus] ?? '확인 불가') +
        ' (' + String(overallStatus ?? 'unknown') + ')'
      );

      field(root, 'lockfileVersion', data.lockfileVersion);
      field(root, 'lockfileHash', data.lockfileHash);
      field(root, '전체 조회 시각(checkedAt)', data.checkedAt);

      if (overallStatus === 'not_configured') {
        add(root, 'p',
          '조회 대상 프로젝트 설정이 필요합니다. 운영자가 허용 대상을 준비해야 합니다.');
      }

      if (overallStatus === 'not_checked') {
        add(root, 'p',
          '승인된 공개 조회 대상이 없거나 아직 조회가 수행되지 않았습니다.');
      }

      if (overallStatus === 'unverifiable') {
        add(root, 'p',
          '설치된 패키지 버전을 검증할 수 없습니다. 취약점 없음으로 판단하지 않습니다.');
      }

      if (overallStatus === 'partial') {
        add(root, 'p',
          '일부 패키지의 조회에 실패했습니다. 이미 확인된 취약점 정보는 유지합니다.');
      }

      const packages = Array.isArray(data.packages)
        ? data.packages : [];

      if (packages.length === 0) {
        add(root, 'p', '표시할 패키지 조회 결과가 없습니다.');
        add(root, 'p',
          '결과가 없다는 사실만으로 패키지나 앱 전체가 안전하다고 판단할 수 없습니다.');
        return root;
      }

      const packageStatuses = {
        known_vulnerabilities: '알려진 취약점 항목 있음',
        none_found: '조회 범위에서 알려진 취약점 항목 없음',
        unverifiable: '조회 확인 불가'
      };

      for (const pkg of packages) {
        const row = document.createElement('section');

        const name = typeof pkg?.name === 'string'
          ? pkg.name : '확인 불가';

        const version = typeof pkg?.version === 'string'
          ? pkg.version : '';

        // 버전 범위를 실제 설치 버전으로 오인하지 않습니다.
        const exactVersion =
          /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(version);

        row.setAttribute('data-student-package-name', name);

        if (exactVersion) {
          row.setAttribute('data-student-package-version', version);
        }

        field(row, '패키지 이름', name);
        add(row, 'p', exactVersion
          ? '설치 버전: ' + version
          : '설치 버전 확인 불가: 정확한 버전이 전달되지 않았습니다.');

        const packageStatus = pkg?.status;
        add(row, 'p',
          '패키지 조회 상태: ' +
          (packageStatuses[packageStatus] ?? '확인 불가') +
          ' (' + String(packageStatus ?? 'unknown') + ')'
        );

        field(row, '조회 출처(source)', pkg?.source);
        field(row, '조회 시각(checkedAt)', pkg?.checkedAt);

        const vulnerabilities = Array.isArray(pkg?.vulnerabilities)
          ? pkg.vulnerabilities : [];

        if (packageStatus === 'unverifiable') {
          add(row, 'p', vulnerabilities.length > 0
            ? '일부 취약점 정보 확인·전체 조회 확인 불가'
            : '조회 확인 불가. 취약점 없음으로 판단하지 않습니다.');
        }

        if (packageStatus === 'none_found') {
          add(row, 'p',
            '조회된 범위에서 알려진 취약점 항목이 없습니다. 안전성을 보증하지 않습니다.');
        }

        for (const vulnerability of vulnerabilities) {
          const item = document.createElement('div');
          field(item, '취약점 ID', vulnerability?.id);
          field(item, '취약점 수정 시각(modified)', vulnerability?.modified);
          row.appendChild(item);
        }

        root.appendChild(row);
      }

      add(root, 'p',
        'OSV 조회 결과는 알려진 취약점 정보이며, 패키지 또는 애플리케이션 전체의 안전성을 보증하지 않습니다.');

      return root;
    },
    renderAiConnection({ status, mode, data, error, checkedAt, explanationAccepted } = {}) {
      const root = document.createElement('section');
      const add = (value) => {
        const p = document.createElement('p');
        p.textContent = value;
        root.appendChild(p);
      };

      const modeLabels = {
        demo: '예제 자료',
        disconnected: '연결 없음',
        unknown: '확인 불가'
      };

      const errorGuides = {
        ON_AI_PROVISIONING_PENDING: '권한 준비 중입니다. 담당자에게 계정 연결과 앱 권한을 확인하세요.',
        WB_CLCO_AUTH_REQUIRED: '인증 실패입니다. 계정 연결을 다시 확인하고 담당자에게 문의하세요.',
        WB_CLCO_ACCESS_BLOCKED: '접근 제한 상태입니다. 이용 권한을 담당자에게 확인하세요.',
        WB_CLCO_COHORT_BUDGET_EXHAUSTED: '반 AI 사용량이 소진됐습니다. 담당자에게 문의하세요.',
        WB_CLCO_LIMIT_REACHED: 'AI 이용 한도에 도달했습니다. 담당자에게 문의하세요.',
        WB_CLCO_SESSION_CLOSED: '현재 이용 시간이 아닙니다. 이용 시간을 확인하세요.',
        WB_CLCO_RATE_LIMITED: '요청이 제한됐습니다. 잠시 뒤 직접 다시 점검하세요.',
        WB_CLCO_TIMEOUT: '응답 시간이 초과됐습니다. 잠시 뒤 직접 다시 점검하세요.',
        REQUEST_TIMEOUT: '요청 시간이 초과됐습니다. 잠시 뒤 직접 다시 점검하세요.',
        ENGINE_TIMEOUT: '서버 확인 시간이 초과됐습니다. 잠시 뒤 직접 다시 점검하세요.',
        TIMEOUT: '시간 초과입니다. 잠시 뒤 직접 다시 점검하세요.',
        CANCELLED: '요청이 취소됐습니다. 이전 점검 결과는 현재 결과가 아닙니다.',
        WB_CLCO_CANCELLED: '요청이 취소됐습니다. 이전 점검 결과는 현재 결과가 아닙니다.',
        REQUEST_CANCELLED: '요청이 취소됐습니다. 이전 점검 결과는 현재 결과가 아닙니다.',
        MODEL_NOT_CONFIGURED: '사용할 모델이 설정되지 않았습니다. 담당자에게 확인하세요.',
        ON_AI_MODEL_LIST_EMPTY: '사용 가능한 모델이 없습니다. 담당자에게 모델 허용 설정을 확인하세요.',
        ON_AI_AUTHORIZATION_CHANGED: '이용 권한이 변경됐습니다. 담당자에게 현재 권한을 확인하세요.',
        SUBJECT_SCOPE_UNVERIFIED: '계정 또는 접근 범위를 확인할 수 없습니다. 담당자에게 확인하세요.',
        AI_REQUEST_UNVERIFIED: 'AI 연결 또는 응답을 확인할 수 없습니다. 담당자에게 확인하세요.'
      };

      const safeMessages = {
        ON_AI_PROVISIONING_PENDING: '학생 앱 이용 권한 준비 중',
        WB_CLCO_AUTH_REQUIRED: 'AI 인증 확인 필요',
        WB_CLCO_ACCESS_BLOCKED: 'AI 접근 제한',
        WB_CLCO_COHORT_BUDGET_EXHAUSTED: '반 사용량 소진',
        WB_CLCO_LIMIT_REACHED: '이용 한도 도달',
        WB_CLCO_SESSION_CLOSED: '이용 시간 외',
        WB_CLCO_RATE_LIMITED: '요청 제한',
        WB_CLCO_TIMEOUT: '응답 시간 초과',
        REQUEST_TIMEOUT: '요청 시간 초과',
        ENGINE_TIMEOUT: '서버 확인 시간 초과',
        TIMEOUT: '시간 초과',
        CANCELLED: '요청 취소',
        WB_CLCO_CANCELLED: '요청 취소',
        REQUEST_CANCELLED: '요청 취소',
        MODEL_NOT_CONFIGURED: '모델 설정 필요',
        ON_AI_MODEL_LIST_EMPTY: '사용 가능한 모델 없음',
        ON_AI_AUTHORIZATION_CHANGED: '이용 권한 변경',
        SUBJECT_SCOPE_UNVERIFIED: '계정 범위 확인 불가',
        AI_REQUEST_UNVERIFIED: 'AI 연결 확인 불가'
      };

      const rawCode = error?.code;
      const code = Object.hasOwn(errorGuides, rawCode)
        ? rawCode : 'AI_REQUEST_UNVERIFIED';

      const safeMessage = (typeof error?.message === 'string' &&
        error.message.length <= 500 &&
        !/sk-[A-Za-z0-9_-]{8,}|bearer\s+\S+|api[_-]?key\s*[:=]/i.test(error.message))
          ? error.message
          : safeMessages[code];

      const heading = document.createElement('h3');
      heading.textContent = 'AI 연결 점검';
      root.appendChild(heading);

      if (modeLabels[mode]) {
        add('연결 모드: ' + modeLabels[mode]);
      }

      if (status === 'idle') {
        add('AI 연결 점검 전');
        add('현재 계정 연결을 확인한 후 사용자가 직접 점검을 시작하세요.');
        return root;
      }

      if (status === 'loading') {
        add('AI 연결 점검 중');
        add('이전 점검 결과는 현재 결과로 표시하지 않습니다.');
        return root;
      }

      if (status === 'error') {
        add('AI 연결 점검 실패 (' + code + ')');
        add('안내 메시지: ' + safeMessage);
        add('복구 안내: ' + errorGuides[code]);
        add('점검 실패는 사건 설명의 성공이나 보안 사건의 실패를 뜻하지 않습니다.');
        add('자동 재점검하지 않습니다. 사용자가 직접 다시 점검하세요.');
        return root;
      }

      if (status !== 'ok' || !data) {
        add('AI 연결 상태 확인 불가');
        return root;
      }

      if (data.audienceAuthorization === 'test') {
        add('시험 연결 점검(test) - 실제 앱 권한 검증 완료가 아닙니다.');
      } else if (data.audienceAuthorization === 'verified') {
        add('앱 권한 확인 후 점검(verified)');
      } else {
        add('AI 이용 권한 확인 불가');
        return root;
      }

      add('모델 응답 점검: ' +
        (data.transportChecked === true ? '수행됨' : '확인 불가'));
      add('응답 모델 수(modelCount): ' +
        (Number.isInteger(data.modelCount) ? data.modelCount : '확인 불가'));
      add('점검 시각(checkedAt): ' + (checkedAt ?? '확인 불가'));
      add('사건 설명은 아직 실행하지 않았습니다. 보안 기록에서 별도로 요청하고 확인해야 합니다.');
      add('연결 점검만으로 실제 사건 설명 성공을 판정하지 않습니다.');
      add('다시 점검은 사용자가 직접 실행합니다.');

      return root;
    },
    renderExplanation({ event, explanation, checkedAt } = {}) {
      const root = document.createElement('section');

      const add = (text) => {
        const p = document.createElement('p');
        p.textContent = String(text ?? '');
        root.appendChild(p);
      };

      const title = document.createElement('h3');
      title.textContent = 'AI 설명(참고용)';
      root.appendChild(title);

      const safeCodes = [
        'CANCELLED', 'WB_CLCO_CANCELLED', 'REQUEST_CANCELLED',
        'REQUEST_TIMEOUT', 'WB_CLCO_TIMEOUT',
        'ON_AI_INVALID_INPUT', 'ON_AI_INVALID_OUTPUT',
        'ON_AI_PROVISIONING_PENDING', 'AI_REQUEST_UNVERIFIED'
      ];

      const safeMessage = (error) => {
        const message = error?.message;
        return typeof message === 'string' &&
          message.length <= 500 &&
          !/sk-[A-Za-z0-9_-]{8,}|bearer\s+\S+|api[_-]?key\s*[:=]/i.test(message)
          ? message : 'AI 설명을 확인할 수 없습니다.';
      };

      // 실패는 event가 없어도 가장 먼저 처리합니다.
      if (explanation?.status === 'error') {
        const raw = explanation.error?.code;
        const code = safeCodes.includes(raw)
          ? raw : 'AI_REQUEST_UNVERIFIED';

        add('AI 설명 실패 (' + code + ')');
        add('오류 메시지: ' + safeMessage(explanation.error));

        if (code === 'ON_AI_INVALID_INPUT' ||
            code === 'ON_AI_INVALID_OUTPUT') {
          add('사건 근거가 부족하거나 AI 설명의 근거가 맞지 않습니다.');
        }

        add('기존 보안 기록은 그대로입니다. AI 설명 실패는 과제 실패가 아닙니다.');
        add('보안 조치는 실행되지 않았습니다.');
        return root;
      }

      if (!event?.id) {
        add('보안 기록에서 기록을 먼저 고르세요.');
        return root;
      }

      if (explanation?.status === 'loading') {
        add('사건 ' + event.id + '의 AI 설명 요청 중');
        return root;
      }

      if (explanation?.status !== 'ok' || !explanation.data) {
        add('AI 설명을 아직 실행하지 않았습니다.');
        return root;
      }

      const data = explanation.data;
      const evidence = Array.isArray(event.evidence)
        ? event.evidence : [];
      const rules = Array.isArray(event.rules)
        ? event.rules : [];
      const evidenceIds = data.evidenceIds;

      const evidenceMap = new Map(evidence.map(
        item => [item.id, item.text]
      ));

      const validEvidence = Array.isArray(evidenceIds) &&
        evidence.length > 0 &&
        evidenceIds.length === evidence.length &&
        new Set(evidenceIds).size === evidenceIds.length &&
        evidenceIds.every(id => evidenceMap.has(id));

      if (!validEvidence) {
        add('AI 설명을 사용할 수 없습니다.');
        add('근거 부족 또는 근거 ID 불일치: 현재 사건의 근거와 AI 인용 근거가 맞지 않습니다.');
        add('없는 근거를 새로 만들지 않습니다. 기존 기록은 그대로입니다.');
        return root;
      }

      if (data.executed !== false ||
          data.requiresHumanConfirmation !== true) {
        add('AI 설명을 사용할 수 없습니다.');
        add('자동 실행 여부 또는 사람 확인 조건이 올바르지 않습니다.');
        add('AI 설명으로 보안 조치를 실행하지 않습니다.');
        return root;
      }

      const proposals = data.proposals;
      if (!Array.isArray(proposals)) {
        add('AI 설명을 사용할 수 없습니다.');
        add('조치 제안 형식을 확인할 수 없습니다.');
        return root;
      }

      const supported = Array.isArray(event.supportedActions)
        ? event.supportedActions : [];

      const validProposals = proposals.every(proposal =>
        supported.includes(proposal.action) &&
        typeof proposal.reason === 'string' &&
        Array.isArray(proposal.evidenceIds) &&
        proposal.evidenceIds.length > 0 &&
        proposal.evidenceIds.every(id => evidenceMap.has(id))
      );

      if (!validProposals) {
        add('AI 설명을 사용할 수 없습니다.');
        add('지원하지 않는 조치 또는 일치하지 않는 제안 근거가 있습니다.');
        return root;
      }

      if (typeof data.summary !== 'string' ||
          data.summary.trim().length === 0) {
        add('AI 설명을 사용할 수 없습니다.');
        add('설명 요약이 없거나 확인할 수 없습니다.');
        return root;
      }

      // 성공이 확인된 경우에만 성공 속성을 지정합니다.
      root.setAttribute('data-student-explanation-event', event.id);

      add('사건 ID: ' + event.id);
      add('AI 설명 요약(참고용): ' + data.summary);
      add('설명 확인 시각: ' + (checkedAt ?? '확인 불가'));

      add('인용한 사건 근거');
      for (const id of evidenceIds) {
        add('근거 ' + id + ' — ' + evidenceMap.get(id));
      }

      add('사건 탐지 규칙');
      if (rules.length === 0) {
        add('표시할 규칙이 없습니다.');
      } else {
        for (const rule of rules) {
          add('규칙 ' + rule.id + ' — ' + rule.text);
        }
      }

      add('확인 불가 상태');
      const states = [
        ['접속', event.state?.access],
        ['세션', event.state?.session],
        ['기기', event.state?.device]
      ];
      const unknownStates = states.filter(([, value]) =>
        value === 'unknown'
      );

      if (unknownStates.length === 0) {
        add('확인 불가(unknown)로 전달된 상태: 없음');
      } else {
        for (const [name] of unknownStates) {
          add(name + ': 확인 불가(unknown)');
        }
      }

      add('AI 조치 제안');
      if (proposals.length === 0) {
        add(supported.length === 0
          ? '연동 시스템이 지원하는 조치가 없어 제안이 없습니다(정상).'
          : 'AI가 제안한 조치가 없습니다.');
      } else {
        for (const proposal of proposals) {
          add('제안 조치: ' + proposal.action);
          add('제안 이유: ' + proposal.reason);
          add('제안 근거: ' + proposal.evidenceIds.join(', '));
          add('사람 확인이 필요하며 실행되지 않았습니다.');
        }
      }

      add('AI 설명은 참고 정보입니다. 사실 판단은 사건 근거와 연동 시스템 상태를 기준으로 합니다.');
      add('실행된 조치: 없음(executed=false)');
      return root;
    },
    renderAction({
      status = 'idle', event = null, actionId = null,
      target = null, receipt = null, observation = null,
      message = null, confirmationExpiresAt = null, error = null
    } = {}) {
      const root = document.createElement('section');
      const add = (value) => {
        const p = document.createElement('p');
        p.textContent = String(value);
        root.appendChild(p);
      };

      const heading = document.createElement('h3');
      heading.textContent = '보안 조치 요청 상태';
      root.appendChild(heading);

      const safeText = (value) => {
        if (typeof value !== 'string' && typeof value !== 'number') {
          return null;
        }
        const text = String(value);
        if (text.length > 500 ||
            /bearer\s+\S+|sk-[A-Za-z0-9_-]{8,}|api[_-]?key\s*[:=]/i.test(text)) {
          return '[민감 정보 또는 과도한 내용으로 표시 제한]';
        }
        return text;
      };

      const field = (name, value) => {
        if (value !== null && value !== undefined && value !== '') {
          add(name + ': ' + (safeText(value) ?? '확인 불가'));
        }
      };

      const statuses = {
        idle: '아직 미실행(idle)',
        loading: '조치 준비 또는 결과 조회 중(loading). 결과 미확인',
        prepared: '준비됨·미실행(prepared). 사람 확인 전이며 집행되지 않았습니다.',
        executing: '서버에 전달 중(executing). 결과와 효과는 아직 확인되지 않았습니다.',
        pending: '서버 접수·처리 중(pending). ACK는 실행 효과 확인이 아닙니다.',
        succeeded: '서버 응답 상태: succeeded. 실제 효과는 관측 결과를 확인해야 합니다.',
        denied: '연동 시스템에서 거절(denied)',
        failed: '연동 시스템 처리 실패(failed)',
        unknown: '결과 불명(unknown). 성공이나 효과 없음으로 판단하지 마세요. 연동 시스템 결과만 재조회하세요.',
        error: '요청 처리 오류(error)',
        expired: '확인 기한 만료(expired). 조치를 다시 준비해야 합니다.'
      };

      add(statuses[status] ?? '알 수 없는 조치 상태: 확인 불가');

      const evidence = Array.isArray(event?.evidence)
        ? event.evidence : [];

      field('현재 사건 ID', event?.id);

      if (evidence.length > 0) {
        add('현재 사건 근거 ID: ' +
          evidence.map(item => safeText(item.id) ?? '확인 불가').join(', '));
      }

      field('조치 ID', actionId);
      field('실제 대상 ID', target?.id);
      field('대상 세대(generation)', target?.generation);
      field('요청 ID(requestId)', receipt?.requestId);
      field('접수 ID(receiptId)', receipt?.receiptId);
      field('서버 결과 버전(version)', receipt?.version);
      field('확인 기한', confirmationExpiresAt);

      if (status === 'prepared') {
        add('제공 화면에서 대상과 조치를 직접 확인해야 합니다.');
        add('이 상태에서는 집행되지 않았습니다.');
      }

      if (status === 'executing' || status === 'pending') {
        add('서버 전달 또는 접수 상태만으로 실제 조치 효과를 확정할 수 없습니다.');
      }

      const mismatch =
        (receipt?.eventId != null && receipt.eventId !== event?.id) ||
        (receipt?.actionId != null && receipt.actionId !== actionId);

      if (mismatch) {
        add('현재 사건 또는 조치와 서버 응답의 식별자가 일치하지 않습니다.');
        add('이전 요청 결과를 현재 사건의 결과로 인정하지 않습니다.');
        return root;
      }

      if (status === 'succeeded') {
        if (observation?.effectApplied === true &&
            observation?.observedAt &&
            receipt?.receiptId) {
          add('효과 확인(succeeded)');
          field('관측 시각', observation.observedAt);
          add('effectApplied: true');
          field('효과 확인 접수 ID(receiptId)', receipt.receiptId);
        } else {
          add('결과 불명: 실제 효과를 확인할 수 없습니다.');
          add('성공으로 판단하지 말고 연동 시스템 결과만 재조회하세요.');
        }
      }

      if (status === 'unknown') {
        add('조치 화면 취소는 이미 서버에 전달된 조치의 효과를 되돌리지 않습니다.');
      }

      if (status === 'denied' || status === 'failed') {
        field('연동 시스템 메시지', message);
      }

      if (status === 'error') {
        field('오류 코드', error?.code);
        field('오류 메시지', error?.message);
        add('요청이 처리되지 않았거나 처리 결과를 확인하지 못했습니다.');
      }

      if (status === 'idle' &&
          Array.isArray(event?.supportedActions) &&
          event.supportedActions.length === 0) {
        add('연동 시스템이 지원하는 조치가 없어 집행할 수 없습니다(정상).');
      }

      if (event?.id && receipt?.requestId &&
          !mismatch) {
        root.setAttribute('data-student-action-event', String(event.id));
        root.setAttribute('data-student-action-request', String(receipt.requestId));
      }

      add('실제 조치는 제공 화면과 서버가 처리합니다. 학생 화면은 상태만 표시합니다.');
      return root;
    },
  };
}
