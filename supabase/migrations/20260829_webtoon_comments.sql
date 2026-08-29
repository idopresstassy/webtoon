-- 명작무료웹툰 작품별 댓글 기능
-- Supabase Dashboard > SQL Editor에서 전체를 실행합니다.

create table if not exists public.webtoon_comments (
  id uuid primary key default gen_random_uuid(),
  webtoon_id uuid not null references public.webtoons(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 1000),
  is_hidden boolean not null default false,
  hidden_at timestamptz,
  hidden_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists webtoon_comments_visible_idx
  on public.webtoon_comments (webtoon_id, is_hidden, created_at desc);
create index if not exists webtoon_comments_author_idx
  on public.webtoon_comments (author_id, created_at desc);

drop trigger if exists webtoon_comments_set_updated_at on public.webtoon_comments;
create trigger webtoon_comments_set_updated_at
before update on public.webtoon_comments
for each row execute function public.set_updated_at();

alter table public.webtoon_comments enable row level security;

drop policy if exists "webtoon_comments_public_read" on public.webtoon_comments;
create policy "webtoon_comments_public_read" on public.webtoon_comments
for select
using (is_hidden = false or author_id = auth.uid() or public.is_admin());

drop policy if exists "webtoon_comments_authenticated_insert" on public.webtoon_comments;
create policy "webtoon_comments_authenticated_insert" on public.webtoon_comments
for insert to authenticated
with check (
  author_id = auth.uid()
  and exists (select 1 from public.webtoons where id = webtoon_id and is_published = true)
);

drop policy if exists "webtoon_comments_author_or_admin_delete" on public.webtoon_comments;
create policy "webtoon_comments_author_or_admin_delete" on public.webtoon_comments
for delete to authenticated
using (author_id = auth.uid() or public.is_admin());

drop policy if exists "webtoon_comments_admin_update" on public.webtoon_comments;
create policy "webtoon_comments_admin_update" on public.webtoon_comments
for update to authenticated
using (public.is_admin())
with check (public.is_admin());

-- 댓글 작성자의 이름만 공개하며, profiles.email을 노출하지 않는 안전한 공개 조회입니다.
create or replace function public.list_webtoon_comments(target_webtoon_id uuid)
returns table (
  id uuid,
  author_id uuid,
  author_name text,
  body text,
  is_hidden boolean,
  created_at timestamptz
)
language sql
stable
security definer set search_path = public
as $$
  select
    comment.id,
    comment.author_id,
    coalesce(nullif(trim(profile.display_name), ''), '회원') as author_name,
    comment.body,
    comment.is_hidden,
    comment.created_at
  from public.webtoon_comments comment
  join public.webtoons webtoon on webtoon.id = comment.webtoon_id
  left join public.profiles profile on profile.id = comment.author_id
  where comment.webtoon_id = target_webtoon_id
    and webtoon.is_published = true
    and (comment.is_hidden = false or comment.author_id = auth.uid() or public.is_admin())
  order by comment.created_at desc;
$$;

grant execute on function public.list_webtoon_comments(uuid) to anon, authenticated;

