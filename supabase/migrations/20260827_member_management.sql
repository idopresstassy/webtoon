-- 독립 회원 관리용 프로필 보완: 이메일과 최근 로그인 시각을 보관합니다.

alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists last_signed_in_at timestamptz;

create unique index if not exists profiles_email_unique_idx on public.profiles (email) where email is not null;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, last_signed_in_at)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    now()
  )
  on conflict (id) do update set
    email = excluded.email,
    last_signed_in_at = now();
  return new;
end;
$$;

update public.profiles profile
set email = users.email,
    last_signed_in_at = coalesce(profile.last_signed_in_at, users.last_sign_in_at, users.created_at)
from auth.users users
where profile.id = users.id;

create or replace function public.touch_last_signed_in()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  update public.profiles set last_signed_in_at = now() where id = new.id;
  return new;
end;
$$;

drop trigger if exists auth_user_signed_in on auth.users;
create trigger auth_user_signed_in
after update of last_sign_in_at on auth.users
for each row
when (old.last_sign_in_at is distinct from new.last_sign_in_at)
execute function public.touch_last_signed_in();

