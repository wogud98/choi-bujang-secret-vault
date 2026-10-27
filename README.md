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
