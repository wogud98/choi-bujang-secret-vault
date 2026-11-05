import { createClient } from '@supabase/supabase-js';
import config from '../aleph.config.json' with { type: 'json' };
import { createLoginVerifier } from '../src/verify-login.mjs';

// 5단계 가점: 로그인·로그아웃도 서버 함수가 맡아 화면 코드에 Supabase 공개 키를 두지 않습니다.
// POST /api/session {email, password} → 서버 전용 키로 Supabase Auth에 로그인하고 {accessToken, expiresAt}만 돌려줍니다.
// DELETE /api/session (Authorization: Bearer) → 검사를 통과한 토큰의 세션을 끊습니다.
// 비밀번호·토큰·서버 전용 키는 로그와 오류 응답에 남기지 않습니다. refresh token은 브라우저로 보내지 않습니다.
let verifyLogin;

const MAX_EMAIL = 320;
const MAX_PASSWORD = 1024;
const LOGIN_ERRORS = new Set(['invalid_credentials', 'email_not_confirmed', 'over_request_rate_limit', 'user_banned']);

function readJson(request) {
  if (typeof request.body === 'string') {
    try { return JSON.parse(request.body); } catch { return null; }
  }
  return request.body && typeof request.body === 'object' ? request.body : null;
}

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  if (!['POST', 'DELETE'].includes(request.method)) {
    response.setHeader('Allow', 'POST, DELETE');
    response.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
    return;
  }
  const url = process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  let projectUrl;
  try { projectUrl = new URL(url); } catch { projectUrl = null; }
  if (!secretKey || !projectUrl || projectUrl.protocol !== 'https:' || projectUrl.pathname !== '/'
      || !projectUrl.hostname.endsWith('.supabase.co')) {
    response.status(500).json({ error: 'LOGIN_NOT_CONFIGURED' });
    return;
  }
  const supabase = createClient(projectUrl.origin, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  if (request.method === 'POST') {
    const input = readJson(request);
    if (!input || Array.isArray(input) || Object.keys(input).some(key => !['email', 'password'].includes(key))
        || typeof input.email !== 'string' || !input.email.trim() || input.email.length > MAX_EMAIL
        || typeof input.password !== 'string' || !input.password || input.password.length > MAX_PASSWORD) {
      response.status(400).json({ error: 'INVALID_LOGIN' });
      return;
    }
    let result;
    try {
      result = await supabase.auth.signInWithPassword({ email: input.email.trim(), password: input.password });
    } catch {
      console.error('login_request_failed');
      response.status(502).json({ error: 'LOGIN_REQUEST_FAILED' });
      return;
    }
    const { data, error } = result;
    if (error || !data?.session?.access_token) {
      const code = LOGIN_ERRORS.has(error?.code) ? error.code : 'login_failed';
      response.status(code === 'over_request_rate_limit' ? 429 : 401).json({ error: code });
      return;
    }
    response.status(200).json({ accessToken: data.session.access_token, expiresAt: data.session.expires_at,
      email: data.user?.email ?? null });
    return;
  }

  // DELETE: 검사를 통과한 학생 로그인 토큰만 Supabase에서 세션을 끊습니다.
  let login = null;
  try {
    verifyLogin ??= createLoginVerifier({ config, supabaseSecretKey: secretKey });
    login = await verifyLogin(request.headers.authorization);
  } catch {
    login = null;
  }
  if (!login) {
    response.setHeader('WWW-Authenticate', 'Bearer');
    response.status(401).json({ error: 'LOGIN_REQUIRED' });
    return;
  }
  if (login.kind === 'student') {
    const token = request.headers.authorization.slice('Bearer '.length);
    const { error } = await supabase.auth.admin.signOut(token, 'local');
    if (error) {
      console.error('logout_request_failed');
      response.status(502).json({ error: 'LOGOUT_REQUEST_FAILED' });
      return;
    }
    // 12단계: 세션을 끊어도 이미 발급된 access token은 만료(exp) 전까지 서명 검사를 통과합니다.
    // 그래서 로그아웃할 때 이 사용자의 승인·대기 기기를 모두 'revoked'로 바꿔, 옛 토큰과 옛 기기 서명으로
    // 다시 보낸 보호 요청이 403(DEVICE_NOT_APPROVED)으로 막히게 합니다. 다른 기기도 다시 승인받아야 합니다.
    const { error: revokeError } = await supabase.from('devices').update({ status: 'revoked' })
      .eq('owner_id', login.userId).in('status', ['approved', 'pending']);
    if (revokeError) {
      console.error('logout_device_revoke_failed');
      response.status(502).json({ error: 'LOGOUT_DEVICE_REVOKE_FAILED' });
      return;
    }
    console.info('logout_devices_revoked');
  }
  response.status(204).end();
}
