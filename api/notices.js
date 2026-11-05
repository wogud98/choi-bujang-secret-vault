import { createClient } from '@supabase/supabase-js';
import config from '../aleph.config.json' with { type: 'json' };
import { createLoginVerifier } from '../src/verify-login.mjs';
import { NOTICES, ZONES, resourceId } from '../src/resources.mjs';
import { deny } from '../src/api-deny.mjs';
import { requireDevice } from '../src/device-proof.mjs';

// 8단계: 강사 공지(반 공지) 구역. 경로: GET /api/notices, GET /api/notices/:id (vercel.json이 :id를 ?id=로 넘김).
// 각 공지에는 'notices:<공지 ID>' 자원 ID를 붙여 내 메모('notes:…')와 구별합니다.
// 로그인 검사는 /api/notes와 같은 src/verify-login.mjs를 씁니다.
// 8단계 제작 3: 공지는 검증된 로그인 사용자 누구나 읽기만 합니다. 쓰기는 강사를 포함해 이 API에서 모두 거부합니다
// (요청 본문·메뉴의 role은 보지 않음). 강사의 공지 수정은 서버 쪽 관리 작업(src/resources.mjs)에서만 합니다.
// 11단계: 학생 로그인은 승인된 기기의 요청 서명이 있어야 읽습니다(src/device-proof.mjs).
let verifyLogin;

const toNotice = (item) => ({ id: item.id, resourceId: resourceId(ZONES.notices, item.id), title: item.title, body: item.body });

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  const rawId = request.query?.id;
  const id = typeof rawId === 'string' && rawId ? rawId : null;
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    deny(response, 405, 'NOTICES_READ_ONLY', 'notice_write_blocked', ZONES.notices);
    return;
  }
  const secretKey = process.env.SUPABASE_SECRET_KEY;
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
    deny(response, 401, 'LOGIN_REQUIRED', 'login_not_verified', ZONES.notices);
    return;
  }
  let supabase = null;
  if (login.kind === 'student') {
    let projectUrl;
    try { projectUrl = new URL(process.env.SUPABASE_URL); } catch { projectUrl = null; }
    if (!projectUrl || projectUrl.protocol !== 'https:' || !projectUrl.hostname.endsWith('.supabase.co')) {
      response.status(500).json({ error: 'DEVICE_CHECK_NOT_CONFIGURED' });
      return;
    }
    supabase = createClient(projectUrl.origin, process.env.SUPABASE_SECRET_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  const path = id ? `/api/notices/${id}` : '/api/notices';
  if (!await requireDevice({ request, response, login, path, supabase, zone: ZONES.notices, deny })) return;
  if (!id) {
    response.status(200).json(NOTICES.map(toNotice));
    return;
  }
  const item = NOTICES.find(notice => notice.id === id);
  if (!item) {
    deny(response, 404, 'NOTICE_NOT_FOUND', 'notice_missing', ZONES.notices);
    return;
  }
  response.status(200).json(toNotice(item));
}
