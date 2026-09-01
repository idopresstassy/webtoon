import { supabase } from "@/lib/supabase";

type WorkRow = { id: string; slug: string; title: string; genre: string; description: string; thumbnail_path: string | null; is_published: boolean; published_at: string | null; created_at: string };
type EpisodeRow = { id: string; webtoon_id: string; episode_number: number; title: string; is_published: boolean; published_at: string | null; created_at: string; viewer_mode?: "scroll" | "swipe" | "both" | null; reading_direction?: "ltr" | "rtl" | null };
type ImageRow = { id: string; episode_id: string; storage_path: string; sort_order: number; page_number?: number | null; page_width?: number | null; page_height?: number | null };

export type PublicEpisode = { id: string; webtoonId: string; episodeNumber: number; title: string; publishedAt: string | null; viewerMode: "scroll" | "swipe" | "both"; readingDirection: "ltr" | "rtl" };
export type PublicWork = { id: string; slug: string; title: string; genre: string; description: string; thumbnailUrl: string | null; latestEpisode: PublicEpisode | null; publishedAt: string | null };

function publicAssetUrl(path: string | null) {
  if (!path) return null;
  return supabase.storage.from("webtoon-assets").getPublicUrl(path).data.publicUrl;
}

function toEpisode(row: EpisodeRow): PublicEpisode {
  return { id: row.id, webtoonId: row.webtoon_id, episodeNumber: row.episode_number, title: row.title, publishedAt: row.published_at, viewerMode: row.viewer_mode === "swipe" ? "swipe" : row.viewer_mode === "both" ? "both" : "scroll", readingDirection: row.reading_direction === "rtl" ? "rtl" : "ltr" };
}

export async function getGenres() {
  const { data, error } = await supabase.from("webtoons").select("genre").eq("is_published", true);
  if (error) throw error;
  return Array.from(new Set((data ?? []).map(item => item.genre))).sort((left, right) => left.localeCompare(right, "ko"));
}

export async function listPublicWebtoons({ search, genre }: { search?: string; genre?: string }) {
  let query = supabase.from("webtoons").select("id, slug, title, genre, description, thumbnail_path, is_published, published_at, created_at").eq("is_published", true).order("created_at", { ascending: false });
  if (genre) query = query.eq("genre", genre);
  if (search?.trim()) query = query.or(`title.ilike.%${search.trim()}%,description.ilike.%${search.trim()}%`);
  const { data: works, error } = await query;
  if (error) throw error;
  const ids = (works ?? []).map(work => work.id);
  const { data: episodes, error: episodeError } = ids.length
    ? await supabase.from("episodes").select("id, webtoon_id, episode_number, title, is_published, published_at, created_at, viewer_mode, reading_direction").in("webtoon_id", ids).eq("is_published", true).order("episode_number", { ascending: false })
    : { data: [], error: null };
  if (episodeError) throw episodeError;
  const latestByWork = new Map<string, PublicEpisode>();
  for (const episode of (episodes ?? []) as EpisodeRow[]) if (!latestByWork.has(episode.webtoon_id)) latestByWork.set(episode.webtoon_id, toEpisode(episode));
  return ((works ?? []) as WorkRow[]).map(work => ({
    id: work.id,
    slug: work.slug,
    title: work.title,
    genre: work.genre,
    description: work.description,
    thumbnailUrl: publicAssetUrl(work.thumbnail_path),
    latestEpisode: latestByWork.get(work.id) ?? null,
    publishedAt: work.published_at,
  } satisfies PublicWork));
}

export async function getPublicWebtoon(slug: string) {
  const { data: work, error } = await supabase.from("webtoons").select("id, slug, title, genre, description, thumbnail_path, is_published, published_at, created_at").eq("slug", slug).eq("is_published", true).single();
  if (error) throw error;
  const { data: episodes, error: episodeError } = await supabase.from("episodes").select("id, webtoon_id, episode_number, title, is_published, published_at, created_at, viewer_mode, reading_direction").eq("webtoon_id", work.id).eq("is_published", true).order("episode_number");
  if (episodeError) throw episodeError;
  return {
    work: { id: work.id, slug: work.slug, title: work.title, genre: work.genre, description: work.description, thumbnailUrl: publicAssetUrl(work.thumbnail_path), publishedAt: work.published_at },
    episodes: ((episodes ?? []) as EpisodeRow[]).map(toEpisode),
  };
}

export async function getPublicViewer(slug: string, episodeNumber: number) {
  const detail = await getPublicWebtoon(slug);
  const episode = detail.episodes.find(item => item.episodeNumber === episodeNumber);
  if (!episode) throw new Error("공개된 회차를 찾을 수 없습니다.");
  const { data: images, error } = await supabase.from("episode_images").select("id, episode_id, storage_path, sort_order, page_number, page_width, page_height").eq("episode_id", episode.id).order("sort_order");
  if (error) throw error;
  return {
    work: detail.work,
    episode,
    allEpisodes: detail.episodes,
    images: ((images ?? []) as ImageRow[]).map(image => ({ id: image.id, imageUrl: publicAssetUrl(image.storage_path), sortOrder: image.sort_order, pageNumber: image.page_number ?? image.sort_order, width: image.page_width ?? 690, height: image.page_height ?? null })),
  };
}

export async function recordPublicReading(webtoonId: string, episodeId: string, visitorId: string) {
  const { error } = await supabase.rpc("record_reading_event", { target_webtoon_id: webtoonId, target_episode_id: episodeId, anonymous_visitor_id: visitorId });
  if (error) throw error;
}
