import { createClient } from '@supabase/supabase-js';
import config from '../aleph.config.json' with { type: 'json' };
import { createLoginVerifier } from '../src/verify-login.mjs';
import { ZONES, resourceId } from '../src/resources.mjs';
import { deny, isStoredInstructor } from '../src/api-deny.mjs';
import { requireDevice } from '../src/device-proof.mjs';

// 8단계 제작 3: 강사 자료 구역. 경로: GET /api/materials 하나.
// 판정기(src/decider.mjs)는 이 구역을 모두 거부하고, 이 API도 서버에 저장된 강사 목록(INSTRUCTOR_USER_IDS)에
// 검증된 사용자 ID가 있을 때만 엽니다. 요청 본문·쿼리·화면 메뉴의 role은 보지 않습니다.
// 11단계: 학생 로그인은 승인된 기기의 요청 서명이 있어야 읽습니다(src/device-proof.mjs).
let verifyLogin;

// 가상 강사 자료입니다. 실제 시험 문제·실명·개인정보는 넣지 않습니다.
const MATERIALS = Object.freeze([
  Object.freeze({ id: 'material-01', title: '[가상 강사 자료] 채점 기준 초안', body: '가상 자료입니다.' }),
]);

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    deny(response, 405, 'METHOD_NOT_ALLOWED', 'material_write_blocked', ZONES.materials);
    return;
  }
  let login = null;
  try {
    verifyLogin ??= createLoginVerifier({ config, supabaseSecretKey: process.env.SUPABASE_SECRET_KEY });
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
    deny(response, 401, 'LOGIN_REQUIRED', 'login_not_verified', ZONES.materials);
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
  const path = '/api/materials';
  if (!await requireDevice({ request, response, login, path, supabase, zone: ZONES.materials, deny })) return;
  if (!isStoredInstructor(login)) {
    deny(response, 403, 'INSTRUCTOR_ONLY', 'not_stored_instructor', ZONES.materials);
    return;
  }
  response.status(200).json(MATERIALS.map(item => ({ id: item.id,
    resourceId: resourceId(ZONES.materials, item.id), title: item.title, body: item.body })));
}
