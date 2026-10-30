// 무차별 로그인 공격 판단 모듈입니다. 심판은 인터넷 없이 이 파일 하나만 불러옵니다.
// import 없이, 파일을 읽거나 쓰지 않고, 바깥에 묻지 않고 경보 하나만 보고 계산합니다.
// 알림 기록과 판정기 연결은 respond.mjs 가 합니다. 이 파일은 판단 결과만 돌려줍니다.

// xdr/brute-force/patterns.json 의 패턴을 그대로 옮겨 적은 상수입니다. 두 곳을 함께 고칩니다.
const PATTERNS = Object.freeze([
  Object.freeze({
    name: 'same_source_failure_burst',
    technique: 'T1110.001',
    condition: Object.freeze({
      mitre: 'T1110',
      descriptionHas: '실패',
      failCountAtLeast: 3,
      clearFailCount: 30,
      clearLevel: 12,
      successAfterFailureIsNotClear: true,
    }),
    evidence: 'T1110.001 비밀번호 추측: 한 주소가 짧은 시간에 같은 계정으로 로그인 실패를 연속으로 쌓는 형태입니다.',
  }),
  Object.freeze({
    name: 'multi_account_password_spray',
    technique: 'T1110.003',
    condition: Object.freeze({
      mitre: 'T1110',
      distinctAccountsAtLeast: 5,
      orDescriptionHas: Object.freeze(['여러 계정', '같은 비밀번호']),
      clearDistinctAccounts: 8,
      clearLevel: 12,
    }),
    evidence: 'T1110.003 비밀번호 스프레이: 한 주소가 여러 계정에 같은 비밀번호를 하나씩 넣어 보는 형태입니다.',
  }),
]);

const BLOCK_AT = 0.85;
const ALERT_AT = 0.5;
// 실패 뒤 성공이 섞인 경보는 본인의 오타일 수 있어 차단 확신도까지 올리지 않습니다.
const SUCCESS_CAP = 0.8;
// 판단 시작 수준. 이 아래 수준은 패턴과 맞는 정도를 0 으로 봅니다.
const BASE_LEVEL = 5;

const clamp01 = (n) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);
const round2 = (n) => Math.round(n * 100) / 100;

function readSignals(alert) {
  const description = typeof alert?.rule?.description === 'string' ? alert.rule.description : '';
  const mitre = Array.isArray(alert?.rule?.mitre) ? alert.rule.mitre : [];
  const level = Number(alert?.rule?.level) || 0;
  const data = alert?.data && typeof alert.data === 'object' ? alert.data : {};

  let failCount = Number.parseInt(data.count, 10);
  if (!Number.isFinite(failCount)) {
    const m = description.match(/실패\D{0,4}(\d+)\s*건/);
    failCount = m ? Number(m[1]) : 0;
  }

  const listed = typeof data.accounts === 'string'
    ? new Set(data.accounts.split(',').map((s) => s.trim()).filter(Boolean)).size
    : 0;
  const counted = description.match(/계정\s*(\d+)\s*개/);
  const accounts = Math.max(listed, counted ? Number(counted[1]) : 0);

  return {
    description,
    level,
    failCount,
    accounts,
    hasMitre: (id) => mitre.some((t) => typeof t === 'string' && t.startsWith(id)),
    successAfter: /실패[^.]*뒤[^.]*성공/.test(description),
  };
}

// 패턴마다 0~1 확신도를 매깁니다. 맞지 않으면 null 입니다.
function scoreBurst(p, s) {
  const c = p.condition;
  if (!s.hasMitre(c.mitre) || !s.description.includes(c.descriptionHas)) return null;
  if (s.failCount < c.failCountAtLeast) return null;
  const levelScore = clamp01((s.level - BASE_LEVEL) / (c.clearLevel - BASE_LEVEL));
  const countScore = clamp01((s.failCount - c.failCountAtLeast) / (c.clearFailCount - c.failCountAtLeast));
  let confidence = ALERT_AT + (1 - ALERT_AT) * ((levelScore + countScore) / 2);
  if (c.successAfterFailureIsNotClear && s.successAfter) confidence = Math.min(confidence, SUCCESS_CAP);
  return confidence;
}

function scoreSpray(p, s) {
  const c = p.condition;
  if (!s.hasMitre(c.mitre)) return null;
  const byCount = s.accounts >= c.distinctAccountsAtLeast;
  const byText = c.orDescriptionHas.some((w) => s.description.includes(w));
  if (!byCount && !byText) return null;
  const levelScore = clamp01((s.level - BASE_LEVEL) / (c.clearLevel - BASE_LEVEL));
  const accountScore = clamp01(s.accounts / c.clearDistinctAccounts);
  let confidence = ALERT_AT + (1 - ALERT_AT) * ((levelScore + accountScore) / 2);
  if (s.successAfter) confidence = Math.min(confidence, SUCCESS_CAP);
  return confidence;
}

const SCORERS = Object.freeze({
  same_source_failure_burst: scoreBurst,
  multi_account_password_spray: scoreSpray,
});

export function decide(alert) {
  const s = readSignals(alert);
  let best = null;
  for (const p of PATTERNS) {
    const confidence = SCORERS[p.name](p, s);
    if (confidence !== null && (!best || confidence > best.confidence)) best = { pattern: p, confidence };
  }

  if (!best) {
    // T1110 표시만 있고 실패가 적거나, 로그인 성공·유지 같은 정상 사건입니다.
    const confidence = s.hasMitre('T1110') ? 0.2 : 0.05;
    return { action: 'record', confidence, reason: '맞는 패턴 없음: 정상 로그인 사건으로 기록' };
  }

  const confidence = round2(best.confidence);
  const action = confidence >= BLOCK_AT ? 'block' : confidence >= ALERT_AT ? 'alert' : 'record';
  return { action, confidence, reason: `${best.pattern.name} (${best.pattern.technique})` };
}
