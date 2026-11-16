// decide.mjs 의 판단 결과를 받아 알림을 남기고, 차단 후보만 ZTNA 판정기용 거부 규칙(그 계정 세션 거두기)으로 넘깁니다.
// decide.mjs 는 판단만 하고, 파일 쓰기와 판정기 연결은 이 파일에서만 합니다.
// 판정기(src/decider.mjs)의 기존 규칙은 고치지 않습니다. 거부 규칙은 따로 xdr/privilege/deny-rules.json 에 둡니다.
//
// 실행: node xdr/privilege/respond.mjs
import { readFile, writeFile, appendFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { decide } from './decide.mjs';

const FIXTURE = new URL('../fixtures/privilege.json', import.meta.url);
const RULES_FILE = new URL('./deny-rules.json', import.meta.url);
const ALERTS_LOG = new URL('../alerts.log', import.meta.url);

// 세션 거두기 규칙은 근거 경보 시각부터 24시간만 유효합니다. 영구 차단은 하지 않습니다.
// 그 사이 담당자가 관리자 그룹 소속을 되돌리고 계정 주인에게 비밀번호 변경·2단계 인증을 확인할 시간을 하루로 둡니다.
// 규칙은 계정 전체가 아니라 "그 계정 + 공격이 나온 주소" 세션만 거둡니다. 같은 계정 주인이 평소 주소에서 쓰는 정상 세션은 그대로 통과합니다.
// 관리자 그룹 추가·처음 보는 관리자 명령처럼 명확한 권한 가로채기(block)만 규칙으로 넣고, 취소·실패한 상승 같은 애매한 시도(alert)는 알림으로만 남깁니다.
const BLOCK_MINUTES = 24 * 60;

/**
 * 경보의 출발 주소(data.srcip)를 꺼냅니다.
 * @param {object} alert 경보 하나
 * @returns {string} 출발 주소. 없거나 문자열이 아니면 빈 문자열
 */
const sourceOf = (alert) => (typeof alert?.data?.srcip === 'string' ? alert.data.srcip : '');

/**
 * 경보의 계정(data.srcuser)을 꺼냅니다.
 * @param {object} alert 경보 하나
 * @returns {string} 계정 이름. 없거나 문자열이 아니면 빈 문자열
 */
const accountOf = (alert) => (typeof alert?.data?.srcuser === 'string' ? alert.data.srcuser : '');

/**
 * 계정과 주소를 묶은 세션 열쇠를 만듭니다.
 * @param {string} srcuser 계정 이름
 * @param {string} srcip 출발 주소
 * @returns {string} "계정@주소" 모양 열쇠
 */
const sessionKey = (srcuser, srcip) => `${srcuser}@${srcip}`;

/**
 * 차단(block) 판단이 나온 경보를 계정·출발 주소 세션별로 묶어 24시간짜리 세션 거두기 규칙 목록을 만듭니다.
 * 정상 사건이 나온 계정·주소 세션은 정상 사용자로 보고 규칙에서 뺍니다.
 * @param {object[]} alerts 경보 묶음의 경보 목록
 * @param {{action: string, confidence: number, reason: string}[]} decisions alerts 와 같은 순서의 decide 판단 결과 목록
 * @returns {object[]} 세션마다 하나씩 만든 거부 규칙 목록
 */
export function buildDenyRules(alerts, decisions) {
  // 정상(record) 사건이 나온 계정·주소 세션은 정상 사용자로 보고 막지 않습니다.
  const trusted = new Set();
  alerts.forEach((alert, i) => {
    if (decisions[i].action === 'record') trusted.add(sessionKey(accountOf(alert), sourceOf(alert)));
  });

  const bySession = new Map();
  alerts.forEach((alert, i) => {
    const d = decisions[i];
    const srcuser = accountOf(alert);
    const srcip = sourceOf(alert);
    const key = sessionKey(srcuser, srcip);
    if (d.action !== 'block' || !srcuser || !srcip || trusted.has(key)) return;
    const startedAt = new Date(alert.timestamp);
    if (Number.isNaN(startedAt.getTime())) return;
    const expiresAt = new Date(startedAt.getTime() + BLOCK_MINUTES * 60_000).toISOString();
    const rule = bySession.get(key) ?? {
      ruleId: `xdr.privilege.revoke.${srcuser}.${srcip}`,
      kind: 'revoke_session',
      srcuser,
      srcip,
      reason: d.reason,
      startsAt: startedAt.toISOString(),
      expiresAt,
      evidenceAlertIds: [],
    };
    rule.evidenceAlertIds.push(alert.id);
    if (expiresAt > rule.expiresAt) rule.expiresAt = expiresAt;
    bySession.set(key, rule);
  });
  return [...bySession.values()];
}

/**
 * 판정기에 더할 확인 단계입니다. 계정·주소 세션이 그 시각에 유효한 세션 거두기 규칙에 걸리는지 봅니다.
 * @param {object[]} rules buildDenyRules 가 만든 거부 규칙 목록
 * @param {string} srcuser 확인할 계정
 * @param {string} srcip 확인할 출발 주소
 * @param {string|number|Date} at 확인할 시각
 * @returns {boolean} 유효한 규칙에 걸리면 true
 */
export function isBlocked(rules, srcuser, srcip, at) {
  const t = new Date(at).getTime();
  return rules.some((r) => r.srcuser === srcuser
    && r.srcip === srcip
    && t >= new Date(r.startsAt).getTime()
    && t < new Date(r.expiresAt).getTime());
}

/**
 * 기록(record)이 아닌 판단을 xdr/alerts.log 에 한 줄씩 덧붙입니다. 이미 적힌 경보 id 는 다시 적지 않습니다.
 * @param {object[]} alerts 경보 묶음의 경보 목록
 * @param {{action: string, confidence: number, reason: string}[]} decisions alerts 와 같은 순서의 decide 판단 결과 목록
 * @returns {Promise<number>} 새로 덧붙인 줄 수
 */
async function appendAlertLines(alerts, decisions) {
  let logged = '';
  try {
    logged = await readFile(ALERTS_LOG, 'utf8');
  } catch {
    logged = '';
  }
  const seen = new Set(logged.split('\n').map((line) => line.split('\t')[1]).filter(Boolean));
  const lines = [];
  alerts.forEach((alert, i) => {
    const d = decisions[i];
    if (d.action === 'record' || seen.has(alert.id)) return;
    lines.push([alert.timestamp, alert.id, d.action, d.confidence, sourceOf(alert), accountOf(alert), d.reason].join('\t'));
  });
  if (lines.length) await appendFile(ALERTS_LOG, `${lines.join('\n')}\n`, 'utf8');
  return lines.length;
}

/**
 * 시험 경보를 모두 판단하고, 거부 규칙 파일을 쓰고, 알림을 남긴 뒤 규칙이 무엇을 막는지 다시 흘려 봅니다.
 * 받는 값은 없습니다.
 * @returns {Promise<{rules: object[], appended: number, replay: object}>} 거부 규칙, 덧붙인 알림 줄 수, 판단별 막힌 수
 */
export async function respond() {
  const fixture = JSON.parse(await readFile(FIXTURE, 'utf8'));
  const alerts = fixture.alerts;
  const decisions = [];
  for (const alert of alerts) decisions.push(await decide(alert));

  const rules = buildDenyRules(alerts, decisions);
  await writeFile(RULES_FILE, `${JSON.stringify({ schema: 'aleph.xdr.deny-rules.v1', moduleKey: 'privilege', rules }, null, 2)}\n`, 'utf8');
  const appended = await appendAlertLines(alerts, decisions);

  // 시험 경보를 다시 흘려 거부 규칙이 무엇을 막는지 확인합니다.
  const replay = { block: { blocked: 0, total: 0 }, alert: { blocked: 0, total: 0 }, record: { blocked: 0, total: 0 } };
  alerts.forEach((alert, i) => {
    const bucket = replay[decisions[i].action];
    bucket.total += 1;
    if (isBlocked(rules, accountOf(alert), sourceOf(alert), alert.timestamp)) bucket.blocked += 1;
  });
  return { rules, appended, replay };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { rules, appended, replay } = await respond();
  console.log(`세션 거두기 규칙 ${rules.length}개 → xdr/privilege/deny-rules.json`);
  console.log(`알림 ${appended}줄 추가 → xdr/alerts.log`);
  console.log(`다시 흘리기: 명확한 공격 ${replay.block.blocked}/${replay.block.total} 막힘, 애매한 시도 ${replay.alert.blocked}/${replay.alert.total} 막힘, 정상 사건 ${replay.record.blocked}/${replay.record.total} 막힘`);
}
