import { createHash, createPublicKey, verify } from 'node:crypto';

// 11단계: 설치형 웹앱의 기기 승인과 요청 서명 검사.
// 브라우저는 페이지를 열 때마다 내보낼 수 없는(non-extractable) P-256 기기 키를 메모리에만 만들고,
// 공개키만 서버에 보내 승인을 요청합니다. 개인키·토큰은 localStorage·sessionStorage·IndexedDB에 넣지 않습니다.
// 승인은 버튼이 아니라 관리자가 Supabase에서 public.devices의 상태를 'approved'로 바꿀 때만 생깁니다.
// 보호 요청은 「방법·경로·본문 해시·시각·기기 ID」를 기기 키로 서명해야 하며, 서버는 경로와 본문을
// 자기가 실제로 받은 값으로 다시 만들어 검사합니다. 그래서 서명 뒤 경로나 본문을 바꾸면 거부됩니다.
// 앱이 설치되었다는 표시(display-mode, 서비스 워커)는 어떤 검사에도 쓰지 않습니다.

export const DEVICE_ID = /^[0-9a-f]{16}$/u;
export const SIGNATURE_VERSION = 'aleph.device.v1';
const SIGNATURE = /^[A-Za-z0-9_-]{86}$/u; // P-256 r||s 64바이트의 base64url
const COORD = /^[A-Za-z0-9_-]{43}$/u; // P-256 좌표 32바이트의 base64url
const MAX_SKEW_MS = 60_000;
export const DEVICE_TTL_HOURS = 12;

const sha256 = value => createHash('sha256').update(value, 'utf8').digest('hex');

// 공개키는 {kty, crv, x, y} 네 칸만 받습니다. 개인키 칸(d)이 섞이면 거부합니다.
export function readPublicKey(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const keys = Object.keys(input).sort();
  if (keys.join(',') !== 'crv,kty,x,y' || input.kty !== 'EC' || input.crv !== 'P-256'
      || !COORD.test(input.x) || !COORD.test(input.y)) return null;
  const jwk = { crv: 'P-256', kty: 'EC', x: input.x, y: input.y };
  try { createPublicKey({ key: jwk, format: 'jwk' }); } catch { return null; }
  return jwk;
}

// 기기 ID = 정렬한 공개키 JSON의 SHA-256 앞 16자리. 화면과 서버가 같은 방법으로 계산합니다.
export function deviceIdFor(jwk) {
  return sha256(JSON.stringify({ crv: jwk.crv, kty: jwk.kty, x: jwk.x, y: jwk.y })).slice(0, 16);
}

// 서명할 문자열. 화면(public/index.html)과 같은 순서·줄바꿈을 씁니다.
export function signedText({ method, path, bodySha256, timestamp, deviceId }) {
  return [SIGNATURE_VERSION, method, path, bodySha256, timestamp, deviceId].join('\n');
}

// 서버가 받은 본문을 다시 문자열로 만듭니다. GET·DELETE는 본문을 쓰지 않으므로 빈 문자열입니다.
export function bodyText(request) {
  if (!['POST', 'PUT', 'PATCH'].includes(request.method)) return '';
  const body = request.body;
  if (body === undefined || body === null || body === '') return '';
  if (typeof body === 'string') return body;
  if (Buffer.isBuffer(body)) return body.toString('utf8');
  return JSON.stringify(body);
}

function header(request, name) {
  const value = request.headers?.[name];
  return typeof value === 'string' ? value : null;
}

// 반환값: {ok:true, deviceId} 또는 {ok:false, status, error, reason}.
// path는 각 서버 함수가 실제로 처리하는 자원 경로(예: /api/notes/<id>)입니다. 요청 헤더의 값을 믿지 않습니다.
export async function checkDeviceProof({ request, path, userId, supabase, now = Date.now() }) {
  const deviceId = header(request, 'x-aleph-device');
  const timestamp = header(request, 'x-aleph-timestamp');
  const signature = header(request, 'x-aleph-signature');
  if (!deviceId && !timestamp && !signature) {
    return { ok: false, status: 403, error: 'DEVICE_SIGNATURE_REQUIRED', reason: 'device_signature_missing' };
  }
  if (!DEVICE_ID.test(deviceId ?? '') || !/^\d{13}$/u.test(timestamp ?? '') || !SIGNATURE.test(signature ?? '')) {
    return { ok: false, status: 403, error: 'DEVICE_SIGNATURE_INVALID', reason: 'device_signature_malformed' };
  }
  if (Math.abs(now - Number(timestamp)) > MAX_SKEW_MS) {
    return { ok: false, status: 403, error: 'DEVICE_SIGNATURE_INVALID', reason: 'device_signature_expired' };
  }
  let row;
  try {
    const { data, error } = await supabase.from('devices')
      .select('device_id, owner_id, public_key, status, expires_at')
      .eq('device_id', deviceId).eq('owner_id', userId).maybeSingle();
    if (error) throw new Error('read');
    row = data;
  } catch {
    return { ok: false, status: 502, error: 'DEVICE_CHECK_FAILED', reason: 'device_lookup_failed' };
  }
  if (!row || row.status !== 'approved' || !(Date.parse(row.expires_at) > now)) {
    return { ok: false, status: 403, error: 'DEVICE_NOT_APPROVED', reason: 'device_not_approved' };
  }
  const jwk = readPublicKey(row.public_key);
  if (!jwk || deviceIdFor(jwk) !== deviceId) {
    return { ok: false, status: 403, error: 'DEVICE_NOT_APPROVED', reason: 'device_key_mismatch' };
  }
  const text = signedText({ method: request.method, path, bodySha256: sha256(bodyText(request)), timestamp, deviceId });
  let valid = false;
  try {
    valid = verify('sha256', Buffer.from(text, 'utf8'),
      { key: createPublicKey({ key: jwk, format: 'jwk' }), dsaEncoding: 'ieee-p1363' },
      Buffer.from(signature, 'base64url'));
  } catch {
    valid = false;
  }
  if (!valid) {
    return { ok: false, status: 403, error: 'DEVICE_SIGNATURE_INVALID', reason: 'device_signature_mismatch' };
  }
  return { ok: true, deviceId };
}

// 학생 로그인은 기기 서명이 있어야 합니다. 운영 심판 토큰은 반 엔진이 기기를 먼저 확인한 요청이므로
// 학생 기기 서명 형식을 요구하지 않습니다(심판 토큰은 운영 측 서명 키로만 만들어집니다).
export async function requireDevice({ request, response, login, path, supabase, zone, deny }) {
  if (login.kind !== 'student') return true;
  const result = await checkDeviceProof({ request, path, userId: login.userId, supabase });
  if (result.ok) return true;
  deny(response, result.status, result.error, result.reason, zone);
  return false;
}
