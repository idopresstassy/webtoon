-- 명작무료웹툰 독립 운영용 Supabase 스키마
-- Supabase Dashboard > SQL Editor에서 전체를 실행합니다.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role text not null default 'reader' check (role in ('reader', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.webtoons (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  title text not null check (char_length(title) between 1 and 160),
  genre text not null check (char_length(genre) between 1 and 80),
  description text not null check (char_length(description) between 1 and 5000),
  thumbnail_path text,
  is_published boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.episodes (
  id uuid primary key default gen_random_uuid(),
  webtoon_id uuid not null references public.webtoons(id) on delete cascade,
  episode_number integer not null check (episode_number > 0),
  title text not null check (char_length(title) between 1 and 160),
  is_published boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (webtoon_id, episode_number)
);

create table if not exists public.episode_images (
  id uuid primary key default gen_random_uuid(),
  episode_id uuid not null references public.episodes(id) on delete cascade,
  storage_path text not null,
  sort_order integer not null check (sort_order > 0),
  created_at timestamptz not null default now(),
  unique (episode_id, sort_order)
);

create table if not exists public.reading_events (
  id uuid primary key default gen_random_uuid(),
  webtoon_id uuid not null references public.webtoons(id) on delete cascade,
  episode_id uuid not null references public.episodes(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  visitor_id text,
  created_at timestamptz not null default now()
);

create index if not exists episodes_webtoon_id_idx on public.episodes(webtoon_id, episode_number);
create index if not exists episode_images_episode_id_idx on public.episode_images(episode_id, sort_order);
create index if not exists reading_events_webtoon_id_idx on public.reading_events(webtoon_id, created_at desc);
create index if not exists reading_events_episode_id_idx on public.reading_events(episode_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists webtoons_set_updated_at on public.webtoons;
create trigger webtoons_set_updated_at before update on public.webtoons
for each row execute function public.set_updated_at();

drop trigger if exists episodes_set_updated_at on public.episodes;
create trigger episodes_set_updated_at before update on public.episodes
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists auth_user_profile_created on auth.users;
create trigger auth_user_profile_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

alter table public.profiles enable row level security;
alter table public.webtoons enable row level security;
alter table public.episodes enable row level security;
alter table public.episode_images enable row level security;
alter table public.reading_events enable row level security;

create policy "profiles_read_own_or_admin" on public.profiles for select
using (id = auth.uid() or public.is_admin());

create policy "webtoons_public_read" on public.webtoons for select
using (is_published = true);
create policy "webtoons_admin_all" on public.webtoons for all
using (public.is_admin()) with check (public.is_admin());

create policy "episodes_public_read" on public.episodes for select
using (
  is_published = true and exists (
    select 1 from public.webtoons w where w.id = webtoon_id and w.is_published = true
  )
);
create policy "episodes_admin_all" on public.episodes for all
using (public.is_admin()) with check (public.is_admin());

create policy "episode_images_public_read" on public.episode_images for select
using (
  exists (
    select 1 from public.episodes e
    join public.webtoons w on w.id = e.webtoon_id
    where e.id = episode_id and e.is_published = true and w.is_published = true
  )
);
create policy "episode_images_admin_all" on public.episode_images for all
using (public.is_admin()) with check (public.is_admin());

create policy "reading_events_admin_read" on public.reading_events for select
using (public.is_admin());

create or replace function public.record_reading_event(
  target_webtoon_id uuid,
  target_episode_id uuid,
  anonymous_visitor_id text default null
)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not exists (
    select 1 from public.episodes e
    join public.webtoons w on w.id = e.webtoon_id
    where e.id = target_episode_id
      and e.webtoon_id = target_webtoon_id
      and e.is_published = true
      and w.is_published = true
  ) then
    raise exception 'Published episode not found';
  end if;

  insert into public.reading_events (webtoon_id, episode_id, user_id, visitor_id)
  values (target_webtoon_id, target_episode_id, auth.uid(), nullif(trim(anonymous_visitor_id), ''));
end;
$$;

grant execute on function public.record_reading_event(uuid, uuid, text) to anon, authenticated;

insert into storage.buckets (id, name, public)
values ('webtoon-assets', 'webtoon-assets', true)
on conflict (id) do update set public = true;

create policy "webtoon_assets_public_read" on storage.objects for select
using (bucket_id = 'webtoon-assets');
create policy "webtoon_assets_admin_insert" on storage.objects for insert
with check (bucket_id = 'webtoon-assets' and public.is_admin());
create policy "webtoon_assets_admin_update" on storage.objects for update
using (bucket_id = 'webtoon-assets' and public.is_admin())
with check (bucket_id = 'webtoon-assets' and public.is_admin());
create policy "webtoon_assets_admin_delete" on storage.objects for delete
using (bucket_id = 'webtoon-assets' and public.is_admin());

-- 첫 운영자 설정: 가입 후 아래 이메일을 실제 운영자 이메일로 바꿔 한 번만 실행합니다.
-- update public.profiles set role = 'admin'
-- where id = (select id from auth.users where email = '운영자 이메일');
