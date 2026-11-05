// 10단계: 안전 정책 사본 만들기 · 검증 · 시험 침공 · 차이 보기 · 되돌리기.
// 안전 정책 = 1~9단계에서 만든 접근 규칙
//   - src/decider.mjs의 RULE_IDS와 구역별 경로(resource_zone)
//   - aleph.config.json의 allowedRoutes
//   - DB 접근 정책(5단계 notes-revoke.sql로 적용한 public.notes 권한·RLS, 아래 DB_ACCESS에 기록)
// 검증한 사본은 backup/safety-policy.json, 확인용 해시는 backup/safety-policy.sha256입니다.
// 시험 정책(artifacts/policy-test.json)과 감사 기록(artifacts/policy-audit.log)은 커밋하지 않는 로컬 연습 파일입니다.
// 이 스크립트는 운영 정책(src/decider.mjs, aleph.config.json)을 고치지 않습니다. 읽기만 합니다.
import { createHash, randomUUID } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(import.meta.dirname, '..');
const BACKUP = join(root, 'backup', 'safety-policy.json');
const BACKUP_HASH = join(root, 'backup', 'safety-policy.sha256');
const TEST_POLICY = join(root, 'artifacts', 'policy-test.json');
const AUDIT_LOG = join(root, 'artifacts', 'policy-audit.log');
const VERSION = 'safety-policy-step9';

// 5단계에 적용한 DB 접근 정책의 기록입니다. 실제 DB 상태는 이 스크립트가 읽지 못하므로
// Supabase SQL Editor에서 notes-revoke.sql ①을 다시 Run 해 같은지 학생이 확인합니다.
const DB_ACCESS = Object.freeze({
  'public.notes': { public: [], anon: [], authenticated: [], service_role: ['delete', 'insert', 'select', 'update'], rls: true },
});

const sha256 = text => createHash('sha256').update(text, 'utf8').digest('hex');
const stop = message => { throw new Error(message); };
const readJson = path => JSON.parse(readFileSync(path, 'utf8'));
const clone = value => JSON.parse(JSON.stringify(value));

// 지금 운영 중인 안전 정책을 파일에서 읽어 모읍니다(쓰지 않음).
export async function livePolicy() {
  const { RULE_IDS, zoneRouteList } = await import(new URL('../src/decider.mjs', import.meta.url).href);
  const config = readJson(join(root, 'aleph.config.json'));
  return {
    ruleIds: [...RULE_IDS].sort(),
    zoneRoutes: zoneRouteList(),
    allowedRoutes: [...config.allowedRoutes].sort(),
    dbAccess: clone(DB_ACCESS),
  };
}

// 사본을 다시 읽고 해시를 대조합니다. 사본이 없거나 해시가 다르면 중단합니다.
export function readVerifiedBackup() {
  if (!existsSync(BACKUP) || !existsSync(BACKUP_HASH)) stop('검증한 안전 정책 사본(backup/safety-policy.json·.sha256)이 없어 중단합니다.');
  const text = readFileSync(BACKUP, 'utf8');
  const expected = readFileSync(BACKUP_HASH, 'utf8').trim().split(/\s+/u)[0];
  const actual = sha256(text);
  if (!/^[0-9a-f]{64}$/u.test(expected) || expected !== actual) {
    stop(`안전 정책 사본의 해시가 맞지 않아 중단합니다(기록 ${expected.slice(0, 12) || '없음'} · 실제 ${actual.slice(0, 12)}).`);
  }
  const backup = JSON.parse(text);
  if (backup?.schema !== 'vault.safety-policy.v1' || typeof backup.version !== 'string' || !backup.policy) {
    stop('안전 정책 사본의 형식이 맞지 않아 중단합니다.');
  }
  return { backup, hash: actual };
}

// 정책을 비교 단위(구역)로 나눕니다. 'zoneRoutes.notes', 'allowedRoutes', 'dbAccess.public.notes'처럼 부릅니다.
function groups(policy) {
  const out = {};
  for (const [key, value] of Object.entries(policy ?? {})) {
    if ((key === 'zoneRoutes' || key === 'dbAccess') && value && typeof value === 'object' && !Array.isArray(value)) {
      for (const [inner, innerValue] of Object.entries(value)) out[`${key}.${inner}`] = innerValue;
    } else {
      out[key] = value;
    }
  }
  return out;
}

// 줄 단위로 펼칩니다. 배열은 값마다 한 줄, 객체는 '키=값' 한 줄씩입니다.
function lines(value) {
  if (Array.isArray(value)) return value.map(String);
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, inner]) => (Array.isArray(inner)
      ? (inner.length ? inner.map(item => `${key}=${item}`) : [`${key}=(없음)`]) : [`${key}=${inner}`]));
  }
  return [String(value)];
}

// 검증한 사본과 시험 정책의 차이만 돌려줍니다. scope 안의 구역만 복원 대상이고, 사본에 없는 구역은 보존 대상입니다.
export function policyDiff(verified, test) {
  const a = groups(verified);
  const b = groups(test);
  const changes = [];
  for (const name of Object.keys(a)) {
    const before = lines(a[name]);
    const after = name in b ? lines(b[name]) : [];
    const removed = before.filter(item => !after.includes(item));
    const added = after.filter(item => !before.includes(item));
    if (removed.length || added.length || !(name in b)) changes.push({ group: name, removed, added, missing: !(name in b) });
  }
  const outside = Object.keys(b).filter(name => !(name in a));
  return { changes, outside };
}

function printDiff(diff, version, hash) {
  process.stdout.write(`복원 기준: ${version} (해시 ${hash.slice(0, 12)}…)\n`);
  if (!diff.changes.length) process.stdout.write('차이 없음: 시험 정책이 검증한 사본과 같습니다.\n');
  for (const change of diff.changes) {
    process.stdout.write(`바뀐 구역 ${change.group}${change.missing ? ' (시험 정책에서 빠짐)' : ''}\n`);
    for (const item of change.added) process.stdout.write(`  + ${item}   (사본에 없음 → 되돌리면 빠짐)\n`);
    for (const item of change.removed) process.stdout.write(`  - ${item}   (사본에 있음 → 되돌리면 다시 들어감)\n`);
  }
  for (const name of diff.outside) process.stdout.write(`범위 밖 구역 ${name}: 안전 정책 사본에 없어 건드리지 않고 보존합니다.\n`);
}

function audit(action, detail) {
  mkdirSync(join(root, 'artifacts'), { recursive: true });
  // 감사 기록은 지우거나 덮어쓰지 않고 한 줄씩 덧붙이기만 합니다. 메모 본문·토큰은 적지 않습니다.
  appendFileSync(AUDIT_LOG, `${new Date().toISOString()} ${action} ${detail}\n`, 'utf8');
}

function readTestPolicy() {
  if (!existsSync(TEST_POLICY)) stop('시험 정책 사본(artifacts/policy-test.json)이 없습니다. 먼저 npm run policy -- tamper 를 실행해 주세요.');
  const test = readJson(TEST_POLICY);
  if (!test?.policy || typeof test.policy !== 'object') stop('시험 정책 사본의 형식이 맞지 않아 중단합니다.');
  return test;
}

// 제작 2 확인용 가상 요청: B가 A의 메모까지 담긴 전체 목록을 요청 · A가 자기 메모 한 건을 요청.
// 메모 주인 비교(B의 GET /api/notes/<A 메모> → 404)는 판정기가 아니라 api/notes.js가 합니다.
async function accessChecks(zoneRoutes) {
  const { decideWithPolicy } = await import(new URL('../src/decider.mjs', import.meta.url).href);
  const base = {
    schema: 'aleph.decision.v1', classId: 'class_fixture', projectId: 'project_fixture', deviceId: 'b'.repeat(16),
    queryLength: 0, querySha256: sha256(''), at: new Date().toISOString(), policyRevision: 1, deviceRegistered: true,
    stepUp: { verified: false, authAgeSeconds: null }, recentEvents: [],
    signals: { source: 'none', region: 'unknown', network: 'unknown', hour: null }, service: 'notes', method: 'GET',
  };
  const bList = await decideWithPolicy({ ...base, requestId: randomUUID(), subjectId: 'learner_b_fixture',
    path: '/notes', route: 'GET /notes' }, zoneRoutes);
  const aOwn = await decideWithPolicy({ ...base, requestId: randomUUID(), subjectId: 'learner_a_fixture',
    path: '/notes/a-note-fixture', route: 'GET /notes/:id' }, zoneRoutes);
  return [
    { name: 'B가 A 메모가 담긴 전체 목록(GET /notes) 요청', expected: 'deny', got: bList.decision },
    { name: 'A가 자기 메모 한 건(GET /notes/:id) 요청', expected: 'allow', got: aOwn.decision },
  ];
}

function printChecks(label, checks, badWord = '확인 필요') {
  for (const item of checks) {
    process.stdout.write(`${item.got === item.expected ? '통과' : badWord} · ${label} · ${item.name} → ${item.got} (기대 ${item.expected})\n`);
  }
}

const commands = {
  // 제작 1: 지금 운영 정책을 그대로 사본으로 만들고 해시를 남깁니다. 이미 있으면 덮어쓰지 않습니다.
  async snapshot() {
    if (existsSync(BACKUP) || existsSync(BACKUP_HASH)) stop('안전 정책 사본이 이미 있어 덮어쓰지 않습니다. verify로 확인해 주세요.');
    const backup = { schema: 'vault.safety-policy.v1', version: VERSION,
      sources: ['src/decider.mjs RULE_IDS·resource_zone 경로', 'aleph.config.json allowedRoutes', 'DB public.notes 권한·RLS(5단계)'],
      policy: await livePolicy() };
    const text = `${JSON.stringify(backup, null, 2)}\n`;
    mkdirSync(join(root, 'backup'), { recursive: true });
    writeFileSync(BACKUP, text, { encoding: 'utf8', flag: 'wx' });
    writeFileSync(BACKUP_HASH, `${sha256(text)}  safety-policy.json\n`, { encoding: 'utf8', flag: 'wx' });
    process.stdout.write(`안전 정책 사본 생성: backup/safety-policy.json · ${VERSION} · 해시 ${sha256(text).slice(0, 12)}…\n`);
  },
  // 사본을 다시 읽어 해시를 대조하고, 지금 운영 정책과 같은지 봅니다.
  async verify() {
    const { backup, hash } = readVerifiedBackup();
    process.stdout.write(`해시 일치: ${backup.version} (${hash.slice(0, 12)}…)\n`);
    const diff = policyDiff(backup.policy, await livePolicy());
    process.stdout.write(diff.changes.length || diff.outside.length
      ? '운영 정책이 사본과 다릅니다. 아래 차이를 확인해 주세요.\n' : '운영 정책이 사본과 같습니다.\n');
    if (diff.changes.length || diff.outside.length) { printDiff(diff, backup.version, hash); process.exitCode = 1; }
  },
  // 시험용 사본 하나를 만들고 규칙 한 줄을 일부러 바꿔 침공을 흉내 냅니다(내 메모 구역에 ID 없는 전체 목록 열기).
  async tamper() {
    const { backup, hash } = readVerifiedBackup();
    const test = { schema: 'vault.policy-test.v1', basedOn: backup.version, note: '시험용 사본입니다. 운영 정책이 아닙니다.',
      policy: clone(backup.policy) };
    test.policy.zoneRoutes.notes = [...test.policy.zoneRoutes.notes, 'GET /notes'].sort();
    mkdirSync(join(root, 'artifacts'), { recursive: true });
    writeFileSync(TEST_POLICY, `${JSON.stringify(test, null, 2)}\n`, 'utf8');
    audit('policy_tamper_simulated', `base=${backup.version} group=zoneRoutes.notes added="GET /notes"`);
    process.stdout.write('시험 정책 사본 생성: artifacts/policy-test.json (규칙 한 줄 변경: zoneRoutes.notes + "GET /notes")\n');
    printDiff(policyDiff(backup.policy, test.policy), backup.version, hash);
  },
  // 검증한 사본과 시험 정책의 차이만 보여 줍니다.
  async diff() {
    const { backup, hash } = readVerifiedBackup();
    printDiff(policyDiff(backup.policy, readTestPolicy().policy), backup.version, hash);
  },
  // 제작 2: 시험 정책을 검증한 버전으로 되돌립니다. --yes가 없으면 바뀔 항목만 보여 주고 끝냅니다.
  // 사본에 있는 구역 중 달라진 구역만 사본 값으로 바꾸고, 범위 밖 구역(다른 서비스 규칙)과 감사 기록은 보존합니다.
  async restore(args) {
    const { backup, hash } = readVerifiedBackup();
    const test = readTestPolicy();
    const diff = policyDiff(backup.policy, test.policy);
    printDiff(diff, backup.version, hash);
    printChecks('되돌리기 전', await accessChecks(test.policy.zoneRoutes), '침공 흔적');
    if (!diff.changes.length) { process.stdout.write('되돌릴 항목이 없습니다.\n'); return; }
    if (!args.includes('--yes')) {
      process.stdout.write('아직 바꾸지 않았습니다. 위 항목을 확인한 뒤 npm run policy -- restore --yes 로 실행하세요.\n');
      return;
    }
    const restored = clone(test);
    const verifiedGroups = groups(backup.policy);
    for (const { group } of diff.changes) {
      const [top, ...rest] = group.split('.');
      const inner = rest.join('.');
      if (inner) {
        restored.policy[top] = { ...(restored.policy[top] ?? {}), [inner]: clone(verifiedGroups[group]) };
      } else {
        restored.policy[top] = clone(verifiedGroups[group]);
      }
    }
    restored.restoredFrom = backup.version;
    writeFileSync(TEST_POLICY, `${JSON.stringify(restored, null, 2)}\n`, 'utf8');
    audit('policy_restored', `to=${backup.version} hash=${hash.slice(0, 12)} groups=${diff.changes.map(item => item.group).join(',')} kept=${diff.outside.join(',') || '-'}`);
    const after = policyDiff(backup.policy, restored.policy);
    process.stdout.write(`되돌림 완료: ${diff.changes.map(item => item.group).join(', ')} → ${backup.version}. 남은 차이 ${after.changes.length}개\n`);
    const checks = await accessChecks(restored.policy.zoneRoutes);
    printChecks('되돌린 뒤', checks);
    if (after.changes.length || checks.some(item => item.got !== item.expected)) process.exitCode = 1;
  },
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [name, ...args] = process.argv.slice(2);
  try {
    if (!Object.hasOwn(commands, name ?? '')) stop('사용법: npm run policy -- snapshot | verify | tamper | diff | restore [--yes]');
    await commands[name](args);
  } catch (error) {
    process.stderr.write(`안전 정책 첫 오류: ${error.message}\n`);
    process.exitCode = 1;
  }
}
