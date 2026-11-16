// 몰래 심어진 프로그램(서비스·예약 작업·시작 폴더) 판단 모듈입니다. 심판은 인터넷 없이 이 파일 하나만 불러옵니다.
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

// xdr/persistence/patterns.json 의 패턴을 그대로 옮겨 적은 상수입니다. 두 곳을 함께 고칩니다.
const PATTERNS = deepFreeze([
  {
    name: 'persistence_change',
    technique: 'T1543, T1053',
    condition: {
      mitreAny: [
        'T1543',
        'T1053'
      ],
      minLevel: 5,
      clearLevel: 12,
      baseConfidence: 0.5,
      levelWeight: 0.15
    },
    evidence: 'T1543·T1053: 서비스나 예약 작업을 만들거나 바꾸는 일은 다시 켜도 프로그램이 살아남게 하는 기본 수법이라, 수준 5 이상의 변경 경보는 모두 사람 확인 대상으로 올립니다.'
  },
  {
    name: 'unsigned_new_service',
    technique: 'T1543.003',
    condition: {
      mitreAny: [
        'T1543'
      ],
      descriptionAny: [
        '서명 없는',
        '서명이 없'
      ],
      bonus: 0.2,
      repeatAtLeast: 3,
      repeatBonus: 0.1
    },
    evidence: 'T1543.003(Windows 서비스): 공격자는 서명 없는 실행 파일을 새 서비스로 등록하거나 기존 서비스의 실행 파일을 바꿔 시스템 권한으로 계속 실행되게 합니다.'
  },
  {
    name: 'unfamiliar_persistence_item',
    technique: 'T1543, T1053',
    condition: {
      mitreAny: [
        'T1543',
        'T1053'
      ],
      descriptionAny: [
        '처음 보는',
        '평소 목록에 없는',
        '임의 문자열'
      ],
      bonus: 0.2
    },
    evidence: 'T1543·T1053 탐지(평소 목록과 비교): 평소 목록에 없는 서비스·예약 작업, 임의 문자열 이름의 작업은 새로 심긴 지속 수단의 대표 신호입니다.'
  },
  {
    name: 'temp_folder_executable',
    technique: 'T1543, T1053',
    condition: {
      mitreAny: [
        'T1543',
        'T1053'
      ],
      pathAny: [
        '\\AppData\\Local\\Temp\\'
      ],
      pathEndsWith: '.exe',
      bonus: 0.1
    },
    evidence: 'T1543·T1053 탐지(실행 파일 위치 확인): 서비스·예약 작업이 누구나 쓸 수 있는 임시 폴더의 실행 파일을 가리키면 정상 설치가 아닐 가능성이 큽니다.'
  },
  {
    name: 'startup_folder_change',
    technique: 'T1547.001',
    condition: {
      mitreAny: [
        'T1543',
        'T1053'
      ],
      pathAny: [
        '\\Start Menu\\Programs\\Startup\\'
      ],
      descriptionAny: [
        '시작 폴더',
        '시작 프로그램',
        '시작 항목'
      ],
      bonus: 0.1
    },
    evidence: 'T1547.001(시작 폴더): 사용자 시작 폴더에 프로그램을 넣으면 로그인할 때마다 자동 실행되므로, 시작 폴더 변경은 서비스·예약 작업과 함께 보는 지속 신호입니다.'
  },
  {
    name: 'service_and_task_together',
    technique: 'T1543, T1053',
    condition: {
      mitreAll: [
        'T1543',
        'T1053'
      ],
      bonus: 0.1
    },
    evidence: 'T1543·T1053: 같은 파일을 서비스·시작 항목과 예약 작업에 함께 걸어 두면 하나를 지워도 살아남게 하는 겹친 지속 수단입니다(선버스트 공격자도 예약 작업과 서비스를 함께 썼습니다).'
  },
  {
    name: 'persistence_unconfirmed',
    technique: 'T1543, T1053',
    condition: {
      descriptionAny: [
        '확인되지 않았',
        '아직 모릅니다',
        '등록은 없습니다',
        '실행된 기록은 없습니다'
      ],
      maxConfidence: 0.8
    },
    evidence: 'T1543·T1053 탐지: 서명을 아직 모르거나 등록·실행이 이어지지 않은 변경은 수업 도구·과제일 수 있어 막지 않고 사람 확인(알림)으로 넘깁니다.'
  }
]);

const BY_NAME = Object.freeze(Object.fromEntries(PATTERNS.map((p) => [p.name, p])));
const BLOCK_AT = 0.85;
const ALERT_AT = 0.5;
// 신호를 더하는 순서입니다. 기본 패턴(persistence_change)에 이 패턴들의 덧점수를 더합니다.
const SIGNAL_NAMES = Object.freeze([
  'unsigned_new_service',
  'unfamiliar_persistence_item',
  'temp_folder_executable',
  'startup_folder_change',
  'service_and_task_together',
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
 * 경보 하나에서 판단에 쓰는 신호(설명·실행 파일 경로·수준·반복 횟수·MITRE 기법)를 꺼냅니다.
 * @param {object} alert 판단할 경보 하나
 * @returns {{description: string, path: string, level: number, repeat: number, mitre: string[]}} 꺼낸 신호
 */
function readSignals(alert) {
  const description = typeof alert?.rule?.description === 'string' ? alert.rule.description : '';
  const mitre = Array.isArray(alert?.rule?.mitre) ? alert.rule.mitre.filter((t) => typeof t === 'string') : [];
  const level = Number(alert?.rule?.level) || 0;
  const data = alert?.data && typeof alert.data === 'object' ? alert.data : {};
  const path = typeof data.path === 'string' ? data.path : '';

  let repeat = Number.parseInt(data.count, 10);
  if (!Number.isFinite(repeat)) {
    const m = description.match(/(\d+)\s*건/);
    repeat = m ? Number(m[1]) : 1;
  }
  return { description, path, level, repeat, mitre };
}

/**
 * 경보의 MITRE 기법 목록에 주어진 기법(하위 기법 포함)이 있는지 봅니다.
 * @param {object} s readSignals 가 꺼낸 신호
 * @param {string} id 찾을 기법 번호(예: T1543)
 * @returns {boolean} 있으면 true
 */
const hasMitre = (s, id) => s.mitre.some((t) => t === id || t.startsWith(`${id}.`));

/**
 * 패턴 하나의 찾는 조건이 경보 신호와 맞는지 봅니다.
 * 기법 조건(mitreAny·mitreAll)은 모두 맞아야 하고, 경로 조건(pathAny)과 설명 조건(descriptionAny)은 둘 중 하나만 맞아도 됩니다.
 * @param {object} p 패턴 하나
 * @param {object} s readSignals 가 꺼낸 신호
 * @returns {boolean} 맞으면 true
 */
function matches(p, s) {
  const c = p.condition;
  if (c.mitreAny && !c.mitreAny.some((id) => hasMitre(s, id))) return false;
  if (c.mitreAll && !c.mitreAll.every((id) => hasMitre(s, id))) return false;
  const lowerPath = s.path.toLowerCase();
  const byPath = Boolean(c.pathAny)
    && c.pathAny.some((part) => lowerPath.includes(part.toLowerCase()))
    && (!c.pathEndsWith || lowerPath.endsWith(c.pathEndsWith));
  const byDescription = Boolean(c.descriptionAny) && c.descriptionAny.some((w) => s.description.includes(w));
  if (c.pathAny || c.descriptionAny) return byPath || byDescription;
  return true;
}

/**
 * 경보 하나를 보고 맞는 패턴으로 차단(block)·알림(alert)·기록(record) 중 하나를 고릅니다.
 * 수준 5 이상의 서비스·예약 작업 변경을 기본 0.5~0.65 로 보고, 서명 없음·평소 목록에 없음·임시 폴더 실행 파일·
 * 시작 폴더·서비스와 예약 작업 동시 신호마다 확신도를 더합니다. 서명을 아직 모르거나 등록·실행이 이어지지 않았으면 최대 0.8 입니다.
 * @param {object} alert 판단할 Wazuh 경보 하나
 * @returns {{action: 'block'|'alert'|'record', confidence: number, reason: string}} 판단 결과
 */
export function decide(alert) {
  const s = readSignals(alert);
  const base = BY_NAME.persistence_change;
  const b = base.condition;

  if (!matches(base, s) || s.level < b.minLevel) {
    // 서비스·예약 작업 표시가 없거나, 서명된 기존 항목·평소 업데이트처럼 수준이 낮은 정상 사건입니다.
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

  const unconfirmed = BY_NAME.persistence_unconfirmed;
  if (matches(unconfirmed, s)) {
    matched.push(unconfirmed);
    confidence = Math.min(unconfirmed.condition.maxConfidence, confidence);
  }

  confidence = round2(clamp01(confidence));
  const action = confidence >= BLOCK_AT ? 'block' : confidence >= ALERT_AT ? 'alert' : 'record';
  const names = matched.map((p) => p.name).join(', ');
  // 근거 기법은 경보에 붙은 기법과, 기본 패턴 밖에서 맞은 패턴의 하위 기법(T1543.003·T1547.001)만 적습니다.
  const techniques = new Set(s.mitre);
  for (const p of matched.slice(1)) if (p.technique.includes('.')) techniques.add(p.technique);
  return { action, confidence, reason: `${names} (${[...techniques].join(', ')})` };
}
