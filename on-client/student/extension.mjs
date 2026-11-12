// 이 파일은 학생이 같은 프로젝트에서 이어서 구현합니다.
// 제공 UI를 받은 것만으로 단계 완료를 인정하지 않습니다.

// ---------- 13단계 · renderIdentity 보조 함수 ----------
// 화면은 document.createElement 와 textContent 로만 만들고, HTML 문자열은 넣지 않습니다.
// renderIdentity 는 부를 때마다 입력값만으로 새 요소를 만들어 돌려줍니다.
// 이전 사용자·기기·세션 값을 모듈 변수에 저장하지 않으므로, 다시 불러오기로 새 입력이 오면
// 제공 UI가 학생 칸을 새 요소로 교체하고, 오류 입력에서는 옛 사용자 이름이 남지 않습니다.

const DEVICE_STATUS = {
  compliant: { text: '보안 기준 충족', tone: 'ok' },
  noncompliant: { text: '보안 기준 미충족', tone: 'error' },
  unknown: { text: '확인 불가', tone: 'empty' },
};

const SESSION_STATUS = {
  active: { text: '활성', tone: 'ok' },
  expired: { text: '만료', tone: 'error' },
  revoked: { text: '철회됨', tone: 'error' },
  unknown: { text: '확인 불가', tone: 'empty' },
};

const MODE_TEXT = {
  connected: '실제 연결',
  demo: '예제 자료',
  disconnected: '연결 없음',
  unknown: '확인 불가',
};

function node(tag, text, className) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text != null) element.textContent = String(text);
  return element;
}

function textOr(value, fallback) {
  return typeof value === 'string' && value.trim() !== '' ? value : fallback;
}

function isObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

// 모드 안내는 loading·ok·error 어느 상태에서든 함께 보여 줍니다.
function modeLine(resource) {
  const mode = isObject(resource) ? resource.mode : null;
  const text = Object.hasOwn(MODE_TEXT, mode) ? MODE_TEXT[mode] : MODE_TEXT.unknown;
  const line = node('p', `자료 출처: ${text}`, `tag ${mode === 'demo' ? 'tag-demo' : 'tag-student'}`);
  line.dataset.mode = Object.hasOwn(MODE_TEXT, mode) ? mode : 'unknown';
  return line;
}

// 상태값을 색상만이 아니라 글자로도 구분합니다. 정상이 아닌 값에는 "주의:"를 붙입니다.
function statusLine(label, rawStatus, table) {
  const known = Object.hasOwn(table, rawStatus) ? rawStatus : 'unknown';
  const { text, tone } = table[known];
  const prefix = tone === 'ok' ? '' : '주의: ';
  const line = node('p', `${label}: ${prefix}${text} (${known})`, `state state-${tone}`);
  line.dataset.status = known;
  return line;
}

function fieldLine(label, value) {
  return node('p', `${label}: ${value}`);
}

// loading / error / 형식 불일치는 값 대신 상태 안내만 보여 줍니다(이전 값을 남기지 않음).
function notReady(resource) {
  if (!isObject(resource)) return node('p', '확인 불가: 전달된 자료가 없습니다.', 'state state-empty');
  if (resource.status === 'loading') return node('p', '불러오는 중…', 'state state-loading');
  if (resource.status === 'error') {
    const message = textOr(resource.error && resource.error.message, '서버가 오류 내용을 보내지 않았습니다.');
    const unverified = resource.mode === 'unknown' || (resource.error && resource.error.code === 'CONTRACT_MISMATCH');
    const box = node('div', null, 'state state-error');
    box.setAttribute('role', 'alert');
    box.append(
      node('p', `${unverified ? '확인 불가' : '연결 실패'}: ${message}`),
      node('p', '이전에 표시하던 정보는 지웠습니다. 다시 불러오기로 새로 확인하세요.'),
    );
    return box;
  }
  if (resource.status !== 'ok') {
    return node('p', '확인 불가: 알 수 없는 응답 상태입니다.', 'state state-empty');
  }
  return null;
}

function section(title, testid, resource, renderOk) {
  const wrap = node('section', null, 'identity-part');
  wrap.dataset.testid = testid;
  wrap.dataset.state = isObject(resource) && typeof resource.status === 'string' ? resource.status : 'unknown';
  wrap.append(node('h3', title), modeLine(resource));
  const pending = notReady(resource);
  wrap.append(pending || renderOk(resource.data));
  return wrap;
}

function renderMe(data) {
  if (!isObject(data) || !isObject(data.user) || !isObject(data.device) || !isObject(data.session)) {
    return node('p', '확인 불가: 계정 자료 형식이 예상과 다릅니다.', 'state state-empty');
  }
  const box = node('div');
  box.append(
    fieldLine('사용자', `${textOr(data.user.label, '이름 없음')} (${textOr(data.user.id, 'ID 없음')})`),
    fieldLine('현재 기기', `${textOr(data.device.label, '이름 없음')} (${textOr(data.device.id, 'ID 없음')})`),
    statusLine('기기 보안 상태', data.device.status, DEVICE_STATUS),
    fieldLine('현재 세션', textOr(data.session.id, 'ID 없음')),
    statusLine('세션 상태', data.session.status, SESSION_STATUS),
  );
  return box;
}

function renderDeviceList(data) {
  if (!Array.isArray(data)) return node('p', '확인 불가: 기기 목록 형식이 예상과 다릅니다.', 'state state-empty');
  if (data.length === 0) return node('p', '등록된 기기가 없습니다.', 'state state-empty');
  const list = node('ul');
  for (const device of data) {
    const item = node('li');
    const safe = isObject(device) ? device : {};
    item.append(
      fieldLine('기기', `${textOr(safe.label, '이름 없음')} (${textOr(safe.id, 'ID 없음')})`),
      statusLine('보안 상태', safe.status, DEVICE_STATUS),
    );
    list.append(item);
  }
  return list;
}

function renderSessionList(data) {
  if (!Array.isArray(data)) return node('p', '확인 불가: 세션 목록 형식이 예상과 다릅니다.', 'state state-empty');
  if (data.length === 0) return node('p', '로그인 세션이 없습니다.', 'state state-empty');
  const list = node('ul');
  for (const session of data) {
    const item = node('li');
    const safe = isObject(session) ? session : {};
    item.append(
      fieldLine('세션', textOr(safe.id, 'ID 없음')),
      statusLine('상태', safe.status, SESSION_STATUS),
    );
    list.append(item);
  }
  return list;
}

function renderIdentityView(input) {
  const { me, devices, sessions } = isObject(input) ? input : {};
  const root = node('div', null, 'student-identity-view');
  root.dataset.testid = 'student-identity-view';
  root.append(
    section('내 계정과 현재 기기·세션', 'student-identity-me', me, renderMe),
    section('내 기기 목록', 'student-identity-devices', devices, renderDeviceList),
    section('내 로그인 세션 목록', 'student-identity-sessions', sessions, renderSessionList),
    node('p', '기기 보안 상태 표시는 악성코드 검사나 치료 기능이 아닙니다.', 'student-text'),
  );
  return root;
}

// ---------- 14단계 · renderDecision 보조 함수 ----------
// 입력: { status, mode, data?, error?, appId }, data: { appId, decision, reason, checkedAt }
// 판정은 한국어 뜻과 원래 코드값을 함께 글자로 보여 주고, 목록에 없는 값은 확인 불가(unknown)로 처리합니다.
// 요청 실패(error)는 서버 판정이 아니므로 거부(deny)와 다른 문구·상태로 보여 줍니다.

const DECISION_TEXT = {
  allow: {
    text: '접근 허용',
    note: '정책상 이 앱 접근이 허용되었습니다. 실제 앱 접속 성공을 보장하지는 않습니다.',
  },
  deny: {
    text: '접근 거부',
    note: '정책상 이 앱 접근이 거부되었습니다.',
  },
  challenge: {
    text: '추가 확인 필요',
    note: '접근 전에 추가 인증 또는 확인이 필요합니다. 이 화면은 확인 절차를 대신 수행하지 않습니다.',
  },
  unknown: {
    text: '확인 불가',
    note: '판정을 확인할 수 없습니다. 접근이 허용되지 않은 것으로 보고, 허용으로 간주하지 마세요.',
  },
};

function formatCheckedAt(value) {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) return '시각 정보 없음';
  return `${new Date(value).toLocaleString('ko-KR')} (${value})`;
}

function decisionResult(input) {
  const data = isObject(input.data) ? input.data : {};
  const raw = data.decision;
  const known = Object.hasOwn(DECISION_TEXT, raw) ? raw : 'unknown';
  const { text, note } = DECISION_TEXT[known];
  const prefix = known === 'allow' ? '' : '주의: ';
  const box = node('div', null, `decision decision-${known}`);
  box.dataset.decision = known;
  const headline = node('p', `판정: ${prefix}${text}(${known})`);
  headline.dataset.status = known;
  box.append(
    headline,
    fieldLine('대상 앱', textOr(data.appId, textOr(input.appId, 'ID 없음'))),
    node('p', note),
  );
  if (known === 'unknown' && raw !== 'unknown') {
    box.append(fieldLine('서버가 보낸 판정 값', textOr(typeof raw === 'string' ? raw : null, '값 없음')));
  }
  box.append(
    fieldLine('판정 이유', textOr(data.reason, '이유 정보 없음')),
    fieldLine('판정 시각', formatCheckedAt(data.checkedAt)),
  );
  return box;
}

function decisionFailure(input) {
  const message = textOr(input.error && input.error.message, '서버가 오류 내용을 보내지 않았습니다.');
  const box = node('div', null, 'decision decision-failed');
  box.dataset.decision = 'request-failed';
  box.setAttribute('role', 'alert');
  box.append(
    node('p', `요청 실패: ${message}`),
    fieldLine('대상 앱', textOr(input.appId, 'ID 없음')),
    node('p', '이것은 접근 거부(deny) 판정이 아닙니다. 판정을 받지 못했으므로 접근이 허용되지 않은 상태입니다.'),
    node('p', '필요하면 앱을 다시 골라 직접 접속을 요청하세요.'),
  );
  return box;
}

function renderDecisionView(input) {
  const safe = isObject(input) ? input : {};
  const root = node('section', null, 'student-decision-view');
  root.dataset.testid = 'student-decision-view';
  root.dataset.state = typeof safe.status === 'string' ? safe.status : 'unknown';
  root.append(node('h3', '업무 앱 접근 판정'));
  if (safe.status === 'idle') {
    root.append(node('p', '앱을 골라 접속을 요청하세요.', 'state state-empty'));
    return root;
  }
  if (safe.status === 'loading') {
    root.append(node('p', `판정 확인 중… (대상 앱: ${textOr(safe.appId, 'ID 없음')})`, 'state state-loading'));
  } else if (safe.status === 'error') {
    root.append(modeLine(safe), decisionFailure(safe));
  } else if (safe.status === 'ok') {
    root.append(modeLine(safe), decisionResult(safe));
  } else {
    root.append(node('p', '확인 불가(unknown): 알 수 없는 응답 상태입니다. 허용으로 간주하지 마세요.', 'state state-empty'));
  }
  root.append(node('p', '이 칸은 선택한 앱 한 개의 판정만 보여 주며, 전체 업무 앱 권한 목록이 아닙니다.', 'student-text'));
  return root;
}

// ---------- 15단계 · renderEvents 보조 함수 ----------
// 입력: { status, mode, data?, error? }, data: 기록 배열
// 기록: { id, kind, at, appId, summary, evidence:[{id,text}], rules:[{id,text}], state:{access,session,device}, supportedActions }
// 받은 배열은 복사해서 정렬·필터링만 하고, 원본 배열이나 서버 자료는 바꾸지 않습니다.
// 필터·상세 선택 상태는 renderEvents 를 부를 때마다 새로 만듭니다.
// 그래서 다시 불러오기로 새 자료가 오면 이전 목록·필터·상세가 남지 않고 모두 새로 그려집니다.
// 서버에 다시 묻지 않고 받은 배열 안에서만 걸러 봅니다. 조치는 16단계의 비활성 「<action> 미지원」 버튼으로만 보여 줍니다.

const EVENT_KIND_TEXT = {
  access: '접속 기록',
  xdr: 'XDR 경보',
};

const ACCESS_STATE = {
  allowed: { text: '허용', tone: 'ok' },
  denied: { text: '거부', tone: 'error' },
  unknown: { text: '확인 불가', tone: 'empty' },
};

let eventFieldSeq = 0;

function kindText(kind) {
  return Object.hasOwn(EVENT_KIND_TEXT, kind) ? `${EVENT_KIND_TEXT[kind]}(${kind})` : `확인 불가(${textOr(kind, '값 없음')})`;
}

function appText(appId) {
  return textOr(appId, '앱을 확인할 수 없음(appId 없음)');
}

function eventTimeMs(value) {
  const ms = typeof value === 'string' ? Date.parse(value) : NaN;
  return Number.isFinite(ms) ? ms : -Infinity;
}

function formatEventTime(value) {
  const ms = eventTimeMs(value);
  if (ms === -Infinity) return `시각 확인 불가(${textOr(value, '값 없음')})`;
  const korean = new Date(ms).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
  return `${korean} 한국 시각 (원래 값 ${value})`;
}

// 세 상태를 따로, 한국어 설명과 원래 값을 함께 적습니다. unknown 은 "확인 불가(unknown)" 입니다.
function eventStateLine(label, rawStatus, table) {
  const known = Object.hasOwn(table, rawStatus) ? rawStatus : 'unknown';
  const { text, tone } = table[known];
  const prefix = tone === 'ok' ? '' : '주의: ';
  const line = node('p', `${label}: ${prefix}${text}(${known})`, `state state-${tone}`);
  line.dataset.status = known;
  if (known !== rawStatus) line.append(node('span', ` · 서버가 보낸 값: ${textOr(typeof rawStatus === 'string' ? rawStatus : null, '값 없음')}`));
  return line;
}

function textRowList(title, rows, emptyText) {
  const wrap = node('div');
  wrap.append(node('h5', title));
  const list = Array.isArray(rows) ? rows.filter(isObject) : [];
  if (list.length === 0) {
    wrap.append(node('p', emptyText));
    return wrap;
  }
  const ul = node('ul');
  for (const row of list) ul.append(node('li', `${textOr(row.id, 'ID 없음')}: ${textOr(row.text, '내용 없음')}`));
  wrap.append(ul);
  return wrap;
}

function eventDetail(event) {
  const state = isObject(event.state) ? event.state : {};
  const box = node('section', null, 'student-event-detail');
  box.dataset.studentEventDetail = event.id;
  box.setAttribute('aria-label', `${event.id} 상세 정보`);
  box.append(
    node('h4', `${event.id} 상세`),
    fieldLine('사건 ID', event.id),
    fieldLine('앱 ID', appText(event.appId)),
    fieldLine('종류', kindText(event.kind)),
    fieldLine('시각', formatEventTime(event.at)),
    fieldLine('요약', textOr(event.summary, '요약 없음')),
    textRowList('근거(evidence)', event.evidence, '근거 없음'),
    textRowList('적용 규칙(rules)', event.rules, '적용 규칙 없음'),
  );
  const states = node('div');
  states.append(
    node('h5', '상태(state)'),
    eventStateLine('접속 판정(access)', state.access, ACCESS_STATE),
    eventStateLine('세션 상태(session)', state.session, SESSION_STATUS),
    eventStateLine('기기 보안 상태(device)', state.device, DEVICE_STATUS),
  );
  if ([state.access, state.session, state.device].includes('unknown')) {
    states.append(node('p', '확인 불가(unknown)는 지금 확인할 수 없는 상태입니다. 정상으로 간주하지 않습니다.'));
  }
  box.append(states);
  box.append(unsupportedActions(event));
  return box;
}

// 16단계: 이 화면에는 조치 실행이 연결돼 있지 않으므로, 넘겨받은 조치는 모두 미지원으로 안내합니다.
// 버튼은 disabled 이고 click 처리기를 달지 않아 어떤 요청(POST 포함)도 보내지 않습니다.
// supportedActions 가 비어 있으면 버튼을 만들지 않습니다.
function unsupportedActions(event) {
  const wrap = node('div', null, 'student-event-actions');
  wrap.append(node('h5', '조치(supportedActions)'));
  const actions = uniqueStrings(Array.isArray(event.supportedActions) ? event.supportedActions : []);
  if (actions.length === 0) {
    wrap.append(node('p', '지원되는 조치: 없음. 이 기록에는 조치 버튼을 만들지 않습니다.'));
    return wrap;
  }
  const noteId = `student-unsupported-note-${++eventFieldSeq}`;
  const note = node('p', '아직 지원하지 않는 조치입니다. 조치 실행 연결은 준비 중이며, 이 버튼은 비활성 상태라 눌러도 요청을 보내지 않습니다. 조치가 실행되거나 완료된 것이 아닙니다.', 'state state-empty');
  note.id = noteId;
  const buttons = node('p');
  for (const action of actions) {
    const button = node('button', `${action} 미지원`);
    button.type = 'button';
    button.disabled = true;
    button.dataset.studentUnsupportedAction = action;
    button.setAttribute('aria-describedby', noteId);
    buttons.append(button, document.createTextNode(' '));
  }
  wrap.append(buttons, note);
  return wrap;
}

function eventRow(event, selectedId, onSelect) {
  const item = node('li', null, 'student-event');
  item.dataset.studentEventId = event.id;
  item.append(
    fieldLine('사건 ID', event.id),
    fieldLine('시각', formatEventTime(event.at)),
    fieldLine('종류', kindText(event.kind)),
    fieldLine('앱', appText(event.appId)),
    fieldLine('요약', textOr(event.summary, '요약 없음')),
  );
  const button = node('button', `${event.id} 상세`);
  button.type = 'button';
  button.setAttribute('aria-expanded', String(selectedId === event.id));
  button.addEventListener('click', () => onSelect(event.id));
  item.append(button);
  return item;
}

function filterSelect(label, values, describe, current, onChange) {
  const id = `student-event-filter-${++eventFieldSeq}`;
  const wrap = node('p');
  const labelEl = node('label', `${label} `);
  labelEl.htmlFor = id;
  const select = node('select');
  select.id = id;
  select.setAttribute('aria-label', label);
  const all = node('option', '전체');
  all.value = 'all';
  select.append(all);
  for (const value of values) {
    const option = node('option', describe(value));
    option.value = value;
    select.append(option);
  }
  select.value = current;
  select.addEventListener('change', () => onChange(select.value));
  wrap.append(labelEl, select);
  return wrap;
}

function uniqueStrings(values) {
  return [...new Set(values.filter((v) => typeof v === 'string' && v !== ''))];
}

function eventsList(data) {
  // 원본을 바꾸지 않도록 복사한 뒤 at 기준 최신순으로 정렬합니다.
  const events = data.filter((event) => isObject(event) && typeof event.id === 'string')
    .slice()
    .sort((a, b) => eventTimeMs(b.at) - eventTimeMs(a.at));
  const filter = { kind: 'all', appId: 'all', access: 'all' };
  let selectedId = null;

  const box = node('div');
  const count = node('p', null, 'student-text');
  count.setAttribute('aria-live', 'polite');
  const list = node('ul', null, 'student-event-list');
  const detail = node('div', null, 'student-event-detail-area');

  const matches = (event) => (filter.kind === 'all' || event.kind === filter.kind)
    && (filter.appId === 'all' || event.appId === filter.appId)
    && (filter.access === 'all' || (isObject(event.state) && event.state.access === filter.access));

  function draw() {
    const shown = events.filter(matches);
    if (selectedId != null && !shown.some((event) => event.id === selectedId)) selectedId = null;
    count.textContent = `표시 중인 기록: ${shown.length}건 (받은 기록 ${events.length}건)`;
    if (shown.length === 0) {
      list.replaceChildren(node('li', '선택한 조건에 맞는 기록이 없습니다. 필터를 "전체"로 바꾸면 받은 기록을 모두 볼 수 있습니다.', 'state state-empty'));
    } else {
      list.replaceChildren(...shown.map((event) => eventRow(event, selectedId, select)));
    }
    const selected = shown.find((event) => event.id === selectedId);
    detail.replaceChildren(selected
      ? eventDetail(selected)
      : node('p', '기록의 상세 버튼을 누르면 근거·규칙·상태가 여기에 표시됩니다.', 'student-text'));
  }

  // 목록을 다시 그린 뒤에도 키보드 사용자가 같은 상세 버튼에 머물도록 초점을 되돌립니다.
  function select(id) {
    selectedId = id;
    draw();
    const row = [...list.children].find((item) => item.dataset.studentEventId === id);
    const button = row && row.querySelector('button');
    if (button) button.focus();
  }

  function setFilter(key) {
    return (value) => {
      filter[key] = value;
      draw();
    };
  }

  const filters = node('div', null, 'student-event-filters');
  filters.setAttribute('role', 'group');
  filters.setAttribute('aria-label', '보안 기록 필터');
  filters.append(
    filterSelect('기록 종류', uniqueStrings([...Object.keys(EVENT_KIND_TEXT), ...events.map((e) => e.kind)]), kindText, filter.kind, setFilter('kind')),
    filterSelect('업무 앱', uniqueStrings(events.map((e) => e.appId)), (v) => v, filter.appId, setFilter('appId')),
    filterSelect('접속 상태', uniqueStrings([...Object.keys(ACCESS_STATE), ...events.map((e) => isObject(e.state) ? e.state.access : null)]),
      (v) => (Object.hasOwn(ACCESS_STATE, v) ? `${ACCESS_STATE[v].text}(${v})` : v), filter.access, setFilter('access')),
  );

  box.append(filters, count, list, detail);
  draw();
  return box;
}

function eventsFailure(input) {
  const message = textOr(input.error && input.error.message, '서버가 오류 내용을 보내지 않았습니다.');
  const unverified = input.mode === 'unknown' || (input.error && input.error.code === 'CONTRACT_MISMATCH');
  const box = node('div', null, 'state state-error');
  box.dataset.state = unverified ? 'unverified' : 'error';
  box.setAttribute('role', 'alert');
  box.append(
    node('p', unverified
      ? `확인 불가: 기록을 불러오지 못했습니다(응답 형식을 확인할 수 없음): ${message}`
      : `기록을 불러오지 못했습니다: ${message}`),
    node('p', '이전에 표시하던 기록 목록과 상세는 지웠습니다. 기록이 없는 것이 아니라 조회에 실패한 상태입니다. 다시 불러오기로 새로 확인하세요.'),
  );
  return box;
}

function renderEventsView(input) {
  const safe = isObject(input) ? input : {};
  const root = node('section', null, 'student-events-view');
  root.dataset.testid = 'student-events-view';
  root.dataset.state = typeof safe.status === 'string' ? safe.status : 'unknown';
  root.append(node('h3', '내 접속 기록과 XDR 경보'));
  if (safe.status === 'loading') {
    root.append(node('p', '보안 기록 불러오는 중…', 'state state-loading'));
  } else if (safe.status === 'error') {
    root.append(modeLine(safe), eventsFailure(safe));
  } else if (safe.status === 'ok' && Array.isArray(safe.data) && safe.data.length === 0) {
    root.append(modeLine(safe), node('p', '표시할 기록이 없습니다. 조회는 정상으로 끝났고, 받은 기록이 0건입니다.', 'state state-empty'));
  } else if (safe.status === 'ok' && Array.isArray(safe.data)) {
    root.append(modeLine(safe), eventsList(safe.data));
  } else {
    root.append(node('p', '확인 불가: 기록 자료 형식이나 응답 상태를 확인할 수 없습니다. 이전 목록은 표시하지 않습니다.', 'state state-empty'));
  }
  root.append(node('p', '조회 범위: 본인의 최근 기록 최대 40건입니다. 모든 직원의 전체 이력이나 실시간 전체 위협 탐지가 아니며, XDR 경보는 서버에 이미 저장된 경보만 표시합니다.', 'student-text'));
  return root;
}

// ---------- 16단계 · renderStatus 보조 함수 ----------
// 입력: { devices, sessions, notifications, diagnostics, mode }
// devices·sessions·diagnostics: { status, mode, data?, error? }, notifications: [{ resource, code, message }]
// 화면은 부를 때마다 입력값만으로 새로 만듭니다. 그래서 사용자가 다시 불러오기를 눌러 성공한 입력이 오면
// 이전 실패·시간 초과 안내는 남지 않습니다. 이 함수는 어떤 요청도 보내지 않으며, 자동으로 다시 요청하지 않습니다.
// /api/diagnostics 는 제공 화면이 조회해 넘겨 준 값만 쓰고, 학생 코드에서 직접 호출하지 않습니다.

const RESOURCE_TEXT = {
  me: '로그인 정보',
  apps: '업무 앱',
  events: '보안 기록',
  devices: '기기',
  sessions: '세션',
  access: '접속 판정',
  diagnostics: '도움정보',
  vulnerabilities: '설치 패키지 조회',
};

const RETRY_TEXT = '다시 시도는 위쪽 「다시 불러오기」 버튼을 직접 누르세요. 이 화면은 자동으로 다시 요청하지 않습니다.';

// 도움정보에서 화면 표시와 복사에 쓰는 항목은 이 여섯 개뿐입니다. 나머지 항목은 읽지 않습니다.
const DIAGNOSTIC_FIELDS = [
  ['requestId', (d) => d.requestId],
  ['component', (d) => d.component],
  ['version', (d) => d.version],
  ['checkedAt', (d) => d.checkedAt],
  ['engine.mode', (d) => (isObject(d.engine) ? d.engine.mode : undefined)],
  ['engine.code', (d) => (isObject(d.engine) ? d.engine.code : undefined)],
];

// 열쇠·토큰처럼 보이는 값은 원문 대신 가림 표시로 바꿉니다(여섯 항목에 원래 비밀은 없지만 한 번 더 막습니다).
const SECRET_LIKE = /(bearer|token|secret|password|passwd|api[_-]?key|authorization|sk-[a-z0-9])/i;

function resourceText(resource) {
  return Object.hasOwn(RESOURCE_TEXT, resource) ? `${RESOURCE_TEXT[resource]}(${resource})` : `확인 불가(${textOr(resource, '자료 이름 없음')})`;
}

function safeCode(code) {
  return typeof code === 'string' && /^[A-Za-z0-9_.-]{1,64}$/.test(code) ? code : '코드 확인 불가';
}

function safeDiagnosticValue(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value !== 'string' || value.trim() === '') return '값 없음';
  if (SECRET_LIKE.test(value)) return '[가림: 비밀값으로 보이는 값]';
  return value.length > 200 ? `${value.slice(0, 200)}…` : value;
}

// 받침에 맞춰 목적격 조사(을/를)를 붙입니다. 예: 기기 목록을, 세션 정보를
function withObject(word) {
  const last = word.charCodeAt(word.length - 1);
  const hasFinal = last >= 0xac00 && last <= 0xd7a3 && (last - 0xac00) % 28 !== 0;
  return `${word}${hasFinal ? '을' : '를'}`;
}

function isTimeout(error) {
  const code = isObject(error) && typeof error.code === 'string' ? error.code : '';
  const message = isObject(error) && typeof error.message === 'string' ? error.message : '';
  return code.includes('TIMEOUT') || message.includes('시간이 초과');
}

// 실패 안내: 무엇을 불러오지 못했는지, message, 시간 초과 여부, 사용자가 직접 할 일을 글자로 보여 줍니다.
function statusFailure(what, resource) {
  const error = isObject(resource.error) ? resource.error : {};
  const message = textOr(error.message, '서버가 오류 내용을 보내지 않았습니다.');
  const unverified = ['CONTRACT_MISMATCH', 'ENGINE_RESULT_UNVERIFIED'].includes(error.code);
  const timeout = isTimeout(error);
  const box = node('div', null, 'state state-error');
  box.dataset.state = timeout ? 'timeout' : unverified ? 'unverified' : 'error';
  box.setAttribute('role', 'alert');
  if (timeout) {
    box.append(node('p', `시간 초과: ${withObject(what)} 제한 시간 안에 불러오지 못했습니다. (${safeCode(error.code)}) ${message}`));
  } else if (unverified) {
    box.append(node('p', `확인 불가: ${withObject(what)} 불러오지 못했습니다(응답 형식을 확인할 수 없음). (${safeCode(error.code)}) ${message}`));
  } else {
    box.append(node('p', `실패: ${withObject(what)} 불러오지 못했습니다. (${safeCode(error.code)}) ${message}`));
  }
  box.append(
    node('p', '목록이 비어 있는 것이 아니라 조회에 실패한 상태입니다. 이전에 표시하던 값은 지웠습니다.'),
    node('p', `로컬 서버가 실행 중인지와 연결 상태를 확인하세요. ${RETRY_TEXT}`),
  );
  return box;
}

function statusPart(title, testid, resource, what, renderOk) {
  const wrap = node('section', null, 'status-part');
  wrap.dataset.testid = testid;
  const safe = isObject(resource) ? resource : {};
  wrap.dataset.state = typeof safe.status === 'string' ? safe.status : 'unknown';
  wrap.append(node('h4', title));
  if (safe.status === 'loading') {
    wrap.append(node('p', `불러오는 중: ${withObject(what)} 조회하고 있습니다…`, 'state state-loading'));
  } else if (safe.status === 'error') {
    wrap.append(modeLine(safe), statusFailure(what, safe));
  } else if (safe.status === 'ok') {
    wrap.append(modeLine(safe), renderOk(safe.data, safe));
  } else if (safe.status === 'idle') {
    wrap.append(node('p', `${withObject(what)} 아직 불러오지 않았습니다.`, 'state state-empty'));
  } else {
    wrap.append(node('p', `확인 불가: ${what}의 응답 상태를 알 수 없습니다.`, 'state state-empty'));
  }
  return wrap;
}

function statusDevices(data) {
  if (!Array.isArray(data)) return node('p', '확인 불가: 기기 목록 형식이 예상과 다릅니다.', 'state state-empty');
  if (data.length === 0) return node('p', '등록된 기기가 없습니다. 조회는 정상으로 끝났고, 받은 기기가 0건입니다(오류 아님).', 'state state-empty');
  const list = node('ul');
  for (const device of data) {
    const safe = isObject(device) ? device : {};
    const item = node('li');
    item.append(
      fieldLine('기기', `${textOr(safe.label, '이름 없음')} (${textOr(safe.id, 'ID 없음')})`),
      statusLine('보안 상태', safe.status, DEVICE_STATUS),
    );
    list.append(item);
  }
  return list;
}

function statusSessions(data) {
  const box = node('div');
  if (!Array.isArray(data)) {
    box.append(node('p', '확인 불가: 세션 자료 형식이 예상과 다릅니다.', 'state state-empty'));
  } else if (data.length === 0) {
    box.append(node('p', '현재 연결 없음: 지금 검증된 연결이 없습니다. 조회는 정상으로 끝났습니다(오류 아님).', 'state state-empty'));
  } else {
    const list = node('ul');
    for (const session of data) {
      const safe = isObject(session) ? session : {};
      const item = node('li');
      item.append(
        fieldLine('세션', textOr(safe.id, 'ID 없음')),
        statusLine('상태', safe.status, SESSION_STATUS),
      );
      list.append(item);
    }
    box.append(list);
  }
  box.append(node('p', '세션은 지금 검증된 연결 한 개만 표시합니다. 지난 세션 전체 목록이 아닙니다.', 'student-text'));
  return box;
}

function statusNotifications(notifications) {
  const wrap = node('section', null, 'status-part');
  wrap.dataset.testid = 'student-status-notifications';
  wrap.append(node('h4', '알림'));
  if (!Array.isArray(notifications)) {
    wrap.append(node('p', '확인 불가: 알림 자료 형식이 예상과 다릅니다.', 'state state-empty'));
    return wrap;
  }
  const rows = notifications.filter(isObject);
  if (rows.length === 0) {
    wrap.append(node('p', '주의할 알림이 없습니다.', 'state state-ok'));
    return wrap;
  }
  wrap.append(node('p', `주의할 알림 ${rows.length}건`));
  const list = node('ul');
  for (const row of rows) {
    const code = safeCode(row.code);
    const item = node('li', null, 'state state-error');
    item.dataset.resource = typeof row.resource === 'string' ? row.resource : 'unknown';
    item.append(
      fieldLine('자료', resourceText(row.resource)),
      fieldLine('코드', code),
      fieldLine('내용', textOr(row.message, '내용 없음')),
    );
    // 대문자 오류 코드(TIMEOUT 등)는 조회 실패 알림이므로 사용자가 할 일을 함께 적습니다.
    if (/^[A-Z][A-Z0-9_]*$/.test(code)) item.append(node('p', `할 일: 연결 상태를 확인하세요. ${RETRY_TEXT}`));
    list.append(item);
  }
  wrap.append(list);
  return wrap;
}

function diagnosticsCopyText(data) {
  const picked = {};
  for (const [name, read] of DIAGNOSTIC_FIELDS) picked[name] = safeDiagnosticValue(read(data));
  return JSON.stringify(picked, null, 2);
}

function statusDiagnostics(resource) {
  const safe = isObject(resource) ? resource : {};
  const ok = safe.status === 'ok' && isObject(safe.data);
  const part = statusPart('도움정보(연결 점검)', 'student-status-diagnostics', resource, '도움정보', (data) => {
    if (!isObject(data)) return node('p', '확인 불가: 도움정보 형식이 예상과 다릅니다.', 'state state-empty');
    const list = node('ul');
    for (const [name, read] of DIAGNOSTIC_FIELDS) list.append(node('li', `${name}: ${safeDiagnosticValue(read(data))}`));
    return list;
  });
  if (safe.status === 'idle' || safe.status === 'loading') {
    part.append(node('p', '도움정보는 위쪽 도움정보 칸의 「도움정보 불러오기」를 사용자가 직접 눌러야 불러옵니다.', 'student-text'));
  }

  const help = node('p', '「도움정보 복사」는 강사·담당자에게 도움을 요청할 때 붙여 넣도록 위 여섯 항목(requestId·component·version·checkedAt·engine.mode·engine.code)만 클립보드에 복사합니다. 비밀번호·토큰·API 키는 넣지 않으며, 누를 때만 복사하고 어디에도 자동으로 보내지 않습니다.', 'student-text');
  help.id = `student-diag-help-${++eventFieldSeq}`;
  const result = node('p', ok ? '' : '도움정보를 불러온 뒤에 복사할 수 있습니다.', 'student-text');
  result.setAttribute('aria-live', 'polite');
  const button = node('button', '도움정보 복사');
  button.type = 'button';
  button.disabled = !ok;
  button.setAttribute('aria-describedby', help.id);
  if (ok) {
    const text = diagnosticsCopyText(safe.data);
    const preview = node('pre', text, 'student-diag-copy');
    preview.tabIndex = 0;
    preview.setAttribute('aria-label', '복사할 도움정보 내용');
    button.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(text);
        result.textContent = '도움정보 여섯 항목을 클립보드에 복사했습니다. 붙여 넣기 전에 비밀값이 없는지 직접 읽어 보세요.';
      } catch {
        result.textContent = '자동 복사를 사용할 수 없습니다. 아래 내용을 직접 선택해 복사하세요.';
        preview.focus();
      }
    });
    part.append(help, button, result, preview);
  } else {
    part.append(help, button, result);
  }
  return part;
}

function renderStatusView(input) {
  const safe = isObject(input) ? input : {};
  const root = node('section', null, 'student-status-view');
  root.dataset.testid = 'student-status-view';
  root.append(
    node('h3', '기기·세션·알림과 연결 점검'),
    modeLine({ mode: safe.mode }),
    statusPart('내 기기', 'student-status-devices', safe.devices, '기기 목록', statusDevices),
    statusPart('현재 세션', 'student-status-sessions', safe.sessions, '세션 정보', statusSessions),
    statusNotifications(safe.notifications),
    statusDiagnostics(safe.diagnostics),
    node('p', '등록 기기는 내 이름으로 등록되고 회수되지 않은 기기 최대 100개까지입니다. 운영체제처럼 서버가 모르는 값은 확인 불가로 표시합니다.', 'student-text'),
  );
  return root;
}

// ---------- 17단계 · renderAiConnection / renderExplanation(기초) ----------
// 두 함수 모두 부를 때마다 입력값만으로 새 요소를 만듭니다. 이전 점검·설명 결과를 모듈 변수에 저장하지 않으므로
// 다시 점검해 성공하면 옛 오류 안내가 사라지고, idle 이 다시 오면(계정 연결 재확인 등) 옛 결과도 사라집니다.
// 이 화면은 서버에 요청을 보내지 않고, 자동으로 다시 점검하지 않습니다. 열쇠·원문 오류는 입력에 없고 화면에도 쓰지 않습니다.

const AI_MANUAL_RETRY = '이 화면은 자동으로 다시 점검하지 않습니다. 다시 점검은 위쪽 「AI 연결 점검」 또는 「현재 API 연결 점검」 버튼을 직접 누르세요.';

const AI_AUTHORIZATION_TEXT = {
  test: '시험 연결 점검(test)',
  verified: '앱 권한 확인 후 점검(verified)',
};

// error.code 를 원인 묶음으로 나눕니다. 표에 없는 코드는 "확인 불가"로 다루고 성공으로 보지 않습니다.
const AI_ERROR_GROUPS = [
  { kind: 'provisioning', title: '권한 준비 중·확인 불가', guide: '학생 잘못이 아닙니다. 담당자에게 계정 연결과 앱 권한 확인을 요청하세요.',
    codes: ['ON_AI_PROVISIONING_PENDING', 'ON_AI_TRANSPORT_PENDING', 'ON_AI_AUTHORIZATION_CHANGED', 'AI_REQUEST_UNVERIFIED', 'SUBJECT_SCOPE_UNVERIFIED', 'ON_AI_INVALID_INPUT', 'ON_AI_INVALID_OUTPUT', 'WB_CLCO_INVALID_RESPONSE', 'WB_CLCO_INVALID_CONTENT_TYPE', 'WB_CLCO_RESPONSE_TOO_LARGE', 'WB_CLCO_REDIRECT_BLOCKED'] },
  { kind: 'auth', title: '인증 실패', guide: '보호 현황의 계정 연결을 다시 확인하고, 계속되면 담당자에게 확인하세요. Workbench 열쇠나 AI 회사 원본 열쇠를 붙여 넣지 마세요.',
    codes: ['WB_CLCO_AUTH_REQUIRED'] },
  { kind: 'blocked', title: '접근 제한', guide: '계정 연결을 다시 확인하고, 운영 중지 여부와 이용 권한을 담당자에게 확인하세요.',
    codes: ['WB_CLCO_ACCESS_BLOCKED'] },
  { kind: 'limits', title: '반 사용량·이용 한도 초과', guide: '반 사용량이나 이용 한도는 담당자가 조정합니다. 담당자에게 확인하세요.',
    codes: ['WB_CLCO_COHORT_BUDGET_EXHAUSTED', 'WB_CLCO_LIMIT_REACHED'] },
  { kind: 'session', title: '이용 시간 아님', guide: 'AI 이용 시간을 확인한 뒤 직접 다시 점검하세요.',
    codes: ['WB_CLCO_SESSION_CLOSED'] },
  { kind: 'retry', title: '요청 제한·시간 초과·네트워크 오류', guide: '잠시 뒤 직접 다시 점검하세요.',
    codes: ['WB_CLCO_RATE_LIMITED', 'WB_CLCO_TIMEOUT', 'REQUEST_TIMEOUT', 'ENGINE_TIMEOUT', 'TIMEOUT', 'NETWORK_ERROR', 'SERVER_UNAVAILABLE'] },
  { kind: 'cancelled', title: '취소됨', guide: '점검을 취소했습니다. 이전 점검 결과는 현재 결과가 아닙니다.',
    codes: ['CANCELLED', 'REQUEST_CANCELLED', 'WB_CLCO_CANCELLED'] },
  { kind: 'no-model', title: '쓸 수 있는 모델 없음', guide: '담당자에게 모델 허용 설정 확인을 요청하세요.',
    codes: ['ON_AI_MODEL_LIST_EMPTY', 'MODEL_NOT_CONFIGURED'] },
];

const AI_UNKNOWN_GROUP = { kind: 'unverified', title: '확인 불가', guide: '원인을 확인할 수 없습니다. 성공으로 보지 말고 담당자에게 계정 연결과 앱 권한 확인을 요청하세요.' };

function aiErrorGroup(code) {
  return AI_ERROR_GROUPS.find((group) => group.codes.includes(code)) || AI_UNKNOWN_GROUP;
}

// 서버가 정리해 준 안내 문장만 보여 주고, 비밀값처럼 보이거나 너무 긴 값은 가립니다.
function safeAiMessage(message) {
  if (typeof message !== 'string' || message.trim() === '') return '서버가 안내 문장을 보내지 않았습니다.';
  if (SECRET_LIKE.test(message)) return '[가림: 비밀값으로 보이는 내용이 있어 표시하지 않습니다]';
  return message.length > 300 ? `${message.slice(0, 300)}…` : message;
}

// AI 요약은 보안 용어(token 등)를 담을 수 있어, 실제 열쇠 모양 값만 가립니다.
const KEY_LIKE = /(sk-[A-Za-z0-9_-]{8,}|bearer\s+[A-Za-z0-9._~+/-]{8,}|eyJ[A-Za-z0-9_-]{10,}\.)/i;
function safeSummary(summary) {
  if (KEY_LIKE.test(summary)) return '[가림: 열쇠로 보이는 값이 있어 표시하지 않습니다]';
  return summary.length > 1500 ? `${summary.slice(0, 1500)}…` : summary;
}

function aiStateBox(status, tone, lines) {
  const box = node('div', null, `state state-${tone}`);
  box.dataset.aiStatus = status;
  for (const line of lines) box.append(typeof line === 'string' ? node('p', line) : line);
  return box;
}

function aiConnectionOk(safe) {
  const data = isObject(safe.data) ? safe.data : {};
  const authorization = data.audienceAuthorization;
  if (data.transportChecked !== true || !Object.hasOwn(AI_AUTHORIZATION_TEXT, authorization)) {
    return aiStateBox('unverified', 'empty', [
      '확인 불가: 점검 응답 형식이 예상과 달라 연결 결과로 보지 않습니다.',
      AI_UNKNOWN_GROUP.guide,
      AI_MANUAL_RETRY,
    ]);
  }
  const box = aiStateBox('ok', 'ok', [
    `점검 결과: ${AI_AUTHORIZATION_TEXT[authorization]}`,
    authorization === 'test'
      ? '시험 연결로 모델 응답만 확인했습니다. 앱 권한 확인이나 실제 사건 설명 수용은 아닙니다.'
      : '점검 시각 기준으로 앱 권한 확인과 모델 응답을 확인했습니다.',
  ]);
  box.dataset.audienceAuthorization = authorization;
  const count = Number.isInteger(data.modelCount) && data.modelCount >= 0 ? `${data.modelCount}개` : '확인 불가';
  box.append(
    fieldLine('응답 모델 수(modelCount)', count),
    fieldLine('점검 시각(checkedAt)', formatCheckedAt(safe.checkedAt)),
  );
  if (safe.mode === 'demo') box.append(node('p', '예제 응답(demo)입니다. 실제 게이트 연결 결과가 아닙니다.', 'tag tag-demo'));
  const notice = node('p', '연결만 점검했습니다. 사건 설명은 아직 실행하지 않았습니다. 모델 목록 응답은 사건 설명 결과가 아니며, 사건 설명은 보안 기록에서 사건을 골라 따로 요청하고 확인합니다.', 'student-text');
  notice.dataset.testid = 'student-ai-no-explanation';
  box.append(notice, node('p', `사건 설명 수용 여부(explanationAccepted): ${safe.explanationAccepted === true ? '예' : '아니요'}`));
  return box;
}

function aiConnectionError(safe) {
  const error = isObject(safe.error) ? safe.error : {};
  const code = safeCode(error.code);
  const group = aiErrorGroup(error.code);
  const box = aiStateBox('error', group.kind === 'cancelled' ? 'empty' : 'error', [
    `${group.title}: AI 연결을 확인하지 못했습니다.`,
    fieldLine('오류 코드(code)', code),
    fieldLine('안내(message)', safeAiMessage(error.message)),
    `할 일: ${group.guide}`,
    '이전 점검 결과는 지웠습니다. 지금 화면은 현재 점검 결과만 보여 줍니다.',
    AI_MANUAL_RETRY,
  ]);
  box.dataset.aiErrorKind = group.kind;
  box.setAttribute('role', 'alert');
  return box;
}

function renderAiConnectionView(input) {
  const safe = isObject(input) ? input : {};
  const root = node('section', null, 'student-ai-connection-view');
  root.dataset.testid = 'student-ai-connection-view';
  root.append(node('h3', 'AI 연결 점검 결과'), modeLine({ mode: safe.mode }));
  if (safe.status === 'idle') {
    root.append(aiStateBox('idle', 'empty', [
      'AI 연결 점검 전',
      '아직 점검하지 않았습니다. 이전 점검 결과가 있었다면 지웠습니다. 설정값이 있다는 것만으로 이용 권한이 확인된 것은 아닙니다.',
      AI_MANUAL_RETRY,
    ]));
  } else if (safe.status === 'loading') {
    root.append(aiStateBox('loading', 'loading', [
      'AI 연결 점검 중',
      '앱 서버를 통해 모델 응답을 점검하고 있습니다. 「AI 연결 점검 취소」를 누르면 늦게 온 응답은 표시하지 않습니다.',
    ]));
  } else if (safe.status === 'ok') {
    root.append(aiConnectionOk(safe));
  } else if (safe.status === 'error') {
    root.append(aiConnectionError(safe));
  } else {
    root.append(aiStateBox('unverified', 'empty', ['확인 불가: 점검 상태를 알 수 없습니다. 성공으로 보지 않습니다.', AI_MANUAL_RETRY]));
  }
  return root;
}

// renderExplanation 기초: 성공일 때만 바깥 요소에 data-student-explanation-event 를 붙입니다(18단계에서 넓힘).
function renderExplanationView(input) {
  const safe = isObject(input) ? input : {};
  const event = isObject(safe.event) ? safe.event : null;
  const explanation = isObject(safe.explanation) ? safe.explanation : {};
  const eventId = event && typeof event.id === 'string' && /^[A-Za-z0-9_.:-]{1,128}$/.test(event.id) ? event.id : null;
  const root = node('section', null, 'student-explanation-view');
  root.dataset.testid = 'student-explanation-view';
  root.append(node('h3', 'AI 사건 설명'));

  if (explanation.status === 'ok') {
    const summary = isObject(explanation.data) ? explanation.data.summary : null;
    if (eventId && typeof summary === 'string' && summary.trim() !== '') {
      root.dataset.studentExplanationEvent = eventId;
      root.append(
        node('p', '사건 설명 결과: 선택한 사건에 대해 AI가 설명을 돌려주었습니다(참고용).', 'state state-ok'),
        fieldLine('사건 ID', eventId),
        fieldLine('AI 요약', safeSummary(summary)),
        fieldLine('설명 시각(checkedAt)', formatCheckedAt(safe.checkedAt)),
      );
      if (explanation.mode === 'demo') root.append(node('p', '예제 응답(demo)입니다. 실제 게이트 결과가 아닙니다.', 'tag tag-demo'));
      root.append(node('p', '요약은 AI의 해석입니다. 사실 판단은 보안 기록의 근거를 기준으로 하세요. 조치는 자동 실행하지 않습니다.', 'student-text'));
      return root;
    }
    root.append(node('p', '확인 불가: 설명 응답에 사건 ID나 요약이 없어 결과로 보지 않습니다. 보안 기록은 그대로 유지됩니다.', 'state state-empty'));
    return root;
  }
  if (explanation.status === 'error') {
    const error = isObject(explanation.error) ? explanation.error : {};
    const group = aiErrorGroup(error.code);
    const box = aiStateBox('error', group.kind === 'cancelled' ? 'empty' : 'error', [
      `AI 설명 실패(${group.title})`,
      fieldLine('오류 코드(code)', safeCode(error.code)),
      fieldLine('안내(message)', safeAiMessage(error.message)),
      eventId ? fieldLine('대상 사건 ID', eventId) : '대상 사건: 확인 불가',
      '보안 기록은 그대로 유지됩니다. 필요하면 보안 기록에서 설명 요청을 직접 다시 누르세요.',
    ]);
    box.setAttribute('role', 'alert');
    root.append(box);
    return root;
  }
  if (explanation.status === 'loading') {
    root.append(node('p', `AI 설명 요청 중${eventId ? `: 사건 ${eventId}` : ''}. 아직 결과가 아닙니다.`, 'state state-loading'));
    return root;
  }
  root.append(node('p', '사건 설명 전: 보안 기록에서 사건을 골라 AI 설명을 직접 요청하세요. AI 연결 점검만으로는 사건 설명이 실행되지 않습니다.', 'state state-empty'));
  return root;
}

export function createStudentView() {
  return {
    renderIdentity(input) { return renderIdentityView(input); },
    renderDecision(input) { return renderDecisionView(input); },
    renderEvents(input) { return renderEventsView(input); },
    renderStatus(input) { return renderStatusView(input); },
    renderVulnerabilities() { return '학생 구현 대기: 정확한 설치 버전·OSV 출처·조회 시각·부분 결과·조회 실패를 구분하세요.'; },
    renderAiConnection(input) { return renderAiConnectionView(input); },
    renderExplanation(input) { return renderExplanationView(input); },
    renderAction() { return '학생 구현 대기: 현재 사건·조치·실제 대상·사람 확인·ACK와 원천 효과·unknown을 구분하세요.'; },
  };
}
