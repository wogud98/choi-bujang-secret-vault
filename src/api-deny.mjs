// 8단계: 자료 API의 거부 응답과 짧은 거부 사유 기록을 한곳에서 만듭니다.
// 로그에는 사유 코드와 구역만 남기고 사용자 ID·토큰·자료 본문은 남기지 않습니다.
export function deny(response, status, error, reason, zone) {
  console.info(`api_denied zone=${zone} reason=${reason}`);
  response.status(status).json({ error });
}

// 강사 권한은 요청 본문·화면 메뉴의 role이 아니라 서버에 저장된 목록에서만 읽습니다.
// Vercel 환경변수 INSTRUCTOR_USER_IDS(쉼표로 구분한 Supabase 사용자 UUID)가 없으면 아무도 강사가 아닙니다.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
export function isStoredInstructor(login) {
  if (!login || login.kind !== 'student' || typeof login.userId !== 'string') return false;
  const ids = (process.env.INSTRUCTOR_USER_IDS ?? '').split(',').map(item => item.trim().toLowerCase())
    .filter(item => UUID.test(item));
  return ids.includes(login.userId.toLowerCase());
}
