-- 명작무료웹툰 운영자 댓글 상단 고정 기능
-- Supabase Dashboard > SQL Editor에서 전체를 실행합니다.

alter table public.webtoon_comments
  add column if not exists is_pinned boolean not null default false,
  add column if not exists pinned_at timestamptz,
  add column if not exists pinned_by uuid references auth.users(id) on delete set null;

create index if not exists webtoon_comments_pinned_idx
  on public.webtoon_comments (webtoon_id, is_pinned desc, pinned_at desc, created_at desc);

-- 기존 공개 조회 함수에 고정 상태를 포함하고, 고정 댓글을 항상 먼저 반환합니다.
-- 반환 항목이 추가되므로 이전 함수를 먼저 제거해야 합니다. 댓글 테이블·댓글 데이터는 삭제하지 않습니다.
drop function if exists public.list_webtoon_comments(uuid);

create function public.list_webtoon_comments(target_webtoon_id uuid)
returns table (
  id uuid,
  author_id uuid,
  author_name text,
  body text,
  is_hidden boolean,
  is_pinned boolean,
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
    comment.is_pinned,
    comment.created_at
  from public.webtoon_comments comment
  join public.webtoons webtoon on webtoon.id = comment.webtoon_id
  left join public.profiles profile on profile.id = comment.author_id
  where comment.webtoon_id = target_webtoon_id
    and webtoon.is_published = true
    and (comment.is_hidden = false or comment.author_id = auth.uid() or public.is_admin())
  order by comment.is_pinned desc, comment.pinned_at desc nulls last, comment.created_at desc;
$$;

grant execute on function public.list_webtoon_comments(uuid) to anon, authenticated;
