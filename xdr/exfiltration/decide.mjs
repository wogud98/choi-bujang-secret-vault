// 자료 빼돌리기(처음 보는 목적지로 가는 대용량 전송·업무 시간 밖 압축 반출) 판단 모듈입니다. 심판은 인터넷 없이 이 파일 하나만 불러옵니다.
// import 없이, 파일을 읽거나 쓰지 않고, 바깥에 묻지 않고 경보 하나만 보고 계산합니다.
// 알림 기록과 판정기 연결은 respond.mjs 가 합니다. 이 파일은 판단 결과만 돌려줍니다.

/**
 * 객체와 그 안의 배열·객체를 모두 바꿀 수 없게 얼립니다.
 * @param {object} value 얼릴 값
 * @returns {object} 얼린 같은 값
 */
function deepFreeze(value) {
  if (value && typeof value === 'object') {
    for (const v of Object.values(value)) deepFreeze(v);
    Object.freeze(value);
  }
  return value;
}

// xdr/exfiltration/patterns.json 의 값을 그대로 옮겨 적은 상수입니다. 두 곳을 함께 고칩니다.
// 평소 목적지(자료실·수업 자료 주소)입니다. 이 주소로 가는 전송은 처음 보는 목적지로 보지 않습니다.
const KNOWN_DESTINATIONS = deepFreeze([
  "192.0.2.10",
  "198.51.100.10"
]);

const PATTERNS = deepFreeze([
  {
    "name": "outbound_transfer",
    "technique": "T1041, T1048",
    "condition": {
      "mitreAny": [
        "T1041",
        "T1048"
      ],
      "minLevel": 5,
      "clearLevel": 12,
      "baseConfidence": 0.5,
      "levelWeight": 0.15
    },
    "evidence": "T1041·T1048: 명령 통로나 다른 프로토콜로 자료를 밖으로 보내는 것이 유출의 기본 모양이라, 수준 5 이상의 외부 전송 경보는 모두 사람 확인 대상으로 올립니다."
  },
  {
    "name": "large_transfer",
    "technique": "T1048",
    "condition": {
      "minBytes": 50000000,
      "bonus": 0.2
    },
    "evidence": "T1048: 공격자는 한 번에 많은 자료를 옮기려 하므로, 한 경보에서 50MB 이상이 나간 전송은 평소 메모 읽기·저장(수 KB)과 뚜렷이 다릅니다."
  },
  {
    "name": "first_seen_destination",
    "technique": "T1048",
    "condition": {
      "descriptionAny": [
        "처음 보는",
        "외부 주소",
        "평소와 다른",
        "다른 주소"
      ],
      "orUnknownDestination": true,
      "bonus": 0.05
    },
    "evidence": "T1048: 유출은 공격자가 마련한 바깥 서버로 가므로, 자료실·수업 자료 주소가 아닌 처음 보는 목적지는 유출 신호입니다."
  },
  {
    "name": "bulk_or_repeated_transfer",
    "technique": "T1041, T1030",
    "condition": {
      "filesAtLeast": 50,
      "countAtLeast": 5,
      "bonus": 0.1
    },
    "evidence": "T1041(T1030 자료 나눠 보내기 포함): 자료 수십 건을 한꺼번에, 또는 같은 목적지로 여러 번 나눠 보내는 것은 대량 반출의 흔적입니다."
  },
  {
    "name": "off_hours_archive_export",
    "technique": "T1048, T1560",
    "condition": {
      "descriptionAny": [
        "시간 밖",
        "압축 파일"
      ],
      "bonus": 0.1
    },
    "evidence": "T1048(T1560 자료 압축 포함): 공격자는 자료를 압축해 한 덩어리로 만들고 사람이 덜 보는 업무 시간 밖에 내보내곤 합니다."
  },
  {
    "name": "small_or_unconfirmed_transfer",
    "technique": "T1041, T1048",
    "condition": {
      "belowBytes": 50000000,
      "maxConfidence": 0.8
    },
    "evidence": "T1041·T1048: 50MB 미만의 작은 전송·실패한 전송·아직 나가지 않은 압축은 정상 백업·과제 제출과 구분이 어려워, 차단하지 않고 최대 확신도 0.8로 알림만 남깁니다."
  }
]);

const BLOCK_AT = 0.85;
const ALERT_AT = 0.5;
const BY_NAME = Object.freeze(Object.fromEntries(PATTERNS.map((p) => [p.name, p])));
const SIGNAL_NAMES = Object.freeze(['large_transfer', 'first_seen_destination', 'bulk_or_repeated_transfer', 'off_hours_archive_export']);

/**
 * 값을 0 이상 1 이하로 자릅니다.
 * @param {number} n 자를 숫자
 * @returns {number} 0~1 사이 값
 */
const clamp01 = (n) => Math.min(1, Math.max(0, n));

/**
 * 소수 둘째 자리까지 반올림합니다.
 * @param {number} n 반올림할 숫자
 * @returns {number} 반올림한 숫자
 */
const round2 = (n) => Math.round(n * 100) / 100;

/**
 * 문자열 숫자를 0 이상의 정수로 바꿉니다. 숫자가 아니면 0 입니다.
 * @param {unknown} v 바꿀 값(경보의 bytes·files·count 칸)
 * @returns {number} 바꾼 숫자
 */
function toCount(v) {
  const n = Number.parseInt(String(v ?? ''), 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * 경보 하나에서 판단에 쓰는 신호(수준·기법·설명·목적지·전송량·파일 수·반복 수)만 꺼냅니다.
 * @param {object} alert Wazuh 모양 경보 하나
 * @returns {{level: number, mitre: string[], description: string, dstip: string, bytes: number, files: number, count: number}} 꺼낸 신호
 */
function readSignals(alert) {
  const rule = alert?.rule ?? {};
  const data = alert?.data ?? {};
  return {
    level: Number(rule.level) || 0,
    mitre: Array.isArray(rule.mitre) ? rule.mitre.filter((m) => typeof m === 'string') : [],
    description: typeof rule.description === 'string' ? rule.description : '',
    dstip: typeof data.dstip === 'string' ? data.dstip : '',
    bytes: toCount(data.bytes),
    files: toCount(data.files),
    count: toCount(data.count),
  };
}

/**
 * 패턴 하나의 조건이 경보 신호와 맞는지 봅니다.
 * @param {object} pattern PATTERNS 의 패턴 하나
 * @param {object} s readSignals 가 꺼낸 신호
 * @returns {boolean} 조건이 모두 맞으면 true
 */
function matches(pattern, s) {
  const c = pattern.condition;
  if (c.mitreAny && !s.mitre.some((m) => c.mitreAny.some((t) => m === t || m.startsWith(`${t}.`)))) return false;
  if (c.minBytes !== undefined && s.bytes < c.minBytes) return false;
  if (c.belowBytes !== undefined && s.bytes >= c.belowBytes) return false;
  if (c.filesAtLeast !== undefined || c.countAtLeast !== undefined) {
    if (!(s.files >= (c.filesAtLeast ?? Infinity) || s.count >= (c.countAtLeast ?? Infinity))) return false;
  }
  if (c.descriptionAny) {
    const byText = c.descriptionAny.some((w) => s.description.includes(w));
    const byDestination = Boolean(c.orUnknownDestination && s.dstip && !KNOWN_DESTINATIONS.includes(s.dstip));
    if (!byText && !byDestination) return false;
  }
  return true;
}

/**
 * 경보 하나를 패턴과 맞춰 차단(block)·알림(alert)·기록(record) 가운데 하나로 판단합니다.
 * 확신도 0.85 이상은 block, 0.5 이상은 alert, 그 아래는 record 입니다.
 * @param {object} alert Wazuh 모양 경보 하나(xdr/fixtures/exfiltration.json 의 alerts 항목)
 * @returns {{action: 'block'|'alert'|'record', confidence: number, reason: string}} 판단, 확신도(0~1), 근거 패턴 이름 한 줄
 */
export function decide(alert) {
  const s = readSignals(alert);
  const base = BY_NAME.outbound_transfer;
  const b = base.condition;

  if (!matches(base, s) || s.level < b.minLevel) {
    // 외부 전송 표시가 없거나, 메모 읽기·작은 동기화처럼 수준이 낮은 정상 사건입니다.
    return { action: 'record', confidence: 0.05, reason: '맞는 패턴 없음: 정상 사건으로 기록' };
  }

  const matched = [base];
  const levelScore = clamp01((s.level - b.minLevel) / (b.clearLevel - b.minLevel));
  let confidence = b.baseConfidence + b.levelWeight * levelScore;

  for (const name of SIGNAL_NAMES) {
    const p = BY_NAME[name];
    if (!matches(p, s)) continue;
    matched.push(p);
    confidence += p.condition.bonus;
  }

  const small = BY_NAME.small_or_unconfirmed_transfer;
  if (matches(small, s)) {
    matched.push(small);
    confidence = Math.min(small.condition.maxConfidence, confidence);
  }

  confidence = round2(clamp01(confidence));
  const action = confidence >= BLOCK_AT ? 'block' : confidence >= ALERT_AT ? 'alert' : 'record';
  return { action, confidence, reason: `${matched.map((p) => p.name).join(', ')} (${s.mitre.join(', ')})` };
}
