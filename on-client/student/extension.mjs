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

export function createStudentView() {
  return {
    renderIdentity(input) { return renderIdentityView(input); },
    renderDecision(input) { return renderDecisionView(input); },
    renderEvents() { return '학생 구현 대기: 본인 접속·XDR 기록을 연결하세요.'; },
    renderStatus() { return '학생 구현 대기: 기기·세션·알림과 연결 점검 상태를 구분하세요.'; },
    renderVulnerabilities() { return '학생 구현 대기: 정확한 설치 버전·OSV 출처·조회 시각·부분 결과·조회 실패를 구분하세요.'; },
    renderAiConnection() { return '학생 구현 대기: 모델 응답 점검과 실제 사건 설명을 구분하고 AI 오류·취소·수동 복구를 안내하세요.'; },
    renderExplanation() { return '학생 구현 대기: 선택한 사건의 근거·규칙·현재 상태와 AI 설명을 연결하세요. 제안은 자동 실행하지 않습니다.'; },
    renderAction() { return '학생 구현 대기: 현재 사건·조치·실제 대상·사람 확인·ACK와 원천 효과·unknown을 구분하세요.'; },
  };
}
