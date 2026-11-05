// 11단계 로컬 연습: 기기 서명 검사(src/device-proof.mjs)를 가짜 DB로 확인합니다.
// 실제 배포·심판 판정이 아니며, 키는 이 실행 중 메모리에서만 만들고 버립니다.
import { webcrypto } from 'node:crypto';
import { checkDeviceProof, deviceIdFor, signedText } from '../src/device-proof.mjs';

const { subtle } = webcrypto;
const hex = async text => Buffer.from(await subtle.digest('SHA-256', new TextEncoder().encode(text))).toString('hex');
const pair = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']);
const jwk = await subtle.exportKey('jwk', pair.publicKey);
const publicKey = { crv: jwk.crv, kty: jwk.kty, x: jwk.x, y: jwk.y };
const deviceId = deviceIdFor(publicKey);
const owner = '00000000-0000-4000-8000-000000000001';
const noteA = 'a0000000-0000-4000-8000-00000000000a';
const noteB = 'a0000000-0000-4000-8000-00000000000b';

function fakeDb(status) {
  const row = { device_id: deviceId, owner_id: owner, public_key: publicKey, status,
    expires_at: new Date(Date.now() + 3600_000).toISOString() };
  const query = { filters: {} };
  query.select = () => query;
  query.eq = (key, value) => { query.filters[key] = value; return query; };
  query.maybeSingle = async () => ({ error: null,
    data: query.filters.device_id === row.device_id && query.filters.owner_id === row.owner_id ? row : null });
  return { from: () => { query.filters = {}; return query; } };
}

async function signed(method, path, body) {
  const timestamp = String(Date.now());
  const text = signedText({ method, path, bodySha256: await hex(body), timestamp, deviceId });
  const signature = Buffer.from(await subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, pair.privateKey,
    new TextEncoder().encode(text))).toString('base64url');
  return { 'x-aleph-device': deviceId, 'x-aleph-timestamp': timestamp, 'x-aleph-signature': signature };
}

const body = JSON.stringify({ title: '가상 제목', body: '가상 내용' });
const cases = [
  { name: '승인된 기기의 서명된 수정 요청', status: 'approved', expect: true,
    request: { method: 'PUT', headers: await signed('PUT', `/api/notes/${noteA}`, body), body: JSON.parse(body) },
    path: `/api/notes/${noteA}` },
  { name: '서명 없는 보호 요청', status: 'approved', expect: 'device_signature_missing',
    request: { method: 'GET', headers: {} }, path: '/api/notes' },
  { name: '서명 뒤 요청 경로 변경', status: 'approved', expect: 'device_signature_mismatch',
    request: { method: 'GET', headers: await signed('GET', `/api/notes/${noteA}`, '') }, path: `/api/notes/${noteB}` },
  { name: '서명 뒤 수정 본문 변경', status: 'approved', expect: 'device_signature_mismatch',
    request: { method: 'PUT', headers: await signed('PUT', `/api/notes/${noteA}`, body),
      body: { title: '가상 제목', body: '바꾼 내용' } }, path: `/api/notes/${noteA}` },
  { name: '승인 대기 기기의 서명된 요청', status: 'pending', expect: 'device_not_approved',
    request: { method: 'GET', headers: await signed('GET', '/api/notes', '') }, path: '/api/notes' },
];

let failed = 0;
for (const item of cases) {
  const result = await checkDeviceProof({ request: item.request, path: item.path, userId: owner, supabase: fakeDb(item.status) });
  const pass = item.expect === true ? result.ok : !result.ok && result.reason === item.expect;
  if (!pass) failed += 1;
  console.log(`${pass ? '통과' : '실패'} · ${item.name}${result.ok ? '' : ` → ${result.status} ${result.reason}`}`);
}
console.log('이 명령은 가짜 DB로 한 연습이며 배포 주소나 심판 판정의 증거가 아닙니다.');
if (failed) process.exitCode = 1;
