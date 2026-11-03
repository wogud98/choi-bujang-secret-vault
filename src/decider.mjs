// ALEPH SDP 엔진이 확인한 요청만 받는 학생 판정기 시작점입니다.
// 6단계부터 규칙을 하나씩 추가합니다. 규칙에 맞지 않는 요청은 모두 거부합니다.
// 요청 본문의 userId, role, 기기 키, 토큰을 별도로 믿거나 저장하지 마세요.
// docs/DECIDER_REQUEST.md 계약에 있는 이름(requestId, subjectId, deviceRegistered,
// service, method, path, route, queryLength, signals, recentEvents, stepUp)만 읽습니다.
export const RULE_IDS = Object.freeze(['starter.deny', 'device_registered', 'step_up_required', 'resource_zone']);

// 8단계 resource_zone: 구역(service)마다 허용하는 정확한 경로 모양(route)과 실제 경로(path) 모양입니다.
// - notes(내 메모): 자료 ID 하나를 고르는 /notes/:id만 허용합니다. ID 없는 전체 목록 GET /notes는 거부합니다.
//   메모 주인 비교는 판정기가 아니라 자료 API(api/notes.js)가 합니다. 심판의 가상 ID가 UUID가 아닐 수 있어 ID 형식은 좁히지 않습니다.
// - notices(반 공지): 읽기(GET)만 허용합니다. 쓰기(POST·PUT·PATCH·DELETE)는 누구에게나 거부합니다.
//   판정기 요청에는 역할이 없으므로 강사의 공지 수정은 서버의 관리 작업에서 처리합니다.
// - materials(강사 자료): 판정기에서 모두 거부합니다.
// 쿼리로 기능을 고르지 않으므로 쿼리가 붙은 요청은 거부합니다. :id와 같은 깊이에 export 같은 기능 경로는 두지 않습니다.
const ONE_SEGMENT = /^[^/]+$/u;
const ZONE_ROUTES = Object.freeze({
  notes: Object.freeze({
    'GET /notes/:id': '/notes/',
    'PUT /notes/:id': '/notes/',
    'DELETE /notes/:id': '/notes/',
  }),
  notices: Object.freeze({
    'GET /notices': '/notices',
    'GET /notices/:id': '/notices/',
  }),
  materials: Object.freeze({}),
});

// 엔진이 검증해 넘기는 접속 정보의 출처. 'none'은 실제 경로(접속 정보 없음),
// 'judge_fixture'는 심판의 가상 사건입니다. 그 밖의 출처는 믿지 않습니다.
const SIGNAL_SOURCES = Object.freeze(['none', 'judge_fixture']);
const NETWORK_VALUES = Object.freeze(['usual', 'unusual', 'unknown']);

function respond(request, decision, reasonCode, ...ruleIds) {
  return {
    schema: 'aleph.decision.v1',
    requestId: request?.requestId,
    decision,
    reasonCode,
    ruleIds,
  };
}

const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

// 요청이 어느 구역의 어느 경로인지 봅니다.
// 'unknown': 모르는 구역 · 'denied': 아는 구역이지만 허용하지 않은 경로 · 'allowed': 허용 경로
// route는 계약대로 '<method> <경로 모양>'이어야 하고, path는 그 모양과 깊이까지 같아야 합니다.
function zoneOf(request) {
  const service = request?.service;
  if (typeof service !== 'string' || !hasOwn(ZONE_ROUTES, service)) return 'unknown';
  const routes = ZONE_ROUTES[service];
  const route = request.route;
  if (typeof route !== 'string' || typeof request.method !== 'string'
      || !route.startsWith(`${request.method} `) || !hasOwn(routes, route)) return 'denied';
  if (request.queryLength !== 0) return 'denied';
  const prefix = routes[route];
  const path = request.path;
  if (typeof path !== 'string') return 'denied';
  if (!route.endsWith('/:id')) return path === prefix ? 'allowed' : 'denied';
  return path.startsWith(prefix) && ONE_SEGMENT.test(path.slice(prefix.length)) ? 'allowed' : 'denied';
}

const hasSubject = request => typeof request?.subjectId === 'string' && request.subjectId.length > 0;

const isPlainObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);

// 입력 검사: request.signals를 출처별로 구분합니다.
// 출처가 'judge_fixture'이고 시각·네트워크가 계약 모양일 때만 { trusted: true }입니다.
// 출처가 없거나 모르는 값이면, 값이 빠졌으면, 실제 경로('none')이면 trusted: false이고
// 빠진 값을 정상값으로 채우지 않습니다(network는 'unknown', hour는 null).
// region은 브라우저 위치일 수 있어 판정 근거로 쓰지 않으므로 읽지 않습니다.
export function readSignals(request) {
  const raw = request?.signals;
  const source = isPlainObject(raw) && SIGNAL_SOURCES.includes(raw.source) ? raw.source : 'untrusted';
  if (source !== 'judge_fixture') return { source, trusted: false, network: 'unknown', hour: null };
  const network = NETWORK_VALUES.includes(raw.network) ? raw.network : null;
  const hour = Number.isInteger(raw.hour) && raw.hour >= 0 && raw.hour <= 23 ? raw.hour : null;
  if (network === null || hour === null) return { source: 'untrusted', trusted: false, network: 'unknown', hour: null };
  return { source, trusted: true, network, hour };
}

// 입력 검사: request.recentEvents는 최대 12건의 {kind, ageSeconds, count}만 셉니다.
// 모양이 틀린 배열은 통째로 믿지 않고(null), 빈 사건으로 바꿔 채우지 않습니다.
export function readRecentEvents(request) {
  const raw = request?.recentEvents;
  if (!Array.isArray(raw) || raw.length > 12) return null;
  const ok = raw.every(item => isPlainObject(item) && typeof item.kind === 'string' && item.kind.length > 0
    && Number.isInteger(item.ageSeconds) && item.ageSeconds >= 0
    && Number.isInteger(item.count) && item.count >= 0);
  return ok ? raw : null;
}

// 입력 검사: 엔진이 확인한 다시 로그인 상태. verified가 true이고 나이가 0~900초 정수일 때만 확인된 것으로 봅니다.
export function readStepUp(request) {
  const raw = request?.stepUp;
  if (!isPlainObject(raw) || raw.verified !== true) return { verified: false, authAgeSeconds: null };
  const age = raw.authAgeSeconds;
  if (!Number.isInteger(age) || age < 0 || age > 900) return { verified: false, authAgeSeconds: null };
  return { verified: true, authAgeSeconds: age };
}

// step_up_required 기준. 지역(region)은 쓰지 않으므로 지역 하나로는 걸리지 않습니다.
const USUAL_HOUR_START = 7; // 07:00부터
const USUAL_HOUR_END = 23; // 23:00 전까지가 평소 시각
const BURST_WINDOW_SECONDS = 600; // 최근 10분
const BURST_MIN_COUNT = 10; // 그 안에 10건 이상이면 갑자기 많이 읽은 것으로 봄
const FRESH_LOGIN_SECONDS = 300; // 다시 로그인한 지 5분 이내만 새 로그인으로 인정

// 평소와 다른 시각 + 처음 보는 네트워크 + 최근 10분 안의 많은 사건이 모두 겹치는지 봅니다.
// 엔진이 검증한 가상 사건(trusted)일 때만 판단하고, 근거가 없으면 이상으로도 정상으로도 꾸미지 않습니다.
function isUnusualBurst(request) {
  const signals = readSignals(request);
  if (!signals.trusted) return false;
  const unusualHour = signals.hour < USUAL_HOUR_START || signals.hour >= USUAL_HOUR_END;
  const newNetwork = signals.network === 'unusual';
  const events = readRecentEvents(request) ?? [];
  const recentCount = events.filter(item => item.ageSeconds <= BURST_WINDOW_SECONDS)
    .reduce((sum, item) => sum + item.count, 0);
  return unusualHour && newNetwork && recentCount >= BURST_MIN_COUNT;
}

export async function decide(request) {
  // device_registered: 등록된 기기일 때만 자료실에 들어옵니다.
  // 미등록이거나 값이 없으면(true가 아니면) 거부합니다.
  if (request?.deviceRegistered !== true) {
    return respond(request, 'deny', 'device_not_registered', 'device_registered');
  }
  // resource_zone: 구역별 정확한 경로만 통과합니다. 모르는 구역은 시작 틀의 기본 거부입니다.
  const zone = zoneOf(request);
  if (zone === 'unknown' || !hasSubject(request)) {
    return respond(request, 'deny', 'starter_not_ready', 'starter.deny');
  }
  if (zone !== 'allowed') {
    return respond(request, 'deny', 'resource_zone_denied', 'resource_zone');
  }
  // step_up_required: 복합 이상 접속은 차단하지 않고 엔진에 다시 로그인 확인을 요청합니다.
  // 엔진이 확인한 새 로그인(5분 이내)이 있을 때만 같은 요청을 다시 판정해 허용합니다.
  if (isUnusualBurst(request)) {
    const stepUp = readStepUp(request);
    if (stepUp.verified && stepUp.authAgeSeconds <= FRESH_LOGIN_SECONDS) {
      return respond(request, 'allow', 'approved', 'step_up_required', 'resource_zone');
    }
    return respond(request, 'step_up', 'step_up_required', 'step_up_required');
  }
  return respond(request, 'allow', 'approved', 'device_registered', 'resource_zone');
}
