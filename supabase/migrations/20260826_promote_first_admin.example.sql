-- Supabase Authentication > Users에서 이메일 사용자를 먼저 만든 뒤 실행합니다.
-- 아래 이메일을 실제 운영자 이메일로 바꿉니다.

insert into public.profiles (id, display_name, role)
select
  id,
  coalesce(raw_user_meta_data ->> 'name', split_part(email, '@', 1)),
  'admin'
from auth.users
where email = '운영자 이메일'
on conflict (id) do update set role = 'admin';

