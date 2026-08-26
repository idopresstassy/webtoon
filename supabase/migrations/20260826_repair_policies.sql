-- 부분 적용된 20260826_independent_webtoon.sql을 안전하게 마무리합니다.
-- 기존 테이블·데이터는 지우지 않고, RLS 정책만 교체합니다.

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

drop policy if exists "profiles_read_own_or_admin" on public.profiles;
drop policy if exists "webtoons_public_read" on public.webtoons;
drop policy if exists "webtoons_admin_all" on public.webtoons;
drop policy if exists "episodes_public_read" on public.episodes;
drop policy if exists "episodes_admin_all" on public.episodes;
drop policy if exists "episode_images_public_read" on public.episode_images;
drop policy if exists "episode_images_admin_all" on public.episode_images;
drop policy if exists "reading_events_admin_read" on public.reading_events;
drop policy if exists "webtoon_assets_public_read" on storage.objects;
drop policy if exists "webtoon_assets_admin_insert" on storage.objects;
drop policy if exists "webtoon_assets_admin_update" on storage.objects;
drop policy if exists "webtoon_assets_admin_delete" on storage.objects;

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
