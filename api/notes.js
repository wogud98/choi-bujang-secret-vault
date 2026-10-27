import { createClient } from '@supabase/supabase-js';
import config from '../aleph.config.json' with { type: 'json' };
import { createLoginVerifier } from '../src/verify-login.mjs';

// 2단계: 학습용 Supabase 테이블의 가상 메모를 서버에서만 읽습니다.
// 서버 전용 키는 Vercel 환경변수에서만 읽고, 응답·로그·브라우저 파일에 넣지 않습니다.
// 3단계: 요청의 Authorization 토큰을 시작 틀의 src/verify-login.mjs로 검사한 뒤에만 자료를 줍니다.
// 사용자 번호·역할은 브라우저가 보낸 값을 쓰지 않고, 검사를 통과한 토큰에서만 얻습니다.
let verifyLogin;

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    response.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
    return;
  }
  const url = process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secretKey) {
    response.status(500).json({ error: 'NOTES_API_NOT_CONFIGURED' });
    return;
  }
  let projectUrl;
  try { projectUrl = new URL(url); } catch { projectUrl = null; }
  if (!projectUrl || projectUrl.protocol !== 'https:' || projectUrl.pathname !== '/'
      || !projectUrl.hostname.endsWith('.supabase.co')) {
    response.status(500).json({ error: 'NOTES_API_BAD_SUPABASE_URL' });
    return;
  }
  let login = null;
  try {
    verifyLogin ??= createLoginVerifier({ config, supabaseSecretKey: secretKey });
  } catch {
    console.error('login_verifier_not_configured');
    response.status(500).json({ error: 'LOGIN_NOT_CONFIGURED' });
    return;
  }
  try {
    login = await verifyLogin(request.headers.authorization);
  } catch {
    login = null;
  }
  if (!login) {
    response.setHeader('WWW-Authenticate', 'Bearer');
    response.status(401).json({ error: 'LOGIN_REQUIRED' });
    return;
  }
  let data;
  let error;
  try {
    const supabase = createClient(projectUrl.origin, secretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    ({ data, error } = await supabase.from('notes')
      .select('title, content, sample_marker').order('id', { ascending: true }));
  } catch {
    error = true;
  }
  if (error || !Array.isArray(data)) {
    console.error('notes_read_failed');
    response.status(502).json({ error: 'NOTES_READ_FAILED' });
    return;
  }
  response.status(200).json({
    sampleMarker: data[0]?.sample_marker ?? null,
    notes: data.map(({ title, content }) => ({ title, content })),
  });
}
