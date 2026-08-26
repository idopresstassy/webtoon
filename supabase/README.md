# Supabase 적용 방법

## 스키마와 보안 정책

1. Supabase 프로젝트 왼쪽 메뉴에서 **SQL Editor**를 엽니다.
2. **New query**를 누릅니다.
3. `migrations/20260826_independent_webtoon.sql` 전체를 붙여 넣고 **Run**을 누릅니다.
4. 오류가 없으면 `webtoons`, `episodes`, `episode_images`, `reading_events`, `profiles` 테이블과 `webtoon-assets` 버킷이 생성됩니다.

## 첫 운영자 지정

회원가입 후 SQL Editor에서 아래 SQL의 이메일만 실제 운영자 이메일로 바꿔 실행합니다.

```sql
update public.profiles set role = 'admin'
where id = (select id from auth.users where email = '운영자 이메일');
```

## 인증 설정

Supabase Dashboard의 **Authentication → Providers**에서 Email 제공자를 켭니다. 이메일 확인을 사용할지 여부는 독립 웹앱의 로그인 구현 단계에서 결정합니다. GitHub 로그인은 필요할 때만 같은 메뉴에서 추가합니다.

## 이미지 저장

`webtoon-assets`는 공개된 웹툰 이미지를 독자가 볼 수 있는 공개 버킷입니다. 업로드·수정·삭제는 RLS 정책상 `admin` 역할만 할 수 있습니다. 작품 표지는 `covers/`, 회차 이미지는 `episodes/` 경로 아래에 보관합니다.
