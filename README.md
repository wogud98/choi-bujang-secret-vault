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

## 12단계 저장점: 탈환 작전실을 완성합니다

이 안내의 기준은 이 저장점 커밋입니다(`git log -1`로 확인, 바로 앞 검사 커밋은 11단계 `31ee016`). 다른 커밋에서 따라 하면 결과가 다를 수 있습니다.

- 탈환 작전실(제작 1): 로그인하고 기기 승인을 받으면 화면에 「탈환 작전실」 칸이 열립니다. 화면은 새 서버 함수 `GET /api/ops`(`api/ops.js`, 요약 계산은 `src/ops-summary.mjs`)의 실제 응답만 그립니다. 이 경로도 로그인 토큰과 승인된 기기의 요청 서명이 있어야 답합니다(없으면 401, 서명 없으면 403). 네 칸은 **판정기 규칙**(`RULE_IDS`·구역별 허용 경로, 학생 `decide()`에 가상 요청 7건을 넣은 결과), **탐지 사건**(`burst_read` 기준과 가상 사건 3건 결과), **회수 상태**(내 기기의 `public.devices` 기록: 승인·대기·회수·만료), **복구 버전**(안전 정책 사본 `safety-policy-step9`의 해시가 `backup/safety-policy.sha256`과 같은지, 내 메모 사본 `public.note_snapshots`와 현재 메모의 해시 비교)입니다. 각 줄에는 「실측」(서버가 DB에서 읽음)·「가상 연습」(학생 함수에 가상 입력, 심판 판정 아님)·「미실행」(운영 반 엔진의 실제 판정·사건 전달처럼 이 자료실에서 볼 수 없는 것)을 붙여 섞지 않습니다. 기기 ID·메모 ID는 앞 4자리와 끝 2자리만 보이고, 메모 제목·본문·토큰·사용자 ID는 응답에 없습니다. 서버는 수치를 가린 기록에서 세고, 화면은 같은 기록으로 다시 세어 「서버 기록으로 다시 센 수치: 일치」를 표시합니다. 맞지 않으면 「불일치」로 보입니다.
- 실측 표(제작 2): 작전실의 「1~12단계 실측 표 만들기」를 누르면 화면이 지금 로그인·기기로 1~12단계의 정상 요청과 금지 요청 24줄을 실제로 보내고, 줄마다 기대 결과·실제 HTTP 결과(오류 코드·건수만)·요청 ID(Vercel 응답 헤더 `x-vercel-id`)·확인 시각을 남깁니다. 보내지 못하거나 이 화면에서 보낼 수 없는 줄(5단계 anon 키 직접 요청, 7단계 재인증 판정, 9단계 폭주 조회 회수)은 「미실행」으로 남고 통과로 바뀌지 않습니다. 「로그아웃 뒤 같은 토큰 재전송 시험」은 실제로 로그아웃한 뒤 같은 토큰으로 다시 보내 회수된 신원이 거부되는지 기록합니다(누르면 다시 로그인해야 합니다). 「표 Markdown 복사」로 표를 그대로 옮길 수 있고, 토큰·서명·메모 본문은 들어가지 않습니다. 심판의 41종 공격은 이 표에 없으며 포털 판정으로만 확인합니다.
- `aleph.config.json`: `step` 12. `judgeIssuer`·`allowedRoutes`·`restoreRoute`·판정기 `RULE_IDS`는 그대로입니다. `vercel.json`은 `api/ops.js`에 해시 파일 `backup/safety-policy.sha256`만 함께 배포합니다. `src/attack-check.mjs`는 12단계에 `/api/ops` 점검 세 개(토큰 없음·위조 토큰·선택 서명 없는 B 토큰)를 먼저 보내고 11단계 점검을 그대로 보냅니다(모두 18개).

### 누가 만든 것인가: 학생 몫과 제공 엔진

| 부분 | 출처 | 파일 |
|---|---|---|
| 학생 판정기 | 학생 작업 (6~10단계) | `src/decider.mjs`, `scripts/fixture-7.mjs`의 가상 요청 |
| 탐지 규칙 | 학생 작업 (9단계) | `src/detect.mjs` |
| 접속 앱(설치형 웹앱·기기 승인) | 학생 작업 (11단계) | `public/index.html`, `public/manifest.webmanifest`, `public/sw.js`, `src/device-proof.mjs`, `api/devices.js` |
| 자료실 API·작전실 | 학생 작업 (2~12단계) | `api/notes.js`, `api/notices.js`, `api/materials.js`, `api/restore.js`, `api/session.js`, `api/ops.js`, `src/ops-summary.mjs`, `src/attack-check.mjs` |
| 판정 요청 중계·실제 판정·사건 전달·회수 집행 | **ALEPH SDP 엔진 사용** (운영 측 제공, 이 저장소에 없음) | 계약만: `docs/DECIDER_REQUEST.md`, `docs/DETECT_EVENTS.md` |
| 로그인 검사·제출 묶음·배포 식별 | BYTE BACK 시작 틀 R5 제공 | `src/verify-login.mjs`, `scripts/bundle.mjs`, `scripts/build-public.mjs`, `scripts/deployment-identity.mjs` |

비밀값은 저장소와 제출 묶음에 넣지 않습니다. Supabase 서버 전용 키(`SUPABASE_SECRET_KEY`)·주소(`SUPABASE_URL`)·강사 목록(`INSTRUCTOR_USER_IDS`)은 Vercel 프로젝트 Settings → Environment Variables에만 있습니다. `.env*`, `bundle-notes.json`, `artifacts/`는 `.gitignore`로 커밋하지 않고, 기기 개인키와 로그인 토큰은 화면 메모리에만 있습니다. 표를 만드는 SQL(`notes-snapshot.sql`, `devices.sql`)도 저장소 밖에 둡니다.

### 설치·실행·중지·복구

1. **설치(공통)**: Node 22 이상에서 저장소를 받고 `npm install`(또는 `npm ci`). Supabase SQL Editor에서 10단계 `notes-snapshot.sql`과 11단계 `devices.sql` ①을 한 번씩 실행합니다. Vercel 환경변수는 위 세 값을 공식 설정 화면에 직접 넣습니다.
2. **학생 판정기**: 실행 `npm run decider:test`(네 줄 통과)·`npm run fixture:7`(`allow`·`step_up`). 실제 판정은 ALEPH SDP 엔진이 `decide(request)`를 부를 때만 일어나며 이 저장소에서 따로 켜고 끄는 프로세스는 없습니다(명령은 끝나면 멈춤). 복구는 `npm run policy -- verify` → 차이가 있으면 `npm run policy -- diff` → `npm run policy -- restore --yes`(시험 사본 기준, 운영 파일은 고치지 않음). 코드 자체를 되돌릴 때는 `git revert <커밋>`을 쓰고 `git reset --hard`는 쓰지 않습니다.
3. **탐지 규칙**: 실행 `npm run detect:test`(여섯 줄 통과). 실제 사건 전달과 회수 집행은 ALEPH SDP 엔진 몫이라 미연결입니다. 복구는 판정기와 같이 `git revert`로 합니다.
4. **접속 앱**: 실행은 배포 주소 `/`를 열고 로그인 → 「이 기기 승인 요청」 → SQL ③으로 승인 → 「승인 결과 확인」. 중지(한 기기의 접속을 끊기)는 SQL ④로 그 기기의 `status`를 `revoked`로 바꿉니다. 작전실 「회수 상태」에서 회수 수가 늘어야 합니다. 로컬 연습은 `npm run device:test`(다섯 줄 통과).
5. **자료실**: 실행은 Vercel이 `main` 푸시마다 배포합니다(`npm run build`가 `public/aleph.json` 생성, 로컬 화면만 볼 때는 `npm run build -- --local`). 중지는 Vercel 프로젝트 Settings → Deployment Protection에서 Vercel Authentication을 켜 외부 접근을 막습니다. 배포 복구는 Vercel Deployments에서 앞선 정상 배포의 Instant Rollback(또는 Promote)을, 메모 복구는 B 계정·승인 기기로 `POST /api/restore`를 씁니다. 작전실 「복구 버전」이 `일치`인지 확인합니다.
6. **작전실 연습**: `npm run ops:test`(일곱 줄 통과: 수치와 가린 기록 일치, 본문·전체 ID 미노출, 엔진 결과 미실행 유지). 가짜 기록 연습이며 심판 판정이 아닙니다.

### 12단계 확인 순서

1. 배포 주소 `/`에 로그인하고 기기 승인을 받으면 「탈환 작전실」이 열리고, 위쪽에 `GET /api/ops 실제 응답 · 요청 ID … · 커밋 …`이 보여야 합니다. 커밋 앞 12자리가 `git log -1`과 같아야 합니다.
2. 「회수 상태」·「복구 버전」 칸이 「실측」이고 「다시 센 수치: 일치」여야 합니다. 판정기·탐지 칸은 「가상 연습」·「미실행」 두 표시가 함께 있어야 합니다.
3. 「1~12단계 실측 표 만들기」 → 정상 줄은 200, 금지 줄은 401·403·404·405·400, 미실행 줄은 그대로 미실행이어야 합니다. 「불일치」가 있으면 그 줄의 요청 ID로 Vercel 로그(`api_denied zone=… reason=…`)를 찾습니다.
4. (선택) 「로그아웃 뒤 같은 토큰 재전송 시험」 → 401 또는 403(`DEVICE_NOT_APPROVED`)이면 회수된 신원 거부입니다. 로그아웃(`DELETE /api/session`)은 Supabase 세션을 끊고, 이 사용자의 승인·대기 기기를 모두 `revoked`로 바꿉니다. 이미 발급된 토큰은 만료 전까지 서명 검사를 통과하므로(첫 실측 07:07Z, 커밋 `24927a1`에서 200·4건으로 뚫림) 기기 승인 회수로 막습니다. 로그아웃하면 다른 기기도 다시 승인받아야 합니다.
5. 터미널: `git pull` → `npm run bundle` → 12단계부터 제출 묶음은 직접 요청을 보내지 않아 18개 점검이 모두 `not_run`입니다(심판이 그 요청 기록을 찾지 못해 바꿈). 실제 HTTP 결과는 3번 실측 표에 남깁니다. 직접 확인할 때만 `ALEPH_CHECK_LIVE=1 npm run bundle`로 GET 점검을 보냅니다(이 결과는 제출하지 않음).

| 순서 | 결과 (12단계 커밋 직전, 코딩 도구 환경) |
|---|---|
| 1–4 배포 화면·실측 표 | 미실행 (이 환경에서 배포 주소로 요청이 닿지 않음). 가짜 API로 한 로컬 브라우저 연습에서는 작전실 네 칸 표시, 표 24줄 중 미실행 4줄 유지, 작전실 칸에 메모 본문 0건 |
| 5 제출 묶음 | 커밋 뒤 `npm run bundle` 결과로 확인 |
| 작전실·판정기·탐지·기기 연습 | `ops:test` 7/7, `decider:test` 4/4, `detect:test` 6/6, `device:test` 5/5 통과 (가상 연습이며 심판 판정 아님) |

남은 약점: 같은 기기 서명을 60초 안에 다시 보내는 재전송은 아직 막지 않습니다(11단계와 같음). 로그아웃한 토큰 자체는 만료 전까지 유효하므로, 기기 서명이 필요 없는 `POST /api/devices`(승인 대기 등록만 됨)는 통과합니다.

## 11단계 저장점: 나만의 접속 앱을 완성합니다

- 설치형 웹앱(제작 1): `public/manifest.webmanifest`(앱 이름 「BYTE BACK 내 자료실」, 짧은 이름 「내 자료실」, 아이콘 `public/icon.svg`)과 오프라인 안내 `public/offline.html`을 붙였습니다. 서비스 워커 `public/sw.js`는 오프라인 안내·아이콘만 미리 받고, 화면이 연결되지 않을 때만 안내를 보여 줍니다. `/api` 요청과 메모 자료는 가로채거나 저장하지 않습니다. 화면에는 「기기 승인 상태」 칸이 있고, 설치된 앱으로 열렸는지는 표시만 할 뿐 기기 확인에 쓰지 않습니다. 따로 설치하는 접속 프로그램은 없습니다.
- 기기 승인(제작 2): 「이 기기 승인 요청」을 누르면 화면이 내보낼 수 없는 P-256 기기 키를 **메모리에만** 만들고 공개키만 `POST /api/devices`로 보냅니다. 서버는 Supabase `public.devices`에 「승인 대기」로 남기기만 하고, 승인은 관리자가 SQL Editor에서 상태를 `approved`로 바꿀 때만 생깁니다(승인 버튼은 없습니다). 「승인 결과 확인」은 기기 키로 서명한 `GET /api/devices/:id`를 보내고, 서버가 승인 상태와 서명을 모두 확인해 `verified: true`라고 답한 뒤에만 자료실을 엽니다. 승인 전에는 자료 API를 부르지도 그리지도 않습니다. 기기 키와 로그인 토큰은 localStorage·sessionStorage·IndexedDB에 넣지 않으므로 화면을 새로 열면 다시 로그인하고 새 기기로 승인받습니다(승인은 12시간 뒤 끝남).
- 요청 서명(`src/device-proof.mjs`): 학생 로그인으로 부르는 보호 요청(`/api/notes`, `/api/notices`, `/api/materials`, `/api/restore`)은 「`aleph.device.v1` · 방법 · 경로 · 본문 SHA-256 · 시각 · 기기 ID」를 기기 키로 서명해 `X-Aleph-Device`·`X-Aleph-Timestamp`·`X-Aleph-Signature` 헤더로 보냅니다. 서버는 경로와 본문을 **자기가 실제로 받은 값으로 다시 만들어** 검사하므로 서명 없는 요청(`DEVICE_SIGNATURE_REQUIRED`), 서명 뒤 경로나 본문을 바꾼 요청(`DEVICE_SIGNATURE_INVALID`), 승인 전 기기(`DEVICE_NOT_APPROVED`)는 모두 403입니다. 시각이 60초 넘게 다르면 거부합니다. 운영 심판 토큰은 반 엔진이 기기를 먼저 확인한 요청이므로 학생 기기 서명을 요구하지 않습니다. 같은 서명을 60초 안에 다시 보내는 재전송은 아직 막지 않습니다(남은 약점).
- `aleph.config.json`: `step` 11. `judgeIssuer`·`allowedRoutes`·`restoreRoute`·판정기 `RULE_IDS`는 그대로입니다(판정기는 계약의 `deviceRegistered`만 읽고, 기기 승인 표를 읽지 않습니다). `src/attack-check.mjs`는 기기 승인 점검 세 개(토큰 없는 승인 요청·상태 확인, 서명 없는 B 토큰 `GET /api/notes`)를 먼저 보내고 10단계 점검을 그대로 보냅니다. 11단계부터 B 토큰 점검은 기기 서명이 없어 403이 정상 거부입니다.

### 11단계 확인 순서

1. Supabase SQL Editor에서 `devices.sql` ①을 한 번 실행하고 ⑤의 세 칸이 모두 `false`인지 봅니다.
2. 배포 주소 `/`에서 A로 로그인 → 「기기 승인 상태: 승인 전」, 메모 목록에 「기기 승인 전에는 자료를 보여 주지 않습니다」만 보여야 합니다.
3. 「이 기기 승인 요청」 → 기기 ID 16자리와 「승인 대기」 표시 → 「승인 결과 확인」을 눌러도 자료가 없어야 합니다.
4. SQL Editor에서 ②로 같은 기기 ID를 찾고 ③으로 승인 → 화면에서 「승인 결과 확인」 → 「서버 확인 완료」와 기존 메모 읽기·추가·수정·삭제가 정상이어야 합니다.
5. 로컬 연습: `npm run device:test` → 다섯 줄 통과(서명 없음·경로 변경·본문 변경·승인 대기 거부, 승인 기기 허용). 가짜 DB 연습이며 심판 판정이 아닙니다.

| 순서 | 결과 (11단계 커밋 직전, 코딩 도구 환경) |
|---|---|
| 1 표 SQL | 미실행 (학생이 Supabase에서 실행) |
| 2–4 화면 | 배포 주소 미실행. 가짜 API로 한 로컬 브라우저 연습에서는 승인 전 자료 API 호출 0회, 승인 뒤 목록·추가 정상, 브라우저 저장소 0건 |
| 5 기기 서명 연습 | 통과 (가짜 DB 연습) |

## 10단계 저장점: 백업에서 자료실을 되살립니다

- 안전 정책(제작 1): 1~9단계의 접근 규칙, 곧 `src/decider.mjs`의 `RULE_IDS`와 구역별 경로(`resource_zone`), `aleph.config.json`의 `allowedRoutes`, DB 접근 정책(5단계에 적용한 `public.notes` 권한 회수·RLS)을 안전 정책으로 정했습니다. 9단계 상태 그대로의 사본 `backup/safety-policy.json`(버전 `safety-policy-step9`)과 확인용 해시 `backup/safety-policy.sha256`을 만들었습니다. `npm run policy -- tamper`는 시험용 사본 `artifacts/policy-test.json`(커밋 안 함)만 만들고, 그 안의 규칙 한 줄(`zoneRoutes.notes`에 ID 없는 `GET /notes` 추가)을 일부러 바꿔 침공을 흉내 냅니다. `npm run policy -- diff`는 복원 기준 버전·해시와 바뀐 줄만 보여 줍니다. 사본이 없거나 해시가 맞지 않으면 모든 명령이 멈춥니다. 운영 정책 파일은 읽기만 하고 고치지 않습니다.
- 되돌리기(제작 2): `npm run policy -- restore`는 먼저 바뀔 항목과 되돌리기 전 판정을 보여 주고 끝납니다. `--yes`를 붙여야 시험 정책에서 사본과 다른 구역만 사본 값으로 되돌립니다. 사본에 없는 구역(다른 서비스 규칙)은 건드리지 않고 보존하며, 감사 기록 `artifacts/policy-audit.log`에는 줄을 덧붙이기만 합니다. 되돌린 뒤 같은 판정기 규칙으로 「B가 A 메모가 담긴 전체 목록 `GET /notes` 요청 → `deny`」, 「A가 자기 메모 한 건 `GET /notes/:id` 요청 → `allow`」를 다시 봅니다. B가 A 메모 ID 하나를 직접 읽는 요청은 판정기가 아니라 `api/notes.js`가 404로 막습니다(4단계).
- 메모 복원(제작 3): 복원 대상은 시험 계정 B의 가상 메모 **`b0000010-0000-4000-8000-00000000000b`**(제목 「10단계 복원 대상 메모 (B)」) 한 건입니다. 서비스는 자료실 Vercel 서버 함수 `api/restore.js`, 경로는 **`POST /api/restore`**(본문은 비우거나 `{"id":"b0000010-0000-4000-8000-00000000000b"}`), `aleph.config.json`의 `restoreRoute`입니다. 비공개 사본은 Supabase `public.note_snapshots`에 있고(브라우저 쪽 역할은 권한 없음, 서버는 읽기만), 만드는 SQL은 저장소 밖에 둡니다. 로그인한 사용자 ID가 사본의 소유자와 같을 때만, 사본의 ID·소유자·내용 해시(`title` + 줄바꿈 + `content`의 SHA-256)를 다시 계산해 맞으면 그 한 행만 고치거나(변조) 다시 넣습니다(삭제). 복원 뒤 다시 읽어 ID·소유자·해시가 사본과 같은지 응답(`id`·`action`·`ownerMatches`·`contentSha256`·`snapshotSha256`·`matches`)으로 돌려줍니다. 다른 메모·사본·감사 기록은 건드리지 않고, 남의 요청·다른 ID는 404, 토큰 없음은 401, 사본 해시가 틀리면 409로 아무것도 쓰지 않습니다. 본문·토큰·사용자 ID는 응답과 로그에 넣지 않습니다.
- `aleph.config.json`: `step` 10, `restoreRoute` `POST /api/restore`. `judgeIssuer`·`allowedRoutes`·`RULE_IDS`와 판정기 규칙은 그대로입니다(판정기에는 사본 비교용 `zoneRouteList`·`decideWithPolicy`만 더했고 `decide(request)`는 같은 표로 판정합니다). `src/attack-check.mjs`는 10단계에 복구 경로 점검 세 개를 먼저 보내고, 복구 직후 9단계와 같은 점검을 다시 보냅니다.

### 10단계 복구 뒤 재시험 순서 (제작 4)

결과는 실제로 실행한 것만 적습니다. 아래 표의 「미실행」은 아직 실행하지 않은 시험입니다.

1. 사전 백업 다시 읽기: `npm run policy -- verify` → 「해시 일치」, 「운영 정책이 사본과 같습니다」
2. 정책 침공·되돌리기: `npm run policy -- tamper` → `npm run policy -- restore`(바뀔 항목 확인) → `npm run policy -- restore --yes` → 「남은 차이 0개」, 두 판정 「통과」
3. 자료 복원 사본 만들기(처음 한 번): Supabase SQL Editor에서 `notes-snapshot.sql` ①②③ → ③의 세 칸 모두 `true`
4. B로 복구 대상 변조 또는 삭제 뒤 `POST /api/restore`(B 토큰) → 200, `matches: true`, 같은 `id`
5. 복구 직후 1~9단계 정상 요청: 배포 주소 `/`에 A로 로그인해 메모 읽기·추가·수정·삭제, B로 로그인해 복구된 메모 보기
6. 복구 직후 1~9단계 금지 요청: `npm run bundle`(`bundle-notes.json` 필요, B 토큰·A 메모 ID 환경변수 선택) → 토큰 없는·위조 토큰 401, anon 키 직접 요청 401, B의 A 메모 GET 404, `owner_id` PUT 400, 강사 자료 401·403, 공지 쓰기 405
7. 판정기·탐지기 연습: `npm run decider:test`(네 줄 통과), `npm run fixture:7`(`allow`·`step_up`), `npm run detect:test`(여섯 줄 통과)

| 순서 | 결과 (10단계 커밋 직전, 코딩 도구 환경) |
|---|---|
| 1 사전 백업 검증 | 해시 일치, 운영 정책과 같음 |
| 2 정책 침공·되돌리기 | 되돌리기 전 B 전체 목록 `allow`(침공 흔적) → 되돌린 뒤 `deny`, A 한 건 `allow` 유지, 남은 차이 0개 |
| 3 사본 SQL | 미실행 (학생이 Supabase에서 실행) |
| 4 B 메모 복원 | 미실행 (배포 주소에 B 토큰 요청 안 함). 가짜 DB로 한 로컬 연습에서는 변조 `updated`·삭제 `reinserted` 모두 해시 일치 |
| 5 정상 사용 | 미실행 |
| 6 금지 요청 | 미실행 (이 환경에서 배포 주소로 요청이 닿지 않음) |
| 7 판정기·탐지기 | 통과 (가상 요청 연습이며 심판 판정 아님) |

## 9단계 저장점: 도플갱어를 찾고 권한을 거둡니다

- 입력 처리(제작 1): `src/detect.mjs`의 `detect(events)`는 사건마다 `at`(시각)·`method`(요청 종류)·`identity.sub`(가명 사용자) 세 값만 읽습니다. 형식이 맞지 않는 사건은 세지 않습니다. 네트워크·기기·지역 값은 만들지도 쓰지도 않고, 메모 내용·토큰·실명은 저장하거나 출력하지 않습니다.
- 탐지 규칙(제작 2) `burst_read`: 같은 `identity.sub`의 `GET` 사건이 어느 10분 구간에서든 120건을 넘으면 의심입니다. 정확히 120건은 정상이고, 다른 사용자의 사건이나 10분 밖의 사건은 합치지 않습니다. 창 계산은 `at` 시각만 씁니다.
- 돌려주는 값(제작 3): 의심이면 `{action:"propose_revocation", reasonCode:"burst_read", subject:<그 sub>}` 세 키만, 아니면 `{action:"observe"}`만 돌려줍니다. 회수 API는 만들지 않았고 기기 권한·`src/decider.mjs`의 허용/거부 응답 형식과 `RULE_IDS`는 그대로입니다(탐지 결과는 판정기 응답이 아닙니다).
- `aleph.config.json`: `step` 9만 바꿨고 `judgeIssuer`·`allowedRoutes`는 그대로입니다. `src/attack-check.mjs`는 9단계에도 8단계의 자료실 주소 점검을 그대로 보냅니다.
- `npm run detect:test` 통과는 가상 사건 연습입니다. 운영 반 엔진의 사건 전달과 접속 회수는 이 저장소에 연결되어 있지 않아 미실행입니다.

### 9단계 확인 순서

1. `npm install`
2. `npm run detect:test` → 여섯 줄 모두 「통과」(121건·200건 폭주만 회수 제안, 30건·120건·두 사용자 각 100건·느린 200건은 `observe`)
3. `npm run decider:test` → 네 줄 모두 「통과」(정상 기기 유지)
4. `npm run bundle`(`bundle-notes.json` 필요) → 8단계와 같은 거부 결과면 정상

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
