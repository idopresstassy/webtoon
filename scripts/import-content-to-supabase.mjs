import mysql from "mysql2/promise";
import { createClient } from "@supabase/supabase-js";

const required = ["DATABASE_URL", "VITE_SUPABASE_URL", "SUPABASE_SECRET_KEY"];
for (const key of required) {
  if (!process.env[key]) throw new Error(`${key} 환경 변수가 필요합니다.`);
}

const source = await mysql.createConnection(process.env.DATABASE_URL);
const target = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const assetOrigin = process.env.SOURCE_ASSET_ORIGIN || "http://127.0.0.1:3000";

function safeFileName(value) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "-");
}

function sourceAssetUrl(value) {
  return value.startsWith("http") ? value : new URL(value, assetOrigin).toString();
}

async function copyAsset(sourceUrl, targetPath) {
  const response = await fetch(sourceAssetUrl(sourceUrl));
  if (!response.ok) throw new Error(`이미지를 읽을 수 없습니다: ${sourceUrl} (${response.status})`);
  const contentType = response.headers.get("content-type") || "image/jpeg";
  const body = await response.arrayBuffer();
  const { error } = await target.storage.from("webtoon-assets").upload(targetPath, body, { contentType, upsert: true });
  if (error) throw error;
  return targetPath;
}

try {
  const [works] = await source.query(`
    SELECT id, slug, title, genre, description, thumbnailUrl, thumbnailKey, isPublished, publishedAt
    FROM webtoons ORDER BY id ASC
  `);
  const [episodes] = await source.query(`
    SELECT id, webtoonId, episodeNumber, title, isPublished, publishedAt
    FROM episodes ORDER BY webtoonId ASC, episodeNumber ASC
  `);
  const [images] = await source.query(`
    SELECT episodeId, imageUrl, imageKey, sortOrder
    FROM episodeImages ORDER BY episodeId ASC, sortOrder ASC
  `);

  for (const work of works) {
    const coverName = safeFileName((work.thumbnailKey || work.thumbnailUrl || "cover").split("/").at(-1));
    const thumbnailPath = work.thumbnailUrl ? await copyAsset(work.thumbnailUrl, `covers/${work.slug}/${coverName}`) : null;
    const { data: savedWork, error: workError } = await target
      .from("webtoons")
      .upsert({
        slug: work.slug,
        title: work.title,
        genre: work.genre,
        description: work.description,
        thumbnail_path: thumbnailPath,
        is_published: Boolean(work.isPublished),
        published_at: work.publishedAt ? new Date(work.publishedAt).toISOString() : null,
      }, { onConflict: "slug" })
      .select("id, slug")
      .single();
    if (workError) throw workError;

    for (const episode of episodes.filter(item => item.webtoonId === work.id)) {
      const { data: savedEpisode, error: episodeError } = await target
        .from("episodes")
        .upsert({
          webtoon_id: savedWork.id,
          episode_number: episode.episodeNumber,
          title: episode.title,
          is_published: Boolean(episode.isPublished),
          published_at: episode.publishedAt ? new Date(episode.publishedAt).toISOString() : null,
        }, { onConflict: "webtoon_id,episode_number" })
        .select("id")
        .single();
      if (episodeError) throw episodeError;

      const currentImages = images.filter(item => item.episodeId === episode.id);
      const targetImages = [];
      for (const image of currentImages) {
        const imageName = safeFileName((image.imageKey || image.imageUrl).split("/").at(-1));
        const path = await copyAsset(image.imageUrl, `episodes/${work.slug}/${String(episode.episodeNumber).padStart(3, "0")}/${String(image.sortOrder).padStart(3, "0")}-${imageName}`);
        targetImages.push({ episode_id: savedEpisode.id, storage_path: path, sort_order: image.sortOrder });
      }
      const { error: clearError } = await target.from("episode_images").delete().eq("episode_id", savedEpisode.id);
      if (clearError) throw clearError;
      if (targetImages.length) {
        const { error: imageError } = await target.from("episode_images").insert(targetImages);
        if (imageError) throw imageError;
      }
    }
  }

  process.stdout.write(`${JSON.stringify({ success: true, works: works.length, episodes: episodes.length, images: images.length })}\n`);
} finally {
  source.destroy();
}
