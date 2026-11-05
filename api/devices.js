import { createClient } from '@supabase/supabase-js';
import config from '../aleph.config.json' with { type: 'json' };
import { createLoginVerifier } from '../src/verify-login.mjs';
import { deny } from '../src/api-deny.mjs';
import { DEVICE_ID, DEVICE_TTL_HOURS, checkDeviceProof, deviceIdFor, readPublicKey } from '../src/device-proof.mjs';

// 11단계: 기기 승인 요청과 결과 확인.
// POST /api/devices {publicKey:{kty,crv,x,y}} → 이 기기의 공개키를 '승인 대기'로 등록합니다. 승인은 만들지 않습니다.
// GET /api/devices/:id → 내 기기의 상태를 돌려줍니다. 'approved'일 때는 그 기기 키의 요청 서명까지 맞아야
// verified:true가 됩니다. 화면은 verified:true를 받은 뒤에만 자료실을 엽니다(자료 API도 따로 다시 검사).
// 승인은 관리자가 Supabase에서 public.devices의 status를 바꿀 때만 생깁니다. 이 API에는 승인 경로가 없습니다.
// 개인키·토큰·사용자 ID는 응답과 로그에 넣지 않습니다.
let verifyLogin;
const ZONE = 'devices';
const MAX_PENDING = 5;

function readJson(request) {
  if (typeof request.body === 'string') {
    try { return JSON.parse(request.body); } catch { return null; }
  }
  return request.body && typeof request.body === 'object' ? request.body : null;
}

function statusOf(row, now = Date.now()) {
  if (!row) return 'unknown';
  if (row.status === 'approved' || row.status === 'pending') {
    return Date.parse(row.expires_at) > now ? row.status : 'expired';
  }
  return row.status === 'revoked' ? 'revoked' : 'unknown';
}

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  const rawId = request.query?.id;
  const id = typeof rawId === 'string' && rawId ? rawId : null;
  const allowed = id ? ['GET'] : ['POST'];
  if (!allowed.includes(request.method)) {
    response.setHeader('Allow', allowed.join(', '));
    response.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
    return;
  }
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  let projectUrl;
  try { projectUrl = new URL(process.env.SUPABASE_URL); } catch { projectUrl = null; }
  if (!secretKey || !projectUrl || projectUrl.protocol !== 'https:' || projectUrl.pathname !== '/'
      || !projectUrl.hostname.endsWith('.supabase.co')) {
    response.status(500).json({ error: 'DEVICE_API_NOT_CONFIGURED' });
    return;
  }
  let login = null;
  try {
    verifyLogin ??= createLoginVerifier({ config, supabaseSecretKey: secretKey });
    login = await verifyLogin(request.headers.authorization);
  } catch {
    login = null;
  }
  if (!login) {
    response.setHeader('WWW-Authenticate', 'Bearer');
    deny(response, 401, 'LOGIN_REQUIRED', 'login_not_verified', ZONE);
    return;
  }
  const supabase = createClient(projectUrl.origin, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const devices = () => supabase.from('devices');

  if (request.method === 'POST') {
    const input = readJson(request);
    const publicKey = input && !Array.isArray(input) && Object.keys(input).join(',') === 'publicKey'
      ? readPublicKey(input.publicKey) : null;
    if (!publicKey) {
      deny(response, 400, 'INVALID_DEVICE_KEY', 'device_key_not_allowed', ZONE);
      return;
    }
    const deviceId = deviceIdFor(publicKey);
    try {
      // 끝난 승인 대기·승인 행은 지우고, 대기 중인 기기가 너무 많으면 새 요청을 받지 않습니다.
      const nowIso = new Date().toISOString();
      const { error: cleanError } = await devices().delete().eq('owner_id', login.userId).lt('expires_at', nowIso);
      if (cleanError) throw new Error('clean');
      const { data: existing, error: readError } = await devices()
        .select('device_id, owner_id, status, expires_at').eq('device_id', deviceId).maybeSingle();
      if (readError) throw new Error('read');
      if (existing) {
        if (existing.owner_id !== login.userId) {
          deny(response, 409, 'DEVICE_ID_TAKEN', 'device_other_owner', ZONE);
          return;
        }
        response.status(200).json({ deviceId, status: statusOf(existing), expiresAt: existing.expires_at });
        return;
      }
      const { count, error: countError } = await devices().select('device_id', { count: 'exact', head: true })
        .eq('owner_id', login.userId).eq('status', 'pending');
      if (countError) throw new Error('count');
      if ((count ?? 0) >= MAX_PENDING) {
        deny(response, 429, 'TOO_MANY_PENDING_DEVICES', 'device_pending_limit', ZONE);
        return;
      }
      const expiresAt = new Date(Date.now() + DEVICE_TTL_HOURS * 3600_000).toISOString();
      const { data, error } = await devices().insert({ device_id: deviceId, owner_id: login.userId,
        public_key: publicKey, status: 'pending', expires_at: expiresAt })
        .select('device_id, status, expires_at').single();
      if (error || !data) throw new Error('insert');
      console.info(`device_requested device=${deviceId}`);
      response.status(201).json({ deviceId, status: data.status, expiresAt: data.expires_at });
    } catch {
      console.error('device_request_failed');
      response.status(502).json({ error: 'DEVICE_REQUEST_FAILED' });
    }
    return;
  }

  if (!DEVICE_ID.test(id)) {
    deny(response, 404, 'DEVICE_NOT_FOUND', 'device_id_malformed', ZONE);
    return;
  }
  let row;
  try {
    const { data, error } = await devices().select('device_id, status, expires_at')
      .eq('device_id', id).eq('owner_id', login.userId).maybeSingle();
    if (error) throw new Error('read');
    row = data;
  } catch {
    console.error('device_status_failed');
    response.status(502).json({ error: 'DEVICE_REQUEST_FAILED' });
    return;
  }
  if (!row) {
    deny(response, 404, 'DEVICE_NOT_FOUND', 'not_owner_or_missing', ZONE);
    return;
  }
  const status = statusOf(row);
  let verified = false;
  if (status === 'approved') {
    // 승인 표시만 믿지 않고, 이 요청이 그 기기 키로 서명됐는지 다시 확인합니다.
    const proof = await checkDeviceProof({ request, path: `/api/devices/${id}`, userId: login.userId, supabase });
    verified = proof.ok;
    if (!proof.ok) console.info(`api_denied zone=${ZONE} reason=${proof.reason}`);
  }
  response.status(200).json({ deviceId: row.device_id, status, verified, expiresAt: row.expires_at });
}
