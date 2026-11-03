# BYTE BACK 방어전 시작 틀 R5

이 저장소는 1단계에서 학생 본인이 GitHub 저장소와 Vercel 배포를 만드는 출발점입니다. 포함된 메모 네 건은 가상 자료입니다. 실제 학생 자료, 토큰, 비밀키를 넣지 마세요.

## 학생이 하는 일: 세 걸음

1. GitHub 계정을 만듭니다.
2. 방어전 1단계 카드의 **Deploy** 버튼을 누릅니다. Vercel에 GitHub로 로그인하고, 새 저장소가 **본인 계정의 Public 저장소**인지 확인한 뒤 Deploy를 누릅니다.
3. 배포가 끝나면 화면에 나온 `https://…vercel.app` 주소를 방어전 1단계 카드에 붙여넣고 제출합니다. 저장소 주소나 설정 파일은 적지 않습니다.

배포가 끝나면 `/`에서 점령된 가상 자료실을 볼 수 있습니다. `/data.json`에는 같은 가상 메모가 공개됩니다. 이 공개 상태를 확인하는 것이 1단계의 출발점입니다. 1단계 접수와 심판 판정은 포털에서 확인합니다.

## 시작 틀의 자동 처리

`vercel.json`은 정적 결과물 `public`을 배포합니다. 빌드 명령 `npm run build`는 Vercel이 제공하는 GitHub 저장소 소유자·이름, 커밋 SHA, 배포 URL을 검증하고 `public/aleph.json`을 생성합니다. 이 값이 없으면 빌드가 실패하므로, 성공한 것처럼 빈 주소를 내보내지 않습니다. `aleph.json`의 내용만으로 저장소 소유권이나 방어 성공을 인정하지 않습니다. 심판이 공개 저장소의 실제 커밋과 배포된 자료를 따로 대조해야 합니다.

`aleph.config.json`의 `repoUrl`과 `publicAppUrl`은 이전 제출 묶음 방식의 자리표시자입니다. 1단계에서는 학생이 편집하지 않습니다. 2단계 이후 코딩 도구가 필요한 설정과 보호 기능을 단계별로 작성합니다. `npm run bundle`과 `bundle-notes.json`도 1단계의 세 걸음에는 포함되지 않습니다.

로컬에서 가상 화면만 확인할 때는 `npm run build -- --local`을 사용합니다. 로컬 실행은 Vercel 배포나 심판 접수를 증명하지 않습니다. 저장소의 `src/attack-check.mjs`는 실제 배포가 된 뒤 `/data.json`을 비로그인으로 요청해 공개 가상 메모의 확인 표시를 읽습니다.

## 다음 단계의 코딩 도구에 전달할 규칙

[AGENTS.md](AGENTS.md)를 먼저 읽히고 한 번에 한 제작 단위만 요청하세요. 2단계부터는 자료 보호를 구현할 때 `public/data.json`을 복사하는 1단계 빌드 흐름도 함께 바꿔야 합니다. 3단계 이후의 로그인, 허용 경로, 5단계의 원본 API 주소, 6단계 이후 정책 규칙은 해당 단계 원고와 계약에 맞춰 추가합니다. 비밀번호·토큰·서버 전용 키·실제 학생 기록을 코드, Git, 제출 묶음에 넣지 않습니다.

`src/decider.mjs`와 `src/detect.mjs`의 로컬 시험은 반 엔진이나 운영 심판의 결과가 아닙니다. 1단계 이후 제출 묶음 계약 `aleph.defense.submission.v2`는 `scripts/bundle.mjs`에 남아 있으며, 코딩 도구가 해당 단계의 최신 배포 주소와 Git 원격을 맞춘 뒤 사용합니다.

## 8단계 저장점: 자료마다 갈 수 있는 구역을 나눕니다

- 자원 ID(제작 1): `src/resources.mjs`가 구역을 `notes`(내 메모)·`notices`(강사 공지)·`materials`(강사 자료)로 나눕니다. `/api/notes` 응답의 각 메모에 `resourceId: "notes:<메모 ID>"`를 더했고(기존 `id`·`title`·`body`와 주소는 그대로), 새 `GET /api/notices`·`GET /api/notices/:id`는 가상 공지 두 건을 `resourceId: "notices:<공지 ID>"`로 돌려줍니다. 화면 메뉴는 바꾸지 않았습니다.
- 판정기(제작 2) `resource_zone`: 구역별 정확한 경로만 허용합니다. 메모는 `GET·PUT·DELETE /notes/:id`(자료 ID 하나)만 허용하고 ID 없는 `GET /notes` 목록과 `POST /notes`는 거부합니다. 반 공지는 `GET /notices`·`GET /notices/:id`만 허용하고 쓰기는 누구에게나 거부합니다. 강사 자료는 모두 거부합니다. `path`가 `route` 모양과 깊이까지 같아야 하고(`/notes/abc/export` 거부), 쿼리가 붙은 요청(`queryLength` 0이 아님)도 거부합니다. 모르는 구역은 시작 틀 기본 거부(`starter.deny`)입니다. ID 형식은 좁히지 않고 메모 주인 비교는 API가 합니다. 거부 이유 코드 `resource_zone_denied`는 새 코드라 운영 등록부에 없으면 엔진이 어차피 거부합니다. 기존 `device_registered`(먼저)와 `step_up_required` 규칙은 그대로입니다.
- 자료 API(제작 3): 메뉴를 우회한 직접 요청도 서버가 다시 확인합니다. 메모는 검증된 토큰 사용자 ID와 DB의 `owner_id`가 같은 행만(남의 메모 404, 본문의 `role`·`owner_id` 400). 공지는 로그인한 사람 누구나 읽기만, 쓰기는 `405 NOTICES_READ_ONLY`. 새 `GET /api/materials`는 서버에 저장된 강사 목록(Vercel 환경변수 `INSTRUCTOR_USER_IDS`, 쉼표로 구분한 사용자 UUID)에 있을 때만 열고 아니면 `403 INSTRUCTOR_ONLY`입니다. 이 값이 없으면 아무도 강사가 아닙니다. 거부할 때는 `api_denied zone=… reason=…`만 로그에 남깁니다(사용자 ID·토큰·본문 없음).
- `aleph.config.json`: `step` 8, `allowedRoutes`는 판정기가 허용하는 경로만(`GET·PUT·DELETE /api/notes/:id`, `GET /api/notices`, `GET /api/notices/:id`). `judgeIssuer`는 그대로입니다. 이 저장소에는 엔진이 없어 화면의 메모 목록·추가(`GET·POST /api/notes`)와 로그인(`/api/session`)은 지금처럼 작동합니다. 엔진 앞에서 실제 구역 차단은 미실행입니다.
- `src/attack-check.mjs`: 7단계 점검에 토큰 없는 `GET /api/materials`, `role`을 넣은 `POST /api/notices`, (선택) B 토큰 `GET /api/materials`를 더했습니다.

### 8단계 확인 순서

1. `npm install`
2. `npm run decider:test` → 네 줄 모두 「통과」, `npm run fixture:7` → `allow`·`step_up`
3. 배포 주소 `/`에 A로 로그인 → 메모 읽기·추가·수정·삭제가 그대로 됨(정상)
4. `npm run bundle`(`bundle-notes.json` 필요) → 토큰 없는 `/api/materials` 401, 공지 쓰기 405, B 토큰 강사 자료 403이면 정상. 자료가 보이면 실패입니다.

## 7단계 저장점: 평소와 다른 접속은 다시 확인합니다

- 입력 검사(제작 1): `readSignals`는 엔진이 넘긴 `signals`의 출처가 `judge_fixture`이고 `network`·`hour`가 계약 모양일 때만 믿습니다. 실제 경로의 `none`, 모르는 출처(예: 브라우저가 꾸민 헤더 값), 값이 빠진 경우는 믿지 않고 정상값으로 채우지도 않습니다(`network` `unknown`, `hour` 없음). `recentEvents`는 12건 이하 `{kind, ageSeconds, count}`일 때만 세고, `stepUp`은 `verified` true와 0~900초 정수 나이일 때만 확인된 것으로 봅니다. 위치(`region`)는 판정 근거로 읽지 않습니다.
- 규칙(제작 2) `step_up_required`: 등록 기기의 내 자료실 읽기라도 믿을 수 있는 가상 사건에서 **평소와 다른 시각(07시 전·23시 이후) + 처음 보는 네트워크(`unusual`) + 최근 10분 사건 합 10건 이상**이 모두 겹치면 `step_up`·`step_up_required`입니다. 차단(`deny`)이 아니라 엔진에 다시 로그인 확인을 요청하고, 지역 하나나 두 조건만으로는 걸리지 않습니다. 기존 `device_registered` 규칙(미등록 `deny`)은 그대로 먼저 봅니다.
- 다시 로그인(제작 3): 계약의 `stepUp`이 엔진이 확인한 새 로그인 시각입니다. 엔진이 확인한 새 로그인이 5분 이내(`authAgeSeconds` ≤ 300)일 때만 같은 요청을 다시 판정해 `allow`·`approved`(규칙 `step_up_required`)로 돌려주고, 확인 전이나 오래된 로그인은 계속 `step_up`입니다. 이 저장소에는 엔진·릴레이가 없고 실제 경로의 `signals`는 `none`이므로, **실제 자료 차단과 새 로그인 뒤 허용은 미실행**입니다. 계약이 준비된 반 엔진에서 심판이 실측합니다. 토큰 원문은 판정기·로그·묶음에 남기지 않습니다.
- 판정기는 계약의 `requestId`·`subjectId`·`deviceRegistered`·`service`·`method`·`route`·`signals`·`recentEvents`·`stepUp`만 읽습니다. `request.role`·`identity`·`device`·`geo`는 읽지 않습니다. 응답은 다섯 항목 그대로이고 `ruleIds`는 모두 `RULE_IDS`(`starter.deny`, `device_registered`, `step_up_required`)에 있습니다.
- 바꾸지 않은 것: 자료실 주소, 브라우저 화면, `/api/notes`·`/api/session`, DB 권한. `aleph.config.json`은 `step` 7만 바꿨고 `judgeIssuer`는 그대로입니다. `src/attack-check.mjs`는 7단계에도 6단계의 자료실 주소 점검을 그대로 보냅니다.

### 7단계 확인 순서

1. `npm install`
2. `npm run fixture:7` → `정상 사건: allow`, `복합 이상 사건: step_up`
3. `npm run decider:test` → 네 줄 모두 「통과」(등록 기기 정상, 미등록 기기, 복합 이상 접속 `step_up`, 다시 확인한 복합 이상 접속 `allow`)
4. 두 명령은 가상 요청 연습이며 심판 판정이 아닙니다. 등록 기기에서 배포 주소 `/`에 로그인하면 기존 화면과 메모 읽기·추가·수정·삭제가 그대로 됩니다.
5. `npm run bundle`(`bundle-notes.json` 필요). `policyRules`에 `step_up_required`가 들어갑니다.

## 6단계 저장점: 등록한 기기만 자료실에 들어옵니다

- 작동: `src/decider.mjs`의 `decide(request)`에 규칙 `device_registered`를 더했습니다. 요청의 `deviceRegistered`가 `true`이고, 로그인한 주체(`subjectId`)가 내 자료실을 읽는 요청(`service` `notes`, `method` `GET`, `route` `GET /notes` 또는 `GET /notes/:id`)일 때만 `allow`·`approved`입니다.
- 거부: `deviceRegistered`가 `false`이거나 값이 없으면 `deny`·`device_not_registered`(규칙 `device_registered`)입니다. 등록 기기라도 읽기가 아닌 요청은 시작 틀의 기본 거부 `deny`·`starter_not_ready`(규칙 `starter.deny`)로 남겨 두었습니다.
- 판정기는 `docs/DECIDER_REQUEST.md` 계약의 `requestId`·`subjectId`·`deviceRegistered`·`service`·`method`·`route`만 읽습니다. 계약에 없는 `request.role`·`identity`·`device`는 읽지 않습니다. 응답은 다섯 항목 그대로이고 `ruleIds`는 모두 `RULE_IDS`(`starter.deny`, `device_registered`)에 있습니다.
- 바꾸지 않은 것: 자료실 주소, 브라우저 화면, `/api/notes`·`/api/session`의 로그인·소유자 검사, DB 권한. 이번 단계에는 따로 설치할 접속 프로그램이 없습니다.
- `aleph.config.json`: `step` 6. `allowedRoutes`·`identityProvider`·`originalApiUrl`은 5단계 그대로이고 `judgeIssuer`는 바꾸지 않았습니다. `src/attack-check.mjs`는 6단계에도 5단계의 자료실 주소 점검을 그대로 보냅니다.

### 6단계 확인 순서

1. `npm install`
2. `npm run decider:test`를 실행합니다. 정상 출력은 아래 두 줄이 모두 「통과」입니다.

   ```text
   통과 · 등록 기기의 정상 요청
   통과 · 미등록 기기의 가상 요청
   ```

   「등록 기기의 정상 요청」은 `allow`, 「미등록 기기의 가상 요청」(`deviceRegistered: false`)은 `deny`·`device_not_registered`여야 통과입니다. 하나라도 「확인 필요」가 나오면 명령이 실패로 끝납니다.
3. 이 시험은 가상 요청 연습이며 심판 판정이 아닙니다. 실제 미등록 기기 공격은 심판이 보내고 결과는 포털에서 확인합니다.
4. 등록 기기에서 배포 주소 `/`를 열어 로그인하면 기존 화면과 메모 읽기·추가·수정·삭제가 그대로 됩니다.
5. `npm run bundle`(`bundle-notes.json` 필요)로 제출 묶음을 만듭니다. `policyRules`에 `device_registered`가 들어갑니다.

- 참고: `npm run fixture:7`(7단계 연습)은 복합 이상 요청에 `step_up`을 기대하므로 6단계에서는 실패하는 것이 정상이었습니다(7단계에서 통과).

## 보너스 xdr-02 저장점: 웹 주입 공격 탐지

- 작동: `xdr/web-injection/decide.mjs`가 Wazuh 모양 연습 경보 하나를 받아 `block`·`alert`·`record`와 확신도, 근거 패턴 이름을 돌려줍니다. 패턴은 MITRE ATT&CK T1190(외부 공개 앱 악용)의 반복 주입 네 형태(SQL 구문, 스크립트 태그, 경로 거슬러 올라가기, 명령 구분자)와 반복 없는 한 번짜리 의심 표기(최대 확신도 0.8, 차단하지 않음)이고, `patterns.json`과 파일 맨 위 상수가 같습니다. `decide.mjs`에는 `import`가 없고 파일 읽기·쓰기·네트워크도 없습니다.
- 알림과 차단: `xdr/web-injection/respond.mjs`가 `alert`·`block`을 공용 `xdr/alerts.log`에 한 줄씩 쌓고(같은 경보는 한 번만), 같은 주소에서 반복된 `block` 주소만 근거 경보 번호와 1시간 만료 시각을 붙여 `xdr/web-injection/deny-rules.json`에 거부 규칙으로 둡니다. 정상 요청이 나온 주소는 규칙에 넣지 않습니다.
- 판정기 연결: xdr-01과 같이 `src/decider.mjs`는 고치지 않았습니다. 거부 규칙은 운영 엔진이 출발 주소를 계약으로 넘겨줄 때 `isBlocked()` 확인 단계로 꽂습니다.
- 다시 실행: `npm run xdr:run -- web-injection`(→ `xdr/web-injection/result.json`), `node xdr/web-injection/respond.mjs`(알림·거부 규칙·다시 흘리기 결과), `node xdr/web-injection/read-alerts.mjs`(경보 확인용 목록). 로컬 결과는 연습 경보 기준이며 심판 판정이 아닙니다.

## 보너스 xdr-01 저장점: 무차별 로그인 공격 탐지

- 작동: `xdr/brute-force/decide.mjs`가 Wazuh 모양 연습 경보 하나를 받아 `block`·`alert`·`record`와 확신도, 근거 패턴 이름을 돌려줍니다. 패턴은 MITRE ATT&CK T1110의 두 형태(같은 주소 실패 연속 T1110.001, 여러 계정 비밀번호 스프레이 T1110.003)이고, `patterns.json`과 파일 맨 위 상수가 같습니다. `decide.mjs`에는 `import`가 없고 파일 읽기·쓰기·네트워크도 없습니다.
- 알림과 차단: `xdr/brute-force/respond.mjs`가 `alert`·`block`을 `xdr/alerts.log`에 한 줄씩 쌓고(같은 경보는 한 번만), `block` 주소만 근거 경보 번호와 1시간 만료 시각을 붙여 `xdr/brute-force/deny-rules.json`에 거부 규칙으로 둡니다. 정상 사건이나 실패 뒤 성공이 나온 주소는 규칙에 넣지 않습니다.
- 판정기 연결: `src/decider.mjs`는 고치지 않았습니다(6단계 전, `starter.deny`만 있음). 현재 판정 요청 계약에는 출발 주소 칸이 없어서, 거부 규칙은 운영 엔진이 주소를 계약으로 넘겨줄 때 `isBlocked()` 확인 단계로 꽂습니다.
- 다시 실행: `npm run xdr:run -- brute-force`(→ `xdr/brute-force/result.json`), `node xdr/brute-force/respond.mjs`(알림·거부 규칙·다시 흘리기 결과), `node xdr/brute-force/read-alerts.mjs`(경보 확인용 목록). 로컬 결과는 연습 경보 기준이며 심판 판정이 아닙니다.

## 5단계 저장점: 자료 요청을 서버 한곳으로

- 작동: 브라우저의 메모 읽기·추가·수정·삭제는 모두 Vercel 서버 함수 `/api/notes`만 부릅니다. 화면이 Supabase를 직접 부르는 곳은 로그인·로그아웃(Auth)뿐이고, 메모 테이블을 직접 부르는 코드는 없습니다(제작1 확인 결과 "없음", 화면 코드 변경 없음).
- 유지: 서버 함수의 로그인 검사(`401 LOGIN_REQUIRED`), 소유자 검사(남의 메모 `404`, 본문의 다른 칸 `400`), 서버 전용 설정(Vercel 환경변수 `SUPABASE_URL`·`SUPABASE_SECRET_KEY`)은 4단계와 같습니다.
- DB: `public.notes` 한 테이블에서 `PUBLIC`·`anon`·`authenticated`의 직접 권한을 모두 회수했습니다. 서버 함수가 쓰는 `service_role`의 SELECT·INSERT·UPDATE·DELETE와 RLS는 유지합니다. 4단계 정책 네 개는 남아 있지만 권한이 없어 직접 요청에는 쓰이지 않습니다. 이제 로그인한 사람의 토큰으로도 Data API를 직접 부를 수 없습니다.

```sql
begin;
revoke all on table public.notes from public, anon, authenticated;
grant select, insert, update, delete on table public.notes to service_role;
alter table public.notes enable row level security;
commit;
```

- 권한 확인(SQL Editor, 적용 전후): `has_table_privilege('anon'|'authenticated'|'service_role', 'public.notes', 'SELECT'…)`. 적용 후 정상은 `anon`·`authenticated` 모두 false, `service_role`은 네 권한 true입니다.
- `aleph.config.json`: `step` 5, `originalApiUrl`은 쿼리 없는 원본 자료 경로 `https://xuhijkycxqipwblhimoh.supabase.co/rest/v1/notes`. `allowedRoutes`·`identityProvider`는 4단계 그대로, `judgeIssuer`는 바꾸지 않았습니다.
- 다시 실행: `npm run bundle`(`bundle-notes.json` 필요). 직접 점검은 4단계와 같고, anon 키 직접 읽기만 `originalApiUrl`로 보냅니다. 정상은 `401` 또는 `403`에 행 없음입니다. 닿지 않으면 미실행으로 남깁니다.
- 화면 확인: A로 로그인하면 메모 읽기·추가·수정·삭제가 그대로 됩니다.
- 남은 점: 옛 공개 커밋 `61842c0`과 1단계 배포의 메모 노출은 그대로입니다.

### 5단계 가점: 화면 코드에서 Supabase 공개 키 빼기

- 작동: 로그인·로그아웃도 서버 함수 `api/session.js`가 맡습니다. 화면 `public/index.html`에는 Supabase 주소·publishable 키·SDK가 없고, 같은 사이트의 `/api/session`과 `/api/notes`만 부릅니다.

| 경로 | 요청 | 응답 |
| --- | --- | --- |
| `POST /api/session` | `{email, password}` (다른 칸은 `400 INVALID_LOGIN`) | `{accessToken, expiresAt, email}`, 실패하면 `401 {error}`(예: `invalid_credentials`), 시도 과다는 `429` |
| `DELETE /api/session` | `Authorization: Bearer <토큰>` | `204`, 토큰이 없거나 검사에 실패하면 `401 LOGIN_REQUIRED` |

- 서버는 2단계의 Vercel 환경변수 `SUPABASE_URL`·`SUPABASE_SECRET_KEY`로 Supabase Auth에 로그인합니다. 브라우저에는 로그인 토큰과 만료 시각만 주고 refresh token은 주지 않습니다. 화면은 토큰을 그 탭의 `sessionStorage`에만 둡니다.
- `/api/notes`의 로그인·소유자 검사와 DB 권한은 바뀌지 않았습니다. `aleph.config.json`의 `allowedRoutes`에 `POST /api/session`, `DELETE /api/session`을 더했습니다.
- 다시 실행: anon 키 직접 점검은 화면에서 키를 읽을 수 없으므로 터미널 환경변수 `ALEPH_CHECK_ANON_KEY`(Supabase 대시보드 > Project Settings > API Keys의 publishable 키)를 줄 때만 보냅니다. 예: `ALEPH_CHECK_ANON_KEY=<publishable 키> npm run bundle`. 없으면 미실행으로 남깁니다.
- 바뀐 점과 남은 약점: 토큰을 자동으로 갱신하지 않아 약 1시간 뒤에는 다시 로그인합니다. 모든 로그인 요청이 Vercel 서버에서 나가므로 Supabase Auth의 로그인 시도 제한이 사용자별이 아니라 서버 주소 단위로 걸립니다.
- 되돌리기: 로그인이 깨지면 이 커밋만 `git revert`하면 화면이 Supabase SDK로 로그인하던 5단계 저장점으로 돌아갑니다.

## 4단계 저장점: 로그인해도 내 자료만

- 작동: `/api/notes`의 다섯 경로 모두 토큰에서 확인한 사용자 ID와 DB의 `owner_id`가 같은 행만 다룹니다. 목록·한 건 읽기·수정·삭제는 `owner_id = 로그인 사용자` 조건을 붙이고, 추가는 확인된 ID를 `owner_id`로 저장합니다.
- 기본 거부: URL·본문의 `owner_id`는 믿지 않습니다. 본문은 추가 `{id?, title, body}`, 수정 `{title, body}`만 받고 다른 칸(예: `owner_id`)이 있으면 `400 INVALID_NOTE`입니다. 남의 메모는 없는 메모와 같은 `404 NOTE_NOT_FOUND`로 답해 있는지도 알리지 않습니다.
- 수정은 기존 행의 주인이 본인인 행만 고르고 `owner_id`는 바꾸지 않으며, 바뀐 행의 주인도 다시 확인합니다. 한 건 응답 `{id,title,body}`, 수정 본문 `{title,body}`는 3단계와 같습니다.
- DB(두 번째 방어선): `public.notes`에 RLS를 켜고 `PUBLIC`·`anon`·`authenticated` 권한을 모두 회수한 뒤 `authenticated`에만 SELECT·INSERT·UPDATE·DELETE를 줍니다. 정책 네 개가 모두 `auth.uid() = owner_id`일 때만 허용합니다(SELECT·DELETE는 USING, INSERT는 WITH CHECK, UPDATE는 둘 다). 앱 API는 서버 전용 키로 접속하므로 앱의 소유자 검사는 API 코드가 맡습니다.
- DB 준비 SQL(소유자 연결, RLS·권한)은 계정 이메일이 들어 있어 저장소 밖에 보관했습니다. 정책 이름: `notes_select_own`, `notes_insert_own`, `notes_update_own`, `notes_delete_own`.
- `aleph.config.json`: `step` 4. `allowedRoutes`는 실제 다섯 경로 `GET /api/notes`, `POST /api/notes`, `GET·PUT·DELETE /api/notes/:id` 그대로입니다. `judgeIssuer`는 바꾸지 않았습니다.
- 다시 실행: `npm run bundle`(`bundle-notes.json` 필요). 직접 점검은 토큰 없는 요청·위조 토큰·anon 키 Data API 직접 읽기를 보냅니다. 교차 사용자 점검은 터미널에서 `ALEPH_CHECK_TOKEN_B`(B의 로그인 토큰)와 `ALEPH_CHECK_NOTE_A`(A 메모 ID)를 줄 때만 보내고, 토큰은 결과에 남기지 않습니다. 배포 주소나 Supabase에 닿지 않으면 미실행으로 남깁니다.
- 화면 확인: A로 로그인하면 가상 메모 네 건, B로 로그인하면 B 시험 메모 한 건만 보입니다. B가 A 메모 ID로 읽기·수정·삭제하면 404입니다.
- 남은 점: `authenticated` 역할로 Data API에 직접 오는 요청은 RLS가 막지만, 심판이 재현할 수 없어 직접 점검에서 뺐습니다. 옛 공개 커밋 `61842c0`과 1단계 배포의 메모 노출은 그대로입니다.

## 3단계 저장점: 지금 작동하는 것과 다시 실행하는 법

- 작동: 화면 `/`에서 Supabase Auth 이메일·비밀번호로 로그인·로그아웃합니다(공식 SDK `@supabase/supabase-js` 2.117.2, `signInWithPassword`·`signOut`). 실패하면 이유를 화면에 보여 줍니다.
- 작동: `/api/notes`는 요청의 `Authorization: Bearer` 토큰을 시작 틀의 `src/verify-login.mjs`로 검사합니다. 토큰이 없거나 검사에 실패하면 자료 없이 `401 LOGIN_REQUIRED`를 돌려줍니다. 사용자 ID는 브라우저가 보낸 값이 아니라 검사를 통과한 토큰에서만 얻습니다.
- 작동: 로그인한 사람은 가상 메모를 추가·수정·삭제합니다. 추가할 때 서버가 확인한 사용자 ID를 `owner_id`로 저장합니다.

| 경로 | 요청 | 응답 |
| --- | --- | --- |
| `GET /api/notes` | 없음 | 로그인 사용자(`owner_id`)의 메모 배열 `[{id,title,body}]` |
| `POST /api/notes` | `{id?, title, body}` (`id`는 UUID, 없으면 서버가 만듦) | `201 {id}`, 같은 `id`가 있으면 `409` |
| `GET /api/notes/:id` | 없음 | `{id,title,body}`, 없으면 `404` |
| `PUT /api/notes/:id` | `{title, body}` | `{id,title,body}`, 없으면 `404` |
| `DELETE /api/notes/:id` | 없음 | `{id}`, 지운 뒤 GET은 `404` |

- `/api/notes/:id`는 `vercel.json`의 rewrite가 같은 함수 `api/notes.js`로 넘깁니다.
- 설정: 화면 코드에는 공개용 Project URL과 publishable key만 있습니다. 서버는 2단계의 Vercel 환경변수 `SUPABASE_URL`·`SUPABASE_SECRET_KEY`를 그대로 씁니다. 두 값은 같은 Supabase 프로젝트여야 합니다.
- DB 준비(Supabase SQL Editor에서 한 번): 메모마다 공개용 UUID 칸을 만듭니다.

```sql
alter table public.notes add column if not exists note_id uuid not null default gen_random_uuid();
create unique index if not exists notes_note_id_key on public.notes (note_id);
```

- `aleph.config.json`: `step` 3, `identityProvider`(발급자 `…/auth/v1`, 대상 `authenticated`, 공개키 주소 `…/auth/v1/.well-known/jwks.json`), `allowedRoutes`에 위 다섯 경로. `judgeIssuer`는 바꾸지 않았습니다.
- 다시 실행: `npm run bundle`(제출 묶음, `bundle-notes.json` 필요). 직접 점검은 토큰 없는 GET·POST·GET `/:id`와 서명이 맞지 않는 토큰으로 자료 API를 불러 `401`과 자료 없음을 기록합니다. 배포 주소에 닿지 않으면 미실행으로 남깁니다.
- `src/decider.mjs`의 `RULE_IDS`는 시작 틀의 `starter.deny`뿐입니다(정책 규칙은 6단계부터).

### 3단계 남은 약점

- **소유자 검사 없음:** 한 건 읽기·수정·삭제(`/api/notes/:id`)는 로그인만 확인하고 메모 주인은 확인하지 않습니다. B 계정이 A 메모의 ID를 알면 읽고 고치고 지울 수 있습니다. 4단계에서 막습니다.
- 2단계 이전에 옮긴 가상 메모 네 건은 `owner_id`가 비어 있어서 아무의 목록에도 나오지 않습니다.
- 옛 공개 커밋 `61842c0`과 1단계 배포의 메모 노출은 그대로입니다.

## 2단계 저장점: 지금 작동하는 것과 다시 실행하는 법

- 작동: 화면 `/`가 서버 함수 `/api/notes`로 학습용 Supabase `notes` 테이블의 가상 메모 네 건을 읽어 카드로 보여 줍니다. `/data.json`은 없고, `/aleph.json`은 배포마다 `step` 2와 커밋을 기록합니다.
- 설정: Vercel 환경변수 `SUPABASE_URL`(`https://<프로젝트>.supabase.co`)과 서버 전용 `SUPABASE_SECRET_KEY`. Supabase SQL Editor에서 메모 이전 SQL을 먼저 실행합니다(SQL은 저장소 밖에 보관).
- `aleph.config.json`: `step` 2, `repoUrl`·`publicAppUrl`은 실제 저장소와 고정 배포 주소. 로그인 발급자·허용 경로·원본 API 주소는 아직 없음(3·5단계).
- 다시 실행: `npm run build -- --local`(빌드 흐름), `npm run bundle`(제출 묶음, `bundle-notes.json` 필요). 직접 점검은 `/data.json`과 `/api/notes`를 비로그인으로 요청하고, 배포 주소에 닿지 않으면 미실행으로 남깁니다.
- 보안 헤더: `vercel.json`이 모든 응답에 `X-Content-Type-Options: nosniff`를 붙여, 브라우저가 응답 형식을 추측해 다른 형식으로 실행하지 않게 합니다(커밋 `bc1dcd9`).
- `src/decider.mjs`의 `RULE_IDS`는 시작 틀의 `starter.deny`뿐입니다(정책 규칙은 6단계부터).

## 2단계 기록: 자료를 코드 밖으로

- 가상 메모 네 건은 학습용 Supabase `public.notes` 테이블로 옮겼습니다(RLS 켬, `anon`·`authenticated` 권한 없음, `owner_id uuid` 칸만 미리 둠). 옮길 때 쓴 SQL은 메모 문장이 들어 있어 저장소에 커밋하지 않았습니다.
- 화면 `/`는 Vercel 서버 함수 `/api/notes`를 통해 메모를 읽습니다. 함수는 Vercel 환경변수 `SUPABASE_URL`과 서버 전용 `SUPABASE_SECRET_KEY`를 씁니다. 키 값은 Vercel 설정 화면의 환경변수 입력란에만 넣고, 코드·Git·로그·응답에 넣지 않습니다.
- 빌드는 더 이상 `public/data.json`을 만들지 않고, `/aleph.json`만 계속 만듭니다. `aleph.config.json`의 `step`은 2입니다.
- **남은 약점:** `/api/notes`는 아직 로그인 확인이 없는 공개 주소라서, 누구나 직접 불러 가상 메모를 읽을 수 있습니다. 그래서 3단계 전까지 이 테이블에는 가상 메모만 둡니다.
- **지워지지 않은 이력:** 1단계 공개 커밋(`61842c0`)과 그때의 Vercel 배포에는 메모가 든 `data.json`이 그대로 남아 있습니다. 최신 파일에서 뺐다고 이전 이력까지 지워지지는 않습니다.
- 다시 실행: `npm run build -- --local`로 빌드 흐름만 확인할 수 있습니다. 메모 읽기는 환경변수가 설정된 Vercel 배포에서 `/api/notes`로 확인합니다.

## 2단계 확인 절차: 가상 메모 문장 검색

메모 문장 자체를 이 문서에 다시 적지 않도록, 아래 검색식은 공백을 `[ ]`로 적은 정규식을 씁니다.

```sh
P='실습용[ ]가상[ ](과제|포트폴리오|리추얼|행정)[ ]기록'
APP=https://choi-bujang-secret-vault-jae-lee.vercel.app

# 1) GitHub 최신 파일 (main의 마지막 커밋)
git fetch origin main && git grep -nE "$P" origin/main -- .   # 결과 없음이 정상

# 2) 현재 배포의 정적 파일
for path in / /data.json /aleph.json; do
  printf '%s ' "$path"; curl -s "$APP$path" | grep -cE "$P"     # 모두 0이 정상, /data.json은 404가 정상
done

# 3) 옛 공개 커밋 (지워지지 않은 이력 확인)
git grep -cE "$P" 61842c0 -- .                                   # 1단계 커밋에는 메모가 남아 있음

# 4) 공개 서버 API (남은 약점 확인)
curl -s "$APP/api/notes"                                         # 3단계 전까지 누구나 메모를 받을 수 있음
```

### 검색 결과 기록 (2026-10-27, 커밋 `b2e52e5` 배포 기준)

| 위치 | 결과 |
| --- | --- |
| GitHub 최신 파일 (`origin/main` = `b2e52e5`) | 메모 문장 0건 |
| 배포 `/` (정적 HTML) | 메모 문장 0건. 메모는 화면이 `/api/notes`에서 받아 그립니다 |
| 배포 `/data.json` | 파일 없음 (요청 실패) |
| 배포 `/aleph.json` | 메모 문장 0건 (`step` 2, 커밋 `b2e52e5`) |
| 옛 공개 커밋 `61842c0` | `data.json`, `public/data.json`에 각 4건 남아 있음 |
| 옛 1단계 배포 | 그 배포의 `/data.json`에 메모가 남아 있을 수 있음 |

**과거 노출은 해소되지 않았습니다.** 최신 파일과 현재 배포에서는 메모 문장을 뺐지만, 공개 저장소의 옛 커밋 `61842c0`과 1단계 때 만든 Vercel 배포가 남아 있는 한 그때 공개된 가상 메모는 계속 볼 수 있습니다.

### 공개 API의 남은 약점

`/api/notes`는 로그인 확인이 없는 공개 주소입니다. 누구나 브라우저나 `curl`로 직접 불러 가상 메모 네 건을 받을 수 있습니다. 서버 전용 키는 응답에 나가지 않지만, 자료 자체는 보호되지 않습니다. 3단계에서 로그인 확인을 붙이기 전까지 이 테이블에는 가상 메모만 둡니다.
