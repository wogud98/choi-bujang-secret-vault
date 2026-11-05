import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RULE_IDS, decide, zoneRouteList } from './decider.mjs';
import { detect } from './detect.mjs';
import safetyPolicy from '../backup/safety-policy.json' with { type: 'json' };

// 12단계 탈환 작전실: 학생 판정기·탐지 규칙·회수 상태·복구 버전을 한 응답으로 요약합니다.
// - 「live」는 이 서버가 실제 DB에서 읽은 결과, 「practice」는 학생 함수에 가상 요청·사건을 넣어 본 결과,
//   「not_run」은 이 서버에서 실행·확인할 수 없는 것(운영 반 엔진의 판정·사건 전달)입니다. 섞어 쓰지 않습니다.
// - 기기 ID·메모 ID는 앞 4자리와 끝 2자리만 남기고 가립니다. 메모 제목·본문·토큰·사용자 ID는 응답에 넣지 않습니다.
// - 수치(counts)는 가린 기록(records)에서 같은 방법으로 셉니다. 화면은 기록으로 다시 세어 서버 수치와 맞는지 봅니다.

const sha256 = text => createHash('sha256').update(text, 'utf8').digest('hex');
export const maskId = value => (typeof value === 'string' && value.length > 8
  ? `${value.slice(0, 4)}…${value.slice(-2)}` : '가림');

export function countBy(records, key, names) {
  const counts = Object.fromEntries(names.map(name => [name, 0]));
  for (const record of records) {
    if (Object.hasOwn(counts, record[key])) counts[record[key]] += 1;
  }
  counts.total = records.length;
  return counts;
}

// ── 판정기: 규칙 목록과 가상 요청 연습 ─────────────────────────────────────────
// 요청 모양은 docs/DECIDER_REQUEST.md의 18개 이름 그대로입니다. 심판 판정이 아닙니다.
function practiceRequest(overrides) {
  return {
    schema: 'aleph.decision.v1', requestId: randomUUID(), classId: 'class_fixture',
    projectId: 'project_fixture', subjectId: 'learner_fixture', deviceId: 'a'.repeat(16),
    service: 'notes', method: 'GET', path: '/notes/demo', route: 'GET /notes/:id',
    queryLength: 0, querySha256: sha256(''), at: new Date().toISOString(), policyRevision: 1,
    deviceRegistered: true, stepUp: { verified: false, authAgeSeconds: null }, recentEvents: [],
    signals: { source: 'judge_fixture', region: 'local', network: 'usual', hour: 14 },
    ...overrides,
  };
}
const DECIDER_PRACTICE = [
  { name: '등록 기기의 내 메모 한 건 읽기', expected: 'allow', request: {} },
  { name: '미등록 기기 요청', expected: 'deny', request: { deviceRegistered: false } },
  { name: 'ID 없는 전체 목록 GET /notes', expected: 'deny', request: { path: '/notes', route: 'GET /notes' } },
  { name: '구역 밖 경로 /notes/:id/export', expected: 'deny', request: { path: '/notes/demo/export' } },
  { name: '강사 자료 구역 읽기', expected: 'deny', request: { service: 'materials', path: '/materials', route: 'GET /materials' } },
  { name: '반 공지 쓰기', expected: 'deny', request: { service: 'notices', method: 'POST', path: '/notices', route: 'POST /notices' } },
  { name: '새벽·처음 보는 네트워크·폭주가 겹친 접속', expected: 'step_up', request: {
    signals: { source: 'judge_fixture', region: 'foreign', network: 'unusual', hour: 3 },
    recentEvents: [{ kind: 'risk_signal', ageSeconds: 60, count: 20 }] } },
];

export async function deciderSummary() {
  const practice = [];
  for (const item of DECIDER_PRACTICE) {
    const request = practiceRequest(item.request);
    const response = await decide(request);
    const wellFormed = response && Object.keys(response).sort().join(',') === 'decision,reasonCode,requestId,ruleIds,schema'
      && response.requestId === request.requestId && Array.isArray(response.ruleIds)
      && response.ruleIds.length > 0 && response.ruleIds.every(id => RULE_IDS.includes(id));
    practice.push({ name: item.name, expected: item.expected, decision: response?.decision ?? null,
      reasonCode: response?.reasonCode ?? null, ruleIds: Array.isArray(response?.ruleIds) ? response.ruleIds : [],
      wellFormed: Boolean(wellFormed), matches: Boolean(wellFormed) && response.decision === item.expected });
  }
  return {
    source: 'student', ruleIds: [...RULE_IDS], routes: zoneRouteList(),
    practice, practiceCounts: countBy(practice.map(item => ({ result: item.matches ? 'matched' : 'mismatched' })),
      'result', ['matched', 'mismatched']),
    live: { state: 'not_run', reason: '운영 반 엔진(ALEPH SDP)이 보내는 실제 판정 요청은 이 서버에서 볼 수 없음' },
  };
}

// ── 탐지 규칙: burst_read 가상 사건 연습 ──────────────────────────────────────────
function reads(count, intervalSeconds) {
  const start = Date.UTC(2026, 9, 1);
  return Array.from({ length: count }, (_, index) => ({
    at: new Date(start + index * intervalSeconds * 1000).toISOString(), method: 'GET',
    identity: { sub: 'learner_fixture' } }));
}
const DETECT_PRACTICE = [
  { name: '10분 안에 120건', expected: 'observe', events: () => reads(120, 2) },
  { name: '10분 안에 121건', expected: 'propose_revocation', events: () => reads(121, 2) },
  { name: '10분 밖으로 흩어진 200건', expected: 'observe', events: () => reads(200, 7) },
];
export function detectionSummary() {
  const practice = DETECT_PRACTICE.map(item => {
    const result = detect(item.events());
    return { name: item.name, expected: item.expected, action: result.action,
      reasonCode: result.reasonCode ?? null, matches: result.action === item.expected };
  });
  return {
    source: 'student', rule: 'burst_read', windowMinutes: 10, limit: 120, practice,
    live: { state: 'not_run', events: null,
      reason: '운영 반 엔진의 조회 사건 전달과 회수 제안 집행이 이 자료실에 연결되지 않음' },
  };
}

// ── 회수 상태: 내 기기 승인 기록(public.devices) ─────────────────────────────────
export const DEVICE_STATES = Object.freeze(['approved', 'pending', 'revoked', 'expired', 'unknown']);
export function deviceStatus(row, now = Date.now()) {
  if (row?.status === 'approved' || row?.status === 'pending') {
    return Date.parse(row.expires_at) > now ? row.status : 'expired';
  }
  return row?.status === 'revoked' ? 'revoked' : 'unknown';
}
export function revocationSummary(rows, now = Date.now()) {
  const records = rows.map(row => ({ device: maskId(row.device_id), status: deviceStatus(row, now),
    expiresAt: typeof row.expires_at === 'string' ? row.expires_at : null }));
  return { state: 'live', source: 'public.devices (내 기기만)', records,
    counts: countBy(records, 'status', DEVICE_STATES) };
}

// ── 복구 버전: 안전 정책 사본 해시와 내 메모 사본(public.note_snapshots) ─────────
// 사본 해시는 backup/safety-policy.sha256(vercel.json includeFiles로 함께 배포)과 비교합니다. 못 읽으면 not_run입니다.
export function policySummary(root = process.cwd()) {
  const text = `${JSON.stringify(safetyPolicy, null, 2)}\n`;
  const actual = sha256(text);
  let recorded = null;
  try {
    recorded = /^([0-9a-f]{64})\s/u.exec(readFileSync(join(root, 'backup', 'safety-policy.sha256'), 'utf8'))?.[1] ?? null;
  } catch {
    recorded = null;
  }
  const policyRules = Array.isArray(safetyPolicy.policy?.ruleIds) ? [...safetyPolicy.policy.ruleIds].sort() : [];
  return { version: safetyPolicy.version ?? null, sha256: actual.slice(0, 12),
    hashCheck: recorded === null ? 'not_run' : recorded === actual ? 'match' : 'mismatch',
    rulesMatchDecider: policyRules.join(',') === [...RULE_IDS].sort().join(',') };
}
export const SNAPSHOT_STATES = Object.freeze(['match', 'changed', 'missing', 'bad_snapshot']);
const contentHash = row => sha256(`${row.title}\n${row.content}`);
export function restoreSummary(snapshots, liveNotes) {
  const live = new Map(liveNotes.map(row => [row.note_id, row]));
  const records = snapshots.map(snapshot => {
    const snapshotOk = typeof snapshot.title === 'string' && typeof snapshot.content === 'string'
      && contentHash(snapshot) === snapshot.content_sha256;
    const note = live.get(snapshot.note_id);
    const liveHash = note ? contentHash(note) : null;
    const state = !snapshotOk ? 'bad_snapshot' : !note ? 'missing' : liveHash === snapshot.content_sha256 ? 'match' : 'changed';
    // 제목·본문은 해시 계산에만 쓰고 돌려주지 않습니다.
    return { note: maskId(snapshot.note_id), snapshotSha256: String(snapshot.content_sha256 ?? '').slice(0, 12),
      liveSha256: liveHash ? liveHash.slice(0, 12) : null, state };
  });
  return { state: 'live', source: 'public.note_snapshots (내 사본만)', records,
    counts: countBy(records, 'state', SNAPSHOT_STATES) };
}
