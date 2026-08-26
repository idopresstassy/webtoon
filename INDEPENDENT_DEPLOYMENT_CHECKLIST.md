# 독립 배포 준비 체크리스트

명작무료웹툰의 독립 운영 기준 구성은 **Supabase(Postgres·회원 인증·이미지 저장)**와 **Vercel(웹·API 배포)**입니다. 현재 외부 계정 연결 오류가 있어도 아래 준비 작업은 GitHub 소스에서 계속 진행할 수 있습니다.

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

이미지 파일 자체는 기존 스토리지 또는 수동 보관 원본에서 내려받아 Supabase Storage의 비공개 버킷으로 다시 업로드합니다. GitHub에는 이미지 원본이나 회원·통계 데이터를 저장하지 않습니다.

## 4. Vercel 배포

Supabase 구성이 끝난 뒤 [Vercel](https://vercel.com/)에서 GitHub의 `idopresstassy/webtoon` 저장소를 연결합니다. 배포 전에 환경 변수를 등록하고, 비회원 감상·회원가입·운영자 로그인·작품 업로드를 순서대로 확인합니다.

> 외부 계정 연결이 계속 실패하면, 먼저 브라우저에서 Supabase 계정을 만든 뒤 이 작업으로 돌아오면 됩니다. 코드와 콘텐츠 내보내기 준비는 연결 없이도 계속 가능합니다.

