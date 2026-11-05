// 9단계 탐지 함수입니다. 사건 형식은 docs/DETECT_EVENTS.md(로컬 연습용)를 따릅니다.
// 반 엔진이 검증한 사건만 전달해야 하며, 브라우저가 보낸 사용자 번호는 받지 않습니다.
// 사건마다 at(시각)·method(요청 종류)·identity.sub(가명 사용자) 세 값만 읽습니다.
// 네트워크·기기·지역 값은 만들지도 쓰지도 않고, 메모 내용·토큰·실명은 저장하거나 출력하지 않습니다.

const WINDOW_MS = 10 * 60 * 1000; // 10분 구간
const BURST_LIMIT = 120; // 120건까지는 정상, 넘으면 의심

/**
 * 사건 하나에서 세 값만 꺼냅니다. 형식이 맞지 않으면 null을 돌려 계산에서 뺍니다.
 * @param {unknown} event 가상 조회 사건 { at, method, identity: { sub } }
 * @returns {{at: number, method: string, sub: string} | null}
 */
function readEvent(event) {
  if (!event || typeof event !== 'object') return null;
  const { at, method, identity } = event;
  const sub = identity && typeof identity === 'object' ? identity.sub : undefined;
  if (typeof at !== 'string' || typeof method !== 'string' || typeof sub !== 'string' || !sub) return null;
  const time = Date.parse(at);
  if (!Number.isFinite(time)) return null;
  return { at: time, method, sub };
}

/**
 * burst_read: 같은 sub의 GET 사건이 어느 10분 구간에서든 120건을 넘는지 봅니다.
 * 사용자별로 시각만 정렬해 두 지점(창 시작·끝)을 옮기며 셉니다.
 * @param {{at: number, method: string, sub: string}[]} reads 세 값만 남긴 사건 목록
 * @returns {string | null} 처음 걸린 sub, 없으면 null
 */
function findBurstReader(reads) {
  const bySub = new Map();
  for (const item of reads) {
    if (item.method !== 'GET') continue;
    if (!bySub.has(item.sub)) bySub.set(item.sub, []);
    bySub.get(item.sub).push(item.at);
  }
  for (const [sub, times] of bySub) {
    times.sort((a, b) => a - b);
    let start = 0;
    for (let end = 0; end < times.length; end += 1) {
      while (times[end] - times[start] >= WINDOW_MS) start += 1;
      if (end - start + 1 > BURST_LIMIT) return sub;
    }
  }
  return null;
}

/**
 * 가상 조회 사건 묶음을 보고 회수 제안 여부를 돌려줍니다.
 * @param {unknown[]} events 가상 조회 사건 배열
 * @returns {{action: 'observe'} | {action: 'propose_revocation', reasonCode: 'burst_read', subject: string}}
 */
export function detect(events) {
  if (!Array.isArray(events)) throw new TypeError('invalid_detection_events');
  const reads = events.map(readEvent).filter(Boolean);
  const subject = findBurstReader(reads);
  if (subject) return { action: 'propose_revocation', reasonCode: 'burst_read', subject };
  return { action: 'observe' };
}
