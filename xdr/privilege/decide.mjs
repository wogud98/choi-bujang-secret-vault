// 권한 가로채기(관리자 그룹 추가·처음 보는 관리자 명령·업무 시간 밖 권한 사용) 판단 모듈입니다. 심판은 인터넷 없이 이 파일 하나만 불러옵니다.
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

// xdr/privilege/patterns.json 의 패턴을 그대로 옮겨 적은 상수입니다. 두 곳을 함께 고칩니다.
const PATTERNS = deepFreeze([
  {
    name: 'privilege_change',
    technique: 'T1068, T1078',
    condition: {
      mitreAny: [
        'T1068',
        'T1078'
      ],
      minLevel: 5,
      clearLevel: 12,
      baseConfidence: 0.5,
      levelWeight: 0.15
    },
    evidence: 'T1068·T1078: 권한 상승 시도나 정상 계정의 권한 변경은 계정 도용과 권한 가로채기의 출발점이라, 수준 5 이상의 권한 경보는 모두 사람 확인 대상으로 올립니다.'
  },
  {
    name: 'admin_group_addition',
    technique: 'T1078',
    condition: {
      mitreAny: [
        'T1078'
      ],
      groupAny: [
        'administrators'
      ],
      descriptionAny: [
        '관리자 그룹에 추가',
        '관리자 그룹에 들어',
        '다시 관리자로'
      ],
      bonus: 0.2,
      repeatAtLeast: 2,
      repeatBonus: 0.1
    },
    evidence: 'T1078(정상 계정 도용): 손에 넣은 평범한 계정을 관리자 그룹에 넣으면 정상 계정처럼 보이면서 높은 권한을 얻으므로, 관리자 그룹 추가(여러 계정·빠졌다 다시 들어옴은 더 뚜렷함)는 권한 가로채기의 대표 신호입니다.'
  },
  {
    name: 'first_seen_admin_command',
    technique: 'T1068, T1078',
    condition: {
      mitreAny: [
        'T1068',
        'T1078'
      ],
      descriptionAny: [
        '처음 보는',
        '처음 봅니다',
        '방금 관리자가 된',
        '곧바로 권한 명령',
        '다른 계정의 권한'
      ],
      bonus: 0.2
    },
    evidence: 'T1068·T1078: 처음 보는 주소에서의 관리자 명령, 방금 관리자가 된 계정이나 남의 계정 권한으로 실행한 관리자 명령은 평소 사용 이력에 없는 권한 사용이라 도용된 권한일 가능성이 큽니다.'
  },
  {
    name: 'off_hours_privilege_use',
    technique: 'T1078',
    condition: {
      mitreAny: [
        'T1068',
        'T1078'
      ],
      descriptionAny: [
        '수업 시간 밖',
        '업무 시간 밖',
        '업무처럼 보이지 않는 시각'
      ],
      workStartHour: 8,
      workEndHour: 20,
      bonus: 0.2
    },
    evidence: 'T1078 탐지(평소 사용 시간과 비교): 도용된 정상 계정은 주인이 쓰지 않는 업무 시간 밖에 쓰이는 일이 많아, 업무 시간 밖 권한 사용은 계정 도용 신호입니다.'
  },
  {
    name: 'privilege_unconfirmed',
    technique: 'T1068, T1078',
    condition: {
      descriptionAny: [
        '취소됐',
        '관리자 그룹은 아닙니다',
        '변경은 없습니다',
        '명령은 없습니다',
        '실패',
        '평소 주소',
        '설명만 바뀌'
      ],
      maxConfidence: 0.8
    },
    evidence: 'T1068·T1078 탐지: 권한 상승이 취소·실패했거나, 관리자 그룹이 아니거나, 평소 주소에서 한 번뿐인 권한 사용은 수업 작업일 수 있어 막지 않고 사람 확인(알림)으로 넘깁니다.'
  }
]);

const BY_NAME = Object.freeze(Object.fromEntries(PATTERNS.map((p) => [p.name, p])));
const BLOCK_AT = 0.85;
const ALERT_AT = 0.5;
// 신호를 더하는 순서입니다. 기본 패턴(privilege_change)에 이 패턴들의 덧점수를 더합니다.
const SIGNAL_NAMES = Object.freeze([
  'admin_group_addition',
  'first_seen_admin_command',
  'off_hours_privilege_use',
]);

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
 * 경보 하나에서 판단에 쓰는 신호(설명·그룹·수준·반복 횟수·경보 시각의 시·MITRE 기법)를 꺼냅니다.
 * @param {object} alert 판단할 경보 하나
 * @returns {{description: string, group: string, level: number, repeat: number, hour: number, mitre: string[]}} 꺼낸 신호
 */
function readSignals(alert) {
  const description = typeof alert?.rule?.description === 'string' ? alert.rule.description : '';
  const mitre = Array.isArray(alert?.rule?.mitre) ? alert.rule.mitre.filter((t) => typeof t === 'string') : [];
  const level = Number(alert?.rule?.level) || 0;
  const data = alert?.data && typeof alert.data === 'object' ? alert.data : {};
  const group = typeof data.group === 'string' ? data.group.toLowerCase() : '';
  let repeat = Number.parseInt(data.count, 10);
  if (!Number.isFinite(repeat)) repeat = 1;
  // 경보 시각은 PC 현지 시각(+09:00)으로 적혀 있어, 적힌 그대로의 시를 씁니다. 못 읽으면 -1 입니다.
  const m = typeof alert?.timestamp === 'string' ? alert.timestamp.match(/T(\d{2}):/) : null;
  const hour = m ? Number(m[1]) : -1;
  return { description, group, level, repeat, hour, mitre };
}

/**
 * 경보의 MITRE 기법 목록에 주어진 기법(하위 기법 포함)이 있는지 봅니다.
 * @param {object} s readSignals 가 꺼낸 신호
 * @param {string} id 찾을 기법 번호(예: T1078)
 * @returns {boolean} 있으면 true
 */
const hasMitre = (s, id) => s.mitre.some((t) => t === id || t.startsWith(`${id}.`));

/**
 * 패턴 하나의 찾는 조건이 경보 신호와 맞는지 봅니다.
 * 기법 조건(mitreAny)은 맞아야 하고, 그룹·설명·업무 시간 조건은 하나만 맞아도 됩니다.
 * @param {object} p 패턴 하나
 * @param {object} s readSignals 가 꺼낸 신호
 * @returns {boolean} 맞으면 true
 */
function matches(p, s) {
  const c = p.condition;
  if (c.mitreAny && !c.mitreAny.some((id) => hasMitre(s, id))) return false;
  const byGroup = Boolean(c.groupAny) && c.groupAny.includes(s.group);
  const byDescription = Boolean(c.descriptionAny) && c.descriptionAny.some((w) => s.description.includes(w));
  const byHour = typeof c.workStartHour === 'number' && s.hour >= 0
    && (s.hour < c.workStartHour || s.hour >= c.workEndHour);
  if (c.groupAny || c.descriptionAny || typeof c.workStartHour === 'number') return byGroup || byDescription || byHour;
  return true;
}

/**
 * 경보 하나를 보고 맞는 패턴으로 차단(block)·알림(alert)·기록(record) 중 하나를 고릅니다.
 * 수준 5 이상의 권한 경보를 기본 0.5~0.65 로 보고, 관리자 그룹 추가·처음 보는 관리자 명령·업무 시간 밖 사용마다 확신도를 더합니다.
 * 권한 상승이 취소·실패했거나 관리자 그룹이 아니거나 평소 주소의 한 번짜리 사용이면 최대 0.8 이라 차단하지 않습니다.
 * @param {object} alert 판단할 Wazuh 경보 하나
 * @returns {{action: 'block'|'alert'|'record', confidence: number, reason: string}} 판단 결과
 */
export function decide(alert) {
  const s = readSignals(alert);
  const base = BY_NAME.privilege_change;
  const b = base.condition;

  if (!matches(base, s) || s.level < b.minLevel) {
    // 권한 기법 표시가 없거나 수준이 낮은 로그인·조회·로그아웃 같은 정상 사건입니다.
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
    if (p.condition.repeatAtLeast && s.repeat >= p.condition.repeatAtLeast) confidence += p.condition.repeatBonus;
  }

  const unconfirmed = BY_NAME.privilege_unconfirmed;
  if (matches(unconfirmed, s)) {
    matched.push(unconfirmed);
    confidence = Math.min(unconfirmed.condition.maxConfidence, confidence);
  }

  confidence = round2(clamp01(confidence));
  const action = confidence >= BLOCK_AT ? 'block' : confidence >= ALERT_AT ? 'alert' : 'record';
  return { action, confidence, reason: `${matched.map((p) => p.name).join(', ')} (${s.mitre.join(', ')})` };
}
