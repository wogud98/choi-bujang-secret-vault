// 알려진 취약점(CVE-2021-44228, Log4Shell) 악용 판단 모듈입니다. 심판은 인터넷 없이 이 파일 하나만 불러옵니다.
// import 없이, 파일을 읽거나 쓰지 않고, 바깥에 묻지 않고 경보 하나만 보고 계산합니다.
// 알림 기록과 판정기 연결은 respond.mjs 가 합니다. 이 파일은 판단 결과만 돌려줍니다.
// 경보 안의 원격 조회 구문은 문서용 표기입니다. 글자로만 비교하고 따라가거나 실행하지 않습니다.

// xdr/known-cve/patterns.json 의 패턴을 그대로 옮겨 적은 상수입니다. 두 곳을 함께 고칩니다.
const LOOKUP_REGEX = '\\$\\{\\s*jndi\\s*:\\s*(ldaps?|rmi|dns|iiop|nis|nds|corba|https?)\\s*://';
const PATTERNS = Object.freeze([
  Object.freeze({
    name: 'jndi_lookup_in_header',
    technique: 'T1190',
    condition: Object.freeze({
      fields: Object.freeze(['useragent', 'referer', 'x_forwarded_for']),
      lookupRegex: LOOKUP_REGEX,
      baseConfidence: 0.7,
      clearLevel: 12,
      repeatAtLeast: 3,
    }),
    evidence: 'CVE-2021-44228·T1190: 요청 머리글(User-Agent 등)에 ${jndi:ldap://…} 원격 조회 구문을 넣어, 머리글을 기록하는 Log4j 가 외부 코드를 내려받게 하는 알려진 악용 형태입니다.',
  }),
  Object.freeze({
    name: 'jndi_lookup_in_argument',
    technique: 'T1190',
    condition: Object.freeze({
      fields: Object.freeze(['url']),
      lookupRegex: LOOKUP_REGEX,
      baseConfidence: 0.7,
      clearLevel: 12,
      repeatAtLeast: 3,
    }),
    evidence: 'CVE-2021-44228·T1190: 주소 인자(검색어·next 등)에 ${jndi:…} 원격 조회 구문을 넣어, 인자를 기록하는 Log4j 가 공격자 서버에 조회하게 하는 알려진 악용 형태입니다.',
  }),
  Object.freeze({
    name: 'known_scanner_trace',
    technique: 'T1190',
    condition: Object.freeze({
      descriptionHas: Object.freeze(['취약점 점검 흔적']),
      onlyWithLookup: true,
      bonus: 0.05,
    }),
    evidence: 'T1190: CVE-2021-44228 공개 직후 자동 점검 도구가 같은 조회 구문을 대량으로 뿌렸으므로, 점검 도구 흔적은 원격 조회 구문과 함께 나올 때만 확신도를 올립니다.',
  }),
  Object.freeze({
    name: 'cve_marker_without_lookup',
    technique: 'T1190',
    condition: Object.freeze({
      mitre: 'T1190',
      noLookup: true,
      baseConfidence: 0.5,
      clearLevel: 12,
      maxConfidence: 0.8,
    }),
    evidence: 'T1190 탐지(웹 요청 로그 확인): T1190 경보지만 완전한 ${jndi:…://} 구문이 없으면 취약점 이름 검색·문서 열람·잘린 글자일 수 있어 막지 않고 사람 확인으로 넘깁니다.',
  }),
]);

const BY_NAME = Object.freeze(Object.fromEntries(PATTERNS.map((p) => [p.name, p])));
const BLOCK_AT = 0.85;
const ALERT_AT = 0.5;
// 판단 시작 수준. 이 아래 수준은 수준 점수를 0 으로 봅니다.
const BASE_LEVEL = 5;
// 원격 조회 구문 패턴에서 덧붙는 신호(반복·머리글과 인자 동시) 하나마다 올리는 확신도입니다.
const EXTRA_SIGNAL_BONUS = 0.05;

/**
 * 숫자를 0~1 사이로 자릅니다. 숫자가 아니면 0 입니다.
 * @param {number} n 자를 숫자
 * @returns {number} 0~1 사이 값
 */
const clamp01 = (n) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);
/**
 * 숫자를 소수 둘째 자리까지 반올림합니다.
 * @param {number} n 반올림할 숫자
 * @returns {number} 반올림한 값
 */
const round2 = (n) => Math.round(n * 100) / 100;

/**
 * 경보 하나에서 판단에 쓰는 신호(설명·data 칸·수준·반복 횟수·MITRE 기법)를 꺼냅니다.
 * @param {object} alert 판단할 경보 하나
 * @returns {{description: string, data: object, level: number, repeat: number, hasMitre: (id: string) => boolean}} 꺼낸 신호
 */
function readSignals(alert) {
  const description = typeof alert?.rule?.description === 'string' ? alert.rule.description : '';
  const mitre = Array.isArray(alert?.rule?.mitre) ? alert.rule.mitre : [];
  const level = Number(alert?.rule?.level) || 0;
  const data = alert?.data && typeof alert.data === 'object' ? alert.data : {};

  let repeat = Number.parseInt(data.count, 10);
  if (!Number.isFinite(repeat)) {
    const m = description.match(/(\d+)\s*번/);
    repeat = m ? Number(m[1]) : 1;
  }

  return {
    description,
    data,
    level,
    repeat,
    hasMitre: (id) => mitre.some((t) => typeof t === 'string' && t.startsWith(id)),
  };
}

/**
 * 경보 수준을 기준 수준(BASE_LEVEL)과 패턴의 확실 수준(clearLevel) 사이에서 0~1 점수로 바꿉니다.
 * @param {object} s readSignals 가 꺼낸 신호
 * @param {object} c 패턴의 조건값(condition)
 * @returns {number} 0~1 수준 점수
 */
const levelScore = (s, c) => clamp01((s.level - BASE_LEVEL) / (c.clearLevel - BASE_LEVEL));

/**
 * 패턴이 보는 data 칸 가운데 완전한 원격 조회 구문(${jndi:프로토콜://)이 들어 있는 칸이 있는지 봅니다.
 * @param {object} p 원격 조회 구문 패턴 하나(조건값 condition 의 fields·lookupRegex 를 씁니다)
 * @param {object} s readSignals 가 꺼낸 신호
 * @returns {boolean} 구문이 있으면 true
 */
function hasLookup(p, s) {
  const re = new RegExp(p.condition.lookupRegex, 'i');
  return p.condition.fields.some((f) => typeof s.data[f] === 'string' && re.test(s.data[f]));
}

/**
 * 경보 하나를 보고 맞는 패턴으로 차단(block)·알림(alert)·기록(record) 중 하나를 고릅니다.
 * 원격 조회 구문이 있으면 수준·반복·머리글과 인자 동시·점검 도구 흔적으로 확신도를 올리고,
 * 구문 없이 T1190 표시만 있으면 최대 0.8 로 알림까지만 올립니다.
 * @param {object} alert 판단할 Wazuh 경보 하나
 * @returns {{action: 'block'|'alert'|'record', confidence: number, reason: string}} 판단 결과
 */
export function decide(alert) {
  const s = readSignals(alert);
  const header = BY_NAME.jndi_lookup_in_header;
  const argument = BY_NAME.jndi_lookup_in_argument;
  const scanner = BY_NAME.known_scanner_trace;
  const marker = BY_NAME.cve_marker_without_lookup;

  const matched = [header, argument].filter((p) => hasLookup(p, s));
  let confidence;

  if (matched.length) {
    const c = matched[0].condition;
    confidence = c.baseConfidence + (1 - c.baseConfidence) * levelScore(s, c);
    if (s.repeat >= c.repeatAtLeast) confidence += EXTRA_SIGNAL_BONUS;
    if (matched.length > 1) confidence += EXTRA_SIGNAL_BONUS;
    if (scanner.condition.descriptionHas.some((w) => s.description.includes(w))) {
      matched.push(scanner);
      confidence += scanner.condition.bonus;
    }
  } else if (s.hasMitre(marker.condition.mitre)) {
    const c = marker.condition;
    matched.push(marker);
    confidence = Math.min(c.maxConfidence, c.baseConfidence + (1 - c.baseConfidence) * (levelScore(s, c) / 2));
  } else {
    // T1190 표시도 조회 구문도 없는 화면·로그인·메모 조회 같은 정상 사건입니다.
    return { action: 'record', confidence: 0.05, reason: '맞는 패턴 없음: 정상 요청으로 기록' };
  }

  confidence = round2(clamp01(confidence));
  const action = confidence >= BLOCK_AT ? 'block' : confidence >= ALERT_AT ? 'alert' : 'record';
  const names = matched.map((p) => p.name).join(', ');
  return { action, confidence, reason: `${names} (CVE-2021-44228, T1190)` };
}
