import { readFileSync } from 'node:fs';

// The student changes this check as each stage adds an attack to the same app.
// Never return tokens, private keys, real names, or note bodies.
function appUrl(config) {
  let app;
  try {
    app = new URL(config.publicAppUrl);
  } catch {
    throw new Error('aleph.config.json의 실제 배포 주소를 먼저 넣어 주세요.');
  }
  if (app.protocol !== 'https:' || app.username || app.password || app.search || app.hash
      || app.pathname !== '/' || app.hostname.endsWith('.example')) {
    throw new Error('aleph.config.json의 실제 배포 주소를 먼저 넣어 주세요.');
  }
  if (typeof config.sampleMarker !== 'string' || !config.sampleMarker) throw new Error('가상 메모의 확인 표시를 넣어 주세요.');
  return app;
}

// 실제로 보낸 비로그인 요청의 결과만 적습니다. 요청이 닿지 않으면 미실행으로 남깁니다.
async function anonymousRead(app, path, marker) {
  let response;
  try {
    response = await fetch(new URL(path, app), { redirect: 'error', signal: AbortSignal.timeout(10000) });
  } catch {
    return { ran: false };
  }
  let visible = false;
  if (response.ok) {
    try {
      const data = await response.json();
      visible = data?.sampleMarker === marker && Array.isArray(data.notes) && data.notes.length > 0;
    } catch {
      // A non-JSON response is not a visible note list.
    }
  }
  return { ran: true, status: response.status, visible };
}

const NOT_RUN = '미실행: 이 환경에서 배포 주소로 요청이 닿지 않음';

// 3단계: 로그인 토큰 없이(또는 서명이 맞지 않는 토큰으로) 자료 API를 부릅니다.
// 실제 로그인 토큰은 쓰지 않으므로 정상 A 로그인 결과는 여기서 확인하지 않습니다.
const PROBE_ID = '00000000-0000-4000-8000-000000000000';
function forgedToken(config) {
  const part = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  return `${part({ alg: 'HS256', typ: 'JWT' })}.${part({ iss: config.identityProvider?.issuer,
    aud: config.identityProvider?.audience, role: 'authenticated', sub: PROBE_ID,
    iat: now, exp: now + 300 })}.${Buffer.from('not-a-real-signature').toString('base64url')}`;
}
async function apiProbe(app, method, path, authorization) {
  let response;
  try {
    response = await fetch(new URL(path, app), {
      method, redirect: 'error', signal: AbortSignal.timeout(10000),
      headers: { ...(authorization ? { Authorization: authorization } : {}),
        ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}) },
      body: method === 'POST' ? JSON.stringify({ title: '점검', body: '비로그인 추가 시도' }) : undefined,
    });
  } catch {
    return { ran: false };
  }
  let leaked = false;
  try {
    const data = await response.json();
    leaked = Array.isArray(data) || typeof data?.id === 'string' || Array.isArray(data?.notes);
  } catch {
    // A non-JSON response carries no note list.
  }
  return { ran: true, status: response.status, leaked };
}
const probeResult = (probe, label) => (!probe.ran ? NOT_RUN
  : `${label} 요청 결과 HTTP ${probe.status}, ${probe.leaked ? '자료 또는 메모 ID가 응답에 포함됨' : '자료 없음'}`);

// 4단계: 공개용 publishable(anon) 키로 Supabase Data API의 notes 테이블을 직접 읽어 봅니다.
// 5단계부터는 aleph.config.json의 originalApiUrl(쿼리 없는 원본 자료 경로)로 같은 요청을 보냅니다.
// 키는 화면 코드에 이미 공개된 값을 public/index.html에서 읽고, 결과에는 적지 않습니다.
// authenticated 역할의 직접 접근은 심판이 재현할 수 없어 점검하지 않습니다.
function publishableKey() {
  try {
    const page = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
    return /\bsb_publishable_[A-Za-z0-9_-]{8,}/u.exec(page)?.[0] ?? null;
  } catch {
    return null;
  }
}
async function anonDataApi(config) {
  const key = publishableKey();
  let target;
  try {
    target = config.originalApiUrl ? new URL(config.originalApiUrl)
      : new URL('/rest/v1/notes', new URL(config.identityProvider?.issuer).origin);
    target.search = 'select=note_id&limit=1';
  } catch { target = null; }
  if (!key || !target) return { ran: false };
  let response;
  try {
    response = await fetch(target, {
      redirect: 'error', signal: AbortSignal.timeout(10000),
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
  } catch {
    return { ran: false };
  }
  let rows = null;
  try {
    const data = await response.json();
    if (Array.isArray(data)) rows = data.length;
  } catch {
    // A non-JSON response carries no rows.
  }
  return { ran: true, status: response.status, rows };
}

// 4단계 교차 사용자 점검(선택): 학생이 터미널 환경변수로 B의 로그인 토큰과 A의 메모 ID를 줄 때만 실행합니다.
// 토큰은 요청 헤더에만 쓰고 결과·로그에 남기지 않습니다. 남의 메모를 바꿀 수 있는 DELETE는 보내지 않고,
// PUT은 owner_id를 끼워 넣은 본문으로 보내 서버가 DB에 닿기 전에 거부하는지만 봅니다.
async function crossUserProbe(app, method, path, token, body) {
  let response;
  try {
    response = await fetch(new URL(path, app), {
      method, redirect: 'error', signal: AbortSignal.timeout(10000),
      headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    return { ran: false };
  }
  let leaked = false;
  try {
    const data = await response.json();
    leaked = typeof data?.id === 'string' || typeof data?.body === 'string';
  } catch {
    // A non-JSON response carries no note.
  }
  return { ran: true, status: response.status, leaked };
}
const CROSS_NOT_RUN = '미실행: ALEPH_CHECK_TOKEN_B·ALEPH_CHECK_NOTE_A 환경변수가 없어 교차 사용자 요청을 보내지 않음';

export async function runAttackChecks(config) {
  // 5단계는 4단계 점검을 그대로 보내고, anon 키 직접 요청만 originalApiUrl로 보냅니다.
  if (config.step === 4 || config.step === 5) {
    const app = appUrl(config);
    const list = await apiProbe(app, 'GET', '/api/notes');
    const one = await apiProbe(app, 'GET', `/api/notes/${PROBE_ID}`);
    const forged = await apiProbe(app, 'GET', '/api/notes', `Bearer ${forgedToken(config)}`);
    const direct = await anonDataApi(config);
    const tokenB = process.env.ALEPH_CHECK_TOKEN_B;
    const noteA = process.env.ALEPH_CHECK_NOTE_A;
    const cross = tokenB && /^[0-9a-f-]{36}$/iu.test(noteA ?? '');
    const readA = cross ? await crossUserProbe(app, 'GET', `/api/notes/${noteA}`, tokenB) : { ran: false };
    const takeA = cross ? await crossUserProbe(app, 'PUT', `/api/notes/${noteA}`, tokenB,
      { title: '점검', body: '소유자 변경 시도', owner_id: PROBE_ID }) : { ran: false };
    return [
      { attackId: 'anonymous_notes_list', expected: '토큰 없는 GET /api/notes는 401로 거부되고 자료가 없음',
        observed: probeResult(list, '토큰 없는 GET /api/notes') },
      { attackId: 'anonymous_note_read_by_id', expected: '토큰 없는 GET /api/notes/:id는 401로 거부됨',
        observed: probeResult(one, '토큰 없는 GET /api/notes/:id') },
      { attackId: 'forged_token_notes_list', expected: '서명이 맞지 않는 토큰의 GET /api/notes는 401로 거부됨',
        observed: probeResult(forged, '위조 토큰 GET /api/notes') },
      { attackId: 'anon_key_direct_data_api', expected: 'anon 키로 Data API의 notes를 직접 읽으면 권한 오류로 거부되고 행이 없음',
        observed: !direct.ran ? '미실행: 이 환경에서 Supabase Data API로 요청이 닿지 않음'
          : `anon 키 직접 GET /rest/v1/notes 결과 HTTP ${direct.status}, ${direct.rows ? `${direct.rows}행 보임` : '행 없음'}` },
      { attackId: 'cross_user_note_read', expected: 'B 토큰으로 A 메모 ID를 GET하면 404로 거부되고 메모가 없음',
        observed: !readA.ran ? (cross ? NOT_RUN : CROSS_NOT_RUN)
          : `B 토큰 GET /api/notes/<A 메모> 결과 HTTP ${readA.status}, ${readA.leaked ? 'A 메모가 응답에 포함됨' : '자료 없음'}` },
      { attackId: 'cross_user_owner_change', expected: 'owner_id를 넣은 PUT은 400으로 거부되고 메모가 바뀌지 않음',
        observed: !takeA.ran ? (cross ? NOT_RUN : CROSS_NOT_RUN)
          : `B 토큰 PUT /api/notes/<A 메모>(owner_id 포함) 결과 HTTP ${takeA.status}, ${takeA.leaked ? '메모가 응답에 포함됨' : '자료 없음'}` },
    ];
  }
  if (config.step === 3) {
    const app = appUrl(config);
    const list = await apiProbe(app, 'GET', '/api/notes');
    const create = await apiProbe(app, 'POST', '/api/notes');
    const one = await apiProbe(app, 'GET', `/api/notes/${PROBE_ID}`);
    const forged = await apiProbe(app, 'GET', '/api/notes', `Bearer ${forgedToken(config)}`);
    return [
      { attackId: 'anonymous_notes_list', expected: '토큰 없는 GET /api/notes는 401로 거부되고 자료가 없음',
        observed: probeResult(list, '토큰 없는 GET /api/notes') },
      { attackId: 'anonymous_note_create', expected: '토큰 없는 POST /api/notes는 401로 거부되고 메모가 만들어지지 않음',
        observed: probeResult(create, '토큰 없는 POST /api/notes') },
      { attackId: 'anonymous_note_read_by_id', expected: '토큰 없는 GET /api/notes/:id는 401로 거부됨',
        observed: probeResult(one, '토큰 없는 GET /api/notes/:id') },
      { attackId: 'forged_token_notes_list', expected: '서명이 맞지 않는 토큰의 GET /api/notes는 401로 거부됨',
        observed: probeResult(forged, '위조 토큰 GET /api/notes') },
    ];
  }
  if (config.step === 2) {
    const app = appUrl(config);
    const staticRead = await anonymousRead(app, '/data.json', config.sampleMarker);
    const apiRead = await anonymousRead(app, '/api/notes', config.sampleMarker);
    return [
      { attackId: 'anonymous_static_data_json', expected: '비로그인 /data.json 요청에서 가상 메모가 보이지 않음',
        observed: !staticRead.ran ? NOT_RUN : staticRead.visible
          ? `비로그인 /data.json 요청에서 공개 가상 메모 확인 표시가 보임 (HTTP ${staticRead.status})`
          : `비로그인 /data.json 요청에서 확인 표시가 보이지 않음 (HTTP ${staticRead.status})` },
      { attackId: 'anonymous_notes_api', expected: '남은 약점: 3단계 전까지 비로그인 /api/notes 요청에서 가상 메모가 보임',
        observed: !apiRead.ran ? NOT_RUN : apiRead.visible
          ? `비로그인 /api/notes 요청에서 가상 메모 확인 표시가 보임 (HTTP ${apiRead.status})`
          : `비로그인 /api/notes 요청에서 확인 표시가 보이지 않음 (HTTP ${apiRead.status})` },
    ];
  }
  if (config.step !== 1) throw new Error('이 단계의 공격 점검을 src/attack-check.mjs에 구현해 주세요.');
  const app = appUrl(config);
  const response = await fetch(new URL('/data.json', app), {
    redirect: 'error', signal: AbortSignal.timeout(10000),
  });
  let visible = false;
  if (response.ok) {
    try {
      const data = await response.json();
      visible = data?.sampleMarker === config.sampleMarker && Array.isArray(data.notes)
        && data.notes.length > 0;
    } catch {
      // A non-JSON response is a failed check, not a successful deployment.
    }
  }
  return [{ attackId: 'anonymous_note_read', expected: '비로그인 화면에서 가상 메모를 확인',
    observed: visible ? '비로그인 요청에서 공개 가상 메모 확인 표시가 보임' : `비로그인 요청에서 확인 표시가 보이지 않음 (HTTP ${response.status})` }];
}
