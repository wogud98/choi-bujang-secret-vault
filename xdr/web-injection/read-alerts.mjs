// 확인용 읽기 모듈입니다. decide.mjs 는 이 파일을 불러오지 않습니다.
// xdr/fixtures/web-injection.json 의 Wazuh 경보에서 시각·출발 주소·계정·규칙 수준·설명만 뽑습니다.
// 원본 경보는 읽기만 하고, 비밀값처럼 보이는 문자열은 [가림] 으로 바꿔 출력합니다.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const FIXTURE = new URL('../fixtures/web-injection.json', import.meta.url);

const SECRET_LIKE = [
  /(password|passwd|pwd|secret|token|api[_-]?key|authorization|bearer)\s*[:=]\s*\S+/gi,
  /eyJ[\w-]+\.[\w-]+\.[\w-]+/g, // JWT 모양
  /\b(sk|pk|sb)_[\w-]{12,}\b/g, // 서버·공개 키 모양
  /\b[a-f0-9]{32,}\b/gi, // 긴 16진수 지문·키 모양
];

export function maskSecrets(text) {
  let out = String(text ?? '');
  for (const pattern of SECRET_LIKE) out = out.replace(pattern, '[가림]');
  return out;
}

export function pickFields(alert) {
  return {
    id: maskSecrets(alert?.id),
    timestamp: maskSecrets(alert?.timestamp),
    srcip: maskSecrets(alert?.data?.srcip),
    srcuser: maskSecrets(alert?.data?.srcuser),
    level: Number(alert?.rule?.level ?? 0),
    description: maskSecrets(alert?.rule?.description),
  };
}

export async function readAlerts(path = FIXTURE) {
  const fixture = JSON.parse(await readFile(path, 'utf8'));
  const alerts = Array.isArray(fixture?.alerts) ? fixture.alerts : [];
  return { total: alerts.length, rows: alerts.map(pickFields) };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { total, rows } = await readAlerts();
  for (const r of rows) {
    console.log([r.id, r.timestamp, r.srcip, r.srcuser, `level ${r.level}`, r.description].join(' | '));
  }
  console.log(`경보 ${total}건, 뽑은 줄 ${rows.length}줄${total === rows.length ? ' (같음)' : ' (다름)'}`);
}
