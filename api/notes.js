import { createClient } from '@supabase/supabase-js';
import config from '../aleph.config.json' with { type: 'json' };
import { createLoginVerifier } from '../src/verify-login.mjs';

// 2단계: 학습용 Supabase 테이블의 가상 메모를 서버에서만 읽습니다.
// 서버 전용 키는 Vercel 환경변수에서만 읽고, 응답·로그·브라우저 파일에 넣지 않습니다.
// 3단계: 요청의 Authorization 토큰을 시작 틀의 src/verify-login.mjs로 검사한 뒤에만 자료를 다룹니다.
// 사용자 번호·역할은 브라우저가 보낸 값을 쓰지 않고, 검사를 통과한 토큰에서만 얻습니다.
// 경로: GET·POST /api/notes, GET·PUT·DELETE /api/notes/:id (vercel.json이 :id를 ?id=로 넘김).
// 남은 약점: 한 건 읽기·수정·삭제는 아직 소유자를 확인하지 않습니다. 4단계에서 막습니다.
let verifyLogin;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const MAX_TITLE = 200;
const MAX_BODY = 5000;

const toNote = (row) => ({ id: row.note_id, title: row.title, body: row.content });

function readJson(request) {
  if (typeof request.body === 'string') {
    try { return JSON.parse(request.body); } catch { return null; }
  }
  return request.body && typeof request.body === 'object' ? request.body : null;
}

function validText(value, max) {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= max;
}

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  const rawId = request.query?.id;
  const id = typeof rawId === 'string' && rawId ? rawId : null;
  const allowed = id ? ['GET', 'PUT', 'DELETE'] : ['GET', 'POST'];
  if (!allowed.includes(request.method)) {
    response.setHeader('Allow', allowed.join(', '));
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
  if (id && !UUID.test(id)) {
    response.status(404).json({ error: 'NOTE_NOT_FOUND' });
    return;
  }

  let input = null;
  if (request.method === 'POST' || request.method === 'PUT') {
    input = readJson(request);
    if (!input || !validText(input.title, MAX_TITLE) || !validText(input.body, MAX_BODY)
        || (request.method === 'POST' && input.id !== undefined
          && (typeof input.id !== 'string' || !UUID.test(input.id)))) {
      response.status(400).json({ error: 'INVALID_NOTE' });
      return;
    }
  }

  let status = 200;
  let result;
  try {
    const supabase = createClient(projectUrl.origin, secretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const notes = () => supabase.from('notes');
    if (request.method === 'GET' && !id) {
      // 목록은 서버가 확인한 로그인 사용자의 메모만 돌려줍니다.
      const { data, error } = await notes().select('note_id, title, content')
        .eq('owner_id', login.userId).order('id', { ascending: true });
      if (error || !Array.isArray(data)) throw new Error('read');
      result = data.map(toNote);
    } else if (request.method === 'POST') {
      // owner_id는 요청 본문이 아니라 검사를 통과한 토큰의 사용자 ID로 저장합니다.
      const row = { owner_id: login.userId, title: input.title, content: input.body };
      if (input.id !== undefined) row.note_id = input.id.toLowerCase();
      const { data, error } = await notes().insert(row).select('note_id').single();
      if (error?.code === '23505') {
        status = 409;
        result = { error: 'NOTE_ID_TAKEN' };
      } else {
        if (error || !data) throw new Error('insert');
        status = 201;
        result = { id: data.note_id };
      }
    } else if (request.method === 'GET') {
      const { data, error } = await notes().select('note_id, title, content')
        .eq('note_id', id.toLowerCase()).maybeSingle();
      if (error) throw new Error('read');
      if (data) result = toNote(data);
    } else if (request.method === 'PUT') {
      const { data, error } = await notes().update({ title: input.title, content: input.body })
        .eq('note_id', id.toLowerCase()).select('note_id, title, content').maybeSingle();
      if (error) throw new Error('update');
      if (data) result = toNote(data);
    } else {
      const { data, error } = await notes().delete()
        .eq('note_id', id.toLowerCase()).select('note_id').maybeSingle();
      if (error) throw new Error('delete');
      if (data) result = { id: data.note_id };
    }
  } catch {
    console.error('notes_request_failed');
    response.status(502).json({ error: 'NOTES_REQUEST_FAILED' });
    return;
  }
  if (result === undefined) {
    response.status(404).json({ error: 'NOTE_NOT_FOUND' });
    return;
  }
  response.status(status).json(result);
}
