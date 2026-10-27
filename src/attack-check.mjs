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

export async function runAttackChecks(config) {
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
