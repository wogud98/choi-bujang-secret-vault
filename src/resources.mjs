// 8단계: 자료실의 자원을 구역(service)으로 나누고, 요청마다 서버가 구별할 수 있는 자원 ID를 붙입니다.
// 자원 ID 모양은 '<구역>:<자료 ID>'입니다. 예: 'notes:3f0c…'(내 메모), 'notices:notice-01'(강사 공지).
// 구역 이름은 판정기(src/decider.mjs)의 service 이름과 같습니다.
export const ZONES = Object.freeze({ notes: 'notes', notices: 'notices', materials: 'materials' });

export function resourceId(zone, id) {
  if (!Object.values(ZONES).includes(zone) || typeof id !== 'string' || !id) {
    throw new TypeError('invalid_resource');
  }
  return `${zone}:${id}`;
}

// 강사 공지는 반 전체에 공개되는 가상 자료입니다. 실명·실제 일정·개인정보는 넣지 않습니다.
// 공지 수정은 이 목록을 고치는 서버 쪽 관리 작업으로만 하고, 자료 API에는 쓰기 경로를 두지 않습니다.
export const NOTICES = Object.freeze([
  Object.freeze({ id: 'notice-01', title: '[가상 공지] 다음 실습 준비', body: '실습 전에 자기 자료실에 로그인되는지 확인해 주세요.' }),
  Object.freeze({ id: 'notice-02', title: '[가상 공지] 제출 묶음 안내', body: '제출 묶음에는 비밀번호·토큰·메모 본문을 넣지 않습니다.' }),
]);
