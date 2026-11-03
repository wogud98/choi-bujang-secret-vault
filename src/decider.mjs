// ALEPH SDP 엔진이 확인한 요청만 받는 학생 판정기 시작점입니다.
// 6단계부터 규칙을 하나씩 추가합니다. 규칙에 맞지 않는 요청은 모두 거부합니다.
// 요청 본문의 userId, role, 기기 키, 토큰을 별도로 믿거나 저장하지 마세요.
// docs/DECIDER_REQUEST.md 계약에 있는 이름(requestId, subjectId, deviceRegistered,
// service, method, route)만 읽습니다.
export const RULE_IDS = Object.freeze(['starter.deny', 'device_registered']);

// 내 자료실 읽기 경로. route는 엔진이 확인한 허용 경로 모양입니다.
const NOTE_READ_ROUTES = Object.freeze(['GET /notes', 'GET /notes/:id']);

function respond(request, decision, reasonCode, ruleId) {
  return {
    schema: 'aleph.decision.v1',
    requestId: request?.requestId,
    decision,
    reasonCode,
    ruleIds: [ruleId],
  };
}

// 로그인한 주체가 내 자료실을 읽는 요청인지 봅니다.
function isMyNoteRead(request) {
  return typeof request?.subjectId === 'string' && request.subjectId.length > 0
    && request.service === 'notes' && request.method === 'GET'
    && NOTE_READ_ROUTES.includes(request.route);
}

export async function decide(request) {
  // device_registered: 등록된 기기일 때만 내 자료실 읽기를 허용합니다.
  // 미등록이거나 값이 없으면(true가 아니면) 거부합니다.
  if (request?.deviceRegistered !== true) {
    return respond(request, 'deny', 'device_not_registered', 'device_registered');
  }
  if (isMyNoteRead(request)) {
    return respond(request, 'allow', 'approved', 'device_registered');
  }
  // 그 밖의 요청은 시작 틀의 기본 거부 그대로입니다.
  return respond(request, 'deny', 'starter_not_ready', 'starter.deny');
}
