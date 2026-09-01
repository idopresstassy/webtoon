import { supabase } from "@/lib/supabase";

type EpisodeImageRow = { id: string; episode_id: string; storage_path: string; sort_order: number; page_number?: number | null; page_width?: number | null; page_height?: number | null };

export type AdminMember = {
  id: string;
  name: string | null;
  email: string | null;
  role: "reader" | "admin";
  createdAt: string;
  lastSignedInAt: string | null;
};

export type AdminEpisodeImage = { id: string; storagePath: string; imageUrl: string; sortOrder: number; pageNumber?: number; width?: number; height?: number | null };
export type AdminEpisode = { id: string; webtoonId: string; episodeNumber: number; title: string; isPublished: boolean; viewerMode: "scroll" | "swipe" | "both"; readingDirection: "ltr" | "rtl"; images: AdminEpisodeImage[] };
export type AdminWork = { id: string; slug: string; title: string; genre: string; description: string; thumbnailPath: string | null; thumbnailUrl: string | null; isPublished: boolean; episodeCount: number };
export type AdminWorkDetail = { work: AdminWork; episodes: AdminEpisode[] };

export type AdminDashboard = {
  totalMembers: number;
  newMembers: number;
  totalViews: number;
  activeVisitors: number;
  workCount: number;
  dailyViews: { date: string; views: number }[];
  topEpisodes: { episodeId: string; workTitle: string; episodeNumber: number; episodeTitle: string; views: number }[];
  topWorks: { workId: string; workTitle: string; genre: string; views: number }[];
};

type WorkRow = { id: string; slug: string; title: string; genre: string; description: string; thumbnail_path: string | null; is_published: boolean };
type EpisodeRow = { id: string; webtoon_id: string; episode_number: number; title: string; is_published: boolean; viewer_mode?: "scroll" | "swipe" | "both" | null; reading_direction?: "ltr" | "rtl" | null };
type ReadingEvent = { id: string; webtoon_id: string; episode_id: string; visitor_id: string | null; user_id: string | null; created_at: string; episodes: { title: string; episode_number: number; webtoons: { title: string; genre: string } | null } | null };

function publicAssetUrl(path: string | null) {
  return path ? supabase.storage.from("webtoon-assets").getPublicUrl(path).data.publicUrl : null;
}

function toWork(work: WorkRow, episodeCount = 0): AdminWork {
  return { id: work.id, slug: work.slug, title: work.title, genre: work.genre, description: work.description, thumbnailPath: work.thumbnail_path, thumbnailUrl: publicAssetUrl(work.thumbnail_path), isPublished: work.is_published, episodeCount };
}

function fileExtension(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (["jpg", "jpeg", "png", "webp"].includes(extension ?? "")) return extension === "jpeg" ? "jpg" : extension;
  return file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
}

function safeFileToken(file: File) {
  return `${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 48)}`;
}

const PAGE_WIDTH = 690;
const PAGE_HEIGHT = 1280;
const MAX_CUT_BYTES = 2 * 1024 * 1024;
const MAX_CUTS = 70;

async function normalizeCut(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) throw new Error("JPG, PNG, WEBP 이미지 파일만 등록할 수 있습니다.");
  const bitmap = await createImageBitmap(file);
  const scale = PAGE_WIDTH / bitmap.width;
  const sourceHeight = Math.min(bitmap.height, Math.floor(PAGE_HEIGHT / scale));
  const canvas = document.createElement("canvas");
  canvas.width = PAGE_WIDTH;
  canvas.height = Math.min(PAGE_HEIGHT, Math.max(1, Math.round(sourceHeight * scale)));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("이미지 변환을 지원하지 않는 브라우저입니다.");
  context.drawImage(bitmap, 0, 0, bitmap.width, sourceHeight, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blobFor = (quality: number) => new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("이미지 변환에 실패했습니다.")), "image/webp", quality));
  let blob = await blobFor(0.86);
  for (const quality of [0.78, 0.68, 0.58, 0.48]) if (blob.size > MAX_CUT_BYTES) blob = await blobFor(quality);
  if (blob.size > MAX_CUT_BYTES) throw new Error("변환 후에도 이미지가 2MB를 초과합니다. 더 단순한 이미지를 사용해 주세요.");
  return new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.webp`, { type: "image/webp", lastModified: Date.now() });
}

async function uploadImage(path: string, file: File) {
  const { error } = await supabase.storage.from("webtoon-assets").upload(path, file, { cacheControl: "31536000", contentType: file.type || "image/jpeg", upsert: false });
  if (error) throw error;
  return path;
}

async function removeStorageFiles(paths: (string | null | undefined)[]) {
  const targets = paths.filter((path): path is string => Boolean(path));
  if (!targets.length) return;
  const { error } = await supabase.storage.from("webtoon-assets").remove(targets);
  if (error) throw error;
}

export async function listAdminWebtoons(): Promise<AdminWork[]> {
  const [worksResult, episodesResult] = await Promise.all([
    supabase.from("webtoons").select("id, slug, title, genre, description, thumbnail_path, is_published").order("created_at", { ascending: false }),
    supabase.from("episodes").select("webtoon_id"),
  ]);
  if (worksResult.error) throw worksResult.error;
  if (episodesResult.error) throw episodesResult.error;
  const counts = new Map<string, number>();
  for (const episode of episodesResult.data ?? []) counts.set(episode.webtoon_id, (counts.get(episode.webtoon_id) ?? 0) + 1);
  return ((worksResult.data ?? []) as WorkRow[]).map(work => toWork(work, counts.get(work.id) ?? 0));
}

export async function getAdminWebtoon(id: string): Promise<AdminWorkDetail> {
  const { data: work, error: workError } = await supabase.from("webtoons").select("id, slug, title, genre, description, thumbnail_path, is_published").eq("id", id).single();
  if (workError) throw workError;
  const { data: episodeRows, error: episodeError } = await supabase.from("episodes").select("id, webtoon_id, episode_number, title, is_published, viewer_mode, reading_direction").eq("webtoon_id", id).order("episode_number");
  if (episodeError) throw episodeError;
  const episodes = (episodeRows ?? []) as EpisodeRow[];
  const ids = episodes.map(episode => episode.id);
  const { data: images, error: imageError } = ids.length ? await supabase.from("episode_images").select("id, episode_id, storage_path, sort_order, page_number, page_width, page_height").in("episode_id", ids).order("sort_order") : { data: [], error: null };
  if (imageError) throw imageError;
  const imagesByEpisode = new Map<string, AdminEpisodeImage[]>();
  for (const image of (images ?? []) as EpisodeImageRow[]) {
    const group = imagesByEpisode.get(image.episode_id) ?? [];
    group.push({ id: image.id, storagePath: image.storage_path, imageUrl: publicAssetUrl(image.storage_path) ?? "", sortOrder: image.sort_order, pageNumber: image.page_number ?? image.sort_order, width: image.page_width ?? 690, height: image.page_height ?? null });
    imagesByEpisode.set(image.episode_id, group);
  }
  return { work: toWork(work as WorkRow, episodes.length), episodes: episodes.map(episode => ({ id: episode.id, webtoonId: episode.webtoon_id, episodeNumber: episode.episode_number, title: episode.title, isPublished: episode.is_published, viewerMode: episode.viewer_mode === "swipe" ? "swipe" : episode.viewer_mode === "both" ? "both" : "scroll", readingDirection: episode.reading_direction === "rtl" ? "rtl" : "ltr", images: imagesByEpisode.get(episode.id) ?? [] })) };
}

export async function createAdminWebtoon(input: { slug: string; title: string; genre: string; description: string; isPublished: boolean; coverFile: File }) {
  const coverPath = `covers/${input.slug}/${safeFileToken(input.coverFile)}.${fileExtension(input.coverFile)}`;
  await uploadImage(coverPath, input.coverFile);
  const { error } = await supabase.from("webtoons").insert({ slug: input.slug, title: input.title.trim(), genre: input.genre.trim(), description: input.description.trim(), thumbnail_path: coverPath, is_published: input.isPublished, published_at: input.isPublished ? new Date().toISOString() : null });
  if (error) {
    await removeStorageFiles([coverPath]);
    throw error;
  }
}

export async function updateAdminWebtoon(input: { id: string; slug: string; title: string; genre: string; description: string; isPublished: boolean; coverFile?: File; currentThumbnailPath?: string | null }) {
  let thumbnailPath = input.currentThumbnailPath ?? null;
  if (input.coverFile) thumbnailPath = await uploadImage(`covers/${input.slug}/${safeFileToken(input.coverFile)}.${fileExtension(input.coverFile)}`, input.coverFile);
  const { error } = await supabase.from("webtoons").update({ slug: input.slug, title: input.title.trim(), genre: input.genre.trim(), description: input.description.trim(), thumbnail_path: thumbnailPath, is_published: input.isPublished, published_at: input.isPublished ? new Date().toISOString() : null }).eq("id", input.id);
  if (error) throw error;
  if (input.coverFile && input.currentThumbnailPath && input.currentThumbnailPath !== thumbnailPath) await removeStorageFiles([input.currentThumbnailPath]);
}

export async function deleteAdminWebtoon(work: AdminWorkDetail) {
  const paths = [work.work.thumbnailPath, ...work.episodes.flatMap(episode => episode.images.map(image => image.storagePath))];
  const { error } = await supabase.from("webtoons").delete().eq("id", work.work.id);
  if (error) throw error;
  await removeStorageFiles(paths);
}

export async function createAdminEpisode(input: { work: AdminWork; episodeNumber: number; title: string; isPublished: boolean; imageFiles: File[]; viewerMode?: "scroll" | "swipe" | "both"; readingDirection?: "ltr" | "rtl" }) {
  if (input.imageFiles.length > MAX_CUTS) throw new Error(`회차당 이미지는 최대 ${MAX_CUTS}컷까지 등록할 수 있습니다.`);
  const { data: episode, error } = await supabase.from("episodes").insert({ webtoon_id: input.work.id, episode_number: input.episodeNumber, title: input.title.trim(), is_published: input.isPublished, viewer_mode: input.viewerMode ?? "both", reading_direction: input.readingDirection ?? "ltr", published_at: input.isPublished ? new Date().toISOString() : null }).select("id").single();
  if (error) throw error;
  const paths: string[] = [];
  try {
    for (let index = 0; index < input.imageFiles.length; index += 1) {
      const file = await normalizeCut(input.imageFiles[index]);
      paths.push(await uploadImage(`episodes/${input.work.slug}/${String(input.episodeNumber).padStart(3, "0")}/${String(index + 1).padStart(3, "0")}-${safeFileToken(file)}.${fileExtension(file)}`, file));
    }
    const { error: imageError } = await supabase.from("episode_images").insert(paths.map((storage_path, index) => ({ episode_id: episode.id, storage_path, sort_order: index + 1, page_number: index + 1, page_width: PAGE_WIDTH, page_height: null })));
    if (imageError) throw imageError;
  } catch (caught) {
    await supabase.from("episodes").delete().eq("id", episode.id);
    await removeStorageFiles(paths);
    throw caught;
  }
}

export async function updateAdminEpisode(input: { episode: AdminEpisode; work: AdminWork; episodeNumber: number; title: string; isPublished: boolean; imageFiles?: File[]; imageOrder?: AdminEpisodeImage[]; viewerMode?: "scroll" | "swipe" | "both"; readingDirection?: "ltr" | "rtl" }) {
  const { error } = await supabase.from("episodes").update({ episode_number: input.episodeNumber, title: input.title.trim(), is_published: input.isPublished, viewer_mode: input.viewerMode ?? "both", reading_direction: input.readingDirection ?? "ltr", published_at: input.isPublished ? new Date().toISOString() : null }).eq("id", input.episode.id);
  if (error) throw error;
  if (input.imageFiles?.length) {
    const paths: string[] = [];
    try {
      if (input.imageFiles.length > MAX_CUTS) throw new Error(`회차당 이미지는 최대 ${MAX_CUTS}컷까지 등록할 수 있습니다.`);
      for (let index = 0; index < input.imageFiles.length; index += 1) {
        const file = await normalizeCut(input.imageFiles[index]);
        paths.push(await uploadImage(`episodes/${input.work.slug}/${String(input.episodeNumber).padStart(3, "0")}/${String(index + 1).padStart(3, "0")}-${safeFileToken(file)}.${fileExtension(file)}`, file));
      }
      const { error: deleteError } = await supabase.from("episode_images").delete().eq("episode_id", input.episode.id);
      if (deleteError) throw deleteError;
      const { error: insertError } = await supabase.from("episode_images").insert(paths.map((storage_path, index) => ({ episode_id: input.episode.id, storage_path, sort_order: index + 1, page_number: index + 1, page_width: PAGE_WIDTH, page_height: null })));
      if (insertError) throw insertError;
      await removeStorageFiles(input.episode.images.map(image => image.storagePath));
    } catch (caught) {
      await removeStorageFiles(paths);
      throw caught;
    }
  } else if (input.imageOrder) {
    const { error: deleteError } = await supabase.from("episode_images").delete().eq("episode_id", input.episode.id);
    if (deleteError) throw deleteError;
    const { error: insertError } = await supabase.from("episode_images").insert(input.imageOrder.map((image, index) => ({ episode_id: input.episode.id, storage_path: image.storagePath, sort_order: index + 1, page_number: index + 1, page_width: image.width ?? PAGE_WIDTH, page_height: image.height ?? null })));
    if (insertError) throw insertError;
  }
}

export async function deleteAdminEpisode(episode: AdminEpisode) {
  const { error } = await supabase.from("episodes").delete().eq("id", episode.id);
  if (error) throw error;
  await removeStorageFiles(episode.images.map(image => image.storagePath));
}

export async function listAdminMembers(): Promise<AdminMember[]> {
  const { data, error } = await supabase.from("profiles").select("id, display_name, email, role, created_at, last_signed_in_at").order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(profile => ({ id: profile.id, name: profile.display_name, email: profile.email, role: profile.role === "admin" ? "admin" : "reader", createdAt: profile.created_at, lastSignedInAt: profile.last_signed_in_at }));
}

function localDay(value: Date) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(value);
  const valueFor = (type: Intl.DateTimeFormatPartTypes) => parts.find(part => part.type === type)?.value ?? "";
  return `${valueFor("year")}-${valueFor("month")}-${valueFor("day")}`;
}

function daysAgo(days: number) { return new Date(Date.now() - days * 24 * 60 * 60 * 1000); }

export async function getAdminDashboard(): Promise<AdminDashboard> {
  const fourteenDaysAgo = daysAgo(13).toISOString();
  const thirtyDaysAgo = daysAgo(29).toISOString();
  const [profilesResult, eventsResult, totalViewsResult, worksResult] = await Promise.all([
    supabase.from("profiles").select("id, created_at"),
    supabase.from("reading_events").select("id, webtoon_id, episode_id, visitor_id, user_id, created_at, episodes(title, episode_number, webtoons(title, genre))").gte("created_at", fourteenDaysAgo),
    supabase.from("reading_events").select("id", { count: "exact", head: true }),
    supabase.from("webtoons").select("id", { count: "exact", head: true }),
  ]);
  if (profilesResult.error) throw profilesResult.error;
  if (eventsResult.error) throw eventsResult.error;
  if (totalViewsResult.error) throw totalViewsResult.error;
  if (worksResult.error) throw worksResult.error;
  const profiles = profilesResult.data ?? [];
  const events = (eventsResult.data ?? []) as unknown as ReadingEvent[];
  const dailyViews = Array.from({ length: 14 }, (_, index) => ({ date: localDay(daysAgo(13 - index)), views: 0 }));
  const dailyIndex = new Map(dailyViews.map((item, index) => [item.date, index]));
  const episodeCounts = new Map<string, { episodeId: string; workTitle: string; episodeNumber: number; episodeTitle: string; views: number }>();
  const workCounts = new Map<string, { workId: string; workTitle: string; genre: string; views: number }>();
  const visitors = new Set<string>();
  for (const event of events) {
    const dayIndex = dailyIndex.get(localDay(new Date(event.created_at)));
    if (dayIndex !== undefined) dailyViews[dayIndex].views += 1;
    visitors.add(event.user_id ?? event.visitor_id ?? event.id);
    const episode = event.episodes; const work = episode?.webtoons;
    if (!episode || !work) continue;
    const episodeCount = episodeCounts.get(event.episode_id) ?? { episodeId: event.episode_id, workTitle: work.title, episodeNumber: episode.episode_number, episodeTitle: episode.title, views: 0 };
    episodeCount.views += 1; episodeCounts.set(event.episode_id, episodeCount);
    const workCount = workCounts.get(event.webtoon_id) ?? { workId: event.webtoon_id, workTitle: work.title, genre: work.genre, views: 0 };
    workCount.views += 1; workCounts.set(event.webtoon_id, workCount);
  }
  return { totalMembers: profiles.length, newMembers: profiles.filter(profile => profile.created_at >= thirtyDaysAgo).length, totalViews: totalViewsResult.count ?? 0, activeVisitors: visitors.size, workCount: worksResult.count ?? 0, dailyViews, topEpisodes: Array.from(episodeCounts.values()).sort((left, right) => right.views - left.views).slice(0, 5), topWorks: Array.from(workCounts.values()).sort((left, right) => right.views - left.views).slice(0, 5) };
}
