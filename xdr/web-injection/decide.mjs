// 웹 주입 공격 판단 모듈입니다. 심판은 인터넷 없이 이 파일 하나만 불러옵니다.
// import 없이, 파일을 읽거나 쓰지 않고, 바깥에 묻지 않고 경보 하나만 보고 계산합니다.
// 알림 기록과 판정기 연결은 respond.mjs 가 합니다. 이 파일은 판단 결과만 돌려줍니다.

// xdr/web-injection/patterns.json 의 패턴을 그대로 옮겨 적은 상수입니다. 두 곳을 함께 고칩니다.
const PATTERNS = Object.freeze([
  Object.freeze({
    name: 'sql_injection_repeat',
    technique: 'T1190',
    condition: Object.freeze({
      mitre: 'T1190',
      descriptionHas: Object.freeze(['SQL 구문', 'SQL 표식', '데이터베이스 조회']),
      urlHas: Object.freeze(['doc-sql']),
      repeatAtLeast: 3,
      clearRepeat: 10,
      clearLevel: 12,
    }),
    evidence: 'T1190 외부 공개 앱 악용: 요청 인자에 SQL 구문을 이어 붙여 앱 뒤의 데이터베이스를 조회·조작하려는 형태입니다(MOVEit CVE-2023-34362 같은 SQL 주입).',
  }),
  Object.freeze({
    name: 'script_injection_repeat',
    technique: 'T1190',
    condition: Object.freeze({
      mitre: 'T1190',
      descriptionHas: Object.freeze(['스크립트 삽입', '스크립트 표식']),
      urlHas: Object.freeze(['doc-script']),
      repeatAtLeast: 3,
      clearRepeat: 10,
      clearLevel: 12,
    }),
    evidence: 'T1190 외부 공개 앱 악용: 요청 인자에 스크립트 태그를 넣어 웹 화면에서 공격자 코드를 실행하게 하려는 형태입니다.',
  }),
  Object.freeze({
    name: 'path_traversal_repeat',
    technique: 'T1190',
    condition: Object.freeze({
      mitre: 'T1190',
      descriptionHas: Object.freeze(['거슬러 올라가', '경로 이탈']),
      urlHas: Object.freeze(['doc-up']),
      repeatAtLeast: 3,
      clearRepeat: 10,
      clearLevel: 12,
    }),
    evidence: 'T1190 외부 공개 앱 악용: 경로 인자에 ../ 를 되풀이해 공개 폴더 밖의 서버 파일을 읽으려는 형태입니다.',
  }),
  Object.freeze({
    name: 'command_separator_repeat',
    technique: 'T1190',
    condition: Object.freeze({
      mitre: 'T1190',
      descriptionHas: Object.freeze(['명령 구분자']),
      urlHas: Object.freeze(['doc-cmd']),
      repeatAtLeast: 3,
      clearRepeat: 10,
      clearLevel: 12,
    }),
    evidence: 'T1190 외부 공개 앱 악용: 요청 인자에 명령 구분자를 넣어 서버가 공격자 명령을 이어 실행하게 하려는 형태입니다.',
  }),
  Object.freeze({
    name: 'single_injection_marker',
    technique: 'T1190',
    condition: Object.freeze({
      mitre: 'T1190',
      repeatBelow: 3,
      clearLevel: 12,
      maxConfidence: 0.8,
    }),
    evidence: 'T1190 탐지(웹 앱 요청 로그 확인): 외부 공개 앱 요청에 주입처럼 보이는 표기가 한 번만 나오고 반복이 없으면 오탐일 수 있어 막지 않고 사람 확인으로 넘깁니다.',
  }),
]);

const BLOCK_AT = 0.85;
const ALERT_AT = 0.5;
// 판단 시작 수준. 이 아래 수준은 패턴과 맞는 정도를 0 으로 봅니다.
const BASE_LEVEL = 5;

const clamp01 = (n) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);
const round2 = (n) => Math.round(n * 100) / 100;

function readSignals(alert) {
  const description = typeof alert?.rule?.description === 'string' ? alert.rule.description : '';
  const mitre = Array.isArray(alert?.rule?.mitre) ? alert.rule.mitre : [];
  const level = Number(alert?.rule?.level) || 0;
  const data = alert?.data && typeof alert.data === 'object' ? alert.data : {};
  const url = typeof data.url === 'string' ? data.url : '';

  let repeat = Number.parseInt(data.count, 10);
  if (!Number.isFinite(repeat)) {
    const m = description.match(/(\d+)\s*번/);
    repeat = m ? Number(m[1]) : 0;
  }

  return {
    description,
    url,
    level,
    repeat,
    hasMitre: (id) => mitre.some((t) => typeof t === 'string' && t.startsWith(id)),
  };
}

const levelScore = (s, c) => clamp01((s.level - BASE_LEVEL) / (c.clearLevel - BASE_LEVEL));

// 반복 주입 패턴의 0~1 확신도입니다. 맞지 않으면 null 입니다.
function scoreRepeat(p, s) {
  const c = p.condition;
  if (!s.hasMitre(c.mitre) || s.repeat < c.repeatAtLeast) return null;
  const marked = c.descriptionHas.some((w) => s.description.includes(w))
    || c.urlHas.some((w) => s.url.includes(w));
  if (!marked) return null;
  const repeatScore = clamp01((s.repeat - 1) / (c.clearRepeat - 1));
  return ALERT_AT + (1 - ALERT_AT) * ((levelScore(s, c) + repeatScore) / 2);
}

// 반복 없는 한 번짜리 의심 표기는 차단 확신도까지 올리지 않습니다.
function scoreSingle(p, s) {
  const c = p.condition;
  if (!s.hasMitre(c.mitre) || s.repeat >= c.repeatBelow) return null;
  return Math.min(c.maxConfidence, ALERT_AT + (1 - ALERT_AT) * (levelScore(s, c) / 2));
}

export function decide(alert) {
  const s = readSignals(alert);
  const matched = [];
  for (const p of PATTERNS) {
    const confidence = p.name === 'single_injection_marker' ? scoreSingle(p, s) : scoreRepeat(p, s);
    if (confidence !== null) matched.push({ pattern: p, confidence });
  }

  if (!matched.length) {
    // T1190 표시가 없는 화면·목록·검색 조회 같은 정상 사건입니다.
    const confidence = s.hasMitre('T1190') ? 0.2 : 0.05;
    return { action: 'record', confidence, reason: '맞는 패턴 없음: 정상 웹 요청으로 기록' };
  }

  matched.sort((a, b) => b.confidence - a.confidence);
  const confidence = round2(matched[0].confidence);
  const action = confidence >= BLOCK_AT ? 'block' : confidence >= ALERT_AT ? 'alert' : 'record';
  const names = matched.map((m) => m.pattern.name).join(', ');
  return { action, confidence, reason: `${names} (T1190)` };
}
