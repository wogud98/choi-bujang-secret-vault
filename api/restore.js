import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import config from '../aleph.config.json' with { type: 'json' };
import { createLoginVerifier } from '../src/verify-login.mjs';
import { ZONES } from '../src/resources.mjs';
import { deny } from '../src/api-deny.mjs';
import { requireDevice } from '../src/device-proof.mjs';

// 10단계: 비공개 가상 메모 사본(Supabase public.note_snapshots)에서 복원 대상 한 건만 되살리는 경로입니다.
// 경로: POST /api/restore  본문은 비우거나 {"id": "<복원 대상 ID>"}만 받습니다.
// - 로그인 토큰을 검사하고, 토큰의 사용자 ID가 사본의 owner_id와 같을 때만 복원합니다(남이면 404).
// - 사본의 ID·소유자·내용 해시(title + 줄바꿈 + content의 SHA-256)를 다시 계산해 맞을 때만 씁니다.
// - 대상 note_id 한 행만 고치거나(변조) 다시 넣고(삭제), 다른 메모·사본·감사 기록은 건드리지 않습니다.
// - 사본 테이블은 service_role에도 읽기 권한만 있으므로 이 경로가 사본을 바꿀 수 없습니다.
// 응답과 로그에는 메모 본문·토큰·사용자 ID를 넣지 않고 ID와 해시만 남깁니다.
// 11단계: 학생 로그인은 승인된 기기의 요청 서명이 있어야 복원합니다(src/device-proof.mjs).
export const RESTORE_TARGET_ID = 'b0000010-0000-4000-8000-00000000000b';

let verifyLogin;

const sha256 = text => createHash('sha256').update(text, 'utf8').digest('hex');
const contentHash = row => sha256(`${row.title}\n${row.content}`);

function readJson(request) {
  if (request.body === undefined || request.body === null || request.body === '') return {};
  if (typeof request.body === 'string') {
    try { return JSON.parse(request.body); } catch { return null; }
  }
  return typeof request.body === 'object' ? request.body : null;
}

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    response.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
    return;
  }
  const url = process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  let projectUrl;
  try { projectUrl = new URL(url); } catch { projectUrl = null; }
  if (!secretKey || !projectUrl || projectUrl.protocol !== 'https:' || projectUrl.pathname !== '/'
      || !projectUrl.hostname.endsWith('.supabase.co')) {
    response.status(500).json({ error: 'RESTORE_API_NOT_CONFIGURED' });
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
    deny(response, 401, 'LOGIN_REQUIRED', 'login_not_verified', ZONES.notes);
    return;
  }
  const supabase = createClient(projectUrl.origin, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  if (!await requireDevice({ request, response, login, path: '/api/restore', supabase, zone: ZONES.notes, deny })) return;
  const input = readJson(request);
  if (!input || Array.isArray(input) || typeof input !== 'object'
      || Object.keys(input).some(key => key !== 'id')
      || (input.id !== undefined && typeof input.id !== 'string')) {
    deny(response, 400, 'INVALID_RESTORE_REQUEST', 'body_not_allowed', ZONES.notes);
    return;
  }
  // 복원 대상은 README에 적은 한 건뿐입니다. 다른 ID는 있는지 없는지 알리지 않고 404입니다.
  if (input.id !== undefined && input.id.toLowerCase() !== RESTORE_TARGET_ID) {
    deny(response, 404, 'SNAPSHOT_NOT_FOUND', 'not_restore_target', ZONES.notes);
    return;
  }

  let result;
  try {
    const { data: snapshot, error: snapshotError } = await supabase.from('note_snapshots')
      .select('note_id, owner_id, title, content, content_sha256')
      .eq('note_id', RESTORE_TARGET_ID).eq('owner_id', login.userId).maybeSingle();
    if (snapshotError) throw new Error('snapshot_read');
    if (!snapshot) {
      deny(response, 404, 'SNAPSHOT_NOT_FOUND', 'not_owner_or_missing', ZONES.notes);
      return;
    }
    // 사본 자체를 먼저 검증합니다. ID·소유자·내용 해시 중 하나라도 다르면 아무것도 쓰지 않고 멈춥니다.
    const snapshotHash = contentHash(snapshot);
    if (snapshot.note_id !== RESTORE_TARGET_ID || snapshot.owner_id !== login.userId
        || snapshot.content_sha256 !== snapshotHash) {
      console.error(`restore_stopped note=${RESTORE_TARGET_ID} reason=snapshot_hash_mismatch`);
      response.status(409).json({ error: 'SNAPSHOT_HASH_MISMATCH' });
      return;
    }
    const notes = () => supabase.from('notes');
    const { data: live, error: liveError } = await notes().select('note_id, owner_id, title, content')
      .eq('note_id', RESTORE_TARGET_ID).maybeSingle();
    if (liveError) throw new Error('live_read');
    let action;
    if (live && live.owner_id !== snapshot.owner_id) {
      // 같은 ID를 다른 사람이 쓰고 있으면 남의 메모를 덮어쓰지 않습니다.
      console.error(`restore_stopped note=${RESTORE_TARGET_ID} reason=owner_conflict`);
      response.status(409).json({ error: 'RESTORE_OWNER_CONFLICT' });
      return;
    }
    if (live && contentHash(live) === snapshotHash) {
      action = 'unchanged';
    } else if (live) {
      const { error } = await notes().update({ title: snapshot.title, content: snapshot.content })
        .eq('note_id', RESTORE_TARGET_ID).eq('owner_id', snapshot.owner_id);
      if (error) throw new Error('update');
      action = 'updated';
    } else {
      const { error } = await notes().insert({ note_id: RESTORE_TARGET_ID, owner_id: snapshot.owner_id,
        title: snapshot.title, content: snapshot.content });
      if (error) throw new Error('insert');
      action = 'reinserted';
    }
    // 복원 뒤 다시 읽어 ID·소유자·내용 해시가 사본과 같은지 확인합니다.
    const { data: after, error: afterError } = await notes().select('note_id, owner_id, title, content')
      .eq('note_id', RESTORE_TARGET_ID).eq('owner_id', snapshot.owner_id).maybeSingle();
    if (afterError || !after) throw new Error('verify');
    const afterHash = contentHash(after);
    result = { id: after.note_id, action, ownerMatches: after.owner_id === snapshot.owner_id,
      contentSha256: afterHash, snapshotSha256: snapshotHash, matches: afterHash === snapshotHash };
  } catch {
    console.error('restore_request_failed');
    response.status(502).json({ error: 'RESTORE_REQUEST_FAILED' });
    return;
  }
  console.info(`restore_done note=${result.id} action=${result.action} match=${result.matches}`);
  response.status(result.matches && result.ownerMatches ? 200 : 409).json(result);
}
