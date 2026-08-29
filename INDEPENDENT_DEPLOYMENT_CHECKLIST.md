# 독립 배포 준비 체크리스트

명작무료웹툰의 독립 운영 기준 구성은 **Supabase(Postgres·회원 인증·이미지 저장)**와 **Vercel(정적 React 웹 배포)**입니다. 공개 목록·상세·세로 뷰어와 운영자 콘텐츠 관리·회원·통계 화면은 Supabase를 직접 사용하며, 독립 배포에서는 기존 Manus 서버를 사용하지 않습니다.

## 1. Supabase 계정과 프로젝트 만들기

1. 브라우저에서 [Supabase Dashboard](https://supabase.com/dashboard/sign-in)를 직접 엽니다.
2. **Continue with GitHub** 또는 이메일 가입으로 로그인합니다.
3. **New project**를 누르고 프로젝트 이름을 `masterpiece-free-webtoon`으로 입력합니다.
4. 데이터베이스 비밀번호는 안전한 곳에 보관합니다. 대화창에 입력하지 않습니다.
5. 리전은 독자와 가까운 아시아 지역을 선택합니다.
6. 프로젝트 생성이 끝나면 이 작업 화면에 **“Supabase 프로젝트 생성 완료”**라고 알려줍니다.

## 2. 비밀 값 등록

프로젝트 생성 후에는 Supabase의 Project Settings → API와 Database에서 필요한 값을 확인합니다. 키·비밀번호는 대화창에 복사하지 말고, 별도 보안 입력 요청이 열릴 때만 등록합니다.

| 용도 | 필요한 값 |
|---|---|
| 브라우저 연결 | 프로젝트 URL, 익명 키 |
| 서버 데이터 이전 | 데이터베이스 연결 문자열 |
| 서버 이미지 업로드 | 서비스 역할 키 |

## 3. 콘텐츠 이전

현재 소스에는 `scripts/export-content.mjs`가 포함되어 있습니다. 기존 데이터베이스에 연결 가능한 환경에서 실행하면 작품·회차·이미지 참조를 JSON으로 내보낼 수 있습니다.

```bash
node scripts/export-content.mjs > content-manifest.json
```

이미지 파일 자체는 기존 스토리지 또는 수동 보관 원본에서 내려받아 Supabase Storage의 **공개 읽기 버킷** `webtoon-assets`로 다시 업로드합니다. 이미지 경로·테이블 행은 RLS로 관리하고, GitHub에는 이미지 원본이나 회원·통계 데이터를 저장하지 않습니다.

현재 프로젝트에서 이전을 수행할 수 있는 경우에는 아래 스크립트가 작품·회차·이미지 파일을 `webtoon-assets` 버킷으로 복사합니다. 실행 전 Supabase 보안 키와 기존 DB·이미지 저장소 접근이 모두 가능한지 확인합니다.

```bash
node scripts/import-content-to-supabase.mjs
```

## 4. Vercel 배포

Supabase 구성이 끝난 뒤 [Vercel](https://vercel.com/)에서 GitHub의 `idopresstassy/webtoon` 저장소를 연결합니다. 프로젝트는 `vercel.json`으로 SPA 경로와 정적 출력 폴더를 지정하므로 Framework Preset은 **Vite**, Build Command는 `pnpm build`, Output Directory는 `dist/public`으로 확인합니다.

Vercel의 **Settings → Environment Variables**에 다음 두 값만 등록합니다. `SUPABASE_SECRET_KEY`는 브라우저·Vercel 환경 변수에 절대 등록하지 않습니다.

| 이름 | 환경 | 설명 |
|---|---|---|
| `VITE_SUPABASE_URL` | Production, Preview | Supabase 프로젝트 URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Production, Preview | Supabase Publishable key |

배포 후에는 비회원 감상, 회원가입·로그인, 운영자 로그인, 작품·회차 업로드, 이미지 순서 변경, 회원·통계 조회를 차례대로 확인합니다.

## 5. 2026-08-29 독립 배포 확인 기록

- Vercel 프로젝트 `webtoon`의 기본 공개 주소 `https://webtoon-sand.vercel.app`에서 홈과 이생규장전 작품 상세가 정상 열리는 것을 확인했습니다.
- GitHub 최신 커밋 재배포 후에도 기본 공개 주소에서 CSS 기반 먹빛 영웅 질감과 공개 작품 카드가 정상 렌더링되며, 영웅 영역의 `/manus-storage/` 이미지 의존성이 제거된 것을 확인했습니다.
- 작품 상세에는 Supabase `webtoon-assets`의 표지와 공개된 4개 회차가 표시되며, 1화 뷰어는 Supabase Storage의 세로 이미지 3개 URL을 사용합니다.
- `koreawebtoon.com`과 `www.koreawebtoon.com`을 Vercel Domains에 추가했습니다. 도메인 구입처의 기존 Manus 연결을 해제하고 아래 DNS 레코드를 등록했습니다.

| 이름 | 유형 | 값 |
|---|---|---|
| `@` | A | `216.198.79.1` |
| `www` | CNAME | `adf9158d20cd60e4.vercel-dns-017.com` |

공개 DNS 확인 서비스에서는 위 값이 확인되었으나, Vercel 관리 화면의 상태가 `Valid Configuration`으로 갱신되기까지는 전파 시간이 더 걸릴 수 있습니다.

- `https://www.koreawebtoon.com`은 독립 Vercel 사이트의 홈을 실제로 제공하는 것을 확인했습니다.
- `https://koreawebtoon.com`은 www로 308 이동하도록 설정되어 있으나, 루트 도메인의 HTTPS 인증서 발급이 완료되기 전에는 브라우저에서 TLS 오류가 날 수 있습니다. Vercel 상태가 두 도메인 모두 `Valid Configuration`으로 바뀐 뒤 루트 리디렉션을 다시 확인합니다.

> 외부 계정 연결이 계속 실패하면, 먼저 브라우저에서 Supabase 계정을 만든 뒤 이 작업으로 돌아오면 됩니다. 코드와 콘텐츠 내보내기 준비는 연결 없이도 계속 가능합니다.
