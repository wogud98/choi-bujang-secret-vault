// decide.mjs 의 판단 결과를 받아 알림을 남기고, 차단 후보만 ZTNA 판정기용 거부 규칙으로 넘깁니다.
// decide.mjs 는 판단만 하고, 파일 쓰기와 판정기 연결은 이 파일에서만 합니다.
// 판정기(src/decider.mjs)의 기존 규칙은 고치지 않습니다. 거부 규칙은 따로 deny-rules.json 에 둡니다.
//
// 실행: node xdr/brute-force/respond.mjs
import { readFile, writeFile, appendFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { decide } from './decide.mjs';

const FIXTURE = new URL('../fixtures/brute-force.json', import.meta.url);
const RULES_FILE = new URL('./deny-rules.json', import.meta.url);
const ALERTS_LOG = new URL('../alerts.log', import.meta.url);

// 차단 규칙은 근거 경보 시각부터 1시간만 유효합니다. 영구 차단은 하지 않습니다.
const BLOCK_MINUTES = 60;

const sourceOf = (alert) => (typeof alert?.data?.srcip === 'string' ? alert.data.srcip : '');

export function buildDenyRules(alerts, decisions) {
  // 정상(record) 사건이나 실패 뒤 성공한 사건이 나온 주소는 정상 사용자 주소로 보고 막지 않습니다.
  const trusted = new Set();
  alerts.forEach((alert, i) => {
    const d = decisions[i];
    const successAfter = /성공/.test(alert?.rule?.description ?? '');
    if (d.action === 'record' || (d.action === 'alert' && successAfter)) trusted.add(sourceOf(alert));
  });

  const bySource = new Map();
  alerts.forEach((alert, i) => {
    const d = decisions[i];
    const srcip = sourceOf(alert);
    if (d.action !== 'block' || !srcip || trusted.has(srcip)) return;
    const startedAt = new Date(alert.timestamp);
    if (Number.isNaN(startedAt.getTime())) return;
    const expiresAt = new Date(startedAt.getTime() + BLOCK_MINUTES * 60_000).toISOString();
    const rule = bySource.get(srcip) ?? {
      ruleId: `xdr.brute_force.deny.${srcip}`,
      kind: 'deny_source',
      srcip,
      reason: d.reason,
      startsAt: startedAt.toISOString(),
      expiresAt,
      evidenceAlertIds: [],
    };
    rule.evidenceAlertIds.push(alert.id);
    if (expiresAt > rule.expiresAt) rule.expiresAt = expiresAt;
    bySource.set(srcip, rule);
  });
  return [...bySource.values()];
}

// 판정기에 더할 확인 단계: 주소가 유효한 거부 규칙에 걸리면 true 입니다.
export function isBlocked(rules, srcip, at) {
  const t = new Date(at).getTime();
  return rules.some((r) => r.srcip === srcip
    && t >= new Date(r.startsAt).getTime()
    && t < new Date(r.expiresAt).getTime());
}

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
    lines.push([alert.timestamp, alert.id, d.action, d.confidence, sourceOf(alert), alert?.data?.srcuser ?? '', d.reason].join('\t'));
  });
  if (lines.length) await appendFile(ALERTS_LOG, `${lines.join('\n')}\n`, 'utf8');
  return lines.length;
}

export async function respond() {
  const fixture = JSON.parse(await readFile(FIXTURE, 'utf8'));
  const alerts = fixture.alerts;
  const decisions = [];
  for (const alert of alerts) decisions.push(await decide(alert));

  const rules = buildDenyRules(alerts, decisions);
  await writeFile(RULES_FILE, `${JSON.stringify({ schema: 'aleph.xdr.deny-rules.v1', moduleKey: 'brute-force', rules }, null, 2)}\n`, 'utf8');
  const appended = await appendAlertLines(alerts, decisions);

  // 시험 경보를 다시 흘려 거부 규칙이 무엇을 막는지 확인합니다.
  const replay = { block: { blocked: 0, total: 0 }, alert: { blocked: 0, total: 0 }, record: { blocked: 0, total: 0 } };
  alerts.forEach((alert, i) => {
    const bucket = replay[decisions[i].action];
    bucket.total += 1;
    if (isBlocked(rules, sourceOf(alert), alert.timestamp)) bucket.blocked += 1;
  });
  return { rules, appended, replay };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { rules, appended, replay } = await respond();
  console.log(`거부 규칙 ${rules.length}개 → xdr/brute-force/deny-rules.json`);
  console.log(`알림 ${appended}줄 추가 → xdr/alerts.log`);
  console.log(`다시 흘리기: 명확한 공격 ${replay.block.blocked}/${replay.block.total} 막힘, 애매한 시도 ${replay.alert.blocked}/${replay.alert.total} 막힘, 정상 사건 ${replay.record.blocked}/${replay.record.total} 막힘`);
}
