import { createClient } from '@supabase/supabase-js';

// 2단계: 학습용 Supabase 테이블의 가상 메모를 서버에서만 읽습니다.
// 서버 전용 키는 Vercel 환경변수에서만 읽고, 응답·로그·브라우저 파일에 넣지 않습니다.
// 3단계 전까지 이 함수는 로그인 없이 누구나 부를 수 있는 공개 주소입니다.
export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    response.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
    return;
  }
  const url = process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secretKey) {
    response.status(500).json({ error: 'NOTES_API_NOT_CONFIGURED' });
    return;
  }
  const supabase = createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.from('notes')
    .select('title, content, sample_marker').order('id', { ascending: true });
  if (error || !Array.isArray(data)) {
    console.error('notes_read_failed');
    response.status(502).json({ error: 'NOTES_READ_FAILED' });
    return;
  }
  response.status(200).json({
    sampleMarker: data[0]?.sample_marker ?? null,
    notes: data.map(({ title, content }) => ({ title, content })),
  });
}
