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
// 12단계: 심판 격리 환경에서는 공개 HTTPS 주소로 GET·HEAD만 보낼 수 있습니다.
// 쓰기 요청(POST·PUT 등)이 필요한 점검은 보내지 않고 미실행으로 기록합니다.
const READ_METHODS = new Set(['GET', 'HEAD']);
const WRITE_SKIPPED = Object.freeze({ ran: false, write: true });
const WRITE_NOT_RUN = '미실행: 쓰기 요청(POST·PUT)이 필요한 점검이라 보내지 않음';

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
  if (!READ_METHODS.has(method)) return WRITE_SKIPPED;
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
const probeResult = (probe, label) => (!probe.ran ? (probe.write ? WRITE_NOT_RUN : NOT_RUN)
  : `${label} 요청 결과 HTTP ${probe.status}, ${probe.leaked ? '자료 또는 메모 ID가 응답에 포함됨' : '자료 없음'}`);

// 4단계: 공개용 publishable(anon) 키로 Supabase Data API의 notes 테이블을 직접 읽어 봅니다.
// 5단계부터는 aleph.config.json의 originalApiUrl(쿼리 없는 원본 자료 경로)로 같은 요청을 보냅니다.
// 5단계 가점부터 화면 코드에는 공개 키가 없으므로, 학생이 터미널 환경변수 ALEPH_CHECK_ANON_KEY에
// Supabase의 publishable(anon) 키를 줄 때만 보냅니다. 키는 요청 헤더에만 쓰고 결과에는 적지 않습니다.
// authenticated 역할의 직접 접근은 심판이 재현할 수 없어 점검하지 않습니다.
function publishableKey() {
  const key = process.env.ALEPH_CHECK_ANON_KEY?.trim();
  return key && /^(?:sb_publishable_[A-Za-z0-9_-]{8,}|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/u.test(key) ? key : null;
}
async function anonDataApi(config) {
  const key = publishableKey();
  let target;
  try {
    target = config.originalApiUrl ? new URL(config.originalApiUrl)
      : new URL('/rest/v1/notes', new URL(config.identityProvider?.issuer).origin);
    target.search = 'select=note_id&limit=1';
  } catch { target = null; }
  if (!key) return { ran: false, reason: 'no_key' };
  if (!target) return { ran: false };
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
  if (!READ_METHODS.has(method)) return WRITE_SKIPPED;
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
    leaked = (Array.isArray(data) && data.length > 0) || typeof data?.id === 'string' || typeof data?.body === 'string';
  } catch {
    // A non-JSON response carries no note.
  }
  return { ran: true, status: response.status, leaked };
}
// 10단계: 복구 경로 POST /api/restore를 부릅니다. B 토큰이 있을 때만 실제 복원을 요청하고,
// 응답의 ID·소유자 일치·내용 해시 일치만 적습니다(본문·토큰은 적지 않음).
async function restoreProbe(app, authorization) {
  // POST /api/restore는 쓰기 요청이므로 보내지 않습니다(아래 코드는 직접 시험할 때를 위해 남김).
  if (!READ_METHODS.has('POST')) return WRITE_SKIPPED;
  let response;
  try {
    response = await fetch(new URL('/api/restore', app), {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10000),
      headers: { ...(authorization ? { Authorization: authorization } : {}), 'Content-Type': 'application/json' },
      body: '{}',
    });
  } catch {
    return { ran: false };
  }
  let data = null;
  try { data = await response.json(); } catch { data = null; }
  return { ran: true, status: response.status, id: typeof data?.id === 'string' ? data.id : null,
    action: typeof data?.action === 'string' ? data.action : null,
    matches: data?.matches === true && data?.ownerMatches === true
      && typeof data?.contentSha256 === 'string' && data.contentSha256 === data.snapshotSha256 };
}
// 11단계: 기기 승인 경로를 토큰 없이 부르고, B 토큰이 있으면 기기 서명 없는 보호 요청을 보냅니다.
// 기기 개인키는 화면 메모리에만 있으므로 이 점검은 서명된 요청을 만들지 않습니다(경로·본문 변조는 npm run device:test 연습).
async function deviceProbe(app, method, path, authorization) {
  if (!READ_METHODS.has(method)) return WRITE_SKIPPED;
  let response;
  try {
    response = await fetch(new URL(path, app), {
      method, redirect: 'error', signal: AbortSignal.timeout(10000),
      headers: { ...(authorization ? { Authorization: authorization } : {}),
        ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}) },
      body: method === 'POST' ? JSON.stringify({ publicKey: { kty: 'EC', crv: 'P-256', x: 'A'.repeat(43), y: 'A'.repeat(43) } }) : undefined,
    });
  } catch {
    return { ran: false };
  }
  let data = null;
  try { data = await response.json(); } catch { data = null; }
  return { ran: true, status: response.status, error: typeof data?.error === 'string' ? data.error : null,
    leaked: Array.isArray(data) && data.length > 0 };
}
const CROSS_NOT_RUN = '미실행: ALEPH_CHECK_TOKEN_B·ALEPH_CHECK_NOTE_A 환경변수가 없어 교차 사용자 요청을 보내지 않음';

export async function runAttackChecks(config) {
  // 5단계는 4단계 점검을 그대로 보내고, anon 키 직접 요청만 originalApiUrl로 보냅니다.
  // 6단계는 기기 조건을 판정기에만 넣었으므로 자료실 주소 점검은 5단계와 같습니다. 미등록 기기 공격은 심판이 맡습니다.
  // 7단계는 복합 이상 접속 규칙을 판정기에만 넣었으므로 자료실 주소 점검은 6단계와 같습니다. 가상 접속 사건은 심판이 보냅니다.
  // 8단계는 같은 점검에 구역 점검을 더합니다: 강사 자료를 토큰 없이·B 토큰으로 읽기, 반 공지 쓰기(본문에 role 끼워 넣기).
  // 10단계는 아래처럼 복구 경로 점검 세 개를 먼저 보낸 뒤 9단계와 같은 점검을 다시 보냅니다.
  // 9단계는 탐지 규칙(burst_read)을 src/detect.mjs에만 넣었으므로 자료실 주소 점검은 8단계와 같습니다. 폭주 조회 사건은 심판이 보냅니다.
  // 10단계는 먼저 복구 경로를 부르고(토큰 없음·위조 토큰·선택 B 토큰), 복구 직후 1~9단계 대표 점검을 그대로 다시 보냅니다.
  // 11단계는 기기 승인 점검 세 개를 먼저 보내고 10단계 점검을 그대로 보냅니다. 학생 B 토큰 요청은 기기 서명이 없으므로
  // 11단계부터 403(DEVICE_SIGNATURE_REQUIRED)이 정상 거부입니다.
  // 12단계는 탈환 작전실 경로 GET /api/ops 점검(토큰 없음·위조 토큰·선택 서명 없는 B 토큰)을 먼저 보내고 11단계 점검을 그대로 보냅니다.
  // 화면의 「1~12단계 실측 표」는 로그인·승인 기기가 필요한 정상 요청까지 보내며, 이 점검은 터미널에서 보낼 수 있는 것만 보냅니다.
  if (config.step >= 4 && config.step <= 12) {
    const app = appUrl(config);
    const device = config.step >= 11;
    const deviceChecks = [];
    if (device) {
      const register = await deviceProbe(app, 'POST', '/api/devices');
      const status = await deviceProbe(app, 'GET', `/api/devices/${'0'.repeat(16)}`);
      const tokenBForDevice = process.env.ALEPH_CHECK_TOKEN_B;
      const unsigned = tokenBForDevice ? await deviceProbe(app, 'GET', '/api/notes', `Bearer ${tokenBForDevice}`) : { ran: false };
      deviceChecks.push(
        { attackId: 'device_request_anonymous', expected: '토큰 없는 POST /api/devices는 401로 거부되고 기기가 등록되지 않음',
          observed: !register.ran ? register.write ? WRITE_NOT_RUN : NOT_RUN : `토큰 없는 POST /api/devices 결과 HTTP ${register.status}` },
        { attackId: 'device_status_anonymous', expected: '토큰 없는 GET /api/devices/:id는 401로 거부됨',
          observed: !status.ran ? NOT_RUN : `토큰 없는 GET /api/devices/:id 결과 HTTP ${status.status}` },
        { attackId: 'device_unsigned_protected_request', expected: '기기 서명 없는 B 토큰 GET /api/notes는 403으로 거부되고 자료가 없음',
          observed: !unsigned.ran ? (tokenBForDevice ? NOT_RUN : '미실행: ALEPH_CHECK_TOKEN_B 환경변수가 없어 서명 없는 B 토큰 요청을 보내지 않음')
            : `서명 없는 B 토큰 GET /api/notes 결과 HTTP ${unsigned.status}${unsigned.error ? ` ${unsigned.error}` : ''}, ${unsigned.leaked ? '자료가 응답에 포함됨' : '자료 없음'}` },
      );
    }
    const opsChecks = [];
    if (config.step >= 12) {
      const anonOps = await deviceProbe(app, 'GET', '/api/ops');
      const forgedOps = await deviceProbe(app, 'GET', '/api/ops', `Bearer ${forgedToken(config)}`);
      const tokenBForOps = process.env.ALEPH_CHECK_TOKEN_B;
      const unsignedOps = tokenBForOps ? await deviceProbe(app, 'GET', '/api/ops', `Bearer ${tokenBForOps}`) : { ran: false };
      const opsObserved = (probe, label) => `${label} GET /api/ops 결과 HTTP ${probe.status}${probe.error ? ` ${probe.error}` : ''}`;
      opsChecks.push(
        { attackId: 'ops_summary_anonymous', expected: '토큰 없는 GET /api/ops는 401로 거부되고 작전실 요약이 없음',
          observed: !anonOps.ran ? NOT_RUN : opsObserved(anonOps, '토큰 없는') },
        { attackId: 'ops_summary_forged_token', expected: '서명이 맞지 않는 토큰의 GET /api/ops는 401로 거부됨',
          observed: !forgedOps.ran ? NOT_RUN : opsObserved(forgedOps, '위조 토큰') },
        { attackId: 'ops_summary_unsigned_device', expected: '기기 서명 없는 B 토큰 GET /api/ops는 403으로 거부됨',
          observed: !unsignedOps.ran ? (tokenBForOps ? NOT_RUN : '미실행: ALEPH_CHECK_TOKEN_B 환경변수가 없어 서명 없는 B 토큰 요청을 보내지 않음')
            : opsObserved(unsignedOps, '서명 없는 B 토큰') },
      );
    }
    const restoreChecks = [];
    if (config.step >= 10) {
      const anon = await restoreProbe(app);
      const forged = await restoreProbe(app, `Bearer ${forgedToken(config)}`);
      const tokenBForRestore = process.env.ALEPH_CHECK_TOKEN_B;
      const own = tokenBForRestore ? await restoreProbe(app, `Bearer ${tokenBForRestore}`) : { ran: false };
      restoreChecks.push(
        { attackId: 'restore_anonymous', expected: '토큰 없는 POST /api/restore는 401로 거부되고 복원되지 않음',
          observed: !anon.ran ? anon.write ? WRITE_NOT_RUN : NOT_RUN : `토큰 없는 POST /api/restore 결과 HTTP ${anon.status}${anon.id ? ', 복원 응답이 옴' : ', 복원 없음'}` },
        { attackId: 'restore_forged_token', expected: '서명이 맞지 않는 토큰의 POST /api/restore는 401로 거부됨',
          observed: !forged.ran ? forged.write ? WRITE_NOT_RUN : NOT_RUN : `위조 토큰 POST /api/restore 결과 HTTP ${forged.status}${forged.id ? ', 복원 응답이 옴' : ', 복원 없음'}` },
        { attackId: 'restore_b_target_note', expected: device
            ? '기기 서명 없는 B 토큰 POST /api/restore는 403으로 거부되고 복원하지 않음(11단계부터 승인된 기기에서만 복원)'
            : 'B 토큰 POST /api/restore는 200이고 복구 대상의 ID·소유자·내용 해시가 사본과 같음',
          observed: !own.ran ? own.write ? WRITE_NOT_RUN : (tokenBForRestore ? NOT_RUN : '미실행: ALEPH_CHECK_TOKEN_B 환경변수가 없어 B 토큰 복원 요청을 보내지 않음')
            : `B 토큰 POST /api/restore 결과 HTTP ${own.status}, ID ${own.id ?? '없음'}, 동작 ${own.action ?? '없음'}, 사본과 ${own.matches ? '일치' : '불일치'}` },
      );
    }
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
    const zone = config.step >= 8;
    const materialsAnon = zone ? await apiProbe(app, 'GET', '/api/materials') : null;
    const noticeWrite = zone ? await crossUserProbe(app, 'POST', '/api/notices', tokenB ?? forgedToken(config),
      { title: '점검', body: '공지 쓰기 시도', role: 'instructor' }) : null;
    const materialsB = zone && tokenB ? await crossUserProbe(app, 'GET', '/api/materials', tokenB) : { ran: false };
    const zoneChecks = !zone ? [] : [
      { attackId: 'anonymous_instructor_materials', expected: '토큰 없는 GET /api/materials는 401로 거부되고 자료가 없음',
        observed: probeResult(materialsAnon, '토큰 없는 GET /api/materials') },
      { attackId: 'notice_write_with_role', expected: '본문에 role을 넣은 POST /api/notices는 405로 거부됨(공지는 읽기만)',
        observed: !noticeWrite.ran ? noticeWrite.write ? WRITE_NOT_RUN : NOT_RUN
          : `${tokenB ? 'B 토큰' : '위조 토큰'} POST /api/notices(role 포함) 결과 HTTP ${noticeWrite.status}, ${noticeWrite.leaked ? '자료가 응답에 포함됨' : '자료 없음'}` },
      { attackId: 'student_reads_instructor_materials', expected: device
          ? '기기 서명 없는 B 토큰의 GET /api/materials는 403으로 거부됨'
          : '강사로 저장되지 않은 B 토큰의 GET /api/materials는 403으로 거부됨',
        observed: !materialsB.ran ? (tokenB ? NOT_RUN : '미실행: ALEPH_CHECK_TOKEN_B 환경변수가 없어 B 토큰 요청을 보내지 않음')
          : `B 토큰 GET /api/materials 결과 HTTP ${materialsB.status}, ${materialsB.leaked ? '자료가 응답에 포함됨' : '자료 없음'}` },
    ];
    return [
      ...opsChecks,
      ...deviceChecks,
      ...restoreChecks,
      { attackId: 'anonymous_notes_list', expected: '토큰 없는 GET /api/notes는 401로 거부되고 자료가 없음',
        observed: probeResult(list, '토큰 없는 GET /api/notes') },
      { attackId: 'anonymous_note_read_by_id', expected: '토큰 없는 GET /api/notes/:id는 401로 거부됨',
        observed: probeResult(one, '토큰 없는 GET /api/notes/:id') },
      { attackId: 'forged_token_notes_list', expected: '서명이 맞지 않는 토큰의 GET /api/notes는 401로 거부됨',
        observed: probeResult(forged, '위조 토큰 GET /api/notes') },
      { attackId: 'anon_key_direct_data_api', expected: 'anon 키로 Data API의 notes를 직접 읽으면 권한 오류로 거부되고 행이 없음',
        observed: !direct.ran ? (direct.reason === 'no_key'
          ? '미실행: ALEPH_CHECK_ANON_KEY 환경변수가 없어 anon 키 직접 요청을 보내지 않음'
          : '미실행: 이 환경에서 Supabase Data API로 요청이 닿지 않음')
          : `anon 키 직접 GET /rest/v1/notes 결과 HTTP ${direct.status}, ${direct.rows ? `${direct.rows}행 보임` : '행 없음'}` },
      { attackId: 'cross_user_note_read', expected: device
          ? 'B 토큰(기기 서명 없음)으로 A 메모 ID를 GET하면 403으로 거부되고 메모가 없음'
          : 'B 토큰으로 A 메모 ID를 GET하면 404로 거부되고 메모가 없음',
        observed: !readA.ran ? (cross ? NOT_RUN : CROSS_NOT_RUN)
          : `B 토큰 GET /api/notes/<A 메모> 결과 HTTP ${readA.status}, ${readA.leaked ? 'A 메모가 응답에 포함됨' : '자료 없음'}` },
      { attackId: 'cross_user_owner_change', expected: device
          ? 'owner_id를 넣은 B 토큰 PUT(기기 서명 없음)은 403으로 거부되고 메모가 바뀌지 않음'
          : 'owner_id를 넣은 PUT은 400으로 거부되고 메모가 바뀌지 않음',
        observed: !takeA.ran ? takeA.write ? WRITE_NOT_RUN : (cross ? NOT_RUN : CROSS_NOT_RUN)
          : `B 토큰 PUT /api/notes/<A 메모>(owner_id 포함) 결과 HTTP ${takeA.status}, ${takeA.leaked ? '메모가 응답에 포함됨' : '자료 없음'}` },
      ...zoneChecks,
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
