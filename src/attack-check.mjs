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

export async function runAttackChecks(config) {
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
