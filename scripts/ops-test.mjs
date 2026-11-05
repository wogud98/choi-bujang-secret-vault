// 12단계 로컬 연습: 탈환 작전실 요약(src/ops-summary.mjs)이 가린 기록과 수치를 맞게 만들고
// 메모 제목·본문·전체 ID를 내보내지 않는지 가짜 기록으로 확인합니다. 배포 주소나 심판 판정의 증거가 아닙니다.
import { createHash } from 'node:crypto';
import { deciderSummary, detectionSummary, policySummary, restoreSummary, revocationSummary } from '../src/ops-summary.mjs';

const sha = text => createHash('sha256').update(text, 'utf8').digest('hex');
const future = new Date(Date.now() + 3600_000).toISOString();
const past = '2020-01-01T00:00:00.000Z';
const devices = [
  { device_id: '0123456789abcdef', status: 'approved', expires_at: future },
  { device_id: '1123456789abcdef', status: 'pending', expires_at: future },
  { device_id: '2123456789abcdef', status: 'revoked', expires_at: past },
  { device_id: '3123456789abcdef', status: 'approved', expires_at: past },
];
const note = (id, title, content) => ({ note_id: id, title, content });
const snapshot = (id, title, content, hash = sha(`${title}\n${content}`)) => ({ ...note(id, title, content), content_sha256: hash });
const snapshots = [
  snapshot('b0000010-0000-4000-8000-00000000000b', '가상 제목', '가상 본문 문장'),
  snapshot('b0000011-0000-4000-8000-00000000000b', '가상 제목 2', '가상 본문 2'),
  snapshot('b0000012-0000-4000-8000-00000000000b', '가상 제목 3', '가상 본문 3'),
  snapshot('b0000013-0000-4000-8000-00000000000b', '가상 제목 4', '가상 본문 4', 'f'.repeat(64)),
];
const live = [note(snapshots[0].note_id, '가상 제목', '가상 본문 문장'), note(snapshots[1].note_id, '가상 제목 2', '바뀐 본문')];

const revocation = revocationSummary(devices);
const restore = restoreSummary(snapshots, live);
const decider = await deciderSummary();
const detection = detectionSummary();
const policy = policySummary();
const text = JSON.stringify({ revocation, restore, decider, detection, policy });
const checks = [
  ['회수 상태 수치 = 가린 기록', revocation.counts.approved === 1 && revocation.counts.pending === 1
    && revocation.counts.revoked === 1 && revocation.counts.expired === 1 && revocation.counts.total === revocation.records.length],
  ['복구 상태 수치 = 가린 기록', restore.counts.match === 1 && restore.counts.changed === 1
    && restore.counts.missing === 1 && restore.counts.bad_snapshot === 1 && restore.counts.total === restore.records.length],
  ['메모 제목·본문·전체 ID를 내보내지 않음', !/가상 (제목|본문)|바뀐 본문/u.test(text)
    && !devices.some(row => text.includes(row.device_id)) && !snapshots.some(row => text.includes(row.note_id))],
  ['판정기 가상 요청 응답 형식·기대 결과', decider.practice.every(item => item.wellFormed && item.matches)],
  ['탐지 가상 사건 기대 결과', detection.practice.every(item => item.matches)],
  ['안전 정책 사본 해시·판정기 규칙 일치', policy.hashCheck === 'match' && policy.rulesMatchDecider],
  ['운영 엔진 결과는 미실행으로 남김', decider.live.state === 'not_run' && detection.live.state === 'not_run'],
];
let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) failed += 1;
  console.log(`${ok ? '통과' : '실패'} · ${name}`);
}
console.log('이 명령은 가짜 기록으로 한 연습이며 배포 주소나 심판 판정의 증거가 아닙니다.');
if (failed) process.exitCode = 1;
