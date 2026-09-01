-- 웹툰 페이지별 업로드 규격 및 뷰어 설정
-- Supabase SQL Editor에서 한 번만 실행하세요. 기존 작품/회차/이미지는 삭제하지 않습니다.

alter table public.episodes
  add column if not exists viewer_mode text not null default 'scroll',
  add column if not exists reading_direction text not null default 'ltr';

alter table public.episodes drop constraint if exists episodes_viewer_mode_check;
alter table public.episodes add constraint episodes_viewer_mode_check check (viewer_mode in ('scroll', 'swipe', 'both'));
alter table public.episodes drop constraint if exists episodes_reading_direction_check;
alter table public.episodes add constraint episodes_reading_direction_check check (reading_direction in ('ltr', 'rtl'));

alter table public.episode_images
  add column if not exists page_number integer,
  add column if not exists page_width integer,
  add column if not exists page_height integer;

alter table public.episode_images drop constraint if exists episode_images_page_number_check;
alter table public.episode_images add constraint episode_images_page_number_check check (page_number is null or page_number > 0);
alter table public.episode_images drop constraint if exists episode_images_page_width_check;
alter table public.episode_images add constraint episode_images_page_width_check check (page_width is null or page_width = 690);
alter table public.episode_images drop constraint if exists episode_images_page_height_check;
alter table public.episode_images add constraint episode_images_page_height_check check (page_height is null or (page_height > 0 and page_height <= 1280));

update public.episode_images set page_number = sort_order where page_number is null;
create index if not exists episode_images_page_number_idx on public.episode_images (episode_id, page_number);
