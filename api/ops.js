import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import config from '../aleph.config.json' with { type: 'json' };
import { createLoginVerifier } from '../src/verify-login.mjs';
import { deny } from '../src/api-deny.mjs';
import { requireDevice } from '../src/device-proof.mjs';
import { deciderSummary, detectionSummary, policySummary, restoreSummary, revocationSummary } from '../src/ops-summary.mjs';

// 12단계 탈환 작전실: GET /api/ops
// 로그인 토큰을 검사하고, 학생 로그인은 승인된 기기의 요청 서명(경로 /api/ops)까지 맞아야 답합니다.
// 판정기·탐지 규칙은 학생 함수를 가상 요청으로 돌린 연습 결과, 회수 상태·복구 버전은 이 사용자의 DB 기록입니다.
// 운영 반 엔진의 실제 판정·사건 전달은 이 서버가 볼 수 없어 not_run으로 돌려줍니다.
// 응답과 로그에는 메모 제목·본문, 토큰, 사용자 ID를 넣지 않고 ID는 가립니다.
let verifyLogin;
const ZONE = 'ops';

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    response.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
    return;
  }
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  let projectUrl;
  try { projectUrl = new URL(process.env.SUPABASE_URL); } catch { projectUrl = null; }
  if (!secretKey || !projectUrl || projectUrl.protocol !== 'https:' || projectUrl.pathname !== '/'
      || !projectUrl.hostname.endsWith('.supabase.co')) {
    response.status(500).json({ error: 'OPS_API_NOT_CONFIGURED' });
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
  if (!await requireDevice({ request, response, login, path: '/api/ops', supabase, zone: ZONE, deny })) return;

  const vercelId = request.headers['x-vercel-id'];
  const requestId = typeof vercelId === 'string' && /^[A-Za-z0-9:_-]{1,128}$/u.test(vercelId) ? vercelId : randomUUID();
  const commit = typeof process.env.VERCEL_GIT_COMMIT_SHA === 'string'
    && /^[0-9a-f]{40}$/u.test(process.env.VERCEL_GIT_COMMIT_SHA) ? process.env.VERCEL_GIT_COMMIT_SHA : null;

  let revocation;
  try {
    const { data, error } = await supabase.from('devices').select('device_id, status, expires_at')
      .eq('owner_id', login.userId).order('created_at', { ascending: false }).limit(50);
    if (error || !Array.isArray(data)) throw new Error('devices');
    revocation = revocationSummary(data);
  } catch {
    console.error('ops_devices_failed');
    revocation = { state: 'error', reason: '기기 승인 표를 읽지 못함', records: [], counts: null };
  }

  let restore;
  try {
    const { data: snapshots, error } = await supabase.from('note_snapshots')
      .select('note_id, title, content, content_sha256').eq('owner_id', login.userId).limit(20);
    if (error || !Array.isArray(snapshots)) throw new Error('snapshots');
    let live = [];
    if (snapshots.length) {
      const { data, error: liveError } = await supabase.from('notes').select('note_id, title, content')
        .eq('owner_id', login.userId).in('note_id', snapshots.map(row => row.note_id));
      if (liveError || !Array.isArray(data)) throw new Error('notes');
      live = data;
    }
    restore = restoreSummary(snapshots, live);
  } catch {
    console.error('ops_restore_failed');
    restore = { state: 'error', reason: '메모 사본 표를 읽지 못함', records: [], counts: null };
  }

  const result = {
    schema: 'aleph.ops.v1', requestId, checkedAt: new Date().toISOString(), step: config.step, commit,
    login: login.kind,
    decider: await deciderSummary(),
    detection: detectionSummary(),
    revocation,
    restore: { ...restore, policy: policySummary(), route: config.restoreRoute ?? null },
  };
  console.info(`ops_summary devices=${revocation.records.length} snapshots=${restore.records.length}`);
  response.status(200).json(result);
}
